// Settings cards for voice, device self-check, guardian screen lock and anonymous puzzle results.
import { h, clear, toast, modal } from '../core/util.js';
import { t, lang, trStatus, tr } from '../core/i18n.js';
import { profile, device, save } from '../core/store.js';
import { loadVoicePack, removeVoicePack, voicePackInstalled, voicePack, offlineVoiceSupported, listen, listenEngine, canSpeakLang, speak } from '../core/speech.js';
import { deviceLockAvailable, addDeviceLock, removeDeviceLock, guardianUnlocked, ageFrom } from '../core/safety.js';
import { playNotes } from '../core/audio.js';
import { sectionTitle, progressBar } from './ui.js';
import { isInstalled } from '../app.js';

// ---------- voice ----------
export function voiceCard() {
  const status = h('div', { class: 'small', 'aria-live': 'polite' });
  const bar = h('div');
  const tryOut = h('div', { class: 'note', hidden: true });
  const draw = () => {
    const engine = listenEngine();
    clear(status).append(h('span', { class: 'pill ' + (engine === 'none' ? '' : 'ok') }, engine === 'device' ? '🎤 ' + t('Spoken answers: understood on this device, even offline') : engine === 'browser' ? '🎤 ' + t('Spoken answers: understood by your browser (needs the internet)') : '⌨️ ' + t('Spoken answers are typed for now — add the voice pack below')),
      voicePackInstalled() ? h('span', { class: 'pill' }, t('Voice pack') + ': ' + t(device.voicePack === 'large' ? 'more accurate' : 'standard')) : null);
  };
  const get = async (size) => {
    clear(bar).append(progressBar(0), h('div', { class: 'tiny muted' }, t('Fetching the voice pack. This happens once.')));
    const ok = await loadVoicePack(size, (f) => { bar.firstChild.firstChild.style.width = Math.round(f * 100) + '%'; });
    clear(bar);
    toast(ok ? '✅ ' + t('Voice pack ready. Spoken answers now work offline.') : t('The voice pack could not be loaded on this device.') + ' ' + voicePack.error.slice(0, 80));
    draw();
  };
  draw();
  return h('div', { class: 'card mt' }, sectionTitle('🎤', t('Speaking and listening')),
    h('p', { class: 'small muted' }, t('The voice pack lets the game understand spoken answers in all 12 languages on this device itself — in any modern browser, with no internet, and without your voice ever leaving the device.')),
    status,
    offlineVoiceSupported() ? h('div', { class: 'row mt' },
      h('button', { class: 'btn', onClick: () => get('small') }, '⬇️ ', t('Voice pack (about 40 MB)')),
      h('button', { class: 'btn ghost', onClick: () => get('large') }, '⬇️ ', t('More accurate voice pack (about 75 MB)')),
      voicePackInstalled() ? h('button', { class: 'btn ghost', onClick: async () => { await removeVoicePack(); draw(); toast(t('Voice pack removed.')); } }, '🗑️ ', t('Remove')) : null) : h('p', { class: 'small' }, t('This browser cannot use a microphone here, so spoken tasks are typed.')),
    bar,
    h('div', { class: 'row mt' }, h('button', { class: 'btn ghost', onClick: async (e) => {
      const b = e.currentTarget; b.disabled = true; tryOut.hidden = false; tryOut.textContent = '🎙️ ' + t('Say a short sentence, then pause…');
      const r = await listen({ onInterim: (s) => { if (s.length > 3) tryOut.textContent = s; } });
      tryOut.textContent = r ? '👂 ' + r.text : t('Nothing was heard. Check that the microphone is allowed for this site.');
      b.disabled = false;
    } }, '🎙️ ', t('Test my microphone')), h('button', { class: 'btn ghost', onClick: () => speak(t('Hello! This is how your teacher sounds.')) }, '🔊 ', t('Test the teacher\'s voice'))),
    tryOut,
    h('p', { class: 'tiny muted mt' }, t('The standard pack is quick; the more accurate one copes better with accents, quiet voices and younger children, and takes a few seconds longer on older phones.')));
}

// ---------- device self-check ----------
// Runs on the player's real device, so families and schools can confirm what works there before relying on it.
export async function deviceCheck() {
  const rows = h('table', { class: 'tbl' });
  const close = modal(h('div', null, h('h2', null, '🧪 ', t('Device check')), h('p', { class: 'small muted' }, t('A quick look at what this device and browser can do.')), rows, h('button', { class: 'btn mt', onClick: () => close() }, t('Close'))));
  const add = (ok, name, note = '') => rows.append(h('tr', null, h('td', null, ok === null ? '➖' : ok ? '✅' : '⚠️'), h('td', null, h('b', null, t(name)), note ? h('div', { class: 'tiny muted' }, note) : null)));
  add(true, 'Screen and browser', `${innerWidth}×${innerHeight} · ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 70)}`);
  let stored = false; try { localStorage.setItem('ukc.check', '1'); stored = localStorage.getItem('ukc.check') === '1'; localStorage.removeItem('ukc.check'); } catch { /* blocked */ }
  add(stored, 'Progress can be saved on this device', stored ? '' : t('Private browsing may be on. Progress will not be kept.'));
  let persisted = null; try { persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { /* unsupported */ }
  add(persisted === null ? null : persisted, 'Saved data is protected from automatic clean-up', persisted ? '' : t('Install the game to the home screen to protect it.'));
  const sw = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
  add(!!sw?.active, 'Works offline', sw?.active ? '' : t('Reload once while online to finish setting up offline play.'));
  let packs = 0; try { const c = await caches.open('ukc-data-v1'); packs = (await c.keys()).filter((r) => /content\//.test(r.url)).length; } catch { /* no cache */ }
  add(packs > 0, 'Lesson packs saved for offline', `${packs}`);
  add(isInstalled() ? true : null, 'Installed like an app');
  add(navigator.onLine, 'Internet right now');
  add(canSpeakLang(lang), 'The teacher can speak your language', canSpeakLang(lang) ? '' : t('No voice for this language is installed on the device; text is always shown.'));
  const engine = listenEngine();
  add(engine !== 'none', 'Spoken answers', engine === 'device' ? t('On this device, offline') : engine === 'browser' ? t('By the browser, online') : t('Add the voice pack in Settings.'));
  let mic = null; try { mic = (await navigator.permissions?.query({ name: 'microphone' }))?.state; } catch { /* not queryable */ }
  add(mic === 'granted' ? true : mic === 'denied' ? false : null, 'Microphone permission', mic ? t(mic === 'granted' ? 'Allowed' : mic === 'denied' ? 'Blocked in the browser settings' : 'Will be asked when needed') : '');
  let sound = false; try { sound = playNotes([72, 76, 79], 0.15) > 0; } catch { /* no audio */ }
  add(sound, 'Sound', sound ? t('You should have heard three notes.') : '');
  await tr('test');
  add(lang === 'en' ? null : 'Translator' in self || trStatus.mode !== 'none', 'Lesson translation', lang === 'en' ? t('Not needed for English') : 'Translator' in self ? t('On this device') : t('Online service'));
  add(await deviceLockAvailable(), 'Fingerprint, face or screen-lock protection for the guardian');
  add(typeof RTCPeerConnection !== 'undefined', 'Live duels with a friend');
}

// ---------- guardian screen lock ----------
export function deviceLockRow(redraw) {
  const box = h('div', { class: 'field mt' }, h('span', null, t('Stronger lock')));
  deviceLockAvailable().then((ok) => {
    if (!ok) { box.append(h('span', { class: 'tiny muted' }, t('This device has no fingerprint, face or screen-lock sign-in available to the browser.'))); return; }
    if (profile.guardian.cred) box.append(h('div', { class: 'row' }, h('span', { class: 'pill ok' }, '🔐 ', t('Protected by this device\'s screen lock')), h('button', { class: 'btn ghost sm', onClick: () => { removeDeviceLock(); redraw(); } }, t('Remove'))));
    else box.append(h('button', { class: 'btn ghost sm', onClick: async () => { if (!guardianUnlocked()) return; toast((await addDeviceLock()) ? '🔐 ' + t('Added. You can now unlock with your fingerprint, face or device PIN.') : t('The screen lock was not confirmed.')); redraw(); } }, '🔐 ', t('Also protect with this device\'s fingerprint, face or screen lock')),
      h('span', { class: 'tiny muted' }, t('A child who learns the PIN still cannot pass the grown-up\'s fingerprint or face.')));
  });
  return box;
}

// ---------- anonymous puzzle results for norming ----------
// The reasoning estimate can only become a properly normed score if results from many players of each age are
// pooled. This exports the puzzle answers with the age in years and nothing else: no name, no device, no progress.
export function normsExport() {
  const answers = profile.aptitude.flatMap((a) => a.answers || []);
  if (answers.length < 8) return toast(t('Finish at least one level final first.'));
  const rec = { app: 'ukc-norms', v: 1, age: ageFrom(profile.birth), band: profile.band, tests: profile.aptitude.map((a) => ({ level: a.level, theta: a.theta, answers: a.answers })) };
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' })), download: `puzzle-results-${Date.now().toString(36)}.json` });
  a.click();
  toast(t('Saved. Give this file to your school or study organiser.'));
  save;
}
