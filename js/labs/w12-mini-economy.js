import { h, slider, readout, button, canvas, fmt } from '../core/labkit.js';

export default {
  id: 'w12-mini-economy',
  world: 12,
  levels: [5, 6],
  kind: 'lab',
  icon: '🏦',
  title: 'Mini Economy',
  goal: 'Set the interest rate each quarter to keep inflation near 2% and unemployment near 5% for three years.',
  limits: 'A deliberately simplified textbook model (an IS curve, a Phillips curve and Okun\'s law) with made-up round coefficients. It has no government budget, trade, exchange rates or expectations that change, and it shows trade-offs rather than the right policy. Real central banks weigh many more things.',
  mount(root, api) {
    const t = api.t;
    const Q = 12, PI_T = 2, U_T = 5;
    const noise = () => (api.rng() - 0.5);
    const scenarios = [
      { name: t('Overheating: prices are rising fast'), y: 2, pi: 4.5 },
      { name: t('Slump: demand is weak'), y: -2.5, pi: 1 },
      { name: t('Supply shock: costs jump but demand is average'), y: 0, pi: 3.5 },
    ];
    const sc = scenarios[Math.floor(api.rng() * 3)];
    let y, pi, q, r, hist, shocks, guess = null, hits = 0, asked = 0, done = false, lastPred = null;
    const rate = slider({ label: t('Interest rate this quarter (%)'), min: 0, max: 10, step: 0.25, value: 3, unit: '%' });
    const c = canvas(230, { light: true });
    const rQ = readout(t('quarter'), '0'), rP = readout(t('inflation %'), '–'), rU = readout(t('unemployment %'), '–'), rY = readout(t('output gap %'), '–');
    const out = h('div', { class: 'note', 'aria-live': 'polite' });
    const predBox = h('div', { class: 'lab-row' });
    const u = (yy) => U_T - 0.5 * yy; // Okun's law (simplified)

    function reset() {
      y = sc.y; pi = sc.pi; q = 0; hist = [{ pi, u: u(y) }]; done = false; guess = null;
      shocks = Array.from({ length: Q }, () => ({ e: noise() * 1.0, s: noise() * 0.6 }));
      if (sc.name === scenarios[2].name) shocks[0].s += 0; // supply shock already in the starting inflation
      out.className = 'note'; out.textContent = t('Raising the rate cools demand and lowers inflation, but can raise unemployment. Lowering it does the opposite.');
      show(); draw();
    }
    function ask() {
      predBox.replaceChildren(h('span', { class: 'lab-goal' }, t('Predict next quarter’s inflation:')),
        ...[[1, t('higher')], [0, t('about the same')], [-1, t('lower')]].map(([v, txt]) => h('button', { class: 'chip' + (guess === v ? ' on' : ''), type: 'button', style: { minHeight: '40px' }, onClick: () => { guess = v; ask(); } }, txt)));
    }
    function step() {
      if (q >= Q) return;
      if (guess === null) { out.className = 'note warn'; out.textContent = t('Make a prediction first.'); return; }
      const rr = rate.value, sk = shocks[q];
      const piOld = pi;
      y = 0.8 * y - 0.5 * (rr - pi - 2) + sk.e;
      pi = Math.max(-2, 0.6 * pi + 0.4 * PI_T + 0.3 * y + sk.s);
      q++;
      const d = pi - piOld, dir = Math.abs(d) < 0.15 ? 0 : d > 0 ? 1 : -1;
      asked++; if (dir === guess) hits++;
      hist.push({ pi, u: u(y) });
      out.className = 'note';
      out.textContent = `${t('Inflation went')} ${dir === 0 ? t('about the same') : dir > 0 ? t('up') : t('down')} (${fmt(d, 2)} ${t('points')}). ${dir === guess ? '✅' : '🔁'} ` + (rr - pi > 2.5 ? t('A high real rate squeezes spending.') : rr - pi < 1.5 ? t('A low real rate encourages spending.') : '');
      guess = null; ask(); show(); draw();
      if (q === Q) finish();
    }
    function finish() {
      const ePi = hist.slice(1).reduce((a, p) => a + Math.abs(p.pi - PI_T), 0) / Q, eU = hist.slice(1).reduce((a, p) => a + Math.abs(p.u - U_T), 0) / Q;
      const ok = ePi <= 1 && eU <= 1;
      out.className = 'note ' + (ok ? 'ok' : 'warn');
      out.textContent = `${t('Average miss')}: ${t('inflation')} ${fmt(ePi, 2)} ${t('points')}, ${t('unemployment')} ${fmt(eU, 2)} ${t('points')}. ` + (ok ? t('Both goals were kept close!') : t('Pulling one goal closer can push the other away: try again.'));
      if (ok && !done) { done = true; api.say(t('Policy works with delays: today’s rate changes spending over the next few quarters, so steering early beats reacting late.')); api.complete(Math.min(1, 0.6 + 0.4 * (asked ? hits / asked : 0)), `Avg inflation miss ${fmt(ePi, 2)}, unemployment miss ${fmt(eU, 2)}.`); }
    }
    function show() {
      const p = hist[hist.length - 1];
      rQ.set(`${q} / ${Q}`); rP.set(fmt(p.pi, 3)); rU.set(fmt(p.u, 3)); rY.set(fmt(y, 3));
    }
    function draw() {
      const { ctx, w } = c, H = 230, L = 28;
      ctx.clearRect(0, 0, w, H);
      const py = (v) => H - 18 - ((v + 2) / 12) * (H - 30), px = (i) => L + (i / Q) * (w - L - 8);
      ctx.font = '10px system-ui'; ctx.fillStyle = '#8a93ad'; ctx.strokeStyle = '#e1e6f4'; ctx.lineWidth = 1;
      for (let v = 0; v <= 10; v += 2) { ctx.beginPath(); ctx.moveTo(L, py(v)); ctx.lineTo(w, py(v)); ctx.stroke(); ctx.fillText(v, 4, py(v) + 3); }
      const band = (v, col) => { ctx.strokeStyle = col; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(L, py(v)); ctx.lineTo(w, py(v)); ctx.stroke(); ctx.setLineDash([]); };
      band(PI_T, '#d9485f66'); band(U_T, '#5b6cff66');
      const ln = (k, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); hist.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p[k])) : ctx.moveTo(px(i), py(p[k])))); ctx.stroke(); };
      ln('pi', '#d9485f'); ln('u', '#5b6cff');
      ctx.fillStyle = '#d9485f'; ctx.fillText(t('inflation (goal 2)'), L + 4, 12); ctx.fillStyle = '#5b6cff'; ctx.fillText(t('unemployment (goal 5)'), L + 110, 12);
    }
    c.onResize = draw;
    c.el.setAttribute('aria-label', t('Inflation and unemployment over twelve quarters'));
    root.append(h('div', { class: 'lab' }, h('div', { class: 'note warn' }, t('A simplified model for learning trade-offs, not a forecast or advice.')),
      h('div', { class: 'lab-goal' }, `${t('Start')}: ${sc.name}`),
      h('div', { class: 'small' }, t('Model each quarter: output gap y′ = 0.8y − 0.5(r − π − 2) + shock; inflation π′ = 0.6π + 0.8 + 0.3y′ + shock; unemployment u = 5 − 0.5y.')),
      c.el, h('div', { class: 'lab-row' }, rQ.el, rP.el, rU.el, rY.el), rate.el, predBox,
      h('div', { class: 'lab-row' }, button(t('Advance one quarter'), step, 'btn gold'), button(t('Restart'), reset, 'btn ghost sm')), out));
    ask(); reset();
    api.say(t('Choose a rate, predict what inflation will do, then advance a quarter.'));
    void lastPred;
    return () => {};
  },
};
