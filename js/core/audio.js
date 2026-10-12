// Sound: effects, playable notes and rhythms, and a calm generative soundtrack that is different for every world.
//
// The soundtrack is slow, consonant and gently pulsed at 10 Hz (inside the 8–12 Hz alpha range associated with
// relaxed alertness). It is meant to be calming and unobtrusive. It is not a medical or neurological treatment and
// the game makes no claim that it changes brain activity.
import { rngFrom } from './util.js';
import { profile } from './store.js';

let ctx = null, master = null, musicBus = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Browsers only allow sound after a tap or key press.
export function unlockAudio() { ac(); }

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function tone(freq, t0, dur, { type = 'sine', gain = 0.18, dest = master, attack = 0.01 } = {}) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

const SFX = {
  tap: [[660, 0, 0.06]], ok: [[660, 0, 0.12], [880, 0.1, 0.18]], no: [[220, 0, 0.18], [196, 0.14, 0.22]],
  win: [[523, 0, 0.15], [659, 0.13, 0.15], [784, 0.26, 0.15], [1047, 0.39, 0.4]], lose: [[392, 0, 0.2], [330, 0.2, 0.2], [262, 0.4, 0.4]],
  coin: [[988, 0, 0.08], [1319, 0.07, 0.2]], step: [[523, 0, 0.1], [784, 0.08, 0.14]], gong: [[110, 0, 1.2], [165, 0, 1.0]],
};
export function sfx(name) {
  if (profile && !profile.settings.sound) return;
  const c = ac(); if (!c) return;
  for (const [f, at, d] of SFX[name] || []) tone(f, c.currentTime + at, d, { type: 'triangle', gain: 0.14 });
}

// Plays a sequence of MIDI notes; an inner array is a chord. Returns the total duration in seconds.
export function playNotes(notes, dur = 0.5, type = 'triangle') {
  const c = ac(); if (!c) return 0;
  let t = c.currentTime + 0.05;
  for (const n of notes) {
    for (const m of [n].flat()) if (m != null) tone(midi(m), t, dur * 0.95, { type, gain: 0.2 / Math.sqrt([n].flat().length) });
    t += dur;
  }
  return notes.length * dur;
}
// Plays a clapped rhythm given in beats.
export function playRhythm(beats, bpm = 96) {
  const c = ac(); if (!c) return 0;
  let t = c.currentTime + 0.05;
  const beat = 60 / bpm;
  for (const b of beats) { tone(180, t, 0.07, { type: 'square', gain: 0.16, attack: 0.002 }); tone(900, t, 0.03, { type: 'square', gain: 0.07, attack: 0.002 }); t += b * beat; }
  return beats.reduce((a, b) => a + b, 0) * beat;
}
export function playItemAudio(au) {
  if (!au) return 0;
  if (au.notes) return playNotes(au.notes, au.dur || 0.5);
  if (au.rhythm) return playRhythm(au.rhythm, au.bpm || 96);
  return 0;
}

// ---------- soundtrack ----------
const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 5, 7, 9], [0, 2, 4, 7, 11], [0, 3, 5, 7, 8], [0, 2, 3, 7, 9], [0, 4, 5, 7, 11]];
let playing = null;

export function startMusic(worldId) {
  if (profile && !profile.settings.music) return stopMusic();
  const c = ac(); if (!c) return;
  if (playing?.id === worldId) return;
  stopMusic();
  const rng = rngFrom('music' + worldId);
  const scale = SCALES[worldId % SCALES.length];
  const root = 48 + ((worldId * 5) % 12);                 // a different key for every world
  const bpm = 58 + (worldId % 6) * 3;                     // 58–73 beats per minute
  const beat = 60 / bpm;
  const voice = ['sine', 'triangle'][worldId % 2];
  const bus = c.createGain(); bus.gain.value = 1;
  // 10 Hz amplitude pulse, kept shallow so it is felt rather than heard.
  const trem = c.createGain(); trem.gain.value = 0.88;
  const lfo = c.createOscillator(), lfoGain = c.createGain();
  lfo.frequency.value = 10; lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain).connect(trem.gain); lfo.start();
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
  bus.connect(trem).connect(lp).connect(musicBus);
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.5, c.currentTime + 2.5);

  const motif = Array.from({ length: 8 }, () => Math.floor(rng() * scale.length));
  let bar = 0, next = c.currentTime + 0.2;
  const schedule = () => {
    while (next < c.currentTime + 1.2) {
      const chordRoot = root + [0, 7, 9, 5][bar % 4] - (bar % 4 === 1 ? 12 : 0);
      // pad: root + fifth + a scale tone, slow attack
      for (const iv of [0, 7, scale[2] + 12]) tone(midi(chordRoot + iv), next, beat * 4.2, { type: 'sine', gain: 0.06, dest: bus, attack: beat });
      // melody: the world's own motif, varied a little each bar
      for (let i = 0; i < 4; i++) {
        if (rng() < 0.3) continue;
        const deg = motif[(bar * 2 + i) % motif.length] + (rng() < 0.2 ? 1 : 0);
        const note = root + 12 + scale[deg % scale.length] + (deg >= scale.length ? 12 : 0);
        tone(midi(note), next + i * beat, beat * 1.6, { type: voice, gain: 0.075, dest: bus, attack: 0.04 });
      }
      if (bar % 2 === 0) tone(midi(chordRoot - 12), next, beat * 3.5, { type: 'triangle', gain: 0.07, dest: bus, attack: 0.08 });
      next += beat * 4; bar++;
    }
  };
  schedule();
  playing = { id: worldId, timer: setInterval(schedule, 400), bus, lfo };
}
export function stopMusic() {
  if (!playing || !ctx) return;
  const p = playing; playing = null;
  clearInterval(p.timer);
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  setTimeout(() => { try { p.lfo.stop(); p.bus.disconnect(); } catch { /* already gone */ } }, 1000);
}
export const musicOn = () => !!playing;
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); });
