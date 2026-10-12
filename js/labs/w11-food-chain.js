import { h, button } from '../core/labkit.js';

const CHAINS = [
  [['🌱', 'grass'], ['🐰', 'rabbit'], ['🦊', 'fox']],
  [['🌿', 'leaf'], ['🐛', 'caterpillar'], ['🐦', 'bird'], ['🦅', 'hawk']],
  [['🌾', 'seeds'], ['🐭', 'mouse'], ['🦉', 'owl']],
  [['🟢', 'plankton'], ['🐟', 'small fish'], ['🐧', 'penguin']],
];
const EXTRA = [['🐄', 'cow'], ['🍄', 'mushroom']];

export default {
  id: 'w11-food-chain',
  world: 11,
  levels: [1, 2],
  kind: 'lab',
  icon: '🦊',
  title: 'Build a Food Chain',
  goal: 'Put the living things in order: who gets energy from the Sun, and who eats whom.',
  limits: 'Real food webs are tangled, with many animals eating many foods. This shows one simple line, and leaves out decomposers and the energy lost at each step.',
  mount(root, api) {
    const t = api.t;
    const chain = CHAINS[Math.floor(api.rng() * CHAINS.length)];
    const extra = EXTRA[Math.floor(api.rng() * EXTRA.length)];
    const cards = [...chain, ...(api.level >= 2 ? [extra] : [])].sort(() => api.rng() - 0.5);
    let slots = Array(chain.length).fill(null), guess = null, done = false, tries = 0;
    const body = h('div', { class: 'lab' });
    const out = h('div', { class: 'note', 'aria-live': 'polite' });

    const used = (c) => slots.includes(c);
    function render() {
      const producerPick = h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, t('First guess: who makes its own food from sunlight?')),
        ...cards.map((c) => h('button', { class: 'chip' + (guess === c ? ' on' : ''), type: 'button', style: { minHeight: '56px', fontSize: '1.8rem' }, 'aria-label': t(c[1]), onClick: () => { guess = c; render(); } }, c[0])));
      const row = h('div', { class: 'lab-row', style: { justifyContent: 'center', alignItems: 'center' } },
        h('span', { style: { fontSize: '2rem' }, 'aria-label': t('Sun') }, '☀️'), '➜',
        ...slots.flatMap((c, i) => [h('button', { class: 'btn ghost', type: 'button', style: { minWidth: '64px', minHeight: '72px', fontSize: '2rem' }, 'aria-label': c ? t(c[1]) : t('empty spot'),
          onClick: () => { if (c) { slots[i] = null; render(); } } }, c ? c[0] : '＿'), i < slots.length - 1 ? '➜' : '']));
      const pool = h('div', { class: 'lab-row', style: { justifyContent: 'center' } },
        ...cards.map((c) => h('button', { class: 'btn', type: 'button', disabled: used(c), style: { minWidth: '72px', minHeight: '72px', fontSize: '2rem', flexDirection: 'column', gap: 0 }, onClick: () => {
          const i = slots.indexOf(null); if (i >= 0) { slots[i] = c; render(); } } },
          c[0], h('span', { style: { fontSize: '.65rem' } }, t(c[1])))));
      body.replaceChildren(producerPick, h('div', { class: 'small muted' }, t('Tap animals and plants to fill the arrows. The arrow means “gives energy to”. Tap a filled spot to take it back.')), row, pool,
        h('div', { class: 'lab-row' }, button(t('Check my chain'), check, 'btn gold'), button(t('Clear'), () => { slots.fill(null); render(); }, 'btn ghost sm')), out);
    }
    function check() {
      if (slots.includes(null)) { out.className = 'note'; out.textContent = t('Fill every spot first.'); return; }
      tries++;
      const right = slots.every((c, i) => c === chain[i]);
      if (right) {
        out.className = 'note ok'; out.textContent = t('Yes! The plant is the producer. Each animal gets its energy from the one before it.');
        if (!done) { done = true; const g = guess === chain[0] ? 1 : 0.85; api.say(t('Plants use sunlight to make food. Animals that eat plants, and animals that eat those animals, pass the energy along.')); api.complete(Math.max(0.5, g - (tries - 1) * 0.15), `${chain.map((c) => c[1]).join(' → ')}`); }
      } else {
        const bad = slots.findIndex((c, i) => c !== chain[i]);
        out.className = 'note warn';
        out.textContent = bad === 0 ? t('The chain starts with something that makes its own food from sunlight.') : t('Look again: who eats what comes before it?');
      }
    }
    root.append(body); render();
    api.say(t('Every food chain starts with the Sun and a plant. Who comes next?'));
    return () => {};
  },
};
