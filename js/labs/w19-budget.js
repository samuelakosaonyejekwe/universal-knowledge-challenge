import { h, slider, readout, choice, fmt } from '../core/labkit.js';

const AREAS = [['🏥', 'Health', 18], ['📚', 'Schools', 18], ['🚌', 'Transport', 14], ['🌳', 'Parks and nature', 10], ['🏠', 'Housing help', 16], ['🔧', 'Repairs', 12]];
const CRIT = ['Services', 'Fairness', 'Sustainability', 'Balance'];
const sat = (x, k) => 1 - Math.exp(-x / k);
export function scores(x) {
  const s = x.map((v, i) => sat(v, AREAS[i][2]));
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  return [mean(s), Math.min(...s), mean([s[2], s[3], s[5]]), 1 - (Math.max(...s) - Math.min(...s))];
}

const LAB = {
  id: 'w19-budget',
  world: 19,
  levels: [3, 4],
  kind: 'lab',
  icon: '💰',
  title: 'City Budget Allocator',
  goal: 'Spend all 60 coins across six services so the town meets every target on four transparent measures.',
  limits: 'Each service has smoothly diminishing returns, 1 − e^(−coins/k), with invented values of k. Real budgets involve debt, taxes, local costs and values that people disagree about; there is no single correct split here, and no party or policy is endorsed.',
  mount(root, api) {
    const t = api.t, r = api.rng;
    const targets = [0.48, 0.3, 0.55, 0.5], focus = Math.floor(r() * 4); targets[focus] = [0.5, 0.42, 0.6, 0.75][focus];
    let done = false, guessed = false;
    const vals = AREAS.map(() => 10);
    const sl = AREAS.map((a, i) => slider({ label: `${a[0]} ${t(a[1])}`, min: 0, max: 30, step: 1, value: Math.round(vals[i]), unit: t('coins'), onInput: () => upd() }));
    const left = readout(t('Coins left'), '–');
    const bars = CRIT.map((c, i) => { const f = h('div', { style: { height: '100%', width: '0%', borderRadius: '6px', background: 'var(--pri)', transition: api.reducedMotion ? 'none' : 'width .2s' } }); const tick = h('div', { style: { position: 'absolute', left: targets[i] * 100 + '%', top: '-3px', bottom: '-3px', width: '3px', background: '#e0891b' } }); const v = h('span', { class: 'small' }); return { f, v, el: h('div', null, h('div', { class: 'small' }, t(c) + ' ', v), h('div', { style: { position: 'relative', height: '14px', background: 'var(--soft)', borderRadius: '6px' } }, f, tick)) }; });
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const pickC = choice(CRIT.map((c, i) => [i, t(c)]), null, (v) => { guessed = true; const s = scores(sl.map((x) => x.value)); const low = s.indexOf(Math.min(...s)); status.textContent = v === low ? t('Right: that one is lowest with the starting split.') : t('Not quite: ') + t(CRIT[low]) + t(' is lowest right now.'); upd(); });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)),
      h('div', { class: 'small' }, t('Predict: with the starting split, which measure is lowest?')), pickC.el,
      ...sl.map((s) => s.el), left.el, ...bars.map((b) => b.el),
      h('div', { class: 'small' }, t('Services = average satisfaction. Fairness = the worst-served area. Sustainability = transport, parks and repairs. Balance = 1 minus the gap between best and worst. Orange marks are the targets.')), status));
    upd();

    function upd() {
      const x = sl.map((s) => s.value), total = x.reduce((p, q) => p + q, 0), s = scores(x);
      left.set(String(60 - total));
      s.forEach((v, i) => { bars[i].f.style.width = Math.max(0, v) * 100 + '%'; bars[i].v.textContent = fmt(v * 100, 2) + '% / ' + Math.round(targets[i] * 100) + '%'; bars[i].f.style.background = v >= targets[i] ? '#17a673' : 'var(--pri)'; });
      if (!done && guessed && total === 60 && s.every((v, i) => v >= targets[i])) {
        done = true; status.className = 'note ok';
        status.textContent = t('Every target met. Other splits could work too: you chose which trade-offs to make.');
        api.say(t('Spending more on one area has smaller and smaller benefits, so a spread usually beats putting everything in one place. Different towns might still choose differently.'));
        api.complete(0.8 + 0.2 * Math.min(1, (Math.min(...s.map((v, i) => v - targets[i])) / 0.1)), t('Balanced four measures with a fixed budget.'));
      } else if (total > 60) { status.className = 'note warn'; status.textContent = t('Over budget. Take some coins back.'); }
    }
    return () => {};
  },
};
export default LAB;
