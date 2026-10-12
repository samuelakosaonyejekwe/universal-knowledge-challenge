import { h, button, choice, canvas, predict, readout, fmt } from '../core/labkit.js';

export default {
  id: 'w09-probability-lab',
  world: 9,
  levels: [5, 6],
  kind: 'lab',
  icon: '🎲',
  title: 'Probability Lab',
  goal: 'Roll until the measured frequency of the target event is within 2 percentage points of its true probability.',
  limits: 'Random numbers come from a computer generator, so the dice are ideal and fair. The 1/√n spread shown is a one-standard-deviation estimate, not a guarantee for any single run.',
  mount(root, api) {
    const t = api.t;
    const exps = {
      coin: { name: t('Coin'), outs: [0, 1], labels: ['T', 'H'], p: () => [0.5, 0.5], roll: () => (api.rng() < 0.5 ? 1 : 0) },
      die: { name: t('One die'), outs: [1, 2, 3, 4, 5, 6], labels: ['1', '2', '3', '4', '5', '6'], p: () => [1, 1, 1, 1, 1, 1].map((x) => x / 6), roll: () => 1 + Math.floor(api.rng() * 6) },
      two: { name: t('Two dice (sum)'), outs: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], labels: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        p: () => [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((x) => x / 36), roll: () => 2 + Math.floor(api.rng() * 6) + Math.floor(api.rng() * 6) },
    };
    let key = api.level >= 6 ? 'two' : 'die';
    let counts, n, target, done, guess;
    const c = canvas(240, { light: true });
    const rN = readout(t('rolls n'), '0'), rF = readout(t('measured'), '–'), rP = readout(t('true P'), '–'), rS = readout(t('spread ±√(p(1−p)/n)'), '–');
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const missionEl = h('div', { class: 'lab-goal' });
    const pbox = h('div');

    function reset() {
      const e = exps[key];
      counts = e.outs.map(() => 0); n = 0; done = false; guess = null;
      target = Math.floor(api.rng() * e.outs.length);
      if (key === 'two') target = 3 + Math.floor(api.rng() * 5);
      const P = e.p()[target];
      missionEl.textContent = `${t('Target event')}: ${exps[key].name} = ${e.labels[target]}`;
      pbox.replaceChildren(predict({ question: `${t('Predict P(')}${e.labels[target]}${t(') as a decimal')}`, truth: P, tolerance: 0.15, onResult: (er) => { guess = er; } }));
      status.className = 'note'; status.textContent = t('Predict, then roll. More rolls shrink the random wobble.');
      update(); draw();
    }
    function update() {
      const P = exps[key].p()[target], f = n ? counts[target] / n : NaN;
      rN.set(String(n)); rF.set(n ? fmt(f, 3) : '–'); rP.set(fmt(P, 3)); rS.set(n ? fmt(Math.sqrt((P * (1 - P)) / n), 2) : '–');
      if (!done && n >= 100 && Math.abs(f - P) <= 0.02) {
        done = true; status.className = 'note ok';
        status.textContent = `${t('Measured')} ${fmt(f)} ${t('vs true')} ${fmt(P)}.`;
        api.say(t('The law of large numbers: the more trials, the closer the measured frequency tends to sit to the true probability. Spread shrinks like 1 over the square root of n.'));
        api.complete(guess !== null && guess <= 0.15 ? 1 : 0.8, `n = ${n}, frequency ${fmt(f)} vs P = ${fmt(P)}`);
      }
    }
    function draw() {
      const { ctx, w } = c, H = 240, e = exps[key], P = e.p(), k = e.outs.length;
      ctx.clearRect(0, 0, w, H);
      const maxv = Math.max(...P, ...counts.map((x) => (n ? x / n : 0))) * 1.15 || 1;
      const bw = (w - 20) / k;
      ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      for (let i = 0; i < k; i++) {
        const x = 10 + i * bw, fr = n ? counts[i] / n : 0;
        const hf = (fr / maxv) * (H - 50), hp = (P[i] / maxv) * (H - 50);
        ctx.fillStyle = i === target ? '#f5a000' : '#7c8cff'; ctx.fillRect(x + bw * 0.12, H - 24 - hf, bw * 0.76, hf);
        ctx.strokeStyle = '#d9485f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 2, H - 24 - hp); ctx.lineTo(x + bw - 2, H - 24 - hp); ctx.stroke();
        ctx.fillStyle = '#4b5578'; ctx.fillText(e.labels[i], x + bw / 2, H - 8);
      }
      ctx.fillStyle = '#d9485f'; ctx.textAlign = 'left'; ctx.fillText(t('red line = theory'), 8, 14);
    }
    function roll(m) {
      const e = exps[key];
      for (let i = 0; i < m; i++) { const r = e.roll(); counts[e.outs.indexOf(r)]++; n++; }
      update(); draw();
    }
    c.onResize = draw;
    c.el.setAttribute('aria-label', t('Histogram of measured frequencies against theory'));
    const sel = choice([['coin', t('Coin')], ['die', t('One die')], ['two', t('Two dice (sum)')]], key, (v) => { key = v; reset(); });
    root.append(h('div', { class: 'lab' }, sel.el, missionEl, pbox, c.el,
      h('div', { class: 'lab-row' }, rN.el, rF.el, rP.el, rS.el),
      h('div', { class: 'lab-row' }, button('+1', () => roll(1)), button('+10', () => roll(10)), button('+100', () => roll(100)), button('+1000', () => roll(1000)), button(t('Reset'), reset, 'btn ghost sm')),
      status));
    reset();
    api.say(t('Before rolling, guess the probability. Two dice make a sum of 7 most often because 6 of the 36 pairs add to 7.'));
    return () => {};
  },
};
