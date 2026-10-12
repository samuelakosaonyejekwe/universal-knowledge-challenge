import { h, button, choice } from '../core/labkit.js';

const SC = [
  { p: ['it rains', 'it does not rain'], q: ['the match is cancelled', 'the match is not cancelled'] },
  { p: ['Ana has a ticket', 'Ana has no ticket'], q: ['Ana enters the hall', 'Ana does not enter the hall'] },
  { p: ['the cat is hungry', 'the cat is not hungry'], q: ['the cat meows', 'the cat does not meow'] },
];
const T = {
  cond: { f: (p, q) => !p || q, s: (S) => `If ${S.p[0]}, then ${S.q[0]}` },
  or: { f: (p, q) => p || q, s: (S) => `Either ${S.p[0]} or ${S.q[0]}` },
  p: { f: (p) => p, s: (S) => cap(S.p[0]) }, np: { f: (p) => !p, s: (S) => cap(S.p[1]) },
  q: { f: (p, q) => q, s: (S) => cap(S.q[0]) }, nq: { f: (p, q) => !q, s: (S) => cap(S.q[1]) },
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const FORMS = [
  { name: 'Modus ponens', prem: ['cond', 'p'], conc: 'q' },
  { name: 'Affirming the consequent', prem: ['cond', 'q'], conc: 'p' },
  { name: 'Denying the antecedent', prem: ['cond', 'np'], conc: 'nq' },
  { name: 'Modus tollens', prem: ['cond', 'nq'], conc: 'np' },
  { name: 'Disjunctive syllogism', prem: ['or', 'np'], conc: 'q' },
];
const HIDDEN = [
  { arg: 'Mia has a ticket, so Mia can go in.', opts: ['Everyone with a ticket can go in.', 'Mia is tall.', 'Mia likes the film.'] },
  { arg: 'The road is wet, so it rained.', opts: ['The road gets wet only when it rains.', 'The road is long.', 'Rain is common in autumn.'] },
  { arg: 'Leo is a cat, so Leo likes fish.', opts: ['All cats like fish.', 'Leo is small.', 'Fish are healthy.'] },
];

const LAB = {
  id: 'w20-argument-builder',
  world: 20,
  levels: [5, 6],
  kind: 'studio',
  icon: '🧩',
  title: 'Argument Builder',
  goal: 'Assemble premises and a conclusion, predict whether it is valid, find counterexamples in the truth table, and fill in a hidden premise.',
  limits: 'Only propositional logic with two statements (p, q) and the connectives if–then, or and not. Valid means the conclusion must be true whenever the premises are, not that the premises are actually true. Real arguments need more logic and judgement about whether the premises are true.',
  mount(root, api) {
    const t = api.t, r = api.rng;
    const forms = [...FORMS].sort(() => r() - 0.5).slice(0, 3);
    const hid = HIDDEN[Math.floor(r() * HIDDEN.length)];
    let ri = 0, stage = 'build', pred = null, scoreSum = 0, S, f, slots, tiles, marks;
    const view = h('div', { class: 'lab' }), status = h('div', { class: 'note', 'aria-live': 'polite' });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), view, status));
    round();

    function round() {
      if (ri >= 3) return hidden();
      f = forms[ri]; S = SC[Math.floor(r() * SC.length)]; stage = 'build'; pred = null; marks = new Set();
      slots = [null, null, null];
      const ids = [...f.prem, f.conc]; const dis = ['p', 'q', 'np', 'nq', 'or', 'cond'].filter((x) => !ids.includes(x));
      tiles = [...ids, dis[Math.floor(r() * dis.length)]].sort(() => r() - 0.5);
      drawBuild(); status.className = 'note'; status.textContent = `${t('Argument')} ${ri + 1}/3. ` + t('Tap sentences to fill: two premises, then the conclusion. One is a distractor.');
    }
    function drawBuild() {
      const lab = ['Premise 1', 'Premise 2', 'Conclusion'];
      view.replaceChildren(
        ...slots.map((s, i) => h('button', { type: 'button', class: 'chip' + (s ? ' on' : ''), style: { justifyContent: 'flex-start', minHeight: '44px' }, onClick: () => { slots[i] = null; drawBuild(); } }, `${t(lab[i])}: ${s ? t(T[s].s(S)) : '…'}`)),
        h('div', { class: 'lab-grid' }, ...tiles.map((id) => h('button', { type: 'button', class: 'btn ghost sm', disabled: slots.includes(id), onClick: () => { const k = slots.indexOf(null); if (k >= 0) { slots[k] = id; drawBuild(); } } }, t(T[id].s(S))))),
        button(t('Check my argument'), checkBuild, 'btn'));
    }
    function checkBuild() {
      if (slots.includes(null)) return;
      const ok = slots[2] === f.conc && [...slots.slice(0, 2)].sort().join() === [...f.prem].sort().join();
      if (!ok) { status.className = 'note warn'; status.textContent = t('Not quite: the conclusion is what the premises are meant to prove, so it is the sentence that follows from the other two.'); return; }
      status.className = 'note ok'; status.textContent = t('Built: ') + t(f.name) + '.';
      stage = 'predict'; view.replaceChildren(h('div', { class: 'lab-goal' }, t('Predict: is this argument valid?')),
        h('div', { class: 'card small' }, slots.map((s, i) => h('div', null, (i < 2 ? 'P: ' : '∴ ') + t(T[s].s(S))))),
        choice([[true, t('Valid')], [false, t('Invalid')]], null, (v) => { pred = v; table(); }).el);
    }
    function row(p, q) { return f.prem.every((id) => T[id].f(p, q)); }
    function table() {
      const rows = [[true, true], [true, false], [false, true], [false, false]];
      const tf = (b) => (b ? 'T' : 'F');
      stage = 'table';
      const body = rows.map(([p, q], i) => h('button', { type: 'button', class: 'chip' + (marks.has(i) ? ' on' : ''), style: { justifyContent: 'space-between', width: '100%', fontVariantNumeric: 'tabular-nums' }, onClick: () => { marks.has(i) ? marks.delete(i) : marks.add(i); table(); } },
        `p=${tf(p)} q=${tf(q)} | ${t('premises')}: ${tf(row(p, q))} | ${t('conclusion')}: ${tf(T[f.conc].f(p, q))}`));
      view.replaceChildren(h('div', { class: 'card small' }, slots.map((s, i) => h('div', null, (i < 2 ? 'P: ' : '∴ ') + t(T[s].s(S))))),
        h('div', { class: 'lab-goal' }, t('Tap every row that is a counterexample (all premises true, conclusion false).')), ...body, button(t('Check table'), checkTable, 'btn'));
    }
    function checkTable() {
      const rows = [[true, true], [true, false], [false, true], [false, false]];
      const truth = new Set(rows.map(([p, q], i) => (row(p, q) && !T[f.conc].f(p, q) ? i : -1)).filter((i) => i >= 0));
      const ok = truth.size === marks.size && [...truth].every((i) => marks.has(i));
      const valid = truth.size === 0, predOk = pred === valid;
      scoreSum += (ok ? 0.5 : 0) + (predOk ? 0.5 : 0);
      status.className = 'note ' + (ok && predOk ? 'ok' : 'warn');
      status.textContent = (valid ? t('Valid: no row has true premises with a false conclusion.') : t('Invalid: a counterexample row has true premises and a false conclusion.')) + ' ' + (predOk ? t('Your prediction was right.') : t('Your prediction was wrong.')) + (ok ? '' : ' ' + t('Your marked rows were not exactly the counterexamples.'));
      api.say(valid ? t('A valid form guarantees the conclusion if the premises are true. Validity is about structure, not about whether the sentences are true.') : t('This form looks convincing but a counterexample shows it can fail. Many everyday mistakes have this shape.'));
      view.replaceChildren(button(ri < 2 ? t('Next argument') : t('Hidden premise'), () => { ri++; round(); }, 'btn ok'));
    }
    function hidden() {
      stage = 'hidden'; const o = hid.opts.map((x, i) => [i, x]).sort(() => r() - 0.5);
      status.className = 'note'; status.textContent = t('This argument has a hidden premise (an unstated assumption).');
      view.replaceChildren(h('div', { class: 'card' }, t(hid.arg)), h('div', { class: 'lab-goal' }, t('Which statement, if added, makes the conclusion follow?')),
        ...o.map(([i, x]) => button(t(x), () => {
          const ok = i === 0; scoreSum += ok ? 1 : 0;
          const sc = scoreSum / 4;
          status.className = 'note ' + (ok ? 'ok' : 'warn');
          status.textContent = (ok ? t('Yes: it links the reason to the conclusion.') : t('That does not link the reason to the conclusion. The needed one is: ') + t(hid.opts[0])) + ' ' + t('Hidden premises can be false too, so always ask whether they are true.');
          view.replaceChildren(); api.say(t('Spotting hidden premises lets you challenge an argument at its weakest point.'));
          if (sc >= 0.6) api.complete(sc, t('Built arguments, tested validity with truth tables and found a hidden premise.'));
          else view.append(button(t('Try again'), () => { ri = 0; scoreSum = 0; round(); }, 'btn'));
        }, 'btn ghost block')));
    }
    return () => {};
  },
};
export default LAB;
