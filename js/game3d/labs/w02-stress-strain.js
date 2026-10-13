// 3D lab — Materials Tester: a rod hangs a stack of weights in a test frame, stretches, necks and may snap,
// while a marker runs along a 3D stress–strain trace.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

// name, E in GPa, yield strength in MPa, density in kg/m³, colour, metal look
const MATS = {
  steel: ['Steel', 200, 250, 7850, '#aeb8c4', 0.7], aluminium: ['Aluminium', 69, 240, 2700, '#e3e8ee', 0.6], copper: ['Copper', 117, 70, 8960, '#c9773a', 0.7],
  titanium: ['Titanium', 110, 880, 4500, '#8f96a8', 0.6], nylon: ['Nylon', 2.5, 70, 1150, '#f2ead2', 0],
};
const SF = 1.5;                       // safety factor: the stress must stay below yield ÷ 1.5

// ----- the model: a round rod in tension. σ = F/A, ΔL = F·L/(A·E), mass = ρ·A·L -----
export const model = {
  SF,
  area: (dMm) => Math.PI * (dMm * 1e-3) ** 2 / 4,                                        // m²
  // F in N, L in m, d in mm → stress s (MPa), yield sy and strength su (MPa), stretch dl (m), mass (kg), E (GPa)
  rod(mat, dMm, F, L) { const [, E, sy, rho] = MATS[mat], a = model.area(dMm); return { s: F / a / 1e6, sy, su: 1.4 * sy, dl: F * L / (a * E * 1e9), mass: rho * a * L, E }; },
  // The smallest area that is both strong enough and stiff enough, m².
  needArea(mat, F, L, dmax) { const [, E, sy] = MATS[mat]; return Math.max(F / (sy * 1e6 / SF), F * L / (dmax * E * 1e9)); },
  // The lightest design over all materials with any diameter.
  best(F, L, dmax) { let mass = Infinity, name = '', key = ''; for (const k of Object.keys(MATS)) { const m = model.needArea(k, F, L, dmax) * MATS[k][3] * L; if (m < mass) { mass = m; name = MATS[k][0]; key = k; } } return { mass, name, key }; },
  // The lightest design the bench can really make: diameters from 2 to 40 mm in steps of 0.5 mm.
  bestOnBench(F, L, dmax) {
    let out = null;
    for (const k of Object.keys(MATS)) for (let d = 2; d <= 40; d += 0.5) { const m = model.rod(k, d, F, L); if (m.s <= m.sy / SF && m.dl <= dmax) { if (!out || m.mass < out.mass) out = { mat: k, d, mass: m.mass }; break; } }
    return out;
  },
  // Strain on the simplified curve: a straight elastic line to yield, then a short plastic part up to the strength.
  strain(mat, ss) { const [, E, sy] = MATS[mat], su = 1.4 * sy, ey = sy / E / 1e3, emax = su / E / 1e3 * 1.5, eu = ey + 0.06 * emax; return ss <= sy ? ss / E / 1e3 : ey + Math.min(1, (ss - sy) / (su - sy)) * (eu - ey); },
};
// Used by the automated tests: a 10 mm steel rod, 1 m long, carrying 20 kN, worked by hand.
export function selfTest() {
  const m = model.rod('steel', 10, 20e3, 1), near = (a, b, rel = 1e-3) => Math.abs(a - b) <= Math.abs(b) * rel;
  const b = model.best(20e3, 1, 1e-3), bench = model.bestOnBench(20e3, 1, 1e-3), mb = model.rod(bench.mat, bench.d, 20e3, 1);
  const ok = near(model.area(10), 7.854e-5) && near(m.s, 254.65) && near(m.dl, 1.2732e-3) && near(m.mass, 0.6165) && m.su === 350
    && b.key === 'aluminium' && near(b.mass, 0.7826) && near(model.strain('steel', 200), 0.001)
    && mb.s <= mb.sy / SF && mb.dl <= 1e-3 && bench.mass >= b.mass && bench.mass <= b.mass * 1.5;
  return { ok, detail: `10 mm steel, 20 kN, 1 m: σ ${m.s.toFixed(1)} MPa, ΔL ${(m.dl * 1e3).toFixed(3)} mm, mass ${m.mass.toFixed(3)} kg; lightest for a 1 mm limit: ${b.name} ${b.mass.toFixed(3)} kg (bench: ${bench.mat} ${bench.d} mm, ${bench.mass.toFixed(3)} kg)` };
}

export default {
  id: 'w02-stress-strain',
  world: 2,
  levels: [5, 6],
  title: 'Materials Tester',
  goal: 'Pick a material and a rod diameter that carries the load safely without stretching too far, and keep it light.',
  kind: 'validated',
  model: 'A straight round rod pulled in tension: stress σ = F/A, stretch ΔL = F·L/(A·E), mass = density × A × L. Linear elastic up to yield, then a simplified flat plastic region and fracture at 1.4 times the yield strength; real curves are rounded and depend on temperature, heat treatment and rate of loading. The stretch you see is drawn about 40 times bigger than the real one so that it shows, and the thin neck is a picture, not a calculation.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rnd = ctx.rng || Math.random, hard = (ctx.level || 5) >= 6;
    const F = (5 + Math.floor(rnd() * 8) % 8 * 5) * 1e3;                                  // N
    const L = 0.5 + Math.floor(rnd() * 4) % 4 * 0.25;                                     // m
    const dmax = (0.4 + Math.floor(rnd() * 6) % 6 * 0.2) * 1e-3;                          // m, allowed stretch
    const opt = model.best(F, L, dmax), fmt = (v, n = 1) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(n));
    let mat = 'steel', d = 10, guess = 1, done = false, ramp = 0, phase = 'idle', fall = 0, fallV = 0, gap = 0, shown = '';
    const rod = () => model.rod(mat, d, F, L);

    const own = [], keep = (o) => { own.push(o); return o; };
    const add3 = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const cube = keep(new THREE.BoxGeometry(1, 1, 1)), box = (material, x, y, z, w, h, dp, parent) => { const m = add3(cube, material, x, y, z, parent); m.scale.set(w, h, dp); return m; };

    // ----- the test frame -----
    const RX = -1.55, TOP = 4.2, LS = 1.1 + (L - 0.5) * 1.0, PL = Math.round(F / 5e3), DROP = 0.6;       // one plate for every 5 kN
    const frameM = ctx.mat('#2c6f8f', { metalness: 0.5, roughness: 0.4 }), dark = ctx.mat('#39474f', { metalness: 0.4, roughness: 0.5 });
    box(frameM, RX, 0.08, 0, 2.9, 0.16, 1.5);
    for (const sx of [-1.2, 1.2]) box(frameM, RX + sx, 2.4, 0, 0.22, 4.5, 0.4);
    box(frameM, RX, 4.62, 0, 2.9, 0.3, 0.6);
    box(dark, RX, TOP + 0.14, 0, 0.5, 0.28, 0.5);                                         // the top grip
    const rodM = keep(new THREE.MeshStandardMaterial({ color: MATS.steel[4], metalness: 0.7, roughness: 0.35 }));
    const halfG = () => { const g = keep(new THREE.CylinderGeometry(1, 1, 1, 18, 8)); g.userData.base = g.attributes.position.array.slice(); return g; };
    const upper = add3(halfG(), rodM, RX, 0, 0), lower = add3(halfG(), rodM, RX, 0, 0);
    const hang = new THREE.Group(); group.add(hang);                                      // everything that hangs from the rod
    box(dark, RX, -0.12, 0, 0.5, 0.24, 0.5, hang);
    const plateG = keep(new THREE.CylinderGeometry(0.55, 0.55, 0.09, 24)), plateM = [ctx.mat('#e0b23c', { metalness: 0.3, roughness: 0.5 }), ctx.mat('#c9952a', { metalness: 0.3, roughness: 0.5 })];
    for (let i = 0; i < PL; i++) add3(plateG, plateM[i % 2], RX, -0.24 - 0.05 - i * 0.1, 0, hang);
    const STACK = 0.24 + PL * 0.1, restY = TOP - LS - STACK;                              // underside of the stack before loading
    const table = box(ctx.mat('#5d6b73', { roughness: 0.7 }), RX, 0, 0, 1.5, 1, 1.1);
    const loadTag = ctx.sprite('Load ' + F / 1e3 + ' kN', { size: 0.3 }); loadTag.position.set(RX, -STACK / 2, 0.75); hang.add(loadTag);
    // the stretch gauge: a pointer on the lower grip and a red plate at the allowed stretch
    const vis = (strain) => LS * Math.min(0.3, strain * 40);                              // drawn stretch for a real strain
    box(dark, RX + 0.85, 2.3, 0.45, 0.07, 4.3, 0.07);
    box(ctx.lit('#ffd24a', 0.9), RX + 0.55, -0.02, 0.45, 0.6, 0.05, 0.12, hang);
    const limit = box(ctx.lit('#f0708a', 1.1), RX + 0.85, TOP - LS - vis(dmax / L) - 0.06, 0.45, 0.45, 0.04, 0.3);
    const limTag = ctx.sprite('stretch limit', { size: 0.2, color: '#ffc2cf' }); limTag.position.set(RX + 0.9, limit.position.y - 0.2, 0.75); group.add(limTag);

    function shapeRod(R, neck) {                                                          // thin the rod around its middle
      const key = R.toFixed(4) + '|' + neck.toFixed(3); if (key === shown) return; shown = key;
      for (const [mesh, w0] of [[lower, 0], [upper, 0.5]]) {
        const g = mesh.geometry, b = g.userData.base, p = g.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) { const w = w0 + (b[i + 1] + 0.5) * 0.5, r = R * (1 - neck * Math.exp(-(((w - 0.5) / 0.11) ** 2))); p[i] = b[i] * r; p[i + 2] = b[i + 2] * r; }
        g.attributes.position.needsUpdate = true; g.computeVertexNormals();
      }
    }

    // ----- the 3D stress–strain trace -----
    const CX = 0.75, CY = 1.0, CW = 2.5, CH = 2.6, CD = 0.4;
    const axisM = ctx.mat('#cfe6ee', { roughness: 0.5 }), curveM = ctx.lit('#3b9ff5', 0.7);
    box(axisM, CX + CW / 2, CY, 0, CW + 0.1, 0.06, 0.06); box(axisM, CX, CY + CH / 2, 0, 0.06, CH + 0.1, 0.06); box(axisM, CX, CY, CD / 2, 0.06, 0.06, CD);
    box(ctx.mat('#17624f', { roughness: 0.7 }), CX + CW / 2, 0.08, 0, CW + 0.6, 0.16, 1.0);
    for (const sx of [0, CW]) box(dark, CX + sx, (CY + 0.16) / 2, 0, 0.08, CY - 0.16, 0.08);
    const segs = [0, 1, 2].map(() => box(curveM, 0, 0, 0, 1, 0.07, CD));
    const allowed = box(ctx.lit('#f0708a', 0.9), CX + CW / 2, CY, 0, CW, 0.035, CD + 0.06);
    const dot = add3(keep(new THREE.SphereGeometry(0.14, 18, 12)), ctx.lit('#ff7a1a', 1.6), CX, CY, 0); const halo = ctx.glow('#ff7a1a', 0.9, 0.8); dot.add(halo);
    const sT = ctx.sprite('stress σ (MPa)', { size: 0.24 }); sT.position.set(CX + 0.2, CY + CH + 0.3, 0); group.add(sT);
    const eT = ctx.sprite('strain ε', { size: 0.24 }); eT.position.set(CX + CW - 0.2, CY - 0.3, 0.3); group.add(eT);
    const aT = ctx.sprite('allowed', { size: 0.2, color: '#ffc2cf' }); group.add(aT);
    let PX = () => CX, PY = () => CY;
    function plot() {
      const m = rod(), smax = Math.max(m.su * 1.15, m.s * 1.1), emax = m.su / m.E / 1e3 * 1.5;
      PX = (e) => CX + Math.min(1, e / emax) * CW; PY = (s) => CY + Math.min(1, s / smax) * CH;
      const ey = m.sy / m.E / 1e3, eu = ey + 0.06 * emax, ef = eu + 0.1 * emax, pts = [[0, 0], [ey, m.sy], [eu, m.su], [ef, m.su * 0.85]];
      segs.forEach((sg, i) => {
        const x0 = PX(pts[i][0]), y0 = PY(pts[i][1]), x1 = PX(pts[i + 1][0]), y1 = PY(pts[i + 1][1]);
        sg.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); sg.scale.x = Math.hypot(x1 - x0, y1 - y0) + 0.06; sg.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      });
      allowed.position.y = PY(m.sy / SF); aT.position.set(CX + CW - 0.35, allowed.position.y + 0.17, CD / 2 + 0.05);
    }

    const rLoad = ui.readout('Load, kN'), rS = ui.readout('Stress σ, MPa'), rA = ui.readout('Allowed stress, MPa'), rD = ui.readout('Stretch ΔL, mm'), rLim = ui.readout('Stretch limit, mm'), rM = ui.readout('Rod mass, kg'), rB = ui.readout('Lightest possible, kg');
    function update() {
      const m = rod();
      rLoad.set(fmt(F / 1e3)); rS.set(fmt(m.s)); rA.set(fmt(m.sy / SF)); rD.set(fmt(m.dl * 1e3, 2)); rLim.set(fmt(dmax * 1e3, 1)); rM.set(m.mass.toFixed(2)); rB.set(opt.mass.toFixed(2) + ' (' + opt.name + ')');
      rodM.color.set(MATS[mat][4]); rodM.metalness = MATS[mat][5]; plot();
    }
    const reset = () => { ramp = 0; phase = 'idle'; fall = fallV = 0; };
    const setMat = (k) => { if (!MATS[k]) return; mat = k; reset(); update(); };
    function run() { reset(); ramp = 0.0001; phase = 'test'; ctx.say('The table sinks and the rod takes the load. Watch the orange marker climb the curve.'); }
    function snap() {
      phase = 'broken'; fall = 0; fallV = 0;
      ctx.say('The rod snapped! The stress was above the strength of the material. Stress is force per area: a thicker rod spreads the same force over a bigger area, and a stronger material can take more.');
    }
    function verdict() {
      phase = 'hold';
      const m = rod(), ok1 = m.s <= m.sy / SF, ok2 = m.dl <= dmax;
      if (!ok1) { ctx.say(`Too risky: the stress is ${fmt(m.s)} MPa, above the allowed ${fmt(m.sy / SF)} MPa. ${m.s > m.sy ? 'The rod has gone thin in the middle and will stay bent out of shape. ' : ''}A thicker rod has more area, so each bit of it carries less force.`); return; }
      if (!ok2) { ctx.say(`Strong enough, but it stretches ${fmt(m.dl * 1e3, 2)} mm (limit ${fmt(dmax * 1e3)} mm). How much it stretches depends on stiffness E: ΔL = F·L / (A·E). Try a stiffer material or a thicker rod.`); return; }
      if (hard && m.mass > opt.mass * 1.5) { ctx.say(`Safe, but heavy: ${m.mass.toFixed(2)} kg. The lightest possible is about ${opt.mass.toFixed(2)} kg (${opt.name}). At this level the rod must be under ${(opt.mass * 1.5).toFixed(2)} kg: try a thinner rod or a material that is strong for its weight.`); return; }
      const sc = Math.min(1, opt.mass / m.mass), good = Math.abs(guess - m.dl * 1e3) <= 0.1 * m.dl * 1e3 + 0.026;
      ctx.say(`Safe design! Mass ${m.mass.toFixed(2)} kg; the lightest possible is about ${opt.mass.toFixed(2)} kg (${opt.name}). Stress σ = F/A decides if it breaks; strain ε = σ/E decides how far it stretches. Lighter is better.`);
      if (!done) { done = true; ctx.complete(Math.max(0.5, sc * 0.85 + (good ? 0.15 : 0)), 'Strength (σ = F/A against yield) and stiffness (ΔL = FL/AE) are separate limits on a design.'); }
    }

    ui.note(`Mission: the rod hangs a load of ${fmt(F / 1e3)} kN, is ${L} m long, may stretch at most ${fmt(dmax * 1e3)} mm, and must stay below yield strength ÷ ${SF}.` + (hard ? ' It must also weigh no more than 1.5 times the lightest possible design.' : ''));
    ui.choice(Object.keys(MATS).map((k) => [k, MATS[k][0]]), 'steel', setMat);
    const dS = ui.slider({ label: 'Rod diameter', min: 2, max: 40, step: 0.5, value: 10, unit: 'mm', onInput: (v) => { d = v; reset(); update(); } });
    const gS = ui.slider({ label: 'My guess: stretch of this rod', min: 0, max: 5, step: 0.05, value: 1, unit: 'mm', onInput: (v) => { guess = v; } });
    ui.button('Run the test', run, 'btn');
    ui.note('Each gold plate is 5 kN, about the weight of a horse. The stretch is drawn 40 times bigger than real so you can see it.');
    for (const o of [table, upper, lower]) ctx.onTap(o, run);                             // tapping the rod or the table also starts the test
    update();
    ctx.say('Choose a material and a diameter, guess the stretch, then run the test.');

    function draw() {
      const m = rod(), su = m.su, ss = phase === 'idle' ? 0 : Math.min(ramp * m.s, su), ee = model.strain(mat, ss);
      const plastic = Math.max(0, Math.min(1, (ss - m.sy) / (su - m.sy))), broken = phase === 'broken';
      const ext = Math.min(0.42, vis(ee) + plastic * 0.1), R = 0.04 + d * 0.0062, bottom = TOP - LS - ext;
      shapeRod(R, broken ? 0.82 : plastic * 0.5);
      const half = (LS + ext) / 2, recoil = broken ? Math.min(0.08, fall) : 0;
      upper.scale.y = half - recoil; upper.position.y = TOP - (half - recoil) / 2;
      lower.scale.y = half; lower.position.y = bottom - fall + half / 2;
      hang.position.y = bottom - fall;
      const tableTop = restY - (phase === 'idle' ? 0 : broken ? DROP : Math.min(1, ramp * 1.6) * DROP);
      table.scale.y = Math.max(0.05, tableTop); table.position.y = tableTop / 2;
      gap = (bottom - fall - STACK) - tableTop;
      dot.position.set(PX(ee + (broken ? 0.04 * su / m.E / 1e3 : 0)), PY(broken ? su * 0.9 : ss), CD / 2 + 0.05);
    }
    draw();

    return {
      step(dt) {
        if (phase === 'test') {
          const m = rod(); ramp = Math.min(1, ramp + dt * 0.45);
          if (ramp * m.s >= m.su) snap(); else if (ramp >= 1) verdict();
        } else if (phase === 'broken' && gap > 1e-4) {                       // the weights settle onto the table
          fallV += 9.81 * dt; const move = Math.min(gap, fallV * dt); fall += move; gap -= move;
        }
      },
      frame(dt, time) { draw(); halo.material.opacity = 0.6 + (ctx.calm ? 0 : Math.sin((time || 0) * 5) * 0.2); },
      // Picks the lightest safe rod the bench can make, guesses its stretch and runs the test.
      autoplay() {
        const b = model.bestOnBench(F, L, dmax);
        setMat(b.mat); dS.set(b.d); gS.set(Math.round(model.rod(b.mat, b.d, F, L).dl * 1e3 / 0.05) * 0.05); run();
      },
      dispose() {
        group.traverse((o) => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
        for (const o of own) o.dispose();
      },
    };
  },
};
