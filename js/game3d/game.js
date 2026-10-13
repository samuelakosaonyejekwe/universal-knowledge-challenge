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
import { groundBelow, rayCast } from './collide.js';
import { picturesFor } from './picture.js';
import { wikiSummary } from '../core/live.js';
import { can } from '../core/safety.js';
import { live, clearLive } from '../core/live3d.js';

const CRYSTALS = 5, SEGMENTS = 7, TABLETS = 2;

// Text written in English inside world files: a translation shipped with the game is used when there is one
// (i18n/worlds/<language>.json); anything else is translated on the device in the background.
const cache = new Map(), shipped = {}, english = new Map();     // english: translated line → the English it came from
export async function loadWorldText() {
  if (lang === 'en' || shipped[lang]) return;
  try { const r = await fetch(`i18n/worlds/${lang}.json`); shipped[lang] = r.ok ? await r.json() : {}; } catch { shipped[lang] = {}; }
}
function tx(text) {
  if (lang === 'en' || !text) return text;
  const ready = shipped[lang]?.[text]; if (ready) { english.set(ready, text); return ready; }
  const key = lang + '|' + text;
  if (!cache.has(key)) { cache.set(key, text); tr(text).then((o) => { cache.set(key, o); english.set(o, text); }).catch(() => {}); }
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
  const sparks = [];

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
  const titleSign = k.sign(`${stage.icon || w.em} ${tx(stage.title)}`, S.guide[0] * 0.4, 3.4, 6.2, { size: 0.55 });
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

  // ----- the projector: whatever is being talked about is shown, not just said -----
  // A screen stands beside the speakers. For each line it shows large pictures of the things mentioned (and their
  // names), a photograph from the lesson's own encyclopedia sources when the device is online, and the same things
  // drift past in the air. A line with nothing to picture shows the lesson's symbol and the key word it is about.
  const show = { group: null, tex: null, g2: null, photos: [], flyers: [] };
  function projector() {
    if (show.group) return show;
    const g = new THREE.Group(), c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    show.g2 = c.getContext('2d'); show.tex = new THREE.CanvasTexture(c); show.tex.colorSpace = THREE.SRGBColorSpace; show.tex.anisotropy = 8;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.56, 2.06, 0.1), k.mat(def.theme.metal || '#39406b', { metalness: 0.4, roughness: 0.4 })); frame.position.y = 2.25; frame.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), new THREE.MeshBasicMaterial({ map: show.tex, toneMapped: false })); face.position.set(0, 2.25, 0.056);
    for (const sx of [-1.5, 1.5]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 8), k.mat(def.theme.metal || '#39406b')); leg.position.set(sx, 0.65, 0); g.add(leg); }
    const lampGlow = glow(def.theme.glow || '#ffd76a', 5.5, 0.22); lampGlow.position.set(0, 2.25, 0.3);
    g.add(frame, face, lampGlow); g.visible = false; level.root.add(g); show.group = g;
    return show;
  }
  function showLine(line) {
    const src = english.get(line) || line, pics = picturesFor(src), g2 = projector().g2, W = 1280, H = 720;
    const bg = g2.createLinearGradient(0, 0, W, H); bg.addColorStop(0, w.c1); bg.addColorStop(1, w.c2); g2.fillStyle = bg; g2.fillRect(0, 0, W, H);
    g2.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 7; i++) { g2.beginPath(); g2.arc((i * 211) % W, (i * 137) % H, 60 + (i * 37) % 90, 0, 7); g2.fill(); }
    const photo = show.photos.find((ph) => ph.words.some((x) => src.toLowerCase().includes(x))) || (show.photos.length && pics.length < 2 ? show.photos[show.n++ % show.photos.length] : null);
    const left = photo ? W * 0.56 : W;
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    if (pics.length) {
      const size = Math.min(300, (left - 80) / pics.length * 0.82), gapX = left / pics.length;
      pics.forEach((pc, i) => { const x = gapX * (i + 0.5); g2.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; g2.fillText(pc.em, x, H * 0.43); g2.font = `800 ${Math.min(64, size * 0.24)}px ui-rounded, system-ui, sans-serif`; g2.fillStyle = '#fff'; g2.shadowColor = 'rgba(0,0,0,.45)'; g2.shadowBlur = 10; g2.fillText(tx(pc.word), x, H * 0.43 + size * 0.68, gapX - 24); g2.shadowBlur = 0; });
    } else {
      // nothing to picture: the lesson's own symbol and the key word this line is closest to
      const terms = stage.terms || [], term = terms.find(([a]) => src.toLowerCase().includes(String(a).toLowerCase())) || terms[show.n++ % Math.max(1, terms.length)];
      g2.font = '260px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; g2.fillText(stage.icon || w.em, left / 2, H * 0.38);
      if (term) { g2.fillStyle = '#fff'; g2.shadowColor = 'rgba(0,0,0,.45)'; g2.shadowBlur = 10; g2.font = '800 70px ui-rounded, system-ui, sans-serif'; g2.fillText(tx(term[0]), left / 2, H * 0.72, left - 60); g2.font = '600 34px ui-rounded, system-ui, sans-serif'; g2.fillText(tx(term[1]), left / 2, H * 0.84, left - 60); g2.shadowBlur = 0; }
    }
    if (photo) {
      const pw = W * 0.4, phh = H * 0.76, px = W * 0.57, py = H * 0.08, im = photo.img, sc = Math.max(pw / im.width, phh / im.height), sw = pw / sc, sh = phh / sc;
      g2.fillStyle = '#fff'; g2.fillRect(px - 10, py - 10, pw + 20, phh + 74);
      try { g2.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, px, py, pw, phh); } catch { /* picture not usable */ }
      g2.fillStyle = '#1c2340'; g2.font = '700 30px ui-rounded, system-ui, sans-serif'; g2.fillText(photo.title, px + pw / 2, py + phh + 32, pw);
    }
    show.tex.needsUpdate = true;
    // the same things drift past in the air above the speakers
    if (!calm && pics.length && show.group.visible) pics.forEach((pc, i) => { const sp = sprite(pc.em, { size: 0.95 }); const G = show.group; sp.position.set(G.position.x, G.position.y + 4.2 + i * 0.35, G.position.z); level.root.add(sp); show.flyers.push({ sp, t: -i * 0.35, from: -4 - i, y: G.position.y + 4.1 + (i % 2) * 0.6, yaw: G.rotation.y }); });
  }
  // photographs for this stage, fetched once (only when live content is allowed and the device is online)
  let photosAsked = false;
  function loadPhotos() {
    if (photosAsked || !navigator.onLine || profile.settings.live === false || !can('live')) return; photosAsked = true; show.n = 0;
    for (const title of (stage.sources || []).slice(0, 3)) wikiSummary(title).then((it) => { if (!it?.img) return; const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => show.photos.push({ img: im, title: it.title || title, words: String(title).toLowerCase().split(/\s+/).filter((x) => x.length > 3) }); im.src = it.img; }).catch(() => {});
  }

  // ----- talking -----
  async function talkTo(npc, lines, mood) {
    talkingTo = npc; ctrl.frozen = true; input.state.locked = false; if (mood) npc.mood = mood;
    rig.lookAt(new THREE.Vector3(npc.pos[0], npc.pos[1] + 1.5, npc.pos[2]));
    const mid = new THREE.Vector3((npc.pos[0] + ctrl.pos[0]) / 2, npc.pos[1] + 1.25, (npc.pos[2] + ctrl.pos[2]) / 2);
    const side = new THREE.Vector3(-(npc.pos[2] - ctrl.pos[2]), 0, npc.pos[0] - ctrl.pos[0]).normalize();
    // the projector stands behind the two of them, facing the camera
    const P = projector(); P.group.position.set(mid.x - side.x * 2.4, Math.min(npc.pos[1], ctrl.pos[1]) + 0.35, mid.z - side.z * 2.4); P.group.rotation.y = Math.atan2(side.x, side.z); P.group.visible = true;
    cam.cut(mid.clone().addScaledVector(side, 6.2).add(new THREE.Vector3(0, 1.2, 0)), mid.clone().add(new THREE.Vector3(0, 0.75, 0)), { dur: 0.9, hold: Infinity });
    await hud.dialogue({ name: npc.name }, lines, { onLine: (i, on) => { npc.speaking = on; if (on) showLine(lines[i]); } });
    P.group.visible = false; for (const f of show.flyers) f.sp.removeFromParent(); show.flyers.length = 0;
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

  // ----- simulations: the world's own (at the console) and the 3D labs (at the bench) share one floor -----
  const sims = new Map();           // key → { group, sim, controls, says, taps }
  let sim = null, simOpen = false, open = null, padSolid = null;
  const padRoot = new THREE.Group(); padRoot.position.set(S.pad[0], S.pad[1], S.pad[2]); padRoot.rotation.y = Math.PI; level.root.add(padRoot);
  function openSimDef(sdef, key) {
    const con = level.spots.console;
    ctrl.frozen = true; simOpen = true;
    const quiet = def.id === 10 || def.id === 14 ? holdMusic() : null;       // these make sounds of their own
    rig.reach(new THREE.Vector3(con.x + 0.15, con.y + 1.08, con.z - 0.1));
    const back = 10 * Math.max(1, 1.25 / Math.max(0.45, (eng.size.w - Math.min(eng.size.w * 0.5, 432)) / eng.size.h));    // further back on narrow screens
    free = false; hud.looking(false);
    cam.orbitAt(new THREE.Vector3(S.pad[0], S.pad[1] + 2.3, S.pad[2]), { yaw: Math.PI, pitch: 0.16, dist: back, min: 3.5, max: 26 });     // drag or use the view pad to circle the simulation
    const body = h('div', { class: 'g3d-sim' });
    const saysEl = h('div', { 'aria-live': 'polite' });
    body.append(h('p', { class: 'lab-goal' }, '🎯 ', tx(sdef.goal)), saysEl);
    let inst = sims.get(key);
    for (const other of sims.values()) other.group.visible = false;
    if (!inst) {
      const group = new THREE.Group(); padRoot.add(group);
      const controls = h('div', { class: 'lab' });
      inst = { group, controls, says: '', saysEl, taps: [], sim: {} }; sims.set(key, inst);
      const me = inst;
      const ctx = {
        THREE, CANNON, group, level: lv, lang: opts.lang || null, band: profile.band, rng, calm, physics, t: tx, mat: k.mat, lit: k.lit, sprite, glow,
        onTap: (object, fn) => { me.taps.push({ object, fn }); },
        ui: {
          el: controls,
          // set(v) moves the control and tells the simulation, exactly as if the player had moved it
          slider: (o) => { const sl = labkit.slider({ ...o, label: tx(o.label) }); controls.append(sl.el); return { el: sl.el, get value() { return sl.value; }, set(v) { sl.set(v); o.onInput?.(sl.value); } }; },
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
        say: (text) => { me.says = tx(text); me.saysEl?.replaceChildren(h('div', { class: 'note mb' }, h('b', null, guide.name + ': '), me.says)); },
        complete(score = 1) {
          const first = !ex.sims?.[key]; (ex.sims ||= {})[key] = Math.max(ex.sims[key] || 0, score); ex.sim = true; ss.lab = true; reach(5); persist(); sfx('ok');
          logEvent('explore', { w: wkey, what: 'sim', id: key, score });
          if (first) { award(wkey, 'experiment'); rig.setFace('happy'); setTimeout(() => rig.setFace('neutral'), 2500); hud.banner('🔬 ' + t('Simulation complete!')); } else toast('✅ ' + t('Mission complete!'));
          goals();
        },
      };
      try { Object.assign(inst.sim, sdef.mount(ctx) || {}); } catch (e) { console.error(e); controls.append(h('div', { class: 'note bad' }, t('This lab could not start on this device.'))); }
    } else { inst.saysEl = saysEl; if (inst.says) saysEl.replaceChildren(h('div', { class: 'note mb' }, h('b', null, guide.name + ': '), inst.says)); }
    inst.group.visible = true; open = inst; sim = inst.sim;
    // what stands on the simulation floor is solid too (walked round, not through)
    { level.root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(inst.group), cx = S.pad[0], cz = S.pad[2];
      if (!padSolid) { padSolid = { type: 'box', min: [0, 0, 0], max: [0, 0, 0], scenery: true }; level.solids.push(padSolid); }
      padSolid.min = [Math.max(cx - 3.7, bb.min.x), S.pad[1], Math.max(cz - 3.0, bb.min.z)]; padSolid.max = [Math.min(cx + 3.7, bb.max.x), Math.max(S.pad[1] + 0.5, Math.min(S.pad[1] + 5, bb.max.y)), Math.min(cz + 3.0, bb.max.z)];
      if (!(padSolid.max[0] > padSolid.min[0] && padSolid.max[2] > padSolid.min[2])) { padSolid.min = [cx, S.pad[1], cz]; padSolid.max = [cx, S.pad[1], cz]; } }
    body.append(inst.controls, h('details', { class: 'small mt' }, h('summary', { class: 'bold' }, sdef.kind === 'validated' ? '📐 ' + t('Checked scientific model') : '🎈 ' + t('Simplified model'), ' — ', t('what it includes and leaves out')), h('p', { class: 'muted' }, tx(sdef.model))));
    hud.panel('🔬 ' + tx(sdef.title), body, { onClose: () => { quiet?.(); simOpen = false; open = null; ctrl.frozen = false; rig.reach(null); cam.release(); } });
  }
  const openSim = () => openSimDef(def.sim, 'main');
  // tapping a 3D object in an open simulation
  const tapRay = new THREE.Raycaster(), tapAt = new THREE.Vector2(); let tapDown = null;
  const onDown = (e) => { tapDown = [e.clientX, e.clientY]; };
  const onUp = (e) => {
    if (!tapDown || Math.hypot(e.clientX - tapDown[0], e.clientY - tapDown[1]) > 8) return;
    if (!simOpen) { worldTap(e); return; }
    if (!open || !open.taps.length) return;
    const r = eng.el.getBoundingClientRect(); tapAt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    tapRay.setFromCamera(tapAt, eng.camera);
    const hit = tapRay.intersectObjects(open.taps.map((x) => x.object), true)[0]; if (!hit) return;
    const owner = open.taps.find((x) => { for (let o = hit.object; o; o = o.parent) if (o === x.object) return true; return false; });
    if (owner) { sfx('tap'); owner.fn(owner.object, open.group.worldToLocal(hit.point.clone())); }
  };
  eng.el.addEventListener('pointerdown', onDown); eng.el.addEventListener('pointerup', onUp);

  // ----- the lesson: the teacher explains in the world, with the worked example and a picture from life -----
  let analogy = 0;
  async function lesson() {
    loadPhotos();
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

  // ----- the lab bench: this world's hands-on labs, built in 3D on the simulation floor -----
  function openBench() {
    const labs = labsFor(worldId(wkey)); let running = null;
    const body = h('div');
    const list = () => { running?.stop(); running = null; body.replaceChildren(h('p', { class: 'small muted' }, t('Every lab says what its model leaves out.')), ...labs.map((l) => h('button', { class: 'card flat', type: 'button', style: { display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer', marginBottom: '.5rem' }, onClick: () => run(l) }, h('b', null, l.icon, ' ', tx(l.title)), h('div', { class: 'small' }, tx(l.goal))))); };
    const run = async (l) => {
      // the 3D version when there is one; the flat version otherwise
      let lab3d = null; try { lab3d = (await import(`./labs/${l.id}.js`)).default; } catch { /* not built in 3D */ }
      if (lab3d) { hud.closePanel(); openSimDef(lab3d, l.id); return; }
      running = mountLab(l, { wkey, level: lv, teacher: who.teacher, onComplete: () => { ss.lab = true; reach(5); persist(); goals(); } }); body.replaceChildren(h('button', { class: 'btn ghost sm mb', type: 'button', onClick: list }, '← ', t('Labs & trips')), running.el);
    };
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

  // ----- whole screens acted out in the world: the level final, entry tests, the arena and the memory book -----
  const HOSTED = { final: ['🏆', 'The level final'], placement: ['🔑', 'Entry test'], arena: ['⚔️', 'Arena'], memory: ['🧠', 'Memory'] };
  let beginner = null, solo = 0;
  async function hostView(kind, params) {
    const mod = await (kind === 'arena' ? import('../views/arena.js') : kind === 'memory' ? import('../views/memory.js') : import('../views/finale.js'));
    const view = { final: mod.finaleView, placement: mod.placementView, arena: mod.arenaView, memory: mod.memoryView }[kind];
    const body = h('div'); ctrl.frozen = true; solo = 0;
    const duelCam = () => { const midZ = (gap.z0 + gap.z1) / 2; cam.cut(new THREE.Vector3(gap.x - 14, gap.y + 5.5, midZ - 3), new THREE.Vector3(gap.x, gap.y + 0.8, midZ - 1), { dur: 1.2, hold: Infinity }); };
    let you = 0, them = 0, per = 2;
    live.scene = {
      start(total) { you = them = 0; per = Math.max(1, total); setBridge(lanes.me, 0); setBridge(lanes.them, 0); ctrl.place(S.raceStart[0], S.raceStart[1] + 0.05, S.raceStart[2], 0); rival.place(S.rivalStart[0], S.rivalStart[1], S.rivalStart[2], 0); rival.pose = null; race = { on: true }; duelCam(); },
      answer(youOK, themOK) { if (youOK) you++; if (themOK) them++; setBridge(lanes.me, Math.floor(you * SEGMENTS / per)); setBridge(lanes.them, Math.floor(them * SEGMENTS / per)); rig.setFace(youOK ? 'happy' : 'sad'); rival.mood = themOK ? 'happy' : 'sad'; if (youOK) cam.state.shake = 0.4; setTimeout(() => { rig.setFace('neutral'); rival.mood = 'neutral'; }, 1400); },
      finish(won) { if (won) { setBridge(lanes.me, SEGMENTS); setBridge(lanes.them, 0); rig.emblem.visible = true; rig.setFace('happy'); rival.pose = 'sad'; if (!calm) confetti(60); } else { rival.pose = 'cheer'; rig.setFace('sad'); } setTimeout(() => { race = null; ctrl.frozen = true; rig.setFace('neutral'); }, 2500); },
    };
    // a test or review without an opponent: every right answer lays one more piece of the player's own bridge
    live.answer = (correct, n, total) => { if (race) return; if (correct) { solo++; setBridge(lanes.me, Math.min(SEGMENTS, Math.ceil(solo * SEGMENTS / Math.max(1, total)))); rig.setFace('happy'); rig.once('cheer', () => rig.setFace('neutral')); burst(rig.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), def.theme.glow || '#ffd76a', 18); } else { rig.setFace('sad'); setTimeout(() => rig.setFace('neutral'), 1200); } if (n === total - 1) solo = 0; };
    live.step = (name) => {
      if (name === 'teach') {
        // the beginner comes to stand with the player
        if (!beginner) { beginner = person(who.layman, 'layman', [S.arena[0] + 1.3, S.arena[1], S.arena[2] + 0.4], null, { wander: false, yaw: -1.2 }); npcs.push(beginner); }
        ctrl.place(S.arena[0] - 0.9, S.arena[1] + 0.05, S.arena[2] + 0.4, 1.2); ctrl.pose = 'talk'; talkingTo = beginner; beginner.speaking = true;
        const mid = new THREE.Vector3(S.arena[0] + 0.2, S.arena[1] + 1.2, S.arena[2] + 0.4); cam.cut(mid.clone().add(new THREE.Vector3(0, 0.8, -4.6)), mid, { dur: 1.1, hold: Infinity });
      } else if (name === 'aptitude') { talkingTo = null; if (beginner) { beginner.speaking = false; beginner.mood = 'happy'; beginner.pose = 'cheer'; } ctrl.pose = 'think'; }
      else if (name === 'passed') { ctrl.pose = 'cheer'; rig.setFace('happy'); rig.emblem.visible = true; sfx('win'); if (!calm) confetti(120); level.spots.portal.open = true; }
      else if (name === 'failed') { ctrl.pose = 'sad'; rig.setFace('sad'); }
    };
    live.tab = (name, tab) => { hud.closePanel(true); hostView(name, [tab]); };
    live.before = (item) => { dbg.item = item; };
    if (kind !== 'memory') { ctrl.place(S.arena[0], S.arena[1] + 0.05, S.arena[2] - 1.5, 0); cam.state.yaw = Math.PI; }
    hud.panel(`${HOSTED[kind][0]} ${t(HOSTED[kind][1])}`, body, { wide: true, onClose: (silent) => { if (!silent) leave('done'); } });
    hud.goals([{ text: t(HOSTED[kind][1]), now: true }]); hud.count('');
    try { await view(body, params); } catch (e) { console.error(e); body.append(h('div', { class: 'note bad' }, String(e.message || e))); }
  }

  // ----- small bursts of sparks -----
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
    hud.menu({ quality: profile.settings.g3dq || 'auto', calm: cam.state.calm, stats: `${Math.round(s.fps)} fps · ${s.calls} draw calls · ${Math.round(s.triangles / 1000)}k triangles · ${s.tier}${eng.glow ? ' · glow' : ''}` }, {
      setQuality: (q) => { profile.settings.g3dq = q; persist(); eng.setQuality(q); },
      setCalm: (v) => { cam.state.calm = v; eng.calm = v; },
      resume: () => { hud.closeMenu(); eng.pause(false); eng.el.focus({ preventScroll: true }); },
    });
  }
  const onKey = (e) => { if ((e.code === 'Escape' || e.code === 'KeyP') && eng.paused) { e.preventDefault(); pause(); } else if ((e.code === 'Enter' || e.code === 'KeyE') && hud.talking && !/^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) hud.advance?.(); };
  window.addEventListener('keydown', onKey);

  // ----- guidance: what to do next is always pointed out, named, and one click away -----
  const things = [];                 // everything that can be used this frame: { x, y, z, range, label, fn }
  const beacon = new THREE.Group(); level.root.add(beacon);
  { const c = new THREE.Color(def.theme.glow || '#ffd76a');
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 9, 14, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.y = 4.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 36), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    const arrow = sprite('▼', { size: 0.8, color: '#' + c.getHexString() }); arrow.position.y = 3.3;
    beacon.add(beam, ring, arrow); beacon.userData = { ring, arrow }; }
  const nearest = (list) => list.reduce((b, o) => { const d = Math.hypot(o.x - ctrl.pos[0], o.z - ctrl.pos[2]) + Math.abs((o.y ?? 0) - ctrl.pos[1]) * 2; return d < b[0] ? [d, o] : b; }, [Infinity, null])[1];
  // The one thing the mission asks for next: { x, y (ground), z, label }.
  function nextTarget() {
    if (opts.host || done) return null;
    const at = (n, label) => ({ x: n.pos[0], y: n.pos[1], z: n.pos[2], label });
    if (!ss.lesson) return at(guide, t('Talk to {name}', { name: guide.name }));
    if (ex.read.length < TABLETS) { const tb = nearest(level.tablets.filter((x) => !ex.read.includes(x.i))); if (tb) return { x: tb.x, y: tb.y, z: tb.z, label: t('Read the tablet') }; }
    if (ex.orbs.length < CRYSTALS) { const o = nearest(level.orbs.filter((x) => !x.taken)); if (o) return { x: o.x, y: o.y - 1.1, z: o.z, label: t('Collect: {thing}', { thing: tx(story.crystal) }) }; }
    if (!ss.lab) { const c = level.spots.console; return { x: c.x, y: c.y, z: c.z - 0.9, label: t('Use the console') }; }
    if (!ss.explained) return at(peers[0], t('Explain it to {name}', { name: peers[0].name }));
    if (!(ss.wins > 0)) return at(rival, t('Challenge {name}', { name: rival.name }));
    if (!ss.done) return at(doctors[0], t('Talk to {name}', { name: doctors[0].name }));
    const po = level.spots.portal; return { x: po.x, y: po.y, z: po.z, label: t('Step through the portal') };
  }
  // small name tags on the things that can be used; they appear as the player comes near
  const tags = [];
  const tag = (text, x, y, z, hide) => { const sp = k.sign(text, x, y, z, { size: 0.34 }); sp.visible = false; tags.push({ sp, x, y, z, hide }); };
  for (const tb of level.tablets) tag('📖 ' + t('Read the tablet'), tb.x, tb.y + 2.4, tb.z, () => ex.read.includes(tb.i));
  for (const o of level.orbs) tag(`${story.crystalEm || '💎'} ${t('Collect: {thing}', { thing: tx(story.crystal) })}`, o.x, o.y + 1.0, o.z, () => o.taken);
  { const c = level.spots.console, bn = level.spots.benchAt, po = level.spots.portal, L = S.ladder;
    tag('🔬 ' + t('Use the console'), c.x, c.y + 1.9, c.z); tag('🧪 ' + t('Labs & trips'), bn.x, bn.y + 2.3, bn.z); tag('🚪 ' + t('Step through the portal'), po.x, po.y + 4, po.z, () => !ss.done);
    tag('🪜 ' + t('Climb'), L[0], S.far[1] + 2.2, L[1] - 0.4); tag('🏊 ' + t('Swim'), S.float[0] + 2.5, S.mid[1] + 0.7, S.float[1]);
    for (const mv of level.movers) { const sp = k.sign('⇄ ' + t('Ride'), 0, 0, 0, { size: 0.34 }); sp.visible = false; tags.push({ sp, follow: mv }); }
    for (const d of level.dynamic) { const sp = k.sign('👋 ' + t('Push me'), 0, 0, 0, { size: 0.3 }); sp.visible = false; tags.push({ sp, body: d.body, near: 6 }); } }
  // click or tap a thing (or a spot on the same ground) and the character walks there
  let auto = null;
  function autoTo(x, z, arrive, then) {
    const p0 = ctrl.pos, L = Math.hypot(x - p0[0], z - p0[2]);
    for (let d = 0.6; d < L - 0.3; d += 0.6) { const gx = p0[0] + (x - p0[0]) * d / L, gz = p0[2] + (z - p0[2]) * d / L, gy = groundBelow(level.solids, gx, p0[1] + 1.2, gz, 0.2); if (gy < p0[1] - 1.3) { hud.tip(t('Too far to walk straight there. Follow the path.'), 3); return false; } }
    auto = { x, z, arrive, then, t: 0, best: L, stuck: 0 }; return true;
  }
  const worldTap = (e) => {
    if (simOpen || hud.busy || race || done || ctrl.frozen || (opts.host && opts.host.kind !== 'memory')) return;
    const r = eng.el.getBoundingClientRect(), v = new THREE.Vector3(); let pick = null, bestPx = 70;
    for (const th of things) { v.set(th.x, th.y, th.z).project(eng.camera); if (v.z > 1) continue; const px = Math.hypot(r.left + (v.x + 1) / 2 * r.width - e.clientX, r.top + (1 - v.y) / 2 * r.height - e.clientY); if (px < bestPx) { bestPx = px; pick = th; } }
    if (pick) { sfx('tap'); autoTo(pick.x, pick.z, Math.max(0.9, pick.range * 0.6), () => { if (!hud.busy) pick.fn(); }); return; }
    // otherwise: the spot on the ground under the pointer
    tapAt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); tapRay.setFromCamera(tapAt, eng.camera);
    const o = tapRay.ray.origin, d = tapRay.ray.direction, hitT = rayCast(level.solids, [o.x, o.y, o.z], [d.x, d.y, d.z], 60);
    if (hitT < 60) { const hx = o.x + d.x * hitT, hy = o.y + d.y * hitT, hz = o.z + d.z * hitT; if (Math.abs(hy - ctrl.pos[1]) < 1.4) { beacon.userData.mark = { x: hx, y: hy, z: hz, until: performance.now() + 1500 }; autoTo(hx, hz, 0.35); } }
  };
  function showMe() {
    const tg = nextTarget(); if (!tg || cam.busy || hud.busy) return;
    const from = new THREE.Vector3(ctrl.pos[0] - tg.x, 0, ctrl.pos[2] - tg.z); if (from.lengthSq() < 1) from.set(0, 0, -1); from.normalize();
    cam.cut(new THREE.Vector3(tg.x + from.x * 9, tg.y + 6, tg.z + from.z * 9), new THREE.Vector3(tg.x, tg.y + 1, tg.z), { dur: 1.1, hold: 1.8 });
  }
  hud.onShow = showMe;
  // "look around": the camera leaves the character and can be turned, zoomed and panned anywhere in the world
  let free = false;
  hud.onView = (name) => {
    if (name === 'reset') { cam.reset(); return; }
    if (name !== 'free' || simOpen || race || hud.talking) return;
    free = !free; hud.looking(free); auto = null;
    if (free) { cam.orbitAt(new THREE.Vector3(ctrl.pos[0], ctrl.pos[1] + 1.2, ctrl.pos[2]), { yaw: cam.state.yaw, pitch: Math.max(0.35, cam.state.pitch), dist: Math.max(10, cam.state.dist), min: 3, max: 90 }); hud.tip(t('Look around: drag to turn, use the arrows or W A S D to slide the view, + and − to zoom. Press 🧍 to come back.'), 7); }
    else cam.release();
  };

  // ----- the loop -----
  let pendingJump = false, inp = input.state, prev = [...ctrl.pos], wasBusy = false, mapTick = 0;
  const wayV = new THREE.Vector3();
  eng.onFixed((dt) => {
    level.step(dt);
    const p = ctrl.pos;
    bumper.velocity.set((p[0] - prev[0]) / dt, 0, (p[2] - prev[2]) / dt); bumper.position.set(p[0], p[1] + 0.55, p[2]); prev = [p[0], p[1], p[2]];
    // resting objects doze to save work; anything the player comes close to is woken so it can be pushed
    for (const bd of physics.world.bodies) if (bd.mass > 0 && bd.sleepState !== 0 && Math.abs(bd.position.x - p[0]) < 1.6 && Math.abs(bd.position.z - p[2]) < 1.6 && Math.abs(bd.position.y - p[1]) < 2.5) bd.wakeUp();
    physics.step();
    if (race) {
      // run to the end of the bridge built so far
      const end = (lane, startZ) => startZ + 0.4 + (gap.z0 - startZ - 0.9) * Math.min(1, lane.n) + Math.max(0, lane.n - 0.5) * segLen;
      const go = p[2] < end(lanes.me, S.raceStart[2]) - 0.15 ? 1 : 0;
      ctrl.frozen = false; ctrl.update(dt, { move: { x: Math.max(-1, Math.min(1, (p[0] - lanes.me.x) * 2)) * go, y: go }, run: true, jump: false, jumpPressed: false }, Math.PI); ctrl.frozen = true;
      if (rival.pos[2] < end(lanes.them, S.rivalStart[2]) - 0.1) { rival.pos[2] += 5 * dt; rival.pose = 'run'; rival.rig.speed = 1; } else if (rival.pose === 'run') rival.pose = null;
    } else if (free) { ctrl.update(dt, { move: { x: 0, y: 0 }, run: false, jump: false, jumpPressed: false }, cam.state.yaw);
    } else if (auto && !ctrl.frozen && Math.hypot(inp.move.x, inp.move.y) < 0.2 && !pendingJump) {
      // walking to the thing that was clicked: steer straight at it, hop small gaps and steps on the way
      const dx = auto.x - p[0], dz = auto.z - p[2], d = Math.hypot(dx, dz); auto.t += dt;
      if (d < auto.best - 0.05) { auto.best = d; auto.stuck = 0; } else auto.stuck += dt;
      if (d < auto.arrive || auto.stuck > 1.6 || auto.t > 14) { const then = d < auto.arrive + 0.6 ? auto.then : null; auto = null; ctrl.update(dt, { move: { x: 0, y: 0 }, run: false, jump: false, jumpPressed: false }, cam.state.yaw); then?.(); }
      else {
        let jump = false;
        if (ctrl.body.grounded) { const firm = level.solids.filter((q) => !q.scenery && !q.dynamic), ax = p[0] + dx / d * 0.95, az = p[2] + dz / d * 0.95, below = groundBelow(firm, ax, p[1] + 0.45, az), above = groundBelow(firm, ax, p[1] + 2.2, az); jump = below < p[1] - 0.6 || above > p[1] + 0.43; }
        ctrl.update(dt, { move: { x: -dx / d, y: dz / d }, run: d > 4, jump: jump || !ctrl.body.grounded, jumpPressed: jump }, Math.PI);
      }
    } else { auto = null; ctrl.update(dt, { move: inp.move, run: inp.run, jump: inp.jump, jumpPressed: pendingJump }, cam.state.yaw); }
    pendingJump = false;
    // people do not walk through one another: the player is eased out of anyone's personal space, and others step back
    for (const n of npcs) {
      const dx = p[0] - n.pos[0], dz = p[2] - n.pos[2], d = Math.hypot(dx, dz), keep = 0.78;
      if (d < keep && Math.abs(p[1] - n.pos[1]) < 1.6 && !race) {
        const ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0, push = keep - d;
        // someone free to move steps aside for the player; someone standing their ground (the master, a doctor) does not
        const yieldTo = n.state !== 'hold' && talkingTo !== n && groundBelow(level.solids, n.pos[0] - ux * push, n.pos[1] + 0.6, n.pos[2] - uz * push, 0.2) > n.pos[1] - 0.5 ? 0.8 : 0;
        n.pos[0] -= ux * push * yieldTo; n.pos[2] -= uz * push * yieldTo;
        const mine = push * (1 - yieldTo); if (groundBelow(level.solids, p[0] + ux * mine, p[1] + 0.6, p[2] + uz * mine, 0.2) > p[1] - 0.5) { p[0] += ux * mine; p[2] += uz * mine; }
      }
    }
    for (let a = 0; a < npcs.length; a++) for (let c = a + 1; c < npcs.length; c++) { const A = npcs[a], B = npcs[c], dx = A.pos[0] - B.pos[0], dz = A.pos[2] - B.pos[2], d = Math.hypot(dx, dz); if (d < 0.75 && d > 1e-4 && Math.abs(A.pos[1] - B.pos[1]) < 1.6 && A.state !== 'hold' && B.state !== 'hold') { const k2 = (0.75 - d) / 2 / d; A.pos[0] += dx * k2; A.pos[2] += dz * k2; B.pos[0] -= dx * k2; B.pos[2] -= dz * k2; } }
    for (const n of npcs) n.update(dt, p, talkingTo);
    if (simOpen) open?.sim.step?.(dt);
  });
  ctrl.onLand = (v) => { sfx('tap'); if (v < -14) cam.state.shake = 0.6; };
  eng.onLost = () => hud.tip(t('The picture was interrupted. It will return in a moment.'), 8);
  ctrl.onRespawn = () => { hud.flash(); hud.tip(t('Careful! You are back on solid ground.')); };

  eng.onFrame((dt, time) => {
    input.state.locked = hud.busy && !race;
    inp = input.poll(dt);
    // the view pad's buttons act for as long as they are held
    { const H = hud.held, L = input.state.look; if (H.has('left')) L.x -= 1.9 * dt; if (H.has('right')) L.x += 1.9 * dt; if (H.has('up')) L.y += 1.2 * dt; if (H.has('down')) L.y -= 1.2 * dt; if (H.has('in')) input.state.zoom -= 9 * dt; if (H.has('out')) input.state.zoom += 9 * dt; }
    if (free) { const o = cam.orbit, raw = input.state.raw || { x: 0, y: 0 }; if (o) { const sp = Math.max(6, o.dist * 0.9) * dt, fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw); cam.pan((fx * raw.y - fz * raw.x) * sp, (fz * raw.y + fx * raw.x) * sp); } inp.move.x = inp.move.y = 0; inp.jumpPressed = false; }
    hud.viewShown(!hud.talking && !hud.menuOpen);
    if (inp.jumpPressed) pendingJump = true;
    if (inp.pausePressed && !hud.panelOpen && !hud.talking) pause();
    const p = ctrl.pos;
    cam.update(dt, p, input.takeLook());
    physics.sync();
    level.frame(dt, time, p);
    if (open) open.sim.frame?.(dt, time, simOpen); else sims.get('main')?.sim.frame?.(dt, time, false);
    for (const part of [...lanes.me.parts, ...lanes.them.parts]) part.scale.lerp(ONE, Math.min(1, dt * 8));
    for (let i = show.flyers.length - 1; i >= 0; i--) { const f = show.flyers[i]; f.t += dt; const u = f.from + Math.max(0, f.t) * 1.9, G = show.group; f.sp.visible = f.t > 0; f.sp.position.set(G.position.x + Math.cos(f.yaw) * u, f.y + Math.sin(f.t * 5) * 0.14, G.position.z - Math.sin(f.yaw) * u); if (u > 5) { f.sp.removeFromParent(); f.sp.material.map?.dispose(); f.sp.material.dispose(); show.flyers.splice(i, 1); } }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i], a = s.p.geometry.attributes.position; s.life -= dt * 1.1;
      for (let j = 0; j < s.vel.length; j++) { s.vel[j][1] -= 9 * dt; a.setXYZ(j, a.getX(j) + s.vel[j][0] * dt, a.getY(j) + s.vel[j][1] * dt, a.getZ(j) + s.vel[j][2] * dt); }
      a.needsUpdate = true; s.p.material.opacity = Math.max(0, s.life);
      if (s.life <= 0) { s.p.removeFromParent(); s.p.geometry.dispose(); s.p.material.dispose(); sparks.splice(i, 1); }
    }
    // what can the player do here?
    let best = null, bestD = Infinity;
    things.length = 0;
    const offer = (x, y, z, range, label, fn) => { things.push({ x, y, z, range, label, fn }); const d = Math.hypot(p[0] - x, (p[1] + 0.9 - y) * 0.6, p[2] - z); if (d < range && d < bestD) { bestD = d; best = [label, fn]; } };
    if (opts.host?.kind === 'memory' && !hud.busy) {
      for (const L of opts.loci) offer(L.x, 1, L.z, 2.0, `${L.em} ${t(L.name)}`, () => hud.panel(`${L.em} ${t(L.name)}`, h('div', null, L.mine.length ? h('ul', null, L.mine.map((c) => h('li', null, h('b', null, tx(c.title)), ' — ', c.cue))) : h('p', { class: 'muted' }, t('Nothing is stored here yet. In a lesson, the Remember step lets you place an idea on this object.')), h('button', { class: 'btn sm mt', type: 'button', onClick: () => hud.closePanel() }, t('OK')))));
      offer(guide.pos[0], guide.pos[1] + 1, guide.pos[2], 2.6, t('Open my memory book'), () => hostView('memory', ['reviews']));
    } else if (!hud.busy && !race && !done && !opts.host) {
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
    if (hud.panelOpen) { const r = hud.panelEl.getBoundingClientRect(); if (r.width < eng.size.w * 0.8) eng.setInset(Math.round(r.width), 0); else eng.setInset(0, Math.round(Math.min(r.height, eng.size.h * 0.72))); } else if (hud.talking) eng.setInset(0, Math.round(eng.size.h * 0.3)); else eng.setInset(0, 0);      // speech sits at the bottom: the speakers and the projector move up into the clear part
    // the beacon stands on the next thing to do; a pointer at the edge of the screen shows the way when it is out of view
    const tg = nextTarget(), mark = beacon.userData.mark && beacon.userData.mark.until > performance.now() ? beacon.userData.mark : null, spot = mark || tg;
    beacon.visible = !!spot && !simOpen && !race && !hud.talking; titleSign.visible = !hud.talking;
    if (spot) { beacon.position.set(spot.x, spot.y, spot.z); beacon.userData.arrow.position.y = 3.3 + Math.sin(time * 4) * 0.25; beacon.userData.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.12); beacon.userData.arrow.visible = !mark; }
    if (tg && !hud.busy && !race) {
      const v = wayV.set(tg.x, tg.y + 2.2, tg.z).project(eng.camera), dist = Math.hypot(tg.x - p[0], tg.z - p[2]), behind = v.z > 1, w = eng.size.w, hgt = eng.size.h;
      let sx = (v.x + 1) / 2 * w, sy = (1 - v.y) / 2 * hgt; if (behind) { sx = w - sx; sy = hgt - 40; }
      const on = !behind && sx > 60 && sx < w - 60 && sy > 90 && sy < hgt - 110;
      const cx = Math.max(64, Math.min(w - 64, sx)), cy = Math.max(96, Math.min(hgt - 120, sy));
      hud.way(dist > 3 ? { x: cx, y: cy, angle: on ? null : Math.atan2(sy - cy, sx - cx), text: `${tg.label} · ${Math.round(dist)} m` } : null);
    } else hud.way(null);
    for (const tgk of tags) {
      if (tgk.follow) tgk.sp.position.set(tgk.follow.c[0], tgk.follow.c[1] + 1.6, tgk.follow.c[2]); else if (tgk.body) tgk.sp.position.set(tgk.body.position.x, tgk.body.position.y + 1.1, tgk.body.position.z);
      const q = tgk.sp.position, dd = Math.hypot(q.x - p[0], q.z - p[2]); tgk.sp.visible = !simOpen && !hud.talking && dd < (tgk.near || 15) && dd > 1.2 && Math.abs(q.y - p[1]) < 9 && !(tgk.hide && tgk.hide());
    }
    if (++mapTick % 10 === 0) hud.map((g2, W2) => {
      // a small map of the islands: you, the other characters and the next thing to do
      const isles = level.solids.filter((sl) => sl.type === 'cyl' && sl.r > 1.4); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const sl of isles) { x0 = Math.min(x0, sl.x - sl.r); x1 = Math.max(x1, sl.x + sl.r); z0 = Math.min(z0, sl.z - sl.r); z1 = Math.max(z1, sl.z + sl.r); }
      const sc = (W2 - 12) / Math.max(x1 - x0, z1 - z0), ox = 6 + (W2 - 12 - (x1 - x0) * sc) / 2, oz = 6 + (W2 - 12 - (z1 - z0) * sc) / 2, X = (x) => ox + (x1 - x) * sc, Z = (z) => oz + (z1 - z) * sc;
      g2.clearRect(0, 0, W2, W2); g2.fillStyle = 'rgba(255,255,255,.55)'; for (const sl of isles) { g2.beginPath(); g2.arc(X(sl.x), Z(sl.z), Math.max(1.5, sl.r * sc), 0, 7); g2.fill(); }
      g2.fillStyle = '#9fd0ff'; for (const n of npcs) { g2.beginPath(); g2.arc(X(n.pos[0]), Z(n.pos[2]), 2, 0, 7); g2.fill(); }
      if (tg) { g2.fillStyle = '#ffd76a'; g2.beginPath(); g2.arc(X(tg.x), Z(tg.z), 4 + Math.sin(time * 5), 0, 7); g2.fill(); }
      g2.fillStyle = '#ff5f8f'; g2.beginPath(); g2.arc(X(p[0]), Z(p[2]), 3.5, 0, 7); g2.fill(); g2.strokeStyle = '#fff'; g2.lineWidth = 1.5; g2.stroke();
    });
    hud.prompt(best?.[0], best?.[1]);
    if (inp.actPressed) { if (hud.talking) hud.advance?.(); else if (!hud.busy) hud.act(); }
    if (wasBusy && !hud.busy) eng.el.focus({ preventScroll: true });
    wasBusy = hud.busy;
  });
  const ONE = new THREE.Vector3(1, 1, 1);

  goals();
  eng.start(); eng.el.focus({ preventScroll: true });
  if (opts.host?.kind === 'memory') {
    // the ten places of the memory palace stand in a ring; each shows the pictures the player has stored there
    const LOCI = [['🚪', 'Door'], ['🪟', 'Window'], ['🛋️', 'Sofa'], ['📚', 'Bookshelf'], ['🕰️', 'Clock'], ['🪴', 'Plant'], ['🖼️', 'Picture'], ['💡', 'Lamp'], ['🪜', 'Stairs'], ['🧺', 'Basket']];
    const kept = Object.entries(profile.palace || {}).flatMap(([wk, list]) => list.map((x) => ({ ...x, wk })));
    opts.loci = LOCI.map(([em, name], i) => { const a = (i / LOCI.length) * Math.PI * 2, x = Math.sin(a) * 6.6, z = Math.cos(a) * 6.6; k.prop('pillar', x, 0, z, { s: 0.55 }); const sp = k.sign(em, x, 2.3, z, { size: 0.9, bg: null }); const mine = kept.filter((c) => c.locus === i && c.cue); if (mine.length) k.sign(String(mine.length), x + 0.5, 2.9, z, { size: 0.4 }); return { x, z, em, name, mine, sp }; });
  }
  if (opts.host && opts.host.kind !== 'memory') hostView(opts.host.kind, opts.host.params);
  if (!ex.met && !opts.host) { hud.tip((input.state.device === 'touch' ? t('Use the left stick to walk. Drag the picture to look around.') : t('Walk with W A S D or the arrow keys. Press Space to jump and E to use things.')) + ' ' + t('Click or tap a thing to go to it.'), 11); hud.banner(`${w.em} ${tx(story.title)}`, 3.5); }

  let gone = false;
  function leave(reason) {
    if (gone) return; gone = true;
    window.removeEventListener('keydown', onKey);
    eng.el.removeEventListener('pointerdown', onDown); eng.el.removeEventListener('pointerup', onUp); clearLive();
    for (const inst of sims.values()) { try { inst.sim.dispose?.(); } catch (e) { console.error(e); } }
    hud.dispose(); input.dispose(); npcs.forEach((n) => n.rig.dispose()); rig.dispose(); level.dispose(); eng.dispose(); ui.remove();
    delete window.__ukc3d;
    onExit?.(reason);
  }
  // for automated play-testing and profiling
  window.__ukc3d = { show, showLine, nextTarget, autoTo, get auto() { return auto; }, things, dbg, eng, ctrl, cam, level, hud, input, physics, ex, ss, npcs, guide, rival, peers, doctors, lanes, spots: S, get sim() { return open ? open.sim : sims.get('main')?.sim; }, get race() { return race; }, openSim, openSimDef, startDuel, collect, hostView, get padBox() { return padSolid; }, tapsOpen: () => (open ? open.taps : []), simGroup: () => (open ? open.group : null) };
  return { dispose: () => leave(null) };
}
