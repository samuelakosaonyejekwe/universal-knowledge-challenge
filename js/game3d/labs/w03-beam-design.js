// World 3 lab — Beam Designer, in 3D.
// A lab file has no imports: everything arrives through the context, so the model can be checked without a browser.

// ----- the model: a rectangular beam on two supports with one load in the middle -----
// name, stiffness E (GPa), allowable bending stress (MPa), density (kg/m³), colour
const MATS = { wood: ['Pine wood', 11, 8, 500, '#c98a4b'], steel: ['Steel', 200, 150, 7850, '#8f9bb0'], alu: ['Aluminium', 69, 90, 2700, '#dfe5ec'] };
const B = { min: 20, max: 300, step: 5 }, H = { min: 20, max: 500, step: 5 };        // width and height, mm
export const model = {
  MATS,
  // F in newtons, L in metres, b and h in millimetres. M = FL/4, σ = M·c/I, δ = FL³/(48EI), I = bh³/12.
  calc(mat, b, h, F, L) {
    const [, E, sa, rho] = MATS[mat], bb = b / 1e3, hh = h / 1e3, I = bb * hh ** 3 / 12;
    const d = F * L ** 3 / (48 * E * 1e9 * I), s = (F * L / 4) * (hh / 2) / I / 1e6;
    return { I, d, s, sa, mass: rho * bb * hh * L, lim: L / 360, okS: s <= sa, okD: d <= L / 360 };
  },
  // The lightest beam of this material that passes both checks.
  lightest(mat, F, L) {
    let best = null;
    for (let b = B.min; b <= B.max; b += B.step) for (let h = H.min; h <= H.max; h += H.step) { const r = model.calc(mat, b, h, F, L); if (r.okS && r.okD && (!best || r.mass < best.mass)) best = { b, h, mass: r.mass }; }
    return best;
  },
  // How far the beam has dropped at the fraction u (0…1) of its span, as a share of the sag in the middle.
  shape: (u) => { const v = u > 0.5 ? 1 - u : u; return v * (3 - 4 * v * v); },
  // The job: 5 to 30 kN on a span of 2 to 6 m. Level 6 also limits the mass.
  task(level, rng) {
    const F = (5 + Math.floor(rng() * 6) * 5) * 1e3, L = 2 + Math.floor(rng() * 5);
    return { F, L, lim: L / 360, slack: level >= 6 ? 1.5 : Infinity };
  },
};
// Used by the automated tests: hand-worked values for a steel beam, and every job has an answer in every material.
export function selfTest() {
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.abs(b);
  const r = model.calc('steel', 60, 100, 10e3, 4), tall = model.calc('steel', 60, 200, 10e3, 4);    // I = 5×10⁻⁶ m⁴
  let all = true; for (const m of Object.keys(MATS)) for (const F of [5e3, 30e3]) for (const L of [2, 6]) if (!model.lightest(m, F, L)) all = false;
  const ok = near(r.I, 5e-6) && near(r.d, 0.0133333333, 1e-6) && near(r.s, 100) && near(r.mass, 188.4) && near(r.d / tall.d, 8) && near(r.s / tall.s, 4) && near(model.shape(0.5), 1) && model.shape(0) === 0 && near(model.shape(0.25), 0.6875) && all;
  return { ok, detail: `steel 60×100 mm, 10 kN on 4 m: sag ${(r.d * 1e3).toFixed(2)} mm, stress ${r.s.toFixed(0)} MPa, mass ${r.mass.toFixed(1)} kg; twice the height: sag ÷${(r.d / tall.d).toFixed(0)}, stress ÷${(r.s / tall.s).toFixed(0)}; every job solvable in every material: ${all}` };
}

export default {
  id: 'w03-beam-design',
  world: 3,
  levels: [5, 6],
  title: 'Beam Designer',
  goal: 'Size a beam that is strong and stiff enough, with as little material as possible.',
  kind: 'validated',
  model: 'A rectangular beam resting on two supports with one point load in the middle: bending moment M = FL/4, stress σ = M·c/I with I = bh³/12, and sag δ = FL³/(48EI). Small deflections, a uniform material and no self-weight. Real beams also need checks for shear, buckling and connections. The span is drawn at true size, the cross-section three times larger, and the sag much larger than real so you can see it.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, job = model.task(ctx.level, ctx.rng), { F, L } = job;
    const K = 3 / 1000;                                                    // mm of cross-section → scene metres (drawn 3× larger)
    const TOP = 1.5, SAG = 0.14;                                           // support height; scene metres of sag at the allowed limit
    const iron = ctx.mat('#4a4038', { metalness: 0.5, roughness: 0.5 }), steel = ctx.mat('#b9b2a6', { metalness: 0.7, roughness: 0.3 }), amber = ctx.mat('#f5a524', { roughness: 0.6 });
    const beamMat = Object.fromEntries(Object.entries(MATS).map(([k, v]) => [k, ctx.mat(v[4], k === 'wood' ? { roughness: 0.8 } : { metalness: 0.6, roughness: 0.35 })]));
    const lampIdle = ctx.mat('#6b5a4c', { roughness: 0.6 }), lampGood = ctx.lit('#4fdc7c', 1.8), lampBad = ctx.lit('#ff7a5c', 1.7), lampWarn = ctx.lit('#ffc94d', 1.6);
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const geos = [];
    const G = (g) => { geos.push(g); return g; };

    // floor plate, the two supports (a fixed wedge and a roller) and the gantry that lowers the load
    add(G(new THREE.BoxGeometry(7, 0.16, 2.6)), iron, 0, 0.08, 0);
    const xs = [-L / 2, L / 2];
    for (const x of xs) add(G(new THREE.BoxGeometry(0.7, TOP - 0.56, 1.5)), ctx.mat('#dab78c', { roughness: 0.9 }), x, (TOP - 0.56) / 2 + 0.16, 0);
    const wedge = G(new THREE.CylinderGeometry(0.03, 0.3, 0.4, 3)); wedge.rotateY(Math.PI / 6); wedge.scale(1, 1, 2.6);
    add(wedge, steel, xs[0], TOP - 0.2, 0);
    const rollG = G(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 18)); rollG.rotateX(Math.PI / 2);
    const roller = add(rollG, steel, xs[1], TOP - 0.2, 0);
    for (const x of [-3.3, 3.3]) add(G(new THREE.BoxGeometry(0.2, 4.9, 0.2)), amber, x, 2.45 + 0.16, -1.05);
    add(G(new THREE.BoxGeometry(6.8, 0.22, 0.22)), amber, 0, 4.95, -1.05);
    add(G(new THREE.BoxGeometry(0.4, 0.3, 1.3)), iron, 0, 4.9, -0.45);
    const cable = add(G(new THREE.CylinderGeometry(0.03, 0.03, 1, 6)), steel, 0, 4, 0);
    const load = add(G(new THREE.BoxGeometry(0.75, 0.6, 0.75)), ctx.mat('#e0662a', { roughness: 0.6 }), 0, 4, 0);
    add(G(new THREE.BoxGeometry(0.79, 0.1, 0.79)), iron, 0, 0, 0, load);
    const tag = ctx.sprite(`${F / 1e3} kN`, { size: 0.42 }); tag.position.set(0, 0, 0.6); load.add(tag);
    const spanTag = ctx.sprite(`span ${L} m`, { size: 0.32 }); spanTag.position.set(0, 0.5, 1.2); group.add(spanTag);
    // the sag gauge beside the middle of the beam: a post, a bright line at the allowed limit and a pointer that rides on the beam
    const gz = 1.05; add(G(new THREE.BoxGeometry(0.08, TOP + 0.3, 0.08)), iron, 0, (TOP + 0.3) / 2, gz);
    add(G(new THREE.BoxGeometry(0.5, 0.04, 0.12)), steel, 0, TOP, gz);
    const limitBar = add(G(new THREE.BoxGeometry(0.6, 0.05, 0.14)), ctx.lit('#ff7a5c', 1.4), 0, TOP - SAG, gz); limitBar.castShadow = false;
    const limTag = ctx.sprite(`limit ${(job.lim * 1e3).toFixed(1)} mm`, { size: 0.26 }); limTag.position.set(0.95, TOP - SAG, gz); group.add(limTag);
    const pointer = add(G(new THREE.ConeGeometry(0.11, 0.3, 4)), ctx.lit('#ffd76a', 1.2), -0.2, TOP, gz); pointer.rotation.z = -Math.PI / 2; pointer.castShadow = false;
    const lamp = add(G(new THREE.SphereGeometry(0.24, 16, 12)), lampIdle, 2.6, 4.45, -1.05); lamp.castShadow = false;

    // the beam: a box whose corner points are moved to the bent shape every frame
    const SEG = 32, beamGeo = G(new THREE.BoxGeometry(1, 1, 1, SEG, 1, 1)), base = beamGeo.attributes.position.array.slice();
    const beam = add(beamGeo, beamMat.steel, 0, 0, 0); beam.frustumCulled = false;
    const OVER = 0.25;                                                     // the beam sticks out this far past each support

    let mat = 'steel', b = 60, h = 100, r = model.calc(mat, b, h, F, L), state = 'idle', t = 0, loadK = 0, vel = 0, drop = 1, tries = 0, done = false;
    const rD = ui.readout('Sag δ (mm)'), rS = ui.readout('Stress σ (MPa)'), rM = ui.readout('Mass (kg)'), rI = ui.readout('Stiffness of shape I (cm⁴)');
    const shown = () => Math.min(1.05, r.d / job.lim * SAG);               // sag in scene metres under the full load
    const bend = () => {
      const p = beamGeo.attributes.position.array, w = L + OVER * 2, hh = Math.max(0.05, h * K), bb = Math.max(0.05, b * K), sag = shown() * loadK;
      for (let i = 0; i < p.length; i += 3) {
        const x = base[i] * w, u = (x + L / 2) / L;
        const dy = u <= 0 ? sag * 3 * u : u >= 1 ? sag * 3 * (1 - u) : sag * model.shape(u);      // the overhanging ends tilt up a little
        p[i] = x; p[i + 1] = TOP + (base[i + 1] + 0.5) * hh - dy; p[i + 2] = base[i + 2] * bb;
      }
      beamGeo.attributes.position.needsUpdate = true; beamGeo.computeVertexNormals();
      const topMid = TOP + hh - sag, ly = topMid + 0.3 + drop * Math.max(0.5, 4.2 - topMid - 0.3);
      load.position.y = ly; cable.scale.y = Math.max(0.01, 4.85 - ly - 0.3); cable.position.y = (4.85 + ly + 0.3) / 2; cable.visible = state !== 'rest' || loadK < 0.5;
      pointer.position.y = TOP - sag; roller.rotation.z = -sag * 2;
    };
    const refresh = () => {
      r = model.calc(mat, b, h, F, L);
      rD.set(`${(r.d * 1e3).toFixed(2)} (limit ${(job.lim * 1e3).toFixed(1)})`); rS.set(`${r.s.toFixed(1)} (limit ${r.sa})`); rM.set(r.mass.toFixed(1)); rI.set((r.I * 1e8).toFixed(0));
    };
    const change = () => { refresh(); if (state !== 'idle') { state = 'lift'; t = 0; } if (!done) lamp.material = lampIdle; };
    const matC = ui.choice(Object.entries(MATS).map(([k, v]) => [k, v[0]]), 'steel', (k) => { if (!MATS[k]) return; mat = k; beam.material = beamMat[k]; change(); });
    const bS = ui.slider({ label: 'Width b', min: B.min, max: B.max, step: B.step, value: b, unit: 'mm', onInput: (v) => { b = v; change(); } });
    const hS = ui.slider({ label: 'Height h', min: H.min, max: H.max, step: H.step, value: h, unit: 'mm', onInput: (v) => { h = v; change(); } });
    const test = () => { if (state === 'lower' || state === 'settle') return; refresh(); tries++; state = 'lower'; t = 0; vel = 0; lamp.material = lampIdle; ctx.say(`The crane lowers ${F / 1e3} kN onto the middle of the beam. Watch the gold pointer: it must stay above the red limit line.`); };
    ui.button('✔ Test the beam', test, 'btn');
    ctx.onTap(load, test);
    ui.note(`Mission: span ${L} m, load ${F / 1e3} kN in the middle. Sag must stay under span/360 = ${(job.lim * 1e3).toFixed(1)} mm and the stress under the material limit${job.slack < Infinity ? ', and the beam may weigh no more than 1.5 times the lightest beam of that material that passes' : ''}. Sag is drawn larger than real.`);
    refresh(); bend();
    ctx.say(`Choose a material and a size for a beam that carries ${F / 1e3} kN across ${L} m, then test it. Try changing the height and the width and compare what each does to the sag.`);

    const verdict = () => {
      const name = MATS[mat][0];
      if (!r.okS) { lamp.material = lampBad; state = 'hold'; t = 0; ctx.say(`Too weak: the stress is ${r.s.toFixed(0)} MPa but ${name.toLowerCase()} is only safe up to ${r.sa} MPa, so the crane takes the load away. Make the beam taller: bending stress is σ = M·c/I, and I grows with the cube of the height, so height helps most.`); return; }
      if (!r.okD) { lamp.material = lampWarn; state = 'hold'; t = 0; ctx.say(`Strong enough but too bendy: it sags ${(r.d * 1e3).toFixed(1)} mm and the limit is ${(job.lim * 1e3).toFixed(1)} mm. Use a stiffer material or more height. Sag is δ = FL³/(48EI): double the height and the sag drops 8 times.`); return; }
      const best = model.lightest(mat, F, L), sc = Math.min(1, best.mass / r.mass);
      if (r.mass > best.mass * job.slack + 1e-9) { lamp.material = lampWarn; state = 'hold'; t = 0; ctx.say(`It passes, but it weighs ${r.mass.toFixed(0)} kg. The lightest ${name.toLowerCase()} beam that passes is about ${best.mass.toFixed(0)} kg, and yours may weigh up to ${(best.mass * job.slack).toFixed(0)} kg. Make it narrower and taller: width only helps a little, height helps a lot.`); return; }
      lamp.material = lampGood; state = 'rest'; done = true;
      ctx.say(`Passes! Sag ${(r.d * 1e3).toFixed(1)} mm, stress ${r.s.toFixed(0)} MPa, mass ${r.mass.toFixed(0)} kg; the lightest ${name.toLowerCase()} beam that passes is about ${best.mass.toFixed(0)} kg. Tall and thin beams resist bending best, because material far from the middle does the work.`);
      ctx.complete(Math.max(0.5, sc), `${mat} ${b}×${h} mm, mass ${r.mass.toFixed(1)} kg, lightest ${best.mass.toFixed(1)} kg, tries=${tries}`);
    };
    return {
      step(dt) {
        t += dt;
        if (state === 'lower') { drop = Math.max(0, drop - dt * (ctx.calm ? 2 : 0.8)); if (drop <= 0) { state = 'settle'; t = 0; } }
        else if (state === 'settle' || state === 'hold' || state === 'rest') {
          // the load settles on the springy beam with a small bounce
          const acc = (1 - loadK) * 60 - vel * (ctx.calm ? 16 : 6); vel += acc * dt; loadK += vel * dt;
          if (state === 'settle' && t >= 1.8) verdict();
          else if (state === 'hold' && t >= 2.2) { state = 'lift'; t = 0; }
        } else if (state === 'lift') {
          vel = 0; loadK = Math.max(0, loadK - dt * 3); drop = Math.min(1, drop + dt * 0.9);
          if (drop >= 1 && loadK <= 0) state = 'idle';
        }
      },
      frame(dt, time) { bend(); if (done && !ctx.calm) lamp.scale.setScalar(1 + Math.sin(time * 5) * 0.12); },
      // Shows a successful run without the player (used by tests).
      autoplay() {
        const best = model.lightest('steel', F, L);
        mat = 'steel'; matC.set?.('steel'); beam.material = beamMat.steel; b = best.b; h = best.h; bS.set(b); hS.set(h); change(); state = 'idle'; drop = 1; loadK = 0;
        test();
      },
      dispose() { for (const g of geos) g.dispose(); },
    };
  },
};
