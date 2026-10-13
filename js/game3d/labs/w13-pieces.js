// World 13 lab — Piece Trails, in 3D: one chess piece hops across a real board to a spinning star.
// No imports: the move rules below are the chess lab's own move generator (js/labs/w13-chess.js), copied here.

const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]; // 4 diagonal, then 4 straight
const other = (c) => (c === 'w' ? 'b' : 'w');
export const sqName = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 3));   // squares are 0..63 with 0 = a8 and 63 = h1

// Is square s attacked by any piece of colour `by`?
function attacked(b, s, by) {
  const r = s >> 3, c = s & 7, W = by === 'w';
  const pr = r + (W ? 1 : -1), P = W ? 'P' : 'p';
  if (pr >= 0 && pr < 8) {
    if (c > 0 && b[pr * 8 + c - 1] === P) return true;
    if (c < 7 && b[pr * 8 + c + 1] === P) return true;
  }
  const N = W ? 'N' : 'n', K = W ? 'K' : 'k', B = W ? 'B' : 'b', R = W ? 'R' : 'r', Q = W ? 'Q' : 'q';
  for (let i = 0; i < 8; i++) {
    let rr = r + KN[i][0], cc = c + KN[i][1];
    if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === N) return true;
    const dr = KG[i][0], dc = KG[i][1], line = i < 4 ? B : R;
    rr = r + dr; cc = c + dc;
    if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === K) return true;
    while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
      const p = b[rr * 8 + cc];
      if (p) { if (p === Q || p === line) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

// All moves that obey how the pieces move, before checking that the mover's own king is safe.
export function pseudoMoves(pos, capsOnly = false) {
  const { b, turn } = pos, W = turn === 'w', out = [];
  const add = (from, to, cap, promo, flag) => out.push({ from, to, piece: b[from], cap: cap || null, promo: promo || null, flag: flag || '' });
  const addPawn = (from, to, cap, flag) => {
    if ((to >> 3) === (W ? 0 : 7)) for (const pr of W ? 'QRBN' : 'qrbn') add(from, to, cap, pr, flag);
    else add(from, to, cap, null, flag);
  };
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p || (p < 'a') !== W) continue;
    const r = s >> 3, c = s & 7, t = p.toLowerCase();
    if (t === 'p') {
      const d = W ? -1 : 1, r1 = r + d;
      if (r1 < 0 || r1 > 7) continue;
      const one = r1 * 8 + c;
      if (!b[one]) {
        if (!capsOnly || r1 === (W ? 0 : 7)) addPawn(s, one, null, '');
        if (!capsOnly && r === (W ? 6 : 1) && !b[one + d * 8]) add(s, one + d * 8, null, null, 'dp');
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (cc < 0 || cc > 7) continue;
        const to = r1 * 8 + cc, q = b[to];
        if (q) { if ((q < 'a') !== W) addPawn(s, to, q, ''); }
        else if (to === pos.ep) add(s, to, W ? 'p' : 'P', null, 'ep');
      }
    } else if (t === 'n' || t === 'k') {
      for (const [dr, dc] of t === 'n' ? KN : KG) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const q = b[rr * 8 + cc];
        if (q ? (q < 'a') !== W : !capsOnly) add(s, rr * 8 + cc, q);
      }
    } else {
      const lo = t === 'r' ? 4 : 0, hi = t === 'b' ? 4 : 8;
      for (let i = lo; i < hi; i++) {
        const dr = KG[i][0], dc = KG[i][1];
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const q = b[rr * 8 + cc];
          if (q) { if ((q < 'a') !== W) add(s, rr * 8 + cc, q); break; }
          if (!capsOnly) add(s, rr * 8 + cc, null);
          rr += dr; cc += dc;
        }
      }
    }
  }
  if (!capsOnly && pos.castle) { // castling: king and rook unmoved, empty between, king never on an attacked square
    const k = W ? 60 : 4, e = other(turn), R = W ? 'R' : 'r';
    if (b[k] === (W ? 'K' : 'k')) {
      if (pos.castle.includes(W ? 'K' : 'k') && b[k + 3] === R && !b[k + 1] && !b[k + 2]
        && !attacked(b, k, e) && !attacked(b, k + 1, e) && !attacked(b, k + 2, e)) add(k, k + 2, null, null, 'ck');
      if (pos.castle.includes(W ? 'Q' : 'q') && b[k - 4] === R && !b[k - 1] && !b[k - 2] && !b[k - 3]
        && !attacked(b, k, e) && !attacked(b, k - 1, e) && !attacked(b, k - 2, e)) add(k, k - 2, null, null, 'cq');
    }
  }
  return out;
}

const NAME = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
const WHY = {
  r: 'The rook slides in straight lines: up, down and sideways, as far as it likes.',
  b: 'The bishop slides on diagonals, so it always stays on the same colour of square.',
  q: 'The queen moves like a rook and a bishop together. She is the strongest piece.',
  k: 'The king takes just one step at a time, in any direction.',
  n: 'The knight jumps in an L shape: two squares one way, then one to the side. It lands on the other colour every time.',
  p: 'The pawn only walks straight forward. On its very first move it may take two steps.',
};
const TARGET = 4; // stars to collect

// Moves of a lone white piece on an otherwise empty board (promotion choices collapsed to one square each).
export function reach(piece, sq) {
  const b = Array(64).fill(null);
  b[sq] = piece.toUpperCase();
  const seen = new Set();
  for (const m of pseudoMoves({ b, turn: 'w', castle: '', ep: -1, half: 0, full: 1 })) seen.add(m.to);
  return [...seen];
}
// Fewest moves from every square reachable from `from` (breadth-first search).
export function distances(piece, from) {
  const dist = new Map([[from, 0]]);
  let frontier = [from];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) for (const to of reach(piece, s)) if (!dist.has(to)) { dist.set(to, dist.get(s) + 1); next.push(to); }
    frontier = next;
  }
  return dist;
}

// Model check against values counted by hand on an empty board (a1 = 56, h8 = 7, d4 = 35, b3 = 41, e2 = 52, e3 = 44, e7 = 12).
export function selfTest() {
  const n = (p, s) => reach(p, s).length, far = (p, a, b) => distances(p, a).get(b);
  const got = [n('r', 56), n('r', 35), n('b', 56), n('b', 35), n('q', 35), n('k', 56), n('k', 35), n('n', 56), n('n', 35), n('p', 52), n('p', 44), n('p', 12)];
  const want = [14, 14, 7, 13, 27, 3, 8, 2, 8, 2, 1, 1];
  const hops = [far('n', 56, 7), far('k', 56, 7), far('r', 56, 7), far('b', 56, 7), far('q', 56, 41), far('p', 52, 12)], wantHops = [6, 7, 2, 1, 2, 4];
  const colour = distances('b', 56).size === 32 && !distances('b', 56).has(57);                 // a bishop never leaves its colour
  const knightFlip = reach('n', 35).every((s) => ((s >> 3) + (s & 7)) % 2 !== ((35 >> 3) + (35 & 7)) % 2);
  return { ok: got.join() === want.join() && hops.join() === wantHops.join() && colour && knightFlip,
    detail: `squares reached in one move: ${got.join(', ')} (expected ${want.join(', ')}); fewest hops: ${hops.join(', ')} (expected ${wantHops.join(', ')}); bishop keeps its colour: ${colour}; knight changes colour: ${knightFlip}` };
}

// Turned shapes: each piece is a profile [radius, height] spun around its centre line (sizes in squares).
const PROFILE = {
  p: [[0, 0], [0.3, 0], [0.3, 0.06], [0.22, 0.1], [0.12, 0.16], [0.09, 0.36], [0.16, 0.4], [0.09, 0.44], [0.14, 0.5], [0.15, 0.57], [0.1, 0.65], [0, 0.68]],
  r: [[0, 0], [0.34, 0], [0.34, 0.07], [0.24, 0.12], [0.19, 0.5], [0.27, 0.56], [0.27, 0.76], [0.18, 0.76], [0.18, 0.67], [0, 0.67]],
  n: [[0, 0], [0.33, 0], [0.33, 0.07], [0.23, 0.12], [0.15, 0.3], [0.18, 0.35], [0, 0.35]],
  b: [[0, 0], [0.34, 0], [0.34, 0.07], [0.22, 0.12], [0.11, 0.5], [0.19, 0.55], [0.1, 0.6], [0.16, 0.72], [0.11, 0.86], [0.03, 0.92], [0.06, 0.96], [0, 1]],
  q: [[0, 0], [0.36, 0], [0.36, 0.08], [0.24, 0.14], [0.12, 0.62], [0.21, 0.68], [0.12, 0.74], [0.23, 0.96], [0.14, 0.94], [0.06, 1], [0.08, 1.06], [0, 1.1]],
  k: [[0, 0], [0.36, 0], [0.36, 0.08], [0.25, 0.14], [0.13, 0.66], [0.22, 0.72], [0.13, 0.78], [0.21, 1], [0.21, 1.04], [0.05, 1.06], [0, 1.06]],
};

export default {
  id: 'w13-pieces',
  world: 13,
  levels: [1, 2],
  title: 'Piece Trails',
  goal: 'Guess how many hops, then move the chess piece to the star.',
  kind: 'validated',
  model: 'One piece on an empty board, moving exactly as the rules of chess say. The fewest hops are found by trying every route. In a real game other pieces get in the way, pawns capture diagonally, and the king may not step into danger.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, T = ctx.t || ((x) => x), onTap = ctx.onTap || (() => {}), rng = ctx.rng || Math.random;
    const lvl = ctx.level <= 1 ? 1 : 2;
    const kinds = lvl === 1 ? ['r', 'b', 'k', 'q'] : ['r', 'b', 'q', 'k', 'n', 'p'];
    const cell = 0.55, Y0 = 0.05, geos = [], G = (g) => { geos.push(g); return g; };
    const add = (geo, material, x, y, z, parent) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const pickInt = (k) => Math.floor(rng() * k);

    // ---------- the scene: a board on a stand, tipped towards the viewer ----------
    const board = new THREE.Group(); board.position.set(0, 1.95, 0); board.rotation.x = 0.55; group.add(board);
    const steel = ctx.mat('#868e96', { metalness: 0.4, roughness: 0.4 });
    add(G(new THREE.CylinderGeometry(0.16, 0.24, 1.9, 12)), steel, 0, 0.95, -0.2, group);
    add(G(new THREE.CylinderGeometry(0.8, 1.05, 0.3, 20)), steel, 0, 0.15, -0.2, group);
    add(G(new THREE.BoxGeometry(4.7, 0.2, 4.7)), ctx.mat('#3b2a1e', { roughness: 0.5 }), 0, -0.11, 0, board).receiveShadow = true;
    const X = (s) => ((s & 7) - 3.5) * cell, Z = (s) => ((s >> 3) - 3.5) * cell;          // row 1 is nearest the viewer
    const gold = new THREE.Color('#ffc94d');
    const SQM = ['#ead9b5', '#8a6f52'].map((c) => [ctx.mat(c, { roughness: 0.45 }), ctx.mat(c, { roughness: 0.45, emissive: gold, emissiveIntensity: 0.75 })]);
    const sqGeo = G(new THREE.BoxGeometry(cell * 0.98, 0.1, cell * 0.98)), squares = [];
    for (let s = 0; s < 64; s++) { const m = add(sqGeo, SQM[((s >> 3) + (s & 7)) % 2][0], X(s), 0, Z(s), board); m.receiveShadow = true; squares.push(m); onTap(m, () => { auto = false; tap(s); }); }
    for (let i = 0; i < 8; i++) {
      const f = ctx.sprite('abcdefgh'[i], { size: 0.2 }); f.position.set((i - 3.5) * cell, 0.1, 2.29); board.add(f);
      const r = ctx.sprite(String(8 - i), { size: 0.2 }); r.position.set(-2.29, 0.1, (i - 3.5) * cell); board.add(r);
    }
    // green rings: where the piece may hop; the square ring: the square chosen with the sliders; small lights: the trail
    const ringGeo = G(new THREE.TorusGeometry(cell * 0.37, cell * 0.06, 6, 20)), green = ctx.lit('#51cf66', 1.3);
    const rings = Array.from({ length: 28 }, () => { const m = add(ringGeo, green, 0, Y0 + 0.03, 0, board); m.rotation.x = Math.PI / 2; m.visible = false; return m; });
    const cursor = add(G(new THREE.TorusGeometry(cell * 0.6, cell * 0.06, 6, 4)), ctx.lit('#ffe08a', 1.6), 0, Y0 + 0.05, 0, board); cursor.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    const dotGeo = G(new THREE.CylinderGeometry(cell * 0.14, cell * 0.14, 0.03, 12)), dotM = ctx.lit('#74c0fc', 1.2);
    const dots = Array.from({ length: 8 }, () => { const m = add(dotGeo, dotM, 0, Y0 + 0.02, 0, board); m.visible = false; return m; });
    // the star: a real five-pointed solid that spins above its square
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.45 : 1) * cell * 0.36; if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const starGeo = G(new THREE.ExtrudeGeometry(shape, { depth: cell * 0.14, bevelEnabled: false })); starGeo.translate(0, 0, -cell * 0.07);
    const starLit = ctx.lit('#ffc94d', 1.5), starOff = ctx.mat('#8d949c', { roughness: 0.5 });
    const starM = add(starGeo, starLit, 0, Y0 + 0.4, 0, board); starM.castShadow = true;
    // the rack of collected stars beside the board
    add(G(new THREE.CylinderGeometry(0.05, 0.07, 3.3, 10)), steel, 3.05, 1.65, 0.3, group);
    const rack = Array.from({ length: TARGET }, (_, i) => { const m = add(starGeo, starOff, 3.05, 1.0 + i * 0.72, 0.3, group); m.scale.setScalar(1.5); return m; });
    // the piece: one turned shape that changes with every star
    const LG = {}; for (const t in PROFILE) LG[t] = G(new THREE.LatheGeometry(PROFILE[t].map(([r, y]) => new THREE.Vector2(r * cell, y * cell)), 18));
    const ivory = ctx.mat('#fbf6ea', { roughness: 0.35 });
    const man = add(LG.r, ivory, 0, Y0, 0, board); man.castShadow = true; onTap(man, () => { auto = false; tap(at); });
    const head = add(G(new THREE.BoxGeometry(0.2 * cell, 0.46 * cell, 0.3 * cell)), ivory, 0, 0.55 * cell, 0, man); head.rotation.x = 0.3;
    const nose = add(G(new THREE.BoxGeometry(0.18 * cell, 0.17 * cell, 0.3 * cell)), ivory, 0, 0.68 * cell, -0.18 * cell, man);
    const crossV = add(G(new THREE.BoxGeometry(0.07 * cell, 0.26 * cell, 0.07 * cell)), ivory, 0, 1.18 * cell, 0, man), crossH = add(G(new THREE.BoxGeometry(0.2 * cell, 0.07 * cell, 0.07 * cell)), ivory, 0, 1.2 * cell, 0, man);
    const titles = {};
    const showTitle = () => {
      if (!titles[piece]) { const s = ctx.sprite(T(NAME[piece]) + ' → ⭐', { size: 0.5, bg: 'rgba(14,18,48,.72)' }); s.position.set(0, 4.45, -1.9); group.add(s); titles[piece] = s; }
      for (const k in titles) titles[k].visible = k === piece;
    };

    // ---------- the game (the same rounds as the flat lab) ----------
    let piece = 'r', at = 0, star = -1, best = 0, hops = 0, guess = 0, shown = false, stars = 0, rightGuesses = 0, extraHops = 0, done = false, lastKind = '';
    let trail = [], between = 0, auto = false, wait = 0, cr = 7, cc = 0;
    const glide = { a: new THREE.Vector3(), b: new THREE.Vector3(), k: 1, lift: 0 }; let cheer = 0;
    const rPiece = ui.readout('Piece'), rStars = ui.readout('Stars'), rHops = ui.readout('Hops'), rBest = ui.readout('Fewest hops possible');
    const cursorSq = () => cr * 8 + cc;
    const moveCursor = () => { cursor.position.set(X(cursorSq()), Y0 + 0.05, Z(cursorSq())); };

    function render() {
      const moves = shown ? reach(piece, at) : [];
      rings.forEach((m, i) => { m.visible = i < moves.length; if (m.visible) m.position.set(X(moves[i]), Y0 + 0.03, Z(moves[i])); });
      for (let s = 0; s < 64; s++) squares[s].material = SQM[((s >> 3) + (s & 7)) % 2][s === star ? 1 : 0];
      dots.forEach((m, i) => { m.visible = i < trail.length; if (m.visible) m.position.set(X(trail[i]), Y0 + 0.02, Z(trail[i])); });
      starM.visible = star >= 0; if (star >= 0) { starM.position.x = X(star); starM.position.z = Z(star); }
      rack.forEach((m, i) => { m.material = i < stars ? starLit : starOff; });
      rPiece.set(T(NAME[piece])); rStars.set(Math.min(stars, TARGET) + ' / ' + TARGET); rHops.set(String(hops));
    }
    function setPiece(t) {
      piece = t; man.geometry = LG[t];
      head.visible = nose.visible = t === 'n'; crossV.visible = crossH.visible = t === 'k';
      showTitle();
    }
    function moveMan(s, snap) {
      glide.a.copy(man.position); glide.b.set(X(s), Y0, Z(s)); glide.k = snap ? 1 : 0; glide.lift = (piece === 'n' ? 1.0 : 0.3) * cell;
      if (snap) man.position.copy(glide.b);
    }

    function newRound() {
      let t;
      do { t = kinds[pickInt(kinds.length)]; } while (kinds.length > 1 && t === lastKind);
      lastKind = t; setPiece(t);
      const maxHops = lvl === 1 ? 2 : 3;
      for (;;) {
        at = piece === 'p' ? 48 + pickInt(8) : pickInt(64); // pawns start on their home row
        const far = [...distances(piece, at)].filter(([s, d]) => d >= 1 && d <= maxHops && (piece !== 'p' || s >= 16));
        if (!far.length) continue;
        const wantTwo = rng() < 0.55, pool = far.filter(([, d]) => (wantTwo ? d >= 2 : d === 1));
        [star, best] = (pool.length ? pool : far)[pickInt(pool.length || far.length)];
        break;
      }
      hops = 0; guess = 0; shown = false; trail = []; between = 0;
      guessC.set?.(0);
      rBest.set('?');
      moveMan(at, true); render();
    }

    function setGuess(v) {
      if (!v || between > 0) return;
      if (guess) { ctx.say('Your guess for this star is already made. Now hop to the star and see if you were right.'); return; }
      guess = v; shown = true;
      ctx.say('Now tap a square with a green ring! The rings show every square this piece may hop to.');
      render();
    }

    function tap(s) {
      if (between > 0) return;
      if (!guess) { ctx.say('Guess first: how many hops to the star?'); return; }
      if (s === at) { ctx.say(WHY[piece]); return; }
      if (!reach(piece, at).includes(s)) { ctx.say(WHY[piece] + ' That square has no green ring, so the piece cannot hop there.'); return; }
      if (trail.length < dots.length) trail.push(at);
      at = s; hops++; moveMan(s, false);
      if (at !== star) {
        if (!reach(piece, at).length || !distances(piece, at).has(star)) { ctx.say('The star is out of reach from here. Let us try a new one!'); newRound(); return; }
        render(); return;
      }
      stars++; extraHops += hops - best;
      const good = lvl === 1 ? (guess === 1) === (best === 1) : guess === best;
      if (good) rightGuesses++;
      rBest.set(String(best));
      ctx.say((good ? 'Your guess was right! ' : `The fewest hops were ${best}. `) + WHY[piece] + (hops > best ? ' It can be done in fewer hops. Look for the shortest trail next time.' : ''));
      star = -1; shown = false; cheer = 1.2; between = 2.2; render();
      if (stars >= TARGET && !done) {
        done = true;
        const score = Math.max(0.4, Math.min(1, 0.5 + 0.5 * rightGuesses / TARGET - 0.05 * extraHops));
        ctx.complete(score, 'Moved chess pieces to the star using each piece\'s own way of moving.');
      }
    }

    // ---------- the panel ----------
    const guessC = ui.choice([[0, 'How many hops?'], [1, '1'], [2, lvl === 1 ? '2 or more' : '2'], ...(lvl === 1 ? [] : [[3, '3']])], 0, (v) => setGuess(v));
    const colS = ui.slider({ label: 'Column (a, b, c … from the left)', min: 1, max: 8, step: 1, value: 1, unit: '', onInput: (v) => { cc = Math.max(0, Math.min(7, Math.round(v) - 1)); moveCursor(); } });
    const rowS = ui.slider({ label: 'Row (1 is nearest to you)', min: 1, max: 8, step: 1, value: 1, unit: '', onInput: (v) => { cr = 8 - Math.max(1, Math.min(8, Math.round(v))); moveCursor(); } });
    ui.button('Hop to the marked square', () => { auto = false; tap(cursorSq()); }, 'btn');
    ui.button('Next star', () => { auto = false; newRound(); });
    ui.note('Tap a square on the board, or mark one with the two sliders and press the hop button. Collect 4 stars.');
    moveCursor(); newRound();
    ctx.say('Each chess piece moves in its own way. Guess the number of hops, then follow the green rings to the star.');

    return {
      step(dt) {
        if (between > 0) { between -= dt; if (between <= 0) newRound(); return; }
        if (!auto) return;
        wait -= dt; if (wait > 0) return;
        wait = 0.75;
        if (!guess) { const g = lvl === 1 ? Math.min(2, best) : best; guessC.set?.(g); if (!guess) setGuess(g); return; }
        // the shortest trail: hop to the square from which the star is nearest
        let to = -1, low = Infinity;
        for (const s of reach(piece, at)) { const d = s === star ? 0 : distances(piece, s).get(star); if (d != null && d < low) { low = d; to = s; } }
        if (to < 0) { newRound(); return; }
        colS.set((to & 7) + 1); rowS.set(8 - (to >> 3)); tap(cursorSq());
      },
      frame(dt, time) {
        if (glide.k < 1) {
          glide.k = Math.min(1, glide.k + dt / (ctx.calm ? 0.7 : 0.45));
          const e = glide.k * glide.k * (3 - 2 * glide.k);
          man.position.lerpVectors(glide.a, glide.b, e);
          man.position.y = Y0 + (ctx.calm ? 0.3 : 1) * glide.lift * Math.sin(Math.PI * e);
        }
        cheer = Math.max(0, cheer - dt);
        man.rotation.y = cheer > 0 && !ctx.calm ? (1.2 - cheer) * 10 : 0;
        if (!ctx.calm) { starM.rotation.y = time * 2; starM.position.y = Y0 + 0.42 + Math.sin(time * 3) * 0.05; rack.forEach((m, i) => { m.rotation.y = i < stars ? time * 1.5 + i : 0; }); }
        cursor.scale.setScalar(ctx.calm ? 1 : 1 + Math.sin(time * 4) * 0.04);
      },
      // Collects the stars the way a player does: make the guess, then mark each square with the sliders and hop.
      autoplay() { auto = true; wait = 0.4; },
      dispose() { auto = false; for (const g of geos) g.dispose(); for (const k in titles) { titles[k].material?.map?.dispose?.(); titles[k].material?.dispose?.(); } },
    };
  },
};
