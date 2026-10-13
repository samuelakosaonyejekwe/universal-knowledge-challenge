// Renders one question, collects a typed, tapped or spoken answer, and marks it against its key or rubric.
import { h, add, shuffle, norm, similar, parseNumber, clear } from '../core/util.js';
import { t, trInto, toEnglish, lang } from '../core/i18n.js';
import { speak, listen, canListen, canSpeakLang, stopListening } from '../core/speech.js';
import { sfx, playItemAudio } from '../core/audio.js';
import { profile } from '../core/store.js';

const PIECES = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
export function fenBoard(fen) {
  const board = h('div', { class: 'board', role: 'img', 'aria-label': t('Chess position') });
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      const n = parseInt(ch, 10);
      const cells = Number.isNaN(n) ? [ch] : Array(n).fill('');
      for (const c of cells) {
        const sq = h('div', { class: 'sq ' + ((r + f) % 2 ? 'd' : 'l') });
        if (c) sq.append(h('span', { class: c === c.toUpperCase() ? 'pc-w' : 'pc-b' }, PIECES[c.toUpperCase()]));
        if (r === 7) sq.append(h('span', { class: 'co' }, 'abcdefgh'[f]));
        if (f === 0) sq.append(h('span', { class: 'co', style: { top: '1px', bottom: 'auto', insetInlineStart: '2px', insetInlineEnd: 'auto' } }, String(8 - r)));
        board.append(sq); f++;
      }
    }
  });
  const turn = fen.split(' ')[1] === 'b' ? t('Black to move') : t('White to move');
  return h('div', null, board, h('div', { class: 'center small muted mb' }, turn));
}

// ---------- marking ----------
// A keyword counts when it appears as a word or the start of a word ("accelerat" matches "accelerating"),
// never as letters buried inside another word ("no" must not match "know"). Very short keywords must be whole words.
export function rubricHits(text, groups) {
  const s = ' ' + norm(text).replace(/[.\-/]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const has = (k) => {
    const key = norm(k).replace(/[.\-/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!key) return false;
    if (/[\u3040-\u30ff\u3400-\u9fff]/.test(key)) return s.includes(key); // Chinese and Japanese are written without spaces
    return key.length <= 3 ? s.includes(' ' + key + ' ') : s.includes(' ' + key);
  };
  return groups.map((g) => g.some(has));
}
export async function mark(item, given) {
  switch (item.t) {
    case 'mc': return { correct: given === item.a };
    case 'num': {
      const v = typeof given === 'number' ? given : parseNumber(given);
      const tol = item.tol > 0 ? item.tol : Math.max(1e-9, Math.abs(item.a) * 0.005);
      return { correct: Number.isFinite(v) && Math.abs(v - item.a) <= tol + 1e-12 };
    }
    case 'text': {
      // A pack translated by people carries rubric keywords in its own language; otherwise mark through English.
      const english = item.tl ? String(given || '') : await toEnglish(String(given || ''));
      const hits = rubricHits(english, item.rubric);
      const n = hits.filter(Boolean).length;
      return { correct: n >= item.min && norm(english).split(' ').length >= 3, hits, partial: n / item.rubric.length };
    }
    case 'order': return { correct: Array.isArray(given) && given.length === item.items.length && given.every((x, i) => x === item.items[i]) };
    case 'match': return { correct: Array.isArray(given) && given.length === item.pairs.length && given.every(([l, r]) => item.pairs.some((p) => p[0] === l && p[1] === r)) };
    case 'say': {
      const tries = [given].flat().filter(Boolean);
      const best = Math.max(0, ...tries.flatMap((g) => [similar(g, item.target), item.roman ? similar(g, item.roman) : 0]));
      return { correct: best >= (item.typed ? 0.86 : 0.7), partial: best };
    }
    default: return { correct: false };
  }
}
export function answerText(item) {
  switch (item.t) {
    case 'mc': return item.o[item.a];
    case 'num': return `${item.a}${item.unit ? ' ' + item.unit : ''}`;
    case 'text': return item.model;
    case 'order': return item.items.join(item.joiner ?? ' → ');
    case 'match': return item.pairs.map((p) => `${p[0]} — ${p[1]}`).join('; ');
    case 'say': return item.roman ? `${item.target} (${item.roman})` : item.target;
    default: return '';
  }
}

// How long a timed question allows, in seconds. Younger players and longer answers get more.
export function timeFor(item) {
  const band = profile?.band;
  const base = { mc: 40, num: 75, text: 150, order: 60, match: 70, say: 45 }[item.t] || 60;
  return Math.round((base + (item.d - 1) * 15) * (band === 'tiny' ? 1.8 : band === 'kid' ? 1.4 : 1));
}

// ---------- rendering ----------
// opts: { feedback, hints, timed, voice, context: { terms, mnemonic }, label }
// Resolves with { correct, given, ms, hints, timeout, partial } once the player has answered (and, when feedback
// is on, pressed Continue).
export function ask(item, opts = {}) {
  const { feedback = true, hints = 0, timed = 0, voice = false, context = {} } = opts;
  // Items generated on the device are already in the player's language; authored items are translated on the fly.
  const put = (node, text) => (item.local ? (node.textContent = text, node) : trInto(node, text));
  const started = performance.now();
  let given = null, locked = false, hintsUsed = 0, timerId = 0, resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  const el = h('div', { class: 'q-card' });
  const body = h('div');
  const actions = h('div', { class: 'row mt q-actions' });
  const fb = h('div', { class: 'mt', 'aria-live': 'polite' });
  const checkBtn = h('button', { class: 'btn', type: 'button', disabled: true }, t('Check answer'));
  const setReady = (ok) => { checkBtn.disabled = !ok || locked; };

  if (opts.label) el.append(h('div', { class: 'tiny muted bold mb' }, opts.label));
  if (timed) {
    const bar = h('i');
    el.append(h('div', { class: 'timer', role: 'timer', 'aria-label': t('Time left') }, bar));
    const end = Date.now() + timed * 1000;
    timerId = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      bar.style.width = (left / (timed * 10)) + '%';
      if (!left) submit(true);
    }, 200);
  }
  if (item.fen) el.append(fenBoard(item.fen));
  el.append(put(h('div', { class: 'q-text' }), item.q));
  if (item.figure) el.append(h('div', { html: item.figure }));
  if (item.au) el.append(h('button', { class: 'btn ghost sm mb', type: 'button', onClick: () => playItemAudio(item.au) }, '🔊 ', t('Play sound')));
  if (item.listen) {
    if (canSpeakLang(item.listen.lang)) {
      const play = () => speak(item.listen.text, item.listen.lang, { rate: 0.85 });
      el.append(h('button', { class: 'btn ghost sm mb', type: 'button', onClick: play }, '🔊 ', t('Listen')));
      setTimeout(play, 400);
    } else el.append(h('div', { class: 'note mb big', lang: item.listen.lang }, item.listen.text));
  }

  // --- answer widgets ---
  let widget;
  const micBtn = (onHeard, code = lang) => {
    if (!voice || !canListen()) return null;
    const b = h('button', { class: 'mic', type: 'button', title: t('Answer by speaking'), 'aria-label': t('Answer by speaking') }, '🎤');
    b.addEventListener('click', async () => {
      if (locked) return;
      b.classList.add('live');
      const heard = await listen({ code });
      b.classList.remove('live');
      if (heard) onHeard(heard);
    });
    return b;
  };

  if (item.t === 'mc') {
    const order = item.fixedOrder ? item.o.map((_, i) => i) : shuffle(item.o.map((_, i) => i));
    const buttons = order.map((oi, pos) => {
      const b = h('button', { class: 'opt', type: 'button', dataset: { i: oi } }, h('span', { class: 'key' }, 'ABCD'[pos]), item.svgOptions ? h('span', { html: item.o[oi] }) : put(h('span'), item.o[oi]));
      b.addEventListener('click', () => { if (locked) return; given = oi; buttons.forEach((x) => x.classList.toggle('sel', x === b)); setReady(true); sfx('tap'); });
      return b;
    });
    widget = h('div', { class: 'opts', role: 'group', style: item.svgOptions ? { gridTemplateColumns: 'repeat(2, 1fr)' } : null }, buttons);
    const mic = micBtn(({ alternatives, text }) => {
      const heard = [text, ...alternatives].map(norm);
      let best = -1, score = 0.55;
      buttons.forEach((b, pos) => {
        const label = norm(b.lastChild.textContent), letter = 'abcd'[pos];
        for (const s of heard) {
          const sc = s === letter || s === `option ${letter}` || s === String(pos + 1) ? 1 : Math.max(similar(s, label), label.length > 3 && s.includes(label) ? 0.9 : 0);
          if (sc > score) { score = sc; best = pos; }
        }
      });
      if (best >= 0) buttons[best].click();
    });
    if (mic) actions.append(mic);
    el._reveal = () => buttons.forEach((b) => { const i = +b.dataset.i; b.disabled = true; if (i === item.a) b.classList.add('right'); else if (i === given) b.classList.add('wrong'); });
    el._eliminate = (n) => { shuffle(buttons.filter((b) => +b.dataset.i !== item.a && !b.hidden)).slice(0, n).forEach((b) => { b.hidden = true; if (given === +b.dataset.i) { given = null; setReady(false); } }); };
  } else if (item.t === 'num') {
    const input = h('input', { class: 'input', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': t('Your answer'), style: { maxWidth: '220px' } });
    input.addEventListener('input', () => { given = input.value; setReady(input.value.trim() !== ''); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !checkBtn.disabled) submit(); });
    widget = h('div', { class: 'row' }, input, item.unit ? h('span', { class: 'bold' }, item.unit) : null);
    const mic = micBtn(({ text }) => { const v = parseNumber(text); if (Number.isFinite(v)) { input.value = String(v); given = input.value; setReady(true); } });
    if (mic) actions.append(mic);
    el._reveal = () => { input.disabled = true; };
  } else if (item.t === 'text') {
    const area = h('textarea', { class: 'input', rows: 4, 'aria-label': t('Your answer'), placeholder: t('Explain in your own words…') });
    area.addEventListener('input', () => { given = area.value; setReady(area.value.trim().length > 5); });
    widget = area;
    const mic = micBtn(({ text }) => { area.value = (area.value + ' ' + text).trim(); given = area.value; setReady(true); });
    if (mic) actions.append(mic);
    el._reveal = () => { area.disabled = true; };
  } else if (item.t === 'order') {
    const picked = [];
    const pool = shuffle(item.items);
    if (pool.every((x, i) => x === item.items[i])) pool.reverse();
    const answerRow = h('div', { class: 'tokens', 'aria-label': t('Your order') });
    const poolRow = h('div', { class: 'tokens mt', style: { borderStyle: 'solid' } });
    const draw = () => {
      clear(answerRow); clear(poolRow);
      picked.forEach((x, i) => answerRow.append(h('button', { class: 'tok', type: 'button', onClick: () => { if (locked) return; picked.splice(i, 1); draw(); } }, h('span', { class: 'tiny muted' }, `${i + 1}. `), put(h('span'), x))));
      pool.forEach((x) => poolRow.append(h('button', { class: 'tok' + (picked.includes(x) ? ' used' : ''), type: 'button', onClick: () => { if (locked) return; picked.push(x); sfx('tap'); draw(); } }, item.joiner === undefined ? put(h('span'), x) : x)));
      given = picked.slice(); setReady(picked.length === item.items.length);
    };
    draw();
    widget = h('div', null, h('div', { class: 'small muted mb' }, t('Tap the pieces in the right order.')), answerRow, poolRow);
    el._reveal = () => {};
  } else if (item.t === 'match') {
    const lefts = shuffle(item.pairs.map((p) => p[0])), rights = shuffle(item.pairs.map((p) => p[1]));
    const pairs = new Map();
    let sel = null;
    const box = h('div', { class: 'match-grid' });
    const draw = () => {
      clear(box);
      const rightUsed = new Map([...pairs].map(([l, r]) => [r, l]));
      lefts.forEach((l, i) => {
        const n = [...pairs.keys()].indexOf(l);
        box.append(h('button', { class: 'opt' + (sel === l ? ' sel' : '') + (pairs.has(l) ? ' paired' : ''), type: 'button', style: { gridColumn: 1, gridRow: i + 1 }, onClick: () => { if (locked) return; if (pairs.has(l)) pairs.delete(l); sel = sel === l ? null : l; draw(); } }, pairs.has(l) ? h('span', { class: 'key' }, n + 1) : null, put(h('span'), l)));
      });
      rights.forEach((r, i) => {
        const owner = rightUsed.get(r), n = owner ? [...pairs.keys()].indexOf(owner) : -1;
        box.append(h('button', { class: 'opt' + (owner ? ' paired' : ''), type: 'button', style: { gridColumn: 2, gridRow: i + 1 }, onClick: () => { if (locked) return; if (owner) pairs.delete(owner); if (sel) { pairs.set(sel, r); sel = null; sfx('tap'); } draw(); } }, owner ? h('span', { class: 'key' }, n + 1) : null, put(h('span'), r)));
      });
      given = [...pairs]; setReady(pairs.size === item.pairs.length);
    };
    draw();
    widget = h('div', null, h('div', { class: 'small muted mb' }, t('Tap an item on the left, then its partner on the right.')), box);
    el._reveal = () => {};
  } else if (item.t === 'say') {
    const heardBox = h('div', { class: 'note', hidden: true });
    const input = h('input', { class: 'input', type: 'text', lang: item.lang, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: t('…or type it here') });
    input.addEventListener('input', () => { given = input.value; item.typed = true; setReady(input.value.trim() !== ''); });
    const mic = (voice || true) && canListen() ? h('button', { class: 'mic', type: 'button', 'aria-label': t('Speak now') }, '🎤') : null;
    mic?.addEventListener('click', async () => {
      if (locked) return;
      mic.classList.add('live');
      const heard = await listen({ code: item.lang });
      mic.classList.remove('live');
      if (heard) { given = [heard.text, ...heard.alternatives]; item.typed = false; heardBox.hidden = false; heardBox.textContent = '👂 ' + heard.text; setReady(true); }
    });
    widget = h('div', { class: 'col' }, mic ? h('div', { class: 'row' }, mic, h('span', { class: 'small muted' }, t('Tap the microphone and speak.'))) : h('div', { class: 'small muted' }, t('Speaking is not available on this device, so type your answer.')), heardBox, input);
    el._reveal = () => { input.disabled = true; };
  }
  body.append(widget);

  // --- hints (practice only; never in a competitive attempt) ---
  if (hints > 0) {
    const hintBtn = h('button', { class: 'btn ghost sm', type: 'button' }, '💡 ', t('Hint'));
    hintBtn.addEventListener('click', () => {
      if (locked) return;
      hintsUsed++;
      if (profile) profile.stats.hints++;
      let text;
      if (hintsUsed === 1) text = context.mnemonic || (context.terms?.length ? context.terms.map((x) => `${x[0]}: ${x[1]}`).slice(0, 2).join(' · ') : item.why.split(/(?<=[.!?])\s/)[0]);
      else if (hintsUsed === 2 && item.t === 'mc' && item.o.length > 2) { el._eliminate(item.o.length - 2); text = t('Two choices are left. Which one fits the idea?'); }
      else text = item.why;
      fb.append(put(h('div', { class: 'note warn mb' }), text));
      if (hintsUsed >= hints) hintBtn.disabled = true;
    });
    actions.prepend(hintBtn);
  }
  checkBtn.addEventListener('click', () => submit());
  actions.append(h('span', { class: 'grow' }), checkBtn);
  el.append(body, actions, fb);

  async function submit(timeout = false) {
    if (locked) return;
    locked = true; clearInterval(timerId); stopListening();
    checkBtn.disabled = true;
    const res = timeout && given == null ? { correct: false } : await mark(item, given);
    // An answer that needed the full explanation as a hint does not count as independent mastery.
    const assisted = hintsUsed >= 3 || (hintsUsed >= 2 && item.t !== 'mc');
    const result = { correct: res.correct && !assisted, raw: res.correct, given, ms: Math.round(performance.now() - started), hints: hintsUsed, timeout, partial: res.partial };
    el._reveal?.();
    sfx(res.correct ? 'ok' : 'no');
    if (!feedback) {
      fb.append(h('div', { class: 'note ' + (res.correct ? 'ok' : 'bad') }, res.correct ? '✅ ' + t('Correct') : timeout ? '⏱️ ' + t('Time is up') : '❌ ' + t('Not this time')));
      setTimeout(() => resolveDone(result), 750);
      return;
    }
    const box = h('div', { class: 'note ' + (res.correct ? 'ok' : 'bad') });
    add(box, [h('div', { class: 'bold' }, res.correct ? '✅ ' + t('Correct!') : timeout ? '⏱️ ' + t('Time is up — here is how to think about it.') : '🔁 ' + t('Not yet — here is how to think about it.'))]);
    if (!res.correct || item.t === 'text') box.append(h('div', { class: 'small mt' }, h('b', null, t('A good answer') + ': '), item.t === 'say' || item.t === 'order' && item.joiner !== undefined ? answerText(item) : put(h('span'), answerText(item))));
    box.append(put(h('div', { class: 'small mt' }), item.why));
    const next = h('button', { class: 'btn mt', type: 'button', onClick: () => resolveDone(result) }, t('Continue'), ' →');
    fb.append(box, next);
    next.focus();
  }
  return { el, done };
}

// Runs a list of questions one after another inside `host`. Returns the per-item results.
export async function runSet(host, items, opts = {}) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const o = typeof opts === 'function' ? opts(item, i) : opts;
    const { el, done } = ask(item, { ...o, label: o.label ?? `${i + 1} / ${items.length}` });
    clear(host).append(el);
    el.scrollIntoView?.({ block: 'nearest' });
    const r = await done;
    results.push({ item, ...r });
    o.onAnswer?.(item, r, i);
  }
  return results;
}
