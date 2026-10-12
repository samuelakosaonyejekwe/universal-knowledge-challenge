import { h, button, readout, fmt, choice, predict } from '../core/labkit.js';

// land-use types; each cell = 10 ha (0.1 km2)
const T = {
  home:  { e: '🏠', n: 'Homes',     people: 500, co2: 0,    cool: 0 },
  work:  { e: '🏭', n: 'Industry',  people: 0,   co2: 3000, cool: 0 },
  park:  { e: '🌳', n: 'Park',      people: 0,   co2: -80,  cool: 1 },
  solar: { e: '☀️', n: 'Solar',     people: 0,   co2: -1500, cool: 0 },
  bus:   { e: '🚇', n: 'Transit',   people: 0,   co2: 100,  cool: 0 },
};
const KEYS = Object.keys(T);

export default {
  id: 'w07-sustainable-city',
  world: 7,
  levels: [5, 6],
  kind: 'lab',
  icon: '🏙️',
  title: 'Sustainable City Planner',
  goal: 'Paint an 8×8 land-use map that houses enough people with low CO₂ per person and enough green space.',
  limits: 'A toy budget: each cell is 10 ha with fixed average values. Per-person transport emissions fall with transit share, green cells cool the city, and travel distances and energy mixes are not modelled in detail.',
  mount(root, api) {
    const t = api.t, N = 8;
    const needPop = 3000 + Math.floor(api.rng() * 5) * 1000;   // people
    const maxPer = [2.5, 2.0, 1.5][Math.floor(api.rng() * 3)]; // t CO2/person/yr
    const minGreen = 0.2;
    let brush = 'home', done = false;
    const grid = Array.from({ length: N * N }, () => 'park');
    const gEl = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gap: '2px', maxWidth: '360px', margin: '0 auto', touchAction: 'manipulation' } });
    const cells = grid.map((_, i) => h('button', { type: 'button', 'aria-label': 'cell ' + (i + 1), style: { aspectRatio: '1', border: 0, borderRadius: '6px', fontSize: 'clamp(.9rem,4.5vw,1.4rem)', background: '#e6f4ea', cursor: 'pointer', padding: 0 }, onClick: () => { grid[i] = brush; update(); } }));
    gEl.append(...cells);
    const brushes = choice(KEYS.map(k => [k, `${T[k].e} ${t(T[k].n)}`]), brush, v => { brush = v; });
    const rPop = readout(t('Residents')), rCo = readout(t('CO₂ per person (t/yr)')), rG = readout(t('Green share')), rH = readout(t('Heat island ΔT (°C)'));
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const pr = predict({ question: t('Predict: people housed if 20 cells are homes (500 per cell)'), unit: '', truth: () => 20 * 500, tolerance: 0.05 });
    function metrics() {
      const c = k => grid.filter(g => g === k).length;
      const pop = c('home') * T.home.people;
      const share = c('bus') / (N * N);
      const transport = pop * 1.2 * Math.max(0.3, 1 - share * 8);   // t CO2/yr from travel
      const heating = pop * 0.8;
      const net = c('work') * T.work.co2 + c('solar') * T.solar.co2 + c('park') * T.park.co2 + c('bus') * T.bus.co2 + transport + heating;
      const per = pop ? net / pop : Infinity;
      const green = c('park') / (N * N);
      const built = (c('home') + c('work') + c('bus')) / (N * N);
      const dT = 4 * built - 3 * green;
      return { pop, per, green, dT };
    }
    function update() {
      cells.forEach((b, i) => { b.textContent = T[grid[i]].e; });
      const m = metrics();
      rPop.set(fmt(m.pop)); rCo.set(m.pop ? fmt(m.per, 3) : '–'); rG.set(fmt(m.green * 100, 3) + '%'); rH.set(fmt(m.dT, 2));
      const ok = m.pop >= needPop && m.per <= maxPer && m.green >= minGreen;
      if (ok) {
        msg.className = 'note ok'; msg.textContent = t('Your city meets all three targets.');
        if (!done) { done = true; api.say(t('Compact homes with transit, clean power and green space can house people with less carbon, and trees help cool the streets.')); api.complete(Math.min(1, 0.7 + (maxPer - m.per) / maxPer * 0.5), t('Balanced housing, emissions and green space in a city plan.')); }
      } else { msg.className = 'note'; msg.textContent = (m.pop < needPop ? '🏠 ' + t('more homes') + ' · ' : '') + (m.per > maxPer ? '🌫️ ' + t('cut CO₂ (solar, transit, fewer factories)') + ' · ' : '') + (m.green < minGreen ? '🌳 ' + t('more green') : ''); }
    }
    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Targets') + `: ≥ ${needPop} ` + t('residents') + `, ≤ ${maxPer} t CO₂/` + t('person') + '/yr, ≥ 20% ' + t('green') + '.'),
      brushes.el, gEl, h('div', { class: 'lab-row' }, rPop.el, rCo.el, rG.el, rH.el), msg, pr,
      h('div', { class: 'row' }, button('↺ ' + t('Clear to parks'), () => { grid.fill('park'); update(); }, 'btn ghost'))));
    update();
    return () => {};
  },
};
