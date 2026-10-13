// World 19 lab — Build a Neighbourhood in 3D: a model town grid with homes, four services and walking zones.
// No imports: everything arrives through the context, so the model can be checked without a browser.

// ----- the model: a 7 × 7 grid; "near" means within 3 squares in every direction -----
const N = 7, REACH = 3, HOMES = 6;
const SERV = [['Park', '#2f9e44'], ['School', '#f08c00'], ['Clinic', '#1098ad'], ['Bus stop', '#7048e8']];
export function near(a, b) { return Math.max(Math.abs(a % N - b % N), Math.abs(Math.floor(a / N) - Math.floor(b / N))) <= REACH; }
// put: the square of each service (index 0–3), or undefined when it is not placed yet
export function served(home, put) { return SERV.every((_, k) => put[k] != null && near(home, put[k])); }
// Empty squares that are near every home.
export function central(homes) { const out = []; for (let i = 0; i < N * N; i++) if (!homes.includes(i) && homes.every((h) => near(h, i))) out.push(i); return out; }
// Six homes inside a block of span × span squares, chosen so that at least five empty squares are near them all.
export function makeHomes(rng, span) {
  for (let tries = 0; tries < 200; tries++) {
    const ox = Math.min(N - span, Math.floor(rng() * (N - span + 1))), oy = Math.min(N - span, Math.floor(rng() * (N - span + 1))), set = new Set();
    for (let g = 0; set.size < HOMES && g < 500; g++) set.add((oy + Math.min(span - 1, Math.floor(rng() * span))) * N + ox + Math.min(span - 1, Math.floor(rng() * span)));
    const homes = [...set];
    if (homes.length === HOMES && central(homes).length >= 5) return homes;
  }
  return [8, 10, 16, 22, 24, 17];
}
export function selfTest() {
  // by hand: square 0 is the top-left corner, square 24 the middle, square 48 the bottom-right corner
  const a = near(0, 24), b = near(0, 48), c = near(0, 3), d = near(0, 4), e = near(21, 45);
  const homes = [0, 5, 24], all = [9, 10, 16, 17], one = [9, 10, 16, 31];
  const h1 = homes.filter((h) => served(h, all)).length, h2 = homes.filter((h) => served(h, one)).length, h3 = homes.filter((h) => served(h, [9, 10, 16])).length;
  let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let fair = true; for (let i = 0; i < 300; i++) { const hs = makeHomes(rng, 4 + (i % 2)); if (hs.length !== HOMES || central(hs).length < 4) fair = false; }
  const ok = a && !b && c && !d && e && h1 === 3 && h2 === 1 && h3 === 0 && fair;
  return { ok, detail: `corner to middle is 3 squares (near), corner to corner 6 (far), 3 across near, 4 across far; homes at 0, 5, 24 with services on 9, 10, 16, 17: ${h1} of 3 happy (hand 3); bus stop moved to square 31: ${h2} (hand 1); every random town has room for all four services` };
}

export default {
  id: 'w19-neighbourhood',
  world: 19,
  levels: [1, 2],
  title: 'Build a Neighbourhood',
  goal: 'Place the park, school, clinic and bus stop so every home can walk to all of them.',
  kind: 'validated',
  model: 'A flat square grid where "near" means within 3 squares, ignoring roads, hills, cost and what people actually prefer. The coloured zone round each building covers exactly the squares that count as near it. Real planners also consult the people who live there.',
  mount(ctx) {
    const { THREE, group, ui } = ctx;
    const C = 0.7, HALF = N * C / 2, TOP = 0.12;                       // one square is 0.7 m; the board top is at 0.12 m
    const cx = (i) => -HALF + (i % N + 0.5) * C, cz = (i) => -HALF + (Math.floor(i / N) + 0.5) * C;
    const homes = makeHomes(ctx.rng, ctx.level >= 2 ? 5 : 4);
    const put = [null, null, null, null];
    let sel = 0, col = 3, row = 3, guess = null, done = false, checked = false, cheer = 0;

    // ----- the board -----
    const board = new THREE.Mesh(new THREE.BoxGeometry(N * C, TOP, N * C), ctx.mat('#b2f2bb', { roughness: 1 })); board.position.y = TOP / 2; group.add(board);
    const lineMat = ctx.mat('#69db7c'), lx = new THREE.BoxGeometry(0.03, 0.02, N * C), lz = new THREE.BoxGeometry(N * C, 0.02, 0.03);
    for (let i = 1; i < N; i++) { const a = new THREE.Mesh(lx, lineMat); a.position.set(-HALF + i * C, TOP + 0.005, 0); a.castShadow = false; const b = new THREE.Mesh(lz, lineMat); b.position.set(0, TOP + 0.005, -HALF + i * C); b.castShadow = false; group.add(a, b); }
    const cursor = new THREE.Mesh(new THREE.BoxGeometry(C * 0.94, 0.04, C * 0.94), ctx.lit('#ffd43b', 0.9)); cursor.castShadow = false; group.add(cursor);
    ctx.onTap(board, (o, p) => tapAt(p));

    // ----- homes -----
    const wall = ctx.mat('#ffe8cc'), roofMat = ctx.mat('#e8590c'), waitLamp = ctx.mat('#ced4da'), happy = ctx.lit('#51cf66', 1.5), sad = ctx.lit('#ffa94d', 1.2);
    const hBody = new THREE.BoxGeometry(0.42, 0.34, 0.42), hRoof = new THREE.ConeGeometry(0.38, 0.26, 4), hLamp = new THREE.SphereGeometry(0.11, 12, 8);
    const houses = homes.map((i) => {
      const g = new THREE.Group(), b = new THREE.Mesh(hBody, wall), r = new THREE.Mesh(hRoof, roofMat), lamp = new THREE.Mesh(hLamp, waitLamp);
      b.position.y = 0.17; r.position.y = 0.47; r.rotation.y = Math.PI / 4; lamp.position.y = 0.82; g.add(b, r, lamp); g.position.set(cx(i), TOP, cz(i)); g.scale.setScalar(1.25); group.add(g);
      ctx.onTap(g, () => ctx.say('That square already has a home. Pick an empty square.'));
      return { g, lamp, i };
    });

    // ----- the four services: each a small model that drops onto its square, and a see-through walking zone -----
    const white = ctx.mat('#f8f9fa'), wood = ctx.mat('#a0704a');
    const build = [
      (g, m) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), wood); t.position.y = 0.2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), m); l.position.y = 0.6; g.add(t, l); },
      (g, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.4), m); b.position.y = 0.2; const t = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), white); t.position.set(0.14, 0.4, 0); g.add(b, t); },
      (g, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.44), white); b.position.y = 0.25; const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); d.position.y = 0.5; g.add(b, d); },
      (g, m) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), white); p.position.set(-0.18, 0.4, 0); const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.3), m); s.position.set(0.02, 0.78, 0); const q = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.14), wood); q.position.set(0.06, 0.2, 0); g.add(p, s, q); },
    ];
    const zoneGeo = new THREE.BoxGeometry(1, 0.03, 1), made = [];
    const services = SERV.map(([name, colour], k) => {
      const g = new THREE.Group(); build[k](g, ctx.lit(colour, 0.35)); g.scale.setScalar(1.2); g.visible = false; group.add(g);
      const zm = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), transparent: true, opacity: 0.3, depthWrite: false, emissive: new THREE.Color(colour), emissiveIntensity: 0.3 }); made.push(zm);
      const zone = new THREE.Mesh(zoneGeo, zm); zone.castShadow = false; zone.visible = false; group.add(zone);
      const label = ctx.sprite(name, { size: 0.2, bg: 'rgba(14,18,48,.78)' }); label.position.y = 1.15; g.add(label);
      return { g, zone, drop: 0, grow: 0, w: 0, d: 0, zx: 0, zz: 0 };
    });

    // ----- controls -----
    const selC = ui.choice(SERV.map((s, k) => [k, s[0]]), 0, (v) => { sel = v; });
    const colS = ui.slider({ label: 'Square across', min: 1, max: N, step: 1, value: col + 1, unit: '', onInput: (v) => { col = Math.round(v) - 1; refresh(); } });
    const rowS = ui.slider({ label: 'Square back to front', min: 1, max: N, step: 1, value: row + 1, unit: '', onInput: (v) => { row = Math.round(v) - 1; refresh(); } });
    ui.button('Place it on the yellow square', () => place(row * N + col), 'btn');
    ui.note('How many homes will be happy?');
    const guessC = ui.choice([0, 1, 2, 3, 4, 5, 6].map((n) => [n, String(n)]), null, (v) => { guess = v; });
    ui.button('✔ Check', () => verify(), 'btn ok');
    const placedR = ui.readout('Buildings placed'), reachR = ui.readout('Walking distance'), happyR = ui.readout('Happy homes');
    ui.note('Tap any empty square to place the chosen building there. Each building\'s coloured zone shows every square within 3 squares of it. A home is happy when it stands inside all four zones.');

    function refresh() {
      cursor.position.set(cx(row * N + col), TOP + 0.03, cz(row * N + col));
      placedR.set(`${put.filter((p) => p != null).length} of 4`); reachR.set(`${REACH} squares`);
      if (!checked) happyR.set('press Check');
    }
    function tapAt(p) {
      const c = Math.max(0, Math.min(N - 1, Math.floor((p.x + HALF) / C))), r = Math.max(0, Math.min(N - 1, Math.floor((p.z + HALF) / C)));
      colS.set(c + 1); rowS.set(r + 1); place(r * N + c);
    }
    function place(i) {
      if (done) return;
      if (homes.includes(i)) { ctx.say('That square already has a home. Pick an empty square.'); return; }
      const other = put.indexOf(i);
      if (other >= 0 && other !== sel) { put[other] = null; services[other].g.visible = services[other].zone.visible = false; }
      put[sel] = i; checked = false;
      const s = services[sel], c = i % N, r = Math.floor(i / N);
      const c0 = Math.max(0, c - REACH), c1 = Math.min(N - 1, c + REACH), r0 = Math.max(0, r - REACH), r1 = Math.min(N - 1, r + REACH);
      s.w = (c1 - c0 + 1) * C - 0.06; s.d = (r1 - r0 + 1) * C - 0.06; s.zx = -HALF + (c0 + c1 + 1) / 2 * C; s.zz = -HALF + (r0 + r1 + 1) / 2 * C;
      s.g.position.set(cx(i), TOP, cz(i)); s.g.visible = s.zone.visible = true; s.drop = 1; s.grow = 0;
      for (const h of houses) h.lamp.material = waitLamp;
      const inside = homes.filter((h) => near(h, i)).length;
      ctx.say(`The ${SERV[sel][0].toLowerCase()} is within ${REACH} squares of ${inside} of the ${HOMES} homes. ${inside < HOMES ? 'Homes outside its coloured zone have too far to walk.' : 'Every home can walk to it.'}`);
      const next = put.findIndex((p) => p == null);
      if (next >= 0) { sel = next; selC.set?.(next); }
      refresh();
    }
    function verify() {
      if (put.some((p) => p == null)) { ctx.say('Place all four buildings first.'); return; }
      if (guess == null) { ctx.say('Make your guess first: how many homes will be happy?'); return; }
      const ok = homes.filter((h) => served(h, put)), good = ok.length === homes.length;
      checked = true;
      for (const h of houses) h.lamp.material = served(h.i, put) ? happy : sad;
      happyR.set(`${ok.length} of ${homes.length}`);
      const right = guess === ok.length ? ' Your guess was right!' : '';
      if (good) {
        ctx.say(`${ok.length} of ${homes.length} homes are happy.${right} Putting services in the middle of everyone makes the walk short for all.`);
        if (!done) { done = true; cheer = 3; ctx.complete(guess === ok.length ? 1 : 0.85, 'Placed services so every home is close to all of them.'); }
      } else {
        const home = homes.find((h) => !served(h, put)), far = SERV.filter((_, k) => !near(home, put[k])).map((s) => s[0].toLowerCase());
        ctx.say(`${ok.length} of ${homes.length} homes are happy.${right} A home with an orange light is too far from at least one building: one of them is outside the zone of the ${far.join(' and the ')}. Try moving buildings closer to the middle of the homes.`);
      }
    }
    refresh();
    ctx.say('Six families live here. Choose a building, pick a square, and watch its walking zone spread. Can you get every home inside all four zones?');

    return {
      frame(dt, time) {
        services.forEach((s, k) => {
          if (!s.g.visible) return;
          s.drop = ctx.calm ? 0 : Math.max(0, s.drop - dt * 2.5); s.grow = ctx.calm ? 1 : Math.min(1, s.grow + dt * 1.8);
          s.g.position.y = TOP + s.drop * s.drop * 1.6;
          const e = 1 - (1 - s.grow) * (1 - s.grow);
          s.zone.scale.set(Math.max(0.01, s.w * e), 1, Math.max(0.01, s.d * e));
          s.zone.position.set(s.g.position.x + (s.zx - s.g.position.x) * e, TOP + 0.03 + k * 0.012, s.g.position.z + (s.zz - s.g.position.z) * e);
        });
        houses.forEach((h, j) => { h.g.position.y = TOP + (cheer > 0 && !ctx.calm ? Math.abs(Math.sin(time * 7 + j)) * 0.12 : 0); });
        if (cheer > 0) cheer -= dt;
        cursor.visible = !done; if (!ctx.calm) cursor.position.y = TOP + 0.03 + Math.sin(time * 4) * 0.008;
      },
      // Finds four empty squares near every home, then places and checks through the player's own controls.
      autoplay() {
        const spots = central(homes).slice(0, 4);
        spots.forEach((i, k) => { sel = k; selC.set?.(k); colS.set(i % N + 1); rowS.set(Math.floor(i / N) + 1); place(row * N + col); });
        guess = HOMES; guessC.set?.(HOMES);
        verify();
      },
      dispose() { for (const g of [lx, lz, hBody, hRoof, hLamp, zoneGeo]) g.dispose(); for (const m of made) m.dispose(); },
    };
  },
};
