import { h, button, canvas, loop, readout, pointer } from '../core/labkit.js';

// A profile is the distance from the spin axis (0–1) at N heights, top to bottom. Spinning it makes a solid of revolution.
const N = 28;
const bump = (u, c, w) => Math.exp(-(((u - c) / w) ** 2));
export const SHAPES = [
  ['Vase', (u) => 0.28 + 0.5 * bump(u, 0.62, 0.25) + 0.18 * bump(u, 0, 0.1)],
  ['Bowl', (u) => (u < 0.35 ? 0 : 0.2 + 0.75 * Math.sqrt(1 - ((u - 0.35) / 0.65) ** 2))],
  ['Bell', (u) => 0.12 + 0.8 * u * u + 0.1 * bump(u, 0.05, 0.08)],
  ['Ball', (u) => 0.9 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))],
  ['Cone', (u) => 0.04 + 0.85 * u],
  ['Hourglass', (u) => 0.15 + 0.75 * Math.abs(2 * u - 1)],
  ['Bottle', (u) => (u < 0.35 ? 0.18 : u < 0.5 ? 0.18 + (u - 0.35) / 0.15 * 0.47 : 0.65)],
  ['Spinning top', (u) => (u < 0.3 ? 0.08 : 0.08 + 0.85 * Math.sin(Math.PI * (u - 0.3) / 0.7) ** 0.7 * (1 - 0.5 * (u - 0.3)))],
];
export const profileOf = (fn) => Array.from({ length: N }, (_, i) => Math.max(0, Math.min(1, fn(i / (N - 1)))));
const ROUNDS = 3;

export default {
  id: 'w15-wheel',
  world: 15,
  levels: [1, 2],
  kind: 'studio',
  icon: '🏺',
  title: 'Sculpture Wheel',
  goal: 'Guess which shape the spinning wheel will make from a line, then shape your own clay.',
  limits: 'The wheel makes perfectly round shapes from one line, like a potter\'s wheel or a lathe. Real clay can sag, wobble and be hollow, and the shading here is only a drawing trick, not real light.',
  mount(root, api) {
    const t = api.t, lvl = api.level <= 1 ? 1 : 2;
    const cv = canvas(300, { light: true });
    let prof = profileOf(SHAPES[0][1]), stage = 'guess', spin = 0, reveal = 0, round = 0, right = 0, done = false, answer = 0, firstTry = true, drawing = false, shaped = false;
    const prompt = h('div', { class: 'lab-goal', style: { fontSize: '1.15rem', textAlign: 'center' }, 'aria-live': 'polite' });
    const options = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    const starsOut = readout(t('Stars'), '0 / ' + ROUNDS);

    const geo = () => ({ cx: cv.w / 2, top: 26, hgt: cv.h - 60, R: Math.min(cv.w / 2 - 14, 125) });
    const yOf = (i, g) => g.top + (i / (N - 1)) * g.hgt;

    function thumb(fn, colour) { // small picture of the finished, mirrored shape
      const c = h('canvas', { width: 144, height: 144, style: { width: '72px', height: '72px', display: 'block' }, 'aria-hidden': 'true' });
      const x = c.getContext('2d'), p = profileOf(fn);
      x.fillStyle = colour; x.beginPath();
      p.forEach((r, i) => x[i ? 'lineTo' : 'moveTo'](72 + r * 62, 10 + (i / (N - 1)) * 124));
      for (let i = N - 1; i >= 0; i--) x.lineTo(72 - p[i] * 62, 10 + (i / (N - 1)) * 124);
      x.closePath(); x.fill();
      return c;
    }

    function draw() {
      const { ctx } = cv, g = geo(), tilt = 0.16;
      ctx.clearRect(0, 0, cv.w, cv.h);
      // the wheel
      ctx.fillStyle = '#c9b8a3'; ctx.beginPath(); ctx.ellipse(g.cx, g.top + g.hgt + 12, g.R + 8, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8947c'; ctx.beginPath(); ctx.ellipse(g.cx, g.top + g.hgt + 8, g.R + 8, 16, 0, 0, Math.PI * 2); ctx.fill();
      if (reveal > 0) { // the solid: stacked bands shaded from light (left) to dark (right)
        ctx.globalAlpha = Math.min(1, reveal);
        for (let i = 0; i < N - 1; i++) {
          const r0 = prof[i] * g.R, r1 = prof[i + 1] * g.R, y0 = yOf(i, g), y1 = yOf(i + 1, g), rm = Math.max(r0, r1, 1);
          const grad = ctx.createLinearGradient(g.cx - rm, 0, g.cx + rm, 0);
          grad.addColorStop(0, '#d98f5f'); grad.addColorStop(0.3, '#f6c9a3'); grad.addColorStop(1, '#8d4f2c');
          ctx.fillStyle = grad; ctx.beginPath();
          ctx.moveTo(g.cx - r0, y0); ctx.lineTo(g.cx + r0, y0); ctx.lineTo(g.cx + r1, y1 + 0.6); ctx.lineTo(g.cx - r1, y1 + 0.6); ctx.closePath(); ctx.fill();
        }
        const rb = prof[N - 1] * g.R, rt = prof[0] * g.R; // rounded base and top rim make it look solid
        ctx.fillStyle = '#b46e44'; ctx.beginPath(); ctx.ellipse(g.cx, yOf(N - 1, g), rb, rb * tilt, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#e9b48c'; ctx.beginPath(); ctx.ellipse(g.cx, yOf(0, g), rt, rt * tilt, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(90, 45, 20, .35)'; ctx.lineWidth = 1.5;
        for (let k = 0; k < 8; k++) { // lines painted on the clay travel round as it turns
          const a = spin + (k * Math.PI) / 4;
          if (Math.cos(a) <= 0) continue;
          ctx.beginPath();
          prof.forEach((r, i) => ctx[i ? 'lineTo' : 'moveTo'](g.cx + r * g.R * Math.sin(a), yOf(i, g) + r * g.R * Math.cos(a) * tilt * 0.5));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // the spin axis and the drawn line (one side only)
      ctx.setLineDash([6, 6]); ctx.strokeStyle = '#5b6585'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(g.cx, 6); ctx.lineTo(g.cx, g.top + g.hgt + 10); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#d9485f'; ctx.lineWidth = reveal > 0 ? 3 : 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); prof.forEach((r, i) => ctx[i ? 'lineTo' : 'moveTo'](g.cx + r * g.R, yOf(i, g))); ctx.stroke();
    }

    function ask() {
      stage = 'guess'; reveal = 0; firstTry = true;
      const picks = SHAPES.map((s, i) => [api.rng(), i]).sort((a, b) => a[0] - b[0]).slice(0, lvl === 1 ? 2 : 3).map((x) => x[1]);
      answer = picks[Math.floor(api.rng() * picks.length)];
      prof = profileOf(SHAPES[answer][1]);
      prompt.textContent = '🌀 ' + t('What will the wheel make from the red line?');
      options.replaceChildren(...picks.map((i) => h('button', { class: 'btn ghost', type: 'button', style: { padding: '.3rem' }, 'aria-label': t(SHAPES[i][0]), onClick: (e) => pick(i, e.currentTarget) },
        thumb(SHAPES[i][1], '#c9773f'))));
      draw();
    }
    function pick(i, el) {
      if (stage !== 'guess') return;
      if (i !== answer) { firstTry = false; el.disabled = true; api.say(t('Not that one. Look at where the red line is far from the middle: the shape is wide there.')); return; }
      stage = 'spin'; round++; if (firstTry) right++;
      starsOut.set(Math.min(round, ROUNDS) + ' / ' + ROUNDS);
      if (api.reducedMotion) reveal = 1;
      prompt.textContent = '✨ ' + t(SHAPES[answer][0]) + '! ' + t('Now drag the clay to change it.');
      api.say(t('Spinning copies the line all the way round. Both sides match: that is symmetry.'));
      options.replaceChildren(button('▶️ ' + t(round >= ROUNDS ? 'One more' : 'Next'), ask, 'btn'));
      if (round >= ROUNDS && !done) { done = true; api.complete(Math.max(0.4, right / ROUNDS), t('Predicted the solid that a spinning profile makes, and shaped clay on the wheel.')); }
      draw();
    }

    function shape(ev) { // dragging pushes or pulls the clay at that height; both sides follow
      if (stage !== 'spin') return;
      const p = pointer(cv.el, ev), g = geo();
      const i = Math.round(((p.y - g.top) / g.hgt) * (N - 1)), r = Math.min(1, Math.abs(p.x - g.cx) / g.R);
      if (i < 0 || i >= N) return;
      for (let k = -2; k <= 2; k++) if (i + k >= 0 && i + k < N) { const w = [1, 0.6, 0.25][Math.abs(k)]; prof[i + k] += (r - prof[i + k]) * w; }
      if (!shaped) { shaped = true; api.say(t('You only move one side, and the wheel shapes the whole way round.')); }
      if (api.reducedMotion) draw();
    }
    const down = (e) => { if (stage !== 'spin') { api.say(t('Guess first! Tap one of the shapes.')); return; } drawing = true; cv.el.setPointerCapture?.(e.pointerId); shape(e); };
    const move = (e) => { if (drawing) shape(e); };
    const up = () => { drawing = false; };
    cv.el.addEventListener('pointerdown', down); cv.el.addEventListener('pointermove', move);
    cv.el.addEventListener('pointerup', up); cv.el.addEventListener('pointercancel', up);
    cv.el.setAttribute('aria-label', t('Potter\'s wheel with a red profile line and the clay shape it makes'));
    cv.onResize = draw;

    const stopLoop = loop((dt) => {
      if (stage !== 'spin' || api.reducedMotion) return;
      spin += dt * 2.2; reveal = Math.min(1, reveal + dt * 1.5); draw();
    });

    root.append(h('div', { class: 'lab' }, prompt, options, cv.el, h('div', { class: 'lab-row' }, starsOut.el)));
    ask();
    api.say(t('A potter\'s wheel spins a line round and round to make a round shape. Guess the shape first!'));

    return () => {
      stopLoop(); cv.onResize = null;
      cv.el.removeEventListener('pointerdown', down); cv.el.removeEventListener('pointermove', move);
      cv.el.removeEventListener('pointerup', up); cv.el.removeEventListener('pointercancel', up);
    };
  },
};
