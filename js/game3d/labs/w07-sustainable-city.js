// World 7 lab — Sustainable City Planner, as a model city on a tilted table: 8 × 8 tiles that grow into buildings.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

// land-use types; each cell = 10 ha (0.1 km2)
const T = {
  home:  { n: 'Homes',    people: 500, co2: 0,     pad: '#d8c7a6' },
  work:  { n: 'Industry', people: 0,   co2: 3000,  pad: '#9aa0a8' },
  park:  { n: 'Park',     people: 0,   co2: -80,   pad: '#7cc93d' },
  solar: { n: 'Solar',    people: 0,   co2: -1500, pad: '#c9d6e8' },
  bus:   { n: 'Transit',  people: 0,   co2: 100,   pad: '#e6d38a' },
};
const KEYS = Object.keys(T), N = 8;

export const model = {
  // The toy budget of the 2D lab, unchanged: people, tonnes of CO₂ per person per year, green share and heat island.
  metrics(grid) {
    const c = (k) => grid.filter((g) => g === k).length;
    const pop = c('home') * T.home.people;
    const share = c('bus') / (N * N);
    const transport = pop * 1.2 * Math.max(0.3, 1 - share * 8);   // t CO2/yr from travel
    const heating = pop * 0.8;
    const net = c('work') * T.work.co2 + c('solar') * T.solar.co2 + c('park') * T.park.co2 + c('bus') * T.bus.co2 + transport + heating;
    const per = pop ? net / pop : Infinity;
    const green = c('park') / (N * N);
    const built = (c('home') + c('work') + c('bus')) / (N * N);
    const dT = 4 * built - 3 * green;
    return { pop, net, per, green, dT, work: c('work') };
  },
  check(grid, goal) {
    const m = this.metrics(grid);
    const r = { m, pop: m.pop >= goal.needPop, co: m.per <= goal.maxPer, green: m.green >= goal.minGreen, heat: goal.maxHeat == null || m.dT <= goal.maxHeat, jobs: m.work >= (goal.minWork || 0) };
    r.ok = r.pop && r.co && r.green && r.heat && r.jobs; return r;
  },
  score: (per, maxPer) => Math.min(1, 0.7 + (maxPer - per) / maxPer * 0.5),
  // A plan that meets the goal with the fewest solar farms: used to show that every goal can be reached.
  plan(goal) {
    for (let solar = 0; solar <= 30; solar++) {
      const g = []; const put = (k, n) => { for (let i = 0; i < n; i++) g.push(k); };
      put('work', goal.minWork || 0); put('home', Math.ceil(goal.needPop / 500)); put('bus', 6); put('solar', solar); while (g.length < N * N) g.push('park');
      if (g.length === N * N && this.check(g, goal).ok) return g;
    }
    return null;
  },
};

const fill = (counts) => { const g = []; for (const k in counts) for (let i = 0; i < counts[k]; i++) g.push(k); return g; };
export function selfTest() {
  const a = model.metrics(fill({ home: 10, bus: 8, work: 2, solar: 4, park: 40 }));   // 6000 − 6000 − 3200 + 800 + 1800 + 4000 = 3400 t
  const b = model.metrics(fill({ home: 20, park: 44 }));                                // 12000 + 8000 − 3520 = 16480 t for 10,000 people
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  let plans = true;
  for (const needPop of [3000, 4000, 5000, 6000, 7000]) for (const maxPer of [2.5, 2.0, 1.5]) for (const hard of [false, true]) if (!model.plan({ needPop, maxPer, minGreen: 0.2, maxHeat: hard ? 1 : null, minWork: hard ? 4 : 0 })) plans = false;
  const ok = a.pop === 5000 && near(a.net, 3400) && near(a.per, 0.68) && near(a.green, 0.625) && near(a.dT, -0.625)
    && b.pop === 10000 && near(b.per, 1.648) && near(b.dT, -0.8125) && near(model.score(0.68, 2), 1) && near(model.score(1.5, 2), 0.825) && plans;
  return { ok, detail: `mixed plan ${a.pop} people, ${a.per.toFixed(2)} t each, ΔT ${a.dT.toFixed(3)} °C; 20 homes tiles ${b.pop} people, ${b.per.toFixed(3)} t each; every goal has a plan: ${plans}` };
}

export default {
  id: 'w07-sustainable-city',
  world: 7,
  levels: [5, 6],
  title: 'Sustainable City Planner',
  goal: 'Build an 8×8 model city that houses enough people with low CO₂ per person and enough green space.',
  kind: 'validated',
  model: 'A toy budget: each tile is 10 ha with fixed average values (500 people per homes tile, +3,000 t CO₂ a year per industry tile, −1,500 t per solar farm, −80 t per park, 2 t per person for travel and heating). Per-person transport emissions fall with transit share, green tiles cool the city, and travel distances, energy mixes, costs and where things stand next to each other are not modelled. The sums are checked against hand-worked plans.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x), s = 0.5, hard = ctx.level >= 6;
    const goal = {
      needPop: hard ? 5000 + Math.floor(ctx.rng() * 3) % 3 * 1000 : 3000 + Math.floor(ctx.rng() * 5) % 5 * 1000,      // people
      maxPer: hard ? [2.0, 1.5][Math.floor(ctx.rng() * 2) % 2] : [2.5, 2.0, 1.5][Math.floor(ctx.rng() * 3) % 3],      // t CO2/person/yr
      minGreen: 0.2, maxHeat: hard ? 1 : null, minWork: hard ? 4 : 0,
    };
    // level 6 starts from a smoky old town that has to be changed; below that the land starts as parks, as in the 2D lab
    const first = () => Array.from({ length: N * N }, (_, i) => { if (!hard) return 'park'; const r = Math.floor(i / N), c = i % N; return r === 2 && c >= 1 && c <= 6 ? 'work' : r === 4 ? 'home' : 'park'; });
    const grid = first(), grow = grid.map(() => 1);
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

    // ----- the table -----
    const wood = ctx.mat('#9a6a3c'), dark = ctx.mat('#5b6470', { metalness: 0.4, roughness: 0.45 });
    add(new THREE.CylinderGeometry(1.1, 1.4, 0.75, 20), wood, 0, 0.375, 0);
    const table = new THREE.Group(); table.position.set(0, 0.95, 0); table.rotation.x = 0.28; group.add(table);
    const board = add(new THREE.BoxGeometry(N * s + 0.2, 0.2, N * s + 0.2), ctx.mat('#cdc6b0'), 0, 0, 0, table);
    const TOP = 0.14, cellX = (i) => (i % N - 3.5) * s, cellZ = (i) => (Math.floor(i / N) - 3.5) * s;
    const dummy = new THREE.Object3D(), tint = new THREE.Color();
    const pads = new THREE.InstancedMesh(new THREE.BoxGeometry(s * 0.94, 0.04, s * 0.94), ctx.mat('#ffffff', { roughness: 0.95 }), N * N); pads.receiveShadow = true; table.add(pads);
    for (let i = 0; i < N * N; i++) { dummy.position.set(cellX(i), 0.12, cellZ(i)); dummy.updateMatrix(); pads.setMatrixAt(i, dummy.matrix); pads.setColorAt(i, tint.set(T[grid[i]].pad)); }
    const flat = (c) => ctx.mat(c, { flatShading: true });
    const parts = [
      ['home', new THREE.BoxGeometry(0.32, 0.3, 0.32), ctx.mat('#f4d9a8'), 0, 0.15],
      ['home', new THREE.ConeGeometry(0.27, 0.2, 4).rotateY(Math.PI / 4), flat('#d9654a'), 0, 0.4],
      ['work', new THREE.BoxGeometry(0.4, 0.22, 0.3), ctx.mat('#8a93a3'), 0, 0.11],
      ['work', new THREE.CylinderGeometry(0.05, 0.065, 0.42, 8), ctx.mat('#b5563d'), 0.1, 0.33],
      ['park', new THREE.CylinderGeometry(0.03, 0.045, 0.14, 6), wood, 0, 0.07],
      ['park', new THREE.ConeGeometry(0.17, 0.34, 6), flat('#2f9e55'), 0, 0.3],
      ['solar', new THREE.CylinderGeometry(0.025, 0.03, 0.16, 6), dark, 0, 0.08],
      ['solar', new THREE.BoxGeometry(0.4, 0.03, 0.3), ctx.mat('#1f4fa8', { metalness: 0.5, roughness: 0.3 }), 0, 0.18],
      ['bus', new THREE.BoxGeometry(0.42, 0.14, 0.2), ctx.mat('#e0a83c'), 0, 0.07],
      ['bus', new THREE.BoxGeometry(0.48, 0.04, 0.28), ctx.mat('#35b6e8'), 0, 0.17],
    ].map(([type, geo, material, dx, dy]) => { const mesh = new THREE.InstancedMesh(geo, material, N * N); mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0; table.add(mesh); return { type, mesh, dx, dy, tilt: type === 'solar' && dy > 0.1 }; });
    const smoke = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), ctx.mat('#6f7480', { roughness: 1 }), N * N * 2); smoke.frustumCulled = false; smoke.count = 0; table.add(smoke);
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0x77736a, transparent: true, opacity: 0, depthWrite: false });
    const haze = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), hazeMat); haze.scale.set(2.3, 0.8, 2.3); haze.position.y = 0.9; table.add(haze);
    const cursor = add(new THREE.TorusGeometry(s / Math.SQRT2, 0.03, 4, 4), ctx.lit('#ffffff', 1), 0, TOP + 0.03, 0, table); cursor.rotation.set(Math.PI / 2, 0, Math.PI / 4); cursor.castShadow = false;
    const sun = add(new THREE.SphereGeometry(0.3, 16, 12), ctx.lit('#ffe07a', 1.8), 0, 4.4, -1.2); sun.castShadow = false; sun.add(ctx.glow('#ffe07a', 1.6, 0.7));

    // ----- four standing gauges: the bar grows, the white plate is the target -----
    const barGeo = new THREE.BoxGeometry(0.34, 1, 0.34).translate(0, 0.5, 0), plateGeo = new THREE.BoxGeometry(0.48, 0.04, 0.48), good = ctx.lit('#3fbf6a', 0.5), bad = ctx.lit('#f08a3c', 0.5), plate = ctx.lit('#ffffff', 0.9), H = 3;
    const gauge = (label, x, labelY, target) => {
      add(new THREE.CylinderGeometry(0.26, 0.3, 0.1, 12), dark, x, 0.05, 1);
      const bar = add(barGeo, bad, x, 0.1, 1); bar.scale.y = 0.02;
      if (target != null) add(plateGeo, plate, x, 0.1 + H * target, 1).castShadow = false;
      const tag = ctx.sprite(t(label), { size: 0.24, bg: 'rgba(14,18,48,.72)' }); tag.position.set(x, labelY, 1); group.add(tag);
      return { bar, to: 0.02 };
    };
    const POP = 12000, PER = 5, heatAt = (d) => Math.max(0, Math.min(1, (d + 3) / 7));
    const gPop = gauge('People', -3.12, 3.75, goal.needPop / POP), gGreen = gauge('Green', -2.62, 3.4, goal.minGreen);
    const gCo = gauge('CO₂', 2.62, 3.4, goal.maxPer / PER), gHeat = gauge('Heat', 3.12, 3.75, hard ? heatAt(goal.maxHeat) : null);

    // ----- the plan -----
    let brush = 'home', col = 0, row = 0, done = false, queue = null, qT = 0;
    const targetText = `≥ ${goal.needPop.toLocaleString('en')} ${t('residents')}, ≤ ${goal.maxPer} t CO₂/${t('person')}/yr, ≥ 20% ${t('green')}` + (hard ? `, ≥ ${goal.minWork} ${t('industry tiles')}, ${t('heat')} ≤ ${goal.maxHeat} °C` : '');
    ui.readout('Targets').set(targetText);
    const rPop = ui.readout('Residents'), rCo = ui.readout('CO₂ per person (t/yr)'), rG = ui.readout('Green share (%)'), rH = ui.readout('Heat island ΔT (°C)'), rTodo = ui.readout('Still to do');
    const brushC = ui.choice(KEYS.map((k) => [k, T[k].n]), brush, (v) => { brush = v; });
    const place = () => { cursor.position.set((col - 3.5) * s, TOP + 0.03, (row - 3.5) * s); };
    const colS = ui.slider({ label: 'Column (left to right)', min: 1, max: N, step: 1, value: 1, unit: '', onInput: (v) => { col = Math.round(v) - 1; place(); } });
    const rowS = ui.slider({ label: 'Row (back to front)', min: 1, max: N, step: 1, value: 1, unit: '', onInput: (v) => { row = Math.round(v) - 1; place(); } });
    const WHY = {
      home: 'Each homes tile houses 500 people. Every person adds about 2 tonnes of CO₂ a year from travel and heating, until transit brings the travel part down.',
      work: 'An industry tile gives people jobs, but it adds 3,000 tonnes of CO₂ a year: as much as two solar farms save.',
      park: 'A park soaks up a little CO₂ (80 tonnes a year), and its trees shade and cool the streets around it.',
      solar: 'A solar farm makes clean electricity from sunlight and saves 1,500 tonnes of CO₂ a year.',
      bus: 'Transit lets people leave the car at home. Each transit tile cuts travel CO₂ by one eighth, down to less than a third with six tiles.',
    };
    function update(quiet) {
      const r = model.check(grid, goal), m = r.m;
      rPop.set(m.pop.toLocaleString('en')); rCo.set(m.pop ? m.per.toFixed(2) : '–'); rG.set((m.green * 100).toFixed(0)); rH.set(m.dT.toFixed(2));
      gPop.to = Math.min(1.15, m.pop / POP); gPop.bar.material = r.pop ? good : bad;
      gCo.to = m.pop ? Math.max(0, Math.min(1.15, m.per / PER)) : 0; gCo.bar.material = r.co ? good : bad;
      gGreen.to = m.green; gGreen.bar.material = r.green ? good : bad;
      gHeat.to = heatAt(m.dT); gHeat.bar.material = r.heat ? good : bad;
      hazeMat.opacity = m.pop ? Math.max(0, Math.min(0.42, (m.per - 1) * 0.12)) : Math.min(0.42, m.work * 0.05);
      const todo = [r.pop ? '' : t('more homes'), r.co ? '' : t('cut CO₂ (solar, transit, fewer factories)'), r.green ? '' : t('more green'), r.heat ? '' : t('cool the city (more parks, fewer buildings)'), r.jobs ? '' : t('keep industry tiles for jobs')].filter(Boolean);
      rTodo.set(r.ok ? t('Your city meets every target.') : todo.join(' · '));
      if (quiet) return;
      if (r.ok && !done) {
        done = true;
        ctx.say('Your city meets every target. Compact homes with transit, clean power and green space can house people with less carbon, and trees help cool the streets.');
        ctx.complete(model.score(m.per, goal.maxPer), `Balanced housing, emissions and green space in a city plan: ${m.pop} people, ${m.per.toFixed(2)} t CO₂ each.`);
      }
    }
    function paint(i, k) {
      if (i < 0 || i >= N * N) return;
      col = i % N; row = Math.floor(i / N); place();
      if (grid[i] !== k) { grid[i] = k; grow[i] = 0; pads.setColorAt(i, tint.set(T[k].pad)); if (pads.instanceColor) pads.instanceColor.needsUpdate = true; }
      if (!done) ctx.say(WHY[k]);
      update();
    }
    ui.button('Build here', () => paint(row * N + col, brush), 'btn');
    ui.button('Build along the whole row', () => { const r0 = row, c0 = col; for (let c = 0; c < N; c++) paint(r0 * N + c, brush); col = c0; place(); }, 'btn');
    ui.button(hard ? 'Back to the old town' : 'Clear to parks', () => { const g = first(); for (let i = 0; i < N * N; i++) if (grid[i] !== g[i]) { grid[i] = g[i]; grow[i] = 0; pads.setColorAt(i, tint.set(T[g[i]].pad)); } if (pads.instanceColor) pads.instanceColor.needsUpdate = true; update(); }, 'btn ghost');
    ui.note('Choose a land use, then tap a tile on the table (or pick a column and row and press Build here). Each tile is 10 hectares. The bars turn green when a target is met; the white plates mark the targets.');
    // a tap anywhere on the table paints the tile under it
    const inv = new THREE.Matrix4(), hit = new THREE.Vector3();
    const tap = (o, p) => {
      if (!p) return;
      table.updateMatrix(); hit.copy(p).applyMatrix4(inv.copy(table.matrix).invert());
      const c = Math.floor(hit.x / s + N / 2), r = Math.floor(hit.z / s + N / 2);
      if (c >= 0 && c < N && r >= 0 && r < N) paint(r * N + c, brush);
    };
    for (const o of [board, pads, ...parts.map((p) => p.mesh)]) ctx.onTap(o, tap);

    // every building is one instance; this places them all (growing ones are scaled up from the ground)
    function layout(time) {
      const sunX = ctx.calm ? 0 : Math.sin(time * 0.3); sun.position.x = sunX * 2.6; sun.position.y = 4.5 - 0.5 * sunX * sunX;
      for (const p of parts) {
        let n = 0;
        for (let i = 0; i < N * N; i++) {
          if (grid[i] !== p.type) continue;
          const k = grow[i], g = k * (1.7 - 0.7 * k);
          dummy.position.set(cellX(i) + p.dx * g, TOP + p.dy * g, cellZ(i)); dummy.rotation.set(p.tilt ? 0.25 : 0, 0, p.tilt ? -0.5 * sunX : 0); dummy.scale.setScalar(Math.max(0.001, g)); dummy.updateMatrix(); p.mesh.setMatrixAt(n++, dummy.matrix);
        }
        p.mesh.count = n; p.mesh.instanceMatrix.needsUpdate = true; p.mesh.boundingSphere = null; p.mesh.boundingBox = null;
      }
      let n = 0; dummy.rotation.set(0, 0, 0);
      for (let i = 0; i < N * N; i++) {
        if (grid[i] !== 'work' || grow[i] < 1) continue;
        for (let j = 0; j < 2; j++) { const f = ctx.calm ? 0.3 + j * 0.4 : (time * 0.45 + i * 0.37 + j * 0.5) % 1; dummy.position.set(cellX(i) + 0.1 + f * 0.12, TOP + 0.58 + f * 0.6, cellZ(i)); dummy.scale.setScalar((0.5 + f) * (1 - f * f) + 0.001); dummy.updateMatrix(); smoke.setMatrixAt(n++, dummy.matrix); }
      }
      smoke.count = n; smoke.instanceMatrix.needsUpdate = true;
    }
    place(); update(true); layout(0);
    for (const g of [gPop, gCo, gGreen, gHeat]) g.bar.scale.y = Math.max(0.02, g.to * H);
    ctx.say(hard ? 'This old town is smoky and short of homes. Change its tiles until every bar is green, but keep at least 4 industry tiles so people have jobs.' : 'The land is all parks. Choose a land use and tap tiles to build a city that reaches all three targets.');

    return {
      step(dt) {
        if (!queue) return;
        qT += dt;
        while (qT > 0.04 && queue.length && !done) {
          qT -= 0.04; const [i, k] = queue.shift();
          colS.set?.(i % N + 1); rowS.set?.(Math.floor(i / N) + 1); col = i % N; row = Math.floor(i / N);
          brushC.set?.(k); brush = k; paint(row * N + col, brush);
        }
      },
      frame(dt, time) {
        for (let i = 0; i < N * N; i++) if (grow[i] < 1) grow[i] = ctx.calm ? 1 : Math.min(1, grow[i] + dt * 2.5);
        layout(time);
        const k = ctx.calm ? 1 : Math.min(1, dt * 5);
        for (const g of [gPop, gCo, gGreen, gHeat]) g.bar.scale.y += (Math.max(0.02, g.to * H) - g.bar.scale.y) * k;
        cursor.scale.setScalar(1 + (ctx.calm ? 0 : 0.06 * Math.sin(time * 4)));
      },
      // Paints a plan that meets the goal, tile by tile, with the same brush and Build action the player uses.
      autoplay() { const plan = model.plan(goal); queue = []; qT = 0; for (let i = 0; i < N * N; i++) if (grid[i] !== plan[i]) queue.push([i, plan[i]]); },
      dispose() { group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); else if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); hazeMat.dispose(); },
    };
  },
};
