import { h, button, canvas, pointer } from '../core/labkit.js';

const SETS = {
  en: ['A', 'B', 'C', 'D', 'E', 'M', 'O', 'S', 'T', 'W'],
  es: ['A', 'E', 'I', 'O', 'U', 'Ñ', 'L', 'M', 'S', 'P'],
  fr: ['A', 'E', 'É', 'È', 'Ç', 'O', 'M', 'S', 'L', 'B'],
  ar: ['ا', 'ب', 'ت', 'ج', 'د', 'ر', 'س', 'م', 'ن', 'ه'],
  ru: ['А', 'Б', 'В', 'Д', 'Е', 'Ж', 'З', 'М', 'О', 'Я'],
  he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ל', 'מ', 'ש', 'ת'],
  it: ['A', 'E', 'I', 'O', 'U', 'M', 'S', 'L', 'G', 'B'],
  el: ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Λ', 'Ο', 'Σ', 'Ω', 'Π'],
  tr: ['A', 'E', 'İ', 'I', 'Ç', 'Ş', 'Ğ', 'Ö', 'Ü', 'O'],
  pt: ['A', 'E', 'Ã', 'Ç', 'Õ', 'O', 'M', 'S', 'L', 'B'],
  zh: ['一', '二', '三', '人', '大', '小', '山', '水', '日', '月'],
  ja: ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'さ', 'た', 'な'],
};
const G = 64; // mask grid resolution

export default {
  id: 'w10-script-tracer',
  world: 10,
  levels: [1, 2],
  kind: 'lab',
  icon: '✍️',
  title: 'Trace the Letter',
  goal: 'Trace the big letter with your finger until it is mostly covered.',
  limits: 'The letter is drawn with your device font, so its shape may differ a little from handwriting. Only the covered area and the spill are scored, not stroke order or direction.',
  mount(root, api) {
    const t = api.t;
    const lang = SETS[api.lang] ? api.lang : 'es';
    const set = SETS[lang];
    let ch, mask, maskN, cover, spill, lifts, guess, done, down = false, last = null, count = 0;
    const SZ = 280;
    const c = canvas(SZ);
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const big = h('div', { class: 'lab-goal', style: { fontSize: '1.4rem', textAlign: 'center' } });
    const guessBox = h('div', { class: 'lab-row' });
    const rtl = lang === 'ar' || lang === 'he';

    function side() { return Math.min(c.w, SZ); }
    function fontStr(s) { return `${Math.round(s * 0.8)}px "Noto Sans","Noto Sans Arabic","Noto Sans Hebrew","Noto Sans CJK SC","Noto Sans CJK JP",sans-serif`; }

    function buildMask() {
      const off = document.createElement('canvas'); off.width = off.height = G;
      const o = off.getContext('2d');
      o.fillStyle = '#000'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.font = fontStr(G);
      o.fillText(ch, G / 2, G / 2 + G * 0.04);
      const d = o.getImageData(0, 0, G, G).data;
      mask = new Uint8Array(G * G); maskN = 0;
      for (let i = 0; i < G * G; i++) if (d[i * 4 + 3] > 100) { mask[i] = 1; maskN++; }
      // dilated mask: cells within 3 cells of the glyph
      near = new Uint8Array(G * G);
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (mask[y * G + x]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < G && Y < G) near[Y * G + X] = 1;
      }
    }
    let near;

    function newChar() {
      let next; do { next = set[Math.floor(api.rng() * set.length)]; } while (next === ch && set.length > 1);
      ch = next; guess = null; done = false; lifts = 0; count = 0;
      cover = new Uint8Array(G * G); spill = new Uint8Array(G * G); strokes = [];
      buildMask(); drawGuess(); report(); draw();
    }
    let strokes = [];

    function stamp(p) {
      const s = side(), ox = (c.w - s) / 2;
      const gx = ((p.x - ox) / s) * G, gy = (p.y / s) * G, r = 3.2;
      for (let y = Math.max(0, Math.floor(gy - r)); y <= Math.min(G - 1, Math.ceil(gy + r)); y++)
        for (let x = Math.max(0, Math.floor(gx - r)); x <= Math.min(G - 1, Math.ceil(gx + r)); x++)
          if ((x - gx) ** 2 + (y - gy) ** 2 <= r * r) { const i = y * G + x; if (mask[i]) cover[i] = 1; else if (!near[i]) spill[i] = 1; }
    }
    function score() {
      let cv = 0, sp = 0;
      for (let i = 0; i < G * G; i++) { cv += cover[i] & mask[i]; sp += spill[i]; }
      return { cov: maskN ? cv / maskN : 0, sp };
    }
    function report() {
      const { cov, sp } = score();
      const pct = Math.round(cov * 100);
      status.className = 'note';
      status.textContent = `${t('Covered')}: ${pct}%` + (sp > 60 ? ` · ${t('Stay on the letter!')}` : '');
      if (!done && maskN > 20 && cov >= 0.8 && sp <= 120) {
        done = true; status.className = 'note ok'; status.textContent = `${t('Great tracing!')} ${pct}%`;
        api.say(t('Tracing trains your hand to remember the shape of each letter.'));
        api.complete(Math.max(0.6, Math.min(1, (cov - 0.1) + (guess === lifts ? 0.1 : 0))), `Traced "${ch}" with ${pct}% covered.`);
      }
    }
    function draw() {
      const { ctx } = c, s = side(), ox = (c.w - s) / 2;
      ctx.clearRect(0, 0, c.w, SZ);
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(ox, 0, s, s);
      ctx.fillStyle = 'rgba(80,90,140,0.28)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontStr(s);
      ctx.fillText(ch, c.w / 2, s / 2 + s * 0.04);
      ctx.strokeStyle = '#ff6b3d'; ctx.lineWidth = Math.max(10, s / 14); ctx.lineCap = ctx.lineJoin = 'round';
      for (const st of strokes) {
        ctx.beginPath(); st.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        if (st.length === 1) ctx.lineTo(st[0].x + 0.1, st[0].y); ctx.stroke();
      }
    }
    function drawGuess() {
      guessBox.replaceChildren(h('span', null, t('Guess: how many times will you lift your finger?')),
        ...[1, 2, 3, 4].map((k) => h('button', { class: 'chip' + (guess === k ? ' on' : ''), type: 'button', style: { minHeight: '44px', minWidth: '44px', justifyContent: 'center' }, onClick: () => { guess = k; drawGuess(); } }, String(k))));
    }
    const dn = (ev) => { down = true; c.el.setPointerCapture?.(ev.pointerId); lifts++; const p = pointer(c.el, ev); strokes.push([p]); stamp(p); last = p; draw(); report(); };
    const mv = (ev) => { if (!down) return; const p = pointer(c.el, ev); const st = strokes[strokes.length - 1]; const dx = p.x - last.x, dy = p.y - last.y, d = Math.hypot(dx, dy);
      for (let k = 1; k <= Math.ceil(d / 4); k++) stamp({ x: last.x + (dx * k) / Math.ceil(d / 4), y: last.y + (dy * k) / Math.ceil(d / 4) });
      st.push(p); last = p; if (++count % 2 === 0) { draw(); report(); } };
    const up = () => { if (down) { down = false; draw(); report(); } };
    c.el.addEventListener('pointerdown', dn); c.el.addEventListener('pointermove', mv);
    c.el.addEventListener('pointerup', up); c.el.addEventListener('pointercancel', up);
    c.onResize = draw;
    c.el.setAttribute('aria-label', t('Tracing pad'));
    root.append(h('div', { class: 'lab', dir: rtl ? 'rtl' : 'ltr' }, big, guessBox, c.el, status,
      h('div', { class: 'lab-row' }, button(t('Clear'), () => { cover.fill(0); spill.fill(0); strokes = []; lifts = 0; done = false; report(); draw(); }, 'btn ghost sm'),
        button(t('Next letter'), newChar, 'btn sm'))));
    big.textContent = t('Trace the big letter!');
    newChar();
    api.say(t('Put your finger on the grey letter and follow its shape.'));
    return () => { c.el.removeEventListener('pointerdown', dn); c.el.removeEventListener('pointermove', mv); c.el.removeEventListener('pointerup', up); c.el.removeEventListener('pointercancel', up); };
  },
};
