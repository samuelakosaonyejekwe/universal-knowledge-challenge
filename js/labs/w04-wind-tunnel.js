import { h, slider, readout, button, choice, canvas, loop, predict, fmt } from '../core/labkit.js';

const AIR = { sea: ['Sea level', 1.225], mid: ['5 km', 0.736], high: ['10 km', 0.414] };
const G = 9.81;
// Lift coefficient for a cambered wing: linear in angle of attack, then stall.
export const cl = (deg) => (deg <= 14 ? 0.2 + 0.1 * deg : Math.max(0.5, 1.6 - 0.18 * (deg - 14)));

// Wind tunnel: L = ½ρv²S·C_L, with stall.
export default {
  id: 'w04-wind-tunnel',
  world: 4,
  levels: [3, 4],
  kind: 'lab',
  icon: '🌬️',
  title: 'Wind Tunnel',
  goal: 'Make the wing lift exactly the weight of the aircraft, without stalling.',
  limits: 'A simple 2D-style wing: C_L rises about 0.1 per degree up to a 14 degree stall, then falls. Drag uses C_D = 0.02 + C_L²/(π·e·AR) with AR = 7 and e = 0.8. Real wings also change with Mach number, flaps, wing shape and turbulence.',
  mount(root, api) {
    const t = api.t;
    const altKeys = Object.keys(AIR);
    const alt = altKeys[Math.floor(api.rng() * 3)];
    const rho = AIR[alt][1];
    const mass = 400 + Math.floor(api.rng() * 12) * 100; // kg
    const W = mass * G;
    let v = 30, a = 4, S = 12, done = false, predictedOk = false, ph = 0;

    const CD = (c) => 0.02 + c * c / (Math.PI * 0.8 * 7);
    const lift = (vv = v) => 0.5 * rho * vv * vv * S * cl(a);
    const cv = canvas(230);
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Mission: at ') + t(AIR[alt][0]) + ' (ρ = ' + rho + t(' kg/m³) lift a ') + mass + t(' kg aircraft: weight = ') + fmt(W / 1e3) + t(' kN. Get the lift within 5% of the weight, below the stall angle.'));
    const vs = slider({ label: t('Airspeed (m/s)'), min: 10, max: 90, step: 1, value: v, unit: 'm/s', onInput: (x) => { v = x; upd(); } });
    const as = slider({ label: t('Angle of attack (degrees)'), min: -4, max: 20, step: 0.5, value: a, unit: '°', onInput: (x) => { a = x; upd(); } });
    const ss = slider({ label: t('Wing area (m²)'), min: 5, max: 30, step: 0.5, value: S, unit: 'm²', onInput: (x) => { S = x; upd(); } });
    const rl = readout(t('Lift (kN)'), '–'), rc = readout('C_L', '–'), rd = readout(t('Drag (kN)'), '–'), rw = readout(t('Weight (kN)'), fmt(W / 1e3));
    const pred = predict({ question: t('Lift (kN) if the airspeed doubled?'), unit: 'kN', truth: () => lift(2 * v) / 1e3, tolerance: 0.05, onResult: (e) => { predictedOk = predictedOk || e <= 0.05; } });
    function upd() { rl.set(fmt(lift() / 1e3)); rc.set(fmt(cl(a), 2)); rd.set(fmt(0.5 * rho * v * v * S * CD(cl(a)) / 1e3)); }
    upd();

    function check() {
      const L = lift(), err = (L - W) / W;
      if (a > 14) { msg.className = 'note bad'; msg.textContent = t('Stalled! The air has separated from the top of the wing and lift collapses.'); api.say(t('Past about 14 degrees the smooth flow breaks away, so C_L falls. Lower the angle and fly faster instead.')); return; }
      if (Math.abs(err) <= 0.05) {
        msg.className = 'note ok'; msg.textContent = t('Lift equals weight: level flight! L = ') + fmt(L / 1e3) + t(' kN.');
        if (!done) { done = true; api.say(t('Lift grows with the square of speed, so doubling speed gives four times the lift. Thin air needs more speed or more wing.')); api.complete(predictedOk ? 1 : 0.85, t('L = ½ρv²S·C_L: lift rises with speed squared, wing area and angle of attack until the wing stalls.')); }
      } else {
        msg.className = 'note warn'; msg.textContent = (err < 0 ? t('Not enough lift (') : t('Too much lift (')) + fmt(L / 1e3) + t(' kN vs ') + fmt(W / 1e3) + t(' kN). ') + (err < 0 ? t('Go faster, tilt the wing up or add wing area.') : t('Slow down, lower the angle or reduce wing area.'));
      }
    }

    const stop = loop((dt) => {
      const c = cv.ctx, Wd = cv.w, cx = Wd * 0.5, cy = 105;
      ph = (ph + dt * v * 4 * (api.reducedMotion ? 0 : 1)) % 40;
      c.fillStyle = '#0d1b3a'; c.fillRect(0, 0, Wd, 230);
      const ar = -a * Math.PI / 180, stalled = a > 14;
      c.strokeStyle = 'rgba(160,210,255,.55)'; c.lineWidth = 1.5;
      for (let i = -4; i <= 4; i++) {
        const y0 = cy + i * 16; c.setLineDash([12, 8]); c.lineDashOffset = -ph; c.beginPath();
        for (let x = 0; x <= Wd; x += 6) {
          const dx = x - cx, bump = Math.exp(-(dx * dx) / 3600) * (i < 0 ? -1 : 1) * 14 / (1 + Math.abs(i) * 0.6) + (stalled && dx > 20 && i <= 0 ? Math.sin((x + ph * 2) / 7) * 8 * (i === 0 ? 1.4 : 0.6) : 0);
          const yy = y0 + bump - (dx > 0 ? -Math.sin(ar) * dx * 0.12 * (1 / (1 + Math.abs(i))) : 0);
          x ? c.lineTo(x, yy) : c.moveTo(x, yy);
        }
        c.stroke();
      }
      c.setLineDash([]);
      c.save(); c.translate(cx, cy); c.rotate(ar);
      c.fillStyle = stalled ? '#ff7a8a' : '#e6ecff'; c.beginPath(); c.ellipse(0, 0, 70, 7, 0, 0, 7); c.fill(); c.restore();
      const Lh = Math.min(95, lift() / W * 55), Wh = 55;
      const arrow = (x, y, dy, col, label) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + dy); c.stroke(); c.beginPath(); c.moveTo(x, y + dy + (dy < 0 ? -8 : 8)); c.lineTo(x - 6, y + dy); c.lineTo(x + 6, y + dy); c.fill(); c.font = '12px sans-serif'; c.textAlign = 'left'; c.fillText(label, x + 10, y + dy / 2); };
      arrow(cx, cy - 10, -Lh, '#2bc48a', t('Lift'));
      arrow(cx - 40, cy + 10, Wh, '#ffd24a', t('Weight'));
      c.fillStyle = '#fff'; c.font = '12px sans-serif'; c.textAlign = 'right'; c.fillText(stalled ? t('STALL') : '', Wd - 8, 18);
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Make the wing lift exactly the weight of the aircraft, without stalling.')),
      msg, cv.el, pred, vs.el, as.el, ss.el,
      h('div', { class: 'lab-row' }, rl.el, rw.el, rc.el, rd.el, button(t('✔ Check flight'), check, 'btn ok sm'))));
    return () => { stop(); };
  },
};
