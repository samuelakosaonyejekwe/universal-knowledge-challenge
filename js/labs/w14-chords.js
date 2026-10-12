import { h, button, choice, readout, predict, loop, fmt } from '../core/labkit.js';

// ---------- music theory (pure) ----------
const LETTERS = 'CDEFGAB', NATURAL = [0, 2, 4, 5, 7, 9, 11], MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const KEYS = [['C', 48], ['G', 55], ['D', 50], ['A', 57], ['F', 53], ['B♭', 58], ['E♭', 51]]; // tonic as a MIDI note in octave 3
export const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12); // equal temperament, A4 = 440 Hz
// Spell a note that lies `semis` above the tonic and `steps` letters above it (so F major gets B♭, not A♯).
export function spell(tonicName, tonicMidi, steps, semis) {
  const li = (LETTERS.indexOf(tonicName[0]) + steps) % 7, diff = ((tonicMidi + semis) - NATURAL[li] + 120) % 12;
  return LETTERS[li] + (diff === 0 ? '' : diff === 1 ? '♯' : diff === 11 ? '♭' : '?');
}
// Chord on scale degree d (0 = I): stack every other note of the major scale. seventh adds a minor 7th (dominant 7th).
export function chord(key, d, seventh = false) {
  const [name, tonic] = key;
  const at = (i) => tonic + MAJOR[(d + i) % 7] + 12 * Math.floor((d + i) / 7);
  const midi = [at(0), at(2), at(4)], names = [0, 2, 4].map((i) => spell(name, tonic, d + i, MAJOR[(d + i) % 7]));
  const minor = midi[1] - midi[0] === 3;
  if (seventh) { midi.push(midi[0] + 10); names.push(spell(name, tonic, d + 6, (MAJOR[d] + 10) % 12)); }
  return { midi, names, label: names[0] + (minor ? 'm' : '') + (seventh ? '7' : ''), roman: ROMAN[d] + (seventh ? '7' : '') };
}
export const MISSIONS = [
  { name: 'I – V – vi – IV', bars: [0, 4, 5, 3], about: 'This four-chord loop is used in a great many pop songs.' },
  { name: 'I – IV – V – vi', bars: [0, 3, 4, 5], about: 'I, IV and V are the three major chords of the key; vi is the relative minor, built from the same scale.' },
  { name: 'I – vi – IV – V', bars: [0, 5, 3, 4], about: 'The "doo-wop" turnaround: V at the end pulls strongly back home to I.' },
  { name: '12-bar blues', bars: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 0], blues: true, about: 'Twelve bars: four of I, two of IV, two of I, then V, IV, I, I. Blues, rock and roll and jazz are all built on it.' },
];

export default {
  id: 'w14-chords',
  world: 14,
  levels: [5, 6],
  kind: 'studio',
  icon: '🎼',
  title: 'Chord Composer',
  goal: 'Turn Roman-numeral chord symbols into real chords in a given key, and hear the progression you compose.',
  limits: 'Equal temperament with A4 = 440 Hz: every semitone multiplies frequency by 2^(1/12), so a fifth is 1.498 rather than the pure 3 : 2. Chords are plain close-position triads (or dominant sevenths) played by simple electronic tones; real music adds inversions, voice leading, rhythm and melody.',
  mount(root, api) {
    const t = api.t, hard = api.level >= 6;
    let ac = null, master = null, key, mission, slots, cur = 0, sevenths = false, playStart = -1, barLen = 1.2, tries = 0, done = false, predErr = null;

    function audio() {
      if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function stop() { if (master) { try { master.disconnect(); } catch { /* already gone */ } master = null; } playStart = -1; }
    function strum(c, when, dur) {
      const voice = (midi, type, vol, delay) => {
        const o = ac.createOscillator(), g = ac.createGain(), s = when + delay;
        o.type = type; o.frequency.value = hz(midi);
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(vol, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
        o.connect(g); g.connect(master); o.start(s); o.stop(s + dur + 0.05);
      };
      voice(c.midi[0] - 12, 'sine', 0.3, 0);
      c.midi.forEach((m, i) => voice(m + 12, 'triangle', 0.14, 0.02 * i));
    }
    function play(list) {
      if (!audio()) return;
      stop(); master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
      const t0 = ac.currentTime + 0.08;
      list.forEach((d, i) => { if (d != null) { const c = chord(key, d, sevenths); strum(c, t0 + i * barLen, barLen * 0.48); strum(c, t0 + (i + 0.5) * barLen, barLen * 0.45); } });
      if (list.length > 1) playStart = t0;
    }

    const goal = h('div', { class: 'lab-goal' });
    const about = h('div', { class: 'note' });
    const predictBox = h('div');
    const slotBox = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' } });
    const palette = h('div', { class: 'lab-row' });
    const notesOut = readout(t('Notes of the selected chord'), '–');
    const freqOut = readout(t('Frequencies (Hz)'), '–');
    const ratioOut = readout(t('Ratios to the chord root'), '–');
    const msg = h('div', { class: 'small', 'aria-live': 'polite' });
    const sevenChoice = h('div');

    function describe(d) {
      if (d == null) { notesOut.set('–'); freqOut.set('–'); ratioOut.set('–'); return; }
      const c = chord(key, d, sevenths);
      notesOut.set(c.label + ' = ' + c.names.join(' – '));
      freqOut.set(c.midi.map((m) => fmt(hz(m), 4)).join(' · '));
      ratioOut.set(c.midi.map((m) => fmt(2 ** ((m - c.midi[0]) / 12), 4)).join(' : '));
    }
    function draw() {
      slotBox.replaceChildren(...slots.map((d, i) => h('button', {
        type: 'button', class: 'chip' + (i === cur ? ' on' : ''), 'aria-label': t('Bar') + ' ' + (i + 1), dataset: { bar: i },
        style: { flexDirection: 'column', borderRadius: '12px', minHeight: '58px', justifyContent: 'center', padding: '.2rem' },
        onClick: () => { cur = i; describe(slots[i]); draw(); },
      }, h('span', { class: 'small muted' }, String(i + 1)), h('b', null, d == null ? '·' : chord(key, d, sevenths).label))));
      palette.replaceChildren(...ROMAN.map((r, d) => {
        const c = chord(key, d, sevenths);
        return button(hard ? c.label : `${c.roman} = ${c.label}`, () => {
          slots[cur] = d; play([d]); describe(d);
          if (cur < slots.length - 1) cur++;
          draw();
        }, 'btn sm ghost');
      }));
    }

    function check() {
      if (slots.includes(null)) { msg.textContent = t('Fill every bar first.'); return; }
      tries++;
      const wrong = slots.map((d, i) => (d === mission.bars[i] || (mission.blues && i === 11 && d === 4) ? null : i + 1)).filter(Boolean);
      if (wrong.length) {
        msg.textContent = '🔁 ' + t('Check bar(s):') + ' ' + wrong.join(', ') + '. ' + t('Count up the major scale from the tonic: I is note 1, IV is note 4, V is note 5, vi is note 6.');
        return;
      }
      msg.textContent = '✅ ' + t(mission.about);
      api.say(t(mission.about));
      play(slots);
      if (!done) {
        done = true;
        const score = Math.max(0.4, 1 - 0.12 * (tries - 1) - (predErr == null ? 0.1 : predErr > 0.02 ? 0.05 : 0));
        api.complete(score, t('Composed the progression') + ' ' + mission.name + ' ' + t('in the key of') + ' ' + key[0] + ' ' + t('major') + '.');
      }
    }

    function fresh() {
      stop();
      key = KEYS[Math.floor(api.rng() * KEYS.length)];
      mission = MISSIONS[Math.floor(api.rng() * MISSIONS.length)];
      sevenths = !!mission.blues; slots = Array(mission.bars.length).fill(null); cur = 0; tries = 0; done = false; predErr = null; msg.textContent = '';
      goal.textContent = '🎯 ' + t('Compose') + ' ' + mission.name + ' ' + t('in the key of') + ' ' + key[0] + ' ' + t('major') + '.';
      about.textContent = (mission.blues ? t('Bars: I I I I · IV IV I I · V IV I I. ') : '') + t('Capital numerals are major chords, small ones are minor. f = 440 Hz × 2^((n − 69) / 12), where n is the MIDI note number.');
      const d = [3, 4, 5][Math.floor(api.rng() * 3)], semis = MAJOR[d], f0 = hz(key[1]);
      predictBox.replaceChildren(predict({
        question: `${t('Predict: the tonic')} ${key[0]} ${t('is')} ${fmt(f0, 4)} Hz. ${t('The root of')} ${ROMAN[d]} ${t('is')} ${semis} ${t('semitones higher. Its frequency?')}`,
        unit: 'Hz', truth: f0 * 2 ** (semis / 12), tolerance: 0.02,
        onResult: (err) => { predErr = err; api.say(`${t('Each semitone multiplies the frequency by 2^(1/12) ≈ 1.0595, so')} ${semis} ${t('semitones multiply it by')} ${fmt(2 ** (semis / 12), 4)}.`); },
      }));
      sevenChoice.replaceChildren(choice([[false, t('Triads')], [true, t('Sevenths (blues)')]], sevenths, (v) => { sevenths = v; draw(); describe(slots[cur]); }).el);
      describe(null); draw();
    }

    const stopLoop = loop(() => { // highlight the bar that is sounding
      const now = playStart >= 0 && ac ? Math.floor((ac.currentTime - playStart) / barLen) : -1;
      if (now >= slots.length) playStart = -1;
      for (const el of slotBox.children) el.style.outline = +el.dataset.bar === now ? '3px solid var(--gold)' : '';
    });

    root.append(h('div', { class: 'lab' }, goal, about, predictBox, slotBox,
      h('div', { class: 'small muted' }, t('Tap a bar, then tap a chord to put it there.')), palette, sevenChoice,
      h('div', { class: 'lab-row' }, button('▶️ ' + t('Play'), () => play(slots)), button('⏹ ' + t('Stop'), stop, 'btn sm ghost'),
        button('✔ ' + t('Check'), check), button('🔄 ' + t('New mission'), fresh, 'btn sm ghost')),
      h('div', { class: 'lab-row' }, notesOut.el, freqOut.el, ratioOut.el), msg));
    fresh();
    api.say(t('Roman numerals name chords by their place in the scale, so the same progression works in any key.'));

    return () => { stop(); stopLoop(); if (ac) { ac.close().catch(() => {}); ac = null; } };
  },
};
