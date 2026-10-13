// Building blocks for the virtual labs in js/labs/. See tools/LABS.md for the lab contract.
import { h } from './util.js';

export { h };

// A labelled slider. Returns { el, get value(), set(v) }.
export function slider({ label, min, max, step = 1, value, unit = '', onInput }) {
  const out = h('output', null, `${value} ${unit}`);
  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  input.addEventListener('input', () => { out.textContent = `${+input.value} ${unit}`; onInput?.(+input.value); });
  const el = h('label', { class: 'lab-ctl' }, h('span', null, label, ' ', out), input);
  return { el, get value() { return +input.value; }, set(v) { input.value = v; out.textContent = `${+input.value} ${unit}`; } };
}

// A value box. Returns { el, set(text) }.
export function readout(label, value = '–') {
  const b = h('b', null, value);
  return { el: h('div', { class: 'readout' }, b, h('span', null, label)), set(v) { b.textContent = v; } };
}

export function button(label, onClick, cls = 'btn sm') {
  return h('button', { class: cls, type: 'button', onClick }, label);
}

// A choice of chips. Returns { el, get value() }.
export function choice(options, value, onChange) {
  let cur = value;
  const el = h('div', { class: 'lab-row', role: 'radiogroup' });
  const draw = () => el.replaceChildren(...options.map(([v, text]) => h('button', {
    class: 'chip' + (v === cur ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(v === cur),
    onClick: () => { cur = v; draw(); onChange?.(v); },
  }, text)));
  draw();
  return { el, get value() { return cur; } };
}

// A responsive canvas in CSS pixels. Returns { el, ctx, w, h } where w/h track the drawn size.
// `light: true` gives a pale background (for charts); default is a dark "space" background.
export function canvas(height = 260, { light = false } = {}) {
  const el = h('canvas', { class: 'lab-canvas' + (light ? ' light' : ''), role: 'img' });
  const ctx = el.getContext('2d');
  const c = { el, ctx, w: 300, h: height };
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.w = Math.max(220, el.clientWidth || el.parentElement?.clientWidth || 300);
    el.style.height = height + 'px';
    el.width = Math.round(c.w * dpr); el.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.onResize?.();
  };
  c.fit = fit;
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(el);
  queueMicrotask(fit);
  return c;
}

// Animation loop; fn(dtSeconds, tSeconds). Returns a stop function. Pauses when the tab is hidden.
export function loop(fn) {
  let id = 0, last = 0, t = 0, alive = true;
  const tick = (now) => {
    if (!alive) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; t += dt;
    fn(dt, t);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => { alive = false; cancelAnimationFrame(id); };
}

// "Predict, then test": asks for a numeric prediction and compares it with the model value.
// Returns the element; calls onResult(relativeError) after the learner checks.
export function predict({ question, unit = '', truth, tolerance = 0.1, onResult }) {
  const input = h('input', { class: 'input', type: 'text', inputmode: 'decimal', 'aria-label': question, style: { maxWidth: '140px' } });
  const out = h('div', { class: 'small', 'aria-live': 'polite' });
  const check = () => {
    const guess = parseFloat(String(input.value).replace(',', '.'));
    if (!Number.isFinite(guess)) { out.textContent = '…'; return; }
    const real = typeof truth === 'function' ? truth() : truth;
    const err = Math.abs(guess - real) / (Math.abs(real) || 1);
    out.textContent = `${err <= tolerance ? '✅' : '🔁'} ${fmt(real)} ${unit}`;
    onResult?.(err);
  };
  return h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, question), input, h('span', null, unit), button('✔ Check', check), out);
}

// Tidy number formatting for readouts.
export function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(2).replace('e+', '×10^').replace('e-', '×10^-');
  return String(+v.toPrecision(digits));
}

// Pointer position inside a canvas in CSS pixels.
export function pointer(el, ev) {
  const r = el.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}
