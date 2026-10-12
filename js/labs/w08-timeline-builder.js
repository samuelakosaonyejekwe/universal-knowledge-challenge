import { h, button } from '../core/labkit.js';

// [emoji, label, year (negative = BCE), place]. Approximate, well-established dates.
const EV = [
  ['🎨', 'Cave paintings at Lascaux, France', -17000, 'Europe'],
  ['🌾', 'Farming begins in the Fertile Crescent', -9000, 'Asia'],
  ['🔺', 'Great Pyramid of Giza built', -2560, 'Africa'],
  ['🏛️', 'Parthenon built in Athens', -440, 'Europe'],
  ['🧱', 'Great Wall begun under Qin Shi Huang', -220, 'Asia'],
  ['🗿', 'Teotihuacan Pyramid of the Sun built', 150, 'Americas'],
  ['🕌', 'House of Wisdom in Baghdad flourishes', 830, 'Asia'],
  ['🏔️', 'Machu Picchu built by the Inca', 1450, 'Americas'],
  ['📖', 'Gutenberg prints with movable type', 1450, 'Europe'],
  ['🦁', 'Mansa Musa travels from Mali to Mecca', 1324, 'Africa'],
  ['🛶', 'Polynesian voyagers reach New Zealand', 1280, 'Oceania'],
  ['⚙️', 'Steam power spreads in the Industrial Revolution', 1780, 'Europe'],
  ['🇺🇳', 'The United Nations is founded', 1945, 'World'],
  ['🌐', 'The World Wide Web is invented', 1989, 'Europe'],
];
const yr = y => y < 0 ? `${-y} BCE` : `${y} CE`;

export default {
  id: 'w08-timeline-builder',
  world: 8,
  levels: [1, 2],
  kind: 'lab',
  icon: '⏳',
  title: 'Timeline Builder',
  goal: 'Put the events in order from longest ago to most recent: tap two cards to swap them.',
  limits: 'Dates are rounded and some are approximate (for example the first farming and the cave paintings). Only a few well-known events from several continents are shown, and history has many more stories.',
  mount(root, api) {
    const t = api.t;
    const n = api.level <= 1 ? 4 : 5;
    const pool = [...EV].sort(() => api.rng() - 0.5);
    const picked = [];
    for (const e of pool) { if (!picked.some(p => Math.abs(p[2] - e[2]) < 150) && !picked.some(p => p[3] === e[3] && picked.length < 3)) picked.push(e); if (picked.length === n) break; }
    for (const e of pool) { if (picked.length === n) break; if (!picked.includes(e) && !picked.some(p => Math.abs(p[2] - e[2]) < 150)) picked.push(e); }
    let order = [...picked].sort(() => api.rng() - 0.5);
    if (order.every((e, i, a) => !i || a[i - 1][2] <= e[2])) order.reverse();
    let sel = -1, done = false, checked = false;
    const list = h('div', { class: 'lab-grid', role: 'list' });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const arrow = h('div', { class: 'small', style: { display: 'flex', justifyContent: 'space-between', fontWeight: 800 } }, h('span', null, '⬆️ ' + t('Long ago')), h('span', null, t('Recent') + ' ⬇️'));
    function draw() {
      list.replaceChildren(...order.map((e, i) => h('button', { type: 'button', role: 'listitem', class: 'chip' + (sel === i ? ' on' : ''), style: { justifyContent: 'flex-start', minHeight: '56px', fontSize: '1rem', textAlign: 'start', borderRadius: '14px', width: '100%' }, onClick: () => tap(i) },
        h('span', { style: { fontSize: '1.7rem' } }, e[0]), h('span', null, t(e[1]), checked ? h('small', { style: { display: 'block', opacity: .8 } }, yr(e[2]) + ' · ' + t(e[3])) : null))));
    }
    function tap(i) {
      if (done) return;
      if (sel < 0) sel = i; else { [order[sel], order[i]] = [order[i], order[sel]]; sel = -1; }
      draw();
    }
    function check() {
      checked = true;
      const sorted = [...order].sort((a, b) => a[2] - b[2]);
      const good = order.filter((e, i) => e === sorted[i]).length;
      draw();
      if (good === n) {
        done = true; msg.className = 'note ok'; msg.textContent = t('Perfect order! Timelines show what came before and after.');
        api.say(t('Events happened all over the world at the same time. Dates help us line up many people\'s stories.'));
        api.complete(1, t('Ordered historical events from several continents.'));
      } else { msg.className = 'note warn'; msg.textContent = `${good}/${n} ` + t('in the right place. Swap some cards and check again.'); checked = false; draw(); }
    }
    root.append(h('div', { class: 'lab' }, arrow, list, h('div', { class: 'lab-row', style: { justifyContent: 'center' } }, button('✔ ' + t('Check'), check, 'btn ok')), msg));
    draw();
    return () => {};
  },
};
