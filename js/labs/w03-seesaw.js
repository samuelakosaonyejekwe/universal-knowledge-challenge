import { h, button, choice, canvas, loop, pointer } from '../core/labkit.js';

const ANIMALS = [null, ['🐭', 1], ['🐱', 2], ['🐶', 3], ['🐻', 4]];

// See-saw: balance when torque (weight × distance) is equal on both sides.
export default {
  id: 'w03-seesaw',
  world: 3,
  levels: [1, 2],
  kind: 'lab',
  icon: '⚖️',
  title: 'See-saw Balance',
  goal: 'Put friends on the right side so the see-saw balances.',
  limits: 'A weightless plank on one pivot, animals with weights of 1 to 4 units, no friction. Real see-saws also have the weight of the plank and the seat.',
  mount(root, api) {
    const t = api.t;
    const NS = 3; // slots per side
    const lockedD = 1 + Math.floor(api.rng() * NS), lockedM = 2 + Math.floor(api.rng() * 3);
    const slots = Array(2 * NS).fill(0); // index 0..2 = left d=3,2,1 ; 3..5 = right d=1,2,3
    const dist = (i) => (i < NS ? NS - i : i - NS + 1);
    const li = NS - lockedD; slots[li] = lockedM;
    let ang = 0, goal = 0, released = false, guess = null, done = false, first = true, wasRight = false, hold = 0, firstTestOK = null;

    const torque = () => slots.reduce((s, m, i) => s + (i < NS ? -m : m) * dist(i), 0);
    const cv = canvas(250);
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Tap the right side to add friends. Guess which way it tips, then press Let go!'));
    const guessRow = choice([['L', t('⬅ Left goes down')], ['B', t('⚖ Balanced')], ['R', t('Right goes down ➡')]], null, (g) => { guess = g; });

    cv.el.addEventListener('pointerdown', (e) => {
      const p = pointer(cv.el, e), W = cv.w, pw = W - 40;
      const i = Math.floor((p.x - 20) / pw * 2 * NS);
      if (i < NS || i >= 2 * NS || p.y < 40) return;
      slots[i] = (slots[i] + 1) % ANIMALS.length; released = false; goal = 0; msg.className = 'note'; msg.textContent = t('Changed! Guess again, then press Let go.');
    });

    const release = () => {
      if (!guess) { msg.className = 'note warn'; msg.textContent = t('Pick a guess first.'); return; }
      const tq = torque(); released = true; goal = Math.max(-0.35, Math.min(0.35, tq * 0.05)); hold = 0;
      const res = tq < 0 ? 'L' : tq > 0 ? 'R' : 'B';
      if (first) { first = false; firstTestOK = res === 'B'; }
      const rt = Math.abs(tq);
      if (res === guess) { msg.className = 'note ok'; msg.textContent = t('Your guess was right!'); } else { msg.className = 'note warn'; msg.textContent = t('Not what you guessed. Compare the pushes on each side.'); }
      const left = slots.slice(0, NS).reduce((s, m, i) => s + m * dist(i), 0), right = slots.slice(NS).reduce((s, m, i) => s + m * dist(i + NS), 0);
      api.say(t(res === 'B' ? 'Balanced! Heavy and close to the middle can match light and far away.' : 'The side with the bigger push (weight × distance from the middle) goes down.') + ' ' + left + ' ' + t('vs') + ' ' + right + (rt ? '' : ''));
    };

    const stop = loop((dt) => {
      ang += (goal - ang) * Math.min(1, dt * 4);
      const tq = torque();
      if (released && !done && tq === 0 && slots.slice(NS).some((m) => m) && Math.abs(ang) < 0.01) { hold += dt; if (hold > 0.8) { done = true; msg.className = 'note ok'; msg.textContent = t('Perfectly balanced! 🎉'); api.complete(firstTestOK ? 1 : 0.7, t('A see-saw balances when weight × distance is the same on both sides (the moment, or torque).')); } } else hold = 0;
      const c = cv.ctx, W = cv.w, pw = W - 40, cx = W / 2, cy = 175;
      c.fillStyle = '#16255a'; c.fillRect(0, 0, W, 250);
      c.fillStyle = '#4b5a90'; c.fillRect(0, 205, W, 45);
      c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - 24, 208); c.lineTo(cx + 24, 208); c.fill();
      c.save(); c.translate(cx, cy); c.rotate(ang);
      c.fillStyle = '#c98a4b'; c.fillRect(-pw / 2, -5, pw, 10);
      c.font = '30px serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff';
      slots.forEach((m, i) => {
        const sx = (i - NS + 0.5) * (pw / (2 * NS));
        c.fillStyle = i >= NS ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)'; c.fillRect(sx - 18, -8, 36, 4);
        if (m) { c.fillStyle = '#fff'; c.fillText(ANIMALS[m][0], sx, -10); c.font = 'bold 12px sans-serif'; c.fillText(String(m), sx, 16); c.font = '30px serif'; }
        else if (i >= NS) { c.font = '22px serif'; c.globalAlpha = 0.5; c.fillText('➕', sx, -10); c.globalAlpha = 1; c.font = '30px serif'; }
      });
      c.restore();
      c.fillStyle = '#fff'; c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText(t('Tap the right side to change friends'), cx, 242);
    });
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t('Put friends on the right side so the see-saw balances.')), msg, cv.el,
      h('div', { class: 'lab-row' }, guessRow.el),
      h('div', { class: 'lab-row' }, button(t('▶ Let go!'), release, 'btn ok'), button(t('🧹 Clear right side'), () => { for (let i = NS; i < 2 * NS; i++) slots[i] = 0; released = false; goal = 0; }, 'btn ghost sm'))));
    return () => { stop(); };
  },
};
