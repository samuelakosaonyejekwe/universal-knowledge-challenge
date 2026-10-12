import { h, button, choice, canvas, pointer } from '../core/labkit.js';

export default {
  id: 'w09-fraction-pizza',
  world: 9,
  levels: [1, 2],
  kind: 'lab',
  icon: '🍕',
  title: 'Fraction Pizza',
  goal: 'Eat exactly the fraction of the pizza that the mission asks for.',
  limits: 'Every slice is cut exactly equal, which real pizzas rarely are. Only unit-slice fractions up to eighths are shown, and the pizza is eaten, never shared.',
  mount(root, api) {
    const t = api.t;
    const parts = api.level <= 1 ? [2, 4] : [2, 3, 4, 6, 8];
    const den = parts[Math.floor(api.rng() * parts.length)];
    const num = 1 + Math.floor(api.rng() * (den - 1));
    let n = den;
    if (api.level >= 2) { const alt = [2, 3, 4, 6, 8].filter((x) => x % den === 0); n = alt[Math.floor(api.rng() * alt.length)]; }
    let eaten = Array(n).fill(false);
    let guess = null, done = false;

    const c = canvas(270);
    const goal = h('div', { class: 'lab-goal', style: { fontSize: '1.6rem', textAlign: 'center' } });
    const state = h('div', { class: 'note', 'aria-live': 'polite' });
    const guessBox = h('div', { class: 'lab-row' });
    const cutBox = h('div', { class: 'lab-row' });

    const count = () => eaten.filter(Boolean).length;
    const geom = () => ({ cx: c.w / 2, cy: 135, R: Math.min(c.w / 2 - 10, 120) });

    function draw() {
      const { ctx } = c, { cx, cy, R } = geom();
      ctx.clearRect(0, 0, c.w, c.h);
      ctx.fillStyle = '#e9edf7'; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, 7); ctx.fill();
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n, a1 = a0 + (2 * Math.PI) / n, am = (a0 + a1) / 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
        if (eaten[i]) { ctx.fillStyle = '#fff'; ctx.fill(); ctx.setLineDash([5, 5]); ctx.strokeStyle = '#b9c2da'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); continue; }
        ctx.fillStyle = '#ffd36b'; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = '#d98f3a'; ctx.beginPath(); ctx.arc(cx, cy, R - 3, a0, a1); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = '#c47a28'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a0), cy + R * Math.sin(a0)); ctx.stroke();
        ctx.fillStyle = '#d6453d';
        for (const k of [0.45, 0.72]) { ctx.beginPath(); ctx.arc(cx + R * k * Math.cos(am), cy + R * k * Math.sin(am), Math.max(5, R / (n + 6)), 0, 7); ctx.fill(); }
      }
      ctx.fillStyle = '#6b7390'; ctx.font = '700 15px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${count()} / ${n}`, cx, 268);
    }

    function check() {
      const k = count();
      state.textContent = k === 0 ? t('Tap slices to eat them.') : `${t('You ate')} ${k} / ${n}`;
      if (!done && k > 0 && k * den === num * n) {
        done = true; state.className = 'note ok';
        api.say(t('Yes! Different cuts can make the same fraction: the same amount of pizza.'));
        api.complete(guess === null || guess === k ? 1 : 0.8, `${num}/${den} = ${k}/${n}`);
      } else state.className = 'note';
    }

    function drawGuess() {
      guessBox.replaceChildren(h('span', null, t('Guess first: how many slices?')), ...Array.from({ length: n }, (_, i) =>
        h('button', { class: 'chip' + (guess === i + 1 ? ' on' : ''), type: 'button', style: { minHeight: '44px', minWidth: '44px', justifyContent: 'center' }, onClick: () => { guess = i + 1; drawGuess(); } }, String(i + 1))));
    }
    function setCuts(m) {
      n = m; eaten = Array(n).fill(false); guess = null; drawGuess(); check(); draw();
    }

    c.onResize = draw;
    c.el.setAttribute('aria-label', t('A pizza cut into slices. Tap a slice to eat it.'));
    const onDown = (ev) => {
      const p = pointer(c.el, ev), { cx, cy, R } = geom();
      const dx = p.x - cx, dy = p.y - cy;
      if (Math.hypot(dx, dy) > R + 8) return;
      let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += 2 * Math.PI;
      const i = Math.min(n - 1, Math.floor((a / (2 * Math.PI)) * n));
      eaten[i] = !eaten[i]; check(); draw();
    };
    c.el.addEventListener('pointerdown', onDown);

    goal.textContent = `${t('Eat')} ${num}/${den}`;
    const parts2 = [h('div', { class: 'card' }, goal), c.el, state, guessBox];
    if (api.level >= 2) {
      const ch = choice([2, 3, 4, 6, 8].map((m) => [m, `${m} ${t('slices')}`]), n, (m) => setCuts(m));
      cutBox.append(h('span', null, t('Cut into:')), ch.el);
      parts2.push(cutBox);
    }
    parts2.push(button(t('Start again'), () => { done = false; setCuts(n); }, 'btn ghost sm'));
    root.append(h('div', { class: 'lab' }, ...parts2));
    drawGuess(); check(); draw();
    api.say(t('Tap the slices you want to eat. Can you make the fraction?'));
    return () => c.el.removeEventListener('pointerdown', onDown);
  },
};
