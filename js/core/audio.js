// Sound: effects, playable notes and rhythms, and a calm generative soundtrack that is different for every world.
//
// The soundtrack is slow and always consonant: every note of the pad, bass and melody comes from one five-note scale
// with no semitones, so no two notes can clash. Effects are tuned to the same key, and the soundtrack steps back
// while a lesson plays its own notes. It is meant to be calm and unobtrusive, and makes no claim about the brain.
import { rngFrom } from './util.js';
import { profile } from './store.js';

let ctx = null, master = null, musicBus = null, meter = null;
let wanted = null; // the soundtrack that should be playing once the browser allows sound
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // A playback-sized buffer keeps sound smooth on slower phones and while the 3D scenes are drawing.
    try { ctx = new AC({ latencyHint: 'playback' }); } catch { ctx = new AC(); }
    // Everything passes through a gentle limiter so effects, notes and music can be clearly audible without distortion.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.knee.value = 12; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.6;
    meter = ctx.createAnalyser(); meter.fftSize = 1024;
    master.connect(limiter); limiter.connect(meter); meter.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    ctx.addEventListener?.('statechange', () => { if (ctx.state === 'running' && wanted != null && !playing) startMusic(wanted); });
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}
// Browsers only allow sound after a tap, click or key press. This is called on every such gesture until sound is
// running, and it restarts the soundtrack that was waiting.
export function unlockAudio() {
  const c = ac(); if (!c) return false;
  if (c.state === 'running' && wanted != null && !playing) startMusic(wanted);
  return c.state === 'running';
}
export const audioRunning = () => ctx?.state === 'running';
// Current output level 0–1 (used by the device check and by tests).
export function audioLevel() {
  if (!meter) return 0;
  const buf = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(buf);
  let sum = 0; for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}
// The most recent slice of the output waveform (used by tests that listen for clicks).
export function audioWave() { const buf = new Float32Array(meter ? meter.fftSize : 0); meter?.getFloatTimeDomainData(buf); return buf; }
const MUSIC_LEVEL = { soft: 0.45, medium: 0.75, loud: 1.1 };
const musicLevel = () => MUSIC_LEVEL[profile?.settings.musicVolume] ?? MUSIC_LEVEL.medium;
export function setMusicVolume() { if (ctx && playing && !holds) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.2); }

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// One soft note. Every note fades in and fades out to silence, and is never started in the past — the two things
// that otherwise cause clicks and crackle.
function tone(freq, t0, dur, { type = 'sine', gain = 0.18, dest = master, attack = 0.02, release = Math.min(0.25, dur * 0.45) } = {}) {
  const c = ac(); if (!c) return;
  t0 = Math.max(t0, c.currentTime + 0.03);
  const a = Math.min(attack, dur * 0.4), r = Math.min(release, dur - a);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  // smooth curves in and out (no corners in the loudness), ending in true silence before the note stops
  g.gain.setValueAtTime(0, t0);
  g.gain.setTargetAtTime(gain, t0, a / 3);
  g.gain.setTargetAtTime(0, t0 + dur - r, r / 4);
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + dur + r * 0.6 + 0.05);
  o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* already released */ } };
}

// Effects are written as steps of the current key's five-note scale, so they always agree with the soundtrack.
// [scale step, start (s), length (s)]
const SFX = {
  tap: [[5, 0, 0.09]], ok: [[5, 0, 0.14], [7, 0.11, 0.22]], no: [[2, 0, 0.2], [0, 0.16, 0.28]],
  win: [[5, 0, 0.16], [6, 0.13, 0.16], [7, 0.26, 0.16], [10, 0.39, 0.5]], lose: [[4, 0, 0.22], [2, 0.2, 0.22], [0, 0.4, 0.45]],
  coin: [[8, 0, 0.1], [10, 0.08, 0.24]], step: [[5, 0, 0.12], [8, 0.09, 0.16]], gong: [[-5, 0, 1.2], [0, 0, 1.0]],
};
let key = { root: 60, scale: [0, 2, 4, 7, 9] };
const degree = (n) => key.root + 12 * Math.floor(n / 5) + key.scale[((n % 5) + 5) % 5];
export function sfx(name) {
  if (profile && !profile.settings.sound) return;
  const c = ac(); if (!c) return;
  for (const [n, at, d] of SFX[name] || []) tone(midi(degree(n)), c.currentTime + at, d, { type: 'sine', gain: 0.2, attack: 0.02, release: d * 0.6 });
}
// The soundtrack steps back while a lesson plays notes of its own, so the two never clash.
function duck(seconds) {
  if (!ctx || !playing) return;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(0.0001, t, 0.08);
  if (!holds) musicBus.gain.setTargetAtTime(musicLevel(), t + seconds + 0.3, 0.5);
}

// A lab or simulation that makes sounds of its own asks the soundtrack to wait; call the returned function to let it return.
let holds = 0;
export function holdMusic() {
  holds++;
  if (ctx && playing) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); }
  let done = false;
  return () => { if (done) return; done = true; holds = Math.max(0, holds - 1); if (!holds && ctx && playing) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime + 0.2, 0.6); };
}

// Plays a sequence of MIDI notes; an inner array is a chord. Returns the total duration in seconds.
export function playNotes(notes, dur = 0.5, type = 'triangle') {
  const c = ac(); if (!c) return 0;
  duck(notes.length * dur);
  let t = c.currentTime + 0.12;
  for (const n of notes) {
    for (const m of [n].flat()) if (m != null) tone(midi(m), t, dur * 0.95, { type, gain: 0.34 / Math.sqrt([n].flat().length) });
    t += dur;
  }
  return notes.length * dur;
}
// Plays a clapped rhythm given in beats.
export function playRhythm(beats, bpm = 96) {
  const c = ac(); if (!c) return 0;
  const beat = 60 / bpm;
  duck(beats.reduce((a, b) => a + b, 0) * beat);
  let t = c.currentTime + 0.12;
  for (const b of beats) { tone(180, t, 0.09, { type: 'triangle', gain: 0.3, attack: 0.004 }); tone(900, t, 0.05, { type: 'triangle', gain: 0.12, attack: 0.004 }); t += b * beat; }
  return beats.reduce((a, b) => a + b, 0) * beat;
}
export function playItemAudio(au) {
  if (!au) return 0;
  if (au.notes) return playNotes(au.notes, au.dur || 0.5);
  if (au.rhythm) return playRhythm(au.rhythm, au.bpm || 96);
  return 0;
}

// ---------- soundtrack ----------
// Five-note scales without semitones: any of their notes sound well together.
const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 5, 7, 9], [0, 2, 5, 7, 10], [0, 3, 5, 8, 10]];
let playing = null;

export function startMusic(worldId) {
  if (profile && !profile.settings.music) { wanted = null; return stopMusic(); }
  wanted = worldId;
  const c = ac(); if (!c) return;
  if (c.state !== 'running') return; // starts by itself on the first tap (see unlockAudio)
  if (playing?.id === worldId) return;
  stopMusic(true);
  const rng = rngFrom('music' + worldId);
  const scale = SCALES[worldId % SCALES.length];
  const root = 53 + ((worldId * 5) % 12);                 // a different key for every world, in a range small speakers can play
  key = { root: root + 12, scale };
  const bpm = 54 + (worldId % 6) * 3;                     // 54–69 beats per minute
  const beat = 60 / bpm;
  const bus = c.createGain(); bus.gain.value = 1;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.2;
  bus.connect(lp).connect(musicBus);
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), c.currentTime);
  musicBus.gain.linearRampToValueAtTime(holds ? 0.0001 : musicLevel(), c.currentTime + 2);

  // The harmony moves only between scale notes whose fifth is also in the scale, so pad and bass stay inside it.
  const homes = scale.filter((n) => scale.includes((n + 7) % 12));
  const walk = [homes[0], homes[1 % homes.length], homes[0], homes[2 % homes.length]];
  let bar = 0, step = 2, next = c.currentTime + 0.3;
  const schedule = () => {
    // Plan several seconds ahead, so a busy moment on the device never leaves a gap or a late, clipped note.
    if (next < c.currentTime + 0.1) next = c.currentTime + 0.3;
    while (next < c.currentTime + 4) {
      const home = root + walk[bar % 4];
      // pad: an open fifth and its octave, swelling in and out slowly and overlapping the next bar
      for (const iv of [0, 7, 12]) tone(midi(home + iv), next, beat * 4.6, { gain: 0.05, dest: bus, attack: beat * 1.4, release: beat * 1.6 });
      if (bar % 2 === 0) tone(midi(home - 12), next, beat * 7.5, { gain: 0.07, dest: bus, attack: beat, release: beat * 2 });
      // melody: a gentle walk up and down the scale — small steps, long soft notes, some rests
      for (let i = 0; i < 4; i += 2) {
        if (rng() < 0.25) continue;
        step = Math.max(0, Math.min(9, step + [-2, -1, -1, 1, 1, 2][Math.floor(rng() * 6)]));
        tone(midi(root + 12 + 12 * Math.floor(step / 5) + scale[step % 5]), next + i * beat, beat * 2.6, { gain: 0.085, dest: bus, attack: 0.12, release: beat * 1.3 });
      }
      next += beat * 4; bar++;
    }
  };
  // Optional focus tones for headphones: 200 Hz in the left ear and 210 Hz in the right, which the listener hears
  // as a soft 10 Hz beat. Offered as a calm backdrop only — research on such tones is mixed and the game claims no effect.
  const tones = [];
  if (profile?.settings.focusTones && c.createStereoPanner) {
    for (const [f, pan] of [[200, -1], [210, 1]]) {
      const o = c.createOscillator(), g = c.createGain(), pn = c.createStereoPanner();
      o.frequency.value = f; g.gain.value = 0.035; pn.pan.value = pan;
      o.connect(g).connect(pn).connect(musicBus); o.start(); tones.push(o);
    }
  }
  schedule();
  playing = { id: worldId, timer: setInterval(schedule, 700), bus, tones };
}
export function stopMusic(keepWanted = false) {
  if (keepWanted !== true) wanted = null;
  if (!playing || !ctx) return;
  const p = playing; playing = null;
  clearInterval(p.timer);
  p.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
  setTimeout(() => { try { p.bus.disconnect(); p.tones?.forEach((o) => o.stop()); } catch { /* already gone */ } }, 6000);
}
export const musicOn = () => !!playing;
// Pause when the game is in the background; pick the soundtrack up again when the player returns.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { const w = wanted; stopMusic(true); wanted = w; }
  else if (wanted != null) { ac(); if (ctx?.state === 'running') startMusic(wanted); }
});
