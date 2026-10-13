// World 8 lab — Timeline Builder in 3D: a road through time with monuments the player moves into order.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

// [model, label, year (negative = BCE), place, short name]. Approximate, well-established dates.
const EV = [
  ['cave', 'Cave paintings at Lascaux, France', -17000, 'Europe', 'Cave paintings'],
  ['farm', 'Farming begins in the Fertile Crescent', -9000, 'Asia', 'First farming'],
  ['pyramid', 'Great Pyramid of Giza built', -2560, 'Africa', 'Great Pyramid'],
  ['temple', 'Parthenon built in Athens', -440, 'Europe', 'Parthenon'],
  ['wall', 'Great Wall begun under Qin Shi Huang', -220, 'Asia', 'Great Wall begun'],
  ['steps', 'Teotihuacan Pyramid of the Sun built', 150, 'Americas', 'Pyramid of the Sun'],
  ['books', 'House of Wisdom in Baghdad flourishes', 830, 'Asia', 'House of Wisdom'],
  ['terraces', 'Machu Picchu built by the Inca', 1450, 'Americas', 'Machu Picchu'],
  ['press', 'Gutenberg prints with movable type', 1450, 'Europe', 'Printing press'],
  ['gold', 'Mansa Musa travels from Mali to Mecca', 1324, 'Africa', 'Mansa Musa\'s journey'],
  ['canoe', 'Polynesian voyagers reach New Zealand', 1280, 'Oceania', 'Voyage to New Zealand'],
  ['steam', 'Steam power spreads in the Industrial Revolution', 1780, 'Europe', 'Steam power'],
  ['globe', 'The United Nations is founded', 1945, 'World', 'United Nations'],
  ['web', 'The World Wide Web is invented', 1989, 'Europe', 'World Wide Web'],
];
const yr = (y) => (y < 0 ? `${-y} BCE` : `${y} CE`);
const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const model = {
  EV, yr,
  count: (level) => (level <= 1 ? 4 : 5),
  sorted: (order) => [...order].sort((a, b) => a[2] - b[2]),
  // How many events stand in the place they would have on a correct timeline.
  right(order) { const s = model.sorted(order); return order.filter((e, i) => e === s[i]).length; },
  inOrder: (order) => order.every((e, i, a) => !i || a[i - 1][2] <= e[2]),
  // Picks n events at least 150 years apart, from several continents, and hands them over out of order.
  pick(n, rng) {
    const pool = shuffle([...EV], rng), picked = [];
    for (const e of pool) { if (!picked.some((p) => Math.abs(p[2] - e[2]) < 150) && !picked.some((p) => p[3] === e[3] && picked.length < 3)) picked.push(e); if (picked.length === n) break; }
    for (const e of pool) { if (picked.length === n) break; if (!picked.includes(e) && !picked.some((p) => Math.abs(p[2] - e[2]) < 150)) picked.push(e); }
    const order = shuffle([...picked], rng);
    if (model.inOrder(order)) order.reverse();
    return order;
  },
  // The swaps a selection sort makes: the earliest event still out of place goes to the next free place.
  swaps(order) {
    const o = [...order], out = [];
    for (let i = 0; i < o.length - 1; i++) { let m = i; for (let j = i + 1; j < o.length; j++) if (o[j][2] < o[m][2]) m = j; if (m !== i) { [o[i], o[m]] = [o[m], o[i]]; out.push([i, m]); } }
    return out;
  },
};

export function selfTest() {
  const by = (k) => EV.find((e) => e[0] === k), a = [by('temple'), by('pyramid'), by('web'), by('steam')];
  const r1 = model.right(a), sw = model.swaps(a), b = [...a]; for (const [i, j] of sw) [b[i], b[j]] = [b[j], b[i]];
  let seed = 11, fine = true; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 200; t++) for (const n of [4, 5]) {
    const o = model.pick(n, rng), s = model.sorted(o);
    if (o.length !== n || model.inOrder(o) || new Set(o).size !== n || s.some((e, i) => i && e[2] - s[i - 1][2] < 150)) fine = false;
  }
  const ok = r1 === 0 && model.inOrder(b) && model.right(b) === 4 && b[0] === by('pyramid') && b[3] === by('web') && yr(-2560) === '2560 BCE' && yr(1989) === '1989 CE' && model.count(1) === 4 && model.count(2) === 5 && fine;
  return { ok, detail: `Parthenon, Pyramid, Web, Steam: ${r1} in place, ${sw.length} swaps give ${b.map((e) => yr(e[2])).join(' → ')}; 400 random sets are all distinct, out of order and at least 150 years apart: ${fine}` };
}

export default {
  id: 'w08-timeline-builder',
  world: 8,
  levels: [1, 2],
  title: 'Timeline Builder',
  goal: 'Put the monuments in order along the road of time, from longest ago to most recent: tap two of them to swap their places, then send the lantern down the road to check.',
  kind: 'validated',
  model: 'Each event has one date and the timeline is correct when the dates never go backwards from left to right. Dates are rounded and some are approximate (for example the first farming and the cave paintings). Only a few well-known events from several continents are shown, and history has many more stories.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = Math.max(1, Math.min(6, Math.round(ctx.level) || 1)), rnd = ctx.rng || Math.random;
    const M = (geo, material, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const n = model.count(L), order = model.pick(n, rnd), SP = n === 4 ? 1.5 : 1.3, sx = (i) => (i - (n - 1) / 2) * SP;
    const sand = ctx.mat('#d9b46a', { roughness: 1, flatShading: true }), rock = ctx.mat('#8d8f96', { roughness: 1, flatShading: true }), darkM = ctx.mat('#2a2522', { roughness: 1 }), ochre = ctx.mat('#c2622d', { roughness: 0.9 });
    const marble = ctx.mat('#f1ece0', { roughness: 0.6 }), leaf = ctx.mat('#5aa55a', { roughness: 0.9, flatShading: true }), wheat = ctx.mat('#e8c14a', { roughness: 0.8 }), soil = ctx.mat('#77553a', { roughness: 1 });
    const adobe = ctx.mat('#b08a5a', { roughness: 1, flatShading: true }), wood = ctx.mat('#8a5a2e', { roughness: 0.8 }), iron = ctx.mat('#4c5560', { metalness: 0.6, roughness: 0.4 }), cream = ctx.mat('#f4ead0', { roughness: 0.9 });
    const blue = ctx.mat('#3f8fe0', { roughness: 0.5 }), teal = ctx.mat('#2f9c93', { roughness: 0.6 }), crimson = ctx.mat('#b8475a', { roughness: 0.7 }), goldM = ctx.mat('#e8b93c', { metalness: 0.8, roughness: 0.3 });
    const gold = ctx.lit('#ffd76a', 1.4), green = ctx.lit('#59d98a', 1.3), cyan = ctx.lit('#7fe3ff', 1.3), plain = ctx.mat('#e9dcc0', { roughness: 0.8 }), road = ctx.mat('#b5763c', { roughness: 1 });
    const spinners = [];

    // one small monument per event, each about 0.9 m across, standing on y = 0
    const build = {
      cave(g) { M(new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), rock, 0, 0, 0, g); M(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkM, 0, 0, 0.27, g); M(new THREE.BoxGeometry(0.16, 0.09, 0.04), ochre, -0.2, 0.3, 0.3, g); M(new THREE.BoxGeometry(0.12, 0.07, 0.04), ochre, 0.22, 0.27, 0.3, g); },
      farm(g) { M(new THREE.BoxGeometry(0.8, 0.1, 0.5), soil, 0, 0.05, 0, g); for (const x of [-0.25, 0, 0.25]) { M(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), leaf, x, 0.4, 0, g); M(new THREE.SphereGeometry(0.07, 8, 6), wheat, x, 0.74, 0, g).scale.set(1, 2, 1); } },
      pyramid(g) { M(new THREE.ConeGeometry(0.55, 0.75, 4), sand, 0, 0.375, 0, g).rotation.y = Math.PI / 4; },
      temple(g) { M(new THREE.BoxGeometry(0.9, 0.1, 0.55), marble, 0, 0.05, 0, g); for (const x of [-0.36, -0.12, 0.12, 0.36]) M(new THREE.CylinderGeometry(0.045, 0.05, 0.46, 10), marble, x, 0.33, 0.2, g); M(new THREE.BoxGeometry(0.9, 0.08, 0.55), marble, 0, 0.6, 0, g); M(new THREE.BoxGeometry(0.6, 0.08, 0.55), marble, 0, 0.68, 0, g); },
      wall(g) { M(new THREE.BoxGeometry(0.95, 0.3, 0.2), rock, 0, 0.15, 0, g); for (const x of [-0.32, 0.32]) M(new THREE.BoxGeometry(0.22, 0.52, 0.28), rock, x, 0.26, 0, g); M(new THREE.BoxGeometry(0.95, 0.05, 0.08), plain, 0, 0.32, 0.07, g); },
      steps(g) { [0.9, 0.7, 0.5, 0.3].forEach((w, i) => M(new THREE.BoxGeometry(w, 0.17, w * 0.8), adobe, 0, 0.085 + i * 0.17, 0, g)); },
      books(g) { [[crimson, 0.2], [teal, -0.25], [blue, 0.1]].forEach(([m, rot], i) => { M(new THREE.BoxGeometry(0.6, 0.14, 0.42), m, 0, 0.07 + i * 0.15, 0, g).rotation.y = rot; }); M(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 12), cream, 0, 0.53, 0, g).rotation.z = Math.PI / 2; },
      terraces(g) { M(new THREE.ConeGeometry(0.34, 0.95, 7), leaf, 0.12, 0.475, -0.18, g); [0.9, 0.68, 0.46].forEach((w, i) => M(new THREE.BoxGeometry(w, 0.13, 0.3), rock, -0.05, 0.065 + i * 0.13, 0.2 - i * 0.1, g)); },
      press(g) { M(new THREE.BoxGeometry(0.8, 0.12, 0.5), wood, 0, 0.06, 0, g); for (const x of [-0.32, 0.32]) M(new THREE.BoxGeometry(0.09, 0.75, 0.12), wood, x, 0.49, 0, g); M(new THREE.BoxGeometry(0.75, 0.1, 0.14), wood, 0, 0.86, 0, g); spinners.push([M(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), iron, 0, 0.58, 0, g), 'y', 1.5]); M(new THREE.BoxGeometry(0.46, 0.06, 0.36), iron, 0, 0.32, 0, g); M(new THREE.BoxGeometry(0.42, 0.02, 0.32), cream, 0, 0.14, 0, g); },
      gold(g) { for (const [x, y] of [[-0.2, 0.07], [0.2, 0.07], [0, 0.21]]) M(new THREE.BoxGeometry(0.36, 0.13, 0.2), goldM, x, y, 0.12, g); M(new THREE.ConeGeometry(0.26, 0.5, 6), cream, -0.1, 0.25, -0.25, g); M(new THREE.SphereGeometry(0.06, 8, 6), gold, 0, 0.36, 0.12, g); },
      canoe(g) { M(new THREE.SphereGeometry(0.2, 12, 8), wood, 0, 0.14, 0, g).scale.set(2.4, 0.5, 0.6); M(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), wood, 0, 0.1, 0.34, g).rotation.z = Math.PI / 2; for (const x of [-0.2, 0.2]) M(new THREE.BoxGeometry(0.04, 0.04, 0.36), wood, x, 0.2, 0.17, g); M(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 6), wood, 0, 0.55, 0, g); M(new THREE.ConeGeometry(0.3, 0.6, 3), cream, 0.1, 0.6, 0, g).scale.z = 0.12; },
      steam(g) { M(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 14), iron, -0.08, 0.32, 0, g).rotation.z = Math.PI / 2; M(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 10), iron, -0.3, 0.68, 0, g); M(new THREE.BoxGeometry(0.85, 0.1, 0.4), wood, 0, 0.05, 0, g); const w = M(new THREE.TorusGeometry(0.24, 0.045, 8, 20), crimson, 0.25, 0.36, 0.26, g); M(new THREE.BoxGeometry(0.46, 0.05, 0.04), crimson, 0, 0, 0, w); M(new THREE.BoxGeometry(0.05, 0.46, 0.04), crimson, 0, 0, 0, w); spinners.push([w, 'z', -2.5]); M(new THREE.SphereGeometry(0.1, 8, 6), cream, -0.3, 0.98, 0, g); },
      globe(g) { M(new THREE.CylinderGeometry(0.16, 0.22, 0.14, 12), marble, 0, 0.07, 0, g); const s = M(new THREE.SphereGeometry(0.33, 18, 12), blue, 0, 0.52, 0, g); for (const [a, b, r] of [[0.5, 0.4, 0.14], [2.4, -0.3, 0.16], [4.2, 0.5, 0.12], [5.4, -0.5, 0.1]]) M(new THREE.SphereGeometry(r, 8, 6), leaf, Math.cos(b) * Math.cos(a) * 0.25, Math.sin(b) * 0.25, Math.cos(b) * Math.sin(a) * 0.25, s); spinners.push([s, 'y', 0.6]); M(new THREE.TorusGeometry(0.4, 0.02, 6, 28), marble, 0, 0.52, 0, g).rotation.x = 1.3; },
      web(g) { M(new THREE.CylinderGeometry(0.16, 0.22, 0.14, 12), iron, 0, 0.07, 0, g); const s = M(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, wireframe: true }), 0, 0.54, 0, g); M(new THREE.SphereGeometry(0.12, 12, 8), cyan, 0, 0, 0, s); for (const [x, y, z] of [[0.34, 0, 0], [-0.2, 0.26, 0.1], [0, -0.2, 0.28]]) M(new THREE.BoxGeometry(0.09, 0.09, 0.09), gold, x, y, z, s); spinners.push([s, 'y', 0.9]); },
    };

    // the road of time, running from long ago (left) to recent (right)
    M(new THREE.BoxGeometry(7, 0.12, 2.2), road, 0, 0.06, 0);
    for (let i = 0; i < 9; i++) M(new THREE.BoxGeometry(0.4, 0.02, 0.1), plain, -3.2 + i * 0.8, 0.13, 0.85);
    M(new THREE.ConeGeometry(0.22, 0.5, 10), gold, 3.3, 0.3, 0.85).rotation.z = -Math.PI / 2;
    for (const [x, txt] of [[-2.9, '⬅ Long ago'], [2.9, 'Recent ➡']]) { M(new THREE.CylinderGeometry(0.06, 0.08, 3.3, 8), wood, x * 1.14, 1.65, -0.9); const s = ctx.sprite(txt, { size: 0.34, bg: 'rgba(14,18,48,.78)' }); s.position.set(x, 3.5, -0.9); group.add(s); }
    const lantern = M(new THREE.SphereGeometry(0.2, 16, 12), gold, -3.3, 0.33, 0.85); lantern.add(ctx.glow('#ffd76a', 1.2, 0.8));
    const ring = M(new THREE.TorusGeometry(0.56, 0.05, 8, 28), gold, 0, 0.16, 0); ring.rotation.x = Math.PI / 2; ring.visible = false;

    // the markers: a pedestal, a monument and a name; they stay with their event when it moves
    const pedGeo = new THREE.CylinderGeometry(0.44, 0.5, 0.5, 18), capGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.07, 18);
    const markers = order.map((e, i) => {
      const g = new THREE.Group(); g.position.set(sx(i), 0.12, 0); group.add(g);
      const ped = M(pedGeo, sand, 0, 0.25, 0, g), cap = M(capGeo, plain, 0, 0.535, 0, g);
      const top = new THREE.Group(); top.position.y = 0.57; g.add(top); build[e[0]](top);
      const tag = ctx.sprite(e[4], { size: 0.25, bg: 'rgba(14,18,48,.78)' }); tag.position.set(0, i % 2 ? 2.55 : 2.05, 0); g.add(tag);
      const mk = { e, g, cap, top, tag, from: sx(i), to: sx(i), p: 1, dir: 1 };
      const tap = () => pickMarker(mk); ctx.onTap(ped, tap); ctx.onTap(cap, tap);
      return mk;
    });
    const slotOf = (mk) => order.indexOf(mk.e), at = (i) => markers.find((m) => m.e === order[i]);

    let sel = -1, a = 0, b = 1, done = false, checking = false, lit = 0, tries = 0, swapsMade = 0, lx = -3.3;
    const queue = []; let wait = 0;
    const places = Array.from({ length: n }, (_, i) => [i, `Place ${i + 1}`]);
    ui.note('Choose two places and swap the monuments standing there, or simply tap two monuments.');
    const aC = ui.choice(places, 0, (v) => { a = v; mark(); }), bC = ui.choice(places, 1, (v) => { b = v; mark(); });
    ui.button('🔁 Swap these two', () => swap(a, b), 'btn');
    ui.button('✔ Check the timeline', () => check(), 'btn ok');
    const rSwaps = ui.readout('Swaps made'), rRight = ui.readout('In the right place'), rSpan = ui.readout('Years from first to last');
    const span = () => { const s = model.sorted(order); return s[n - 1][2] - s[0][2]; };
    const show = () => { rSwaps.set(String(swapsMade)); rSpan.set(`${String(span()).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} years`); };
    function mark() { const i = sel >= 0 ? sel : -1; ring.visible = i >= 0; if (i >= 0) ring.position.x = sx(i); }
    function clearCaps() { for (const m of markers) m.cap.material = plain; }
    function swap(i, j) {
      if (done || checking) return false;
      if (i === j || i < 0 || j < 0 || i >= n || j >= n) { ctx.say('Choose two different places to swap.'); return false; }
      const mi = at(i), mj = at(j);
      [order[i], order[j]] = [order[j], order[i]];
      for (const [m, k, dir] of [[mi, j, 1], [mj, i, -1]]) { m.from = m.g.position.x; m.to = sx(k); m.p = 0; m.dir = dir; }
      swapsMade++; sel = -1; mark(); clearCaps(); rRight.set('–'); show();
      ctx.say(`${mi.e[4]} and ${mj.e[4]} change places. Ask yourself: which of these happened first?`);
      return true;
    }
    function pickMarker(mk) {
      if (done || checking) return;
      const i = slotOf(mk);
      if (sel < 0) { sel = i; mark(); ctx.say(`${mk.e[1]}. Now tap the monument it should change places with.`); }
      else if (sel === i) { sel = -1; mark(); }
      else swap(sel, i);
    }
    function check() {
      if (done || checking) return;
      checking = true; lit = 0; lx = -3.3; tries++; sel = -1; mark(); clearCaps();
      ctx.say('The lantern rolls along the road of time. A monument glows green when it stands in the right place.');
    }
    function verdict() {
      checking = false;
      const good = model.right(order); rRight.set(`${good} / ${n}`);
      if (good === n) {
        done = true;
        markers.forEach((m) => { const s = ctx.sprite(yr(m.e[2]), { size: 0.24, color: '#ffe9a8', bg: 'rgba(14,18,48,.85)' }); s.position.set(0, 0.26, 0.56); m.g.add(s); });
        const s = model.sorted(order);
        ctx.say(`Perfect order! From ${s[0][4]} (${yr(s[0][2])}, ${s[0][3]}) to ${s[n - 1][4]} (${yr(s[n - 1][2])}, ${s[n - 1][3]}). Events happened all over the world, and dates help us line up many people's stories.`);
        ctx.complete(1, 'Ordered historical events from several continents.');
      } else ctx.say(`${good} of ${n} are in the right place. A timeline only works when nothing comes before something older, so swap some monuments and check again.`);
    }
    show(); rRight.set('–');
    ctx.say(`Here are ${n} moments from history, mixed up. Put the one from longest ago on the left and the most recent on the right.`);

    return {
      step(dt) {
        if (queue.length && !checking) { wait -= dt; if (wait <= 0) { queue.shift()(); wait = 1.0; } }
        if (checking) {
          lx += dt * (6.6 / 3);
          while (lit < n && lx >= sx(lit)) { const m = at(lit); if (model.sorted(order)[lit] === m.e) m.cap.material = green; lit++; }
          if (lx >= 3.3) { lx = 3.3; verdict(); }
        }
      },
      frame(dt, time = 0) {
        for (const m of markers) {
          if (m.p < 1) {
            m.p = Math.min(1, m.p + dt / 0.8); const k = m.p * m.p * (3 - 2 * m.p), arc = Math.sin(Math.PI * m.p);
            m.g.position.set(m.from + (m.to - m.from) * k, 0.12 + arc * 0.5, m.dir * arc * 0.75);
          }
          const ty = slotOf(m) % 2 ? 2.55 : 2.05; m.tag.position.y += (ty - m.tag.position.y) * Math.min(1, dt * 6);
          m.top.position.y = 0.57 + (done && !ctx.calm ? Math.abs(Math.sin(time * 3 + m.to)) * 0.12 : 0);
        }
        for (const [o, axis, w] of spinners) if (!ctx.calm) o.rotation[axis] += dt * w;
        lantern.position.x += (lx - lantern.position.x) * Math.min(1, dt * 12); lantern.rotation.z = -lantern.position.x / 0.2;
        if (ring.visible) ring.position.y = 0.16 + Math.sin(time * 4) * 0.03;
      },
      // Sorts the road the way a player would: the earliest event still out of place moves to the next free place.
      autoplay() {
        for (const [i, j] of model.swaps(order)) queue.push(() => { aC.set(i); bC.set(j); swap(a, b); });
        queue.push(() => check());
      },
      dispose() { queue.length = 0; },
    };
  },
};
