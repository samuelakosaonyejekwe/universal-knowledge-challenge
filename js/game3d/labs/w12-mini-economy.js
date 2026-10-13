// 3D lab — Mini Economy: a little town whose shops, workers and price tags respond to the interest rate the
// player sets each quarter, with two big dials for inflation and unemployment. No imports: all through ctx.

// ----- the model: a textbook IS curve, Phillips curve and Okun's law with round made-up coefficients -----
const Q = 12, PI_T = 2, U_T = 5;
export const model = {
  quarters: Q, inflationGoal: PI_T, unemploymentGoal: U_T,
  unemployment: (y) => U_T - 0.5 * y,                                        // Okun's law (simplified)
  // One quarter: output gap y′ = 0.8y − 0.5(r − π − 2) + shock; inflation π′ = 0.6π + 0.8 + 0.3y′ + shock.
  next(y, pi, r, e = 0, s = 0) { const y2 = 0.8 * y - 0.5 * (r - pi - 2) + e, pi2 = Math.max(-2, 0.6 * pi + 0.4 * PI_T + 0.3 * y2 + s); return { y: y2, pi: pi2, u: U_T - 0.5 * y2 }; },
  // The rate that would bring the output gap to zero next quarter (before any surprise).
  steady: (y, pi) => pi + 2 + 1.6 * y,
  // Average misses over twelve quarters for a rule r(y, π), with no surprises.
  run(y, pi, rule) { let ePi = 0, eU = 0; for (let i = 0; i < Q; i++) { const n = this.next(y, pi, rule(y, pi)); y = n.y; pi = n.pi; ePi += Math.abs(pi - PI_T) / Q; eU += Math.abs(n.u - U_T) / Q; } return { ePi, eU }; },
};
const clampRate = (r) => Math.max(0, Math.min(10, Math.round(r * 4) / 4));
export function selfTest() {
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  const rest = model.next(0, 2, 4), hot = model.next(2, 4.5, 3), cool = model.next(2, 4.5, 9.7), slump = model.next(-2.5, 1, 0);
  const rule = (y, pi) => clampRate(model.steady(y, pi));
  const a = model.run(2, 4.5, rule), b = model.run(-2.5, 1, rule), c = model.run(0, 3.5, rule), lazy = model.run(2, 4.5, () => 0);
  const ok = near(rest.y, 0) && near(rest.pi, 2) && near(rest.u, 5) && near(hot.y, 3.35) && near(hot.pi, 4.505) && near(hot.u, 3.325)
    && near(cool.y, 0) && near(cool.pi, 3.5) && near(cool.u, 5) && near(slump.y, -0.5) && near(slump.pi, 1.25) && near(slump.u, 5.25)
    && near(model.steady(2, 4.5), 9.7) && near(model.steady(0, 2), 4)
    && a.ePi < 1 && a.eU < 1 && b.ePi < 1 && b.eU < 1 && c.ePi < 1 && c.eU < 1 && lazy.ePi > 1 && lazy.eU > 1;
  return { ok, detail: `rate 4 at the goals stays put (gap ${rest.y}, inflation ${rest.pi} %, unemployment ${rest.u} %); overheating at rate 3: gap ${hot.y.toFixed(2)}, inflation ${hot.pi.toFixed(3)} %, unemployment ${hot.u.toFixed(3)} %; at rate 9.7: gap ${cool.y.toFixed(2)}, inflation ${cool.pi.toFixed(1)} %; slump at rate 0: inflation ${slump.pi} %, unemployment ${slump.u} %; steady rule misses ${a.ePi.toFixed(2)}/${a.eU.toFixed(2)}, ${b.ePi.toFixed(2)}/${b.eU.toFixed(2)}, ${c.ePi.toFixed(2)}/${c.eU.toFixed(2)}; rate 0 all year from overheating misses ${lazy.ePi.toFixed(1)}/${lazy.eU.toFixed(1)}` };
}

const SCENARIOS = [
  { name: 'Overheating: prices are rising fast', y: 2, pi: 4.5 },
  { name: 'Slump: demand is weak', y: -2.5, pi: 1 },
  { name: 'Supply shock: costs jump but demand is average', y: 0, pi: 3.5 },
];
const f2 = (v) => v.toFixed(2), f1 = (v) => v.toFixed(1);

export default {
  id: 'w12-mini-economy',
  world: 12,
  levels: [5, 6],
  title: 'Mini Economy',
  goal: 'Set the interest rate each quarter to keep inflation near 2% and unemployment near 5% for three years.',
  kind: 'validated',
  model: 'A deliberately simplified textbook model (an IS curve, a Phillips curve and Okun\'s law) with made-up round coefficients: output gap y′ = 0.8y − 0.5(r − π − 2) + shock; inflation π′ = 0.6π + 0.8 + 0.3y′ + shock; unemployment u = 5 − 0.5y. The sums are checked by hand-worked values. It has no government budget, trade, exchange rates or expectations that change, and it shows trade-offs rather than the right policy. Real central banks weigh many more things. It is for learning, not a forecast or advice.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level;
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const label = (text, size, x, y, z) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); group.add(s); return s; };
    const noise = () => ctx.rng() - 0.5;
    const sc = SCENARIOS[Math.floor(ctx.rng() * (L >= 6 ? 3 : 2))];      // the supply shock is kept for the top level

    // ----- four shops with floating price tags -----
    const SHOPX = [-2.7, -0.9, 0.9, 2.7], shopCol = ['#e8590c', '#7048e8', '#2f9e44', '#d6336c'];
    const bodyGeo = new THREE.BoxGeometry(1.2, 1.1, 0.9), roofGeo = new THREE.ConeGeometry(0.95, 0.5, 4), tagGeo = new THREE.BoxGeometry(0.55, 0.34, 0.1), tagMat = ctx.lit('#ffd43b', 0.8);
    const shops = SHOPX.map((x, i) => {
      const g = new THREE.Group(); g.position.set(x, 0, -1.6); group.add(g);
      add(bodyGeo, ctx.mat(shopCol[i]), 0, 0.55, 0, g); const roof = add(roofGeo, ctx.mat('#0f3d4a'), 0, 1.35, 0, g); roof.rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(0.34, 0.6, 0.06), ctx.mat('#fff3bf'), 0, 0.3, 0.46, g);
      return { g, tag: add(tagGeo, tagMat, x, 2.2, -1.5) };
    });
    label('Price tags', 0.24, -2.7, 0.4, -0.95);

    // ----- two dials: 0 on the left, 10 on the right, a green arc one point either side of the goal -----
    const ang = (v) => (0.5 - Math.max(0, Math.min(10, v)) / 10) * (Math.PI * 4 / 3);
    const dial = (x, color, goal, title) => {
      const g = new THREE.Group(); g.position.set(x, 4.1, -2.1); group.add(g);
      const face = add(new THREE.CylinderGeometry(0.78, 0.78, 0.14, 32), ctx.mat('#e9f7f9'), 0, 0, 0, g); face.rotation.x = Math.PI / 2;
      const zone = add(new THREE.TorusGeometry(0.62, 0.06, 6, 14, ang(goal - 1) - ang(goal + 1)), ctx.lit('#2f9e44', 0.9), 0, 0, 0.1, g); zone.rotation.z = Math.PI / 2 + ang(goal + 1);
      const pivot = new THREE.Group(); pivot.position.z = 0.14; g.add(pivot);
      add(new THREE.BoxGeometry(0.08, 0.66, 0.06), ctx.lit(color, 0.7), 0, 0.3, 0, pivot); add(new THREE.SphereGeometry(0.1, 12, 10), ctx.mat('#0f3d4a'), 0, 0, 0, pivot);
      label(title, 0.3, x, 5.1, -2.1); label('0', 0.2, x - 0.85, 3.55, -2.0); label('10', 0.2, x + 0.85, 3.55, -2.0);
      return pivot;
    };
    const needlePi = dial(-1.8, '#d9485f', PI_T, 'Inflation %, goal 2'), needleU = dial(1.8, '#5b6cff', U_T, 'Unemployment %, goal 5');

    // ----- the town bank with its interest-rate column -----
    const bank = add(new THREE.BoxGeometry(1.3, 0.8, 0.9), ctx.mat('#f4f1ea'), 0, 0.4, 0.4);
    const pediment = add(new THREE.ConeGeometry(0.95, 0.4, 4), ctx.mat('#3bc9db'), 0, 1.0, 0.4); pediment.rotation.y = Math.PI / 4;
    const tube = add(new THREE.CylinderGeometry(0.2, 0.2, 2.0, 14), ctx.mat('#cfeef5', { transparent: true, opacity: 0.28, depthWrite: false }), 0, 2.2, 0.4); tube.castShadow = false;
    const rateFill = add(new THREE.CylinderGeometry(0.15, 0.15, 1, 12), ctx.lit('#f08c00', 0.9), 0, 1.2, 0.4);
    label('Interest rate', 0.24, 0, 3.4, 0.4);

    // ----- ten workers: each one waiting on the left stands for one in a hundred without a job -----
    const wBody = new THREE.CapsuleGeometry(0.14, 0.3, 4, 10), wHead = new THREE.SphereGeometry(0.13, 12, 10), skins = ['#f1c9a5', '#c68a5b', '#8d5a3b', '#e3b08a'], coats = ['#1c7ed6', '#f08c00', '#0ca678', '#d6336c', '#7048e8'];
    add(new THREE.BoxGeometry(2.3, 0.1, 1.3), ctx.mat('#48606a'), -2.35, 0.05, 1.75);
    const workers = Array.from({ length: 10 }, (_, i) => {
      const g = new THREE.Group(), idle = new THREE.Vector3(-3.2 + (i % 5) * 0.42, 0.1, 1.5 + Math.floor(i / 5) * 0.5), work = new THREE.Vector3(SHOPX[i % 4] + (Math.floor(i / 4) - 1) * 0.34, 0, -0.75 + Math.floor(i / 4) * 0.12);
      g.position.copy(work); group.add(g); add(wBody, ctx.mat(coats[i % coats.length]), 0, 0.32, 0, g); add(wHead, ctx.mat(skins[i % skins.length]), 0, 0.76, 0, g);
      return { g, idle, work, out: false };
    });
    label('Looking for work', 0.24, -2.35, 1.5, 1.75);

    // ----- a small bar chart that grows one pair of bars each quarter -----
    const HX = 0.95, HZ = 1.9, HS = 0.16, barGeo = new THREE.BoxGeometry(0.11, 1, 0.11), dummy = new THREE.Object3D();
    const barsPi = new THREE.InstancedMesh(barGeo, ctx.lit('#d9485f', 0.5), Q), barsU = new THREE.InstancedMesh(barGeo, ctx.lit('#5b6cff', 0.5), Q);
    for (const b of [barsPi, barsU]) { b.frustumCulled = false; group.add(b); }
    add(new THREE.BoxGeometry(2.6, 0.06, 0.5), ctx.mat('#0f3d4a'), HX + 1.15, 0.03, HZ + 0.07);
    add(new THREE.BoxGeometry(2.6, 0.025, 0.025), ctx.lit('#d9485f', 1.0), HX + 1.15, 0.06 + PI_T * HS, HZ).castShadow = false;
    add(new THREE.BoxGeometry(2.6, 0.025, 0.025), ctx.lit('#5b6cff', 1.0), HX + 1.15, 0.06 + U_T * HS, HZ + 0.14).castShadow = false;
    label('Quarters 1 to 12', 0.22, HX + 1.15, 1.9, HZ);

    let y = sc.y, pi = sc.pi, q = 0, hist = [], shocks = [], guess = 0, hits = 0, asked = 0, done = false, rate = 3, auto = false, autoT = 0, over = false;
    let vPi = pi, vU = model.unemployment(y), vY = y, vR = rate;
    const rQ = ui.readout('Quarter'), rP = ui.readout('Inflation, %'), rU = ui.readout('Unemployment, %'), rY = ui.readout('Output gap, %'), rR = ui.readout('Real rate, %');
    const bars = () => {
      for (let i = 0; i < Q; i++) for (const [mesh, key, dz] of [[barsPi, 'pi', 0], [barsU, 'u', 0.14]]) {
        const h = i + 1 < hist.length ? Math.max(0.02, Math.min(10, hist[i + 1][key]) * HS) : 0.0001;
        dummy.position.set(HX + i * 0.21, 0.06 + h / 2, HZ + dz); dummy.scale.set(h > 0.001 ? 1 : 0.0001, h, h > 0.001 ? 1 : 0.0001); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.instanceMatrix.needsUpdate = true;
      }
    };
    const show = () => {
      const p = hist[hist.length - 1];
      rQ.set(`${q} / ${Q}`); rP.set(f2(p.pi)); rU.set(f2(p.u)); rY.set(f2(y)); rR.set(f2(rate - pi));
      const out = Math.max(0, Math.min(10, Math.round(p.u))); workers.forEach((w, i) => { w.out = i < out; });
      bars();
    };
    const reset = () => {
      y = sc.y; pi = sc.pi; q = 0; hist = [{ pi, u: model.unemployment(y) }]; done = false; over = false; hits = 0; asked = 0;
      shocks = Array.from({ length: Q }, () => ({ e: noise() * 1.0, s: noise() * 0.6 }));
      show();
      ctx.say(`Start: ${sc.name}. Inflation is ${f1(pi)} % and unemployment is ${f1(model.unemployment(y))} %. Raising the rate cools demand and lowers inflation, but can raise unemployment. Lowering it does the opposite.`);
    };
    const finish = () => {
      const ePi = hist.slice(1).reduce((a, p) => a + Math.abs(p.pi - PI_T), 0) / Q, eU = hist.slice(1).reduce((a, p) => a + Math.abs(p.u - U_T), 0) / Q, ok = ePi <= 1 && eU <= 1;
      over = true;
      const sum = `Three years are over. Average miss: inflation ${f2(ePi)} points, unemployment ${f2(eU)} points.`;
      if (!ok) return ctx.say(`${sum} Both must stay within 1 point. Pulling one goal closer can push the other away: restart and try steering earlier.`);
      if (done) return;
      done = true;
      ctx.say(`${sum} Both goals were kept close! You guessed the direction of inflation right ${hits} times out of ${asked}. Policy works with delays: today's rate changes spending over the next few quarters, so steering early beats reacting late.`);
      ctx.complete(Math.min(1, 0.6 + 0.4 * (asked ? hits / asked : 0)), `Avg inflation miss ${f2(ePi)}, unemployment miss ${f2(eU)}.`);
    };
    const advance = () => {
      if (q >= Q) return ctx.say('The three years are over. Press Restart to try again.');
      const sk = shocks[q], piOld = pi, n = model.next(y, pi, rate, sk.e, sk.s);
      y = n.y; pi = n.pi; q++;
      const d = pi - piOld, dir = Math.abs(d) < 0.15 ? 0 : d > 0 ? 1 : -1, right = dir === guess;
      asked++; if (right) hits++;
      hist.push({ pi, u: n.u }); show();
      const real = rate - pi, why = real > 2.5 ? 'A high real rate squeezes spending: borrowing costs more, so shops sell less, prices rise more slowly and fewer workers are needed.'
        : real < 1.5 ? 'A low real rate encourages spending: borrowing is cheap, so shops get busy, hire more workers and can raise prices faster.'
          : 'The real rate is close to neutral, so spending neither speeds up nor slows down much.';
      ctx.say(`Quarter ${q}: inflation went ${dir === 0 ? 'about the same' : dir > 0 ? 'up' : 'down'} (${d >= 0 ? '+' : ''}${f2(d)} points) to ${f1(pi)} %, and unemployment is ${f1(n.u)} %. ${right ? 'You predicted that.' : 'That was not your prediction.'} ${why}`);
      if (q === Q) finish();
    };
    const rateS = ui.slider({ label: 'Interest rate this quarter', min: 0, max: 10, step: 0.25, value: rate, unit: '%', onInput: (v) => { rate = clampRate(v); rR.set(f2(rate - pi)); } });
    ui.note('Predict next quarter\'s inflation. Your choice stays until you change it.');
    const guessC = ui.choice([[1, 'higher'], [0, 'about the same'], [-1, 'lower']], 0, (v) => { guess = v; });
    ui.button('⏩ Advance one quarter', advance, 'btn gold'); ui.button('Restart', () => { auto = false; reset(); }, 'btn ghost sm');
    ui.note('Each figure waiting on the left stands for 1 worker in 100 without a job. The higher the price tags float, the faster prices are rising. Tall, busy shops mean spending is above normal.');
    ctx.onTap?.(bank, advance); ctx.onTap?.(pediment, advance);
    reset();

    return {
      step(dt) {
        if (!auto || done) return;
        autoT -= dt; if (autoT > 0) return; autoT = ctx.calm ? 0.15 : 0.45;
        if (over) return reset();
        rate = clampRate(model.steady(y, pi)); rateS.set(rate);
        const d = model.next(y, pi, rate).pi - pi; guess = Math.abs(d) < 0.15 ? 0 : d > 0 ? 1 : -1; guessC.set?.(guess);
        advance();
      },
      frame(dt, time) {
        const k = Math.min(1, dt * 3), p = hist[hist.length - 1];
        vPi += (p.pi - vPi) * k; vU += (p.u - vU) * k; vY += (y - vY) * k; vR += (rate - vR) * k;
        needlePi.rotation.z = ang(vPi); needleU.rotation.z = ang(vU);
        rateFill.scale.y = Math.max(0.02, vR / 10 * 2); rateFill.position.y = 1.2 + rateFill.scale.y / 2;
        shops.forEach((s, i) => {
          s.g.scale.y = 1 + Math.max(-3, Math.min(3, vY)) * 0.1;
          s.tag.position.y = 2.0 + Math.max(-2, Math.min(9, vPi)) * 0.17 + Math.sin(time * 2 + i) * 0.04; s.tag.rotation.y += dt * (0.3 + Math.max(0, vPi) * 0.35);
        });
        workers.forEach((w, i) => {
          const to = w.out ? w.idle : w.work, gp = w.g.position, dx = to.x - gp.x, dz = to.z - gp.z, dist = Math.hypot(dx, dz), stepLen = Math.min(dist, dt * 2.6);
          if (dist > 0.01) { gp.x += dx / dist * stepLen; gp.z += dz / dist * stepLen; }
          const moving = dist > 0.05; gp.y = to.y + (moving ? Math.abs(Math.sin(time * 10 + i)) * 0.1 : w.out ? 0 : Math.abs(Math.sin(time * (3 + vY * 0.4) + i)) * 0.07);
          w.g.rotation.x = !moving && w.out ? 0.22 : 0;          // those without work stand with drooping shoulders
        });
      },
      autoplay() { auto = true; autoT = 0; if (q > 0) reset(); },
      dispose() { auto = false; },
    };
  },
};
