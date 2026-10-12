// Builds js/data/norms.json from anonymous puzzle-result files exported by players
// (Settings → "Share anonymous puzzle results"). Each file holds an age, an age band and puzzle answers — no names.
//   node tools/norms.mjs <folder-of-exported-files>
// A band's norms are used by the game once it has results from at least 100 players (see NORM_MIN in aptitude.js).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.log('usage: node tools/norms.mjs <folder>'); process.exit(1); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function ability(answers) {
  const right = answers.filter((a) => a.correct).length;
  if (right === 0) return Math.min(...answers.map((a) => a.b)) - 1;
  if (right === answers.length) return Math.max(...answers.map((a) => a.b)) + 1;
  let th = 0;
  for (let i = 0; i < 25; i++) { let g = 0, hss = 0; for (const a of answers) { const p = 1 / (1 + Math.exp(-(th - a.b))); g += (a.correct ? 1 : 0) - p; hss += p * (1 - p); } th += g / Math.max(hss, 1e-6); }
  return Math.max(-4, Math.min(4, th));
}

const bands = {};
let files = 0, used = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  files++;
  let rec; try { rec = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
  if (rec.app !== 'ukc-norms' || !rec.band) continue;
  const answers = (rec.tests || []).flatMap((t) => t.answers || []).filter((a) => typeof a.b === 'number');
  if (answers.length < 16) continue; // too little evidence from this player
  (bands[rec.band] ||= []).push(ability(answers));
  used++;
}
const out = { bands: {}, built: new Date().toISOString().slice(0, 10), players: used };
for (const [band, list] of Object.entries(bands)) {
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  const sd = Math.sqrt(list.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, list.length - 1));
  out.bands[band] = { n: list.length, mean: +mean.toFixed(3), sd: +sd.toFixed(3) };
}
writeFileSync(join(root, 'js/data/norms.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${files} files read, ${used} players used`, out.bands);
