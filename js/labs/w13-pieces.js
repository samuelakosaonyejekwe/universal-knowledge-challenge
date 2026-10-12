import { h, button, readout } from '../core/labkit.js';
import { pseudoMoves, sqName } from './w13-chess.js';

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
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
function reach(piece, sq) {
  const b = Array(64).fill(null);
  b[sq] = piece.toUpperCase();
  const seen = new Set();
  for (const m of pseudoMoves({ b, turn: 'w', castle: '', ep: -1, half: 0, full: 1 })) seen.add(m.to);
  return [...seen];
}
// Fewest moves from every square reachable from `from` (breadth-first search).
function distances(piece, from) {
  const dist = new Map([[from, 0]]);
  let frontier = [from];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) for (const to of reach(piece, s)) if (!dist.has(to)) { dist.set(to, dist.get(s) + 1); next.push(to); }
    frontier = next;
  }
  return dist;
}

export default {
  id: 'w13-pieces',
  world: 13,
  levels: [1, 2],
  kind: 'lab',
  icon: '⭐',
  title: 'Piece Trails',
  goal: 'Guess how many hops, then move the chess piece to the star.',
  limits: 'One piece on an empty board. In a real game other pieces get in the way, pawns capture diagonally, and the king may not step into danger.',
  mount(root, api) {
    const t = api.t, lvl = api.level <= 1 ? 1 : 2;
    const kinds = lvl === 1 ? ['r', 'b', 'k', 'q'] : ['r', 'b', 'q', 'k', 'n', 'p'];
    let piece, at, star, best, hops, guess, shown, stars = 0, rightGuesses = 0, extraHops = 0, done = false, lastKind = '';
    const pickInt = (n) => Math.floor(api.rng() * n);

    const board = h('div', { class: 'board', role: 'grid', 'aria-label': t('Practice board') });
    const title = h('div', { class: 'lab-goal', style: { fontSize: '1.2rem' } });
    const guessRow = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    const starOut = readout(t('Stars'), '0 / ' + TARGET);
    const hopOut = readout(t('Hops'), '0');

    function newRound() {
      do { piece = kinds[pickInt(kinds.length)]; } while (kinds.length > 1 && piece === lastKind);
      lastKind = piece;
      const maxHops = lvl === 1 ? 2 : 3;
      for (;;) {
        at = piece === 'p' ? 48 + pickInt(8) : pickInt(64); // pawns start on their home row
        const far = [...distances(piece, at)].filter(([s, d]) => d >= 1 && d <= maxHops && (piece !== 'p' || s >= 16));
        if (!far.length) continue;
        const wantTwo = api.rng() < 0.55, pool = far.filter(([, d]) => (wantTwo ? d >= 2 : d === 1));
        [star, best] = (pool.length ? pool : far)[pickInt(pool.length || far.length)];
        break;
      }
      hops = 0; guess = 0; shown = false;
      title.textContent = GLYPH[piece] + '︎ ' + t(NAME[piece]) + ' → ⭐';
      hopOut.set('0');
      guessRow.replaceChildren(h('span', { class: 'lab-goal' }, t('How many hops?')),
        ...[1, 2, 3].slice(0, lvl === 1 ? 2 : 3).map((n) => button(n === 1 ? '1️⃣' : n === 2 ? (lvl === 1 ? '2️⃣➕' : '2️⃣') : '3️⃣',
          () => { guess = n; shown = true; guessRow.replaceChildren(h('span', { class: 'lab-goal' }, t('Now tap a green dot!'))); render(); },
          'btn')));
      render();
    }

    function render() {
      const moves = shown ? reach(piece, at) : [];
      const cells = [];
      for (let s = 0; s < 64; s++) {
        const dark = ((s >> 3) + (s & 7)) % 2 === 1, can = moves.includes(s);
        const label = sqName(s) + (s === at ? ' ' + t(NAME[piece]) : s === star ? ' ' + t('star') : '') + (can ? ' – ' + t('can move here') : '');
        cells.push(h('button', {
          class: 'sq ' + (dark ? 'd' : 'l') + (s === at ? ' hl' : '') + (can ? ' mv' : ''), type: 'button', 'aria-label': label,
          style: { border: '0', padding: '0', cursor: 'pointer', fontFamily: 'inherit' }, onClick: () => tap(s),
        }, s === at ? h('span', { class: 'pc-w', 'aria-hidden': 'true' }, GLYPH[piece] + '︎') : s === star ? '⭐' : null));
      }
      board.replaceChildren(...cells);
    }

    function tap(s) {
      if (!guess) { api.say(t('Guess first: how many hops to the star?')); return; }
      if (s === at) { api.say(t(WHY[piece])); return; }
      if (!reach(piece, at).includes(s)) { api.say(t(WHY[piece])); return; }
      at = s; hops++; hopOut.set(String(hops));
      if (at !== star) {
        if (!reach(piece, at).length || !distances(piece, at).has(star)) { api.say(t('The star is out of reach from here. Let us try a new one!')); newRound(); return; }
        render(); return;
      }
      stars++; extraHops += hops - best;
      const good = lvl === 1 ? (guess === 1) === (best === 1) : guess === best;
      if (good) rightGuesses++;
      starOut.set(Math.min(stars, TARGET) + ' / ' + TARGET);
      api.say((good ? '✅ ' : '') + t(WHY[piece]) + (hops > best ? ' ' + t('It can be done in fewer hops. Look for the shortest trail next time.') : ''));
      star = -1; shown = false; render();
      if (stars >= TARGET && !done) {
        done = true;
        const score = Math.max(0.4, Math.min(1, 0.5 + 0.5 * rightGuesses / TARGET - 0.05 * extraHops));
        api.complete(score, t('Moved chess pieces to the star using each piece\'s own way of moving.'));
      }
      guessRow.replaceChildren(button('▶️ ' + t('Next star'), newRound, 'btn'));
    }

    root.append(h('div', { class: 'lab' }, title, guessRow, board, h('div', { class: 'lab-row' }, starOut.el, hopOut.el)));
    newRound();
    api.say(t('Each chess piece moves in its own way. Guess the number of hops, then follow the green dots to the star.'));
    return () => { board.replaceChildren(); };
  },
};
