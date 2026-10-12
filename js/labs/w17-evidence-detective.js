import { h, button, choice } from '../core/labkit.js';

const FALL = [['ad', 'Attacking the person'], ['pop', 'Everyone does it'], ['one', 'One example only'], ['cause', 'Mixing up cause and chance'], ['none', 'No fallacy']];
const CASES = [
  { claim: 'Our class bought ice cream on three hot days, so ice cream makes the weather hot.', src: 'a pupil\'s notebook', rel: 1, fall: 'cause', why: 'Hot weather makes people buy ice cream; the reverse is not shown. Two things happening together are not always cause and effect.' },
  { claim: 'You cannot trust Mia\'s idea about the school garden, because she is always late.', src: 'a classmate', rel: 1, fall: 'ad', why: 'Being late says nothing about whether the garden idea is good. Judge the idea, not the person.' },
  { claim: 'Everybody in my street uses this brand of torch, so it must be the best.', src: 'an advert', rel: 0, fall: 'pop', why: 'Many people choosing something is not proof of quality. Tests are better evidence.' },
  { claim: 'My uncle ate a lemon every day and never caught a cold, so lemons stop colds.', src: 'a family story', rel: 0, fall: 'one', why: 'One person is a story, not a study. We need many people compared with and without lemons.' },
  { claim: 'A museum guide says the bridge was built in 1890; the town records and an engineer\'s book agree.', src: 'museum plus two records', rel: 2, fall: 'none', why: 'Several independent sources agree, and they have a reason to be accurate.' },
  { claim: 'A measured test of 200 plants found those given more light grew taller on average.', src: 'a science report', rel: 2, fall: 'none', why: 'A large measured sample with a comparison is good evidence, though it still may not apply to every plant.' },
];
const REL = [[0, 'Weak'], [1, 'Medium'], [2, 'Strong']];

const LAB = {
  id: 'w17-evidence-detective',
  world: 17,
  levels: [3, 4],
  kind: 'lab',
  icon: '🕵️',
  title: 'Evidence Detective',
  goal: 'Rate how strong the source is and spot the thinking trap in each invented claim.',
  limits: 'The claims are invented and short. Real evidence is messier, and a source rated weak can still turn out to be true; the rating is about how much to trust it, not whether it is right.',
  mount(root, api) {
    const t = api.t;
    const order = [...CASES].sort(() => api.rng() - 0.5).slice(0, 5);
    let i = 0, pts = 0, relPick = null, falPick = null, shown = false;
    const claim = h('div', { class: 'card', style: { fontWeight: 700 } });
    const src = h('div', { class: 'small muted' });
    const relC = choice(REL.map(([v, s]) => [v, t(s)]), null, (v) => { relPick = v; });
    const falC = choice(FALL.map(([v, s]) => [v, t(s)]), null, (v) => { falPick = v; });
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const go = button(t('Check'), () => check(), 'btn');
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), claim, src,
      h('div', { class: 'small' }, '1. ' + t('How strong is the evidence? Decide before you check.')), relC.el,
      h('div', { class: 'small' }, '2. ' + t('Which trap, if any?')), falC.el, go, status));

    function load() {
      const c = order[i]; relPick = null; falPick = null; shown = false;
      claim.textContent = '“' + t(c.claim) + '”';
      src.textContent = `${t('Source')}: ${t(c.src)}  (${i + 1}/${order.length})`;
      status.className = 'note'; status.textContent = t('Pick both answers, then press Check.');
      go.textContent = t('Check');
      for (const el of [relC.el, falC.el]) el.querySelectorAll('.chip').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
    }
    function check() {
      if (shown) { i++; if (i >= order.length) return finish(); load(); return; }
      if (relPick == null || falPick == null) { status.textContent = t('Pick both answers first.'); return; }
      const c = order[i]; shown = true;
      const a = relPick === c.rel ? 1 : Math.abs(relPick - c.rel) === 1 ? 0.5 : 0;
      const b = falPick === c.fall ? 1 : 0;
      pts += (a + b) / 2;
      status.className = 'note ' + (a + b === 2 ? 'ok' : 'warn');
      status.textContent = `${t('Strength')}: ${t(REL[c.rel][1])}. ${t('Trap')}: ${t(FALL.find((f) => f[0] === c.fall)[1])}.`;
      api.say(t(c.why));
      go.textContent = i + 1 >= order.length ? t('Finish') : t('Next case');
    }
    function finish() {
      const score = pts / order.length;
      status.className = 'note ' + (score >= 0.7 ? 'ok' : 'warn');
      status.textContent = t(`Case closed: ${Math.round(score * 100)}% accurate.`);
      go.style.display = 'none';
      if (score >= 0.7) api.complete(score, t('Rated sources and spotted fallacies.'));
      else root.firstChild.append(button(t('Open a new file'), () => { i = 0; pts = 0; go.style.display = ''; load(); }, 'btn ghost'));
    }
    load();
    return () => {};
  },
};
export default LAB;
