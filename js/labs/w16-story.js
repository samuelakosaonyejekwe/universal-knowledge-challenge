import { h, button, readout } from '../core/labkit.js';

// Four short original fables, five beats each: beginning, three middle beats, end. Level 1 uses beats 1, 3 and 5.
export const FABLES = [
  { title: 'The Little Cloud', beats: [['☁️', 'A little cloud wishes it were big.'], ['💧', 'It drinks and drinks from the lake.'], ['🌬️', 'The wind carries it over a dry garden.'], ['🌧️', 'The cloud gives all its rain away.'], ['🌈', 'The flowers grow, and a rainbow smiles.']],
    guess: [['🌻', 'The cloud shares its rain.'], ['🙈', 'The cloud keeps its rain.']], moral: 'Giving can make you happy.' },
  { title: 'The Ant and the Crumb', beats: [['🍞', 'Ant finds a huge crumb.'], ['😓', 'It is far too heavy to carry alone.'], ['📣', 'Ant calls her friends.'], ['🐜', 'Together they lift the crumb.'], ['🎉', 'At home, everybody eats.']],
    guess: [['🤝', 'Friends help to carry it.'], ['🚶', 'Ant walks away hungry.']], moral: 'Together we are strong.' },
  { title: 'The Firefly', beats: [['🌙', 'Night comes. Firefly is afraid of the dark.'], ['🐭', 'A little mouse is lost.'], ['✨', 'Firefly switches on her tiny light.'], ['🏡', 'She leads the mouse all the way home.'], ['😊', 'Now Firefly knows: a small light is a big help.']],
    guess: [['🏡', 'Firefly lights the way home.'], ['🛌', 'Firefly hides until morning.']], moral: 'Even a small light can help.' },
  { title: 'The Apple Seed', beats: [['🌰', 'A tiny seed falls to the ground.'], ['🤲', 'A girl covers it with soil.'], ['🚿', 'Every day she waters it, and waits.'], ['🌱', 'One morning a green shoot peeps out.'], ['🍎', 'At last it is a tree full of apples.']],
    guess: [['🍎', 'The seed becomes a tree.'], ['🐦', 'A bird flies off with the seed.']], moral: 'Good things take time.' },
];
const PART = [['🟢', 'Beginning'], ['🟡', 'Middle'], ['🔴', 'End']];

export default {
  id: 'w16-story',
  world: 16,
  levels: [1, 2],
  kind: 'lab',
  icon: '📖',
  title: 'Story Builder',
  goal: 'Guess the ending, then put the story cards in order: beginning, middle, end.',
  limits: 'These are very short fables written for this game, with one clear order. Real stories can begin in the middle, jump back in time or end in surprising ways.',
  mount(root, api) {
    const t = api.t, lvl = api.level <= 1 ? 1 : 2;
    let fable, beats, slots, guessed, wrongTurns, done, last = -1, told = 0;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    const head = h('div', { class: 'lab-goal', style: { fontSize: '1.2rem', textAlign: 'center' }, 'aria-live': 'polite' });
    const stage = h('div', { class: 'lab-grid' });
    const toldOut = readout(t('Stories told'), '0');
    const cardStyle = { display: 'flex', alignItems: 'center', gap: '.6rem', width: '100%', minHeight: '62px', padding: '.4rem .7rem', borderRadius: '16px', border: '3px solid var(--line)',
      background: 'var(--card)', cursor: 'pointer', textAlign: 'start', fontWeight: '700' };
    const card = (b, onClick, extra = {}) => h('button', { type: 'button', style: { ...cardStyle, ...extra }, onClick },
      h('span', { style: { fontSize: '2rem', lineHeight: '1' }, 'aria-hidden': 'true' }, b[0]), h('span', null, t(b[1])));

    function begin() {
      let i; do { i = Math.floor(api.rng() * FABLES.length); } while (i === last);
      last = i; fable = FABLES[i];
      beats = (lvl === 1 ? [0, 2, 4] : [0, 1, 2, 3, 4]).map((k, n) => ({ n, b: fable.beats[k] }));
      slots = Array(beats.length).fill(null); guessed = null; wrongTurns = 0; done = false;
      // Predict first: see only the beginning and guess how it will end.
      head.textContent = '📖 ' + t(fable.title);
      const opts = api.rng() < 0.5 ? [0, 1] : [1, 0];
      stage.replaceChildren(card(beats[0].b, () => api.say(t(beats[0].b[1])), { borderColor: '#17a673' }),
        h('div', { class: 'lab-goal', style: { textAlign: 'center' } }, '🤔 ' + t('How will it end?')),
        ...opts.map((o) => card(fable.guess[o], () => { guessed = o; api.say(t('Good guess! Now put the story in order to find out.')); order(); }, { borderStyle: 'dashed' })));
      api.say(t(beats[0].b[1]) + ' ' + t('How will it end?'));
    }

    const partOf = (i) => (i === 0 ? 0 : i === slots.length - 1 ? 2 : 1);
    function order() {
      head.textContent = '🧩 ' + t('What happens first? Tap the cards in order.');
      const tray = beats.map((x) => [api.rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      if (tray.every((x, i) => x.n === i)) tray.reverse();
      const draw = () => {
        const slotEls = slots.map((s, i) => {
          const [dot, name] = PART[partOf(i)];
          const label = h('span', { class: 'small', style: { minWidth: '5.2rem', fontWeight: '800' } }, dot + ' ' + t(name));
          const body = s ? card(s.b, () => { if (!done) { slots[i] = null; draw(); } }, { borderColor: ['#17a673', '#e89b0c', '#d9485f'][partOf(i)] })
            : h('div', { style: { ...cardStyle, cursor: 'default', borderStyle: 'dashed', color: 'var(--muted)' } }, '…');
          return h('div', { style: { display: 'flex', alignItems: 'center', gap: '.4rem' } }, label, body);
        });
        const left = tray.filter((x) => !slots.includes(x));
        stage.replaceChildren(...slotEls, left.length ? h('hr', { style: { width: '100%', border: '0', borderTop: '2px dashed var(--line)' } }) : null,
          ...left.map((x) => card(x.b, () => { const at = slots.indexOf(null); if (at < 0) return; slots[at] = x; api.say(t(x.b[1])); draw(); if (!slots.includes(null)) later(check, 500); })));
      };
      const check = () => {
        if (done || slots.includes(null)) return;
        const bad = slots.map((s, i) => (s.n === i ? -1 : i)).filter((i) => i >= 0);
        if (bad.length) {
          wrongTurns++;
          const firstBad = bad[0];
          for (const i of bad) slots[i] = null;
          api.say(t(firstBad === 0 ? 'Hmm. A story starts by showing who it is about. Which card does that?' : 'Almost! Ask: what had to happen before this could happen?'));
          draw(); return;
        }
        done = true; told++; toldOut.set(String(told));
        head.textContent = '🌟 ' + t(fable.moral);
        api.say(beats.map((x) => t(x.b[1])).join(' ') + ' ' + t(fable.moral) + ' ' + t(guessed === 0 ? 'You guessed the ending!' : 'The ending was a surprise!'));
        api.complete(Math.max(0.4, 1 - 0.15 * wrongTurns), t('Put a story in order: beginning, middle and end.'));
        draw();
        stage.append(h('div', { class: 'note ok' }, '💡 ' + t(fable.moral)), button('▶️ ' + t('Another story'), begin, 'btn'));
      };
      draw();
    }

    root.append(h('div', { class: 'lab' }, head, stage, h('div', { class: 'lab-row' }, toldOut.el)));
    begin();
    return () => { for (const id of timers) clearTimeout(id); timers.clear(); stage.replaceChildren(); };
  },
};
