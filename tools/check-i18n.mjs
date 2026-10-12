// Checks interface translations: node tools/check-i18n.mjs [fr es …]
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keys = JSON.parse(readFileSync(join(root, 'i18n/_strings.json'), 'utf8'));
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['fr', 'es', 'ar', 'ru', 'he', 'it', 'el', 'tr', 'pt', 'zh', 'ja'];
let bad = 0;
for (const l of langs) {
  const p = join(root, `i18n/${l}.json`);
  if (!existsSync(p)) { console.log(`${l}: missing file`); bad++; continue; }
  let d; try { d = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.log(`${l}: invalid JSON ${e.message}`); bad++; continue; }
  const missing = keys.filter((k) => typeof d[k] !== 'string' || !d[k].trim());
  const ph = keys.filter((k) => d[k] && (k.match(/\{[a-z]+\}/g) || []).some((x) => !d[k].includes(x)));
  if (missing.length || ph.length) { bad++; console.log(`${l}: ${missing.length} missing, ${ph.length} with lost {placeholders}`); missing.slice(0, 5).forEach((k) => console.log('   missing:', JSON.stringify(k))); ph.slice(0, 5).forEach((k) => console.log('   placeholder:', JSON.stringify(k))); }
  else console.log(`${l}: OK (${keys.length})`);
}
process.exit(bad ? 1 : 0);
