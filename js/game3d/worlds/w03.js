// World 3 — Mechanical and Manufacturing Engineering: the Sunset Skyworks.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: a motor, two pairs of gears and a rope drum -----
const MOTOR = { torque: 2.4, rpm: 600 };      // N·m and revolutions per minute (about 151 W)
const DRUM_R = 0.05;                          // rope drum radius, m
const G0 = 9.81;                              // m/s², used only to show the load's mass in kg
const HEIGHT = 3;                             // how far the load must be lifted, m
const TEETH = { driver: [10, 40], driven: [20, 80], step: 2 };
const RAD = Math.PI * 2 / 60;                 // rpm → rad/s
export const model = {
  MOTOR, DRUM_R,
  // Gear ratio of one pair: teeth on the driven gear ÷ teeth on the gear that drives it.
  ratio: (driver, driven) => driven / driver,
  // One pair of gears: torque is multiplied by the ratio (less friction), speed is divided by it.
  stage(torque, rpm, driver, driven, eff = 1) { const r = driven / driver; return { ratio: r, torque: torque * r * eff, rpm: rpm / r }; },
  power: (torque, rpm) => torque * rpm * RAD,                                            // W
  // Motor → gear 1 → gear 2, then (on the same shaft) gear 3 → gear 4 on the drum.
  train(n1, n2, n3, n4, eff = 1) {
    const a = model.stage(MOTOR.torque, MOTOR.rpm, n1, n2, eff), b = model.stage(a.torque, a.rpm, n3, n4, eff);
    return { ratio: a.ratio * b.ratio, eff: eff * eff, torque: b.torque, rpm: b.rpm, midRpm: a.rpm };
  },
  // The drum winds a rope that holds a load of `load` newtons.
  hoist(tr, load) {
    const pull = tr.torque / DRUM_R, speed = tr.rpm * RAD * DRUM_R, lifts = pull >= load - 1e-9;
    const motorTorque = load * DRUM_R / (tr.ratio * tr.eff), powerOut = lifts ? load * speed : 0;
    return { pull, speed, lifts, motorTorque, powerOut, powerIn: powerOut / tr.eff };
  },
  // The job for each level: heavier loads, more friction in each pair of gears, and a tighter speed target.
  task(level) {
    const L = Math.min(6, Math.max(1, level | 0)), eff = 1 - 0.02 * (L - 1), load = 250 + 50 * L;
    const fastest = model.power(MOTOR.torque, MOTOR.rpm) * eff * eff / load;             // no gear train can beat this speed
    return { eff, load, target: Math.floor((0.6 + 0.05 * L) * fastest * 100) / 100, fastest };
  },
  // The fastest set of gears that still lifts the load (null if there is none).
  best(level) {
    const k = model.task(level); let win = null;
    for (let n1 = TEETH.driver[0]; n1 <= TEETH.driver[1]; n1 += TEETH.step) for (let n2 = TEETH.driven[0]; n2 <= TEETH.driven[1]; n2 += TEETH.step)
      for (let n3 = TEETH.driver[0]; n3 <= TEETH.driver[1]; n3 += TEETH.step) for (let n4 = TEETH.driven[0]; n4 <= TEETH.driven[1]; n4 += TEETH.step) {
        const tr = model.train(n1, n2, n3, n4, k.eff), h = model.hoist(tr, k.load);
        if (h.pull >= k.load * 1.01 && h.speed >= k.target && (!win || h.speed > win.speed)) win = { n: [n1, n2, n3, n4], speed: h.speed };
      }
    return win;
  },
};
// Used by the automated tests: known gear results, and energy must be conserved.
export function selfTest() {
  const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const one = model.stage(MOTOR.torque, MOTOR.rpm, 20, 60);                               // 20 → 60 teeth: three times the torque, a third of the speed
  const ideal = model.train(20, 60, 15, 45, 1), lossy = model.train(20, 60, 15, 45, 0.9);
  const pIn = model.power(MOTOR.torque, MOTOR.rpm), pIdeal = model.power(ideal.torque, ideal.rpm), pLossy = model.power(lossy.torque, lossy.rpm);
  const h = model.hoist(ideal, 300), hl = model.hoist(lossy, 300);
  let solvable = true; for (let L = 1; L <= 6; L++) if (!model.best(L)) solvable = false;
  const ok = near(one.ratio, 3) && near(one.torque, 7.2) && near(one.rpm, 200) && near(ideal.ratio, 9) && near(pIdeal, pIn) && near(pLossy / pIn, 0.81)
    && near(h.pull, 432) && near(h.speed, 600 / 9 * RAD * 0.05) && near(h.powerIn, h.powerOut) && near(h.motorTorque * MOTOR.rpm * RAD, h.powerIn) && near(hl.powerOut / hl.powerIn, 0.81) && solvable;
  return { ok, detail: `20→60 teeth: ${one.torque.toFixed(1)} N·m at ${one.rpm.toFixed(0)} rpm (×3, ÷3); two stages ×${ideal.ratio.toFixed(0)}: ${pIn.toFixed(1)} W in, ${pIdeal.toFixed(1)} W out at 100 %, ${pLossy.toFixed(1)} W out at 90 % per stage; pull ${h.pull.toFixed(0)} N at ${h.speed.toFixed(3)} m/s; levels 1–6 solvable: ${solvable}` };
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
  hole(0, 0, root * 0.14);
  for (let i = 0; i < 5; i++) hole(Math.cos(i * 1.2566 + 0.6) * root * 0.58, Math.sin(i * 1.2566 + 0.6) * root * 0.58, root * 0.2);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 5 }); g.translate(0, 0, -depth / 2);
  return g;
}

const sim = {
  title: 'Gear train hoist',
  goal: 'Choose the number of teeth on four gears so the motor can lift the load, and lift it at least as fast as the target speed.',
  kind: 'validated',
  model: 'A motor that holds 600 rpm and can give up to 2.4 N·m drives a rope drum (radius 0.05 m) through two pairs of gears. For each pair, gear ratio = driven teeth ÷ driver teeth; torque is multiplied by the ratio and by the efficiency, speed is divided by the ratio, and power in = power out ÷ efficiency. It is checked against known results: 20 → 60 teeth gives three times the torque at a third of the speed, and power is conserved at 100 % efficiency. It leaves out the weight and stretch of the rope, the time the motor needs to speed up, tooth strength and wear, and the way a real motor slows down under load: here it either holds its speed or cannot turn at all.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, job = model.task(ctx.level), MOD = 0.014, Y = 1.55, XB = -0.9, ZD = -0.6, LX = 2.74;
    const brass = ctx.mat('#e3b341', { metalness: 0.65, roughness: 0.3 }), copper = ctx.mat('#d2743a', { metalness: 0.65, roughness: 0.32 }), iron = ctx.mat('#4a4038', { metalness: 0.5, roughness: 0.5 }), steel = ctx.mat('#b9b2a6', { metalness: 0.7, roughness: 0.3 });
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    add(new THREE.BoxGeometry(6.9, 0.2, 2.2), iron, 0, 0.1, -0.2);
    const n = [20, 20, 20, 20];
    // three shafts: the motor, the middle shaft (two gears) and the drum
    const sA = new THREE.Group(), sB = new THREE.Group(), sC = new THREE.Group(); group.add(sA, sB, sC);
    const gears = [add(new THREE.BufferGeometry(), brass, 0, 0, 0, sA), add(new THREE.BufferGeometry(), copper, 0, 0, 0, sB), add(new THREE.BufferGeometry(), brass, 0, 0, 0.17, sB), add(new THREE.BufferGeometry(), copper, 0, 0, 0.17, sC)];
    const axle = new THREE.CylinderGeometry(0.05, 0.05, 1, 10); axle.rotateX(Math.PI / 2);
    add(axle, steel, 0, 0, -0.2, sA).scale.z = 0.5; add(axle, steel, 0, 0, 0, sB).scale.z = 0.6; add(axle, steel, 0, 0, -0.35, sC).scale.z = 1.2;
    const drumGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.5, 20); drumGeo.rotateX(Math.PI / 2);
    add(drumGeo, ctx.mat('#7a4a2a', { roughness: 0.7 }), 0, 0, ZD, sC); add(new THREE.BoxGeometry(0.08, 0.54, 0.52), steel, 0, 0, ZD, sC);
    const motorGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 18); motorGeo.rotateX(Math.PI / 2);
    const motor = add(motorGeo, ctx.lit('#e0662a', 0.35, { metalness: 0.4 }), 0, Y, -0.6);
    const posts = [0, 1, 2].map(() => add(new THREE.BoxGeometry(0.16, Y, 0.14), iron, 0, Y / 2, -0.2));
    // the lifting frame, pulley, rope and load
    add(new THREE.BoxGeometry(0.18, 4.9, 0.18), iron, 3.3, 2.45, ZD); add(new THREE.BoxGeometry(1.1, 0.16, 0.18), iron, 2.85, 4.82, ZD);
    const pulley = add(new THREE.TorusGeometry(0.14, 0.05, 8, 18), steel, LX - 0.14, 4.6, ZD);
    add(new THREE.BoxGeometry(0.5, 0.05, 0.3), ctx.lit('#ffd76a', 1.2), 3.05, 0.2 + HEIGHT + 0.63, ZD).castShadow = false;       // the finish line
    const load = add(new THREE.BoxGeometry(0.7, 0.6, 0.7), ctx.mat('#f5a524', { roughness: 0.6 }), LX, 0.5, ZD);
    add(new THREE.BoxGeometry(0.72, 0.1, 0.72), iron, 0, 0, 0, load);
    const tag = ctx.sprite(`${job.load} N`, { size: 0.5 }); tag.position.set(0, 0, 0.6); load.add(tag);
    const ropePos = new Float32Array(9), ropeGeo = new THREE.BufferGeometry(); ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePos, 3));
    const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0xfff1d0 })); rope.frustumCulled = false; group.add(rope);

    let state = 'idle', phase = 0, h = 0, t = 0, tries = 0, tr = null, ho = null;
    const rRatio = ui.readout('Gear ratio (motor turns per drum turn)'), rTorque = ui.readout('Drum torque, N·m'), rPull = ui.readout('Rope pull, N'), rRpm = ui.readout('Drum speed, rpm'), rSpeed = ui.readout('Lifting speed, m/s'), rIn = ui.readout('Power in, W'), rOut = ui.readout('Power out, W'), rH = ui.readout('Height, m');
    const draw = () => {
      const [n1, n2, n3, n4] = n, a2 = Math.PI / n2 - phase * n1 / n2;
      sA.rotation.z = phase; sB.rotation.z = a2; sC.rotation.z = Math.PI / n4 - a2 * n3 / n4;
      load.position.y = 0.5 + h; pulley.rotation.z = -h / 0.14;
      ropePos.set([sC.position.x, Y + 0.27, ZD, LX - 0.14, 4.74, ZD, LX, 0.8 + h, ZD]); ropeGeo.attributes.position.needsUpdate = true;
    };
    const refresh = () => {
      tr = model.train(n[0], n[1], n[2], n[3], job.eff); ho = model.hoist(tr, job.load);
      rRatio.set(`${tr.ratio.toFixed(2)} = ${n[1]}/${n[0]} × ${n[3]}/${n[2]}`); rTorque.set(tr.torque.toFixed(1)); rPull.set(`${ho.pull.toFixed(0)} (load ${job.load})`);
      rRpm.set(tr.rpm.toFixed(1)); rSpeed.set(`${ho.speed.toFixed(3)} (target ${job.target.toFixed(2)})`); rIn.set(ho.lifts ? ho.powerIn.toFixed(1) : '0'); rOut.set(ho.lifts ? ho.powerOut.toFixed(1) : '0'); rH.set(h.toFixed(2));
    };
    // New tooth counts: rebuild the wheels and slide the shafts so the teeth still touch.
    const change = (i, v) => {
      n[i] = v; gears[i].geometry.dispose(); gears[i].geometry = gearGeo(THREE, v, v * MOD, 0.12);
      sB.position.set(XB, Y, 0); sA.position.set(XB - (n[0] + n[1]) * MOD, Y, 0); sC.position.set(XB + (n[2] + n[3]) * MOD, Y, 0);
      motor.position.x = sA.position.x; [sA, sB, sC].forEach((s, j) => { posts[j].position.x = s.position.x; });
      state = 'idle'; h = 0; t = 0; refresh(); draw();
    };
    const names = ['Gear 1 on the motor (driver)', 'Gear 2 (driven by gear 1)', 'Gear 3 on the same shaft (driver)', 'Gear 4 on the drum (driven)'];
    const sliders = names.map((label, i) => { const lim = i % 2 ? TEETH.driven : TEETH.driver; return ui.slider({ label, min: lim[0], max: lim[1], step: TEETH.step, value: n[i], unit: 'teeth', onInput: (v) => change(i, Math.round(v)) }); });
    const start = () => {
      refresh(); h = 0; t = 0; tries++;
      if (!ho.lifts) { state = 'stall'; ctx.say(`The motor cannot turn the drum. The rope pulls with ${ho.pull.toFixed(0)} N but the load weighs ${job.load} N. A bigger gear ratio multiplies the turning force: make a driven gear bigger or a driver gear smaller.`); }
      else if (ho.speed < job.target) { state = 'slow'; ctx.say('It is moving... watch how fast the load climbs.'); }
      else { state = 'lift'; ctx.say('The motor holds its speed and the load is rising.'); }
    };
    ui.button('⚙️ Start the hoist', start, 'btn');
    ui.note(`Motor: ${MOTOR.torque} N·m at ${MOTOR.rpm} rpm (${model.power(MOTOR.torque, MOTOR.rpm).toFixed(0)} W). Load: ${job.load} N (about ${(job.load / G0).toFixed(0)} kg), to be lifted ${HEIGHT} m at ${job.target.toFixed(2)} m/s or faster. Each pair of gears passes on ${(job.eff * 100).toFixed(0)} % of its power${job.eff < 1 ? '; friction turns the rest into heat' : ''}. A big gear driven by a small one turns more slowly but more strongly. The gears are drawn ten times slower than real so you can watch them.`);
    n.forEach((v, i) => change(i, v));
    ctx.say('Gears trade speed for force. Pick the teeth, then start the hoist: you need enough force to lift the load, but not so much gearing that it crawls.');
    return {
      step(dt) {
        if (state === 'idle' || state === 'done') return;
        t += dt;
        if (state === 'stall') { phase += ctx.calm ? 0 : Math.sin(t * 40) * 0.004 * Math.max(0, 1 - t); if (t > 1.2) state = 'idle'; return; }
        phase += MOTOR.rpm * RAD / 10 * dt; h = Math.min(HEIGHT, h + ho.speed * dt); rH.set(h.toFixed(2));
        if (state === 'slow' && t >= 5) {
          state = 'idle';
          ctx.say(`It lifts, but only at ${ho.speed.toFixed(3)} m/s: the ${HEIGHT} m climb would take ${(HEIGHT / ho.speed).toFixed(0)} seconds, and the target is ${job.target.toFixed(2)} m/s. This much gearing gives ${ho.pull.toFixed(0)} N of pull, more than the ${job.load} N you need, and you paid for it with speed. Try a smaller gear ratio.`);
        } else if (h >= HEIGHT) {
          state = 'done';
          ctx.say(`Up it goes: ${HEIGHT} m in ${t.toFixed(1)} s at ${ho.speed.toFixed(3)} m/s. The drum turns ${tr.ratio.toFixed(1)} times slower than the motor, and in return it turns ${(tr.ratio * tr.eff).toFixed(1)} times harder. Power in ${ho.powerIn.toFixed(0)} W, power out ${ho.powerOut.toFixed(0)} W${job.eff < 1 ? ': the difference warmed the gears through friction.' : ': these ideal gears lose nothing, so gears never make extra power, they only swap speed for force.'}`);
          ctx.complete(tries <= 2 ? 1 : tries <= 4 ? 0.85 : 0.7, `ratio=${tr.ratio.toFixed(2)}, v=${ho.speed.toFixed(3)}, tries=${tries}`);
        }
      },
      frame() { draw(); },
      // Shows a successful run without the player (used by tests).
      autoplay() { const b = model.best(ctx.level); b.n.forEach((v, i) => { change(i, v); sliders[i].set(v); }); start(); },
      dispose() { for (const g of gears) g.geometry.dispose(); ropeGeo.dispose(); },
      get state() { return state; },
    };
  },
};

export default {
  id: 3,
  theme: {
    sky: ['#4b3470', '#e8734a', '#ffd89a'], fog: '#e9966a', fogNear: 42, fogFar: 150,
    ground: '#b9713c', ground2: '#d08b4c', side: '#6b3a24', stone: '#dab78c', accent: '#e0662a', glow: '#ffc94d', metal: '#8a5a2b', wood: '#7a4a2a', leaf: '#93ad4c', water: '#3fa7a0', crate: '#f5a524',
    sun: '#ffc890', sunPower: 2.4, ambient: 1.2, skyLight: '#ffdcb4', groundLight: '#6b3a24', sunDir: [-0.7, 0.6, 0.3], particles: 'sparks',
  },
  layout: { shape: 'zigzag', mirror: -1, stones: 4, rise: 0.55, towerH: 6.5 },
  story: {
    title: 'The Sunset Skyworks',
    crystal: 'brass cogs', crystalEm: '⚙️',
    intro: ['Welcome to the Sunset Skyworks, the workshop above the clouds! Every wheel up here used to turn together.', 'This morning five brass cogs shook loose and rolled away across the islands. Now the big hoist has stopped, and a crate of parts is stuck on the ground.'],
    remind: 'The brass cogs shine like gold. Look over the stepping stones, in the lagoon, on top of the tower and near the hoist.',
    afterCrystals: 'All five cogs! Ride the lift from the tower to the hoist console and choose gears that can raise the crate.',
    afterSim: 'The crate is up and the wheels are turning. Only the Chief of the Workshop is left to meet: the arena is up the steps.',
    notReady: 'The arena is for makers who have finished the job. Bring all five brass cogs and get the hoist working first.',
    rival: ['So you made the hoist run. Good hands! Now show me you know why it works.', 'We each build a bridge of light, one piece for every right answer. Let us see whose bridge is finished first.'],
    win: ['Your bridge is finished before mine. You think like an engineer. The portal is yours.'],
    lose: ['My bridge is done and yours still has gaps. Read the tablets again, then come back and we will try once more.'],
    outro: 'The cogs are back in place, the hoist is lifting and the Chief of the Workshop has tipped a hat to you. The lesson is ready whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, brass = '#e3b341', copper = '#d2743a', iron = '#4a4038';
    const shiny = (c) => k.mat(c, { metalness: 0.65, roughness: 0.32 });
    // a flat gear wheel that turns; speed in turns of a 10-tooth wheel, so meshing wheels keep step
    const cogs = [];
    const cog = (x, y, z, r, teeth, color, dir, parent, material) => { const m = k.mesh(gearGeo(THREE, teeth, r, r * 0.22), material || shiny(color), x, y, z, parent); m.rotation.z = dir < 0 ? Math.PI / teeth : 0; cogs.push([m, dir * 10 / teeth, m.rotation.z]); return m; };
    k.animate((dt, t) => { for (const c of cogs) c[0].rotation.z = c[2] + t * c[1]; });
    const frame = (x, y, z, yaw) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; return k.add(g); };

    // home island: the workshop, a wall of meshing gears and an anvil
    k.prop('house', -5.5, 0, -5.5, { s: 0.9, yaw: Math.PI / 4, color: '#e9c9a0', solid: true });
    cog(0, 0, 0, 0.42, 10, brass, 1, frame(-4.75, 1.3, -4.75, Math.PI / 4));
    const wall = frame(-7.3, 0, 4.8, 2.15);
    k.mesh(new THREE.BoxGeometry(3.4, 3.6, 0.2), k.mat(iron), 0.1, 1.8, -0.25, wall);
    cog(-0.6, 1.5, 0, 0.9, 18, copper, 1, wall); cog(0.8, 1.5, 0, 0.5, 10, brass, -1, wall); cog(-0.6, 3.0, 0, 0.6, 12, brass, -1, wall);
    k.block(4.2, 0.4, -6.6, 0.6, 0.4, 0.45, { color: iron });
    k.mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), k.mat(iron), 4.2, 0.52, -6.6); k.mesh(new THREE.BoxGeometry(1.0, 0.24, 0.45), k.mat(iron), 4.2, 0.76, -6.6);
    k.mesh(new THREE.ConeGeometry(0.12, 0.5, 10), k.mat(iron), 4.95, 0.78, -6.6).rotation.z = -Math.PI / 2;
    k.prop('lamp', 3.4, 0, 7); k.prop('lamp', -3.4, 0, 7);

    // middle island: a conveyor carrying boxes, and two pistons pumping
    const mid = S.mid, cz = mid[2] - 4.1;
    k.block(-2.5, mid[1] + 0.7, cz, 2.8, 0.7, 0.8, { color: k.theme.metal });
    k.mesh(new THREE.BoxGeometry(2.8, 0.06, 0.66), k.mat('#2e2925', { roughness: 0.95 }), -2.5, mid[1] + 0.73, cz);
    const roller = new THREE.CylinderGeometry(0.38, 0.38, 0.72, 14); roller.rotateX(Math.PI / 2);
    const rollers = [-3.9, -1.1].map((x) => k.mesh(roller, shiny('#b9b2a6'), x, mid[1] + 0.38, cz));
    const boxes = [0, 1].map((i) => k.mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), k.mat(i ? '#f5a524' : '#e0662a'), 0, mid[1] + 0.97, cz));
    k.block(2.6, mid[1] + 0.35, mid[2] + 4.9, 2.0, 0.35, 0.8, { color: iron });
    const rods = [-0.5, 0.5].map((dx) => { k.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), shiny(copper), 2.6 + dx, mid[1] + 0.8, mid[2] + 4.9); return k.mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 10), shiny('#b9b2a6'), 2.6 + dx, mid[1] + 1.3, mid[2] + 4.9); });
    k.animate((dt, t) => {
      boxes.forEach((b, i) => { b.position.x = -3.7 + ((t * 0.5 + i * 1.2) % 2.4); });
      for (const r of rollers) r.rotation.z = -t * 1.3;
      rods.forEach((r, i) => { r.position.y = mid[1] + 1.45 + Math.sin(t * 2.2 + i * Math.PI) * 0.35; });
    });

    // far island: a crane that swings its arm, and pipes with a valve wheel up the tower
    const far = S.far;
    k.block(4.4, far[1] + 0.4, far[2] - 2.4, 1.0, 0.4, 1.0, { color: iron });
    k.mesh(new THREE.BoxGeometry(0.34, 4.8, 0.34), k.mat('#f5a524'), 4.4, far[1] + 2.8, far[2] - 2.4);
    const jib = frame(4.4, far[1] + 5.2, far[2] - 2.4, Math.PI / 2);
    k.mesh(new THREE.BoxGeometry(4.8, 0.24, 0.24), k.mat('#f5a524'), 1.3, 0, 0, jib); k.mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), k.mat(iron), -0.9, -0.1, 0, jib);
    const cable = k.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), k.mat('#fff1d0'), 3.4, -0.6, 0, jib); cable.castShadow = false;
    const hung = k.mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), k.mat(copper), 3.4, -1.4, 0, jib);
    k.animate((dt, t) => { jib.rotation.y = Math.PI / 2 + Math.sin(t * 0.3) * 0.7; const L = 1.5 + Math.sin(t * 0.45) * 0.6; cable.scale.y = L; cable.position.y = -L / 2; hung.position.y = -L - 0.25; });
    const TH = S.sim[1] - far[1];
    for (const dz of [1.8, 2.4]) k.mesh(new THREE.CylinderGeometry(0.11, 0.11, TH - dz * 0.6, 10), shiny(copper), 2.86, far[1] + (TH - dz * 0.6) / 2, far[2] + dz);
    const valve = k.mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 18), k.mat('#c0392b'), 3.02, far[1] + 1.5, far[2] + 1.8); valve.rotation.y = Math.PI / 2;
    k.animate((dt, t) => { valve.rotation.x = Math.sin(t * 0.8) * 1.5; });

    // simulation island: a friendly robot arm that waves, and a pair of big gears
    const sx = S.sim[0], sy = S.sim[1], sz = S.sim[2];
    k.block(sx - 6, sy + 0.5, sz - 1.2, 0.9, 0.5, 0.9, { color: iron });
    const turret = k.mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.4, 14), k.mat('#f5a524'), sx - 6, sy + 0.7, sz - 1.2);
    const upper = k.mesh(new THREE.BoxGeometry(0.22, 1.4, 0.22), k.mat('#e0662a'), 0, 0.8, 0, turret); upper.geometry.translate(0, 0.6, 0); upper.position.y = 0.2;
    const elbow = k.mesh(new THREE.SphereGeometry(0.19, 12, 10), shiny('#b9b2a6'), 0, 1.3, 0, upper);
    const fore = k.mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), k.mat('#f5a524'), 0, 0, 0, elbow); fore.geometry.translate(0, 0.55, 0);
    for (const dx of [-0.12, 0.12]) k.mesh(new THREE.BoxGeometry(0.06, 0.3, 0.14), k.mat(iron), dx, 1.22, 0, fore);
    k.animate((dt, t) => { turret.rotation.y = 1.2 + Math.sin(t * 0.5) * 0.5; upper.rotation.z = 0.35 + Math.sin(t * 0.8) * 0.12; elbow.rotation.z = -0.5 + Math.sin(t * 3.2) * 0.45; });
    const pair = frame(sx + 4.4, sy, sz + 5.4, Math.PI + 0.6);
    k.mesh(new THREE.BoxGeometry(0.2, 1.7, 0.2), k.mat(iron), 0, 0.85, -0.25, pair); k.mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), k.mat(iron), 1.5, 0.7, -0.25, pair);
    cog(0, 1.7, 0, 1.0, 20, copper, 1, pair); cog(1.5, 1.7, 0, 0.5, 10, brass, -1, pair);

    // arena: two gear posts
    for (const sgn of [-1, 1]) { const p = frame(S.arena[0] + sgn * 5.6, S.arena[1], S.arena[2] + 2.7, -sgn * 1.1); k.mesh(new THREE.CylinderGeometry(0.09, 0.14, 2.4, 8), k.mat(iron), 0, 1.2, -0.2, p); cog(0, 2.5, 0, 0.7, 14, sgn > 0 ? brass : copper, sgn, p); }

    // the setting sun, two great wheels in the sky and a few clouds
    const sunBall = k.mesh(new THREE.SphereGeometry(9, 24, 16), k.lit('#ffb45c', 1.6, { fog: false }), -62, 26, 78); sunBall.castShadow = false;
    const skyMat = k.mat('#b5632e', { metalness: 0.5, roughness: 0.5, fog: false }), far2 = frame(48, 30, 84, -1.9);
    cog(0, 0, 0, 14, 28, copper, 0.25, far2, skyMat).castShadow = false; cog(22, 0, 0, 8, 16, brass, -0.25, far2, skyMat).castShadow = false;
    k.prop('cloud', 16, 8, 30, { s: 1.7, color: '#ffc9a0' });
  },
  sim,
};
