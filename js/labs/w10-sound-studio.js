import { h, button, canvas, pointer } from '../core/labkit.js';

// Mandarin tone contours: pitch 0 (low) .. 1 (high) over time 0..1
const TONES = [
  { n: 1, word: 'mā', han: '妈', gloss: 'mother', name: 'High and level', pts: [[0, 0.85], [1, 0.85]] },
  { n: 2, word: 'má', han: '麻', gloss: 'hemp', name: 'Rising', pts: [[0, 0.35], [1, 0.85]] },
  { n: 3, word: 'mǎ', han: '马', gloss: 'horse', name: 'Dipping', pts: [[0, 0.4], [0.45, 0.12], [1, 0.65]] },
  { n: 4, word: 'mà', han: '骂', gloss: 'to scold', name: 'Falling', pts: [[0, 0.92], [1, 0.12]] },
];
// Stress / pitch-accent words. s = index of the stressed (or high) syllable; syl = syllables
const WORDS = {
  en: [['ba-NA-na', 'banana', 1], ['PHO-to-graph', 'photograph', 0], ['pho-TO-gra-phy', 'photography', 1], ['com-PU-ter', 'computer', 1]],
  es: [['te-LÉ-fo-no', 'teléfono', 1], ['pa-PÁ', 'papá', 1], ['ME-sa', 'mesa', 0], ['ciu-DAD', 'ciudad', 1]],
  fr: [['cho-co-LAT', 'chocolat', 2], ['ba-NANE', 'banane', 1], ['or-di-na-TEUR', 'ordinateur', 3]],
  ar: [['ki-TĀB', 'كتاب', 1], ['MAD-ra-sa', 'مدرسة', 0]],
  ru: [['ma-la-KO', 'молоко', 2], ['ka-RO-va', 'корова', 1], ['sa-BA-ka', 'собака', 1]],
  he: [['sha-LOM', 'שלום', 1], ['to-DA', 'תודה', 1], ['SE-fer', 'ספר', 0]],
  it: [['ME-la', 'mela', 0], ['te-LE-fo-no', 'telefono', 1], ['a-MI-co', 'amico', 1]],
  el: [['ef-ha-ri-STO', 'ευχαριστώ', 3], ['sho-LI-o', 'σχολείο', 1], ['ka-li-ME-ra', 'καλημέρα', 2]],
  tr: [['ki-TAP', 'kitap', 1], ['ço-CUK', 'çocuk', 1], ['el-MA', 'elma', 1]],
  pt: [['ba-NA-na', 'banana', 1], ['o-bri-GA-do', 'obrigado', 2], ['te-le-FO-ne', 'telefone', 2]],
  ja: [['HA-shi', 'はし = chopsticks (high-low)', 0], ['ha-SHI', 'はし = bridge (low-high)', 1], ['A-me', 'あめ = rain (high-low)', 0], ['a-ME', 'あめ = candy (low-high)', 1]],
};

export default {
  id: 'w10-sound-studio',
  world: 10,
  levels: [3, 4],
  kind: 'studio',
  icon: '🎵',
  title: 'Sound Studio',
  goal: 'Show how the pitch or stress of a word is shaped, then listen to check your idea.',
  limits: 'Simple sine and triangle tones stand in for a voice. Real speech also changes loudness, length and vowel quality, and stress rules have exceptions. Needs sound on your device.',
  mount(root, api) {
    const t = api.t;
    const lang = WORDS[api.lang] || api.lang === 'zh' ? api.lang : 'es';
    let actx = null, done = false, tone, word, pick = null, drawn = [], down = false, ideal = false;
    const status = h('div', { class: 'note', 'aria-live': 'polite' });
    const body = h('div', { class: 'lab' });
    const ctx = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch { actx = null; } return actx; };
    const beep = (f0, f1, start, dur, gain, type = 'sine') => {
      const a = ctx(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + start;
      o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.linearRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    };
    const hz = (p) => 130 * Math.pow(2, p * 1.2);
    const sample = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1); } return pts[pts.length - 1][1]; };
    const playContour = (pts) => { const N = 12; for (let i = 0; i < N; i++) beep(hz(sample(pts, i / N)), hz(sample(pts, (i + 1) / N)), (i * 0.7) / N, 0.7 / N + 0.03, 0.18); };

    if (lang === 'zh') {
      const c = canvas(220, { light: true });
      const draw = () => {
        const { ctx: g, w } = c; g.clearRect(0, 0, w, 220);
        g.strokeStyle = '#dde3f3'; g.lineWidth = 1;
        for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, i * 44); g.lineTo(w, i * 44); g.stroke(); }
        g.fillStyle = '#8a93ad'; g.font = '11px system-ui'; g.fillText(t('high'), 4, 12); g.fillText(t('low'), 4, 214);
        const line = (pts, col, wd) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] * w, 210 - p[1] * 200) : g.moveTo(p[0] * w, 210 - p[1] * 200))); g.stroke(); };
        if (ideal) line(tone.pts.length === 2 ? tone.pts : sampleN(tone.pts), '#17a673', 8);
        if (drawn.length) line(drawn.map((p) => [p[0] / w, (210 - p[1]) / 200]), '#5b6cff', 4);
      };
      const sampleN = (pts) => Array.from({ length: 21 }, (_, i) => [i / 20, sample(pts, i / 20)]);
      const newTone = () => { tone = TONES[Math.floor(api.rng() * 4)]; drawn = []; ideal = false; done = false; head.textContent = `${tone.han}  ${tone.word}  = ${t(tone.gloss)}`; status.className = 'note'; status.textContent = t('Draw the pitch line you think this tone makes, left to right (high is up).'); draw(); };
      const head = h('div', { class: 'lab-goal', style: { fontSize: '1.4rem', textAlign: 'center' } });
      const toRel = (ev) => { const p = pointer(c.el, ev); return [Math.max(0, Math.min(c.w, p.x)), Math.max(10, Math.min(210, p.y))]; };
      const dn = (ev) => { down = true; c.el.setPointerCapture?.(ev.pointerId); drawn = [toRel(ev)]; ideal = false; draw(); };
      const mv = (ev) => { if (down) { const p = toRel(ev); if (p[0] >= drawn[drawn.length - 1][0]) drawn.push(p); draw(); } };
      const up = () => { down = false; };
      c.el.addEventListener('pointerdown', dn); c.el.addEventListener('pointermove', mv); c.el.addEventListener('pointerup', up); c.el.addEventListener('pointercancel', up);
      c.onResize = draw;
      const mine = () => drawn.length > 3 ? Array.from({ length: 20 }, (_, i) => [i / 19, 1 - 0]).map(([x], i) => [x, sample(drawn.map((p) => [p[0] / c.w, (210 - p[1]) / 200]), x)]) : null;
      const check = () => {
        const m = mine(); if (!m) { status.textContent = t('Draw a line first.'); return; }
        ideal = true; draw();
        // compare after removing overall pitch offset (tones are relative), RMS in 0..1 units
        const ref = sampleN(tone.pts).map((p) => p[1]), my = m.map((p) => p[1]);
        const mr = ref.reduce((a, b) => a + b) / ref.length, mm = my.reduce((a, b) => a + b) / my.length;
        const rmse = Math.sqrt(ref.reduce((a, r, i) => a + (r - mr - (my[i] - mm)) ** 2, 0) / ref.length);
        playContour(m);
        if (rmse < 0.2 && !done) { done = true; status.className = 'note ok'; status.textContent = t('Your line matches the tone: ') + t(tone.name);
          api.say(t('In Mandarin the same syllable changes meaning with the pitch contour: mā, má, mǎ and mà are four different words.'));
          api.complete(Math.max(0.6, 1 - rmse * 2), `Drew tone ${tone.n} (${tone.name}).`); }
        else if (!done) { status.className = 'note warn'; status.textContent = t('Not quite. The green line is the model. Try again!'); }
      };
      body.append(head, c.el, h('div', { class: 'lab-row' },
        button(t('▶ Play my line'), check), button(t('▶ Hear the model'), () => { ideal = true; draw(); playContour(tone.pts.length === 2 ? tone.pts : sampleN(tone.pts)); }, 'btn ghost sm'),
        button(t('Clear'), () => { drawn = []; ideal = false; draw(); }, 'btn ghost sm'), button(t('New word'), newTone, 'btn ghost sm')), status);
      root.append(body); newTone();
      api.say(t('Guess the shape first. Then play it to see if it fits.'));
      return () => { c.el.removeEventListener('pointerdown', dn); c.el.removeEventListener('pointermove', mv); c.el.removeEventListener('pointerup', up); c.el.removeEventListener('pointercancel', up); try { actx?.close(); } catch { /* closed */ } };
    }

    // stress / pitch-accent mode
    const list = WORDS[lang], pitch = lang === 'ja';
    const play = (s) => {
      const syl = word[0].split('-');
      syl.forEach((_, i) => {
        const on = i === s, st = i * 0.45;
        if (pitch) beep(on ? 300 : 190, on ? 300 : 190, st, 0.4, 0.2, 'triangle');
        else beep(on ? 250 : 190, on ? 245 : 185, st, on ? 0.55 : 0.32, on ? 0.3 : 0.1, 'triangle');
      });
    };
    const render = () => {
      const syl = word[0].toLowerCase().split('-');
      const word2 = word[0].split('-');
      body.replaceChildren(
        h('div', { class: 'lab-goal', style: { fontSize: '1.3rem', textAlign: 'center' } }, `${word[1]}`),
        h('div', { class: 'small muted', style: { textAlign: 'center' } }, pitch ? t('Which syllable is high in pitch?') : t('Which syllable is stressed (louder, longer, higher)?')),
        h('div', { class: 'lab-row', style: { justifyContent: 'center' } }, ...syl.map((s, i) => h('button', { class: 'chip' + (pick === i ? ' on' : ''), type: 'button', style: { minHeight: '56px', fontSize: '1.1rem', padding: '0 1rem' },
          onClick: () => { pick = i; render(); } }, word2[i].toLowerCase()))),
        h('div', { class: 'lab-row', style: { justifyContent: 'center' } },
          button(t('▶ Play my pick'), () => { if (pick === null) status.textContent = t('Pick a syllable first.'); else play(pick); }),
          button(t('Check'), check, 'btn gold'),
          button(t('New word'), newWord, 'btn ghost sm')), status);
    };
    const check = () => {
      if (pick === null) { status.className = 'note'; status.textContent = t('Pick a syllable first.'); return; }
      play(word[2]);
      if (pick === word[2]) {
        status.className = 'note ok'; status.textContent = t('Correct! You hear the pattern.');
        if (!done) { done = true; api.say(pitch ? t('In Japanese the pitch falls after the accented mora, and it can change the word: hashi means chopsticks or bridge.') : t('Stressed syllables are made longer, louder and higher, which helps listeners hear where a word is.')); api.complete(1, `Found the ${pitch ? 'accent' : 'stress'} in ${word[1]}.`); }
      } else { status.className = 'note warn'; status.textContent = t('Not that one. You heard the right pattern: listen again.'); }
    };
    const newWord = () => { word = list[Math.floor(api.rng() * list.length)]; pick = null; done = false; status.className = 'note'; status.textContent = ''; render(); };
    root.append(body); newWord();
    api.say(t('Choose a syllable before you listen, then check your prediction.'));
    return () => { try { actx?.close(); } catch { /* closed */ } };
  },
};
