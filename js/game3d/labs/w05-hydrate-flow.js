// World 5 lab — Flow Assurance: Hydrate Watch. A warm pipeline cools along the cold seabed; its colour shows the
// temperature, and ice-like hydrate grows wherever the fluid falls below the hydrate line.
// No imports: everything arrives through the context, so the model can be checked without a browser.

const L = 20000, D = 0.25, CP = 2000, TSEA = 4, TIN = 60, MARGIN = 3, SHIFT = 1.2;   // m, m, J/(kg·K), °C, °C, °C, °C per wt% MEG
export const model = {
  L, D, CP, TSEA, TIN, MARGIN, SHIFT,
  // Conceptual methane-hydrate boundary: P[MPa] = 2.6·exp(0.1016·T[°C]) (about 2.6 MPa at 0 °C, 12 MPa at 15 °C).
  Ph: (T) => 2.6 * Math.exp(0.1016 * T),
  Th: (P) => Math.log(P / 2.6) / 0.1016,
  ntu: (U, m) => U * Math.PI * D * L / (m * CP),
  // Temperature x metres from the wellhead: heat leaks to the sea in proportion to how much warmer the fluid is.
  Tat: (x, U, m) => TSEA + (TIN - TSEA) * Math.exp(-U * Math.PI * D * x / (m * CP)),
  line: (P, meg) => model.Th(P) - SHIFT * meg,                 // hydrate forms below this temperature
  need: (P, meg) => model.line(P, meg) + MARGIN,               // the line plus the safety margin
  // How far along the pipe the fluid first reaches temperature T (null when it never gets that cold).
  reach(T, U, m) { if (T <= TSEA) return null; const x = -Math.log((T - TSEA) / (TIN - TSEA)) * m * CP / (U * Math.PI * D); return x >= 0 && x <= L ? x : null; },
};
// By hand: pipe-in-pipe (U 3) at 30 kg/s: NTU = 3 × π × 0.25 × 20000 / (30 × 2000) = 0.7854,
// arrival T = 4 + 56 × e^−0.7854 = 4 + 56 × 0.45594 = 29.53 °C. Bare steel (U 25) at 15 kg/s: NTU = 13.09, arrival 4.00 °C.
// Hydrate line at 12 MPa: ln(12 / 2.6) / 0.1016 = 1.52940 / 0.1016 = 15.05 °C; with 5 wt% MEG and the margin: 15.05 − 6 + 3 = 12.05 °C.
export function selfTest() {
  const near = (a, b, tol = 0.01) => Math.abs(a - b) < tol;
  const ok = near(model.ntu(3, 30), 0.7854, 1e-4) && near(model.Tat(L, 3, 30), 29.53) && near(model.ntu(25, 15), 13.09) && near(model.Tat(L, 25, 15), 4.0, 0.001)
    && near(model.Th(12), 15.05) && near(model.need(12, 5), 12.05) && near(model.Ph(0), 2.6, 1e-9) && near(model.Ph(model.Th(17)), 17, 1e-9)
    && near(model.Tat(model.reach(20, 8, 20), 8, 20), 20, 1e-6) && model.Tat(0, 8, 20) === TIN;
  return { ok, detail: `pipe-in-pipe at 30 kg/s arrives at ${model.Tat(L, 3, 30).toFixed(2)} °C (by hand 29.53); hydrate line at 12 MPa ${model.Th(12).toFixed(2)} °C (by hand 15.05)` };
}

export default {
  id: 'w05-hydrate-flow',
  world: 5,
  levels: [5, 6],
  title: 'Flow Assurance: Hydrate Watch',
  goal: 'Keep the pipeline fluid warmer than the hydrate line all the way to the platform, with a safety margin.',
  kind: 'validated',
  model: 'Hot fluid (60 °C) in a 20 km, 0.25 m pipe on a 4 °C seabed cools as T(x) = 4 + 56·exp(−UπDx/(ṁcp)). The hydrate line is a conceptual curve for methane hydrate, P = 2.6·exp(0.1016·T), not a design tool. Pressure is held constant along the line, heat loss uses an overall U, specific heat is constant (2000 J/(kg·K)), and inhibitor shifts the curve by a rough 1.2 °C per wt% MEG. The pipe is drawn far shorter than 20 km, and the ice shown on the outside stands for hydrate that would form inside.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, top = ctx.level >= 6, own = [];
    const P = top ? 15 + Math.round(ctx.rng() * 5) : 8 + Math.round(ctx.rng() * 6);       // MPa
    const maxFlow = top ? 30 : 60, maxMeg = top ? 10 : 30;
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const clear = (color, opacity) => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), transparent: true, opacity, roughness: 0.3, metalness: 0.1, depthWrite: false }); own.push(m); return m; };
    const label = (text, size, x, y, z, parent = group) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); parent.add(s); return s; };
    const heat = (T, c) => { const f = Math.max(0, Math.min(1, (T - TSEA) / (TIN - TSEA))); return c.setHSL(0.62 * (1 - f), 0.9, 0.5); };       // blue (cold) → red (hot)

    // the sea and the seabed
    const SEA = 3.5, BED = 0.3;
    add(new THREE.BoxGeometry(7, BED, 5), ctx.mat('#e9d6a4', { roughness: 1 }), 0, BED / 2, 0);
    add(new THREE.BoxGeometry(6.9, SEA - BED, 4.9), clear('#19b8c9', 0.16), 0, (SEA + BED) / 2, 0).renderOrder = 2;
    for (const [x, z, s] of [[-1.2, -1.5, 0.3], [1.4, 1.6, 0.36], [-2.6, -1.2, 0.24]]) add(new THREE.DodecahedronGeometry(s), ctx.mat('#c8d8dc', { flatShading: true, roughness: 0.9 }), x, BED + s * 0.5, z);

    // the pipeline: along the seabed, then up the riser to the platform
    const PY = BED + 0.2, curve = new THREE.CatmullRomCurve3([[-2.8, PY + 0.25, 0.7], [-2.3, PY, 1.0], [-1.5, PY, 1.5], [-0.5, PY, 0.1], [0.5, PY, -1.3], [1.6, PY, -0.6], [2.3, PY, 0.5], [2.7, PY + 0.5, 0.9], [2.75, 2.2, 0.9], [2.75, 3.9, 0.9]].map((p) => new THREE.Vector3(...p)));
    const N = 14, segs = [], up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
    const frost = ctx.lit('#eaffff', 0.7), frostGeo = new THREE.IcosahedronGeometry(0.2, 0);
    for (let k = 0; k < N; k++) {
      const a = curve.getPointAt(k / N), b = curve.getPointAt((k + 1) / N), mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }); own.push(mat);
      const pipe = add(new THREE.CylinderGeometry(0.11, 0.11, a.distanceTo(b) * 1.04, 12), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      pipe.quaternion.setFromUnitVectors(up, tmp.copy(b).sub(a).normalize());
      const ice = add(frostGeo, frost, pipe.position.x, pipe.position.y + 0.12, pipe.position.z); ice.rotation.set(k, k * 2, k * 3); ice.visible = false;
      segs.push({ mat, ice, grow: 0, x: (k + 0.5) / N * L });
    }
    const coats = { 25: null, 8: add(new THREE.TubeGeometry(curve, 70, 0.17, 10), clear('#ffd76a', 0.42), 0, 0, 0), 3: add(new THREE.TubeGeometry(curve, 70, 0.23, 10), clear('#2c5870', 0.55), 0, 0, 0) };
    coats[8].renderOrder = 1; coats[3].renderOrder = 1;
    // pulses of fluid moving along the pipe, and the test batch
    const pulses = []; for (let k = 0; k < 6; k++) { const mat = new THREE.MeshStandardMaterial({ roughness: 0.4 }); own.push(mat); pulses.push({ m: add(new THREE.SphereGeometry(0.15, 12, 8), mat, 0, 0, 0), mat, u: k / 6 }); }
    const batch = add(new THREE.SphereGeometry(0.26, 16, 12), ctx.lit('#ffffff', 1.5), -2.8, PY + 0.25, 0.7); batch.add(ctx.glow('#fff2b0', 1.1, 0.8)); batch.visible = false;

    // the wellhead, its valve wheel and the inhibitor tank
    const steel = ctx.mat('#2c5870', { metalness: 0.5, roughness: 0.4 });
    const well = add(new THREE.BoxGeometry(0.8, 0.5, 0.8), steel, -2.9, BED + 0.25, 0.7);
    add(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 12), ctx.mat('#f2a23a', { roughness: 0.5 }), -2.9, BED + 0.85, 0.7);
    const wheel = add(new THREE.TorusGeometry(0.3, 0.06, 8, 20), ctx.mat('#e0362f', { roughness: 0.5 }), -2.9, BED + 1.3, 0.7); wheel.rotation.x = Math.PI / 2;
    label('Wellhead 60 °C', 0.3, 0, 0.5, 0, wheel);
    add(new THREE.CylinderGeometry(0.28, 0.28, 1.0, 14), clear('#dffaff', 0.25), -2.9, BED + 0.5, -0.5).renderOrder = 3;
    const megFill = add(new THREE.CylinderGeometry(0.24, 0.24, 1, 14), ctx.lit('#3bbf9a', 0.5), -2.9, BED, -0.5); label('MEG', 0.26, -2.9, BED + 1.25, -0.5);
    ctx.onTap(wheel, () => send()); ctx.onTap(well, () => send());

    // the platform and its arrival thermometer
    for (const [x, z] of [[2.2, 0.2], [3.3, 0.2], [2.2, 1.5], [3.3, 1.5]]) add(new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8), steel, x, 2.0, z);
    add(new THREE.BoxGeometry(1.5, 0.14, 1.7), ctx.mat('#f2a23a', { roughness: 0.6 }), 2.75, 4.05, 0.85);
    add(new THREE.BoxGeometry(0.6, 0.45, 0.6), ctx.mat('#f4f4f4'), 3.1, 4.35, 0.5);
    const TH = 0.9, TB = 4.15;                                                      // thermometer height and base
    add(new THREE.CylinderGeometry(0.1, 0.1, TH, 12), clear('#ffffff', 0.25), 2.35, TB + TH / 2, 1.4).renderOrder = 3;
    const okMat = ctx.lit('#17a673', 1.0), badMat = ctx.lit('#d9485f', 1.0);
    const mercury = add(new THREE.CylinderGeometry(0.07, 0.07, 1, 10), badMat, 2.35, TB, 1.4);
    const needRing = add(new THREE.TorusGeometry(0.13, 0.025, 6, 16), ctx.lit('#ffffff', 1.0), 2.35, TB, 1.4); needRing.rotation.x = Math.PI / 2;
    label('Platform', 0.3, 2.75, 5.3, 0.85);

    // ----- state -----
    let U = 25, m = 15, meg = 0, state = 'idle', u = 0, tries = 0, done = false, clock = 0, megVis = 0;
    const rOut = ui.readout('Arrival T (°C)'), rNeed = ui.readout('Needed T (°C)'), rLine = ui.readout(`Hydrate line at ${P} MPa (°C)`), rNtu = ui.readout('NTU = UπDL/(ṁcp)'), rAt = ui.readout('Test batch: distance (km) and T (°C)');
    const setU = (v) => { U = +v; refresh(); };
    ui.choice([[25, 'Bare steel (U 25)'], [8, 'Foam coat (U 8)'], [3, 'Pipe-in-pipe (U 3)']], 25, setU);
    const flowS = ui.slider({ label: 'Flow rate', min: 5, max: maxFlow, step: 1, value: m, unit: 'kg/s', onInput: (v) => { m = +v; refresh(); } });
    const megS = ui.slider({ label: 'MEG inhibitor', min: 0, max: maxMeg, step: 1, value: 0, unit: 'wt%', onInput: (v) => { meg = +v; refresh(); } });
    ui.button('🛢️ Send a test batch', () => send(), 'btn');
    ui.note(`Line pressure ${P} MPa, 20 km, seabed ${TSEA} °C. Red pipe is hot, blue pipe is cold. The fluid must arrive at least ${MARGIN} °C warmer than the hydrate line.` + (top ? ` This old well gives at most ${maxFlow} kg/s, and only ${maxMeg} wt% of inhibitor is on board.` : ''));

    function refresh() {
      const To = model.Tat(L, U, m), nd = model.need(P, meg);
      rOut.set(To.toFixed(1)); rNeed.set(nd.toFixed(1)); rLine.set(model.line(P, meg).toFixed(1)); rNtu.set(model.ntu(U, m).toFixed(2));
      for (const s of segs) heat(model.Tat(s.x, U, m), s.mat.color), s.mat.emissive.copy(s.mat.color).multiplyScalar(0.35);
      coats[8].visible = U === 8; coats[3].visible = U === 3;
      mercury.material = To >= nd ? okMat : badMat; mercury.scale.y = Math.max(0.02, To / 70 * TH); mercury.position.y = TB + mercury.scale.y / 2;
      needRing.position.y = TB + Math.max(0, Math.min(1, nd / 70)) * TH;
      if (state === 'idle') rAt.set('–');
    }
    function send() {
      if (state === 'run') return;
      state = 'run'; u = 0; tries++; batch.visible = true;
      ctx.say('The test batch leaves the wellhead at 60 °C. Watch it lose heat to the cold sea on the way.');
    }
    function judge() {
      state = 'idle'; batch.visible = false;
      const To = model.Tat(L, U, m), ln = model.line(P, meg), nd = ln + MARGIN, coat = U === 25 ? 'bare steel' : U === 8 ? 'the foam coat' : 'pipe-in-pipe';
      if (To >= nd) {
        ctx.say(`Safe! The fluid arrives at ${To.toFixed(1)} °C and hydrate cannot form above ${ln.toFixed(1)} °C at ${P} MPa. Hot fluid loses heat to cold seawater; more flow, better insulation or inhibitor keeps it out of the ice-like hydrate region.`);
        if (!done) { done = true; ctx.complete(Math.max(0.6, 1 - meg / 60), `P=${P} MPa, U=${U}, flow=${m} kg/s, MEG=${meg} wt%, arrival=${To.toFixed(1)} °C, tries=${tries}`); }
        return;
      }
      if (To >= ln) return ctx.say(`No hydrate yet, but too close: the fluid arrives at ${To.toFixed(1)} °C, only ${(To - ln).toFixed(1)} °C above the hydrate line. The rule is a ${MARGIN} °C margin, because a cold day or a slow-down could tip it over.`);
      const x = model.reach(ln, U, m);
      ctx.say(`Danger: with ${coat} at ${m} kg/s the fluid drops below the hydrate line (${ln.toFixed(1)} °C) after about ${x == null ? 20 : (x / 1000).toFixed(1)} km and arrives at ${To.toFixed(1)} °C. Ice-like hydrate would plug the pipe there. ` +
        (U > 3 ? 'Better insulation lets less heat leak out.' : m < maxFlow ? 'A faster flow spends less time in the cold pipe.' : 'A little inhibitor lowers the temperature at which hydrate can form.'));
    }

    megFill.scale.y = 0.02; refresh();
    ctx.say('Hot fluid from the well cools on its long trip along the cold seabed. Choose the pipe coat, the flow and the inhibitor, then send a test batch.');
    return {
      step(dt) {
        clock += dt;
        const ln = model.line(P, meg);
        for (const s of segs) {
          const want = model.Tat(s.x, U, m) < ln ? Math.min(1.3, 0.7 + (ln - model.Tat(s.x, U, m)) * 0.06) : 0;
          s.grow += (want - s.grow) * Math.min(1, dt * (ctx.calm ? 8 : 2)); s.ice.visible = s.grow > 0.03; s.ice.scale.setScalar(Math.max(0.03, s.grow));
        }
        megVis += (meg / 30 - megVis) * Math.min(1, dt * 4); megFill.scale.y = Math.max(0.02, megVis * 0.96); megFill.position.y = BED + megFill.scale.y / 2;
        const speed = 0.04 + m / 60 * 0.3;
        for (const p of pulses) { p.u = (p.u + speed * dt) % 1; p.m.position.copy(curve.getPointAt(p.u)); heat(model.Tat(p.u * L, U, m), p.mat.color); p.mat.emissive.copy(p.mat.color).multiplyScalar(0.6); }
        if (state === 'run') {
          u = Math.min(1, u + dt / (ctx.calm ? 2.5 : 5)); batch.position.copy(curve.getPointAt(u));
          rAt.set(`${(u * 20).toFixed(1)} km, ${model.Tat(u * L, U, m).toFixed(1)} °C`);
          if (u >= 1) judge();
        }
      },
      frame(dt) { if (!ctx.calm) wheel.rotation.z += dt * (state === 'run' ? 2.5 : 0.2); },
      // Shows a successful run without the player (used by tests): best insulation, full flow, no inhibitor.
      autoplay() { setU(3); m = maxFlow; flowS.set(maxFlow); meg = 0; megS.set(0); refresh(); send(); },
      dispose() { for (const o of own) o.dispose(); },
      get state() { return state; },
    };
  },
};
