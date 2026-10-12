import { h, slider, readout, choice, fmt, predict, canvas } from '../core/labkit.js';

// Conceptual, in abstract "dose units". HVL values (cm) are illustrative round numbers for gamma rays.
const MAT = { none: ['No shield', Infinity], water: ['Water', 10], concrete: ['Concrete', 6], steel: ['Steel', 2.5], lead: ['Lead', 1.2] };

export default {
  id: 'w06-radiation-protection',
  world: 6,
  levels: [5, 6],
  kind: 'lab',
  icon: '🛡️',
  title: 'Radiation Protection Planner',
  goal: 'Plan a short inspection of a sealed (fictional) source so the total dose stays under the limit: use time, distance and shielding.',
  limits: 'Conceptual only. Point source, inverse-square law D = k/d², gamma shielding by half-value layers (HVL), abstract dose units, no scatter or build-up. HVLs are illustrative; real work follows trained professionals, regulations and measured dose rates.',
  mount(root, api) {
    const t = api.t;
    const k = 400 + Math.floor(api.rng() * 5) * 200;       // dose-rate at 1 m, units/h
    const limit = [20, 40, 60][Math.floor(api.rng() * 3)];  // dose units allowed
    let d = 1, time = 30, mat = 'none', x = 0, done = false;
    const c = canvas(150);
    const sd = slider({ label: t('Distance d'), min: 1, max: 10, step: 0.5, value: d, unit: 'm', onInput: v => { d = v; update(); } });
    const st = slider({ label: t('Time near source'), min: 1, max: 60, step: 1, value: time, unit: 'min', onInput: v => { time = v; update(); } });
    const sx = slider({ label: t('Shield thickness'), min: 0, max: 20, step: 0.5, value: x, unit: 'cm', onInput: v => { x = v; update(); } });
    const mc = choice(Object.entries(MAT).map(([key, v]) => [key, t(v[0])]), 'none', v => { mat = v; update(); });
    const rRate = readout(t('Dose rate (units/h)')), rDose = readout(t('Total dose')), rLim = readout(t('Limit'));
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const rate = () => (k / (d * d)) * (MAT[mat][1] === Infinity ? 1 : Math.pow(0.5, x / MAT[mat][1]));
    const dose = () => rate() * time / 60;
    const pr = predict({ question: t('Predict: dose rate if you double the distance from 1 m (units/h)'), unit: '', tolerance: 0.1, truth: () => k / 4 });
    function draw() {
      const { ctx, w } = c, H = 150; ctx.clearRect(0, 0, w, H);
      ctx.fillStyle = '#f5b700'; ctx.beginPath(); ctx.arc(30, 75, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText('source', 8, 108);
      const px = 30 + (d / 10) * (w - 80);
      ctx.fillStyle = '#4aa3ff'; ctx.fillText('🧍', px - 8, 80);
      if (x > 0 && mat !== 'none') { ctx.fillStyle = '#9aa5c8'; const sx0 = 30 + (px - 30) * 0.4; ctx.fillRect(sx0, 30, Math.max(3, x), 90); }
      ctx.strokeStyle = '#f5b70088';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(44, 75); ctx.lineTo(px - 12, 75 + i * 10); ctx.stroke(); }
    }
    function update() {
      const D = dose();
      rRate.set(fmt(rate(), 3)); rDose.set(fmt(D, 3)); rLim.set(String(limit));
      if (D <= limit) {
        msg.className = 'note ok'; msg.textContent = t('Under the limit.');
        if (!done) { done = true; api.say(t('Less time, more distance and more shielding each cut the dose. Doubling distance cuts it to a quarter; each half-value layer halves it.')); api.complete(Math.min(1, 0.6 + 0.4 * (limit - D) / limit), t('Planned a low-dose job with time, distance and shielding.')); }
      } else { msg.className = 'note warn'; msg.textContent = t('Over the limit. Try more distance, a thicker shield or less time.'); }
      draw();
    }
    c.onResize = draw;
    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Source: ') + `${k} units/h at 1 m. ` + t('Keep total dose at or below') + ` ${limit}.`),
      c.el, sd.el, st.el, mc.el, sx.el, h('div', { class: 'lab-row' }, rRate.el, rDose.el, rLim.el), msg, pr,
      h('p', { class: 'small muted' }, 'D = k/d² · (½)^(x/HVL) · t. ' + t('Rule: keep doses as low as reasonably achievable.'))));
    update();
    return () => {};
  },
};
