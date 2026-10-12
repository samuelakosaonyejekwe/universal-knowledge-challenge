// Arena: practice duels, friend challenges by code, pass-and-play, tournaments, team missions and leaderboards.
// There is no chat anywhere. Players are known only by pseudonyms and can exchange preset friendly phrases.
import { h, clear, toast, rngFrom, shuffle, hashStr, pick } from '../core/util.js';
import { t, trInto } from '../core/i18n.js';
import { profile, device, save, worldId, wstate, recordAnswer, logEvent } from '../core/store.js';
import { world, WORLDS, LEVELS } from '../data/worlds.js';
import { can } from '../core/safety.js';
import { cast, nameMenu } from '../core/names.js';
import { loadLevel, duelSet, tiebreakSet } from '../engine/content.js';
import { runSet, ask, timeFor } from '../engine/quiz.js';
import { runDuel } from '../engine/duel.js';
import { go, talk, sectionTitle, award, loading } from './ui.js';
import { liveDuel } from './liveduel.js';

const SALT = 'ukc-fairplay-1';
const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const dec = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(s.trim().replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; } };
const sign = (o) => hashStr(SALT + JSON.stringify(o)).toString(36);
const PHRASES = ['Good game!', 'Well played!', 'That was close!', 'Great thinking!', 'Rematch?', 'Thank you for playing!'];

// The same seed gives every player the same questions.
export async function seededSet(wkey, level, seed, n = 8) {
  const pack = await loadLevel(wkey, level);
  const pool = pack.stages.flatMap((s) => s.questions.filter((q) => ['mc', 'num', 'order', 'match'].includes(q.t)));
  return shuffle(pool, rngFrom('seed' + seed)).slice(0, n);
}
const myWorlds = () => Object.entries(profile.worlds).filter(([, w]) => w.level > 0);
export function worldPicker(onPick) {
  const mine = myWorlds();
  if (!mine.length) return h('div', { class: 'note' }, t('Start a world first — then you can compete in it.'));
  return h('div', { class: 'row' }, mine.map(([k, w]) => h('button', { class: 'chip', onClick: () => onPick(k, w.level) }, world(worldId(k)).em, ' ', t(world(worldId(k)).short), k.includes(':') ? ' · ' + k.split(':')[1] : '', ' · ', t('Level {n}', { n: w.level }))));
}

export function arenaView(main, [tab = 'practice', arg]) {
  main.append(h('div', { class: 'hero' }, h('h1', null, '⚔️ ', t('Arena')), h('p', { class: 'muted' }, t('Compete or cooperate. Matches are made by level, never by anything you can buy.'))));
  const tabs = [['practice', '🥋', 'Practice duel'], ['team', '🤝', 'Team mission'], ['live', '⚡', 'Live duel'], ['friend', '🎟️', 'Friend challenge'], ['pass', '🔄', 'Pass and play'], ['cup', '🏟️', 'Tournaments'], ['board', '🏅', 'Leaderboard']];
  main.append(h('div', { class: 'tabs mt' }, tabs.map(([k, e, l]) => h('button', { 'aria-selected': String(k === tab), onClick: () => go('arena/' + k) }, e, ' ', t(l)))));
  const body = h('div'); main.append(body);
  const social = can('social');
  if (['friend', 'cup', 'live'].includes(tab) && !social) { body.append(h('div', { class: 'card' }, t('Challenge codes are switched off for this player. A guardian can switch them on in Settings.'))); return; }
  return ({ practice, team, friend, pass, cup, board, live: liveDuel })[tab]?.(body, arg);
}

// ---------- practice duel against a computer-controlled master ----------
function practice(body) {
  body.append(h('div', { class: 'card' }, sectionTitle('🥋', t('Practice duel')), h('p', { class: 'small muted' }, t('A standard duel against the master of your current level, on everything you have studied so far. Win for 100 credits.')),
    worldPicker(async (wkey, level) => {
      clear(body).append(loading());
      const done = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((s) => profile.worlds[wkey].stages[`${level}.${s}`]?.done).length;
      const stage = Math.max(1, Math.min(9, done || 1));
      const who = cast(wkey, level, profile.worlds[wkey].runs[level] || 0);
      const [items, tiebreak] = await Promise.all([duelSet(wkey, level, stage, { text: false }), tiebreakSet(wkey, level, { text: false })]).catch(() => [[], []]);
      if (!items.length) { clear(body).append(h('div', { class: 'card' }, t('This lesson pack is not on your device yet'))); return; }
      const host = h('div'); clear(body).append(host);
      const timed = !profile.settings.untimed;
      const res = await runDuel(host, { wkey, level, items, tiebreak, master: who.master, timed, voice: true });
      logEvent('practice-duel', { w: wkey, level, won: res.won, you: res.you, them: res.them, timed });
      if (res.won) { award(wkey, 'duel'); if (res.perfect) setTimeout(() => award(wkey, 'perfect'), 1200); }
      host.append(h('div', { class: 'card center mt' }, h('h2', null, res.won ? '🏅 ' + t('Victory! {you} to {them}', { you: res.you, them: res.them }) : t('{you} to {them} — the master takes this one', { you: res.you, them: res.them })), h('button', { class: 'btn', onClick: () => go('arena/practice/' + Date.now()) }, t('Again'))));
    })));
}

// ---------- cooperative mission with computer classmates ----------
function team(body) {
  body.append(h('div', { class: 'card' }, sectionTitle('🤝', t('Team mission')), h('p', { class: 'small muted' }, t('You and two classmates solve six problems together. They suggest answers — sometimes wrong. Listen, reason, and decide as a team. Five right completes the mission for 75 credits.')),
    worldPicker(async (wkey, level) => {
      clear(body).append(loading());
      const who = cast(wkey, level, 0);
      const items = (await seededSet(wkey, level, Date.now(), 12).catch(() => [])).filter((q) => q.t === 'mc').slice(0, 6);
      if (items.length < 4) { clear(body).append(h('div', { class: 'card' }, t('This lesson pack is not on your device yet'))); return; }
      const host = h('div'); clear(body).append(h('div', { class: 'card mb' }, h('div', { class: 'row' }, who.peers.slice(0, 2).map((p) => h('span', { class: 'pill' }, '🧑‍🎓 ', p.name))), h('p', { class: 'small mt' }, t('Your classmates will share what they think. Agree only if their reasoning convinces you.'))), host);
      let right = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i], peer = who.peers[i % 2];
        const peerRight = Math.random() < 0.62;
        const guess = peerRight ? it.o[it.a] : pick(it.o.filter((_, k) => k !== it.a));
        const hint = h('div', { class: 'talk' });
        const { el, done } = ask(it, { feedback: true, label: `${t('Team problem')} ${i + 1} / ${items.length}` });
        clear(host).append(talk(peer, pick(['I think it is', 'My guess is', 'I am fairly sure it is', 'Could it be']) + ` "${guess}". ` + pick(['What do you think?', 'Do you agree?', 'Can you check my thinking?']), { role: 'peer' }), el, hint);
        const r = await done;
        if (r.correct) right++;
        recordAnswer(wkey, it, r.correct, { ms: r.ms });
      }
      const ok = right >= Math.min(5, items.length - 1);
      if (ok) { profile.social.coop++; save(); award(wkey, 'coop'); }
      logEvent('coop', { w: wkey, level, right, n: items.length });
      clear(host).append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, ok ? '🎉' : '🌱'), h('h2', null, t('Team score: {a} of {b}', { a: right, b: items.length })), talk(who.peers[0], ok ? 'We did it together! Thanks for checking my answers.' : 'We nearly had it. Let us study a bit and try again — I learned from the ones we missed.', { role: 'peer' }), h('button', { class: 'btn', onClick: () => go('arena/team/' + Date.now()) }, t('Another mission'))));
    })));
}

// ---------- friend challenge: same questions by code, results compared by code ----------
function friend(body) {
  const out = h('div', { class: 'mt' });
  const codeIn = h('input', { class: 'input', placeholder: t('Paste a challenge or result code'), autocomplete: 'off' });
  body.append(h('div', { class: 'card' }, sectionTitle('🎟️', t('Friend challenge')), h('p', { class: 'small muted' }, t('Make a challenge, share its code with a friend or classmate, and you both get exactly the same questions. Then swap result codes to see who did best. No messages, no real names.')),
    h('h3', null, t('Make a challenge')), worldPicker((wkey, level) => {
      const c = { k: 'c', w: wkey, l: level, s: Math.random().toString(36).slice(2, 8), n: 8 };
      showCode(out, t('Share this challenge code'), enc(c), () => play(out, c));
    }),
    h('h3', { class: 'mt' }, t('Got a code?')), h('div', { class: 'row' }, h('div', { class: 'grow' }, codeIn), h('button', { class: 'btn', onClick: () => {
      const o = dec(codeIn.value);
      if (!o) return toast(t('That code does not look right.'));
      if (o.k === 'c') {
        const mine = profile.worlds[o.w]?.level || 0;
        if (o.l > mine + 1) out.replaceChildren(h('div', { class: 'note warn' }, t('This challenge is for Level {n}, well above your current level in that world. Fair matches pair players of similar level — you can still play it as a friendly.', { n: o.l })), h('button', { class: 'btn mt', onClick: () => play(out, o) }, t('Play as a friendly')));
        else play(out, o);
      } else if (o.k === 'r') compare(out, o);
    } }, t('Open')))), out);
}
function showCode(out, label, code, onPlay) {
  const box = h('textarea', { class: 'input', rows: 2, readonly: true, 'aria-label': label }, code);
  clear(out).append(h('div', { class: 'card' }, h('b', null, label), box, h('div', { class: 'row mt' },
    h('button', { class: 'btn ghost sm', onClick: async () => { try { await navigator.clipboard.writeText(code); toast(t('Copied')); } catch { box.select(); } } }, '📋 ', t('Copy')),
    navigator.share ? h('button', { class: 'btn ghost sm', onClick: () => navigator.share({ text: code }).catch(() => {}) }, '📤 ', t('Share')) : null,
    onPlay ? h('button', { class: 'btn', onClick: onPlay }, '▶ ', t('Play it now')) : null)));
}
async function play(out, c, cupRound = null) {
  clear(out).append(loading());
  const items = await seededSet(c.w, c.l, c.s + (cupRound ?? ''), c.n).catch(() => []);
  if (!items.length) { clear(out).append(h('div', { class: 'card' }, t('This lesson pack is not on your device yet'))); return null; }
  const timed = !profile.settings.untimed;
  const host = h('div'); clear(out).append(host);
  const res = await runSet(host, items, (it) => ({ feedback: false, timed: timed ? timeFor(it) : 0 }));
  const score = res.filter((r) => r.correct).length, ms = res.reduce((a, r) => a + r.ms, 0);
  const result = { k: 'r', c: enc(c), who: profile.name, sc: score, n: items.length, ms, tm: timed ? 1 : 0 };
  result.g = sign(result);
  profile.social.results.push({ ...result, at: Date.now(), mine: true });
  if (profile.social.results.length > 60) profile.social.results.shift();
  save(); logEvent('challenge', { w: c.w, level: c.l, score, n: items.length });
  if (cupRound != null) return result;
  showCode(out, t('You scored {a} of {b}. Send this result code back to your friend', { a: score, b: items.length }), enc(result));
  out.append(h('div', { class: 'card mt' }, h('b', null, t('Send a friendly word')), h('div', { class: 'row mt' }, PHRASES.map((p) => h('button', { class: 'chip', onClick: () => { navigator.clipboard?.writeText(t(p)).catch(() => {}); toast(t(p)); } }, t(p))))));
  return result;
}
function compare(out, theirs) {
  const { g, ...rest } = theirs;
  if (sign(rest) !== g) { clear(out).append(h('div', { class: 'note bad' }, t('This result code has been changed, so it cannot be accepted. Fair play matters.'))); return; }
  const mine = profile.social.results.filter((r) => r.mine && r.c === theirs.c).pop();
  const rows = [[theirs.who, theirs.sc, theirs.n, theirs.tm]];
  if (mine) rows.push([mine.who + ' (' + t('you') + ')', mine.sc, mine.n, mine.tm]);
  rows.sort((a, b) => b[1] - a[1]);
  clear(out).append(h('div', { class: 'card' }, h('h3', null, t('Results')), h('table', { class: 'tbl' }, h('tr', null, h('th', null, t('Player')), h('th', null, t('Score')), h('th', null, t('Mode'))), rows.map((r) => h('tr', null, h('td', null, r[0]), h('td', null, `${r[1]} / ${r[2]}`), h('td', null, r[3] ? t('Timed') : t('Untimed'))))),
    !mine ? h('button', { class: 'btn mt', onClick: () => play(out, dec(theirs.c)) }, t('Play the same challenge')) : h('p', { class: 'mt bold' }, rows[0][1] === rows[1]?.[1] ? t('A tie — well matched!') : t('{name} wins this one. Good game!', { name: rows[0][0] }))));
}

// ---------- pass and play: two players, one device ----------
function pass(body) {
  const out = h('div', { class: 'mt' });
  body.append(h('div', { class: 'card' }, sectionTitle('🔄', t('Pass and play')), h('p', { class: 'small muted' }, t('Two players, one device, the same questions. The second player looks away while the first answers.')),
    worldPicker(async (wkey, level) => {
      const guest = nameMenu('guest' + Date.now(), 1)[0];
      const c = { w: wkey, l: level, s: Math.random().toString(36).slice(2, 8), n: 6 };
      const items = await seededSet(c.w, c.l, c.s, c.n).catch(() => []);
      if (!items.length) { clear(out).append(h('div', { class: 'card' }, t('This lesson pack is not on your device yet'))); return; }
      const scores = [];
      for (const name of [profile.name, guest]) {
        await new Promise((r) => clear(out).append(h('div', { class: 'card center' }, h('h2', null, t('{name}, it is your turn', { name })), h('p', { class: 'muted' }, t('The other player looks away now.')), h('button', { class: 'btn', onClick: r }, t('Ready')))));
        const host = h('div'); clear(out).append(host);
        const res = await runSet(host, items, { feedback: false });
        scores.push(res.filter((x) => x.correct).length);
      }
      const [a, b] = scores;
      clear(out).append(h('div', { class: 'card center' }, h('h2', null, `${profile.name} ${a} — ${b} ${guest}`), h('p', { class: 'bold' }, a === b ? t('A tie — well matched!') : t('{name} wins this one. Good game!', { name: a > b ? profile.name : guest })),
        h('div', { class: 'row center' }, PHRASES.slice(0, 4).map((p) => h('span', { class: 'chip' }, t(p)))), h('button', { class: 'btn mt', onClick: () => go('arena/pass/' + Date.now()) }, t('Again'))));
    })), out);
}

// ---------- tournaments: school, regional, international — run by sharing codes ----------
function cup(body) {
  const out = h('div', { class: 'mt' });
  const codeIn = h('input', { class: 'input', placeholder: t('Paste a tournament code'), autocomplete: 'off' });
  const board = h('textarea', { class: 'input', rows: 4, placeholder: t('Organisers: paste players\' result codes here, one per line') });
  let tier = 'School';
  const tiers = h('div', { class: 'row' });
  const drawTiers = () => clear(tiers).append(...['School', 'Regional', 'International'].map((x) => h('button', { class: 'chip', 'aria-pressed': String(tier === x), onClick: () => { tier = x; drawTiers(); } }, t(x))));
  drawTiers();
  body.append(h('div', { class: 'card' }, sectionTitle('🏟️', t('Tournaments')), h('p', { class: 'small muted' }, t('A teacher, club or family creates a tournament code. Every player gets the same three rounds and sends back one result code. Only levels and scores decide the outcome — nothing can be bought.')),
    h('h3', null, t('Organise one')), tiers, h('div', { class: 'mt' }, worldPicker((wkey, level) => showCode(out, t('{tier} tournament code — share it with the players', { tier: t(tier) }), enc({ k: 't', w: wkey, l: level, s: Math.random().toString(36).slice(2, 8), n: 6, tier })))),
    h('h3', { class: 'mt' }, t('Play in one')), h('div', { class: 'row' }, h('div', { class: 'grow' }, codeIn), h('button', { class: 'btn', onClick: async () => {
      const c = dec(codeIn.value);
      if (c?.k !== 't') return toast(t('That code does not look right.'));
      let total = 0, ms = 0;
      for (let r = 1; r <= 3; r++) {
        await new Promise((res) => clear(out).append(h('div', { class: 'card center' }, h('h2', null, t('Round {n} of 3', { n: r })), h('button', { class: 'btn', onClick: res }, t('Start')))));
        const rr = await play(out, c, r);
        if (!rr) return;
        total += rr.sc; ms += rr.ms;
      }
      const result = { k: 'tr', c: enc(c), who: profile.name, sc: total, n: c.n * 3, ms, tm: profile.settings.untimed ? 0 : 1 };
      result.g = sign(result);
      showCode(out, t('Tournament finished: {a} of {b}. Send this result code to the organiser', { a: total, b: c.n * 3 }), enc(result));
    } }, t('Enter'))),
    h('h3', { class: 'mt' }, t('Scoreboard')), board, h('button', { class: 'btn ghost mt', onClick: () => {
      const rows = board.value.split(/\s+/).map(dec).filter((o) => o?.k === 'tr').filter((o) => { const { g, ...rest } = o; return sign(rest) === g; });
      if (!rows.length) return toast(t('No valid result codes found.'));
      const table = (list, title) => (list.length ? h('div', { class: 'card mt' }, h('h3', null, title), h('table', { class: 'tbl' }, h('tr', null, h('th', null, '#'), h('th', null, t('Player')), h('th', null, t('Score'))), list.sort((a, b) => b.sc - a.sc).map((r, i) => h('tr', null, h('td', null, i + 1), h('td', null, r.who), h('td', null, `${r.sc} / ${r.n}`))))) : null);
      clear(out).append(table(rows.filter((r) => r.tm), '⏱️ ' + t('Timed')), table(rows.filter((r) => !r.tm), '⏳ ' + t('Untimed')));
    } }, t('Build the scoreboard'))), out);
}

// ---------- leaderboard: pseudonyms only, timed and untimed kept apart ----------
function board(body) {
  if (!can('board')) { body.append(h('div', { class: 'card' }, t('Leaderboards are unavailable for this player.'))); return; }
  const wins = (timed) => profile.log.filter((e) => (e.type === 'duel' || e.type === 'practice-duel' || e.type === 'championship') && e.won && !!e.timed === timed).length;
  const credits = Object.values(profile.worlds).reduce((a, w) => a + w.credits, 0);
  const rows = Object.entries(device.profiles).map(([id, p]) => ({ name: p.name, me: id === profile.id }));
  body.append(h('div', { class: 'card' }, sectionTitle('🏅', t('Leaderboard')), h('p', { class: 'small muted' }, t('Only player names chosen from the game\'s list appear here — never real names, photos or locations. Timed and untimed play are ranked separately.')),
    h('div', { class: 'grid c3' }, h('div', { class: 'readout' }, h('b', null, String(wins(true))), h('span', null, '⏱️ ', t('Timed duel wins'))), h('div', { class: 'readout' }, h('b', null, String(wins(false))), h('span', null, '⏳ ', t('Untimed duel wins'))), h('div', { class: 'readout' }, h('b', null, String(credits)), h('span', null, t('Credits across all worlds'))), h('div', { class: 'readout' }, h('b', null, String(profile.social.coop)), h('span', null, '🤝 ', t('Team missions'))))),
    h('div', { class: 'card mt' }, h('h3', null, t('Players on this device')), h('table', { class: 'tbl' }, rows.map((r) => h('tr', null, h('td', null, r.name, r.me ? ' ⭐' : ''))))),
    h('div', { class: 'card mt' }, h('h3', null, t('Recent challenges')), profile.social.results.length ? h('table', { class: 'tbl' }, profile.social.results.slice(-8).reverse().map((r) => h('tr', null, h('td', null, new Date(r.at).toLocaleDateString()), h('td', null, `${r.sc} / ${r.n}`), h('td', null, r.tm ? t('Timed') : t('Untimed'))))) : h('p', { class: 'muted small' }, t('No challenges yet.'))));
  trInto; WORLDS; LEVELS; wstate;
}
