import { h, slider, readout, button, choice, fmt, predict } from '../core/labkit.js';

// Approximate overland / sea-lane distances (km) between stops. Rounded; routes were networks, not single lines.
const ROUTES = {
  silk: { n: 'Silk Roads', icon: '🐪', mode: 'caravan', v: 30, stops: [
    ['Chang\'an (Xi\'an), China', 0, 'Silk, paper and tea began their journeys west from this great capital.'],
    ['Dunhuang, China', 1700, 'Oasis gateway to the deserts, famous for Buddhist cave art.'],
    ['Samarkand, Central Asia', 2800, 'Sogdian merchants ran trade and carried ideas and languages along the route.'],
    ['Baghdad, Iraq', 2300, 'A centre of learning and a market for goods from three continents.'],
    ['Antioch, Mediterranean coast', 900, 'Goods reached Mediterranean ports and then travelled on by sea.'] ] },
  sahara: { n: 'Trans-Saharan routes', icon: '🐫', mode: 'caravan', v: 25, stops: [
    ['Sijilmasa, Morocco', 0, 'A northern desert-edge city where caravans prepared for the crossing.'],
    ['Taghaza, Sahara', 750, 'A salt-mining settlement: salt was prized in the south.'],
    ['Timbuktu, Mali', 800, 'A market and a famous centre of scholars and manuscripts.'],
    ['Gao, Songhai', 400, 'A trading city on the Niger River, linked to West African gold.'] ] },
  ocean: { n: 'Indian Ocean trade', icon: '⛵', mode: 'dhow', v: 120, stops: [
    ['Kilwa, East Africa', 0, 'Swahili coast port trading gold, ivory and timber.'],
    ['Aden, Arabia', 3700, 'Ships waited here for the right monsoon wind.'],
    ['Calicut, India', 3000, 'A spice port: pepper and cotton cloth.'],
    ['Malacca, Southeast Asia', 2600, 'A strait where sailors from many lands met.'],
    ['Guangzhou, China', 2800, 'Porcelain and silk were loaded for the return voyage.'] ] },
};

export default {
  id: 'w08-trade-routes',
  world: 8,
  levels: [5, 6],
  kind: 'tour',
  icon: '🗺️',
  title: 'Trade Route Planner',
  goal: 'Tour a historic trade route stop by stop, then plan the journey: set your daily distance and rest days to arrive before the deadline.',
  limits: 'Real trade was a web of many roads and sea lanes, carried out by many peoples, usually in relays rather than one traveller going end to end. Distances are rounded approximations and speeds are typical averages (monsoon winds, weather and danger changed everything).',
  mount(root, api) {
    const t = api.t;
    const keys = Object.keys(ROUTES);
    let key = keys[Math.floor(api.rng() * keys.length)], si = 0, daily = 0, rest = 2, done = false, deadline = 0;
    const tourBox = h('div', { class: 'card' });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const rTot = readout(t('Distance (km)')), rDays = readout(t('Journey (days)')), rDL = readout(t('Deadline (days)'));
    let sd, sr;
    const total = () => ROUTES[key].stops.reduce((s, x) => s + x[1], 0);
    const days = () => total() / daily + rest * (ROUTES[key].stops.length - 1);
    const pick = choice(keys.map(k => [k, ROUTES[k].icon + ' ' + t(ROUTES[k].n)]), key, v => { key = v; setup(); });
    function drawTour() {
      const R = ROUTES[key], s = R.stops[si];
      tourBox.replaceChildren(
        h('div', { class: 'small muted' }, `${t('Stop')} ${si + 1}/${R.stops.length}`),
        h('h3', { style: { margin: '.2rem 0' } }, R.icon + ' ' + t(s[0])),
        h('p', null, t(s[2])), si ? h('p', { class: 'small' }, `↤ ${s[1]} km ${t('from the previous stop')}`) : null,
        h('div', { class: 'lab-row' }, button('◀', () => { si = Math.max(0, si - 1); drawTour(); }), h('span', { style: { flex: 1, display: 'flex', gap: '4px', justifyContent: 'center' } }, ...R.stops.map((_, i) => h('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: i <= si ? 'var(--pri, #55f)' : '#ccd' } }))), button('▶', () => { si = Math.min(R.stops.length - 1, si + 1); drawTour(); })));
    }
    function setup() {
      si = 0; const R = ROUTES[key];
      daily = R.v; rest = 2;
      const base = total() / R.v + 2 * (R.stops.length - 1);
      deadline = Math.round(base * (0.8 + api.rng() * 0.3) / 5) * 5;
      sd = slider({ label: t(R.mode === 'dhow' ? 'Distance sailed per day' : 'Distance per travel day'), min: Math.round(R.v * 0.6), max: Math.round(R.v * 1.8), step: 1, value: R.v, unit: 'km/day', onInput: v => { daily = v; update(); } });
      sr = slider({ label: t('Rest days at each stop'), min: 0, max: 6, step: 1, value: 2, unit: t('days'), onInput: v => { rest = v; update(); } });
      ctl.replaceChildren(sd.el, sr.el);
      rTot.set(fmt(total())); rDL.set(String(deadline)); drawTour(); update();
    }
    function update() { rDays.set(fmt(days(), 3)); check(); }
    function check() {
      const D = days();
      if (D <= deadline) { msg.className = 'note ok'; msg.textContent = t('You make it in time!') + ` ${fmt(D, 3)} ≤ ${deadline}.`;
        if (!done) { done = true; api.say(t('Travel time = distance ÷ speed, plus time resting at stops. Faster days may mean more risk to animals and travellers, so merchants balanced speed with safety.')); api.complete(Math.min(1, 0.7 + 0.1 * rest), t('Planned a journey along a historic trade route.')); } }
      else { msg.className = 'note warn'; msg.textContent = t('Too slow: it takes') + ` ${fmt(D, 3)} ${t('days')}, ${t('deadline')} ${deadline}.`; }
    }
    const ctl = h('div', { class: 'lab' });
    const pr = predict({ question: t('Predict: days of pure travel for the whole route at the default speed'), unit: t('days'), tolerance: 0.1, truth: () => total() / ROUTES[key].v });
    root.append(h('div', { class: 'lab' }, pick.el, tourBox, ctl, h('div', { class: 'lab-row' }, rTot.el, rDays.el, rDL.el), msg, pr));
    setup();
    return () => {};
  },
};
