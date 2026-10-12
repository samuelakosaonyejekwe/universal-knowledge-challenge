// Small shared helpers: DOM building, seeded randomness, text normalisation.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
    else if (k === 'html') el.innerHTML = v; // only ever used with strings built by this app, never with fetched text
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, kids);
  return el;
}
export function add(el, kids) {
  for (const k of [kids].flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
// Screens build their content with el.append(...). Make that accept nested lists and skip empty values
// (null, undefined, false), exactly as h() does, so optional pieces can be written inline.
if (typeof Element !== 'undefined') {
  const nativeAppend = Element.prototype.append;
  Element.prototype.append = function (...kids) {
    return nativeAppend.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false));
  };
}
export const clear = (el) => { el.replaceChildren(); return el; };
export const $ = (sel, root = document) => root.querySelector(sel);

export function hashStr(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
export function rngFrom(seed) {
  let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
export const sample = (arr, n, rng = Math.random) => shuffle(arr, rng).slice(0, n);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const DAY = 86400000;
export const dayNum = (t = Date.now()) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / DAY);
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

// Text normalisation for answer checking: case, accents, punctuation and spacing are ignored.
export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-֑ͯ-ׇً-ٰٟ]/g, '')
    .replace(/[^\p{L}\p{N}\s.\-/]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// 0..1 similarity between two phrases.
export function similar(a, b) {
  a = norm(a).replace(/\s/g, ''); b = norm(b).replace(/\s/g, '');
  if (!a.length && !b.length) return 1;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

const NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
// Reads a number from typed or spoken input: "3.5", "3,5", "1/2", "-4", "2 x 10^3", "twenty five", "minus three".
export function parseNumber(input) {
  let s = String(input ?? '').toLowerCase().trim().replace(/−/g, '-').replace(/×/g, 'x').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2');
  let m = s.match(/(-?\d+(?:\.\d+)?)\s*(?:x|\*)\s*10\s*\^?\s*(-?\d+)/);
  if (m) return parseFloat(m[1]) * 10 ** parseInt(m[2], 10);
  m = s.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (m && +m[2] !== 0) return parseFloat(m[1]) / parseFloat(m[2]);
  m = s.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/);
  if (m) return parseFloat(m[0]) * (/\b(minus|negative)\b/.test(s.slice(0, m.index)) ? -1 : 1);
  const words = s.replace(/-/g, ' ').split(/\s+/);
  let total = 0, cur = 0, seen = false, neg = false, frac = null;
  for (const w of words) {
    if (w === 'minus' || w === 'negative') neg = true;
    else if (w === 'point') frac = '';
    else if (w in NUM_WORDS) { seen = true; if (frac !== null) frac += NUM_WORDS[w]; else cur += NUM_WORDS[w]; }
    else if (w === 'hundred') { cur = (cur || 1) * 100; seen = true; }
    else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; seen = true; }
    else if (w === 'million') { total += (cur || 1) * 1e6; cur = 0; seen = true; }
    else if (w === 'half' && !seen) return 0.5;
  }
  if (!seen) return NaN;
  const v = total + cur + (frac ? parseFloat('0.' + frac) : 0);
  return neg ? -v : v;
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Slow, salted hash for sign-in secrets and guardian PINs (stored locally only).
export async function slowHash(secret, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 120000 }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}
export function modal(content, { dismiss = true } = {}) {
  const back = h('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'modal' }, content));
  const close = () => back.remove();
  if (dismiss) back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.body.append(back);
  back.querySelector('button, input, select, textarea, a')?.focus();
  return close;
}
export function confetti(n = 70) {
  if (document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const cols = ['#f5b700', '#ff6b8b', '#4f5bd5', '#17a673', '#8a5cf6', '#ff9e3c'];
  for (let i = 0; i < n; i++) box.append(h('i', { style: { left: Math.random() * 100 + 'vw', background: pick(cols), animationDuration: 1.8 + Math.random() * 2 + 's', animationDelay: Math.random() * 0.6 + 's' } }));
  document.body.append(box);
  setTimeout(() => box.remove(), 4600);
}
