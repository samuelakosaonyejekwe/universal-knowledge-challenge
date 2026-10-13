// The 3D adventure for a world: loads the lesson for the player's current stage and starts the game.
import { h, clear } from '../core/util.js';
import { canMarkText } from '../core/i18n.js';
import { profile, wstate, sstate, worldId, worldLang, stageDone } from '../core/store.js';
import { rerender } from '../app.js';
import { world } from '../data/worlds.js';
import { loadStage, practiceSet } from '../engine/content.js';
import { cast } from '../core/names.js';
import { go, loading, contentMissing } from './ui.js';
import { webglOK } from '../gfx/kit3d.js';

export const worldFile = (wid) => `../game3d/worlds/w${String(wid).padStart(2, '0')}.js`;

export async function exploreView(main, [wkey, stageArg]) {
  const wid = worldId(wkey), w = world(wid);
  if (!w) return go('home');
  if (wid === 10 && !worldLang(wkey)) return go('world/10');
  const ws = wstate(wkey);
  if (!ws.toured || !ws.level) return go('world/' + wkey);
  const level = ws.level;
  let stageN = 9; for (let s = 1; s <= 9; s++) if (!stageDone(wkey, level, s)) { stageN = s; break; }
  // a stage already reached can be replayed; a later one cannot be skipped to
  const asked = parseInt(stageArg, 10); if (asked >= 1 && asked <= 9 && (asked <= stageN || ws.completed.includes(level))) stageN = asked;
  if (!webglOK()) return go(`stage/${wkey}/${level}/${stageN}`);
  main.append(loading());
  let stage, items, def, game, textOK;
  try {
    [stage, items, def, game, textOK] = await Promise.all([loadStage(wkey, level, stageN), practiceSet(wkey, level, stageN, 16, { say: false }), import(worldFile(wid)).then((m) => m.default), import('../game3d/game.js'), canMarkText()]);
  } catch (e) { console.error(e); clear(main).append(contentMissing(() => exploreView(clear(main), [wkey, stageArg]))); return null; }
  await game.loadWorldText();
  clear(main);
  const host = h('div', { class: 'g3d' });
  main.append(host);
  document.documentElement.classList.add('g3d-on');
  const off = () => document.documentElement.classList.remove('g3d-on');
  const run = game.startGame(host, { wkey, world: w, def, level, stageN, stage, items, lang: worldLang(wkey), ss: sstate(wkey, level, stageN), textOK, who: cast(wkey, level, ws.runs?.[level] || 0), profile,
    onExit: (reason) => { off(); if (reason === 'next') { if (location.hash === `#/explore/${wkey}/${stageN + 1}`) rerender(); else go(`explore/${wkey}/${stageN + 1}`); } else if (reason === 'final') go(`finale/${wkey}/${level}`); else if (reason) go(`world/${wkey}`); } });
  return () => { off(); run.dispose(); };
}
