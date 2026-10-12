import { h, slider, readout, predict, fmt, canvas } from '../core/labkit.js';

const SCEN = [
  { name: 'a rare plant disease', pos: 'a leaf test is positive', hit: 'diseased' },
  { name: 'a hidden fault in a gadget', pos: 'a scanner raises an alarm', hit: 'faulty' },
  { name: 'a rare sleep problem', pos: 'a screening quiz flags a person', hit: 'affected' },
];

const LAB = {
  id: 'w17-bayes-lab',
  world: 17,
  levels: [5, 6],
  kind: 'lab',
  icon: '🎲',
  title: 'Bayes Update Lab',
  goal: 'Predict how likely it really is after a positive test, then compare with the exact Bayes result.',
  limits: 'One test, one yes/no condition, and the test errors are assumed independent of who is tested. Real tests have varying accuracy across groups and repeated tests are rarely independent.',
  mount(root, api) {
    const t = api.t;
    const sc = SCEN[Math.floor(api.rng() * SCEN.length)];
    const pr0 = [1, 2, 5][Math.floor(api.rng() * 3)], se0 = 90 + Math.floor(api.rng() * 9), fp0 = [5, 10][Math.floor(api.rng() * 2)];
    let target = 0.3 + Math.round(api.rng() * 4) * 0.1, done = false, guessed = false;
    const prior = slider({ label: t('Base rate P(H), how common it is'), min: 0.1, max: 50, step: 0.1, value: pr0, unit: '%', onInput: upd });
    const sens = slider({ label: t('Sensitivity P(+|H)'), min: 50, max: 100, step: 1, value: se0, unit: '%', onInput: upd });
    const fpr = slider({ label: t('False positive rate P(+|not H)'), min: 0.5, max: 30, step: 0.5, value: fp0, unit: '%', onInput: upd });
    const post = readout(t('Posterior P(H|+)'), '–'), tp = readout(t('Out of 1000: true +'), '–'), fpn = readout(t('Out of 1000: false +'), '–');
    const cv = canvas(140, { light: true });
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const pred = predict({ question: t(`With these settings, what is P(H | +) in %?`), unit: '%', truth: () => exact() * 100, tolerance: 0.15, onResult: (e) => { guessed = true; api.say(e <= 0.15 ? t('Good intuition. Most people overestimate when the base rate is low.') : t('Look at the dots: most positives come from the large healthy group, even with a small false positive rate.')); upd(); } });
    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t(LAB.goal)),
      h('div', null, t(`Imagine ${sc.name}. You learn that ${sc.pos}. How likely is it that the thing is ${sc.hit}?`)),
      prior.el, sens.el, fpr.el, pred, h('div', { class: 'lab-row' }, post.el, tp.el, fpn.el), cv.el,
      h('div', { class: 'note warn' }, t(`Mission: after you have made a prediction, set the sliders so P(H|+) is within 3 points of ${Math.round(target * 100)}%.`)), status));

    function exact() {
      const p = prior.value / 100, s = sens.value / 100, f = fpr.value / 100;
      return p * s / (p * s + (1 - p) * f);
    }
    function upd() {
      const p = prior.value / 100, s = sens.value / 100, f = fpr.value / 100, e = exact();
      post.set(fmt(e * 100, 3) + '%'); tp.set(fmt(1000 * p * s, 3)); fpn.set(fmt(1000 * (1 - p) * f, 3));
      draw(1000 * p * s, 1000 * (1 - p) * f);
      if (guessed && !done && Math.abs(e - target) <= 0.03) {
        done = true; status.className = 'note ok';
        status.textContent = t(`P(H|+) = ${fmt(e * 100)}%. Bayes: P(H|+) = P(+|H)P(H) / [P(+|H)P(H) + P(+|not H)P(not H)].`);
        api.say(t('The posterior depends on the base rate as much as on the test quality.'));
        api.complete(0.8 + 0.2 * (Math.abs(e - target) <= 0.01 ? 1 : 0), t('Used Bayes\' rule to hit a target posterior.'));
      }
    }
    function draw(tpv, fpv) {
      const { ctx, w } = cv; ctx.clearRect(0, 0, w, 140);
      const tot = tpv + fpv || 1, bw = w - 20;
      ctx.fillStyle = '#17a673'; ctx.fillRect(10, 30, bw * tpv / tot, 34);
      ctx.fillStyle = '#d9485f'; ctx.fillRect(10 + bw * tpv / tot, 30, bw * fpv / tot, 34);
      ctx.fillStyle = '#222'; ctx.font = '12px sans-serif';
      ctx.fillText(t('All positive results: green = truly H, red = not H'), 10, 20);
      ctx.fillText(t('Green share = posterior'), 10, 84);
      ctx.fillStyle = '#17a673'; ctx.fillRect(10, 96, bw * Math.min(1, target), 6);
      ctx.fillStyle = '#222'; ctx.fillText(t('target'), 10 + bw * target - 12, 118);
    }
    cv.onResize = upd;
    upd();
    return () => {};
  },
};
export default LAB;
