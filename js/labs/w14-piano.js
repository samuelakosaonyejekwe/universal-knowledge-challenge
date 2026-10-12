import { h, button, readout } from '../core/labkit.js';

// C major scale from middle C (MIDI 60) to the C above. Equal temperament: f = 440 Hz × 2^((n − 69) / 12).
const KEYS = [[60, 'C', '#e5484d'], [62, 'D', '#f08c00'], [64, 'E', '#f5c400'], [65, 'F', '#2bb673'],
  [67, 'G', '#12a5a5'], [69, 'A', '#3b82f6'], [71, 'B', '#8a5cf6'], [72, 'C', '#e5484d']];
export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const ROUNDS = 4;

export default {
  id: 'w14-piano',
  world: 14,
  levels: [1, 2],
  kind: 'lab',
  icon: '🎹',
  title: 'Echo Piano',
  goal: 'Listen to the little tune, then play it back on the piano.',
  limits: 'Eight white keys of one octave, tuned in equal temperament (A = 440 Hz). The sound is a simple electronic tone, not a real piano string, and there are no black keys here.',
  mount(root, api) {
    const t = api.t, lvl = api.level <= 1 ? 1 : 2;
    let ac = null, tune = [], pos = 0, busy = false, round = 0, slips = 0, done = false, stage = 'guess', pair = [0, 1], rightGuess = 0;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

    function audio() { // created on first use inside mount, resumed on the first tap
      if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(midi, dur = 0.5) {
      const a = audio(); if (!a) return;
      const now = a.currentTime, g = a.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.3, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      g.connect(a.destination);
      for (const [mult, type, vol] of [[1, 'triangle', 1], [2, 'sine', 0.25]]) {
        const o = a.createOscillator(), og = a.createGain();
        o.type = type; o.frequency.value = hz(midi) * mult; og.gain.value = vol;
        o.connect(og); og.connect(g); o.start(now); o.stop(now + dur + 0.05);
      }
    }

    const keyEls = KEYS.map(([midi, name, colour], i) => h('button', {
      type: 'button', 'aria-label': t('Key') + ' ' + name,
      style: { flex: '1 1 0', minWidth: '0', height: '150px', border: '2px solid #1c2340', borderRadius: '0 0 12px 12px', background: '#fff', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', padding: '0 0 8px', fontWeight: '800', touchAction: 'manipulation' },
      onPointerdown: (e) => { e.preventDefault(); press(i); },
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(i); } },
    }, h('span', { style: { width: '70%', maxWidth: '30px', aspectRatio: '1', borderRadius: '50%', background: colour } }), name));
    const piano = h('div', { style: { display: 'flex', gap: '2px', touchAction: 'manipulation', userSelect: 'none' } }, keyEls);
    const prompt = h('div', { class: 'lab-goal', style: { fontSize: '1.15rem', textAlign: 'center' }, 'aria-live': 'polite' });
    const dots = h('div', { style: { textAlign: 'center', fontSize: '1.6rem', minHeight: '2.2rem', letterSpacing: '.2em' }, 'aria-hidden': 'true' });
    const actions = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    const roundOut = readout(t('Tunes'), '0 / ' + ROUNDS);
    const hzOut = readout(t('Pitch'), '–');

    function light(i, ms = 320) {
      keyEls[i].style.background = KEYS[i][2];
      later(() => { keyEls[i].style.background = '#fff'; }, ms);
    }
    function sound(i) { tone(KEYS[i][0]); light(i); hzOut.set(Math.round(hz(KEYS[i][0])) + ' Hz'); }
    function showDots() { dots.textContent = tune.map((k, i) => (i < pos ? '🟢' : '⚪')).join(''); }

    function playTune() {
      if (busy) return;
      busy = true; pos = 0; showDots();
      prompt.textContent = '👂 ' + t('Listen…');
      const gap = api.reducedMotion ? 650 : 560;
      tune.forEach((k, i) => later(() => sound(k), 250 + i * gap));
      later(() => { busy = false; prompt.textContent = '🎹 ' + t('Your turn! Play it back.'); }, 250 + tune.length * gap);
    }

    // Predict first: which of two keys will sound higher? Then hear them.
    function askHigher() {
      stage = 'guess';
      let a = Math.floor(api.rng() * 8), b = Math.floor(api.rng() * 8);
      if (a === b) b = (a + 3) % 8;
      pair = [a, b];
      dots.textContent = '';
      prompt.textContent = t('Which key will sound higher?');
      actions.replaceChildren(...pair.map((k) => h('button', { class: 'btn', type: 'button', style: { background: KEYS[k][2], minWidth: '84px', color: '#fff', textShadow: '0 1px 3px #000' }, 'aria-label': t('Key') + ' ' + KEYS[k][1],
        onClick: () => answerHigher(k) }, KEYS[k][1] + (k === 7 ? '²' : ''))));
    }
    function answerHigher(k) {
      if (stage !== 'guess' || busy) return;
      const [a, b] = pair, top = Math.max(a, b), ok = k === top;
      if (ok) rightGuess++;
      busy = true; actions.replaceChildren();
      later(() => sound(Math.min(a, b)), 100); later(() => sound(top), 700);
      api.say(t(ok ? 'Yes! Keys further to the right sound higher, because the air shakes faster.' : 'Listen: the key further to the right sounds higher, because the air shakes faster.'));
      later(() => { busy = false; startTune(); }, 1500);
    }

    function startTune() {
      stage = 'echo';
      const len = (lvl === 1 ? 2 : 3) + Math.min(round, 2), span = lvl === 1 ? 5 : 8;
      let k = Math.floor(api.rng() * span);
      tune = [k];
      while (tune.length < len) { // small steps, like a real melody
        const step = [-2, -1, 1, 2, lvl === 1 ? 1 : 0][Math.floor(api.rng() * 5)];
        k = Math.max(0, Math.min(span - 1, k + step));
        tune.push(k);
      }
      actions.replaceChildren(button('🔊 ' + t('Hear it again'), playTune, 'btn sm ghost'));
      playTune();
    }

    function press(i) {
      sound(i);
      if (stage !== 'echo' || busy || !tune.length) return;
      if (i === tune[pos]) {
        pos++; showDots();
        if (pos < tune.length) return;
        round++; roundOut.set(Math.min(round, ROUNDS) + ' / ' + ROUNDS);
        prompt.textContent = '🌟 ' + t('You played it!');
        api.say(t('A melody is a chain of notes going up and down. You remembered every step.'));
        tune = [];
        if (round >= ROUNDS && !done) {
          done = true;
          api.complete(Math.max(0.4, Math.min(1, 0.7 + 0.3 * rightGuess / ROUNDS - 0.04 * slips)), t('Echoed melodies by ear and told higher notes from lower ones.'));
        }
        actions.replaceChildren(button('▶️ ' + t('Next tune'), askHigher, 'btn'));
      } else {
        slips++; pos = 0; showDots();
        prompt.textContent = '🔁 ' + t('Not quite. Listen once more.');
        busy = true; later(() => { busy = false; playTune(); }, 800);
      }
    }

    root.append(h('div', { class: 'lab' }, prompt, dots, actions, piano, h('div', { class: 'lab-row' }, roundOut.el, hzOut.el)));
    prompt.textContent = '🎵 ' + t('Tap to begin');
    actions.replaceChildren(button('▶️ ' + t('Start'), () => { audio(); askHigher(); }, 'btn'));
    api.say(t('First guess which key is higher. Then listen to a tune and play it back.'));

    return () => { for (const id of timers) clearTimeout(id); timers.clear(); if (ac) { ac.close().catch(() => {}); ac = null; } };
  },
};
