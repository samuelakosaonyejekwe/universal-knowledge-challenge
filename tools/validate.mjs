// Validates content packs against tools/CONTENT.md.
// Usage: node tools/validate.mjs [content/w01 ...]   (no args = everything under content/)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const curriculum = JSON.parse(readFileSync(join(root, 'js/data/curriculum.json'), 'utf8'));
const LANGS = ['en', 'es', 'fr', 'ar', 'ru', 'he', 'it', 'el', 'tr', 'pt', 'zh', 'ja'];
const CTX = ['home', 'city', 'farm', 'sport', 'sea', 'music', 'nature', 'tech'];
const KINDS = ['recall', 'concept', 'apply', 'reason'];

const errors = [];
let files = 0, stages = 0, items = 0;
const isStr = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;
const isArr = (v, min, max = Infinity) => Array.isArray(v) && v.length >= min && v.length <= max;
const distinct = (a) => new Set(a.map((x) => String(x).trim().toLowerCase())).size === a.length;

function checkItem(it, at, err) {
  items++;
  if (!it || typeof it !== 'object') return err(`${at}: not an object`);
  if (!isStr(it.q, 5)) err(`${at}: q missing`);
  if (!isStr(it.why, 5)) err(`${at}: why missing`);
  if (![1, 2, 3].includes(it.d)) err(`${at}: d must be 1-3`);
  if (!KINDS.includes(it.k)) err(`${at}: k must be one of ${KINDS}`);
  switch (it.t) {
    case 'mc':
      if (!isArr(it.o, 2, 4) || !it.o.every((o) => isStr(o))) err(`${at}: o needs 2-4 strings`);
      else if (!distinct(it.o)) err(`${at}: options not distinct`);
      if (!Number.isInteger(it.a) || it.a < 0 || it.a >= (it.o?.length ?? 0)) err(`${at}: a out of range`);
      if (it.o?.some((o) => /\b(all|none) of the above\b|\bboth [a-d] and [a-d]\b/i.test(o))) err(`${at}: position-dependent option`);
      break;
    case 'num':
      if (typeof it.a !== 'number' || !Number.isFinite(it.a)) err(`${at}: a must be a number`);
      if (it.tol !== undefined && !(typeof it.tol === 'number' && it.tol >= 0)) err(`${at}: tol must be >= 0`);
      break;
    case 'text':
      if (!isArr(it.rubric, 2, 5) || !it.rubric.every((g) => isArr(g, 1) && g.every((k) => isStr(k) && k === k.toLowerCase()))) err(`${at}: rubric needs 2-5 groups of lowercase keywords`);
      if (!Number.isInteger(it.min) || it.min < 1 || it.min > (it.rubric?.length ?? 0)) err(`${at}: min out of range`);
      if (!isStr(it.model, 10)) err(`${at}: model answer missing`);
      break;
    case 'order':
      if (!isArr(it.items, 3, 6) || !it.items.every((s) => isStr(s)) || !distinct(it.items)) err(`${at}: items needs 3-6 distinct strings`);
      break;
    case 'match':
      if (!isArr(it.pairs, 3, 5) || !it.pairs.every((p) => isArr(p, 2, 2) && isStr(p[0]) && isStr(p[1]))) err(`${at}: pairs needs 3-5 [left,right]`);
      else if (!distinct(it.pairs.map((p) => p[0])) || !distinct(it.pairs.map((p) => p[1]))) err(`${at}: pair sides not distinct`);
      break;
    default: err(`${at}: unknown type ${it.t}`);
  }
  if (it.au && !(Array.isArray(it.au.notes) || Array.isArray(it.au.rhythm))) err(`${at}: au needs notes or rhythm`);
  if (it.fen !== undefined && !(isStr(it.fen) && it.fen.split(' ')[0].split('/').length === 8)) err(`${at}: bad fen`);
}

function checkTeach(t, at, err) {
  if (!t || !isStr(t.topic, 5) || !isStr(t.model, 20)) return err(`${at}: teach.topic/model missing`);
  if (!isArr(t.points, 3, 5)) return err(`${at}: teach.points needs 3-5`);
  t.points.forEach((p, i) => {
    if (!isArr(p?.k, 1) || !p.k.every((k) => isStr(k) && k === k.toLowerCase())) err(`${at}: teach.points[${i}].k needs lowercase keywords`);
    if (!isStr(p?.ask, 8)) err(`${at}: teach.points[${i}].ask missing`);
  });
}

function checkPanel(p, at, err) {
  if (!isArr(p, 3, 3)) return err(`${at}: panel needs exactly 3 items`);
  p.forEach((it, i) => {
    checkItem(it, `${at}.panel[${i}]`, err);
    if (it.k !== 'reason') err(`${at}.panel[${i}]: k must be reason`);
    if (!['mc', 'text'].includes(it.t)) err(`${at}.panel[${i}]: type must be mc or text`);
  });
}

function checkFile(path, world, level, lang) {
  files++;
  const rel = path.replace(root + '/', '');
  const err = (m) => errors.push(`${rel}: ${m}`);
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { return err(`invalid JSON — ${e.message}`); }
  if (data.world !== world) err(`world should be ${world}`);
  if (data.level !== level) err(`level should be ${level}`);
  if (lang && data.lang !== lang) err(`lang should be ${lang}`);
  if (!isArr(data.stages, 9, 9)) return err(`needs exactly 9 stages, has ${data.stages?.length}`);
  const titles = curriculum[world - 1][level - 1];
  data.stages.forEach((s, i) => {
    stages++;
    const at = `stage ${i + 1}`;
    if (s.n !== i + 1) err(`${at}: n should be ${i + 1}`);
    if (s.title !== titles[i]) err(`${at}: title should be "${titles[i]}"`);
    if (!isStr(s.icon)) err(`${at}: icon missing`);
    if (!isStr(s.hook, 10)) err(`${at}: hook missing`);
    if (!isArr(s.explain, lang ? 1 : 2, 4) || !s.explain.every((p) => isStr(p, 20))) err(`${at}: explain needs ${lang ? 1 : 2}-4 paragraphs`);
    if (!isStr(s.mnemonic, 8)) err(`${at}: mnemonic missing`);
    if (!s.trip || !isStr(s.trip.wiki) || !isStr(s.trip.prompt, 8)) err(`${at}: trip missing`);
    if (!isArr(s.sources, 1, 3) || !s.sources.every((x) => isStr(x))) err(`${at}: sources needs 1-3 titles`);
    checkPanel(s.panel, at, err);
    checkTeach(s.teach, at, err);
    if (lang) {
      if (!isArr(s.items, 8, 8) || !s.items.every((x) => isArr(x, 3, 3) && isStr(x[0]) && isStr(x[1]) && typeof x[2] === 'string')) err(`${at}: items needs exactly 8 [en, target, romanisation]`);
      else if (!distinct(s.items.map((x) => x[0])) || !distinct(s.items.map((x) => x[1]))) err(`${at}: items not distinct`);
      if (!isArr(s.sentences, 3, 3) || !s.sentences.every((x) => isArr(x, 2, 2) && isStr(x[0]) && isArr(x[1], 3, 8) && x[1].every((t) => isStr(t)))) err(`${at}: sentences needs exactly 3 [en, [3-8 tokens]]`);
      if (!isArr(s.gq, 2, 2)) err(`${at}: gq needs exactly 2 items`);
      else s.gq.forEach((it, j) => checkItem(it, `${at}.gq[${j}]`, err));
      return;
    }
    if (!s.example || !isStr(s.example.q, 5) || !isArr(s.example.steps, 2, 5) || !isStr(s.example.a)) err(`${at}: example needs q, 2-5 steps, a`);
    const ctx = Object.keys(s.analogies || {});
    if (ctx.length < 3 || !ctx.every((c) => CTX.includes(c) && isStr(s.analogies[c], 10))) err(`${at}: analogies needs >=3 of ${CTX}`);
    if (!isArr(s.terms, 3, 5) || !s.terms.every((t) => isArr(t, 2, 2) && isStr(t[0]) && isStr(t[1], 5))) err(`${at}: terms needs 3-5 [term, definition]`);
    if (!s.misc || !isStr(s.misc.wrong, 8) || !isStr(s.misc.right, 8)) err(`${at}: misc.wrong/right missing`);
    if (!isArr(s.questions, 10, 10)) return err(`${at}: needs exactly 10 questions, has ${s.questions?.length}`);
    s.questions.forEach((it, j) => checkItem(it, `${at}.questions[${j}]`, err));
    const n = (f) => s.questions.filter(f).length;
    if (n((q) => q.t === 'mc') < 5) err(`${at}: needs at least 5 mc`);
    if (n((q) => ['num', 'order', 'match'].includes(q.t)) < 1) err(`${at}: needs a num/order/match item`);
    if (level >= 2 && n((q) => q.t === 'text') < 1) err(`${at}: needs a text item`);
    if (n((q) => q.k === 'apply' || q.k === 'reason') < 3) err(`${at}: needs 3+ apply/reason items`);
    if (!distinct(s.questions.map((q) => q.q))) err(`${at}: duplicate question text`);
  });
}

function walkWorld(dir) {
  const m = dir.match(/w(\d\d)(?:\/([a-z]{2}))?\/?$/);
  if (!m) return;
  const world = +m[1];
  if (world === 10 && !m[2]) {
    for (const l of LANGS) if (existsSync(join(dir, l))) walkWorld(join(dir, l));
    return;
  }
  for (const f of readdirSync(dir).sort()) {
    const lm = f.match(/^l([1-6])\.json$/);
    if (lm) checkFile(join(dir, f), world, +lm[1], m[2]);
  }
}

const args = process.argv.slice(2);
const targets = args.length ? args.map((a) => join(process.cwd(), a)) : readdirSync(join(root, 'content')).filter((d) => /^w\d\d$/.test(d)).map((d) => join(root, 'content', d));
for (const t of targets) if (existsSync(t) && statSync(t).isDirectory()) walkWorld(t.replace(/\/$/, ''));

if (errors.length) {
  console.log(errors.slice(0, 60).join('\n'));
  if (errors.length > 60) console.log(`… and ${errors.length - 60} more`);
  console.log(`FAILED: ${errors.length} problem(s) in ${files} file(s)`);
  process.exit(1);
}
console.log(`OK — ${files} file(s), ${stages} stage(s), ${items} question item(s)`);
