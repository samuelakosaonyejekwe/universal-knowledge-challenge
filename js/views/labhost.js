// Mounts a virtual lab, tour or studio and connects it to the teacher, credits and progress.
import { h, rngFrom, toast } from '../core/util.js';
import { t, tr, lang } from '../core/i18n.js';
import { profile, save, worldLang, logEvent } from '../core/store.js';
import { speak } from '../core/speech.js';
import { sfx } from '../core/audio.js';
import LABS from '../labs/index.js';
import { award } from './ui.js';

export const labsFor = (wid, level = null) => LABS.filter((l) => l.world === wid && (level == null || l.levels.includes(level)));
// The lab for a stage: one that suits the level, rotating so different stages meet different labs.
export function labForStage(wid, level, stage) {
  const fit = labsFor(wid, level);
  const pool = fit.length ? fit : labsFor(wid).sort((a, b) => Math.abs(a.levels[0] - level) - Math.abs(b.levels[0] - level)).slice(0, 1);
  return pool.length ? pool[(stage - 1) % pool.length] : null;
}

// Interface strings inside labs are translated in the background and picked up on the next visit.
const labText = new Map();
function labT(text) {
  if (lang === 'en') return text;
  const key = lang + '|' + text;
  if (labText.has(key)) return labText.get(key);
  labText.set(key, text);
  tr(text).then((out) => labText.set(key, out));
  return text;
}

// Returns { el, stop }. onComplete(score, note) fires each time the learner achieves the lab's mission.
export function mountLab(meta, { wkey, level, teacher, onComplete }) {
  const root = h('div', { class: 'lab' });
  const says = h('div', { 'aria-live': 'polite' });
  const kindLabel = { lab: 'Virtual lab', tour: 'Virtual trip', studio: 'Creative studio' }[meta.kind] || 'Virtual lab';
  const el = h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('div', { class: 'step-title' }, h('span', { class: 'em' }, meta.icon), h('span', null, labT(meta.title))), h('span', { class: 'pill' }, t(kindLabel))),
    h('p', { class: 'lab-goal mt' }, '🎯 ', labT(meta.goal)), says, root,
    h('details', { class: 'mt small' }, h('summary', { class: 'bold' }, 'ℹ️ ', t('What this model leaves out')), h('p', { class: 'muted' }, labT(meta.limits))));
  let stop = () => {}, alive = true, completions = 0;
  const api = {
    level, lang: worldLang(wkey) || 'es', rng: rngFrom(`${meta.id}|${profile.id}|${Date.now()}`),
    reducedMotion: profile.settings.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches,
    t: labT,
    say(text) {
      if (!alive) return;
      const out = labT(text);
      says.replaceChildren(h('div', { class: 'note mb' }, h('b', null, (teacher?.short || t('Teacher')) + ': '), out));
      speak(out);
    },
    complete(score = 1, note = '') {
      if (!alive) return;
      completions++;
      sfx('ok');
      const key = meta.id;
      profile.notes.labs ||= {};
      const first = !profile.notes.labs[key];
      profile.notes.labs[key] = { n: (profile.notes.labs[key]?.n || 0) + 1, best: Math.max(profile.notes.labs[key]?.best || 0, score), at: Date.now() };
      logEvent('lab', { w: wkey, id: key, score });
      save();
      if (first) award(wkey, 'experiment'); else toast('✅ ' + t('Mission complete!'));
      onComplete?.(score, note, completions);
    },
  };
  import(`../labs/${meta.id}.js`).then((m) => {
    if (!alive) return;
    try { stop = m.default.mount(root, api) || (() => {}); } catch (e) { console.error(e); root.append(h('div', { class: 'note bad' }, t('This lab could not start on this device.'))); }
  }).catch(() => root.append(h('div', { class: 'note bad' }, t('This lab is not on your device yet. Connect once to download it.'))));
  return { el, stop: () => { alive = false; try { stop(); } catch (e) { console.error(e); } } };
}
