// One stage: Discover → Understand → Remember → Recall → Experiment → Apply → Explain, then the Master Duel
// and the College of Doctors. The teacher guides closely at first and steps back as the level goes on.
import { h, clear, toast, confetti, pick } from '../core/util.js';
import { t, trInto, canMarkText, toEnglish } from '../core/i18n.js';
import { profile, wstate, sstate, save, worldId, recordAnswer, stageDone, logEvent } from '../core/store.js';
import { world, STEPS, STAGE_REWARD, AWARD, CONTEXTS } from '../data/worlds.js';
import { cast } from '../core/names.js';
import { loadStage, practiceSet, duelSet, tiebreakSet, panelSet, stageTitle } from '../engine/content.js';
import { ask, runSet, rubricHits } from '../engine/quiz.js';
import { runDuel, duelReview } from '../engine/duel.js';
import { scheduleStage } from '../core/srs.js';
import { listen, canListen, speak } from '../core/speech.js';
import { sfx } from '../core/audio.js';
import { avatarEl } from '../core/avatar.js';
import { go, talk, me, sectionTitle, award, loading, contentMissing } from './ui.js';
import { labForStage, mountLab } from './labhost.js';
import { showTopic } from './world.js';
import { rerender, inPage, refreshNav } from '../app.js';

const LOCI = ['🚪 Door', '🪟 Window', '🛋️ Sofa', '📚 Bookshelf', '🕰️ Clock', '🪴 Plant', '🖼️ Picture', '💡 Lamp', '🪜 Stairs', '🧺 Basket'];

export async function stageView(main, [wkey, L, S]) {
  const level = +L, stage = +S, wid = worldId(wkey);
  const w = world(wid), ws = wstate(wkey);
  if (stage >= 10) return go(`finale/${wkey}/${level}`);
  const open = (level === ws.level || ws.completed.includes(level)) && (stage === 1 || stageDone(wkey, level, stage - 1) || ws.completed.includes(level));
  if (!open) return go('world/' + wkey);
  main.append(loading());
  let st;
  try { st = await loadStage(wkey, level, stage); } catch { clear(main).append(contentMissing(rerender)); return; }
  const run = ws.runs[level] || 0;
  const who = cast(wkey, level, run);
  const ss = sstate(wkey, level, stage);
  const textOK = await canMarkText();
  const qopts = { text: textOK && profile.band !== 'tiny' };
  let stopLab = null;

  // Hands-on learners meet the experiment before the explanation.
  const order = STEPS.map((s) => s[0]);
  if (profile.learn?.order[0] === 'do') { order.splice(order.indexOf('experiment'), 1); order.splice(1, 0, 'experiment'); }
  const meta = Object.fromEntries(STEPS.map((s) => [s[0], s]));
  let cur = ss.done ? 0 : Math.min(ss.step, order.length);

  clear(main).append(
    h('div', { class: 'row between' }, h('button', { class: 'btn ghost sm', onClick: () => go('world/' + wkey) }, '← ', t(w.short)), h('span', { class: 'pill' }, t('Level {n}', { n: level }), ' · ', t('Stage'), ' ', stage, ' / 9')),
    h('h1', { class: 'mt' }, st.icon, ' ', trInto(h('span'), st.title)));
  const bar = h('div', { class: 'tabs' });
  const box = h('div');
  // On wide screens a companion panel sits beside the lesson: the key words, the memory hook and quick links.
  // It steps aside whenever the learner is being tested, so it never gives answers away.
  const aside = h('aside', { class: 'stage-aside' },
    h('div', { class: 'card' }, h('div', { class: 'row nowrap' }, avatarEl({ seed: who.teacher.seed }, { band: profile.band, role: 'teacher', cast: profile.cast }), h('div', null, h('b', null, who.teacher.name), h('div', { class: 'tiny muted' }, t(who.teacher.title)))),
      h('div', { class: 'small mt' }, t('I am here whenever you need another explanation.'))),
    st.terms?.length ? h('div', { class: 'card' }, h('div', { class: 'bold mb' }, '🔑 ', t('Key words')), st.terms.map(([term, def]) => h('div', { class: 'term mb' }, h('b', null, st.lang ? term : trInto(h('span'), term)), h('div', { class: 'small' }, trInto(h('span'), def))))) : null,
    h('div', { class: 'card' }, h('div', { class: 'bold mb' }, '🧩 ', t('Memory hook')), trInto(h('div', { class: 'small' }), st.mnemonic)),
    st.trip ? h('div', { class: 'card' }, h('div', { class: 'bold mb' }, '🧳 ', t('Virtual trip')), trInto(h('div', { class: 'small mb' }), st.trip.prompt), h('button', { class: 'btn ghost sm', onClick: () => showTopic(st.trip.wiki, st.trip.prompt) }, t('Take a virtual trip'))) : null);
  main.append(bar, h('div', { class: 'stage-wide' }, box, aside));

  function drawBar() {
    clear(bar);
    order.forEach((k, i) => bar.append(h('button', { 'aria-selected': String(i === cur), disabled: !(ss.done || i <= ss.step), onClick: () => show(i) }, meta[k][1], ' ', t(meta[k][2]))));
    bar.append(h('button', { 'aria-selected': String(cur === order.length), disabled: !(ss.done || ss.step >= order.length), onClick: () => show(order.length) }, '⚔️ ', t('Master Duel')));
  }
  function reached(i) { if (i > ss.step) { ss.step = i; save(); } }
  function nextBtn(label = 'Next', enabled = true) {
    const b = h('button', { class: 'btn', disabled: !enabled, onClick: () => { sfx('step'); reached(cur + 1); show(cur + 1); } }, t(label), ' →');
    return b;
  }
  function show(i) {
    stopLab?.(); stopLab = null;
    cur = i; drawBar(); clear(box); scrollTo(0, 0); refreshNav();
    aside.hidden = !['understand', 'encode', 'experiment', 'apply'].includes(order[i]);
    if (i >= order.length) return duelGate();
    ({ discover, understand, encode, recall, experiment, apply, explain })[order[i]]();
  }

  // 1 — investigate before being told
  function discover() {
    const note = h('textarea', { class: 'input', rows: 3, placeholder: t('What do you think, and why?'), 'aria-label': t('Your prediction') });
    note.value = profile.notes[`pred|${wkey}|${level}|${stage}`] || '';
    const go2 = nextBtn('I have made my prediction', note.value.trim().length > 2);
    note.addEventListener('input', () => { go2.disabled = note.value.trim().length < 3; profile.notes[`pred|${wkey}|${level}|${stage}`] = note.value.slice(0, 400); save(); });
    box.append(h('div', { class: 'card' }, sectionTitle('🔎', t('Discover')), talk(who.teacher, st.hook, { auto: profile.learn?.order[0] === 'listen' }),
      h('p', { class: 'small muted' }, t('There is no wrong answer here. Scientists and scholars begin with a guess and then test it.')), note,
      h('div', { class: 'row mt' }, st.trip ? h('button', { class: 'btn ghost', onClick: () => showTopic(st.trip.wiki, st.trip.prompt) }, '🧳 ', t('Take a virtual trip')) : null, go2,
        h('button', { class: 'btn ghost sm', onClick: () => { reached(cur + 1); show(cur + 1); } }, t('I would rather just think about it')))));
  }

  // 2 — the teacher explains, with an example from the learner's own world
  function understand() {
    const card = h('div', { class: 'card' }, sectionTitle('💡', t('Understand')));
    st.explain.forEach((p, i) => card.append(talk(who.teacher, p, { auto: i === 0 && profile.learn?.order[0] === 'listen' })));
    const keys = Object.keys(st.analogies || {});
    if (keys.length) {
      const known = (profile.experience?.contexts || []).filter((k) => keys.includes(k));
      const ordered = [...known, ...keys.filter((k) => !known.includes(k))];
      let ai = (ss.tries + run) % ordered.length;
      if (known.length && ss.tries + run === 0) ai = 0;
      const an = h('div', { class: 'note mt' });
      const drawAn = () => { const k = ordered[ai % ordered.length]; const c = CONTEXTS.find((x) => x[0] === k); clear(an).append(h('div', { class: 'bold small' }, c[1], ' ', t('Think of it like this')), trInto(h('div'), st.analogies[k])); };
      drawAn();
      card.append(an, h('button', { class: 'btn ghost sm mt', onClick: () => { ai++; drawAn(); profile.stats.reexplain = (profile.stats.reexplain || 0) + 1; } }, '🔄 ', t('Explain it a different way')));
    }
    if (st.example) {
      let shown = 0;
      const ol = h('ol', { class: 'worked' });
      const ans = h('div', { class: 'note ok', hidden: true }, h('b', null, t('Answer') + ': '), trInto(h('span'), st.example.a));
      const more = h('button', { class: 'btn ghost sm', onClick: () => { if (shown < st.example.steps.length) ol.append(trInto(h('li'), st.example.steps[shown++])); if (shown >= st.example.steps.length) { ans.hidden = false; more.hidden = true; } } }, t('What would you do next? Show a step'));
      card.append(h('div', { class: 'card flat mt' }, h('div', { class: 'bold' }, '✏️ ', t('Worked example')), trInto(h('p'), st.example.q), ol, more, ans));
    }
    if (st.misc) card.append(h('div', { class: 'note warn mt' }, h('div', { class: 'bold small' }, '⚠️ ', t('A common mix-up')), trInto(h('div'), st.misc.wrong), h('div', { class: 'bold small mt' }, '✅ ', t('What is really going on')), trInto(h('div'), st.misc.right)));
    if (st.limits) card.append(h('div', { class: 'note mt small' }, h('b', null, 'ℹ️ ', t('Limits of this explanation') + ': '), trInto(h('span'), st.limits)));
    if (who.peers && (stage + level) % 3 === 0) card.append(h('div', { class: 'mt' }, h('div', { class: 'tiny muted bold' }, t('Your classmates today')), talk(who.peers[0], pick(['I mixed that up at first too. The example made it click for me.', 'Can we try the lab next? I want to see it happen.', 'I think I get it — but I want to test myself before the master asks.']), { role: 'peer' })));
    const nb = nextBtn();
    nb.addEventListener('click', () => { if (!ss.lesson) { ss.lesson = true; award(wkey, 'lesson'); } }, { capture: true });
    card.append(h('div', { class: 'row mt' }, nb));
    box.append(card);
  }

  // 3 — encode: memory hook, key terms, and a place in the memory palace
  function encode() {
    const card = h('div', { class: 'card' }, sectionTitle('🧩', t('Remember')), talk(who.teacher, st.mnemonic));
    card.append(h('div', { class: 'grid c3 mt' }, (st.terms || []).map(([term, def]) => { const f = h('button', { class: 'flip', onClick: () => f.classList.toggle('on') }, h('div', { class: 'in' }, h('div', { class: 'f' }, st.lang ? term : trInto(h('span'), term)), h('div', { class: 'b small' }, trInto(h('span'), def)))); return f; })));
    card.append(h('p', { class: 'small muted mt' }, t('Tap a card to turn it over. Try to say the meaning before you look.')));
    const pal = (profile.palace[wkey] ||= []);
    const mine = pal.find((x) => x.level === level && x.stage === stage);
    const cue = h('input', { class: 'input', placeholder: t('Your own funny picture or link for this idea'), maxlength: 120, value: mine?.cue || '' });
    let locus = mine?.locus ?? (stage - 1) % LOCI.length;
    const loci = h('div', { class: 'row' });
    const drawLoci = () => clear(loci).append(...LOCI.map((l, i) => h('button', { class: 'chip', 'aria-pressed': String(i === locus), onClick: () => { locus = i; drawLoci(); } }, l.split(' ')[0], ' ', t(l.split(' ').slice(1).join(' ')))));
    drawLoci();
    card.append(h('div', { class: 'card flat mt' }, h('div', { class: 'bold' }, '🏛️ ', t('Place it in your memory palace')), h('p', { class: 'small muted' }, t('Imagine a room you know. Put this idea on one object and make the picture silly — silly pictures stick.')), loci, h('div', { class: 'mt' }, cue),
      h('button', { class: 'btn ghost sm mt', onClick: () => { const rec = { level, stage, locus, cue: cue.value.trim(), title: st.title, at: Date.now() }; const i = pal.findIndex((x) => x.level === level && x.stage === stage); if (i >= 0) pal[i] = rec; else pal.push(rec); save(); toast('🏛️ ' + t('Saved to your memory palace')); } }, t('Save'))));
    card.append(h('div', { class: 'row mt' }, nextBtn()));
    box.append(card);
  }

  // 4 — retrieval practice without hints
  async function recall() {
    const host = h('div');
    box.append(h('div', { class: 'card mb' }, sectionTitle('🧠', t('Recall')), talk(who.teacher, 'Close the lesson in your mind. Answer from memory — no hints this time. Recalling is what makes knowledge last.', { local: false })), host);
    const items = await practiceSet(wkey, level, stage, 3, qopts);
    const res = await runSet(host, items, { feedback: true, hints: 0, voice: false, onAnswer: (it, r) => recordAnswer(wkey, it, r.correct, { ms: r.ms }) });
    const right = res.filter((r) => r.correct).length;
    clear(host).append(h('div', { class: 'card' }, talk(who.teacher, right >= 2 ? 'Good recall. Let us put it to work.' : 'That is fine — forgetting is part of learning. Look at the explanation once more, or carry on and we will practise it again.'),
      h('div', { class: 'row mt' }, right < 2 ? h('button', { class: 'btn ghost', onClick: () => show(order.indexOf('understand')) }, '↩ ', t('Read the explanation again')) : null, nextBtn())));
  }

  // 5 — experiment: a lab, virtual trip or studio
  async function experiment() {
    const lab = labForStage(wid, level, stage);
    const nb = nextBtn('Next', !!ss.lab);
    const card = h('div', { class: 'card mb' }, sectionTitle('🧪', t('Experiment')), talk(who.teacher, 'Now try it with your own hands. Predict what will happen first, then test it.'));
    box.append(card);
    const finish = () => { if (!ss.lab) { ss.lab = true; save(); } nb.disabled = false; };
    if (lab) {
      const m = mountLab(lab, { wkey, level, teacher: who.teacher, onComplete: finish });
      stopLab = m.stop;
      box.append(m.el);
    } else {
      // No lab for this stage yet: a hands-on sorting task from the stage instead.
      const items = (await loadStage(wkey, level, stage)).questions.filter((q) => q.t === 'order' || q.t === 'match').slice(0, 1);
      const host = h('div'); box.append(host);
      if (items.length) { await runSet(host, items, { feedback: true, hints: 2, context: st }); }
      finish();
    }
    const skip = h('button', { class: 'btn ghost sm', hidden: true, onClick: () => { finish(); nb.click(); } }, t('Continue without finishing the mission'));
    const timer = setTimeout(() => { skip.hidden = false; }, 40000);
    const prev = stopLab; stopLab = () => { clearTimeout(timer); prev?.(); };
    box.append(h('div', { class: 'row mt' }, nb, skip));
  }

  // 6 — apply: new problems; hints fade through the level (3, then 2, then 1)
  async function apply() {
    const hints = stage <= 3 ? 3 : stage <= 6 ? 2 : 1;
    const host = h('div');
    box.append(h('div', { class: 'card mb' }, sectionTitle('🛠️', t('Apply')), talk(who.teacher, stage <= 3 ? 'New problems now. Ask for a hint whenever you need one — I am right here.' : stage <= 6 ? 'You need me less already. Two hints at most on each problem.' : 'You are nearly ready for the master. One hint only — trust your reasoning.')), host);
    const items = await practiceSet(wkey, level, stage, 4, qopts);
    const res = await runSet(host, items, { feedback: true, hints, voice: true, context: st, onAnswer: (it, r) => {
      recordAnswer(wkey, it, r.correct, { ms: r.ms });
      if (r.correct && it.d === 3 && !r.hints && !ss.hard) { ss.hard = true; award(wkey, 'hard'); }
    } });
    const right = res.filter((r) => r.correct).length;
    ss.practice = Math.max(ss.practice || 0, right / items.length); save();
    clear(host).append(h('div', { class: 'card' }, talk(who.teacher, right >= 3 ? 'Strong work. You applied the idea to problems you had never seen.' : 'You are getting there. Each explanation you just read is a step forward. Practise once more if you like.'),
      h('div', { class: 'row mt' }, h('button', { class: 'btn ghost', onClick: () => show(cur) }, '🔁 ', t('Practise with new problems')), nextBtn())));
  }

  // 7 — explain it aloud or in writing (the microphone unlocks here because the teacher asks for it)
  function explain() {
    const tc = st.teach;
    const area = h('textarea', { class: 'input', rows: 5, placeholder: t('Explain in your own words…'), 'aria-label': t('Your explanation') });
    const out = h('div', { class: 'mt', 'aria-live': 'polite' });
    const mic = canListen() ? h('button', { class: 'mic', 'aria-label': t('Speak your explanation') }, '🎤') : null;
    mic?.addEventListener('click', async () => { mic.classList.add('live'); const r = await listen({ onInterim: (s) => { mic.title = s; } }); mic.classList.remove('live'); if (r) area.value = (area.value + ' ' + r.text).trim(); });
    const done = (ok) => { if (!ss.explained) { ss.explained = true; ss.ready = true; award(wkey, 'investigation'); logEvent('ready', { w: wkey, level, stage }); } save(); out.append(h('div', { class: 'row mt' }, nextBtn(ok ? 'I am ready for the master' : 'Go to the Master Duel'))); };
    const check = h('button', { class: 'btn', onClick: async () => {
      if (area.value.trim().split(/\s+/).length < 5) return toast(t('Say a little more — at least a full sentence.'));
      check.disabled = true; clear(out);
      if (!textOK) {
        // No translator for this language on this device: an honest self-check against the model explanation.
        out.append(h('div', { class: 'note' }, h('b', null, t('Compare your explanation with this one') + ': '), trInto(h('span'), tc.model)), h('p', { class: 'small mt' }, t('Did yours cover the same ideas?')));
        out.append(h('div', { class: 'row' }, h('button', { class: 'btn ok', onClick: () => { clear(out); done(true); } }, t('Yes, mostly')), h('button', { class: 'btn ghost', onClick: () => { check.disabled = false; clear(out); } }, t('Not yet — let me improve it'))));
        return;
      }
      const hits = rubricHits(await toEnglish(area.value), tc.points.map((p) => p.k));
      const n = hits.filter(Boolean).length, ok = n / hits.length >= 0.5;
      recordAnswer(wkey, { k: 'concept', id: `${wkey}|${level}|${stage}|t` }, ok);
      out.append(talk(who.teacher, ok ? 'You explained that clearly. I can hear that you understand it, not just remember it.' : 'A good start. You left out something important — let me ask you about it.'));
      const missing = tc.points.filter((_, i) => !hits[i]);
      if (missing.length) out.append(h('div', { class: 'note warn' }, h('b', null, t('To make it even better, also answer') + ': '), h('ul', null, missing.slice(0, 2).map((p) => trInto(h('li'), p.ask)))));
      out.append(h('details', { class: 'small mt' }, h('summary', null, t('See a model explanation')), trInto(h('p'), tc.model)));
      if (ok) done(true); else { check.disabled = false; out.append(h('div', { class: 'row mt' }, h('button', { class: 'btn ghost sm', onClick: () => done(false) }, t('Continue anyway'))));
      }
    } }, t('Check my explanation'));
    box.append(h('div', { class: 'card' }, sectionTitle('🗣️', t('Explain')), talk(who.teacher, `Your turn to speak. Explain to me: ${tc.topic}. Use an example if you can.`, { auto: true }),
      h('div', { class: 'row nowrap', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow' }, area), mic), h('div', { class: 'small muted' }, mic ? t('Tap the microphone to speak, or type.') : t('Type your explanation.')),
      h('div', { class: 'row mt' }, check), out));
  }

  // 8 — the Master Duel is offered only when every learning step is complete
  function duelGate() {
    const ready = ss.done || (ss.step >= order.length && ss.ready);
    const card = h('div', { class: 'card' });
    box.append(card);
    if (!ready) { card.append(talk(who.teacher, 'Finish every step with me first. The master only accepts challengers who are ready.'), h('button', { class: 'btn', onClick: () => show(Math.min(ss.step, order.length - 1)) }, t('Back to my lesson'))); return; }
    card.append(talk(who.teacher, ss.done ? 'You have already won this stage. You may duel again for practice.' : 'You have done everything I asked. When you feel ready, step into the arena. I believe in you.'),
      h('div', { class: 'row mt' },
        h('button', { class: 'btn gold', onClick: startDuel }, '⚔️ ', t('Challenge {name}', { name: who.master.short })),
        h('label', { class: 'row small' }, (() => { const c = h('input', { type: 'checkbox', checked: profile.settings.untimed }); c.addEventListener('change', () => { profile.settings.untimed = c.checked; save(); }); return c; })(), t('Untimed mode'))));
  }
  async function startDuel() {
    inDuel = true; refreshNav(); aside.hidden = true;
    clear(box).append(loading());
    const [items, tiebreak] = await Promise.all([duelSet(wkey, level, stage, qopts), tiebreakSet(wkey, level, qopts)]);
    const timed = !profile.settings.untimed;
    ss.tries++; save();
    const host = h('div'); clear(box).append(host);
    const res = await runDuel(host, { wkey, level, items, tiebreak, master: who.master, timed, voice: true });
    logEvent('duel', { w: wkey, level, stage, won: res.won, you: res.you, them: res.them, timed });
    const out = h('div', { class: 'mt' }); host.append(out);
    inDuel = false; refreshNav();
    if (res.won) {
      const first = !ss.wins;
      ss.wins++; ss.best = Math.max(ss.best, res.you);
      if (ss.tries > 1 && first) profile.stats.retriesWon++;
      save();
      out.append(h('div', { class: 'card center' }, h('div', { style: { margin: '0 auto', width: 'fit-content' } }, avatarEl(profile.avatar, { band: profile.band, role: 'student', size: 'xl', emblem: true })),
        h('h2', null, '🏅 ', t('Victory! {you} to {them}', { you: res.you, them: res.them })), h('p', null, t('The arena fills with light and a golden emblem shines on your uniform.')),
        res.tie ? h('p', { class: 'small' }, t('You won the sudden-death round on reasoning.')) : null));
      if (first) { award(wkey, 'stage', STAGE_REWARD[stage - 1]); if (res.perfect) setTimeout(() => award(wkey, 'perfect'), 1200); }
      else award(wkey, 'duel');
      out.append(h('details', { class: 'card mt' }, h('summary', { class: 'bold' }, t('Review the questions')), duelReview(res.results, (lv, s) => stageTitle(wkey, lv, s))));
      out.append(h('div', { class: 'row center mt' }, ss.done ? h('button', { class: 'btn', onClick: () => go('world/' + wkey) }, t('Back to the map')) : h('button', { class: 'btn gold', onClick: panel }, '🩺 ', t('Face the College of Doctors'))));
    } else {
      // Constructive feedback: what went wrong, which ideas to strengthen, what to practise — then a fresh attempt.
      const weak = [...new Set(res.results.filter((r) => !r.correct).map((r) => r.item.stage))].filter((s) => s);
      out.append(h('div', { class: 'card' }, talk(who.teacher, res.you < 50 ? `You scored ${res.you}. You need at least 50 and more than the master. Nobody is out of this game — let us look at each miss together.` : `So close: ${res.you} to ${res.them}. You reached 50 but the master edged ahead. A little more practice will do it.`),
        duelReview(res.results, (lv, s) => stageTitle(wkey, lv, s)),
        h('div', { class: 'note mt' }, h('b', null, '🎯 ', t('Recommended practice')), h('ul', null,
          weak.includes(stage) ? h('li', null, t('Re-read the explanation and try a different analogy.')) : null,
          h('li', null, t('Do the Recall and Apply steps again — the questions will be new.')),
          h('li', null, t('Repeat the lab and change one thing at a time.')),
          weak.filter((s) => s !== stage).length ? h('li', null, t('Revisit earlier stages: {list}', { list: weak.filter((s) => s !== stage).join(', ') })) : null)),
        h('div', { class: 'row mt' }, h('button', { class: 'btn', onClick: () => show(order.indexOf('understand')) }, '📖 ', t('Study again with my teacher')), h('button', { class: 'btn ghost', onClick: () => show(order.indexOf('apply')) }, '🛠️ ', t('Practise')), h('button', { class: 'btn gold', onClick: startDuel }, '⚔️ ', t('Try again with new questions')))));
    }
  }

  // 9 — the College of Doctors drills nuanced understanding
  async function panel() {
    aside.hidden = true;
    clear(box).append(loading());
    ss.panelTries = ss.panelTries || 0;
    const items = await panelSet(wkey, level, stage, ss.panelTries, qopts);
    const host = h('div');
    clear(box).append(h('div', { class: 'card mb' }, sectionTitle('🩺', t('The College of Doctors')), h('div', { class: 'row' }, who.doctors.map((d) => h('div', { class: 'col center', style: { alignItems: 'center' } }, avatarEl({ seed: d.seed }, { band: profile.band, role: 'doctor', cast: profile.cast }), h('span', { class: 'tiny bold' }, d.name)))),
      h('p', { class: 'small mt' }, t('Three doctors each ask one searching question. Answer at least two well to pass. Take your time and explain your reasoning.'))), host);
    let right = 0;
    for (let i = 0; i < items.length; i++) {
      const { el, done } = ask(items[i], { feedback: true, voice: true, label: `${who.doctors[i].name} ${t('asks')}` });
      clear(host).append(el);
      const r = await done;
      if (r.correct) right++;
      recordAnswer(wkey, items[i], r.correct, { ms: r.ms });
    }
    ss.panelTries++;
    if (right >= 2) {
      ss.panel = true; ss.done = true; save(true);
      scheduleStage(wkey, level, stage);
      confetti(); sfx('win');
      clear(host).append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, '🎓'), h('h2', null, t('Stage complete!')), talk(who.doctors[0], 'The College is satisfied. Your understanding runs deeper than the answers.', { role: 'doctor' }),
        h('p', { class: 'small muted' }, t('This stage will come back for short reviews after about 1, 3, 7, 14 and 30 days to keep it in long-term memory.')),
        h('div', { class: 'row center' }, stage < 9 ? h('button', { class: 'btn', onClick: () => go(`stage/${wkey}/${level}/${stage + 1}`) }, t('Next stage'), ' →') : h('button', { class: 'btn gold', onClick: () => go(`finale/${wkey}/${level}`) }, '🏆 ', t('Go to the level final')), h('button', { class: 'btn ghost', onClick: () => go('world/' + wkey) }, t('Back to the map')))));
    } else {
      save();
      clear(host).append(h('div', { class: 'card' }, talk(who.doctors[1], 'Not yet. You know the answers, but we need to hear the reasoning behind them. Read our explanations, then face us again — the questions will change.', { role: 'doctor' }),
        h('div', { class: 'row mt' }, h('button', { class: 'btn', onClick: panel }, t('Face the College again')), h('button', { class: 'btn ghost', onClick: () => show(order.indexOf('understand')) }, t('Study first')))));
    }
  }

  // The top arrows step through the lesson first, then leave it.
  let inDuel = false;
  inPage.canBack = () => !inDuel && cur > 0;
  inPage.canForward = () => !inDuel && cur < order.length && (ss.done || cur < ss.step);
  inPage.back = () => { if (!inPage.canBack()) return false; show(cur - 1); return true; };
  inPage.forward = () => { if (!inPage.canForward()) return false; show(cur + 1); return true; };
  if (ss.done) box.append(h('div', { class: 'note ok mb' }, '⭐ ', t('You have completed this stage. Revisit any part of it whenever you like.')));
  // A learner who beat the master but has not yet passed the doctors returns straight to the doctors.
  if (!ss.done && ss.wins > 0 && !ss.panel) { drawBar(); panel(); } else show(cur);
  me;
  return () => { stopLab?.(); };
}
