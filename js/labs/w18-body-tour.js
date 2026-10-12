import { h, button } from '../core/labkit.js';

const ORGANS = [
  { id: 'brain', e: '🧠', name: 'Brain', x: 50, y: 9, fn: 'The brain is your control centre. It helps you think, feel and move.', q: 'Which part helps you think?' },
  { id: 'lungs', e: '🫁', name: 'Lungs', x: 50, y: 31, fn: 'Lungs take in air so your body gets oxygen. You breathe in and out.', q: 'Which part helps you breathe?' },
  { id: 'heart', e: '❤️', name: 'Heart', x: 62, y: 39, fn: 'The heart is a pump. It pushes blood all around your body.', q: 'Which part pumps blood?' },
  { id: 'stomach', e: '🍽️', name: 'Stomach', x: 42, y: 54, fn: 'The stomach mixes up the food you eat so your body can use it.', q: 'Which part mixes your food?' },
  { id: 'bones', e: '🦴', name: 'Bones', x: 50, y: 76, fn: 'Bones hold you up and keep you strong, like a frame.', q: 'Which part holds you up?' },
];

const LAB = {
  id: 'w18-body-tour',
  world: 18,
  levels: [1, 2],
  kind: 'tour',
  icon: '🫀',
  title: 'Tour of the Body',
  goal: 'Tap each part of the body to meet it, then match each job to the right part.',
  limits: 'This is a simple cartoon, not a real body map: organs are drawn in rough places and sizes, and many organs are left out. It is an educational simulation, never medical advice.',
  mount(root, api) {
    const t = api.t;
    const seen = new Set(); let phase = 'tour', q = 0, right = 0, order = [], locked = false, timer = 0;
    const body = h('div', { style: { position: 'relative', width: 'min(100%, 240px)', height: '330px', margin: '0 auto' } },
      h('div', { style: { position: 'absolute', left: '33%', top: '1%', width: '34%', height: '17%', borderRadius: '50%', background: '#ffd9b8' } }),
      h('div', { style: { position: 'absolute', left: '22%', top: '19%', width: '56%', height: '46%', borderRadius: '30px', background: '#ffe6cf' } }),
      h('div', { style: { position: 'absolute', left: '28%', top: '66%', width: '18%', height: '32%', borderRadius: '14px', background: '#ffd9b8' } }),
      h('div', { style: { position: 'absolute', left: '54%', top: '66%', width: '18%', height: '32%', borderRadius: '14px', background: '#ffd9b8' } }));
    const spots = {};
    for (const o of ORGANS) {
      const b = h('button', { type: 'button', 'aria-label': t(o.name), class: 'btn ghost', style: { position: 'absolute', left: o.x + '%', top: o.y + '%', transform: 'translate(-50%,-50%)', width: '54px', height: '54px', minHeight: '54px', padding: 0, fontSize: '1.7rem', borderRadius: '50%' }, onClick: () => tap(o) }, o.e);
      spots[o.id] = b; body.append(b);
    }
    const status = h('div', { class: 'note', 'aria-live': 'polite' }, t('Tap a part of the body.'));
    const prog = h('div', { class: 'small muted', style: { textAlign: 'center' } });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), body, status, prog));
    upd();

    function upd() { prog.textContent = phase === 'tour' ? `${seen.size} / ${ORGANS.length} ` + t('met') : t('Question') + ` ${q + 1} / 4`; }
    function tap(o) {
      if (phase === 'tour') {
        seen.add(o.id); spots[o.id].style.boxShadow = '0 0 0 3px #17a673';
        status.className = 'note'; status.textContent = `${o.e} ${t(o.name)}: ${t(o.fn)}`; api.say(t(o.fn));
        if (seen.size === ORGANS.length) { timer = setTimeout(startQuiz, 1800); }
        upd();
      } else if (!locked) {
        locked = true; const want = order[q], ok = o.id === want.id; if (ok) right++;
        status.className = 'note ' + (ok ? 'ok' : 'warn');
        status.textContent = ok ? '🎉 ' + t('Yes!') + ' ' + t(want.fn) : '🤔 ' + t('That is the') + ' ' + t(o.name) + '. ' + t('The answer is the') + ' ' + t(want.name) + '.';
        q++;
        timer = setTimeout(() => { if (q >= 4) finish(); else ask(); }, 1600);
      }
    }
    function startQuiz() {
      phase = 'quiz'; order = [...ORGANS].sort(() => api.rng() - 0.5).slice(0, 4);
      Object.values(spots).forEach((b) => { b.style.boxShadow = ''; }); ask();
    }
    function ask() { locked = false; status.className = 'note'; status.textContent = '❓ ' + t(order[q].q); upd(); }
    function finish() {
      const score = right / 4;
      status.className = 'note ok'; status.textContent = t(`You matched ${right} of 4 jobs!`);
      api.say(t('Every part of your body has a job, and they all work together.'));
      if (score >= 0.5) api.complete(score, t('Explored the body and matched parts to jobs.'));
      else { phase = 'tour'; q = 0; right = 0; seen.clear(); status.textContent += ' ' + t('Tap the parts again to learn more.'); upd(); }
    }
    return () => clearTimeout(timer);
  },
};
export default LAB;
