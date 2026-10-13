// Orbit Lab in 3D: a satellite circling a globe in a tilted plane, so it passes in front of and behind the planet.
// The task is the 2D lab's own: for a given distance, find the one sideways speed that makes the orbit a circle.
// No imports: everything arrives through the context, so the model can be checked without a browser.

const GM = 3.986e14, RE = 6.371e6;                        // Earth: m³/s² and m

// ----- the model: two bodies, Newtonian gravity, leapfrog (kick–drift–kick) steps -----
export const model = {
  GM, RE,
  circular: (r) => Math.sqrt(GM / r),
  period: (r) => 2 * Math.PI * Math.sqrt(r ** 3 / GM),
  start: (r, v) => ({ x: r, y: 0, vx: 0, vy: v, swept: 0, rmin: r, rmax: r, t: 0 }),
  step(s, d) {
    let r = Math.hypot(s.x, s.y), k = -GM / (r * r * r);
    s.vx += k * s.x * d / 2; s.vy += k * s.y * d / 2;
    const a0 = Math.atan2(s.y, s.x);
    s.x += s.vx * d; s.y += s.vy * d;
    r = Math.hypot(s.x, s.y); k = -GM / (r * r * r);
    s.vx += k * s.x * d / 2; s.vy += k * s.y * d / 2;
    let da = Math.atan2(s.y, s.x) - a0; if (da < -Math.PI) da += 2 * Math.PI; if (da > Math.PI) da -= 2 * Math.PI;
    s.swept += Math.abs(da); s.t += d; s.rmin = Math.min(s.rmin, r); s.rmax = Math.max(s.rmax, r);
    return r;
  },
  ecc: (s) => (s.rmax - s.rmin) / (s.rmax + s.rmin),
};

// Hand-worked values: at r = 6,771 km, v = √(3.986×10¹⁴ / 6.771×10⁶) = 7,673 m/s and one lap takes 5,545 s (92.4 min).
// Launched 10 % faster the orbit must be an ellipse with eccentricity 1.1² − 1 = 0.21.
export function selfTest() {
  const r = RE + 400e3, vc = model.circular(r), T = model.period(r);
  const lap = (v) => { const s = model.start(r, v); while (s.swept < 2 * Math.PI && s.t < 20 * T) model.step(s, T / 2500); return s; };
  const c = lap(vc), f = lap(vc * 1.1);
  const ok = Math.abs(vc - 7673) < 1 && Math.abs(T - 5545) < 2 && Math.abs(c.t - T) / T < 0.002 && model.ecc(c) < 0.001 && Math.abs(model.ecc(f) - 0.21) < 0.003;
  return { ok, detail: `v = ${vc.toFixed(0)} m/s, lap ${c.t.toFixed(0)} s against ${T.toFixed(0)} s, eccentricity ${model.ecc(c).toExponential(1)}; 10 % faster gives ${model.ecc(f).toFixed(3)}` };
}

export default {
  id: 'w01-orbit',
  world: 1,
  levels: [5, 6],
  title: 'Orbit Lab',
  goal: 'Launch the satellite sideways at exactly the speed for a circular orbit.',
  kind: 'validated',
  model: 'Two bodies, Newtonian gravity, a spherical Earth and no air drag, simulated with a leapfrog integrator and drawn to scale in a tilted plane. Real orbits are also nudged by the Moon, the Sun and Earth\'s bulge, and a real launch needs a rocket burn rather than an instant start.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, hard = ctx.level >= 6;
    // level 5: orbits 400…5,900 km up; level 6: far orbits another 20,000 km out, where the speed is much lower
    const r0 = RE + 400e3 + Math.floor(ctx.rng() * 12) * 500e3 + (hard ? 20e6 : 0);
    const vc = model.circular(r0), period = model.period(r0), timeScale = period / 9, U = 1.9 / r0;   // one lap of the circle in 9 s
    const km = (m) => Math.round(m / 1e3).toLocaleString('en-US');
    const geos = [], add = (geo, mat, x, y, z, parent = group) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const CY = 2.6, metal = ctx.mat('#39406b', { metalness: 0.4, roughness: 0.4 });

    // the planet on its stand, to the same scale as the orbit
    const pr = RE * U;
    const planet = add(new THREE.SphereGeometry(pr, 40, 28), ctx.mat('#2f7fe0', { roughness: 0.6 }), 0, CY, 0); planet.castShadow = true;
    for (const [lon, lat, sz] of [[0.4, 0.5, 0.46], [2.3, -0.3, 0.4], [3.9, 0.7, 0.31], [5.2, -0.6, 0.33], [1.3, -0.9, 0.24]]) { const size = sz * pr, d = pr * 1.03 - size; add(new THREE.SphereGeometry(size, 12, 8), ctx.mat('#4fc36a', { roughness: 0.9 }), Math.cos(lat) * Math.cos(lon) * d, Math.sin(lat) * d, Math.cos(lat) * Math.sin(lon) * d, planet); }
    for (const y of [1, -1]) add(new THREE.SphereGeometry(pr * 0.3, 12, 8), ctx.mat('#f4f6ff', { roughness: 0.8 }), 0, y * pr * 0.76, 0, planet);
    const air = ctx.glow('#7fc8ff', pr * 3.3, 0.5); air.position.set(0, CY, 0); group.add(air);
    add(new THREE.CylinderGeometry(0.1, 0.5, CY - pr * 0.9, 16), metal, 0, (CY - pr * 0.9) / 2, 0);
    for (const [x, y, z] of [[-3.1, 4.4, -2.3], [-1.6, 4.8, -2.4], [0.9, 4.6, -2.3], [2.8, 4.2, -2.4], [3.3, 1.2, -2.2], [-3.3, 1.5, -2.2]]) add(new THREE.OctahedronGeometry(0.09), ctx.lit('#ffffff', 1.6), x, y, z);

    // everything that orbits lives in a plane tilted towards the viewer: model (x, y) → plane (x, 0, −y)
    const plane = new THREE.Group(); plane.position.set(0, CY, 0); plane.rotation.x = 0.35; group.add(plane);
    const ringGeo = new THREE.TorusGeometry(1.9, 0.012, 6, 96); ringGeo.rotateX(Math.PI / 2);
    add(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.55 }), 0, 0, 0, plane);
    const sat = new THREE.Group(); plane.add(sat);
    add(new THREE.BoxGeometry(0.2, 0.2, 0.26), ctx.lit('#ffd76a', 1.2), 0, 0, 0, sat);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.34, 0.03, 0.2), ctx.mat('#3d7bf0', { metalness: 0.5, roughness: 0.3 }), sx * 0.28, 0, 0, sat);
    add(new THREE.ConeGeometry(0.07, 0.16, 10), ctx.mat('#cfd6ee', { metalness: 0.5, roughness: 0.3 }), 0, 0.17, 0, sat);
    sat.add(ctx.glow('#ffd76a', 0.7, 0.8));
    // the launch arrow: it points the way the satellite will go and grows with the chosen speed
    const arrow = new THREE.Group(); arrow.position.set(1.9, 0, 0); arrow.rotation.x = -Math.PI / 2; plane.add(arrow);
    const green = ctx.lit('#7fff9e', 1.3), shaft = add(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), green, 0, 0.5, 0, arrow), head = add(new THREE.ConeGeometry(0.1, 0.22, 10), green, 0, 1, 0, arrow);
    // the pull of gravity on the satellite, always towards the planet
    const pullGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6); pullGeo.rotateZ(Math.PI / 2); pullGeo.translate(-0.5, 0, 0);
    const pull = add(pullGeo, ctx.lit('#ff8a5c', 1.2), 0, 0, 0, plane);
    const MAX = 2400, trailPos = new Float32Array(MAX * 3), trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); geos.push(trailGeo);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 })); trail.frustumCulled = false; trailGeo.setDrawRange(0, 0); plane.add(trail);
    const label = ctx.sprite(`r = ${km(r0)} km`, { size: 0.45 }); label.position.set(0, 0.45, 2.15); plane.add(label);

    let vkm = Math.round(vc * 0.7 / 10) / 100;                                            // start 30 % too slow
    let s = null, n = 0, tick = 0, done = false, predicted = false, launches = 0;
    const rR = ui.readout('Distance from centre (km)'), rS = ui.readout('Speed (km/s)'), rE = ui.readout('Eccentricity'), rT = ui.readout('Time in flight (min)');
    const showArrow = () => { const len = Math.min(2.2, vkm * 0.16); shaft.scale.y = len; shaft.position.y = len / 2; head.position.y = len + 0.1; arrow.visible = !s; };
    const place = (x, y) => { sat.position.set(x * U, 0, -y * U); sat.rotation.y = Math.atan2(y, x); const r = Math.hypot(x, y); pull.position.copy(sat.position); pull.rotation.y = Math.atan2(y, x); pull.scale.x = Math.min(1.2, 0.5 * (r0 / r) ** 2); };
    const setV = (v) => { vkm = Math.max(1, Math.min(14, +(+v).toFixed(2))); showArrow(); };
    const nudge = (d) => { setV(vkm + d); vS.set?.(vkm); };
    const options = [vc / Math.SQRT2, vc, vc * Math.SQRT2].map((v) => (v / 1e3).toFixed(2));
    const setPredict = (p) => {
      const e = Math.abs(+p - vc / 1e3) / (vc / 1e3); predicted = predicted || e <= 0.03;
      ctx.say(e <= 0.03 ? 'Good prediction: that is √(GM/r). Now set the launch speed and test it.' : +p > vc / 1e3 ? 'That one is √2 times too big: it is the escape speed, where the satellite never comes back. Test it and see.' : 'That one is too small: gravity would win and the path would dip towards the planet. Test it and see.');
    };
    const launch = () => { s = model.start(r0, vkm * 1e3); n = 0; tick = 0; launches++; trailGeo.setDrawRange(0, 0); showArrow(); ctx.say(`Launched at ${vkm.toFixed(2)} km/s. Watch the path…`); };
    const finish = (text, ok) => {
      rE.set(model.ecc(s).toFixed(3)); s = null; place(r0, 0); showArrow(); ctx.say(text);
      if (ok && !done) { done = true; ctx.complete(predicted ? 1 : 0.85, 'A circular orbit needs v = √(GM/r); the satellite is always falling but keeps missing the Earth.'); }
    };
    ui.note(`Mission: a circular orbit at r = ${km(r0)} km from Earth's centre (altitude ${km(r0 - RE)} km). Use GM = 3.986×10¹⁴ m³/s².`);
    ui.note('Predict the circular speed (km/s):');
    const predC = ui.choice(options.map((o) => [o, o + ' km/s']), null, setPredict);
    const vS = ui.slider({ label: 'Launch speed (km/s)', min: 1, max: 14, step: 0.01, value: vkm, unit: 'km/s', onInput: setV });
    ui.button('−0.05', () => nudge(-0.05), 'btn ghost sm'); ui.button('+0.05', () => nudge(0.05), 'btn ghost sm');
    ui.button('🚀 Launch', launch, 'btn ok sm');
    ctx.onTap(sat, launch);
    place(r0, 0); showArrow(); rR.set(km(r0)); rS.set('–'); rE.set('–'); rT.set('–');
    ctx.say(hard ? `This satellite sits far out, ${km(r0)} km from Earth's centre. Gravity is weaker there, so think: does it need more sideways speed or less? Find the speed that keeps it on the blue ring.` : `The satellite waits ${km(r0)} km from Earth's centre. Find the sideways speed that keeps it on the blue ring all the way round.`);

    return {
      step(dt) {
        if (!s) return;
        const span = dt * timeScale, steps = Math.max(1, Math.ceil(span / (period / 2500))), d = span / steps;
        for (let i = 0; i < steps; i++) {
          const r = model.step(s, d);
          if (r < RE) return finish('The satellite came down to the ground. Too slow sideways: gravity pulled it down before it could miss the planet.', false);
          if (r > 8 * r0) return finish('It escaped into space! Above the escape speed, √2 times the circular speed, it never comes back.', false);
          if (s.swept >= 2 * Math.PI) {
            const e = model.ecc(s), fast = vkm * 1e3 > vc;
            if (e < 0.03) return finish(`Circular! Eccentricity ${e.toFixed(2)}: the distance only varied from ${km(s.rmin)} to ${km(s.rmax)} km. Gravity supplies exactly the pull needed to bend the path into a circle: GM/r² = v²/r, so v = √(GM/r).`, true);
            return finish(`That orbit is an ellipse (eccentricity ${e.toFixed(2)}). ${fast ? 'Too fast: it climbs away from the Earth and swings back. Slow down a little.' : 'Too slow: it falls inward and swings around closer. Speed up a little.'}`, false);
          }
        }
        place(s.x, s.y);
        if (tick++ % 2 === 0) { const i = n % MAX; trailPos.set([sat.position.x, 0, sat.position.z], i * 3); n++; trailGeo.setDrawRange(0, Math.min(n, i + 1)); trailGeo.attributes.position.needsUpdate = true; }
        rR.set(km(Math.hypot(s.x, s.y))); rS.set((Math.hypot(s.vx, s.vy) / 1e3).toFixed(3)); rE.set(model.ecc(s).toFixed(3)); rT.set((s.t / 60).toFixed(0));
      },
      frame(dt) { planet.rotation.y += dt * 0.15; },
      // Plays the lab the way a player would: predict, set the circular speed and launch.
      autoplay() { predC.set?.(options[1]); if (!predicted) setPredict(options[1]); const v = Math.round(vc / 10) / 100; vS.set?.(v); setV(v); launch(); },
      dispose() { for (const g of geos) g.dispose(); },
    };
  },
};
