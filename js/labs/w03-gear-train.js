import { h, slider, readout, button, canvas, loop, predict, fmt } from '../core/labkit.js';

// Compound gear train: ratio = (z2/z1)·(z4/z3); gears 2 and 3 share a shaft.
export default {
  id: 'w03-gear-train',
  world: 3,
  levels: [3, 4],
  kind: 'lab',
  icon: '⚙️',
  title: 'Gear Train Builder',
  goal: 'Choose the gear teeth so the output shaft turns at the target speed.',
  limits: 'Ideal spur gears of the same module, 97% efficient at each mesh, no backlash and no shaft friction. Real gear trains also need strength checks and lubrication.',
  mount(root, api) {
    const t = api.t;
    const rnd = (a, b) => a + Math.floor(api.rng() * (b - a + 1));
    const inRpm = [60, 90, 120][rnd(0, 2)];
    const tz = [rnd(10, 20), rnd(24, 50), rnd(10, 20), rnd(24, 50)];
    const targetRpm = Math.round(inRpm * (tz[0] / tz[1]) * (tz[2] / tz[3]));
    let z = [20, 20, 20, 20], th = [0, 0, 0, 0], done = false, predictedOk = false;
    const eta = 0.97;
    const out = () => inRpm * (z[0] / z[1]) * (z[2] / z[3]);
    const cv = canvas(230);
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Mission: the input shaft turns at ') + inRpm + t(' rpm. Make the output turn at ') + targetRpm + t(' rpm (within 4%). Gears 2 and 3 are on the same shaft.'));
    const sl = z.map((v, i) => slider({ label: t('Gear ') + (i + 1) + t(' teeth'), min: 8, max: 50, step: 1, value: v, unit: '', onInput: (x) => { z[i] = x; upd(); } }));
    const ro = readout(t('Output (rpm)'), '–'), rr = readout(t('Speed ratio'), '–'), rt = readout(t('Torque ×'), '–');
    const pred = predict({ question: t('Output speed (rpm)?'), unit: 'rpm', truth: () => out(), tolerance: 0.05, onResult: (e) => { predictedOk = predictedOk || e <= 0.05; } });
    function upd() { ro.set(fmt(out(), 3)); rr.set(fmt(out() / inRpm, 3)); rt.set(fmt(eta * eta * inRpm / out(), 3)); }
    upd();

    function lock() {
      const o = out(), err = Math.abs(o - targetRpm) / targetRpm;
      if (err <= 0.04) {
        msg.className = 'note ok'; msg.textContent = t('Locked in! Output ') + fmt(o, 3) + t(' rpm.');
        if (!done) { done = true; api.say(t('A small gear driving a big gear slows things down but makes more torque. Two stages multiply the ratios.')); api.complete(predictedOk ? 1 : 0.85, t('Speed ratio = (teeth of driven ÷ teeth of driver) for each stage, multiplied; torque goes the other way.')); }
      } else { msg.className = 'note warn'; msg.textContent = t('Output is ') + fmt(o, 3) + t(' rpm. ') + (o > targetRpm ? t('Too fast: make a driven gear bigger.') : t('Too slow: make a driven gear smaller.')); }
    }

    const stop = loop((dt) => {
      const W = cv.w, c = cv.ctx, m = 1; // module, arbitrary units
      const r = z.map((n) => n * m / 2);
      const xs = [0, r[0] + r[1], r[0] + r[1], r[0] + r[1] + r[2] + r[3]];
      const lo = Math.min(...xs.map((x, i) => x - r[i])), hi = Math.max(...xs.map((x, i) => x + r[i]));
      const sc = Math.min((W - 20) / (hi - lo), 4), ox = (W - (hi - lo) * sc) / 2 - lo * sc;
      const rpm = [inRpm, -inRpm * z[0] / z[1], -inRpm * z[0] / z[1], inRpm * (z[0] / z[1]) * (z[2] / z[3])];
      for (let i = 0; i < 4; i++) th[i] += rpm[i] / 60 * 2 * Math.PI * dt * (api.reducedMotion ? 0 : 0.25);
      c.fillStyle = '#10183d'; c.fillRect(0, 0, W, 230);
      const cols = ['#ffb347', '#5a86ff', '#7bd88f', '#ff6f91'];
      const drawGear = (i, off, alpha) => {
        const R = r[i] * sc, cx = ox + xs[i] * sc, cy = 120 + off, n = z[i];
        c.globalAlpha = alpha; c.fillStyle = cols[i]; c.beginPath();
        for (let k = 0; k < n * 2; k++) { const a = th[i] + (k / (n * 2)) * 2 * Math.PI, rad = R + (k % 2 ? -3 : 3); c.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a)); }
        c.closePath(); c.fill();
        c.fillStyle = '#10183d'; c.beginPath(); c.arc(cx, cy, Math.max(3, R * 0.2), 0, 7); c.fill();
        c.fillStyle = '#fff'; c.globalAlpha = 1; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText(String(i + 1) + ' · ' + n + 'T', cx, cy + 4);
      };
      drawGear(1, 0, 0.85); drawGear(2, 0, 0.9); drawGear(0, 0, 1); drawGear(3, 0, 1);
      c.fillStyle = '#9fb0ff'; c.font = '11px sans-serif'; c.textAlign = 'left'; c.fillText('in: ' + inRpm + ' rpm', 6, 14); c.textAlign = 'right'; c.fillText('out: ' + fmt(out(), 3) + ' rpm', W - 6, 14);
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Choose the gear teeth so the output shaft turns at the target speed.')),
      msg, cv.el, pred, ...sl.map((s) => s.el),
      h('div', { class: 'lab-row' }, ro.el, rr.el, rt.el, button(t('🔒 Lock it in'), lock, 'btn ok sm'))));
    return () => { stop(); };
  },
};
