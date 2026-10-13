// World 3 lab — Gear Train Builder, in 3D.
// A lab file has no imports: everything arrives through the context, so the model can be checked without a browser.

// ----- the model: a compound gear train; gears 2 and 3 share a shaft -----
const ETA = 0.97;                               // each pair of gears passes on 97 % of its power
const TOL = 0.04;                               // the output must be within 4 % of the target
const ZMIN = 8, ZMAX = 50;
export const model = {
  ETA, TOL,
  // Output speed: each pair divides the speed by (driven teeth ÷ driver teeth).
  out: (inRpm, z) => inRpm * (z[0] / z[1]) * (z[2] / z[3]),
  ratio: (z) => (z[0] / z[1]) * (z[2] / z[3]),
  torqueGain: (z) => ETA * ETA / model.ratio(z),
  // Speeds of the three shafts in rpm; the sign shows the direction (meshing gears turn opposite ways).
  shafts: (inRpm, z) => [inRpm, -inRpm * z[0] / z[1], inRpm * (z[0] / z[1]) * (z[2] / z[3])],
  error: (inRpm, z, target) => Math.abs(model.out(inRpm, z) - target) / target,
  // The job: a hidden set of teeth gives the target speed. Level 3 and below fix the second pair.
  task(level, rng) {
    const rnd = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const inRpm = [60, 90, 120][rnd(0, 2)], tz = [rnd(10, 20), rnd(24, 50), rnd(10, 20), rnd(24, 50)];
    return { inRpm, tz, target: Math.round(model.out(inRpm, tz)), free: level >= 4 ? [0, 1, 2, 3] : [0, 1] };
  },
  // Teeth for the free gears that come closest to the target.
  solve(job, start) {
    const z = start.slice(); let best = null;
    const tryIt = () => { const e = model.error(job.inRpm, z, job.target); if (!best || e < best.e - 1e-12) best = { z: z.slice(), e }; };
    if (job.free.length === 2) { for (let a = ZMIN; a <= ZMAX; a++) for (let b = ZMIN; b <= ZMAX; b++) { z[0] = a; z[1] = b; tryIt(); } }
    else { z[2] = job.tz[2]; z[3] = job.tz[3]; for (let a = ZMIN; a <= ZMAX; a++) for (let b = ZMIN; b <= ZMAX; b++) { z[0] = a; z[1] = b; tryIt(); } }
    return best;
  },
};
// Used by the automated tests: hand-worked ratios, and every job has an answer inside the tolerance.
export function selfTest() {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const z = [20, 40, 15, 45], o = model.out(60, z), sh = model.shafts(60, z);       // ½ × ⅓ = ⅙ of 60 rpm
  const tg = model.torqueGain(z);                                                   // 6 × 0.97² = 5.6454
  const same = model.out(90, [20, 20, 20, 20]), up = model.out(120, [50, 10, 20, 20]);
  let n = 0, solvable = true; const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  for (let i = 0; i < 400; i++) for (const L of [3, 4]) { const job = model.task(L, rng), start = L >= 4 ? [20, 20, 20, 20] : [20, 20, job.tz[2], job.tz[3]], b = model.solve(job, start); if (!b || b.e > TOL || job.target < 1) solvable = false; }
  const ok = near(o, 10) && near(sh[1], -30) && near(sh[2], 10) && near(tg, 5.6454) && near(same, 90) && near(up, 600) && solvable;
  return { ok, detail: `60 rpm through 20→40 and 15→45 teeth: ${sh[1].toFixed(0)} rpm on the middle shaft, ${o.toFixed(0)} rpm out (÷6), torque ×${tg.toFixed(4)}; equal gears keep 90 rpm; 50→10 turns 120 into ${up.toFixed(0)} rpm; 800 random jobs solvable within 4 %: ${solvable}` };
}

// One flat gear wheel as a single mesh shape. A tooth is centred on angle 0.
function gearGeo(THREE, teeth, r, depth) {
  const m = 2 * r / teeth, tip = r + m * 0.9, root = r - m * 1.1, p = Math.PI * 2 / teeth, sh = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * p;
    for (const [rad, off] of [[root, -0.27], [tip, -0.12], [tip, 0.12], [root, 0.27]]) { const x = Math.cos(a + off * p) * rad, y = Math.sin(a + off * p) * rad; if (i === 0 && off === -0.27) sh.moveTo(x, y); else sh.lineTo(x, y); }
  }
  sh.closePath();
  const hole = (x, y, rad) => { const h = new THREE.Path(); h.absarc(x, y, rad, 0, Math.PI * 2, true); sh.holes.push(h); };
  if (teeth >= 14) for (let i = 0; i < 5; i++) hole(Math.cos(i * 1.2566 + 0.6) * root * 0.6, Math.sin(i * 1.2566 + 0.6) * root * 0.6, root * 0.19);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 5 }); g.translate(0, 0, -depth / 2);
  return g;
}

export default {
  id: 'w03-gear-train',
  world: 3,
  levels: [3, 4],
  title: 'Gear Train Builder',
  goal: 'Choose the gear teeth so the output shaft turns at the target speed.',
  kind: 'validated',
  model: 'Ideal spur gears of the same module in two pairs, with gears 2 and 3 on the same shaft. Output speed = input speed × (teeth of gear 1 ÷ teeth of gear 2) × (teeth of gear 3 ÷ teeth of gear 4). Each mesh is 97 % efficient, so torque is multiplied by 0.97 × 0.97 ÷ speed ratio. No backlash and no shaft friction. Real gear trains also need strength checks and lubrication. The wheels are drawn four times slower than real so you can watch them.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, job = model.task(ctx.level, ctx.rng), MOD = 0.0205, Y = 1.75, SLOW = ctx.calm ? 0.08 : 0.25;
    const RAD = Math.PI * 2 / 60;
    const iron = ctx.mat('#4a4038', { metalness: 0.5, roughness: 0.5 }), steel = ctx.mat('#b9b2a6', { metalness: 0.7, roughness: 0.3 });
    const cols = ['#ffb347', '#5a86ff', '#7bd88f', '#ff6f91'].map((c) => ctx.mat(c, { metalness: 0.45, roughness: 0.4 }));
    const lampIdle = ctx.mat('#6b5a4c', { roughness: 0.6 }), lampGood = ctx.lit('#4fdc7c', 1.8), lampFast = ctx.lit('#ff8a5c', 1.6), lampSlow = ctx.lit('#6ab0ff', 1.6);
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    add(new THREE.BoxGeometry(7, 0.2, 2.6), iron, 0, 0.1, 0);

    const z = job.free.length === 4 ? [20, 20, 20, 20] : [20, 20, job.tz[2], job.tz[3]];
    // three shafts: the input (with a crank), the middle shaft (two gears) and the output (with a spinner)
    const ZF = 0.42, ZB = 0.12;                                              // first pair in front, second pair behind it
    const sA = new THREE.Group(), sB = new THREE.Group(), sC = new THREE.Group(), ghost = new THREE.Group(); group.add(sA, sB, sC, ghost);
    const gears = [add(new THREE.BufferGeometry(), cols[0], 0, 0, ZF, sA), add(new THREE.BufferGeometry(), cols[1], 0, 0, ZF, sB), add(new THREE.BufferGeometry(), cols[2], 0, 0, ZB, sB), add(new THREE.BufferGeometry(), cols[3], 0, 0, ZB, sC)];
    const axle = new THREE.CylinderGeometry(0.06, 0.06, 1, 10); axle.rotateX(Math.PI / 2);
    add(axle, steel, 0, 0, 0.42, sA).scale.z = 1.45; add(axle, steel, 0, 0, 0.15, sB).scale.z = 0.9; add(axle, steel, 0, 0, 0.35, sC).scale.z = 1.3;
    // the crank on the input shaft
    add(new THREE.BoxGeometry(0.1, 0.42, 0.06), steel, 0, 0.17, 1.12, sA); const knobG = new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10); knobG.rotateX(Math.PI / 2); add(knobG, ctx.mat('#e0662a'), 0, 0.36, 1.25, sA);
    // in front of the output gear: the output spinner (one bright blade) and, just behind it, a pale target spinner that turns at the wanted speed
    const bladeG = new THREE.BoxGeometry(0.16, 0.8, 0.05); bladeG.translate(0, 0.4, 0);
    const hubG = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16); hubG.rotateX(Math.PI / 2);
    add(hubG, steel, 0, 0, 0.95, sC); add(bladeG, ctx.lit('#ffd76a', 0.9), 0, 0, 0.95, sC); const tail = add(bladeG, steel, 0, 0, 0.95, sC); tail.rotation.z = Math.PI; tail.scale.set(0.7, 0.45, 1);
    add(hubG, iron, 0, 0, 0.78, ghost); const tBlade = add(bladeG, ctx.lit('#9be7ff', 0.7, { transparent: true, opacity: 0.75 }), 0, 0, 0.78, ghost); tBlade.scale.set(1.5, 1.12, 1);
    const ringG = new THREE.TorusGeometry(0.98, 0.035, 8, 40); add(ringG, iron, 0, 0, 0.78, ghost).castShadow = false;
    const posts = [0, 1, 2].map(() => add(new THREE.BoxGeometry(0.16, Y, 0.16), iron, 0, Y / 2, -0.22));
    const lamp = add(new THREE.SphereGeometry(0.22, 16, 12), lampIdle, 0, 0, 0); lamp.castShadow = false;
    const tags = gears.map((g, i) => { const t = ctx.sprite(String(i + 1), { size: 0.34 }); group.add(t); return t; });
    const inTag = ctx.sprite(`in ${job.inRpm} rpm`, { size: 0.3 }), outTag = ctx.sprite(`target ${job.target} rpm`, { size: 0.3 }); group.add(inTag, outTag);

    let phase = 0, tPhase = 0, state = 'idle', t = 0, tries = 0, done = false, sliders = [];
    const rOut = ui.readout('Output (rpm)'), rRatio = ui.readout('Speed ratio'), rTq = ui.readout('Torque ×'), rMid = ui.readout('Middle shaft (rpm)');
    const refresh = () => {
      const o = model.out(job.inRpm, z);
      rOut.set(`${o.toFixed(1)} (target ${job.target})`); rRatio.set(`${model.ratio(z).toFixed(3)} = ${z[0]}/${z[1]} × ${z[2]}/${z[3]}`); rTq.set(model.torqueGain(z).toFixed(2)); rMid.set(Math.abs(model.shafts(job.inRpm, z)[1]).toFixed(1));
    };
    // Turn the wheels so that the teeth of each pair stay in mesh.
    const draw = () => {
      const b = Math.PI - Math.PI / z[1] - phase * z[0] / z[1];
      sA.rotation.z = phase; sB.rotation.z = b; sC.rotation.z = Math.PI - Math.PI / z[3] - b * z[2] / z[3];
      ghost.rotation.z = state === 'match' || done ? sC.rotation.z : tPhase;
    };
    // New tooth counts: rebuild the wheel and slide the shafts so the teeth still touch, keeping the train centred.
    const change = (i, v) => {
      v = Math.max(ZMIN, Math.min(ZMAX, Math.round(v)));
      if (z[i] !== v || !gears[i].geometry.attributes.position) { z[i] = v; gears[i].geometry.dispose(); gears[i].geometry = gearGeo(THREE, v, v * MOD, 0.16); }
      layout(); if (!done) { state = 'idle'; lamp.material = lampIdle; } refresh(); draw();
    };
    const layout = () => {
      const r = z.map((n) => n * MOD), xa = 0, xb = r[0] + r[1], xc = xb + r[2] + r[3];
      const lo = Math.min(xa - r[0], xb - r[1], xb - r[2], xc - r[3], xc - 1), hi = Math.max(xa + r[0], xb + r[1], xb + r[2], xc + Math.max(r[3], 1)), off = -(lo + hi) / 2;
      sA.position.set(xa + off, Y, 0); sB.position.set(xb + off, Y, 0); sC.position.set(xc + off, Y, 0); ghost.position.copy(sC.position);
      [sA, sB, sC].forEach((s, j) => { posts[j].position.x = s.position.x; });
      const top = (i) => Y + r[i] + 0.34;
      tags[0].position.set(sA.position.x, top(0), ZF); tags[1].position.set(sB.position.x - (r[1] > r[2] ? 0 : 0.2), top(1), ZF); tags[2].position.set(sB.position.x + 0.2, Y - r[2] - 0.3, ZB + 0.3); tags[3].position.set(sC.position.x, Y - r[3] - 0.3, ZB + 0.3);
      inTag.position.set(sA.position.x, Y - r[0] - 0.36, 1.0); outTag.position.set(sC.position.x, Math.min(4.6, Y + Math.max(r[3], 1) + 0.75), 0.8); lamp.position.set(sC.position.x, Math.min(4.2, Y + Math.max(r[3], 1) + 0.3), 0.78);
    };
    const names = ['Gear 1 teeth (on the input shaft)', 'Gear 2 teeth (driven by gear 1)', 'Gear 3 teeth (same shaft as gear 2)', 'Gear 4 teeth (on the output shaft)'];
    sliders = job.free.map((i) => ui.slider({ label: names[i], min: ZMIN, max: ZMAX, step: 1, value: z[i], unit: 'teeth', onInput: (v) => change(i, v) }));
    const lock = () => {
      if (done) return;
      tries++; t = 0; state = 'test'; lamp.material = lampIdle;
      ctx.say('Watch the two spinners on the output shaft: the gold one is your output and the pale blue one turns at the target speed.');
    };
    ui.button('🔒 Lock it in', lock, 'btn');
    // tapping a free gear adds one tooth (the sliders can do the same and more)
    job.free.forEach((i, k) => ctx.onTap(gears[i], () => { const v = z[i] >= ZMAX ? ZMIN : z[i] + 1; change(i, v); sliders[k].set(v); }));
    ui.note(`The input shaft turns at ${job.inRpm} rpm. Make the output turn at ${job.target} rpm (within 4 %). Gears 2 and 3 are fixed to the same shaft, so they always turn together. ${job.free.length === 2 ? `Gears 3 and 4 are already fitted (${z[2]} and ${z[3]} teeth): choose gears 1 and 2.` : 'Choose all four gears: the two pairs multiply.'} For each pair, speed out = speed in × driver teeth ÷ driven teeth.`);
    z.forEach((v, i) => change(i, v));
    ctx.say(`The crank turns at ${job.inRpm} rpm. Pick the teeth so the gold spinner keeps pace with the pale blue one at ${job.target} rpm, then lock it in.`);

    const verdict = () => {
      const o = model.out(job.inRpm, z), err = model.error(job.inRpm, z, job.target), mid = Math.abs(model.shafts(job.inRpm, z)[1]);
      if (err <= TOL) {
        done = true; state = 'match'; lamp.material = lampGood;
        ctx.say(`Locked in! ${job.inRpm} rpm × ${z[0]}/${z[1]} = ${mid.toFixed(1)} rpm on the middle shaft, then × ${z[2]}/${z[3]} = ${o.toFixed(1)} rpm out. A small gear driving a big gear slows things down but makes more torque: here the output turns ${model.torqueGain(z).toFixed(1)} times harder. Two stages multiply the ratios.`);
        ctx.complete(tries <= 2 ? 1 : 0.85, `out=${o.toFixed(2)} rpm, target=${job.target}, tries=${tries}`);
      } else {
        const fast = o > job.target; state = 'idle'; lamp.material = fast ? lampFast : lampSlow;
        ctx.say(`Output is ${o.toFixed(1)} rpm but the target is ${job.target} rpm. ${fast ? 'Too fast: the gold spinner runs ahead. Make a driven gear (2 or 4) bigger, or a driver gear smaller. A bigger driven gear needs more teeth to pass for one turn, so it turns more slowly.' : 'Too slow: the gold spinner falls behind. Make a driven gear (2 or 4) smaller, or a driver gear bigger. Fewer teeth on the driven gear means it gets round sooner.'}`);
      }
    };
    return {
      step(dt) {
        phase += job.inRpm * RAD * SLOW * dt; tPhase += job.target * RAD * SLOW * dt;
        const lap = Math.PI * 2 * z[1] * z[3]; if (phase > lap) phase -= lap;            // a whole number of turns for every shaft
        if (state === 'test') { t += dt; if (t >= 2.5) verdict(); }
      },
      frame(dt, time) { draw(); if (done && !ctx.calm) lamp.scale.setScalar(1 + Math.sin(time * 5) * 0.12); },
      // Shows a successful run without the player (used by tests).
      autoplay() { const b = model.solve(job, z); job.free.forEach((i, k) => { change(i, b.z[i]); sliders[k].set(b.z[i]); }); lock(); },
      dispose() { for (const g of gears) g.geometry.dispose(); axle.dispose(); knobG.dispose(); bladeG.dispose(); hubG.dispose(); ringG.dispose(); },
    };
  },
};
