// World 4 lab — Paper Plane Pilot, in 3D: a paper dart is thrown down a hall and glides to a landing zone.
// No imports: everything arrives through ctx, so the model can be checked by tools/test-game3d.mjs without a browser.

// ----- the model (the same as the 2D lab): a point-mass glider that keeps one tilt to the air -----
const THROW = [3, 5.5, 9];          // m/s
const NOSE = [0, 1, 2];             // lumps of clay
const FLAP = [-1, 0, 1];            // down, flat, up
const K = 1.8, G = 9.81;            // K = rho·S/(2m) in 1/m
const H0 = 1.5, GAM0 = 0.15;        // launch height (m) and launch slope (rad)

export function fly(th, nose, flap, dt = 0.005) {
  const alpha = 0.18 + 0.1 * FLAP[flap] - 0.05 * NOSE[nose];
  const stalled = alpha > 0.25;
  const CL = stalled ? 0.5 : 3.5 * alpha, CD = 0.05 + 0.1 * CL * CL + (stalled ? 0.3 : 0);
  let x = 0, y = H0, v = THROW[th], gam = GAM0, t = 0;
  const path = [[x, y, v, gam]];
  while (y > 0 && t < 12) {
    const a = K * v * v;
    v += (-G * Math.sin(gam) - a * CD) * dt;
    v = Math.max(v, 0.5);
    gam += ((a * CL - G * Math.cos(gam)) / v) * dt;
    x += v * Math.cos(gam) * dt; y += v * Math.sin(gam) * dt; t += dt;
    if (path.length < 4000) path.push([x, y, v, gam]);
  }
  return { x, t, path, CL, CD, alpha, stalled };
}

// Checks: the trim numbers by hand, a steady glide (lift balances weight, so the path angle is −atan(CD/CL)),
// and that halving the time step hardly moves the landing point.
export function selfTest() {
  const a = fly(1, 0, 1), b = fly(1, 0, 2), c = fly(1, 0, 1, 0.0025);
  const trim = Math.abs(a.alpha - 0.18) < 1e-12 && Math.abs(a.CL - 0.63) < 1e-12 && Math.abs(a.CD - 0.08969) < 1e-9 && b.stalled && b.CL === 0.5 && Math.abs(b.CD - 0.375) < 1e-12;
  // long glide from high up: by the end the slope must match the glide ratio
  let v = 5.5, gam = 0; for (let i = 0; i < 40000; i++) { const q = K * v * v; v += (-G * Math.sin(gam) - q * a.CD) * 0.001; gam += ((q * a.CL - G * Math.cos(gam)) / v) * 0.001; }
  const want = -Math.atan(a.CD / a.CL), vWant = Math.sqrt(G * Math.cos(want) / (K * a.CL));
  const glide = Math.abs(gam - want) < 0.002 && Math.abs(v - vWant) < 0.01;
  const steady = Math.abs(a.x - c.x) < 0.15;                 // within about 1% of the 14 m flight
  return { ok: trim && glide && steady, detail: `flat trim CL ${a.CL.toFixed(2)} CD ${a.CD.toFixed(4)}; glide slope ${gam.toFixed(4)} rad (theory ${want.toFixed(4)}), speed ${v.toFixed(2)} m/s (theory ${vWant.toFixed(2)}); medium flat throw lands at ${a.x.toFixed(2)} m (${c.x.toFixed(2)} m at half the time step)` };
}

const THROW_NAME = ['gentle', 'medium', 'hard'];

export default {
  id: 'w04-paper-plane',
  world: 4,
  levels: [1, 2],
  title: 'Paper Plane Pilot',
  goal: 'Set up and throw the paper plane so it lands in the green target zone.',
  kind: 'validated',
  model: 'The plane is a point that always keeps the same tilt to the air. Lift, drag, weight and the throw are modelled with simple formulas and solved in tiny time steps; a long glide is checked against the glide slope the formulas predict. Real paper planes wobble, spin and are affected by wind. The hall is drawn to scale, but the plane itself is drawn bigger so you can see it.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, calm = !!ctx.calm, lv = ctx.level || 1;
    const U = 0.42, X0 = -3.3;                                   // metres → scene units; where the throw starts
    const sx = (m) => X0 + m * U, sy = (m) => 0.06 + m * U;
    const r3 = () => Math.floor(ctx.rng() * 3);
    const centre = Math.max(4, Math.round(fly(r3(), r3(), r3()).x * 2) / 2);
    const half = lv >= 2 ? 1 : 1.5;                              // a narrower zone for the higher level

    const white = ctx.mat('#ffffff', { roughness: 0.6 }), blue = ctx.mat('#1f8fe5', { roughness: 0.5 }), gold = ctx.mat('#ffd23f', { roughness: 0.5 }), steel = ctx.mat('#5b6b82', { metalness: 0.4, roughness: 0.4 });
    const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

    // the hall floor with a distance scale along its back edge
    add(new THREE.BoxGeometry(7, 0.06, 2.6), ctx.mat('#56637a', { roughness: 0.95 }), 0, 0.03, 0);
    add(new THREE.BoxGeometry(6.8, 0.02, 0.08), white, 0.05, 0.07, -1.1);
    for (let m = 0; m <= 16; m += 2) {
      add(new THREE.CylinderGeometry(0.03, 0.03, m % 4 ? 0.25 : 0.45, 6), m % 4 ? white : gold, sx(m), m % 4 ? 0.18 : 0.28, -1.1);
      if (m % 4 === 0 && m) { const s = ctx.sprite(m + ' m', { size: 0.36 }); s.position.set(sx(m), 0.75, -1.1); group.add(s); }
    }
    // the landing zone: a green mat with two flags
    const zone = add(new THREE.BoxGeometry(2 * half * U, 0.05, 1.7), ctx.lit('#2bc48a', 0.5), sx(centre), 0.085, 0);
    for (const e of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), steel, sx(centre + e * half), 0.56, -0.85);
      add(new THREE.ConeGeometry(0.11, 0.3, 4), gold, sx(centre + e * half) + 0.14, 0.95, -0.85).rotation.z = -Math.PI / 2;
    }
    const zl = ctx.sprite('🎯 ' + centre + ' m', { size: 0.45 }); zl.position.set(sx(centre), 1.45, -0.85); group.add(zl);

    // the thrower: a little pilot whose arm swings
    const pilot = new THREE.Group(); pilot.position.set(X0 - 0.12, 0.06, 0.12); group.add(pilot);
    add(new THREE.CapsuleGeometry(0.11, 0.2, 4, 10), blue, 0, 0.23, 0, pilot);
    add(new THREE.SphereGeometry(0.1, 14, 10), ctx.mat('#f2c9a0', { roughness: 0.8 }), 0, 0.5, 0, pilot);
    add(new THREE.ConeGeometry(0.11, 0.1, 12), gold, 0, 0.62, 0, pilot);
    const arm = new THREE.Group(); arm.position.set(0.02, 0.4, -0.12); pilot.add(arm);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8), blue, 0, 0.13, 0, arm);

    // the paper dart: two wings and a keel, with clay on the nose and flaps on the back edge
    const plane = new THREE.Group(); group.add(plane);
    const body = new THREE.Group(); plane.add(body);
    const pg = new THREE.BufferGeometry();
    const N = [0.36, 0, 0], T = [-0.34, 0.03, 0], L = [-0.34, 0.06, -0.27], R = [-0.34, 0.06, 0.27], Kl = [-0.34, -0.12, 0];
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...N, ...L, ...T, ...N, ...T, ...R, ...N, ...T, ...Kl]), 3)); pg.computeVertexNormals();
    const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide, flatShading: true });
    const dart = new THREE.Mesh(pg, paper); dart.castShadow = true; body.add(dart);
    const stripe = add(new THREE.BoxGeometry(0.5, 0.012, 0.03), blue, -0.06, 0.05, 0, body); stripe.rotation.z = -0.05;
    const clayM = ctx.mat('#a8683a', { roughness: 0.9 });
    const clay = [add(new THREE.SphereGeometry(0.055, 10, 8), clayM, 0.3, -0.01, 0, body), add(new THREE.SphereGeometry(0.05, 10, 8), clayM, 0.21, -0.035, 0, body)];
    const flapM = ctx.mat('#ff8a3c', { roughness: 0.6 });
    const flaps = [-1, 1].map((e) => { const h = new THREE.Group(); h.position.set(-0.34, 0.05, e * 0.15); body.add(h); add(new THREE.BoxGeometry(0.11, 0.012, 0.18), flapM, -0.055, 0, 0, h); return h; });
    const shadow = add(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ color: 0x1b2433, transparent: true, opacity: 0.35 }), 0, 0.068, 0); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;

    // the four forces, drawn as arrows that travel with the plane
    const arrow = (color) => {
      const g = new THREE.Group(), m = ctx.lit(color, 0.9);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), m), head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 10), m);
      g.add(shaft, head); group.add(g);
      g.put = (x, y, angle, len) => { g.visible = len > 0.04; g.position.set(x, y, 0); g.rotation.z = angle - Math.PI / 2; shaft.scale.y = Math.max(0.01, len); shaft.position.y = len / 2; head.position.y = len + 0.09; };
      g.visible = false; return g;
    };
    const aLift = arrow('#2bc48a'), aDrag = arrow('#ff5d6c'), aWeight = arrow('#ffd23f'), aPush = arrow('#5ad1ff');
    // the trail the plane leaves, and a marker where it came down
    const MAX = 500, tp = new Float32Array(MAX * 3), tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setDrawRange(0, 0);
    const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); trail.frustumCulled = false; group.add(trail);
    const mark = add(new THREE.SphereGeometry(0.09, 12, 8), ctx.lit('#ff8a3c', 1.3), 0, 0.14, 0); mark.visible = false;

    let cfg = [1, 0, 1], guess = null, flown = null, k = 0, kf = 0, state = 'ready', first = true, done = false, swing = 0, tn = 0, pulse = 0;
    const setup = () => {
      clay[0].visible = cfg[1] >= 1; clay[1].visible = cfg[1] >= 2;
      for (const f of flaps) f.rotation.z = -FLAP[cfg[2]] * 0.6;       // flap up = back edge lifts
      if (state !== 'fly') { state = 'ready'; flown = null; tg.setDrawRange(0, 0); mark.visible = false; for (const a of [aLift, aDrag, aWeight, aPush]) a.visible = false; pose(0, H0, GAM0, 0.18 + 0.1 * FLAP[cfg[2]] - 0.05 * NOSE[cfg[1]]); }
    };
    const pose = (xm, ym, gam, alpha) => { plane.position.set(sx(xm), sy(ym), 0); plane.rotation.z = gam + alpha; shadow.position.x = sx(xm); shadow.scale.setScalar(Math.max(0.35, 1 - ym * 0.15)); };

    ui.note(`Mission: land in the green zone, ${centre - half} m to ${centre + half} m away. Make a guess, set up your plane, then throw. You can also tap the plane to throw it.`);
    const guessC = ui.choice([['short', 'My guess: lands short'], ['in', 'My guess: in the zone'], ['far', 'My guess: goes far']], null, (v) => { guess = v; });
    const throwC = ui.choice([[0, 'Gentle throw'], [1, 'Medium throw'], [2, 'Hard throw']], 1, (v) => { cfg[0] = v; setup(); });
    const noseC = ui.choice([[0, 'No clay on the nose'], [1, 'One lump of clay'], [2, 'Two lumps of clay']], 0, (v) => { cfg[1] = v; setup(); });
    const flapC = ui.choice([[0, 'Flaps down'], [1, 'Flaps flat'], [2, 'Flaps up']], 1, (v) => { cfg[2] = v; setup(); });
    const rD = ui.readout('Distance, m'), rH = ui.readout('Height now, m'), rV = ui.readout('Speed now, m/s'), rT = ui.readout('Time in the air, s'), rZ = ui.readout('Target zone, m');
    rZ.set(`${centre - half} – ${centre + half}`); rD.set('–'); rH.set(H0.toFixed(1)); rV.set('–'); rT.set('–');

    const go = () => {
      if (state === 'fly') return;
      if (!guess) { ctx.say('Make a guess first: will it land short, in the zone, or go too far?'); return; }
      flown = fly(cfg[0], cfg[1], cfg[2]); k = 0; kf = 0; tn = 0; state = 'fly'; swing = 1; mark.visible = false; tg.setDrawRange(0, 0); rD.set('–');
      ctx.say(`Whoosh! A ${THROW_NAME[cfg[0]]} throw at ${THROW[cfg[0]]} m/s. Watch the arrows: green is lift, red is drag, yellow is weight.`);
    };
    const land = () => {
      state = 'landed'; const d = flown.x, res = d < centre - half ? 'short' : d > centre + half ? 'far' : 'in', D = d.toFixed(1);
      rD.set(D); rH.set('0.0'); rT.set(flown.t.toFixed(1)); mark.position.x = sx(d); mark.visible = true; pulse = 1;
      for (const a of [aLift, aDrag, aWeight, aPush]) a.visible = false;
      const right = res === guess ? ' Your guess was right!' : ' That was not what you guessed, and that is how pilots learn.';
      if (res === 'in') {
        ctx.say(`Landed at ${D} m, inside the zone! Lift held the plane up, weight pulled it down, drag slowed it, and your throw gave it the push to start.${right}`);
        if (!done) { done = true; ctx.complete(first ? 1 : 0.8, `landed ${D} m, zone ${centre}±${half} m, throw=${cfg[0]} clay=${cfg[1]} flaps=${cfg[2]}`); }
      } else if (flown.stalled) ctx.say(`Only ${D} m. The nose pointed too high, so the air could not flow smoothly over the wing. That is a stall: lots of drag, little lift, and the plane flopped down. Put the flaps flat or add a little clay to the nose.${right}`);
      else if (flown.alpha < 0.05) ctx.say(`Only ${D} m. The nose is too heavy for these flaps, so the wing meets the air almost flat and makes very little lift. Weight wins and it dives. Take some clay off or put the flaps up.${right}`);
      else if (res === 'short') ctx.say(`It landed at ${D} m, short of the zone. Drag used up the speed before it got there. A harder throw gives more speed, and more speed means more lift.${right}`);
      else ctx.say(`It flew ${D} m, past the zone. It had more speed and lift than it needed. Try a gentler throw, or change the nose and flaps so it glides less.${right}`);
      first = false;
    };
    ctx.onTap(dart, go); ctx.onTap(zone, () => ctx.say(`The green zone is ${centre - half} m to ${centre + half} m from the thrower. The posts at the back are 2 m apart.`));
    setup();
    ctx.say('Pick a guess, choose the throw, the clay and the flaps, then throw the plane.');

    return {
      step(dt) {
        if (state !== 'fly') return;
        kf += dt / 0.005 * (calm ? 2 : 1); k = Math.min(flown.path.length - 1, Math.floor(kf));
        const p = flown.path[k];
        pose(p[0], Math.max(0, p[1]), p[3], flown.alpha);
        const want = Math.min(MAX, 1 + Math.floor(k / 8));
        while (tn < want) { const q = flown.path[Math.min(flown.path.length - 1, tn * 8)]; tp.set([sx(q[0]), sy(Math.max(0, q[1])), 0], tn * 3); tn++; }
        tg.setDrawRange(0, tn); tg.attributes.position.needsUpdate = true;
        // forces, each as a share of the weight: lift is square to the path, drag points back along it
        const q = K * p[2] * p[2], px = plane.position.x, py = plane.position.y;
        aWeight.put(px, py, -Math.PI / 2, 0.55);
        aLift.put(px, py, p[3] + Math.PI / 2, Math.min(1.5, 0.55 * q * flown.CL / G));
        aDrag.put(px, py, p[3] + Math.PI, Math.min(1.2, 0.55 * q * flown.CD / G));
        aPush.put(px, py, p[3], k < 60 ? 0.5 * (1 - k / 60) * THROW[cfg[0]] / 9 + 0.05 : 0);
        rH.set(Math.max(0, p[1]).toFixed(1)); rV.set(p[2].toFixed(1)); rT.set((k * 0.005).toFixed(1));
        if (k >= flown.path.length - 1) land();
      },
      frame(dt, time) {
        const t = time || 0;
        swing = Math.max(0, swing - dt * 2.5); arm.rotation.z = -0.5 - 1.3 * Math.sin(swing * Math.PI);
        body.rotation.x = state === 'fly' && !calm ? Math.sin(t * 5) * (flown.stalled ? 0.35 : 0.08) : 0;
        if (state === 'ready') plane.position.y = sy(H0) + (calm ? 0 : Math.sin(t * 2) * 0.015);
        pulse = Math.max(0, pulse - dt); mark.scale.setScalar(1 + pulse * 1.5);
        zone.scale.y = 1 + (calm ? 0 : 0.25 * Math.max(0, Math.sin(t * 2.5)));
      },
      // Shows a successful run without the player (used by tests): finds the set-up that lands nearest the middle.
      autoplay() {
        let best = null;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) { const e = Math.abs(fly(a, b, c).x - centre); if (!best || e < best.e) best = { e, a, b, c }; }
        if (state === 'fly') state = 'landed';
        guessC.set('in'); throwC.set(best.a); noseC.set(best.b); flapC.set(best.c); go();
      },
      dispose() { group.traverse((o) => { if (o.isMesh || o.isLine) o.geometry?.dispose?.(); }); paper.dispose(); },
      get state() { return done ? 'landed in the zone' : state; },
    };
  },
};
