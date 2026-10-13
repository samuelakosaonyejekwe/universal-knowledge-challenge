// World 5 lab — Ship Stability. A cargo lift raises or lowers the ship's centre of gravity G; when the wind blows,
// the hull leans until the righting push of the water balances the wind.
// No imports: everything arrives through the context, so the model can be checked without a browser.

const B = 12, LEN = 40, T = 3, RHO = 1025, G0 = 9.81;      // m beam, m length, m draught, kg/m³ sea water, m/s²
const KB = T / 2, BM = B * B / (12 * T);                    // box hull: B is halfway down the draught, BM = I/V = B²/(12T)
const MASS = RHO * B * LEN * T;                             // kg of water pushed aside = mass of the ship
export const model = {
  B, LEN, T, KB, BM, MASS, KM: KB + BM,
  // KG in m above the keel, wind heeling moment in N·m.
  solve(KG, wind) {
    const GM = KB + BM - KG, tips = GM <= 0;
    const heel = tips ? 90 : Math.asin(Math.min(1, wind / (MASS * G0 * GM))) * 180 / Math.PI;
    return { GM, tips, heel, GZ: tips ? 0 : GM * Math.sin(heel * Math.PI / 180) };
  },
  // The highest KG that keeps the heel at or below `deg` degrees in this wind.
  highest: (wind, deg) => KB + BM - wind / (MASS * G0 * Math.sin(deg * Math.PI / 180)),
};
// By hand: mass = 1025 × 12 × 40 × 3 = 1,476,000 kg; KB = 1.5 m; BM = 144 / 36 = 4 m; KM = 5.5 m.
// KG 4 m, wind 1.0 MN·m: GM = 1.5 m; sin φ = 1,000,000 / (1,476,000 × 9.81 × 1.5) = 0.046042; φ = 2.639°.
// KG 2 m, wind 1.6 MN·m: GM = 3.5 m; sin φ = 1,600,000 / 50,678,460 = 0.031572; φ = 1.809°.
export function selfTest() {
  const a = model.solve(4, 1e6), b = model.solve(2, 1.6e6), c = model.solve(6, 1e6), near = (x, y, tol = 1e-3) => Math.abs(x - y) < tol;
  const ok = MASS === 1476000 && near(KB, 1.5) && near(BM, 4) && near(a.GM, 1.5) && near(a.heel, 2.639) && near(a.GZ, 0.06906, 1e-4) && near(b.GM, 3.5) && near(b.heel, 1.809)
    && c.tips && near(model.solve(model.highest(1e6, 3), 1e6).heel, 3, 1e-6);
  return { ok, detail: `1,476 t barge: KG 4 m in 1.0 MN·m wind heels ${a.heel.toFixed(3)}° (by hand 2.639); KG 2 m in 1.6 MN·m heels ${b.heel.toFixed(3)}° (by hand 1.809); KG 6 m tips (GM ${c.GM.toFixed(1)} m)` };
}

export default {
  id: 'w05-ship-stability',
  world: 5,
  levels: [3, 4],
  title: 'Ship Stability',
  goal: 'Stack the cargo so the ship stays upright when the wind pushes: keep the heel small and GM positive.',
  kind: 'validated',
  model: 'A rectangular barge hull (12 m wide, 40 m long, 3 m deep in the water) in calm water, with small-angle theory: GM = KB + BM − KG, BM = B²/(12T), and the heel where the wind moment equals mass × g × GM × sin φ (GZ = GM·sin φ). The cargo lift stands for moving the whole ship\'s centre of gravity G to the chosen height. Real ships use full hull shapes, free surface effects and large-angle stability curves. The swaying before the ship settles is only for show, the model ship is drawn shorter than 40 m, and when GM is negative the ship is simply shown leaning far over.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, top = ctx.level >= 4, own = [];
    const wind = (top ? 12 + Math.round(ctx.rng() * 4) : 6 + Math.round(ctx.rng() * 4)) / 10 * 1e6;      // N·m
    const target = top ? 2 : 3 + Math.floor(ctx.rng() * 2);                                               // largest heel allowed, degrees
    const U = 0.2, WY = 1.3, KEEL = -T * U, FZ = 2.2, MAG = 5;                                             // scene units per metre, waterline, keel below the pivot, front of the hull
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const clear = (color, opacity) => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), transparent: true, opacity, roughness: 0.15, metalness: 0.1, depthWrite: false }); own.push(m); return m; };
    const label = (text, size, x, y, z, parent = group) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); parent.add(s); return s; };

    // the sea
    add(new THREE.BoxGeometry(7, 0.2, 5), ctx.mat('#2c5870', { roughness: 0.8 }), 0, 0.1, 0);
    add(new THREE.BoxGeometry(6.9, WY - 0.2, 4.9), clear('#19b8c9', 0.5), 0, (WY + 0.2) / 2, 0).renderOrder = 2;

    // the ship turns about its waterline; the viewer looks at its bow
    const ship = new THREE.Group(); ship.position.set(0, WY, 0); group.add(ship);
    const steel = ctx.mat('#51606b', { metalness: 0.5, roughness: 0.4 });
    add(new THREE.BoxGeometry(B * U, 6 * U, 2 * FZ), ctx.mat('#b5482f', { roughness: 0.6 }), 0, KEEL + 3 * U, 0, ship);
    add(new THREE.BoxGeometry(B * U - 0.1, 0.04, 2 * FZ - 0.1), steel, 0, KEEL + 6 * U + 0.02, 0, ship);
    add(new THREE.BoxGeometry(1.5, 0.7, 0.9), ctx.mat('#f4f4f4'), 0, KEEL + 6 * U + 0.37, -1.5, ship);
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 12), ctx.mat('#0d6fb8'), 0, KEEL + 6 * U + 1.0, -1.6, ship);
    // the cargo lift on the bow: two rails marked every 2 m, and a pallet of containers that rides on them
    const railH = 14.8 * U;
    for (const x of [-0.62, 0.62]) add(new THREE.BoxGeometry(0.07, railH, 0.07), steel, x, KEEL + railH / 2, FZ + 0.06, ship);
    add(new THREE.BoxGeometry(1.31, 0.07, 0.07), steel, 0, KEEL + railH, FZ + 0.06, ship);
    const flag = add(new THREE.BoxGeometry(0.42, 0.26, 0.02), ctx.mat('#ffd23a'), 0.21, KEEL + railH + 0.22, FZ + 0.06, ship);
    const cargo = new THREE.Group(); ship.add(cargo);
    const colours = ['#f2a23a', '#0d6fb8', '#3bbf9a', '#e0662a'];
    colours.forEach((c, k) => add(new THREE.BoxGeometry(0.54, 0.3, 0.42), ctx.mat(c, { roughness: 0.7 }), k % 2 ? 0.28 : -0.28, k < 2 ? -0.155 : 0.155, FZ + 0.3, cargo));
    const dot = (color, text, parent, y) => { const m = add(new THREE.SphereGeometry(0.1, 14, 10), ctx.lit(color, 1.4), 0, y, FZ + 0.62, parent); label(text, 0.34, 0.95, 0, 0, m); return m; };
    dot('#ffd76a', 'G', cargo, 0); dot('#ffffff', 'M', ship, KEEL + model.KM * U); dot('#2f7fe0', 'B', ship, KEEL + KB * U);
    const upArrow = add(new THREE.ConeGeometry(0.24, 0.42, 4), ctx.lit('#9df3ff', 0.9), -1.0, KEEL + 6 * U + 0.75, FZ + 0.1, ship);
    const downArrow = add(new THREE.ConeGeometry(0.24, 0.42, 4), ctx.lit('#9df3ff', 0.9), -1.0, KEEL + 6 * U + 0.25, FZ + 0.1, ship); downArrow.rotation.z = Math.PI;
    ctx.onTap(upArrow, () => nudge(0.5)); ctx.onTap(downArrow, () => nudge(-0.5));

    // a lean meter beside the ship: the needle shows the heel five times bigger, between two limit marks
    const meter = new THREE.Group(); meter.position.set(2.95, 0, 1.9); group.add(meter);
    add(new THREE.CylinderGeometry(0.06, 0.1, 2.3, 10), steel, 0, 1.15, 0, meter);
    const needle = new THREE.Group(); needle.position.y = 2.3; meter.add(needle);
    const okMat = ctx.lit('#17a673', 1.1), badMat = ctx.lit('#d9485f', 1.1);
    const pointer = add(new THREE.BoxGeometry(0.08, 1.2, 0.08), okMat, 0, 0.6, 0, needle);
    for (const s of [-1, 1]) { const a = s * target * MAG * Math.PI / 180; add(new THREE.SphereGeometry(0.09, 10, 8), ctx.lit('#ffffff', 1.2), Math.sin(a) * 1.25, 2.3 + Math.cos(a) * 1.25, 0, meter); }
    label('Lean ×5', 0.28, 0, 3.95, 0, meter);
    // the wind
    const gust = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }); own.push(gust);
    const streaks = []; for (let k = 0; k < 8; k++) { const s = add(new THREE.BoxGeometry(0.7, 0.035, 0.035), gust, -3.4 + k * 0.85, 2.1 + (k * 0.37 % 1) * 2.4, -2 + (k * 0.61 % 1) * 4); s.visible = false; streaks.push(s); }

    // ----- state -----
    let KG = 5, r = model.solve(KG, wind), state = 'idle', tT = 0, tries = 0, done = false, phi = 0, vel = 0, visKG = KG;
    const kgS = ui.slider({ label: 'Centre of gravity height KG', min: 2, max: 14, step: 0.1, value: KG, unit: 'm', onInput: (v) => { KG = +v; refresh(); } });
    ui.button('⬆️ Cargo up', () => nudge(0.5), 'btn ghost'); ui.button('⬇️ Cargo down', () => nudge(-0.5), 'btn ghost');
    ui.button('💨 Let the wind blow', () => blow(), 'btn');
    const gmR = ui.readout('GM (m)'), heelR = ui.readout(`Heel in this wind (°) — allowed ${target}`), gzR = ui.readout('Righting arm GZ at heel (m)');
    ui.note(`Wind heeling moment ${(wind / 1e6).toFixed(1)} MN·m. Keep heel at or below ${target}°. KB = ${KB.toFixed(1)} m, BM = B²/(12T) = ${BM.toFixed(1)} m, displacement ${(MASS / 1000).toFixed(0)} t. G must stay below M.`);

    function refresh() {
      r = model.solve(KG, wind);
      gmR.set(r.GM.toFixed(2)); heelR.set(r.tips ? 'tips over!' : r.heel.toFixed(2)); gzR.set(r.tips ? '–' : r.GZ.toFixed(3));
    }
    function nudge(d) { const v = Math.max(2, Math.min(14, Math.round((KG + d) * 10) / 10)); KG = v; kgS.set(v); refresh(); }
    function blow() {
      if (state === 'wind') return;
      state = 'wind'; tT = 0; tries++;
      ctx.say('Here comes the wind from the side. Watch how far the ship leans before the water pushes it back.');
    }
    function judge() {
      state = 'idle';
      if (r.tips) return ctx.say(`GM is negative (${r.GM.toFixed(1)} m): G is above M. When the ship leans, its weight pulls it over even further instead of back upright. Lower the cargo until G is below M, which sits ${model.KM.toFixed(1)} m above the keel.`);
      if (r.heel > target) return ctx.say(`Too much heel: ${r.heel.toFixed(1)}°, and only ${target}° is allowed. GM is ${r.GM.toFixed(2)} m, so the water has a short lever to push back with. Move the weight lower to raise GM.`);
      ctx.say(`Stable and steady: the ship leans only ${r.heel.toFixed(1)}°. GM = KB + BM − KG = ${KB.toFixed(1)} + ${BM.toFixed(1)} − ${KG.toFixed(1)} = ${r.GM.toFixed(1)} m. Lowering the centre of gravity raises GM, so the ship resists heeling.`);
      if (!done) { done = true; ctx.complete(Math.min(1, 0.6 + (target - r.heel) / target * 0.4), `KG=${KG.toFixed(1)} m, GM=${r.GM.toFixed(2)} m, heel=${r.heel.toFixed(2)}°, tries=${tries}`); }
    }

    refresh();
    ctx.say('The yellow ball G is the ship\'s centre of gravity. Slide the cargo up or down, then let the wind blow and see how far the ship leans.');
    return {
      step(dt) {
        visKG += (KG - visKG) * Math.min(1, dt * 5); cargo.position.y = KEEL + visKG * U;
        // a damped swing towards the steady heel (the steady angle is the model's; the swing is for show)
        const want = state === 'wind' ? (r.tips ? 25 : Math.min(25, r.heel)) : 0, w = 2.6, z = ctx.calm ? 1 : 0.28;
        vel += (w * w * (want - phi) - 2 * z * w * vel) * dt; phi += vel * dt;
        ship.rotation.z = -phi * Math.PI / 180;
        needle.rotation.z = -Math.max(-80, Math.min(80, phi * MAG)) * Math.PI / 180; pointer.material = Math.abs(phi) <= target + 0.01 ? okMat : badMat;
        for (const s of streaks) { s.visible = state === 'wind'; if (s.visible) { s.position.x += dt * (2.5 + wind / 1e6); if (s.position.x > 3.4) s.position.x = -3.4; } }
        if (state === 'wind') { tT += dt; if (tT >= (ctx.calm ? 3 : 6)) judge(); }
      },
      frame(dt, time) { flag.rotation.y = ctx.calm ? 0 : Math.sin(time * (state === 'wind' ? 9 : 2)) * (state === 'wind' ? 0.5 : 0.15); },
      // Shows a successful run without the player (used by tests): the cargo right down in the hold, then the wind.
      autoplay() { nudge(2 - KG); blow(); },
      dispose() { for (const m of own) m.dispose(); },
      get state() { return state; },
    };
  },
};
