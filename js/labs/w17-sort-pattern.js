import { h, button } from '../core/labkit.js';

const RULES = {
  colour: { bins: [['🔴', 'red'], ['🔵', 'blue']], make: (r) => { const k = r() < 0.5 ? 0 : 1; return { e: ['🔴', '🔵'][k], size: 2 + r() * 1.5, bin: k }; }, why: 'Every item went in the bin with the same colour.' },
  size: { bins: [['🐘', 'big'], ['🐭', 'small']], make: (r) => { const k = r() < 0.5 ? 0 : 1; return { e: ['🟣', '🟡', '🟢'][Math.floor(r() * 3)], size: k ? 1.4 : 3.8, bin: k }; }, why: 'Only the size matters here, not the colour.' },
  kind: { bins: [['🐶', 'animal'], ['🍎', 'fruit']], make: (r) => { const k = r() < 0.5 ? 0 : 1; const a = [['🐱', '🐰', '🐸'], ['🍌', '🍇', '🍓']][k]; return { e: a[Math.floor(r() * 3)], size: 3, bin: k }; }, why: 'Animals go together and fruits go together.' },
};
const SYMS = ['🔺', '🟦', '⭐', '❤️', '🌙'];

const LAB = {
  id: 'w17-sort-pattern',
  world: 17,
  levels: [1, 2],
  kind: 'lab',
  icon: '🧺',
  title: 'Sort and Spot',
  goal: 'Put each thing in the right basket, then find what comes next in the pattern.',
  limits: 'Only one simple rule at a time (colour, size or kind) and short repeating patterns. Real sorting often has several rules at once, and many patterns have more than one answer.',
  mount(root, api) {
    const t = api.t, r = api.rng;
    const rule = RULES[['colour', 'size', 'kind'][Math.floor(r() * 3)]];
    let n = 0, right = 0, cur = null, phase = 'sort', pRound = 0, pRight = 0, locked = false, timer = 0;
    const stage = h('div', { style: { minHeight: '110px', display: 'grid', placeItems: 'center' } });
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const bins = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    const prog = h('div', { class: 'small muted', style: { textAlign: 'center' } });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), prog, stage, bins, status));

    function nextSort() {
      if (n >= 8) return startPattern();
      cur = rule.make(r); locked = false;
      stage.replaceChildren(h('div', { style: { fontSize: cur.size + 'rem', lineHeight: 1 } }, cur.e));
      prog.textContent = `${n + 1} / 8`;
      status.className = 'note'; status.textContent = t('Which basket? Tap one.');
      bins.replaceChildren(...rule.bins.map(([e, name], i) => h('button', { class: 'btn ghost', type: 'button', 'aria-label': t(name), style: { fontSize: '2.4rem', minWidth: '110px', minHeight: '84px' }, onClick: () => pick(i) }, e)));
    }
    function pick(i) {
      if (locked || phase !== 'sort') return; locked = true;
      const ok = i === cur.bin; if (ok) right++; n++;
      status.className = 'note ' + (ok ? 'ok' : 'warn'); status.textContent = ok ? '🎉 ' + t('Yes!') : '🤔 ' + t('Not that one. Look again next time!');
      timer = setTimeout(nextSort, api.reducedMotion ? 400 : 800);
    }
    function startPattern() {
      phase = 'pattern'; api.say(t(rule.why));
      nextPattern();
    }
    function nextPattern() {
      if (pRound >= 3) return finish();
      const pool = [...SYMS].sort(() => r() - 0.5);
      const kind = pRound === 0 ? [0, 1] : pRound === 1 ? [0, 0, 1] : [0, 1, 2];
      const seq = []; for (let i = 0; i < 5; i++) seq.push(pool[kind[i % kind.length]]);
      const ans = seq.pop(); locked = false;
      const opts = [ans, ...pool.filter((s) => s !== ans).slice(0, 2)].sort(() => r() - 0.5);
      stage.replaceChildren(h('div', { style: { fontSize: '2.2rem', display: 'flex', gap: '.4rem', flexWrap: 'wrap', justifyContent: 'center' } }, ...seq.map((s) => h('span', null, s)), h('span', null, '❓')));
      prog.textContent = t('Pattern') + ` ${pRound + 1} / 3`;
      status.className = 'note'; status.textContent = t('What comes next?');
      bins.replaceChildren(...opts.map((s) => h('button', { class: 'btn ghost', type: 'button', style: { fontSize: '2.2rem', minWidth: '84px', minHeight: '84px' }, onClick: () => {
        if (locked) return; locked = true;
        const ok = s === ans; if (ok) pRight++; pRound++;
        status.className = 'note ' + (ok ? 'ok' : 'warn');
        status.textContent = ok ? '🎉 ' + t('Yes! The pattern repeats.') : '🤔 ' + t('The pattern repeats, so the answer was') + ' ' + ans;
        timer = setTimeout(nextPattern, 900);
      } }, s)));
    }
    function finish() {
      const score = (right / 8 * 0.6 + pRight / 3 * 0.4);
      stage.replaceChildren(h('div', { style: { fontSize: '3rem' } }, '🏆'));
      bins.replaceChildren(); prog.textContent = '';
      status.className = 'note ok'; status.textContent = t(`Sorted ${right} of 8 and found ${pRight} of 3 patterns!`);
      api.say(t('Patterns are things that repeat. Spotting a rule lets you guess what comes next.'));
      if (score >= 0.7) api.complete(score, t('Sorted by a rule and continued patterns.'));
      else { bins.replaceChildren(button(t('Try again'), () => { n = 0; right = 0; pRound = 0; pRight = 0; phase = 'sort'; nextSort(); }, 'btn')); }
    }
    nextSort();
    return () => clearTimeout(timer);
  },
};
export default LAB;
