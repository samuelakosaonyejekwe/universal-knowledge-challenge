import { h, slider, readout, button, canvas, loop, predict, fmt } from '../core/labkit.js';

export default {
  id: 'w11-predator-prey',
  world: 11,
  levels: [5, 6],
  kind: 'lab',
  icon: '🐇',
  title: 'Predator and Prey',
  goal: 'Tune the predators so the prey settle at the target number.',
  limits: 'Two species, a well-mixed area, logistic prey growth (carrying capacity 200), no migration, disease, seasons or randomness. Populations are continuous numbers, so they can fall below one animal.',
  mount(root, api) {
    const t = api.t;
    const r = 0.8, K = 200, b = 0.2; // prey growth (1/yr), carrying capacity, conversion efficiency
    const target = 40 + 10 * Math.floor(api.rng() * 9); // 40..120
    let N, P, time, hist, running = false, done = false, guessOk = false, minN, minP;
    const sA = slider({ label: t('Attack rate a (per predator per year)'), min: 0.005, max: 0.03, step: 0.001, value: 0.01, unit: '', onInput: () => preview() });
    const sM = slider({ label: t('Predator death rate m (per year)'), min: 0.1, max: 0.8, step: 0.05, value: 0.4, unit: '', onInput: () => preview() });
    const c = canvas(240, { light: true });
    const rN = readout(t('prey N'), '–'), rP = readout(t('predators P'), '–'), rE = readout(t('equilibrium N* = m/(b·a)'), '–'), rT = readout(t('years'), '0');
    const out = h('div', { class: 'note', 'aria-live': 'polite' });
    const nStar = () => sM.value / (b * sA.value);

    function reset() { N = 100; P = 10; time = 0; hist = [[N, P]]; minN = N; minP = P; running = false; preview(); draw(); }
    function preview() { rE.set(fmt(nStar(), 3)); }
    function step(dt) {
      const a = sA.value, m = sM.value;
      const f = (n, p) => [r * n * (1 - n / K) - a * n * p, b * a * n * p - m * p];
      const k1 = f(N, P), k2 = f(N + (dt / 2) * k1[0], P + (dt / 2) * k1[1]), k3 = f(N + (dt / 2) * k2[0], P + (dt / 2) * k2[1]), k4 = f(N + dt * k3[0], P + dt * k3[1]);
      N = Math.max(0, N + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]));
      P = Math.max(0, P + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]));
      time += dt;
    }
    function draw() {
      const { ctx, w } = c, H = 240, T = 60, Y = 220;
      ctx.clearRect(0, 0, w, H);
      ctx.strokeStyle = '#dde3f3'; ctx.fillStyle = '#8a93ad'; ctx.font = '10px system-ui';
      for (let y = 0; y <= Y; y += 50) { const py = H - 16 - (y / Y) * (H - 30); ctx.beginPath(); ctx.moveTo(24, py); ctx.lineTo(w, py); ctx.stroke(); ctx.fillText(y, 2, py + 3); }
      const py = H - 16 - (target / Y) * (H - 30);
      ctx.strokeStyle = '#17a673'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(24, py); ctx.lineTo(w, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#17a673'; ctx.fillText(`${t('target')} ${target}`, w - 70, py - 3);
      const line = (i, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); hist.forEach((q, k) => { const x = 24 + ((k * 0.2) / T) * (w - 28), y = H - 16 - (Math.min(Y, q[i]) / Y) * (H - 30); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
      line(0, '#3b9d5a'); line(1, '#d9485f');
      ctx.fillStyle = '#3b9d5a'; ctx.fillText(t('prey'), 30, 12); ctx.fillStyle = '#d9485f'; ctx.fillText(t('predators'), 70, 12);
      rN.set(fmt(N, 3)); rP.set(fmt(P, 3)); rT.set(fmt(time, 3));
    }
    let acc = 0;
    const stop = loop((dt) => {
      if (!running) return;
      acc += dt * (api.reducedMotion ? 20 : 8); // simulated years per second
      while (acc >= 0.2 && time < T_END) {
        for (let i = 0; i < 10; i++) step(0.02);
        acc -= 0.2; hist.push([N, P]); minN = Math.min(minN, N); minP = Math.min(minP, P);
      }
      draw();
      if (time >= T_END) { running = false; verdict(); }
    });
    const T_END = 60;
    function verdict() {
      const alive = minN > 1 && minP > 1;
      const close = Math.abs(N - target) / target <= 0.1;
      if (alive && close) {
        out.className = 'note ok'; out.textContent = `${t('Both species survived and prey settled near')} ${fmt(N, 3)}.`;
        if (!done) { done = true; api.say(t('At balance the predators only just replace themselves, so prey equals m/(b·a): a tougher or hungrier predator needs fewer prey to live on.')); api.complete(guessOk ? 1 : 0.8, `Prey equilibrium ${fmt(N, 3)} near target ${target}.`); }
      } else { out.className = 'note warn'; out.textContent = !alive ? t('A population almost vanished. Change the rates and try again.') : `${t('Prey ended at')} ${fmt(N, 3)}, ${t('not near')} ${target}. ${t('Use N* = m/(b·a) to adjust.')}`; }
    }
    const preBox = predict({ question: t('Predict N* for these sliders'), truth: () => nStar(), tolerance: 0.05, onResult: (e) => { guessOk = e <= 0.05; } });
    c.onResize = draw;
    c.el.setAttribute('aria-label', t('Graph of prey and predator numbers over 60 years'));
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, `${t('Mission: settle the prey at')} ${target} ${t('(±10%) with both species alive.')}`),
      h('div', { class: 'small' }, t('Model: dN/dt = rN(1−N/K) − aNP, dP/dt = b·aNP − mP, with r = 0.8/yr, K = 200, b = 0.2.')),
      sA.el, sM.el, preBox, c.el, h('div', { class: 'lab-row' }, rN.el, rP.el, rE.el, rT.el),
      h('div', { class: 'lab-row' }, button(t('▶ Run 60 years'), () => { reset(); running = true; out.className = 'note'; out.textContent = ''; }, 'btn gold'), button(t('Reset'), reset, 'btn ghost sm')), out));
    reset();
    api.say(t('Predict the balance point first, then watch the two curves chase each other.'));
    return () => { stop(); running = false; };
  },
};
