// The learner's dashboard: a summary, the detail behind it, and the personal evaluation.
import { h, dayNum, pct } from '../core/util.js';
import { t } from '../core/i18n.js';
import { profile, worldId, worldProgress } from '../core/store.js';
import { world, LEVELS } from '../data/worlds.js';
import { evaluate, DIMENSIONS, mastery } from '../engine/report.js';
import { can, BANDS } from '../core/safety.js';
import { dueReviews } from '../core/srs.js';
import { avatarEl } from '../core/avatar.js';
import { ENGLISH_NAMES } from '../core/i18n.js';
import { go, sectionTitle, progressBar, guardianGate } from './ui.js';

function radar(parts) {
  const keys = DIMENSIONS.map((d) => d[0]), n = keys.length, R = 70, cx = 110, cy = 100;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  let s = `<svg class="radar" viewBox="-40 -6 300 212" width="100%" style="max-width:360px" role="img" aria-label="${t('Mastery chart')}">`;
  for (const f of [0.25, 0.5, 0.75, 1]) s += `<polygon points="${keys.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="#dbe2f4"/>`;
  keys.forEach((_, i) => { const [x, y] = pt(i, R); s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#dbe2f4"/>`; });
  s += `<polygon points="${keys.map((k, i) => pt(i, R * (parts[k] ?? 0)).join(',')).join(' ')}" fill="rgba(79,91,213,.28)" stroke="#4f5bd5" stroke-width="2"/>`;
  keys.forEach((k, i) => { const [x, y] = pt(i, R + 16); s += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${t(DIMENSIONS[i][1])}${parts[k] == null ? '' : ' ' + Math.round(parts[k] * 100) + '%'}</text>`; });
  return h('div', { class: 'center', html: s + '</svg>' });
}

function activityChart() {
  const today = dayNum();
  const days = Array.from({ length: 14 }, (_, i) => profile.stats.days[today - 13 + i] || { q: 0, c: 0, ms: 0 });
  const max = Math.max(10, ...days.map((d) => d.ms / 60000));
  let s = `<svg viewBox="0 0 280 90" width="100%" role="img" aria-label="${t('Minutes played over the last 14 days')}">`;
  days.forEach((d, i) => { const m = d.ms / 60000, hgt = (m / max) * 64; s += `<rect x="${i * 20 + 3}" y="${72 - hgt}" width="14" height="${Math.max(hgt, 1)}" rx="3" fill="${i === 13 ? '#f5b700' : '#8a5cf6'}"><title>${Math.round(m)} min · ${d.c}/${d.q}</title></rect>`; });
  return h('div', { html: s + `<text x="0" y="86" font-size="9" fill="#5b6585">−13 d</text><text x="280" y="86" font-size="9" fill="#5b6585" text-anchor="end">${t('today')}</text></svg>` });
}

export function dashboardView(main, [tab = 'summary', arg]) {
  const p = profile;
  main.append(h('div', { class: 'hero row nowrap' }, avatarEl(p.avatar, { band: p.band, role: 'student', size: 'lg', cast: p.cast, emblem: Object.values(p.worlds).some((w) => w.completed.length) }),
    h('div', null, h('h1', null, p.name), h('div', { class: 'row' }, h('span', { class: 'pill' }, t(BANDS[p.band].account), ' ', t('account')), p.tampered ? h('span', { class: 'pill bad' }, t('Records were altered — competitions are off')) : null))));
  const tabs = [['summary', '📊', 'Summary'], ['detail', '🔍', 'Detail'], ['report', '🧭', 'My evaluation']];
  main.append(h('div', { class: 'tabs mt' }, tabs.map(([k, e, l]) => h('button', { 'aria-selected': String(k === tab), onClick: () => go('dashboard/' + k) }, e, ' ', t(l)))));
  const body = h('div'); main.append(body);
  const worlds = Object.entries(p.worlds).filter(([, w]) => w.level > 0);
  const totalQ = Object.values(p.stats.kinds).reduce((a, x) => a + x[1], 0), totalC = Object.values(p.stats.kinds).reduce((a, x) => a + x[0], 0);
  const stagesDone = worlds.reduce((a, [, w]) => a + Object.values(w.stages).filter((s) => s.done).length, 0);

  if (tab === 'summary') {
    const m = mastery(p.stats.kinds, p.stats.retention);
    body.append(h('div', { class: 'grid c4' },
      [['🌍', worlds.length, 'Worlds started'], ['⭐', stagesDone, 'Stages completed'], ['🏆', worlds.reduce((a, [, w]) => a + w.completed.length, 0), 'Levels mastered'], ['✅', totalQ ? pct(totalC, totalQ) + '%' : '–', 'Answers correct'], ['⏱️', Math.round(p.stats.ms / 60000), 'Minutes of learning'], ['🔁', dueReviews().length, 'Reviews ready']]
        .map(([e, v, l]) => h('div', { class: 'card flat center' }, h('div', { class: 'big' }, e), h('div', { class: 'huge' }, String(v)), h('div', { class: 'small muted' }, t(l))))),
      h('div', { class: 'grid c2 mt' }, h('div', { class: 'card' }, sectionTitle('🎯', t('Mastery')), radar(m.parts), h('p', { class: 'tiny muted center' }, t('Understanding 25% · Recall 20% · Application 25% · Reasoning 20% · Retention 10%'))),
        h('div', { class: 'card' }, sectionTitle('📅', t('Last 14 days')), activityChart(), h('p', { class: 'small muted' }, t('Short sessions on many days beat one long session.')))),
      h('div', { class: 'card mt' }, sectionTitle('🌍', t('My worlds')), worlds.length ? worlds.map(([k, w]) => { const wd = world(worldId(k)); return h('button', { class: 'row between', style: { width: '100%', background: 'none', border: 0, padding: '.4rem 0', cursor: 'pointer', textAlign: 'start' }, onClick: () => go('world/' + k) }, h('span', { class: 'grow' }, h('b', null, wd.em, ' ', t(wd.short), k.includes(':') ? ' · ' + t(ENGLISH_NAMES[k.split(':')[1]]) : ''), h('div', { class: 'tiny muted' }, t('Level {n}', { n: w.level }), ' · ', t(LEVELS[w.level - 1].name), ' · ', wd.creditEm, ' ', w.credits, ' ', t(wd.credit)), progressBar(worldProgress(k))), h('span', { class: 'pill' }, pct(worldProgress(k) * 60, 60) + '%')); }) : h('p', { class: 'muted' }, t('No worlds started yet.'))));
  }

  if (tab === 'detail') {
    body.append(h('div', { class: 'card' }, sectionTitle('🧮', t('By kind of thinking')), h('table', { class: 'tbl' }, h('tr', null, h('th', null, t('Skill')), h('th', null, t('Correct')), h('th', null, t('Answered')), h('th', null, '%')),
      DIMENSIONS.map(([k, name, about]) => { const pair = k === 'retention' ? p.stats.retention : p.stats.kinds[k]; return h('tr', null, h('td', null, h('b', null, t(name)), h('div', { class: 'tiny muted' }, t(about))), h('td', null, pair[0]), h('td', null, pair[1]), h('td', null, pair[1] ? pct(pair[0], pair[1]) : '–')); }))));
    for (const [k, w] of worlds) {
      const wd = world(worldId(k));
      const rows = Object.entries(w.stages).sort().map(([key, s]) => { const [lv, st] = key.split('.'); return h('tr', null, h('td', null, `${lv}.${st}`), h('td', null, s.done ? '⭐' : s.ready ? '⚔️' : '📖'), h('td', null, s.tries || 0), h('td', null, s.best || '–'), h('td', null, s.practice != null ? pct(s.practice, 1) + '%' : '–')); });
      body.append(h('details', { class: 'card mt' }, h('summary', { class: 'bold' }, wd.em, ' ', t(wd.short), ' — ', wd.creditEm, ' ', w.credits),
        h('p', { class: 'small' }, t('Levels mastered'), ': ', w.completed.sort().join(', ') || '–', ' · ', t('Finals not passed'), ': ', Object.entries(w.levelFails).filter(([, n]) => n).map(([l, n]) => `L${l}×${n}`).join(', ') || '–'),
        h('table', { class: 'tbl' }, h('tr', null, h('th', null, t('Stage')), h('th', null, t('Status')), h('th', null, t('Duels')), h('th', null, t('Best score')), h('th', null, t('Practice'))), rows)));
    }
    body.append(h('div', { class: 'card mt' }, sectionTitle('🧩', t('Aptitude tests')), p.aptitude.length ? h('table', { class: 'tbl' }, h('tr', null, h('th', null, t('Date')), h('th', null, t('World')), h('th', null, t('Level')), h('th', null, t('Score'))), p.aptitude.slice(-10).reverse().map((a) => h('tr', null, h('td', null, new Date(a.t).toLocaleDateString()), h('td', null, world(worldId(a.w)).em), h('td', null, a.level), h('td', null, `${a.score} / ${a.n}`)))) : h('p', { class: 'muted small' }, t('Taken at the end of each level.'))),
      h('div', { class: 'card mt' }, sectionTitle('📜', t('Recent activity')), h('table', { class: 'tbl' }, p.log.slice(-25).reverse().map((e) => h('tr', null, h('td', { class: 'tiny muted' }, new Date(e.t).toLocaleString()), h('td', null, e.type), h('td', { class: 'small' }, [e.w && world(worldId(e.w)).em, e.level && 'L' + e.level, e.stage && 'S' + e.stage, e.n != null && e.type === 'credits' ? '+' + e.n : null, e.won != null ? (e.won ? '✔' : '✖') : null, e.you != null ? `${e.you}–${e.them}` : null].filter(Boolean).join(' ')))))));
  }

  if (tab === 'report') {
    const wkey = arg || null;
    const ev = evaluate(wkey);
    const pick = h('div', { class: 'row mb' }, h('button', { class: 'chip', 'aria-pressed': String(!wkey), onClick: () => go('dashboard/report') }, t('All worlds')), worlds.map(([k]) => h('button', { class: 'chip', 'aria-pressed': String(k === wkey), onClick: () => go('dashboard/report/' + k) }, world(worldId(k)).em, ' ', t(world(worldId(k)).short))));
    body.append(pick);
    if (!ev.enough) { body.append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, '🌱'), h('p', null, t('Your evaluation grows from what you do. Answer at least 20 questions and it will appear here.')))); return; }
    body.append(h('div', { class: 'note mb' }, wkey && ev.complete ? t('Final evaluation: you have completed every level of this world.') : t('Provisional evaluation — it becomes final when you complete all six levels of a world.')));
    body.append(h('div', { class: 'grid c2' },
      h('div', { class: 'card' }, sectionTitle('🎯', t('Mastery')), radar(ev.mastery.parts), h('div', { class: 'center big bold' }, ev.mastery.overall != null ? Math.round(ev.mastery.overall * 100) + '%' : '–')),
      h('div', { class: 'card' }, sectionTitle('💪', t('Your strengths')), h('ul', null, ev.strengths.map((s) => h('li', null, h('b', null, t(DIMENSIONS.find((d) => d[0] === s.k)[1]) + ': '), t(s.text)))),
        sectionTitle('🌱', t('What to work on, and how')), ev.growth.length ? h('ul', null, ev.growth.map((s) => h('li', null, h('b', null, t(DIMENSIONS.find((d) => d[0] === s.k)[1]) + ': '), t(s.text)))) : h('p', { class: 'small' }, t('No weak area stands out. Keep stretching yourself with harder levels.')))),
      h('div', { class: 'card mt' }, sectionTitle('🧠', t('How you think')), ev.style.length ? h('ul', null, ev.style.map((s) => h('li', null, t(s)))) : h('p', { class: 'small muted' }, t('Play a little more — in both timed and untimed modes — and this section fills in.')),
        ev.learn ? h('p', { class: 'small' }, h('b', null, t('Learning compass') + ': '), ev.learn.order.map((m) => t({ read: 'Reading', listen: 'Listening', see: 'Pictures and demonstrations', do: 'Hands-on trying' }[m])).join(' → ')) : null),
      h('div', { class: 'card mt' }, sectionTitle('🧭', t('Your best fit')), ev.fit.length ? h('ul', null, ev.fit.map((f) => h('li', null, h('b', null, t(f.name)), ` — ${Math.round(f.score * 100)}% · `, t('paths that use these strengths'), ': ', t(f.paths)))) : h('p', { class: 'small muted' }, t('Explore a few worlds and your best fits will show.')),
        ev.tryNext.length ? h('p', { class: 'small' }, h('b', null, t('Worlds you might enjoy next') + ': '), ev.tryNext.map((x) => `${x.em} ${t(x.short)}`).join(' · ')) : null,
        h('p', { class: 'tiny muted' }, t('Suggestions, not limits: interests grow, and anyone can learn any of these subjects.'))));
    // Indicative reasoning range.
    const rc = h('div', { class: 'card mt' }, sectionTitle('🧩', t('Reasoning estimate')));
    if (!ev.range) rc.append(h('p', { class: 'small muted' }, t('Complete at least two level finals to see an estimate from your aptitude tests.')));
    else {
      const showNumber = () => rc.append(h('div', { class: 'center' }, h('div', { class: 'huge' }, `${ev.range.lo}–${ev.range.hi}`), h('div', { class: 'small muted' }, t('Indicative range on the standard scale (average 100, standard deviation 15) · from {n} puzzles', { n: ev.range.n }))));
      rc.append(h('p', null, h('b', null, t(ev.range.label)), ' — ', t('based on your pattern, sequence and logic puzzles.')));
      if (can('iq-number')) showNumber();
      else if (p.guardian) rc.append(h('button', { class: 'btn ghost sm', onClick: (e) => guardianGate(() => { e.target.remove(); showNumber(); }) }, '🔒 ', t('Guardian: show the number range')));
      rc.append(h('div', { class: 'note warn small mt' }, t('Please read this honestly: this is an estimate from game puzzles built in the style of established reasoning tests (such as the Wechsler scales, Stanford–Binet and Raven\'s matrices). It has not been standardised on a population, it is not an IQ test, and it is not a diagnosis. Scores change with practice, sleep, language and mood. Only a qualified psychologist using a standardised test can measure IQ.')));
    }
    body.append(rc, h('button', { class: 'btn ghost mt', onClick: () => print() }, '🖨️ ', t('Print or save as PDF')));
  }
}
