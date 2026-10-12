// Age assurance, guardian controls, feature permissions, wellbeing timers and a text filter.
//
// This app has no server of its own, so these protections are enforced on the device. They follow the
// layered approach in the design brief: neutral age screening, guardian-managed accounts for under-16s,
// safe defaults for everyone, protection against simply re-entering a different age, an audit trail, and a
// correction route through the guardian. The key idea: even if a child gives a false age, nothing unsafe unlocks —
// there is no open chat, no public profile, no contact with strangers and no adult content anywhere in the app.
import { device, saveDevice, audit, profile, save, todayMs } from './store.js';
import { slowHash, DAY } from './util.js';

export const BANDS = {
  tiny: { label: 'Under 7', min: 0, max: 6, account: 'Guardian-managed' },
  kid: { label: '7–12', min: 7, max: 12, account: 'Guardian-managed' },
  teen: { label: '13–15', min: 13, max: 15, account: 'Supervised' },
  young: { label: '16–17', min: 16, max: 17, account: 'Teen' },
  adult: { label: '18+', min: 18, max: 200, account: 'Adult' },
};

export function ageFrom(birth, now = new Date()) {
  let age = now.getFullYear() - birth.y;
  if (now.getMonth() + 1 < birth.m) age--;
  return age;
}
export function bandFor(age) {
  return Object.keys(BANDS).find((k) => age >= BANDS[k].min && age <= BANDS[k].max) || 'adult';
}
export const needsGuardian = (band) => band === 'tiny' || band === 'kid' || band === 'teen';
export const isMinor = (band) => band !== 'adult';

// Neutral age screening with re-registration protection: the first birth date entered on this device is remembered
// for 30 days. A different, older answer during that window does not unlock anything — the first answer stands
// unless a guardian corrects it.
const LOCK_DAYS = 30;
export function screenAge(birth) {
  const now = Date.now();
  const lock = device.ageLock;
  let used = birth, changed = false;
  if (lock && now - lock.t < LOCK_DAYS * DAY) {
    if (ageFrom(birth) > ageFrom(lock.birth)) { used = lock.birth; changed = true; audit('age-reentry-blocked', { tried: bandFor(ageFrom(birth)), kept: bandFor(ageFrom(lock.birth)) }); }
  } else {
    device.ageLock = { t: now, birth };
    saveDevice();
  }
  const age = ageFrom(used);
  return { birth: used, age, band: bandFor(age), changed };
}
export function clearAgeLock() { device.ageLock = null; saveDevice(); audit('age-lock-cleared-by-guardian'); }

// ---------- guardian ----------
export async function makeGuardian({ name, relation, birthYear, pin }) {
  const id = 'g' + Date.now().toString(36);
  return { id, name, relation, adult: new Date().getFullYear() - birthYear >= 18, pin: await slowHash(pin, id), at: Date.now() };
}
let unlockedUntil = 0;
export async function checkGuardianPin(pin) {
  const g = profile?.guardian;
  if (!g) return false;
  const ok = (await slowHash(pin, g.id)) === g.pin;
  audit(ok ? 'guardian-unlock' : 'guardian-pin-failed', { id: profile.id });
  if (ok) unlockedUntil = Date.now() + 10 * 60000;
  return ok;
}
export const guardianUnlocked = () => Date.now() < unlockedUntil;
export const lockGuardian = () => { unlockedUntil = 0; };

// A guardian can correct an age that was entered wrongly. The change is recorded.
export function correctAge(birth) {
  const before = profile.band;
  profile.birth = birth;
  profile.band = bandFor(ageFrom(birth));
  audit('age-corrected-by-guardian', { id: profile.id, from: before, to: profile.band });
  save(true);
}

// ---------- permissions ----------
// One place decides what each account may do. Views ask `can()`; they never decide for themselves.
export function can(feature) {
  const p = profile;
  if (!p) return false;
  const s = p.settings, b = p.band;
  switch (feature) {
    case 'links': return s.links && b !== 'tiny';                 // opening outside websites
    case 'live': return s.live;                                   // fetching fresh material from open sources
    case 'forums': return s.live && s.links && (b === 'young' || b === 'adult' || (b === 'teen' && !!p.guardian?.forums)); // community Q&A titles
    case 'repos': return s.live && s.links && b !== 'tiny' && b !== 'kid';
    case 'speech': return s.speech;                               // microphone
    case 'social': return s.social && !p.tampered;                // challenge codes, tournaments
    case 'board': return !p.tampered;                             // leaderboards
    case 'export': return !needsGuardian(b) || guardianUnlocked();
    case 'settings-safety': return !needsGuardian(b) || guardianUnlocked();
    case 'iq-number': return b === 'young' || b === 'adult' || guardianUnlocked(); // younger players see a description, not a number
    default: return false;
  }
}

// ---------- wellbeing ----------
let sessionStart = Date.now(), lastBreak = Date.now();
export const sessionMinutes = () => (Date.now() - sessionStart) / 60000;
export function breakDue() {
  const mins = profile?.settings.breakMins || 0;
  return mins > 0 && (Date.now() - lastBreak) / 60000 >= mins;
}
export const tookBreak = () => { lastBreak = Date.now(); };
export function dailyLimitReached() {
  const lim = profile?.settings.dailyMins || 0;
  return lim > 0 && todayMs() / 60000 >= lim;
}
export const BREAK_IDEAS = [
  'Stand up and stretch as tall as you can.', 'Drink a glass of water.', 'Look out of a window at something far away for twenty seconds.',
  'Tell someone at home one thing you just learned.', 'Go outside for a few minutes if you can.', 'Take ten slow, deep breaths.',
  'Draw what you learned on a piece of paper.', 'Play or talk with a friend or someone in your family.', 'Walk around and count how many of today\'s ideas you can spot around you.',
];
export const HABITS = [
  'Sleep helps your brain keep what you learned today.', 'Short study sessions on several days beat one long session.', 'Moving your body helps you concentrate afterwards.',
  'Explaining an idea to someone else is one of the best ways to remember it.', 'It is normal to forget — every time you recall something, the memory gets stronger.', 'Water and regular meals help you think clearly.',
  'Mistakes are information. They show exactly what to practise next.', 'Being confident is not the same as being correct — check your answer.',
];

// ---------- text filter ----------
// Applied to anything fetched from outside sources before it is shown to under-18s, and to anything a player types
// that another player could see (which is only preset phrases and pseudonyms in this app).
// Under-18s: no sexual content, strong language, drugs, gambling or graphic violence.
// Under-13s additionally skip outside text that dwells on killing or war deaths; the authored lessons cover
// hard history gently instead.
const BLOCK = /\b(sex|sexual\w*|sexy|porn\w*|nude|nudity|naked|erotic\w*|rape[ds]?|murder\w*|massacre\w*|suicide|gore|gory|tortur\w*|behead\w*|mutilat\w*|cocaine|heroin|marijuana|cannabis|gambl\w*|casino|betting|damn\w*|shit\w*|fuck\w*|bitch\w*|bastard\w*|slut\w*|whore\w*|piss\w*|asshole\w*)\b/i;
const BLOCK_YOUNG = /\b(kill(?:ed|ing|s)?|slaughter\w*|execut(?:ed|ion\w*)|genocide|corpse\w*|blood(?:y|shed)?|stabb\w*|shot dead|bomb(?:ed|ing)s?|terroris\w*|weapon\w*|drug\w*|alcohol\w*|beer|wine|vodka|cigarette\w*|tobacco)\b/i;
export function isSafeText(text, band = profile?.band) {
  const s = String(text || '');
  if (!band || band === 'adult') return true;
  if (BLOCK.test(s)) return false;
  return !((band === 'tiny' || band === 'kid') && BLOCK_YOUNG.test(s));
}
export function filterItems(items, fields = ['title', 'text']) {
  if (!profile || !isMinor(profile.band)) return items;
  return items.filter((it) => fields.every((f) => isSafeText(it[f])));
}
