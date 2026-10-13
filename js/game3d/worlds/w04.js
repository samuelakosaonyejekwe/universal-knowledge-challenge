// World 4 — Aerospace and Aeronautical Engineering: the Flight Academy.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: the lift and drag equations for a small training aeroplane in a wind tunnel -----
const RHO0 = 1.225;                 // air density at sea level, kg/m³
const WEIGHT = 1000 * 9.81;         // a 1,000 kg aeroplane, N
const STALL = 15;                   // angle of attack where the wing stalls, degrees
const CD0 = 0.03;                   // drag coefficient at zero lift
const K = 1 / (Math.PI * 7 * 0.8);  // induced drag factor: aspect ratio 7, efficiency 0.8
export const model = {
  RHO0, WEIGHT, STALL, CD0, K,
  // Standard atmosphere (troposphere): density in kg/m³ at a height in metres.
  density: (h) => RHO0 * (1 - 2.25577e-5 * h) ** 4.25588,
  // Simplified lift curve: a straight line (0.1 per degree, 0.2 at 0°) up to the stall, then a steady fall.
  cl: (a) => (a <= STALL ? 0.2 + 0.1 * a : Math.max(0.4, 1.7 - 0.12 * (a - STALL))),
  // Drag polar, with extra drag from the separated flow after the stall.
  cd(a) { const c = model.cl(a); return CD0 + K * c * c + (a > STALL ? 0.03 * (a - STALL) : 0); },
  lift: (rho, v, S, a) => 0.5 * rho * v * v * S * model.cl(a),          // N
  drag: (rho, v, S, a) => 0.5 * rho * v * v * S * model.cd(a),          // N
  // The airspeed at which lift equals weight.
  takeoff: (rho, S, a) => Math.sqrt(2 * WEIGHT / (rho * S * model.cl(a))),
};
// Used by the automated tests: the lift equation against numbers worked out by hand.
export function selfTest() {
  const L = model.lift(1.225, 30, 16, 10);                 // ½ × 1.225 × 30² × 16 × 1.2 = 10,584 N
  const L2 = model.lift(1.225, 60, 16, 10);                // double the speed: four times the lift
  const D = model.drag(1.225, 30, 16, 10);                 // 8,820 × (0.03 + 1.44 × 0.056841) = 986.5 N
  const rho = model.density(3000);                         // standard atmosphere: 0.909 kg/m³
  const v = model.takeoff(1.225, 16, 10);                  // √(19,620 / 23.52) = 28.88 m/s
  const ok = Math.abs(L - 10584) < 0.5 && Math.abs(L2 / L - 4) < 1e-9 && Math.abs(D - 986.5) < 1 && Math.abs(rho - 0.909) < 0.002 && Math.abs(v - 28.88) < 0.01
    && Math.abs(model.cl(15) - 1.7) < 1e-9 && Math.abs(model.cl(20) - 1.1) < 1e-9 && model.cl(20) < model.cl(15) && model.cl(25) < model.cl(20) && model.lift(1.225, 30, 16, 20) < model.lift(1.225, 30, 16, 15);
  return { ok, detail: `lift ${L.toFixed(0)} N (hand 10584), ×${(L2 / L).toFixed(2)} at double speed, drag ${D.toFixed(1)} N (hand 986.5), C_L 15° ${model.cl(15).toFixed(2)} → 20° ${model.cl(20).toFixed(2)}, ρ(3 km) ${rho.toFixed(3)} kg/m³, take-off ${v.toFixed(2)} m/s` };
}

const sim = {
  title: 'Wind tunnel take-off',
  goal: 'Turn on the wind and set the airspeed and the angle of the wing so that lift is bigger than the weight of the aeroplane. Keep it flying for three seconds without stalling.',
  kind: 'validated',
  model: 'The lift equation L = ½ρv²S·C_L and the drag equation D = ½ρv²S·C_D for a 1,000 kg training aeroplane (weight 9,810 N), with air density from the standard atmosphere. The lift equation is checked against numbers worked out by hand. The lift curve is simplified: C_L = 0.2 + 0.1 for each degree up to a stall at 15°, then it falls steadily. Drag uses C_D = 0.03 + C_L²/(π × 7 × 0.8), plus extra drag after the stall. It leaves out flaps, the propeller wash, ground effect, gusts, air squashing at high speed, and the slow, smooth way a real wing stalls. The streamlines are a drawing of the flow, not a calculation.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, lv = ctx.level, calm = !!ctx.calm;
    const limit = lv >= 5 ? 1300 : lv >= 3 ? 1500 : 0;                    // most drag the engine can beat, N
    const hMin = lv >= 6 ? 4000 : 3000;
    // the tunnel: floor, glass roof, legs, fan ring and guide rod
    const steel = ctx.mat('#5b6b82', { metalness: 0.5, roughness: 0.4 }), pale = ctx.mat('#e8eef5', { roughness: 0.5 });
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    add(new THREE.BoxGeometry(7, 0.2, 2.2), pale, 0, 0.5, 0);
    add(new THREE.BoxGeometry(7, 0.08, 2.2), ctx.mat('#bfe6ff', { transparent: true, opacity: 0.3, roughness: 0.1 }), 0, 4.2, 0);
    for (const sx of [-3, 3]) add(new THREE.BoxGeometry(0.4, 0.4, 1.8), steel, sx, 0.2, 0);
    add(new THREE.TorusGeometry(1.75, 0.12, 10, 40), steel, -3.4, 2.35, 0).rotation.y = Math.PI / 2;
    const fan = new THREE.Group(); fan.position.set(-3.4, 2.35, 0); group.add(fan);
    add(new THREE.SphereGeometry(0.22, 14, 10), steel, 0, 0, 0, fan);
    for (let i = 0; i < 3; i++) { const b = add(new THREE.BoxGeometry(0.05, 1.5, 0.34), ctx.mat('#1f8fe5', { roughness: 0.4 }), 0, 0, 0, fan); b.geometry.translate(0, 0.8, 0); b.rotation.x = i * Math.PI * 2 / 3; }
    add(new THREE.CylinderGeometry(0.03, 0.03, 3.6, 8), steel, 0, 2.4, -0.02);
    // the model aeroplane: nose to the left, into the wind
    const holder = new THREE.Group(), plane = new THREE.Group(); group.add(holder); holder.add(plane);
    const white = ctx.mat('#ffffff', { roughness: 0.4 }), blue = ctx.mat('#1f8fe5', { roughness: 0.4 }), gold = ctx.mat('#ffd23f', { roughness: 0.4 });
    add(new THREE.CapsuleGeometry(0.16, 1.0, 6, 12), white, 0, 0, 0, plane).rotation.z = Math.PI / 2;
    const wing = add(new THREE.BoxGeometry(0.5, 0.06, 2.3), blue, -0.1, 0.02, 0, plane);
    add(new THREE.BoxGeometry(0.26, 0.04, 0.85), blue, 0.6, 0.04, 0, plane);
    add(new THREE.BoxGeometry(0.3, 0.36, 0.04), gold, 0.6, 0.22, 0, plane);
    add(new THREE.ConeGeometry(0.12, 0.2, 12), gold, -0.75, 0, 0, plane).rotation.z = Math.PI / 2;
    const prop = add(new THREE.BoxGeometry(0.03, 0.74, 0.09), steel, -0.8, 0, 0, plane);
    // force arrows: lift (green, up), weight (orange, down) and drag (red, along the wind)
    const arrow = (color, rz) => {
      const g = new THREE.Group(), m = ctx.lit(color, 0.9); g.rotation.z = rz; holder.add(g);
      const shaft = add(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), m, 0, 0, 0.3, g); shaft.geometry.translate(0, 0.5, 0);
      const head = add(new THREE.ConeGeometry(0.1, 0.22, 10), m, 0, 0, 0.3, g);
      return (len) => { g.visible = len > 0.04; shaft.scale.y = Math.max(0.01, len); head.position.y = len + 0.1; };
    };
    const liftA = arrow('#3fd07a', 0), weightA = arrow('#ff9a3c', Math.PI), dragA = arrow('#ff5d6c', -Math.PI / 2);
    weightA(0.9);
    // streamlines and the little arrows that ride along them
    const LINES = 7, PTS = 44, lines = [], darts = [];
    const dartM = ctx.lit('#5ad1ff', 1.1), dartStall = ctx.lit('#ffb057', 1.1);
    for (let i = 0; i < LINES; i++) {
      const pos = new Float32Array(PTS * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.8 })); line.frustumCulled = false; group.add(line);
      lines.push({ y0: 1.05 + i * 0.44, pos, geo, line });
      for (let j = 0; j < 2; j++) darts.push({ i, off: j * 3 + i * 0.83, m: add(new THREE.ConeGeometry(0.07, 0.24, 8), dartM, 0, 0, 0) });
    }

    let v = 15, alpha = 2, area = 16, height = lv >= 5 ? hMin : 0;
    let on = false, vNow = 0, h = 0, hold = 0, done = false, idle = 0, dirty = false, travel = 0, tries = 0, L = 0, D = 0, rho = model.density(height);
    const touched = () => { idle = 0; dirty = true; };
    const vS = ui.slider({ label: 'Airspeed', min: 0, max: 80, step: 0.5, value: v, unit: 'm/s', onInput: (x) => { v = x; touched(); } });
    const aS = ui.slider({ label: 'Angle of attack', min: -2, max: 25, step: 0.5, value: alpha, unit: '°', onInput: (x) => { alpha = x; touched(); } });
    const sS = lv >= 3 ? ui.slider({ label: 'Wing area', min: 10, max: 24, step: 1, value: area, unit: 'm²', onInput: (x) => { area = x; touched(); } }) : null;
    const hS = lv >= 5 ? ui.slider({ label: 'Airfield height', min: hMin, max: 6000, step: 250, value: height, unit: 'm', onInput: (x) => { height = x; rho = model.density(height); touched(); } }) : null;
    const rL = ui.readout('Lift, N'), rW = ui.readout('Weight, N'), rD = ui.readout(limit ? `Drag, N (limit ${limit})` : 'Drag, N'), rC = ui.readout('Lift coefficient C_L'), rR = ui.readout('Air density, kg/m³'), rV = ui.readout('Wind now, m/s'), rH = ui.readout('Flying for, s');
    const start = () => { on = !on; touched(); if (on) tries++; };
    ui.button('💨 Wind on / off', start, 'btn');
    ui.note(`Lift = ½ × air density × speed² × wing area × C_L. Green arrow: lift. Orange arrow: weight (${WEIGHT.toLocaleString('en')} N). Red arrow: drag.${limit ? ` The engine can only beat ${limit.toLocaleString('en')} N of drag.` : ''}${lv >= 5 ? ' This airfield is high up, where the air is thinner.' : ''}`);
    rW.set(Math.round(WEIGHT)); rR.set(rho.toFixed(3));
    ctx.say(lv >= 5 ? 'The air is thin up here, so the wing has less to push against. Turn on the wind and find a speed and angle that still lift the aeroplane.' : 'Turn on the wind, then raise the airspeed and tilt the wing. Watch the green lift arrow grow past the orange weight arrow.');
    const N = (x) => Math.round(x).toLocaleString('en');
    const status = () => (alpha > STALL ? 'stall' : L <= WEIGHT ? 'slow' : limit && D > limit ? 'drag' : 'fly');
    const explain = (key) => {
      if (key === 'stall') ctx.say(`At ${alpha}° the wing has stalled. The air cannot follow the top of the wing any more, so it tumbles: lift drops to ${N(L)} N and drag grows. Stay at ${STALL}° or less.`);
      else if (key === 'slow') ctx.say(`Lift is ${N(L)} N, but the aeroplane weighs ${N(WEIGHT)} N. Speed counts twice in the lift equation: twice the speed gives four times the lift. ${alpha < 12 ? 'A little more angle helps too.' : 'More speed is the best help now.'}`);
      else if (key === 'drag') ctx.say(`It lifts, but drag is ${N(D)} N and the engine can only beat ${N(limit)} N. Drag grows with speed squared as well, so try less speed with a little more angle${sS ? ', or a bigger wing' : ''}.`);
      else ctx.say(`Lift ${N(L)} N is more than weight ${N(WEIGHT)} N. Hold it steady...`);
    };
    // The drawn path of one streamline at tunnel position x (−3…3) that starts at height y0.
    const flowY = (x, y0, py, cl, stall, t) => {
      const d = y0 - py, near = Math.exp(-d * d / 0.9) * Math.min(1, vNow / 10);
      const around = (d >= 0 ? 1 : -1) * 0.16 * Math.exp(-x * x / 0.5);
      const turn = -0.3 * cl * (0.5 + 0.5 * Math.tanh(2.2 * x)) + 0.12 * cl * Math.exp(-((x + 0.9) ** 2) / 0.5);
      const wake = stall * (d > 0 ? 1 : 0.3) * (calm ? 0.05 : 0.13) * Math.sin(9 * x - 11 * t + y0 * 5) * (0.5 + 0.5 * Math.tanh(3 * x));
      return y0 + near * (around + turn + wake);
    };
    return {
      step(dt) {
        const target = on ? v : 0; vNow += Math.max(-25 * dt, Math.min(25 * dt, target - vNow)); idle += dt;
        L = model.lift(rho, vNow, area, alpha); D = model.drag(rho, vNow, area, alpha);
        rL.set(N(L)); rD.set(N(D)); rC.set(model.cl(alpha).toFixed(2)); rR.set(rho.toFixed(3)); rV.set(vNow.toFixed(1));
        const up = L > WEIGHT ? Math.min(1.35, 0.3 + (L / WEIGHT - 1) * 1.3) : 0;
        h += (up - h) * Math.min(1, dt * 2.5);
        if (!on || done) { hold = 0; rH.set(done ? '3.0' : '–'); return; }
        const settled = Math.abs(vNow - v) < 0.3, key = status();
        if (settled && key === 'fly') hold += dt; else hold = 0;
        rH.set(hold.toFixed(1));
        if (settled && dirty && idle > 0.6) { dirty = false; explain(key); }
        if (hold >= 3) {
          done = true; const spare = L / WEIGHT, neat = spare < 1.6;
          ctx.say(`Take-off! Lift ${N(L)} N beat weight ${N(WEIGHT)} N at ${v} m/s and ${alpha}°, with air density ${rho.toFixed(2)} kg/m³. ${neat ? 'Just enough lift and little drag: a tidy take-off.' : 'That is far more lift than needed, so the engine is fighting extra drag. A slower, gentler setting would also fly.'}`);
          ctx.complete(neat ? 1 : 0.8, `L/W=${spare.toFixed(2)}, v=${v}, a=${alpha}, S=${area}, h=${height}, tries=${tries}`);
        }
      },
      frame(dt, time) {
        const t = time || 0, stalled = alpha > STALL, flow = Math.min(1, vNow / 10), cl = model.cl(alpha), py = 1.6 + h;
        fan.rotation.x += dt * vNow * 0.5; prop.rotation.x += dt * (2 + vNow * 0.6); travel += dt * vNow * 0.05;
        const shake = stalled && !calm ? Math.sin(t * 23) * 0.03 * flow : 0;
        holder.position.set(0, py + shake, 0); plane.rotation.z = -alpha * Math.PI / 180 + shake;
        const sc = Math.sqrt(area / 16); wing.scale.set(sc, 1, sc);
        liftA(Math.min(2.2, 0.9 * L / WEIGHT)); dragA(Math.min(1.8, 3.6 * D / WEIGHT));
        const st = stalled ? flow : 0;
        for (const ln of lines) {
          for (let i = 0; i < PTS; i++) { const x = -3 + 6 * i / (PTS - 1); ln.pos[i * 3] = x; ln.pos[i * 3 + 1] = flowY(x, ln.y0, py, cl, st, t); ln.pos[i * 3 + 2] = 0.3; }
          ln.geo.attributes.position.needsUpdate = true; ln.line.material.opacity = 0.2 + 0.6 * flow;
        }
        for (const d of darts) {
          const y0 = lines[d.i].y0, x = -3 + ((d.off + travel) % 6), y = flowY(x, y0, py, cl, st, t), slope = (flowY(x + 0.05, y0, py, cl, st, t) - flowY(x - 0.05, y0, py, cl, st, t)) / 0.1;
          d.m.position.set(x, y, 0.3); d.m.rotation.z = -Math.PI / 2 + Math.atan(slope); d.m.visible = flow > 0.03; d.m.scale.setScalar(0.6 + 0.6 * Math.min(1, vNow / 50));
          d.m.material = stalled && y0 > py && x > 0 ? dartStall : dartM;
        }
      },
      // Shows a successful run without the player (used by tests).
      autoplay() {
        alpha = lv >= 5 ? 8 : 10; aS.set(alpha);
        v = Math.ceil(model.takeoff(rho, area, alpha) * Math.sqrt(1.15) * 2) / 2; vS.set(v);
        done = false; hold = 0; if (!on) start();
      },
      get state() { return done ? 'flown' : on ? status() : 'ready'; },
    };
  },
};

export default {
  id: 4,
  theme: {
    sky: ['#1668d8', '#5ad1ff', '#eaf8ff'], fog: '#d4efff', fogNear: 60, fogFar: 190,
    ground: '#86cf86', ground2: '#a3dd9c', side: '#b9a98f', stone: '#e8eef5', accent: '#1f8fe5', glow: '#ffd23f', metal: '#5b6b82', wood: '#c08a4e', leaf: '#4fbf73', water: '#5ad1ff', crate: '#ffb057',
    sun: '#fffbe8', sunPower: 2.8, ambient: 1.5, skyLight: '#e3f5ff', groundLight: '#9fc7e8', sunDir: [0.25, 1, 0.2], particles: 'dust',
  },
  layout: { shape: 'chain', mirror: -1, stones: 5, rise: 0.4, towerH: 6.5 },
  story: {
    title: 'The Flight Academy',
    crystal: 'wing badges', crystalEm: '🛩️',
    intro: ['Welcome to the Flight Academy, high above the clouds! Today was meant to be our first take-off of the year.', 'But a big gust blew our five wing badges across the sky islands, and the little blue trainer cannot leave the wind tunnel until we understand its wing.'],
    remind: 'The wing badges glow gold. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five wing badges! Now ride the lift from the tower to the wind tunnel and find out what makes our trainer fly.',
    afterSim: 'It flew! Now only the Chief Test Pilot stands between you and the portal. The arena is up the steps.',
    notReady: 'The arena is for pilots who have done their checks. Bring all five wing badges and fly the trainer in the wind tunnel first.',
    rival: ['So the tunnel lifted your model. A fan can do that. Can you tell me why it flew?', 'We each build a bridge of light, one piece for every right answer. Let us see who lands on the far side first.'],
    win: ['Your bridge touched down before mine. Clear thinking, pilot. The portal is yours.'],
    lose: ['My bridge has landed and yours is still in the air. Read the tablets again, then come back and fly against me.'],
    outro: 'The badges are home, the trainer has flown, and the Chief Test Pilot has tipped a cap to you. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, white = k.mat('#ffffff', { roughness: 0.5 }), blue = k.mat('#1f8fe5', { roughness: 0.5 }), gold = k.mat('#ffd23f', { roughness: 0.5 }), steel = k.mat('#5b6b82', { metalness: 0.4, roughness: 0.4 });
    // the runway down the middle of the home island, with centre stripes and edge lights
    k.mesh(new THREE.BoxGeometry(3, 0.04, 16), k.mat('#56637a', { roughness: 0.95 }), 0, 0.03, -0.5).castShadow = false;
    for (const z of [-6.5, -2.5, 1.5, 5.5]) k.mesh(new THREE.BoxGeometry(0.3, 0.02, 1.8), white, 0, 0.06, z).castShadow = false;
    const beacons = [];
    for (const z of [-7, -0.5, 6]) for (const x of [-1.8, 1.8]) { const b = k.mesh(new THREE.SphereGeometry(0.11, 10, 8), k.lit('#ffd23f', 1.4), x, 0.1, z); b.castShadow = false; beacons.push(b); }
    k.animate((dt, t) => { beacons.forEach((b, i) => b.scale.setScalar(1 + 0.35 * Math.max(0, Math.sin(t * 3 - (i >> 1) * 1.2)))); });
    // the hangar: a solid hall with a rounded roof and a big door facing the runway
    k.block(7.2, 2, 0, 2.4, 2, 3.6, { color: '#e8eef5' });
    k.mesh(new THREE.CylinderGeometry(1.8, 1.8, 2.4, 18, 1, false, 0, Math.PI), blue, 7.2, 2, 0).rotation.z = Math.PI / 2;
    k.mesh(new THREE.BoxGeometry(0.06, 1.6, 2.5), k.mat('#33506e', { roughness: 0.6 }), 5.98, 0.8, 0);
    // a small trainer aeroplane parked beside the runway; its propeller turns
    const plane = k.add(new THREE.Group()); plane.position.set(-6, 0.62, -4.6); plane.rotation.y = -0.9;
    k.mesh(new THREE.CapsuleGeometry(0.3, 1.9, 6, 12), white, 0, 0, 0, plane).rotation.z = Math.PI / 2;
    k.mesh(new THREE.BoxGeometry(0.8, 0.08, 3.4), blue, -0.25, 0.3, 0, plane);
    k.mesh(new THREE.BoxGeometry(0.45, 0.06, 1.3), blue, 1.1, 0.1, 0, plane);
    k.mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), gold, 1.1, 0.4, 0, plane);
    k.mesh(new THREE.ConeGeometry(0.2, 0.35, 12), gold, -1.4, 0, 0, plane).rotation.z = Math.PI / 2;
    const prop = k.mesh(new THREE.BoxGeometry(0.04, 1.3, 0.14), steel, -1.5, 0, 0, plane);
    k.animate((dt) => { prop.rotation.x += dt * 9; });
    // the windsock swings and lifts with the breeze
    k.mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8), steel, 6.2, 1.6, 5.6);
    const sock = k.add(new THREE.Group()); sock.position.set(6.2, 3.1, 5.6);
    for (let i = 0; i < 3; i++) k.mesh(new THREE.CylinderGeometry(0.2 - i * 0.05, 0.26 - i * 0.05, 0.55, 10, 1, true), k.mat(i % 2 ? '#ffffff' : '#ff8a3c', { side: THREE.DoubleSide }), 0.3 + i * 0.55, 0, 0, sock).rotation.z = -Math.PI / 2;
    k.animate((dt, t) => { sock.rotation.y = 0.5 + Math.sin(t * 0.7) * 0.55 + Math.sin(t * 2.3) * 0.08; sock.rotation.z = -0.18 + Math.sin(t * 1.9) * 0.07; });
    // the control tower on the middle island, with a glass cab and a blinking beacon
    const mid = S.mid, tx = -3.4, tz = mid[2] - 3.8;
    k.prop('column', tx, mid[1], tz, { s: 1.2, solid: true, color: '#ffffff' });
    k.mesh(new THREE.CylinderGeometry(1.05, 0.8, 0.9, 12), k.mat('#8fdcff', { roughness: 0.15, metalness: 0.2 }), tx, mid[1] + 4.3, tz);
    k.mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 12), blue, tx, mid[1] + 4.82, tz);
    k.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), steel, tx, mid[1] + 5.4, tz);
    const blink = k.mesh(new THREE.SphereGeometry(0.13, 10, 8), k.lit('#ff5d6c', 1.6), tx, mid[1] + 6, tz); blink.castShadow = false;
    k.animate((dt, t) => { blink.scale.setScalar(Math.sin(t * 2.4) > 0.2 ? 1.25 : 0.7); });
    // the wind tunnel island, the arena and the far side
    k.prop('pillar', S.sim[0] + 5.2, S.sim[1], S.sim[2] + 5, { solid: true }); k.prop('banner', S.sim[0] - 6.4, S.sim[1], S.sim[2] - 1.2, { color: '#ffd23f' });
    for (const a of [0.5, 2.64]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6);
    for (const sx of [-3.4, 3.4]) k.prop('banner', S.end[0] + sx, S.end[1], S.end[2] - 1.5, { color: sx < 0 ? '#ff8a3c' : '#1f8fe5' });
    // hot-air balloons drift in the sky
    const balloons = [[-44, 24, 34, '#ff6b5a', '#ffd23f'], [30, 33, 78, '#8a5cf6', '#ffffff']].map(([x, y, z, c1, c2], i) => {
      const g = k.add(new THREE.Group()); g.position.set(x, y, z);
      const env = k.mesh(new THREE.SphereGeometry(4, 20, 14), k.mat(c1, { roughness: 0.7, fog: false }), 0, 0, 0, g); env.scale.y = 1.15; env.castShadow = false;
      const band = k.mesh(new THREE.TorusGeometry(3.95, 0.5, 8, 28), k.mat(c2, { roughness: 0.7, fog: false }), 0, 0.3, 0, g); band.rotation.x = Math.PI / 2; band.castShadow = false;
      k.mesh(new THREE.BoxGeometry(1.3, 1, 1.3), k.mat('#c08a4e', { fog: false }), 0, -6.2, 0, g).castShadow = false;
      return { g, x, y, z, i };
    });
    k.animate((dt, t) => { for (const b of balloons) { b.g.position.set(b.x + Math.sin(t * 0.05 + b.i * 2) * 8, b.y + Math.sin(t * 0.3 + b.i) * 1.2, b.z + Math.cos(t * 0.04 + b.i) * 6); b.g.rotation.y = t * 0.05; } });
    // a sea of clouds far below the islands
    const deck = k.add(new THREE.Group()), puff = k.mat('#ffffff', { roughness: 1, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.3 });
    for (const [x, y, z, r] of [[-14, -9, -6, 7], [15, -11, 8, 9], [-24, -10, 26, 8], [8, -9, 34, 7], [-40, -12, 52, 10], [-4, -11, 62, 9], [-30, -8, 82, 8], [-8, -10, 96, 9], [-46, -11, 108, 10]]) { const c = k.mesh(new THREE.SphereGeometry(r, 14, 10), puff, x, y, z, deck); c.scale.y = 0.32; c.castShadow = false; c.receiveShadow = false; }
    k.animate((dt, t) => { deck.position.x = Math.sin(t * 0.03) * 6; });
  },
  sim,
};
