// Lists interface strings that still need translating, and merges a file of new translations in.
//   node tools/i18n-missing.mjs list fr            → JSON array of missing English strings
//   node tools/i18n-missing.mjs merge fr add.json  → adds { "English": "translation", … } to i18n/fr.json
import { readFileSync, writeFileSync } from 'node:fs';
const [cmd, lang, file] = process.argv.slice(2);
const keys = JSON.parse(readFileSync('i18n/_strings.json', 'utf8'));
const path = `i18n/${lang}.json`;
const cur = JSON.parse(readFileSync(path, 'utf8'));
if (cmd === 'list') console.log(JSON.stringify(keys.filter((k) => typeof cur[k] !== 'string' || !cur[k].trim()), null, 1));
else if (cmd === 'merge') {
  const add = JSON.parse(readFileSync(file, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(add)) if (keys.includes(k) && typeof v === 'string' && v.trim()) { cur[k] = v; n++; }
  writeFileSync(path, JSON.stringify(cur));
  console.log(`merged ${n} strings into ${path}`);
}
