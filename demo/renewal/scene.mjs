const WIDTH = 390, HEIGHT = 844, TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = value => 1 - (1 - clamp(value)) ** 3;
const durations = {roll: 220, sword: 300, attack: 340, hurt: 300, death: 320, unlock: 340, reward: 220, heal: 280};
const columns = {hero: 0, bandit: 1, archer: 2, sentinel: 3, boss: 3};

/** Portrait battle presentation. Simulation remains entirely in model.mjs. */
export function createAdventureScene(canvas, {
  backgroundUrl = new URL('./assets/forest-path.png', import.meta.url).href,
  spritesUrl = new URL('./assets/characters-polished-v2.png', import.meta.url).href,
} = {}) {
  const context = canvas.getContext('2d');
  let state = null, dead = false, raf = 0, timer = 0, sequence = null, active = null;
  let background = null, sprites = null, spriteCrops = [], reducedMotion = false, inCallback = false;
  const completedDeaths = new Set(), pendingImages = new Set();
  const heroHealth = canvas.parentElement?.querySelector?.('.renewal-hero-health');
  const layout = {heroY: HEIGHT * .60, enemyY: HEIGHT * .34, heroHeight: .21, enemyHeight: .17, bossHeight: .185, spriteAspect: 1};
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  const began = clock();
  const schedule = callback => typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(callback) : 0;

  function load(url) {
    return new Promise(resolve => {
      if (!url || typeof globalThis.Image !== 'function') { resolve(null); return; }
      const image = new Image();
      let settled = false;
      const settle = result => {
        if (settled) return;
        settled = true; image.onload = null; image.onerror = null;
        pendingImages.delete(cancel); resolve(result);
      };
      const cancel = () => settle(null);
      pendingImages.add(cancel);
      image.onload = () => settle(image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null);
      image.onerror = () => settle(null);
      try { image.src = url; } catch { settle(null); }
    });
  }
  const ready = Promise.all([load(backgroundUrl), load(spritesUrl)]).then(([forest, characters]) => {
    if (!dead) { background = forest; sprites = characters; spriteCrops = cropSprites(characters); }
  });

  function cropSprites(image) {
    if (!image) return [];
    const cellWidth = image.naturalWidth / 4, imageHeight = image.naturalHeight;
    const full = Array.from({length: 4}, (_, column) => ({x: column * cellWidth, y: 0, width: cellWidth, height: imageHeight}));
    // Inspect alpha once, never during animation. Cross-origin or unavailable
    // pixel access safely falls back to the declared equal-width cells.
    try {
      const scratch = typeof globalThis.OffscreenCanvas === 'function' ? new OffscreenCanvas(Math.ceil(cellWidth), imageHeight) : globalThis.document?.createElement?.('canvas');
      if (!scratch) return full;
      scratch.width = Math.ceil(cellWidth); scratch.height = imageHeight;
      const reader = scratch.getContext('2d', {willReadFrequently: true});
      if (!reader?.getImageData) return full;
      return full.map(cell => {
        reader.clearRect?.(0, 0, scratch.width, scratch.height);
        reader.drawImage(image, cell.x, 0, cell.width, cell.height, 0, 0, scratch.width, scratch.height);
        const {data} = reader.getImageData(0, 0, scratch.width, scratch.height);
        let left = scratch.width, right = -1, top = scratch.height, bottom = -1;
        for (let y = 0; y < scratch.height; y++) for (let x = 0; x < scratch.width; x++) {
          if (data[(y * scratch.width + x) * 4 + 3] <= 24) continue;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right < left || bottom < top) return cell;
        const ratio = cell.width / scratch.width;
        return {x: cell.x + left * ratio, y: top, width: (right - left + 1) * ratio, height: bottom - top + 1};
      });
    } catch { return full; }
  }

  function ellipse(x, y, rx, ry, fill, stroke, width = 1) {
    context.beginPath(); context.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU);
    if (fill) { context.fillStyle = fill; context.fill(); }
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = width; context.stroke(); }
  }
  function line(points, color, width = 2) {
    context.beginPath();
    points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
    context.strokeStyle = color; context.lineWidth = width; context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
  }
  function polygon(points, color) {
    context.beginPath(); points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath(); context.fillStyle = color; context.fill();
  }
  function actorList() {
    const enemies = state?.enemies || [];
    const positions = enemies.length <= 1 ? [.5] : enemies.length === 2 ? [.28, .72] : [.24, .5, .76];
    return [...enemies.map((enemy, index) => ({...enemy, x: (positions[index] ?? .5) * WIDTH, y: layout.enemyY})),
      {id: 'hero', kind: 'hero', ...(state?.hero || {hp: 1}), x: WIDTH * .5, y: layout.heroY}];
  }
  function findActor(id) { return actorList().find(actor => actor.id === id); }
  function targetOf(event) { return event?.target ?? (event?.type === 'death' ? event.source : null); }
  // seed is mutable RNG state, so encounter identity uses its stable stage/actor IDs.
  function battleKey(value) { return value ? JSON.stringify([value.stage, (value.enemies || []).map(enemy => enemy.id)]) : ''; }
  function applyState(next, settled = false) {
    if (!next) return;
    const changed = battleKey(next) !== battleKey(state);
    if (changed) completedDeaths.clear();
    state = next;
    for (const actor of actorList()) {
      if (actor.hp > 0) completedDeaths.delete(actor.id);
      else if (settled) completedDeaths.add(actor.id);
    }
  }
  function update(next, options = {}) {
    if (dead || !next) return;
    if (Object.hasOwn(options, 'reducedMotion')) reducedMotion = Boolean(options.reducedMotion);
    if (sequence && !inCallback && battleKey(next) !== battleKey(state)) cancelPlayback();
    applyState(next, !sequence);
  }
  function backdrop() {
    if (background) {
      const imageWidth = background.naturalWidth, imageHeight = background.naturalHeight;
      const cropWidth = Math.min(imageWidth, imageHeight * WIDTH / HEIGHT);
      const cropHeight = Math.min(imageHeight, imageWidth * HEIGHT / WIDTH);
      context.drawImage(background, (imageWidth - cropWidth) / 2, (imageHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, WIDTH, HEIGHT);
      return;
    }
    // A light, quiet fallback keeps texture errors independent from game rules.
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#8dc6a0'); gradient.addColorStop(.6, '#d5e3b3'); gradient.addColorStop(1, '#567a50');
    context.fillStyle = gradient; context.fillRect(0, 0, WIDTH, HEIGHT);
    polygon([[WIDTH * .45, 100], [WIDTH * .56, 100], [WIDTH, HEIGHT], [0, HEIGHT]], '#c6cba0');
    for (let index = 0; index < 9; index++) {
      const y = 160 + index * 74, spread = 28 + index * 13;
      line([[WIDTH / 2 - spread, y], [WIDTH / 2 + spread, y + 3]], '#8a9f7b88', 2);
    }
  }
  function actorPose(actor, progress, time) {
    const pose = {x: actor.x, y: actor.y, scale: 1, alpha: 1};
    const event = active?.event;
    if (completedDeaths.has(actor.id)) { pose.alpha = 0; return pose; }
    if (!reducedMotion) pose.scale += Math.sin(time * 1.65 + actor.x * .03) * .006;
    if (!event) return pose;
    const targetId = targetOf(event), isSource = actor.id === event.source, isTarget = actor.id === targetId;
    if (event.type === 'death' && isTarget) {
      pose.alpha *= 1 - ease(progress);
      if (!reducedMotion) { pose.y += 10 * ease(progress); pose.scale *= 1 - progress * .05; }
    }
    if (reducedMotion) return pose;
    if (isSource && (event.type === 'attack' || event.type === 'hurt')) {
      const target = findActor(targetId), pulse = Math.sin(clamp(progress / .78) * Math.PI);
      if (target) { const dx = target.x - actor.x, dy = target.y - actor.y, distance = Math.hypot(dx, dy) || 1;
        const reach = (event.type === 'attack' ? 43 : 32) * pulse;
        pose.x += dx / distance * reach; pose.y += dy / distance * reach; pose.scale += pulse * .025;
      }
    }
    if (isTarget && ['sword', 'attack', 'hurt'].includes(event.type) && progress > .42 && progress < .85) {
      const impact = (progress - .42) / .43;
      pose.x += Math.sin(impact * Math.PI * 4) * (1 - impact) * 3;
    }
    return pose;
  }
  function drawActor(actor, progress, time) {
    const pose = actorPose(actor, progress, time);
    if (pose.alpha <= .003) return;
    const height = HEIGHT * (actor.id === 'hero' ? layout.heroHeight : actor.kind === 'boss' || actor.kind === 'sentinel' ? layout.bossHeight : layout.enemyHeight) * pose.scale;
    const column = columns[actor.kind] ?? 1;
    const crop = spriteCrops[column];
    const sourceWidth = crop?.width || (sprites ? sprites.naturalWidth / 4 : 400);
    const sourceHeight = crop?.height || (sprites ? sprites.naturalHeight : 600);
    // Positions use a normalized battlefield, but artwork keeps its own aspect
    // after the viewport's independent horizontal and vertical transforms.
    const width = height * sourceWidth / sourceHeight * layout.spriteAspect;
    context.save(); context.globalAlpha = pose.alpha;
    ellipse(pose.x, actor.y + height * .46, Math.max(19, width * .36), 6.5, '#173c2848');
    if (sprites) {
      context.drawImage(sprites, crop?.x ?? column * sourceWidth, crop?.y ?? 0, sourceWidth, sourceHeight,
        pose.x - width / 2, pose.y - height / 2, width, height);
    } else {
      const tint = actor.id === 'hero' ? '#f4eee0' : actor.kind === 'archer' ? '#4e7357' : '#8f5a44';
      polygon([[pose.x - 13, pose.y + 36], [pose.x - 10, pose.y - 15], [pose.x + 10, pose.y - 15], [pose.x + 17, pose.y + 36]], tint);
      ellipse(pose.x, pose.y - 28, 11, 13, '#dbb78c');
      line([[pose.x + 12, pose.y - 4], [pose.x + 26, pose.y - 31]], '#e6e5cb', 3);
    }
    context.restore();
    if (state?.targetId === actor.id && actor.hp > 0) {
      context.save(); context.globalAlpha = .72;
      ellipse(actor.x, actor.y + height * .49, width * .46, 8, null, '#ffe7a1', 1.5); context.restore();
    }
  }
  function impact(x, y, progress, tint) {
    const burst = clamp((progress - .4) / .6);
    if (progress < .4) return;
    context.save(); context.globalAlpha *= (1 - burst) * .95;
    ellipse(x, y, 9 + burst * 28, 5 + burst * 15, null, tint, 2.5);
    for (let index = 0; index < 7; index++) {
      const angle = index * TAU / 7 + .2, radius = 7 + burst * (reducedMotion ? 10 : 35);
      line([[x + Math.cos(angle) * radius, y + Math.sin(angle) * radius], [x + Math.cos(angle) * (radius + 9), y + Math.sin(angle) * (radius + 9)]], tint, 2);
    }
    context.restore();
  }
  function sword(source, target, progress) {
    const travel = ease(clamp((progress - .04) / .57));
    const x = source.x + (target.x - source.x) * travel;
    const y = source.y + (target.y - source.y) * travel;
    if (!reducedMotion && progress < .72) {
      const dx = target.x - source.x, dy = target.y - source.y, distance = Math.hypot(dx, dy) || 1;
      const vx = dx / distance, vy = dy / distance, px = -vy, py = vx;
      context.save(); context.globalAlpha = Math.min(1, progress * 9, (1 - progress) * 4);
      line([[x - vx * 57, y - vy * 57], [x - vx * 12, y - vy * 12]], '#72e3c5aa', 9);
      line([[x - vx * 50, y - vy * 50], [x - vx * 7, y - vy * 7]], '#e8fff0', 3);
      polygon([[x + vx * 27, y + vy * 27], [x - vx * 14 + px * 4, y - vy * 14 + py * 4], [x - vx * 22, y - vy * 22], [x - vx * 14 - px * 4, y - vy * 14 - py * 4]], '#f9fff1');
      line([[x - vx * 22 - px * 8, y - vy * 22 - py * 8], [x - vx * 22 + px * 8, y - vy * 22 + py * 8]], '#ffe4a5', 3);
      context.restore();
    }
    impact(target.x, target.y - 8, progress, '#efffe0');
  }
  function effects(progress) {
    if (!active) return;
    const event = active.event, target = findActor(targetOf(event)), source = findActor(event.source || 'hero');
    context.save();
    if (event.type === 'sword' && source && target) sword(source, target, progress);
    if (['attack', 'hurt'].includes(event.type) && source && target) {
      context.globalAlpha = Math.sin(progress * Math.PI);
      context.strokeStyle = event.type === 'hurt' ? '#ffdcac' : '#fcffd4'; context.lineWidth = reducedMotion ? 2 : 5;
      context.beginPath(); context.ellipse(target.x, target.y - 5, reducedMotion ? 19 : 35, reducedMotion ? 25 : 47, -.6, -.9 + progress * 1.6, 1.6 + progress * 1.6); context.stroke();
      impact(target.x, target.y - 8, progress, event.type === 'hurt' ? '#ffe2b7' : '#fff5b6');
    }
    if (event.type === 'death' && target) {
      context.globalAlpha = Math.sin(progress * Math.PI) * .7;
      for (let index = 0; index < 9; index++) {
        const spread = reducedMotion ? 12 : 12 + progress * 26, angle = index * 2.4;
        ellipse(target.x + Math.cos(angle) * spread, target.y + Math.sin(angle) * spread - (reducedMotion ? 0 : progress * 16), 1.4, 2.4, '#edfff0');
      }
    }
    if (['unlock', 'heal', 'roll'].includes(event.type)) {
      const actor = target || source || findActor('hero');
      if (actor) {
        const tint = event.type === 'unlock' ? '#fff2a2' : event.type === 'heal' ? '#b6ffc1' : '#d5ffe9';
        context.globalAlpha = Math.sin(progress * Math.PI) * .75;
        const radius = reducedMotion ? 31 : 24 + ease(progress) * 24;
        ellipse(actor.x, actor.y + 31, radius, radius * .32, null, tint, 2);
        if (event.type !== 'roll') for (let index = 0; index < 6; index++) {
          const angle = index * TAU / 6, x = actor.x + Math.cos(angle) * radius, y = actor.y + Math.sin(angle) * radius * .7;
          line([[x - 3, y], [x + 3, y]], tint, 1.5); line([[x, y - 3], [x, y + 3]], tint, 1.5);
        }
      }
    }
    context.restore();
  }
  function readout(progress) {
    if (!active || !['sword', 'attack', 'hurt', 'heal'].includes(active.event.type)) return;
    const event = active.event, target = findActor(targetOf(event) || (event.type === 'heal' ? 'hero' : null));
    if (!target || !Number.isFinite(event.amount) || event.amount <= 0 || progress < .27) return;
    const label = `${event.type === 'heal' ? '+' : '−'}${Math.round(event.amount)}`;
    const alpha = Math.min(1, (progress - .27) * 8, (1 - progress) * 7);
    const y = target.y - 48 - (reducedMotion ? 0 : ease(clamp((progress - .27) / .73)) * 15);
    context.save(); context.globalAlpha = alpha; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = '800 27px Georgia, serif';
    const width = Math.max(43, context.measureText(label).width + 18);
    context.fillStyle = '#153a2ede'; context.fillRect(target.x - width / 2, y - 18, width, 35);
    context.strokeStyle = '#203e2b'; context.lineWidth = 3; context.strokeText(label, target.x, y);
    context.fillStyle = event.type === 'heal' ? '#d3ffd3' : event.type === 'hurt' ? '#ffe0bd' : '#fff6cd'; context.fillText(label, target.x, y);
    context.restore();
  }
  function finishEvent(current) {
    if (dead || active !== current || !sequence || sequence !== current.sequence) return;
    clearTimeout(timer); timer = 0;
    const running = sequence;
    active = null;
    if (current.event.type === 'death') completedDeaths.add(targetOf(current.event));
    applyState(current.event.snapshot);
    if (current.event.snapshot && running.onFrame) {
      inCallback = true;
      try { running.onFrame(current.event.snapshot); }
      finally { inCallback = false; }
    }
    if (dead || sequence !== running) return;
    running.index++;
    startEvent(running);
  }
  function startEvent(running) {
    if (dead || sequence !== running) return;
    if (running.index >= running.events.length) {
      sequence = null; active = null; running.resolve(); return;
    }
    const event = running.events[running.index];
    const duration = reducedMotion ? Math.min(durations[event.type] || 220, 240) : durations[event.type] || 220;
    const current = {event, time: clock(), duration, sequence: running};
    active = current;
    timer = setTimeout(() => finishEvent(current), duration);
  }
  function cancelPlayback() {
    clearTimeout(timer); timer = 0; active = null;
    const previous = sequence; sequence = null; previous?.resolve();
  }
  function frame(now) {
    if (dead) return;
    const rect = canvas.getBoundingClientRect?.() || {};
    const viewportHeight = rect.height || HEIGHT;
    layout.enemyY = HEIGHT * (viewportHeight <= 700 ? .29 : .34);
    layout.heroHeight = viewportHeight <= 700 ? .18 : .21;
    layout.enemyHeight = viewportHeight <= 700 ? .15 : .17;
    layout.bossHeight = viewportHeight <= 700 ? .165 : .185;
    layout.heroY = HEIGHT * .60;
    const healthTop = heroHealth?.getBoundingClientRect?.().top;
    if (Number.isFinite(healthTop)) {
      const healthY = (healthTop - (rect.top || 0)) / viewportHeight * HEIGHT;
      if (healthY > 0 && healthY < HEIGHT) layout.heroY = Math.min(layout.heroY, healthY - layout.heroHeight * HEIGHT * .5 - 8 / viewportHeight * HEIGHT);
    }
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1), width = Math.max(1, Math.round((rect.width || WIDTH) * dpr));
    const height = Math.max(1, Math.round((rect.height || HEIGHT) * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    layout.spriteAspect = (height / HEIGHT) / (width / WIDTH);
    context.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const current = active, progress = current ? clamp((now - current.time) / current.duration) : 0;
    const time = reducedMotion ? 0 : (now - began) / 1000;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.save();
    if (!reducedMotion && current && ['sword', 'attack', 'hurt'].includes(current.event.type)) {
      const bump = Math.sin(clamp((progress - .36) / .35) * Math.PI), target = findActor(targetOf(current.event));
      const cameraX = target ? clamp(target.x / WIDTH) - .5 : 0;
      const zoom = 1 + bump * .009;
      context.translate(WIDTH * .5 - cameraX * bump * 3, HEIGHT * .42 - bump * 1.5);
      context.scale(zoom, zoom); context.translate(-WIDTH * .5, -HEIGHT * .42);
    }
    backdrop();
    if (state) for (const actor of actorList()) drawActor(actor, progress, time);
    effects(progress); context.restore(); readout(progress);
    if (current && now - current.time >= current.duration) finishEvent(current);
    if (!dead) raf = schedule(frame);
  }
  raf = schedule(frame);
  return {
    ready, update,
    play(events, {reducedMotion: quiet = false, onFrame} = {}) {
      cancelPlayback();
      if (dead || !Array.isArray(events) || events.length === 0) return Promise.resolve();
      reducedMotion = Boolean(quiet);
      return new Promise(resolve => {
        const running = {events: events.filter(event => event && typeof event.type === 'string'), index: 0, onFrame, resolve};
        sequence = running; startEvent(running);
      });
    },
    destroy() {
      if (dead) return;
      dead = true; cancelPlayback();
      if (raf && typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(raf);
      for (const cancel of [...pendingImages]) cancel();
      state = null; background = null; sprites = null; spriteCrops = []; completedDeaths.clear();
    },
  };
}
