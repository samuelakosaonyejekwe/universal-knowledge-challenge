// World 5 — Marine, Offshore and Subsea Engineering: the Deepwater Mission.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: a box-shaped barge, Archimedes' principle and initial (small-angle) stability -----
const L = 15;                       // barge length, m
const D = 3;                        // barge depth from keel to deck, m
const LIGHT_PER_BEAM = 7.5;         // empty barge mass for each metre of beam, t/m (60 t at 8 m)
const LIGHT_KG = 1.2;               // height of the empty barge's centre of gravity above the keel, m
const CARGO_LEN = 12;               // length of the cargo stack on deck, m
const CARGO_DENSITY = 2.5;          // stone blocks, t/m³
const FRESH = 1000, SEA = 1025;     // water density, kg/m³
const PUSH = 30;                    // sideways test push, t·m
export const model = {
  L, D, FRESH, SEA,
  // cargo (t) stacked `stack` m high on the deck, `offset` m to one side of the centre line.
  solve({ cargo, stack, offset = 0, beam = 8, rho = SEA }) {
    const light = LIGHT_PER_BEAM * beam, mass = light + cargo;                        // t
    const T = mass * 1000 / (rho * L * beam);                                         // draught: mass = ρ·L·B·T
    const KB = T / 2, BM = beam * beam / (12 * T);                                    // box shape: I/V = B²/(12T)
    const KG = (light * LIGHT_KG + cargo * (D + stack / 2)) / mass;
    const GM = KB + BM - KG, freeboard = D - T;
    const width = cargo / (CARGO_DENSITY * CARGO_LEN * stack);                        // how wide the stack must be, m
    const tan = GM > 0 ? cargo * offset / (mass * GM) : 0;                            // heel from off-centre cargo
    return { light, mass, T, KB, BM, KG, GM, freeboard, width, tan, heel: Math.atan(tan) * 180 / Math.PI,
      rock: GM > 0 ? Math.atan(PUSH / (mass * GM)) * 180 / Math.PI : 90,
      fits: width + 2 * Math.abs(offset) <= beam + 1e-9, sunk: freeboard <= 0, tippy: GM <= 0 };
  },
  goal: (level) => ({ cargo: 90 + 20 * level, freeboard: +(0.5 + 0.08 * level).toFixed(2), GM: +(0.4 + 0.2 * level).toFixed(1), heel: 3 }),
  passes(r, cargo, g) { return !r.sunk && !r.tippy && r.fits && cargo >= g.cargo && r.freeboard >= g.freeboard && r.GM >= g.GM && Math.abs(r.heel) <= g.heel; },
};
// Used by the automated tests. Worked by hand for a 15 m × 8 m barge (60 t) carrying 180 t stacked 2 m high:
// fresh water: T = 240,000 / (1000 × 15 × 8) = 2.000 m; KB = 1.000; BM = 64 / 24 = 2.6667; KG = (60×1.2 + 180×4) / 240 = 3.300; GM = 0.3667 m
// sea water:   T = 240,000 / (1025 × 120) = 1.9512 m; KB = 0.9756; BM = 64 / 23.4146 = 2.7333; GM = 0.4089 m
export function selfTest() {
  const f = model.solve({ cargo: 180, stack: 2, beam: 8, rho: FRESH }), s = model.solve({ cargo: 180, stack: 2, beam: 8, rho: SEA });
  const side = model.solve({ cargo: 180, stack: 2, offset: 0.1, beam: 8, rho: FRESH });      // tan φ = 180 × 0.1 / (240 × 0.3667) = 0.2045
  const near = (a, b, tol = 5e-4) => Math.abs(a - b) < tol;
  const ok = near(f.T, 2) && near(f.KB, 1) && near(f.BM, 2.6667) && near(f.KG, 3.3) && near(f.GM, 0.3667) && near(s.T, 1.9512) && near(s.GM, 0.4089) && near(side.tan, 0.2045)
    && near(f.mass * 1000, FRESH * L * 8 * f.T, 1e-6) && s.T < f.T;
  return { ok, detail: `240 t barge: fresh T ${f.T.toFixed(3)} m, GM ${f.GM.toFixed(4)} m (by hand 2.000, 0.3667); sea T ${s.T.toFixed(4)} m, GM ${s.GM.toFixed(4)} m (by hand 1.9512, 0.4089)` };
}

const sim = {
  title: 'Load the barge',
  goal: 'Load the model barge in the glass tank. Carry enough cargo, keep enough of its side dry, and keep it steady enough not to tip.',
  kind: 'validated',
  model: 'A box-shaped barge 15 m long and 3 m deep. Archimedes\' principle gives how deep it floats (mass = water density × length × beam × draught), and its first steadiness comes from the metacentric height GM = KB + BM − KG, with KB = T/2 and BM = B²/(12T). The lean from off-centre cargo uses tan φ = cargo × offset / (mass × GM). The numbers are checked against a sum worked by hand. It is only right for small leans while the deck stays dry. It leaves out waves, wind, the curved shape of real hulls, liquids sloshing in tanks and cargo that slides; the rocking you see is the steady lean a 30 t·m sideways push would give, applied to and fro.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, U = 0.3, FLOOR = 0.3, DEEP = 5, WY = FLOOR + DEEP * U;      // metres → scene units; water 5 m deep
    const g = model.goal(ctx.level), own = [];
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const clear = (color, opacity) => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), transparent: true, opacity, roughness: 0.15, metalness: 0.1, depthWrite: false }); own.push(m); return m; };
    // the glass tank
    add(new THREE.BoxGeometry(6.9, FLOOR, 5.4), ctx.mat('#2c5870', { metalness: 0.4, roughness: 0.4 }), 0, FLOOR / 2, 0);
    const waterMat = clear('#19b8c9', 0.5), water = add(new THREE.BoxGeometry(6.4, DEEP * U, 4.9), waterMat, 0, FLOOR + DEEP * U / 2, 0); water.renderOrder = 2;
    const glassGeo = new THREE.BoxGeometry(6.5, 2.3, 5); add(glassGeo, clear('#dffaff', 0.1), 0, FLOOR + 1.15, 0).renderOrder = 3;
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(glassGeo), new THREE.LineBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.7 })); frame.position.set(0, FLOOR + 1.15, 0); group.add(frame);
    // the barge: `float` turns about the waterline, `hull` slides down as the barge sinks deeper
    const float = new THREE.Group(); float.position.y = WY; group.add(float);
    const hull = new THREE.Group(); float.add(hull);
    const box = add(new THREE.BoxGeometry(1, D * U, L * U), ctx.mat('#b5482f', { roughness: 0.6 }), 0, D * U / 2, 0, hull);
    add(new THREE.BoxGeometry(1.004, 0.035, L * U + 0.02), ctx.lit('#ffffff', 0.9), 0, (D - g.freeboard) * U - D * U / 2, 0, box);       // the load line
    add(new THREE.BoxGeometry(0.96, 0.03, L * U * 0.97), ctx.mat('#51606b', { roughness: 0.8 }), 0, D * U / 2 + 0.012, 0, box);          // the deck
    const load = add(new THREE.BoxGeometry(1, 1, CARGO_LEN * U), ctx.mat('#f2a23a', { roughness: 0.7 }), 0, D * U, 0, hull);
    const face = L * U / 2 + 0.06;
    const dot = (color, text) => { const m = add(new THREE.SphereGeometry(0.075, 12, 8), ctx.lit(color, 1.4), 0, 0, face, hull); const s = ctx.sprite(text, { size: 0.32 }); s.position.set(0.3, 0, 0); m.add(s); return m; };
    const dG = dot('#ff5a3d', 'G'), dB = dot('#2f7fe0', 'B'), dM = dot('#ffd76a', 'M');

    let cargo = 60, stack = 4, offset = 0, beam = 8, rho = SEA, r = model.solve({ cargo, stack, offset, beam, rho });
    let state = 'idle', tT = 0, tries = 0, clock = 0, visT = r.T, visHeel = 0;
    const cargoS = ui.slider({ label: 'Cargo', min: 0, max: 300, step: 10, value: cargo, unit: 't', onInput: (v) => { cargo = +v; refresh(); } });
    const stackS = ui.slider({ label: 'Stack height', min: 1, max: 6, step: 0.5, value: stack, unit: 'm', onInput: (v) => { stack = +v; refresh(); } });
    const offS = ui.slider({ label: 'Cargo position, left or right of the middle', min: -3, max: 3, step: 0.25, value: 0, unit: 'm', onInput: (v) => { offset = +v; refresh(); } });
    const beamS = ctx.level >= 3 ? ui.slider({ label: 'Barge beam (width)', min: 6, max: 10, step: 0.5, value: beam, unit: 'm', onInput: (v) => { beam = +v; refresh(); } }) : null;
    const waterC = ctx.level >= 4 ? ui.choice([[SEA, 'Sea water, 1025 kg/m³'], [FRESH, 'Fresh water, 1000 kg/m³']], SEA, (v) => { rho = +v; refresh(); }) : null;
    const rM = ui.readout('Barge and cargo, t'), rT = ui.readout('Draught (depth under water), m'), rF = ui.readout(`Freeboard (dry side), m — needs ${g.freeboard}`), rKG = ui.readout('KG (centre of gravity above keel), m'),
      rGM = ui.readout(`GM (steadiness), m — needs ${g.GM}`), rH = ui.readout('Lean from off-centre cargo, °'), rR = ui.readout('Rocking in the test push, °'), rW = ui.readout('Stack width, m');
    function refresh() {
      r = model.solve({ cargo, stack, offset, beam, rho });
      rM.set(r.mass.toFixed(0)); rT.set(r.T.toFixed(2)); rF.set(r.sunk ? 'deck under water' : r.freeboard.toFixed(2)); rKG.set(r.KG.toFixed(2)); rGM.set(r.GM.toFixed(2));
      rH.set(r.tippy ? 'tips over' : Math.abs(r.heel).toFixed(1)); rR.set(r.tippy ? 'tips over' : Math.min(90, r.rock).toFixed(1)); rW.set(r.width.toFixed(1) + (r.fits ? '' : ' — does not fit'));
      box.scale.x = beam * U;
      load.visible = cargo > 0; load.scale.set(Math.max(0.05, Math.min(r.width, beam + 2) * U), stack * U, 1); load.position.set(offset * U, D * U + stack * U / 2, 0);
      dG.position.set(cargo * offset / r.mass * U, r.KG * U, face); dB.position.y = r.KB * U; dM.position.y = (r.KB + r.BM) * U; dM.visible = r.KB + r.BM < 13;
      waterMat.color.set(rho === SEA ? '#19b8c9' : '#8fd6f5');
    }
    const test = () => { state = 'test'; tT = 0; tries++; ctx.say('Casting off in the tank. Watch how deep it sits and how far it rocks.'); };
    ui.button('⚓ Cast off and test', test, 'btn');
    ui.note(`Carry at least ${g.cargo} t. Keep the white load line above the water (freeboard ${g.freeboard} m or more), GM at least ${g.GM} m, and the lean under ${g.heel}°. G is the centre of gravity, B the centre of the pushed-aside water, M the point G must stay below.`);
    refresh();
    ctx.say('Slide the cargo on and watch the barge sink until the water it pushes aside weighs as much as the barge itself.');
    const judge = () => {
      state = 'idle';
      const wide = beamS ? ' or make the barge wider' : '';
      if (r.sunk) return ctx.say(`Too heavy. This barge can push aside only ${(rho * L * beam * D / 1000).toFixed(0)} t of water before its deck goes under, but it weighs ${r.mass.toFixed(0)} t. Take some cargo off${wide}.`);
      if (r.tippy) return ctx.say('The stack is so high that the centre of gravity G is above the point M. Nothing pushes the barge back upright, so it leans right over. Stack the cargo lower.');
      if (!r.fits) return ctx.say(`That stack is ${r.width.toFixed(1)} m wide and does not fit on the ${beam} m deck there. Stack it a little higher or move it to the middle.`);
      if (cargo < g.cargo) return ctx.say(`It floats well, but the mission needs at least ${g.cargo} t. Every extra tonne makes the barge push aside one more tonne of water, so it sits deeper.`);
      if (r.freeboard < g.freeboard) return ctx.say(`Too deep. The barge sinks until the water it pushes aside weighs ${r.mass.toFixed(0)} t, the same as itself. That leaves only ${r.freeboard.toFixed(2)} m of dry side. Carry a little less${wide}${waterC && rho === FRESH ? ', or float it in salty sea water, which is heavier and holds it higher' : ''}.`);
      if (r.GM < g.GM) return ctx.say(`It floats, but it is tippy: GM is only ${r.GM.toFixed(2)} m. High cargo lifts the centre of gravity G towards M, so a small push rocks it ${Math.min(90, r.rock).toFixed(0)}°. Stack lower${wide}.`);
      if (Math.abs(r.heel) > g.heel) return ctx.say(`It leans ${Math.abs(r.heel).toFixed(1)}° because the cargo sits ${Math.abs(offset)} m off the middle. Move the stack back to the centre line.`);
      ctx.say(`Ready to sail! Barge and cargo weigh ${r.mass.toFixed(0)} t, so it sinks ${r.T.toFixed(2)} m until it has pushed aside ${r.mass.toFixed(0)} t of water. With GM at ${r.GM.toFixed(2)} m it swings back upright when pushed.`);
      ctx.complete(tries <= 2 ? 1 : 0.8, `cargo=${cargo} t, T=${r.T.toFixed(2)} m, GM=${r.GM.toFixed(2)} m, tries=${tries}`);
    };
    return {
      step(dt) {
        clock += dt;
        const push = (state === 'test' ? PUSH : ctx.calm ? 0 : 5) * Math.sin(clock * 2 * Math.PI / 3.2), side = offset < 0 ? -1 : 1;
        const want = r.sunk ? 0 : r.tippy ? 0.49 * side : Math.max(-0.49, Math.min(0.49, Math.atan((cargo * offset + push) / (r.mass * r.GM))));
        visHeel += (want - visHeel) * Math.min(1, dt * 4); visT += ((r.sunk ? DEEP : r.T) - visT) * Math.min(1, dt * 3);
        hull.position.y = -visT * U; float.rotation.z = -visHeel;
        if (state === 'test') { tT += dt; if (tT >= 4.5) judge(); }
      },
      // Shows a successful run without the player (used by tests): the target cargo, in the middle, stacked as low as fits.
      autoplay() {
        let pick = null;
        for (let b = beamS ? 10 : 8; b >= (beamS ? 6 : 8) && !pick; b -= 0.5) for (let h = 1; h <= 6 && !pick; h += 0.5) if (model.passes(model.solve({ cargo: g.cargo, stack: h, offset: 0, beam: b, rho: SEA }), g.cargo, g)) pick = [b, h];
        if (!pick) return;
        rho = SEA; waterC?.set?.(SEA); if (beamS) beamS.set(pick[0]);
        cargoS.set(g.cargo); stackS.set(pick[1]); offS.set(0); refresh(); test();
      },
      dispose() { for (const m of own) m.dispose(); },
      get state() { return state; },
    };
  },
};

export default {
  id: 5,
  theme: {
    sky: ['#2a93cf', '#8edbe0', '#ffdcae'], fog: '#b4e6e4', fogNear: 36, fogFar: 135,
    ground: '#e9d6a4', ground2: '#f4e6bd', side: '#3f8493', stone: '#c8d8dc', accent: '#0d6fb8', glow: '#9df3ff', metal: '#2c5870', wood: '#a9744a', leaf: '#3bbf9a', water: '#19b8c9', crate: '#f2a23a',
    sun: '#fff0cf', sunPower: 2.3, ambient: 1.4, skyLight: '#dcfcff', groundLight: '#2f7f8f', sunDir: [-0.6, 0.55, 0.5], particles: 'bubbles',
  },
  layout: { mirror: -1, stones: 3, rise: 0.45, towerH: 4.5 },
  story: {
    title: 'The Deepwater Mission',
    crystal: 'tide pearls', crystalEm: '🐚',
    intro: ['Good morning, and welcome to Dawnwater Harbour! Our little yellow submarine is ready to dive and check the legs of the sea platform.', 'But the night tide carried away the five tide pearls that light the harbour, and the supply barge is still waiting to be loaded.'],
    remind: 'The tide pearls shine pale blue. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five tide pearls! Now ride the lift from the tower to the tank console and load the barge so it floats safe and steady.',
    afterSim: 'The barge is loaded and sitting level. Only the Deepwater Master stands between you and the portal — the arena is up the steps.',
    notReady: 'The arena is for those who have done the work. Bring all five tide pearls and load the barge first.',
    rival: ['So you floated a barge in a tank. The open sea asks harder questions.', 'We each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge crossed the water before mine. Steady thinking — the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and try me.'],
    outro: 'The harbour lights are shining, the barge is safely loaded, and the little submarine is on its way down. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, SEA_Y = -8, grp = (x, y, z) => { const g = k.add(new THREE.Group()); g.position.set(x, y, z); return g; };
    const hard = (x, y, z, r, h) => { const s = { type: 'cyl', x, z, r, y0: y, y1: y + h }; k.level.solids.push(s); k.physics.addSolid(s); };
    const white = k.mat('#f6f4ec', { roughness: 0.6 }), red = k.mat('#e2483d', { roughness: 0.55 }), steel = k.mat('#2c5870', { metalness: 0.5, roughness: 0.4 }), rope = k.mat('#e9dcb8', { roughness: 1 });
    // the open sea far below: the lower islands stand in it like rock stacks
    const sea = k.mesh(new THREE.CircleGeometry(150, 48), k.mat('#19b8c9', { transparent: true, opacity: 0.86, roughness: 0.25, metalness: 0.1 }), -10, SEA_Y, 50); sea.rotation.x = -Math.PI / 2; sea.castShadow = sea.receiveShadow = false;
    k.animate((dt, t) => { sea.position.y = SEA_Y + Math.sin(t * 0.5) * 0.12; });
    // the lighthouse on the home island, with a lamp that turns
    const lh = grp(-6.2, 0, -5.6); hard(-6.2, 0, -5.6, 1.15, 6);
    k.mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.6, 16), k.mat(k.theme.stone), 0, 0.3, 0, lh); k.mesh(new THREE.CylinderGeometry(0.62, 0.95, 5, 16), white, 0, 3.1, 0, lh);
    k.mesh(new THREE.CylinderGeometry(0.87, 0.94, 0.8, 16), red, 0, 1.6, 0, lh); k.mesh(new THREE.CylinderGeometry(0.72, 0.79, 0.8, 16), red, 0, 3.8, 0, lh);
    k.mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 16), steel, 0, 5.67, 0, lh);
    const lamp = k.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 12), k.lit('#fff2b0', 1.8), 0, 6.14, 0, lh); lamp.castShadow = false; lamp.add(k.glow('#fff2b0', 3.2, 0.6));
    k.mesh(new THREE.ConeGeometry(0.75, 0.7, 16), red, 0, 6.89, 0, lh);
    const beam = k.mesh(new THREE.CylinderGeometry(0.12, 1.0, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }), 6.3, 0, 0, lamp); beam.rotation.z = Math.PI / 2; beam.castShadow = false;
    k.animate((dt) => { lamp.rotation.y += dt * 0.7; });
    // mooring posts along the quay, joined by sagging ropes
    const posts = [-0.1, 0.3, 0.7].map((a) => { const x = Math.cos(a) * 8.7, z = Math.sin(a) * 8.7; k.mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.75, 10), steel, x, 0.375, z); hard(x, 0, z, 0.3, 0.75); return [x, z]; });
    for (let i = 0; i < 2; i++) { const [ax, az] = posts[i], [bx, bz] = posts[i + 1]; k.mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(ax, 0.62, az), new THREE.Vector3((ax + bx) / 2, 0.05, (az + bz) / 2), new THREE.Vector3(bx, 0.62, bz)), 10, 0.045, 5), rope).castShadow = false; }
    // gulls wheel around the lighthouse
    const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.16, -0.75, 0.14, 0, 0, 0, -0.16, 0, 0, 0.16, 0, 0, -0.16, 0.75, 0.14, 0]), 3)); wing.computeVertexNormals();
    const gulls = [[4.5, 8.6, 0.5, 0], [6.5, 9.6, -0.38, 2.1], [9, 10.8, 0.3, 4.4]].map(([r, y, w, p]) => { const m = k.mesh(wing, k.mat('#ffffff', { side: THREE.DoubleSide, roughness: 1 }), 0, y, 0); m.castShadow = false; return { m, r, y, w, p }; });
    k.animate((dt, t) => { for (const q of gulls) { const a = t * q.w + q.p; q.m.position.set(-6.2 + Math.cos(a) * q.r, q.y + Math.sin(t * 0.7 + q.p) * 0.4, -5.6 + Math.sin(a) * q.r); q.m.rotation.y = -a - (q.w > 0 ? 0 : Math.PI); q.m.scale.y = Math.sin(t * 5 + q.p) * 1.3; } });
    // an anchor stands on the middle island
    const mid = S.mid, an = grp(-4, mid[1], mid[2] - 3.6); an.rotation.set(0, 0.5, 0.12); hard(-4, mid[1], mid[2] - 3.6, 0.35, 2);
    k.mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8), steel, 0, 1.05, 0, an); k.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), steel, 0, 1.75, 0, an).rotation.z = Math.PI / 2;
    k.mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 14), steel, 0, 2.15, 0, an); k.mesh(new THREE.TorusGeometry(0.6, 0.09, 6, 16, Math.PI), steel, 0, 0.72, 0, an).rotation.z = Math.PI;
    // buoys bob in the lagoon, and a little yellow submarine circles under the water
    const lz = mid[2] + 11.6, wy = mid[1] - 0.45;
    const buoys = [[5.9, lz - 4.4, '#e2483d'], [6.1, lz + 4.8, '#3bbf9a'], [0.6, lz + 5.6, '#e2483d']].map(([x, z, c], i) => { const b = grp(x, wy, z); k.mesh(new THREE.CylinderGeometry(0.16, 0.42, 0.95, 10), k.mat(c, { roughness: 0.55 }), 0, 0.3, 0, b); k.mesh(new THREE.SphereGeometry(0.14, 10, 8), k.lit('#fff2b0', 1.6), 0, 0.9, 0, b).castShadow = false; return { b, i }; });
    k.animate((dt, t) => { for (const { b, i } of buoys) { b.position.y = wy + Math.sin(t * 1.3 + i * 2) * 0.07; b.rotation.z = Math.sin(t * 0.9 + i) * 0.12; b.rotation.x = Math.cos(t * 0.7 + i) * 0.08; } });
    const sub = grp(0, wy - 1.25, lz), yellow = k.mat('#ffcf3d', { roughness: 0.4 });
    k.mesh(new THREE.CapsuleGeometry(0.32, 1.0, 6, 12), yellow, 0, 0, 0, sub).rotation.z = Math.PI / 2; k.mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.34, 10), yellow, 0.12, 0.42, 0, sub);
    k.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), steel, 0.12, 0.75, 0, sub); k.mesh(new THREE.SphereGeometry(0.11, 10, 8), k.lit('#9df3ff', 1.4), 0.5, 0.06, 0.26, sub).castShadow = false;
    const screw = k.mesh(new THREE.BoxGeometry(0.06, 0.5, 0.12), steel, -0.88, 0, 0, sub);
    k.animate((dt, t) => { const a = t * 0.45; sub.position.set(0.4 + Math.cos(a) * 3.3, wy - 1.25 + Math.sin(t * 0.8) * 0.12, lz + Math.sin(a) * 3.3); sub.rotation.y = -a - Math.PI / 2; screw.rotation.x += dt * 9; });
    // a harbour crane swings a crate out over the water behind the tank
    const cx = S.sim[0] + 2.5, cz = S.sim[2] - 6.3, top = grp(cx, S.sim[1] + 5, cz); hard(cx, S.sim[1], cz, 0.45, 5);
    k.mesh(new THREE.BoxGeometry(0.5, 5, 0.5), k.mat('#f2a23a', { roughness: 0.6 }), cx, S.sim[1] + 2.5, cz); k.mesh(new THREE.BoxGeometry(1, 0.8, 1), white, 0, 0.4, 0, top);
    k.mesh(new THREE.BoxGeometry(5.4, 0.25, 0.25), k.mat('#f2a23a', { roughness: 0.6 }), 1.7, 1.0, 0, top); k.mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 5), rope, 4, -0.1, 0, top).castShadow = false;
    k.mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), k.mat('#0d6fb8'), 4, -1.5, 0, top);
    k.animate((dt, t) => { top.rotation.y = Math.PI / 2 + Math.sin(t * 0.3) * 0.8; });
    // a small supply ship sails slow circles on the sea beside the harbour
    const ship = grp(0, SEA_Y, 0); ship.scale.setScalar(1.3);
    k.mesh(new THREE.BoxGeometry(7, 1.4, 2.2), k.mat('#0d6fb8', { roughness: 0.5 }), 0, 0.5, 0, ship);
    const bowGeo = new THREE.ConeGeometry(1, 2.2, 4); bowGeo.rotateY(Math.PI / 4); const bow = k.mesh(bowGeo, k.mat('#0d6fb8', { roughness: 0.5 }), 4.6, 0.5, 0, ship); bow.rotation.z = -Math.PI / 2; bow.scale.set(1.4 / Math.SQRT2, 1, 2.2 / Math.SQRT2);
    k.mesh(new THREE.BoxGeometry(2, 1.3, 1.7), white, -1.9, 1.85, 0, ship); k.mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.2, 10), red, -2.3, 3.1, 0, ship); k.mesh(new THREE.BoxGeometry(2.2, 0.7, 1.6), k.mat('#f2a23a', { roughness: 0.6 }), 1.5, 1.55, 0, ship);
    k.animate((dt, t) => { const a = t * 0.07 + 1; ship.position.set(27 + Math.cos(a) * 15, SEA_Y + 0.1 + Math.sin(t * 0.9) * 0.15, 36 + Math.sin(a) * 15); ship.rotation.y = -a - Math.PI / 2; ship.rotation.z = Math.sin(t * 0.8) * 0.04; });
    // an offshore platform stands on its legs in the mist
    const rig = grp(-62, 0, 44), rigMat = k.mat('#7d98a4', { roughness: 0.7, flatShading: true });
    for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) k.mesh(new THREE.CylinderGeometry(0.7, 0.7, 15, 8), rigMat, x, -0.5, z, rig).castShadow = false;
    k.mesh(new THREE.BoxGeometry(12, 1.2, 12), k.mat('#f2a23a', { roughness: 0.6 }), 0, 7.4, 0, rig).castShadow = false; k.mesh(new THREE.BoxGeometry(6, 3.5, 5), white, -2, 9.75, 1, rig).castShadow = false;
    k.mesh(new THREE.ConeGeometry(1.8, 9, 4), rigMat, 3, 12.5, -2, rig).castShadow = false;
    const beacon = k.mesh(new THREE.SphereGeometry(0.5, 12, 8), k.lit('#ff6a5a', 1.8), 3, 17.4, -2, rig); beacon.castShadow = false; beacon.add(k.glow('#ff6a5a', 5, 0.7));
    k.animate((dt, t) => { beacon.scale.setScalar(0.7 + 0.3 * Math.sin(t * 2.2)); });
    // signal flags by the portal and lights around the arena
    k.prop('banner', S.end[0] - 3.5, S.end[1], S.end[2] - 0.8, { color: '#e2483d' }); k.prop('banner', S.end[0] + 3.5, S.end[1], S.end[2] - 0.8, { color: '#ffcf3d' });
    k.prop('lamp', S.arena[0] - 6, S.arena[1], S.arena[2] - 0.5, { color: '#fff2b0' }); k.prop('lamp', S.arena[0] + 6, S.arena[1], S.arena[2] - 0.5, { color: '#fff2b0' });
  },
  sim,
};
