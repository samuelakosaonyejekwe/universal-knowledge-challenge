import { h, slider, readout, button, canvas, loop, predict, fmt } from '../core/labkit.js';

const GM = 3.986e14, RE = 6.371e6; // Earth

// Newtonian two-body orbit: find the circular-orbit speed v = sqrt(GM/r).
export default {
  id: 'w01-orbit',
  world: 1,
  levels: [5, 6],
  kind: 'lab',
  icon: '🪐',
  title: 'Orbit Lab',
  goal: 'Launch the satellite sideways at exactly the speed for a circular orbit.',
  limits: 'Two bodies, Newtonian gravity, a spherical Earth and no air drag, simulated with a leapfrog integrator. Real orbits are also nudged by the Moon, the Sun and Earth\'s bulge.',
  mount(root, api) {
    const t = api.t;
    const r0 = (RE + (400e3 + Math.floor(api.rng() * 12) * 500e3 + (api.rng() < 0.3 ? 20e6 : 0))); // 6.8e6 .. ~12e6 or higher
    const vc = Math.sqrt(GM / r0);
    const period = 2 * Math.PI * Math.sqrt(r0 ** 3 / GM);
    const timeScale = period / 9;
    let vkm = Math.round(vc * 0.7 / 10) / 100; // start 30% too slow
    let s = null, trail = [], swept = 0, rmin = 0, rmax = 0, done = false, predicted = false, launches = 0;

    const cv = canvas(300);
    const vsl = slider({ label: t('Launch speed (km/s)'), min: 1, max: 14, step: 0.01, value: vkm, unit: 'km/s', onInput: (v) => { vkm = v; } });
    const rr = readout(t('Distance from centre (km)'), '–'), sp = readout(t('Speed (km/s)'), '–');
    const msg = h('div', { class: 'note', 'aria-live': 'polite' },
      t('Mission: circular orbit at r = ') + fmt(r0 / 1e3, 4) + t(' km from Earth\'s centre (altitude ') + fmt((r0 - RE) / 1e3, 3) + t(' km). Predict the speed first, using GM = 3.986×10¹⁴ m³/s².'));
    const pred = predict({ question: t('Circular speed (km/s)?'), unit: 'km/s', truth: () => vc / 1e3, tolerance: 0.03, onResult: (e) => { predicted = predicted || e <= 0.03; } });

    function launch() {
      s = { x: r0, y: 0, vx: 0, vy: vkm * 1e3 }; trail = []; swept = 0; rmin = r0; rmax = r0; launches++;
      msg.className = 'note'; msg.textContent = t('Launched at ') + fmt(vkm, 3) + t(' km/s. Watch the path…');
    }
    const acc = (x, y) => { const r = Math.hypot(x, y), k = -GM / (r * r * r); return [k * x, k * y]; };
    function finish(text, ok, e) {
      const sc = ok ? (predicted ? 1 : 0.85) : 0;
      s = null; msg.className = 'note ' + (ok ? 'ok' : 'warn'); msg.textContent = text;
      if (ok && !done) { done = true; api.say(t('Gravity supplies exactly the centripetal force: GM/r² = v²/r, so v = √(GM/r). Faster than this and the orbit stretches out; slower and it falls closer.')); api.complete(sc, t('A circular orbit needs v = √(GM/r); the satellite is always falling but keeps missing the Earth.')); }
      else if (!ok && e != null) api.say(t(e));
    }
    const step = (dt) => {
      const n = Math.max(1, Math.ceil(dt / (period / 2500))), d = dt / n;
      for (let i = 0; i < n && s; i++) {
        let [ax, ay] = acc(s.x, s.y);
        s.vx += ax * d / 2; s.vy += ay * d / 2;
        const a0 = Math.atan2(s.y, s.x);
        s.x += s.vx * d; s.y += s.vy * d;
        [ax, ay] = acc(s.x, s.y);
        s.vx += ax * d / 2; s.vy += ay * d / 2;
        let da = Math.atan2(s.y, s.x) - a0; if (da < -Math.PI) da += 2 * Math.PI; if (da > Math.PI) da -= 2 * Math.PI;
        swept += Math.abs(da);
        const r = Math.hypot(s.x, s.y); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r);
        if (r < RE) { finish(t('The satellite hit the Earth! It needed more sideways speed.'), false, 'Too slow sideways: gravity pulled it down before it could miss the planet.'); return; }
        if (r > 8 * r0) { finish(t('It escaped into space! Too fast.'), false, 'Above the escape speed √2·v_circ it never comes back.'); return; }
        if (swept >= 2 * Math.PI) {
          const e = (rmax - rmin) / (rmax + rmin);
          if (e < 0.03) finish(t('Circular! Eccentricity ') + fmt(e, 2) + t(' (r varies from ') + fmt(rmin / 1e3, 4) + t(' to ') + fmt(rmax / 1e3, 4) + t(' km).'), true);
          else finish(t('That orbit is an ellipse (eccentricity ') + fmt(e, 2) + t('). ') + (vkm * 1e3 > vc ? t('Too fast: slow down a little.') : t('Too slow: speed up a little.')), false, vkm * 1e3 > vc ? 'Too fast: it climbs away from the Earth and swings back.' : 'Too slow: it falls inward and swings around closer.');
          return;
        }
      }
    };

    const stop = loop((dt) => {
      if (s) { step(dt * timeScale); if (s) { trail.push([s.x, s.y]); if (trail.length > 900) trail.shift(); rr.set(fmt(Math.hypot(s.x, s.y) / 1e3, 4)); sp.set(fmt(Math.hypot(s.vx, s.vy) / 1e3, 3)); } }
      const c = cv.ctx, W = cv.w, H = 300, sc = (Math.min(W, H) / 2 - 12) / (r0 * 1.9);
      c.fillStyle = '#0a0f2a'; c.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.setLineDash([4, 5]); c.beginPath(); c.arc(cx, cy, r0 * sc, 0, 7); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#2f7de1'; c.beginPath(); c.arc(cx, cy, RE * sc, 0, 7); c.fill();
      c.strokeStyle = '#ffd24a'; c.lineWidth = 2; c.beginPath();
      trail.forEach(([x, y], i) => { const X = cx + x * sc, Y = cy - y * sc; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke();
      const p = s ? [s.x, s.y] : [r0, 0];
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + p[0] * sc, cy - p[1] * sc, 5, 0, 7); c.fill();
      if (!s) { c.strokeStyle = '#7fff9e'; c.lineWidth = 2; const L = Math.min(70, vkm * 5); c.beginPath(); c.moveTo(cx + r0 * sc, cy); c.lineTo(cx + r0 * sc, cy - L); c.stroke(); }
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Launch the satellite sideways at exactly the speed for a circular orbit.')),
      msg, cv.el, pred, vsl.el,
      h('div', { class: 'lab-row' },
        button('−0.05', () => { vkm = Math.max(1, +(vkm - 0.05).toFixed(2)); vsl.set(vkm); }, 'btn ghost sm'),
        button('+0.05', () => { vkm = Math.min(14, +(vkm + 0.05).toFixed(2)); vsl.set(vkm); }, 'btn ghost sm'),
        button(t('🚀 Launch'), launch, 'btn ok sm'), rr.el, sp.el)));
    return () => { stop(); };
  },
};
