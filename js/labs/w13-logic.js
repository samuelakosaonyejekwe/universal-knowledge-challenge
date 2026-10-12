import { h, button, readout, predict } from '../core/labkit.js';

const RUNNERS = [['🦊', 'Fox'], ['🦉', 'Owl'], ['🐢', 'Turtle'], ['🐇', 'Hare'], ['🦔', 'Hedgehog'], ['🐿️', 'Squirrel'], ['🦆', 'Duck']];
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

// ---------- pure puzzle logic (order[i] = runner who finished in place i) ----------
export function permutations(n) {
  const out = [], go = (cur, left) => { if (!left.length) out.push(cur); else left.forEach((x, i) => go([...cur, x], left.filter((_, j) => j !== i))); };
  go([], [...Array(n).keys()]);
  return out;
}
const place = (order, who) => order.indexOf(who);
export const holds = (c, order) => {
  const a = place(order, c.a), b = c.b == null ? -1 : place(order, c.b);
  if (a < 0 || (c.b != null && b < 0)) return null; // not decided yet
  switch (c.type) {
    case 'before': return a < b;
    case 'justBefore': return a + 1 === b;
    case 'next': return Math.abs(a - b) === 1;
    case 'apart': return Math.abs(a - b) > 1;
    case 'at': return a === c.k;
    case 'notAt': return a !== c.k;
    default: return a === 0 || a === order.length - 1; // 'end'
  }
};
export const consistent = (clues, n) => permutations(n).filter((p) => clues.every((c) => holds(c, p)));

// Build a set of true clues with exactly one solution, then drop any clue that is not needed.
export function generate(n, hard, rng) {
  const sol = permutations(n)[Math.floor(rng() * permutations(n).length)];
  const pool = [];
  for (let a = 0; a < n; a++) {
    for (let k = 0; k < n; k++) pool.push({ type: hard ? 'notAt' : (rng() < 0.3 ? 'at' : 'notAt'), a, k });
    pool.push({ type: 'end', a });
    for (let b = 0; b < n; b++) if (a !== b) for (const type of ['before', 'justBefore', 'next', 'apart']) pool.push({ type, a, b });
  }
  const truths = pool.filter((c) => holds(c, sol)).map((c) => [rng(), c]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  let clues = [], left = permutations(n).length;
  for (const c of truths) { // keep a clue only if it rules something out
    if (left === 1) break;
    if (!hard && c.type === 'at' && clues.some((x) => x.type === 'at')) continue;
    const now = consistent([...clues, c], n).length;
    if (now < left) { clues.push(c); left = now; }
  }
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.filter((_, j) => j !== i);
    if (consistent(without, n).length === 1) clues = without;
  }
  return { sol, clues };
}

export default {
  id: 'w13-logic',
  world: 13,
  levels: [3, 4, 5, 6],
  kind: 'lab',
  icon: '🧩',
  title: 'Race Detective',
  goal: 'Use the clues to work out the one finishing order that fits them all.',
  limits: 'A small made-up puzzle with no ties. Every puzzle is checked by trying all possible orders, so exactly one answer fits. Real detectives rarely get clues this tidy.',
  mount(root, api) {
    const t = api.t, lvl = api.level;
    const n = lvl <= 3 ? 3 : lvl === 4 ? 4 : 5, hard = lvl >= 5;
    let cast, puzzle, order, hand, tries, used, done;
    const total = permutations(n).length;
    const name = (i) => cast[i][0] + ' ' + t(cast[i][1]);
    const text = (c) => {
      const A = name(c.a), B = c.b == null ? '' : name(c.b);
      switch (c.type) {
        case 'before': return `${A} ${t('finished somewhere ahead of')} ${B}.`;
        case 'justBefore': return `${A} ${t('finished just ahead of')} ${B}.`;
        case 'next': return `${A} ${t('and')} ${B} ${t('finished right next to each other.')}`;
        case 'apart': return `${A} ${t('and')} ${B} ${t('did not finish next to each other.')}`;
        case 'at': return `${A} ${t('finished')} ${t(ORD[c.k])}.`;
        case 'notAt': return `${A} ${t('did not finish')} ${t(ORD[c.k])}.`;
        default: return `${A} ${t('finished either first or last.')}`;
      }
    };

    const slots = h('div', { class: 'lab-row', style: { justifyContent: 'center', gap: '.4rem' } });
    const tray = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    const clueBox = h('div', { class: 'lab-grid' });
    const leftOut = readout(t('Orders that still fit'), String(total));
    const triesOut = readout(t('Checks'), '0');
    const msg = h('div', { class: 'small', 'aria-live': 'polite' });
    const predictBox = h('div');

    function countLeft() { leftOut.set(String(consistent(puzzle.clues.filter((_, i) => used.has(i)), n).length)); }

    function draw() {
      slots.replaceChildren(...order.map((who, i) => h('button', {
        class: 'chip' + (who != null ? ' on' : ''), type: 'button', style: { flexDirection: 'column', minWidth: '54px', minHeight: '64px', borderRadius: '14px', padding: '.3rem' },
        'aria-label': t(ORD[i]) + ': ' + (who == null ? t('empty') : t(cast[who][1])),
        onClick: () => { if (hand != null) { const old = order.indexOf(hand); if (old >= 0) order[old] = null; order[i] = hand; hand = null; } else if (who != null) { order[i] = null; } draw(); },
      }, h('span', { style: { fontSize: '1.5rem' } }, who == null ? '❔' : cast[who][0]), h('span', { class: 'small' }, t(ORD[i])))));
      tray.replaceChildren(...cast.map((c, i) => h('button', {
        class: 'chip' + (hand === i ? ' on' : ''), type: 'button', style: { opacity: order.includes(i) ? 0.45 : 1 },
        'aria-pressed': String(hand === i), onClick: () => { hand = hand === i ? null : i; draw(); },
      }, name(i))));
      clueBox.replaceChildren(...puzzle.clues.map((c, i) => {
        const ok = holds(c, order), mark = !tries || ok == null ? '•' : ok ? '✅' : '❌';
        return h('label', { class: 'note' + (tries && ok === false ? ' bad' : ''), style: { display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.45rem .7rem' } },
          h('input', { type: 'checkbox', checked: used.has(i), 'aria-label': t('Count this clue'), onChange: (e) => { if (e.target.checked) used.add(i); else used.delete(i); countLeft(); } }),
          h('span', null, mark + ' ' + text(c)));
      }));
    }

    function check() {
      if (order.includes(null)) { msg.textContent = t('Place every runner first.'); return; }
      tries++; triesOut.set(String(tries));
      const bad = puzzle.clues.filter((c) => !holds(c, order)).length;
      draw();
      if (bad) {
        msg.textContent = '🔁 ' + bad + ' ' + t('clue(s) do not fit this order. They are marked in red.');
        api.say(t('An answer must fit every clue at once. Find a red clue and ask: who has to move to make it true?'));
        return;
      }
      msg.textContent = '✅ ' + t('Every clue fits, and no other order does.');
      if (!done) {
        done = true;
        api.say(t('You solved it by elimination: each clue crossed out orders until only one was left.'));
        api.complete(Math.max(0.4, 1 - 0.15 * (tries - 1)), t('Deduced the only order that satisfies every clue.'));
      }
    }

    function fresh() {
      cast = RUNNERS.map((r) => [api.rng(), r]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
      puzzle = generate(n, hard, api.rng);
      order = Array(n).fill(null); hand = null; tries = 0; used = new Set(); done = false;
      triesOut.set('0'); leftOut.set(String(total)); msg.textContent = '';
      predictBox.replaceChildren(predict({
        question: t('Before any clue: how many different finishing orders can') + ' ' + n + ' ' + t('runners have?'),
        truth: total, tolerance: 0,
        onResult: (err) => api.say(err === 0
          ? t('Right: multiply the choices for each place. That is a factorial.') + ` ${n}! = ${total}`
          : t('Count the choices place by place and multiply them:') + ' ' + [...Array(n).keys()].map((i) => n - i).join(' × ') + ' = ' + total),
      }));
      draw();
    }

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Who finished where? Pick a runner, then tap a place.')),
      predictBox, slots, tray,
      h('div', { class: 'small muted' }, t('Tick a clue to see how many orders it leaves.')),
      clueBox,
      h('div', { class: 'lab-row' }, leftOut.el, triesOut.el, button('✔ ' + t('Check my order'), check, 'btn sm'), button('🔄 ' + t('New puzzle'), fresh, 'btn sm ghost')),
      msg));
    fresh();
    api.say(t('Each clue rules out some orders. Tick the clues one by one and watch the number of possible orders shrink to 1.'));
    return () => { slots.replaceChildren(); tray.replaceChildren(); clueBox.replaceChildren(); };
  },
};
