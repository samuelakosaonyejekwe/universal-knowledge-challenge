// Sound: effects, playable notes and rhythms, and a calm generative soundtrack that is different for every world.
//
// The soundtrack is slow, consonant and gently pulsed at 10 Hz (inside the 8–12 Hz alpha range associated with
// relaxed alertness). It is meant to be calming and unobtrusive. It is not a medical or neurological treatment and
// the game makes no claim that it changes brain activity.
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
    limiter.threshold.value = -8; limiter.knee.value = 18; limiter.ratio.value = 3; limiter.attack.value = 0.02; limiter.release.value = 0.3;
    master = ctx.createGain(); master.gain.value = 0.85;
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
const MUSIC_LEVEL = { soft: 0.5, medium: 0.9, loud: 1.4 };
const musicLevel = () => MUSIC_LEVEL[profile?.settings.musicVolume] ?? MUSIC_LEVEL.medium;
export function setMusicVolume() { if (ctx && playing) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.2); }

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// One soft note. Every note fades in and fades out to silence, and is never started in the past — the two things
// that otherwise cause clicks and crackle.
function tone(freq, t0, dur, { type = 'sine', gain = 0.18, dest = master, attack = 0.02 } = {}) {
  const c = ac(); if (!c) return;
  t0 = Math.max(t0, c.currentTime + 0.03);
  const a = Math.min(attack, dur * 0.4), release = Math.min(0.25, dur * 0.45);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + a);
  g.gain.setValueAtTime(gain, t0 + dur - release);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.02);
  o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* already released */ } };
}

const SFX = {
  tap: [[660, 0, 0.06]], ok: [[660, 0, 0.12], [880, 0.1, 0.18]], no: [[220, 0, 0.18], [196, 0.14, 0.22]],
  win: [[523, 0, 0.15], [659, 0.13, 0.15], [784, 0.26, 0.15], [1047, 0.39, 0.4]], lose: [[392, 0, 0.2], [330, 0.2, 0.2], [262, 0.4, 0.4]],
  coin: [[988, 0, 0.08], [1319, 0.07, 0.2]], step: [[523, 0, 0.1], [784, 0.08, 0.14]], gong: [[110, 0, 1.2], [165, 0, 1.0]],
};
export function sfx(name) {
  if (profile && !profile.settings.sound) return;
  const c = ac(); if (!c) return;
  for (const [f, at, d] of SFX[name] || []) tone(f, c.currentTime + at, d, { type: 'sine', gain: 0.26, attack: 0.012 });
}

// Plays a sequence of MIDI notes; an inner array is a chord. Returns the total duration in seconds.
export function playNotes(notes, dur = 0.5, type = 'triangle') {
  const c = ac(); if (!c) return 0;
  let t = c.currentTime + 0.05;
  for (const n of notes) {
    for (const m of [n].flat()) if (m != null) tone(midi(m), t, dur * 0.95, { type, gain: 0.34 / Math.sqrt([n].flat().length) });
    t += dur;
  }
  return notes.length * dur;
}
// Plays a clapped rhythm given in beats.
export function playRhythm(beats, bpm = 96) {
  const c = ac(); if (!c) return 0;
  let t = c.currentTime + 0.05;
  const beat = 60 / bpm;
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
const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 5, 7, 9], [0, 2, 4, 7, 11], [0, 3, 5, 7, 8], [0, 2, 3, 7, 9], [0, 4, 5, 7, 11]];
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
  const bpm = 58 + (worldId % 6) * 3;                     // 58–73 beats per minute
  const beat = 60 / bpm;
  const voice = ['sine', 'triangle'][worldId % 2];
  const bus = c.createGain(); bus.gain.value = 1;
  // 10 Hz amplitude pulse, kept shallow so it is felt rather than heard.
  const trem = c.createGain(); trem.gain.value = 0.88;
  const lfo = c.createOscillator(), lfoGain = c.createGain();
  lfo.frequency.value = 10; lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain).connect(trem.gain); lfo.start();
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.3;
  bus.connect(trem).connect(lp).connect(musicBus);
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), c.currentTime);
  musicBus.gain.linearRampToValueAtTime(musicLevel(), c.currentTime + 1.5);

  const motif = Array.from({ length: 8 }, () => Math.floor(rng() * scale.length));
  let bar = 0, next = c.currentTime + 0.3;
  const schedule = () => {
    // Plan several seconds ahead, so a busy moment on the device never leaves a gap or a late, clipped note.
    if (next < c.currentTime + 0.1) next = c.currentTime + 0.3;
    while (next < c.currentTime + 4) {
      const chordRoot = root + [0, 7, 9, 5][bar % 4] - (bar % 4 === 1 ? 12 : 0);
      // pad: root + fifth + a scale tone, slow attack
      for (const iv of [0, 7, scale[2] + 12]) tone(midi(chordRoot + iv), next, beat * 4.2, { type: 'sine', gain: 0.07, dest: bus, attack: beat * 0.9 });
      // melody: the world's own motif, varied a little each bar
      for (let i = 0; i < 4; i++) {
        if (rng() < 0.3) continue;
        const deg = motif[(bar * 2 + i) % motif.length] + (rng() < 0.2 ? 1 : 0);
        const note = root + 12 + scale[deg % scale.length] + (deg >= scale.length ? 12 : 0);
        tone(midi(note), next + i * beat, beat * 1.6, { type: voice, gain: 0.13, dest: bus, attack: 0.06 });
      }
      if (bar % 2 === 0) tone(midi(chordRoot - 12), next, beat * 3.5, { type: 'sine', gain: 0.1, dest: bus, attack: 0.12 });
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
  playing = { id: worldId, timer: setInterval(schedule, 700), bus, lfo, tones };
}
export function stopMusic(keepWanted = false) {
  if (keepWanted !== true) wanted = null;
  if (!playing || !ctx) return;
  const p = playing; playing = null;
  clearInterval(p.timer);
  p.bus.gain.setValueAtTime(1, ctx.currentTime);
  p.bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  setTimeout(() => { try { p.lfo.stop(); p.bus.disconnect(); p.tones?.forEach((o) => o.stop()); } catch { /* already gone */ } }, 1000);
}
export const musicOn = () => !!playing;
// Pause when the game is in the background; pick the soundtrack up again when the player returns.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { const w = wanted; stopMusic(true); wanted = w; }
  else if (wanted != null) { ac(); if (ctx?.state === 'running') startMusic(wanted); }
});
