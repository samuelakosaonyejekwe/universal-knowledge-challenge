// Spaced review: each completed stage comes back after growing gaps (about 1, 3, 7, 14 and 30 days).
// Gaps stretch after a good recall and shrink after a poor one. Forgetting never costs credits.
import { profile, save } from './store.js';
import { dayNum } from './util.js';

export const GAPS = [1, 3, 7, 14, 30, 60];
const key = (wkey, level, stage) => `${wkey}|${level}|${stage}`;

export function scheduleStage(wkey, level, stage) {
  const k = key(wkey, level, stage);
  if (!profile.reviews[k]) profile.reviews[k] = { n: 0, due: dayNum() + GAPS[0], last: dayNum() };
  save();
}
export function dueReviews(limit = 50) {
  const today = dayNum();
  return Object.entries(profile.reviews).filter(([, r]) => r.due <= today).sort((a, b) => a[1].due - b[1].due).slice(0, limit)
    .map(([k, r]) => { const [wkey, level, stage] = k.split('|'); return { key: k, wkey, level: +level, stage: +stage, ...r }; });
}
export const upcomingReviews = () => Object.values(profile.reviews).filter((r) => r.due > dayNum()).length;

// score: fraction correct in the review round.
export function recordReview(k, score) {
  const r = profile.reviews[k];
  if (!r) return;
  if (score >= 0.8) r.n = Math.min(r.n + 1, GAPS.length - 1);
  else if (score < 0.5) r.n = Math.max(0, r.n - 1);
  r.due = dayNum() + (score < 0.5 ? 1 : GAPS[r.n]);
  r.last = dayNum(); r.score = score;
  save();
}
