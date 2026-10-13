// 3D lab — Solid, Liquid or Gas? Things are dropped into three glass bins whose particles show how each state moves.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

// model name, shown name, state, why
const ITEMS = [
  ['ice', 'ice', 's', 'Ice keeps its shape, so it is a solid.'],
  ['rock', 'rock', 's', 'A rock keeps its shape, so it is a solid.'],
  ['brick', 'brick', 's', 'A brick keeps its shape, so it is a solid.'],
  ['ball', 'ball', 's', 'A ball keeps its shape, so it is a solid.'],
  ['water', 'water', 'l', 'Water flows and takes the shape of its cup: a liquid.'],
  ['milk', 'milk', 'l', 'Milk pours and flows: a liquid.'],
  ['honey', 'honey', 'l', 'Honey flows slowly, but it still flows: a liquid.'],
  ['juice', 'juice', 'l', 'Juice pours and flows: a liquid.'],
  ['wind', 'wind', 'g', 'Air spreads out everywhere: a gas.'],
  ['balloon', 'air in a balloon', 'g', 'The air fills the whole balloon: a gas.'],
  ['steam', 'steam', 'g', 'Steam is water as a gas. It spreads out to fill the room.'],
  ['bubble', 'bubble air', 'g', 'The air inside a bubble is a gas.'],
];
const BINS = [['s', 'Solid', 'keeps its shape', '#f2a65a'], ['l', 'Liquid', 'flows', '#4aa8ff'], ['g', 'Gas', 'spreads out', '#f3f0a0']];
const MOVES = {
  s: 'In a solid the particles are packed in neat rows. They only wobble on the spot, so the shape stays.',
  l: 'In a liquid the particles touch but slide past each other, so it flows and lies flat in the bin.',
  g: 'In a gas the particles are far apart and zoom about, so it spreads out to fill the whole bin.',
};

export default {
  id: 'w02-sort-states',
  world: 2,
  levels: [1, 2],
  title: 'Solid, Liquid or Gas?',
  goal: 'Sort every thing into solid, liquid or gas.',
  kind: 'simplified',
  model: 'Everyday things are sorted by how they behave at room temperature (about 20 °C). The moving dots in each bin are a picture of the particles: packed and wobbling in a solid, touching and sliding in a liquid, far apart and fast in a gas. Real particles are far too small to see and there are vastly more of them, and real materials such as sand, foam or jelly can be tricky and sit between the groups.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rnd = ctx.rng || Math.random;
    const N = (ctx.level || 1) >= 2 ? 8 : 6;                                             // level 1: six things; level 2: eight, with the tricky ones
    const shuffle = (a) => a.map((i) => [rnd(), i]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
    const pool = shuffle(ITEMS), pick = [];
    for (const st of ['s', 'l', 'g']) pick.push(pool.find((i) => i[2] === st));
    if (N === 8) for (const tricky of ['honey', 'steam']) { const it = ITEMS.find((i) => i[0] === tricky); if (!pick.includes(it)) pick.push(it); }
    for (const i of pool) if (pick.length < N && !pick.includes(i)) pick.push(i);
    const order = shuffle(pick);

    const own = [], keep = (o) => { own.push(o); return o; };
    const add3 = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const clear = (color, opacity, o = {}) => keep(new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.15, depthWrite: false, ...o }));

    // ----- three glass bins with their particles -----
    const BW = 1.9, BH = 1.9, BD = 1.3, BZ = -0.9, FLOOR = 0.2;
    const glass = clear('#e8fff8', 0.16, { side: THREE.DoubleSide });
    const binG = keep(new THREE.BoxGeometry(BW, BH, BD)), baseG = keep(new THREE.BoxGeometry(BW + 0.2, FLOOR, BD + 0.2)), dotG = keep(new THREE.SphereGeometry(0.1, 10, 8));
    const bins = {}, dummy = new THREE.Object3D();
    BINS.forEach(([k, name, hint, color], i) => {
      const x = (i - 1) * 2.35;
      const base = add3(baseG, ctx.mat('#1f7a66', { roughness: 0.6 }), x, FLOOR / 2, BZ);
      const box = add3(binG, glass, x, FLOOR + BH / 2, BZ); box.renderOrder = 3;
      const head = ctx.sprite(name, { size: 0.42, label: hint }); head.position.set(x, FLOOR + BH + 0.5, BZ); group.add(head);
      const n = k === 's' ? 32 : k === 'l' ? 30 : 12, dots = new THREE.InstancedMesh(dotG, ctx.lit(color, 0.5), n); dots.frustumCulled = false; group.add(dots);
      const p = [];
      for (let j = 0; j < n; j++) {
        if (k === 's') p.push({ x: -0.45 + (j % 4) * 0.3, y: 0.32 + Math.floor(j / 8) * 0.3, z: -0.45 + (Math.floor(j / 4) % 2) * 0.3, f: 9 + rnd() * 5, a: rnd() * 6.3 });
        else if (k === 'l') p.push({ x: -0.75 + (j % 10) * 0.166, y: 0.3 + Math.floor(j / 10) * 0.17, z: -0.42 + rnd() * 0.5, f: 0.5 + rnd() * 0.8, a: rnd() * 6.3 });
        else p.push({ x: (rnd() - 0.5) * 1.5, y: 0.4 + rnd() * 1.4, z: (rnd() - 0.5) * 0.9, vx: (rnd() - 0.5) * 3, vy: (rnd() - 0.5) * 3, vz: (rnd() - 0.5) * 2 });
      }
      bins[k] = { k, x, name, base, box, head, dots, p, count: 0, pop: 0 };
      ctx.onTap(box, () => drop(k)); ctx.onTap(base, () => drop(k));
    });
    function moveDots(dt, time) {
      for (const b of Object.values(bins)) {
        b.p.forEach((p, j) => {
          let x = p.x, y = p.y, z = p.z;
          if (b.k === 's') { x += Math.sin(time * p.f + p.a) * 0.025; y += Math.cos(time * p.f * 1.1 + p.a) * 0.025; }
          else if (b.k === 'l') { x += Math.sin(time * p.f + p.a) * 0.22; z += Math.cos(time * p.f * 0.8 + p.a * 2) * 0.16; y += Math.sin(time * p.f * 1.7 + p.a) * 0.04; x = Math.max(-0.83, Math.min(0.83, x)); }
          else {
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (Math.abs(p.x) > 0.83) { p.x = Math.sign(p.x) * 0.83; p.vx = -p.vx; }
            if (p.y < 0.32 || p.y > BH + 0.05) { p.y = Math.max(0.32, Math.min(BH + 0.05, p.y)); p.vy = -p.vy; }
            if (Math.abs(p.z) > 0.53) { p.z = Math.sign(p.z) * 0.53; p.vz = -p.vz; }
            x = p.x; y = p.y; z = p.z;
          }
          dummy.position.set(b.x + x, y, BZ + z); dummy.updateMatrix(); b.dots.setMatrixAt(j, dummy.matrix);
        });
        b.dots.instanceMatrix.needsUpdate = true;
        b.pop = Math.max(0, b.pop - dt * 2); b.head.position.y = FLOOR + BH + 0.5 + b.pop * 0.15;
      }
    }

    // ----- the things to sort, each a small 3D model. `shell` parts vanish and `inside` parts appear when a liquid or gas is let out -----
    const G = {
      cube: keep(new THREE.BoxGeometry(1, 1, 1)), ball: keep(new THREE.SphereGeometry(1, 18, 12)), rock: keep(new THREE.DodecahedronGeometry(0.27)),
      cup: keep(new THREE.CylinderGeometry(0.19, 0.16, 0.44, 16, 1, true)), drink: keep(new THREE.CylinderGeometry(0.16, 0.14, 0.34, 16)),
      cone: keep(new THREE.ConeGeometry(0.175, 0.32, 16)), swirl: keep(new THREE.TorusGeometry(0.2, 0.045, 8, 20, 4.6)), thin: keep(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6)),
    };
    const cupM = clear('#f4fffb', 0.3, { side: THREE.DoubleSide }), puffM = clear('#ffffff', 0.75), airM = clear('#cfeeff', 0.55);
    const part = (g, geo, material, x, y, z, s, role) => { const m = add3(geo, material, x, y, z, g); if (s != null) (Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s)); m.userData.role = role || ''; return m; };
    const drinkOf = (g, color) => { part(g, G.cup, cupM, 0, 0.22, 0, null, 'shell'); part(g, G.drink, ctx.mat(color, { roughness: 0.25 }), 0, 0.19, 0); };
    const BUILD = {
      ice(g) { part(g, G.cube, clear('#bfe9ff', 0.7), 0, 0.21, 0, 0.42); },
      rock(g) { part(g, G.rock, ctx.mat('#8d949c', { roughness: 0.9, flatShading: true }), 0, 0.24, 0); },
      brick(g) { part(g, G.cube, ctx.mat('#c0523a', { roughness: 0.8 }), 0, 0.13, 0, [0.54, 0.26, 0.28]); },
      ball(g) { part(g, G.ball, ctx.mat('#ffffff', { roughness: 0.5 }), 0, 0.25, 0, 0.25); part(g, G.swirl, ctx.mat('#e2453c'), 0, 0.25, 0, 1.2).rotation.x = 1.2; },
      water(g) { part(g, G.ball, ctx.mat('#3d9bff', { roughness: 0.15 }), 0, 0.2, 0, 0.2); part(g, G.cone, ctx.mat('#3d9bff', { roughness: 0.15 }), 0, 0.46, 0, null, 'shell'); },
      milk(g) { drinkOf(g, '#fbfbf4'); },
      honey(g) { drinkOf(g, '#e8a020'); },
      juice(g) { drinkOf(g, '#ff9a2e'); part(g, G.thin, ctx.mat('#e2453c'), 0.06, 0.36, 0, null, 'shell').rotation.z = -0.3; },
      wind(g) { for (let i = 0; i < 3; i++) { const m = part(g, G.swirl, airM, (i - 1) * 0.16, 0.2 + i * 0.12, 0, 0.8 + i * 0.15); m.rotation.z = i * 2.1; } },
      balloon(g) {
        const skin = part(g, G.ball, ctx.mat('#e85d9a', { roughness: 0.3 }), 0, 0.42, 0, [0.24, 0.29, 0.24], 'shell'); skin.userData.role = 'shell';
        part(g, G.thin, ctx.mat('#ffffff'), 0, 0.07, 0, [1, 0.3, 1], 'shell');
        for (let i = 0; i < 3; i++) part(g, G.ball, airM, Math.cos(i * 2.1) * 0.13, 0.36 + i * 0.07, Math.sin(i * 2.1) * 0.13, 0.13, 'inside').visible = false;
      },
      steam(g) { for (let i = 0; i < 4; i++) part(g, G.ball, puffM, Math.cos(i * 1.7) * 0.13, 0.17 + i * 0.1, Math.sin(i * 1.7) * 0.1, 0.15 - i * 0.012); },
      bubble(g) { part(g, G.ball, clear('#d9f6ff', 0.4, { emissive: new THREE.Color('#7fd8ff'), emissiveIntensity: 0.4 }), 0, 0.26, 0, 0.26); part(g, G.ball, ctx.lit('#ffffff', 1), 0.1, 0.36, 0.17, 0.045, 'shell'); },
    };

    // the bench the things wait on
    const BY = 0.8, SZ = 1.75;
    add3(keep(new THREE.BoxGeometry(7, 0.12, 0.75)), ctx.mat('#7a5a36', { roughness: 0.7 }), 0, BY - 0.06, SZ);
    const legG = keep(new THREE.BoxGeometry(0.16, BY - 0.12, 0.6));
    for (const x of [-3.2, 3.2]) add3(legG, ctx.mat('#5d4326'), x, (BY - 0.12) / 2, SZ);

    const things = order.map((it, k) => {
      const g = new THREE.Group(), home = new THREE.Vector3((k - (N - 1) / 2) * (6.3 / N), BY, SZ);
      BUILD[it[0]](g); g.position.copy(home); group.add(g);
      const tag = ctx.sprite(it[1], { size: 0.19 }); tag.position.set(home.x, BY - 0.26, SZ + 0.42); group.add(tag);
      const th = { it, g, tag, home, state: 'shelf', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), bin: null, right: false, wander: rnd() * 6.3 };
      g.traverse((o) => { if (o.isMesh) ctx.onTap(o, () => select(k)); });
      return th;
    });

    let sel = -1, firstTry = 0, sorted = 0, busy = null, done = false, queue = [], wait = 0;
    const tries = new Set();
    const rSorted = ui.readout('Sorted'), rFirst = ui.readout('Right first time'), rTemp = ui.readout('Room temperature');
    const show = () => { rSorted.set(sorted + ' of ' + N + ' things'); rFirst.set(String(firstTry)); rTemp.set('20 °C'); };

    function select(k) {
      const th = things[k]; if (!th) return;
      if (th.state !== 'shelf') { if (th.state === 'in') ctx.say(`The ${th.it[1]} is already sorted. Pick a thing that is still on the bench.`); return; }
      sel = sel === k ? -1 : k;
      if (sel >= 0) ctx.say(`You picked ${th.it[1]}. Does it keep its shape, flow, or spread out? Tap its bin.`);
    }
    function drop(k) {
      if (busy) { ctx.say('Wait until the last thing has landed.'); return; }
      if (sel < 0) { ctx.say('Tap a thing first.'); return; }
      const th = things[sel], b = bins[k]; sel = -1;
      th.right = th.it[2] === k; th.bin = b; th.state = 'fly'; th.t = 0; th.from.copy(th.g.position); th.to.set(b.x, FLOOR + BH + 0.75, BZ); busy = th;
      if (th.right) { if (!tries.has(th.it[1])) firstTry++; ctx.say(th.it[3] + ' ' + MOVES[k]); }
      else { tries.add(th.it[1]); ctx.say('Hmm, not quite. Think: can you pour it? Can you hold it in your hand? Does it fill the whole room? Try again!'); }
    }
    function landed(th) {
      const b = th.bin; th.state = 'in'; th.t = 0; b.count++; b.pop = 1; sorted++; busy = null; th.tag.visible = false; show();
      th.g.traverse((o) => { if (o.userData.role === 'shell' && th.it[2] !== 's') o.visible = false; if (o.userData.role === 'inside') o.visible = true; });
      if (sorted === N && !done) {
        done = true;
        ctx.say('All sorted! Solids keep their shape, liquids flow, and gases spread out to fill the space.');
        ctx.complete(firstTry / N, 'Solids keep their shape, liquids flow, and gases spread out to fill the space.');
      }
    }
    const ease = (u) => u * u * (3 - 2 * u);
    function moveThings(dt, time) {
      things.forEach((th, k) => {
        const g = th.g; th.t += dt;
        if (th.state === 'shelf') {
          const lift = k === sel ? 0.35 + (ctx.calm ? 0 : Math.sin(time * 4) * 0.05) : 0;
          g.position.y += (th.home.y + lift - g.position.y) * Math.min(1, dt * 8); g.position.x = th.home.x; g.position.z = th.home.z;
          g.rotation.y += dt * (k === sel ? 2.2 : 0.3);
        } else if (th.state === 'fly') {                                                  // up and over the rim of the bin
          const u = Math.min(1, th.t / 0.8), e = ease(u);
          g.position.lerpVectors(th.from, th.to, e); g.position.y += Math.sin(u * Math.PI) * 0.5; g.rotation.y += dt * 4;
          if (u >= 1) {
            th.t = 0;
            if (th.right) { const c = th.bin.count; th.state = 'fall'; th.from.copy(g.position); th.to.set(th.bin.x - 0.5 + (c % 3) * 0.5, th.it[2] === 'g' ? 1.0 + (c % 2) * 0.4 : FLOOR, BZ + 0.38 - Math.floor(c / 3) * 0.4); }
            else { th.state = 'back'; th.from.copy(g.position); }
          }
        } else if (th.state === 'fall') {                                                 // solids and liquids drop; gases drift down
          const gas = th.it[2] === 'g', u = Math.min(1, th.t / (gas ? 0.9 : 0.45)), e = gas ? ease(u) : u * u;
          g.position.lerpVectors(th.from, th.to, e);
          if (u >= 1) landed(th);
        } else if (th.state === 'back') {                                                 // the wrong bin: it comes back to the bench
          const u = Math.min(1, th.t / 0.8), e = ease(u);
          g.position.lerpVectors(th.from, th.home, e); g.position.y += Math.sin(u * Math.PI) * 0.4; g.rotation.z = Math.sin(u * Math.PI * 4) * 0.2 * (1 - u);
          if (u >= 1) { th.state = 'shelf'; g.rotation.z = 0; busy = null; }
        } else {
          const st = th.it[2], u = Math.min(1, th.t / 1.2);
          if (st === 's') g.position.y = th.to.y + Math.abs(Math.sin(u * Math.PI * 2)) * 0.12 * (1 - u);        // a little bounce, same shape
          else if (st === 'l') g.scale.set(1 + 1.1 * ease(u), 1 - 0.62 * ease(u), 1 + 0.6 * ease(u));            // it runs flat: a puddle
          else {                                                                                                 // it swells and wanders
            g.scale.setScalar(1 + 0.9 * ease(u));
            const w = time * 0.5 + th.wander; g.position.set(th.to.x + Math.sin(w) * 0.25, th.to.y + Math.sin(w * 1.3) * 0.25, th.to.z + Math.cos(w * 0.8) * 0.12); g.rotation.y += dt * 0.5;
          }
        }
      });
    }

    ui.note('Tap a thing on the bench, then tap the bin where it goes. Guess first! Watch the dots in each bin: they show how the tiny particles move.');
    ui.choice(order.map((it, k) => [k, it[1]]), -1, (k) => { const i = Number(k); if (sel !== i) select(i); });
    for (const [k, name, hint] of BINS) ui.button(`Put it in ${name} (${hint})`, () => drop(k), 'btn ghost sm');
    ui.note('Solid = keeps its shape · Liquid = pours · Gas = spreads out');
    show(); moveDots(0, 0);
    ctx.say('Sort every thing: does it keep its shape, does it flow, or does it spread out?');

    return {
      step(dt) {
        if (queue.length && !busy && (wait -= dt) <= 0) { wait = 0.25; queue.shift()(); }
      },
      frame(dt, time) { moveDots(Math.min(dt, 0.05), time || 0); moveThings(Math.min(dt, 0.05), time || 0); },
      // Sorts each remaining thing the way a player would: pick it, then choose its bin.
      autoplay() {
        queue = []; wait = 0;
        things.forEach((th, k) => { if (th.state === 'shelf') queue.push(() => { sel = -1; select(k); }, () => drop(th.it[2])); });
      },
      dispose() {
        queue = [];
        group.traverse((o) => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
        for (const b of Object.values(bins)) b.dots.dispose();
        for (const o of own) o.dispose();
      },
    };
  },
};
