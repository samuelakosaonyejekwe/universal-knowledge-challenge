import { h, button, choice, readout } from '../core/labkit.js';

export default {
  id: 'w12-piggy-bank',
  world: 12,
  levels: [1, 2],
  kind: 'lab',
  icon: '🐷',
  title: 'Piggy Bank',
  goal: 'Save your pocket money week by week until you can buy the toy.',
  limits: 'A small pretend world: a fixed weekly allowance, fixed prices and no interest. Real saving also depends on prices changing and on what you really need.',
  mount(root, api) {
    const t = api.t;
    const allowance = 3 + Math.floor(api.rng() * 3); // coins per week
    const price = allowance * (3 + Math.floor(api.rng() * 3)) + Math.floor(api.rng() * allowance); // coins
    const toys = ['🧸', '🚲', '🪁', '🎨'];
    const toy = toys[Math.floor(api.rng() * toys.length)];
    const treats = [['🍬', 1], ['🍦', 2]];
    let bank = 0, week = 0, weekSpent = 0, guess = null, bought = false, spentTotal = 0;
    const minWeeks = Math.ceil(price / allowance);
    const maxWeeks = minWeeks + 3;
    const out = h('div', { class: 'note', 'aria-live': 'polite' });
    const body = h('div', { class: 'lab' });
    const rB = readout(t('in my piggy'), '0'), rW = readout(t('week'), '0');

    const coins = (n, big) => h('div', { style: { fontSize: big ? '1.6rem' : '1.2rem', lineHeight: 1.5, wordBreak: 'break-all' }, 'aria-label': `${n} ${t('coins')}` }, n > 0 ? '🪙'.repeat(Math.min(n, 60)) : '–');

    function render() {
      rB.set(String(bank)); rW.set(String(week));
      const left = allowance - weekSpent;
      body.replaceChildren(
        h('div', { class: 'card', style: { textAlign: 'center' } }, h('div', { style: { fontSize: '3rem' } }, toy), h('div', { class: 'lab-goal' }, `${t('Costs')} ${price} 🪙`)),
        guess === null ? h('div', null, h('div', { class: 'lab-goal' }, t('Guess: how many weeks will it take if you save everything?')),
          h('div', { class: 'lab-row' }, ...Array.from({ length: 8 }, (_, i) => h('button', { class: 'chip', type: 'button', style: { minHeight: '48px', minWidth: '48px', justifyContent: 'center', fontSize: '1.1rem' }, onClick: () => { guess = i + 1; render(); } }, String(i + 1))))) :
          h('div', { class: 'small' }, `${t('Your guess')}: ${guess} ${t('weeks')}`),
        h('div', { class: 'lab-row' }, rW.el, rB.el, h('div', { class: 'readout' }, h('b', null, String(left)), h('span', null, t('to use this week')))),
        coins(bank, true),
        h('div', { class: 'small muted' }, `${t('Each week you get')} ${allowance} 🪙. ${t('Spend some on a treat, or save it all.')}`),
        h('div', { class: 'lab-row' },
          ...treats.map(([e, c]) => button(`${e} ${t('Treat')} −${c}🪙`, () => spend(c), 'btn ghost')),
          button(`➡️ ${t('Next week')} (+${allowance - weekSpent}🪙)`, nextWeek, 'btn gold')),
        h('div', { class: 'lab-row' }, button(`${toy} ${t('Buy it!')}`, buy, 'btn ok'), button(t('Start again'), reset, 'btn ghost sm')), out);
    }
    function spend(c) {
      if (guess === null) { out.textContent = t('Make your guess first!'); return; }
      if (weekSpent + c > allowance) { out.className = 'note warn'; out.textContent = t('Not enough coins left this week.'); return; }
      weekSpent += c; spentTotal += c; render();
    }
    function nextWeek() {
      if (guess === null) { out.className = 'note'; out.textContent = t('Make your guess first!'); render(); return; }
      if (bought) return;
      bank += allowance - weekSpent; weekSpent = 0; week++; render();
      out.className = 'note'; out.textContent = bank >= price ? t('You have enough! Tap Buy.') : `${price - bank} 🪙 ${t('still to go.')}`;
      if (week >= maxWeeks && bank < price) { out.className = 'note warn'; out.textContent = t('Time is up. Treats cost savings: try again with fewer treats.'); }
    }
    function buy() {
      if (bought) return;
      if (bank < price) { out.className = 'note warn'; out.textContent = `${t('Not enough yet: you need')} ${price - bank} 🪙 ${t('more')}.`; return; }
      bought = true; out.className = 'note ok'; out.textContent = `🎉 ${t('You bought it in')} ${week} ${t('weeks!')}`;
      api.say(t('Saving means not spending now so you can afford something bigger later. Every treat you skip makes the wait shorter.'));
      api.complete(week <= maxWeeks ? (guess === minWeeks ? 1 : 0.85) : 0.6, `Saved ${price} coins in ${week} weeks.`);
    }
    function reset() { bank = 0; week = 0; weekSpent = 0; guess = null; bought = false; out.className = 'note'; out.textContent = ''; render(); }
    root.append(body); render();
    api.say(t('Pocket money comes every week. Choose how much to spend and how much to save.'));
    void choice; void spentTotal;
    return () => {};
  },
};
