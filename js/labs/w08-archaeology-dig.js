import { h, button } from '../core/labkit.js';

const COLS = 5, ROWS = 4;
// Finds by layer (1 = top = youngest). Fictional site, general reasoning about stratigraphy.
const FINDS = [
  [['🔩', 'iron nail'], ['🥫', 'tin can lid'], ['🪙', 'coin']],
  [['🏺', 'glazed pot piece'], ['🪙', 'coin'], ['🧵', 'woven cloth scrap']],
  [['🪡', 'bronze needle'], ['🏺', 'plain clay pot piece'], ['🦴', 'animal bone']],
  [['🪨', 'stone scraper'], ['🔥', 'charcoal from a hearth'], ['🐚', 'shell bead']],
];

export default {
  id: 'w08-archaeology-dig',
  world: 8,
  levels: [3, 4],
  kind: 'lab',
  icon: '🏺',
  title: 'Archaeology Dig',
  goal: 'Dig down through the layers, record what you find, then reason about which things are older and what the evidence really tells us.',
  limits: 'A fictional site with neat flat layers. Real layers can be tilted, mixed by digging animals or builders, or upside down, so archaeologists combine many kinds of evidence (such as radiocarbon dating) with careful written records.',
  mount(root, api) {
    const t = api.t;
    const cells = []; // [row][col] = {dug, find}
    for (let r = 0; r < ROWS; r++) { cells.push([]); for (let c = 0; c < COLS; c++) cells[r].push({ dug: false, find: api.rng() < 0.7 ? FINDS[r][Math.floor(api.rng() * 3)] : null }); }
    const coinYear = 1400 + Math.floor(api.rng() * 8) * 50;
    let dugCount = 0, phase = 'dig', qi = 0, right = 0, done = false;
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '3px', maxWidth: '340px', margin: '0 auto' } });
    const notebook = h('div', { class: 'small' });
    const qBox = h('div', { class: 'card', style: { display: 'none' } });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const layerCol = ['#d8b98a', '#c19a63', '#a67c4a', '#8a6038'];
    const els = cells.map((row, r) => row.map((c, k) => h('button', { type: 'button', 'aria-label': `layer ${r + 1}, column ${k + 1}`, style: { aspectRatio: '1', border: 0, borderRadius: '6px', fontSize: '1.4rem', cursor: 'pointer', padding: 0, background: layerCol[r], opacity: 1 }, onClick: () => dig(r, k) })));
    els.forEach(row => grid.append(...row));
    function draw() {
      cells.forEach((row, r) => row.forEach((c, k) => {
        const b = els[r][k];
        const open = r === 0 || cells[r - 1][k].dug;
        b.textContent = c.dug ? (c.find ? c.find[0] : '·') : (open ? '🖌️' : '');
        b.style.background = c.dug ? '#f2e6cf' : layerCol[r];
        b.style.opacity = c.dug || open ? 1 : .55;
      }));
      const log = cells.flatMap((row, r) => row.filter(c => c.dug && c.find).map(c => `${c.find[0]} ${t(c.find[1])} (${t('layer')} ${r + 1})`));
      notebook.textContent = '📒 ' + (log.length ? log.join(' · ') : t('Notebook is empty. Tap a brush to dig.'));
    }
    function dig(r, k) {
      if (phase !== 'dig') return;
      if (r > 0 && !cells[r - 1][k].dug) { msg.className = 'note warn'; msg.textContent = t('Dig the layer above first: it lies on top, so it is younger.'); return; }
      if (cells[r][k].dug) return;
      cells[r][k].dug = true; dugCount++;
      msg.className = 'note'; msg.textContent = cells[r][k].find ? `${cells[r][k].find[0]} ${t('Found')}: ${t(cells[r][k].find[1])}.` : t('Only soil here.');
      draw();
      if (dugCount >= 8 && phase === 'dig') { phase = 'quiz'; ask(); }
    }
    function ask() {
      qBox.style.display = '';
      const qs = [
        { q: t('The stone scraper was in layer 4 and the iron nail in layer 1. Which is probably older?'), o: [t('Stone scraper'), t('Iron nail')], a: 0, why: t('Deeper layers were laid down earlier (the law of superposition), as long as the ground is undisturbed.') },
        { q: t('A coin stamped') + ` ${coinYear} ` + t('CE was found in layer 2. What does that show about layer 2?'), o: [t('It formed before') + ' ' + coinYear, t('It formed in or after') + ' ' + coinYear, t('It is exactly') + ' ' + coinYear + ' ' + t('years old')], a: 1, why: t('A coin cannot be buried before it is made, so the layer is no older than the coin. It may be much younger.') },
        { q: t('A diary written by someone who lived at the site and a story written 500 years later disagree. Which is usually stronger evidence?'), o: [t('The later story'), t('The diary, being a primary source')], a: 1, why: t('Primary sources come from the time. Later accounts can be useful but should be checked against other evidence.') },
      ];
      const show = () => {
        const q = qs[qi];
        qBox.replaceChildren(h('b', null, `${qi + 1}/${qs.length} · ` + q.q), ...q.o.map((o, i) => h('div', { style: { marginTop: '.4rem' } }, button(o, () => {
          const ok = i === q.a; if (ok) right++;
          msg.className = 'note ' + (ok ? 'ok' : 'warn'); msg.textContent = (ok ? '✅ ' : '🔁 ') + q.why; api.say(q.why);
          qi++;
          if (qi >= qs.length) { qBox.style.display = 'none'; if (!done) { done = true; api.complete(right / qs.length, t('Used layers and sources to reason about the past.')); } } else show();
        }, 'btn ghost'))));
      };
      show();
    }
    root.append(h('div', { class: 'lab' }, h('div', { class: 'small' }, '⬆️ ' + t('Layer 1 (top, newest)') + '  ·  ⬇️ ' + t('Layer 4 (deepest, oldest)')), grid, notebook, qBox, msg));
    draw();
    return () => {};
  },
};
