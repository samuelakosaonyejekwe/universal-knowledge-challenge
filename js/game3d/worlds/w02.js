// World 2 — Chemistry and Materials Science: the Garden of Glowing Flasks.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: a strong acid (HCl) titrated with a strong base (NaOH), both fully split into ions -----
const KW = 1.0e-14;                 // ion product of water at 25 °C, (mol/L)²
export const model = {
  KW,
  // Acid left over after mixing, mol/L (negative when base is left over). Volumes in mL, concentrations in mol/L.
  net: (ca, va, cb, vb) => (ca * va - cb * vb) / (va + vb),
  // [H⁺] from the charge balance [H⁺] − [OH⁻] = net together with [H⁺][OH⁻] = Kw, so water's own ions are counted.
  hydrogen(net) { const root = Math.sqrt(net * net + 4 * KW); return net >= 0 ? (net + root) / 2 : KW / ((root - net) / 2); },
  pH(ca, va, cb, vb) { return -Math.log10(model.hydrogen(model.net(ca, va, cb, vb))); },
  // Volume of base (mL) at which moles of base equal moles of acid.
  equivalence: (ca, va, cb) => ca * va / cb,
  // The acid's concentration worked back from a finished titration.
  acidFrom: (va, cb, vEq) => cb * vEq / va,
};
// Used by the automated tests: textbook values for 25.00 mL of 0.100 mol/L HCl titrated with 0.100 mol/L NaOH.
export function selfTest() {
  const start = model.pH(0.1, 25, 0.1, 0), half = model.pH(0.1, 25, 0.1, 12.5), vEq = model.equivalence(0.1, 25, 0.1);
  const eq = model.pH(0.1, 25, 0.1, vEq), over = model.pH(0.1, 25, 0.1, 30), dilute = model.pH(1e-8, 25, 0.1, 0);
  const h = model.hydrogen(-0.5 / 55), product = h * (h + 0.5 / 55);                    // [H⁺][OH⁻] must stay equal to Kw
  const near = (a, b, e) => Math.abs(a - b) <= e;
  const ok = near(start, 1, 0.001) && near(half, 1.4771, 0.001) && near(vEq, 25, 1e-9) && near(eq, 7, 0.001) && near(over, 11.9586, 0.001)
    && near(dilute, 6.9783, 0.001) && near(product / KW, 1, 1e-9) && near(model.acidFrom(25, 0.1, vEq), 0.1, 1e-12);
  return { ok, detail: `0.1 M HCl pH ${start.toFixed(2)}; half-way (12.5 mL) pH ${half.toFixed(3)}; equivalence ${vEq.toFixed(2)} mL pH ${eq.toFixed(2)}; 5 mL excess NaOH pH ${over.toFixed(3)}; 1e-8 M HCl pH ${dilute.toFixed(3)}` };
}

const sim = {
  title: 'Titration bench',
  goal: 'Run sodium hydroxide from the burette into the flask of hydrochloric acid. Stop at the equivalence point, where the moles of base equal the moles of acid and the pH is 7.',
  kind: 'validated',
  model: 'A strong acid (hydrochloric acid, HCl) mixed with a strong base (sodium hydroxide, NaOH) at 25 °C. Both are treated as fully split into ions, the volumes simply add, and the pH comes from the exact charge balance with water\'s own ions included (Kw = 1.0 × 10⁻¹⁴), so it is correct right at neutral. Checked against textbook values: pH 1.00 at the start, 7.00 at the equivalence point and 11.96 with 5 mL too much base. It leaves out activity effects in strong solutions, carbon dioxide from the air, temperature changes from the heat of the reaction, and the small errors of a real burette and a real indicator.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = Math.max(1, Math.min(6, Math.round(ctx.level || 1)));
    const tol = [3, 2.5, 2, 1.5, 1, 0.5][L - 1], pickBase = L >= 4, unknown = L >= 5, rnd = ctx.rng || Math.random;
    const va = L >= 4 ? 20 : 25;                                                         // mL of acid in the flask
    const ca = unknown ? [0.06, 0.08, 0.1, 0.12][Math.floor(rnd() * 4) % 4] : L === 3 ? 0.08 : L === 4 ? 0.12 : 0.1;
    const CAP = 5000;                                                                    // the burette holds 50.00 mL, counted in steps of 0.01 mL
    let cb = 0.1, n = 0, pending = 0, drop = 100, flasks = 1, done = false, auto = false, guess = 0.05, hinted = '', dripT = 0;
    const own = [], keep = (o) => { own.push(o); return o; };
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(keep(geo), material); m.position.set(x, y, z); parent.add(m); return m; };

    // the bench, the stand and the burette
    const X = 1.0, TOP = 0.7;
    add(new THREE.BoxGeometry(3.4, 0.2, 1.7), ctx.mat('#7a5a36', { roughness: 0.7 }), X + 0.2, TOP - 0.1, 0);
    for (const sx of [-1.3, 1.7]) add(new THREE.BoxGeometry(0.2, TOP - 0.2, 1.5), ctx.mat('#5d4326'), X + sx, (TOP - 0.2) / 2, 0);
    const steel = ctx.mat('#b9c6cf', { metalness: 0.6, roughness: 0.3 });
    add(new THREE.BoxGeometry(1.5, 0.08, 0.9), steel, X + 0.55, TOP + 0.04, -0.25);
    add(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 8), steel, X + 1.1, TOP + 2.1, -0.25);
    add(new THREE.BoxGeometry(1.15, 0.08, 0.1), steel, X + 0.55, 3.7, -0.12);
    const glass = keep(new THREE.MeshStandardMaterial({ color: 0xdffcf4, transparent: true, opacity: 0.26, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    const tube = add(new THREE.CylinderGeometry(0.11, 0.11, 2.4, 16, 1, true), glass, X, 3.5, 0); tube.renderOrder = 3;
    add(new THREE.CylinderGeometry(0.11, 0.025, 0.25, 12), ctx.mat('#e9f6f2', { roughness: 0.2 }), X, 2.18, 0);
    add(new THREE.BoxGeometry(0.3, 0.06, 0.06), ctx.mat('#0e9f8e'), X, 2.3, 0.02);
    const B0 = 2.33, BL = 2.3, base = add(new THREE.CylinderGeometry(0.085, 0.085, BL, 12), ctx.mat('#9fd8ff', { roughness: 0.2 }), X, B0 + BL / 2, 0);
    const bead = add(new THREE.SphereGeometry(0.05, 10, 8), ctx.mat('#9fd8ff', { roughness: 0.2 }), X, 2, 0); bead.visible = false;

    // the conical flask and the liquid whose colour follows the indicator
    const flask = new THREE.Group(); flask.position.set(X, TOP, 0); group.add(flask);
    const body = add(new THREE.LatheGeometry([[0, 0], [0.75, 0], [0.78, 0.06], [0.2, 1.0], [0.2, 1.3], [0.27, 1.35]].map(([r, y]) => new THREE.Vector2(r, y)), 28), glass, 0, 0, 0, flask); body.renderOrder = 3;
    const liquidMat = keep(new THREE.MeshStandardMaterial({ color: 0xe5383b, emissive: 0xe5383b, emissiveIntensity: 0.45, roughness: 0.25 }));
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 0.3, 28), liquidMat); flask.add(liquid);
    const halo = ctx.glow('#ffffff', 2.6, 0.35); halo.position.set(0, 0.4, -0.2); flask.add(halo);
    let depth = -1;
    const fill = (mL) => { const h = Math.round((0.15 + 0.5 * mL / 75) * 100) / 100; if (h === depth) return; depth = h; liquid.geometry.dispose(); liquid.geometry = new THREE.CylinderGeometry(0.72 - 0.6 * h, 0.72, h, 28); liquid.position.y = 0.03 + h / 2; };
    // universal indicator: red in strong acid, green at neutral, blue and violet in base
    const stops = [[1, '#e5383b'], [3, '#f3722c'], [5, '#f9c80e'], [7, '#3fb950'], [8.5, '#1fa2a8'], [10, '#3466e0'], [13, '#7b3fd1']].map(([p, c]) => [p, new THREE.Color(c)]);
    const tint = (pH, out) => { let i = 1; while (i < stops.length - 1 && pH > stops[i][0]) i++; const [p0, c0] = stops[i - 1], [p1, c1] = stops[i]; return out.copy(c0).lerp(c1, Math.min(1, Math.max(0, (pH - p0) / (p1 - p0)))); };

    // the titration curve: pH (0 to 14) against millilitres of base (0 to 50)
    const OX = -3.2, OY = 1.0, W = 2.6, H = 2.8, ZC = -0.4, px = (mL) => OX + W * mL / 50, py = (pH) => OY + H * Math.min(14, Math.max(0, pH)) / 14;
    add(new THREE.BoxGeometry(W + 0.7, H + 0.8, 0.08), ctx.mat('#103a3a', { roughness: 0.9 }), OX + W / 2 - 0.05, OY + H / 2 + 0.05, ZC - 0.08);
    add(new THREE.BoxGeometry(W + 0.7, 0.9, 0.5), ctx.mat('#5d4326'), OX + W / 2 - 0.05, 0.45, ZC - 0.1);
    const axis = keep(new THREE.MeshBasicMaterial({ color: 0xd6fff0 }));
    add(new THREE.BoxGeometry(W, 0.025, 0.02), axis, OX + W / 2, OY, ZC); add(new THREE.BoxGeometry(0.025, H, 0.02), axis, OX, OY + H / 2, ZC);
    add(new THREE.PlaneGeometry(W, H * 2 * tol / 14), keep(new THREE.MeshBasicMaterial({ color: 0x44c96b, transparent: true, opacity: 0.3, depthWrite: false })), OX + W / 2, py(7), ZC + 0.005);
    for (const [text, x, y] of [['pH', OX - 0.05, OY + H + 0.22], ['7', OX - 0.2, py(7)], ['mL', OX + W + 0.05, OY - 0.22]]) { const s = ctx.sprite(text, { size: 0.34 }); s.position.set(x, y, ZC + 0.05); group.add(s); }
    const MAXP = 1500, curvePos = new Float32Array(MAXP * 3), curveGeo = keep(new THREE.BufferGeometry()); curveGeo.setAttribute('position', new THREE.BufferAttribute(curvePos, 3));
    const curve = new THREE.Line(curveGeo, keep(new THREE.LineBasicMaterial({ color: 0xfff3a8 }))); curve.frustumCulled = false; group.add(curve);
    const dot = add(new THREE.SphereGeometry(0.06, 12, 8), ctx.lit('#fff3a8', 1.5), OX, OY, ZC + 0.03);
    let np = 0, plotN = -99, plotPH = -99;

    // controls and readouts
    const fmt = (v, d = 2) => v.toFixed(d), nowPH = () => model.pH(ca, va, cb, n / 100);
    ui.note(unknown ? `The flask holds ${fmt(va)} mL of hydrochloric acid (HCl). Nobody wrote down how strong it is: find out.` : `The flask holds ${fmt(va)} mL of hydrochloric acid (HCl), ${fmt(ca, 3)} mol/L, with a few drops of universal indicator.`);
    if (pickBase) ui.choice([[0.05, 'NaOH 0.050 mol/L'], [0.1, 'NaOH 0.100 mol/L'], [0.2, 'NaOH 0.200 mol/L']], cb, (v) => { cb = +v; fresh(false); ctx.say(`The burette now holds NaOH of ${fmt(cb, 3)} mol/L and the flask is fresh. A weaker base needs more millilitres, so each drop changes the pH less.`); });
    ui.choice([[500, 'Add 5 mL'], [100, 'Add 1 mL'], [10, 'Add 0.1 mL'], [1, 'Add 0.01 mL']], drop, (v) => { drop = +v; });
    const rV = ui.readout('NaOH added, mL'), rP = ui.readout('pH'), rA = ui.readout('Acid at start, mmol'), rB = ui.readout('Base added, mmol'), rF = ui.readout('Flask volume, mL'), rT = ui.readout('Target pH');
    const answerS = unknown ? ui.slider({ label: 'My answer: acid strength', min: 0.02, max: 0.2, step: 0.005, value: guess, unit: 'mol/L', onInput: (v) => { guess = +v; } }) : null;
    rT.set(`${fmt(7 - tol, 1)} to ${fmt(7 + tol, 1)}`); rA.set(unknown ? '?' : fmt(ca * va));

    const show = () => {
      const vb = n / 100, pH = nowPH();
      tint(pH, liquidMat.color); liquidMat.emissive.copy(liquidMat.color); halo.material.color.copy(liquidMat.color); fill(va + vb);
      const left = Math.max(0.001, 1 - n / CAP); base.scale.y = left; base.position.y = B0 + BL * left / 2;
      rV.set(fmt(vb)); rP.set(fmt(pH)); rB.set(fmt(cb * vb, 3)); rF.set(fmt(va + vb));
      if (np < MAXP && (np === 0 || !pending || n - plotN >= 5 || Math.abs(pH - plotPH) > 0.08)) { curvePos.set([px(vb), py(pH), ZC + 0.02], np * 3); np++; plotN = n; plotPH = pH; curveGeo.setDrawRange(0, np); curveGeo.attributes.position.needsUpdate = true; }
      dot.position.set(px(vb), py(pH), ZC + 0.03);
    };
    // A clean flask of the same acid and a refilled burette.
    function fresh(count = true) { if (done) return; if (count && n > 0) flasks++; n = 0; pending = 0; np = 0; plotN = plotPH = -99; hinted = ''; show(); }
    const pour = (units) => {
      if (done) return;
      const room = CAP - n - pending;
      if (room <= 0) { ctx.say('The burette is empty: all 50.00 mL has gone in. Take a new flask and try again.'); return; }
      pending += Math.min(units, room); dripT = 0.45;
    };
    const check = () => {
      if (done || pending) return;
      const vb = n / 100, pH = nowPH(), acid = ca * va, alkali = cb * vb;
      if (!n) { ctx.say(`Nothing has been added yet, so the flask is still acid: pH ${fmt(pH)}. Open the burette first.`); return; }
      if (pH < 7 - tol) { ctx.say(unknown ? `pH ${fmt(pH)}: still acidic. There is more acid than base in the flask, so some H⁺ is left over. Add more NaOH, and use smaller drops as the colour starts to change.` : `pH ${fmt(pH)}: still acidic. The flask began with ${fmt(acid, 3)} mmol of acid and has had only ${fmt(alkali, 3)} mmol of base. The moles of base must equal the moles of acid.`); return; }
      if (pH > 7 + tol) { ctx.say(`pH ${fmt(pH)}: too far. ${unknown ? 'More base has gone in than there was acid' : `${fmt(alkali, 3)} mmol of base is more than the ${fmt(acid, 3)} mmol of acid`}, so OH⁻ is left over and the indicator has turned blue. Take a new flask and stop sooner.`); return; }
      if (unknown && Math.abs(guess - ca) > 0.0026) { ctx.say(`You stopped in the right place: pH ${fmt(pH)}. Now work out the acid. Moles of base = ${fmt(cb, 3)} mol/L × ${fmt(vb)} mL = ${fmt(alkali, 3)} mmol. The moles of acid are the same. Divide them by the ${fmt(va)} mL of acid and set your answer.`); return; }
      done = true; auto = false;
      ctx.say(unknown
        ? `Equivalence point! ${fmt(vb)} mL × ${fmt(cb, 3)} mol/L = ${fmt(alkali, 3)} mmol of NaOH, so the flask held ${fmt(alkali, 3)} mmol of HCl. ${fmt(alkali, 3)} mmol ÷ ${fmt(va)} mL = ${fmt(model.acidFrom(va, cb, vb), 3)} mol/L. Every H⁺ met one OH⁻ and made water, leaving salty water at pH ${fmt(pH)}.`
        : `Equivalence point! Acid: ${fmt(ca, 3)} mol/L × ${fmt(va)} mL = ${fmt(acid, 3)} mmol. Base: ${fmt(cb, 3)} mol/L × ${fmt(vb)} mL = ${fmt(alkali, 3)} mmol. Moles of acid = moles of base, so every H⁺ met one OH⁻ and made water. Only salty water is left: pH ${fmt(pH)}.`);
      ctx.complete(Math.max(0.6, 1 - 0.1 * (flasks - 1)), `pH=${fmt(pH)}, V=${fmt(vb)} mL, flasks=${flasks}`);
    };
    // What the guide says when a pour has finished.
    const hint = () => {
      const pH = nowPH(), key = Math.abs(pH - 7) <= tol ? 'in' : pH > 7 ? 'over' : pH > 3 ? 'near' : '';
      if (!key || key === hinted || auto) return; hinted = key;
      if (key === 'in') ctx.say(`pH ${fmt(pH)}: you are inside the target. If you think the acid and the base are balanced, press Check.`);
      else if (key === 'over') ctx.say(`pH ${fmt(pH)}: the colour jumped past green. Near the end almost no acid is left, so one small drop of base changes the pH a lot.`);
      else ctx.say(`pH ${fmt(pH)}: the colour is starting to change, so most of the acid is used up. Switch to smaller drops now.`);
    };
    ui.button('💧 Add', () => pour(drop), 'btn');
    ui.button('Check', check, 'btn');
    ui.button('New flask', () => { fresh(); ctx.say('A clean flask of the same acid, and the burette is full again.'); });
    ui.note('Count in moles: moles = concentration × volume. Near the end one step of 0.01 mL can move the pH by more than 2, so go slowly.');
    show();
    ctx.say(unknown ? 'Add NaOH until the indicator turns green, then use the volume you needed to work out how strong the acid is.' : 'Choose a drop size and add NaOH. Watch the colour: red is acid, green is neutral, blue is base.');

    return {
      step(dt) {
        if (done) return;
        if (pending > 0) {
          const amount = Math.min(pending, Math.max(1, Math.round((pending > 60 ? 600 : 120) * dt)));
          n += amount; pending -= amount; dripT = 0.45; show();
          if (!pending) hint();
        } else if (auto) {
          const target = Math.round(model.equivalence(ca, va, cb) * 100), left = target - n;
          if (left < 0) fresh();
          else if (left > 0) pour(left >= 500 ? 500 : left >= 100 ? 100 : left >= 10 ? 10 : 1);
          else { if (unknown) { guess = ca; answerS.set(ca); } check(); }
        }
        if (dripT > 0) dripT -= dt;
      },
      frame(dt, time = 0) {
        const surface = TOP + 0.03 + depth, flowing = dripT > 0;
        bead.visible = flowing; if (flowing) bead.position.y = 2.03 - (2.03 - surface) * ((time * 3.2) % 1);
        flask.rotation.z = flowing && !ctx.calm ? Math.sin(time * 9) * 0.035 : 0;
      },
      // Shows a successful run without the player (used by tests).
      autoplay() { if (!done) auto = true; },
      dispose() { liquid.geometry.dispose(); for (const o of own) o.dispose(); },
      get state() { return done ? 'done' : pending ? 'pouring' : 'ready'; },
    };
  },
};

const M = -1;                         // this world's route bends the other way from World 1

export default {
  id: 2,
  theme: {
    sky: ['#04343a', '#0e9f8e', '#e3f9a6'], fog: '#3fb79c', fogNear: 42, fogFar: 150,
    ground: '#3aa878', ground2: '#5fcf8c', side: '#14594f', stone: '#cfe6da', accent: '#0e9f8e', glow: '#d7ff7a', metal: '#8a6a2f', wood: '#9a6b3f', leaf: '#44c96b', water: '#35d6c4', crate: '#f2c14e',
    sun: '#fff3c2', sunPower: 2.3, ambient: 1.3, skyLight: '#d6fff0', groundLight: '#1d6b52', sunDir: [-0.4, 0.9, 0.5], particles: 'bubbles',
  },
  layout: { mirror: M, stones: 5, rise: 0.4, towerH: 4.5 },
  story: {
    title: 'The Garden of Glowing Flasks',
    crystal: 'element seeds', crystalEm: '🌱',
    intro: ['Welcome to the Garden of Glowing Flasks! Everything here is made of tiny pieces called atoms, and we grow new materials from them.', 'This morning a gust of wind blew our five element seeds across the islands. And the big flask on the bench is still full of sour acid that nobody has balanced.'],
    remind: 'The element seeds shine yellow-green. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five seeds! Now ride the lift from the tower to the titration bench and balance the acid, drop by drop.',
    afterSim: 'The flask is green and calm. Only the Master Mixer stands between you and the portal — the arena is up the steps.',
    notReady: 'The arena is for careful chemists. Bring all five element seeds and balance the acid first.',
    rival: ['So you turned a flask green. Mixing is easy. Knowing why it works is hard.', 'We each build a bridge of light, one piece for every right answer. Let us see whose bridge is finished first.'],
    win: ['Your bridge is finished before mine. You measured, you counted and you reasoned well — the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and try me.'],
    outro: 'The seeds are planted, the acid is balanced, and the Keeper of the Elements is smiling. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, V2 = (r, y) => new THREE.Vector2(r, y);
    const glass = k.mat('#dffcf4', { transparent: true, opacity: 0.28, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false });
    const see = (m) => { m.castShadow = false; m.renderOrder = 3; return m; };
    // the periodic table: a wall of 90 coloured tiles, one colour for each family of elements
    const wall = k.block(-8.6 * M, 3.3, 0, 0.3, 3.3, 6.4, { color: '#14594f' });
    const cells = []; for (let row = 0; row < 7; row++) for (let c = 0; c < 18; c++) if (row > 2 || c === 0 || c === 17 || (row > 0 && (c === 1 || c > 11))) cells.push([row, c]);
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.29, 0.29), k.mat('#ffffff', { roughness: 0.45 }), cells.length), spot = new THREE.Object3D(), shade = new THREE.Color();
    cells.forEach(([row, c], i) => { spot.position.set(M * 0.17, 1.0 - row * 0.34, (c - 8.5) * 0.34 * -M); spot.updateMatrix(); tiles.setMatrixAt(i, spot.matrix); tiles.setColorAt(i, shade.set(row === 0 && c === 0 ? '#ffffff' : c === 0 ? '#ff8f6b' : c === 1 ? '#ffc857' : c < 12 ? '#5cc8f0' : c < 17 ? '#8be37a' : '#c79bff')); });
    tiles.receiveShadow = true; wall.mesh.add(tiles);
    // a giant round flask on a plinth, with bubbles rising through it
    const fx = -5.9 * M, fz = -5.9; k.block(fx, 0.5, fz, 1.6, 0.5, 1.6);
    const round = []; for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + i / 14 * (Math.PI / 2 + 1.3); round.push(V2(Math.cos(a) * 1.2, 1.2 + Math.sin(a) * 1.2)); } round.push(V2(0.32, 3.3), V2(0.44, 3.4));
    see(k.mesh(new THREE.LatheGeometry(round, 28), glass, fx, 0.5, fz));
    k.mesh(new THREE.SphereGeometry(1.08, 24, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), k.lit('#44c96b', 0.9, { side: THREE.DoubleSide }), fx, 1.7, fz).castShadow = false;
    const fizz = [0, 1].map((i) => { const b = k.mesh(new THREE.SphereGeometry(0.13, 10, 8), k.lit('#eaffd0', 1.2), fx + (i ? 0.35 : -0.3), 1.2, fz + (i ? -0.2 : 0.25)); b.castShadow = false; return b; });
    // a tall conical flask, lamps by the gate and glowing mushrooms
    const cx = 6.6 * M, cz = -5.6;
    see(k.mesh(new THREE.LatheGeometry([V2(0, 0), V2(1.1, 0), V2(1.12, 0.08), V2(0.3, 1.9), V2(0.3, 2.6), V2(0.42, 2.7)], 28), glass, cx, 0, cz));
    k.mesh(new THREE.CylinderGeometry(0.72, 1.04, 0.85, 24), k.lit('#ff9f6b', 0.8), cx, 0.47, cz).castShadow = false;
    k.prop('lamp', 4.6, 0, 7.2); k.prop('lamp', -4.6, 0, 7.2);
    k.prop('mushroom', -7.4 * M, 0, 5, { s: 1.3, color: '#ff8fc7' }); k.prop('mushroom', 7.2 * M, 0, 4.6, { color: '#ffd24a' });
    // a ball-and-stick model of methane (one carbon, four hydrogens) turning above the middle island
    const mid = S.mid, mx = 4.3 * M, mz = mid[2] - 3.3, up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    k.mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.3, 10), k.mat(k.theme.stone), mx, mid[1] + 0.65, mz);
    const carbon = k.mesh(new THREE.SphereGeometry(0.5, 20, 14), k.mat('#33474f', { roughness: 0.4 }), mx, mid[1] + 2.75, mz);
    for (const [x, y, z] of [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]) {
      dir.set(x, y, z).normalize();
      k.mesh(new THREE.SphereGeometry(0.3, 16, 12), k.mat('#f4fbff', { roughness: 0.35 }), dir.x * 1.2, dir.y * 1.2, dir.z * 1.2, carbon);
      k.mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), k.mat('#b9c6cf'), dir.x * 0.6, dir.y * 0.6, dir.z * 0.6, carbon).quaternion.setFromUnitVectors(up, dir);
    }
    // a salt crystal on the far island: sodium and chloride ions taking turns at the corners of a cube
    const far = S.far, cube = see(k.mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), k.mat('#eaffff', { transparent: true, opacity: 0.14, depthWrite: false }), -4.6 * M, far[1] + 2.1, far[2] - 2.4));
    cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0xeaffff })));
    for (let i = 0; i < 8; i++) { const a = i & 1, b = (i >> 1) & 1, c = (i >> 2) & 1, big = (a + b + c) % 2; k.mesh(new THREE.SphereGeometry(big ? 0.3 : 0.2, 14, 10), big ? k.lit('#8be37a', 0.5) : k.lit('#c79bff', 0.5), a - 0.5, b - 0.5, c - 0.5, cube); }
    k.prop('lamp', 5.2 * M, far[1], far[2] + 0.5);
    // two bubbling vats behind the console, and a banner
    const pot = new THREE.LatheGeometry([V2(0, 0), V2(0.7, 0), V2(0.95, 0.5), V2(0.88, 1.0), V2(1.0, 1.06)], 20), brass = k.mat('#b98a3a', { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }), disc = new THREE.CircleGeometry(0.86, 20), pop = new THREE.SphereGeometry(0.16, 10, 8);
    const vats = [[2.6, '#b6ff6a'], [-2.6, '#6ae8ff']].map(([dx, c]) => {
      const x = S.sim[0] + dx * M, y = S.sim[1], z = S.sim[2] - 5.6;
      k.mesh(pot, brass, x, y, z); const top = k.mesh(disc, k.lit(c, 1.0), x, y + 0.9, z); top.rotation.x = -Math.PI / 2; top.castShadow = false;
      const b = k.mesh(pop, k.lit(c, 1.3), x + dx * 0.1, y + 0.9, z); b.castShadow = false; return { b, y: y + 0.9 };
    });
    k.prop('banner', S.sim[0] + 5.9 * M, S.sim[1], S.sim[2] - 1, { color: '#44c96b' });
    // lamps round the arena and rings beside the portal
    for (const a of [0.6, 2.2, 3.9, 5.4]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6, { color: '#7dffb0' });
    for (const sx of [-3.3, 3.3]) k.prop('ring', S.end[0] + sx, S.end[1] + 0.6, S.end[2], { s: 0.7 });
    // in the sky: a ring of six carbon atoms and two giant soap bubbles
    const hex = k.mesh(new THREE.TorusGeometry(7, 0.45, 8, 6), k.mat('#eafff2', { roughness: 0.6, fog: false }), -30 * M, 30, 55); hex.castShadow = false; hex.rotation.set(0.5, 0.6 * M, 0);
    const atoms = new THREE.InstancedMesh(new THREE.SphereGeometry(1.7, 18, 12), k.lit('#44c96b', 0.5, { fog: false }), 6);
    for (let i = 0; i < 6; i++) { spot.position.set(Math.cos(i * Math.PI / 3) * 7, Math.sin(i * Math.PI / 3) * 7, 0); spot.updateMatrix(); atoms.setMatrixAt(i, spot.matrix); } hex.add(atoms);
    const soap = k.mat('#e9fffb', { transparent: true, opacity: 0.22, roughness: 0.05, fog: false, depthWrite: false });
    const floats = [[40 * M, 22, 30, 5], [-14 * M, 30, 78, 3.5]].map(([x, y, z, r]) => { const b = see(k.mesh(new THREE.SphereGeometry(r, 24, 16), soap, x, y, z)); return { b, y }; });
    k.animate((dt, t) => {
      carbon.rotation.y += dt * 0.5; carbon.rotation.x = Math.sin(t * 0.4) * 0.25;
      cube.rotation.y += dt * 0.35; cube.position.y = far[1] + 2.1 + Math.sin(t * 1.1) * 0.12;
      hex.rotation.z += dt * 0.06;
      fizz.forEach((b, i) => { const f = (t * 0.45 + i * 0.5) % 1; b.position.y = 0.9 + f * 1.0; b.scale.setScalar(0.5 + f * 0.7); });
      vats.forEach((v, i) => { const f = (t * 0.7 + i * 0.37) % 1; v.b.position.y = v.y + f * 0.9; v.b.scale.setScalar(Math.sin(f * Math.PI) * 1.1 + 0.05); });
      floats.forEach((o, i) => { o.b.position.y = o.y + Math.sin(t * 0.25 + i * 2) * 1.5; });
    });
  },
  sim,
};
