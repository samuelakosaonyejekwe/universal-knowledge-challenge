import { h, button, readout, fmt, predict, choice } from '../core/labkit.js';

export default {
  id: 'w06-half-life',
  world: 6,
  levels: [3, 4],
  kind: 'lab',
  icon: '☢️',
  title: 'Half-Life Sampler',
  goal: 'Predict how many atoms are left after some half-lives, then run time forward and check.',
  limits: 'Each atom decays at random, so a small sample only follows N = N₀·(½)^(t/T) on average. Real samples have trillions of atoms and so follow the curve very smoothly. This is a conceptual model, not about handling any real material.',
  mount(root, api) {
    const t = api.t;
    const N0 = 100;
    const T = [1, 2, 5, 10][Math.floor(api.rng() * 4)]; // fictional isotope half-life, in days
    const unitName = t('days');
    const targetK = 2 + Math.floor(api.rng() * 3);       // half-lives to reach
    let alive = Array(N0).fill(true), time = 0, done = false, guessErr = null, guessed = false;
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px', maxWidth: '300px', margin: '0 auto' } });
    const cells = alive.map(() => h('div', { style: { aspectRatio: '1', borderRadius: '50%', transition: 'background .3s' } }));
    grid.append(...cells);
    const rT = readout(t('Time') + ' (' + unitName + ')'), rN = readout(t('Left')), rF = readout(t('Formula N')), rK = readout(t('Half-lives'));
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const step = choice([[0.5, '½ T'], [1, '1 T']], 1, () => {});
    const count = () => alive.filter(Boolean).length;
    function draw() {
      cells.forEach((c, i) => { c.style.background = alive[i] ? '#f5b700' : '#d5d9e6'; });
      const k = time / T;
      rT.set(fmt(time)); rN.set(String(count())); rF.set(fmt(N0 * Math.pow(0.5, k), 3)); rK.set(fmt(k));
      if (!done && Math.abs(k - targetK) < 1e-9 && guessed) {
        done = true;
        const score = guessErr == null ? 0.7 : Math.max(0.5, 1 - guessErr);
        msg.className = 'note ok';
        msg.textContent = t('Reached the target. Count vs formula:') + ` ${count()} vs ${fmt(N0 * Math.pow(0.5, k), 3)}.`;
        api.say(t('Each half-life removes half of what is left, not half of the start. Random chance makes the real count wobble around the formula.'));
        api.complete(score, t('Used half-life: N = N0 · (1/2)^(t/T).'));
      }
    }
    function advance() {
      const dt = step.value * T, p = 1 - Math.pow(0.5, dt / T);
      alive = alive.map(a => a && api.rng() >= p);
      time += dt; draw();
    }
    const pr = predict({ question: t('Predict: atoms left of 100 after') + ` ${targetK} ` + t('half-lives'), unit: '', tolerance: 0.2,
      truth: () => N0 * Math.pow(0.5, targetK), onResult: e => { guessed = true; guessErr = Math.min(1, e); msg.className = 'note'; msg.textContent = t('Now press Run until you reach') + ` ${targetK} T (${fmt(targetK * T)} ${unitName}).`; draw(); } });
    const reset = () => { alive = Array(N0).fill(true); time = 0; done = false; msg.className = 'note'; msg.textContent = ''; draw(); };
    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('A made-up isotope has half-life T =') + ` ${T} ${unitName}. ` + t('Each gold dot is an atom that has not decayed.')),
      grid, h('div', { class: 'lab-row' }, rT.el, rN.el, rF.el, rK.el), pr,
      h('div', { class: 'lab-row' }, step.el, button('⏩ ' + t('Run'), advance, 'btn'), button('↺ ' + t('Reset'), reset, 'btn ghost')), msg));
    draw();
    return () => {};
  },
};
