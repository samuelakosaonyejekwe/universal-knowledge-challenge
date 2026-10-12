// Finds and repairs multiple-choice items whose correct option gives itself away by being the longest.
//   node tools/options.mjs stat  content/w06            → share of items where the key is the single longest option
//   node tools/options.mjs list  content/w06 [level]    → the affected items as JSON lines
//   node tools/options.mjs apply patch.json             → replaces wrong options; the question, key and correct option are never touched
// patch.json: [{ "f": "content/w06/l1.json", "s": 1, "where": "questions", "i": 0, "wrong": ["…", "…", "…"] }, …]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [cmd, target, levelArg] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /^l[1-6]\.json$/.test(f) ? [p] : []; });
const longest = (q) => { const L = q.o.map((o) => o.length), m = Math.max(...L); return L[q.a] === m && L.filter((x) => x === m).length === 1; };
function items(file) {
  const d = JSON.parse(readFileSync(file, 'utf8')), out = [];
  for (const st of d.stages) for (const where of ['questions', 'panel', 'gq']) (st[where] || []).forEach((q, i) => { if (q.t === 'mc' && q.o.length > 2) out.push({ st, where, i, q }); });
  return out;
}
if (cmd === 'stat' || cmd === 'list') {
  let n = 0, bad = 0;
  for (const f of walk(target).sort()) {
    if (levelArg && !f.endsWith(`l${levelArg}.json`)) continue;
    for (const { st, where, i, q } of items(f)) {
      n++;
      if (longest(q)) { bad++; if (cmd === 'list') console.log(JSON.stringify({ f, s: st.n, where, i, q: q.q, correct: q.o[q.a], wrong: q.o.filter((_, k) => k !== q.a) })); }
    }
  }
  if (cmd === 'stat') console.log(`${target}: ${bad} of ${n} mc items (${Math.round((100 * bad) / Math.max(n, 1))}%) have the key as the single longest option`);
} else if (cmd === 'apply') {
  const patch = JSON.parse(readFileSync(target, 'utf8'));
  const files = new Map();
  let done = 0, skipped = 0;
  for (const p of patch) {
    if (!files.has(p.f)) files.set(p.f, JSON.parse(readFileSync(p.f, 'utf8')));
    const q = files.get(p.f).stages[p.s - 1]?.[p.where]?.[p.i];
    const ok = q && q.t === 'mc' && Array.isArray(p.wrong) && p.wrong.length === q.o.length - 1 && p.wrong.every((w) => typeof w === 'string' && w.trim())
      && new Set([q.o[q.a], ...p.wrong].map((x) => x.trim().toLowerCase())).size === q.o.length;
    if (!ok) { skipped++; console.log('skipped', p.f, p.s, p.where, p.i); continue; }
    const wrong = p.wrong.slice();
    q.o = q.o.map((o, k) => (k === q.a ? o : wrong.shift()));
    done++;
  }
  for (const [f, d] of files) writeFileSync(f, JSON.stringify(d, null, 1) + '\n');
  console.log(`applied ${done}, skipped ${skipped}`);
} else console.log('usage: stat|list <dir> [level] | apply <patch.json>');
