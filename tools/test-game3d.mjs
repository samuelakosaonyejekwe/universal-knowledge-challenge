// Checks the 3D adventure's logic without a browser: collision and movement, route finding, and every world's
// simulation model against a known result.   node tools/test-game3d.mjs
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { moveBody, pushOut, rayCast, route, groundBelow } from '../js/game3d/collide.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const ok = (name, pass, detail = '') => { console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!pass) fails++; };
const body = (x, y, z) => ({ pos: [x, y, z], vel: [0, 0, 0], r: 0.3, h: 1.5, grounded: false, ground: null });
const floor = { type: 'box', min: [-10, -1, -10], max: [10, 0, 10] };
const G = 24, DT = 1 / 60;
const run = (b, solids, seconds, each) => { for (let i = 0; i < Math.round(seconds / DT); i++) { each?.(b, i); b.vel[1] -= G * DT; moveBody(b, solids, DT); } return b; };

{ const b = run(body(0, 3, 0), [floor], 2); ok('falls and lands on the floor', b.grounded && Math.abs(b.pos[1]) < 1e-6, `y=${b.pos[1].toFixed(4)}`); }
{ const wall = { type: 'box', min: [2, 0, -5], max: [3, 4, 5] }; const b = run(body(0, 0, 0), [floor, wall], 2, (b) => { b.vel[0] = 4; }); ok('a wall stops the player', Math.abs(b.pos[0] - 1.7) < 0.01, `x=${b.pos[0].toFixed(3)}`); }
{ const step = { type: 'box', min: [1, 0, -5], max: [6, 0.35, 5] }; const b = run(body(0, 0, 0), [floor, step], 1, (b) => { b.vel[0] = 3; }); ok('walks up a small step', Math.abs(b.pos[1] - 0.35) < 1e-6 && b.pos[0] > 2); }
{ const tall = { type: 'box', min: [1, 0, -5], max: [6, 0.9, 5] }; const b = run(body(0, 0, 0), [floor, tall], 1, (b) => { b.vel[0] = 3; }); ok('does not walk up a tall ledge', b.pos[1] < 0.01 && b.pos[0] < 0.75); }
{ const b = body(0, 0, 0); b.grounded = true; b.vel[1] = 9.2; let top = 0; run(b, [floor], 1.2, (b) => { top = Math.max(top, b.pos[1]); }); ok('jump height matches the tuning', Math.abs(top - 9.2 * 9.2 / (2 * G)) < 0.2 && b.grounded, `peak ${top.toFixed(2)} m`); }
{ const roof = { type: 'box', min: [-2, 2, -2], max: [2, 2.5, 2] }; const b = body(0, 0, 0); b.vel[1] = 9; let top = 0; run(b, [floor, roof], 1, (b) => { top = Math.max(top, b.pos[1]); }); ok('bumps its head on a ceiling', top <= 0.5 + 1e-6, `peak ${top.toFixed(2)}`); }
{ const cyl = { type: 'cyl', x: 0, z: 0, r: 2, y0: -3, y1: 0 }; const b = run(body(1.2, 2, 0), [cyl], 1.5); const off = run(body(2.6, 2, 0), [cyl], 1.5); ok('stands on a round island and falls beside it', b.grounded && !off.grounded && off.pos[1] < -5); }
{ const lift = { type: 'box', min: [-1, -0.4, -1], max: [1, 0, 1], moving: true, delta: [0, 0, 0] }; const b = body(0, 0.01, 0);
  for (let i = 0; i < 240; i++) { const d = [0.02, 0.01, 0]; lift.delta = d; for (const k of [0, 1, 2]) { lift.min[k] += d[k]; lift.max[k] += d[k]; } b.vel[1] -= G * DT; moveBody(b, [lift], DT); }
  ok('rides a moving, rising platform', b.grounded && Math.abs(b.pos[0] - 4.8) < 0.05 && Math.abs(b.pos[1] - 2.4) < 0.05, `x=${b.pos[0].toFixed(2)} y=${b.pos[1].toFixed(2)}`); }
ok('pushes out of a block from inside', (() => { const p = pushOut(floor, 9.9, 0, 0.3); return p && p.nx === 1 && p.depth > 0.3; })());
ok('camera ray finds the nearest solid', Math.abs(rayCast([{ type: 'box', min: [4, 0, -1], max: [5, 2, 1] }, { type: 'box', min: [7, 0, -1], max: [8, 2, 1] }], [0, 1, 0], [1, 0, 0], 20) - 4) < 1e-9);
ok('finds the ground below a point', groundBelow([floor, { type: 'box', min: [-1, 0, -1], max: [1, 2, 1] }], 0, 5, 0) === 2);
{ const nodes = [[0, 0, 0], [5, 0, 0], [5, 0, 5], [0, 0, 5], [10, 0, 10]], links = [[0, 1], [1, 2], [2, 3], [0, 3], [2, 4]]; const p = route(nodes, links, 0, 4); ok('route finding returns a shortest path', p.join() === '0,1,2,4' || p.join() === '0,3,2,4', p.join('→')); }

// A stand-in for the browser, enough to build a whole world and run its simulation without drawing anything.
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'measureText' ? () => ({ width: 40 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document = { createElement: () => ({ getContext: () => ctx2d, width: 64, height: 64, style: {} }), documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {} } } };
globalThis.Element = class { }; globalThis.window = globalThis; globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; globalThis.sessionStorage = globalThis.localStorage;
const THREE = await import('../js/vendor/three.module.min.js');
const { createPhysics, CANNON } = await import('../js/game3d/physics.js');
const { createWorld, buildCourse, decorateWorld } = await import('../js/game3d/world.js');
const { sprite, glow } = await import('../js/gfx/kit3d.js');
// Every place a character must stand or walk has to be free of scenery: the start, the guide, tablets, the console,
// the lab bench, the ladder, landing points, the arena, the doctors, the portal, every waypoint and the lines between them.
function audit(lvl, S) {
  const solids = lvl.solids.filter((s) => !s.dynamic), bad = [];
  const blocked = (x, y, z, r = 0.32) => solids.some((s) => { const T = s.type === 'cyl' ? s.y1 : s.max[1], B = s.type === 'cyl' ? s.y0 : s.min[1]; if (T <= y + 0.3 || B >= y + 1.5) return false; if (s.type === 'cyl') return Math.hypot(x - s.x, z - s.z) < s.r + r; const cx = Math.max(s.min[0], Math.min(s.max[0], x)), cz = Math.max(s.min[2], Math.min(s.max[2], z)); return Math.hypot(x - cx, z - cz) < r; });
  const what = (x, y, z, r = 0.32) => { const s = solids.find((s) => { const T = s.type === 'cyl' ? s.y1 : s.max[1], B = s.type === 'cyl' ? s.y0 : s.min[1]; if (T <= y + 0.3 || B >= y + 1.5) return false; if (s.type === 'cyl') return Math.hypot(x - s.x, z - s.z) < s.r + r; const cx = Math.max(s.min[0], Math.min(s.max[0], x)), cz = Math.max(s.min[2], Math.min(s.max[2], z)); return Math.hypot(x - cx, z - cz) < r; }); return s.type === 'cyl' ? `round thing r ${s.r.toFixed(2)} at ${s.x.toFixed(1)}, ${s.z.toFixed(1)}` : `block ${s.min.map((v) => v.toFixed(1))} … ${s.max.map((v) => v.toFixed(1))}`; };
  const need = (name, x, y, z, r) => { if (blocked(x, y, z, r)) bad.push(`${name} (${x.toFixed(1)}, ${z.toFixed(1)}) by ${what(x, y, z, r)}`); };
  need('start', S.spawn[0], 0, S.spawn[2]); need('guide', S.guide[0], S.guide[1], S.guide[2]);
  const con = S.console; need('console front', con.x, con.y, con.z - 0.95); need('bench front', S.benchAt.x, S.benchAt.y, S.benchAt.z - 0.85);
  need('ladder foot', S.ladder[0], S.far[1], S.ladder[1] - 0.05, 0.25); need('middle island entry', S.midIn[0], S.mid[1], S.midIn[1]); need('far island entry', S.farIn[0], S.far[1], S.farIn[1]);
  need('arena centre', S.arena[0], S.arena[1], S.arena[2]); need('rival', S.rival[0], S.rival[1], S.rival[2]); need('duel start', S.raceStart[0], S.raceStart[1], S.raceStart[2]); need('master start', S.rivalStart[0], S.rivalStart[1], S.rivalStart[2]);
  S.doctors.forEach((p, i) => need('doctor ' + (i + 1), p[0], p[1], p[2])); need('portal', S.portal.x, S.portal.y, S.portal.z - 0.9);
  for (let a = 0; a < 12; a++) for (const r of [1.5, 3, 4.2]) need('simulation floor', S.pad[0] + Math.cos(a * Math.PI / 6) * r, S.pad[1], S.pad[2] + Math.sin(a * Math.PI / 6) * r, 0.1);
  lvl.tablets.forEach((t, i) => { let free = 0; for (let a = 0; a < 8; a++) if (!blocked(t.x + Math.cos(a * Math.PI / 4) * 1.3, t.y, t.z + Math.sin(a * Math.PI / 4) * 1.3)) free++; if (free < 3) bad.push(`tablet ${i + 1} is boxed in`); });
  lvl.orbs.forEach((o, i) => { let free = 0; for (let a = 0; a < 8; a++) for (const r of [0, 0.9]) if (!blocked(o.x + Math.cos(a * Math.PI / 4) * r, o.y - 1.1, o.z + Math.sin(a * Math.PI / 4) * r)) free++; if (free < 6) bad.push(`crystal ${i + 1} is boxed in`); });
  lvl.nodes.forEach((n, i) => need('waypoint ' + i, n[0], n[1], n[2]));
  for (const [a, b] of lvl.links) { const A = lvl.nodes[a], B = lvl.nodes[b], L = Math.hypot(B[0] - A[0], B[2] - A[2]); for (let d = 0.5; d < L; d += 0.5) if (blocked(A[0] + (B[0] - A[0]) * d / L, A[1], A[2] + (B[2] - A[2]) * d / L, 0.25)) { bad.push(`walk ${a}→${b} is blocked`); break; } }
  for (const leg of S.legs) if (leg.board) { need('boarding point', leg.board[0], groundBelow(solids, leg.board[0], 99, leg.board[1]), leg.board[1], 0.25); }
  return bad;
}

function tryWorld(d, level) {
  const eng = { scene: new THREE.Scene(), quality: { particles: 1 }, calm: false };
  const physics = createPhysics(), lvl = createWorld(eng, physics, d, {});
  const S = buildCourse(lvl.kit, d.layout || {});
  decorateWorld(lvl.kit, d, S);
  const blockedAt = audit(lvl, S);
  for (let i = 0; i < 120; i++) { lvl.step(1 / 60); physics.step(); } lvl.frame(1 / 60, 2, [0, 0, 0]);
  let score = null; const el = { append() {}, appendChild: (x) => x, querySelector: () => null };
  const control = (o) => { let v = o?.value; return { el, get value() { return v; }, set(x) { v = x; o?.onInput?.(x); } }; };
  const made = { sliders: 0, buttons: 0, choices: 0, reads: 0 };
  const sim = d.sim.mount({ THREE, CANNON, group: new THREE.Group(), level, lang: 'es', band: 'teen', rng: Math.random, calm: false, physics, t: (x) => x, mat: lvl.kit.mat, lit: lvl.kit.lit, sprite, glow,
    ui: { el, slider: (o) => { made.sliders++; return control(o); }, button: () => { made.buttons++; return el; }, readout: () => { made.reads++; return { el, set() {} }; }, choice: (opts, v, fn) => { made.choices++; let cur = v; return { el, get value() { return cur; }, set(x) { cur = x; fn?.(x); } }; }, note: () => el },
    say() {}, complete: (s = 1) => { score = Math.max(score ?? 0, s); } }) || {};
  for (let i = 0; i < 300; i++) { sim.step?.(1 / 60); if (i % 2 === 0) sim.frame?.(1 / 30, i / 60, true); }
  const early = score;
  if (typeof sim.autoplay !== 'function') return { ok: false, detail: 'sim.autoplay() is missing' };
  sim.autoplay();
  for (let i = 0; i < 60 * 90 && score == null; i++) { sim.step?.(1 / 60); if (i % 2 === 0) sim.frame?.(1 / 30, 5 + i / 60, true); }
  sim.dispose?.();
  const controls = made.sliders + made.buttons + made.choices;
  if (blockedAt.length) return { ok: false, detail: 'scenery in the way: ' + blockedAt.slice(0, 6).join('; ') };
  return { ok: score != null && early == null && controls >= 2 && made.reads >= 1 && lvl.orbs.length === 5, detail: `level ${level}: ${score == null ? 'autoplay never completed the goal within 90 s' : early != null ? 'completed before the player did anything' : `score ${score}`}, ${controls} controls, ${made.reads} readouts, ${lvl.solids.length} solids` };
}

// every world file: the story, theme and simulation are complete, and the simulation's model passes its own check
const need = ['title', 'crystal', 'intro', 'afterCrystals', 'afterSim', 'rival', 'win', 'lose', 'outro'];
const only = process.argv[2];      // e.g. `node tools/test-game3d.mjs w05` checks one world
for (const f of readdirSync(join(root, 'js/game3d/worlds')).filter((x) => /^w\d\d\.js$/.test(x) && (!only || x.startsWith(only))).sort()) {
  const m = await import(pathToFileURL(join(root, 'js/game3d/worlds', f)).href), d = m.default;
  const missing = [...need.filter((k) => !d.story?.[k]), ...['sky', 'ground', 'side', 'stone', 'accent'].filter((k) => !d.theme?.[k]), ...['title', 'goal', 'kind', 'model', 'mount'].filter((k) => !d.sim?.[k])];
  ok(`${f} is complete`, !missing.length && typeof d.decorate === 'function' && ['validated', 'simplified'].includes(d.sim?.kind), missing.join(', '));
  if (typeof m.selfTest === 'function') { const r = m.selfTest(); ok(`${f} model check`, r.ok, r.detail); }
  else ok(`${f} model check`, d.sim?.kind !== 'validated', 'a validated simulation must export selfTest()');
  for (const level of [1, 6]) { let r; try { r = tryWorld(d, level); } catch (e) { r = { ok: false, detail: String(e.stack || e).split('\n').slice(0, 3).join(' | ') }; } ok(`${f} builds and its simulation can be completed`, r.ok, r.detail); }
}
// every 3D lab: complete, mountable at each of its levels, finishable through autoplay(), and its model checked
import { existsSync } from 'node:fs';
const labDir = join(root, 'js/game3d/labs');
function tryLab(d, level) {
  const eng = { scene: new THREE.Scene(), quality: { particles: 1 }, calm: false }, physics = createPhysics(), lvl = createWorld(eng, physics, { theme: { sky: ['#fff', '#eee', '#ddd'], ground: '#8c8', side: '#484', stone: '#aaa', accent: '#48f' } }, {});
  let score = null; const el = { append() {}, appendChild: (x) => x, querySelector: () => null };
  const control = (o) => { let v = o?.value; return { el, get value() { return v; }, set(x) { v = x; o?.onInput?.(x); } }; };
  const made = { controls: 0, reads: 0, taps: 0 }, group = new THREE.Group();
  const sim = d.mount({ THREE, CANNON, group, level, lang: 'es', band: 'teen', rng: Math.random, calm: false, physics, t: (x) => x, mat: lvl.kit.mat, lit: lvl.kit.lit, sprite, glow,
    onTap: (o, fn) => { if (!o || typeof fn !== 'function') throw new Error('onTap needs an object and a function'); made.taps++; },
    ui: { el, slider: (o) => { made.controls++; return control(o); }, button: () => { made.controls++; return el; }, readout: () => { made.reads++; return { el, set() {} }; }, choice: (opts, v, fn) => { made.controls++; let cur = v; return { el, get value() { return cur; }, set(x) { cur = x; fn?.(x); } }; }, note: () => el },
    say() {}, complete: (s = 1) => { score = Math.max(score ?? 0, s); } }) || {};
  for (let i = 0; i < 240; i++) { sim.step?.(1 / 60); physics.step(); if (i % 2 === 0) sim.frame?.(1 / 30, i / 60, true); }
  const early = score;
  if (typeof sim.autoplay !== 'function') return { ok: false, detail: 'autoplay() is missing' };
  sim.autoplay();
  for (let i = 0; i < 60 * 120 && score == null; i++) { sim.step?.(1 / 60); physics.step(); if (i % 2 === 0) sim.frame?.(1 / 30, 4 + i / 60, true); }
  sim.dispose?.();
  let meshes = 0, deep = false; const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3());
  group.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) meshes++; }); deep = size.z > 0.4 && size.x > 0.4 && size.y > 0.4;
  return { ok: score != null && early == null && made.controls >= 2 && made.reads >= 1 && meshes >= 8 && deep, detail: `level ${level}: ${score == null ? 'autoplay never completed the goal within 120 s' : early != null ? 'completed before the player did anything' : `score ${score}`}, ${made.controls} controls, ${made.reads} readouts, ${made.taps} tappable, ${meshes} objects, ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} m${deep ? '' : ' (not three-dimensional enough)'}` };
}
if (existsSync(labDir)) for (const f of readdirSync(labDir).filter((x) => /^w\d\d-.*\.js$/.test(x) && (!only || x.startsWith(only))).sort()) {
  const m = await import(pathToFileURL(join(labDir, f)).href), d = m.default, id = f.replace(/\.js$/, '');
  const missing = ['id', 'world', 'levels', 'title', 'goal', 'kind', 'model', 'mount'].filter((k) => d?.[k] == null);
  ok(`lab ${f} is complete`, !missing.length && d.id === id && existsSync(join(root, 'js/labs', f)) && ['validated', 'simplified'].includes(d.kind), missing.join(', ') || (d.id !== id ? 'id does not match the file name' : ''));
  if (missing.length) continue;
  if (typeof m.selfTest === 'function') { const r = m.selfTest(); ok(`lab ${f} model check`, r.ok, r.detail); } else ok(`lab ${f} model check`, d.kind !== 'validated', 'a validated lab must export selfTest()');
  for (const level of [...new Set([d.levels[0], d.levels[d.levels.length - 1]])]) { let r; try { r = tryLab(d, level); } catch (e) { r = { ok: false, detail: String(e.stack || e).split('\n').slice(0, 3).join(' | ') }; } ok(`lab ${f} can be completed`, r.ok, r.detail); }
}
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
