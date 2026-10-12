// Settings: language, accessibility, sound, offline downloads, the guardian zone, privacy and data.
import { h, clear, toast, modal } from '../core/util.js';
import { t, LANGS, lang, trStatus } from '../core/i18n.js';
import { profile, device, save, signOut, deleteProfile, exportProfile, syncMeta } from '../core/store.js';
import { needsGuardian, guardianUnlocked, lockGuardian, correctAge, clearAgeLock, BANDS, can } from '../core/safety.js';
import { listenSupported } from '../core/speech.js';
import { kvClear } from '../core/idb.js';
import { TARGET_LANGS } from '../data/worlds.js';
import LABS from '../labs/index.js';
import { go, sectionTitle, guardianGate, confirmBox } from './ui.js';
import { changeLanguage, applySettings, installApp, isInstalled, rerender } from '../app.js';

function toggle(label, key, { guard = false, hint = '', onChange } = {}) {
  const s = profile.settings;
  const c = h('input', { type: 'checkbox', checked: !!s[key] });
  c.addEventListener('change', () => {
    const apply = () => { s[key] = c.checked; save(true); applySettings(); onChange?.(); };
    if (guard && needsGuardian(profile.band)) { const want = c.checked; c.checked = !want; guardianGate(() => { c.checked = want; apply(); }); } else apply();
  });
  return h('label', { class: 'row between', style: { padding: '.45rem 0' } }, h('span', null, h('b', null, t(label)), guard && needsGuardian(profile.band) ? ' 🔒' : '', hint ? h('div', { class: 'tiny muted' }, t(hint)) : null), c);
}
function choice(label, key, opts) {
  const row = h('div', { class: 'row' });
  const draw = () => clear(row).append(...opts.map(([v, l]) => h('button', { class: 'chip', 'aria-pressed': String(profile.settings[key] === v), onClick: () => { profile.settings[key] = v; save(true); applySettings(); draw(); } }, t(l))));
  draw();
  return h('div', { class: 'field' }, h('span', null, t(label)), row);
}

// Saves every lesson pack, lab and screen on the device so the whole game works in airplane mode.
async function downloadAll(btn, out) {
  btn.disabled = true;
  const pad = (n) => String(n).padStart(2, '0');
  const urls = ['js/data/aspects.json'];
  for (let w = 1; w <= 20; w++) for (let l = 1; l <= 6; l++) { if (w === 10) for (const c of TARGET_LANGS) urls.push(`content/w10/${c}/l${l}.json`); else urls.push(`content/w${pad(w)}/l${l}.json`); }
  for (const lab of LABS) urls.push(`js/labs/${lab.id}.js`);
  for (const l of LANGS) if (l.code !== 'en') urls.push(`i18n/${l.code}.json`);
  let ok = 0, fail = 0;
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(urls.slice(i, i + 8).map((u) => fetch(u).then((r) => { r.ok ? ok++ : fail++; }).catch(() => { fail++; })));
    out.textContent = `${ok + fail} / ${urls.length}`;
  }
  btn.disabled = false;
  out.textContent = fail ? t('{ok} saved, {fail} could not be fetched — try again when online.', { ok, fail }) : '✅ ' + t('Everything is saved on this device. You can play in airplane mode.');
}

export function settingsView(main) {
  const p = profile, g = needsGuardian(p.band);
  main.append(h('div', { class: 'hero' }, h('h1', null, '⚙️ ', t('Settings'))));

  main.append(h('div', { class: 'card mt' }, sectionTitle('🌐', t('Language')), h('div', { class: 'row' }, LANGS.map((l) => h('button', { class: 'chip', lang: l.code, 'aria-pressed': String(l.code === lang), onClick: () => changeLanguage(l.code).then(() => save(true)) }, l.flag, ' ', l.name))),
    lang !== 'en' ? h('p', { class: 'tiny muted mt' }, t('Menus are fully translated. Lessons are translated on your device when your browser can, otherwise through an online service, and saved for offline use. Where neither is available, lesson text appears in English.'), ' ', t('Lesson translation right now') + ': ', t({ device: 'on this device', online: 'online service', none: 'not yet used' }[trStatus.mode])) : null));

  main.append(h('div', { class: 'card mt' }, sectionTitle('♿', t('Reading and comfort')),
    choice('Text size', 'size', [['m', 'Normal'], ['l', 'Large'], ['xl', 'Extra large']]), choice('Contrast', 'contrast', [['normal', 'Normal'], ['high', 'High contrast']]),
    choice('Letter spacing', 'spacing', [['normal', 'Normal'], ['wide', 'Wider (easier for some readers)']]), choice('Movement on screen', 'motion', [['on', 'On'], ['off', 'Reduced']]),
    toggle('Untimed mode', 'untimed', { hint: 'No clocks in duels. Leaderboards keep timed and untimed results apart, so this never counts against you.' }),
    toggle('Read aloud', 'voice', { hint: 'Your teacher\'s words are spoken as well as shown. All speech also appears as text.' }),
    toggle('Sound effects', 'sound'), toggle('Background music', 'music', { hint: 'A calm soundtrack, different in every world.' })));

  const out = h('div', { class: 'small mt', 'aria-live': 'polite' });
  const dl = h('button', { class: 'btn', onClick: () => downloadAll(dl, out) }, '⬇️ ', t('Download all lessons for offline play'));
  main.append(h('div', { class: 'card mt' }, sectionTitle('✈️', t('Install and offline')),
    h('p', { class: 'small muted' }, t('The game installs on computers, Android phones and tablets, iPhones and iPads. Once a lesson has been opened it works without the internet. Download everything here before a trip.')),
    h('div', { class: 'row' }, isInstalled() ? h('span', { class: 'pill ok' }, '✔ ', t('Installed')) : h('button', { class: 'btn ghost', onClick: installApp }, '📲 ', t('Install on this device')), dl), out,
    h('p', { class: 'tiny muted mt' }, t('Speaking answers aloud needs a browser with speech recognition (most Chrome, Edge and Safari versions) and usually an internet connection. Without it, every spoken task can be typed.'), ' ', listenSupported() ? '🎤 ' + t('Speech recognition is available here.') : '⌨️ ' + t('Speech recognition is not available in this browser.'))));

  // Guardian zone
  const gz = h('div', { class: 'card mt' }, sectionTitle('👪', t('Guardian zone')));
  if (p.guardian) {
    gz.append(h('p', { class: 'small' }, t('Managed by'), ': ', h('b', null, p.guardian.name), ' · ', t(p.guardian.relation), ' · ', t('consent given'), ' ', new Date(p.consent.at).toLocaleDateString()));
    const inner = h('div');
    const drawInner = () => {
      clear(inner);
      if (!guardianUnlocked()) { inner.append(h('button', { class: 'btn', onClick: () => guardianGate(drawInner) }, '🔒 ', t('Unlock with guardian PIN'))); return; }
      const num = (label, key, min, max, hint) => { const i = h('input', { class: 'input', type: 'number', min, max, value: p.settings[key], style: { maxWidth: '120px' } }); i.addEventListener('change', () => { p.settings[key] = Math.max(min, Math.min(max, +i.value || 0)); save(true); }); return h('label', { class: 'field' }, h('span', null, t(label)), i, h('span', { class: 'tiny muted' }, t(hint))); };
      const y = h('input', { class: 'input', type: 'number', value: p.birth.y, style: { maxWidth: '120px' } }), m = h('input', { class: 'input', type: 'number', min: 1, max: 12, value: p.birth.m, style: { maxWidth: '90px' } });
      inner.append(
        num('Break reminder every (minutes)', 'breakMins', 0, 120, '0 switches reminders off. 20–30 minutes is a healthy rhythm.'), num('Daily play limit (minutes)', 'dailyMins', 0, 600, '0 means no limit.'),
        toggle('Microphone for spoken answers', 'speech'), toggle('Live content from open sources', 'live', { hint: 'Encyclopedia entries, courses, research and data, filtered for young players.' }),
        toggle('Links to outside websites', 'links'), toggle('Challenge codes and tournaments', 'social', { hint: 'No chat, pseudonyms only.' }),
        h('div', { class: 'field mt' }, h('span', null, t('Correct the date of birth')), h('div', { class: 'row' }, y, m, h('button', { class: 'btn ghost sm', onClick: () => { correctAge({ y: +y.value, m: +m.value }); clearAgeLock(); syncMeta(); toast(t('Age corrected. This change is recorded.')); rerender(); } }, t('Save'))), h('span', { class: 'tiny muted' }, t('Current account type') + ': ' + t(BANDS[p.band].account))),
        h('details', { class: 'small' }, h('summary', { class: 'bold' }, t('Safety record for this device')), h('table', { class: 'tbl' }, device.audit.slice(-20).reverse().map((a) => h('tr', null, h('td', { class: 'tiny' }, new Date(a.t).toLocaleString()), h('td', null, a.type))))),
        h('button', { class: 'btn ghost sm mt', onClick: () => { lockGuardian(); drawInner(); } }, '🔒 ', t('Lock again')));
    };
    drawInner();
    gz.append(inner);
  } else gz.append(h('p', { class: 'small muted' }, g ? '' : t('This is a {type} account, so there is no guardian PIN. Break reminders and limits can be set here.', { type: t(BANDS[p.band].account) })),
    (() => { const i = h('input', { class: 'input', type: 'number', min: 0, max: 120, value: p.settings.breakMins, style: { maxWidth: '120px' } }); i.addEventListener('change', () => { p.settings.breakMins = +i.value || 0; save(true); }); return h('label', { class: 'field' }, h('span', null, t('Break reminder every (minutes)')), i); })(),
    toggle('Microphone for spoken answers', 'speech'), toggle('Live content from open sources', 'live'), toggle('Links to outside websites', 'links'), toggle('Challenge codes and tournaments', 'social'));
  main.append(gz);

  main.append(h('div', { class: 'card mt' }, sectionTitle('🔐', t('Privacy and your data')),
    h('ul', { class: 'small' }, ['Your profile and learning records are stored only on this device. There is no account server and nothing is sold or shared.', 'The game keeps a player name from its own list, your birth month and year (for the age band), your answers and progress, and your settings. Nothing else.', 'When live content or translation is on, your browser contacts open services such as Wikipedia directly. They receive the topic being looked up, not who you are.', 'Speech recognition is done by your browser\'s own speech service. The game does not record or store your voice.', 'There are no adverts, no purchases, no loot boxes and no gambling of any kind.'].map((x) => h('li', null, t(x)))),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onClick: () => guardianGate(() => { const a = h('a', { href: URL.createObjectURL(new Blob([exportProfile()], { type: 'application/json' })), download: `${p.name.replace(/\s+/g, '-')}-knowledge-challenge.json` }); a.click(); toast(t('Saved. Open this file on another device to continue there.')); }) }, '💾 ', t('Export my player')),
      h('button', { class: 'btn ghost', onClick: () => kvClear('').then(() => toast(t('Saved live content and translations cleared.'))) }, '🧹 ', t('Clear saved live content')),
      h('button', { class: 'btn ghost', onClick: () => go('rules') }, '📜 ', t('Game rules')), h('button', { class: 'btn ghost', onClick: () => go('about') }, '🧩 ', t('About you')),
      h('button', { class: 'btn ghost', onClick: () => { signOut(); go('welcome'); } }, '🚪 ', t('Sign out')),
      h('button', { class: 'btn bad', onClick: () => guardianGate(() => confirmBox(t('Delete this player?'), t('All progress for {name} on this device will be erased. This cannot be undone.', { name: p.name }), t('Delete'), () => { deleteProfile(p.id); go('welcome'); })) }, '🗑️ ', t('Delete my player')))));

  main.append(h('div', { class: 'card mt small' }, sectionTitle('ℹ️', t('About this game')),
    h('p', null, t('The Universal Knowledge Challenge is an educational game. Its medicine world uses fictional patients and is not medical advice; its flight, marine and nuclear simulations are simplified teaching models, not training for real operation; completing the chess world does not confer an official title. Lesson content is written to be accurate and is intended to be reviewed by subject specialists; if you spot an error, tell your teacher.')),
    h('p', { class: 'muted' }, t('Version'), ' 1.0 · ', can('live') ? t('Live sources: Wikipedia, Wikiversity, Wikibooks, OpenAlex, Internet Archive, Open Library, NASA, USGS, Open-Meteo, World Bank, PubChem, GBIF, MusicBrainz, Art Institute of Chicago, PoetryDB, Lichess, Stack Exchange, GitHub.') : '')));
  modal;
}
