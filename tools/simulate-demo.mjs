import {pathToFileURL} from 'node:url';
import {BALANCE, BUILDS, NODES} from '../demo/config.mjs';
import {createRun, rollDice, toggleHold, rerollDice} from '../demo/model.mjs';
import {prepareRound, selectTarget, resolveRound} from '../demo/combat.mjs';
import {enterNode, completeBattle, chooseUpgrade, chooseEvent, advanceNode} from '../demo/journey.mjs';

const triggered = (kind, value) => kind === 'sword' ? value >= 4 : kind === 'poison' ? value % 2 === 1 : value <= 3;
function validate(run) {
 const fail = message => {throw new Error(`${run.build}, RNG ${run.seed}, node ${run.nodeIndex}: ${message}`);};
 if (!NODES[run.nodeIndex]) fail('invalid node');
 if (!Number.isInteger(run.seed) || run.seed < 0 || run.seed > 0xffffffff) fail('invalid RNG');
 for (const [name, value] of Object.entries({...run.hero, ...run.stats})) {
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) fail(`invalid ${name}`);
 }
 if (run.hero.hp > run.hero.maxHp) fail('HP exceeds maximum');
 if (run.combat) {
  if (!['roll', 'pick', 'resolved'].includes(run.combat.phase)) fail('invalid combat phase');
  if (run.combat.round > 100) fail('battle exceeded 100 rounds');
  if (run.combat.phase === 'pick' && (run.combat.dice.length !== 5 || run.combat.dice.some(v => !Number.isInteger(v) || v < 1 || v > 6))) fail('invalid dice');
  for (const enemy of run.combat.enemies) {
   for (const value of [enemy.hp, enemy.maxHp, enemy.shield, enemy.stance, enemy.poison.stacks, enemy.poison.turns, enemy.intent.damage]) {
    if (!Number.isFinite(value) || value < 0) fail('invalid enemy state');
   }
   if (enemy.hp > enemy.maxHp) fail('enemy HP exceeds maximum');
  }
 }
}

/** Deterministic policy: own-build growth, heal when injured, trigger-range holds,
 * interrupt a charging boss while it has stance, otherwise focus lowest HP. */
export function playSeed(build, seed) {
 let run = enterNode(createRun(build, seed));
 const battles = [], eventCounts = {};
 let transitions = 0, ascensionTurn = null;
 while (!['victory', 'defeat'].includes(run.flow)) {
  validate(run);
  if (++transitions > 2000) throw new Error(`${build}/${seed}: non-progress transition limit`);
  const before = JSON.stringify(run);
  if (run.flow === 'battle') {
   if (run.combat.phase === 'resolved') run = prepareRound(run);
   if (run.combat.phase === 'roll') run = rollDice(run);
   if (run.combat.phase !== 'pick') throw new Error(`${build}/${seed}: battle cannot reach pick`);
   while (run.combat.rerolls > 0) {
    for (let i = 0; i < 5; i++) {
     const shouldHold = triggered(run.diceSkills[i]?.kind ?? build, run.combat.dice[i]);
     if (shouldHold !== run.combat.held[i]) run = toggleHold(run, i);
    }
    if (run.combat.held.every(Boolean)) break;
    run = rerollDice(run);
   }
   const living = run.combat.enemies.filter(e => e.hp > 0);
   const target = living.find(e => e.kind === 'boss' && e.intent.kind === 'heavy' && e.stance > 0)
    ?? [...living].sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id))[0];
   if (!target) throw new Error(`${build}/${seed}: no living target`);
   run = selectTarget(run, target.id);
   const previousTurns = run.stats.turns;
   const result = resolveRound(run);
   run = result.state;
   if (run.stats.turns !== previousTurns + 1) throw new Error(`${build}/${seed}: round did not progress`);
   for (const event of result.events) eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
   if (run.hero.hp === 0 || run.combat.enemies.every(e => e.hp === 0)) {
    battles.push({node: run.nodeIndex, turns: run.combat.round, hp: run.hero.hp});
    run = completeBattle(run);
   } else if (run.combat.round >= 100) throw new Error(`${build}/${seed}: battle exceeded 100 rounds`);
  } else if (run.flow === 'reward') {
   const choice = run.choices.find(c => c.build === build);
   if (!choice) throw new Error(`${build}/${seed}: missing own-build growth`);
   run = chooseUpgrade(run, choice.id);
   if (run.ascended && ascensionTurn === null) ascensionTurn = run.stats.turns;
  } else if (run.flow === 'event') {
   run = chooseEvent(run, run.hero.maxHp - run.hero.hp >= BALANCE.eventHeal ? 'heal' : 'train');
  } else if (run.flow === 'camp') run = advanceNode(run);
  else if (run.flow === 'intro') run = enterNode(run);
  else throw new Error(`${build}/${seed}: unknown flow ${run.flow}`);
  validate(run);
  if (before === JSON.stringify(run)) throw new Error(`${build}/${seed}: transition did not progress`);
 }
 return {build, seed, outcome: run.flow, turns: run.stats.turns, hp: run.hero.hp,
  mastery: run.mastery, ascended: run.ascended, ascensionTurn, battles, eventCounts};
}

export function simulate() {
 return Object.keys(BUILDS).map(build => {
  const runs = Array.from({length: 100}, (_, i) => playSeed(build, i + 1));
  const wins = runs.filter(r => r.outcome === 'victory').length;
  return {build, seeds: '1–100', wins, losses: 100 - wins, winRate: wins / 100,
   averageTurns: runs.reduce((n, r) => n + r.turns, 0) / 100,
   minTurns: Math.min(...runs.map(r => r.turns)), maxTurns: Math.max(...runs.map(r => r.turns)),
   masteryReached: runs.filter(r => r.mastery >= BALANCE.masteryThreshold).length,
   ascensionRate: runs.filter(r => r.ascended).length / 100,
   averageAscensionTurn: runs.filter(r => r.ascended).reduce((n, r) => n + r.ascensionTurn, 0) / (runs.filter(r => r.ascended).length || 1),
   turnCounts: runs.map(r => r.turns),
   lossesBySeed: runs.filter(r => r.outcome === 'defeat').map(r => r.seed),
   examples: runs.filter(r => [1, 42, 100].includes(r.seed))};
 });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try {console.log(JSON.stringify({policy: 'Own-build growth; heal at 35+ missing HP, otherwise train; hold each die in its skill/build trigger range; target charging boss with stance, otherwise weakest.', results: simulate()}, null, 2));}
 catch (error) {console.error(error.stack);process.exitCode = 1;}
}
