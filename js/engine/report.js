// Turns a player's recorded learning into mastery scores, strengths, things to improve, and a thinking profile.
import { profile, worldId } from '../core/store.js';
import { world, WORLDS } from '../data/worlds.js';
import { reasoningRange } from './aptitude.js';

const rate = (pair, fallback = null) => (pair && pair[1] >= 3 ? pair[0] / pair[1] : fallback);

// The mastery model from the design: understanding 25, recall 20, application 25, reasoning 20, retention 10.
export const WEIGHTS = { concept: 0.25, recall: 0.2, apply: 0.25, reason: 0.2, retention: 0.1 };
export const DIMENSIONS = [
  ['concept', 'Understanding', 'Explaining why and how things work'], ['recall', 'Recall', 'Bringing facts and terms back from memory'],
  ['apply', 'Application', 'Using ideas on new problems'], ['reason', 'Reasoning', 'Weighing evidence and arguments'],
  ['retention', 'Retention', 'Still knowing it days and weeks later'],
];

export function mastery(kinds, retention) {
  const parts = { concept: rate(kinds.concept), recall: rate(kinds.recall), apply: rate(kinds.apply), reason: rate(kinds.reason), retention: rate(retention) };
  let sum = 0, w = 0;
  for (const [k, v] of Object.entries(parts)) if (v != null) { sum += v * WEIGHTS[k]; w += WEIGHTS[k]; }
  return { parts, overall: w ? sum / w : null, evidence: Object.values(kinds).reduce((a, p) => a + p[1], 0) };
}

const ADVICE = {
  concept: 'Before answering, say out loud why the answer must be true. Use "Explain differently" in lessons and teach the idea to someone at home.',
  recall: 'Use the Memory tab: short recall rounds on several different days work better than one long session. Build a memory palace for key terms.',
  apply: 'Spend more time in the labs and on "Apply" problems. Change one thing at a time and predict the result before you test it.',
  reason: 'Slow down on "why" questions: list what you know, what is being claimed, and what would prove it wrong. The Thinking & Strategy world trains exactly this.',
  retention: 'Do your scheduled reviews when they come due. Each successful recall after a gap makes the memory last longer.',
};
const STRENGTH = {
  concept: 'You grasp why things work, not just what they are called.', recall: 'You bring back facts and terms reliably.',
  apply: 'You carry ideas into new situations well.', reason: 'You weigh evidence and spot weak arguments.', retention: 'What you learn stays with you over time.',
};

// Worlds that draw on similar strengths, used for "best fit" suggestions.
const KIN = {
  1: [9, 4, 6], 2: [11, 6, 3], 3: [4, 5, 1], 4: [1, 3, 9], 5: [3, 7, 1], 6: [1, 2, 18], 7: [8, 5, 12], 8: [16, 20, 7], 9: [1, 13, 12], 10: [16, 8, 14],
  11: [18, 2, 7], 12: [19, 9, 17], 13: [17, 9, 20], 14: [15, 16, 9], 15: [14, 16, 8], 16: [10, 8, 20], 17: [20, 13, 9], 18: [11, 2, 20], 19: [12, 8, 17], 20: [17, 16, 8],
};
const PATHS = {
  1: 'physicist, astronomer, data scientist', 2: 'chemist, materials scientist, pharmacist', 3: 'mechanical or manufacturing engineer, product designer', 4: 'aerospace engineer, pilot, mission planner',
  5: 'naval architect, offshore or ocean engineer', 6: 'nuclear or energy engineer, medical physicist', 7: 'geographer, urban planner, climate scientist', 8: 'historian, archaeologist, museum curator',
  9: 'mathematician, statistician, analyst', 10: 'translator, interpreter, diplomat, teacher', 11: 'biologist, ecologist, biotechnologist', 12: 'economist, entrepreneur, policy analyst',
  13: 'strategist, analyst, game designer', 14: 'musician, composer, sound engineer', 15: 'artist, sculptor, designer, conservator', 16: 'writer, editor, dramatist, storyteller',
  17: 'researcher, strategist, investigator', 18: 'doctor, nurse, public-health worker', 19: 'public servant, city planner, community leader', 20: 'philosopher, ethicist, lawyer, teacher',
};

export function evaluate(wkey = null) {
  const p = profile;
  const w = wkey ? p.worlds[wkey] : null;
  const kinds = w ? w.kinds : p.stats.kinds;
  const m = mastery(kinds, p.stats.retention);
  const scored = Object.entries(m.parts).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  const strengths = scored.filter(([, v]) => v >= 0.75).slice(0, 2).map(([k]) => ({ k, text: STRENGTH[k] }));
  const growth = scored.slice().reverse().filter(([, v]) => v < 0.75).slice(0, 2).map(([k]) => ({ k, text: ADVICE[k] }));
  if (!strengths.length && scored.length) strengths.push({ k: scored[0][0], text: STRENGTH[scored[0][0]] });

  // How the player thinks: pace, persistence, independence, checking.
  const style = [];
  const timed = p.stats.modes.timed, untimed = p.stats.modes.untimed;
  if (timed && untimed && timed[1] >= 10 && untimed[1] >= 10) {
    const dt = timed[0] / timed[1] - untimed[0] / untimed[1];
    style.push(dt < -0.1 ? 'You think most clearly without a clock. Use untimed mode to learn, then add time pressure gradually.' : dt > 0.05 ? 'A clock sharpens your focus — you do well under time pressure.' : 'Your accuracy holds steady with or without a clock.');
  }
  const answered = Object.values(p.stats.kinds).reduce((a, x) => a + x[1], 0);
  if (answered >= 20) {
    const hintRate = p.stats.hints / answered;
    style.push(hintRate < 0.05 ? 'You work things out independently and rarely reach for hints.' : hintRate > 0.3 ? 'You lean on hints quite often. Try committing to an answer first — struggling a little before the hint makes the learning stick.' : 'You use hints sensibly: after trying, not instead of trying.');
  }
  if (p.stats.retriesWon >= 2) style.push('You come back stronger after a setback — a retry is where much of your learning happens.');
  const c = rate(kinds.concept), r = rate(kinds.recall), a = rate(kinds.apply), re = rate(kinds.reason);
  if (c != null && r != null) style.push(c - r > 0.12 ? 'You are a "why" thinker: principles first, details second. Anchor the key facts with mnemonics.' : r - c > 0.12 ? 'You collect facts easily. Push further by asking what links them together.' : 'You balance knowing facts with understanding how they connect.');
  if (a != null && re != null && Math.abs(a - re) > 0.12) style.push(a > re ? 'You are a hands-on problem-solver: you learn by doing and testing.' : 'You are an analytical thinker: you like to examine an argument before acting on it.');

  // Best fit: where the evidence shows the strongest mastery, plus kindred worlds to try.
  const ranked = Object.entries(p.worlds).map(([k, ws]) => ({ k, m: mastery(ws.kinds, p.stats.retention) })).filter((x) => x.m.evidence >= 20 && x.m.overall != null).sort((x, y) => y.m.overall - x.m.overall);
  const fit = ranked.slice(0, 3).map((x) => ({ wkey: x.k, name: world(worldId(x.k)).short, score: x.m.overall, paths: PATHS[worldId(x.k)] }));
  const base = wkey ? worldId(wkey) : fit[0] ? worldId(fit[0].wkey) : null;
  const tryNext = base ? KIN[base].map((id) => WORLDS[id - 1]).filter((x) => !p.worlds[String(x.id)]?.completed.length) : [];

  return {
    mastery: m, strengths, growth, style, fit, tryNext,
    learn: p.learn, range: reasoningRange(p.aptitude, p.band),
    complete: w ? w.completed.length === 6 : false,
    enough: m.evidence >= 20,
  };
}
