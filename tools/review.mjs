// Applies reviewed corrections to lesson packs and checks encyclopedia titles.
//   node tools/review.mjs apply patch.json
//       patch.json: [{ "f": "content/w06/l2.json", "s": 3, "where": "questions", "i": 4, "set": { "a": 2, "why": "…" } },   ← one question item
//                    { "f": "content/w06/l2.json", "s": 3, "set": { "explain": ["…", "…"], "sources": ["…"] } }]          ← stage fields
//   node tools/review.mjs wiki content/w06      → lists `trip.wiki` and `sources` titles that do not exist on English Wikipedia
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [cmd, target] = process.argv.slice(2);
const ITEM = ['q', 'o', 'a', 'why', 'tol', 'unit', 'rubric', 'min', 'model', 'items', 'pairs', 'd', 'k', 'fen', 'au'];
const STAGE = ['icon', 'hook', 'explain', 'example', 'analogies', 'mnemonic', 'terms', 'misc', 'limits', 'trip', 'sources', 'teach', 'items', 'sentences'];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /^l[1-6]\.json$/.test(f) ? [p] : []; });

if (cmd === 'apply') {
  const patch = JSON.parse(readFileSync(target, 'utf8'));
  const files = new Map();
  let done = 0, skipped = 0;
  for (const p of patch) {
    if (!files.has(p.f)) files.set(p.f, JSON.parse(readFileSync(p.f, 'utf8')));
    const st = files.get(p.f).stages[p.s - 1];
    const obj = p.where ? st?.[p.where]?.[p.i] : st;
    const allowed = p.where ? ITEM : STAGE;
    if (!obj || !p.set || !Object.keys(p.set).every((k) => allowed.includes(k))) { skipped++; console.log('skipped', JSON.stringify(p).slice(0, 120)); continue; }
    for (const [k, v] of Object.entries(p.set)) { if (v === null) delete obj[k]; else obj[k] = v; }
    done++;
  }
  for (const [f, d] of files) writeFileSync(f, JSON.stringify(d, null, 1) + '\n');
  console.log(`applied ${done}, skipped ${skipped} — now run the validator`);
} else if (cmd === 'wiki') {
  const titles = new Map();
  for (const f of walk(target)) for (const st of JSON.parse(readFileSync(f, 'utf8')).stages) for (const t of [st.trip?.wiki, ...(st.sources || [])].filter(Boolean)) { if (!titles.has(t)) titles.set(t, []); titles.get(t).push(`${f}#${st.n}`); }
  const all = [...titles.keys()], missing = [];
  for (let i = 0; i < all.length; i += 40) {
    const batch = all.slice(i, i + 40);
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&redirects=1&format=json&titles=${encodeURIComponent(batch.join('|'))}`, { headers: { 'User-Agent': 'UniversalKnowledgeChallenge-content-check/1.0' } });
    const j = await r.json();
    const back = new Map();
    for (const n of j.query.normalized || []) back.set(n.to, n.from);
    for (const n of j.query.redirects || []) back.set(n.to, back.get(n.from) || n.from);
    for (const pg of Object.values(j.query.pages)) if (pg.missing !== undefined || pg.invalid !== undefined) missing.push(back.get(pg.title) || pg.title);
  }
  for (const m of missing) console.log(`MISSING "${m}" — used in ${(titles.get(m) || ['?']).slice(0, 3).join(', ')}`);
  console.log(`${all.length} titles checked, ${missing.length} missing`);
} else console.log('usage: apply <patch.json> | wiki <dir>');
