import { h, slider, readout, canvas, fmt, predict, choice } from '../core/labkit.js';

// Conceptual methane-hydrate boundary: P_h[MPa] = 2.6·exp(0.1016·T[°C]) (fits ~2.6 MPa at 0 °C, ~12 MPa at 15 °C).
const Ph = T => 2.6 * Math.exp(0.1016 * T);
const Th = P => Math.log(P / 2.6) / 0.1016;

export default {
  id: 'w05-hydrate-flow',
  world: 5,
  levels: [5, 6],
  kind: 'lab',
  icon: '🛢️',
  title: 'Flow Assurance: Hydrate Watch',
  goal: 'Keep the pipeline fluid warmer than the hydrate line all the way to the platform, with a safety margin.',
  limits: 'A conceptual curve for methane hydrate (not a design tool). Pressure is held constant along the line, heat loss uses an overall U, specific heat is constant, and inhibitor shifts the curve by a rough 1.2 °C per wt% MEG.',
  mount(root, api) {
    const t = api.t;
    const L = 20000, D = 0.25, cp = 2000, Tsea = 4, Tin = 60, margin = 3;
    const P = Math.round(8 + api.rng() * 12);     // MPa operating pressure
    let m = 15, U = 20, meg = 0, done = false;
    const c = canvas(260, { light: true });
    const Tat = x => Tsea + (Tin - Tsea) * Math.exp(-U * Math.PI * D * x / (m * cp));
    const Tout = () => Tat(L);
    const need = () => Th(P) - 1.2 * meg + margin;
    const ins = choice([[25, t('Bare steel (U 25)')], [8, t('Foam coat (U 8)')], [3, t('Pipe-in-pipe (U 3)')]], 25, v => { U = v; update(); });
    U = 25;
    const sm = slider({ label: t('Flow rate'), min: 5, max: 60, step: 1, value: m, unit: 'kg/s', onInput: v => { m = v; update(); } });
    const sg = slider({ label: t('MEG inhibitor'), min: 0, max: 30, step: 1, value: 0, unit: 'wt%', onInput: v => { meg = v; update(); } });
    const rOut = readout(t('Arrival T (°C)')), rNeed = readout(t('Needed T (°C)')), rNtu = readout('NTU = UπDL/(ṁcp)');
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const pred = predict({ question: t('Predict arrival T with the first settings shown (m = 15 kg/s, bare steel)'), unit: '°C', tolerance: 0.15,
      truth: () => Tsea + (Tin - Tsea) * Math.exp(-25 * Math.PI * D * L / (15 * cp)) });

    function draw() {
      const { ctx, w } = c, H = 260, pad = 36;
      ctx.clearRect(0, 0, w, H);
      const X = T => pad + (T / 70) * (w - pad - 8), Y = p => H - 24 - (p / 30) * (H - 40);
      ctx.strokeStyle = '#ccd'; ctx.fillStyle = '#556'; ctx.font = '11px sans-serif';
      for (let T = 0; T <= 70; T += 10) { ctx.beginPath(); ctx.moveTo(X(T), 8); ctx.lineTo(X(T), H - 24); ctx.stroke(); ctx.fillText(T, X(T) - 6, H - 8); }
      for (let p = 0; p <= 30; p += 10) { ctx.beginPath(); ctx.moveTo(pad, Y(p)); ctx.lineTo(w - 8, Y(p)); ctx.stroke(); ctx.fillText(p, 8, Y(p) + 4); }
      ctx.fillText('T (°C)', w - 44, H - 8); ctx.fillText('P (MPa)', 4, 12);
      // hydrate region (left/above the curve)
      ctx.beginPath(); ctx.moveTo(X(0), Y(30));
      for (let T = 0; T <= 70; T += 1) { const p = Math.min(30, Ph(T - 1.2 * meg)); ctx.lineTo(X(T), Y(p)); }
      ctx.lineTo(X(70), Y(30)); ctx.closePath(); ctx.fillStyle = '#7ec8ff77'; ctx.fill();
      ctx.beginPath();
      for (let T = 0; T <= 70; T += 1) { const p = Math.min(30, Ph(T - 1.2 * meg)); T ? ctx.lineTo(X(T), Y(p)) : ctx.moveTo(X(T), Y(p)); }
      ctx.strokeStyle = '#1f78c8'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#1f78c8'; ctx.fillText(t('hydrates form here'), pad + 8, Y(28));
      // operating path (horizontal at P from T_out to T_in)
      ctx.strokeStyle = Tout() >= need() ? '#17a673' : '#d9485f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(X(Tout()), Y(P)); ctx.lineTo(X(Tin), Y(P)); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(X(Tout()), Y(P), 5, 0, 7); ctx.fill();
      ctx.fillText(t('platform'), X(Tout()) - 12, Y(P) - 9); ctx.fillText(t('wellhead'), X(Tin) - 40, Y(P) - 9);
    }
    function update() {
      const To = Tout(), nd = need();
      rOut.set(fmt(To, 3)); rNeed.set(fmt(nd, 3)); rNtu.set(fmt(U * Math.PI * D * L / (m * cp), 3));
      if (To >= nd) {
        msg.className = 'note ok'; msg.textContent = t('Safe: the fluid stays above the hydrate line plus margin.');
        if (!done) { done = true; api.say(t('Hot fluid loses heat to cold seawater. More flow, better insulation or inhibitor keeps it out of the ice-like hydrate region.')); api.complete(Math.max(0.6, 1 - meg / 60), t('Kept a subsea line outside the hydrate region.')); }
      } else { msg.className = 'note warn'; msg.textContent = t('Danger: the arrival temperature is inside the hydrate region (margin ') + margin + '°C).'; }
      draw();
    }
    c.onResize = draw;
    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Line pressure') + ` ${P} MPa, ${L / 1000} km, ` + t('seabed') + ` ${Tsea} °C.`),
      c.el, ins.el, sm.el, sg.el, h('div', { class: 'lab-row' }, rOut.el, rNeed.el, rNtu.el), msg, pred));
    update();
    return () => {};
  },
};
