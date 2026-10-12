import { h, readout, choice, button, canvas, loop } from '../core/labkit.js';

const THROW = [3, 5.5, 9]; // m/s
const NOSE = [0, 1, 2];
const FLAP = [-1, 0, 1]; // down, flat, up
const K = 1.8, G = 9.81; // K = rho·S/(2m) in 1/m

// Point-mass glider: constant angle of attack set by trim (nose weight and flaps).
export function fly(th, nose, flap, dt = 0.005) {
  const alpha = 0.18 + 0.1 * FLAP[flap] - 0.05 * NOSE[nose];
  const stalled = alpha > 0.25;
  const CL = stalled ? 0.5 : 3.5 * alpha, CD = 0.05 + 0.1 * CL * CL + (stalled ? 0.3 : 0);
  let x = 0, y = 1.5, v = THROW[th], gam = 0.15, t = 0;
  const path = [[x, y, v, gam]];
  while (y > 0 && t < 12) {
    const a = K * v * v;
    v += (-G * Math.sin(gam) - a * CD) * dt;
    v = Math.max(v, 0.5);
    gam += ((a * CL - G * Math.cos(gam)) / v) * dt;
    x += v * Math.cos(gam) * dt; y += v * Math.sin(gam) * dt; t += dt;
    if (path.length < 4000) path.push([x, y, v, gam]);
  }
  return { x, path, CL, CD, alpha, stalled };
}

// Four-forces paper plane toy.
export default {
  id: 'w04-paper-plane',
  world: 4,
  levels: [1, 2],
  kind: 'lab',
  icon: '✈️',
  title: 'Paper Plane Pilot',
  goal: 'Set up and throw the paper plane so it lands in the target zone.',
  limits: 'The plane is a point that always keeps the same tilt to the air. Lift, drag, weight and the throw are modelled with simple formulas; real paper planes wobble, spin and are affected by wind.',
  mount(root, api) {
    const t = api.t;
    const r = () => Math.floor(api.rng() * 3);
    const tgtCfg = [r(), r(), r()];
    const tgtRes = fly(...tgtCfg);
    const centre = Math.max(4, Math.round(tgtRes.x * 2) / 2);
    const half = 1.5;
    let cfg = [1, 0, 1], pos = null, k = 0, guess = null, scored = false, firstFlight = true, done = false, flown = null;

    const cv = canvas(230);
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Mission: land in the green zone! Choose a guess, set up your plane, then throw.'));
    const throwC = choice([[0, t('Gentle')], [1, t('Medium')], [2, t('Hard')]], 1, (v) => { cfg[0] = v; });
    const noseC = choice([[0, t('No clay')], [1, t('🟤 Clay')], [2, t('🟤🟤 Lots')]], 0, (v) => { cfg[1] = v; });
    const flapC = choice([[0, t('Flaps down')], [1, t('Flat')], [2, t('Flaps up')]], 1, (v) => { cfg[2] = v; });
    const guessC = choice([['short', t('Lands short')], ['in', t('In the zone')], ['far', t('Goes far')]], null, (v) => { guess = v; });
    const dist = readout(t('Distance (m)'), '–');
    const px = (m, W) => 20 + (m / 22) * (W - 40);

    function go() {
      if (!guess) { msg.className = 'note warn'; msg.textContent = t('Make a guess first!'); return; }
      flown = fly(cfg[0], cfg[1], cfg[2]); pos = 0; k = 0; scored = false;
      msg.className = 'note'; msg.textContent = t('Whoosh…');
    }
    function land() {
      scored = true; const d = flown.x; dist.set(String(Math.round(d * 10) / 10));
      const res = d < centre - half ? 'short' : d > centre + half ? 'far' : 'in';
      const guessOK = res === guess;
      if (res === 'in') {
        msg.className = 'note ok'; msg.textContent = t('Landed in the zone! 🎯');
        if (!done) { done = true; api.say(t('Lift holds the plane up, weight pulls it down, drag slows it, and your throw gives it the push to start.')); api.complete(firstFlight ? 1 : 0.8, t('A paper plane flies when lift and drag balance weight and the throw: four forces.')); }
      } else {
        msg.className = 'note warn'; msg.textContent = res === 'short' ? t('Too short. Try a harder throw or flaps up.') : t('Too far. Try a gentler throw.');
        if (flown.stalled) api.say(t('The nose pointed too high, so the wing stalled and the plane flopped down. Add a little clay to the nose.'));
        else if (flown.alpha < 0.05) api.say(t('Too much clay on the nose: not enough lift, so it dives.'));
      }
      firstFlight = false;
      if (guessOK && res !== 'in') api.say(t('Your guess was right!'));
    }

    const stop = loop((dt) => {
      const c = cv.ctx, W = cv.w;
      if (flown && !scored) {
        k += Math.max(1, Math.round(dt / 0.005 * (api.reducedMotion ? 4 : 1)));
        if (k >= flown.path.length - 1) { k = flown.path.length - 1; land(); }
      }
      c.fillStyle = '#9ad8ff'; c.fillRect(0, 0, W, 230);
      c.fillStyle = '#6cc070'; c.fillRect(0, 190, W, 40);
      c.fillStyle = '#17a673'; c.fillRect(px(centre - half, W), 186, px(centre + half, W) - px(centre - half, W), 8);
      c.fillStyle = '#fff'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillText('🎯 ' + centre + ' m', px(centre, W), 210);
      const p = flown ? flown.path[Math.min(k, flown.path.length - 1)] : [0, 1.5, 0, 0.15];
      const sx = px(p[0], W), sy = 190 - p[1] * 24;
      if (flown) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); flown.path.slice(0, k + 1).forEach((q, i) => { i % 20 || (i ? c.lineTo(px(q[0], W), 190 - q[1] * 24) : c.moveTo(px(q[0], W), 190 - q[1] * 24)); }); c.stroke(); }
      c.save(); c.translate(sx, sy); c.rotate(-p[3]); c.font = '28px serif'; c.textAlign = 'center'; c.fillText('✈️', 0, 8); c.restore();
      if (flown && !scored) { // four forces
        const a = K * p[2] * p[2];
        const arrow = (dx, dy, col, label) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + dx, sy + dy); c.stroke(); c.font = '11px sans-serif'; c.fillText(label, sx + dx * 1.2, sy + dy * 1.2); };
        arrow(0, 22, '#444', t('weight'));
        arrow(-Math.sin(-p[3]) * Math.min(40, a * flown.CL * 1.2), -Math.cos(p[3]) * Math.min(40, a * flown.CL * 1.2), '#17a673', t('lift'));
        arrow(-Math.cos(p[3]) * Math.min(30, a * flown.CD * 4), Math.sin(p[3]) * Math.min(30, a * flown.CD * 4), '#d9485f', t('drag'));
      }
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Set up and throw the paper plane so it lands in the target zone.')),
      msg, cv.el,
      h('div', { class: 'lab-row' }, h('b', null, t('My guess:')), guessC.el),
      h('div', { class: 'lab-row' }, h('b', null, t('Throw:')), throwC.el),
      h('div', { class: 'lab-row' }, h('b', null, t('Nose:')), noseC.el),
      h('div', { class: 'lab-row' }, h('b', null, t('Wings:')), flapC.el),
      h('div', { class: 'lab-row' }, button(t('🛫 Throw!'), go, 'btn ok'), dist.el)));
    return () => { stop(); };
  },
};
