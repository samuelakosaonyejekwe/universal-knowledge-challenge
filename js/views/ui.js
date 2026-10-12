// Shared interface pieces used by every screen.
import { h, modal, toast } from '../core/util.js';
import { t, trInto, tr } from '../core/i18n.js';
import { speak, stopSpeaking } from '../core/speech.js';
import { avatarEl } from '../core/avatar.js';
import { profile, addCredits, wstate, worldId } from '../core/store.js';
import { checkGuardianPin, guardianUnlocked, needsGuardian } from '../core/safety.js';
import { sfx } from '../core/audio.js';
import { world, AWARD } from '../data/worlds.js';

export const go = (path) => { location.hash = '#/' + path.replace(/^#?\/?/, ''); };

// A character says something: portrait, name, speech bubble and a button to hear it read aloud.
// `local: true` means the text is already in the player's language (interface text); otherwise it is lesson text.
export function talk(person, text, { role = person.role, right = false, local = false, auto = false } = {}) {
  const span = h('span');
  if (local) span.textContent = text; else trInto(span, text);
  const read = () => (local ? Promise.resolve(text) : tr(text)).then((s) => speak(s));
  const el = h('div', { class: 'talk' + (role === 'master' ? ' master' : '') + (right ? ' right' : '') },
    avatarEl(person.avatar || { seed: person.seed }, { band: profile?.band, role, cast: profile?.cast, emblem: person.emblem }),
    h('div', { class: 'bubble' }, h('span', { class: 'who' }, person.name, person.title ? ` · ${t(person.title)}` : ''), span),
    h('button', { class: 'say', type: 'button', title: t('Read aloud'), 'aria-label': t('Read aloud'), onClick: read }, '🔊'));
  if (auto) read();
  return el;
}
export const me = () => ({ name: profile.name, avatar: profile.avatar, role: 'student' });

export function sectionTitle(em, text) {
  return h('div', { class: 'step-title mb' }, h('span', { class: 'em' }, em), h('span', null, text));
}

export function progressBar(frac, cls = '') {
  return h('div', { class: 'bar ' + cls, role: 'progressbar', 'aria-valuenow': Math.round(frac * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: Math.round(frac * 100) + '%' } }));
}

export function creditPill(wkey) {
  const w = world(worldId(wkey));
  return h('span', { class: 'pill gold', title: t(w.credit) }, w.creditEm, ' ', String(profile.worlds[wkey]?.credits || 0), ' ', h('span', { class: 'tiny' }, t(w.credit)));
}

// Gives fictional achievement credits in the world's own currency. They have no money value.
export function award(wkey, kind, amount = AWARD[kind]) {
  if (!amount) return;
  const w = world(worldId(wkey));
  wstate(wkey);
  addCredits(wkey, amount, kind);
  sfx('coin');
  toast(`${w.creditEm} +${amount} ${t(w.credit)}`);
}

// Asks for the guardian PIN before a protected action. Adults and 16–17s pass straight through.
export function guardianGate(onOk, reason = '') {
  if (!profile.guardian || !needsGuardian(profile.band) || guardianUnlocked()) return onOk();
  const input = h('input', { class: 'input', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, 'aria-label': t('Guardian PIN') });
  const msg = h('div', { class: 'small', 'aria-live': 'polite' });
  const close = modal(h('div', null,
    h('h2', null, '🔒 ', t('Grown-up check')),
    h('p', null, t('Please ask your parent or guardian to enter their PIN.')),
    reason ? h('p', { class: 'small muted' }, reason) : null,
    h('label', { class: 'field' }, h('span', null, t('Guardian PIN')), input), msg,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onClick: async () => { if (await checkGuardianPin(input.value)) { close(); onOk(); } else { msg.textContent = t('That PIN is not right.'); input.value = ''; } } }, t('Unlock')),
      h('button', { class: 'btn ghost', onClick: () => close() }, t('Cancel')))));
}

export function confirmBox(title, text, yes, onYes) {
  const close = modal(h('div', null, h('h2', null, title), h('p', null, text), h('div', { class: 'row' },
    h('button', { class: 'btn', onClick: () => { close(); onYes(); } }, yes), h('button', { class: 'btn ghost', onClick: () => close() }, t('Cancel')))));
}

export const loading = () => h('div', { class: 'center' }, h('div', { class: 'spinner', role: 'status', 'aria-label': t('Loading') }));
export function contentMissing(retry) {
  return h('div', { class: 'card center' }, h('div', { class: 'huge' }, '📦'), h('h2', null, t('This lesson pack is not on your device yet')),
    h('p', { class: 'muted' }, t('Connect to the internet once and it will be saved for offline use.')), h('button', { class: 'btn', onClick: retry }, t('Try again')));
}
export { stopSpeaking };
