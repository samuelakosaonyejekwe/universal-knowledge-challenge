import { h, button, choice, readout } from '../core/labkit.js';

// =====================================================================================
// Rules engine — pure functions, no DOM. Squares are 0..63 with 0 = a8 and 63 = h1.
// A position is { b: [64 piece letters or null], turn: 'w'|'b', castle: 'KQkq' subset,
// ep: en-passant target square or -1, half: half-move clock, full: move number }.
// Proven with perft in Node (start position and 'Kiwipete').
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

// Choose a move. depth: plies to search; q: quiescence; wild: chance of a random move; pause: async yield to the UI.
export async function chooseMove(pos, { depth = 2, q = false, wild = 0, rng = Math.random, budget = 2500, pause = null, alive = () => true, seen = null } = {}) {
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
        if (pause) await pause();
        if (!alive()) return null;
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

// Strength for each learner level: 1 is nearly random, 6 looks 4 plies ahead and settles captures.
export const STRENGTH = [null,
  { depth: 1, q: false, wild: 0.85 }, { depth: 1, q: false, wild: 0.3 }, { depth: 2, q: false, wild: 0.1 },
  { depth: 2, q: true, wild: 0 }, { depth: 3, q: true, wild: 0 }, { depth: 4, q: true, wild: 0 }];

// =====================================================================================
// The lab
// =====================================================================================
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

export default {
  id: 'w13-chess',
  world: 13,
  levels: [1, 2, 3, 4, 5, 6],
  kind: 'lab',
  icon: '♟️',
  title: 'Chess Board',
  goal: 'Play a full game of chess against the computer and win or draw.',
  limits: 'All the rules of chess are here (castling, en passant, promotion, check, checkmate, stalemate, draws by insufficient material, fifty moves and threefold repetition). The computer looks only a few moves ahead and judges positions by simple counting, so it is far weaker than a chess master or a real engine. There is no clock and no draw offers.',
  mount(root, api) {
    const t = api.t, lvl = Math.min(6, Math.max(1, api.level | 0));
    const young = lvl <= 2;
    let human = 'w', hist, sel = -1, thinking = false, over = null, token = 0, pendingPromo = null, guessed = false;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    const pause = () => new Promise((res) => later(res, 0));
    const cur = () => hist[hist.length - 1];

    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const board = h('div', { class: 'board', role: 'grid', 'aria-label': t('Chess board') });
    const promoRow = h('div', { class: 'lab-row', hidden: true });
    const moveNo = readout(t('Move'), '1');
    const points = readout(t('Points (you – computer)'), '?');
    const guessOut = h('span', { class: 'small', 'aria-live': 'polite' });
    const guessRow = h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, t('Who is ahead on points?')),
      ...[['you', t('Me')], ['even', t('Level')], ['comp', t('Computer')]].map(([v, text]) => button(text, () => guess(v), 'chip')), guessOut);
    const sideChoice = choice([['w', '♔ ' + t('I play White')], ['b', '♚ ' + t('I play Black')]], 'w', (v) => { human = v; newGame(); });

    function guess(v) {
      const me = material(cur().pos.b, human), comp = material(cur().pos.b, other(human));
      const truth = me > comp ? 'you' : me < comp ? 'comp' : 'even';
      points.set(`${me} – ${comp}`);
      guessOut.textContent = (v === truth ? '✅ ' : '🔁 ') + t('Pawn 1, knight 3, bishop 3, rook 5, queen 9.');
      guessed = true;
    }

    function setMsg(text, cls = '') { msg.className = 'note' + (cls ? ' ' + cls : ''); msg.textContent = text; }

    function render() {
      const { pos, move } = cur();
      const targets = sel >= 0 && !thinking && !over ? legalMoves(pos).filter((m) => m.from === sel) : [];
      const chk = inCheck(pos) ? kingSq(pos.b, pos.turn) : -1;
      const cells = [];
      for (let i = 0; i < 64; i++) {
        const s = human === 'w' ? i : 63 - i, p = pos.b[s], dark = ((s >> 3) + (s & 7)) % 2 === 1;
        const isTarget = targets.some((m) => m.to === s);
        const cls = 'sq ' + (dark ? 'd' : 'l') + (s === sel ? ' hl' : '') + (isTarget ? ' mv' : '');
        const style = { border: '0', padding: '0', cursor: 'pointer', fontFamily: 'inherit' };
        if (s === chk) style.boxShadow = 'inset 0 0 0 4px #d9485f';
        else if (move && (s === move.from || s === move.to)) style.boxShadow = 'inset 0 0 0 3px rgba(79, 91, 213, .75)';
        const label = sqName(s) + (p ? ' ' + t((sideOf(p) === 'w' ? 'white ' : 'black ') + NAME[p.toLowerCase()]) : '') + (isTarget ? ' – ' + t('can move here') : '');
        cells.push(h('button', { class: cls, type: 'button', style, 'aria-label': label, onClick: () => tap(s) },
          p ? h('span', { class: sideOf(p) === 'w' ? 'pc-w' : 'pc-b', 'aria-hidden': 'true' }, GLYPH[p.toLowerCase()] + '︎') : null,
          (i % 8 === 0 || i >= 56) ? h('span', { class: 'co', 'aria-hidden': 'true' }, i >= 56 && i % 8 !== 0 ? sqName(s)[0] : i >= 56 ? sqName(s) : sqName(s)[1]) : null));
      }
      board.replaceChildren(...cells);
      moveNo.set(String(pos.full));
      if (!guessed) points.set('?');
    }

    function tap(s) {
      if (thinking || over || pendingPromo) return;
      const pos = cur().pos;
      if (pos.turn !== human) return;
      const options = sel >= 0 ? legalMoves(pos).filter((m) => m.from === sel && m.to === s) : [];
      if (options.length > 1) { askPromo(options); return; }
      if (options.length === 1) { play(options[0]); return; }
      const p = pos.b[s];
      if (p && sideOf(p) === human) {
        sel = s === sel ? -1 : s;
        if (sel >= 0 && !legalMoves(pos).some((m) => m.from === s)) {
          api.say(t(inCheck(pos) ? 'That piece cannot help while your king is in check.' : 'That piece has no legal move right now.'));
        }
      } else sel = -1;
      render();
    }

    function askPromo(options) {
      pendingPromo = options;
      promoRow.hidden = false;
      promoRow.replaceChildren(h('span', { class: 'lab-goal' }, t('Your pawn reached the end! Turn it into:')),
        ...options.map((m) => button(GLYPH[m.promo.toLowerCase()] + '︎ ' + t(NAME[m.promo.toLowerCase()]), () => {
          pendingPromo = null; promoRow.hidden = true; play(m);
        }, 'btn sm')));
    }

    function explain(m, mine) {
      if (m.flag === 'ck' || m.flag === 'cq') return t(mine ? 'You castled: the king jumps to safety and the rook comes out, all in one move.' : 'The computer castled to tuck its king away safely.');
      if (m.flag === 'ep') return t('En passant! A pawn that has just jumped two squares can be captured as if it had moved only one.');
      if (m.promo) return t('Promotion! A pawn that reaches the far side becomes a stronger piece.');
      if (m.cap && !mine) return t('The computer captured your') + ' ' + t(NAME[m.cap.toLowerCase()]) + '. ' + t('Before each move, ask: which of my pieces are attacked?');
      return '';
    }

    function play(m) {
      const pos = make(cur().pos, m), mine = cur().pos.turn === human;
      hist.push({ pos, key: posKey(pos), move: m });
      sel = -1; guessed = false; guessOut.textContent = '';
      const st = status(pos, hist.map((x) => x.key));
      const why = explain(m, mine);
      if (st.over) { finish(st); render(); return; }
      if (st.check) api.say(t(mine ? 'Check! You are attacking the king, so the computer must answer.' : 'Check! Your king is attacked: move it, block the attack or capture the attacker.'));
      else if (why) api.say(why);
      render();
      if (pos.turn !== human) computer();
      else setMsg(st.check ? t('You are in check. Save your king!') : t('Your turn. Tap a piece to see where it can go.'), st.check ? 'warn' : '');
    }

    function finish(st) {
      over = st;
      const won = st.winner === human;
      if (st.kind === 'checkmate') {
        setMsg(t(won ? 'Checkmate! You win. The king is attacked and has no escape.' : 'Checkmate. The computer wins this one. Try again!'), won ? 'ok' : 'bad');
        if (won) api.complete(1, t('Won a full game of chess by checkmate.'));
        else api.say(t('Checkmate means the king is attacked and no move can save it. Look for what attacked you and guard it next time.'));
        return;
      }
      const text = {
        stalemate: 'Draw by stalemate: the side to move is not in check but has no legal move.',
        material: 'Draw: neither side has enough pieces left to give checkmate.',
        fifty: 'Draw by the fifty-move rule: fifty moves each with no capture and no pawn move.',
        threefold: 'Draw by repetition: the same position has appeared three times.',
      }[st.kind];
      setMsg(t(text), 'ok');
      api.say(t(text));
      api.complete(0.6, t('Drew a full game of chess against the computer.'));
    }

    function computer() {
      thinking = true;
      const my = ++token, pos = cur().pos, began = Date.now();
      setMsg(t('The computer is thinking…'));
      const seen = new Map();
      for (const x of hist) seen.set(x.key, (seen.get(x.key) || 0) + 1);
      chooseMove(pos, { ...STRENGTH[lvl], rng: api.rng, pause, alive: () => my === token, seen, budget: 2200 }).then((m) => {
        if (my !== token || !m) return;
        later(() => { if (my !== token) return; thinking = false; play(m); }, Math.max(0, 350 - (Date.now() - began)));
      });
    }

    function newGame() {
      token++; thinking = false; over = null; sel = -1; pendingPromo = null; promoRow.hidden = true; guessed = false; guessOut.textContent = '';
      const pos = fromFen(START);
      hist = [{ pos, key: posKey(pos), move: null }];
      render();
      if (human === 'b') computer();
      else setMsg(t('You are White, so you move first. Tap a piece to see where it can go.'));
    }

    function undo() {
      if (hist.length < 2) return;
      token++; thinking = false; over = null; sel = -1; pendingPromo = null; promoRow.hidden = true;
      hist.pop();
      while (hist.length > 1 && cur().pos.turn !== human) hist.pop();
      render();
      if (cur().pos.turn !== human) computer();
      else setMsg(t('Move taken back. Your turn.'));
    }

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t(young ? 'Beat the computer! Tap a piece, then tap a green dot.' : 'Win or draw against the computer. Tap a piece, then one of the dots.')),
      msg, board, promoRow,
      h('div', { class: 'lab-row' }, button('🔄 ' + t('New game'), newGame, 'btn sm'), button('↩️ ' + t('Take back'), undo, 'btn sm ghost'), moveNo.el, points.el),
      guessRow, sideChoice.el,
      h('div', { class: 'small muted' }, t('Computer strength') + ': ' + lvl + ' / 6. '
        + t(lvl <= 2 ? 'It mostly plays without a plan.' : lvl <= 4 ? 'It looks two moves ahead.' : 'It looks three to four moves ahead and follows captures to the end.'))));
    newGame();
    api.say(t(young ? 'The goal is to trap the other king. Tap one of your pieces and the dots show where it may go.'
      : 'Guess who is ahead on points before you count: predicting first trains you to read the board.'));

    return () => { token++; for (const id of timers) clearTimeout(id); timers.clear(); };
  },
};
