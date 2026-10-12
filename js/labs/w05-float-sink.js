import { h, button } from '../core/labkit.js';

const ITEMS = [
  ['🪵', 'wood', 600], ['🍎', 'apple', 800], ['🪨', 'rock', 2600], ['🧊', 'ice', 917], ['🔑', 'key', 7800],
  ['🏀', 'ball', 120], ['🦆', 'rubber duck', 300], ['🥔', 'potato', 1100], ['🕯️', 'candle', 900], ['🪙', 'coin', 8900],
  ['🍇', 'grape', 1050], ['🍃', 'leaf', 400],
];

export default {
  id: 'w05-float-sink',
  world: 5,
  levels: [1, 2],
  kind: 'lab',
  icon: '🛟',
  title: 'Float or Sink?',
  goal: 'Guess if each thing floats or sinks, then drop it in the water. Then load the boat!',
  limits: 'Uses density only (water is 1000 kg/m³). Real objects can have air inside, and shape and surface tension matter for small things. The boat is simplified to a box with a fixed carrying limit.',
  mount(root, api) {
    const t = api.t;
    const pool = [...ITEMS].sort(() => api.rng() - 0.5).slice(0, 5);
    let i = 0, right = 0, guess = null, done = false, timer = 0;
    const cap = 4 + Math.floor(api.rng() * 4); let cargo = 0;
    const reduce = api.reducedMotion;

    const item = h('div', { style: { position: 'absolute', left: '50%', top: '4px', fontSize: '3rem', transform: 'translateX(-50%)', transition: reduce ? 'none' : 'top 1.2s ease-in', lineHeight: 1 } });
    const tank = h('div', { style: { position: 'relative', height: '200px', maxWidth: '260px', margin: '0 auto', borderRadius: '14px', background: 'linear-gradient(#fff 0 40px, #7cc8ff 40px, #1f78c8)', overflow: 'hidden', border: '3px solid #5a8bb8' } },
      h('div', { style: { position: 'absolute', top: '40px', left: 0, right: 0, height: '3px', background: '#fff8' } }), item);
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const btnFloat = button('🏊 ' + t('Floats'), () => choose('float'), 'btn');
    const btnSink = button('⚓ ' + t('Sinks'), () => choose('sink'), 'btn ghost');
    const next = button('➡️ ' + t('Next'), () => advance(), 'btn ok');
    const row = h('div', { class: 'lab-row', style: { justifyContent: 'center' } }, btnFloat, btnSink);
    next.style.display = 'none';

    function show() {
      const [e, name] = pool[i];
      item.textContent = e; item.style.transition = 'none'; item.style.top = '4px';
      guess = null; next.style.display = 'none'; row.style.display = 'flex';
      status.className = 'note';
      status.textContent = t('Round') + ` ${i + 1}/5: ` + t('Will the') + ' ' + t(name) + ' ' + t('float or sink?');
    }
    function choose(g) {
      if (guess) return;
      guess = g;
      const [, name, d] = pool[i];
      const floats = d < 1000;
      void item.offsetWidth;
      item.style.transition = reduce ? 'none' : 'top 1.2s ease-in';
      item.style.top = floats ? '24px' : '150px';
      const ok = (g === 'float') === floats;
      if (ok) right++;
      row.style.display = 'none';
      status.className = 'note ' + (ok ? 'ok' : 'warn');
      status.textContent = (ok ? '🎉 ' : '🤔 ') + t(floats ? 'It floats!' : 'It sinks!');
      api.say(floats ? t(`The ${name} is lighter than the same amount of water, so water pushes it up.`) : t(`The ${name} is heavier than the same amount of water, so it sinks.`));
      next.style.display = '';
    }
    function advance() {
      i++;
      if (i >= pool.length) { finish(); return; }
      show();
    }
    function finish() {
      done = true;
      row.style.display = 'none'; next.style.display = 'none';
      status.className = 'note ok';
      status.textContent = `⭐ ${right}/5 ` + t('Now load the boat below!');
      api.complete(right / 5, t('Predicted floating and sinking by comparing things with water.'));
    }

    const boatBox = h('div', { style: { fontSize: '2.2rem', textAlign: 'center', minHeight: '3.2rem' } });
    const boatTank = h('div', { style: { position: 'relative', height: '110px', maxWidth: '260px', margin: '0 auto', borderRadius: '14px', background: 'linear-gradient(#fff 0 40px, #7cc8ff 40px, #1f78c8)', overflow: 'hidden', border: '3px solid #5a8bb8' } });
    const boat = h('div', { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', transition: reduce ? 'none' : 'top .5s', width: '200px' } });
    boatTank.append(boat);
    const boatMsg = h('div', { class: 'small', 'aria-live': 'polite' });
    function drawBoat() {
      const sunk = cargo > cap;
      boat.replaceChildren(h('div', { style: { fontSize: '1.4rem', minHeight: '1.6rem' } }, '📦'.repeat(Math.min(cargo, 8))), h('div', { style: { fontSize: '2.6rem', lineHeight: 1 } }, '⛵'));
      boat.style.top = (sunk ? 62 : 12 + cargo * 6) + 'px';
      boatMsg.textContent = sunk ? t('Glug! Too heavy. The boat sinks. Tap Empty.') : t('Boxes') + `: ${cargo}`;
    }
    const add = button('➕ 📦', () => { if (cargo <= cap) { cargo++; drawBoat(); if (cargo > cap) api.say(t('The boat pushed away all the water it could. One more box was too much.')); } }, 'btn');
    const empty = button('♻️ ' + t('Empty'), () => { cargo = 0; drawBoat(); }, 'btn ghost');

    root.append(h('div', { class: 'lab' }, tank, status, row, next,
      h('h3', null, '⛵ ' + t('Load the boat')), boatTank, h('div', { class: 'lab-row', style: { justifyContent: 'center' } }, add, empty), boatMsg, boatBox));
    show(); drawBoat();
    return () => { clearTimeout(timer); };
  },
};
