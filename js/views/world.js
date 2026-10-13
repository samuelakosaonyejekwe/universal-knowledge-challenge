// A world: guided tour, choosing a level, the journey map, labs, the aspects atlas and the live knowledge hub.
import { h, clear, modal, toast } from '../core/util.js';
import { t, trInto, ENGLISH_NAMES, langInfo } from '../core/i18n.js';
import { profile, wstate, save, worldId, worldLang, stageDone, levelProgress } from '../core/store.js';
import { world, LEVELS, STAGE_REWARD, TARGET_LANGS } from '../data/worlds.js';
import { pretranslate, translatedPack } from '../engine/content.js';
import { lang as uiLang } from '../core/i18n.js';
import curriculum from '../data/curriculum.js';
import { cast } from '../core/names.js';
import { can } from '../core/safety.js';
import { channel, CHANNELS, wikiSummary } from '../core/live.js';
import { go, talk, sectionTitle, progressBar, creditPill, loading } from './ui.js';
import { labsFor, mountLab } from './labhost.js';
import { rerender } from '../app.js';
import { use3d, load3d, autoDispose } from '../gfx/use3d.js';

const stageIcon = (n) => ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'][n - 1];

export async function worldView(main, [wkey, tab = 'journey']) {
  const wid = worldId(wkey);
  const w = world(wid);
  if (!w) return go('home');
  if (wid === 10 && !worldLang(wkey)) return languageChooser(main);
  const ws = wstate(wkey);
  ws.last = Date.now(); save();
  const who = cast(wkey, Math.max(1, ws.level), ws.runs[Math.max(1, ws.level)] || 0);
  const langName = worldLang(wkey) ? ` · ${langInfo(worldLang(wkey)).flag} ${t(ENGLISH_NAMES[worldLang(wkey)])}` : '';

  main.append(h('div', { class: 'hero' },
    h('div', { class: 'scene', 'aria-hidden': 'true' }, [...w.scene].filter((c) => c.trim()).slice(0, 5).map((e, i) => h('span', { style: { left: (60 + (i % 3) * 13) + '%', top: (6 + i * 17) + '%', animationDelay: i * 0.8 + 's' } }, e))),
    h('div', { class: 'tiny bold' }, t('World {n} of 20', { n: wid })), h('h1', null, w.em, ' ', t(w.name), langName),
    h('div', { class: 'row' }, creditPill(wkey), h('span', { class: 'pill' }, '🏛️ ', t(w.feature)))));

  if (!ws.toured) return tour(main, wkey, w, who);
  if (!ws.level) return chooseLevel(main, wkey, w, who);

  const tabs = [['journey', '🗺️', 'Journey'], ['labs', '🧪', 'Labs & trips'], ['atlas', '📖', 'Atlas'], ['live', '📡', 'Live hub']];
  main.append(h('div', { class: 'tabs mt', role: 'tablist' }, tabs.map(([k, e, label]) => h('button', { role: 'tab', 'aria-selected': String(k === tab), onClick: () => go(`world/${wkey}/${k}`) }, e, ' ', t(label)))));
  const body = h('div');
  main.append(body);
  if (tab === 'labs') return labsTab(body, wkey, w, ws);
  if (tab === 'atlas') return atlasTab(body, wid);
  if (tab === 'live') return liveTab(body, wid);
  journeyTab(body, wkey, w, ws, who);
}

function languageChooser(main) {
  main.append(h('div', { class: 'hero' }, h('h1', null, '🗣️ ', t('World Languages')), h('p', { class: 'muted' }, t('Twelve languages, each with its own complete path, progress and masters. You can study several.'))),
    h('div', { class: 'grid c3 mt' }, TARGET_LANGS.map((code) => {
      const ws = profile.worlds['10:' + code];
      return h('button', { class: 'card', style: { cursor: 'pointer', textAlign: 'start' }, onClick: () => go('world/10:' + code) },
        h('div', { class: 'big bold' }, langInfo(code).flag, ' ', langInfo(code).name), h('div', { class: 'small muted' }, t(ENGLISH_NAMES[code])),
        ws?.level ? h('div', { class: 'small mt' }, t('Level {n}', { n: ws.level })) : null);
    })));
}

// ---------- the end-to-end tour every player takes on first entering a world ----------
function tour(main, wkey, w, who) {
  const wid = worldId(wkey);
  let i = 0;
  const box = h('div', { class: 'card mt' });
  main.append(box);
  const slides = [
    () => [talk(who.teacher, `Welcome to ${w.name}! I will be your first teacher here. Let me show you the whole journey before you take a single step.`, { auto: true }),
      h('p', null, t('This world has six levels. Each level has nine learning stages and ends with a championship against that level\'s master. A new teacher and a new master meet you on every level.'))],
    ...LEVELS.map((lv) => () => {
      const c = cast(wkey, lv.n);
      return [sectionTitle('🏔️', `${t('Level {n}', { n: lv.n })} — ${t(lv.name)}`), h('p', { class: 'muted' }, t(lv.about)),
        h('ol', { class: 'small' }, curriculum[wid - 1][lv.n - 1].slice(0, 9).map((s) => trInto(h('li'), s))),
        h('div', { class: 'row' }, h('span', { class: 'pill' }, '👩‍🏫 ', c.teacher.name), h('span', { class: 'pill gold' }, '⚔️ ', c.master.name)),
        h('p', { class: 'small mt' }, t('What is expected of you: finish each stage\'s lesson and lab, beat the master with at least 50 points, satisfy the College of Doctors, then teach a beginner and pass the reasoning test to move up.'))];
    }),
    () => [sectionTitle('🧭', t('How every stage works')),
      h('ol', null, ['Discover — investigate a question before anyone explains it.', 'Understand — your teacher explains with examples from life you know.', 'Remember — memory hooks and your own memory palace.', 'Recall — bring it back without looking.', 'Experiment — labs, virtual trips and studios.', 'Apply — new problems, with hints that fade as you grow.', 'Explain — say it in your own words, by voice or keyboard.', 'Duel the master, then face the College of Doctors.'].map((x) => h('li', null, t(x)))),
      h('p', { class: 'small' }, `${w.creditEm} `, t('You earn {credit} here: {ladder} for the nine stages and 1,500 for the championship. They are fictional, cannot be bought, and never lock a lesson.', { credit: t(w.credit), ladder: STAGE_REWARD.slice(0, 9).join(', ') }))],
    () => [talk(who.master, 'So you are the new student. Many arrive. Few leave as masters. I will be waiting.', { role: 'master', auto: true }),
      talk(who.teacher, 'Do not mind the master. With steady practice you will be ready. Shall we find your starting level?')],
  ];
  const draw = () => {
    clear(box).append(h('div', { class: 'steps' }, slides.map((_, k) => h('i', { class: k < i ? 'done' : k === i ? 'now' : '' }))), ...slides[i]().flat(),
      h('div', { class: 'row between mt' },
        h('button', { class: 'btn ghost', disabled: i === 0, onClick: () => { i--; draw(); } }, '← ', t('Back')),
        h('button', { class: 'btn', onClick: () => { if (i < slides.length - 1) { i++; draw(); } else { wstate(wkey).toured = true; save(true); rerender(); } } }, i < slides.length - 1 ? t('Next') : t('Choose my level'), ' →')));
  };
  draw();
}

// ---------- choosing where to start ----------
function chooseLevel(main, wkey, w, who) {
  const ws = wstate(wkey);
  const start = (level) => { ws.level = level; ws.placed = true; save(true); rerender(); };
  main.append(h('div', { class: 'card mt' }, talk(who.teacher, 'Where shall we begin? If you start at Level 1 there is no test. To start higher, I need to see that you know the level below.'),
    h('div', { class: 'grid c2 mt' },
      h('button', { class: 'btn block', onClick: () => start(1) }, '🌱 ', t('Start from the beginning (Level 1)')),
      h('button', { class: 'btn gold block', onClick: () => go(use3d() ? `explore/${wkey}/placement/find` : `placement/${wkey}/find`) }, '🧭 ', t('Find my level with a short check'))),
    h('h3', { class: 'mt' }, t('Or ask to join a level')),
    h('div', { class: 'levels' }, LEVELS.slice(1).map((lv) => {
      const fails = ws.placeFails[lv.n] || 0;
      return h('div', { class: 'level-card row between' }, h('div', null, h('b', null, t('Level {n}', { n: lv.n }), ' — ', t(lv.name)), h('div', { class: 'small muted' }, t(lv.about)), fails ? h('div', { class: 'tiny' }, t('Entry tests not passed: {n} of 3', { n: fails })) : null),
        h('button', { class: 'btn sm', disabled: fails >= 3, onClick: () => go(use3d() ? `explore/${wkey}/placement/${lv.n}` : `placement/${wkey}/${lv.n}`) }, fails >= 3 ? t('Closed for now') : t('Take the entry test')));
    }))));
}

// ---------- journey map ----------
function journeyTab(body, wkey, w, ws, who) {
  const wid = worldId(wkey);
  const next = (() => { for (let s = 1; s <= 9; s++) if (!stageDone(wkey, ws.level, s)) return s; return 10; })();
  body.append(talk(who.teacher, next <= 9 ? `Ready for stage ${next}: "${curriculum[wid - 1][ws.level - 1][next - 1]}"?` : `You have finished all nine stages. ${who.master.short} is waiting for the championship.`),
    // The 3D world is the main way to play a stage; the flat pages remain for devices and players that prefer them.
    h('div', { class: 'row mb' },
      next <= 9 && use3d() ? h('button', { class: 'btn gold', onClick: () => go(`explore/${wkey}/${next}`) }, '🎮 ', t('Play stage {n} in the 3D world', { n: next })) : null,
      h('button', { class: next <= 9 && use3d() ? 'btn ghost' : 'btn', onClick: () => go(next <= 9 ? `stage/${wkey}/${ws.level}/${next}` : use3d() ? `explore/${wkey}/final` : `finale/${wkey}/${ws.level}`) }, '▶ ', next > 9 ? t('Enter the level final') : use3d() ? t('Play it on flat pages') : t('Start stage {n}', { n: next }))));
  if (uiLang !== 'en' && !worldLang(wkey)) {
    // One tap prepares the whole level in the player's language and keeps it on the device for offline play.
    const status = h('span', { class: 'small muted' });
    body.append(h('div', { class: 'card flat mb row' }, h('button', { class: 'btn ghost sm', onClick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      const r = await pretranslate(wkey, ws.level, (d, n) => { status.textContent = `${d} / ${n}`; }).catch(() => null);
      b.disabled = false;
      status.textContent = !r ? t('Could not prepare this level right now.') : r.total === 0 ? '✅ ' + t('This level is already in your language.') : r.translated >= r.total * 0.9 ? '✅ ' + t('Level {n} is ready in your language, including offline.', { n: ws.level }) : t('{a} of {b} texts prepared. The rest will be translated when you are online again.', { a: r.translated, b: r.total });
    } }, '🌐 ', t('Prepare this level in my language')),
      profile.band === 'adult' ? h('button', { class: 'btn ghost sm', title: t('For translators and schools'), onClick: async () => { status.textContent = '…'; const pk = await translatedPack(wkey, ws.level); const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(pk, null, 1)], { type: 'application/json' })), download: `l${ws.level}.json` }); a.click(); status.textContent = t('Saved. A translator can now correct this file; place it in content/_tr/{lang}/w{w}/ to ship it.', { lang: uiLang, w: String(wid).padStart(2, '0') }); } }, '📝 ', t('Export this level for a translator')) : null, status));
  }
  if (use3d()) {
    // The level as a mountain to climb: tap a glowing stage to enter it.
    const peak = h('div', { class: 'card mb', style: { padding: '.4rem', background: '#10163a' } });
    body.append(peak);
    load3d().then(({ mountJourney }) => {
      const sc = mountJourney(peak, { world: w, level: ws.level, next, isDone: (s) => (s === 10 ? ws.completed.includes(ws.level) : stageDone(wkey, ws.level, s)), avatar: profile.avatar, band: profile.band, onPick: (s) => go(s <= 9 ? `explore/${wkey}/${s}` : `explore/${wkey}/final`) });
      autoDispose(peak, sc.dispose);
    }).catch(() => peak.remove());
  }
  const list = h('div', { class: 'levels' });
  for (const lv of LEVELS) {
    const done = ws.completed.includes(lv.n), current = lv.n === ws.level, open = done || current;
    const c = cast(wkey, lv.n, ws.runs[lv.n] || 0);
    const path = h('div', { class: 'path' });
    for (let s = 1; s <= 9; s++) {
      const isDone = stageDone(wkey, lv.n, s) || done, isNow = current && s === next;
      const allowed = open && (isDone || isNow);
      path.append(h('button', { class: 'node' + (isDone ? ' done' : isNow ? ' now' : ''), disabled: !allowed, title: curriculum[wid - 1][lv.n - 1][s - 1], 'aria-label': `${t('Stage')} ${s}: ${curriculum[wid - 1][lv.n - 1][s - 1]}`, onClick: () => go(`stage/${wkey}/${lv.n}/${s}`) }, isDone ? '⭐' : stageIcon(s), h('span', { class: 'n' }, `+${STAGE_REWARD[s - 1]}`)));
    }
    path.append(h('button', { class: 'node duel' + (done ? ' done' : current && next === 10 ? ' now' : ''), disabled: !(current && next === 10), title: c.master.name, 'aria-label': t('Level final'), onClick: () => go(`finale/${wkey}/${lv.n}`) }, done ? '🏆' : '⚔️', h('span', { class: 'n' }, '+1500')));
    list.append(h('div', { class: 'level-card' + (current ? ' current' : '') + (!open ? ' locked' : '') },
      h('div', { class: 'row between' }, h('div', null, h('b', null, t('Level {n}', { n: lv.n }), ' — ', t(lv.name)), h('div', { class: 'small muted' }, t(lv.about))),
        done ? h('span', { class: 'pill ok' }, '✔ ', t('Mastered')) : current ? h('span', { class: 'pill' }, t('You are here')) : lv.n > ws.level ? h('button', { class: 'btn ghost sm', disabled: (ws.placeFails[lv.n] || 0) >= 3, onClick: () => go(use3d() ? `explore/${wkey}/placement/${lv.n}` : `placement/${wkey}/${lv.n}`) }, '🔑 ', t('Entry test')) : h('span', { class: 'pill' }, t('Open to revisit'))),
      h('div', { class: 'row small mt' }, h('span', null, '👩‍🏫 ', c.teacher.name), h('span', null, '⚔️ ', c.master.name)),
      open ? progressBar(levelProgress(wkey, lv.n) / 10, 'ok') : null, path));
  }
  body.append(list);
  if (ws.completed.length === 6) body.append(h('div', { class: 'card tint mt center' }, h('div', { class: 'huge' }, '👑'), h('h2', null, t('World champion!')), h('p', null, t('You have mastered every level of this world. Your full evaluation is ready.')), h('button', { class: 'btn gold', onClick: () => go('dashboard/report/' + wkey) }, t('See my evaluation'))));
}

// ---------- labs, virtual trips, studios ----------
function labsTab(body, wkey, w, ws) {
  const labs = labsFor(w.id);
  if (!labs.length) { body.append(h('div', { class: 'card' }, t('Labs for this world are being prepared.'))); return; }
  body.append(h('p', { class: 'muted' }, t('Explore freely. Every lab says what its model leaves out. Your first completed mission in each lab earns credits.')),
    h('div', { class: 'grid c2' }, labs.map((l) => h('button', { class: 'card', style: { textAlign: 'start', cursor: 'pointer' }, onClick: () => go(`lab/${wkey}/${l.id}`) },
      h('div', { class: 'row between' }, h('span', { class: 'big bold' }, l.icon, ' ', l.title), profile.notes.labs?.[l.id] ? h('span', { class: 'pill ok' }, '✔') : null),
      h('div', { class: 'small' }, l.goal), h('div', { class: 'tiny muted mt' }, t({ lab: 'Virtual lab', tour: 'Virtual trip', studio: 'Creative studio' }[l.kind] || 'Virtual lab'), ' · ', t('Levels'), ' ', l.levels.join(', '))))));
}
export function labView(main, [wkey, id]) {
  const w = world(worldId(wkey));
  const meta = labsFor(w.id).find((l) => l.id === id);
  if (!meta) return go('world/' + wkey + '/labs');
  const ws = wstate(wkey);
  const level = Math.max(1, ws.level || meta.levels[0]);
  const lab = mountLab(meta, { wkey, level: meta.levels.includes(level) ? level : meta.levels[0], teacher: cast(wkey, level).teacher });
  main.append(h('button', { class: 'btn ghost sm mb', onClick: () => go(`world/${wkey}/labs`) }, '← ', t('All labs')), lab.el);
  return lab.stop;
}

// ---------- atlas: every aspect of the subject, each linked to a live encyclopedia entry ----------
let aspectsCache = null;
async function atlasTab(body, wid) {
  body.append(loading());
  try { aspectsCache ||= await (await fetch('js/data/aspects.json')).json(); } catch { clear(body).append(h('div', { class: 'card' }, t('The atlas is not on your device yet.'))); return; }
  const a = aspectsCache[wid - 1];
  clear(body).append(h('p', { class: 'muted' }, t('Everything this world covers. Tap any topic for a live encyclopedia entry in your language.')),
    a.activities ? trInto(h('div', { class: 'note mb' }), a.activities) : null,
    a.sections.map((s) => h('details', { class: 'card', open: a.sections.length <= 2 }, h('summary', { class: 'bold' }, trInto(h('span'), s.name), ` (${s.items.length})`),
      h('div', { class: 'row mt' }, s.items.map((it) => h('button', { class: 'chip', onClick: () => showTopic(it, '', world(wid).query.split(' ').slice(0, 2).join(' ')) }, trInto(h('span'), it)))))));
}
export async function showTopic(title, prompt = '', hint = '') {
  const box = h('div', null, h('h2', null, title), loading());
  const close = modal(box);
  const query = title.split(/[:(]/)[0].trim();
  const s = await wikiSummary(query, undefined, hint).catch(() => null);
  clear(box).append(h('h2', null, title), s && s.title !== title ? h('div', { class: 'small muted mb' }, t('Closest encyclopedia entry') + ': ', h('b', null, s.title)) : null, prompt ? trInto(h('div', { class: 'note mb' }), '🔎 ' + prompt) : null);
  if (!s) box.append(h('p', { class: 'muted' }, navigator.onLine ? t('No suitable entry was found for this topic.') : t('You are offline and this entry has not been saved yet.')));
  else {
    if (s.img) box.append(h('img', { src: s.img, alt: '', style: { borderRadius: '14px', maxHeight: '220px', display: 'block', margin: '0 auto .6rem' }, loading: 'lazy', referrerpolicy: 'no-referrer' }));
    box.append(h('p', { lang: s.lang }, s.text), h('p', { class: 'tiny muted' }, t('Source'), ': ', s.source, s.offline ? ' · ' + t('saved copy') : ''));
    if (s.url && can('links')) box.append(h('a', { class: 'btn ghost sm', href: s.url, target: '_blank', rel: 'noopener noreferrer' }, t('Read the full article'), ' ↗'));
  }
  box.append(h('button', { class: 'btn sm', style: { marginInlineStart: '.5rem' }, onClick: () => close() }, t('Close')));
}

// ---------- live hub ----------
async function liveTab(body, wid) {
  if (!can('live')) { body.append(h('div', { class: 'card' }, t('Live content is switched off in Settings.'))); return; }
  const allowed = CHANNELS.filter((c) => can(c[4]));
  let cur = allowed[0][0];
  const tabs = h('div', { class: 'tabs' }), list = h('div', { class: 'card' });
  const draw = async () => {
    clear(tabs).append(...allowed.map(([k, e, label]) => h('button', { 'aria-selected': String(k === cur), onClick: () => { cur = k; draw(); } }, e, ' ', t(label))));
    clear(list).append(loading());
    const meta = allowed.find((c) => c[0] === cur);
    const res = await channel(wid, cur).catch(() => ({ items: [], failed: true }));
    clear(list).append(h('div', { class: 'row between mb' }, h('span', { class: 'small muted' }, t(meta[3])), h('span', { class: 'pill ' + (res.offline ? '' : 'ok') }, res.offline ? '✈️ ' + t('saved copy') : res.at ? '🟢 ' + t('updated {time}', { time: new Date(res.at).toLocaleString() }) : '…')));
    if (!res.items.length) list.append(h('p', { class: 'muted' }, res.empty ? t('This world has no special live feed — see the other tabs.') : navigator.onLine ? t('Nothing suitable is available from this source right now.') : t('You are offline and nothing has been saved for this tab yet.')));
    for (const it of res.items) {
      const title = it.url && can('links') ? h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer', class: 'bold' }, it.title, ' ↗') : h('span', { class: 'bold' }, it.title);
      list.append(h('div', { class: 'live-item' }, it.img ? h('img', { src: it.img, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
        h('div', { class: 'grow' }, title, h('div', { class: 'small', style: it.pre ? { whiteSpace: 'pre-line' } : null }, String(it.text || '').slice(0, it.pre ? 900 : 420)), h('div', { class: 'tiny muted' }, [it.meta, it.source].filter(Boolean).join(' · ')))));
    }
  };
  body.append(h('p', { class: 'muted' }, t('Fresh material fetched by your own device from open, reputable sources, and saved for offline reading.')), tabs, list);
  draw();

}
