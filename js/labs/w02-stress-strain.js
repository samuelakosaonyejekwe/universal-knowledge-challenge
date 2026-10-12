import { h, slider, readout, button, choice, canvas, loop, predict, fmt } from '../core/labkit.js';

// E in GPa, yield strength in MPa, density kg/m³
const MATS = {
  steel: ['Steel', 200, 250, 7850], aluminium: ['Aluminium', 69, 240, 2700], copper: ['Copper', 117, 70, 8960],
  titanium: ['Titanium', 110, 880, 4500], nylon: ['Nylon', 2.5, 70, 1150],
};
const SF = 1.5;

// Tensile test: sigma = F/A, strain = sigma/E (elastic), dL = F·L/(A·E).
export default {
  id: 'w02-stress-strain',
  world: 2,
  levels: [5, 6],
  kind: 'lab',
  icon: '🔩',
  title: 'Materials Tester',
  goal: 'Pick a material and a rod diameter that carries the load safely without stretching too far, and keep it light.',
  limits: 'A straight round rod pulled in tension. Linear elastic up to yield, then a simplified flat plastic region and fracture at 1.4 times the yield strength; real curves are rounded and depend on temperature, heat treatment and rate of loading.',
  mount(root, api) {
    const t = api.t;
    const F = (5 + Math.floor(api.rng() * 8) * 5) * 1e3; // N
    const L = 0.5 + Math.floor(api.rng() * 4) * 0.25; // m
    const dmax = (0.4 + Math.floor(api.rng() * 6) * 0.2) * 1e-3; // m allowed stretch
    let mat = 'steel', d = 10, done = false, ramp = 0, predictedOk = false, testing = false;

    const area = () => Math.PI * (d * 1e-3) ** 2 / 4;
    const model = (m = mat, a = area()) => { const [, E, sy, rho] = MATS[m]; const s = F / a / 1e6; return { s, sy, su: 1.4 * sy, dl: F * L / (a * E * 1e9), mass: rho * a * L, E }; };
    const best = () => { // lightest design over all materials (continuous diameter)
      let bm = Infinity, bn = '';
      for (const [k, [n, E, sy, rho]] of Object.entries(MATS)) {
        const a = Math.max(F / (sy * 1e6 / SF), F * L / (dmax * E * 1e9));
        if (a * rho * L < bm) { bm = a * rho * L; bn = n; }
      }
      return { mass: bm, name: bn };
    };
    const opt = best();

    const cv = canvas(250, { light: true });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' },
      t('Mission: the rod hangs a load of ') + fmt(F / 1e3) + t(' kN, is ') + fmt(L) + t(' m long, may stretch at most ') + fmt(dmax * 1e3) + t(' mm, and must stay below yield strength ÷ ') + SF + '.');
    const mats = choice(Object.entries(MATS).map(([k, v]) => [k, t(v[0])]), 'steel', (m) => { mat = m; ramp = 0; update(); });
    const dsl = slider({ label: t('Rod diameter (mm)'), min: 2, max: 40, step: 0.5, value: 10, unit: 'mm', onInput: (v) => { d = v; ramp = 0; update(); } });
    const rs = readout(t('Stress σ (MPa)'), '–'), rd = readout(t('Stretch ΔL (mm)'), '–'), rm = readout(t('Rod mass (kg)'), '–');
    const pred = predict({ question: t('Stretch of this rod (mm)?'), unit: 'mm', truth: () => model().dl * 1e3, tolerance: 0.1, onResult: (e) => { predictedOk = predictedOk || e <= 0.1; } });

    function update() { const m = model(); rs.set(fmt(m.s)); rd.set(fmt(m.dl * 1e3)); rm.set(fmt(m.mass, 2)); }
    function run() { ramp = 0.0001; testing = true; }
    function verdict() {
      testing = false;
      const m = model(), ok1 = m.s <= m.sy / SF, ok2 = m.dl <= dmax;
      if (m.s > m.su) { msg.className = 'note bad'; msg.textContent = t('The rod snapped! The stress was above the strength. Use a thicker rod or a stronger material.'); api.say(t('Stress is force per area: a thicker rod spreads the same force over a bigger area.')); return; }
      if (!ok1) { msg.className = 'note warn'; msg.textContent = t('Too risky: stress ') + fmt(m.s) + t(' MPa is above the allowed ') + fmt(m.sy / SF) + t(' MPa.'); return; }
      if (!ok2) { msg.className = 'note warn'; msg.textContent = t('Strong enough, but it stretches ') + fmt(m.dl * 1e3) + t(' mm (limit ') + fmt(dmax * 1e3) + t(' mm). Try a stiffer material or a thicker rod.'); api.say(t('How much it stretches depends on stiffness E: ΔL = F·L / (A·E).')); return; }
      const sc = Math.min(1, opt.mass / m.mass);
      msg.className = 'note ok'; msg.textContent = t('Safe design! Mass ') + fmt(m.mass, 2) + t(' kg; the lightest possible is about ') + fmt(opt.mass, 2) + t(' kg (') + t(opt.name) + t('). Lighter is better.');
      if (!done) { done = true; api.say(t('Stress σ = F/A decides if it breaks; strain ε = σ/E decides how far it stretches.')); api.complete(Math.max(0.5, sc * 0.85 + (predictedOk ? 0.15 : 0)), t('Strength (σ = F/A against yield) and stiffness (ΔL = FL/AE) are separate limits on a design.')); }
    }

    update();
    const stop = loop((dt) => {
      if (testing) { ramp = Math.min(1, ramp + dt * 0.7); if (ramp >= 1) verdict(); }
      const c = cv.ctx, W = cv.w, H = 250, m = model(), ml = 40, mb = 30, pw = W - ml - 10, ph = H - mb - 14;
      const smax = Math.max(m.su * 1.15, m.s * 1.1), emax = Math.max(m.su / m.E / 1e3 * 1.5, 1e-9);
      c.fillStyle = '#f7f9ff'; c.fillRect(0, 0, W, H);
      const X = (e) => ml + (e / emax) * pw, Y = (s) => 14 + ph - (s / smax) * ph;
      c.strokeStyle = '#8a93b8'; c.lineWidth = 1; c.beginPath(); c.moveTo(ml, 14); c.lineTo(ml, 14 + ph); c.lineTo(ml + pw, 14 + ph); c.stroke();
      const ey = m.sy / m.E / 1e3, eu = ey * 1.0 + 0.12 * emax * 0.5, ef = eu + 0.1 * emax;
      c.strokeStyle = '#3b6ff5'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(ey), Y(m.sy)); c.lineTo(X(Math.min(eu, emax)), Y(m.su)); c.lineTo(X(Math.min(ef, emax)), Y(m.su * 0.85)); c.stroke();
      c.fillStyle = '#555'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillText(t('strain ε →'), ml + pw / 2, H - 4);
      c.save(); c.translate(11, 14 + ph / 2); c.rotate(-Math.PI / 2); c.fillText(t('stress σ (MPa) →'), 0, 0); c.restore();
      c.strokeStyle = '#e8a'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(ml, Y(m.sy / SF)); c.lineTo(ml + pw, Y(m.sy / SF)); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#c33'; c.textAlign = 'left'; c.fillText(t('allowed'), ml + 4, Y(m.sy / SF) - 3);
      const ss = (testing || ramp >= 1 ? ramp : 1) * m.s;
      const ee = ss <= m.sy ? ss / m.E / 1e3 : ey + (ss - m.sy) / (m.su - m.sy) * (eu - ey);
      c.fillStyle = '#ff7a1a'; c.beginPath(); c.arc(X(Math.min(ee, emax)), Y(Math.min(ss, smax)), 6, 0, 7); c.fill();
      // little rod
      const stretch = 1 + Math.min(0.3, ee * 5);
      c.fillStyle = '#9aa3c7'; c.fillRect(W - 40, 20, 16, 30 * stretch * 2);
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Pick a material and a rod diameter that carries the load safely without stretching too far, and keep it light.')), msg, cv.el,
      h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, t('Material:')), mats.el),
      dsl.el, pred,
      h('div', { class: 'lab-row' }, rs.el, rd.el, rm.el, button(t('▶ Run the test'), run, 'btn ok sm'))));
    return () => { stop(); };
  },
};
