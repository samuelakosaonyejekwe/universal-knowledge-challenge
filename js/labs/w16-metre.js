import { h, button, choice, readout, predict } from '../core/labkit.js';

// William Shakespeare, Sonnet 18 (first printed 1609; public domain), in the usual modern spelling.
export const SONNET = [
  "Shall I compare thee to a summer's day?",
  'Thou art more lovely and more temperate:',
  'Rough winds do shake the darling buds of May,',
  "And summer's lease hath all too short a date;",
  'Sometime too hot the eye of heaven shines,',
  "And often is his gold complexion dimm'd;",
  'And every fair from fair sometime declines,',
  "By chance or nature's changing course untrimm'd;",
  'But thy eternal summer shall not fade,',
  "Nor lose possession of that fair thou ow'st;",
  "Nor shall death brag thou wander'st in his shade,",
  "When in eternal lines to time thou grow'st:",
  'So long as men can breathe or eyes can see,',
  'So long lives this, and this gives life to thee.',
];
export const SCHEME = 'ABABCDCDEFEFGG';
// Lines that scan as regular iambic pentameter, split into syllables ("·" joins syllables of one word).
export const SCANNED = [
  [0, "Shall I com·pare thee to a sum·mer's day?"],
  [3, "And sum·mer's lease hath all too short a date;"],
  [8, 'But thy e·ter·nal sum·mer shall not fade,'],
  [11, "When in e·ter·nal lines to time thou grow'st:"],
  [12, 'So long as men can breathe or eyes can see,'],
];
export const syllables = (line) => line.split(' ').flatMap((w) => w.split('·').map((s, i, all) => ({ s, joins: i < all.length - 1 })));

export default {
  id: 'w16-metre',
  world: 16,
  levels: [5, 6],
  kind: 'lab',
  icon: '🪶',
  title: 'Metre and Rhyme Lab',
  goal: 'Mark the five stressed beats in a line of iambic pentameter, then work out the rhyme scheme of a Shakespeare sonnet.',
  limits: 'Metre is a pattern, not a law: actors and readers bend it, and Shakespeare often varies it on purpose. The lines chosen for tapping are regular ones. Some rhymes that were good in the 1600s, such as "temperate" and "date", no longer sound exact, and the spelling here is modernised.',
  mount(root, api) {
    const t = api.t, hard = api.level >= 6;
    let ac = null, stressDone = false, rhymeDone = false, stressTries = 0, rhymeTries = 0, predErr = null, completed = false, letter = 'A';
    const timers = new Set();
    const [lineNo, scanned] = SCANNED[Math.floor(api.rng() * SCANNED.length)];
    const syl = syllables(scanned), marks = syl.map(() => false);
    const letters = SONNET.map((_, i) => (!hard && i < 4 ? SCHEME[i] : ''));

    function beat() { // da-DUM × 5 with soft and strong clicks
      if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); }
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + 0.05;
      for (let i = 0; i < 10; i++) {
        const o = ac.createOscillator(), g = ac.createGain(), s = t0 + i * 0.3, strong = i % 2 === 1;
        o.type = 'sine'; o.frequency.value = strong ? 330 : 220;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(strong ? 0.3 : 0.09, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + (strong ? 0.26 : 0.16));
        o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + 0.3);
        const id = setTimeout(() => { timers.delete(id); sylEls.forEach((el, k) => { el.style.outline = k === i ? '3px solid var(--gold)' : ''; }); }, 50 + i * 300);
        timers.add(id);
      }
      const id = setTimeout(() => { timers.delete(id); sylEls.forEach((el) => { el.style.outline = ''; }); }, 3100);
      timers.add(id);
    }

    // ---------- part 1: stresses ----------
    const stressMsg = h('div', { class: 'small', 'aria-live': 'polite' });
    const feetOut = readout(t('Stressed syllables marked'), '0 / 5');
    const sylEls = syl.map((x, i) => h('button', { type: 'button', 'aria-pressed': 'false', 'aria-label': `${t('Syllable')} ${i + 1}: ${x.s}`,
      style: { minWidth: '36px', minHeight: '46px', padding: '.2rem .35rem', borderRadius: '10px', border: '2px solid var(--line)', background: 'var(--card)', cursor: 'pointer', marginInlineEnd: x.joins ? '0' : '.35rem', marginBottom: '.3rem' },
      onClick: () => { marks[i] = !marks[i]; paint(); } }));
    function paint() {
      sylEls.forEach((el, i) => {
        el.setAttribute('aria-pressed', String(marks[i]));
        el.replaceChildren(h('div', { 'aria-hidden': 'true', style: { fontWeight: '900', color: marks[i] ? 'var(--pri)' : 'var(--muted)' } }, marks[i] ? '/' : '˘'),
          h('div', { style: { fontWeight: marks[i] ? '900' : '500' } }, syl[i].s + (syl[i].joins ? '-' : '')));
        el.style.background = marks[i] ? 'var(--soft)' : 'var(--card)';
      });
      feetOut.set(marks.filter(Boolean).length + ' / 5');
    }
    function checkStress() {
      stressTries++;
      const wrong = marks.map((m, i) => (m === (i % 2 === 1) ? null : i + 1)).filter(Boolean);
      if (wrong.length) {
        stressMsg.textContent = '🔁 ' + (marks.filter(Boolean).length !== 5 ? t('Pentameter means five beats: mark exactly five strong syllables.') + ' ' : '') + t('Say the line aloud like a heartbeat: da-DUM, da-DUM. Check syllable(s):') + ' ' + wrong.join(', ');
        return;
      }
      stressMsg.textContent = '✅ ' + t('Five iambs: 5 feet × 2 syllables = 10 syllables, with the stress on every second one.');
      api.say(t('An iamb is a weak syllable followed by a strong one, like a heartbeat. Five of them in a row make iambic pentameter, close to the rhythm of spoken English.'));
      stressDone = true; finish();
    }

    // ---------- part 2: rhyme scheme ----------
    const rhymeMsg = h('div', { class: 'small', 'aria-live': 'polite' });
    const poem = h('div', { class: 'lab-grid', style: { gap: '.2rem' } });
    function drawPoem(showMarks = false) {
      poem.replaceChildren(...SONNET.map((line, i) => {
        const cut = line.lastIndexOf(' '), bad = showMarks && letters[i] !== SCHEME[i];
        return h('button', { type: 'button', 'aria-label': `${t('Line')} ${i + 1}, ${t('rhyme letter')} ${letters[i] || t('none')}: ${line}`,
          style: { display: 'flex', gap: '.5rem', alignItems: 'baseline', textAlign: 'start', padding: '.3rem .45rem', borderRadius: '8px', cursor: 'pointer', fontSize: '.92rem',
            border: '1px solid ' + (bad ? 'var(--bad)' : 'var(--line)'), background: bad ? 'var(--bad-soft)' : 'var(--card)', marginTop: i === 4 || i === 8 || i === 12 ? '.5rem' : '0' },
          onClick: () => { letters[i] = letters[i] === letter ? '' : letter; drawPoem(); } },
        h('b', { style: { minWidth: '1.3rem', color: 'var(--pri)' } }, letters[i] || '·'),
        h('span', null, line.slice(0, cut + 1), h('b', null, line.slice(cut + 1))));
      }));
    }
    function checkRhyme() {
      if (letters.includes('')) { rhymeMsg.textContent = t('Give every line a letter first.'); return; }
      rhymeTries++;
      const wrong = letters.filter((l, i) => l !== SCHEME[i]).length;
      drawPoem(true);
      if (wrong) {
        rhymeMsg.textContent = `🔁 ${wrong} ${t('line(s) do not fit. The first line-ending is A; each new sound gets the next letter, and a line that rhymes with an earlier one reuses its letter.')}`;
        return;
      }
      rhymeMsg.textContent = '✅ ABAB CDCD EFEF GG — ' + t('three quatrains and a couplet: 3 × 4 + 2 = 14 lines, using 7 rhyme sounds.');
      api.say(t('This is the English, or Shakespearean, sonnet: three groups of four lines build the thought, and the final rhyming pair sums it up.'));
      rhymeDone = true; finish();
    }

    function finish() {
      if (completed || !stressDone || !rhymeDone) return;
      completed = true;
      const score = 1 - 0.1 * (stressTries - 1) - 0.1 * (rhymeTries - 1) - (predErr === 0 ? 0 : 0.05);
      api.complete(Math.max(0.4, score), t('Scanned a line of iambic pentameter and found the rhyme scheme ABAB CDCD EFEF GG of Sonnet 18.'));
    }

    paint(); drawPoem();
    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, '1 · ' + t('Tap the stressed syllables of this line.') + ` (${t('Sonnet 18, line')} ${lineNo + 1})`),
      predict({ question: t('Predict: iambic pentameter has 5 feet of 2 syllables. Syllables per line?'), truth: 10, tolerance: 0,
        onResult: (err) => { predErr = err; api.say(t('"Penta" means five and an iamb has two syllables, so 5 × 2 = 10. Count the buttons to test it.')); } }),
      h('div', { style: { display: 'flex', flexWrap: 'wrap' } }, sylEls),
      h('div', { class: 'lab-row' }, feetOut.el, button('🔊 ' + t('Hear the beat'), beat, 'btn sm ghost'), button('✔ ' + t('Check stresses'), checkStress)),
      stressMsg,
      h('div', { class: 'lab-goal', style: { marginTop: '.4rem' } }, '2 · ' + t('Find the rhyme scheme: choose a letter, then tap every line that ends with that sound.')),
      choice([...'ABCDEFG'].map((l) => [l, l]), 'A', (v) => { letter = v; }).el,
      poem,
      h('div', { class: 'small muted' }, '— William Shakespeare, ' + t('Sonnet 18') + ' (1609)'),
      h('div', { class: 'lab-row' }, button('✔ ' + t('Check rhyme scheme'), checkRhyme)), rhymeMsg));
    api.say(t('Poets measure lines in beats. Predict how many syllables the line has, mark its strong beats, then label the rhymes.'));

    return () => { for (const id of timers) clearTimeout(id); timers.clear(); if (ac) { ac.close().catch(() => {}); ac = null; } };
  },
};
