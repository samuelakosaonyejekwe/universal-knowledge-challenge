// World 17 lab — Bayes Update Lab in 3D: a grandstand of 1,000 small figures. A scanner sweeps over them and each
// figure lights up as a true positive, a false positive, a missed case or a true negative, so the answer to
// "how likely is it really, after a positive test?" can be seen and counted.
// No imports: everything arrives through the context, so the model can be checked without a browser.

const SCEN = [
  { name: 'a rare plant disease', pos: 'a leaf test is positive', hit: 'diseased' },
  { name: 'a hidden fault in a gadget', pos: 'a scanner raises an alarm', hit: 'faulty' },
  { name: 'a rare sleep problem', pos: 'a screening quiz flags a person', hit: 'affected' },
];
const N = 1000, COLS = 40, ROWS = 25;

// ----- the model: Bayes' rule for one yes/no condition and one test -----
export const model = {
  // p = base rate P(H), s = sensitivity P(+|H), f = false positive rate P(+|not H); all from 0 to 1.
  posterior(p, s, f) { const d = p * s + (1 - p) * f; return d > 0 ? p * s / d : 0; },
  // The same thing as whole figures in a crowd of n.
  crowd(p, s, f, n = N) { const h = Math.round(n * p), tp = Math.round(h * s), fp = Math.round((n - h) * f); return { h, tp, fn: h - tp, fp, tn: n - h - fp }; },
};
// Used by the automated tests: hand-worked values.
export function selfTest() {
  const a = model.posterior(0.01, 0.9, 0.09);            // 0.009 / (0.009 + 0.0891) = 0.091743…
  const b = model.posterior(0.02, 0.9, 0.1);             // 0.018 / (0.018 + 0.098) = 0.155172…
  const c = model.crowd(0.02, 0.9, 0.1);                 // 20 have it, 18 true positives, 98 false positives
  const d = model.posterior(0.5, 0.8, 0.8);              // a test that says nothing leaves the base rate: 0.5
  const ok = Math.abs(a - 0.0917431) < 1e-6 && Math.abs(b - 18 / 116) < 1e-12 && c.h === 20 && c.tp === 18 && c.fn === 2 && c.fp === 98 && c.tn === 882 && Math.abs(c.tp / (c.tp + c.fp) - b) < 1e-12 && Math.abs(d - 0.5) < 1e-12;
  return { ok, detail: `1 % base, 90 % sensitive, 9 % false alarms: ${(a * 100).toFixed(2)} % (by hand 9.17 %); 2 %, 90 %, 10 %: ${c.tp} true and ${c.fp} false positives in 1,000 = ${(b * 100).toFixed(2)} % (by hand 18/116 = 15.52 %); useless test keeps ${(d * 100).toFixed(0)} %` };
}

const fmt = (v, d = 1) => String(+v.toFixed(d));

export default {
  id: 'w17-bayes-lab',
  world: 17,
  levels: [5, 6],
  title: 'Bayes Update Lab',
  goal: 'Predict how likely it really is after a positive test, then test a crowd of 1,000 and compare with the exact Bayes result.',
  kind: 'validated',
  model: 'Bayes\' rule for one test and one yes/no condition: P(H|+) = P(+|H)P(H) / [P(+|H)P(H) + P(+|not H)P(not H)], checked against hand-worked values. The crowd shows the same numbers rounded to whole figures out of 1,000. The test errors are assumed independent of who is tested. Real tests have varying accuracy across groups and repeated tests are rarely independent.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rnd = ctx.rng || Math.random, lv = Math.max(1, Math.min(6, ctx.level || 5)), HARD = lv >= 6, MAXBASE = 10;
    const pick = (a) => a[Math.min(a.length - 1, Math.floor(rnd() * a.length))];
    const sc = pick(SCEN);
    let prior = pick([1, 2, 5]), sens = 90 + Math.min(8, Math.floor(rnd() * 9)), fpr = pick([5, 10]);
    let target = 0.3 + Math.min(4, Math.round(rnd() * 4)) * 0.1;
    const exact = () => model.posterior(prior / 100, sens / 100, fpr / 100);
    for (let k = 0; k < 5 && Math.abs(exact() - target) <= 0.06; k++) target = target >= 0.65 ? 0.3 : target + 0.1;     // never start on the target
    target = Math.round(target * 10) / 10;
    let pred = 50, guessed = false, done = false, phase = 'hidden', scanX = -9, view = 'mixed', auto = false, predErr = 0, labelWait = 0, labelsDirty = true, moving = true;

    // ----- the grandstand: 25 steps, each row a little higher so every figure can be seen -----
    const X0 = -3.35, DX = 0.138, Z0 = 1.6, DZ = 0.158, RISE = 0.13, BASE = 0.1;
    const stone = ctx.mat('#f4f8fb'), dark = ctx.mat('#27455a', { roughness: 0.9 });
    const geos = [];
    const G = (g) => { geos.push(g); return g; };
    const stepG = G(new THREE.BoxGeometry(COLS * DX + 0.2, 1, DZ)); stepG.translate(0, 0.5, 0);
    const steps = new THREE.InstancedMesh(stepG, stone, ROWS); steps.receiveShadow = true; steps.frustumCulled = false;
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    for (let r = 0; r < ROWS; r++) { P.set(X0 + (COLS - 1) * DX / 2, 0, Z0 - r * DZ); S.set(1, BASE + r * RISE, 1); steps.setMatrixAt(r, M.compose(P, Q, S)); }
    group.add(steps);
    // ----- 1,000 figures: a body and a head each, drawn as two instanced meshes -----
    const bodyG = G(new THREE.CylinderGeometry(0.028, 0.06, 0.2, 6)); bodyG.translate(0, 0.1, 0);
    const headG = G(new THREE.SphereGeometry(0.05, 8, 6)); headG.translate(0, 0.25, 0);
    const figM = ctx.mat('#ffffff', { roughness: 0.55 });
    const bodies = new THREE.InstancedMesh(bodyG, figM, N), heads = new THREE.InstancedMesh(headG, figM, N);
    bodies.frustumCulled = heads.frustumCulled = false; group.add(bodies, heads);
    const perm = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rnd() * (i + 1))); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const cur = new Float32Array(N * 4), tgt = new Float32Array(N * 4), kind = new Uint8Array(N);     // x, y, z, size
    const COL = { hid: new THREE.Color('#c3d2db'), has: new THREE.Color('#7048e8'), tp: new THREE.Color('#12b886'), fp: new THREE.Color('#e03131'), fn: new THREE.Color('#f59f00'), tn: new THREE.Color('#9db4c2') };
    let counts = model.crowd(prior / 100, sens / 100, fpr / 100);
    // Who is who: figures 0…h−1 have the condition (the first tp of them test positive); the last fp figures are false alarms.
    const assign = (snap) => {
      counts = model.crowd(prior / 100, sens / 100, fpr / 100);
      const { h, tp, fn, fp } = counts;
      for (let i = 0; i < N; i++) {
        let k, kd;
        if (i < tp) { kd = 1; k = fn + i; } else if (i < h) { kd = 2; k = i - tp; } else if (i >= N - fp) { kd = 3; k = h + i - (N - fp); } else { kd = 4; k = h + fp + i - h; }
        kind[i] = kd;
        const col = view === 'sorted' ? Math.floor(k / ROWS) : perm[i] % COLS, row = view === 'sorted' ? k % ROWS : Math.floor(perm[i] / COLS);
        tgt[i * 4] = X0 + col * DX; tgt[i * 4 + 1] = BASE + row * RISE; tgt[i * 4 + 2] = Z0 - row * DZ;
        if (snap) { cur[i * 4] = tgt[i * 4]; cur[i * 4 + 1] = tgt[i * 4 + 1]; cur[i * 4 + 2] = tgt[i * 4 + 2]; cur[i * 4 + 3] = 1; }
      }
      moving = true;
    };
    const paint = (ease) => {
      let still = true;
      for (let i = 0; i < N; i++) {
        const o = i * 4, kd = kind[i], seen = phase === 'shown' || (phase === 'sweep' && cur[o] < scanX), plus = seen && (kd === 1 || kd === 3);
        tgt[o + 3] = plus ? 1.45 : 1;
        for (let c = 0; c < 4; c++) { const d = tgt[o + c] - cur[o + c]; if (Math.abs(d) > 0.002) { cur[o + c] += d * ease; still = false; } else cur[o + c] = tgt[o + c]; }
        P.set(cur[o], cur[o + 1] + (cur[o + 3] - 1) * 0.12, cur[o + 2]); S.setScalar(cur[o + 3]); M.compose(P, Q, S);
        bodies.setMatrixAt(i, M); heads.setMatrixAt(i, M);
        const c = !seen ? (kd <= 2 ? COL.has : COL.hid) : kd === 1 ? COL.tp : kd === 2 ? COL.fn : kd === 3 ? COL.fp : COL.tn;
        bodies.setColorAt(i, c); heads.setColorAt(i, c);
      }
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
      if (still && phase !== 'sweep') moving = false;
    };
    // ----- the scanner: a bright bar that lies along the slope and sweeps across the crowd -----
    const slopeLen = Math.hypot((ROWS - 1) * DZ, (ROWS - 1) * RISE) + 0.6, slope = Math.atan2((ROWS - 1) * RISE, (ROWS - 1) * DZ);
    const scanner = new THREE.Group(); scanner.position.set(X0 - 0.3, 0, 0); group.add(scanner);
    const bar = new THREE.Mesh(G(new THREE.BoxGeometry(0.07, 0.07, slopeLen)), ctx.lit('#22c3dd', 1.6)); bar.position.set(0, BASE + (ROWS - 1) * RISE / 2 + 0.55, Z0 - (ROWS - 1) * DZ / 2); bar.rotation.x = slope; scanner.add(bar);
    const postF = new THREE.Mesh(G(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8)), dark); postF.position.set(0, 0.37, Z0 + 0.3); scanner.add(postF);
    const postB = new THREE.Mesh(G(new THREE.CylinderGeometry(0.05, 0.05, 4.1, 8)), dark); postB.position.set(0, 2.05, Z0 - (ROWS - 1) * DZ - 0.25); scanner.add(postB);
    const beamGlow = ctx.glow('#22c3dd', 1.2, 0.7); beamGlow.position.copy(bar.position); scanner.add(beamGlow);
    // ----- the tower of positives: green = really has it, red = false alarm; its green share is the posterior -----
    const TX = 2.98, TZ = 0.9, TOP = 4, TY = 0.16;
    const plinth = new THREE.Mesh(G(new THREE.BoxGeometry(0.95, TY, 0.95)), stone); plinth.position.set(TX, TY / 2, TZ); group.add(plinth);
    const colG = G(new THREE.BoxGeometry(0.6, 1, 0.6)); colG.translate(0, 0.5, 0);
    const colT = new THREE.Mesh(colG, ctx.lit('#12b886', 0.55)), colF = new THREE.Mesh(colG, ctx.lit('#e03131', 0.45)), colQ = new THREE.Mesh(colG, ctx.mat('#9db4c2', { roughness: 0.5 }));
    for (const c of [colT, colF, colQ]) { c.position.set(TX, TY, TZ); c.castShadow = true; group.add(c); }
    const markG = G(new THREE.BoxGeometry(0.86, 0.05, 0.86));
    const targetM = new THREE.Mesh(markG, ctx.lit('#22c3dd', 1.2)), predM = new THREE.Mesh(markG, ctx.lit('#7048e8', 1)); group.add(targetM, predM);
    let towerNow = 0.5;
    const labels = {};
    const label = (key, text, x, y, z, size) => {
      const L = labels[key];
      if (L && L.text === text) { L.s.position.set(x, y, z); return; }
      if (L) { L.s.removeFromParent(); L.s.material?.map?.dispose?.(); L.s.material?.dispose?.(); }
      const s = ctx.sprite(text, { size }); s.position.set(x, y, z); group.add(s); labels[key] = { s, text };
    };
    const drawLabels = () => {
      const shown = phase === 'shown', e = exact();
      label('target', `🎯 ${Math.round(target * 100)} %`, TX - 0.05, TY + TOP * target + 0.02, TZ + 0.75, 0.3);
      label('pred', `✋ ${Math.round(pred)} %`, TX - 0.05, TY + TOP * pred / 100 + 0.02, TZ - 0.75, 0.26);
      label('top', shown ? `${fmt(e * 100)} %` : '?', TX, TY + TOP + 0.4, TZ, 0.42);
      label('tp', shown ? `🟢 ${counts.tp}` : '🟢 ?', -2.6, 4.35, -2.3, 0.36);
      label('fp', shown ? `🔴 ${counts.fp}` : '🔴 ?', -1.2, 4.35, -2.3, 0.36);
      label('fn', shown ? `🟠 ${counts.fn}` : '🟠 ?', 0.2, 4.35, -2.3, 0.36);
      label('all', `🟣 ${counts.h} / 1000`, 1.75, 4.35, -2.3, 0.36);
      labelsDirty = false;
    };

    // ----- controls -----
    const priorS = ui.slider({ label: 'Base rate P(H), how common it is', min: 0.1, max: 50, step: 0.1, value: prior, unit: '%', onInput: (v) => { prior = +v; upd(true); } });
    const sensS = ui.slider({ label: 'Sensitivity P(+|H)', min: 50, max: 100, step: 1, value: sens, unit: '%', onInput: (v) => { sens = +v; upd(true); } });
    const fprS = ui.slider({ label: 'False positive rate P(+|not H)', min: 0.5, max: 30, step: 0.5, value: fpr, unit: '%', onInput: (v) => { fpr = +v; upd(true); } });
    const predS = ui.slider({ label: 'My prediction of P(H | +)', min: 0, max: 100, step: 1, value: pred, unit: '%', onInput: (v) => { pred = +v; refresh(); } });
    ui.button('🔎 Lock in my prediction and test the crowd', () => lock(), 'btn');
    const viewC = ui.choice([['mixed', 'Mixed crowd'], ['sorted', 'Sorted into groups']], view, (v) => setView(v));
    const rPost = ui.readout('Posterior P(H|+), %'), rTp = ui.readout('Out of 1000: true +'), rFp = ui.readout('Out of 1000: false +'), rTarget = ui.readout('Target, %'), rBase = HARD ? ui.readout('Base rate allowed, %') : null;
    ui.note(`Imagine ${sc.name}. You learn that ${sc.pos}. How likely is it that the thing is ${sc.hit}? Purple figures have it. After the test: green = has it and tested positive, red = false alarm, orange = missed, grey = correctly clear.`);
    ui.note(`Mission: after you have made a prediction, set the sliders so P(H|+) is within 3 points of ${Math.round(target * 100)}%.${HARD ? ` Keep the base rate at ${MAXBASE}% or less: improve the test, not the crowd.` : ''}`);

    function refresh() {
      const p = prior / 100, s = sens / 100, f = fpr / 100, e = exact(), shown = phase === 'shown';
      rPost.set(shown ? fmt(e * 100, 1) : '? (predict first)'); rTp.set(shown ? fmt(1000 * p * s, 1) : '?'); rFp.set(shown ? fmt(1000 * (1 - p) * f, 1) : '?');
      rTarget.set(`${Math.round(target * 100)} ± 3`); rBase?.set(`${MAXBASE} or less (now ${fmt(prior)})`);
      targetM.position.set(TX, TY + TOP * target, TZ); predM.position.set(TX, TY + TOP * pred / 100, TZ);
      labelsDirty = true;
    }
    function upd(fromPlayer) {
      assign(false); refresh();
      if (phase !== 'shown' || !guessed) { if (fromPlayer && phase === 'hidden') ctx.say(`Now ${counts.h} of the 1,000 figures are purple: they really have it. Before you test, predict: of the figures that test positive, what share will be purple ones?`); return; }
      const e = exact(), pct = fmt(e * 100), T = Math.round(target * 100), pos = counts.tp + counts.fp;
      if (done) return;
      if (Math.abs(e - target) <= 0.03 && (!HARD || prior <= MAXBASE + 1e-9)) {
        done = true;
        ctx.say(`P(H|+) = ${pct} %: ${counts.tp} green figures among ${pos} positives. Bayes: P(H|+) = P(+|H)P(H) / [P(+|H)P(H) + P(+|not H)P(not H)]. The posterior depends on the base rate as much as on the test quality.`);
        ctx.complete(0.8 + 0.2 * (Math.abs(e - target) <= 0.01 ? 1 : 0), `posterior=${pct}%, target=${T}%, base=${fmt(prior)}%, sensitivity=${sens}%, false positives=${fmt(fpr)}%, prediction error=${Math.round(predErr * 100)}%`);
      } else if (!fromPlayer) return;
      else if (Math.abs(e - target) <= 0.03) ctx.say(`${pct} % is on target, but the base rate is ${fmt(prior)} %. Keep it at ${MAXBASE} % or less and reach the target by making false alarms rarer instead.`);
      else if (e < target) ctx.say(`${counts.tp} of the ${pos} positive figures are green: ${pct} %. The target is ${T} %. Too many red false alarms are mixed in: make false positives rarer${HARD ? '' : ', or make the condition more common'}.`);
      else ctx.say(`${counts.tp} of the ${pos} positive figures are green: ${pct} %. The target is ${T} %. To come down, allow more false alarms or make the condition rarer: then more of the positives are red.`);
    }
    function setView(v) {
      if (v === view) return; view = v; assign(false);
      ctx.say(v === 'sorted' ? 'The same 1,000 figures, now standing in groups. The raised figures in the middle all tested positive. Compare the green part with the red part.' : 'Mixed again, as a real crowd would be. The numbers have not changed, only where the figures stand.');
    }
    function lock() {
      if (phase === 'sweep') return;
      const truth = exact() * 100; predErr = truth > 0 ? Math.abs(pred - truth) / truth : 1; guessed = true;
      phase = 'sweep'; scanX = X0 - 0.3; moving = true; refresh();
      ctx.say(`Prediction locked: ${Math.round(pred)} %. The scanner is testing all 1,000 figures. Watch which ones light up.`);
    }
    function endSweep() {
      phase = 'shown'; moving = true; refresh();
      const e = exact(), pos = counts.tp + counts.fp;
      const first = predErr <= 0.15 ? 'Good intuition. Most people overestimate when the base rate is low.' : `You predicted ${Math.round(pred)} %. Look at the figures: most positives come from the large healthy group, even with a small false positive rate.`;
      ctx.say(`${first} ${pos} figures tested positive: ${counts.tp} green ones really have it and ${counts.fp} red ones are false alarms, so P(H|+) = ${fmt(e * 100)} %. Now move the sliders until it is within 3 points of ${Math.round(target * 100)} %.`);
      upd(false);
      if (auto && !done) solve();
    }
    // The winning settings for the demonstration: a 5 % base rate, a 90 % sensitive test, and the false positive rate that fits.
    function solve() {
      let best = 0.5, err = 9;
      for (let f = 0.5; f <= 30; f += 0.5) { const d = Math.abs(model.posterior(0.05, 0.9, f / 100) - target); if (d < err) { err = d; best = f; } }
      priorS.set(5); sensS.set(90); fprS.set(best);
    }
    ctx.onTap?.(bar, () => lock());
    ctx.onTap?.(steps, () => { const v = view === 'mixed' ? 'sorted' : 'mixed'; if (viewC.set) viewC.set(v); else setView(v); });
    assign(true); paint(1); refresh(); drawLabels();
    ctx.say(`${counts.h} of these 1,000 figures are purple: they really have it. The test is not perfect. Predict P(H | +), then lock it in and let the scanner test everyone.`);

    return {
      step(dt) {
        if (phase !== 'sweep') return;
        scanX += dt * (ctx.calm ? 20 : 2.4);
        if (scanX >= X0 + COLS * DX + 0.2) endSweep();
      },
      frame(dt, time) {
        const ease = ctx.calm ? 1 : Math.min(1, dt * 5);
        if (moving || phase === 'sweep') paint(ease);
        scanner.position.x = phase === 'sweep' ? scanX : X0 - 0.3;
        if (!ctx.calm) beamGlow.material.opacity = 0.55 + Math.sin(time * 6) * 0.15;
        const shown = phase === 'shown', want = shown ? exact() : 0.5;
        towerNow += (want - towerNow) * ease;
        colQ.visible = !shown; colT.visible = colF.visible = shown;
        colQ.scale.y = TOP;
        colT.scale.y = Math.max(0.01, TOP * towerNow); colF.scale.y = Math.max(0.01, TOP * (1 - towerNow)); colF.position.y = TY + TOP * towerNow;
        labelWait -= dt;
        if (labelsDirty && labelWait <= 0) { drawLabels(); labelWait = 0.2; }
      },
      // Shows a successful run without the player (used by tests).
      autoplay() { auto = true; predS.set(Math.round(exact() * 100)); if (phase === 'shown') solve(); else lock(); },
      dispose() {
        for (const k of Object.keys(labels)) { labels[k].s.removeFromParent(); labels[k].s.material?.map?.dispose?.(); labels[k].s.material?.dispose?.(); }
        bodies.dispose?.(); heads.dispose?.(); steps.dispose?.();
        for (const g of geos) g.dispose();
      },
      get state() { return { prior, sens, fpr, pred, target, phase, done, counts }; },
    };
  },
};
