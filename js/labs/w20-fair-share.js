import { h, button, choice } from '../core/labkit.js';

const KIDS = ['🐻', '🐰', '🦊'];
const LAB = {
  id: 'w20-fair-share',
  world: 20,
  levels: [1, 2],
  kind: 'lab',
  icon: '🍪',
  title: 'Fair Share',
  goal: 'Share the cookies. First say what you think fair means, then share in a way that matches.',
  limits: 'Only two simple ideas of fairness (same for everyone, and more for who needs more). People also think about effort, promises and other ideas. Neither idea is declared the winner here.',
  mount(root, api) {
    const t = api.t, r = api.rng;
    const total = 6 + Math.floor(r() * 2) * 3;
    const hungry = Math.floor(r() * 3);
    const rounds = [{ need: false, text: 'Everybody is hungry in the same way.' }, { need: true, text: 'This friend has had no lunch today!' }];
    let ri = 0, idea = null, results = [], locked = false;
    const give = [0, 0, 0];
    const ideaC = choice([['same', '⚖️ ' + t('Same for all')], ['need', '❤️ ' + t('More for who needs')]], null, (v) => { idea = v; status.className = 'note'; status.textContent = t('Now share the cookies.'); });
    const row = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    const left = h('div', { class: 'lab-goal', style: { textAlign: 'center', fontSize: '1.2rem' } });
    const sit = h('div', { class: 'card', style: { textAlign: 'center' } });
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const done = button('✔ ' + t('Done sharing'), () => finish(), 'btn ok');
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), sit, h('div', { class: 'small' }, t('What is fair?')), ideaC.el, left, row, done, status));
    start();

    function start() {
      give.fill(0); locked = false; idea = null; ideaC.el.querySelectorAll('.chip').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
      sit.textContent = `${t('Round')} ${ri + 1}/2. ${t(rounds[ri].text)}` + (rounds[ri].need ? ` ${KIDS[hungry]}` : '');
      status.className = 'note'; status.textContent = t('Pick what you think fair means first.'); draw();
    }
    function draw() {
      const used = give.reduce((a, b) => a + b, 0);
      left.textContent = '🍪'.repeat(total - used) || '✔';
      row.replaceChildren(...KIDS.map((k, i) => h('div', { class: 'card', style: { textAlign: 'center', minWidth: '90px' } },
        h('div', { style: { fontSize: '2.2rem' } }, k + (rounds[ri].need && i === hungry ? '😋' : '')), h('div', { style: { minHeight: '1.6rem' } }, '🍪'.repeat(give[i])),
        h('div', { class: 'lab-row', style: { justifyContent: 'center' } }, button('−', () => mv(i, -1)), button('+', () => mv(i, 1))))));
    }
    function mv(i, d) {
      if (locked) return;
      if (idea === null) { status.className = 'note warn'; status.textContent = t('Pick what you think fair means first.'); return; }
      const used = give.reduce((a, b) => a + b, 0);
      if (d > 0 && used >= total) return;
      give[i] = Math.max(0, give[i] + d); draw();
    }
    function finish() {
      if (locked) return;
      if (idea === null || give.reduce((a, b) => a + b, 0) < total) { status.className = 'note warn'; status.textContent = t('Share out all the cookies, after choosing what fair means.'); return; }
      locked = true;
      const equal = give.every((g) => g === give[0]);
      const more = give[hungry] > Math.max(...give.filter((_, i) => i !== hungry));
      const ok = idea === 'same' ? equal : rounds[ri].need ? more : equal;
      results.push(ok);
      status.className = 'note ' + (ok ? 'ok' : 'warn');
      status.textContent = ok ? '🎉 ' + t('Your sharing matches your idea of fair!') : '🤔 ' + t('Your sharing and your idea do not match. Look at the cookies again.');
      api.say(rounds[ri].need ? t('Some people say fair is the same for everyone. Others say fair is giving more to who needs more. Both are ideas people use.') : t('When everyone needs the same, sharing equally is an easy way to be fair.'));
      if (!ok) { locked = false; return; }
      if (ri === 0) { ri++; setTimeout(start, 1500); } else api.complete(1, t('Shared fairly and explained why in two situations.'));
    }
    return () => {};
  },
};
export default LAB;
