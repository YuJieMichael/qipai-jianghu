# Battle experience iteration

Base 214a5d4 (already merged and pushed main at user's explicit request). User intent remains: improve demo polish/combat/build usability; previous automatic execution and parallel-agent authorization persist. This is bounded work in existing Canvas/DOM battle flow, with no new subsystem or save schema. Proceed with the short in-chat design already communicated under automatic authorization.

## Outcomes

- Normal/2× battle presentation speed, persisted separately from player/run data. Reduced motion remains independent.
- During playback, usable skip-current-round button immediately finishes the current scene event and skips remaining presentations. Resolve/complete/settle/next automatic roll still happen exactly once. No ability to repeat attacks or bypass original exit/destroy boundaries.
- Previous-round readable report with exact dice/hand, actual damage delta, kills delta, before/after hero HP and shield, named ordered events. Reporting never invokes RNG or retains full event snapshots. Most recent report lives in controller memory, clears on start/resume/home; no new run/profile fields.
- Dice settle animation only on genuine initial/next-round or reroll changes, selection is still choose-to-replace; frozen dice never enter reroll selection. Reduced-motion suppresses rolling/motion.
- Desktop and360 UI: speed setting always usable, skip onlywhilebusy, progress text, report expand/collapse accessible without losing itself on selection render. No extra rollbutton or automaticattack.

## Work packages / ownership

A Presentation timing (agent): demo/choreography.mjs,scene.mjs,audio.mjs; NEW tests/demo-playback.test.mjs. Extend speed input and add scene.skip()/audio.stop() APIs. Test timing, skip lifecycle and reduced-motion independence.
B Interface (agent): demo/ui.mjs,style.css; NEW demo/battle-report-ui.mjs; NEW tests/demo-battle-experience-ui.test.mjs. Receives options contract below. Root never edits these files until handoff frozen.
C Controller/report integration (root): demo/main.mjs; NEW demo/battle-report.mjs; NEW tests/demo-battle-experience.test.mjs. Settings persistence, cancellation callback, skip flag/generation, exact summary calculation, passing render options and audio cue.

## Contracts

Settings.playbackSpeed numeric 1|2. Action {type:'speed'} toggles. Action {type:'skip-playback'} allowed while busy only.
createController extra onSkipPlayback callback (synchronous), invoked once on first skip request in a round; callback calls scene.skip() and audio.stop(). Event context includes playbackSpeed selected for next event, so eventDuration may prefer context.playbackSpeed over scene options. Existing injected play callbacks continue working.
createController render options playback = null|{index:oneBased,total,text,type}; opts.roundReport=null|report.
Report = {round,nodeName,hand:{name,dice:[...]},damage,kills,hero:{hpBefore,hpAfter,shieldBefore,shieldAfter},events:[{type,text,sourceName,targetNames:[...],value}]}.
createBattleReport(before,result) accepts resolveRound result {state,events}; pure, detached output; actual damage and kills are stats deltas, HP/shield are snapshot endpoints. Event targets use each event's snapshot for correct summoned enemy names. Maximum retained recent240 lightweight event entries.
renderRoundReport(report,{open=false}) pure escapedHTML. UI mayremember disclosure locally across same-report renders; clears when report changes/null. No live battle stats taken from report.
Scene eventDuration respects context.playbackSpeed or options.playbackSpeed validated to1|2. Sequence2600ms normal/1400 reducedmotion at1; half at2. scene.skip resolves active presentation once and commits that event snapshot; laterplay still works. audio.stop stopsvoiceswithoutmuting/closing.
Dice feedback root extra onDiceCue(type:'dice'|'hold'), invoked only for actual rolls/rerolls/hold changes; no RNG or simulation changes.

## Verification / delivery

TDD meaningful controller/report/timing/lifecycle regressions. Root fullsuite after integration; independently reviewed diff. Skip vsnormal must yield byte-equivalent run/profile; fresh round automaticallypick. Check exit/destroy when skip pending preserves preattacksave. CUA QA onlocalhost testprofile, preserveuser127run. Desktop+360 viewport; actual speed/skip/report interactions, console checks, nooverflow. Sourcepack/guide/verification in outputs. Commit/push feature then fast-forwardmain after approved review andpassingtests, within user's merge/continue/automaticauthorization. No forcepush, newpublichosting, paidservices, externalmessages, or changes to rootoriginalindex.
