// World 13 — Chess and Reasoning: the Grandmaster Arena.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: queens on an N × N board. A queen is [row, column]; it sees along its row, column and diagonals -----
const SIZES = [4, 5, 6, 6, 8, 8];                                   // board size for levels 1…6
const KNOWN = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92 };                  // published numbers of solutions
export const model = {
  // How two queens see each other: 'row', 'column', 'diagonal' or '' (they do not).
  sees: (a, b) => (a[0] === b[0] ? 'row' : a[1] === b[1] ? 'column' : Math.abs(a[0] - b[0]) === Math.abs(a[1] - b[1]) ? 'diagonal' : ''),
  // Every pair of queens that can see each other, as pairs of positions in the list.
  pairs(qs) { const out = []; for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) if (model.sees(qs[i], qs[j])) out.push([i, j]); return out; },
  conflicts: (qs) => model.pairs(qs).length,
  // Squares (row × n + column) that at least one queen sees. A queen's own square is not counted.
  attacked(qs, n) {
    const a = new Uint8Array(n * n);
    for (const [r, c] of qs) for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let y = r + dr, x = c + dc; y >= 0 && y < n && x >= 0 && x < n; y += dr, x += dc) a[y * n + x] = 1;
    return a;
  },
  // Counts every solution by backtracking: one queen per row, skipping columns and diagonals already in use.
  count(n) {
    const cols = [], d1 = [], d2 = [];
    const go = (r) => { if (r === n) return 1; let s = 0; for (let c = 0; c < n; c++) { if (cols[c] || d1[r + c] || d2[r - c + n]) continue; cols[c] = d1[r + c] = d2[r - c + n] = 1; s += go(r + 1); cols[c] = d1[r + c] = d2[r - c + n] = 0; } return s; };
    return go(0);
  },
  // The first solution the same systematic search finds (checked with `sees`, not with the tables used by count).
  first(n) {
    const qs = [];
    const go = (r) => { if (r === n) return true; for (let c = 0; c < n; c++) { const q = [r, c]; if (qs.some((o) => model.sees(o, q))) continue; qs.push(q); if (go(r + 1)) return true; qs.pop(); } return false; };
    return go(0) ? qs : null;
  },
};
// Used by the automated tests: the search must find the published number of solutions, and the conflict counter
// must be right on positions whose answer is known.
export function selfTest() {
  const counts = [4, 5, 6, 7, 8].map((n) => model.count(n)), want = [4, 5, 6, 7, 8].map((n) => KNOWN[n]);
  const diagonal = model.conflicts([[0, 0], [1, 1], [2, 2], [3, 3]]);                             // every pair shares the diagonal: 6
  const oneRow = model.conflicts([0, 1, 2, 3, 4, 5, 6, 7].map((c) => [0, c]));                    // every pair shares the row: 28
  const mixed = model.conflicts([[0, 0], [0, 3], [3, 3], [2, 2]]);                                // row, column and three diagonals: 5
  const peace = model.conflicts([[0, 1], [1, 3], [2, 0], [3, 2]]) + model.conflicts([0, 4, 7, 5, 2, 6, 1, 3].map((c, r) => [r, c]));
  const firsts = [4, 5, 6, 7, 8].every((n) => { const s = model.first(n); return s && s.length === n && model.conflicts(s) === 0; });
  const seen = model.attacked([[0, 0]], 4).reduce((a, b) => a + b, 0);                            // a corner queen sees 9 of the other 15 squares
  return { ok: counts.join() === want.join() && diagonal === 6 && oneRow === 28 && mixed === 5 && peace === 0 && firsts && seen === 9,
    detail: `solutions for N=4…8: ${counts.join(', ')}; conflict pairs ${diagonal}, ${oneRow}, ${mixed} (expected 6, 28, 5); known solutions ${peace} conflicts` };
}

const sim = {
  title: 'The queens\' peace',
  goal: 'Place one queen for every row of the board so that no two queens share a row, a column or a diagonal.',
  kind: 'validated',
  model: 'Exact logic, not an estimate: a queen sees every square along its row, its column and both diagonals, and two queens are in conflict when one stands on a square the other sees. The number of solutions is counted by a backtracking search and matches the known results (2, 10, 4, 40 and 92 for boards of 4 to 8 squares a side). It leaves out every other chess piece, taking turns and capturing, and it counts turned-round and mirrored arrangements as different solutions.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, N = SIZES[Math.max(1, Math.min(6, Math.round(ctx.level) || 1)) - 1], cell = 4.4 / N, free = ctx.level <= 2, total = model.count(N);
    const board = new THREE.Group(); board.position.set(0, 2.5, 0); board.rotation.x = 0.95; group.add(board);
    const geos = [], G = (g) => { geos.push(g); return g; }, add = (geo, material, x, y, z, parent = board) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const gold = new THREE.Color('#ffc94d'), coral = new THREE.Color('#ff7a6b'), LIGHT = '#f3efe6', DARK = '#3a3f45';
    // square materials: [plain, attacked (soft gold), on a line of conflict (soft coral)] for light and dark squares
    const M = [LIGHT, DARK].map((c) => [ctx.mat(c, { roughness: 0.35 }), ctx.mat(c, { roughness: 0.35, emissive: gold, emissiveIntensity: c === LIGHT ? 0.3 : 0.45 }), ctx.mat(c, { roughness: 0.35, emissive: coral, emissiveIntensity: c === LIGHT ? 0.45 : 0.7 })]);
    const qGold = ctx.lit('#ffc94d', 0.45, { metalness: 0.4 }), qBad = ctx.lit('#ff7a6b', 0.7);
    const X = (c) => (c - (N - 1) / 2) * cell, Z = (r) => ((N - 1) / 2 - r) * cell;          // row 1 is nearest the viewer
    add(G(new THREE.BoxGeometry(4.9, 0.2, 4.9)), ctx.mat('#23272b', { roughness: 0.3, metalness: 0.2 }), 0, -0.13, 0);
    add(G(new THREE.CylinderGeometry(0.16, 0.22, 2.5, 12)), ctx.mat('#868e96', { metalness: 0.4, roughness: 0.4 }), 0, 1.25, -0.25, group);
    add(G(new THREE.CylinderGeometry(0.7, 0.95, 0.3, 20)), ctx.mat('#868e96', { metalness: 0.4, roughness: 0.4 }), 0, 0.15, -0.25, group);
    const sqGeo = G(new THREE.BoxGeometry(cell * 0.98, 0.12, cell * 0.98)), squares = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const m = add(sqGeo, M[(r + c) % 2 ? 0 : 1][0], X(c), 0, Z(r)); m.receiveShadow = true; squares.push(m); }
    // a pool of N queens, each a few simple shapes
    const qGeo = [[G(new THREE.CylinderGeometry(0.34, 0.38, 0.14, 16)), 0.07], [G(new THREE.CylinderGeometry(0.12, 0.3, 0.6, 14)), 0.44], [G(new THREE.CylinderGeometry(0.27, 0.14, 0.18, 10)), 0.83], [G(new THREE.SphereGeometry(0.1, 12, 8)), 0.98]];
    const pool = Array.from({ length: N }, () => { const g = new THREE.Group(); g.scale.setScalar(cell); g.visible = false; for (const [geo, y] of qGeo) add(geo, qGold, 0, y, 0, g).castShadow = true; board.add(g); return g; });
    const cursor = add(G(new THREE.TorusGeometry(cell * 0.66, cell * 0.045, 6, 4)), ctx.lit('#ffe08a', 1.4), 0, 0.1, 0); cursor.rotation.set(Math.PI / 2, 0, Math.PI / 4);

    let qs = [], bad = new Set(), cr = 0, cc = 0, hint = false, hintUsed = false, lifts = 0, solved = false, queue = [], wait = 0;
    const name = (q) => 'abcdefgh'[q[1]] + (q[0] + 1), plural = (n) => `${n} ${n === 1 ? 'pair' : 'pairs'}`;
    const rSq = ui.readout('Selected square'), rQ = ui.readout('Queens placed'), rC = ui.readout('Pairs in conflict'), rS = ui.readout(`Solutions on a ${N} × ${N} board`);
    const moveCursor = () => { cursor.position.set(X(cc), 0.1, Z(cr)); rSq.set(name([cr, cc])); };
    const colS = ui.slider({ label: 'Column (a, b, c … from the left)', min: 1, max: N, step: 1, value: 1, unit: '', onInput: (v) => { cc = Math.max(0, Math.min(N - 1, Math.round(v) - 1)); moveCursor(); } });
    const rowS = ui.slider({ label: 'Row (1 is nearest to you)', min: 1, max: N, step: 1, value: 1, unit: '', onInput: (v) => { cr = Math.max(0, Math.min(N - 1, Math.round(v) - 1)); moveCursor(); } });
    // Redraws the board from the list of queens and returns the pairs in conflict.
    const refresh = () => {
      const pairs = model.pairs(qs), seen = model.attacked(qs, N), line = new Uint8Array(N * N), taken = new Uint8Array(N * N);
      bad = new Set(pairs.flat());
      for (const [i, j] of pairs) { const a = qs[i], b = qs[j], dr = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]); for (let r = a[0], c = a[1]; ; r += dr, c += dc) { line[r * N + c] = 1; if (r === b[0] && c === b[1]) break; } }
      for (const q of qs) taken[q[0] * N + q[1]] = 1;
      for (let i = 0; i < N * N; i++) squares[i].material = M[(Math.floor(i / N) + i % N) % 2 ? 0 : 1][line[i] ? 2 : (free || hint) && seen[i] && !taken[i] ? 1 : 0];
      pool.forEach((g, i) => { g.visible = i < qs.length; if (!g.visible) return; g.position.x = X(qs[i][1]); g.position.z = Z(qs[i][0]); const mt = bad.has(i) ? qBad : qGold; for (const m of g.children) m.material = mt; });
      rQ.set(`${qs.length} of ${N}`); rC.set(String(pairs.length)); rS.set(String(total));
      return { pairs, seen, taken };
    };
    // Places a queen on the selected square, or lifts the one standing there. The player and autoplay both use this.
    const toggle = () => {
      const at = qs.findIndex((q) => q[0] === cr && q[1] === cc);
      if (at < 0 && qs.length >= N) { ctx.say(`All ${N} queens are already on the board. Choose a queen that is wobbling, lift it, and then try a new square for it.`); return; }
      if (at >= 0) { qs.splice(at, 1); lifts++; } else { qs.push([cr, cc]); pool[qs.length - 1].position.y = 0.06 + cell * 0.9; }
      const { pairs, seen, taken } = refresh(), p = pairs.length, q = qs.length, last = qs[q - 1];
      if (q < N || p) solved = false;
      if (at >= 0) { ctx.say(p ? `Lifted. ${plural(p)} of queens can still see each other, so keep going.` : 'Lifted. Taking a queen back and trying its next square is called backtracking. Careful thinkers do it all the time.'); return; }
      const clash = pairs.find(([, j]) => j === q - 1);
      if (q === N && !p) {
        solved = true;
        ctx.say(`Peace! ${N} queens, and no two share a row, a column or a diagonal. There are exactly ${total} ways to do this on a ${N} × ${N} board${N === 6 ? ', only 4, which is why this board is so tricky' : ''}.`);
        ctx.complete(hintUsed ? 0.75 : 1, `N=${N}, lifts=${lifts}, hint=${hintUsed}`);
      } else if (clash) { const o = qs[clash[0]]; ctx.say(`The queens on ${name(o)} and ${name(last)} share a ${model.sees(o, last)}, so they can see each other. Lift one and try the next square along.`); }
      else if (p) ctx.say(`${plural(p)} of queens can still see each other (they wobble). Fix those before you add more.`);
      else if (!seen.some((v, i) => !v && !taken[i])) ctx.say(`A dead end: every free square is now seen by a queen, but you need ${N - q} more. Go back to your last queen and move it one square. That is backtracking.`);
      else ctx.say(`Peaceful so far: ${q} of ${N}. Every row and every column can hold only one queen, so put the next one in an empty row and an empty column, then check its diagonals.`);
    };
    const clear = () => { qs = []; solved = false; refresh(); };
    ui.button('♛ Place / lift queen', () => { queue = []; toggle(); }, 'btn');
    ui.button('Clear', () => { queue = []; clear(); ctx.say('A clean board. Work in order this time: one queen in row 1, then row 2, and so on.'); });
    if (!free) ui.choice([['off', 'Hint off'], ['on', 'Hint: show attacked squares']], 'off', (v) => { hint = v === 'on'; if (hint) hintUsed = true; refresh(); if (hint) ctx.say('The golden squares are the ones a queen can already see. A safe square is one that does not glow. Using the hint lowers your score a little.'); });
    ui.note(free ? 'A queen sees along her row, her column and both diagonals. Golden squares are already seen by a queen; red lines join queens that can see each other.' : 'A queen sees along her row, her column and both diagonals. Red lines join queens that can see each other.');
    moveCursor(); refresh();
    ctx.say(`Place ${N} queens so that none can see another. First idea: one queen in each row and each column. Then fix the diagonals. Work in order, and when you get stuck, go back one step.`);
    return {
      step(dt) {
        if (!queue.length) return;
        wait -= dt; if (wait > 0) return;
        const [r, c] = queue.shift(); cr = r; cc = c; rowS.set(r + 1); colS.set(c + 1); cr = r; cc = c; moveCursor(); toggle(); wait = 0.7;
      },
      frame(dt, time) {
        const f = Math.min(1, dt * 10);
        pool.forEach((g, i) => { if (!g.visible) return; g.position.y += (0.06 - g.position.y) * f; const w = bad.has(i) && !ctx.calm ? Math.sin(time * 9 + i) * 0.16 : 0; g.rotation.z += (w - g.rotation.z) * Math.min(1, dt * 14); });
        cursor.scale.setScalar(ctx.calm ? 1 : 1 + Math.sin(time * 4) * 0.04);
      },
      // Shows a successful run without the player (used by tests): the first solution the search finds, one queen at a time.
      autoplay() { clear(); queue = model.first(N).map((q) => [...q]); wait = 0.3; },
      dispose() { for (const g of geos) g.dispose(); },
      get solved() { return solved; },
    };
  },
};

export default {
  id: 13,
  theme: {
    sky: ['#c9d2dc', '#e6ebf0', '#fff1d6'], fog: '#e3e8ee', fogNear: 55, fogFar: 185,
    ground: '#ddd7ca', ground2: '#cbc4b4', side: '#868e96', stone: '#ece7dc', accent: '#343a40', glow: '#ffc94d', metal: '#3b4046', wood: '#5a3d2b', leaf: '#3f8f5a', water: '#8fc7e8', crate: '#c9a36a',
    sun: '#fff4dc', sunPower: 2.0, ambient: 1.15, skyLight: '#f1f5fa', groundLight: '#aaa396', sunDir: [-0.45, 1, 0.3], particles: 'dust',
  },
  layout: { shape: 'zigzag', mirror: -1, stones: 5, rise: 0.4, towerH: 6 },
  story: {
    title: 'The Grandmaster Arena',
    crystal: 'golden pawns', crystalEm: '♟️',
    intro: ['Welcome to the Grandmaster Arena! This morning a gust of wind swept across the great marble board.', 'Five golden pawns rolled away over the courtyard, and now the queens are squabbling because each one can see another. Will you help me bring back the peace?'],
    remind: 'The golden pawns shine like little lamps. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five golden pawns! Now ride the lift from the tower to the tilted board and give every queen a square of her own.',
    afterSim: 'The queens are at peace. Only the Grandmaster is left to face, and the arena is up the steps.',
    notReady: 'A good player gets ready first. Bring all five golden pawns and settle the queens, then come to the arena.',
    rival: ['So you calmed the queens. That takes patience. Now let us see how well you think ahead.', 'We each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge is finished before mine. You thought before you moved. Well played, and the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Every player loses sometimes. Read the tablets again, then come back for another game.'],
    outro: 'The golden pawns are home, the queens are at peace, and the Grandmaster has shaken your hand. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, m = S.sim[0] < 0 ? -1 : 1;
    const ivory = k.mat('#f4efe3', { roughness: 0.35 }), ebony = k.mat('#2b2f34', { roughness: 0.3, metalness: 0.15 }), gilt = k.lit('#ffc94d', 0.5, { metalness: 0.5 });
    // giant chess pieces: a base, a tapering body and a top that tells you which piece it is
    const tops = {
      pawn: [0.8, 0.16, (P) => P(new THREE.SphereGeometry(0.27, 16, 12), 1.2)],
      rook: [1.1, 0.34, (P) => P(new THREE.CylinderGeometry(0.46, 0.4, 0.36, 8), 1.5)],
      knight: [0.9, 0.24, (P) => { P(new THREE.BoxGeometry(0.34, 0.5, 0.8), 1.36, 0.12).rotation.x = 0.5; P(new THREE.ConeGeometry(0.1, 0.3, 4), 1.74, -0.12); }],
      bishop: [1.2, 0.14, (P) => { P(new THREE.SphereGeometry(0.26, 16, 12), 1.6).scale.y = 1.4; P(new THREE.SphereGeometry(0.08, 10, 8), 2.03); }],
      queen: [1.5, 0.16, (P) => { P(new THREE.CylinderGeometry(0.36, 0.2, 0.34, 10), 1.86); P(new THREE.SphereGeometry(0.13, 12, 8), 2.13, 0, gilt); }],
      king: [1.6, 0.18, (P) => { P(new THREE.CylinderGeometry(0.34, 0.22, 0.36, 10), 1.98); P(new THREE.BoxGeometry(0.1, 0.46, 0.1), 2.38, 0, gilt); P(new THREE.BoxGeometry(0.34, 0.1, 0.1), 2.42, 0, gilt); }],
    };
    const piece = (kind, x, y, z, { s = 1.6, dark = false, yaw = 0 } = {}) => {
      const g = k.add(new THREE.Group()), [h, top, crown] = tops[kind], body = dark ? ebony : ivory; g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s);
      const P = (geo, py, pz = 0, material = body) => k.mesh(geo, material, 0, py, pz, g);
      P(new THREE.CylinderGeometry(0.5, 0.58, 0.22, 20), 0.11); P(new THREE.CylinderGeometry(top, 0.42, h, 16), 0.22 + h / 2); crown(P);
      const hard = { type: 'cyl', x, z, r: 0.58 * s, y0: y, y1: y + (h + 0.6) * s }; k.level.solids.push(hard); k.physics.addSolid(hard);
      return g;
    };
    // the home courtyard: a chequered floor, the king and queen behind the start, a rook and a bishop at the sides
    const tile = new THREE.PlaneGeometry(2, 2), flat = (geo, material, x, y, z) => { const t = k.mesh(geo, material, x, y, z); t.rotation.x = -Math.PI / 2; t.castShadow = false; return t; };
    flat(new THREE.PlaneGeometry(6, 6), k.mat('#343a40', { roughness: 0.4 }), 0, 0.02, 0);
    for (const [x, z] of [[0, 2], [0, -2], [2, 0], [-2, 0]]) flat(tile, k.mat('#f7f3ea', { roughness: 0.4 }), x, 0.035, z);
    piece('king', -3.5 * m, 0, -7.5, { dark: true }); piece('queen', 6.2 * m, 0, -5.6, { yaw: 0.4 });
    piece('rook', -8 * m, 0, -1.5, { s: 1.5 }); piece('bishop', 8 * m, 0, 3.2, { s: 1.4, dark: true });
    k.prop('lamp', 4, 0, 7.4); k.prop('lamp', -4, 0, 7.4);
    const hedge = (x, y, z, yaw) => { const g = k.prop('bush', x, y, z, { yaw, color: '#3f8f5a' }); g.scale.set(1.8, 1.15, 0.95); return g; };
    hedge(7.3 * m, 0, 5.1, 0.9 * m);
    // the middle island: a knight on guard, a hedge, a lamp and a giant chess clock whose two hands take turns to tick
    const mid = S.mid;
    piece('knight', -4.9 * m, mid[1], mid[2] + 0.3, { s: 1.5, yaw: 1.2 * m });
    hedge(2.6 * m, mid[1], mid[2] - 5.2, 0.45 * m); k.prop('lamp', -2.8 * m, mid[1], mid[2] + 5.2);
    const clock = k.add(new THREE.Group()); clock.position.set(4.2 * m, mid[1], mid[2] - 3.4); clock.rotation.y = Math.atan2(-4.2 * m, 3.4);
    k.mesh(new THREE.BoxGeometry(2.2, 1.3, 0.7), ebony, 0, 0.65, 0, clock);
    const rocker = k.mesh(new THREE.BoxGeometry(1.5, 0.1, 0.3), gilt, 0, 1.37, 0, clock), handGeo = new THREE.BoxGeometry(0.05, 0.34, 0.03); handGeo.translate(0, 0.15, 0);
    const hands = [-0.55, 0.55].map((x) => { k.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), ivory, x, 0.7, 0.36, clock).rotation.x = Math.PI / 2; const hand = k.mesh(handGeo, k.mat('#343a40'), x, 0.7, 0.4, clock); hand.castShadow = false; return hand; });
    const turned = [0, 0]; let lastTick = -1;
    k.animate((dt, t) => {
      const sec = Math.floor(t), side = Math.floor(sec / 6) % 2, f = Math.min(1, dt * 18);
      if (sec !== lastTick) { lastTick = sec; turned[side] += Math.PI / 30; }
      hands.forEach((hand, i) => { hand.rotation.z += (-turned[i] - hand.rotation.z) * f; });
      rocker.rotation.z += ((side ? -0.09 : 0.09) - rocker.rotation.z) * Math.min(1, dt * 8);
    });
    // two pawns guard the tower ladder
    piece('pawn', -3.7, S.far[1], S.far[2] - 0.3, { s: 1.3 }); piece('pawn', 3.7, S.far[1], S.far[2] - 0.3, { s: 1.3, dark: true });
    // banners frame the steps behind the tilted board; hedges line the far rim of that island
    k.prop('banner', S.sim[0] - 3.4, S.sim[1], S.sim[2] + 6.2, { color: '#e0b040' }); k.prop('banner', S.sim[0] + 3.4, S.sim[1], S.sim[2] + 6.2);
    hedge(S.sim[0] + 6.6 * m, S.sim[1], S.sim[2] - 0.8, Math.PI / 2); hedge(S.sim[0] + 6.2 * m, S.sim[1], S.sim[2] - 2.7, Math.PI / 2 + 0.35 * m);
    // the arena: warm lamps beside the steps and a hedge at each side
    for (const sx of [-1, 1]) { k.prop('lamp', S.arena[0] + sx * 4.3, S.arena[1], S.arena[2] - 4.2); hedge(S.arena[0] + sx * 6.1, S.arena[1], S.arena[2] + 0.4, Math.PI / 2); }
  },
  sim,
};
