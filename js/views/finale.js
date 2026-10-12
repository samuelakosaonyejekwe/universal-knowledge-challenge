// The level final (championship duel → teach a beginner → aptitude test) and the entry/placement tests.
import { h, clear, confetti, toast } from '../core/util.js';
import { t, trInto, canMarkText, toEnglish } from '../core/i18n.js';
import { profile, wstate, save, worldId, recordAnswer, stageDone, logEvent } from '../core/store.js';
import { world, LEVELS, AWARD } from '../data/worlds.js';
import { cast } from '../core/names.js';
import { duelSet, tiebreakSet, teachTopics, placementSet, diagnosticSet, stageTitle } from '../engine/content.js';
import { ask, runSet, rubricHits } from '../engine/quiz.js';
import { runDuel, duelReview } from '../engine/duel.js';
import { buildAptitude, aptitudePass, ability } from '../engine/aptitude.js';
import { listen, canListen } from '../core/speech.js';
import { sfx } from '../core/audio.js';
import { avatarEl } from '../core/avatar.js';
import { go, talk, sectionTitle, award, loading, contentMissing, progressBar } from './ui.js';
import { rerender } from '../app.js';

export async function finaleView(main, [wkey, L]) {
  const level = +L, wid = worldId(wkey), w = world(wid), ws = wstate(wkey);
  if (ws.completed.includes(level)) return go('world/' + wkey);
  if (level !== ws.level || ![1, 2, 3, 4, 5, 6, 7, 8, 9].every((s) => stageDone(wkey, level, s))) return go('world/' + wkey);
  const run = ws.runs[level] || 0, who = cast(wkey, level, run);
  const fin = (ws.finale[level] ||= { duel: false, teach: false, apt: false });
  const textOK = await canMarkText();
  const qopts = { text: textOK && profile.band !== 'tiny' };
  const box = h('div');
  main.append(h('div', { class: 'hero' }, h('div', { class: 'tiny bold' }, t(w.short), ' · ', t('Level {n}', { n: level })), h('h1', null, '🏆 ', t('The level final')), h('p', { class: 'muted' }, who.master.name)), box);

  // Failing any of the three final tests means the level is repeated — with a new teacher, a new master and
  // new questions. Three failed finals on one level and the learner rebuilds from the level below.
  function levelFailed(why) {
    ws.levelFails[level] = (ws.levelFails[level] || 0) + 1;
    delete ws.finale[level];
    const fails = ws.levelFails[level];
    const reset = (lv) => { for (let s = 1; s <= 9; s++) delete ws.stages[`${lv}.${s}`]; ws.runs[lv] = (ws.runs[lv] || 0) + 1; };
    let msg;
    if (fails >= 3 && level > 1) {
      ws.levelFails[level] = 0;
      reset(level); reset(level - 1);
      ws.completed = ws.completed.filter((x) => x !== level - 1);
      ws.level = level - 1;
      msg = 'This was your third final on this level. That tells us the foundations need strengthening, so we will rebuild from the level below with a new teacher. Your credits stay with you, and you will come back stronger.';
    } else {
      reset(level);
      msg = 'This level needs another journey. You will meet it again with a different teacher, a different master and fresh questions. Your credits stay with you.';
    }
    logEvent('level-failed', { w: wkey, level, why, fails });
    save(true);
    box.append(h('div', { class: 'card mt' }, talk(who.teacher, msg), h('button', { class: 'btn mt', onClick: () => go('world/' + wkey) }, t('Back to the map'))));
  }

  function intro() {
    const fails = ws.levelFails[level] || 0;
    clear(box).append(h('div', { class: 'card mt' }, talk(who.master, 'You made it through my nine stages. Now you face me properly — on everything.', { role: 'master', auto: true }),
      h('ol', null,
        h('li', { class: fin.duel ? 'muted' : '' }, fin.duel ? '✅ ' : '', h('b', null, t('Championship duel')), ' — ', t('20 questions across the whole level. Reach 50 points and beat the master.')),
        h('li', { class: fin.teach ? 'muted' : '' }, fin.teach ? '✅ ' : '', h('b', null, t('Teach a beginner')), ' — ', t('{name} knows nothing about this. Explain three ideas until they truly understand.', { name: who.layman.short })),
        h('li', null, h('b', null, t('Aptitude test')), ' — ', t('Patterns, sequences and logic. No revision needed.'))),
      fails ? h('div', { class: 'note warn small' }, t('Finals not passed on this level: {n} of 3', { n: fails })) : null,
      h('button', { class: 'btn gold mt', onClick: () => (fin.duel ? (fin.teach ? aptitude() : teach()) : duel()) }, '⚔️ ', fin.duel ? t('Continue the final') : t('Begin the final'))));
  }

  async function duel() {
    clear(box).append(loading());
    let items, tiebreak;
    try { [items, tiebreak] = await Promise.all([duelSet(wkey, level, 10, qopts), tiebreakSet(wkey, level, qopts)]); } catch { clear(box).append(contentMissing(rerender)); return; }
    const host = h('div', { class: 'mt' }); clear(box).append(host);
    const res = await runDuel(host, { wkey, level, items, tiebreak, master: who.master, timed: !profile.settings.untimed, voice: true });
    logEvent('championship', { w: wkey, level, won: res.won, you: res.you, them: res.them });
    if (res.won) {
      fin.duel = true; save(true);
      award(wkey, 'championship', AWARD.championship);
      if (res.perfect) setTimeout(() => award(wkey, 'perfect'), 1200);
      box.append(h('div', { class: 'card center mt' }, h('div', { style: { margin: '0 auto', width: 'fit-content' } }, avatarEl(profile.avatar, { band: profile.band, role: 'student', size: 'xl', emblem: true })),
        h('h2', null, '🏆 ', t('Champion! {you} to {them}', { you: res.you, them: res.them })), h('p', null, t('The arena fills with light and a golden emblem shines on your uniform.')),
        h('button', { class: 'btn gold', onClick: teach }, t('Now teach what you know'), ' →')));
    } else {
      box.append(h('div', { class: 'card mt' }, h('h3', null, t('What to strengthen')), duelReview(res.results, (lv, s) => stageTitle(wkey, lv, s))));
      levelFailed('duel');
    }
  }

  // The learner must pass on what they know: a beginner asks, listens, and keeps asking until they understand.
  async function teach() {
    clear(box).append(loading());
    const topics = await teachTopics(wkey, level, 3);
    const lay = who.layman;
    let total = 0, ti = 0;
    const meter = h('div');
    const host = h('div');
    clear(box).append(h('div', { class: 'card mt' }, sectionTitle('🧑‍🏫', t('Teach {name}', { name: lay.short })), h('div', { class: 'small muted' }, t('{name} understands so far', { name: lay.short })), meter), host);
    const drawMeter = () => clear(meter).append(progressBar((total + 0) / topics.length, 'gold'));
    drawMeter();
    const next = async () => {
      if (ti >= topics.length) return finish();
      const tp = topics[ti];
      let said = '', round = 0, covered = tp.points.map(() => false);
      const convo = h('div');
      const area = h('textarea', { class: 'input', rows: 4, placeholder: t('Speak or type your explanation…'), 'aria-label': t('Your explanation') });
      const mic = canListen() ? h('button', { class: 'mic', 'aria-label': t('Speak to {name}', { name: lay.short }) }, '🎤') : null;
      mic?.addEventListener('click', async () => { mic.classList.add('live'); const r = await listen({}); mic.classList.remove('live'); if (r) area.value = (area.value + ' ' + r.text).trim(); });
      const send = h('button', { class: 'btn' }, t('Explain'), ' →');
      convo.append(talk(lay, `I have never studied this. Can you teach me: ${tp.topic}?`, { role: 'layman', auto: true }));
      clear(host).append(h('div', { class: 'card mt' }, h('div', { class: 'tiny bold muted' }, `${ti + 1} / ${topics.length} · `, trInto(h('span'), tp.title)), convo, h('div', { class: 'row nowrap mt', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow' }, area), mic), h('div', { class: 'row mt' }, send)));
      send.addEventListener('click', async () => {
        const text = area.value.trim();
        if (text.split(/\s+/).length < 4) return toast(t('Say a little more — at least a full sentence.'));
        send.disabled = true;
        convo.append(talk({ name: profile.name, avatar: profile.avatar, role: 'student' }, text, { right: true, local: true }));
        area.value = ''; said += ' ' + text; round++;
        if (textOK) covered = rubricHits(await toEnglish(said), tp.points.map((p) => p.k));
        else {
          // Without a translator for this language the beginner asks each follow-up and the learner judges honestly.
          const i = covered.indexOf(false);
          if (i >= 0) covered[i] = await new Promise((res) => { const row = h('div', { class: 'row' }, h('span', { class: 'small' }, t('Did your explanation answer this?')), h('button', { class: 'btn ok sm', onClick: () => { row.remove(); res(true); } }, t('Yes')), h('button', { class: 'btn ghost sm', onClick: () => { row.remove(); res(false); } }, t('Not yet'))); convo.append(talk(lay, tp.points[i].ask, { role: 'layman' }), row); });
        }
        // Ask about a different missing point each round.
        const gaps = covered.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
        const missing = gaps.length ? gaps[(round - 1) % gaps.length] : -1;
        if (missing >= 0 && round < 3) {
          if (textOK) convo.append(talk(lay, `Hmm, I am starting to see… but ${tp.points[missing].ask.charAt(0).toLowerCase()}${tp.points[missing].ask.slice(1)}`, { role: 'layman', auto: true }));
          send.disabled = false; area.focus();
          return;
        }
        const score = covered.filter(Boolean).length / covered.length;
        total += score; ti++; drawMeter();
        recordAnswer(wkey, { k: 'concept', id: `${wkey}|${level}|${tp.stage}|t` }, score >= 0.7);
        convo.append(talk(lay, score >= 0.99 ? 'Ohh! Now I really get it. You explained that so clearly — thank you!' : score >= 0.6 ? 'I think I understand most of it now. Thank you for being patient with me.' : 'I am still a bit lost, but I can see you tried hard to help me.', { role: 'layman', auto: true }),
          h('details', { class: 'small' }, h('summary', null, t('See a model explanation')), trInto(h('p'), tp.model)),
          h('button', { class: 'btn mt', onClick: next }, ti < topics.length ? t('Next idea') : t('Finish'), ' →'));
        sfx(score >= 0.6 ? 'ok' : 'no');
      });
    };
    const finish = () => {
      const frac = total / topics.length;
      logEvent('teach', { w: wkey, level, score: frac });
      if (frac >= 0.7) {
        fin.teach = true; save(true); sfx('win');
        clear(host).append(h('div', { class: 'card mt center' }, h('div', { class: 'huge' }, '💡'), h('h2', null, t('{name} understands!', { name: lay.short })), h('p', null, t('Teaching someone else is the strongest proof that you understand.')), h('button', { class: 'btn gold', onClick: aptitude }, t('Last step: the aptitude test'), ' →')));
      } else { clear(host); levelFailed('teach'); }
    };
    next();
  }

  async function aptitude() {
    const items = buildAptitude(level, profile.band, `${profile.id}|${wkey}|${level}|${Date.now()}`);
    const host = h('div', { class: 'mt' });
    clear(box).append(h('div', { class: 'card mt' }, sectionTitle('🧩', t('Aptitude test')), h('p', { class: 'small' }, t('{n} puzzles: number patterns, picture patterns and logic. There is nothing to memorise — just look for the rule.', { n: items.length }))), host);
    const res = await runSet(host, items, { feedback: false, timed: 0 });
    const answers = res.map((r) => ({ b: r.item.b, correct: r.correct, fam: r.item.fam }));
    const right = answers.filter((a) => a.correct).length, frac = right / answers.length;
    profile.aptitude.push({ t: Date.now(), w: wkey, level, score: right, n: answers.length, theta: ability(answers), answers });
    if (profile.aptitude.length > 40) profile.aptitude.shift();
    for (const r of res) recordAnswer(wkey, { k: 'reason' }, r.correct);
    logEvent('aptitude', { w: wkey, level, score: right, n: answers.length });
    if (frac >= aptitudePass(profile.band)) {
      ws.completed.push(level); delete ws.finale[level]; ws.levelFails[level] = 0;
      const last = level === 6;
      if (last) ws.champion = true; else ws.level = level + 1;
      save(true); confetti(120); sfx('win');
      clear(host).append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, last ? '👑' : '🎉'), h('h2', null, last ? t('Grand Master of {world}!', { world: t(w.short) }) : t('Level {n} mastered!', { n: level })),
        h('p', null, t('Aptitude: {a} of {b}.', { a: right, b: answers.length }), ' ', last ? t('You have completed the whole world. Your full evaluation is ready.') : t('Level {n} — {name} — is now open, with a new teacher and a new master.', { n: level + 1, name: t(LEVELS[level].name) })),
        h('div', { class: 'row center' }, last ? h('button', { class: 'btn gold', onClick: () => go('dashboard/report/' + wkey) }, t('See my evaluation')) : h('button', { class: 'btn', onClick: () => go('world/' + wkey) }, t('Onward'), ' →'), h('button', { class: 'btn ghost', onClick: () => go('dashboard') }, t('My progress')))));
    } else {
      clear(host).append(h('div', { class: 'card' }, h('p', null, t('Aptitude: {a} of {b}.', { a: right, b: answers.length })), h('p', { class: 'small muted' }, t('These puzzles reward practice. The Thinking & Strategy and Chess & Reasoning worlds train exactly these skills.'))));
      levelFailed('aptitude');
    }
  }
  intro();
}

// ---------- entry tests ----------
export async function placementView(main, [wkey, target]) {
  const wid = worldId(wkey), w = world(wid), ws = wstate(wkey);
  const who = cast(wkey, 1);
  const box = h('div', { class: 'mt' });
  main.append(h('div', { class: 'hero' }, h('h1', null, '🔑 ', target === 'find' ? t('Find my level') : t('Entry test for Level {n}', { n: target })), h('p', { class: 'muted' }, t(w.name))), box);
  const place = (level) => {
    for (let l = 1; l < level; l++) if (!ws.completed.includes(l)) ws.completed.push(l);
    ws.level = level; ws.placed = true; save(true);
    logEvent('placed', { w: wkey, level });
    go('world/' + wkey);
  };
  const missing = () => clear(box).append(contentMissing(rerender));

  if (target === 'find') {
    // Short adaptive check: four questions per level; three right moves up a level.
    let level = 1;
    const step = async () => {
      let items;
      try { items = await diagnosticSet(wkey, level); } catch { return missing(); }
      const host = h('div');
      clear(box).append(h('div', { class: 'card mb' }, talk(who.teacher, level === 1 ? 'Let me see what you already know. Just do your best — this only helps me choose where we start.' : 'Nicely done. Let us try something a little harder.')), host);
      const res = await runSet(host, items, { feedback: false, timed: 0, label: `${t('Level {n}', { n: level })}` });
      const right = res.filter((r) => r.correct).length;
      if (right >= 3 && level < 5) { level++; return step(); }
      const start = right >= 3 ? level + 1 : level;
      clear(box).append(h('div', { class: 'card' }, talk(who.teacher, `I suggest we start at Level ${start}: ${LEVELS[start - 1].name}. You can always revisit earlier levels.`),
        h('div', { class: 'row mt' }, h('button', { class: 'btn', onClick: () => place(start) }, t('Start at Level {n}', { n: start })), start > 1 ? h('button', { class: 'btn ghost', onClick: () => place(1) }, t('I would rather start at Level 1')) : null)));
    };
    return step();
  }

  const level = +target;
  if (!(level >= 2 && level <= 6)) return go('world/' + wkey);
  const fails = ws.placeFails[level] || 0;
  if (fails >= 3) { box.append(h('div', { class: 'card' }, talk(who.teacher, `This entry test is closed for now. Let us build up from Level ${level - 1} — you will reach Level ${level} by mastering it.`), h('button', { class: 'btn mt', onClick: () => (ws.level ? go('world/' + wkey) : place(level - 1)) }, t('Continue')))); return; }
  let items;
  box.append(loading());
  try { items = await placementSet(wkey, level); } catch { return missing(); }
  const host = h('div');
  clear(box).append(h('div', { class: 'card mb' }, talk(who.teacher, `To join Level ${level} you need the essentials of the level below. ${items.length} questions, 70% to pass. The questions are different every time.`), fails ? h('div', { class: 'small muted' }, t('Entry tests not passed: {n} of 3', { n: fails })) : null), host);
  const res = await runSet(host, items, { feedback: false, timed: 0, onAnswer: (it, r) => recordAnswer(wkey, it, r.correct, { ms: r.ms }) });
  const right = res.filter((r) => r.correct).length, pass = right / items.length >= 0.7;
  logEvent('entry-test', { w: wkey, level, right, n: items.length, pass });
  if (pass) {
    sfx('win');
    clear(box).append(h('div', { class: 'card' }, h('h2', null, '✅ ', t('Passed: {a} of {b}', { a: right, b: items.length })), talk(who.teacher, `You are ready for Level ${level}. Would you like to learn here, or try for the next level up?`),
      h('div', { class: 'row mt' }, h('button', { class: 'btn', onClick: () => place(level) }, t('Play and learn on Level {n}', { n: level })),
        level < 6 ? h('button', { class: 'btn ghost', onClick: () => { for (let l = 1; l < level; l++) if (!ws.completed.includes(l)) ws.completed.push(l); if (ws.level < level) ws.level = level; save(true); go(`placement/${wkey}/${level + 1}`); } }, t('Try the entry test for Level {n}', { n: level + 1 })) : null)));
  } else {
    ws.placeFails[level] = fails + 1; save(true);
    const closed = ws.placeFails[level] >= 3;
    clear(box).append(h('div', { class: 'card' }, h('h2', null, t('Not yet: {a} of {b}', { a: right, b: items.length })),
      talk(who.teacher, closed ? `That was the third try, so we will start one level down, at Level ${level - 1}. That is the quickest way to get here properly.` : 'No harm done. Here is what to look at before another try.'),
      duelReview(res, (lv, s) => stageTitle(wkey, lv, s)),
      h('div', { class: 'row mt' }, closed ? h('button', { class: 'btn', onClick: () => (ws.level ? go('world/' + wkey) : place(level - 1)) }, t('Start at Level {n}', { n: level - 1 })) : h('button', { class: 'btn', onClick: rerender }, t('Try again with new questions')),
        h('button', { class: 'btn ghost', onClick: () => go('world/' + wkey) }, t('Back')))));
  }
}
