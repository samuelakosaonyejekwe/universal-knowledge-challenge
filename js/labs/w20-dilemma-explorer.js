import { h, button, choice } from '../core/labkit.js';

const LENS = [['virtue', '🌟 Virtue: what would a good person be like?'], ['duty', '📜 Duty: what rules or promises apply?'], ['cons', '🌍 Consequences: what makes things go best for everyone?']];
const D = [
  { story: 'You find a purse with a name card. If you hand it in now, you will miss the start of a party. If you finish the party first, the owner waits a few hours.', opts: ['Hand it in right now', 'Go to the party, then hand it in'],
    view: [[0, 'An honest, caring person puts the worried owner first.'], [0, 'Lost things should go back as soon as we can; that is a basic rule.'], [0, 'A short wait for you costs less than hours of worry for the owner, but it is close.']],
    reasons: [[0, 0, 'Being honest and kind matters most to me.'], [0, 1, 'Returning lost things quickly is the rule I follow.'], [0, 2, 'The owner may be very worried; that is a bigger cost than a late party.'], [1, 0, 'A good person also keeps their own plans and friends.'], [1, 1, 'Nothing says it must be this minute, only that I do return it.'], [1, 2, 'Handing it in later makes little difference and I enjoy the party.']],
    twist: 'Twist: the owner is not worried at all and is going to be away until tomorrow.', shifts: [false, false, true], why: ['Virtue and duty look at what kind of person you are and the rule, not just this outcome.', '', 'Consequences care about how worried the owner is, so the answer can move.'] },
  { story: 'You promised to help your friend Sam practise for a race. On the way, a classmate trips and needs someone to walk them to the nurse. Sam will wait.', opts: ['Keep the promise to Sam', 'Walk the classmate to the nurse first'],
    view: [[1, 'A kind person helps who needs it, then makes it up to Sam.'], [0, 'A promise is a promise, unless the other person lets you off.'], [1, 'The classmate needs help most, and Sam only loses a little time.']],
    reasons: [[0, 0, 'Being reliable is part of being a good friend.'], [0, 1, 'I made a promise, and promises should be kept.'], [0, 2, 'Sam would be let down and trust would be damaged.'], [1, 0, 'Kindness to someone hurt matters most to me.'], [1, 1, 'Helping someone in need is also a duty.'], [1, 2, 'The classmate needs help now, and Sam only loses a bit of time.']],
    twist: 'Twist: Sam shouts, "Go and help, I do not mind!"', shifts: [false, true, false], why: ['A kind person would help either way.', 'A promise can be released by the person it was made to, so duty can change.', 'Consequences already favoured helping the classmate.'] },
];

const LAB = {
  id: 'w20-dilemma-explorer',
  world: 20,
  levels: [3, 4],
  kind: 'lab',
  icon: '⚖️',
  title: 'Thought Experiment Explorer',
  goal: 'Choose what to do, compare how three ways of thinking reason about it, then give consistent reasons and handle a twist.',
  limits: 'Two gentle, invented dilemmas and three simplified ways of thinking. Real philosophers disagree about each of them, and no answer is announced as the correct one here: you are scored on giving reasons and staying consistent, not on picking a side.',
  mount(root, api) {
    const t = api.t;
    const order = [...D].sort(() => api.rng() - 0.5); let di = 0; const scores = [];
    let pick = null, picked = new Set(), lens = null, changed = null, stage = 0;
    const story = h('div', { class: 'card' }), body = h('div', { class: 'lab' }), status = h('div', { class: 'note', 'aria-live': 'polite' });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), story, body, status));
    show();

    function show() {
      const d = order[di]; pick = null; picked = new Set(); lens = null; changed = null; stage = 0;
      story.textContent = `(${di + 1}/${order.length}) ` + t(d.story);
      status.className = 'note'; status.textContent = t('Predict first: what would you do?');
      body.replaceChildren(choice(d.opts.map((o, i) => [i, t(o)]), null, (v) => { pick = v; reveal(); }).el);
    }
    function reveal() {
      const d = order[di]; stage = 1;
      const lensCards = d.view.map(([lean, txt], i) => h('div', { class: 'card small' }, h('b', null, t(LENS[i][1])), h('div', null, '→ ' + t(d.opts[lean]) + '. ' + t(txt))));
      const uniq = new Set(d.view.map((v) => v[0])).size;
      const reasons = d.reasons.map(([o, l, txt], i) => h('label', { class: 'chip', style: { alignItems: 'flex-start' } }, h('input', { type: 'checkbox', onChange: (e) => { e.target.checked ? picked.add(i) : picked.delete(i); } }), t(txt)));
      const twistBox = h('div');
      body.replaceChildren(...lensCards,
        h('div', { class: 'small' }, uniq > 1 ? t('The three lenses can disagree. That is allowed: thinking carefully means giving reasons.') : t('The lenses agree on the action here but for different reasons.')),
        h('div', { class: 'lab-goal' }, t('Pick two or three reasons that support YOUR choice:')), h('div', { class: 'lab-grid' }, ...reasons),
        button(t('Submit my reasons'), () => submitReasons(twistBox), 'btn'), twistBox);
    }
    function submitReasons(box) {
      const d = order[di];
      if (picked.size < 2 || picked.size > 3) { status.className = 'note warn'; status.textContent = t('Choose two or three reasons.'); return; }
      const rs = [...picked].map((i) => d.reasons[i]);
      const support = rs.filter((x) => x[0] === pick).length / rs.length;
      const counts = [0, 0, 0]; rs.forEach((x) => counts[x[1]]++);
      lens = counts.indexOf(Math.max(...counts)); const same = Math.max(...counts) / rs.length;
      d.s = { support, same };
      status.className = 'note'; status.textContent = t('Your reasons mostly follow the lens:') + ' ' + t(LENS[lens][1].split(':')[0]) + '. ' + (support < 1 ? t('Some reasons you picked back the other option, which is a sign of a tension worth noticing.') : t('Your reasons all back your choice.'));
      box.replaceChildren(h('div', { class: 'card' }, t(d.twist), h('div', { class: 'lab-goal' }, t('Does your answer change?')),
        choice([[true, t('Yes, I would change')], [false, t('No, I would stay')]], null, (v) => { changed = v; }).el,
        button(t('Finish this one'), () => twist(), 'btn')));
    }
    function twist() {
      if (changed === null) return;
      const d = order[di], s = d.s;
      const ok = changed === d.shifts[lens];
      status.className = 'note ' + (ok ? 'ok' : 'warn');
      status.textContent = ok ? t('Consistent: ') + t(d.why[lens] || 'Your lens does not depend on that fact, so the answer stays.') : t('Check your lens: ') + (d.shifts[lens] ? t('the twist changes a fact that this way of thinking cares about.') : t('this way of thinking does not depend on the changed fact, so the answer would stay.'));
      api.say(t('Philosophers use thought experiments to test whether our reasons stay consistent when the facts change.'));
      scores.push(0.35 * s.support + 0.3 * s.same + 0.35 * (ok ? 1 : 0));
      body.replaceChildren(button(di + 1 < order.length ? t('Next dilemma') : t('See result'), () => { di++; if (di < order.length) show(); else end(); }, 'btn ok'));
    }
    function end() {
      const sc = scores.reduce((a, b) => a + b, 0) / scores.length;
      body.replaceChildren(); story.textContent = '';
      status.className = 'note ok'; status.textContent = t(`Reasoning consistency: ${Math.round(sc * 100)}%. Not a right-answer score: it shows how well your reasons matched each other.`);
      if (sc >= 0.6) api.complete(sc, t('Compared virtue, duty and consequence reasoning with consistent reasons.'));
      else body.append(button(t('Explore again'), () => { di = 0; scores.length = 0; story.textContent = ''; show(); }, 'btn'));
    }
    return () => {};
  },
};
export default LAB;
