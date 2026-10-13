// When a duel, a test or a review runs while the player is inside the 3D world, the world listens here and acts it out
// (bridges of light grow, characters cheer). On the flat pages nothing is listening and these calls do nothing.
export const live = {
  scene: null,     // { start(total), answer(youOK, themOK), finish(won) } — used by the Master Duel
  answer: null,    // (correct, index, total) after each question of a test or review
  step: null,      // (name) — 'duel' | 'teach' | 'aptitude' | 'passed' | 'failed'
  tab: null,       // (view, tab) — switch between sections without leaving the world
  before: null,    // (item) just before each question is shown
};
export const clearLive = () => { live.scene = live.answer = live.step = live.tab = live.before = null; };
