import { h, button, choice, slider, canvas, readout } from '../core/labkit.js';

// Additive (light): start from black and add red, green and blue light.          R = r, G = g, B = b
// Subtractive (ink or paint): start from white paper; each ink removes one colour. R = 1 − c, G = 1 − m, B = 1 − y
export const MODES = {
  add: { names: ['Red light', 'Green light', 'Blue light'], hues: ['#ff0000', '#00ff00', '#0000ff'], toRGB: (v) => v.map((x) => x / 100) },
  sub: { names: ['Cyan ink', 'Magenta ink', 'Yellow ink'], hues: ['#00b7eb', '#ff00a8', '#ffe600'], toRGB: (v) => v.map((x) => 1 - x / 100) },
};
const css = (rgb) => `rgb(${rgb.map((x) => Math.round(x * 255)).join(',')})`;
const QUIZ = {
  add: [[[0, 1], 'yellow'], [[1, 2], 'cyan'], [[0, 2], 'magenta']],
  sub: [[[0, 1], 'blue'], [[1, 2], 'red'], [[0, 2], 'green']],
};
const pairName = (mode, [a, b], t) => t(MODES[mode].names[a]) + ' + ' + t(MODES[mode].names[b]);

export default {
  id: 'w15-mix',
  world: 15,
  levels: [3, 4],
  kind: 'lab',
  icon: '🎨',
  title: 'Colour Mixer',
  goal: 'Mix three lights, or three inks, until your colour matches the target.',
  limits: 'Ideal lights and ideal inks: each ink removes exactly one of red, green or blue. Real pigments are muddier (which is why printers add black), percentages here are screen values rather than measured light, and screens differ from one another.',
  mount(root, api) {
    const t = api.t, lvl = api.level;
    const cv = canvas(210);
    let mode = api.rng() < 0.5 ? 'add' : 'sub', target = [0, 0, 0], tries = 0, done = false, quizRight = null, solved = 0;
    const sliders = [0, 1, 2].map((i) => slider({ label: '–', min: 0, max: 100, step: 5, value: 0, unit: '%', onInput: () => draw() }));
    const labels = sliders.map((s) => s.el.querySelector('span').firstChild);
    const lightOut = readout(t('Light reaching your eye (R G B)'), '–');
    const goal = h('div', { class: 'lab-goal' });
    const quiz = h('div', { class: 'lab-row' });
    const msg = h('div', { class: 'small', 'aria-live': 'polite' });
    const modeBox = h('div');
    const values = () => sliders.map((s) => s.value);
    const mine = () => MODES[mode].toRGB(values());

    function draw() {
      const { ctx } = cv, w = cv.w, hgt = cv.h, M = MODES[mode], v = values();
      const split = Math.round(w * 0.58), r = Math.min(split, hgt) * 0.27, cx = split / 2, cy = hgt / 2 + 4;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = mode === 'add' ? '#000' : '#fff'; ctx.fillRect(0, 0, split, hgt);
      ctx.fillStyle = '#20264a'; ctx.fillRect(split, 0, w - split, hgt);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, split, hgt); ctx.clip();
      ctx.globalCompositeOperation = mode === 'add' ? 'lighter' : 'multiply';
      [[-90, 0], [30, 1], [150, 2]].forEach(([deg, i]) => {
        const a = (deg * Math.PI) / 180, x = cx + Math.cos(a) * r * 0.62, y = cy + Math.sin(a) * r * 0.62, k = v[i] / 100;
        const unit = [0, 1, 2].map((j) => (mode === 'add' ? (j === i ? k : 0) : (j === i ? 1 - k : 1)));
        ctx.fillStyle = css(unit); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore(); ctx.globalCompositeOperation = 'source-over';
      const bw = w - split - 20, bh = (hgt - 58) / 2;
      ctx.font = '700 12px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
      ctx.fillText(t('Target'), split + 10, 6);
      ctx.fillStyle = css(target); ctx.fillRect(split + 10, 22, bw, bh);
      ctx.fillStyle = '#fff'; ctx.fillText(t('Your mix'), split + 10, 28 + bh);
      ctx.fillStyle = css(mine()); ctx.fillRect(split + 10, 44 + bh, bw, bh);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.strokeRect(split + 10.5, 22.5, bw - 1, bh - 1); ctx.strokeRect(split + 10.5, 44.5 + bh, bw - 1, bh - 1);
      lightOut.set(mine().map((x) => Math.round(x * 100) + ' %').join(' · '));
      cv.el.setAttribute('aria-label', `${t('Target colour and your mix')}: ${values().join(', ')} %`);
    }

    function mission() {
      const steps = lvl <= 3 ? [0, 50, 100] : [0, 25, 50, 75, 100];
      let recipe;
      do { recipe = [0, 1, 2].map(() => steps[Math.floor(api.rng() * steps.length)]); } while (recipe.every((x) => x === recipe[0]) || recipe.filter((x) => x > 0).length < 2);
      target = MODES[mode].toRGB(recipe);
      tries = 0; done = false; quizRight = null; msg.textContent = '';
      sliders.forEach((s, i) => { s.set(0); labels[i].textContent = t(MODES[mode].names[i]); s.el.querySelector('input').setAttribute('aria-label', t(MODES[mode].names[i])); s.el.querySelector('input').style.accentColor = MODES[mode].hues[i]; });
      goal.textContent = '🎯 ' + t(mode === 'add' ? 'Mix the three lights on the dark stage to match the target.' : 'Mix the three inks on the white paper to match the target.');
      const [pair, result] = QUIZ[mode][Math.floor(api.rng() * 3)];
      quiz.replaceChildren(h('span', { class: 'lab-goal' }, `${t('Predict:')} ${pairName(mode, pair, t)} = ?`),
        ...['yellow', 'cyan', 'magenta', 'red', 'green', 'blue'].map((name) => [api.rng(), name]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
          .filter((name, i, all) => name === result || all.filter((n) => n !== result).indexOf(name) < 2)
          .map((name) => button(t(name), () => {
            if (quizRight === null) quizRight = name === result;
            sliders.forEach((s, i) => s.set(pair.includes(i) ? 100 : 0)); draw();
            quiz.replaceChildren(h('span', { class: 'small' }, (name === result ? '✅ ' : '🔁 ') + `${pairName(mode, pair, t)} = ${t(result)}. ` + t('The sliders now show it. Go on and match the target.')));
            api.say(t(mode === 'add'
              ? 'Lights add up: each new light sends more colour to your eye, and all three together make white.'
              : 'Inks take light away: each ink soaks up one colour from the white paper, and all three together leave black.'));
          }, 'chip')));
      draw();
    }

    function check() {
      tries++;
      const m = mine(), diff = m.map((x, i) => Math.round((x - target[i]) * 100)), worst = Math.max(...diff.map(Math.abs));
      if (worst <= (lvl <= 3 ? 12 : 8)) {
        msg.textContent = '✅ ' + t('Matched! Recipe:') + ' ' + values().map((v, i) => `${t(MODES[mode].names[i])} ${v} %`).join(', ');
        if (!done) {
          done = true; solved++;
          api.say(t(mode === 'add' ? 'A screen makes every colour this way, from tiny red, green and blue lights.' : 'A printer makes every colour this way, from cyan, magenta and yellow inks.'));
          api.complete(Math.max(0.4, 1 - 0.1 * (tries - 1) - (quizRight ? 0 : 0.1)), t(mode === 'add' ? 'Matched a colour by adding red, green and blue light.' : 'Matched a colour by mixing cyan, magenta and yellow inks.'));
        }
        return;
      }
      const i = diff.map(Math.abs).indexOf(worst), ch = ['red', 'green', 'blue'][i], tooMuch = diff[i] > 0;
      const fix = mode === 'add' ? (tooMuch ? 'Use less' : 'Use more') : (tooMuch ? 'Use more' : 'Use less');
      msg.textContent = `🔁 ${t('Your mix sends')} ${t(tooMuch ? 'too much' : 'too little')} ${t(ch)} ${t('light to the eye.')} ${t(fix)}: ${t(MODES[mode].names[i])}.`;
      if (mode === 'sub' && tries === 1) api.say(t('In ink mixing, think backwards: cyan removes red, magenta removes green, yellow removes blue.'));
    }

    function setMode(m) { mode = m; modeBox.replaceChildren(choice([['add', '💡 ' + t('Light (R G B)')], ['sub', '🖨️ ' + t('Ink (C M Y)')]], mode, setMode).el); mission(); }
    cv.onResize = draw;
    root.append(h('div', { class: 'lab' }, goal, modeBox, quiz, cv.el, h('div', { class: 'lab-row' }, sliders.map((s) => s.el)),
      h('div', { class: 'lab-row' }, lightOut.el, button('✔ ' + t('Check match'), check), button('🔄 ' + t('New target'), () => mission(), 'btn sm ghost')), msg));
    setMode(mode);
    api.say(t('Lights and inks mix in opposite ways. Predict what two of them make together, then test it.'));
    return () => { cv.onResize = null; };
  },
};
