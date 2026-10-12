// Home: the 20 worlds, what to do next, reviews that are due.
import { h } from '../core/util.js';
import { t } from '../core/i18n.js';
import { profile, worldProgress } from '../core/store.js';
import { WORLDS, LEVELS } from '../data/worlds.js';
import { dueReviews } from '../core/srs.js';
import { avatarEl } from '../core/avatar.js';
import { HABITS } from '../core/safety.js';
import { go, progressBar } from './ui.js';
import { stageTitle } from '../engine/content.js';
import { isInstalled, installApp } from '../app.js';

export function home(main) {
  const p = profile;
  const started = Object.entries(p.worlds).filter(([, w]) => w.level > 0).sort((a, b) => (b[1].last || 0) - (a[1].last || 0));
  const due = dueReviews();
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  main.append(h('div', { class: 'hero' },
    h('div', { class: 'scene', 'aria-hidden': 'true' }, ['✨', '🌟', '💫'].map((e, i) => h('span', { style: { right: (8 + i * 14) + '%', top: (10 + i * 22) + '%', animationDelay: i + 's' } }, e))),
    h('div', { class: 'row nowrap' }, avatarEl(p.avatar, { band: p.band, role: 'student', size: 'lg', cast: p.cast, emblem: Object.values(p.worlds).some((w) => w.completed.length) }),
      h('div', null, h('h1', null, t(hello) + ', ' + p.name + '!'), h('p', { class: 'muted mt0' }, t('Where will your curiosity take you today?'))))));

  const next = h('div', { class: 'grid c2 mt' });
  if (started.length) {
    const [wkey, w] = started[0];
    const world = WORLDS[parseInt(wkey, 10) - 1];
    let stage = 1; while (stage <= 9 && w.stages[`${w.level}.${stage}`]?.done) stage++;
    next.append(h('button', { class: 'card tint', style: { textAlign: 'start', cursor: 'pointer' }, onClick: () => go(stage <= 9 ? `stage/${wkey}/${w.level}/${stage}` : `finale/${wkey}/${w.level}`) },
      h('div', { class: 'tiny bold muted' }, '▶ ', t('Continue')), h('div', { class: 'big bold' }, world.em, ' ', t(world.short)),
      h('div', { class: 'small' }, t('Level {n}', { n: w.level }), ' · ', t(LEVELS[w.level - 1].name), ' · ', stage <= 9 ? stageTitle(wkey, w.level, stage) : t('Level final'))));
  } else {
    next.append(h('div', { class: 'card tint' }, h('div', { class: 'big bold' }, '👇 ', t('Pick any world to begin')), h('div', { class: 'small' }, t('Each world starts with a guided tour, then you choose your level.'))));
  }
  next.append(h('button', { class: 'card', style: { textAlign: 'start', cursor: 'pointer' }, onClick: () => go('memory') },
    h('div', { class: 'tiny bold muted' }, '🧠 ', t('Memory')), h('div', { class: 'big bold' }, due.length ? t('{n} reviews are ready', { n: due.length }) : t('No reviews due right now')),
    h('div', { class: 'small muted' }, t(HABITS[new Date().getDate() % HABITS.length]))));
  main.append(next);

  const fav = new Set(p.interests);
  const tiles = WORLDS.map((w) => {
    const prog = Math.max(worldProgress(String(w.id)), ...Object.keys(p.worlds).filter((k) => k.startsWith(w.id + ':')).map(worldProgress), 0);
    return h('button', { class: 'world-tile', style: { '--c1': w.c1, '--c2': w.c2 }, onClick: () => go('world/' + w.id), 'aria-label': t(w.name) },
      h('span', { class: 'num' }, String(w.id).padStart(2, '0'), fav.has(w.id) ? ' ♥' : ''), h('span', { class: 'em' }, w.em),
      h('span', null, h('span', { class: 'nm' }, t(w.short)), progressBar(prog)));
  });
  main.append(h('h2', { class: 'mt' }, '🌍 ', t('The 20 worlds of knowledge')), h('div', { class: 'worlds' }, tiles));
  if (!isInstalled()) main.append(h('div', { class: 'card mt row between' }, h('div', null, h('b', null, '📲 ', t('Install the game')), h('div', { class: 'small muted' }, t('Add it to your phone, tablet or computer and play offline.'))), h('button', { class: 'btn sm', onClick: installApp }, t('Install'))));
}
