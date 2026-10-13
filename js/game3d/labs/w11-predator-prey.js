// 3D lab — Predator and Prey: a meadow of hares and lynx whose figures appear and vanish with the model,
// and a row of pillars at the back, one per year, that the player steers towards a target height.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

// ----- the model (the same as the 2D lab) -----
//   dN/dt = r·N·(1 − N/K) − a·N·P      prey grow until the meadow is full, and some are caught
//   dP/dt = b·a·N·P − m·P              predators raise young from what they catch, and some die each year
const r = 0.8, K = 200, b = 0.2;          // prey growth (per year), carrying capacity (animals), conversion efficiency
const DT = 0.02, T_END = 60, N0 = 100, P0 = 10;
export const model = {
  r, K, b, DT, T_END, N0, P0,
  rates: (N, P, a, m) => [r * N * (1 - N / K) - a * N * P, b * a * N * P - m * P],
  // one fourth-order Runge–Kutta step of dt years
  step(s, a, m, dt = DT) {
    const f = model.rates;
    const k1 = f(s.N, s.P, a, m), k2 = f(s.N + dt / 2 * k1[0], s.P + dt / 2 * k1[1], a, m), k3 = f(s.N + dt / 2 * k2[0], s.P + dt / 2 * k2[1], a, m), k4 = f(s.N + dt * k3[0], s.P + dt * k3[1], a, m);
    s.N = Math.max(0, s.N + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]));
    s.P = Math.max(0, s.P + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]));
    s.t += dt;
    return s;
  },
  start: (N = N0, P = P0) => ({ N, P, t: 0 }),
  nStar: (a, m) => m / (b * a),                         // prey at balance
  pStar: (a, m) => r * (1 - m / (b * a) / K) / a,       // predators at balance (only real when N* is below K)
  // a whole 60-year run, sampled every 0.2 years as the lab does
  run(a, m) { const s = model.start(); let minN = s.N, minP = s.P; for (let i = 0; i < T_END / DT; i++) { model.step(s, a, m); if (i % 10 === 9) { minN = Math.min(minN, s.N); minP = Math.min(minP, s.P); } } return { N: s.N, P: s.P, minN, minP }; },
  wins: (o, target) => o.minN > 1 && o.minP > 1 && Math.abs(o.N - target) / target <= 0.1,
};
export function selfTest() {
  const d = model.rates(100, 10, 0.01, 0.4);                      // by hand: 0.8·100·0.5 − 0.01·100·10 = 30 ; 0.2·0.01·100·10 − 0.4·10 = −2
  const ns = model.nStar(0.02, 0.4), ps = model.pStar(0.02, 0.4);  // by hand: 0.4/(0.2·0.02) = 100 ; 0.8·(1 − 100/200)/0.02 = 20
  const e = model.start(ns, ps); let moved = 0;
  for (let i = 0; i < 3000; i++) { model.step(e, 0.02, 0.4); moved = Math.max(moved, Math.abs(e.N - ns), Math.abs(e.P - ps)); }
  const o = model.run(0.02, 0.4), full = model.run(0.01, 0.4);    // N* = 200 = K: the predators cannot keep up and fade
  let solvable = 0; for (let t = 40; t <= 120; t += 10) { let hit = false; for (let ai = 5; ai <= 30 && !hit; ai++) for (let mi = 2; mi <= 16 && !hit; mi++) hit = model.wins(model.run(ai / 1000, mi * 0.05), t); if (hit) solvable++; }
  const ok = Math.abs(d[0] - 30) < 1e-9 && Math.abs(d[1] + 2) < 1e-9 && Math.abs(ns - 100) < 1e-9 && Math.abs(ps - 20) < 1e-9 && moved < 1e-9
    && Math.abs(o.N - 100) < 0.01 && Math.abs(o.P - 20) < 0.01 && full.P < P0 && full.N > 190 && solvable === 9;
  return { ok, detail: `rates at (100, 10): ${d[0].toFixed(2)}, ${d[1].toFixed(2)} per year (by hand 30, −2); balance (${ns}, ${ps}) moved ${moved.toExponential(1)}; 60 years from (100, 10) ends at (${o.N.toFixed(3)}, ${o.P.toFixed(3)}); N* = K leaves ${full.P.toFixed(1)} predators; ${solvable} of 9 targets reachable` };
}

export default {
  id: 'w11-predator-prey',
  world: 11,
  levels: [5, 6],
  title: 'Predator and Prey',
  goal: 'Tune the lynx so that the hares settle at the target number after 60 years, with both kinds of animal still living in the meadow.',
  kind: 'validated',
  model: 'dN/dt = rN(1 − N/K) − aNP and dP/dt = b·aNP − mP with r = 0.8 per year, K = 200 and b = 0.2, starting from 100 prey and 10 predators and solved with fourth-order Runge–Kutta steps of 0.02 years. Two species, a well-mixed area, logistic prey growth (carrying capacity 200), no migration, disease, seasons or randomness. Populations are continuous numbers, so they can fall below one animal. Each hare figure stands for 4 animals and each lynx figure for 3.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rng = ctx.rng || Math.random, L = ctx.level;
    const target = 40 + 10 * Math.min(8, Math.floor(rng() * 9));           // 40..120 animals
    const HIDE = L >= 6;                                                   // at the top level the balance point stays hidden until the run starts
    const PER_N = 4, PER_P = 3, NN = 50, NP = 30, TOP = 220, BAR_H = 3.0, BASE_Y = 0.12;

    // ----- the meadow -----
    const D = new THREE.Object3D(), MZ = 0.55;
    const meadow = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 40), ctx.mat('#7ccf6a', { roughness: 1 })); meadow.scale.set(3.4, 1, 1.8); meadow.position.set(0, 0.06, MZ); meadow.receiveShadow = true; group.add(meadow);
    const spot = () => { const q = Math.sqrt(rng()) * 0.88, a = rng() * Math.PI * 2; return [Math.cos(a) * q * 3.2, MZ + Math.sin(a) * q * 1.6]; };
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.22, 4), ctx.mat('#2f9e44', { flatShading: true }), 36);
    for (let i = 0; i < 36; i++) { const [x, z] = spot(); D.position.set(x, 0.2, z); D.rotation.set(0, rng() * 3, (rng() - 0.5) * 0.4); D.scale.setScalar(0.7 + rng() * 0.8); D.updateMatrix(); tufts.setMatrixAt(i, D.matrix); }
    group.add(tufts);
    for (const [x, z, s] of [[-3.0, 1.2, 0.34], [3.05, 0.1, 0.42], [2.6, 1.75, 0.26]]) { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), ctx.mat('#8d9a86', { flatShading: true })); rock.position.set(x, s * 0.6, z); rock.castShadow = true; group.add(rock); }

    // ----- the animals: each kind is a few instanced shapes -----
    const ball = new THREE.SphereGeometry(1, 10, 8), cone = new THREE.ConeGeometry(1, 1, 6), box = new THREE.BoxGeometry(1, 1, 1);
    const part = (geo, material, count, locals) => {
      const im = new THREE.InstancedMesh(geo, material, count * locals.length); im.castShadow = true; im.frustumCulled = false; group.add(im);
      return { im, locals: locals.map(([x, y, z, sx = 1, sy = sx, sz = sx, rz = 0]) => { D.position.set(x, y, z); D.rotation.set(0, 0, rz); D.scale.set(sx, sy, sz); D.updateMatrix(); return D.matrix.clone(); }) };
    };
    const hareParts = [
      part(ball, ctx.mat('#f4efe6', { roughness: 0.9 }), NN, [[0, 0.13, 0, 0.17, 0.13, 0.11], [0.16, 0.25, 0, 0.09], [-0.17, 0.14, 0, 0.05]]),
      part(ball, ctx.mat('#b9a58f', { roughness: 0.9 }), NN, [[0.13, 0.42, 0.04, 0.025, 0.12, 0.04], [0.13, 0.42, -0.04, 0.025, 0.12, 0.04]]),
    ];
    const lynxParts = [
      part(ball, ctx.mat('#c9a66b', { roughness: 0.85 }), NP, [[0, 0.3, 0, 0.3, 0.16, 0.14], [0.32, 0.46, 0, 0.14, 0.13, 0.13], [-0.32, 0.34, 0, 0.07]]),
      part(cone, ctx.mat('#4a3a33', { roughness: 0.85, flatShading: true }), NP, [[0.3, 0.64, 0.08, 0.04, 0.14, 0.04], [0.3, 0.64, -0.08, 0.04, 0.14, 0.04]]),
      part(box, ctx.mat('#b08f58', { roughness: 0.9 }), NP, [[0.2, 0.09, 0.08, 0.06, 0.2, 0.06], [0.2, 0.09, -0.08, 0.06, 0.2, 0.06], [-0.2, 0.09, 0.08, 0.06, 0.2, 0.06], [-0.2, 0.09, -0.08, 0.06, 0.2, 0.06]]),
    ];
    const herd = (count) => Array.from({ length: count }, () => { const [hx, hz] = spot(); return { hx, hz, ph: rng() * 6.28, sp: 0.5 + rng() * 0.6, sc: 0 }; });
    const hares = herd(NN), lynx = herd(NP);
    const F = new THREE.Matrix4(), M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const draw = (list, parts, shown, size, hop, dt, time) => {
      for (let i = 0; i < list.length; i++) {
        const f = list[i], th = ctx.calm ? f.ph : time * f.sp + f.ph;
        f.sc += ((i < shown ? 1 : 0) - f.sc) * Math.min(1, dt * 6);
        V.set(f.hx + Math.cos(th) * 0.25, 0.12 + (ctx.calm ? 0 : Math.abs(Math.sin(time * 5 + f.ph)) * hop), f.hz + Math.sin(th * 0.7) * 0.2);
        Q.setFromAxisAngle(UP, Math.atan2(-Math.cos(th * 0.7) * 0.14, -Math.sin(th) * 0.25));
        F.compose(V, Q, SC.setScalar(Math.max(1e-4, f.sc * size)));
        for (const p of parts) for (let j = 0; j < p.locals.length; j++) { M.multiplyMatrices(F, p.locals[j]); p.im.setMatrixAt(i * p.locals.length + j, M); }
      }
      for (const p of parts) p.im.instanceMatrix.needsUpdate = true;
    };
    const figures = (animals, per, pool) => (animals < 1 ? 0 : Math.min(pool, Math.ceil(animals / per)));

    // ----- one pair of pillars per year along the back: hares behind, lynx in front, on the same scale -----
    const YEARS = T_END, BX = -3.0, BW = 6.0, ZN = -2.2, ZP = -1.9;
    const barGeo = new THREE.BoxGeometry(1, 1, 1);
    const barsN = new THREE.InstancedMesh(barGeo, ctx.mat('#3b9d5a', { roughness: 0.7 }), YEARS + 1), barsP = new THREE.InstancedMesh(barGeo, ctx.mat('#e8743b', { roughness: 0.7 }), YEARS + 1);
    barsN.frustumCulled = barsP.frustumCulled = false; barsN.castShadow = barsP.castShadow = true; group.add(barsN, barsP);
    const hOf = (v) => BAR_H * Math.min(1, v / TOP);
    const setBar = (im, k, v, z) => { const hh = Math.max(1e-4, hOf(v)); D.position.set(BX + BW * k / YEARS, BASE_Y + hh / 2, z); D.rotation.set(0, 0, 0); D.scale.set(0.07, hh, 0.16); D.updateMatrix(); im.setMatrixAt(k, D.matrix); im.instanceMatrix.needsUpdate = true; };
    const clearBars = () => { for (let k = 0; k <= YEARS; k++) { setBar(barsN, k, 0, ZN); setBar(barsP, k, 0, ZP); } };
    const shelf = new THREE.Mesh(barGeo, ctx.mat('#5b4a3a', { roughness: 0.9 })); shelf.scale.set(BW + 0.5, BASE_Y, 0.8); shelf.position.set(0, BASE_Y / 2, (ZN + ZP) / 2); shelf.receiveShadow = true; group.add(shelf);
    const ty = BASE_Y + hOf(target);
    const beam = new THREE.Mesh(barGeo, ctx.lit('#7dffb8', 1.4)); beam.scale.set(BW + 0.4, 0.035, 0.035); beam.position.set(0, ty, ZN + 0.14); beam.castShadow = false; group.add(beam);
    const band = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x7dffb8, transparent: true, opacity: 0.22, depthWrite: false })); band.scale.set(BW + 0.4, hOf(target * 0.2), 0.3); band.position.set(0, ty, ZN); group.add(band);
    const label = (text, x, y, z, size = 0.3) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); group.add(s); return s; };
    label(`target ${target}`, 2.75, ty + 0.3, ZN + 0.3, 0.34);
    for (const v of [0, 100, 200]) { label(String(v), -3.35, BASE_Y + hOf(v) + 0.05, ZP, 0.24); const tick = new THREE.Mesh(barGeo, ctx.mat('#ffffff')); tick.scale.set(0.16, 0.02, 0.02); tick.position.set(-3.12, BASE_Y + hOf(v), ZP); group.add(tick); }
    label('year 0', BX, 0.42, ZP + 0.55, 0.22); label('year 60', BX + BW, 0.42, ZP + 0.55, 0.22);
    const tagN = label('hares', 0, 0, 0, 0.28), tagP = label('lynx', 0, 0, 0, 0.28);
    const clock = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), ctx.lit('#ffd76a', 1.8)); clock.castShadow = false; group.add(clock);
    const clockGlow = ctx.glow('#ffd76a', 0.7, 0.8); clock.add(clockGlow);

    // ----- controls, readouts and the run -----
    let a = 0.01, m = 0.4, pred = 100, s = model.start(), state = 'ready', acc = 0, minN = N0, minP = P0, guessOk = false, done = false, tries = 0, year = 0;
    const rN = ui.readout('Hares (prey N), animals'), rP = ui.readout('Lynx (predators P), animals'), rT = ui.readout('Time, years'), rE = ui.readout('Balance point N* = m ÷ (b·a), animals');
    const round2 = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
    const show = () => {
      rN.set(round2(s.N)); rP.set(round2(s.P)); rT.set(s.t.toFixed(1));
      rE.set(HIDE && state === 'ready' ? 'work it out, then run' : round2(model.nStar(a, m)));
      const x = BX + BW * Math.min(1, s.t / YEARS);
      clock.position.set(x, BASE_Y + BAR_H + 0.35, ZN);
      tagN.position.set(Math.min(2.9, x + 0.45), BASE_Y + hOf(s.N) + 0.2, ZN + 0.1); tagP.position.set(Math.min(2.9, x + 0.45), Math.max(0.45, BASE_Y + hOf(s.P) - 0.05), ZP + 0.35);
    };
    const reset = () => { s = model.start(); state = 'ready'; acc = 0; year = 0; minN = N0; minP = P0; clearBars(); setBar(barsN, 0, s.N, ZN); setBar(barsP, 0, s.P, ZP); show(); };
    const aS = ui.slider({ label: 'Attack rate a (per predator per year)', min: 0.005, max: 0.03, step: 0.001, value: a, unit: '', onInput: (v) => { a = Math.round(v * 1000) / 1000; if (state !== 'run') show(); } });
    const mS = ui.slider({ label: 'Predator death rate m (per year)', min: 0.1, max: 0.8, step: 0.05, value: m, unit: '', onInput: (v) => { m = Math.round(v * 20) / 20; if (state !== 'run') show(); } });
    const pS = ui.slider({ label: 'My prediction for the balance point N*', min: 10, max: 400, step: 1, value: pred, unit: 'hares', onInput: (v) => { pred = v; } });
    const run = () => { reset(); const ns = model.nStar(a, m); guessOk = Math.abs(pred - ns) / ns <= 0.05; tries++; state = 'run'; show(); ctx.say(`You predicted ${Math.round(pred)} hares at balance. The years are running: watch the green pillars and the meadow.`); };
    ui.button('▶ Run 60 years', run, 'btn');
    ui.button('Reset', reset, 'btn ghost sm');
    ui.note(`Mission: settle the hares at ${target} (within 10 %) with both kinds alive. The model: dN/dt = rN(1 − N/K) − aNP, dP/dt = b·aNP − mP, with r = 0.8 per year, K = 200, b = 0.2. One hare figure is 4 animals, one lynx figure is 3.`);
    reset();
    ctx.say(HIDE ? 'Work out the balance point m ÷ (b·a) yourself, set your prediction, then watch the two kinds chase each other.' : 'Predict the balance point first, then watch the two kinds chase each other.');

    const verdict = () => {
      state = 'done';
      const alive = minN > 1 && minP > 1, close = Math.abs(s.N - target) / target <= 0.1, ns = model.nStar(a, m);
      if (alive && close) {
        ctx.say(`Both kinds survived and the hares settled near ${round2(s.N)}. At balance the lynx only just replace themselves, so the hares equal m ÷ (b·a) = ${round2(ns)}: a tougher or hungrier predator needs fewer prey to live on.${guessOk ? ' Your prediction was right too.' : ` Your prediction of ${Math.round(pred)} was not within 5 % of it.`}`);
        if (!done) { done = true; ctx.complete(guessOk ? 1 : 0.8, `Prey equilibrium ${round2(s.N)} near target ${target}, tries=${tries}.`); }
      } else if (!alive) {
        ctx.say(minP <= 1 ? `The lynx almost vanished. They need ${round2(ns)} hares just to replace themselves, and the meadow cannot give them that many for long. Raise a or lower m and try again.` : 'The hares almost vanished: the lynx caught them faster than they could breed. Change the rates and try again.');
      } else if (Math.abs(s.N - ns) / ns > 0.1) {
        ctx.say(`The hares ended at ${round2(s.N)}, but they had not settled yet: they were still heading for ${round2(ns)}. Pick rates whose m ÷ (b·a) is ${target}.`);
      } else {
        ctx.say(`The hares settled at ${round2(s.N)}, not near ${target}. That is the balance point m ÷ (b·a). ${s.N > target ? 'To bring it down, make the lynx better hunters (raise a) or longer-lived (lower m).' : 'To lift it, make the lynx weaker hunters (lower a) or shorter-lived (raise m).'}`);
      }
    };

    return {
      step(dt) {
        if (state !== 'run') return;
        acc += dt * (ctx.calm ? 20 : 6);                               // simulated years per second
        while (acc >= 0.2 && s.t < T_END - 1e-9) {
          for (let i = 0; i < 10; i++) model.step(s, a, m);
          acc -= 0.2; minN = Math.min(minN, s.N); minP = Math.min(minP, s.P);
          const y = Math.round(s.t); if (y > year && Math.abs(s.t - y) < 1e-6) { year = y; setBar(barsN, y, s.N, ZN); setBar(barsP, y, s.P, ZP); }
        }
        show();
        if (s.t >= T_END - 1e-9) verdict();
      },
      frame(dt, time = 0) {
        draw(hares, hareParts, figures(s.N, PER_N, NN), 1, 0.12, dt, time);
        draw(lynx, lynxParts, figures(s.P, PER_P, NP), 1, 0.03, dt, time);
        clockGlow.material.opacity = state === 'run' && !ctx.calm ? 0.6 + 0.3 * Math.sin(time * 6) : 0.6;
      },
      // Shows a successful run without the player (used by tests): finds slider settings whose balance point is the target.
      autoplay() {
        let best = null;
        for (let ai = 5; ai <= 30; ai++) for (let mi = 2; mi <= 16; mi++) {
          const A = ai / 1000, Mm = mi * 0.05, o = model.run(A, Mm);
          if (model.wins(o, target)) { const err = Math.abs(o.N - target); if (!best || err < best.err) best = { A, Mm, err }; }
        }
        if (!best) return;
        aS.set(best.A); mS.set(Math.round(best.Mm * 20) / 20); pS.set(Math.round(model.nStar(a, m)));
        run();
      },
      dispose() { for (const g of [ball, cone, box, barGeo]) g.dispose(); },
      get state() { return state; },
    };
  },
};
