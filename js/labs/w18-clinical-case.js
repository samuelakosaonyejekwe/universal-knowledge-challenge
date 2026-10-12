import { h, button } from '../core/labkit.js';

const CASES = [
  {
    who: 'Tomas, 7 (invented), has had a cough and fever for 3 days.', truth: 'chest',
    dx: [['cold', 'Common cold'], ['chest', 'Chest infection'], ['asthma', 'Asthma flare'], ['object', 'Small object breathed in']],
    qs: [
      ['Is breathing fast or hard?', 'Yes, quick breaths and the skin between the ribs pulls in.', { chest: 1, asthma: 1, cold: -1 }, true],
      ['Any wheeze, or asthma in the past?', 'No wheeze and no asthma history.', { asthma: -2 }],
      ['How high and how long is the fever?', '38.9 °C for three days.', { chest: 1, cold: -0.5 }],
      ['Did it start suddenly while playing or eating?', 'No, it built up slowly.', { object: -2 }],
      ['Is he drinking enough?', 'Drinking much less than usual.', { chest: 1 }, true],
      ['Any runny nose or sore throat?', 'A little runny nose.', { cold: 0.5 }],
    ],
    tests: [
      ['Check oxygen level and breathing rate', 'Oxygen 93%, 38 breaths a minute.', { chest: 1, cold: -1 }, 'key'],
      ['Chest X-ray', 'A cloudy patch in one lung.', { chest: 2, object: -1 }, 'useful'],
      ['Try a reliever inhaler and re-check', 'No change in breathing.', { asthma: -1 }, 'useful'],
      ['Ankle X-ray', 'Not related to the problem.', {}, 'low'],
      ['Allergy skin test', 'Not related to this illness.', {}, 'low'],
    ],
    net: 'Come back or call urgently if breathing gets harder, he is very sleepy, or he stops drinking.',
  },
  {
    who: 'Maya, 15 (invented), felt dizzy and nearly fainted after sports on a hot day.', truth: 'dehyd',
    dx: [['dehyd', 'Dehydration'], ['sugar', 'Low blood sugar'], ['anaemia', 'Low iron (anaemia)'], ['heart', 'Heart rhythm problem']],
    qs: [
      ['Did she drink during the sport?', 'Hardly anything for two hours.', { dehyd: 1.5 }],
      ['Did she skip meals?', 'She ate breakfast and lunch normally.', { sugar: -1.5 }],
      ['Any chest pain, racing heart, or fainting during exercise before?', 'No chest pain, no earlier faints, no family history.', { heart: -2 }, true],
      ['Is her urine dark?', 'Yes, quite dark.', { dehyd: 1 }],
      ['Is she often tired or pale?', 'No, she has normal energy.', { anaemia: -1.5 }],
      ['Did she recover after resting and drinking?', 'Yes, within twenty minutes.', { dehyd: 1, heart: -0.5 }, true],
    ],
    tests: [
      ['Check pulse and blood pressure lying and standing', 'Pulse fast and pressure drops a little on standing.', { dehyd: 1.5 }, 'key'],
      ['Finger-prick blood sugar', 'Normal.', { sugar: -2 }, 'useful'],
      ['Heart tracing (ECG)', 'Normal rhythm.', { heart: -2 }, 'useful'],
      ['Hearing test', 'Not related to the problem.', {}, 'low'],
      ['Knee scan', 'Not related to the problem.', {}, 'low'],
    ],
    net: 'Seek urgent help if she faints again, has chest pain, or her heart races without a reason.',
  },
];

const LAB = {
  id: 'w18-clinical-case',
  world: 18,
  levels: [5, 6],
  kind: 'lab',
  icon: '📋',
  title: 'Clinical Reasoning Case',
  goal: 'Ask good questions, choose sensible tests, rank the possible causes, and set a safety net. You are scored on reasoning and safety, not speed.',
  limits: 'Fictional cases and an educational simulation, never medical advice. Real diagnosis involves many more possibilities, an examination, and a clinician who knows the patient. No treatments or doses are included on purpose.',
  mount(root, api) {
    const t = api.t;
    const c = CASES[Math.floor(api.rng() * CASES.length)];
    const asked = new Set(), tested = new Set();
    let order = c.dx.map((d) => d[0]).sort(() => api.rng() - 0.5), netPick = null, done = false;
    const log = h('div', { class: 'card small' }, t('Findings will appear here.'));
    const qBox = h('div', { class: 'lab-row' }), tBox = h('div', { class: 'lab-row' }), rankBox = h('div', { class: 'lab-grid' });
    const netBox = h('div', { class: 'lab-row' });
    const nets = [[c.net, true], ['Nothing more is needed; no need to watch for changes.', false], ['Only come back if it is still there in two months.', false]].sort(() => api.rng() - 0.5);
    nets.forEach(([txt, ok]) => netBox.append(h('button', { class: 'chip', type: 'button', onClick: (e) => { netPick = ok; netBox.querySelectorAll('.chip').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, t(txt))));
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    c.qs.forEach((q, n) => qBox.append(button('❓ ' + t(q[0]), (e) => { asked.add(n); log.append(h('div', null, '• ' + t(q[0]) + ' → ' + t(q[1]))); e.currentTarget.disabled = true; refresh(); }, 'btn ghost sm')));
    c.tests.forEach((q, n) => tBox.append(button('🧪 ' + t(q[0]), (e) => { tested.add(n); log.append(h('div', null, '• ' + t(q[0]) + ' → ' + t(q[1]))); e.currentTarget.disabled = true; refresh(); }, 'btn ghost sm')));
    function name(id) { return c.dx.find((d) => d[0] === id)[1]; }
    function refresh() {
      rankBox.replaceChildren(...order.map((id, i) => h('div', { class: 'lab-row' }, h('b', null, `${i + 1}.`), h('span', { style: { flex: 1 } }, t(name(id))),
        button('▲', () => mv(i, -1)), button('▼', () => mv(i, 1)))));
    }
    function mv(i, d) { const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; refresh(); }
    function evidence() {
      const sc = {}; c.dx.forEach((d) => { sc[d[0]] = 0; });
      asked.forEach((n) => Object.entries(c.qs[n][2]).forEach(([k, v]) => { sc[k] += v; }));
      tested.forEach((n) => Object.entries(c.tests[n][2]).forEach(([k, v]) => { sc[k] += v; }));
      return sc;
    }
    function submit() {
      if (done) return;
      const ev = evidence(); let agree = 0, pairs = 0;
      for (let a = 0; a < order.length; a++) for (let b = a + 1; b < order.length; b++) { pairs++; const d = ev[order[a]] - ev[order[b]]; if (d >= 0) agree++; }
      const consistent = agree / pairs;
      const reds = c.qs.map((q, n) => (q[3] ? n : -1)).filter((n) => n >= 0), redHit = reds.filter((n) => asked.has(n)).length / reds.length;
      const key = c.tests.findIndex((x) => x[3] === 'key'), keyOk = tested.has(key) ? 1 : 0;
      const waste = [...tested].filter((n) => c.tests[n][3] === 'low').length;
      const top = order.indexOf(c.truth) === 0 ? 1 : order.indexOf(c.truth) === 1 ? 0.5 : 0;
      const safety = (redHit * 0.4 + keyOk * 0.3 + (netPick ? 0.3 : 0)) ;
      const score = Math.max(0, consistent * 0.35 + safety * 0.4 + top * 0.15 + (asked.size >= 3 ? 0.1 : 0) - waste * 0.05);
      status.className = 'note ' + (score >= 0.65 ? 'ok' : 'warn');
      status.textContent = t(`Reasoning fit with your evidence: ${Math.round(consistent * 100)}%. Safety: ${Math.round(safety * 100)}%. Most likely cause in this case: ${name(c.truth)}.`) + (waste ? ' ' + t('Unneeded tests cost the patient time and worry.') : '') + (netPick === null ? ' ' + t('Pick a safety-net plan.') : netPick ? '' : ' ' + t('That safety-net advice is unsafe.'));
      api.say(t('Good reasoning follows the evidence you collected, checks the dangerous possibilities, and tells the family what to watch for.'));
      if (netPick !== null) { done = true; if (score >= 0.65) api.complete(Math.min(1, score), t('Reasoned from evidence and kept the patient safe.')); else done = false; }
    }
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), h('div', { class: 'card' }, '🧑‍⚕️ ' + t(c.who)),
      h('div', { class: 'small' }, '1. ' + t('Take a history (ask what you think matters)')), qBox,
      h('div', { class: 'small' }, '2. ' + t('Choose tests (only what helps)')), tBox, log,
      h('div', { class: 'small' }, '3. ' + t('Predict: rank the causes, most likely first')), rankBox,
      h('div', { class: 'small' }, '4. ' + t('Safety net: what should the family be told?')), netBox,
      button(t('Submit my reasoning'), submit, 'btn'), status));
    refresh();
    return () => {};
  },
};
export default LAB;
