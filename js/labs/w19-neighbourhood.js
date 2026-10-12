import { h, button, choice } from '../core/labkit.js';

const N = 7, REACH = 3;
const SERV = [['🌳', 'park'], ['🏫', 'school'], ['🏥', 'clinic'], ['🚌', 'bus stop']];

const LAB = {
  id: 'w19-neighbourhood',
  world: 19,
  levels: [1, 2],
  kind: 'studio',
  icon: '🏘️',
  title: 'Build a Neighbourhood',
  goal: 'Place the park, school, clinic and bus stop so every home can walk to all of them.',
  limits: 'A flat square grid where "near" means within 3 squares, ignoring roads, hills, cost and what people actually prefer. Real planners also consult the people who live there.',
  mount(root, api) {
    const t = api.t, r = api.rng;
    const ox = Math.floor(r() * 3), oy = Math.floor(r() * 3);
    const homes = new Set();
    while (homes.size < 6) homes.add((oy + Math.floor(r() * 4)) * N + ox + Math.floor(r() * 4));
    const put = {}; let sel = 0, done = false;
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${N},1fr)`, gap: '3px', width: 'min(100%,350px)', margin: '0 auto' } });
    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const b = h('button', { type: 'button', class: 'btn ghost', 'aria-label': `${t('square')} ${i + 1}`, style: { aspectRatio: '1', minHeight: 0, padding: 0, fontSize: 'clamp(1rem,6vw,1.7rem)', background: homes.has(i) ? '#fff2cf' : '#e4f6e0' }, onClick: () => place(i) });
      cells.push(b); grid.append(b);
    }
    const tray = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const guessRow = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    let guess = null;
    const guessC = choice([0, 1, 2, 3, 4, 5, 6].map((n) => [n, String(n)]), null, (v) => { guess = v; });
    const check = button('✔ ' + t('Check'), () => verify(), 'btn ok');
    guessRow.append(h('span', { class: 'lab-goal' }, '🏠 ' + t('How many homes will be happy?')), guessC.el, check);
    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t(LAB.goal)), tray, grid, guessRow, status));
    drawTray(); draw();

    function drawTray() {
      tray.replaceChildren(...SERV.map(([e, n], k) => h('button', { type: 'button', 'aria-label': t(n), class: 'chip' + (sel === k ? ' on' : ''), style: { fontSize: '1.8rem', minWidth: '64px', minHeight: '52px', justifyContent: 'center', opacity: k in put ? 0.5 : 1 }, onClick: () => { sel = k; drawTray(); } }, e)));
    }
    function place(i) {
      if (homes.has(i)) { api.say(t('That square already has a home. Pick an empty square.')); return; }
      for (const k of Object.keys(put)) if (put[k] === i) delete put[k];
      put[sel] = i;
      const next = SERV.findIndex((_, k) => !(k in put)); if (next >= 0) sel = next;
      drawTray(); draw();
    }
    function near(a, b) { return Math.max(Math.abs(a % N - b % N), Math.abs(Math.floor(a / N) - Math.floor(b / N))) <= REACH; }
    function served(home) { return SERV.every((_, k) => k in put && near(home, put[k])); }
    function draw() {
      cells.forEach((b, i) => {
        const k = Object.keys(put).find((x) => put[x] === i);
        b.textContent = homes.has(i) ? '🏠' : k !== undefined ? SERV[k][0] : '';
      });
    }
    function verify() {
      if (Object.keys(put).length < 4) { status.className = 'note warn'; status.textContent = t('Place all four buildings first.'); return; }
      if (guess == null) { status.className = 'note warn'; status.textContent = t('Make your guess first!'); return; }
      const hs = [...homes], ok = hs.filter(served);
      hs.forEach((hm) => { cells[hm].textContent = served(hm) ? '😊' : '😟'; });
      const good = ok.length === hs.length;
      status.className = 'note ' + (good ? 'ok' : 'warn');
      status.textContent = `${ok.length}/${hs.length} ` + t('homes are happy.') + (guess === ok.length ? ' 🎯 ' + t('Your guess was right!') : '');
      api.say(good ? t('Putting services in the middle of everyone makes the walk short for all.') : t('A sad home is too far from at least one building. Try moving them closer to the middle of the homes.'));
      if (good && !done) { done = true; api.complete(guess === ok.length ? 1 : 0.85, t('Placed services so every home is close to all of them.')); }
    }
    return () => {};
  },
};
export default LAB;
