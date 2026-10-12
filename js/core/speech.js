// Voice: the teacher speaks (speech synthesis) and the player answers aloud (speech recognition).
// Recognition is run by the device/browser, in the language the player chose, and copes with accents as well as
// that engine does. Where a browser has no recognition (or the guardian turned the microphone off) every spoken
// task can be typed instead, so nobody is blocked.
import { langInfo, lang } from './i18n.js';
import { profile } from './store.js';
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

export function speak(text, code = lang, { rate } = {}) {
  if (!synth || !text || (profile && !profile.settings.voice)) return Promise.resolve(false);
  return new Promise((resolve) => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
    const v = voiceFor(code);
    if (v) u.voice = v;
    u.lang = langInfo(code).speech;
    u.rate = rate || (profile?.band === 'tiny' ? 0.85 : 0.95);
    u.onend = () => resolve(true); u.onerror = () => resolve(false);
    synth.speak(u);
  });
}
export const stopSpeaking = () => synth?.cancel();

export const canListen = () => !!Rec && can('speech');
export const listenSupported = () => !!Rec;

let active = null;
// Listens once. Resolves with { text, alternatives } or null if nothing was heard / permission was refused.
export function listen({ code = lang, onInterim, maxMs = 30000 } = {}) {
  if (!canListen()) return Promise.resolve(null);
  stopSpeaking();
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
export const stopListening = () => { try { active?.stop(); } catch { /* not running */ } };
