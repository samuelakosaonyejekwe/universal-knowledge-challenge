// Pendulum Timer in 3D: a real pendulum swinging on a frame, drawn to scale (1 scene unit = 1 metre), with a stopwatch.
// No imports: everything arrives through the context, so the model can be checked without a browser.

const PLANETS = { earth: ['🌍', 'Earth', 9.81, '#2f7fe0'], moon: ['🌙', 'Moon', 1.62, '#c9cfe6'], mars: ['🔴', 'Mars', 3.71, '#e0662a'], jupiter: ['🟠', 'Jupiter', 24.8, '#d9a066'] };
const A0 = 0.26;                                          // starting swing, radians (about 15 degrees)

// ----- the model: a point mass on a massless string, angle th and turning rate om -----
export const model = {
  A0,
  start: () => ({ th: A0, om: 0, t: 0, last: null, measured: null }),
  // Advances the swing by dt seconds in 20 small steps and times each full swing between passes through the middle.
  step(s, L, g, dt) {
    const d = dt / 20;
    for (let i = 0; i < 20; i++) {
      const prev = s.th;
      s.om += (-g / L) * Math.sin(s.th) * d; s.th += s.om * d; s.t += d;
      if (prev > 0 && s.th <= 0) { const tc = s.t - d * (0 - s.th) / (prev - s.th || 1); if (s.last != null) s.measured = tc - s.last; s.last = tc; }
    }
    return s;
  },
  small: (L, g) => 2 * Math.PI * Math.sqrt(L / g),                           // T = 2π√(L/g)
  period: (L, g) => 2 * Math.PI * Math.sqrt(L / g) * (1 + (A0 * A0) / 16),   // with the first correction for a 15° swing
};

// Hand-worked values: a 1 m pendulum on Earth swings in 2π√(1/9.81) = 2.006 s (2.015 s at 15°); on the Moon 4.937 s.
export function selfTest() {
  const run = (L, g) => { const s = model.start(); while (s.measured == null && s.t < 60) model.step(s, L, g, 1 / 60); return s.measured; };
  const e = run(1, 9.81), m = run(1, 1.62), q = run(0.25, 9.81);
  const ok = Math.abs(model.small(1, 9.81) - 2.0061) < 0.0005 && Math.abs(model.small(1, 1.62) - 4.9366) < 0.001 && Math.abs(e - model.period(1, 9.81)) < 0.01 && Math.abs(m - model.period(1, 1.62)) < 0.02 && Math.abs(q / e - 0.5) < 0.005;
  return { ok, detail: `1 m on Earth: swings ${e.toFixed(3)} s, formula ${model.period(1, 9.81).toFixed(3)} s; on the Moon ${m.toFixed(3)} s, formula ${model.period(1, 1.62).toFixed(3)} s; a quarter of the length takes ${(q / e).toFixed(3)} of the time` };
}

export default {
  id: 'w01-pendulum',
  world: 1,
  levels: [3, 4],
  title: 'Pendulum Timer',
  goal: 'Build a pendulum that swings with the target time for one full swing.',
  kind: 'validated',
  model: 'A point-mass bob on a massless string, a swing of about 15 degrees, no air drag and no friction at the pivot, drawn to scale. The swing is solved step by step and timed between passes through the middle; the check uses T = 2π√(L/g) with the small correction for a 15 degree swing. Big swings take slightly longer than the formula says.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, keys = Object.keys(PLANETS);
    const hard = ctx.level >= 4, pool = hard ? ['moon', 'mars', 'jupiter'] : ['earth'];
    const planetKey = pool[Math.floor(ctx.rng() * pool.length)], gTarget = PLANETS[planetKey][2];
    const Ltarget = +(0.3 + Math.floor(ctx.rng() * 45) * 0.05).toFixed(2);              // 0.3…2.5 m
    const Ttarget = model.small(Ltarget, gTarget);
    const geos = [], add = (geo, mat, x, y, z, parent = group) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    const metal = ctx.mat('#39406b', { metalness: 0.4, roughness: 0.4 }), pale = ctx.mat('#cfd6ee', { metalness: 0.5, roughness: 0.3 }), gold = ctx.lit('#ffd76a', 1.3);
    const PY = 4.0;                                                                       // height of the pivot, m

    // the frame: a beam running front to back on two pairs of legs, so the bob swings between them
    const beamGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.2, 10); beamGeo.rotateX(Math.PI / 2);
    add(beamGeo, metal, 0, PY + 0.07, 0);
    const legLen = Math.hypot(1.25, PY + 0.07);
    for (const z of [-1, 1]) for (const sx of [-1, 1]) { const leg = add(new THREE.CylinderGeometry(0.05, 0.07, legLen, 8), metal, sx * 0.625, (PY + 0.07) / 2, z); leg.rotation.z = sx * Math.atan2(1.25, PY + 0.07); }
    for (const z of [-1, 1]) add(new THREE.BoxGeometry(2.7, 0.08, 0.16), metal, 0, 0.04, z);
    // the pendulum itself
    const arm = new THREE.Group(); arm.position.set(0, PY, 0); group.add(arm);
    const string = add(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), pale, 0, -0.5, 0, arm);
    const bob = add(new THREE.SphereGeometry(1, 24, 16), ctx.lit('#ffb347', 0.5), 0, -1, 0, arm);
    add(new THREE.SphereGeometry(0.09, 12, 8), pale, 0, PY, 0);
    // a measuring pole behind the swing, marked every half metre down from the pivot, with a sliding marker
    add(new THREE.BoxGeometry(0.08, PY, 0.08), pale, -1.9, PY / 2, -0.6);
    for (let d = 0.5; d <= 3; d += 0.5) { add(new THREE.BoxGeometry(d % 1 ? 0.22 : 0.36, 0.03, 0.1), gold, -1.9, PY - d, -0.6); if (d % 1 === 0) { const lab = ctx.sprite(d + ' m', { size: 0.4 }); lab.position.set(-2.35, PY - d, -0.6); group.add(lab); } }
    const marker = add(new THREE.BoxGeometry(0.5, 0.07, 0.16), ctx.lit('#6be28a', 1.2), -1.9, PY - 1, -0.6);
    // the planet you are standing on, with an arrow that grows with its gravity
    add(new THREE.CylinderGeometry(0.12, 0.3, 0.7, 12), metal, 2.5, 0.35, 0.4);
    const globe = add(new THREE.SphereGeometry(0.55, 28, 18), ctx.mat(PLANETS.earth[3], { roughness: 0.7 }), 2.5, 1.25, 0.4);
    const globeMats = Object.fromEntries(keys.map((k) => [k, ctx.mat(PLANETS[k][3], { roughness: 0.7 })]));
    const names = Object.fromEntries(keys.map((k) => { const sp = ctx.sprite(PLANETS[k][1], { size: 0.5 }); sp.position.set(2.5, 2.15, 0.4); sp.visible = false; group.add(sp); return [k, sp]; }));
    const pull = new THREE.Group(); pull.position.set(3.25, 2.0, 0.4); group.add(pull);
    const shaft = add(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), ctx.lit('#ff8a5c', 1.1), 0, -0.5, 0, pull), tip = add(new THREE.ConeGeometry(0.15, 0.3, 10), ctx.lit('#ff8a5c', 1.1), 0, -1, 0, pull); tip.rotation.x = Math.PI;
    // the stopwatch: its hand goes round once in the target time and jumps back to the top at each full swing
    add(new THREE.CylinderGeometry(0.06, 0.1, 1.0, 8), metal, -2.9, 0.5, 0.9);
    const watchGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.16, 32); watchGeo.rotateX(Math.PI / 2);
    const watch = add(watchGeo, ctx.mat('#f4f6ff', { roughness: 0.4 }), -2.9, 1.55, 0.9);
    const rimGeo = new THREE.TorusGeometry(0.6, 0.06, 8, 32); add(rimGeo, gold, 0, 0, 0.05, watch);
    add(new THREE.BoxGeometry(0.06, 0.16, 0.06), ctx.lit('#6be28a', 1.2), 0, 0.46, 0.1, watch);
    const hand = new THREE.Group(); hand.position.z = 0.11; watch.add(hand);
    add(new THREE.BoxGeometry(0.05, 0.46, 0.04), ctx.mat('#e0483c', { roughness: 0.5 }), 0, 0.23, 0, hand);
    const lampOff = ctx.mat('#59608f', { roughness: 0.5 }), lampOn = ctx.lit('#6be28a', 1.8);
    const lamp = add(new THREE.SphereGeometry(0.16, 14, 10), lampOff, -2.9, 2.36, 0.9);

    let cur = 'earth', L = 1, mass = 0.5, s = model.start(), done = false, guess = null, tested = false, sinceCross = 0;
    const g = () => PLANETS[cur][2], f3 = (x) => x.toFixed(3);
    const rWant = ui.readout('Target time (s)'), rMeas = ui.readout('Measured time (s)'), rG = ui.readout('Gravity here (m/s²)');
    rWant.set(f3(Ttarget));
    const reset = () => { s = model.start(); sinceCross = 0; rMeas.set('–'); lamp.material = lampOff; };
    const show = () => {
      string.scale.y = L; string.position.y = -L / 2; bob.position.y = -L; bob.scale.setScalar(0.16 + 0.1 * Math.cbrt(mass)); marker.position.y = PY - L;
      globe.material = globeMats[cur]; for (const k of keys) names[k].visible = k === cur;
      const len = 0.15 + (g() / 24.8) * 1.2; shaft.scale.y = len; shaft.position.y = -len / 2; tip.position.y = -len - 0.15;
      rG.set(String(g()));
    };
    const setL = (v) => { L = Math.max(0.1, Math.min(3, +v)); reset(); show(); };
    const setMass = (v) => { mass = Math.max(0.1, Math.min(2, +v)); reset(); show(); };
    const setPlanet = (k) => { cur = k; reset(); show(); };
    const setGuess = (v) => { guess = v; };
    const check = () => {
      const T = model.period(L, g()), err = Math.abs(T - Ttarget);
      if (guess && !tested) {
        tested = true;
        ctx.say(guess === 'same' ? 'You were right: the mass cancels out. Only the length and gravity set the time.' : 'Try changing the mass slider: the time stays the same! A heavier bob is pulled harder, but it is also harder to move, and the two cancel.');
      }
      if (cur !== planetKey) { ctx.say(`Choose the planet from the mission first: ${PLANETS[planetKey][1]}. Gravity there is ${gTarget} m/s², so the same pendulum swings at a different pace.`); return; }
      if (err <= 0.08) {
        lamp.material = lampOn;
        if (!done) { done = true; ctx.say(`Yes! Your pendulum takes ${f3(T)} s. T = 2π√(L/g). Longer string, longer swing; stronger gravity, quicker swing.`); ctx.complete(guess === 'same' ? 1 : 0.85, 'The swing time depends on length and gravity, not on mass: T = 2π√(L/g).'); }
      } else ctx.say(T > Ttarget ? `Too slow (${f3(T)} s). Make the string shorter: a short pendulum has less far to travel, so it swings back sooner.` : `Too fast (${f3(T)} s). Make the string longer: a long pendulum has further to travel, so each swing takes more time.`);
    };

    ui.note(`Mission: on ${PLANETS[planetKey][0]} ${PLANETS[planetKey][1]} (g = ${gTarget} m/s²) make one full swing last ${f3(Ttarget)} s.`);
    const Lsl = ui.slider({ label: 'String length (m)', min: 0.1, max: 3, step: 0.05, value: 1, unit: 'm', onInput: setL });
    const Msl = ui.slider({ label: 'Bob mass (kg)', min: 0.1, max: 2, step: 0.1, value: 0.5, unit: 'kg', onInput: setMass });
    ui.note('Planet:');
    const planetC = ui.choice(keys.map((k) => [k, PLANETS[k][0] + ' ' + PLANETS[k][1]]), 'earth', setPlanet);
    ui.note('Guess: if the bob gets heavier…');
    const guessC = ui.choice([['faster', 'Heavier swings faster'], ['same', 'Same time'], ['slower', 'Heavier swings slower']], null, setGuess);
    ui.button('✔ Check my pendulum', check, 'btn ok sm');
    ctx.onTap(globe, () => { const k = keys[(keys.indexOf(cur) + 1) % keys.length]; planetC.set?.(k); setPlanet(k); });
    ctx.onTap(bob, () => { const m = mass >= 2 ? 0.1 : Math.min(2, +(mass + 0.3).toFixed(1)); Msl.set?.(m); setMass(m); });
    ctx.onTap(watch, check);
    show(); rMeas.set('–');
    ctx.say(hard ? `We have landed on ${PLANETS[planetKey][1]}, where gravity is ${gTarget} m/s². Choose that planet, then find the string length that makes one full swing last ${f3(Ttarget)} seconds.` : `Change the string length until one full swing lasts ${f3(Ttarget)} seconds. Watch the stopwatch: its hand goes round once in the target time.`);

    return {
      step(dt) {
        const before = s.last;
        model.step(s, L, g(), dt); sinceCross += dt;
        if (s.last !== before) { sinceCross = s.t - s.last; if (s.measured != null) { rMeas.set(f3(s.measured)); if (!done) lamp.material = cur === planetKey && Math.abs(s.measured - Ttarget) <= 0.08 ? lampOn : lampOff; } }
        arm.rotation.z = s.th;
        hand.rotation.z = -(sinceCross / Ttarget) * 2 * Math.PI;
      },
      frame(dt) { globe.rotation.y += dt * 0.3; },
      // Plays the lab the way a player would: guess, choose the mission's planet, set the string and check.
      autoplay() { guessC.set?.('same'); setGuess('same'); planetC.set?.(planetKey); setPlanet(planetKey); Lsl.set?.(Ltarget); setL(Ltarget); check(); },
      dispose() { for (const x of geos) x.dispose(); },
    };
  },
};
