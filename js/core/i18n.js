// Interface language (12 languages, shipped with the app) and lesson translation (done on the device where possible).
import { kvGet, kvSet } from './idb.js';
import { hashStr } from './util.js';

export const LANGS = [
  { code: 'en', name: 'English', flag: '🇬🇧', speech: 'en-GB', wiki: 'en' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', speech: 'fr-FR', wiki: 'fr' },
  { code: 'es', name: 'Español', flag: '🇪🇸', speech: 'es-ES', wiki: 'es' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', speech: 'ar-SA', wiki: 'ar', rtl: true },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', speech: 'ru-RU', wiki: 'ru' },
  { code: 'he', name: 'עברית', flag: '🇮🇱', speech: 'he-IL', wiki: 'he', rtl: true },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', speech: 'it-IT', wiki: 'it' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', speech: 'el-GR', wiki: 'el' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', speech: 'tr-TR', wiki: 'tr' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', speech: 'pt-PT', wiki: 'pt' },
  { code: 'zh', name: '中文', flag: '🇨🇳', speech: 'zh-CN', wiki: 'zh' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', speech: 'ja-JP', wiki: 'ja' },
];
export const langInfo = (code) => LANGS.find((l) => l.code === code) || LANGS[0];
export const ENGLISH_NAMES = { en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic', ru: 'Russian', he: 'Hebrew', it: 'Italian', el: 'Greek', tr: 'Turkish', pt: 'Portuguese', zh: 'Chinese (Mandarin)', ja: 'Japanese' };

export let lang = 'en';
let dict = {};

export async function setLang(code) {
  lang = langInfo(code).code;
  dict = {};
  if (lang !== 'en') {
    try { const r = await fetch(`i18n/${lang}.json`); if (r.ok) dict = await r.json(); } catch { /* offline before first cache: English */ }
  }
  const root = document.documentElement;
  root.lang = lang;
  root.dir = langInfo(lang).rtl ? 'rtl' : 'ltr';
}

// Interface strings: the English sentence is the key. `{name}` placeholders are filled from vars.
export function t(text, vars) {
  let s = dict[text] ?? text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// ---------- lesson translation ----------
// Lessons are authored in English. For other languages the app translates on the device with the browser's
// built-in translator when there is one, otherwise through a free translation service while online, and keeps
// every result so it works offline afterwards. If neither is available the English text is shown.
const memo = new Map();
let native = null, nativeTried = '';
let remoteBlockedUntil = 0;
export const trStatus = { mode: 'none' }; // 'device' | 'online' | 'none'

async function nativeTranslator(from, to) {
  const key = `${from}>${to}`;
  if (nativeTried === key) return native;
  nativeTried = key; native = null;
  try {
    if (!('Translator' in self)) return null;
    const avail = await self.Translator.availability({ sourceLanguage: from, targetLanguage: to });
    if (avail === 'unavailable') return null;
    if (avail !== 'available' && !navigator.userActivation?.isActive) { nativeTried = ''; return null; } // model download needs a tap; try again later
    native = await self.Translator.create({ sourceLanguage: from, targetLanguage: to });
  } catch { native = null; }
  return native;
}

async function remote(text, from, to) {
  if (!navigator.onLine || Date.now() < remoteBlockedUntil) return null;
  const parts = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [text];
  const chunks = [];
  for (const p of parts) {
    if (chunks.length && (chunks[chunks.length - 1] + p).length < 450) chunks[chunks.length - 1] += p; else chunks.push(p);
  }
  const out = [];
  for (const c of chunks) {
    try {
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c.slice(0, 480))}&langpair=${from}|${to === 'zh' ? 'zh-CN' : to}`);
      const j = await r.json();
      const got = j?.responseData?.translatedText;
      if (!r.ok || j.responseStatus !== 200 || !got || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(got)) { remoteBlockedUntil = Date.now() + 3600000; return null; }
      out.push(got);
    } catch { return null; }
  }
  return out.join(' ');
}

async function translate(text, from, to) {
  if (!text || from === to || !/\p{L}/u.test(text)) return text;
  const key = `tr|${from}|${to}|${hashStr(text).toString(36)}|${text.length}`;
  if (memo.has(key)) return memo.get(key);
  const cached = await kvGet(key);
  if (cached) { memo.set(key, cached); return cached; }
  let out = null;
  const nt = await nativeTranslator(from, to);
  if (nt) { try { out = await nt.translate(text); trStatus.mode = 'device'; } catch { out = null; } }
  if (!out) { out = await remote(text, from, to); if (out) trStatus.mode = 'online'; }
  if (!out) return text;
  memo.set(key, out);
  kvSet(key, out);
  return out;
}

// Lesson text → the player's language.
export const tr = (text) => (lang === 'en' ? Promise.resolve(text) : translate(text, 'en', lang));
// A typed or spoken answer → English, so rubrics written in English can mark it.
export const toEnglish = (text) => (lang === 'en' ? Promise.resolve(text) : translate(text, lang, 'en'));

// Puts text into an element straight away and swaps in the translation when it arrives.
export function trInto(el, text) {
  el.textContent = text;
  if (lang !== 'en' && text) {
    el.dataset.src = text;
    tr(text).then((out) => { if (el.dataset.src === text) el.textContent = out; });
  }
  return el;
}
// True when free-text answers in the player's language can be marked (English, or a working translator).
export async function canMarkText() {
  if (lang === 'en') return true;
  if (await nativeTranslator(lang, 'en')) return true;
  return navigator.onLine && Date.now() >= remoteBlockedUntil;
}
