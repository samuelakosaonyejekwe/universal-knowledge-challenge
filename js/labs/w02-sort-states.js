import { h, button } from '../core/labkit.js';

const ITEMS = [
  ['🧊', 'ice', 's', 'Ice keeps its shape, so it is a solid.'],
  ['🪨', 'rock', 's', 'A rock keeps its shape, so it is a solid.'],
  ['🧱', 'brick', 's', 'A brick keeps its shape, so it is a solid.'],
  ['⚽', 'ball', 's', 'A ball keeps its shape, so it is a solid.'],
  ['💧', 'water', 'l', 'Water flows and takes the shape of its cup: a liquid.'],
  ['🥛', 'milk', 'l', 'Milk pours and flows: a liquid.'],
  ['🍯', 'honey', 'l', 'Honey flows slowly, but it still flows: a liquid.'],
  ['🧃', 'juice', 'l', 'Juice pours and flows: a liquid.'],
  ['💨', 'wind', 'g', 'Air spreads out everywhere: a gas.'],
  ['🎈', 'air in a balloon', 'g', 'The air fills the whole balloon: a gas.'],
  ['☁️', 'steam', 'g', 'Steam is water as a gas. It spreads out to fill the room.'],
  ['🫧', 'bubble air', 'g', 'The air inside a bubble is a gas.'],
];
const BINS = [['s', '🧱', 'Solid', 'keeps its shape'], ['l', '💧', 'Liquid', 'flows'], ['g', '💨', 'Gas', 'spreads out']];

// Tap an item, then tap the bin where it belongs.
export default {
  id: 'w02-sort-states',
  world: 2,
  levels: [1, 2],
  kind: 'lab',
  icon: '🧊',
  title: 'Solid, Liquid or Gas?',
  goal: 'Sort every thing into solid, liquid or gas.',
  limits: 'Everyday things are sorted by how they behave at room temperature. Real materials such as sand, foam or jelly can be tricky and sit between the groups.',
  mount(root, api) {
    const t = api.t;
    const pool = ITEMS.map((i) => [api.rng(), i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    // 6 items, at least one of each state
    const pick = [];
    for (const st of ['s', 'l', 'g']) pick.push(pool.find((i) => i[2] === st));
    for (const i of pool) if (pick.length < 6 && !pick.includes(i)) pick.push(i);
    const queue = pick.map((i) => [api.rng(), i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    let sel = null, right = 0, firstTry = 0, tries = new Set(), done = false;
    const placed = { s: [], l: [], g: [] };

    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Tap a thing, then tap where it goes. Guess first!'));
    const tray = h('div', { class: 'lab-row', style: { justifyContent: 'center', minHeight: '86px' } });
    const bins = h('div', { class: 'grid c2', style: { gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem' } });

    const draw = () => {
      tray.replaceChildren(...queue.map((it, k) => h('button', {
        class: 'btn ' + (sel === k ? 'gold' : 'ghost'), type: 'button', 'aria-label': t(it[1]),
        style: { minWidth: '84px', minHeight: '84px', padding: '.3rem .4rem', flexDirection: 'column', gap: '.1rem' },
        onClick: () => { sel = sel === k ? null : k; draw(); },
      }, h('span', { style: { fontSize: '2.2rem', lineHeight: '1' } }, it[0]), h('span', { style: { fontSize: '.8rem' } }, t(it[1])))));
      bins.replaceChildren(...BINS.map(([k, ic, name, hint]) => h('button', {
        class: 'card', type: 'button', style: { minHeight: '140px', cursor: 'pointer', textAlign: 'center', border: '3px dashed var(--line)', padding: '.4rem' },
        'aria-label': t(name),
        onClick: () => drop(k),
      }, h('div', { style: { fontSize: '2rem' } }, ic), h('b', null, t(name)), h('div', { class: 'small muted' }, t(hint)),
      h('div', { style: { fontSize: '1.6rem', marginTop: '.3rem' } }, placed[k].join(' ')))));
    };
    function drop(k) {
      if (sel == null) { msg.textContent = t('Tap a thing first.'); return; }
      const it = queue[sel];
      if (it[2] === k) {
        if (!tries.has(it[1])) firstTry++;
        placed[k].push(it[0]); queue.splice(sel, 1); sel = null; right++;
        msg.className = 'note ok'; msg.textContent = '✅ ' + t(it[3]); api.say(t(it[3]));
        if (!queue.length && !done) {
          done = true; msg.textContent = t('All sorted! 🎉');
          api.complete(firstTry / 6, t('Solids keep their shape, liquids flow, and gases spread out to fill the space.'));
        }
      } else {
        tries.add(it[1]); msg.className = 'note warn';
        msg.textContent = t('Hmm, not quite. Does it keep its shape, flow, or spread out? Try again!');
        api.say(t('Think: can you pour it? Can you hold it in your hand? Does it fill the whole room?'));
      }
      draw();
    }
    draw();
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t('Sort every thing into solid, liquid or gas.')), msg, tray, bins,
      h('div', { class: 'small muted' }, t('Solid = keeps its shape · Liquid = pours · Gas = spreads out'))));
    return () => {};
  },
};
