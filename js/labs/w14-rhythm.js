import { h, button, slider, readout, predict, loop, fmt } from '../core/labkit.js';

// One bar of 4/4 split into 8 eighth-notes: steps 0 2 4 6 are beats 1 2 3 4, steps 1 3 5 7 are the "ands".
const ROWS = [['hat', '🥢', 'Cymbal'], ['snare', '🥁', 'Snare'], ['kick', '🦶', 'Kick'], ['chop', '🎸', 'Chop']];
const COUNT = ['1', '+', '2', '+', '3', '+', '4', '+'];
export const GROOVES = [
  { id: 'rock', name: 'Rock backbeat', bpm: [100, 120, 150], swing: 50,
    recipe: 'Kick on beats 1 and 3, snare on beats 2 and 4 (the backbeat), cymbal on every eighth.',
    why: 'The snare on 2 and 4 is the backbeat: it answers the kick on 1 and 3 and makes you clap along.',
    pat: { hat: [0, 1, 2, 3, 4, 5, 6, 7], snare: [2, 6], kick: [0, 4], chop: [] },
    need: { snare: [2, 6], kick: [0, 4] }, sw: [50, 56] },
  { id: 'reggae', name: 'Reggae off-beat', bpm: [75, 80, 96], swing: 50,
    recipe: 'Guitar chop on every "and" (the off-beats). Kick and snare together only on beat 3: the "one drop". Leave beat 1 empty.',
    why: 'Reggae leaves beat 1 empty and puts the chop between the beats, so the music seems to bounce.',
    pat: { hat: [0, 2, 4, 6], snare: [4], kick: [4], chop: [1, 3, 5, 7] },
    need: { chop: [1, 3, 5, 7], kick: [4], snare: [4] }, sw: [50, 56] },
  { id: 'swing', name: 'Jazz swing', bpm: [100, 120, 150], swing: 67,
    recipe: 'Ride cymbal: "ding, ding-ga, ding, ding-ga" — beats 1, 2, the "and" of 2, 3, 4, the "and" of 4. Then slide Swing up to about 67 %.',
    why: 'With swing, each beat is split long–short (about 2 : 1) instead of evenly, which gives jazz its lilt.',
    pat: { hat: [0, 2, 3, 4, 6, 7], snare: [], kick: [0, 4], chop: [] },
    need: { hat: [0, 2, 3, 4, 6, 7] }, sw: [60, 72] },
];
const same = (set, arr) => set.size === arr.length && arr.every((x) => set.has(x));
// Time of step i within the bar, in seconds: the off-beat eighth is delayed by the swing ratio.
export const stepTime = (i, bpm, swing) => (60 / bpm) * (Math.floor(i / 2) + (i % 2 ? swing / 100 : 0));

export default {
  id: 'w14-rhythm',
  world: 14,
  levels: [3, 4],
  kind: 'lab',
  icon: '🥁',
  title: 'Groove Builder',
  goal: 'Build the named groove on the step grid so that it matches the one you hear.',
  limits: 'One bar of eight eighth-notes with drum sounds made from simple electronic tones and noise. Real grooves vary from bar to bar, use many more sounds, and musicians count reggae and swing in more than one way.',
  mount(root, api) {
    const t = api.t, lvl = api.level;
    let ac = null, noise = null, playing = null, timer = 0, nextBar = 0, barStart = 0, done = false, tries = 0, target, predicted = false;
    const grid = Object.fromEntries(ROWS.map(([id]) => [id, new Set()]));
    const order = GROOVES.map((g) => [api.rng(), g]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    let gi = 0;

    function audio() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        ac = new AC();
        noise = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function env(when, peak, dur) {
      const g = ac.createGain();
      g.gain.setValueAtTime(peak, when); g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      g.connect(ac.destination); return g;
    }
    function hiss(when, peak, dur, freq) {
      const src = ac.createBufferSource(), f = ac.createBiquadFilter();
      src.buffer = noise; f.type = 'highpass'; f.frequency.value = freq;
      src.connect(f); f.connect(env(when, peak, dur)); src.start(when); src.stop(when + dur + 0.02);
    }
    function osc(when, type, f0, f1, peak, dur) {
      const o = ac.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, when); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
      o.connect(env(when, peak, dur)); o.start(when); o.stop(when + dur + 0.02);
    }
    const hit = {
      hat: (w) => hiss(w, 0.18, 0.06, 7000),
      snare: (w) => { hiss(w, 0.35, 0.16, 1500); osc(w, 'triangle', 190, 140, 0.25, 0.1); },
      kick: (w) => osc(w, 'sine', 150, 45, 0.9, 0.22),
      chop: (w) => { for (const f of [220, 277.18, 329.63]) osc(w, 'sawtooth', f, f, 0.07, 0.09); }, // staccato A major chord
    };

    function schedule() { // look a little ahead and queue the next bar on the audio clock
      if (!playing) return;
      while (nextBar < ac.currentTime + 0.25) {
        const { pat, bpm, swing } = playing();
        for (const [id] of ROWS) for (const i of pat[id]) hit[id](nextBar + stepTime(i, bpm, swing));
        barStart = nextBar; nextBar += 240 / bpm;
      }
    }
    function start(source) {
      if (!audio()) return;
      stop(); playing = source; nextBar = ac.currentTime + 0.08; barStart = nextBar;
      schedule(); timer = setInterval(schedule, 60);
    }
    function stop() { playing = null; clearInterval(timer); timer = 0; cells.forEach((c) => { c.style.outline = ''; }); }

    const mine = () => ({ pat: Object.fromEntries(ROWS.map(([id]) => [id, [...grid[id]]])), bpm: tempo.value, swing: swing.value });
    const tempo = slider({ label: t('Tempo'), min: 60, max: 180, step: 1, value: 100, unit: 'BPM', onInput: () => upd() });
    const swing = slider({ label: t('Swing (long part of each beat)'), min: 50, max: 75, step: 1, value: 50, unit: '%' });
    const barOut = readout(t('One bar lasts'), '–');
    const beatOut = readout(t('One beat lasts'), '–');
    const upd = () => { if (!predicted) return; barOut.set(fmt(240 / tempo.value) + ' s'); beatOut.set(fmt(60 / tempo.value) + ' s'); };

    const cells = [];
    const gridEl = h('div', { style: { display: 'grid', gridTemplateColumns: '2.1rem repeat(8, 1fr)', gap: '4px', alignItems: 'center' }, role: 'group', 'aria-label': t('Step grid') });
    gridEl.append(h('span'), ...COUNT.map((c, i) => h('span', { class: 'small', style: { textAlign: 'center', fontWeight: i % 2 ? '600' : '900', opacity: i % 2 ? 0.6 : 1 } }, c)));
    for (const [id, icon, label] of ROWS) {
      gridEl.append(h('span', { title: t(label), 'aria-hidden': 'true', style: { fontSize: '1.2rem', textAlign: 'center' } }, icon));
      for (let i = 0; i < 8; i++) {
        const cell = h('button', { type: 'button', 'aria-pressed': 'false', 'aria-label': `${t(label)} ${COUNT[i] === '+' ? t('and') : t('beat') + ' ' + COUNT[i]}`,
          style: { aspectRatio: '1', minHeight: '30px', borderRadius: '8px', border: '2px solid var(--line)', background: i % 2 ? 'var(--card)' : 'var(--soft)', cursor: 'pointer', padding: '0' },
          onClick: () => {
            const on = !grid[id].has(i);
            if (on) { grid[id].add(i); if (audio()) hit[id](ac.currentTime + 0.01); } else grid[id].delete(i);
            cell.setAttribute('aria-pressed', String(on));
            cell.style.background = on ? 'var(--pri)' : i % 2 ? 'var(--card)' : 'var(--soft)';
          } });
        cell.dataset.step = i; cells.push(cell); gridEl.append(cell);
      }
    }
    const stopLoop = loop(() => { // moving play-head
      if (!playing || !ac) return;
      const { bpm, swing: sw } = playing(), pos = ac.currentTime - barStart;
      let step = -1;
      for (let i = 0; i < 8; i++) if (pos >= stepTime(i, bpm, sw)) step = i;
      cells.forEach((c) => { c.style.outline = +c.dataset.step === step ? '3px solid var(--gold)' : ''; });
    });

    const goal = h('div', { class: 'lab-goal' });
    const recipe = h('div', { class: 'note' });
    const msg = h('div', { class: 'small', 'aria-live': 'polite' });
    const predictBox = h('div');

    function mission() {
      target = order[gi % order.length];
      const bpm = target.bpm[Math.floor(api.rng() * target.bpm.length)];
      tempo.set(bpm); swing.set(50); done = false; tries = 0; predicted = false; msg.textContent = '';
      for (const [id] of ROWS) grid[id].clear();
      cells.forEach((c) => { c.setAttribute('aria-pressed', 'false'); c.style.background = +c.dataset.step % 2 ? 'var(--card)' : 'var(--soft)'; });
      goal.textContent = '🎯 ' + t('Build this groove:') + ' ' + t(target.name) + ' — ' + bpm + ' BPM';
      recipe.textContent = lvl <= 3 ? t(target.recipe) : t('Listen to the target, then rebuild it by ear. Count "1 and 2 and 3 and 4 and".');
      barOut.set('?'); beatOut.set('?');
      predictBox.replaceChildren(predict({
        question: t('Predict: at') + ' ' + bpm + ' BPM, ' + t('how many seconds does one bar of 4 beats last?'), unit: 's', truth: 240 / bpm, tolerance: 0.05,
        onResult: (err) => { predicted = true; upd(); api.say(t(err <= 0.05 ? 'Yes: one beat lasts 60 ÷ BPM seconds, and a bar has 4 beats.' : 'One beat lasts 60 ÷ BPM seconds, so a bar of 4 beats lasts 240 ÷ BPM seconds.')); },
      }));
    }

    function check() {
      tries++;
      const wrong = Object.entries(target.need).filter(([id, arr]) => !same(grid[id], arr)).map(([id]) => t(ROWS.find((r) => r[0] === id)[2]));
      const swOk = swing.value >= target.sw[0] && swing.value <= target.sw[1];
      if (wrong.length || !swOk) {
        msg.textContent = '🔁 ' + (wrong.length ? t('Listen again to:') + ' ' + wrong.join(', ') + '. ' : '') + (swOk ? '' : t(target.id === 'swing' ? 'The beats are still split evenly: add swing.' : 'This groove has even eighths: take the swing off.'));
        return;
      }
      msg.textContent = '✅ ' + t(target.why);
      api.say(t(target.why));
      if (!done) { done = true; api.complete(Math.max(0.4, 1 - 0.12 * (tries - 1) - (predicted ? 0 : 0.1)), t('Built a groove on the step grid:') + ' ' + t(target.name)); }
    }

    root.append(h('div', { class: 'lab' }, goal, recipe, predictBox, gridEl,
      h('div', { class: 'lab-row' },
        button('🎧 ' + t('Hear the target'), () => start(() => ({ pat: target.pat, bpm: tempo.value, swing: target.swing }))),
        button('▶️ ' + t('Play mine'), () => start(mine)), button('⏹ ' + t('Stop'), stop, 'btn sm ghost'),
        button('✔ ' + t('Check'), check), button('⏭ ' + t('Next groove'), () => { stop(); gi++; mission(); }, 'btn sm ghost')),
      h('div', { class: 'lab-row' }, tempo.el, swing.el), h('div', { class: 'lab-row' }, barOut.el, beatOut.el), msg));
    mission();
    api.say(t('Tap the squares to place sounds. Bold numbers are the beats; the plus signs are the off-beats in between.'));

    return () => { stop(); stopLoop(); if (ac) { ac.close().catch(() => {}); ac = null; } };
  },
};
