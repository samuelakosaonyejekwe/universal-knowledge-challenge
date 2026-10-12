import { h, slider, readout, button, choice, canvas, loop, fmt } from '../core/labkit.js';

const PLANETS = { earth: ['🌍', 'Earth', 9.81], moon: ['🌙', 'Moon', 1.62], mars: ['🔴', 'Mars', 3.71], jupiter: ['🟠', 'Jupiter', 24.8] };

// Pendulum timer: T = 2π√(L/g) (small swings); mass does not matter.
export default {
  id: 'w01-pendulum',
  world: 1,
  levels: [3, 4],
  kind: 'lab',
  icon: '⏱️',
  title: 'Pendulum Timer',
  goal: 'Build a pendulum that swings with the target time for one full swing.',
  limits: 'A point-mass bob on a massless string, swing of about 15 degrees, no air drag and no friction at the pivot. Big swings take slightly longer than the formula says.',
  mount(root, api) {
    const t = api.t;
    const keys = Object.keys(PLANETS);
    const planetKey = keys[Math.floor(api.rng() * keys.length)];
    const gTarget = PLANETS[planetKey][2];
    const Ltarget = 0.3 + Math.floor(api.rng() * 45) * 0.05; // 0.3 .. 2.5 m
    const Ttarget = 2 * Math.PI * Math.sqrt(Ltarget / gTarget);
    const A0 = 0.26; // rad
    let cur = 'earth', th = A0, om = 0, L = 1, mass = 0.5, done = false, guess = null, tested = false, zc = [], measured = null;

    const cv = canvas(250);
    const Lsl = slider({ label: t('String length (m)'), min: 0.1, max: 3, step: 0.05, value: 1, unit: 'm', onInput: (v) => { L = v; reset(); } });
    const Msl = slider({ label: t('Bob mass (kg)'), min: 0.1, max: 2, step: 0.1, value: 0.5, unit: 'kg', onInput: (v) => { mass = v; reset(); } });
    const planet = choice(keys.map((k) => [k, PLANETS[k][0] + ' ' + t(PLANETS[k][1])]), 'earth', (k) => { cur = k; reset(); });
    const meas = readout(t('Measured time (s)'), '–');
    const want = readout(t('Target time (s)'), fmt(Ttarget, 3));
    const msg = h('div', { class: 'note', 'aria-live': 'polite' },
      t('Mission: on ') + PLANETS[planetKey][0] + ' ' + t(PLANETS[planetKey][1]) + t(' (g = ') + PLANETS[planetKey][2] + t(' m/s²) make one swing last ') + fmt(Ttarget, 3) + t(' s. First guess below.'));
    const guessRow = choice([['faster', t('Heavier swings faster')], ['same', t('Same time')], ['slower', t('Heavier swings slower')]], null, (g) => { guess = g; });

    function reset() { th = A0; om = 0; zc = []; measured = null; meas.set('–'); }
    const g = () => PLANETS[cur][2];

    const check = () => {
      const T = 2 * Math.PI * Math.sqrt(L / g()) * (1 + (A0 * A0) / 16);
      const err = Math.abs(T - Ttarget);
      if (guess && !tested) {
        tested = true;
        api.say(t(guess === 'same' ? 'You were right: the mass cancels out. Only the length and gravity set the time.' : 'Try changing the mass slider: the time stays the same! A heavier bob is pulled harder, but it is also harder to move, and the two cancel.'));
      }
      if (cur !== planetKey) { msg.className = 'note warn'; msg.textContent = t('Choose the planet from the mission first.'); return; }
      if (err <= 0.08) {
        msg.className = 'note ok'; msg.textContent = t('Yes! Your pendulum takes ') + fmt(T, 3) + t(' s.');
        if (!done) { done = true; api.say(t('T = 2π√(L/g). Longer string, longer swing; stronger gravity, quicker swing.')); api.complete(guess === 'same' ? 1 : 0.85, t('The swing time depends on length and gravity, not on mass: T = 2π√(L/g).')); }
      } else {
        msg.className = 'note warn';
        msg.textContent = (T > Ttarget ? t('Too slow (') : t('Too fast (')) + fmt(T, 3) + t(' s). ') + (T > Ttarget ? t('Make the string shorter.') : t('Make the string longer.'));
      }
    };

    const stop = loop((dt, tt) => {
      const steps = 20, d = dt / steps;
      for (let i = 0; i < steps; i++) {
        const prev = th;
        om += (-g() / L) * Math.sin(th) * d; th += om * d;
        if (prev > 0 && th <= 0) { zc.push(tt); if (zc.length > 3) zc.shift(); if (zc.length >= 2) { measured = zc[zc.length - 1] - zc[zc.length - 2]; meas.set(fmt(measured, 3)); } }
      }
      const c = cv.ctx, W = cv.w;
      c.fillStyle = '#0f1430'; c.fillRect(0, 0, W, 250);
      c.fillStyle = '#26356b'; c.fillRect(0, 0, W, 8);
      const px = W / 2, py = 10, len = 20 + (L / 3) * 190;
      const bx = px + len * Math.sin(th), by = py + len * Math.cos(th);
      c.strokeStyle = '#aab4e6'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by); c.stroke();
      c.fillStyle = '#ffb347'; c.beginPath(); c.arc(bx, by, 8 + mass * 5, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = '13px sans-serif'; c.textAlign = 'left';
      c.fillText(PLANETS[cur][0] + ' g = ' + PLANETS[cur][2] + ' m/s²', 8, 240);
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Build a pendulum that swings with the target time for one full swing.')),
      msg, cv.el,
      h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, t('Guess: if the bob gets heavier…')), guessRow.el),
      h('div', { class: 'lab-row' }, Lsl.el, Msl.el),
      h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, t('Planet:')), planet.el),
      h('div', { class: 'lab-row' }, want.el, meas.el, button(t('✔ Check my pendulum'), check, 'btn ok sm'))));
    return () => { stop(); };
  },
};
