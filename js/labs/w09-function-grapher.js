import { h, slider, readout, button, choice, canvas, predict, fmt } from '../core/labkit.js';

export default {
  id: 'w09-function-grapher',
  world: 9,
  levels: [3, 4],
  kind: 'lab',
  icon: '📈',
  title: 'Function Grapher',
  goal: 'Shape the curve so that it passes through every target dot.',
  limits: 'Only y = ax² + bx + c (lines when a = 0) drawn for x from −6 to 6. Coefficients move in steps of 0.5, and a dot counts as hit when the curve is within 0.3 of it.',
  mount(root, api) {
    const t = api.t;
    const ri = (lo, hi) => lo + Math.floor(api.rng() * (hi - lo + 1));
    let mode = 'lin';
    let secret, targets, done = false, predicted = null;
    const f = (co, x) => co.a * x * x + co.b * x + co.c;

    function newMission() {
      done = false; predicted = null;
      secret = mode === 'lin' ? { a: 0, b: ri(-2, 2) || 1, c: ri(-3, 3) } : { a: [-1, -0.5, 0.5, 1][ri(0, 3)], b: ri(-2, 2), c: ri(-3, 3) };
      const xs = mode === 'lin' ? [-3, 2] : [-4, 0, 3];
      if (mode !== 'lin') xs[1] = ri(-1, 1);
      targets = xs.map((x) => ({ x, y: f(secret, x) }));
      if (targets.some((p) => Math.abs(p.y) > 6)) return newMission();
      sA.set(0); sB.set(0); sC.set(0);
      status.textContent = ''; status.className = 'note';
      pbox.replaceChildren(predict({ question: t('Predict: y at x = 0 on the target curve'), truth: secret.c, tolerance: 0.01, onResult: (e) => { predicted = e; } }));
      redraw();
    }

    const c = canvas(300, { light: true });
    const sA = slider({ label: 'a (x²)', min: -2, max: 2, step: 0.5, value: 0, onInput: () => redraw() });
    const sB = slider({ label: 'b (x)', min: -4, max: 4, step: 0.5, value: 0, onInput: () => redraw() });
    const sC = slider({ label: 'c', min: -6, max: 6, step: 0.5, value: 0, onInput: () => redraw() });
    const eq = readout(t('your rule'), '');
    const hits = readout(t('dots hit'), '0');
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const pbox = h('div');
    const mchoice = choice([['lin', t('Straight line')], ['quad', t('Curve')]], 'lin', (v) => { mode = v; sA.el.style.display = v === 'lin' ? 'none' : ''; newMission(); });
    if (api.level < 4) mchoice.el.style.display = 'none';
    sA.el.style.display = 'none';

    function redraw() {
      const { ctx, w } = c, H = 300, X = 6, Y = 7;
      const px = (x) => ((x + X) / (2 * X)) * w, py = (y) => H / 2 - (y / Y) * (H / 2);
      ctx.clearRect(0, 0, w, H);
      ctx.strokeStyle = '#dde3f3'; ctx.lineWidth = 1; ctx.font = '10px system-ui'; ctx.fillStyle = '#8a93ad';
      for (let x = -X; x <= X; x++) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), H); ctx.stroke(); if (x && x % 2 === 0) ctx.fillText(x, px(x) + 2, py(0) + 11); }
      for (let y = -Y + 1; y < Y; y++) { ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(w, py(y)); ctx.stroke(); if (y && y % 2 === 0) ctx.fillText(y, px(0) + 3, py(y) - 2); }
      ctx.strokeStyle = '#4b5578'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.moveTo(px(0), 0); ctx.lineTo(px(0), H); ctx.stroke();
      const co = { a: sA.value, b: sB.value, c: sC.value };
      ctx.strokeStyle = '#5b6cff'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const x = -X + (i / 120) * 2 * X, y = f(co, x); i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)); }
      ctx.stroke();
      let n = 0;
      for (const p of targets) {
        const ok = Math.abs(f(co, p.x) - p.y) <= 0.3; if (ok) n++;
        ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 8, 0, 7); ctx.fillStyle = ok ? '#17a673' : '#f5a000'; ctx.fill();
        ctx.fillStyle = '#222'; ctx.font = '700 11px system-ui'; ctx.fillText(`(${p.x}, ${p.y})`, px(p.x) + 10, py(p.y) - 8);
      }
      const parts = [];
      const add = (v, sym) => { if (!v) return; parts.push((parts.length ? (v < 0 ? ' − ' : ' + ') : (v < 0 ? '−' : '')) + fmt(Math.abs(v)) + sym); };
      if (mode === 'quad') add(co.a, 'x²');
      add(co.b, 'x'); add(co.c, '');
      eq.set('y = ' + (parts.join('') || '0'));
      hits.set(`${n} / ${targets.length}`);
      if (n === targets.length && !done) {
        done = true; status.className = 'note ok'; status.textContent = t('All dots hit!');
        api.say(mode === 'lin' ? t('b is the slope: how much y changes when x goes up by 1. c is where the line crosses the y-axis.') : t('a bends the curve: positive opens up, negative opens down. c is where it crosses the y-axis.'));
        api.complete(predicted === 0 ? 1 : 0.85, mode === 'lin' ? 'Found a line through two points.' : 'Fitted a quadratic through three points.');
      }
    }
    c.onResize = redraw;
    c.el.setAttribute('aria-label', t('Graph with target dots and your curve'));
    root.append(h('div', { class: 'lab' }, mchoice.el, pbox, c.el, h('div', { class: 'lab-row' }, eq.el, hits.el), sA.el, sB.el, sC.el, status,
      button(t('New mission'), () => newMission(), 'btn ghost sm')));
    newMission();
    api.say(t('Guess first, then move the sliders until the curve touches all the orange dots.'));
    return () => {};
  },
};
