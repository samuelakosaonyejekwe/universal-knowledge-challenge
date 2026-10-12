// The Master Duel: student and master face the same questions. 5 points per correct answer, no negative marking.
// The student wins with at least 50 points AND more points than the master. A tie goes to sudden death on
// nuanced reasoning questions: whoever fails a question the other answers correctly loses.
import { h, clear, sleep, confetti } from '../core/util.js';
import { t, trInto } from '../core/i18n.js';
import { ask, timeFor, answerText } from './quiz.js';
import { sfx } from '../core/audio.js';
import { speak } from '../core/speech.js';
import { avatarEl } from '../core/avatar.js';
import { profile, recordAnswer } from '../core/store.js';
import { LEVELS } from '../data/worlds.js';

export const POINTS = 5, WIN_MIN = 50;

// The master is good but beatable; stronger on higher levels and weaker on the hardest questions.
function masterAnswers(level, item, rng = Math.random) {
  const skill = LEVELS[level - 1].master;
  return rng() < Math.min(0.95, Math.max(0.2, skill + (2 - item.d) * 0.1));
}

const BOASTS = [
  'Nobody at this level has ever out-thought me. Shall we begin?',
  'I hope your teacher prepared you. I do not go easy on anyone.',
  'Interesting. You think you understand this? Show me.',
  'I have studied this my whole life. Try to keep up.',
];
const GRACIOUS = ['Remarkable. You reasoned better than I did today. Well played.', 'I underestimated you. That was true understanding.', 'You have earned this. I will be ready for you next time.'];
const KIND = ['A good effort. Understanding takes practice — come back when you are ready.', 'You pushed me further than most. Study your mistakes and challenge me again.'];

// opts: { wkey, level, items, tiebreak, master, timed, voice, title }
// Resolves with { won, you, them, perfect, tie, results }.
export async function runDuel(host, opts) {
  const { wkey, level, items, master, timed, voice } = opts;
  const total = items.length;
  let you = 0, them = 0;
  const results = [];
  const arena = h('div', { class: 'arena' });
  const youScore = h('div', { class: 'score' }, '0'), themScore = h('div', { class: 'score' }, '0');
  const youDots = h('div', { class: 'dots' }), themDots = h('div', { class: 'dots' });
  for (let i = 0; i < total; i++) { youDots.append(h('i')); themDots.append(h('i')); }
  const stage = h('div');
  const line = h('div', { class: 'talk master' });
  arena.append(
    h('div', { class: 'versus' },
      h('div', { class: 'side' }, avatarEl(profile.avatar, { band: profile.band, role: 'student' }), h('div', null, profile.name), youScore, youDots),
      h('div', { class: 'vs' }, 'VS'),
      h('div', { class: 'side' }, avatarEl({ seed: master.seed }, { band: profile.band, role: 'master', cast: profile.cast }), h('div', null, master.short), themScore, themDots)),
    line, stage);
  clear(host).append(arena);

  const say = (text) => {
    clear(line).append(avatarEl({ seed: master.seed }, { band: profile.band, role: 'master', cast: profile.cast, size: 'sm' }), h('div', { class: 'bubble' }, h('span', { class: 'who' }, master.name), trInto(h('span'), text)));
    speak(t(text));
  };
  say(BOASTS[Math.floor(Math.random() * BOASTS.length)]);
  sfx('gong');
  await new Promise((r) => { stage.append(h('div', { class: 'center' }, h('p', { class: 'small' }, t('{n} questions · 5 points each · reach 50 and beat the master · no hints', { n: total })), h('button', { class: 'btn gold', onClick: r }, '⚔️ ', t('Begin the duel')))); });
  clear(line);

  for (let i = 0; i < total; i++) {
    const item = items[i];
    const { el, done } = ask(item, { feedback: false, timed: timed ? timeFor(item) : 0, voice, label: `${t('Question')} ${i + 1} / ${total}` });
    clear(stage).append(el);
    const r = await done;
    const m = masterAnswers(level, item);
    if (r.correct) you += POINTS;
    if (m) them += POINTS;
    youDots.children[i].className = r.correct ? 'y' : 'n';
    themDots.children[i].className = m ? 'y' : 'n';
    youScore.textContent = you; themScore.textContent = them;
    results.push({ item, ...r, master: m });
    recordAnswer(wkey, item, r.correct, { ms: r.ms, mode: timed ? 'timed' : 'untimed' });
  }

  let tie = false, won = you >= WIN_MIN && you > them;
  if (you >= WIN_MIN && you === them) {
    tie = true;
    won = await suddenDeath(stage, say, opts, results);
  }
  const perfect = results.filter((r) => !r.sudden).every((r) => r.correct);
  clear(stage);
  if (won) {
    arena.classList.add('lit'); sfx('win'); confetti();
    say(GRACIOUS[Math.floor(Math.random() * GRACIOUS.length)]);
    await sleep(900);
  } else {
    sfx('lose');
    say(KIND[Math.floor(Math.random() * KIND.length)]);
  }
  return { won, you, them, perfect, tie, results };
}

async function suddenDeath(stage, say, opts, results) {
  const pool = (opts.tiebreak || []).slice();
  say('A tie! Then reasoning decides it. One slip and it is over.');
  let round = 0;
  while (true) {
    const item = pool.length ? pool.shift() : opts.items[round % opts.items.length];
    round++;
    const { el, done } = ask(item, { feedback: false, timed: 0, voice: opts.voice, label: `${t('Sudden death')} · ${t('Round')} ${round}` });
    clear(stage).append(el);
    const r = await done;
    // The master tires: each round is a little harder for them, so the contest always ends.
    const m = Math.random() < Math.max(0.15, LEVELS[opts.level - 1].master - 0.08 * round - (item.d - 2) * 0.08);
    results.push({ item, ...r, master: m, sudden: true });
    recordAnswer(opts.wkey, item, r.correct, { ms: r.ms });
    if (r.correct && !m) return true;
    if (!r.correct && m) return false;
    stage.append(h('div', { class: 'note mt' }, r.correct ? t('Both correct — another question!') : t('Both missed — another question!')));
    await sleep(1100);
  }
}

// Corrective feedback after a duel: every miss explained, grouped by the idea that needs work.
export function duelReview(results, stageTitleOf) {
  const wrong = results.filter((r) => !r.correct);
  const box = h('div', { class: 'col' });
  if (!wrong.length) { box.append(h('div', { class: 'note ok' }, t('A flawless duel — every answer correct.'))); return box; }
  const byStage = new Map();
  for (const r of wrong) { const k = `${r.item.level}.${r.item.stage}`; if (!byStage.has(k)) byStage.set(k, []); byStage.get(k).push(r); }
  for (const [k, list] of byStage) {
    const [lv, st] = k.split('.').map(Number);
    const card = h('div', { class: 'card flat' }, h('h3', null, '📌 ', trInto(h('span'), stageTitleOf(lv, st))));
    for (const r of list) {
      card.append(h('div', { class: 'mb' },
        trInto(h('div', { class: 'bold small' }), r.item.q),
        h('div', { class: 'small' }, h('b', null, t('A good answer') + ': '), trInto(h('span'), answerText(r.item))),
        trInto(h('div', { class: 'small muted' }), r.item.why)));
    }
    box.append(card);
  }
  return box;
}
