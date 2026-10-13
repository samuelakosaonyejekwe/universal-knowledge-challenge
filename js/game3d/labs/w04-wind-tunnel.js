// World 4 lab — Wind Tunnel, in 3D: a wing section on a sliding carriage carries the aircraft's weight as a hanging
// load. Smoke lines bend round the wing; the wing floats at the green marks only when lift equals weight.
// No imports: everything arrives through ctx.

// ----- the model (the same as the 2D lab): L = ½ρv²S·C_L, with stall -----
const AIR = { sea: ['Sea level', 1.225], mid: ['5 km up', 0.736], high: ['10 km up', 0.414] };
const G = 9.81, STALL = 14;
// Lift coefficient for a cambered wing: linear in angle of attack, then stall.
export const cl = (deg) => (deg <= STALL ? 0.2 + 0.1 * deg : Math.max(0.5, 1.6 - 0.18 * (deg - STALL)));
export const cd = (c) => 0.02 + c * c / (Math.PI * 0.8 * 7);
export const lift = (rho, v, S, deg) => 0.5 * rho * v * v * S * cl(deg);
export const drag = (rho, v, S, deg) => 0.5 * rho * v * v * S * cd(cl(deg));

// Hand-worked: sea level, 30 m/s, 12 m², 4°: C_L = 0.2 + 0.4 = 0.6, L = 0.5 × 1.225 × 900 × 12 × 0.6 = 3969 N.
// C_D = 0.02 + 0.36 ÷ (π × 0.8 × 7) = 0.04046, D = 6615 × 0.04046 = 267.7 N. Double the speed: four times the lift.
export function selfTest() {
  const L = lift(1.225, 30, 12, 4), D = drag(1.225, 30, 12, 4), L2 = lift(1.225, 60, 12, 4);
  const ok = Math.abs(cl(4) - 0.6) < 1e-12 && Math.abs(L - 3969) < 1e-6 && Math.abs(cd(0.6) - 0.040463) < 1e-5 && Math.abs(D - 267.66) < 0.05 && Math.abs(L2 / L - 4) < 1e-12
    && Math.abs(cl(14) - 1.6) < 1e-12 && Math.abs(cl(16) - 1.24) < 1e-12 && cl(20) === 0.52 && cl(30) === 0.5 && Math.abs(lift(0.414, 30, 12, 4) / L - 0.414 / 1.225) < 1e-12;
  return { ok, detail: `sea level, 30 m/s, 12 m², 4°: C_L ${cl(4).toFixed(2)}, lift ${L.toFixed(0)} N (by hand 3969), drag ${D.toFixed(1)} N (by hand 267.7); twice the speed gives ${(L2 / L).toFixed(2)}× the lift; C_L 1.60 at 14°, ${cl(16).toFixed(2)} at 16° (stalled)` };
}

const kN = (n) => (n / 1000).toFixed(2);

export default {
  id: 'w04-wind-tunnel',
  world: 4,
  levels: [3, 4],
  title: 'Wind Tunnel',
  goal: 'Make the wing lift exactly the weight of the aircraft, without stalling.',
  kind: 'validated',
  model: 'A simple wing section: C_L rises about 0.1 per degree up to a 14 degree stall, then falls. Lift is L = ½ρv²S·C_L and drag uses C_D = 0.02 + C_L²/(π·e·AR) with AR = 7 and e = 0.8. Real wings also change with Mach number, flaps, wing shape and turbulence. The smoke lines are drawn to show the idea of the flow; they are not a calculation of the real air, and the drag arrow is drawn five times longer so that you can see it.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, calm = !!ctx.calm, lv = ctx.level || 3;
    // thicker air at the lower level, thin high-altitude air at the higher one
    const pool = lv >= 4 ? ['mid', 'high'] : ['sea', 'mid'], alt = pool[Math.floor(ctx.rng() * pool.length)], rho = AIR[alt][1];
    const mass = 400 + Math.floor(ctx.rng() * 12) * 100, W = mass * G;      // kg, N
    let v = 30, a = 4, S = 12, done = false, firstPick = null, tries = 0;

    const white = ctx.mat('#ffffff', { roughness: 0.45 }), blue = ctx.mat('#1f8fe5', { roughness: 0.5 }), gold = ctx.mat('#ffd23f', { roughness: 0.5 }), steel = ctx.mat('#5b6b82', { metalness: 0.4, roughness: 0.4 });
    const wingOk = ctx.mat('#e8eef5', { roughness: 0.35, metalness: 0.2 }), wingBad = ctx.mat('#ff7a8a', { roughness: 0.5 });
    const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

    // ----- the tunnel: a plinth, a fan, an open frame -----
    const CY = 2.5;
    add(new THREE.BoxGeometry(6.8, 0.2, 3.2), ctx.mat('#56637a', { roughness: 0.9 }), 0, 0.1, 0);
    for (const x of [-3.2, 3.2]) { const r = add(new THREE.TorusGeometry(1.5, 0.09, 10, 40), x < 0 ? blue : white, x, CY, 0); r.rotation.y = Math.PI / 2; add(new THREE.BoxGeometry(0.2, CY - 1.4, 0.5), steel, x, (CY - 1.4) / 2 + 0.1, 0); }
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(6.4, 0.05, 0.05), steel, 0, CY + sy * 1.06, sz * 1.06).castShadow = false;
    const fan = new THREE.Group(); fan.position.set(-3.2, CY, 0); group.add(fan);
    add(new THREE.SphereGeometry(0.22, 14, 10), gold, 0, 0, 0, fan);
    for (let i = 0; i < 4; i++) { const b = add(new THREE.BoxGeometry(0.05, 1.25, 0.34), white, 0, 0, 0, fan); b.rotation.x = i * Math.PI / 2; b.translateY(0.75); b.rotateY(0.45); }
    const hub = add(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ visible: false }), -3.2, CY, 0); hub.castShadow = false;

    // ----- the carriage: two slotted posts, an axle, the wing, and the aircraft's weight hanging below -----
    for (const z of [-1.32, 1.32]) {
      add(new THREE.BoxGeometry(0.12, 3.9, 0.1), steel, 0, 2.15, z);
      add(new THREE.TorusGeometry(0.16, 0.045, 8, 20), ctx.lit('#2bc48a', 1.2), 0, CY, z).rotation.x = Math.PI / 2;
    }
    const lvl = ctx.sprite('lift = weight', { size: 0.34, color: '#7dffc5' }); lvl.position.set(0.75, CY, 1.45); group.add(lvl);
    const rig = new THREE.Group(); rig.position.set(0, 1.55, 0); group.add(rig);
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.7, 10), steel, 0, 0, 0, rig).rotation.x = Math.PI / 2;
    const shape = new THREE.Shape(); shape.moveTo(0.5, 0); shape.bezierCurveTo(0.1, 0.17, -0.46, 0.17, -0.5, 0); shape.bezierCurveTo(-0.46, -0.08, 0.1, -0.03, 0.5, 0);
    const wg = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 14 }); wg.translate(0, 0, -0.5);
    const wing = add(wg, wingOk, 0, 0, 0, rig);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), steel, 0, -0.4, 0, rig);
    const crate = add(new THREE.BoxGeometry(0.5, 0.5, 0.5), ctx.mat('#ffb057', { roughness: 0.8 }), 0, -1.0, 0, rig);
    const ml = ctx.sprite(mass + ' kg', { size: 0.34 }); ml.position.set(0, -1.0, 0.42); rig.add(ml);
    const al = ctx.sprite(`${AIR[alt][0]}: ${rho} kg/m³`, { size: 0.36 }); al.position.set(-1.9, 4.35, 0); group.add(al);

    // ----- force arrows, side by side at the near wing tip so their lengths can be compared -----
    const arrow = (color, angle) => {
      const g = new THREE.Group(), m = ctx.lit(color, 0.9);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), m), head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 10), m);
      g.add(shaft, head); g.rotation.z = angle; rig.add(g);
      g.len = (n) => { g.visible = n > 0.03; shaft.scale.y = Math.max(0.01, n); shaft.position.y = n / 2; head.position.y = n + 0.11; };
      return g;
    };
    const aL = arrow('#2bc48a', 0), aW = arrow('#ffd23f', Math.PI), aD = arrow('#ff5d6c', -Math.PI / 2);

    // ----- smoke lines in two sheets, with puffs that ride along them -----
    const OFF = [-0.95, -0.55, -0.2, 0.2, 0.55, 0.95], PTS = 40, lines = [], puffs = [];
    const smokeM = new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.7 });
    const puffM = ctx.lit('#ffffff', 0.9), puffBad = ctx.lit('#ff9aa6', 0.9), puffG = new THREE.SphereGeometry(0.06, 8, 6);
    for (const z of [-0.3, 0.3]) for (const off of OFF) {
      const pos = new Float32Array(PTS * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geo, smokeM); line.frustumCulled = false; group.add(line);
      const ln = { off, z, pos, geo }; lines.push(ln);
      const p = new THREE.Mesh(puffG, puffM); p.castShadow = false; group.add(p); puffs.push({ m: p, ln, at: (lines.length * 1.37) % 6 });
    }
    let wy = 1.55, travel = 0, Lnow = 0, Dnow = 0;
    // Height of one smoke line at tunnel position x (−3…3); off is its starting height above the wing.
    const flowY = (x, off, c, st, t) => {
      const side = off >= 0 ? 1 : -1, strength = Math.min(1, v / 15);
      const around = side * 0.2 * Math.exp(-x * x / 0.5) / (1 + Math.abs(off) * 1.2);
      const turn = (-0.3 * c * (0.5 + 0.5 * Math.tanh(2 * x)) + 0.1 * c * Math.exp(-((x + 0.9) ** 2) / 0.5)) * Math.exp(-off * off / 1.5);
      const wake = st * (off > 0 ? 1 : 0.25) * (calm ? 0.05 : 0.15) * Math.sin(9 * x - 11 * t + off * 5) * (0.5 + 0.5 * Math.tanh(3 * x)) * Math.exp(-off * off);
      return wy + off + strength * (around + turn + wake);
    };

    // ----- controls -----
    ui.note(`Mission: in ${AIR[alt][0].toLowerCase()} air (ρ = ${rho} kg/m³) the wing must carry a ${mass} kg aircraft, which weighs ${kN(W)} kN. Get the lift within 5% of the weight, below the stall angle, then check. The wing floats at the green marks when lift equals weight.`);
    const pred = ui.choice([[2, 'If speed doubles, lift is 2×'], [4, 'If speed doubles, lift is 4×'], [8, 'If speed doubles, lift is 8×']], null, (p) => {
      if (firstPick == null) firstPick = p;
      ctx.say(`Test your guess: right now the lift is ${kN(lift(rho, v, S, a))} kN at ${v} m/s. At ${2 * v} m/s it would be ${kN(lift(rho, 2 * v, S, a))} kN. Move the speed slider and watch the green arrow.`);
    });
    const vS = ui.slider({ label: 'Airspeed', min: 10, max: 90, step: 1, value: v, unit: 'm/s', onInput: (x) => { v = x; upd(); } });
    const aS = ui.slider({ label: 'Angle of attack', min: -4, max: 20, step: 0.5, value: a, unit: '°', onInput: (x) => { a = x; upd(); } });
    const sS = ui.slider({ label: 'Wing area', min: 5, max: 30, step: 0.5, value: S, unit: 'm²', onInput: (x) => { S = x; upd(); } });
    const rL = ui.readout('Lift, kN'), rW = ui.readout('Weight, kN'), rP = ui.readout('Lift ÷ weight, %'), rC = ui.readout('C_L'), rD = ui.readout('Drag, kN'), rR = ui.readout('Air density, kg/m³');
    rW.set(kN(W)); rR.set(String(rho));
    function upd() {
      Lnow = lift(rho, v, S, a); Dnow = drag(rho, v, S, a);
      rL.set(kN(Lnow)); rP.set((Lnow / W * 100).toFixed(0)); rC.set(cl(a).toFixed(2)); rD.set(kN(Dnow));
      const k = (S - 5) / 25, chord = 1.0 + 0.5 * k, span = 0.8 + 1.2 * k;          // a bigger wing is drawn longer and wider
      wing.scale.set(chord, chord, span); wing.material = a > STALL ? wingBad : wingOk;
      const tip = span / 2 + 0.22; aL.position.set(0, 0.05, tip); aW.position.set(0.28, -0.05, tip); aD.position.set(chord / 2, 0, 0);
      aL.len(Math.min(2.1, 0.8 * Math.max(0, Lnow) / W)); aW.len(0.8); aD.len(Math.min(1.6, 4 * Dnow / W));
    }
    function check() {
      tries++; const err = (Lnow - W) / W, pc = (Lnow / W * 100).toFixed(0);
      if (a > STALL) { ctx.say(`Stalled! At ${a}° the air cannot follow the top of the wing, so it breaks away and tumbles. C_L has fallen to ${cl(a).toFixed(2)} and drag is ${kN(Dnow)} kN. Lower the angle to ${STALL}° or less and fly faster instead.`); return; }
      if (Math.abs(err) <= 0.05) {
        const picked = firstPick === 4;
        ctx.say(`Level flight! Lift ${kN(Lnow)} kN matches the weight ${kN(W)} kN (${pc}%) at ${v} m/s, ${a}° and ${S} m². Lift = ½ × air density × speed² × wing area × C_L. Speed is squared, so doubling it gives four times the lift${firstPick == null ? '' : picked ? ', just as you guessed' : ', not ' + firstPick + ' times'}. Thin air needs more speed or more wing.`);
        if (!done) { done = true; ctx.complete(picked ? 1 : 0.85, `L/W=${(Lnow / W).toFixed(3)}, v=${v}, a=${a}, S=${S}, rho=${rho}, mass=${mass}, tries=${tries}`); }
      } else if (err < 0) ctx.say(`Not enough lift: ${kN(Lnow)} kN against a weight of ${kN(W)} kN (${pc}%), so the load pulls the wing down. Go faster (speed counts twice), tilt the wing up a little, or add wing area.`);
      else ctx.say(`Too much lift: ${kN(Lnow)} kN against a weight of ${kN(W)} kN (${pc}%), so the wing climbs past the marks. Slow down, lower the angle or use a smaller wing.`);
    }
    ui.button('✔ Check flight', check, 'btn');
    ctx.onTap(wing, check); ctx.onTap(crate, () => ctx.say(`This load stands for the aircraft: ${mass} kg, pulled down by gravity with ${kN(W)} kN.`));
    ctx.onTap(hub, () => { vS.set(v >= 90 ? 10 : Math.min(90, v + 5)); });
    upd();
    ctx.say('Turn up the fan, tilt the wing and choose its size. When the green lift arrow is as long as the yellow weight arrow, the wing floats at the green marks.');

    return {
      step(dt) {
        const target = CY + Math.max(-0.95, Math.min(1.0, (Lnow / W - 1) * 1.9));
        wy += (target - wy) * Math.min(1, dt * 2.2);
      },
      frame(dt, time) {
        const t = time || 0, stalled = a > STALL, c = cl(a), st = stalled ? 1 : 0;
        fan.rotation.x += dt * (1 + v * 0.35); travel += dt * v * 0.05;
        const shake = stalled && !calm ? Math.sin(t * 23) * 0.03 : 0;
        rig.position.y = wy + shake; wing.rotation.z = -a * Math.PI / 180 + shake;
        for (const ln of lines) {
          for (let i = 0; i < PTS; i++) { const x = -3 + 6 * i / (PTS - 1); ln.pos[i * 3] = x; ln.pos[i * 3 + 1] = flowY(x, ln.off, c, st, t); ln.pos[i * 3 + 2] = ln.z; }
          ln.geo.attributes.position.needsUpdate = true;
        }
        smokeM.opacity = 0.25 + 0.5 * Math.min(1, v / 40);
        for (const p of puffs) {
          const x = -3 + ((p.at + travel) % 6);
          p.m.position.set(x, flowY(x, p.ln.off, c, st, t), p.ln.z); p.m.scale.setScalar(0.8 + 0.6 * Math.min(1, v / 60));
          p.m.material = stalled && p.ln.off > 0 && x > 0.2 ? puffBad : puffM;
        }
      },
      // Shows a successful run without the player (used by tests): a safe 6° angle, then the speed and area that fit best.
      autoplay() {
        let best = null;
        for (let vv = 10; vv <= 90; vv++) for (let s = 5; s <= 30; s += 0.5) { const e = Math.abs(lift(rho, vv, s, 6) / W - 1); if (!best || e < best.e) best = { e, vv, s }; }
        pred.set(4); aS.set(6); vS.set(best.vv); sS.set(best.s); check();
      },
      dispose() { group.traverse((o) => { if (o.isMesh || o.isLine) o.geometry?.dispose?.(); }); smokeM.dispose(); hub.material.dispose(); },
      get state() { return done ? 'level flight' : a > STALL ? 'stalled' : 'tuning'; },
    };
  },
};
