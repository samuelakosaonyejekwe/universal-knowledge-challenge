// One 3D adventure: builds the world, runs the player, the other characters and the mission, and connects
// everything the player does to the lesson (questions, key ideas, the simulation and the knowledge challenge).
import { h, rngFrom, toast, confetti, shuffle } from '../core/util.js';
import { t, tr, trInto, lang } from '../core/i18n.js';
import { save, recordAnswer, logEvent } from '../core/store.js';
import { sfx, holdMusic } from '../core/audio.js';
import { ask, timeFor } from '../engine/quiz.js';
import { LEVELS } from '../data/worlds.js';
import * as labkit from '../core/labkit.js';
import { award } from '../views/ui.js';
import { THREE, sprite, glow } from '../gfx/kit3d.js';
import { createEngine } from './engine.js';
import { createPhysics, CANNON } from './physics.js';
import { createInput } from './input.js';
import { createRig } from './rig.js';
import { createController, createFollowCamera } from './player.js';
import { createNpc } from './npc.js';
import { createWorld, buildCourse } from './world.js';
import { createHud } from './hud.js';

const CRYSTALS = 5, SEGMENTS = 6;

// Text written in English inside world files is translated in the background and used from then on.
const cache = new Map();
function tx(text) {
  if (lang === 'en' || !text) return text;
  const key = lang + '|' + text;
  if (!cache.has(key)) { cache.set(key, text); tr(text).then((o) => cache.set(key, o)).catch(() => {}); }
  return cache.get(key);
}

// opts: { wkey, world, def, level, stageN, stage (lesson), items (questions), who (cast), profile, onExit(reason) }
export function startGame(host, opts) {
  const { wkey, world: w, def, level: lv, stageN, stage, who, profile, onExit } = opts;
  const rng = rngFrom(`g3d|${wkey}|${lv}|${stageN}`);
  const calm = profile.settings.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eng = createEngine(host, { quality: profile.settings.g3dq || 'auto', calm });
  const ui = h('div', { class: 'g3d-ui' }); host.append(ui);
  const physics = createPhysics();
  const level = createWorld(eng, physics, def, { rng });
  const k = level.kit, S = buildCourse(k, def.layout || {});
  def.decorate?.(k, S);
  const story = def.story;

  // progress for this stage's mission is kept with the profile
  const all = (profile.notes.explore ||= {});
  const ex = (all[`${wkey}|${lv}|${stageN}`] ||= { orbs: [], sim: false, race: false, met: false, done: 0, read: [] });
  const persist = () => save();

  // ----- characters -----
  const rig = createRig(profile.avatar, { role: 'student', band: profile.band, emblem: ex.done > 0 });
  eng.scene.add(rig.group);
  const ctrl = createController(rig, level);
  ctrl.place(S.spawn[0], S.spawn[1], S.spawn[2], 0);
  const cam = createFollowCamera(eng.camera, level, { yaw: Math.PI });
  cam.state.calm = calm;
  const input = createInput(eng.el, ui);
  const bumper = physics.kinematic(new CANNON.Sphere(0.42), [0, -50, 0]);
  const person = (p, role, at, nodes, extra = {}) => {
    const r = createRig({ seed: p.seed }, { role, band: profile.band }); eng.scene.add(r.group);
    const n = createNpc(r, level, { at, nodes, name: p.short || p.name, role, ...extra });
    const tag = sprite(n.name, { size: 0.42, font: 56, bg: 'rgba(14,18,48,.72)' }); tag.position.y = 2.0; r.group.add(tag);
    return n;
  };
  const guide = person(who.teacher, 'teacher', [S.guide[0], S.guide[1], S.guide[2]], S.homeNodes);
  const rival = person(who.master, 'master', S.rival, null, { wander: false, yaw: Math.PI }); rival.pose = 'think';
  const hints = shuffle([...(stage.terms || []).map(([a, b]) => `${a}: ${b}`), ...Object.values(stage.analogies || {}), stage.mnemonic].filter(Boolean), rng);
  const peers = [person(who.peers[0], 'peer', null, S.midNodes), person(who.peers[1], 'peer', null, S.simNodes)];
  const npcs = [guide, rival, ...peers];
  let talkingTo = null;

  // ----- HUD -----
  const hud = createHud(ui, { onExit: () => leave('menu'), onPause: () => pause() });
  const names = { guide: guide.name, rival: rival.name, crystal: tx(story.crystal) };
  function goals() {
    const got = ex.orbs.length, steps = [
      [t('Talk to {name}', { name: names.guide }), ex.met],
      [t('Collect {n} of {total}: {thing}', { n: Math.min(got, CRYSTALS), total: CRYSTALS, thing: tx(story.crystal) }), got >= CRYSTALS],
      [t('Run the simulation at the console'), ex.sim],
      [t('Win the challenge against {name}', { name: names.rival }), ex.race],
      [t('Step through the portal'), false],
    ];
    const now = steps.findIndex((s) => !s[1]);
    hud.goals(steps.map(([text, done], i) => ({ text, done, now: i === now })));
    hud.count(`${story.crystalEm || '💎'} ${got}/${CRYSTALS}`);
    if (level.spots.portal) level.spots.portal.open = ex.race;
  }
  for (const o of level.orbs) if (ex.orbs.includes(o.i)) { o.taken = true; o.g.visible = false; }

  // ----- talking -----
  async function talkTo(npc, lines, mood) {
    talkingTo = npc; ctrl.frozen = true; input.state.locked = false; if (mood) npc.mood = mood;
    rig.lookAt(new THREE.Vector3(npc.pos[0], npc.pos[1] + 1.5, npc.pos[2]));
    const mid = new THREE.Vector3((npc.pos[0] + ctrl.pos[0]) / 2, npc.pos[1] + 1.25, (npc.pos[2] + ctrl.pos[2]) / 2);
    const side = new THREE.Vector3(-(npc.pos[2] - ctrl.pos[2]), 0, npc.pos[0] - ctrl.pos[0]).normalize();
    cam.cut(mid.clone().addScaledVector(side, 4.2).add(new THREE.Vector3(0, 0.7, 0)), mid, { dur: 0.9, hold: Infinity });
    await hud.dialogue({ name: npc.name }, lines, { onLine: (i, on) => { npc.speaking = on; } });
    npc.speaking = false; talkingTo = null; ctrl.frozen = false; rig.lookAt(null); cam.release(); npc.mood = 'neutral';
  }

  // ----- questions -----
  const pool = opts.items.slice(); let qi = 0;
  const dbg = { item: null };
  const nextItem = () => pool[qi++ % pool.length];
  function question(item, { timed = 0, closable = true } = {}) {
    return new Promise((resolve) => {
      dbg.item = item;
      const { el, done } = ask(item, { feedback: true, hints: timed ? 0 : 1, timed, context: { terms: stage.terms, mnemonic: stage.mnemonic } });
      let settled = false;
      hud.panel(t('Question'), el, { closable, onClose: () => { if (!settled) { settled = true; resolve(null); } } });
      done.then((r) => { if (settled) return; settled = true; recordAnswer(wkey, item, r.correct, { ms: r.ms, mode: 'explore' }); resolve(r); hud.closePanel(); });
    });
  }

  async function collect(o) {
    ctrl.frozen = true; rig.once('use');
    const r = await question(nextItem());
    ctrl.frozen = false;
    if (!r) return;
    if (r.correct) {
      o.taken = true; o.g.visible = false; ex.orbs.push(o.i); persist(); sfx('coin'); burst(o.g.position, def.theme.glow || '#ffd76a');
      rig.setFace('happy'); rig.once('cheer', () => rig.setFace('neutral'));
      logEvent('explore', { w: wkey, what: 'crystal', n: ex.orbs.length });
      if (ex.orbs.length === CRYSTALS) hud.banner('✨ ' + t('All found! Now run the simulation.'));
      goals();
    } else { sfx('no'); rig.setFace('sad'); setTimeout(() => rig.setFace('neutral'), 1500); hud.tip(t('Not yet. Read a tablet or ask a classmate, then try this crystal again.')); }
  }

  function readTablet(tb) {
    const terms = stage.terms || [], n = tb.i % (terms.length + 1);
    const body = h('div');
    if (n < terms.length) { body.append(trInto(h('h3'), terms[n][0]), trInto(h('p'), terms[n][1])); }
    else body.append(h('h3', null, '🧠 ', t('Memory hook')), trInto(h('p'), stage.mnemonic || stage.hook));
    if (stage.misc && n === 0) body.append(h('div', { class: 'note mt' }, h('b', null, t('Careful') + ': '), trInto(h('span'), stage.misc.right)));
    body.append(h('button', { class: 'btn sm mt', type: 'button', onClick: () => hud.closePanel() }, t('OK')));
    if (!ex.read.includes(tb.i)) { ex.read.push(tb.i); persist(); }
    hud.panel('📖 ' + t('Key idea'), body);
  }

  // ----- the simulation console -----
  let sim = null, simOpen = false;
  const pad = new THREE.Group(); pad.position.set(S.pad[0], S.pad[1], S.pad[2]); pad.rotation.y = Math.PI; level.root.add(pad);
  function openSim() {
    const con = level.spots.console;
    ctrl.frozen = true; simOpen = true;
    const quiet = def.id === 10 || def.id === 14 ? holdMusic() : null;       // these simulations make sounds of their own
    rig.reach(new THREE.Vector3(con.x + 0.15, con.y + 1.08, con.z - 0.1));
    const back = 10 * Math.max(1, 1.25 / Math.max(0.45, (eng.size.w - Math.min(eng.size.w * 0.5, 432)) / eng.size.h));    // further back on narrow screens
    cam.cut(new THREE.Vector3(S.pad[0], S.pad[1] + 3.9, S.pad[2] - back), new THREE.Vector3(S.pad[0], S.pad[1] + 2.3, S.pad[2]), { dur: 1.1, hold: Infinity });
    const body = h('div', { class: 'g3d-sim' });
    const sdef = def.sim;
    const saysEl = h('div', { 'aria-live': 'polite' });
    body.append(h('p', { class: 'lab-goal' }, '🎯 ', tx(sdef.goal)), saysEl);
    const controls = h('div', { class: 'lab' }); body.append(controls);
    body.append(h('details', { class: 'small mt' }, h('summary', { class: 'bold' }, sdef.kind === 'validated' ? '📐 ' + t('Checked scientific model') : '🎈 ' + t('Simplified model'), ' — ', t('what it includes and leaves out')), h('p', { class: 'muted' }, tx(sdef.model))));
    if (!sim) {
      const ctx = {
        THREE, CANNON, group: pad, level: lv, lang: opts.lang || null, band: profile.band, rng, calm, physics, t: tx, mat: k.mat, lit: k.lit, sprite, glow,
        ui: {
          el: controls,
          // set(v) moves the control and tells the simulation, exactly as if the player had moved it
          slider: (o) => { const s = labkit.slider({ ...o, label: tx(o.label) }); controls.append(s.el); return { el: s.el, get value() { return s.value; }, set(v) { s.set(v); o.onInput?.(s.value); } }; },
          button: (label, fn, cls) => { const b = labkit.button(tx(label), fn, cls); controls.append(b); return b; },
          readout: (label, v) => { const r = labkit.readout(tx(label), v); (controls.querySelector('.g3d-reads:last-child') || controls.appendChild(h('div', { class: 'row g3d-reads' }))).append(r.el); return r; },
          choice: (options, v, fn) => {
            let cur = v; const row = h('div', { class: 'lab-row', role: 'radiogroup' });
            const draw = () => row.replaceChildren(...options.map(([val, text]) => h('button', { class: 'chip' + (val === cur ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(val === cur), onClick: () => { cur = val; draw(); fn?.(val); } }, tx(text))));
            draw(); controls.append(row);
            return { el: row, get value() { return cur; }, set(val) { cur = val; draw(); fn?.(val); } };
          },
          note: (text) => { const p = h('p', { class: 'small muted' }, tx(text)); controls.append(p); return p; },
        },
        say: (text) => { sim.says = tx(text); sim.saysEl?.replaceChildren(h('div', { class: 'note mb' }, h('b', null, guide.name + ': '), sim.says)); },
        complete(score = 1, note = '') {
          const first = !ex.sim; ex.sim = true; ex.simBest = Math.max(ex.simBest || 0, score); persist(); sfx('ok');
          logEvent('explore', { w: wkey, what: 'sim', score });
          if (first) { award(wkey, 'experiment'); rig.setFace('happy'); setTimeout(() => rig.setFace('neutral'), 2500); hud.banner('🔬 ' + t('Simulation complete!')); } else toast('✅ ' + t('Mission complete!'));
          goals();
        },
      };
      sim = { says: '', saysEl, controlsEl: controls };
      Object.assign(sim, sdef.mount(ctx) || {});
    } else { sim.saysEl = saysEl; controls.replaceWith(sim.controlsEl); if (sim.says) saysEl.replaceChildren(h('div', { class: 'note mb' }, h('b', null, guide.name + ': '), sim.says)); }
    hud.panel('🔬 ' + tx(sdef.title), body, { onClose: () => { quiet?.(); simOpen = false; ctrl.frozen = false; rig.reach(null); cam.release(); } });
  }

  // ----- the knowledge challenge: two bridges of light race across the gap -----
  const gap = S.gap, segLen = (gap.z1 - gap.z0) / SEGMENTS;
  const lanes = { me: { x: S.raceStart[0], n: 0, parts: [], solids: [], color: '#3ddc97' }, them: { x: S.rivalStart[0], n: 0, parts: [], solids: [], color: '#ff6b8b' } };
  function setBridge(lane, n) {
    n = Math.max(0, Math.min(SEGMENTS, n));
    while (lane.parts.length < n) {
      const i = lane.parts.length, z = gap.z0 + segLen * (i + 0.5);
      const m = k.mesh(new THREE.BoxGeometry(1.7, 0.22, segLen * 0.96), k.lit(lane.color, 0.8, { transparent: true, opacity: 0.9 }), lane.x, gap.y - 0.11, z); m.scale.set(0.01, 1, 0.01); m.castShadow = false;
      const s = { type: 'box', min: [lane.x - 0.85, gap.y - 0.22, z - segLen / 2], max: [lane.x + 0.85, gap.y, z + segLen / 2] };
      lane.parts.push(m); lane.solids.push(s); level.solids.push(s); burst(m.position, lane.color, 14);
    }
    while (lane.parts.length > n) { lane.parts.pop().removeFromParent(); const s = lane.solids.pop(); level.solids.splice(level.solids.indexOf(s), 1); }
    lane.n = n;
  }
  let race = null;
  if (ex.race) setBridge(lanes.me, SEGMENTS);
  async function startRace() {
    if (ex.orbs.length < CRYSTALS || !ex.sim) { await talkTo(rival, [tx(story.notReady || 'You are not ready for me. Bring every crystal and finish the simulation first.')]); return; }
    await talkTo(rival, story.rival.map(tx));
    setBridge(lanes.me, 0); setBridge(lanes.them, 0);
    ctrl.place(S.raceStart[0], S.raceStart[1] + 0.05, S.raceStart[2], 0); rival.place(S.rivalStart[0], S.rivalStart[1], S.rivalStart[2], 0); rival.pose = null;
    race = { on: true, mine: 0, theirs: 0, round: 0 };
    const midZ = (gap.z0 + gap.z1) / 2;
    cam.cut(new THREE.Vector3(gap.x - 14, gap.y + 5.5, midZ - 3), new THREE.Vector3(gap.x, gap.y + 0.8, midZ - 1), { dur: 1.4, hold: Infinity });
    const master = LEVELS[lv - 1].master;
    const score = h('div', { class: 'g3d-score' });
    const drawScore = () => score.replaceChildren(h('span', { class: 'me' }, `${profile.name} ${'▰'.repeat(race.mine)}${'▱'.repeat(SEGMENTS - race.mine)}`), h('span', { class: 'them' }, `${rival.name} ${'▰'.repeat(race.theirs)}${'▱'.repeat(SEGMENTS - race.theirs)}`));
    while (race.mine < SEGMENTS && race.theirs < SEGMENTS) {
      race.round++; drawScore();
      // strategy: a steady step, or a bold double step against a shorter clock
      const bold = await new Promise((res) => {
        const body = h('div', null, score, h('p', null, t('Choose how to build your bridge for this question.')),
          h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onClick: () => res(false) }, '🛡️ ', t('Steady: 1 piece')), h('button', { class: 'btn gold', type: 'button', onClick: () => res(true) }, '⚡ ', t('Bold: 2 pieces, less time'))),
          h('p', { class: 'small muted' }, t('A wrong bold answer costs one piece.')));
        hud.panel('⚔️ ' + t('Round {n}', { n: race.round }), body, { closable: false });
      });
      const item = nextItem();
      const r = await question(item, { timed: profile.settings.untimed ? 0 : Math.round(timeFor(item) * (bold ? 0.5 : 1)), closable: false });
      const ok = !!r?.correct, themOK = rng() < master;
      if (ok) race.mine += bold ? 2 : 1; else if (bold) race.mine -= 1;
      if (themOK) race.theirs += 1;
      race.mine = Math.max(0, Math.min(SEGMENTS, race.mine)); race.theirs = Math.min(SEGMENTS, race.theirs);
      if (race.mine >= SEGMENTS && race.theirs >= SEGMENTS) race.theirs = SEGMENTS - 1;      // the player answered first
      setBridge(lanes.me, race.mine); setBridge(lanes.them, race.theirs);
      sfx(ok ? 'ok' : 'no'); rig.setFace(ok ? 'happy' : 'sad'); rival.mood = themOK ? 'happy' : 'sad'; cam.state.shake = ok ? 0.5 : 0;
      await new Promise((res) => setTimeout(res, 1500));
      rig.setFace('neutral'); rival.mood = 'neutral';
    }
    const won = race.mine >= SEGMENTS;
    logEvent('explore', { w: wkey, what: 'race', won, rounds: race.round });
    race.on = false;
    if (won) {
      const first = !ex.race; ex.race = true; persist(); sfx('win'); if (!calm) confetti(60);
      rig.setFace('happy'); rig.once('cheer', () => rig.setFace('neutral')); rival.pose = 'sad';
      if (first) award(wkey, 'duel');
      setBridge(lanes.them, 0);
      await new Promise((res) => setTimeout(res, 1600));
      rival.place(S.rival[0], S.rival[1], S.rival[2], Math.PI); cam.release(); race = null;
      await talkTo(rival, story.win.map(tx)); rival.pose = 'think';
      hud.banner('🌉 ' + t('Your bridge is complete. The portal is open!'), 4);
    } else {
      sfx('lose'); rival.pose = 'cheer'; rig.setFace('sad');
      await new Promise((res) => setTimeout(res, 1800));
      setBridge(lanes.me, 0); setBridge(lanes.them, 0);
      ctrl.place(S.arena[0], S.arena[1] + 0.05, S.arena[2], 0); rival.place(S.rival[0], S.rival[1], S.rival[2], Math.PI); rival.pose = 'think'; rig.setFace('neutral');
      cam.release(); race = null;
      await talkTo(rival, story.lose.map(tx));
    }
    goals();
  }

  async function finish() {
    if (done) return; done = true;
    ctrl.frozen = true; ex.done++; persist(); sfx('win'); if (!calm) confetti(90);
    rig.emblem.visible = true; rig.setFace('happy'); ctrl.pose = 'cheer';
    award(wkey, 'investigation');
    logEvent('explore', { w: wkey, what: 'mission', level: lv, stage: stageN });
    const body = h('div', null,
      h('p', null, tx(story.outro)),
      h('ul', { class: 'small' }, h('li', null, `${story.crystalEm || '💎'} ${ex.orbs.length}/${CRYSTALS}`), h('li', null, '🔬 ', t('Simulation complete!')), h('li', null, '⚔️ ', t('Challenge won'))),
      h('div', { class: 'row mt' }, h('button', { class: 'btn', type: 'button', onClick: () => leave('lesson') }, '▶ ', t('Start stage {n}', { n: stageN })), h('button', { class: 'btn ghost', type: 'button', onClick: () => leave('done') }, t('Back to the world'))));
    hud.panel('🏆 ' + t('Mission complete!'), body, { closable: false });
  }
  let done = false;

  // ----- small bursts of sparks -----
  const sparks = [];
  function burst(at, color, n = 26) {
    if (calm) return;
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { pos.set([at.x, at.y, at.z], i * 3); vel.push([(Math.random() - 0.5) * 5, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 5]); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(color), size: 0.16, transparent: true, depthWrite: false })); p.frustumCulled = false;
    level.root.add(p); sparks.push({ p, vel, life: 1 });
  }

  // ----- pause -----
  function pause() {
    if (hud.menuOpen) { hud.closeMenu(); eng.pause(false); return; }
    eng.pause(true);
    const s = eng.stats;
    hud.menu({ quality: profile.settings.g3dq || 'auto', calm: cam.state.calm, stats: `${Math.round(s.fps)} fps · ${s.calls} draw calls · ${Math.round(s.triangles / 1000)}k triangles · ${s.tier}` }, {
      setQuality: (q) => { profile.settings.g3dq = q; persist(); eng.setQuality(q); },
      setCalm: (v) => { cam.state.calm = v; eng.calm = v; },
      resume: () => { hud.closeMenu(); eng.pause(false); eng.el.focus({ preventScroll: true }); },
    });
  }
  const onKey = (e) => { if ((e.code === 'Escape' || e.code === 'KeyP') && eng.paused) { e.preventDefault(); pause(); } else if ((e.code === 'Enter' || e.code === 'KeyE') && hud.talking && !/^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) hud.advance?.(); };
  window.addEventListener('keydown', onKey);

  // ----- the loop -----
  let pendingJump = false, inp = input.state, prev = [...ctrl.pos], wasBusy = false;
  eng.onFixed((dt) => {
    level.step(dt);
    const p = ctrl.pos;
    bumper.velocity.set((p[0] - prev[0]) / dt, 0, (p[2] - prev[2]) / dt); bumper.position.set(p[0], p[1] + 0.55, p[2]); prev = [p[0], p[1], p[2]];
    physics.step();
    if (race) {
      // run to the end of the bridge built so far
      const targetZ = S.raceStart[2] + 0.4 + (gap.z0 - S.raceStart[2] - 0.9) * Math.min(1, lanes.me.n) + Math.max(0, lanes.me.n - 0.5) * segLen;
      const go = p[2] < targetZ - 0.15 ? 1 : 0;
      ctrl.frozen = false; ctrl.update(dt, { move: { x: Math.max(-1, Math.min(1, (p[0] - lanes.me.x) * 2)) * go, y: go }, run: true, jump: false, jumpPressed: false }, Math.PI); ctrl.frozen = true;
      const tz = S.rivalStart[2] + 0.4 + (gap.z0 - S.rivalStart[2] - 0.9) * Math.min(1, lanes.them.n) + Math.max(0, lanes.them.n - 0.5) * segLen;
      if (rival.pos[2] < tz - 0.1) { rival.pos[2] += 5 * dt; rival.pose = 'run'; rival.rig.speed = 1; } else if (rival.pose === 'run') rival.pose = null;
    } else ctrl.update(dt, { move: inp.move, run: inp.run, jump: inp.jump, jumpPressed: pendingJump }, cam.state.yaw);
    pendingJump = false;
    for (const n of npcs) n.update(dt, p, talkingTo);
    if (simOpen) sim?.step?.(dt);
  });
  ctrl.onLand = (v) => { sfx('tap'); if (v < -14) cam.state.shake = 0.6; };
  ctrl.onRespawn = () => { hud.flash(); hud.tip(t('Careful! You are back on solid ground.')); };

  eng.onFrame((dt, time) => {
    input.state.locked = hud.busy && !race;
    inp = input.poll(dt);
    if (inp.jumpPressed) pendingJump = true;
    if (inp.pausePressed && !hud.panelOpen && !hud.talking) pause();
    const p = ctrl.pos;
    cam.update(dt, p, input.takeLook());
    physics.sync();
    level.frame(dt, time, p);
    sim?.frame?.(dt, time, simOpen);
    for (const part of [...lanes.me.parts, ...lanes.them.parts]) part.scale.lerp(ONE, Math.min(1, dt * 8));
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i], a = s.p.geometry.attributes.position; s.life -= dt * 1.1;
      for (let j = 0; j < s.vel.length; j++) { s.vel[j][1] -= 9 * dt; a.setXYZ(j, a.getX(j) + s.vel[j][0] * dt, a.getY(j) + s.vel[j][1] * dt, a.getZ(j) + s.vel[j][2] * dt); }
      a.needsUpdate = true; s.p.material.opacity = Math.max(0, s.life);
      if (s.life <= 0) { s.p.removeFromParent(); s.p.geometry.dispose(); s.p.material.dispose(); sparks.splice(i, 1); }
    }
    // what can the player do here?
    let best = null, bestD = Infinity;
    const offer = (x, y, z, range, label, fn) => { const d = Math.hypot(p[0] - x, (p[1] + 0.9 - y) * 0.6, p[2] - z); if (d < range && d < bestD) { bestD = d; best = [label, fn]; } };
    if (!hud.busy && !race && !done) {
      for (const o of level.orbs) if (!o.taken) offer(o.x, o.y, o.z, 1.9, t('Collect: {thing}', { thing: tx(story.crystal) }), () => collect(o));
      for (const tb of level.tablets) offer(tb.x, tb.y + 1, tb.z, 1.9, t('Read the tablet'), () => readTablet(tb));
      offer(guide.pos[0], guide.pos[1] + 1, guide.pos[2], 2.6, t('Talk to {name}', { name: guide.name }), async () => {
        const lines = !ex.met ? [...story.intro, stage.hook, `Find the ${CRYSTALS} ${story.crystal} — each one opens when you answer its question.`] : ex.race ? [story.afterRace || 'The portal is open. Go on — you have earned it!'] : ex.sim ? [story.afterSim] : ex.orbs.length >= CRYSTALS ? [story.afterCrystals] : [story.remind || `Keep looking for the ${story.crystal}. Read the tablets when a question is hard.`];
        await talkTo(guide, lines.map(tx)); if (!ex.met) { ex.met = true; persist(); goals(); }
      });
      peers.forEach((n, i) => offer(n.pos[0], n.pos[1] + 1, n.pos[2], 2.4, t('Talk to {name}', { name: n.name }), () => talkTo(n, [tx(hints.length ? hints[(i + (n.told = (n.told || 0) + 1)) % hints.length] : stage.hook)])));
      offer(rival.pos[0], rival.pos[1] + 1, rival.pos[2], 2.8, ex.race ? t('Talk to {name}', { name: rival.name }) : t('Challenge {name}', { name: rival.name }), () => (ex.race ? talkTo(rival, story.win.map(tx)) : startRace()));
      const con = level.spots.console; offer(con.x, con.y + 1, con.z - 0.9, 1.8, t('Use the console'), openSim);
      const po = level.spots.portal; if (po.open && Math.hypot(p[0] - po.x, p[2] - po.z) < 1.3 && Math.abs(p[1] - po.y) < 1.5) finish();
    }
    if (hud.panelOpen) { const r = hud.panelEl.getBoundingClientRect(); if (r.width < eng.size.w * 0.8) eng.setInset(Math.round(r.width), 0); else eng.setInset(0, Math.round(Math.min(r.height, eng.size.h * 0.72))); } else eng.setInset(0, 0);
    hud.prompt(best?.[0], best?.[1]);
    if (inp.actPressed && !hud.busy) hud.act();
    if (wasBusy && !hud.busy) eng.el.focus({ preventScroll: true });
    wasBusy = hud.busy;
  });
  const ONE = new THREE.Vector3(1, 1, 1);

  goals();
  eng.start(); eng.el.focus({ preventScroll: true });
  if (!ex.met) { hud.tip(input.state.device === 'touch' ? t('Use the left stick to walk. Drag the picture to look around.') : t('Walk with W A S D or the arrow keys. Press Space to jump and E to use things.'), 9); hud.banner(`${w.em} ${tx(story.title)}`, 3.5); }

  let gone = false;
  function leave(reason) {
    if (gone) return; gone = true;
    window.removeEventListener('keydown', onKey);
    try { sim?.dispose?.(); } catch (e) { console.error(e); }
    hud.dispose(); input.dispose(); npcs.forEach((n) => n.rig.dispose()); rig.dispose(); level.dispose(); eng.dispose(); ui.remove();
    delete window.__ukc3d;
    onExit?.(reason);
  }
  // for automated play-testing and profiling
  window.__ukc3d = { dbg, eng, ctrl, cam, level, hud, input, physics, ex, npcs, guide, rival, lanes, spots: S, get sim() { return sim; }, get race() { return race; }, openSim, startRace, collect };
  return { dispose: () => leave(null) };
}
