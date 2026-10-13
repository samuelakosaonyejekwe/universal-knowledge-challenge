// One 3D adventure: builds the world, runs the player, the other characters and the mission, and connects
// everything the player does to the lesson (questions, key ideas, the simulation and the knowledge challenge).
import { h, rngFrom, toast, confetti, shuffle } from '../core/util.js';
import { t, tr, trInto, lang } from '../core/i18n.js';
import { save, recordAnswer, logEvent, worldId } from '../core/store.js';
import { sfx, holdMusic } from '../core/audio.js';
import { ask, rubricHits } from '../engine/quiz.js';
import { runDuel } from '../engine/duel.js';
import { duelSet, tiebreakSet, panelSet } from '../engine/content.js';
import { scheduleStage } from '../core/srs.js';
import { toEnglish } from '../core/i18n.js';
import { STAGE_REWARD, CONTEXTS } from '../data/worlds.js';
import { labsFor, mountLab } from '../views/labhost.js';
import * as labkit from '../core/labkit.js';
import { award } from '../views/ui.js';
import { THREE, sprite, glow } from '../gfx/kit3d.js';
import { createEngine } from './engine.js';
import { createPhysics, CANNON } from './physics.js';
import { createInput } from './input.js';
import { createRig } from './rig.js';
import { createController, createFollowCamera } from './player.js';
import { createNpc } from './npc.js';
import { createWorld, buildCourse, decorateWorld } from './world.js';
import { createHud } from './hud.js';

const CRYSTALS = 5, SEGMENTS = 7, TABLETS = 2;

// Text written in English inside world files: a translation shipped with the game is used when there is one
// (i18n/worlds/<language>.json); anything else is translated on the device in the background.
const cache = new Map(), shipped = {};
export async function loadWorldText() {
  if (lang === 'en' || shipped[lang]) return;
  try { const r = await fetch(`i18n/worlds/${lang}.json`); shipped[lang] = r.ok ? await r.json() : {}; } catch { shipped[lang] = {}; }
}
function tx(text) {
  if (lang === 'en' || !text) return text;
  const ready = shipped[lang]?.[text]; if (ready) return ready;
  const key = lang + '|' + text;
  if (!cache.has(key)) { cache.set(key, text); tr(text).then((o) => cache.set(key, o)).catch(() => {}); }
  return cache.get(key);
}

// opts: { wkey, world, def, level, stageN, stage (lesson), items (questions), who (cast), profile, onExit(reason) }
export function startGame(host, opts) {
  const { wkey, world: w, def, level: lv, stageN, stage, who, profile, onExit, ss, textOK } = opts;
  const qopts = { text: textOK && profile.band !== 'tiny', say: false };
  const rng = rngFrom(`g3d|${wkey}|${lv}|${stageN}`);
  const calm = profile.settings.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eng = createEngine(host, { quality: profile.settings.g3dq || 'auto', calm });
  const ui = h('div', { class: 'g3d-ui' }); host.append(ui);
  const physics = createPhysics();
  const level = createWorld(eng, physics, def, { rng });
  const k = level.kit, S = buildCourse(k, def.layout || {});
  decorateWorld(k, def, S);
  const story = def.story;

  // progress for this stage's mission is kept with the profile
  const all = (profile.notes.explore ||= {});
  const ex = (all[`${wkey}|${lv}|${stageN}`] ||= { orbs: [], sim: false, met: false, done: 0, read: [] });
  const reach = (n) => { if (n > ss.step) ss.step = n; };          // the same step counter the flat lesson pages use
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
  const doctors = who.doctors.map((d, i) => { const n = person(d, 'doctor', S.doctors[i], null, { wander: false, yaw: Math.PI }); n.full = d.name; return n; });
  const npcs = [guide, rival, ...peers, ...doctors];
  k.sign(`${stage.icon || w.em} ${tx(stage.title)}`, S.guide[0] * 0.4, 3.4, 6.2, { size: 0.55 });
  let talkingTo = null;

  // ----- HUD -----
  const hud = createHud(ui, { onExit: () => leave('menu'), onPause: () => pause() });
  const names = { guide: guide.name, rival: rival.name, crystal: tx(story.crystal) };
  function goals() {
    const got = ex.orbs.length, steps = [
      [t('Hear the lesson from {name}', { name: names.guide }), !!ss.lesson],
      [t('Read {n} tablets', { n: TABLETS }), ex.read.length >= TABLETS],
      [t('Collect {n} of {total}: {thing}', { n: Math.min(got, CRYSTALS), total: CRYSTALS, thing: tx(story.crystal) }), got >= CRYSTALS],
      [t('Run the simulation at the console'), !!ss.lab],
      [t('Explain it to {name}', { name: peers[0].name }), !!ss.explained],
      [t('Beat {name} in the Master Duel', { name: names.rival }), ss.wins > 0],
      [t('Satisfy the College of Doctors'), !!ss.done],
      [t('Step through the portal'), false],
    ];
    const now = steps.findIndex((x) => !x[1]);
    hud.goals(steps.map(([text, done], n) => ({ text, done, now: n === now })));
    hud.count(`${story.crystalEm || '💎'} ${got}/${CRYSTALS}`);
    if (level.spots.portal) level.spots.portal.open = !!ss.done;
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
  function question(item, { timed = 0, closable = true, hints = 1, label } = {}) {
    return new Promise((resolve) => {
      dbg.item = item;
      const { el, done } = ask(item, { feedback: true, hints, timed, label, context: { terms: stage.terms, mnemonic: stage.mnemonic } });
      let settled = false;
      hud.panel(t('Question'), el, { closable, onClose: () => { if (!settled) { settled = true; resolve(null); } } });
      done.then((r) => { if (settled) return; settled = true; recordAnswer(wkey, item, r.correct, { ms: r.ms, mode: 'explore' }); resolve(r); hud.closePanel(); });
    });
  }

  async function collect(o) {
    ctrl.frozen = true; rig.once('use');
    const recall = ex.orbs.length < 2, item = nextItem();
    const r = await question(item, { hints: recall ? 0 : stageN <= 3 ? 3 : stageN <= 6 ? 2 : 1 });
    ctrl.frozen = false;
    if (!r) return;
    if (r.correct) {
      o.taken = true; o.g.visible = false; ex.orbs.push(o.i); sfx('coin'); burst(o.g.position, def.theme.glow || '#ffd76a');
      rig.setFace('happy'); rig.once('cheer', () => rig.setFace('neutral'));
      if (item.d === 3 && !r.hints && !ss.hard) { ss.hard = true; award(wkey, 'hard'); }
      logEvent('explore', { w: wkey, what: 'crystal', n: ex.orbs.length });
      if (ex.orbs.length === 2) reach(4);
      if (ex.orbs.length === CRYSTALS) { ss.practice = Math.max(ss.practice || 0, 1); reach(6); hud.banner('✨ ' + t('All found!')); }
      persist(); goals();
    } else { sfx('no'); rig.setFace('sad'); setTimeout(() => rig.setFace('neutral'), 1500); hud.tip(t('Not yet. Read a tablet or ask a classmate, then try this crystal again.')); }
  }

  function readTablet(tb) {
    const terms = stage.terms || [], n = tb.i % (terms.length + 1);
    const body = h('div');
    if (n < terms.length) { body.append(trInto(h('h3'), terms[n][0]), trInto(h('p'), terms[n][1])); }
    else body.append(h('h3', null, '🧠 ', t('Memory hook')), trInto(h('p'), stage.mnemonic || stage.hook));
    if (stage.misc && n === 0) body.append(h('div', { class: 'note mt' }, h('b', null, t('Careful') + ': '), trInto(h('span'), stage.misc.right)));
    body.append(h('button', { class: 'btn sm mt', type: 'button', onClick: () => hud.closePanel() }, t('OK')));
    if (!ex.read.includes(tb.i)) { ex.read.push(tb.i); if (ex.read.length >= TABLETS) reach(3); persist(); goals(); }
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
          const first = !ex.sim; ex.sim = true; ex.simBest = Math.max(ex.simBest || 0, score); ss.lab = true; reach(5); persist(); sfx('ok');
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

  // ----- the lesson: the teacher explains in the world, with the worked example and a picture from life -----
  let analogy = 0;
  async function lesson() {
    const keys = Object.keys(stage.analogies || {}), known = (profile.experience?.contexts || []).filter((x) => keys.includes(x)), order = [...known, ...keys.filter((x) => !known.includes(x))];
    const lines = [];
    if (!ex.met) lines.push(...story.intro);
    if (!ss.lesson) lines.push(stage.hook);
    lines.push(...stage.explain);
    if (order.length) { const key = order[analogy++ % order.length], c = CONTEXTS.find((x) => x[0] === key); lines.push(`${c ? c[1] + ' ' : ''}Think of it like this. ${stage.analogies[key]}`); }
    if (stage.example && !ss.lesson) lines.push(`Let us work one through together. ${stage.example.q}`, ...stage.example.steps, `So the answer is: ${stage.example.a}`);
    if (stage.misc) lines.push(`A common mix-up: "${stage.misc.wrong}" What is really going on: ${stage.misc.right}`);
    if (!ss.lesson) lines.push(`Now make it yours. Read the tablets, find the ${CRYSTALS} ${story.crystal}, run the simulation, and explain it to ${peers[0].name}. Then the master will accept your challenge.`);
    await talkTo(guide, lines.map(tx));
    ex.met = true;
    if (!ss.lesson) { ss.lesson = true; award(wkey, 'lesson'); }
    reach(2); persist(); goals();
  }

  // ----- explain it to a classmate -----
  async function explainTo(npc) {
    const tc = stage.teach;
    await talkTo(npc, [tx(`I am stuck. Can you explain it to me? ${tc.topic}. Use an example if you can.`)]);
    ctrl.frozen = true; talkingTo = npc;
    const area = h('textarea', { class: 'input', rows: 5, placeholder: t('Explain in your own words…'), 'aria-label': t('Your explanation') });
    const out = h('div', { class: 'mt', 'aria-live': 'polite' });
    const done = () => { if (!ss.explained) { ss.explained = true; ss.ready = true; award(wkey, 'investigation'); logEvent('ready', { w: wkey, level: lv, stage: stageN }); } reach(7); persist(); goals(); npc.mood = 'happy'; hud.closePanel(); talkTo(npc, [tx('Oh! Now I see it. Thank you — you explain it better than the book.')]); };
    const check = h('button', { class: 'btn', type: 'button', onClick: async () => {
      if (area.value.trim().split(/\s+/).length < 5) return toast(t('Say a little more — at least a full sentence.'));
      check.disabled = true; out.replaceChildren();
      if (!textOK) {
        out.append(h('div', { class: 'note' }, h('b', null, t('Compare your explanation with this one') + ': '), trInto(h('span'), tc.model)), h('p', { class: 'small mt' }, t('Did yours cover the same ideas?')),
          h('div', { class: 'row' }, h('button', { class: 'btn ok', type: 'button', onClick: done }, t('Yes, mostly')), h('button', { class: 'btn ghost', type: 'button', onClick: () => { check.disabled = false; out.replaceChildren(); } }, t('Not yet — let me improve it'))));
        return;
      }
      const hits = rubricHits(await toEnglish(area.value), tc.points.map((p) => p.k)), ok = hits.filter(Boolean).length / hits.length >= 0.5;
      recordAnswer(wkey, { k: 'concept', id: `${wkey}|${lv}|${stageN}|t` }, ok);
      if (ok) return done();
      const missing = tc.points.filter((_, n) => !hits[n]);
      out.append(h('div', { class: 'note warn' }, h('b', null, t('To make it even better, also answer') + ': '), h('ul', null, missing.slice(0, 2).map((p) => trInto(h('li'), p.ask)))),
        h('details', { class: 'small mt' }, h('summary', null, t('See a model explanation')), trInto(h('p'), tc.model)),
        h('div', { class: 'row mt' }, h('button', { class: 'btn ghost sm', type: 'button', onClick: done }, t('Continue anyway'))));
      check.disabled = false;
    } }, t('Check my explanation'));
    hud.panel('🗣️ ' + t('Explain'), h('div', null, trInto(h('p', { class: 'bold' }), tc.topic), area, h('div', { class: 'row mt' }, check), out), { onClose: () => { ctrl.frozen = false; talkingTo = null; } });
    dbg.teach = tc;
  }

  // ----- the lab bench: this world's hands-on labs, used without leaving the world -----
  function openBench() {
    const labs = labsFor(worldId(wkey)); let running = null;
    const body = h('div');
    const list = () => { running?.stop(); running = null; body.replaceChildren(h('p', { class: 'small muted' }, t('Every lab says what its model leaves out.')), ...labs.map((l) => h('button', { class: 'card flat', type: 'button', style: { display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer', marginBottom: '.5rem' }, onClick: () => run(l) }, h('b', null, l.icon, ' ', tx(l.title)), h('div', { class: 'small' }, tx(l.goal))))); };
    const run = (l) => { running = mountLab(l, { wkey, level: lv, teacher: who.teacher, onComplete: () => { ss.lab = true; reach(5); persist(); goals(); } }); body.replaceChildren(h('button', { class: 'btn ghost sm mb', type: 'button', onClick: list }, '← ', t('Labs & trips')), running.el); };
    list(); ctrl.frozen = true;
    hud.panel('🧪 ' + t('Labs & trips'), body, { wide: true, onClose: () => { running?.stop(); ctrl.frozen = false; } });
  }

  // ----- the Master Duel: the official duel, shown as two bridges of light growing across the gap -----
  const gap = S.gap, segLen = (gap.z1 - gap.z0) / SEGMENTS;
  const lanes = { me: { x: S.raceStart[0], n: 0, parts: [], solids: [], color: '#3ddc97' }, them: { x: S.rivalStart[0], n: 0, parts: [], solids: [], color: '#ff6b8b' } };
  function setBridge(lane, n) {
    n = Math.max(0, Math.min(SEGMENTS, n));
    while (lane.parts.length < n) {
      const i = lane.parts.length, z = gap.z0 + segLen * (i + 0.5);
      const m = k.mesh(new THREE.BoxGeometry(1.7, 0.22, segLen * 0.96), k.lit(lane.color, 0.8, { transparent: true, opacity: 0.9 }), lane.x, gap.y - 0.11, z); m.scale.set(0.01, 1, 0.01); m.castShadow = false;
      const sld = { type: 'box', min: [lane.x - 0.85, gap.y - 0.22, z - segLen / 2], max: [lane.x + 0.85, gap.y, z + segLen / 2] };
      lane.parts.push(m); lane.solids.push(sld); level.solids.push(sld); burst(m.position, lane.color, 14);
    }
    while (lane.parts.length > n) { lane.parts.pop().removeFromParent(); const sld = lane.solids.pop(); level.solids.splice(level.solids.indexOf(sld), 1); }
    lane.n = n;
  }
  let race = null;
  if (ss.wins > 0) setBridge(lanes.me, SEGMENTS);
  const ready = () => ss.done || (ss.lesson && ex.orbs.length >= CRYSTALS && ss.lab && ss.explained);
  async function startDuel() {
    if (!ready()) { await talkTo(rival, [tx(story.notReady || 'You are not ready for me. Finish every step with your teacher first.')]); return; }
    await talkTo(rival, story.rival.map(tx));
    setBridge(lanes.me, 0); setBridge(lanes.them, 0);
    ctrl.place(S.raceStart[0], S.raceStart[1] + 0.05, S.raceStart[2], 0); rival.place(S.rivalStart[0], S.rivalStart[1], S.rivalStart[2], 0); rival.pose = null;
    race = { on: true };
    const midZ = (gap.z0 + gap.z1) / 2;
    cam.cut(new THREE.Vector3(gap.x - 14, gap.y + 5.5, midZ - 3), new THREE.Vector3(gap.x, gap.y + 0.8, midZ - 1), { dur: 1.4, hold: Infinity });
    const host = h('div');
    hud.panel('⚔️ ' + t('Master Duel'), host, { closable: false });
    const [items, tiebreak] = await Promise.all([duelSet(wkey, lv, stageN, qopts), tiebreakSet(wkey, lv, qopts)]);
    dbg.duel = items; ss.tries++; persist();
    let you = 0, them = 0;
    const res = await runDuel(host, { wkey, level: lv, items, tiebreak, master: who.master, timed: !profile.settings.untimed, voice: false,
      scene: {
        answer(youOK, themOK) { if (youOK) you++; if (themOK) them++; setBridge(lanes.me, Math.floor(you / 2)); setBridge(lanes.them, Math.floor(them / 2)); rig.setFace(youOK ? 'happy' : 'sad'); rival.mood = themOK ? 'happy' : 'sad'; if (youOK) cam.state.shake = 0.4; setTimeout(() => { rig.setFace('neutral'); rival.mood = 'neutral'; }, 1400); },
        finish() {},
      },
      before: (item) => { dbg.item = item; } });
    logEvent('duel', { w: wkey, level: lv, stage: stageN, won: res.won, you: res.you, them: res.them, timed: !profile.settings.untimed, in3d: true });
    hud.closePanel(); race.on = false;
    if (res.won) {
      const first = !ss.wins; ss.wins++; ss.best = Math.max(ss.best, res.you); if (ss.tries > 1 && first) profile.stats.retriesWon++;
      persist(); if (!calm) confetti(60);
      setBridge(lanes.me, SEGMENTS); setBridge(lanes.them, 0);
      rig.emblem.visible = true; rig.setFace('happy'); rig.once('cheer', () => rig.setFace('neutral')); rival.pose = 'sad';
      if (first) { award(wkey, 'stage', STAGE_REWARD[stageN - 1]); if (res.perfect) setTimeout(() => award(wkey, 'perfect'), 1200); } else award(wkey, 'duel');
      hud.banner('🏅 ' + t('Victory! {you} to {them}', { you: res.you, them: res.them }), 3.5);
      await new Promise((r) => setTimeout(r, 1800));
      rival.place(S.rival[0], S.rival[1], S.rival[2], Math.PI); cam.release(); race = null;
      await talkTo(rival, story.win.map(tx)); rival.pose = 'think';
      if (!ss.done) hud.tip(t('Cross your bridge. The College of Doctors is waiting on the far side.'), 8);
    } else {
      rival.pose = 'cheer'; rig.setFace('sad');
      await new Promise((r) => setTimeout(r, 1800));
      setBridge(lanes.me, ss.wins > 0 ? SEGMENTS : 0); setBridge(lanes.them, 0);
      ctrl.place(S.arena[0], S.arena[1] + 0.05, S.arena[2], 0); rival.place(S.rival[0], S.rival[1], S.rival[2], Math.PI); rival.pose = 'think'; rig.setFace('neutral');
      cam.release(); race = null;
      await talkTo(rival, [...story.lose.map(tx), tx(res.you < 50 ? `You scored ${res.you}. You need at least 50 and more than me.` : `So close: ${res.you} to ${res.them}.`)]);
      hud.tip(t('Nobody is out of this game. Hear the lesson again, practise, then challenge the master with new questions.'), 9);
    }
    goals();
  }

  // ----- the College of Doctors: three searching questions on the portal island -----
  async function college(first) {
    if (!(ss.wins > 0)) { await talkTo(first, [tx('The College hears only those who have beaten the master. Come back when your bridge is built.')]); return; }
    if (ss.done) { await talkTo(first, [tx('The College is satisfied. Your understanding runs deeper than the answers.')]); return; }
    await talkTo(first, [tx('Three doctors each ask one searching question. Answer at least two well to pass. Take your time and explain your reasoning.')]);
    ctrl.frozen = true;
    const items = await panelSet(wkey, lv, stageN, ss.panelTries || 0, qopts);
    let right = 0;
    for (let n = 0; n < items.length; n++) {
      const doc = doctors[n % doctors.length]; talkingTo = doc;
      const r = await question(items[n], { closable: false, hints: 0, label: `${doc.full} ${t('asks')}` });
      if (r?.correct) right++;
    }
    talkingTo = null; ctrl.frozen = false; ss.panelTries = (ss.panelTries || 0) + 1;
    if (right >= 2) {
      ss.panel = true; ss.done = true; save(true); scheduleStage(wkey, lv, stageN);
      if (!calm) confetti(90); sfx('win'); doctors.forEach((d) => { d.pose = 'cheer'; d.mood = 'happy'; });
      hud.banner('🎓 ' + t('Stage complete!'), 3.5);
      await talkTo(doctors[0], [tx('The College is satisfied. Your understanding runs deeper than the answers.'), tx('The portal is open. Step through when you are ready.')]);
    } else {
      persist();
      await talkTo(doctors[1], [tx('Not yet. You know the answers, but we need to hear the reasoning behind them. Read our explanations, then face us again — the questions will change.')]);
    }
    goals();
  }

  async function finish() {
    if (done) return; done = true;
    ctrl.frozen = true; ex.done++; persist(); sfx('win'); if (!calm) confetti(90);
    rig.emblem.visible = true; rig.setFace('happy'); ctrl.pose = 'cheer';
    logEvent('explore', { w: wkey, what: 'mission', level: lv, stage: stageN });
    const body = h('div', null,
      h('p', null, tx(story.outro)),
      h('p', { class: 'small muted' }, t('This stage will come back for short reviews after about 1, 3, 7, 14 and 30 days to keep it in long-term memory.')),
      h('div', { class: 'row mt' }, stageN < 9 ? h('button', { class: 'btn', type: 'button', onClick: () => leave('next') }, t('Next stage'), ' →') : h('button', { class: 'btn gold', type: 'button', onClick: () => leave('final') }, '🏆 ', t('Go to the level final')), h('button', { class: 'btn ghost', type: 'button', onClick: () => leave('done') }, t('Back to the map'))));
    hud.panel('🎓 ' + t('Stage complete!'), body, { closable: false });
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
      const end = (lane, startZ) => startZ + 0.4 + (gap.z0 - startZ - 0.9) * Math.min(1, lane.n) + Math.max(0, lane.n - 0.5) * segLen;
      const go = p[2] < end(lanes.me, S.raceStart[2]) - 0.15 ? 1 : 0;
      ctrl.frozen = false; ctrl.update(dt, { move: { x: Math.max(-1, Math.min(1, (p[0] - lanes.me.x) * 2)) * go, y: go }, run: true, jump: false, jumpPressed: false }, Math.PI); ctrl.frozen = true;
      if (rival.pos[2] < end(lanes.them, S.rivalStart[2]) - 0.1) { rival.pos[2] += 5 * dt; rival.pose = 'run'; rival.rig.speed = 1; } else if (rival.pose === 'run') rival.pose = null;
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
      offer(guide.pos[0], guide.pos[1] + 1, guide.pos[2], 2.6, ss.lesson ? t('Hear the lesson again') : t('Talk to {name}', { name: guide.name }), lesson);
      peers.forEach((n, i) => offer(n.pos[0], n.pos[1] + 1, n.pos[2], 2.4, i === 0 && ss.lesson && !ss.explained ? t('Explain it to {name}', { name: n.name }) : t('Talk to {name}', { name: n.name }), () => (i === 0 && ss.lesson && !ss.explained ? explainTo(n) : talkTo(n, [tx(hints.length ? hints[(i + (n.told = (n.told || 0) + 1)) % hints.length] : stage.hook)]))));
      offer(rival.pos[0], rival.pos[1] + 1, rival.pos[2], 2.8, t('Challenge {name}', { name: rival.name }), startDuel);
      for (const d of doctors) offer(d.pos[0], d.pos[1] + 1, d.pos[2], 2.4, t('Talk to {name}', { name: d.name }), () => college(d));
      const con = level.spots.console; offer(con.x, con.y + 1, con.z - 0.9, 1.8, t('Use the console'), openSim);
      const bn = level.spots.benchAt; offer(bn.x, bn.y + 1, bn.z - 0.8, 1.6, t('Open the lab bench'), openBench);
      const po = level.spots.portal; if (po.open && Math.hypot(p[0] - po.x, p[2] - po.z) < 1.3 && Math.abs(p[1] - po.y) < 1.5) finish();
    }
    if (hud.panelOpen) { const r = hud.panelEl.getBoundingClientRect(); if (r.width < eng.size.w * 0.8) eng.setInset(Math.round(r.width), 0); else eng.setInset(0, Math.round(Math.min(r.height, eng.size.h * 0.72))); } else eng.setInset(0, 0);
    hud.prompt(best?.[0], best?.[1]);
    if (inp.actPressed) { if (hud.talking) hud.advance?.(); else if (!hud.busy) hud.act(); }
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
  window.__ukc3d = { dbg, eng, ctrl, cam, level, hud, input, physics, ex, ss, npcs, guide, rival, peers, doctors, lanes, spots: S, get sim() { return sim; }, get race() { return race; }, openSim, startDuel, collect };
  return { dispose: () => leave(null) };
}
