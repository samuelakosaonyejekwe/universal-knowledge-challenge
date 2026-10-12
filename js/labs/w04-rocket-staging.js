import { h, slider, readout, button, choice, canvas, loop, fmt } from '../core/labkit.js';

const G0 = 9.80665, ISP1 = 300, ISP2 = 350, EPS = 0.07, PROP = 450e3; // kg of propellant available in total

// Delta-v of a (one or two stage) rocket; masses in kg, split = stage-1 share of propellant.
export function deltaV(payload, split, stages) {
  if (stages === 1) {
    const m0 = payload + (1 + EPS) * PROP, mf = payload + EPS * PROP;
    return [ISP1 * G0 * Math.log(m0 / mf)];
  }
  const p1 = PROP * split, p2 = PROP - p1;
  const m01 = payload + (1 + EPS) * PROP, mf1 = m01 - p1;
  const m02 = mf1 - EPS * p1, mf2 = m02 - p2;
  return [ISP1 * G0 * Math.log(m01 / mf1), ISP2 * G0 * Math.log(m02 / mf2)];
}

// Rocket staging: Tsiolkovsky, Δv = Isp·g0·ln(m0/mf), stage by stage.
export default {
  id: 'w04-rocket-staging',
  world: 4,
  levels: [5, 6],
  kind: 'lab',
  icon: '🚀',
  title: 'Rocket Staging',
  goal: 'Split the propellant between two stages to reach orbit speed with your payload.',
  limits: 'Ideal rocket equation with a fixed 450 tonnes of propellant, tanks that weigh 7% of the propellant, and the same engine efficiency (Isp 300 s then 350 s). Gravity and air-drag losses are lumped into the required Δv; real rockets also have thrust limits and varying Isp.',
  mount(root, api) {
    const t = api.t;
    const payload = (6 + Math.floor(api.rng() * 8)) * 1e3; // 6..13 t
    let best = 0;
    for (let s = 0.05; s < 0.96; s += 0.01) best = Math.max(best, deltaV(payload, s, 2).reduce((a, b) => a + b, 0));
    const need = Math.min(9400, Math.floor(best * 0.97 / 50) * 50 || 9400);
    let stages = 2, split = 0.6, done = false, guess = null, usedGuess = false;

    const cv = canvas(230, { light: true });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Mission: lift a ') + fmt(payload / 1e3) + t(' t payload to a speed gain of at least ') + fmt(need / 1e3, 3) + t(' km/s (7.8 km/s orbit plus losses). You have 450 t of propellant. First, guess: do two stages beat one?'));
    const guessC = choice([['yes', t('Two stages are better')], ['no', t('One stage is as good')]], null, (g) => { guess = g; });
    const stagesC = choice([[1, t('1 stage')], [2, t('2 stages')]], 2, (v) => { stages = v; upd(); });
    const ssl = slider({ label: t('Propellant in stage 1 (%)'), min: 5, max: 95, step: 1, value: 60, unit: '%', onInput: (v) => { split = v / 100; upd(); } });
    const r1 = readout(t('Stage 1 Δv (km/s)'), '–'), r2 = readout(t('Stage 2 Δv (km/s)'), '–'), rt = readout(t('Total Δv (km/s)'), '–');
    const total = () => deltaV(payload, split, stages).reduce((a, b) => a + b, 0);
    function upd() { const d = deltaV(payload, split, stages); r1.set(fmt(d[0] / 1e3)); r2.set(d[1] != null ? fmt(d[1] / 1e3) : '–'); rt.set(fmt(total() / 1e3)); }
    upd();

    function launch() {
      const d = total();
      if (!usedGuess && guess) {
        usedGuess = true;
        const one = deltaV(payload, 0, 1)[0], two = Math.max(...Array.from({ length: 91 }, (_, i) => deltaV(payload, 0.05 + i * 0.01, 2).reduce((a, b) => a + b, 0)));
        api.say(t('One stage gives ') + fmt(one / 1e3) + t(' km/s at best; a good two-stage split gives ') + fmt(two / 1e3) + t(' km/s. Dropping empty tanks makes the rest lighter.'));
      }
      if (d >= need) {
        msg.className = 'note ok'; msg.textContent = t('Orbit reached! Total Δv ') + fmt(d / 1e3, 3) + t(' km/s ≥ ') + fmt(need / 1e3, 3) + t(' km/s.');
        if (!done) { done = true; api.say(t('Δv = Isp·g0·ln(m0/mf). Each stage starts lighter because the empty stage below is dropped, so staging adds up to more speed.')); api.complete(guess === 'yes' ? 1 : 0.85, t('The rocket equation is logarithmic in the mass ratio, so dropping dead weight (staging) gains speed.')); }
      } else {
        msg.className = 'note warn'; msg.textContent = t('Only ') + fmt(d / 1e3, 3) + t(' km/s: short by ') + fmt((need - d) / 1e3, 3) + t(' km/s. ') + (stages === 1 ? t('Try two stages.') : t('Move the split: find the best balance.'));
      }
    }

    const stop = loop(() => {
      const c = cv.ctx, W = cv.w, H = 230, d = deltaV(payload, split, stages), tot = d.reduce((a, b) => a + b, 0);
      c.fillStyle = '#f7f9ff'; c.fillRect(0, 0, W, H);
      const x0 = 14, pw = W - 28, vmax = 12000, X = (v) => x0 + (v / vmax) * pw;
      c.font = '12px sans-serif'; c.textAlign = 'left';
      let acc = 0; const cols = ['#3b6ff5', '#ff8f3c'];
      d.forEach((dv, i) => { c.fillStyle = cols[i]; c.fillRect(X(acc), 40, X(acc + dv) - X(acc), 40); c.fillStyle = '#fff'; c.fillText(t('Stage ') + (i + 1) + ': ' + fmt(dv / 1e3) + ' km/s', X(acc) + 6, 64); acc += dv; });
      c.strokeStyle = '#17a673'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(need), 28); c.lineTo(X(need), 92); c.stroke();
      c.fillStyle = '#17a673'; c.fillText(t('goal ') + fmt(need / 1e3, 3), Math.min(X(need) + 4, W - 70), 24);
      c.fillStyle = '#556'; c.fillText(t('Total Δv: ') + fmt(tot / 1e3) + ' km/s', x0, 108);
      // curve of total Δv versus split
      const cy0 = 130, ch = 80;
      c.strokeStyle = '#8a93b8'; c.lineWidth = 1; c.strokeRect(x0, cy0, pw, ch);
      c.strokeStyle = '#3b6ff5'; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i <= 90; i++) { const s = 0.05 + i * 0.01, v = deltaV(payload, s, 2).reduce((a, b) => a + b, 0), px = x0 + (i / 90) * pw, py = cy0 + ch - ((v - 6000) / 5000) * ch; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
      c.strokeStyle = '#17a673'; c.setLineDash([4, 4]); const gy = cy0 + ch - ((need - 6000) / 5000) * ch; c.beginPath(); c.moveTo(x0, gy); c.lineTo(x0 + pw, gy); c.stroke(); c.setLineDash([]);
      if (stages === 2) { const px = x0 + ((split - 0.05) / 0.9) * pw, py = cy0 + ch - ((tot - 6000) / 5000) * ch; c.fillStyle = '#ff7a1a'; c.beginPath(); c.arc(px, py, 6, 0, 7); c.fill(); }
      c.fillStyle = '#556'; c.fillText(t('Δv against the stage-1 share (your choice is the orange dot)'), x0, cy0 + ch + 14);
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Split the propellant between two stages to reach orbit speed with your payload.')),
      msg, h('div', { class: 'lab-row' }, h('b', null, t('My guess:')), guessC.el), cv.el,
      h('div', { class: 'lab-row' }, stagesC.el), ssl.el,
      h('div', { class: 'lab-row' }, r1.el, r2.el, rt.el, button(t('🚀 Launch'), launch, 'btn ok sm'))));
    return () => { stop(); };
  },
};
