import { h, button, readout, canvas, loop, choice, fmt } from '../core/labkit.js';

// Push-and-pull cart: F = m·a with a little friction. For young children.
export default {
  id: 'w01-force-cart',
  world: 1,
  levels: [1, 2],
  kind: 'lab',
  icon: '🛒',
  title: 'Push the Cart',
  goal: 'Push and pull the cart so it stops on the star.',
  limits: 'One straight track, a constant push of 3 newtons, a small steady rolling friction of 1 newton and no air. Real carts also have wheel bearings and air drag.',
  mount(root, api) {
    const t = api.t;
    const TRACK = 10, PUSH = 3, FRIC = 1;
    const target = 3 + Math.floor(api.rng() * 6); // 3..8 m
    let x = 1, v = 0, boxes = 0, force = 0, held = 0, done = false, guess = null, guessed = false, firstPush = true;
    const mass = () => 1 + boxes; // kg: empty cart 1 kg, each box 1 kg

    const cv = canvas(170);
    const vel = readout(t('Speed (m/s)'), '0');
    const acc = readout(t('Speed-up (m/s²)'), '0');
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Which cart speeds up faster when you push? Choose, then try!'));

    const guessRow = choice([['light', t('🧸 Empty cart')], ['heavy', t('📦 Full cart')]], null, (g) => {
      guess = g;
      msg.textContent = t('Good guess. Now push the empty cart, then add boxes and push again.');
    });
    const loadRow = choice([[0, t('Empty')], [1, '📦'], [2, '📦📦'], [3, '📦📦📦']], 0, (b) => { boxes = b; });

    const press = (dir) => (e) => { e.preventDefault(); force = dir * PUSH; held = dir; };
    const release = () => { force = 0; held = 0; };
    const big = (label, dir, cls) => h('button', {
      class: 'btn ' + cls, type: 'button', style: { flex: '1 1 120px', minHeight: '64px', fontSize: '1.2rem' },
      onPointerdown: press(dir), onPointerup: release, onPointerleave: release, onPointercancel: release,
    }, label);
    const pull = big(t('⬅ Pull'), -1, 'gold');
    const push = big(t('Push ➡'), 1, 'ok');

    let still = 0;
    const px = (m) => 24 + (m / TRACK) * (cv.w - 48);
    const draw = () => {
      const c = cv.ctx, W = cv.w;
      c.clearRect(0, 0, W, 170);
      c.fillStyle = '#1b2a5a'; c.fillRect(0, 0, W, 170);
      c.fillStyle = '#3b4a7a'; c.fillRect(0, 122, W, 48);
      c.fillStyle = '#ffd24a'; c.fillRect(px(target) - 22, 122, 44, 6);
      c.font = '34px serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText('⭐', px(target), 112);
      c.fillText('🛒', px(x), 122);
      for (let i = 0; i < boxes; i++) c.fillText('📦', px(x) - 6 + (i % 2) * 8, 88 - i * 22);
      if (held) { c.font = '28px serif'; c.fillText(held > 0 ? '👉' : '👈', px(x) - held * 36, 100); }
      c.fillStyle = '#fff'; c.font = '12px sans-serif';
      for (let m = 0; m <= TRACK; m += 2) c.fillText(m + ' m', px(m), 160);
    };

    const stop = loop((dt) => {
      const m = mass();
      let a = force / m;
      if (Math.abs(v) > 0.001) a -= Math.sign(v) * FRIC / m;
      else if (force === 0 || Math.abs(force) <= FRIC) a = 0;
      else a -= Math.sign(force) * FRIC / m;
      const v0 = v;
      v += a * dt;
      if (Math.abs(v0) > 0.001 && Math.sign(v) !== Math.sign(v0) && force === 0) v = 0; // friction cannot reverse motion
      x += v * dt;
      if (x < 0) { x = 0; v = 0; } else if (x > TRACK) { x = TRACK; v = 0; }
      vel.set(fmt(Math.abs(v), 2)); acc.set(fmt(Math.abs(a), 2));
      if (force !== 0 && firstPush) { firstPush = false; api.say(t('Pushing gives the cart a speed-up. The more boxes, the smaller the speed-up!')); }
      if (boxes >= 2 && force !== 0 && guess && !guessed) {
        guessed = true;
        const ok = guess === 'light';
        api.say(t(ok ? 'Yes! An empty cart is easier to speed up. Heavy things need a bigger push.' : 'Look at the speed-up number: the full cart gets less. Heavy things need a bigger push!'));
      }
      if (!done && Math.abs(v) < 0.05 && Math.abs(x - target) < 0.4) still += dt; else still = 0;
      if (!done && still > 0.7) {
        done = true;
        msg.className = 'note ok'; msg.textContent = t('You parked on the star! 🎉');
        api.say(t('Great parking! A push makes it go, and a pull in the other direction slows it down.'));
        api.complete(guess ? 1 : 0.85, t('A bigger force or a smaller mass gives a bigger speed-up (F = m × a).'));
      }
      draw();
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Push and pull the cart so it stops on the star.')),
      cv.el, msg,
      h('div', { class: 'lab-row' }, pull, push),
      h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, t('Cart:')), guessRow.el),
      h('div', { class: 'lab-row' }, h('span', { class: 'lab-goal' }, t('Load:')), loadRow.el),
      h('div', { class: 'lab-row' }, vel.el, acc.el, button(t('↺ Start again'), () => { x = 1; v = 0; still = 0; done = false; msg.className = 'note'; msg.textContent = t('Back to the start!'); }, 'btn ghost sm'))));
    return () => { stop(); };
  },
};
