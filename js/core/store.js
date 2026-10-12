// Local, private storage for profiles and progress. Nothing here leaves the device unless the player exports it.
import { uid, slowHash, hashStr, dayNum } from './util.js';

const DEVICE_KEY = 'ukc.device.v1';
const PROFILE_KEY = (id) => `ukc.profile.${id}`;
const SALT = 'ukc-integrity-1';

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.warn('storage full or blocked', e); return false; }
}

// Device-level record: which profiles exist here, age-screen lock, audit trail, device preferences.
export const device = Object.assign({ profiles: {}, current: null, lang: null, ageLock: null, audit: [], installedAt: Date.now() }, read(DEVICE_KEY, {}));
export const saveDevice = () => { write(DEVICE_KEY, device); emit(); };
export function audit(type, detail = {}) {
  device.audit.push({ t: Date.now(), type, ...detail });
  if (device.audit.length > 300) device.audit.splice(0, device.audit.length - 300);
  write(DEVICE_KEY, device);
}

export let profile = null; // the signed-in profile

const sign = (p) => { const { sig, ...rest } = p; return hashStr(SALT + JSON.stringify(rest)).toString(36); };

let saveTimer = 0;
export function save(now = false) {
  if (!profile) return;
  const flush = () => { saveTimer = 0; if (!profile) return; profile.sig = sign(profile); write(PROFILE_KEY(profile.id), profile); };
  clearTimeout(saveTimer);
  if (now) flush(); else saveTimer = setTimeout(flush, 250);
  emit();
}
addEventListener('pagehide', () => { if (profile) { profile.sig = sign(profile); write(PROFILE_KEY(profile.id), profile); } });

export function blankProfile(data) {
  return {
    id: uid(), v: 1, created: Date.now(),
    name: data.name, avatar: data.avatar, cast: data.cast || 0,
    birth: data.birth, // { y, m } only — enough for an age band, nothing more
    band: data.band, guardian: data.guardian || null, consent: data.consent || {},
    lang: data.lang || 'en', school: data.school || '', interests: data.interests || [],
    experience: null, learn: null, pledged: false,
    settings: { sound: true, music: true, voice: true, untimed: data.band === 'tiny', size: 'm', contrast: 'normal', spacing: 'normal', motion: 'on', breakMins: data.band === 'tiny' || data.band === 'kid' ? 20 : 30, dailyMins: 0, links: data.band !== 'tiny' && data.band !== 'kid', live: true, speech: true, social: true },
    worlds: {}, items: {}, reviews: {}, palace: {}, notes: {},
    stats: { kinds: { recall: [0, 0], concept: [0, 0], apply: [0, 0], reason: [0, 0] }, retention: [0, 0], ms: 0, days: {}, hints: 0, retriesWon: 0, modes: {} },
    aptitude: [], log: [], social: { results: [], coop: 0 }, tampered: false,
  };
}

export async function createProfile(data, secret) {
  const p = blankProfile(data);
  p.secret = await slowHash(secret, p.id);
  write(PROFILE_KEY(p.id), { ...p, sig: sign(p) });
  device.profiles[p.id] = { name: p.name, avatar: p.avatar, band: p.band, kind: data.secretKind || 'text' };
  device.current = p.id;
  audit('profile-created', { id: p.id, band: p.band, guardian: !!p.guardian });
  profile = p;
  saveDevice();
  return p;
}

export async function signIn(id, secret) {
  const p = read(PROFILE_KEY(id), null);
  if (!p) return false;
  if ((await slowHash(secret, id)) !== p.secret) { audit('signin-failed', { id }); return false; }
  if (p.sig && p.sig !== sign(p)) { p.tampered = true; audit('integrity-flag', { id }); }
  profile = p;
  device.current = id;
  saveDevice();
  return true;
}
// Resume the profile that was open when the app was last closed (the device itself is the trusted boundary).
export function resume() {
  if (!device.current) return false;
  const p = read(PROFILE_KEY(device.current), null);
  if (!p) { device.current = null; return false; }
  if (p.sig && p.sig !== sign(p)) p.tampered = true;
  profile = p;
  return true;
}
export function signOut() { save(true); profile = null; device.current = null; saveDevice(); }
export function deleteProfile(id) {
  localStorage.removeItem(PROFILE_KEY(id));
  delete device.profiles[id];
  if (device.current === id) { device.current = null; profile = null; }
  audit('profile-deleted', { id });
  saveDevice();
}
export function syncMeta() {
  if (!profile) return;
  device.profiles[profile.id] = { ...device.profiles[profile.id], name: profile.name, avatar: profile.avatar, band: profile.band };
  saveDevice();
}
export const exportProfile = () => JSON.stringify({ app: 'ukc', v: 1, profile: { ...profile, sig: sign(profile) } });
export function importProfile(text) {
  const data = JSON.parse(text);
  if (data?.app !== 'ukc' || !data.profile?.id || !data.profile.secret) throw new Error('not a profile file');
  const p = data.profile;
  if (p.sig !== sign(p)) p.tampered = true;
  write(PROFILE_KEY(p.id), p);
  device.profiles[p.id] = { name: p.name, avatar: p.avatar, band: p.band, kind: 'text' };
  audit('profile-imported', { id: p.id });
  saveDevice();
  return p.id;
}

// ---------- progress helpers ----------
// A world key is "7", or "10:es" for a language path inside the Languages world.
export const worldId = (wkey) => parseInt(wkey, 10);
export const worldLang = (wkey) => String(wkey).split(':')[1] || null;

export function wstate(wkey) {
  const w = profile.worlds[wkey] ||= { started: Date.now(), toured: false, level: 0, placed: false, placeFails: {}, levelFails: {}, credits: 0, stages: {}, finale: {}, completed: [], champion: false, kinds: { recall: [0, 0], concept: [0, 0], apply: [0, 0], reason: [0, 0] }, runs: {} };
  return w;
}
export function sstate(wkey, level, stage) {
  const w = wstate(wkey);
  return (w.stages[`${level}.${stage}`] ||= { step: 0, done: false, wins: 0, tries: 0, best: 0, panel: false, run: w.runs[level] || 0 });
}
export const stageDone = (wkey, level, stage) => !!profile.worlds[wkey]?.stages[`${level}.${stage}`]?.done;
export function levelProgress(wkey, level) {
  let n = 0;
  for (let s = 1; s <= 9; s++) if (stageDone(wkey, level, s)) n++;
  return n + (profile.worlds[wkey]?.completed.includes(level) ? 1 : 0);
}
export function worldProgress(wkey) {
  const w = profile?.worlds[wkey];
  if (!w) return 0;
  let n = 0;
  for (let l = 1; l <= 6; l++) n += w.completed.includes(l) ? 10 : levelProgress(wkey, l);
  return n / 60;
}

export function addCredits(wkey, amount, reason) {
  const w = wstate(wkey);
  w.credits += amount;
  logEvent('credits', { w: wkey, n: amount, why: reason });
  save();
}
export function logEvent(type, data = {}) {
  profile.log.push({ t: Date.now(), type, ...data });
  if (profile.log.length > 400) profile.log.splice(0, profile.log.length - 400);
}

// Records one answered item for mastery tracking, the Mistake Lab and "prefer unseen questions".
export function recordAnswer(wkey, item, correct, { ms = 0, retention = false, mode = '' } = {}) {
  const k = item.k || 'recall';
  const add = (pair) => { pair[1]++; if (correct) pair[0]++; };
  add(profile.stats.kinds[k]);
  add(wstate(wkey).kinds[k]);
  if (retention) add(profile.stats.retention);
  if (item.id) {
    const rec = (profile.items[item.id] ||= { s: 0, c: 0, w: 0 });
    rec.s++; if (correct) { rec.c++; rec.w = 0; } else rec.w = (rec.w || 0) + 1;
    rec.t = dayNum();
  }
  const d = (profile.stats.days[dayNum()] ||= { q: 0, c: 0, ms: 0 });
  d.q++; if (correct) d.c++;
  if (mode) { const m = (profile.stats.modes[mode] ||= [0, 0]); add(m); }
  save();
}
export function addTime(ms) {
  if (!profile) return;
  profile.stats.ms += ms;
  (profile.stats.days[dayNum()] ||= { q: 0, c: 0, ms: 0 }).ms += ms;
  const keys = Object.keys(profile.stats.days);
  if (keys.length > 120) for (const k of keys.slice(0, keys.length - 120)) delete profile.stats.days[k];
  save();
}
export const todayMs = () => profile?.stats.days[dayNum()]?.ms || 0;
