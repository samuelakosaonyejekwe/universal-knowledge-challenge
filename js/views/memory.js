// Memory: spaced reviews, the Mistake Review Laboratory, the Memory Palace, and healthy learning habits.
import { h, clear, dayNum } from '../core/util.js';
import { live } from '../core/live3d.js';
import { use3d } from '../gfx/use3d.js';
import { t, trInto, canMarkText } from '../core/i18n.js';
import { profile, save, worldId, recordAnswer } from '../core/store.js';
import { world } from '../data/worlds.js';
import { dueReviews, upcomingReviews, recordReview, GAPS } from '../core/srs.js';
import { reviewSet, itemById, stageTitle } from '../engine/content.js';
import { runSet } from '../engine/quiz.js';
import { HABITS, BREAK_IDEAS } from '../core/safety.js';
import { rerender } from '../app.js';
import { go, sectionTitle, loading } from './ui.js';

const LOCI = ['🚪', '🪟', '🛋️', '📚', '🕰️', '🪴', '🖼️', '💡', '🪜', '🧺'];

export async function memoryView(main, [tab = 'reviews']) {
  main.append(h('div', { class: 'hero' }, h('h1', null, '🧠 ', t('Memory')), h('p', { class: 'muted' }, t('Recall it, space it out, link it to pictures — and what you learn stays.'))));
  const tabs = [['reviews', '🔁', 'Reviews'], ['mistakes', '🧪', 'Mistake Lab'], ['palace', '🏛️', 'Memory Palace'], ['habits', '🌱', 'Habits']];
  main.append(h('div', { class: 'tabs mt' }, tabs.map(([k, e, l]) => h('button', { 'aria-selected': String(k === tab), onClick: () => (live.tab ? live.tab('memory', k) : go('memory/' + k)) }, e, ' ', t(l)))));
  if (!live.tab && use3d()) { const recent = Object.entries(profile.worlds || {}).filter(([, v]) => v.level).sort((a, b) => (b[1].last || 0) - (a[1].last || 0))[0]; if (recent) main.append(h('div', { class: 'row mt' }, h('button', { class: 'btn gold', onClick: () => go(`explore/${recent[0]}/memory`) }, '🎮 ', t('Walk my memory palace in 3D')))); }
  const body = h('div'); main.append(body);
  const textOK = await canMarkText();
  const qopts = { text: textOK && profile.band !== 'tiny' };

  if (tab === 'reviews') {
    const due = dueReviews();
    body.append(h('div', { class: 'card' }, sectionTitle('🔁', t('Spaced reviews')),
      h('p', { class: 'small muted' }, t('Each finished stage returns after about {gaps} days. Good recall stretches the gap; a shaky one brings it back sooner. Forgetting never costs credits.', { gaps: GAPS.slice(0, 5).join(', ') })),
      h('div', { class: 'row' }, h('span', { class: 'pill gold' }, t('{n} ready now', { n: due.length })), h('span', { class: 'pill' }, t('{n} scheduled later', { n: upcomingReviews() })))));
    const host = h('div', { class: 'mt' }); body.append(host);
    if (!due.length) { host.append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, '🌤️'), h('p', null, t('Nothing to review right now. Finish a stage and it will appear here tomorrow.')))); return; }
    const list = h('div', { class: 'col' });
    for (const r of due.slice(0, 12)) {
      const w = world(worldId(r.wkey));
      list.append(h('div', { class: 'card flat row between' }, h('div', null, h('b', null, w.em, ' ', trInto(h('span'), stageTitle(r.wkey, r.level, r.stage))), h('div', { class: 'tiny muted' }, t(w.short), ' · ', t('Level {n}', { n: r.level }), ' · ', t('review {n}', { n: r.n + 1 }))),
        h('button', { class: 'btn sm', onClick: async () => {
          clear(host).append(loading());
          const items = await reviewSet(r.wkey, r.level, r.stage, 5, qopts).catch(() => []);
          if (!items.length) { clear(host).append(h('div', { class: 'card' }, t('This lesson pack is not on your device yet'))); return; }
          const res = await runSet(clear(host), items, { feedback: true, onAnswer: (it, a) => recordAnswer(r.wkey, it, a.correct, { retention: true, ms: a.ms }) });
          const score = res.filter((x) => x.correct).length / res.length;
          recordReview(r.key, score);
          clear(host).append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, score >= 0.8 ? '🌟' : score >= 0.5 ? '👍' : '🌱'), h('h3', null, t('{a} of {b} recalled', { a: res.filter((x) => x.correct).length, b: res.length })),
            h('p', { class: 'small' }, score >= 0.8 ? t('Strong memory — this will come back after a longer gap.') : score >= 0.5 ? t('Good. It will come back at the same gap.') : t('This one has faded a little. It will return tomorrow, and you can revisit the lesson any time.')),
            h('div', { class: 'row center' }, score < 0.5 ? h('button', { class: 'btn ghost', onClick: () => go(`stage/${r.wkey}/${r.level}/${r.stage}`) }, t('Revisit the lesson')) : null, h('button', { class: 'btn', onClick: () => rerender() }, t('More reviews')))));
        } }, t('Review'))));
    }
    host.append(list);
  }

  if (tab === 'mistakes') {
    const ids = Object.entries(profile.items).filter(([, r]) => r.w > 0).sort((a, b) => b[1].w - a[1].w).slice(0, 30).map(([id]) => id);
    body.append(h('div', { class: 'card' }, sectionTitle('🧪', t('Mistake Review Laboratory')), h('p', { class: 'small muted' }, t('Every miss is a clue. Here your recent misses come back until you get each one right — with the reasoning explained.')), h('span', { class: 'pill' }, t('{n} to work on', { n: ids.length }))));
    const host = h('div', { class: 'mt' }); body.append(host);
    if (!ids.length) { host.append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, '✨'), h('p', null, t('No open mistakes. When you miss a question it will wait for you here.')))); return; }
    host.append(h('button', { class: 'btn', onClick: async () => {
      clear(host).append(loading());
      const items = (await Promise.all(ids.slice(0, 8).map(itemById))).filter((q) => q && (qopts.text || q.t !== 'text'));
      if (!items.length) { clear(host).append(h('div', { class: 'card' }, t('This lesson pack is not on your device yet'))); return; }
      const res = await runSet(clear(host), items, { feedback: true, hints: 1, onAnswer: (it, a) => recordAnswer(it.id.split('|')[0], it, a.correct, { ms: a.ms }) });
      clear(host).append(h('div', { class: 'card center' }, h('h3', null, t('{a} of {b} fixed', { a: res.filter((x) => x.correct).length, b: res.length })), h('button', { class: 'btn', onClick: () => rerender() }, t('Continue'))));
    } }, '🔬 ', t('Work on my mistakes')));
  }

  if (tab === 'palace') {
    const keys = Object.keys(profile.palace).filter((k) => profile.palace[k].length);
    body.append(h('div', { class: 'card' }, sectionTitle('🏛️', t('Your Memory Palace')), h('p', { class: 'small muted' }, t('In each lesson you can hang an idea on an object in an imaginary room. Walk through the room in your mind and the ideas come back in order.'))));
    if (!keys.length) { body.append(h('div', { class: 'card center mt' }, h('div', { class: 'huge' }, '🚪'), h('p', null, t('Your palace is empty. Use the "Remember" step in any lesson to place your first idea.')))); return; }
    for (const k of keys) {
      const w = world(worldId(k));
      const grid = h('div', { class: 'palace' }, profile.palace[k].map((x) => {
        const cell = h('button', { class: 'locus full' }, h('div', { class: 'em' }, LOCI[x.locus % LOCI.length]), h('div', { class: 'small bold' }, x.cue || '…'), h('div', { class: 'tiny muted', hidden: true }, trInto(h('span'), x.title)));
        cell.addEventListener('click', () => { cell.lastChild.hidden = !cell.lastChild.hidden; });
        return cell;
      }));
      body.append(h('div', { class: 'card mt' }, h('h3', null, w.em, ' ', t(w.short)), h('p', { class: 'tiny muted' }, t('Look at your picture, say the idea aloud, then tap to check.')), grid));
    }
  }

  if (tab === 'habits') {
    const today = profile.stats.days[dayNum()] || { ms: 0 };
    body.append(h('div', { class: 'card' }, sectionTitle('🌱', t('Habits that help memory')), h('ul', null, HABITS.map((x) => h('li', null, t(x))))),
      h('div', { class: 'card mt' }, sectionTitle('🤸', t('Break ideas')), h('ul', null, BREAK_IDEAS.map((x) => h('li', null, t(x)))), h('p', { class: 'small muted' }, t('Today you have played for about {n} minutes.', { n: Math.round(today.ms / 60000) }))),
      h('div', { class: 'note mt small' }, t('Honest science: memory games make you better at what you practise. They are not proven to raise general intelligence, and confidence is not the same as accuracy — so always check.')));
    save;
  }
}
