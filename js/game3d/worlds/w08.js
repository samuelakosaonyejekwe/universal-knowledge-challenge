// World 8 — World History and Civilisations: the Archive in the Dunes.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: radioactive decay of carbon-14, N/N0 = (1/2)^(t / half-life) -----
const HALF_LIFE = 5730;             // years
const MAX_AGE = 50000;              // years: beyond this too little carbon-14 is left to measure
export const model = {
  HALF_LIFE, MAX_AGE,
  fraction: (years) => Math.pow(0.5, years / HALF_LIFE),          // share of the carbon-14 still there
  age: (fraction) => -HALF_LIFE * Math.log2(fraction),            // years since the living thing died
  halfLives: (years) => years / HALF_LIFE,
};
// Used by the automated tests: one, two and three half-lives, and a round trip from age to fraction and back.
export function selfTest() {
  const a = model.fraction(5730), b = model.fraction(11460), c = model.age(0.125), back = model.age(model.fraction(23456));
  return { ok: Math.abs(a - 0.5) < 1e-12 && Math.abs(b - 0.25) < 1e-12 && Math.abs(c - 17190) < 1 && Math.abs(back - 23456) < 1e-6,
    detail: `5,730 y → ${(a * 100).toFixed(2)} %, 11,460 y → ${(b * 100).toFixed(2)} %, 12.5 % → ${c.toFixed(1)} y, round trip 23,456 y → ${back.toFixed(3)} y` };
}

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const LAYER_COLORS = ['#d9b46a', '#b5763c', '#8f5a34', '#77705f', '#5a3e2e'];                                   // top → deepest
const LAYER_NAMES = ['top layer', 'second layer', 'third layer', 'fourth layer', 'deepest layer'];
const LAYER_AGES = [[800, 2500], [3500, 6500], [8000, 11500], [13500, 18000], [20500, 26000]];                  // years, per layer

const sim = {
  title: 'The dating lab',
  goal: 'Choose a find, read how much carbon-14 it still holds, and turn the age dial until the decay curve gives the same amount. Date every find, and check that the deeper ones come out older.',
  kind: 'validated',
  model: 'Radioactive decay of carbon-14 with a half-life of 5,730 years: the share that is left equals one half raised to the power (age ÷ 5,730). The model is checked at one, two and three half-lives. It ignores calibration curves (the amount of carbon-14 in the air has changed a little over time, so real laboratories correct their dates against tree rings) and contamination by newer or older carbon, and the meter here reads the exact share with no measuring error. The method only works for things that were once alive, and only back to roughly 50,000 years.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = Math.max(1, Math.min(6, Math.round(ctx.level) || 1)), rnd = ctx.rng || Math.random;
    const tol = [800, 600, 400, 300, 200, 150][L - 1], count = [1, 1, 3, 3, 4, 5][L - 1], STEP = 50;
    const M = (geo, material, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // the cut-away dig on the left: five layers, the deepest laid down first
    const DX = -1.95, DW = 3.0, LH = 0.6, TOP = 3.0;
    LAYER_COLORS.forEach((c, i) => M(new THREE.BoxGeometry(DW - (i % 2) * 0.06, LH, 1.2), ctx.mat(c, { roughness: 1, flatShading: true }), DX, TOP - LH * (i + 0.5), -0.3));
    M(new THREE.BoxGeometry(DW + 0.16, 0.1, 1.3), ctx.mat('#8f9a4a', { roughness: 1 }), DX, TOP + 0.05, -0.3);
    const shapes = {
      charcoal: (g) => M(new THREE.DodecahedronGeometry(0.2, 0), ctx.mat('#2a2522', { flatShading: true }), 0, 0, 0, g),
      seed: (g) => { M(new THREE.SphereGeometry(0.13, 12, 8), ctx.mat('#e2bd5c', { roughness: 0.6 }), 0, 0, 0, g).scale.set(1.5, 1, 0.8); },
      bone: (g) => { M(new THREE.CapsuleGeometry(0.055, 0.34, 4, 8), ctx.mat('#f3ead6', { roughness: 0.6 }), 0, 0, 0, g).rotation.z = 1.1; },
      wood: (g) => { M(new THREE.CylinderGeometry(0.085, 0.1, 0.44, 10), ctx.mat('#8a5a2e', { roughness: 0.9 }), 0, 0, 0, g).rotation.z = 1.35; },
      basket: (g) => M(new THREE.TorusGeometry(0.14, 0.06, 8, 16), ctx.mat('#b79a55', { roughness: 1 }), 0, 0, 0, g),
    };
    const KINDS = [['charcoal', 'Charcoal', 'charcoal'], ['seed', 'Seed', 'seed'], ['bone', 'Bone tool', 'bone tool'], ['wood', 'Wood', 'piece of wood'], ['basket', 'Reed basket', 'reed basket']];
    const layers = count === 1 ? [L === 1 ? 1 : 2] : shuffle([0, 1, 2, 3, 4]).slice(0, count).sort((a, b) => a - b);
    const kinds = shuffle(KINDS.slice(0, Math.max(4, count))).slice(0, count);
    const gold = ctx.lit('#ffd76a', 1.4), green = ctx.lit('#59d98a', 1.2);
    const finds = layers.map((layer, i) => {
      const [lo, hi] = LAYER_AGES[layer], measured = Math.round(model.fraction(lo + rnd() * (hi - lo)) * 1e4) / 1e4;
      const g = new THREE.Group(); g.position.set(DX - DW / 2 + DW * (i + 0.5) / count, TOP - LH * (layer + 0.5), 0.42); g.scale.setScalar(1.25); group.add(g);
      shapes[kinds[i][0]](g);
      const ring = M(new THREE.TorusGeometry(0.3, 0.025, 6, 28), gold, 0, 0, 0, g); ring.visible = false;
      return { key: kinds[i][0], label: kinds[i][1], name: kinds[i][2], layer, measured, target: model.age(measured), date: null, g, ring };
    });

    // the meter and the decay curve on the right: age runs across, the share of carbon-14 left runs up
    const AX0 = 0.85, AX1 = 3.35, AY0 = 0.9, AY1 = 3.5, GX = 0.5;
    const px = (years) => AX0 + (AX1 - AX0) * years / MAX_AGE, py = (f) => AY0 + (AY1 - AY0) * f;
    M(new THREE.BoxGeometry(3.3, 3.2, 0.08), ctx.mat('#3a2a1e', { roughness: 0.9 }), 1.87, 2.2, -0.2);
    M(new THREE.BoxGeometry(0.28, AY1 - AY0 + 0.1, 0.05), ctx.mat('#1f1712'), GX, (AY0 + AY1) / 2, -0.14);
    const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
    const fill = M(unit, ctx.lit('#ff8a4c', 1.1), GX, AY0, -0.1); fill.scale.set(0.2, 0.01, 0.05);
    const line = M(new THREE.BoxGeometry(AX1 - GX + 0.1, 0.035, 0.03), ctx.lit('#ff8a4c', 1.1), (GX + AX1) / 2 + 0.05, AY0, -0.11);
    const cream = ctx.lit('#fff1cf', 0.5);
    M(new THREE.BoxGeometry(AX1 - AX0, 0.03, 0.03), cream, (AX0 + AX1) / 2, AY0, -0.12);
    for (let n = 1; n * HALF_LIFE < MAX_AGE; n++) M(new THREE.BoxGeometry(0.025, 0.16, 0.03), cream, px(n * HALF_LIFE), AY0 - 0.08, -0.12);      // one tick per half-life
    const pts = []; for (let i = 0; i <= 80; i++) { const y = MAX_AGE * i / 80; pts.push(new THREE.Vector3(px(y), py(model.fraction(y)), -0.1)); }
    const curve = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fe3d0 })); group.add(curve);
    const bar = M(unit, gold, AX0, AY0, -0.07); bar.scale.set(0.09, 1, 0.05);
    const dot = M(new THREE.SphereGeometry(0.09, 14, 10), gold, AX0, AY1, -0.05); dot.add(ctx.glow('#ffd76a', 0.7, 0.8));
    const dial = M(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32), ctx.mat('#8a6a3c', { metalness: 0.5, roughness: 0.4 }), 1.87, 4.36, -0.12); dial.rotation.x = Math.PI / 2;
    const handGeo = new THREE.BoxGeometry(0.05, 0.42, 0.04); handGeo.translate(0, 0.21, 0);
    const hand = M(handGeo, cream, 1.87, 4.36, -0.05);

    let sel = 0, age = 0, shown = 0, misses = 0, done = false, auto = false, warned = false;
    const pct = (f) => (f * 100).toFixed(2);
    const pick = count > 1 ? ui.choice(finds.map((f, i) => [i, f.label]), 0, (v) => select(+v, true)) : null;
    const ageS = ui.slider({ label: 'Age dial', min: 0, max: MAX_AGE, step: STEP, value: 0, unit: 'years', onInput: (v) => setAge(v, false) });
    ui.button('◀ 50 years younger', () => setAge(age - STEP, true));
    ui.button('50 years older ▶', () => setAge(age + STEP, true));
    ui.button('📌 Record this date', () => record(), 'btn');
    const rM = ui.readout('Meter: carbon-14 left in the find, %'), rA = ui.readout('Carbon-14 left at the dial age, %'), rH = ui.readout('Half-lives at the dial age'), rD = ui.readout('Finds dated');
    ui.note('Plants and animals take in carbon-14 while they live. After they die it slowly turns into nitrogen: half of it is gone every 5,730 years. That time is called the half-life.');

    const refresh = () => {
      const f = model.fraction(age), x = px(age);
      bar.position.x = x; bar.scale.y = Math.max(0.01, (AY1 - AY0) * f); dot.position.set(x, py(f), -0.05); hand.rotation.z = -age / MAX_AGE * Math.PI * 2;
      bar.material = L <= 2 && !finds[sel].date && Math.abs(age - finds[sel].target) <= tol ? green : gold;
      rA.set(pct(f)); rH.set(model.halfLives(age).toFixed(2)); rD.set(`${finds.filter((q) => q.date != null).length} / ${count}`);
    };
    function setAge(v, moveSlider) {
      age = Math.max(0, Math.min(MAX_AGE, Math.round(v / STEP) * STEP)); if (moveSlider) ageS.set(age);
      if (age > 45000 && !warned) { warned = true; ctx.say('This far back less than half of one percent is left. After about 50,000 years the meter cannot tell so little carbon-14 from none at all, so the method stops working.'); }
      refresh();
    }
    function select(i, speak) {
      sel = i; const f = finds[i];
      finds.forEach((q, j) => { q.ring.visible = j === i || q.date != null; });
      rM.set(pct(f.measured)); line.position.y = py(f.measured); refresh();
      if (speak) ctx.say(f.date != null ? `You dated the ${f.name} at about ${fmt(f.date)} years. Choose a find that has no date yet.` : `The ${f.name} lay in the ${LAYER_NAMES[f.layer]}. The meter finds ${pct(f.measured)} % of its carbon-14 still there. Turn the age dial until the gold bar reaches the orange line.`);
    }
    function record() {
      const f = finds[sel];
      if (f.date != null) { ctx.say(`The ${f.name} already has its date. Choose a find that has no date yet.`); return; }
      const clash = finds.find((q) => q.date != null && (q.layer < f.layer ? age <= q.date : age >= q.date));
      if (clash) { misses++; ctx.say(`That cannot be right. The ${f.name} lay ${clash.layer < f.layer ? 'below' : 'above'} the ${clash.name}, which is about ${fmt(clash.date)} years old. Deeper layers were laid down first, so deeper finds must be older.`); return; }
      if (Math.abs(age - f.target) > tol) {
        misses++;
        ctx.say(`After ${fmt(age)} years, ${pct(model.fraction(age))} % would be left, but the meter reads ${pct(f.measured)} %. ${age > f.target ? 'More is left than that, so the find is younger: turn the dial down.' : 'Less is left than that, so the find is older: turn the dial up.'}`);
        return;
      }
      f.date = age; f.ring.material = green; f.ring.visible = true; refresh();
      const left = finds.filter((q) => q.date == null).length, why = `${pct(f.measured)} % left means ${model.halfLives(f.target).toFixed(1)} half-lives have passed, so the ${f.name} is about ${fmt(Math.round(f.target / 10) * 10)} years old.`;
      if (left) { ctx.say(`${why} ${left === 1 ? 'One more find to date.' : `${left} more finds to date.`}`); return; }
      done = true;
      ctx.say(`${why} ${count > 1 ? 'Every date fits the layers: the deeper the find, the older it is. ' : ''}Carbon dating only works for things that were once alive, like wood, seeds, bone and charcoal, because only living things take in carbon-14. And it only reaches back about 50,000 years: after that too little is left to measure.`);
      ctx.complete(misses === 0 ? 1 : Math.max(0.6, 1 - 0.08 * misses), `finds=${count}, misses=${misses}, tolerance=${tol} y`);
    }
    select(0, false);
    ctx.say(count > 1 ? 'Choose a find and read its carbon-14 on the meter. Then turn the age dial until the gold bar on the curve reaches the orange line, and record the date.' : 'The meter shows how much carbon-14 is left in this find. Turn the age dial until the gold bar on the curve reaches the orange line, then record the date.');
    return {
      step(dt) {
        if (!auto || done) return;
        const i = finds.findIndex((q) => q.date == null); if (i < 0) return;
        if (sel !== i) select(i, true);
        const goal = Math.round(finds[i].target / STEP) * STEP, d = goal - age, move = 12000 * dt;        // the dial glides to the answer
        if (Math.abs(d) <= move) { setAge(goal, true); record(); } else setAge(age + Math.sign(d) * Math.max(STEP, move), true);
      },
      frame(dt, time) {
        shown += (finds[sel].measured - shown) * Math.min(1, dt * 4); fill.scale.y = Math.max(0.01, (AY1 - AY0) * shown);
        const r = finds[sel].ring; r.scale.setScalar(ctx.calm || finds[sel].date != null ? 1 : 1 + Math.sin(time * 4) * 0.08);
      },
      // Shows a successful run without the player (used by tests): each find in turn, from the top layer down.
      autoplay() { auto = true; },
      get state() { return done ? 'done' : auto ? 'auto' : 'ready'; },
      get choice() { return pick ? sel : 0; },
    };
  },
};

export default {
  id: 8,
  theme: {
    sky: ['#6f8fc4', '#f2b56b', '#ffe3a8'], fog: '#ecb876', fogNear: 40, fogFar: 190,
    ground: '#d9a35a', ground2: '#e8bd77', side: '#a8641c', stone: '#e3c898', accent: '#1c8f8a', glow: '#ffd27a', metal: '#8a6a3c', wood: '#8a5a2e', leaf: '#7f9a45', water: '#2fa6b5', crate: '#c98d4a',
    sun: '#ffd2a0', sunPower: 2.4, ambient: 1.2, skyLight: '#ffe6c2', groundLight: '#a8641c', sunDir: [0.6, 0.5, -0.6], particles: 'dust',
  },
  layout: { mirror: -1, stones: 5, rise: 0.4, towerH: 6 },
  story: {
    title: 'The Archive in the Dunes',
    crystal: 'hour stones', crystalEm: '⏳',
    intro: ['Welcome to the Archive in the Dunes! Every people who ever lived left a story here: on clay, on bark, on paper and in song.', 'Last night a great wind mixed up our shelves and carried off the five hour stones. Without them the Archive cannot tell which story came first.'],
    remind: 'The hour stones glow like gold. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five hour stones! Now ride the lift from the tower to the dating lab and find out how old our finds really are.',
    afterSim: 'The finds are back in the right order. Only the Keeper of Dates stands between you and the portal — the arena is up the steps.',
    notReady: 'The arena is for those who have done the work. Bring all five hour stones and date the finds first.',
    rival: ['So you can read a meter. A date is only the first line of a story.', 'We each build a bridge of light, one piece for every right answer. Let us see whose history holds together.'],
    win: ['Your bridge reached the far side before mine. You asked good questions of the past — the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and try me.'],
    outro: 'The shelves are in order, the hour stones are home, and the Keeper of Dates has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only: places people built in many parts of the world, gathered around the archive.
  decorate(k, S) {
    const { THREE } = k, m = S.sim[0] < 0 ? -1 : 1, D = new THREE.Object3D();
    const stone = k.mat('#e3c898'), clay = k.mat('#b8562f', { roughness: 0.9, side: THREE.DoubleSide }), dark = k.mat('#5a3a22'), thatch = k.mat('#c9a24b', { roughness: 1, flatShading: true }), tile = k.mat('#1c8f8a', { roughness: 0.5, flatShading: true }), red = k.mat('#a83a2a');
    const group = (x, y, z, yaw = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; return k.add(g); };
    const hard = (x, y, z, r, h) => { const s = { type: 'cyl', x, z, r, y0: y, y1: y + h }; k.level.solids.push(s); k.physics.addSolid(s); };
    // Many copies of one small shape as a single mesh: list of [x, y, z, rotX, rotY].
    const many = (geo, material, list, parent) => { const im = new THREE.InstancedMesh(geo, material, list.length); list.forEach(([x, y, z, rx = 0, ry = 0], i) => { D.position.set(x, y, z); D.rotation.set(rx, ry, 0); D.updateMatrix(); im.setMatrixAt(i, D.matrix); }); im.castShadow = im.receiveShadow = true; parent.add(im); return im; };
    const jarGeo = new THREE.LatheGeometry([[0.02, 0], [0.17, 0], [0.3, 0.25], [0.33, 0.5], [0.24, 0.78], [0.15, 0.9], [0.2, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const jar = (x, y, z, s) => { k.mesh(jarGeo, clay, x, y, z).scale.setScalar(s); };

    // home island: the archive gate, the scroll shelves, a sundial and storage jars
    k.prop('column', 4.6, 0, 7, { solid: true }); k.prop('column', -4.6, 0, 7, { s: 0.7, solid: true });
    const sx = -6.4 * m, shelf = group(sx, 0, -6, Math.atan2(-sx, 6));
    k.mesh(new THREE.BoxGeometry(2.7, 2.3, 0.12), dark, 0, 1.15, -0.26, shelf);
    many(new THREE.BoxGeometry(2.7, 0.08, 0.62), dark, [0.04, 0.76, 1.48, 2.26].map((y) => [0, y, 0]), shelf);
    const scrolls = []; for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) { scrolls.push([-1.12 + i * 0.28, 0.18 + row * 0.72, 0.02, Math.PI / 2]); if ((i + row) % 3 === 0) scrolls.push([-0.98 + i * 0.28, 0.35 + row * 0.72, 0, Math.PI / 2]); }
    many(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), k.mat('#f3e4bd', { roughness: 0.9 }), scrolls, shelf);
    hard(sx, 0, -6, 1.3, 2.3);
    const dx = 6.3 * m, dz = -5.4;
    k.mesh(new THREE.CylinderGeometry(1, 1.1, 0.34, 24), stone, dx, 0.17, dz); hard(dx, 0, dz, 1.1, 0.34);
    k.mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.95, 8), k.mat('#8a6a3c', { metalness: 0.5, roughness: 0.4 }), dx, 0.74, dz - 0.18).rotation.x = 0.45;
    many(new THREE.BoxGeometry(0.06, 0.03, 0.2), dark, Array.from({ length: 9 }, (_, i) => { const a = -1.4 + i * 0.35; return [Math.sin(a) * 0.82, 0.35, Math.cos(a) * 0.82, 0, a]; }), group(dx, 0, dz));
    const shadeGeo = new THREE.BoxGeometry(0.09, 0.012, 0.8); shadeGeo.translate(0, 0, 0.4);
    const shade = k.mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: 0x4a2f1a, transparent: true, opacity: 0.55 }), dx, 0.35, dz); shade.castShadow = false;
    k.animate((dt, t) => { const a = Math.sin(t * 0.15) * 1.3; shade.rotation.y = a; shade.scale.z = 0.62 + 0.38 * Math.abs(Math.sin(a)); });      // the day passes: the shadow swings and grows
    jar(-7.6 * m, 0, 0.9, 1.1); jar(-7 * m, 0, 1.8, 0.8); jar(-7.9 * m, 0, 2, 0.6);

    // middle island: a round house with a thatched roof, and more jars
    const mid = S.mid, hx = 3.6 * m, hz = mid[2] - 3.3, house = group(hx, mid[1], hz, Math.atan2(-hx, 3.3));
    k.mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.2, 18), k.mat('#d9b88a', { roughness: 1 }), 0, 0.6, 0, house);
    k.mesh(new THREE.ConeGeometry(1.65, 1.35, 18), thatch, 0, 1.82, 0, house);
    k.mesh(new THREE.BoxGeometry(0.5, 0.85, 0.08), dark, 0, 0.43, 1.13, house);
    hard(hx, mid[1], hz, 1.2, 1.2);
    jar(-5.2 * m, mid[1], mid[2] + 0.4, 0.9); jar(-4.7 * m, mid[1], mid[2] + 1.3, 0.65);

    // the lagoon: a small sailing boat rides the water
    const wy = mid[1] - 0.45, bx = -5 * m, bz = mid[2] + 14, boat = group(bx, wy, bz, 0.5);
    k.mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), k.mat('#8a5a2e', { side: THREE.DoubleSide }), 0, 0.28, 0, boat).scale.set(1.9, 0.7, 0.75);
    k.mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 6), dark, 0, 0.95, 0, boat);
    k.mesh(new THREE.BoxGeometry(1.05, 1.0, 0.03), k.mat('#f6ecd2', { roughness: 1 }), 0, 1.2, 0.05, boat);
    k.animate((dt, t) => { boat.position.set(bx + Math.sin(t * 0.25) * 0.5, wy + Math.sin(t * 1.3) * 0.03, bz + Math.cos(t * 0.2) * 0.6); boat.rotation.z = Math.sin(t * 0.9) * 0.06; });

    // far island: a tiered tower, each roof a little smaller than the one below
    const tx = -4.3 * m, tz = S.far[2] - 2.6; let ty = S.far[1];
    for (let i = 0; i < 3; i++) {
      const w = 1.7 - i * 0.42, h = 1 - i * 0.15;
      if (i === 0) k.block(tx, ty + h, tz, w, h, w, { color: '#a83a2a' }); else k.mesh(new THREE.BoxGeometry(w, h, w), red, tx, ty + h / 2, tz);
      k.mesh(new THREE.ConeGeometry(w * 0.98, 0.5, 4), tile, tx, ty + h + 0.25, tz).rotation.y = Math.PI / 4;
      ty += h + 0.26;
    }
    k.mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.7, 6), k.lit('#ffd27a', 0.8), tx, ty + 0.4, tz);

    // simulation island: a stepped dig that shows its layers, and an arch on the way to the steps
    const px = S.sim[0] + 5.9 * m, pz = S.sim[2] - 1.8;
    ['#5a3e2e', '#8f5a34', '#b5763c', '#d9b46a'].forEach((c, i) => { const len = 3 - i * 0.7; k.block(px, S.sim[1] + 0.33 * (i + 1), pz + len / 2, 1.1, 0.33, len, { color: c }); });
    k.prop('arch', S.sim[0], S.sim[1], S.sim[2] + 6.9, { s: 1.4 });
    // arena and portal
    for (const s of [-1, 1]) { k.prop('banner', S.arena[0] + s * 3.4, S.arena[1], S.arena[2] - 5.6, { color: s < 0 ? '#e0a43a' : '#a8641c' }); k.prop('pillar', S.end[0] + s * 3.4, S.end[1], S.end[2] - 1.6, { s: 0.8, solid: true }); }

    // across the gap: a stepped pyramid on its own rock
    const pyr = group(-19 * m, -0.5, 31, 0.5);
    k.mesh(new THREE.CylinderGeometry(6.2, 2.2, 4.5, 9), k.mat('#a8641c', { flatShading: true }), 0, -2.25, 0, pyr);
    for (let i = 0; i < 4; i++) { const w = 7.4 - i * 1.8; k.mesh(new THREE.BoxGeometry(w, 1, w), stone, 0, 0.5 + i, 0, pyr); }
    // the low sun and the dunes far below
    const sun = k.mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }), 41 - 8 * m, 45, 1); sun.castShadow = sun.receiveShadow = false; sun.add(k.glow('#ffd27a', 44, 0.6));
    const dune = new THREE.SphereGeometry(30, 24, 12), sandFar = k.mat('#d99a52', { roughness: 1, fog: false });
    for (const [x, y, z, w] of [[-46 * m, -22, 28, 1.5], [62 * m, -24, 66, 1.7], [-34 * m, -27, 104, 1.3]]) { const d = k.mesh(dune, sandFar, x, y, z); d.scale.set(w, 0.25, 1); d.castShadow = false; }
  },
  sim,
};
