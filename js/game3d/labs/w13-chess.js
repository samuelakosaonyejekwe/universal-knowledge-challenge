// World 13 lab — Chess Board, in 3D: a real board with turned pieces that glide, and a computer opponent.
// No imports: the rules engine below is the same one the flat lab uses (js/labs/w13-chess.js), copied here.

// =====================================================================================
// Rules engine — pure functions. Squares are 0..63 with 0 = a8 and 63 = h1.
// A position is { b: [64 piece letters or null], turn: 'w'|'b', castle: 'KQkq' subset,
// ep: en-passant target square or -1, half: half-move clock, full: move number }.
// =====================================================================================
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]; // 4 diagonal, then 4 straight
const RIGHTS = { 60: 'KQ', 4: 'kq', 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };
const other = (c) => (c === 'w' ? 'b' : 'w');
export const sideOf = (p) => (p < 'a' ? 'w' : 'b');
export const sqName = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 3));
export const sqOf = (n) => (8 - +n[1]) * 8 + n.charCodeAt(0) - 97;

export function fromFen(fen) {
  const [rows, turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const b = [];
  for (const ch of rows) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') for (let i = 0; i < +ch; i++) b.push(null); else b.push(ch);
  }
  return { b, turn, castle: castle === '-' ? '' : castle, ep: ep === '-' ? -1 : sqOf(ep), half: +half, full: +full };
}

// Is square s attacked by any piece of colour `by`?
export function attacked(b, s, by) {
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

// Play a move and return the new position (the old one is left untouched).
export function make(pos, m) {
  const b = pos.b.slice(), W = pos.turn === 'w';
  b[m.from] = null; b[m.to] = m.promo || m.piece;
  if (m.flag === 'ep') b[m.to + (W ? 8 : -8)] = null;
  else if (m.flag === 'ck') { b[m.to + 1] = null; b[m.to - 1] = W ? 'R' : 'r'; }
  else if (m.flag === 'cq') { b[m.to - 2] = null; b[m.to + 1] = W ? 'R' : 'r'; }
  let castle = pos.castle;
  if (castle) {
    const lose = (RIGHTS[m.from] || '') + (RIGHTS[m.to] || '');
    if (lose) castle = [...castle].filter((ch) => !lose.includes(ch)).join('');
  }
  return {
    b, turn: other(pos.turn), castle, ep: m.flag === 'dp' ? (m.from + m.to) >> 1 : -1,
    half: m.cap || m.piece === 'P' || m.piece === 'p' ? 0 : pos.half + 1, full: pos.full + (W ? 0 : 1),
  };
}

export const kingSq = (b, c) => b.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (pos, c = pos.turn) => attacked(pos.b, kingSq(pos.b, c), other(c));
const leavesKingSafe = (pos, n) => !attacked(n.b, kingSq(n.b, pos.turn), n.turn);
export const legalMoves = (pos) => pseudoMoves(pos).filter((m) => leavesKingSafe(pos, make(pos, m)));

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(make(pos, m), depth - 1);
  return n;
}

// Identity of a position for threefold repetition: pieces, side to move, castling rights, usable en passant.
export function posKey(pos) {
  const ep = pos.ep >= 0 && legalMoves(pos).some((m) => m.flag === 'ep') ? pos.ep : -1;
  return pos.b.map((p) => p || '.').join('') + pos.turn + pos.castle + ':' + ep;
}

// Neither side can ever give checkmate: K v K, K+minor v K, or only bishops that all stand on one colour.
export function insufficient(b) {
  let knights = 0, light = 0, dark = 0;
  for (let s = 0; s < 64; s++) {
    const p = b[s] && b[s].toLowerCase();
    if (!p || p === 'k') continue;
    if (p === 'n') knights++;
    else if (p === 'b') { if (((s >> 3) + (s & 7)) % 2) dark++; else light++; }
    else return false;
  }
  if (knights === 0) return light === 0 || dark === 0;
  return knights === 1 && light + dark === 0;
}

// keys: posKey of every position so far, the current one last.
export function status(pos, keys = []) {
  if (!legalMoves(pos).length) {
    return inCheck(pos) ? { over: true, kind: 'checkmate', winner: other(pos.turn) } : { over: true, kind: 'stalemate', winner: null };
  }
  if (insufficient(pos.b)) return { over: true, kind: 'material', winner: null };
  if (pos.half >= 100) return { over: true, kind: 'fifty', winner: null };
  const k = keys[keys.length - 1];
  if (k && keys.filter((x) => x === k).length >= 3) return { over: true, kind: 'threefold', winner: null };
  return { over: false, check: inCheck(pos) };
}

// ---------- computer opponent: alpha-beta search ----------
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000, INF = 1e9, TIMEOUT = { timeout: true };

export function material(b, c) { // classic points: P1 N3 B3 R5 Q9
  const PTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let s = 0;
  for (const p of b) if (p && sideOf(p) === c) s += PTS[p.toLowerCase()];
  return s;
}

// Score in centipawns from the point of view of the side to move.
export function evaluate(pos) {
  const b = pos.b;
  let big = 0, s = 0;
  for (let i = 0; i < 64; i++) { const p = b[i]; if (p && p !== 'P' && p !== 'p') big += VAL[p.toLowerCase()]; }
  const endgame = big <= 2600;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const W = p < 'a', t = p.toLowerCase(), r = i >> 3, c = i & 7, adv = W ? 7 - r : r;
    const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)); // 0 at the rim … 3 in the middle
    let v = VAL[t];
    if (t === 'p') v += adv * (endgame ? 12 : 5) + (c > 2 && c < 5 && adv > 2 ? 18 : 0);
    else if (t === 'n') v += centre * 14 - 10;
    else if (t === 'b') v += centre * 7;
    else if (t === 'r') v += adv === 6 ? 20 : 0;
    else if (t === 'q') v += centre * 3;
    else v += endgame ? centre * 14 : (adv === 0 ? 12 : -25) + (c < 3 || c > 5 ? 18 : 0);
    s += W ? v : -v;
  }
  return pos.turn === 'w' ? s : -s;
}

const order = (m) => (m.cap ? 1000 + 10 * VAL[m.cap.toLowerCase()] - VAL[m.piece.toLowerCase()] : 0) + (m.promo ? 900 : 0);
const sorted = (moves) => moves.sort((x, y) => order(y) - order(x));
function tick(ctx) {
  if ((++ctx.nodes & 511) === 0 && ctx.canStop && Date.now() > ctx.deadline) throw TIMEOUT;
}

// Keep searching captures until the position is quiet, so the engine does not stop in the middle of a swap.
function quiesce(pos, a, bt, ply, ctx) {
  tick(ctx);
  const stand = evaluate(pos);
  if (stand >= bt || ply >= ctx.maxPly + 4) return stand;
  if (stand > a) a = stand;
  for (const m of sorted(pseudoMoves(pos, true))) {
    const n = make(pos, m);
    if (!leavesKingSafe(pos, n)) continue;
    const sc = -quiesce(n, -bt, -a, ply + 1, ctx);
    if (sc >= bt) return sc;
    if (sc > a) a = sc;
  }
  return a;
}

function negamax(pos, depth, a, bt, ply, ctx) {
  tick(ctx);
  if (pos.half >= 100) return 0;
  if (depth <= 0) {
    if (ply < ctx.maxPly && inCheck(pos)) depth = 1; // look one move further when in check, so mates are seen
    else return ctx.q ? quiesce(pos, a, bt, ply, ctx) : evaluate(pos);
  }
  let any = false;
  for (const m of sorted(pseudoMoves(pos))) {
    const n = make(pos, m);
    if (!leavesKingSafe(pos, n)) continue;
    any = true;
    const sc = -negamax(n, depth - 1, -bt, -a, ply + 1, ctx);
    if (sc >= bt) return sc;
    if (sc > a) a = sc;
  }
  if (!any) return inCheck(pos) ? -MATE + ply : 0;
  return a;
}

// Choose a move. depth: plies to search; q: quiescence; wild: chance of a random move.
// The same search as the flat lab's chooseMove, written as a generator: where that one awaits a pause between
// root moves, this one yields, so the lab can run it a little every step and the scene keeps moving.
export function* thinkMove(pos, { depth = 2, q = false, wild = 0, rng = Math.random, budget = 2500, seen = null } = {}) {
  let moves = legalMoves(pos);
  if (!moves.length) return null;
  if (rng() < wild) return moves[Math.floor(rng() * moves.length)];
  moves = moves.map((m) => ({ m, k: order(m) + rng() })).sort((x, y) => y.k - x.k).map((x) => x.m); // random tie-breaks
  const ctx = { q, nodes: 0, deadline: Date.now() + budget, canStop: false, maxPly: 0 };
  let best = moves[0];
  for (let d = 1; d <= depth; d++) {
    ctx.maxPly = d + 2; ctx.canStop = d > 1;
    let a = -INF, top = null;
    const scores = new Map();
    try {
      for (const m of moves) {
        yield;
        const n = make(pos, m);
        const sc = seen && (seen.get(posKey(n)) || 0) >= 2 ? 0 : -negamax(n, d - 1, -INF, -a, 1, ctx);
        scores.set(m, sc);
        if (sc > a) { a = sc; top = m; }
      }
    } catch (e) { if (e !== TIMEOUT) throw e; break; }
    best = top || best;
    if (a > MATE - 100) break;
    moves = [best, ...moves.filter((m) => m !== best).sort((x, y) => scores.get(y) - scores.get(x))];
  }
  return best;
}
// Runs the search to the end in one go (used by the model check).
export function chooseMove(pos, opts) { const g = thinkMove(pos, opts); for (;;) { const r = g.next(); if (r.done) return r.value; } }

// Strength for each learner level: 1 is nearly random, 6 looks 4 plies ahead and settles captures.
export const STRENGTH = [null,
  { depth: 1, q: false, wild: 0.85 }, { depth: 1, q: false, wild: 0.3 }, { depth: 2, q: false, wild: 0.1 },
  { depth: 2, q: true, wild: 0 }, { depth: 3, q: true, wild: 0 }, { depth: 4, q: true, wild: 0 }];

// A short ending used by the demonstration: two rooks walk a lone king to the edge (checkmate in two moves).
const DEMO = '6k1/8/R7/1R6/8/8/8/6K1 w - - 0 1';

// Model check: the move generator must count the known numbers of positions, and see mate and stalemate.
export function selfTest() {
  const start = fromFen(START), kiwi = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  const d1 = perft(start, 1), d2 = perft(start, 2), d3 = perft(start, 3), k1 = perft(kiwi, 1), k2 = perft(kiwi, 2);
  const fool = status(fromFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'));      // fool's mate: White is checkmated
  const stale = status(fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));                                     // Black to move, no move, no check
  const bare = status(fromFen('8/8/4k3/8/8/3K4/8/8 w - - 0 1'));                                       // king against king
  const ep = legalMoves(fromFen('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3')).filter((m) => m.flag === 'ep').length;
  const castles = legalMoves(fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')).filter((m) => m.flag === 'ck' || m.flag === 'cq').length;
  const promo = legalMoves(fromFen('8/4P3/8/8/8/k7/8/4K3 w - - 0 1')).filter((m) => m.promo).length;
  let demo = fromFen(DEMO), plies = 0;
  while (!status(demo).over && plies < 6) { demo = make(demo, chooseMove(demo, { depth: 3, q: false, wild: 0 })); plies++; }
  const end = status(demo);
  const ok = d1 === 20 && d2 === 400 && d3 === 8902 && k1 === 48 && k2 === 2039 && fool.kind === 'checkmate' && fool.winner === 'b'
    && stale.kind === 'stalemate' && bare.kind === 'material' && ep === 1 && castles === 2 && promo === 4 && end.kind === 'checkmate' && end.winner === 'w' && plies === 3;
  return { ok, detail: `moves from the start: ${d1} (20), after one move each: ${d2} (400), after three: ${d3} (8902); test position ${k1} and ${k2} (48, 2039); fool's mate ${fool.kind}; ${stale.kind}; en passant ${ep}, castling ${castles}, promotions ${promo}; the search mates the lone king in ${plies} half-moves` };
}

// =====================================================================================
// The 3D lab
// =====================================================================================
const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
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
  id: 'w13-chess',
  world: 13,
  levels: [1, 2, 3, 4, 5, 6],
  title: 'Chess Board',
  goal: 'Play a full game of chess against the computer and win or draw.',
  kind: 'validated',
  model: 'All the rules of chess are here (castling, en passant, promotion, check, checkmate, stalemate, draws by insufficient material, fifty moves and threefold repetition). The move generator is checked by counting positions: 20 moves from the start and 400 after one move each. The computer looks only a few moves ahead and judges positions by simple counting, so it is far weaker than a chess master or a real engine. There is no clock and no draw offers.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, T = ctx.t || ((x) => x), onTap = ctx.onTap || (() => {}), rng = ctx.rng || Math.random;
    const lvl = Math.min(6, Math.max(1, Math.round(ctx.level) || 1)), young = lvl <= 2;
    const cell = 0.55, Y0 = 0.05, geos = [], G = (g) => { geos.push(g); return g; };
    const add = (geo, material, x, y, z, parent) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };

    // ---------- the scene: a board on a stand, tipped towards the viewer ----------
    const tilt = new THREE.Group(); tilt.position.set(0, 1.95, 0); tilt.rotation.x = 0.55; group.add(tilt);
    const board = new THREE.Group(); tilt.add(board);                    // turns round when the player takes Black
    const steel = ctx.mat('#868e96', { metalness: 0.4, roughness: 0.4 }), frame = ctx.mat('#3b2a1e', { roughness: 0.5 });
    add(G(new THREE.CylinderGeometry(0.16, 0.24, 1.9, 12)), steel, 0, 0.95, -0.2, group);
    add(G(new THREE.CylinderGeometry(0.8, 1.05, 0.3, 20)), steel, 0, 0.15, -0.2, group);
    add(G(new THREE.BoxGeometry(4.7, 0.2, 4.7)), frame, 0, -0.11, 0, board).receiveShadow = true;
    const trayGeo = G(new THREE.BoxGeometry(0.92, 0.12, 4.3)), felt = ctx.mat('#2f6b4f', { roughness: 0.9 });
    add(trayGeo, felt, -2.84, -0.07, 0, board); add(trayGeo, felt, 2.84, -0.07, 0, board);
    const X = (s) => ((s & 7) - 3.5) * cell, Z = (s) => ((s >> 3) - 3.5) * cell;          // rank 1 is nearest the viewer
    const gold = new THREE.Color('#ffc94d'), blue = new THREE.Color('#4f7bd5'), coral = new THREE.Color('#ff6b5e');
    const SQM = ['#ead9b5', '#8a6f52'].map((c) => [ctx.mat(c, { roughness: 0.45 }), ctx.mat(c, { roughness: 0.45, emissive: gold, emissiveIntensity: 0.75 }),
      ctx.mat(c, { roughness: 0.45, emissive: blue, emissiveIntensity: 0.55 }), ctx.mat(c, { roughness: 0.45, emissive: coral, emissiveIntensity: 0.9 })]);
    const sqGeo = G(new THREE.BoxGeometry(cell * 0.98, 0.1, cell * 0.98)), squares = [];
    for (let s = 0; s < 64; s++) { const m = add(sqGeo, SQM[((s >> 3) + (s & 7)) % 2][0], X(s), 0, Z(s), board); m.receiveShadow = true; squares.push(m); onTap(m, () => tap(s)); }
    for (let i = 0; i < 8; i++) {
      const f = ctx.sprite('abcdefgh'[i], { size: 0.2 }); f.position.set((i - 3.5) * cell, 0.1, 2.29); board.add(f);
      const r = ctx.sprite(String(8 - i), { size: 0.2 }); r.position.set(-2.29, 0.1, (i - 3.5) * cell); board.add(r);
    }
    // rings that show where the chosen piece may go, and one brighter ring for the move chosen in the list
    const ringGeo = G(new THREE.TorusGeometry(cell * 0.37, cell * 0.06, 6, 20)), green = ctx.lit('#51cf66', 1.3);
    const rings = Array.from({ length: 28 }, () => { const m = add(ringGeo, green, 0, Y0 + 0.03, 0, board); m.rotation.x = Math.PI / 2; m.visible = false; m.castShadow = false; return m; });
    const cursor = add(G(new THREE.TorusGeometry(cell * 0.45, cell * 0.07, 6, 4)), ctx.lit('#ffe08a', 1.6), 0, Y0 + 0.05, 0, board); cursor.rotation.set(Math.PI / 2, 0, Math.PI / 4); cursor.visible = false; cursor.castShadow = false;

    // ---------- the pieces: a pool of 16 for each colour; a piece changes shape when a pawn is promoted ----------
    const LG = {}; for (const t in PROFILE) LG[t] = G(new THREE.LatheGeometry(PROFILE[t].map(([r, y]) => new THREE.Vector2(r * cell, y * cell)), 18));
    const headGeo = G(new THREE.BoxGeometry(0.2 * cell, 0.46 * cell, 0.3 * cell)), noseGeo = G(new THREE.BoxGeometry(0.18 * cell, 0.17 * cell, 0.3 * cell));
    const crossV = G(new THREE.BoxGeometry(0.07 * cell, 0.26 * cell, 0.07 * cell)), crossH = G(new THREE.BoxGeometry(0.2 * cell, 0.07 * cell, 0.07 * cell));
    const PM = { w: ctx.mat('#fbf6ea', { roughness: 0.35 }), b: ctx.mat('#2b2f36', { roughness: 0.3, metalness: 0.25 }) };
    const pool = [];
    for (const c of ['w', 'b']) for (let i = 0; i < 16; i++) {
      const m = add(LG.p, PM[c], 0, Y0, 0, board); m.castShadow = true; m.visible = false;
      const p = { m, c, t: 'p', sq: -1, from: new THREE.Vector3(), to: new THREE.Vector3(), k: 1, lift: 0, s0: 1, s1: 1, extras: [], promo: null };
      pool.push(p); onTap(m, () => { if (p.sq >= 0) tap(p.sq); });
    }
    function setType(p, t) {
      p.t = t; p.m.geometry = LG[t];
      for (const e of p.extras) p.m.remove(e);
      p.extras = [];
      const dir = p.c === 'w' ? -1 : 1;                                   // knights look towards the other side
      if (t === 'n') {
        const head = add(headGeo, PM[p.c], 0, 0.55 * cell, 0, p.m); head.rotation.x = -dir * 0.3;
        p.extras.push(head, add(noseGeo, PM[p.c], 0, 0.68 * cell, dir * 0.18 * cell, p.m));
      } else if (t === 'k') p.extras.push(add(crossV, PM[p.c], 0, 1.18 * cell, 0, p.m), add(crossH, PM[p.c], 0, 1.2 * cell, 0, p.m));
      for (const e of p.extras) e.castShadow = true;
    }
    const taken = { w: 0, b: 0 };
    const trayAt = (c, i) => [(c === 'w' ? -1 : 1) * (2.63 + (i >> 3) * 0.42), ((i & 7) - 3.5) * 0.5];   // captured pieces line up beside the board
    function go(p, x, z, scale, lift, snap) {
      p.from.copy(p.m.position); p.to.set(x, Y0, z); p.s0 = p.m.scale.x; p.s1 = scale; p.lift = lift; p.k = snap ? 1 : 0;
      if (snap) { p.m.position.copy(p.to); p.m.scale.setScalar(scale); if (p.promo) { setType(p, p.promo); p.promo = null; } }
    }
    // Stand the pieces of a position on the board (used for a new game and for a loaded position).
    function stand(pos) {
      taken.w = taken.b = 0;
      for (const p of pool) { p.sq = -1; p.m.visible = false; p.promo = null; p.k = 1; }
      for (let s = 0; s < 64; s++) {
        const ch = pos.b[s]; if (!ch) continue;
        const p = pool.find((x) => x.c === sideOf(ch) && !x.m.visible); if (!p) continue;
        setType(p, ch.toLowerCase()); p.sq = s; p.m.visible = true; go(p, X(s), Z(s), 1, 0, true);
      }
    }
    // Show one move: the mover glides, a captured piece flies to its tray, the rook hops over when castling.
    function shift(m, c, snap) {
      const mover = pool.find((p) => p.sq === m.from); if (!mover) return;
      if (m.cap) {
        const at = m.flag === 'ep' ? m.to + (c === 'w' ? 8 : -8) : m.to, victim = pool.find((p) => p.sq === at);
        if (victim) { victim.sq = -1; const [x, z] = trayAt(victim.c, taken[victim.c]++); go(victim, x, z, 0.72, 1.3 * cell, snap); }
      }
      mover.sq = m.to; if (m.promo) mover.promo = m.promo.toLowerCase();
      go(mover, X(m.to), Z(m.to), 1, mover.t === 'n' ? 0.9 * cell : 0.12 * cell, snap);
      if (m.flag === 'ck' || m.flag === 'cq') {
        const rook = pool.find((p) => p.sq === (m.flag === 'ck' ? m.to + 1 : m.to - 2)), to = m.flag === 'ck' ? m.to - 1 : m.to + 1;
        if (rook) { rook.sq = to; go(rook, X(to), Z(to), 1, 1.0 * cell, snap); }
      }
    }
    function restand() { stand(hist[0].pos); for (let i = 1; i < hist.length; i++) shift(hist[i].move, hist[i - 1].pos.turn, true); }

    // ---------- the game (the same flow as the flat lab) ----------
    let human = 'w', hist = [], sel = -1, thinking = false, over = null, guessed = false, job = null, pick = -1, list = [];
    let auto = false, autoJob = null, autoWait = 0, done = false;
    const cur = () => hist[hist.length - 1];
    const rMsg = ui.readout('Game'), rMove = ui.readout('Move number'), rPts = ui.readout('Points (you – computer)'), rPick = ui.readout('Chosen move');
    const setMsg = (text) => rMsg.set(T(text));
    const label = (m) => {
      if (m.flag === 'ck') return T('Castle on the king\'s side');
      if (m.flag === 'cq') return T('Castle on the queen\'s side');
      return `${T(NAME[m.piece.toLowerCase()])} ${sqName(m.from)} ${m.cap ? '×' : '→'} ${sqName(m.to)}` + (m.promo ? ' = ' + T(NAME[m.promo.toLowerCase()]) : '');
    };
    // the list of legal moves in the panel (a real list where the page allows it; the buttons below always work)
    let listEl = null;
    try {
      if (typeof document !== 'undefined' && ui.el && typeof ui.el.append === 'function') {
        listEl = document.createElement('select'); listEl.size = 5; listEl.style.width = '100%'; listEl.setAttribute('aria-label', T('Legal moves'));
        listEl.addEventListener('change', () => choose(+listEl.value));
        ui.el.append(listEl);
      }
    } catch (e) { listEl = null; }
    function fillList() {
      if (!listEl) return;
      try {
        listEl.replaceChildren(...list.map((m, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = label(m); return o; }));
        listEl.value = pick >= 0 ? String(pick) : '';
      } catch (e) { /* the list is a helper; the buttons still work */ }
    }

    function render() {
      const { pos, move } = cur(), mine = !thinking && !over && pos.turn === human;
      list = mine ? legalMoves(pos) : [];
      if (pick >= list.length) pick = -1;
      const targets = sel >= 0 && mine ? list.filter((m) => m.from === sel) : [];
      const chk = inCheck(pos) ? kingSq(pos.b, pos.turn) : -1;
      for (let s = 0; s < 64; s++) squares[s].material = SQM[((s >> 3) + (s & 7)) % 2][s === chk ? 3 : s === sel ? 1 : move && (s === move.from || s === move.to) ? 2 : 0];
      const seen = new Set(); let n = 0;
      for (const m of targets) if (!seen.has(m.to) && n < rings.length) { seen.add(m.to); rings[n].position.set(X(m.to), Y0 + 0.03, Z(m.to)); rings[n++].visible = true; }
      for (; n < rings.length; n++) rings[n].visible = false;
      cursor.visible = pick >= 0; if (pick >= 0) cursor.position.set(X(list[pick].to), Y0 + 0.05, Z(list[pick].to));
      rMove.set(String(pos.full)); if (!guessed) rPts.set('?');
      rPick.set(pick >= 0 ? `${label(list[pick])} (${pick + 1} / ${list.length})` : list.length ? `– (${list.length})` : '–');
      fillList();
    }

    function tap(s) {
      if (thinking || over) return;
      const pos = cur().pos;
      if (pos.turn !== human) return;
      const options = sel >= 0 ? legalMoves(pos).filter((m) => m.from === sel && m.to === s) : [];
      if (options.length > 1) { play(options.find((m) => m.promo.toLowerCase() === promoC.value) || options[0]); return; }   // promotion: the piece chosen in the panel
      if (options.length === 1) { play(options[0]); return; }
      const p = pos.b[s];
      pick = -1;
      if (p && sideOf(p) === human) {
        sel = s === sel ? -1 : s;
        if (sel >= 0 && !legalMoves(pos).some((m) => m.from === s)) {
          ctx.say(inCheck(pos) ? 'That piece cannot help while your king is in check.' : 'That piece has no legal move right now.');
        }
      } else sel = -1;
      render();
    }
    // Choose a move in the panel list: its piece lights up and a golden ring marks where it would land.
    function choose(i) {
      if (thinking || over || cur().pos.turn !== human || !list.length) return;
      pick = ((i % list.length) + list.length) % list.length; sel = list[pick].from; render();
    }
    function playPick() {
      if (thinking || over || cur().pos.turn !== human) return;
      if (pick < 0 || !list[pick]) { ctx.say('Choose a move first: tap a piece and then a ringed square, or step through the list of moves.'); return; }
      play(list[pick]);
    }

    function explain(m, mine) {
      if (m.flag === 'ck' || m.flag === 'cq') return mine ? 'You castled: the king jumps to safety and the rook comes out, all in one move.' : 'The computer castled to tuck its king away safely.';
      if (m.flag === 'ep') return 'En passant! A pawn that has just jumped two squares can be captured as if it had moved only one.';
      if (m.promo) return 'Promotion! A pawn that reaches the far side becomes a stronger piece.';
      if (m.cap && !mine) return `The computer captured your ${NAME[m.cap.toLowerCase()]}. Before each move, ask: which of my pieces are attacked?`;
      if (m.cap) return `You captured a ${NAME[m.cap.toLowerCase()]}. It waits beside the board. Count the points: pawn 1, knight 3, bishop 3, rook 5, queen 9.`;
      return '';
    }

    // Every move, the player's and the computer's, goes through here.
    function play(m) {
      const before = cur().pos, pos = make(before, m), mine = before.turn === human;
      hist.push({ pos, key: posKey(pos), move: m });
      shift(m, before.turn, false);
      sel = -1; pick = -1; guessed = false;
      const st = status(pos, hist.map((x) => x.key));
      const why = explain(m, mine);
      if (st.over) { finish(st); render(); return; }
      if (st.check) ctx.say(mine ? 'Check! You are attacking the king, so the computer must answer.' : 'Check! Your king is attacked: move it, block the attack or capture the attacker.');
      else if (why) ctx.say(why);
      if (pos.turn !== human) computer();
      else setMsg(st.check ? 'You are in check. Save your king!' : 'Your turn');
      render();
    }

    function finish(st) {
      over = st; thinking = false; job = null;
      const won = st.winner === human;
      if (st.kind === 'checkmate') {
        setMsg(won ? 'Checkmate! You win.' : 'Checkmate. The computer wins.');
        if (won) { ctx.say('Checkmate! You win. The king is attacked and has no escape: it cannot move away, nothing can block and the attacker cannot be captured.'); done = true; ctx.complete(1, 'Won a full game of chess by checkmate.'); }
        else ctx.say('Checkmate means the king is attacked and no move can save it. Look for what attacked you and guard it next time. Press New game to try again.');
        return;
      }
      const text = {
        stalemate: 'Draw by stalemate: the side to move is not in check but has no legal move.',
        material: 'Draw: neither side has enough pieces left to give checkmate.',
        fifty: 'Draw by the fifty-move rule: fifty moves each with no capture and no pawn move.',
        threefold: 'Draw by repetition: the same position has appeared three times.',
      }[st.kind];
      setMsg('Draw');
      ctx.say(text);
      done = true; ctx.complete(0.6, 'Drew a full game of chess against the computer.');
    }

    function computer() {
      thinking = true;
      setMsg('The computer is thinking…');
      const seen = new Map();
      for (const x of hist) seen.set(x.key, (seen.get(x.key) || 0) + 1);
      job = { gen: thinkMove(cur().pos, { ...STRENGTH[lvl], rng, seen, budget: 2200 }), wait: 0.7, done: false, move: null };
    }
    // Run a search for a few milliseconds; true when it has finished.
    function advance(j, ms) {
      const end = Date.now() + ms;
      while (!j.done) { const r = j.gen.next(); if (r.done) { j.done = true; j.move = r.value; } else if (Date.now() >= end) break; }
      return j.done;
    }

    // The lab's position loader: a new game is the start position; the demonstration loads a short ending.
    function load(fen) {
      job = null; autoJob = null; thinking = false; over = null; sel = -1; pick = -1; guessed = false;
      const pos = fromFen(fen);
      hist = [{ pos, key: posKey(pos), move: null }];
      stand(pos);
      if (pos.turn !== human) computer();
      else setMsg(human === 'w' ? 'You are White, so you move first.' : 'Your turn');
      render();
    }
    const newGame = () => load(START);

    function undo() {
      if (hist.length < 2) return;
      job = null; thinking = false; over = null; sel = -1; pick = -1;
      hist.pop();
      while (hist.length > 1 && cur().pos.turn !== human) hist.pop();
      restand();
      if (cur().pos.turn !== human) computer();
      else setMsg('Move taken back. Your turn.');
      render();
    }

    function guess(v) {
      if (v === 'none') return;
      const me = material(cur().pos.b, human), comp = material(cur().pos.b, other(human));
      const truth = me > comp ? 'you' : me < comp ? 'comp' : 'even';
      rPts.set(`${me} – ${comp}`); guessed = true;
      ctx.say((v === truth ? 'Right! ' : 'Not this time. ') + `You have ${me} points and the computer has ${comp}. Count them like this: pawn 1, knight 3, bishop 3, rook 5, queen 9.`);
    }

    // ---------- the panel ----------
    ui.button('Previous move in the list', () => { auto = false; choose(pick < 0 ? list.length - 1 : pick - 1); });
    ui.button('Next move in the list', () => { auto = false; choose(pick + 1); });
    ui.button('Play the chosen move', () => { auto = false; playPick(); }, 'btn');
    const promoC = ui.choice([['q', 'Pawn becomes a queen'], ['r', 'a rook'], ['b', 'a bishop'], ['n', 'a knight']], 'q', () => {});
    ui.button('New game', () => { auto = false; newGame(); });
    ui.button('Take back', () => { auto = false; undo(); });
    ui.choice([['none', 'Who is ahead on points?'], ['you', 'Me'], ['even', 'Level'], ['comp', 'Computer']], 'none', guess);
    const sideC = ui.choice([['w', 'I play White'], ['b', 'I play Black']], 'w', (v) => { human = v; newGame(); });
    ui.note((young ? 'Beat the computer! Tap a piece, then tap a square with a green ring.' : 'Win or draw against the computer. Tap a piece, then one of the ringed squares, or pick a move from the list.')
      + ` Computer strength: ${lvl} of 6. ` + (lvl <= 2 ? 'It mostly plays without a plan.' : lvl <= 4 ? 'It looks two moves ahead.' : 'It looks three to four moves ahead and follows captures to the end.'));
    newGame();
    ctx.say(young ? 'The goal is to trap the other king. Tap one of your pieces and the green rings show where it may go.'
      : 'Guess who is ahead on points before you count: predicting first trains you to read the board.');

    return {
      step(dt) {
        if (job) {                                                        // the computer thinks a little every step
          job.wait -= dt;
          if (advance(job, 7) && job.wait <= 0) { const m = job.move; job = null; thinking = false; if (m) play(m); }
          return;
        }
        if (!auto) return;
        // The demonstration: the player's side also asks the search for a move and plays it with the same two taps.
        if (over) { if (!done) { autoWait -= dt; if (autoWait <= 0) load(DEMO); } return; }
        if (thinking || cur().pos.turn !== human) return;
        if (!autoJob) autoJob = { gen: thinkMove(cur().pos, { depth: 3, q: false, wild: 0, rng, budget: 4000 }), done: false, move: null };
        autoWait -= dt;
        if (advance(autoJob, 7) && autoWait <= 0) { const m = autoJob.move; autoJob = null; autoWait = 1.1; if (m) { if (m.promo) promoC.set?.(m.promo.toLowerCase()); tap(m.from); tap(m.to); } }
      },
      frame(dt) {
        const want = human === 'b' ? Math.PI : 0;
        board.rotation.y += (want - board.rotation.y) * Math.min(1, dt * 5);
        for (const p of pool) {
          if (p.k >= 1) continue;
          p.k = Math.min(1, p.k + dt / (ctx.calm ? 0.8 : 0.5));
          const e = p.k * p.k * (3 - 2 * p.k);
          p.m.position.lerpVectors(p.from, p.to, e);
          p.m.position.y = Y0 + (ctx.calm ? 0.3 : 1) * p.lift * Math.sin(Math.PI * e);
          p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * e);
          if (p.k >= 1 && p.promo) { setType(p, p.promo); p.promo = null; }
        }
      },
      // Plays a game to its end through the same taps the player uses. A whole game from the first move cannot be
      // promised to end well in two minutes, so the demonstration loads a short ending (two rooks against a king).
      autoplay() {
        auto = true; done = false; autoWait = 0.6;
        if (human !== 'w') { human = 'w'; sideC.set?.('w'); }
        load(DEMO);
        ctx.say('A demonstration from a short ending: two rooks take turns to shut the lone king on the edge of the board, and then one rook gives checkmate.');
      },
      dispose() { job = null; autoJob = null; auto = false; for (const g of geos) g.dispose(); },
    };
  },
};
