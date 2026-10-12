import { h, slider, readout, button, choice, canvas, loop, predict, fmt } from '../core/labkit.js';

// E (GPa), allowable bending stress (MPa), density (kg/m³)
const MATS = { wood: ['Pine wood', 11, 8, 500], steel: ['Steel', 200, 150, 7850], alu: ['Aluminium', 69, 90, 2700] };

// Simply-supported beam, central load: M = FL/4, σ = M·c/I, δ = FL³/(48EI).
export default {
  id: 'w03-beam-design',
  world: 3,
  levels: [5, 6],
  kind: 'lab',
  icon: '🏗️',
  title: 'Beam Designer',
  goal: 'Size a beam that is strong and stiff enough, with as little material as possible.',
  limits: 'A rectangular beam resting on two supports with one point load in the middle; small deflections, a uniform material and no self-weight. Real beams also need checks for shear, buckling and connections.',
  mount(root, api) {
    const t = api.t;
    const F = (5 + Math.floor(api.rng() * 6) * 5) * 1e3; // N
    const L = 2 + Math.floor(api.rng() * 5); // m
    const lim = L / 360;
    let mat = 'steel', b = 60, hh = 100, done = false, predictedOk = false;

    const calc = (m = mat, bb = b, h2 = hh) => {
      const [, E, sa, rho] = MATS[m], B = bb / 1e3, Hh = h2 / 1e3, I = B * Hh ** 3 / 12;
      return { d: F * L ** 3 / (48 * E * 1e9 * I), s: (F * L / 4) * (Hh / 2) / I / 1e6, sa, mass: rho * B * Hh * L };
    };
    const lightest = (m) => { let best = Infinity; for (let bb = 20; bb <= 300; bb += 5) for (let h2 = 20; h2 <= 500; h2 += 5) { const r = calc(m, bb, h2); if (r.d <= lim && r.s <= r.sa && r.mass < best) best = r.mass; } return best; };

    const cv = canvas(210, { light: true });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Mission: span ') + L + t(' m, load ') + fmt(F / 1e3) + t(' kN in the middle. Sag must stay under span/360 = ') + fmt(lim * 1e3) + t(' mm and the stress under the material limit.'));
    const mats = choice(Object.entries(MATS).map(([k, v]) => [k, t(v[0])]), 'steel', (k) => { mat = k; upd(); });
    const bs = slider({ label: t('Width b (mm)'), min: 20, max: 300, step: 5, value: b, unit: 'mm', onInput: (v) => { b = v; upd(); } });
    const hs = slider({ label: t('Height h (mm)'), min: 20, max: 500, step: 5, value: hh, unit: 'mm', onInput: (v) => { hh = v; upd(); } });
    const rd = readout(t('Sag δ (mm)'), '–'), rs = readout(t('Stress σ (MPa)'), '–'), rm = readout(t('Mass (kg)'), '–');
    const pred = predict({ question: t('Sag of this beam (mm)?'), unit: 'mm', truth: () => calc().d * 1e3, tolerance: 0.1, onResult: (e) => { predictedOk = predictedOk || e <= 0.1; } });
    function upd() { const r = calc(); rd.set(fmt(r.d * 1e3)); rs.set(fmt(r.s)); rm.set(fmt(r.mass)); }
    upd();

    function check() {
      const r = calc(), okD = r.d <= lim, okS = r.s <= r.sa;
      if (!okS) { msg.className = 'note bad'; msg.textContent = t('Too weak: stress ') + fmt(r.s) + t(' MPa is above ') + r.sa + t(' MPa. Make it taller (stress falls with h²).'); api.say(t('Bending stress is σ = M·c/I, and I grows with the cube of height, so height helps most.')); return; }
      if (!okD) { msg.className = 'note warn'; msg.textContent = t('Strong enough but too bendy: sag ') + fmt(r.d * 1e3) + t(' mm. Use a stiffer material or more height.'); api.say(t('Sag is δ = FL³/(48EI): double the height and the sag drops 8 times.')); return; }
      const best = lightest(mat), sc = Math.min(1, best / r.mass);
      msg.className = 'note ok'; msg.textContent = t('Passes! Mass ') + fmt(r.mass) + t(' kg; the lightest ') + t(MATS[mat][0]) + t(' beam that passes is about ') + fmt(best) + ' kg.';
      if (!done) { done = true; api.say(t('Tall and thin beams resist bending best, because material far from the middle does the work.')); api.complete(Math.max(0.5, sc * 0.85 + (predictedOk ? 0.15 : 0)), t('Beam stiffness grows with h³ (I = bh³/12), so a deeper beam saves material.')); }
    }

    const stop = loop(() => {
      const c = cv.ctx, W = cv.w, r = calc(), x0 = 30, x1 = W - 30, y0 = 70;
      c.fillStyle = '#f7f9ff'; c.fillRect(0, 0, W, 210);
      const dpx = Math.min(70, Math.max(2, r.d / lim * 18));
      c.strokeStyle = r.s <= r.sa && r.d <= lim ? '#17a673' : '#d9485f'; c.lineWidth = Math.max(4, Math.min(16, hh / 40));
      c.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, x = x0 + u * (x1 - x0), y = y0 + dpx * Math.sin(Math.PI * u); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      c.fillStyle = '#556'; c.beginPath(); c.moveTo(x0, y0 + 10); c.lineTo(x0 - 12, y0 + 30); c.lineTo(x0 + 12, y0 + 30); c.fill(); c.beginPath(); c.arc(x1, y0 + 20, 10, 0, 7); c.fill();
      c.strokeStyle = '#e8590c'; c.lineWidth = 3; const mx = (x0 + x1) / 2; c.beginPath(); c.moveTo(mx, 8); c.lineTo(mx, y0 + dpx - 14); c.stroke();
      c.fillStyle = '#e8590c'; c.beginPath(); c.moveTo(mx, y0 + dpx - 8); c.lineTo(mx - 6, y0 + dpx - 18); c.lineTo(mx + 6, y0 + dpx - 18); c.fill();
      c.fillStyle = '#334'; c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText(fmt(F / 1e3) + ' kN', mx + 36, 20);
      c.setLineDash([4, 4]); c.strokeStyle = '#999'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0 + Math.min(70, lim / lim * 18)); c.lineTo(x1, y0 + 18); c.stroke(); c.setLineDash([]);
      c.fillText(t('sag shown larger than real; dashed = limit'), W / 2, 112);
      // cross-section
      const sw = Math.min(90, b / 3.4), sh = Math.min(70, hh / 7);
      c.fillStyle = '#8fa1d6'; c.fillRect(W / 2 - sw / 2, 150 + (70 - sh) / 2 - 6, sw, sh);
      c.fillStyle = '#334'; c.fillText(t('cross-section ') + b + '×' + hh + ' mm', W / 2, 205);
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Size a beam that is strong and stiff enough, with as little material as possible.')),
      msg, cv.el, h('div', { class: 'lab-row' }, mats.el), bs.el, hs.el, pred,
      h('div', { class: 'lab-row' }, rd.el, rs.el, rm.el, button(t('✔ Test the beam'), check, 'btn ok sm'))));
    return () => { stop(); };
  },
};
