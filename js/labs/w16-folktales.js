import { h, button, canvas, readout, pointer } from '../core/labkit.js';

// Six widely shared folktales, retold very briefly, each with the people who tell it. [latitude, longitude] in degrees.
export const STOPS = [
  { id: 'anansi', continent: 'Africa', place: 'Ghana, West Africa', at: [6.7, -1.6], icon: '🕷️', title: 'How Anansi Won the Stories',
    teller: 'the Akan (Asante) people of Ghana', hero: ['🕷️', 'a spider'], decoys: [['🦁', 'a lion'], ['🐘', 'an elephant']],
    tale: 'Long ago every story belonged to Nyame, the sky god. Anansi the spider asked to buy them, and Nyame named a price no one had ever paid: bring me the hornets, the python and the leopard. Anansi was small, but he caught each one with a clever trick, and Nyame kept his word. That is why stories are called Anansesem, "spider stories".',
    idea: 'A small character wins by thinking, not by strength.' },
  { id: 'monkey', continent: 'Asia', place: 'India, South Asia', at: [25.3, 83.0], icon: '🐒', title: 'The Monkey and the Crocodile',
    teller: 'storytellers of India, in the ancient Panchatantra', hero: ['🐒', 'a monkey'], decoys: [['🐅', 'a tiger'], ['🦚', 'a peacock']],
    tale: 'A monkey shared the sweet fruit of his tree with a crocodile every day. One day the crocodile offered him a ride across the river, and halfway over admitted it was a trap. "What a pity," said the monkey calmly, "I left my heart at home in the tree. Take me back for it." The crocodile turned round, and the monkey leapt to safety.',
    idea: 'Staying calm and thinking fast can get you out of trouble.' },
  { id: 'bremen', continent: 'Europe', place: 'Germany, Europe', at: [53.1, 8.8], icon: '🐓', title: 'The Bremen Town Musicians',
    teller: 'German storytellers, written down by the Brothers Grimm', hero: ['🐓', 'a rooster and three friends'], decoys: [['👑', 'a king'], ['🐺', 'a wolf']],
    tale: 'A donkey, a dog, a cat and a rooster were thought too old to work, so they set off for the town of Bremen to become musicians. At night they found a house full of robbers. They climbed on one another\'s backs and sang all at once. The noise was so strange that the robbers ran away, and the four friends made the house their home.',
    idea: 'Friends who work together can do what none could do alone.' },
  { id: 'raven', continent: 'North America', place: 'Pacific Northwest Coast, North America', at: [53.0, -132.0], icon: '🐦', title: 'Raven Brings the Light',
    teller: 'the Haida, Tlingit and Tsimshian peoples', hero: ['🐦', 'a raven'], decoys: [['🐻', 'a bear'], ['🦌', 'a deer']],
    tale: 'In the beginning the world was dark, because an old man kept all the light shut in a box. Raven, the clever trickster, changed his shape to get into the house. When the box was opened at last, Raven took the light and flew up through the smoke hole, and so the sun, the moon and the stars came into the sky. Each nation and family tells this story in its own way.',
    idea: 'A trickster changes the world for everyone.' },
  { id: 'hummingbird', continent: 'South America', place: 'The Andes, South America', at: [-13.5, -72.0], icon: '🌺', title: 'The Hummingbird and the Fire',
    teller: 'the Quechua people of the Andes', hero: ['🐦', 'a hummingbird'], decoys: [['🐆', 'a jaguar'], ['🦙', 'a llama']],
    tale: 'A great fire broke out in the forest, and all the animals fled to the river. Only the tiny hummingbird flew back and forth, carrying one drop of water in her beak each time. "What do you think you are doing?" asked the big animals. "I am doing what I can," said the hummingbird.',
    idea: 'Everyone can do their part, however small.' },
  { id: 'maui', continent: 'Oceania', place: 'Aotearoa New Zealand, Oceania', at: [-39.3, 175.6], icon: '🎣', title: 'Māui Fishes Up the Land',
    teller: 'the Māori of Aotearoa New Zealand', hero: ['🎣', 'a young fisherman'], decoys: [['🦈', 'a shark'], ['🐋', 'a whale']],
    tale: 'Māui\'s older brothers would not take him fishing, so he hid in their canoe. Far out at sea he let down a magic hook handed down from his ancestor, and pulled with all his might. Up came a giant fish, which became the North Island: Te Ika-a-Māui, "the fish of Māui". Tales of Māui are told right across the Pacific, from Hawaiʻi to Tonga.',
    idea: 'A daring hero explains how the land itself came to be.' },
];
const LAND = [ // very rough outlines, [longitude, latitude]
  [[-165, 65], [-125, 70], [-95, 72], [-60, 55], [-78, 25], [-97, 17], [-83, 9], [-105, 22], [-125, 40], [-165, 58]],
  [[-80, 10], [-60, 10], [-35, -7], [-55, -35], [-70, -54], [-75, -20], [-81, -5]],
  [[-10, 36], [-9, 43], [0, 50], [5, 60], [25, 70], [40, 66], [40, 45], [27, 37], [10, 44], [0, 38]],
  [[-17, 15], [-6, 35], [10, 37], [32, 31], [43, 11], [51, 11], [40, -15], [32, -28], [20, -35], [13, -10], [9, 4], [-8, 5]],
  [[40, 45], [40, 66], [70, 73], [110, 75], [170, 68], [140, 50], [122, 30], [108, 12], [100, 3], [95, 18], [80, 8], [70, 22], [57, 25], [45, 13], [35, 30], [27, 37]],
  [[114, -22], [131, -12], [142, -11], [153, -27], [146, -39], [131, -32], [115, -34]],
  [[173, -35], [178, -38], [174, -41], [168, -46], [171, -41]],
];
// Great-circle distance on a sphere of radius 6371 km (haversine formula).
export function km([la1, lo1], [la2, lo2]) {
  const r = Math.PI / 180, a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export default {
  id: 'w16-folktales',
  world: 16,
  levels: [3, 4],
  kind: 'tour',
  icon: '🗺️',
  title: 'Folktale Journey',
  goal: 'Travel to six parts of the world, hear a folktale in each, and collect a stamp by naming the people who tell it.',
  limits: 'Each tale is squeezed into a few sentences, and every folktale has many versions: the people named here tell them far more richly, and some tales are shared by several peoples. The map is a rough sketch, and distances are straight great-circle lines on a perfectly round Earth.',
  mount(root, api) {
    const t = api.t;
    const cv = canvas(190);
    const path = [], stamps = new Set(), firstTry = new Set();
    let cur = null, phase = 'pick', done = false, total = 0;
    const kmOut = readout(t('Journey so far'), '0 km');
    const stampOut = readout(t('Stamps'), '0 / 6');
    const panel = h('div', { class: 'lab-grid', 'aria-live': 'polite' });
    const chips = h('div', { class: 'lab-row' });
    const xy = ([lat, lon]) => [((lon + 180) / 360) * cv.w, ((78 - lat) / 138) * cv.h];

    function draw() {
      const { ctx } = cv;
      ctx.clearRect(0, 0, cv.w, cv.h);
      ctx.fillStyle = '#2f6f5e';
      for (const poly of LAND) { ctx.beginPath(); poly.forEach(([lon, lat], i) => { const [x, y] = xy([lat, lon]); ctx[i ? 'lineTo' : 'moveTo'](x, y); }); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath();
      path.forEach((s, i) => { const [x, y] = xy(s.at); ctx[i ? 'lineTo' : 'moveTo'](x, y); }); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const s of STOPS) {
        const [x, y] = xy(s.at);
        ctx.fillStyle = s === cur ? '#ffd866' : stamps.has(s.id) ? '#7be0a8' : '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, s === cur ? 13 : 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillText(stamps.has(s.id) && s !== cur ? '✓' : s.icon, x, y + 1);
      }
    }

    function drawChips() {
      chips.replaceChildren(...STOPS.map((s) => h('button', { class: 'chip' + (s === cur ? ' on' : ''), type: 'button', onClick: () => go(s) }, (stamps.has(s.id) ? '✅ ' : s.icon + ' ') + t(s.continent))));
    }

    function go(s) {
      if (s === cur) return;
      if (cur) { total += km(cur.at, s.at); kmOut.set(Math.round(total / 100) * 100 + ' km'); }
      cur = s; path.push(s); phase = stamps.has(s.id) ? 'read' : 'guess';
      show(); draw(); drawChips();
    }

    const shuffled = (arr) => arr.map((x) => [api.rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    function show() {
      const s = cur, head = h('div', { class: 'lab-goal' }, '📍 ' + t(s.place));
      if (phase === 'guess') { // predict first: who might the hero of this place's tale be?
        panel.replaceChildren(head, h('div', null, t('Before you hear it: who do you think is the hero of this tale?')),
          h('div', { class: 'lab-row' }, shuffled([s.hero, ...s.decoys]).map(([icon, name]) => button(icon + ' ' + t(name), () => {
            phase = 'read'; show();
            api.say(t(name === s.hero[1] ? 'Good guess! In folktales the hero is often someone small or unexpected.' : 'A surprise! In folktales the hero is often someone small or unexpected.'));
          }, 'btn sm ghost'))));
        return;
      }
      const tellers = shuffled([s, ...shuffled(STOPS.filter((x) => x !== s)).slice(0, 2)]);
      let wrong = false;
      const ask = stamps.has(s.id)
        ? h('div', { class: 'note ok' }, '✅ ' + t('Told by') + ' ' + t(s.teller) + '.')
        : h('div', { class: 'lab-grid' }, h('div', { class: 'lab-goal' }, t('Which people tell this tale?')),
          ...tellers.map((x) => h('button', { class: 'btn sm ghost', type: 'button', style: { justifyContent: 'flex-start', textAlign: 'start' },
            onClick: (e) => {
              if (x !== s) { wrong = true; e.currentTarget.disabled = true; api.say(t('Not this one. Think about where on the map you are standing.')); return; }
              stamps.add(s.id); if (!wrong) firstTry.add(s.id);
              stampOut.set(stamps.size + ' / 6');
              api.say(t('Stamp collected! This tale is told by') + ' ' + t(s.teller) + '. ' + t(s.idea));
              show(); draw(); drawChips(); finish();
            } }, t(x.teller))));
      panel.replaceChildren(head, h('h3', { style: { margin: '0' } }, s.icon + ' ' + t(s.title)), h('p', { style: { margin: '0' } }, t(s.tale)),
        h('div', { class: 'note' }, '💡 ' + t(s.idea)), ask);
    }

    function finish() {
      if (done || stamps.size < STOPS.length) return;
      done = true;
      panel.append(h('div', { class: 'note ok' }, '🌍 ' + t('You have heard a tale from six parts of the world, travelling about') + ' ' + Math.round(total / 1000) * 1000 + ' km. '
        + t('Small, clever or brave heroes turn up everywhere: people far apart tell stories about the same hopes.')));
      api.complete(Math.max(0.4, firstTry.size / STOPS.length), t('Toured six folktales and named the peoples who tell them.'));
    }

    const tap = (e) => {
      const p = pointer(cv.el, e);
      let best = null, bd = 26;
      for (const s of STOPS) { const [x, y] = xy(s.at), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = s; } }
      if (best) go(best);
    };
    cv.el.addEventListener('pointerdown', tap);
    cv.el.setAttribute('aria-label', t('World map with six story stops. Use the buttons below the map to travel.'));
    cv.onResize = draw;

    root.append(h('div', { class: 'lab' }, h('div', { class: 'lab-goal' }, t('Tap a stop on the map, or a button, to travel there.')),
      cv.el, chips, h('div', { class: 'lab-row' }, stampOut.el, kmOut.el), panel));
    go(STOPS[Math.floor(api.rng() * STOPS.length)]);
    api.say(t('Folktales were told aloud long before they were written down. Guess the hero, listen, then name the people who tell the tale.'));

    return () => { cv.onResize = null; cv.el.removeEventListener('pointerdown', tap); };
  },
};
