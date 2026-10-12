import { h, button, predict, readout, fmt } from '../core/labkit.js';

const SITES = [
  { e: '🏥', n: 'Clinic', ppl: 40, crit: 0.3 },
  { e: '🏢', n: 'Care flats', ppl: 60, crit: 0.4 },
  { e: '🏫', n: 'School shelter', ppl: 120, crit: 0.5 },
  { e: '🏘️', n: 'Low street', ppl: 80, crit: 0.35 },
  { e: '🏪', n: 'Market', ppl: 30, crit: 0.7 },
];
const TURNS = 8, CREWS = 3, PUMP = 0.15;
export function simulate(rates, plan) {
  const d = SITES.map(() => 0); let exp = 0;
  for (let k = 0; k < TURNS; k++) {
    d.forEach((_, i) => { d[i] = Math.max(0, d[i] + rates[i] * (k >= 3 && k <= 4 ? 1.6 : 1) - PUMP * (plan[k]?.[i] || 0)); if (d[i] > SITES[i].crit) exp += SITES[i].ppl; });
  }
  return exp;
}

const LAB = {
  id: 'w19-crisis',
  world: 19,
  levels: [5, 6],
  kind: 'lab',
  icon: '🌊',
  title: 'Flood Response Desk',
  goal: 'Send three crews each turn to hold back rising water so as few people as possible are in flooded buildings over eight turns.',
  limits: 'Each turn water in a site rises by a fixed rate (m) and a crew removes 0.15 m; the storm surge on turns 4 and 5 speeds the rise by 60%. Real floods depend on terrain, drains, rainfall forecasts and many more resources. There is no single right plan, and the numbers are invented.',
  mount(root, api) {
    const t = api.t, r = api.rng;
    const rates = SITES.map(() => +(0.06 + r() * 0.1).toFixed(2));
    const worst = SITES.reduce((m, s, i) => (s.ppl > SITES[m].ppl ? i : m), 0);
    let turn = 0, exposure = 0, done = false, asked = false;
    const depth = SITES.map(() => 0), alloc = SITES.map(() => 0), plan = [];
    const maxExp = TURNS * SITES.reduce((a, s) => a + s.ppl, 0);
    const turnR = readout(t('Turn'), '1 / ' + TURNS), left = readout(t('Crews left'), String(CREWS)), exR = readout(t('People-turns flooded'), '0');
    const rows = SITES.map((s, i) => {
      const bar = h('div', { style: { height: '10px', borderRadius: '5px', background: '#3a86d9', width: '0%' } });
      const crit = h('div', { style: { position: 'absolute', top: '-2px', bottom: '-2px', width: '3px', background: '#d9485f', left: '0%' } });
      const cnt = h('b', null, '0');
      const val = h('span', { class: 'small' });
      const el = h('div', { class: 'card', style: { padding: '.4rem .6rem' } },
        h('div', { class: 'lab-row' }, h('span', null, `${s.e} ${t(s.n)} (${s.ppl} ${t('people')})`), h('span', { style: { marginInlineStart: 'auto' } }, button('−', () => add(i, -1)), ' ', cnt, ' ', button('+', () => add(i, 1)))),
        h('div', { style: { position: 'relative', background: 'var(--soft)', borderRadius: '5px', height: '10px', marginTop: '.3rem' } }, bar, crit), val);
      return { el, bar, crit, cnt, val };
    });
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const go = button('▶ ' + t('Run this turn'), () => run(), 'btn');
    const pred = predict({ question: t(`With no help, after how many turns does the ${SITES[worst].n} flood? (flood = deeper than the red line)`), unit: t('turns (0 = never)'), truth: () => { let d = 0; for (let k = 0; k < TURNS; k++) { d += rates[worst] * (k >= 3 && k <= 4 ? 1.6 : 1); if (d > SITES[worst].crit + 1e-9) return k + 1; } return 0; }, tolerance: 0.01, onResult: () => { asked = true; api.say(t('Add the rise each turn (rate in m, 60% more during the surge on turns 4 and 5) until the total passes the red line.')); } });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), pred, h('div', { class: 'lab-row' }, turnR.el, left.el, exR.el), ...rows.map((x) => x.el), go, status));
    draw();

    function add(i, d) {
      const used = alloc.reduce((a, b) => a + b, 0);
      if (d > 0 && used >= CREWS) return;
      alloc[i] = Math.max(0, alloc[i] + d); draw();
    }
    function draw() {
      left.set(String(CREWS - alloc.reduce((a, b) => a + b, 0)));
      rows.forEach((x, i) => {
        const sc = 1.2; x.bar.style.width = Math.min(100, depth[i] / sc * 100) + '%'; x.crit.style.left = SITES[i].crit / sc * 100 + '%';
        x.cnt.textContent = String(alloc[i]); x.val.textContent = `${fmt(depth[i], 2)} m, ${t('next rise')} +${fmt(rates[i] * (turn >= 3 && turn <= 4 ? 1.6 : 1), 2)} m`;
        x.bar.style.background = depth[i] > SITES[i].crit ? '#d9485f' : '#3a86d9';
      });
    }
    function run() {
      if (done) return;
      if (!asked) { status.className = 'note warn'; status.textContent = t('Make your prediction first.'); return; }
      plan.push([...alloc]);
      let flooded = [];
      depth.forEach((_, i) => { depth[i] = Math.max(0, depth[i] + rates[i] * (turn >= 3 && turn <= 4 ? 1.6 : 1) - PUMP * alloc[i]); if (depth[i] > SITES[i].crit) { exposure += SITES[i].ppl; flooded.push(SITES[i].n); } });
      turn++; alloc.fill(0);
      exR.set(String(exposure)); turnR.set(Math.min(turn + 1, TURNS) + ' / ' + TURNS);
      status.className = 'note'; status.textContent = flooded.length ? t('Flooded this turn') + ': ' + flooded.map(t).join(', ') : t('Nothing flooded this turn.');
      if (turn === 3) api.say(t('A storm surge is coming: the water will rise 60% faster for the next two turns.'));
      draw();
      if (turn >= TURNS) finish();
    }
    function finish() {
      done = true; go.disabled = true;
      const bad = simulate(rates, []), frac = exposure / bad, score = Math.max(0, 1 - exposure / (bad * 0.5));
      status.className = 'note ' + (exposure <= bad * 0.4 ? 'ok' : 'warn');
      status.textContent = t(`${exposure} people-turns flooded, compared with ${bad} if nobody had helped (${Math.round(frac * 100)}%).`);
      api.say(t('Crews matter most where the most people are at risk and where the water is about to cross the line. Waiting until after the line is crossed is too late, because you must also pump the water back down.'));
      if (exposure <= bad * 0.4) api.complete(Math.min(1, 0.7 + score * 0.3), t('Prioritised crews to protect the most people.'));
      else root.firstChild.append(button(t('Try again'), () => { turn = 0; exposure = 0; done = false; go.disabled = false; depth.fill(0); exR.set('0'); turnR.set('1 / ' + TURNS); status.textContent = ''; draw(); }, 'btn ghost'));
    }
    return () => {};
  },
};
export default LAB;
