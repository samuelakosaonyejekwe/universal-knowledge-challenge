// Voice: the teacher speaks (speech synthesis) and the player answers aloud (speech recognition).
// Recognition is run by the device/browser, in the language the player chose, and copes with accents as well as
// that engine does. Where a browser has no recognition (or the guardian turned the microphone off) every spoken
// task can be typed instead, so nobody is blocked.
import { langInfo, lang } from './i18n.js';
import { profile, device, saveDevice } from './store.js';
import { can } from './safety.js';

const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
const Rec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

let voices = [];
const loadVoices = () => { voices = synth?.getVoices() || []; };
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }

function voiceFor(code) {
  const want = langInfo(code).speech.toLowerCase(), base = code.toLowerCase();
  return voices.find((v) => v.lang.toLowerCase() === want) || voices.find((v) => v.lang.toLowerCase().startsWith(base)) || null;
}
export const canSpeakLang = (code) => !!voiceFor(code);

let keepAlive = 0;
export function speak(text, code = lang, { rate } = {}) {
  if (!synth || !text || (profile && !profile.settings.voice)) return Promise.resolve(false);
  return new Promise((resolve) => {
    synth.cancel();
    clearInterval(keepAlive);
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
    if (!voices.length) loadVoices();
    const v = voiceFor(code);
    if (v) u.voice = v;
    u.lang = langInfo(code).speech;
    u.rate = rate || (profile?.band === 'tiny' ? 0.85 : 0.95);
    u.volume = 1;
    const done = (ok) => { clearInterval(keepAlive); resolve(ok); };
    u.onend = () => done(true); u.onerror = () => done(false);
    // Some browsers drop an utterance spoken in the same instant as a cancel, and some stop long ones part-way;
    // a short delay and a periodic nudge keep the teacher talking.
    setTimeout(() => {
      synth.speak(u);
      keepAlive = setInterval(() => { if (!synth.speaking) clearInterval(keepAlive); else if (!/android/i.test(navigator.userAgent)) { synth.pause(); synth.resume(); } }, 9000);
    }, 70);
  });
}
export const stopSpeaking = () => { clearInterval(keepAlive); synth?.cancel(); };

// ---------- on-device speech recognition (works offline, in every modern browser) ----------
const micOK = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof Worker !== 'undefined';
let worker = null, jobs = new Map(), jobId = 0;
export const voicePack = { ready: false, loading: false, progress: 0, error: '' };
const packSize = () => device.voicePack || '';
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./voice-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') { voicePack.progress = m.total ? m.loaded / m.total : 0; voicePack.onProgress?.(voicePack.progress); return; }
    const job = jobs.get(m.id); if (!job) return;
    jobs.delete(m.id);
    if (m.type === 'error') job.reject(new Error(m.message)); else job.resolve(m);
  };
  worker.onerror = (e) => { for (const j of jobs.values()) j.reject(new Error(e.message || 'voice worker failed')); jobs.clear(); };
  return worker;
}
const call = (msg) => new Promise((resolve, reject) => { const id = ++jobId; jobs.set(id, { resolve, reject }); getWorker().postMessage({ ...msg, id }); });
// Downloads (first time) and warms up the voice pack. size: 'small' (≈40 MB) or 'large' (≈80 MB, more accurate).
export async function loadVoicePack(size = packSize() || 'small', onProgress) {
  voicePack.loading = true; voicePack.error = ''; voicePack.onProgress = onProgress;
  try { await call({ type: 'load', size }); device.voicePack = size; saveDevice(); voicePack.ready = true; return true; }
  catch (e) { voicePack.error = e.message; return false; }
  finally { voicePack.loading = false; }
}
export function removeVoicePack() { device.voicePack = ''; saveDevice(); voicePack.ready = false; worker?.terminate(); worker = null; return caches?.delete('transformers-cache'); }
export const voicePackInstalled = () => !!packSize();
export const offlineVoiceSupported = micOK;

let stopRecording = null;
// Records from the microphone until the speaker pauses (or maxMs), and returns 16 kHz mono samples.
async function record({ maxMs = 20000, onLevel } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  let spoke = false, quiet = 0, total = 0;
  return new Promise((resolve) => {
    const finish = async () => {
      if (!stopRecording) return; stopRecording = null;
      proc.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop());
      const rate = ctx.sampleRate; await ctx.close();
      const all = new Float32Array(total); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      if (!spoke || total < rate * 0.3) return resolve(null);
      // Resample to the 16 kHz the model expects.
      const off = new OfflineAudioContext(1, Math.ceil((total * 16000) / rate), 16000);
      const buf = off.createBuffer(1, total, rate); buf.copyToChannel(all, 0);
      const node = off.createBufferSource(); node.buffer = buf; node.connect(off.destination); node.start();
      resolve((await off.startRendering()).getChannelData(0));
    };
    stopRecording = finish;
    proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(d)); total += d.length;
      let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      const rms = Math.sqrt(sum / d.length);
      onLevel?.(rms);
      if (rms > 0.02) { spoke = true; quiet = 0; } else if (spoke) quiet += d.length / ctx.sampleRate;
      if ((spoke && quiet > 1.6) || total / ctx.sampleRate > maxMs / 1000) finish();
    };
    src.connect(proc); proc.connect(ctx.destination);
  });
}
async function listenOffline({ code, onInterim, maxMs }) {
  try {
    onInterim?.('🎙️ …');
    const audio = await record({ maxMs });
    if (!audio) return null;
    onInterim?.('⏳ …');
    const out = await call({ type: 'run', size: packSize() || 'small', audio, lang: code });
    return out.text ? { text: out.text, alternatives: [out.text] } : null;
  } catch (e) { voicePack.error = e.message; return null; }
}

// Which engine answers: the offline voice pack when it is installed (always, so results are the same online and
// offline) or when the browser has no recogniser of its own; otherwise the browser's built-in recogniser.
const useOffline = () => micOK() && voicePackInstalled() && (!Rec || !navigator.onLine || device.voicePrefer !== 'browser');
export const canListen = () => can('speech') && (!!Rec || (micOK() && voicePackInstalled()));
export const listenSupported = () => !!Rec || micOK();
export const listenEngine = () => (useOffline() ? 'device' : Rec ? 'browser' : 'none');

let active = null;
// Listens once. Resolves with { text, alternatives } or null if nothing was heard / permission was refused.
export function listen({ code = lang, onInterim, maxMs = 30000 } = {}) {
  if (!canListen()) return Promise.resolve(null);
  stopSpeaking();
  if (stopRecording) { stopRecording(); return Promise.resolve(null); } // a second tap on the microphone ends the recording
  if (useOffline()) return listenOffline({ code, onInterim, maxMs: Math.min(maxMs, 28000) });
  return new Promise((resolve) => {
    let finalText = '', alts = [], done = false;
    const rec = new Rec();
    active = rec;
    rec.lang = langInfo(code).speech;
    rec.interimResults = true; rec.maxAlternatives = 4; rec.continuous = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); active = null; resolve(finalText ? { text: finalText.trim(), alternatives: alts } : null); };
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { finalText += r[0].transcript + ' '; alts = alts.concat([...r].map((a) => a.transcript.trim())); } else interim += r[0].transcript;
      }
      onInterim?.((finalText + interim).trim());
    };
    rec.onerror = finish; rec.onend = finish;
    const timer = setTimeout(() => { try { rec.stop(); } catch { finish(); } }, maxMs);
    try { rec.start(); } catch { finish(); }
  });
}
export const stopListening = () => { try { active?.stop(); } catch { /* not running */ } stopRecording?.(); };
