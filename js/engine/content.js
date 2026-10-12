// Loads lesson packs and builds question sets (practice, duel, tie-break, placement, diagnostic, review).
import { rngFrom, shuffle, sample } from '../core/util.js';
import { profile, worldId, worldLang } from '../core/store.js';
import { ENGLISH_NAMES, lang as uiLang, markLocal, tr } from '../core/i18n.js';
import curriculum from '../data/curriculum.js';

const packs = new Map();
let trIndex = null; // list of ready-translated packs (content/_tr/index.json)
const pad = (n) => String(n).padStart(2, '0');
export const packUrl = (wkey, level) => {
  const lang = worldLang(wkey);
  return `content/w${pad(worldId(wkey))}/${lang ? lang + '/' : ''}l${level}.json`;
};
export const stageTitle = (wkey, level, stage) => curriculum[worldId(wkey) - 1][level - 1][stage - 1];

// Every text a learner reads in a stage (used to mark ready-translated packs and to pre-translate for offline use).
function stageStrings(s) {
  const out = [s.hook, ...(s.explain || []), s.mnemonic, s.limits, s.example?.q, ...(s.example?.steps || []), s.example?.a, ...Object.values(s.analogies || {}), s.misc?.wrong, s.misc?.right, s.trip?.prompt, s.title, s.teach?.topic, s.teach?.model, ...(s.teach?.points || []).map((p) => p.ask), ...(s.terms || []).flat()];
  for (const q of [...(s.questions || []), ...(s.panel || []), ...(s.gq || [])]) out.push(q.q, q.why, q.model, ...(q.o || []), ...(q.joiner === undefined ? q.items || [] : []), ...(q.pairs || []).flat());
  return out.filter((x) => typeof x === 'string' && x);
}

// Lesson packs are authored in English. A ready-translated pack, when one exists for the player's language
// (content/_tr/<lang>/wNN/lK.json, same format, made with the translator workshop or by human translators), is
// used as it is; otherwise the English pack is loaded and translated on the device as it is shown.
export async function loadLevel(wkey, level) {
  const lang = worldLang(wkey);
  const key = `${wkey}|${level}|${lang ? '' : uiLang}`;
  if (packs.has(key)) return packs.get(key);
  let raw = null, tl = null;
  if (!lang && uiLang !== 'en') {
    const name = `${uiLang}/w${pad(worldId(wkey))}/l${level}`;
    try {
      trIndex ||= await (await fetch('content/_tr/index.json')).json();
      if (trIndex.packs.includes(name)) { const r = await fetch(`content/_tr/${name}.json`); if (r.ok) { raw = await r.json(); tl = uiLang; } }
    } catch { /* no ready-translated pack */ }
  }
  if (!raw) {
    const res = await fetch(packUrl(wkey, level));
    if (!res.ok) throw new Error(`content ${key} unavailable (${res.status})`);
    raw = await res.json();
  }
  // Only packs checked by a human translator carry rubric keywords in their own language.
  const pack = { wkey, level, tl, stages: raw.stages.map((s) => normalise(lang ? fromLanguageStage(s, lang) : s, wkey, level, raw.machine ? null : tl)) };
  if (tl) for (const s of pack.stages) markLocal(stageStrings(s));
  packs.set(key, pack);
  return pack;
}
// Translates every text of a level now and keeps the results on the device, so the level reads instantly — and
// offline — in the player's language afterwards. Returns { done, total, translated }.
export async function pretranslate(wkey, level, onProgress) {
  const pack = await loadLevel(wkey, level);
  if (uiLang === 'en' || pack.tl) return { done: 0, total: 0, translated: 0 };
  const all = [...new Set(pack.stages.flatMap(stageStrings))];
  let done = 0, translated = 0;
  for (const text of all) { const out = await tr(text); if (out !== text) translated++; done++; if (done % 5 === 0) onProgress?.(done, all.length); }
  return { done, total: all.length, translated };
}
// The same level with every text replaced by its translation, in the ready-translated pack format (for the workshop).
export async function translatedPack(wkey, level) {
  const res = await fetch(packUrl(wkey, level)); const raw = await res.json();
  const walk = async (v, k) => {
    if (typeof v === 'string') return ['icon', 't', 'k', 'unit', 'fen', 'wiki', 'title'].includes(k) ? v : tr(v);
    if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await walk(x, k)); return out; }
    if (v && typeof v === 'object') { const out = {}; for (const [kk, x] of Object.entries(v)) out[kk] = ['sources', 'au', 'rubric'].includes(kk) ? x : kk === 'k' && Array.isArray(x) ? x : await walk(x, kk); return out; }
    return v;
  };
  return { ...(await walk(raw, '')), tl: uiLang, machine: true };
}
export const loadStage = async (wkey, level, stage) => (await loadLevel(wkey, level)).stages[stage - 1];

function normalise(s, wkey, level, tl = null) {
  const tag = (list, prefix) => (list || []).map((q, i) => ({ ...q, tl: tl || undefined, id: `${wkey}|${level}|${s.n}|${prefix}${i}`, stage: s.n, level }));
  return { ...s, questions: tag(s.questions, 'q'), panel: tag(s.panel, 'p') };
}

// ---------- World 10: language stages become ordinary stages ----------
function fromLanguageStage(s, code) {
  const name = ENGLISH_NAMES[code];
  const joiner = code === 'zh' || code === 'ja' ? '' : ' ';
  const rng = rngFrom(`lang|${code}|${s.title}|${s.n}`);
  const items = s.items, show = (it) => (it[2] ? `${it[1]} (${it[2]})` : it[1]);
  const others = (i, n, col) => sample(items.filter((_, j) => j !== i), n, rng).map((x) => (col === 1 ? show(x) : x[0]));
  const q = [];
  const order = shuffle(items.map((_, i) => i), rng);
  for (const i of order.slice(0, 3)) q.push({ t: 'mc', q: `What does "${show(items[i])}" mean?`, o: [items[i][0], ...others(i, 3, 0)], a: 0, why: `"${items[i][1]}" means "${items[i][0]}".`, d: 1, k: 'recall' });
  for (const i of order.slice(3, 6)) q.push({ t: 'mc', q: `How do you say "${items[i][0]}" in ${name}?`, o: [show(items[i]), ...others(i, 3, 1)], a: 0, why: `"${items[i][0]}" is "${show(items[i])}".`, d: 2, k: 'recall' });
  const li = order[6];
  q.push({ t: 'mc', q: 'Listen. What does it mean?', listen: { text: items[li][1], lang: code }, o: [items[li][0], ...others(li, 3, 0)], a: 0, why: `You heard "${show(items[li])}", which means "${items[li][0]}".`, d: 2, k: 'concept' });
  q.push({ t: 'match', q: `Match each ${name} phrase to its meaning.`, pairs: sample(items, 4, rng).map((it) => [show(it), it[0]]), why: 'Each phrase is paired with its meaning.', d: 1, k: 'recall' });
  for (const [en, tokens] of s.sentences.slice(0, 2)) q.push({ t: 'order', q: `Build the sentence: "${en}"`, items: tokens, joiner, why: `"${en}" is "${tokens.join(joiner)}".`, d: 2, k: 'apply' });
  const si = order[7];
  q.push({ t: 'say', q: `Say this in ${name}: "${items[si][0]}"`, target: items[si][1], roman: items[si][2], lang: code, why: `"${items[si][0]}" is "${show(items[si])}".`, d: 2, k: 'apply' });
  const [en3, tok3] = s.sentences[2];
  q.push({ t: 'order', q: `Build the sentence: "${en3}"`, items: tok3, joiner, why: `"${en3}" is "${tok3.join(joiner)}".`, d: 3, k: 'apply' });
  for (const g of s.gq) q.push(g);
  return {
    ...s, questions: q, lang: code,
    terms: items.slice(0, 5).map((it) => [show(it), it[0]]),
    example: { q: `How would you say: "${s.sentences[0][0]}"?`, steps: s.sentences[0][1].map((tok, i) => `${i + 1}. ${tok}`).slice(0, 5), a: s.sentences[0][1].join(joiner) },
    analogies: {}, phrases: items, misc: null,
  };
}

// ---------- choosing questions ----------
const seenCount = (q) => profile?.items[q.id]?.s || 0;
const wrongStreak = (q) => profile?.items[q.id]?.w || 0;
// Least-seen first, with recently missed items pulled forward, shuffled within ties so no two attempts match.
function prefer(list, rng) {
  return shuffle(list, rng).sort((a, b) => (seenCount(a) - wrongStreak(a) * 2) - (seenCount(b) - wrongStreak(b) * 2));
}
const usable = (q, { text = true, say = true } = {}) => (text || q.t !== 'text') && (say || q.t !== 'say');

export async function practiceSet(wkey, level, stage, n = 4, opts = {}) {
  const s = await loadStage(wkey, level, stage);
  return prefer(s.questions.filter((q) => usable(q, opts)), Math.random).slice(0, n);
}

// A stage duel mixes this stage with earlier ones (interleaving and spaced review). Stage 10 spans the whole level.
export async function duelSet(wkey, level, stage, opts = {}) {
  const pack = await loadLevel(wkey, level);
  const rng = Math.random;
  const ok = (q) => usable(q, opts);
  if (stage >= 10) {
    const out = [];
    for (const s of pack.stages) out.push(...prefer(s.questions.filter(ok), rng).slice(0, 2));
    const extra = prefer(pack.stages.flatMap((s) => s.questions.filter((q) => ok(q) && q.d >= 2 && !out.includes(q))), rng).slice(0, 2);
    return shuffle([...out, ...extra], rng);
  }
  const own = pack.stages[stage - 1];
  let earlier = pack.stages.slice(0, stage - 1).flatMap((s) => s.questions.filter(ok));
  if (!earlier.length && level > 1) {
    try { earlier = (await loadLevel(wkey, level - 1)).stages.flatMap((s) => s.questions.filter(ok)); } catch { /* previous level not cached */ }
  }
  const nSpiral = earlier.length ? 4 : 0;
  const mine = prefer(own.questions.filter(ok), rng).slice(0, 14 - nSpiral);
  const set = [...mine, ...prefer(earlier, rng).slice(0, nSpiral)];
  if (set.length < 14) set.push(...own.panel.filter((q) => q.t === 'mc').slice(0, 14 - set.length));
  const out = shuffle(set, rng);
  // The very first stages have nothing earlier to draw on: a few questions return at the end as a second look
  // (with their choices reshuffled), so every duel has 14 questions and the 50-point bar means the same thing.
  if (out.length < 14) out.push(...shuffle(out.filter((q) => q.t === 'mc' || q.t === 'num'), rng).slice(0, 14 - out.length));
  return out;
}

// Nuanced reasoning questions for sudden death, drawn from the whole level.
export async function tiebreakSet(wkey, level, opts = {}) {
  const pack = await loadLevel(wkey, level);
  const nuanced = pack.stages.flatMap((s) => [...s.panel, ...s.questions.filter((q) => q.k === 'reason' && q.d >= 2)]).filter((q) => usable(q, opts));
  return shuffle(nuanced, Math.random);
}

export async function panelSet(wkey, level, stage, attempt = 0, opts = {}) {
  const s = await loadStage(wkey, level, stage);
  const pool = [...s.panel, ...s.questions.filter((q) => q.d >= 2 && (q.k === 'reason' || q.k === 'apply'))].filter((q) => usable(q, opts));
  if (attempt === 0 && s.panel.filter((q) => usable(q, opts)).length >= 3) return s.panel.slice(0, 3);
  return prefer(pool, Math.random).slice(0, 3);
}

// Entry test for joining at `level` (> 1): the essentials of the level below. A different draw every time.
export async function placementSet(wkey, level) {
  const pack = await loadLevel(wkey, level - 1);
  const out = [];
  for (const s of shuffle(pack.stages, Math.random)) {
    const q = prefer(s.questions.filter((x) => x.t === 'mc' || x.t === 'num' || x.t === 'order' || x.t === 'match'), Math.random)[0];
    if (q) out.push(q);
  }
  return out.concat(prefer(pack.stages.flatMap((s) => s.questions.filter((x) => x.t === 'mc' && x.d >= 2 && !out.includes(x))), Math.random).slice(0, 1));
}

// Four questions from one level, used by the "find my level" diagnostic.
export async function diagnosticSet(wkey, level) {
  const pack = await loadLevel(wkey, level);
  return sample(pack.stages, 4).map((s) => sample(s.questions.filter((x) => x.t === 'mc' || x.t === 'num'), 1)[0]).filter(Boolean);
}

export async function reviewSet(wkey, level, stage, n = 5, opts = {}) {
  const s = await loadStage(wkey, level, stage);
  return prefer(s.questions.filter((q) => usable(q, opts)), Math.random).slice(0, n);
}

export async function teachTopics(wkey, level, n = 3) {
  const pack = await loadLevel(wkey, level);
  return sample(pack.stages.filter((s) => s.teach), n).map((s) => ({ ...s.teach, stage: s.n, title: s.title }));
}

// Finds one item again from its id (for the Mistake Lab).
export async function itemById(id) {
  const [wkey, level, stage, ref] = id.split('|');
  try {
    const s = await loadStage(wkey, +level, +stage);
    return (ref[0] === 'p' ? s.panel : s.questions)[+ref.slice(1)] || null;
  } catch { return null; }
}
