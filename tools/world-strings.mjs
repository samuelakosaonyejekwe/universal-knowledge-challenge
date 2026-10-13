// Collects the English text of every 3D world (story lines, simulation titles, goals, labels, notes and the
// guide's fixed remarks) into i18n/worlds/_strings.json, so translations can be shipped with the game.
//   node tools/world-strings.mjs            → rewrites the list
//   node tools/world-strings.mjs missing fr → prints the strings i18n/worlds/fr.json does not have yet
//   node tools/world-strings.mjs merge fr add.json → adds { "English": "translation" } pairs to i18n/worlds/fr.json
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dir = join(root, 'i18n/worlds');
mkdirSync(dir, { recursive: true });
const [cmd, lang, file] = process.argv.slice(2);
const listPath = join(dir, '_strings.json'), read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
if (cmd === 'missing') { const cur = read(join(dir, lang + '.json'), {}); console.log(JSON.stringify(read(listPath, []).filter((k) => typeof cur[k] !== 'string' || !cur[k].trim()), null, 1)); process.exit(0); }
if (cmd === 'merge') {
  const keys = new Set(read(listPath, [])), cur = read(join(dir, lang + '.json'), {}), add = JSON.parse(readFileSync(file, 'utf8')); let n = 0;
  for (const [k, v] of Object.entries(add)) if (keys.has(k) && typeof v === 'string' && v.trim()) { cur[k] = v; n++; }
  writeFileSync(join(dir, lang + '.json'), JSON.stringify(cur)); console.log(`merged ${n} strings into i18n/worlds/${lang}.json (${Object.keys(cur).length} of ${keys.size})`); process.exit(0);
}
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'measureText' ? () => ({ width: 40 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document = { createElement: () => ({ getContext: () => ctx2d, width: 64, height: 64, style: {} }), documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {} } } };
globalThis.Element = class { }; globalThis.window = globalThis; globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; globalThis.sessionStorage = globalThis.localStorage;
const THREE = await import('../js/vendor/three.module.min.js');
const { createPhysics, CANNON } = await import('../js/game3d/physics.js');
const { createWorld, buildCourse, decorateWorld } = await import('../js/game3d/world.js');
const { sprite, glow } = await import('../js/gfx/kit3d.js');
const out = new Set();
// Only fixed text is collected: a remark with a number worked out during play is translated on the device instead.
const keep = (x) => { if (typeof x === 'string' && x.trim().length > 1 && /[A-Za-z]{2}/.test(x)) out.add(x); return x; };
for (const f of readdirSync(join(root, 'js/game3d/worlds')).filter((x) => /^w\d\d\.js$/.test(x)).sort()) {
  const d = (await import(pathToFileURL(join(root, 'js/game3d/worlds', f)).href)).default;
  for (const v of Object.values(d.story)) [v].flat().forEach(keep);
  [d.sim.title, d.sim.goal, d.sim.model].forEach(keep);
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const eng = { scene: new THREE.Scene(), quality: { particles: 1 }, calm: false }, physics = createPhysics(), lvl = createWorld(eng, physics, d, {});
    buildCourse(lvl.kit, d.layout || {});
    const el = { append() {}, appendChild: (x) => x, querySelector: () => null }, ctl = (o) => { let v = o?.value; return { el, get value() { return v; }, set(x) { v = x; o?.onInput?.(x); } }; };
    let said = 0;
    try {
      d.sim.mount({ THREE, CANNON, group: new THREE.Group(), level, lang: 'es', band: 'teen', rng: Math.random, calm: false, physics, t: keep, mat: lvl.kit.mat, lit: lvl.kit.lit, sprite, glow,
        ui: { el, slider: (o) => { keep(o.label); return ctl(o); }, button: (label) => { keep(label); return el; }, readout: (label) => { keep(label); return { el, set() {} }; }, choice: (opts, v, fn) => { opts.forEach((o) => keep(o[1])); let cur = v; return { el, get value() { return cur; }, set(x) { cur = x; fn?.(x); } }; }, note: (text) => { keep(text); return el; } },
        say: (text) => { if (said++ < 1) keep(text); }, complete() {} });
    } catch (e) { console.error(f, level, e.message); }
  }
}
// fixed lines the characters say in every world
for (const m of readFileSync(join(root, 'js/game3d/game.js'), 'utf8').matchAll(/\btx\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*\)/g)) keep((m[1] ?? m[2]).replace(/\\(['"\\])/g, '$1'));
const list = [...out].sort();
writeFileSync(listPath, JSON.stringify(list, null, 1));
console.log(`${list.length} strings, ${list.join(' ').split(/\s+/).length} words → i18n/worlds/_strings.json`);
