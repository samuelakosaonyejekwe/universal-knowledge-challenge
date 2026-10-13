// World 1 — Physics and Astronomy: the Starfall Observatory.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: one small body around a planet, Newton's law of gravitation, velocity-Verlet steps -----
const GM = 3.986004418e14;          // Earth's gravitational parameter, m³/s²
const RE = 6.371e6;                 // Earth's mean radius, m
export const model = {
  GM, RE,
  start(altitude, speed) { return { x: 0, y: RE + altitude, vx: speed, vy: 0, t: 0, swept: 0 }; },
  // Advances the state by dt seconds (velocity Verlet: second order, and keeps energy steady over many laps).
  step(s, dt) {
    let r3 = Math.hypot(s.x, s.y) ** 3, ax = -GM * s.x / r3, ay = -GM * s.y / r3;
    const a0 = Math.atan2(s.x, s.y);
    s.x += s.vx * dt + 0.5 * ax * dt * dt; s.y += s.vy * dt + 0.5 * ay * dt * dt;
    r3 = Math.hypot(s.x, s.y) ** 3; const bx = -GM * s.x / r3, by = -GM * s.y / r3;
    s.vx += 0.5 * (ax + bx) * dt; s.vy += 0.5 * (ay + by) * dt; s.t += dt;
    let da = Math.atan2(s.x, s.y) - a0; if (da < -Math.PI) da += 2 * Math.PI; if (da > Math.PI) da -= 2 * Math.PI;
    s.swept += da;
    return s;
  },
  energy: (s) => 0.5 * (s.vx * s.vx + s.vy * s.vy) - GM / Math.hypot(s.x, s.y),      // per kilogram
  circular: (altitude) => Math.sqrt(GM / (RE + altitude)),
  escape: (altitude) => Math.sqrt(2 * GM / (RE + altitude)),
  // Kepler's third law for the orbit that starts at this height and speed (null when the probe escapes).
  period(altitude, speed) { const r = RE + altitude, a = 1 / (2 / r - speed * speed / GM); return a > 0 ? 2 * Math.PI * Math.sqrt(a ** 3 / GM) : null; },
};
// Used by the automated tests: one lap of a circular orbit must take the time Kepler's law predicts.
export function selfTest() {
  const alt = 400e3, v = model.circular(alt), s = model.start(alt, v), e0 = model.energy(s);
  while (s.swept < 2 * Math.PI && s.t < 1e5) model.step(s, 2);
  const T = model.period(alt, v), drift = Math.abs((model.energy(s) - e0) / e0);
  return { ok: Math.abs(s.t - T) / T < 0.002 && drift < 1e-6, detail: `lap ${s.t.toFixed(0)} s, Kepler ${T.toFixed(0)} s, energy drift ${(drift * 100).toExponential(1)} %` };
}

const sim = {
  title: 'Orbit launcher',
  goal: 'Launch the probe sideways from the tower. Find a speed that carries it all the way round the planet without falling back or flying away.',
  kind: 'validated',
  model: 'Newton\'s law of gravitation for one small probe around an Earth-sized planet (radius 6,371 km), solved step by step with the velocity-Verlet method. One lap is checked against Kepler\'s third law and the energy is conserved to better than one part in a million. It leaves out air drag, the planet\'s spin and bulge, the Moon and the Sun, and the rocket burn itself: the probe simply starts at the chosen height and speed.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, U = 0.9 / RE;                        // metres → scene units (planet radius 0.9)
    const C = new THREE.Vector3(0, 2.7, 0);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(0.9, 40, 28), ctx.mat('#2f7fe0', { roughness: 0.6 })); planet.position.copy(C); group.add(planet);
    for (const [lon, lat, sz] of [[0.4, 0.5, 0.42], [2.3, -0.3, 0.36], [3.9, 0.7, 0.28], [5.2, -0.6, 0.3], [1.3, -0.9, 0.22]]) { const land = new THREE.Mesh(new THREE.SphereGeometry(sz, 12, 8), ctx.mat('#4fc36a', { roughness: 0.9 })); const d = 0.93 - sz; land.position.set(Math.cos(lat) * Math.cos(lon) * d, Math.sin(lat) * d, Math.cos(lat) * Math.sin(lon) * d); planet.add(land); }
    const air = ctx.glow('#7fc8ff', 3.1, 0.55); air.position.copy(C); group.add(air);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.2, 6), ctx.lit('#ffffff', 0.8)); group.add(tower);
    const probe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), ctx.lit('#ffd76a', 1.6)); group.add(probe);
    const halo = ctx.glow('#ffd76a', 0.6, 0.9); probe.add(halo);
    const MAX = 900, trailPos = new Float32Array(MAX * 3), trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 })); trail.frustumCulled = false; group.add(trail);
    const guideRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.012, 96), new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); guideRing.position.copy(C); group.add(guideRing);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.2, 20), ctx.mat('#39406b', { metalness: 0.4, roughness: 0.4 })); stand.position.y = 0.6; group.add(stand);

    let alt = 400e3, speed = 6.5, s = null, n = 0, state = 'ready', lo = 0, hi = 0, tries = 0, e0 = 0;
    const speedS = ui.slider({ label: 'Launch speed', min: 5, max: 12, step: 0.05, value: speed, unit: 'km/s', onInput: (v) => { speed = v; } });
    const altS = ctx.level >= 3 ? ui.slider({ label: 'Launch height', min: 200, max: 2000, step: 50, value: 400, unit: 'km', onInput: (v) => { alt = v * 1000; place(); } }) : null;
    const rNow = ui.readout('Speed now, km/s'), rH = ui.readout('Height now, km'), rLo = ui.readout('Lowest, km'), rHi = ui.readout('Highest, km'), rT = ui.readout('Lap time, min'), rK = ui.readout('Kepler predicts, min'), rE = ui.readout('Energy drift, %');
    const place = () => { const r = (RE + alt) * U; tower.position.set(C.x, C.y + 0.9 + (r - 0.9) / 2, 0); tower.scale.y = Math.max(0.05, (r - 0.9) / 0.2); guideRing.scale.setScalar(r); if (state !== 'fly') probe.position.set(C.x, C.y + r, 0); };
    const launch = () => {
      s = model.start(alt, speed * 1000); e0 = model.energy(s); n = 0; lo = hi = alt; state = 'fly'; tries++; trailGeo.setDrawRange(0, 0);
      const T = model.period(alt, speed * 1000); rK.set(T ? (T / 60).toFixed(1) : '∞'); rT.set('–');
    };
    ui.button('🚀 Launch', launch, 'btn');
    ui.note('Too slow and gravity pulls the probe down. Too fast and it never comes back. In between, it keeps falling around the planet: that is an orbit.');
    place();
    ctx.say('Pick a speed and launch. Watch whether the path closes into a loop.');
    const end = (kind) => {
      state = kind;
      if (kind === 'crash') ctx.say(`It fell back after ${Math.round(s.t / 60)} minutes. Gravity won: try a faster launch.`);
      else if (kind === 'escape') ctx.say('It escaped! Above escape speed the probe never returns. Try a little slower.');
      else {
        const ecc = (hi - lo) / (hi + lo + 2 * RE), round = ecc < 0.05;
        rT.set((s.t / 60).toFixed(1));
        ctx.say(round ? `A nearly circular orbit — one lap in ${(s.t / 60).toFixed(0)} minutes, just as Kepler's law predicts.` : `It is in orbit! The path is a stretched loop (an ellipse) between ${Math.round(lo / 1000)} km and ${Math.round(hi / 1000)} km. A circular orbit here needs about ${(model.circular(alt) / 1000).toFixed(2)} km/s.`);
        ctx.complete(round ? 1 : 0.7, `e=${ecc.toFixed(3)}, tries=${tries}`);
      }
    };
    return {
      step(dt) {
        if (state !== 'fly') return;
        const lapGuess = model.period(alt, speed * 1000) || 20000, simDt = Math.min(120, lapGuess / 420) * (dt * 60);   // one lap in about 7 seconds
        for (let i = 0; i < 6 && state === 'fly'; i++) {
          model.step(s, simDt / 6);
          const r = Math.hypot(s.x, s.y), h = r - RE; lo = Math.min(lo, h); hi = Math.max(hi, h);
          if (h <= 0) end('crash'); else if (r > RE * 6.5 && model.energy(s) >= 0) end('escape'); else if (r > RE * 9) end('escape'); else if (Math.abs(s.swept) >= 2 * Math.PI) end('orbit');
        }
        probe.position.set(C.x + s.x * U, C.y + s.y * U, 0);
        if (n < MAX) { trailPos.set([probe.position.x, probe.position.y, 0], n * 3); n++; trailGeo.setDrawRange(0, n); trailGeo.attributes.position.needsUpdate = true; }
        rNow.set((Math.hypot(s.vx, s.vy) / 1000).toFixed(2)); rH.set(Math.round((Math.hypot(s.x, s.y) - RE) / 1000)); rLo.set(Math.round(lo / 1000)); rHi.set(Math.round(hi / 1000));
        rE.set((Math.abs((model.energy(s) - e0) / e0) * 100).toExponential(1));
      },
      frame(dt) { planet.rotation.y += dt * 0.15; },
      // Shows a successful run without the player (used by tests).
      autoplay() { speed = +(model.circular(alt) / 1000).toFixed(2); speedS.set(speed); launch(); },
      get state() { return state; },
    };
  },
};

export default {
  id: 1,
  theme: {
    sky: ['#070b2e', '#2b2470', '#f08a5d'], fog: '#2b2470', fogNear: 50, fogFar: 170,
    ground: '#5560c9', ground2: '#6a74dd', side: '#2a2d6b', stone: '#9097d8', accent: '#8a5cf6', glow: '#ffd76a', metal: '#39406b', wood: '#b98045', leaf: '#3fd0b0', water: '#3d7bf0', crate: '#c9a0ff',
    sun: '#ffe2c4', sunPower: 2.0, ambient: 1.25, skyLight: '#b9c4ff', groundLight: '#3a2c7a', sunDir: [0.5, 0.9, -0.4], particles: 'stars',
  },
  layout: { mirror: 1, stones: 4, rise: 0.5, towerH: 5.5 },
  story: {
    title: 'The Starfall Observatory',
    crystal: 'star lenses', crystalEm: '🔭',
    intro: ['Welcome to the Starfall Observatory! Last night our great telescope went dark.', 'Its five star lenses were scattered across the sky islands, and the probe we were about to launch is still waiting on its tower.'],
    remind: 'The star lenses glow gold. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five lenses! Now take the lift from the tower to the launch console and put our probe into orbit.',
    afterSim: 'The probe is flying. Only the Observatory Master stands between you and the portal — the arena is up the steps.',
    notReady: 'The arena is for those who have done the work. Bring all five star lenses and launch the probe first.',
    rival: ['So you launched a probe. Launching is easy. Understanding is hard.', 'We each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge reached the stars before mine. Well reasoned — the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and try me.'],
    outro: 'The telescope shines again, the probe is in orbit, and the Observatory Master has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k;
    // the observatory dome and its telescope on the home island
    k.prop('dome', -5.5, 0, -6, { s: 1.35, solid: true });
    const scope = k.mesh(new THREE.CylinderGeometry(0.28, 0.4, 3.2, 14), k.mat('#cfd6ee', { metalness: 0.5, roughness: 0.3 }), -5.5, 3.1, -6); scope.rotation.set(0.9, 0.4, 0);
    k.prop('lamp', 3.5, 0, 6.5); k.prop('lamp', -3.5, 0, 6.5); k.prop('crystal', 6.5, 0, -5, { s: 1.2 }); k.prop('crystal', -7.5, 0, 0.5, { color: '#b08cff' }); k.prop('rock', 7.2, 0, 3.4, { solid: true });
    // a small orrery on the middle island: three worlds circling a sun
    const mid = S.mid, sun = k.mesh(new THREE.SphereGeometry(0.5, 20, 14), k.lit('#ffcf5c', 1.8), mid[0] + 3.2, mid[1] + 2.4, mid[2] - 2.6); sun.castShadow = false; sun.add(k.glow('#ffcf5c', 3, 0.7));
    k.mesh(new THREE.CylinderGeometry(0.08, 0.2, 1.9, 8), k.mat('#39406b'), mid[0] + 3.2, mid[1] + 0.95, mid[2] - 2.6);
    const worlds = [[0.95, 0.12, '#9aa3c7', 1.6], [1.5, 0.18, '#2f7fe0', 1.0], [2.15, 0.15, '#e0662a', 0.53]].map(([r, size, c, w]) => ({ r, w, m: k.mesh(new THREE.SphereGeometry(size, 14, 10), k.mat(c), 0, 0, 0, sun) }));
    k.animate((dt, t) => { for (const p of worlds) p.m.position.set(Math.cos(t * p.w) * p.r, 0, Math.sin(t * p.w) * p.r); });
    k.prop('column', -4.6, mid[1], mid[2] + 3.4, { solid: true }); k.prop('crystal', 2, mid[1], mid[2] + 4, { s: 0.9 });
    // far islands, the tower beacon and the launch pad
    k.prop('lamp', -4.5, S.far[1], S.far[2] - 2.5); k.prop('lamp', 4.5, S.far[1], S.far[2] - 2.5); k.prop('ring', 0, S.far[1] + 6.2, S.far[2] + 3.2, { s: 0.8 });
    k.prop('pillar', S.sim[0] - 5.2, S.sim[1], S.sim[2] + 5, { solid: true }); k.prop('pillar', S.sim[0] + 5.4, S.sim[1], S.sim[2] - 4.4, { solid: true }); k.prop('banner', S.sim[0] - 5.8, S.sim[1], S.sim[2] - 2.5);
    for (const a of [0.6, 2.2, 3.9, 5.4]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6, { color: '#b08cff' });
    k.prop('arch', S.end[0], S.end[1], S.end[2] - 3.4, { s: 0.9 });
    // a ringed giant and a moon hang in the sky
    const giant = k.mesh(new THREE.SphereGeometry(16, 32, 20), k.mat('#c98a5a', { roughness: 0.9, fog: false }), -70, 34, 120); giant.castShadow = false;
    const rings = k.mesh(new THREE.RingGeometry(21, 30, 64), new THREE.MeshBasicMaterial({ color: 0xf2d7a8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false }), 0, 0, 0, giant); rings.rotation.x = 1.25; rings.castShadow = false;
    const moon = k.mesh(new THREE.SphereGeometry(5, 24, 16), k.mat('#e6ebff', { roughness: 1, fog: false }), 60, 48, 60); moon.castShadow = false;
    k.animate((dt) => { giant.rotation.y += dt * 0.02; });
    for (const [x, y, z] of [[-18, 9, 20], [16, 13, 38], [-14, 12, 66], [34, 16, 50]]) k.prop('cloud', x, y, z, { s: 1.6, color: '#8f8be0' });
  },
  sim,
};
