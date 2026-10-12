import { h, button, readout } from '../core/labkit.js';

// Invented adult ranges for a teaching game only.
const NORMAL = { hr: [60, 100], rr: [12, 20], t: [36.1, 37.8], o2: [95, 100] };
const CRIT = { hr: [40, 130], rr: [8, 30], t: [35, 39.5], o2: [90, 100] };
const NAMES = ['Sam', 'Ada', 'Leo', 'Ines', 'Omar', 'Kai', 'Zoe', 'Ravi', 'Lena'];
const CAT = { green: ['🟢', 'Routine'], amber: ['🟡', 'Soon'], red: ['🔴', 'Urgent'] };

function level(v) {
  let sev = 0;
  for (const k of Object.keys(NORMAL)) {
    if (v[k] < CRIT[k][0] || v[k] > CRIT[k][1] && k !== 'o2') return 2;
    if (v[k] < NORMAL[k][0] || v[k] > NORMAL[k][1]) sev = Math.max(sev, 1);
  }
  return sev;
}

const LAB = {
  id: 'w18-triage-desk',
  world: 18,
  levels: [3, 4],
  kind: 'lab',
  icon: '🩺',
  title: 'Triage Desk',
  goal: 'Sort six invented patients by urgency using the normal ranges. When unsure, escalate.',
  limits: 'All patients are fictional and this is an educational simulation, never medical advice. Real triage also uses age, symptoms, history and clinical judgement, and ranges differ for children. Only four vital signs are used here.',
  mount(root, api) {
    const t = api.t, r = api.rng;
    const between = (a, b, d = 0) => +(a + r() * (b - a)).toFixed(d);
    const mk = (cat, i) => {
      const v = { hr: between(65, 95), rr: between(13, 19), t: between(36.3, 37.6, 1), o2: between(96, 99) };
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      if (cat >= 1) { const k = pick(['hr', 'rr', 't', 'o2']); v[k] = { hr: between(105, 125), rr: between(22, 27), t: between(38.0, 39.2, 1), o2: between(91, 94) }[k]; }
      if (cat === 2) { const k = pick(['hr', 'rr', 't', 'o2']); v[k] = { hr: between(135, 160), rr: between(32, 40), t: between(39.7, 40.5, 1), o2: between(82, 89) }[k]; }
      return { name: NAMES[i], v, ans: level(v) };
    };
    const cats = [0, 0, 1, 1, 2, 2].sort(() => r() - 0.5);
    const pts = cats.map((c, i) => mk(c, i));
    let i = 0, score = 0, under = 0, locked = false, guess = null;
    const rd = { hr: readout(t('Heart rate (bpm)')), rr: readout(t('Breaths (/min)')), t: readout(t('Temp (°C)')), o2: readout(t('Oxygen (%)')) };
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const next = button(t('Next patient'), () => advance(), 'btn ok'); next.style.display = 'none';
    const row = h('div', { class: 'lab-row' }, ...['green', 'amber', 'red'].map((c, k) => button(CAT[c][0] + ' ' + t(CAT[c][1]), () => pick(k), 'btn')));
    const title = h('div', { class: 'lab-goal' });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)),
      h('div', { class: 'small' }, t('Normal: heart 60–100, breaths 12–20, temp 36.1–37.8, oxygen 95–100. Danger: heart under 40 or over 130, breaths under 8 or over 30, temp under 35 or over 39.5, oxygen under 90.')),
      title, h('div', { class: 'lab-row' }, ...Object.values(rd).map((x) => x.el)), h('div', { class: 'small' }, t('Predict first: how urgent is this patient?')), row, status, next));
    show();

    function show() {
      const p = pts[i]; locked = false; row.style.display = 'flex'; next.style.display = 'none';
      title.textContent = `👤 ${p.name} (${i + 1}/6)`;
      for (const k of Object.keys(rd)) rd[k].set(String(p.v[k]));
      status.className = 'note'; status.textContent = t('Choose Routine, Soon or Urgent.');
    }
    function pick(k) {
      if (locked || i >= pts.length) return; locked = true; guess = k;
      const p = pts[i], d = k - p.ans;
      const s = d === 0 ? 1 : d > 0 ? 0.6 : 0; score += s; if (d < 0) under++;
      const why = Object.keys(NORMAL).filter((x) => p.v[x] < NORMAL[x][0] || p.v[x] > NORMAL[x][1]).map((x) => ({ hr: 'heart rate', rr: 'breathing rate', t: 'temperature', o2: 'oxygen' }[x]));
      status.className = 'note ' + (d === 0 ? 'ok' : d > 0 ? 'warn' : 'bad');
      status.textContent = (d === 0 ? '✅ ' : d > 0 ? '⚠️ ' + t('Safe, but more urgent than needed.') + ' ' : '🚨 ' + t('Too low. Missing an urgent patient is the worst mistake.') + ' ') + t('Answer') + ': ' + t(CAT[['green', 'amber', 'red'][p.ans]][1]) + '. ' + (why.length ? t('Outside normal') + ': ' + why.map(t).join(', ') + '.' : t('All four signs are in the normal range.'));
      if (d < 0) api.say(t('When in doubt, escalate. Sending a well person to be checked costs little; missing a sick one can cost a lot.'));
      row.style.display = 'none'; next.style.display = '';
    }
    function advance() {
      i++; if (i < pts.length) return show();
      const sc = score / pts.length; next.style.display = 'none';
      status.className = 'note ' + (sc >= 0.7 && !under ? 'ok' : 'warn');
      status.textContent = t(`Desk closed: ${Math.round(sc * 100)}% with ${under} under-triaged.`);
      if (sc >= 0.7 && !under) api.complete(sc, t('Triaged all patients safely using stated ranges.'));
      else next.after(button(t('New shift'), () => { i = 0; score = 0; under = 0; pts.forEach((p, n) => Object.assign(p, mk(cats[n], n))); show(); }, 'btn'));
    }
    return () => {};
  },
};
export default LAB;
