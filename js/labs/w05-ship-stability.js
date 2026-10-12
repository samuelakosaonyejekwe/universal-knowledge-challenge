import { h, slider, readout, canvas, fmt, predict, button } from '../core/labkit.js';

export default {
  id: 'w05-ship-stability',
  world: 5,
  levels: [3, 4],
  kind: 'lab',
  icon: '🚢',
  title: 'Ship Stability',
  goal: 'Stack the cargo so the ship stays upright when the wind pushes: keep the heel small and GM positive.',
  limits: 'A rectangular barge hull in calm water, small-angle theory (GZ = GM·sin φ). Real ships use full hull shapes, free surface effects and large-angle stability curves.',
  mount(root, api) {
    const t = api.t;
    const B = 12, L = 40, T = 3;            // m: beam, length, draft
    const KB = T / 2, BM = B * B / (12 * T); // box hull: BM = I/V = B^2/(12 T)
    const mass = 1025 * B * L * T;           // kg displaced
    const wind = Math.round(6 + api.rng() * 10) / 10 * 1e6; // N·m heeling moment (0.6..1.6 MN·m)
    const target = 2 + Math.floor(api.rng() * 3);        // max heel (degrees) allowed
    let KG = 4, done = false;
    const c = canvas(240);
    const kg = slider({ label: t('Centre of gravity height KG'), min: 2, max: 14, step: 0.1, value: KG, unit: 'm', onInput: v => { KG = v; update(); } });
    const gmR = readout('GM (m)'), heelR = readout(t('Heel (°)')), gzR = readout(t('Righting arm GZ at heel (m)'));
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const goalLine = h('div', { class: 'lab-goal' }, t('Wind heeling moment') + ` ${fmt(wind / 1e6, 3)} MN·m. ` + t('Keep heel at or below') + ` ${target}°.`);
    const pred = predict({ question: t('Predict: heel in degrees at KG = 4 m'), unit: '°', tolerance: 0.25,
      truth: () => { const gm = KB + BM - 4; return gm > 0 ? Math.asin(Math.min(1, wind / (mass * 9.81 * gm))) * 180 / Math.PI : 90; } });
    let heelDeg = 0;

    function model() {
      const GM = KB + BM - KG;
      let heel = 90;
      if (GM > 0) heel = Math.asin(Math.min(1, wind / (mass * 9.81 * GM))) * 180 / Math.PI;
      return { GM, heel };
    }
    function draw() {
      const { ctx, w } = c, H = 240;
      ctx.clearRect(0, 0, w, H);
      ctx.fillStyle = '#9fd8ff'; ctx.fillRect(0, 0, w, H);
      const cx = w / 2, wl = 130, s = Math.min(14, (w - 40) / (B + 6));
      ctx.save(); ctx.translate(cx, wl); ctx.rotate(heelDeg * Math.PI / 180);
      const hullH = 6 * s, bw = B * s, d = T * s;
      ctx.fillStyle = '#c0392b'; ctx.fillRect(-bw / 2, -(hullH - d), bw, hullH);
      ctx.fillStyle = '#ecf0f1'; ctx.fillRect(-bw / 4, -(hullH - d) - 1.2 * s, bw / 2, 1.2 * s);
      ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(0, d - KG * s, 6, 0, 7); ctx.fill(); // G
      ctx.fillStyle = '#000'; ctx.font = '11px sans-serif'; ctx.fillText('G', 8, d - KG * s + 4);
      ctx.restore();
      ctx.fillStyle = '#1f78c8aa'; ctx.fillRect(0, wl, w, H - wl);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, wl, w, 2);
      ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.fillText('💨 →', 8, 24);
    }
    function update() {
      const { GM, heel } = model();
      heelDeg = GM > 0 ? heel : 25;
      gmR.set(fmt(GM, 3)); heelR.set(GM > 0 ? fmt(heel, 3) : t('capsize!'));
      gzR.set(GM > 0 ? fmt(GM * Math.sin(heel * Math.PI / 180), 3) : '–');
      if (GM <= 0) { msg.className = 'note bad'; msg.textContent = t('GM is negative: when it leans, the ship leans further. Lower the cargo!'); }
      else if (heel <= target) {
        msg.className = 'note ok'; msg.textContent = t('Stable and steady. Low weight gives a big GM.');
        if (!done) { done = true; api.say(t('GM = KB + BM − KG. Lowering the centre of gravity raises GM, so the ship resists heeling.')); api.complete(Math.min(1, 0.6 + (target - heel) / target * 0.4 + (GM < 1 ? 0 : 0)), t('Kept a ship stable by lowering its centre of gravity.')); }
      } else { msg.className = 'note warn'; msg.textContent = t('Too much heel. Move the weight lower to raise GM.'); }
      draw();
    }
    c.onResize = draw;
    root.append(h('div', { class: 'lab' }, goalLine, c.el, kg.el,
      h('div', { class: 'lab-row' }, gmR.el, heelR.el, gzR.el), msg, pred,
      h('p', { class: 'small muted' }, `KB = ${fmt(KB)} m, BM = B²/(12T) = ${fmt(BM, 3)} m, ` + t('displacement') + ` ${fmt(mass / 1000, 3)} t`)));
    update();
    return () => {};
  },
};
