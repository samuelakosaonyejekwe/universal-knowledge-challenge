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

const MODES = ['final', 'placement', 'arena', 'memory'];
export async function exploreView(main, [wkey, stageArg, extra]) {
  const wid = worldId(wkey), w = world(wid);
  if (!w) return go('home');
  if (wid === 10 && !worldLang(wkey)) return go('world/10');
  const ws = wstate(wkey);
  const mode = MODES.includes(stageArg) ? stageArg : null;
  // whole screens can be acted out in the world too: the level final, entry tests, the arena and the memory book
  const flat = { final: `finale/${wkey}/${ws.level}`, placement: `placement/${wkey}/${extra || 'find'}`, arena: `arena/${extra || 'practice'}`, memory: `memory/${extra || 'reviews'}` };
  if (!mode && (!ws.toured || !ws.level)) return go('world/' + wkey);
  const level = Math.max(1, ws.level || 1);
  let stageN = 9; for (let s = 1; s <= 9; s++) if (!stageDone(wkey, level, s)) { stageN = s; break; }
  // a stage already reached can be replayed; a later one cannot be skipped to
  const asked = parseInt(stageArg, 10); if (asked >= 1 && asked <= 9 && (asked <= stageN || ws.completed.includes(level))) stageN = asked;
  if (!webglOK()) return go(mode ? flat[mode] : `stage/${wkey}/${level}/${stageN}`);
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
  const run = game.startGame(host, { wkey, world: w, def, level, stageN, stage, items, lang: worldLang(wkey), ss: sstate(wkey, level, stageN), textOK, host: mode ? { kind: mode, params: mode === 'final' ? [wkey, String(ws.level)] : mode === 'placement' ? [wkey, extra || 'find'] : [extra || (mode === 'arena' ? 'practice' : 'reviews')] } : null, who: cast(wkey, level, ws.runs?.[level] || 0), profile,
    onExit: (reason) => { off(); if (reason === 'next') { if (location.hash === `#/explore/${wkey}/${stageN + 1}`) rerender(); else go(`explore/${wkey}/${stageN + 1}`); } else if (reason === 'final') go(`finale/${wkey}/${level}`); else if (reason) go(`world/${wkey}`); } });
  return () => { off(); run.dispose(); };
}
