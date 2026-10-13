// World 9 lab — Probability Lab in 3D: dice tumble (or a coin flips) in a tray, and a row of columns grows behind it,
// one for each outcome. Red bars mark what theory predicts; the target column must settle onto its bar.
// No imports: everything arrives through the context, so the file also runs in tools/test-game3d.mjs.

const NEED = 100, CLOSE = 0.02;

// ----- the model: three chance experiments with exact probabilities -----
const EXPS = {
  coin: { name: 'Coin', labels: ['T', 'H'], outs: [0, 1], p: [0.5, 0.5], roll: (rnd) => { const v = rnd() < 0.5 ? 1 : 0; return { out: v, faces: [v] }; } },
  die: { name: 'One die', labels: ['1', '2', '3', '4', '5', '6'], outs: [1, 2, 3, 4, 5, 6], p: [1, 1, 1, 1, 1, 1].map((x) => x / 6), roll: (rnd) => { const v = 1 + Math.min(5, Math.floor(rnd() * 6)); return { out: v, faces: [v] }; } },
  two: { name: 'Two dice (sum)', labels: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], outs: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], p: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((x) => x / 36),
    roll: (rnd) => { const a = 1 + Math.min(5, Math.floor(rnd() * 6)), b = 1 + Math.min(5, Math.floor(rnd() * 6)); return { out: a + b, faces: [a, b] }; } },
};
export const model = {
  EXPS, NEED, CLOSE,
  // One-standard-deviation wobble of a measured share after n trials.
  spread: (p, n) => Math.sqrt((p * (1 - p)) / n),
  reached: (count, n, p) => n >= NEED && Math.abs(count / n - p) <= CLOSE,
  // Counts the ways two dice make each sum by listing all 36 pairs.
  pairs() { const w = new Array(11).fill(0); for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) w[a + b - 2]++; return w; },
};

export function selfTest() {
  const near = (a, b, e = 1e-12) => Math.abs(a - b) < e;
  const sums = Object.values(EXPS).every((e) => near(e.p.reduce((s, x) => s + x, 0), 1) && e.p.length === e.outs.length && e.labels.length === e.outs.length);
  const pairs = model.pairs(), pairsOk = pairs.every((w, i) => near(w / 36, EXPS.two.p[i])) && pairs[5] === 6;
  let seed = 2024; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let worst = 0; const N = 60000;
  for (const e of Object.values(EXPS)) {
    const c = e.outs.map(() => 0); for (let i = 0; i < N; i++) c[e.outs.indexOf(e.roll(rnd).out)]++;
    e.p.forEach((p, i) => { worst = Math.max(worst, Math.abs(c[i] / N - p) / model.spread(p, N)); });
  }
  const sd = model.spread(1 / 6, 100);
  const ok = sums && pairsOk && near(sd, 0.0372678, 1e-6) && near(model.spread(0.5, 10000), 0.005) && worst < 4 && model.reached(18, 100, 1 / 6) && !model.reached(20, 100, 1 / 6) && !model.reached(9, 50, 1 / 6);
  return { ok, detail: `chances add to 1; 6 of 36 pairs make 7; spread for P = 1/6 after 100 rolls = ${sd.toFixed(4)}; ${N} trials of each experiment stay within ${worst.toFixed(2)} standard errors` };
}

export default {
  id: 'w09-probability-lab',
  world: 9,
  levels: [5, 6],
  title: 'Probability Lab',
  goal: 'Roll until the measured share of the target event is within 2 percentage points of its true probability, after at least 100 rolls.',
  kind: 'validated',
  model: 'Each trial is a fair coin, one fair die or the sum of two fair dice; the true chances are exact fractions (for two dice, the number of the 36 pairs that make each sum), and the model is checked by listing those pairs and by 60,000 trial runs. Random numbers come from a computer generator, so the dice are ideal and fair. The tumbling you see is a drawing of the last roll in each batch, not a physics calculation: the result is chosen first and the die turns to show it. The 1/√n spread shown is a one-standard-deviation estimate, not a guarantee for any single run.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level, rnd = ctx.rng || Math.random;
    const KMAX = 11, HMAX = 3.3, BASE = 0.5, CZ = -1.0, TZ = 1.25, HALF = 0.28, REST = 0.1 + HALF;
    const geos = [], keep = (g) => { geos.push(g); return g; };
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const label = (text, size, x, y, z) => { const s = ctx.sprite(text, { size, bg: 'rgba(70,30,100,0.85)' }); s.position.set(x, y, z); group.add(s); return s; };
    const drop = (s) => { if (!s) return; s.parent?.remove(s); s.material?.map?.dispose?.(); s.material?.dispose?.(); };

    // the plinth with one column, one theory bar and one label for each outcome
    add(keep(new THREE.BoxGeometry(7, BASE, 1.0)), ctx.mat('#b02a5b', { roughness: 0.6 }), 0, BASE / 2, CZ).receiveShadow = true;
    const colGeo = keep(new THREE.BoxGeometry(1, 1, 0.5)); colGeo.translate(0, 0.5, 0);
    const barGeo = keep(new THREE.BoxGeometry(1, 0.05, 0.7)), bandGeo = keep(new THREE.BoxGeometry(1, 1, 0.82)), whiskGeo = keep(new THREE.BoxGeometry(0.07, 1, 0.07));
    const plain = ctx.mat('#7048e8', { roughness: 0.45 }), gold = ctx.mat('#ff922b', { roughness: 0.4 }), red = ctx.lit('#e03131', 0.9);
    const cols = [], bars = [];
    for (let i = 0; i < KMAX; i++) { cols.push(add(colGeo, plain, 0, BASE, CZ)); bars.push(add(barGeo, red, 0, BASE, CZ)); }
    const band = add(bandGeo, ctx.mat('#51cf66', { transparent: true, opacity: 0.4, roughness: 0.3, depthWrite: false }), 0, BASE, CZ); band.castShadow = false;
    const whisker = add(whiskGeo, ctx.lit('#ffffff', 0.8), 0, BASE, CZ + 0.45);
    let outLabels = [], targetLabel = null, resultLabel = null;

    // the rolling tray, two dice and a coin
    add(keep(new THREE.BoxGeometry(2.9, 0.1, 1.7)), ctx.mat('#2f9e77', { roughness: 0.95 }), 0, 0.05, TZ).receiveShadow = true;
    const wallM = ctx.mat('#f76707', { roughness: 0.5 }), wallA = keep(new THREE.BoxGeometry(3.1, 0.28, 0.1)), wallB = keep(new THREE.BoxGeometry(0.1, 0.28, 1.7));
    add(wallA, wallM, 0, 0.14, TZ - 0.9); add(wallA, wallM, 0, 0.14, TZ + 0.9); add(wallB, wallM, -1.5, 0.14, TZ); add(wallB, wallM, 1.5, 0.14, TZ);
    const NORMAL = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0] };
    const SPOTS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] };
    const dieGeo = keep(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)), pipGeo = keep(new THREE.SphereGeometry(0.052, 10, 8)), UP = new THREE.Vector3(0, 1, 0);
    const makeDie = (pipColor, homeX) => {
      const m = add(dieGeo, ctx.mat('#fff4e6', { roughness: 0.35 }), homeX, REST, TZ), pips = new THREE.InstancedMesh(pipGeo, ctx.mat(pipColor, { roughness: 0.4 }), 21), M = new THREE.Matrix4();
      let c = 0;
      for (let v = 1; v <= 6; v++) {
        const nr = new THREE.Vector3(...NORMAL[v]), u = new THREE.Vector3(nr.y !== 0 ? 1 : 0, nr.y !== 0 ? 0 : 1, 0), w = new THREE.Vector3().crossVectors(nr, u);
        for (const [i, j] of SPOTS[v]) pips.setMatrixAt(c++, M.makeTranslation(nr.x * HALF + (u.x * i + w.x * j) * 0.15, nr.y * HALF + (u.y * i + w.y * j) * 0.15, nr.z * HALF + (u.z * i + w.z * j) * 0.15));
      }
      pips.instanceMatrix.needsUpdate = true; m.add(pips);
      return { m, homeX, side: Math.sign(homeX) || 1, qEnd: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0), turns: 10, coin: false };
    };
    const dice = [makeDie('#d6336c', -0.5), makeDie('#5f3dc4', 0.5)];
    const coinGeo = keep(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 32));
    const coinMesh = add(coinGeo, [ctx.mat('#e8a400', { roughness: 0.3, metalness: 0.5 }), ctx.mat('#ffe066', { roughness: 0.3, metalness: 0.4 }), ctx.mat('#ced4da', { roughness: 0.3, metalness: 0.5 })], 0, 0.14, TZ);
    add(keep(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20)), ctx.mat('#f76707', { roughness: 0.4 }), 0, 0.05, 0, coinMesh);            // heads: a raised disc
    add(keep(new THREE.BoxGeometry(0.5, 0.04, 0.14)), ctx.mat('#5f3dc4', { roughness: 0.4 }), 0, -0.05, 0, coinMesh);                    // tails: a raised bar
    const coin = { m: coinMesh, homeX: 0, side: 1, qEnd: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0), turns: 14, coin: true };
    const qSpin = new THREE.Quaternion(), qYaw = new THREE.Quaternion(), XAXIS = new THREE.Vector3(1, 0, 0);

    let key = L >= 6 ? 'two' : 'die', counts = [], n = 0, target = 0, done = false, guessErr = null, guessTouched = false, guessLocked = false, batch = null, auto = false, autoT = 0, dx = 0.6, tumble = 1;
    const shown = new Array(KMAX).fill(0);
    const rTarget = ui.readout('Target event'), rN = ui.readout('Rolls n'), rF = ui.readout('Measured share'), rP = ui.readout('True chance P'), rS = ui.readout('Typical wobble ±√(p(1−p)/n)');
    const E = () => EXPS[key], P = () => E().p[target], pct = (v) => `${(v * 100).toFixed(1)} %`;
    const maxv = () => Math.max(...E().p, ...counts.map((c) => (n ? c / n : 0))) * 1.15 || 1;
    const actors = () => (key === 'coin' ? [coin] : key === 'die' ? [dice[0]] : dice);

    const pose = (a, u) => {
      const k = (1 - u) * (1 - u), rest = a.coin ? 0.14 : REST;
      a.m.position.set(a.homeX * (key === 'two' ? 1 : 0) + a.side * 0.7 * k, rest + 1.5 * (1 - u) * Math.abs(Math.sin(u * Math.PI * 3)), TZ);
      a.m.quaternion.copy(qSpin.setFromAxisAngle(a.axis, a.turns * k)).multiply(a.qEnd);
    };
    // Turns each die (or the coin) so that it will come to rest showing this trial.
    const aim = (trial) => {
      actors().forEach((a, i) => {
        const v = trial.faces[i];
        if (a.coin) { a.qEnd.setFromAxisAngle(XAXIS, v === 1 ? 0 : Math.PI); a.axis.set(1, 0, 0); a.turns = Math.PI * 6; }
        else { a.qEnd.setFromUnitVectors(new THREE.Vector3(...NORMAL[v]), UP).premultiply(qYaw.setFromAxisAngle(UP, (rnd() - 0.5) * 0.9)); a.axis.set(rnd() - 0.5, rnd() * 0.4, rnd() - 0.5).normalize(); a.turns = 9 + rnd() * 5; }
      });
    };
    const readouts = () => {
      const f = n ? counts[target] / n : NaN;
      rN.set(String(n)); rF.set(n ? f.toFixed(3) : '–'); rP.set(P().toFixed(3)); rS.set(n ? model.spread(P(), n).toFixed(3) : '–');
    };
    const tally = (trial) => { counts[E().outs.indexOf(trial.out)]++; n++; };
    const showResult = (trial) => {
      drop(resultLabel);
      resultLabel = label(key === 'coin' ? (trial.out ? 'H (heads)' : 'T (tails)') : key === 'die' ? String(trial.out) : `${trial.faces[0]} + ${trial.faces[1]} = ${trial.out}`, 0.42, 0, 1.75, TZ);
    };
    const judge = () => {
      const p = P(), f = counts[target] / n, sd = model.spread(p, n), name = `${E().name} = ${E().labels[target]}`;
      if (!done && model.reached(counts[target], n, p)) {
        done = true; auto = false;
        ctx.say(`After ${n} rolls the measured share of "${name}" is ${pct(f)} and the true chance is ${pct(p)}. That is the law of large numbers: the more trials, the closer the measured share tends to sit to the true probability. The wobble shrinks like 1 over the square root of n, so 4 times as many rolls halve it.`);
        ctx.complete(guessErr !== null && guessErr <= 0.15 ? 1 : 0.8, `n = ${n}, frequency ${f.toFixed(2)} vs P = ${p.toFixed(2)}`);
      } else if (!done) {
        ctx.say(n < NEED ? `${n} ${n === 1 ? 'roll' : 'rolls'} so far: "${name}" came up ${counts[target]} ${counts[target] === 1 ? 'time' : 'times'} (${pct(f)}). With so few rolls, luck swings the share a lot: the typical wobble is still ±${pct(sd)}. Roll at least ${NEED} times.`
          : `After ${n} rolls the measured share is ${pct(f)} and the true chance is ${pct(p)}: ${(Math.abs(f - p) * 100).toFixed(1)} points apart. The typical wobble at ${n} rolls is ±${pct(sd)}. More rolls even out the lucky and unlucky streaks, so keep rolling.`);
      }
    };
    const finish = () => {
      if (!batch) return;
      const b = batch; batch = null;
      for (let i = 0; i < b.left; i++) tally(E().roll(rnd));
      tally(b.last); tumble = 1; actors().forEach((a) => pose(a, 1)); showResult(b.last); readouts(); judge();
    };
    const roll = (m) => {
      if (batch) finish();
      if (!guessLocked) { guessLocked = true; if (!guessTouched) guessErr = null; }
      const last = E().roll(rnd);
      batch = { left: m - 1, total: m, t: 0, T: ctx.calm ? 0.05 : m === 1 ? 0.9 : m <= 10 ? 1.2 : m <= 100 ? 1.6 : 2.2, last };
      aim(last); tumble = 0; drop(resultLabel); resultLabel = null;
    };
    const reset = () => {
      batch = null; const e = E(), k = e.outs.length;
      counts = e.outs.map(() => 0); n = 0; done = false; guessErr = null; guessTouched = false; guessLocked = false; tumble = 1;
      target = key === 'two' ? 3 + Math.min(4, Math.floor(rnd() * 5)) : Math.min(k - 1, Math.floor(rnd() * k));
      dx = Math.min(0.9, 6.5 / k);
      for (const s of outLabels) drop(s); outLabels = []; drop(targetLabel); drop(resultLabel); resultLabel = null;
      const top = maxv();
      for (let i = 0; i < KMAX; i++) {
        const on = i < k, x = (i - (k - 1) / 2) * dx; cols[i].visible = false; bars[i].visible = on; shown[i] = 0;
        if (!on) continue;
        cols[i].position.x = x; cols[i].scale.set(dx * 0.72, 0.001, 1); cols[i].material = i === target ? gold : plain;
        bars[i].position.set(x, BASE + e.p[i] / top * HMAX, CZ); bars[i].scale.x = dx * 0.94;
        outLabels.push(label(e.labels[i], 0.3, x, BASE / 2, CZ + 0.56));
      }
      targetLabel = label(`Target: ${e.name} = ${e.labels[target]}`, 0.44, 0, 4.75, CZ);
      rTarget.set(`${e.name} = ${e.labels[target]}`);
      coin.m.visible = key === 'coin'; dice[0].m.visible = key !== 'coin'; dice[1].m.visible = key === 'two';
      aim(key === 'coin' ? { faces: [1] } : { faces: [1, 1] }); actors().forEach((a) => pose(a, 1));
      readouts();
    };

    ui.choice([['coin', 'Coin'], ['die', 'One die'], ['two', 'Two dice (sum)']], key, (v) => { if (!EXPS[v]) return; key = v; auto = false; reset(); ctx.say(`A new experiment: ${EXPS[v].name}. Guess the chance of the target, then roll.`); });
    ui.slider({ label: 'Guess first: the chance of the target', min: 0, max: 1, step: 0.01, value: 0.5, unit: '', onInput: (v) => { if (guessLocked) { ctx.say('Your guess was locked at the first roll. Press Reset to guess again.'); return; } guessErr = Math.abs(v - P()); guessTouched = true; } });
    ui.button('🎲 Roll 1', () => roll(1), 'btn'); ui.button('Roll 10', () => roll(10)); ui.button('Roll 100', () => roll(100)); ui.button('Roll 1000', () => roll(1000));
    ui.button('Reset', () => { auto = false; reset(); ctx.say('Everything is cleared and there is a new target. Guess its chance, then roll.'); });
    ui.note('Each column is the share of rolls that gave that result. The red bar is what theory predicts. The green band on the target is the goal (within 2 points), and the white rod shows the typical wobble, which shrinks as you roll more.');

    reset();
    ctx.say('Before rolling, guess the probability. Two dice make a sum of 7 most often because 6 of the 36 pairs add to 7.');

    return {
      step(dt) {
        if (batch) {
          batch.t += dt;
          const others = batch.total - 1, want = Math.floor(others * Math.min(1, batch.t / (batch.T * 0.8))), now = want - (others - batch.left);
          for (let i = 0; i < now; i++) tally(E().roll(rnd));
          batch.left -= Math.max(0, now); if (now > 0) readouts();
          tumble = Math.min(1, batch.t / batch.T);
          if (batch.t >= batch.T) finish();
        } else if (auto && !done) { autoT -= dt; if (autoT <= 0) { roll(n < NEED ? 100 : 1000); autoT = 0.3; } }
      },
      frame(dt) {
        const e = E(), k = e.outs.length, top = maxv(), ease = ctx.calm ? 1 : Math.min(1, dt * 7);
        for (let i = 0; i < k; i++) {
          const to = n ? counts[i] / n / top * HMAX : 0; shown[i] += (to - shown[i]) * ease;
          cols[i].visible = shown[i] > 0.004; cols[i].scale.y = Math.max(0.001, shown[i]);
          const by = BASE + e.p[i] / top * HMAX; bars[i].position.y += (by - bars[i].position.y) * ease;
        }
        const x = (target - (k - 1) / 2) * dx, py = bars[target].position.y, unit = HMAX / top;
        band.position.set(x, py, CZ); band.scale.set(dx * 0.98, 2 * CLOSE * unit, 1);
        const sd = n ? model.spread(P(), n) : 0; whisker.visible = n > 0; whisker.position.set(x + dx * 0.36, py, CZ + 0.45); whisker.scale.y = Math.max(0.02, Math.min(HMAX * 2, 2 * sd * unit));
        if (batch) for (const a of actors()) pose(a, tumble);
      },
      // Presses the roll buttons' own handler again and again until the measured share has settled.
      autoplay() { if (done) reset(); auto = true; autoT = 0; },
      dispose() { batch = null; auto = false; for (const g of geos) g.dispose(); for (const s of outLabels) drop(s); drop(targetLabel); drop(resultLabel); },
    };
  },
};
