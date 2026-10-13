// The 3D adventure for a world: loads the lesson for the player's current stage and starts the game.
import { h, clear } from '../core/util.js';
import { t } from '../core/i18n.js';
import { profile, wstate, worldId, worldLang, stageDone } from '../core/store.js';
import { world } from '../data/worlds.js';
import { loadStage, practiceSet } from '../engine/content.js';
import { cast } from '../core/names.js';
import { go, loading, contentMissing } from './ui.js';
import { webglOK } from '../gfx/kit3d.js';

export const worldFile = (wid) => `../game3d/worlds/w${String(wid).padStart(2, '0')}.js`;

export async function exploreView(main, [wkey]) {
  const wid = worldId(wkey), w = world(wid);
  if (!w) return go('home');
  if (wid === 10 && !worldLang(wkey)) return go('world/10');
  const ws = wstate(wkey), level = Math.max(1, ws.level || 1);
  let stageN = 9; for (let s = 1; s <= 9; s++) if (!stageDone(wkey, level, s)) { stageN = s; break; }
  if (!webglOK()) { main.append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, '🎮'), h('h2', null, t('3D is not available on this device')), h('p', { class: 'muted' }, t('You can still learn everything in this world through the lessons and labs.')), h('a', { class: 'btn', href: `#/world/${wkey}` }, t('Back to the world')))); return null; }
  main.append(loading());
  let stage, items, def, game;
  try {
    [stage, items, def, game] = await Promise.all([loadStage(wkey, level, stageN), practiceSet(wkey, level, stageN, 16, { say: false }), import(worldFile(wid)).then((m) => m.default), import('../game3d/game.js')]);
  } catch (e) { console.error(e); clear(main).append(contentMissing(() => exploreView(clear(main), [wkey]))); return null; }
  clear(main);
  const host = h('div', { class: 'g3d' });
  main.append(host);
  document.documentElement.classList.add('g3d-on');
  const off = () => document.documentElement.classList.remove('g3d-on');
  const run = game.startGame(host, { wkey, world: w, def, level, stageN, stage, items, lang: worldLang(wkey), who: cast(wkey, level, ws.runs?.[level] || 0), profile,
    onExit: (reason) => { off(); if (reason === 'lesson') go(`stage/${wkey}/${level}/${stageN}`); else if (reason) go(`world/${wkey}`); } });
  return () => { off(); run.dispose(); };
}
