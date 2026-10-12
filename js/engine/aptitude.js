// The aptitude test that closes every level: freshly generated reasoning items in the families used by
// established reasoning assessments — number series, figure matrices, figure analogies, odd-one-out and
// deductive logic. It is language-light so it is fair across languages.
//
// The "indicative reasoning range" reported later is placed on the familiar scale used by tests such as the
// Wechsler scales and Stanford–Binet (mean 100, standard deviation 15). It is an un-normed estimate from game
// play, not a clinical IQ score, and the game always says so.
import { rngFrom, shuffle, pick } from '../core/util.js';
import { t } from '../core/i18n.js';

const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

// ---------- item families (each returns an mc item with difficulty b in logits) ----------
function series(rng, hard) {
  const kinds = hard < 1 ? ['add', 'add', 'sub', 'skip'] : hard < 2 ? ['add', 'mul', 'alt', 'sq'] : ['mul', 'alt', 'sq', 'fib', 'two', 'grow'];
  const kind = pick(kinds, rng);
  let seq = [], b = 0;
  const a0 = ri(rng, 1, 9);
  if (kind === 'add') { const d = ri(rng, 2, hard < 1 ? 5 : 9); seq = Array.from({ length: 6 }, (_, i) => a0 + d * i); b = -2 + hard * 0.5; }
  else if (kind === 'sub') { const d = ri(rng, 1, 4); seq = Array.from({ length: 6 }, (_, i) => 30 + a0 - d * i); b = -1.6; }
  else if (kind === 'skip') { const d = pick([2, 5, 10], rng); seq = Array.from({ length: 6 }, (_, i) => d * (i + 1)); b = -2.2; }
  else if (kind === 'mul') { const m = ri(rng, 2, 3); seq = Array.from({ length: 6 }, (_, i) => ri(rng, 1, 1) * (a0 % 4 + 1) * m ** i); b = -0.4; }
  else if (kind === 'alt') { const d1 = ri(rng, 2, 6), d2 = ri(rng, 1, 4); let v = a0; seq = [v]; for (let i = 1; i < 6; i++) { v += i % 2 ? d1 : -d2; seq.push(v); } b = 0.3; }
  else if (kind === 'sq') { const off = ri(rng, 0, 3); seq = Array.from({ length: 6 }, (_, i) => (i + 1 + off) ** 2); b = 0.2; }
  else if (kind === 'fib') { seq = [ri(rng, 1, 3), ri(rng, 2, 5)]; for (let i = 2; i < 6; i++) seq.push(seq[i - 1] + seq[i - 2]); b = 0.9; }
  else if (kind === 'two') { const m = 2, d = ri(rng, 1, 3); let v = a0 % 3 + 1; seq = [v]; for (let i = 1; i < 6; i++) { v = v * m + d; seq.push(v); } b = 1.5; }
  else { let v = a0, d = ri(rng, 1, 3); seq = [v]; for (let i = 1; i < 6; i++) { v += d; d += ri(rng, 1, 1) * (hard > 2 ? 2 : 1); seq.push(v); } b = 1.1; }
  const answer = seq[5];
  const wrong = new Set();
  for (const delta of shuffle([1, -1, 2, -2, seq[5] - seq[4], -(seq[4] - seq[3]) || 3, 10, -3], rng)) { const w = answer + delta; if (w !== answer && w >= 0) wrong.add(w); if (wrong.size === 3) break; }
  return { t: 'mc', q: `${t('Which number comes next?')}  ${seq.slice(0, 5).join(' , ')} , ?`, o: [String(answer), ...[...wrong].map(String)], a: 0, local: true, why: t('Find the rule that turns each number into the next one, then apply it once more.'), d: b > 0.5 ? 3 : b > -1 ? 2 : 1, k: 'reason', b, fam: 'series' };
}

function oddOne(rng, hard) {
  const kinds = hard < 1 ? ['even', 'five'] : hard < 2 ? ['mult', 'square'] : ['prime', 'square', 'mult'];
  const kind = pick(kinds, rng);
  let good, bad, b;
  if (kind === 'even') { good = shuffle([2, 4, 6, 8, 10, 12, 14], rng).slice(0, 3); bad = pick([3, 5, 7, 9, 11], rng); b = -2; }
  else if (kind === 'five') { good = shuffle([5, 10, 15, 20, 25, 30], rng).slice(0, 3); bad = pick([12, 18, 22, 27], rng); b = -1.6; }
  else if (kind === 'mult') { const m = pick([3, 4, 6, 7], rng); good = shuffle([2, 3, 4, 5, 6, 7, 8, 9], rng).slice(0, 3).map((x) => x * m); bad = good[0] + pick([1, 2], rng); if (bad % m === 0) bad++; b = -0.5; }
  else if (kind === 'square') { good = shuffle([4, 9, 16, 25, 36, 49, 64, 81], rng).slice(0, 3); bad = pick([12, 20, 30, 45, 50, 72], rng); b = 0.3; }
  else { good = shuffle([7, 11, 13, 17, 19, 23, 29, 31], rng).slice(0, 3); bad = pick([21, 27, 33, 39, 49, 51], rng); b = 1.0; }
  return { t: 'mc', q: t('Three of these numbers belong together. Which one is the odd one out?'), o: [String(bad), ...good.map(String)], a: 0, local: true, why: t('Three share a property (such as being even, a multiple, a square or a prime); one does not.'), d: b > 0.5 ? 3 : 2, k: 'reason', b, fam: 'odd' };
}

// --- figures: a cell is { shape, n, fill, rot } drawn as SVG ---
const SHAPES = ['circle', 'square', 'triangle', 'diamond'];
const FILLS = ['solid', 'empty', 'half'];
function cellSVG(c, size = 64) {
  if (!c) return `<svg viewBox="0 0 64 64" width="${size}" height="${size}"><rect x="2" y="2" width="60" height="60" rx="8" fill="#fff" stroke="#c9d1ea" stroke-dasharray="5 4"/><text x="32" y="42" text-anchor="middle" font-size="28" fill="#8a93b3">?</text></svg>`;
  const col = '#3b3fd8';
  const one = (cx, cy, r) => {
    const fill = c.fill === 'solid' ? col : c.fill === 'half' ? '#b9bdf3' : '#fff';
    const tr = `transform="rotate(${c.rot || 0} ${cx} ${cy})"`;
    if (c.shape === 'circle') return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="2.5"/>${c.rot ? `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r}" stroke="${c.fill === 'solid' ? '#fff' : col}" stroke-width="2.5" ${tr}/>` : ''}`;
    if (c.shape === 'square') return `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="${fill}" stroke="${col}" stroke-width="2.5" ${tr}/>`;
    if (c.shape === 'triangle') return `<path d="M${cx} ${cy - r} L${cx + r} ${cy + r} L${cx - r} ${cy + r}Z" fill="${fill}" stroke="${col}" stroke-width="2.5" ${tr}/>`;
    return `<path d="M${cx} ${cy - r} L${cx + r * 0.75} ${cy} L${cx} ${cy + r} L${cx - r * 0.75} ${cy}Z" fill="${fill}" stroke="${col}" stroke-width="2.5" ${tr}/>`;
  };
  const pos = { 1: [[32, 32, 15]], 2: [[20, 32, 10], [44, 32, 10]], 3: [[32, 18, 8.5], [18, 44, 8.5], [46, 44, 8.5]], 4: [[19, 19, 8], [45, 19, 8], [19, 45, 8], [45, 45, 8]] }[c.n || 1];
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}"><rect x="2" y="2" width="60" height="60" rx="8" fill="#fff" stroke="#c9d1ea"/>${pos.map((p) => one(...p)).join('')}</svg>`;
}
const same = (a, b) => a.shape === b.shape && a.n === b.n && a.fill === b.fill && (a.rot || 0) === (b.rot || 0);
function distractors(answer, rng, n = 3) {
  const out = [];
  const tweaks = shuffle([
    (c) => ({ ...c, shape: pick(SHAPES.filter((s) => s !== c.shape), rng) }), (c) => ({ ...c, n: c.n === 1 ? 2 : c.n - 1 }), (c) => ({ ...c, n: c.n === 4 ? 3 : c.n + 1 }),
    (c) => ({ ...c, fill: pick(FILLS.filter((f) => f !== c.fill), rng) }), (c) => ({ ...c, rot: ((c.rot || 0) + 90) % 360, shape: c.shape === 'circle' ? 'triangle' : c.shape }),
    (c) => ({ ...c, fill: pick(FILLS.filter((f) => f !== c.fill), rng), n: c.n === 1 ? 2 : c.n - 1 }),
  ], rng);
  for (const tw of tweaks) { const d = tw(answer); if (!same(d, answer) && !out.some((x) => same(x, d))) out.push(d); if (out.length === n) break; }
  return out;
}

function matrix(rng, hard) {
  // Rules along rows: shape is fixed per row or cycles; count grows across; fill cycles down or across.
  const shapes = shuffle(SHAPES, rng).slice(0, 3), fills = shuffle(FILLS, rng);
  const rules = hard < 1 ? 1 : hard < 2 ? 2 : 3;
  const countAcross = rules >= 1, fillDown = rules >= 2, shapeLatin = rules >= 3;
  const n0 = ri(rng, 1, 2);
  const cell = (r, c) => ({
    shape: shapeLatin ? shapes[(r + c) % 3] : shapes[r],
    n: countAcross ? n0 + c : n0,
    fill: fillDown ? fills[shapeLatin ? (r * 2 + c) % 3 : r] : 'solid',
    rot: 0,
  });
  const grid = Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => cell(r, c)));
  const answer = grid[2][2];
  const opts = [answer, ...distractors(answer, rng)];
  const svg = `<div class="lab-grid" style="grid-template-columns:repeat(3,64px);justify-content:center;margin:.6rem 0">${grid.flat().map((c, i) => cellSVG(i === 8 ? null : c)).join('')}</div>`;
  return { t: 'mc', q: t('Which tile completes the pattern?'), figure: svg, o: opts.map((c) => cellSVG(c, 56)), svgOptions: true, a: 0, local: true, why: t('Look along each row and down each column: what stays the same, and what changes step by step?'), d: rules, k: 'reason', b: -1.5 + rules * 1.1, fam: 'matrix' };
}

function analogy(rng, hard) {
  const A = { shape: pick(SHAPES, rng), n: ri(rng, 1, 2), fill: pick(FILLS, rng), rot: 0 };
  const C = { shape: pick(SHAPES.filter((s) => s !== A.shape), rng), n: ri(rng, 1, 2), fill: pick(FILLS, rng), rot: 0 };
  const moves = shuffle([
    (c) => ({ ...c, n: c.n + 1 }), (c) => ({ ...c, fill: FILLS[(FILLS.indexOf(c.fill) + 1) % 3] }), (c) => ({ ...c, shape: SHAPES[(SHAPES.indexOf(c.shape) + 1) % 4] }),
  ], rng).slice(0, hard < 1.5 ? 1 : 2);
  const apply = (c) => moves.reduce((x, m) => m(x), c);
  const B = apply(A), D = apply(C);
  const opts = [D, ...distractors(D, rng)];
  const svg = `<div class="row center" style="margin:.6rem 0;gap:.3rem">${cellSVG(A)}<b>→</b>${cellSVG(B)}<b style="margin:0 .5rem">::</b>${cellSVG(C)}<b>→</b>${cellSVG(null)}</div>`;
  return { t: 'mc', q: t('The first tile changes into the second. Change the third tile in the same way.'), figure: svg, o: opts.map((c) => cellSVG(c, 56)), svgOptions: true, a: 0, local: true, why: t('Work out exactly what changed between the first pair (how many, which shading) and make the same change.'), d: moves.length + 1, k: 'reason', b: -0.8 + moves.length * 0.9, fam: 'analogy' };
}

const NONSENSE = ['zibs', 'taks', 'mips', 'lorps', 'feks', 'dabs', 'nurls', 'gops', 'wims', 'pliffs'];
function logic(rng, hard) {
  const [A, B, C] = shuffle(NONSENSE, rng);
  const forms = [
    { p: [t('All {a} are {b}.', { a: A, b: B }), t('All {b} are {c}.', { b: B, c: C })], c: t('All {a} are {c}.', { a: A, c: C }), ans: 0, b: -0.6 },
    { p: [t('All {a} are {b}.', { a: A, b: B }), t('No {b} are {c}.', { b: B, c: C })], c: t('Some {a} are {c}.', { a: A, c: C }), ans: 1, b: 0.2 },
    { p: [t('All {a} are {b}.', { a: A, b: B }), t('Some {b} are {c}.', { b: B, c: C })], c: t('Some {a} are {c}.', { a: A, c: C }), ans: 2, b: 1.4 },
    { p: [t('No {a} are {b}.', { a: A, b: B }), t('All {c} are {a}.', { c: C, a: A })], c: t('No {c} are {b}.', { c: C, b: B }), ans: 0, b: 0.8 },
    { p: [t('All {a} are {b}.', { a: A, b: B })], c: t('All {b} are {a}.', { b: B, a: A }), ans: 2, b: 0.6 },
    { p: [t('Some {a} are {b}.', { a: A, b: B }), t('All {b} are {c}.', { b: B, c: C })], c: t('Some {a} are {c}.', { a: A, c: C }), ans: 0, b: 1.0 },
  ].filter((f) => (hard < 1 ? f.b < 0.5 : hard < 2 ? f.b < 1.1 : true));
  const f = pick(forms, rng);
  const o = [t('It must be true'), t('It cannot be true'), t('You cannot tell')];
  return { t: 'mc', q: `${f.p.join(' ')}  ${t('Conclusion')}: "${f.c}"`, o, a: f.ans, fixedOrder: true, local: true, why: t('Draw the groups as circles inside or outside each other and see whether the conclusion is forced, impossible, or left open.'), d: f.b > 0.7 ? 3 : 2, k: 'reason', b: f.b, fam: 'logic' };
}

// Builds a test. `level` 1–6 and the age band set how hard the items run.
export function buildAptitude(level, band, seed = String(Date.now())) {
  const rng = rngFrom('apt' + seed);
  const bandShift = { tiny: -1.2, kid: -0.5, teen: 0, young: 0.3, adult: 0.4 }[band] ?? 0;
  const hard = Math.max(0, Math.min(3, (level - 1) * 0.5 + 0.6 + bandShift));
  const tiny = band === 'tiny';
  const plan = tiny ? [series, matrix, oddOne, matrix, series, analogy, matrix, series]
    : [series, matrix, analogy, oddOne, logic, series, matrix, analogy, logic, series, matrix, oddOne];
  return plan.map((f, i) => f(rng, Math.max(0, hard + (i / plan.length - 0.5))));
}
export const aptitudePass = (band) => (band === 'tiny' ? 0.4 : 0.5);

// Rasch ability estimate (logits) from answered items with known difficulties.
export function ability(answers) {
  if (!answers.length) return null;
  const right = answers.filter((a) => a.correct).length;
  if (right === 0) return Math.min(...answers.map((a) => a.b)) - 1;
  if (right === answers.length) return Math.max(...answers.map((a) => a.b)) + 1;
  let th = 0;
  for (let i = 0; i < 25; i++) {
    let g = 0, hss = 0;
    for (const a of answers) { const p = 1 / (1 + Math.exp(-(th - a.b))); g += (a.correct ? 1 : 0) - p; hss += p * (1 - p); }
    th += g / Math.max(hss, 1e-6);
  }
  return Math.max(-4, Math.min(4, th));
}

// Maps ability onto the mean-100, SD-15 scale, relative to what the item design expects for the age band.
// Returns a deliberately wide range; null until there is enough evidence.
const EXPECT = { tiny: -1.7, kid: -0.9, teen: -0.2, young: 0.15, adult: 0.3 };
export function reasoningRange(history, band) {
  const all = history.flatMap((h) => h.answers || []);
  if (all.length < 16) return null;
  const th = ability(all);
  const z = (th - (EXPECT[band] ?? 0)) / 1.25;
  const mid = Math.round((100 + 15 * z) / 5) * 5;
  const half = all.length >= 48 ? 8 : all.length >= 30 ? 10 : 13;
  const lo = Math.max(70, mid - half), hi = Math.min(145, mid + half);
  const label = mid >= 130 ? 'Very high' : mid >= 120 ? 'High' : mid >= 110 ? 'Above average' : mid >= 90 ? 'Average' : mid >= 80 ? 'Developing' : 'Emerging';
  return { lo, hi, mid, label, n: all.length };
}
