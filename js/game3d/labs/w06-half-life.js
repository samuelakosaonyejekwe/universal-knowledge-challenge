// Half-Life Sampler in 3D: a tray of 100 glowing atoms that wink out by chance, a clock dial, and a row of bars
// that records how many are left after every step. No imports: everything arrives through the context.

const N0 = 100;
const HALF_LIVES = [1, 2, 5, 10];            // made-up isotope half-lives, in days
const MAX_STEPS = 8;                         // bars after the starting one

export const model = {
  N0,
  left: (k) => N0 * Math.pow(0.5, k),                       // N = N0 · (1/2)^(t/T), with k = t/T
  chance: (part) => 1 - Math.pow(0.5, part),                // chance that one atom decays during `part` half-lives
  // One step of time for a list of atoms: each one decays, or not, by its own chance.
  advance(alive, part, rng) { const p = model.chance(part); let n = 0; for (let i = 0; i < alive.length; i++) if (alive[i]) { if (rng() < p) alive[i] = false; else n++; } return n; },
  error: (guess, k) => Math.min(1, Math.abs(guess - model.left(k)) / model.left(k)),
};
// Used by the automated tests: the formula by hand, and the average of many random trays against the formula.
export function selfTest() {
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let sum = 0; const runs = 400;
  for (let r = 0; r < runs; r++) { const a = Array(N0).fill(true); let n = N0; for (let s = 0; s < 3; s++) n = model.advance(a, 1, rnd); sum += n; }
  const mean = sum / runs, half = model.chance(0.5);
  const ok = model.left(0) === 100 && model.left(1) === 50 && model.left(2) === 25 && model.left(3) === 12.5 && model.left(4) === 6.25
    && Math.abs(model.left(2.5) - 17.6777) < 1e-3 && Math.abs(half - 0.292893) < 1e-6 && Math.abs((1 - half) * (1 - half) - 0.5) < 1e-12
    && model.chance(1) === 0.5 && Math.abs(mean - 12.5) < 0.6 && model.error(25, 2) === 0 && Math.abs(model.error(10, 3) - 0.2) < 1e-12;
  return { ok, detail: `after 2, 3, 4 half-lives: ${model.left(2)}, ${model.left(3)}, ${model.left(4)} of 100; chance in half a half-life ${half.toFixed(4)}; average of ${runs} random trays after 3 half-lives ${mean.toFixed(2)} (formula 12.5)` };
}

const fmt = (v) => String(+v.toPrecision(3));

export default {
  id: 'w06-half-life',
  world: 6,
  levels: [3, 4],
  title: 'Half-Life Sampler',
  goal: 'Predict how many atoms are left after some half-lives, then run time forward and check.',
  kind: 'validated',
  model: 'Each of the 100 atoms decays at random with the chance given by N = N₀·(½)^(t/T), so a small sample only follows the formula on average. Real samples have trillions of atoms and so follow the curve very smoothly. The isotope is made up. This is a conceptual model, not about handling any real material.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rng = ctx.rng || Math.random;
    const level = Math.max(3, Math.min(4, Math.round(ctx.level || 3)));
    const T = HALF_LIVES[Math.floor(rng() * 4)];
    const targetK = (level <= 3 ? 2 : 3) + Math.floor(rng() * 2);       // 2 or 3 half-lives, then 3 or 4
    const truth = model.left(targetK);
    const white = ctx.mat('#f2f6fc', { roughness: 0.5 }), steel = ctx.mat('#8d9bb8', { metalness: 0.5, roughness: 0.35 }), dark = ctx.mat('#39406b', { roughness: 0.5 });
    const gold = ctx.lit('#f5b700', 1.3), dull = ctx.mat('#c9cfde', { roughness: 0.8 }), cyan = ctx.lit('#6fe8ff', 1.0), violet = ctx.lit('#c95be0', 1.3);
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

    // the tray: a tilted board with 100 hollows, one atom in each
    const tray = new THREE.Group(); tray.position.set(-1.75, 2.0, -0.2); tray.rotation.x = -0.5; group.add(tray);
    add(new THREE.BoxGeometry(3.3, 3.3, 0.14), dark, 0, 0, -0.07, tray);
    add(new THREE.BoxGeometry(3.5, 0.12, 0.4), steel, 0, -1.71, 0.06, tray); add(new THREE.BoxGeometry(3.5, 0.12, 0.4), steel, 0, 1.71, 0.06, tray);
    add(new THREE.BoxGeometry(0.12, 3.3, 0.4), steel, -1.71, 0, 0.06, tray); add(new THREE.BoxGeometry(0.12, 3.3, 0.4), steel, 1.71, 0, 0.06, tray);
    add(new THREE.BoxGeometry(0.16, 3.2, 0.16), steel, -0.5, 1.6, -1.1); add(new THREE.BoxGeometry(0.16, 3.2, 0.16), steel, -3.0, 1.6, -1.1);
    const geoAtom = new THREE.SphereGeometry(0.115, 14, 10);
    const bright = new THREE.InstancedMesh(geoAtom, gold, N0), spent = new THREE.InstancedMesh(geoAtom, dull, N0);
    bright.frustumCulled = false; spent.frustumCulled = false; tray.add(bright); tray.add(spent);
    const halo = ctx.glow('#f5b700', 4.2, 0.35); halo.position.set(0, 0, 0.3); tray.add(halo);

    // the bars: one for the start and one for every step of time, with a blue plate where the formula says it should end
    const BX = 0.5, GAP = 0.36, BY = 0.3, UNIT = 0.03;
    add(new THREE.BoxGeometry(3.4, 0.3, 1.0), white, BX + GAP * 4, 0.15, 0.3);
    const geoBar = new THREE.BoxGeometry(0.24, 1, 0.5); geoBar.translate(0, 0.5, 0);
    const bars = [], marks = [];
    for (let j = 0; j <= MAX_STEPS; j++) {
      const b = add(geoBar, gold, BX + GAP * j, BY, 0.3); b.scale.y = 0.001; b.visible = false; bars.push(b);
      const m = add(new THREE.BoxGeometry(0.32, 0.03, 0.62), cyan, BX + GAP * j, BY, 0.3); m.visible = false; marks.push(m);
    }
    for (const v of [100, 50, 25]) { const s = ctx.sprite(String(v), { size: 0.24 }); s.position.set(BX - 0.42, BY + v * UNIT, 0.3); group.add(s); add(new THREE.BoxGeometry(3.3, 0.012, 0.02), steel, BX + GAP * 4, BY + v * UNIT, 0); }
    const guessLine = add(new THREE.BoxGeometry(3.4, 0.035, 0.06), violet, BX + GAP * 4, BY, 0.62); guessLine.visible = false;

    // the clock: the hand goes round once for every half-life
    const DIAL = new THREE.Vector3(BX + GAP * 4, 4.25, 0.3);
    const face = add(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32), white, DIAL.x, DIAL.y, DIAL.z); face.rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(0.5, 0.05, 8, 36), steel, DIAL.x, DIAL.y, DIAL.z + 0.05);
    const hand = new THREE.Group(); hand.position.set(DIAL.x, DIAL.y, DIAL.z + 0.08); group.add(hand);
    add(new THREE.BoxGeometry(0.06, 0.4, 0.03), violet, 0, 0.2, 0, hand); add(new THREE.SphereGeometry(0.06, 10, 8), steel, 0, 0, 0, hand);
    const lab = ctx.sprite(`Half-life T = ${T} ${T === 1 ? 'day' : 'days'}`, { size: 0.32 }); lab.position.set(-1.75, 4.0, 0); group.add(lab);
    const tip = ctx.sprite(`Goal: ${targetK} half-lives`, { size: 0.28 }); tip.position.set(DIAL.x, 4.95, 0.3); group.add(tip);

    // small sparks that leave an atom when it decays
    const NS = 40, sPos = new Float32Array(NS * 3), sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xfff1b0, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })); sparks.frustumCulled = false; group.add(sparks);
    const sLife = new Float32Array(NS), sVel = new Float32Array(NS * 3); let sNext = 0;
    const park = (j) => { const h = tray.position; sPos.set([h.x, h.y - 0.03, h.z - 0.06], j * 3); };       // resting sparks hide inside the board
    for (let j = 0; j < NS; j++) park(j);

    let alive = Array(N0).fill(true), time = 0, counts = [N0], ks = [0], done = false, guessed = false, guess = 50, guessErr = null;
    let part = 1, busy = 0, queue = 0, shownK = 0, dirty = true;
    const fade = new Float32Array(N0), delay = new Float32Array(N0);          // 0 = glowing, 1 = decayed
    const rT = ui.readout('Time, days'), rN = ui.readout('Atoms left'), rF = ui.readout('Formula N'), rK = ui.readout('Half-lives passed'), rG = ui.readout('Your prediction');
    const count = () => counts[counts.length - 1];
    const reads = () => { const k = time / T; rT.set(fmt(time)); rN.set(String(count())); rF.set(fmt(model.left(k))); rK.set(fmt(k)); rG.set(guessed ? fmt(guess) : '–'); };
    const showBars = () => { for (let j = 0; j <= MAX_STEPS; j++) { const on = j < counts.length; bars[j].visible = on; marks[j].visible = on; if (on) marks[j].position.y = BY + model.left(ks[j]) * UNIT; else bars[j].scale.y = 0.001; } };

    const predS = ui.slider({ label: `My prediction: atoms left of 100 after ${targetK} half-lives`, min: 0, max: 100, step: level <= 3 ? 0.5 : 0.25, value: guess, unit: 'atoms', onInput: (v) => { guess = v; } });
    const lock = () => {
      if (time > 0) { ctx.say('A prediction has to come before the experiment. Press Reset, then lock in your number.'); return; }
      guessed = true; guessErr = model.error(guess, targetK);
      guessLine.visible = true; guessLine.position.y = BY + guess * UNIT; reads();
      ctx.say(`Locked in: ${fmt(guess)} atoms. The purple line marks your prediction. Now press Run until you reach ${targetK} T (${fmt(targetK * T)} days).`);
    };
    ui.button('✔ Lock in my prediction', lock, 'btn');
    const stepC = ui.choice([[0.5, '½ T each step'], [1, '1 T each step']], 1, (v) => { part = +v; });
    const advance = () => {
      if (counts.length > MAX_STEPS) { ctx.say('The bar chart is full. Press Reset to start again with 100 fresh atoms.'); queue = 0; return; }
      const p = model.chance(part);
      for (let i = 0; i < N0; i++) if (alive[i] && rng() < p) { alive[i] = false; delay[i] = 0.1 + rng() * (ctx.calm ? 0.5 : 1.1); }
      time += part * T; counts.push(alive.filter(Boolean).length); ks.push(time / T);
      busy = ctx.calm ? 0.9 : 1.5; showBars(); reads();
    };
    const run = () => { if (queue < 4) queue++; };
    const reset = () => { alive = Array(N0).fill(true); time = 0; counts = [N0]; ks = [0]; queue = 0; busy = 0; fade.fill(0); delay.fill(0); dirty = true; showBars(); reads(); ctx.say('One hundred fresh atoms. Each one decays by chance, so no two runs are exactly the same.'); };
    ui.button('⏩ Run', run, 'btn'); ui.button('↺ Reset', reset, 'btn ghost');
    ui.note(`A made-up isotope has half-life T = ${T} ${T === 1 ? 'day' : 'days'}. Each gold ball is an atom that has not decayed. The blue plates show N = 100 · (½)^(t/T). You can also tap the clock to run.`);
    ctx.onTap(face, run);
    // What the last step showed, in words.
    const report = () => {
      const k = time / T, n = count(), f = model.left(k), before = counts[counts.length - 2];
      if (!done && guessed && Math.abs(k - targetK) < 1e-9) {
        done = true;
        const score = Math.max(0.5, 1 - guessErr), close = guessErr <= 0.2;
        ctx.say(`${close ? 'A good prediction!' : `You predicted ${fmt(guess)}.`} The tray has ${n} atoms and the formula says ${fmt(f)}. Each half-life removes half of what is left, not half of the start. Random chance makes the real count wobble around the formula.`);
        ctx.complete(score, 'Used half-life: N = N0 · (1/2)^(t/T).');
      } else if (k > targetK + 1e-9 && !done) ctx.say(`That is ${fmt(k)} half-lives, past the goal of ${targetK}. Press Reset and stop at ${fmt(targetK * T)} days.`);
      else if (Math.abs(k - targetK) < 1e-9 && !guessed) ctx.say(`You reached ${targetK} half-lives with ${n} atoms left, but there was no prediction to check. Press Reset, lock in a number first, then run again.`);
      else ctx.say(`${before - n} of ${before} atoms decayed in this step, leaving ${n}. The formula says ${fmt(f)}: chance decides each atom, so the count lands near the blue plate, not always on it.`);
    };
    showBars(); reads();
    ctx.say(`How many of the 100 atoms will still glow after ${targetK} half-lives? Set your prediction, lock it in, then run time forward.`);

    const obj = new THREE.Object3D(), v = new THREE.Vector3();
    const place = () => {
      for (let i = 0; i < N0; i++) {
        const x = (i % 10 - 4.5) * 0.3, y = (4.5 - Math.floor(i / 10)) * 0.3, f = fade[i];
        obj.position.set(x, y, 0.12 - f * 0.05); obj.scale.setScalar(Math.max(0.0001, 1 - f)); obj.updateMatrix(); bright.setMatrixAt(i, obj.matrix);
        obj.position.set(x, y, 0.05); obj.scale.setScalar(Math.max(0.0001, f * 0.62)); obj.updateMatrix(); spent.setMatrixAt(i, obj.matrix);
      }
      bright.instanceMatrix.needsUpdate = true; spent.instanceMatrix.needsUpdate = true;
    };
    const spark = (i) => {
      v.set((i % 10 - 4.5) * 0.3, (4.5 - Math.floor(i / 10)) * 0.3, 0.15).applyEuler(tray.rotation).add(tray.position);
      const j = sNext; sNext = (sNext + 1) % NS; sPos.set([v.x, v.y, v.z], j * 3); sLife[j] = 0.8;
      sVel.set([(rng() - 0.5) * 1.2, 0.6 + rng() * 0.9, 0.8 + rng() * 0.8], j * 3);
    };
    place();
    return {
      step(dt) {
        if (busy > 0) { busy -= dt; if (busy <= 0) report(); }
        else if (queue > 0) { queue--; advance(); }
      },
      frame(dt) {
        let moved = dirty; dirty = false;
        for (let i = 0; i < N0; i++) {
          if (alive[i] || fade[i] >= 1) continue;
          if (delay[i] > 0) { delay[i] -= dt; if (delay[i] <= 0 && !ctx.calm) spark(i); continue; }
          fade[i] = Math.min(1, fade[i] + dt * 3.5); moved = true;
        }
        if (moved) place();
        let live = false;
        for (let j = 0; j < NS; j++) {
          if (sLife[j] <= 0) continue;
          sLife[j] -= dt; live = true;
          if (sLife[j] <= 0) park(j); else for (let c = 0; c < 3; c++) sPos[j * 3 + c] += sVel[j * 3 + c] * dt;
        }
        if (live) sGeo.attributes.position.needsUpdate = true;
        for (let j = 0; j < counts.length && j <= MAX_STEPS; j++) { const want = Math.max(0.001, counts[j] * UNIT); bars[j].scale.y += (want - bars[j].scale.y) * Math.min(1, dt * 5); }
        shownK += (time / T - shownK) * Math.min(1, dt * 3); hand.rotation.z = -shownK * Math.PI * 2;
        const n = count(); halo.material.opacity = 0.06 + 0.3 * (n / N0);
      },
      // Predicts with the formula, locks it in and runs whole half-lives up to the goal, as a player would.
      autoplay() {
        if (time > 0) reset();
        predS.set(truth); guess = truth; lock();
        part = 1; stepC.set?.(1);
        queue = 0; for (let i = 0; i < targetK; i++) run();
      },
      dispose() { queue = 0; bright.dispose?.(); spent.dispose?.(); },
    };
  },
};
