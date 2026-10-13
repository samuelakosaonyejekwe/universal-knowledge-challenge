// World 16 — Metre and Rhyme Lab in 3D: ten drum-stones for the syllables of one line, and fourteen rhyme blocks on stepped shelves.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

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
// An iamb is weak-STRONG, so in a regular line every second syllable (2, 4, 6, 8, 10) carries the beat.
export const stressed = (i) => i % 2 === 1;
// The numbers (from 1) of the syllables whose mark does not fit the pattern.
export const wrongStress = (marks) => marks.map((m, i) => (m === stressed(i) ? 0 : i + 1)).filter(Boolean);
export const wrongRhyme = (letters) => letters.filter((l, i) => l !== SCHEME[i]).length;
const lastWord = (line) => line.slice(line.lastIndexOf(' ') + 1).replace(/[?:,;.]+$/, '');

export function selfTest() {
  const tens = SCANNED.every(([n, text]) => syllables(text).length === 10 && text.replaceAll('·', '') === SONNET[n]);
  const five = Array.from({ length: 10 }, (_, i) => stressed(i)).filter(Boolean).length === 5;
  const sounds = [...new Set(SCHEME)], pairs = sounds.every((l) => [...SCHEME].filter((x) => x === l).length === 2);
  const shape = [0, 1, 4, 5, 8, 9].every((i) => SCHEME[i] === SCHEME[i + 2] && SCHEME[i] !== SCHEME[i + 1]) && SCHEME[12] === SCHEME[13];
  const marks = [false, true, false, true, false, true, false, true, false, true], swapped = [true, false, false, true, false, true, false, true, false, true];
  const checks = wrongStress(marks).length === 0 && wrongStress(swapped).join() === '1,2' && wrongRhyme([...SCHEME]) === 0 && wrongRhyme([...'AABBCDCDEFEFGG']) === 2;
  const ok = tens && five && SONNET.length === 14 && SCHEME.length === 14 && sounds.length === 7 && pairs && shape && checks && 3 * 4 + 2 === 14 && 5 * 2 === 10;
  return { ok, detail: `5 scanned lines of 10 syllables: ${tens}; 5 feet × 2 = 10 with beats on 2, 4, 6, 8, 10: ${five}; 14 lines, ${sounds.length} rhyme sounds, 3 × 4 + 2 shape: ${shape && pairs}; a swapped first foot flags syllables ${wrongStress(swapped).join(' and ')}` };
}

function fuse(THREE, parts) {
  const pos = [], nor = [], tint = [], c = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [geo, colour, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m.compose(new THREE.Vector3(...p), q.setFromEuler(e.set(...r)), new THREE.Vector3(...s)));
    c.set(colour);
    for (const v of g.attributes.position.array) pos.push(v);
    for (const v of g.attributes.normal.array) nor.push(v);
    for (let i = 0; i < g.attributes.position.count; i++) tint.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
  return out;
}

const LETTERS = [...'ABCDEFG'];
const TINT = { A: '#ffb3ba', B: '#ffd9a0', C: '#fff3a3', D: '#b9f0b3', E: '#a8e6f0', F: '#b9c8ff', G: '#e0b9ff' };

export default {
  id: 'w16-metre',
  world: 16,
  levels: [5, 6],
  title: 'Metre and Rhyme Lab',
  goal: 'Mark the five stressed beats in a line of iambic pentameter, then work out the rhyme scheme of a Shakespeare sonnet.',
  kind: 'validated',
  model: 'One regular line of Sonnet 18 as ten drum-stones, one for each syllable: iambic pentameter is 5 feet of 2 syllables with the beat on every second one. The fourteen blocks carry the last word of each line, and the rhyme scheme is checked against ABAB CDCD EFEF GG. Metre is a pattern, not a law: actors and readers bend it, and Shakespeare often varies it on purpose. The lines chosen for tapping are regular ones. Some rhymes that were good in the 1600s, such as "temperate" and "date", no longer sound exact, and the spelling here is modernised.',
  mount(ctx) {
    const { THREE, group, ui, level } = ctx, t = ctx.t || ((x) => x), calm = !!ctx.calm, hard = level >= 6;
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s = 20) => new THREE.CylinderGeometry(a, b, h, s);
    const paint = ctx.mat('#ffffff', { vertexColors: true, roughness: 0.8 }), stone = ctx.mat('#bfae8c', { roughness: 0.85 }), gold = ctx.lit('#ffc55c', 1.3), amber = ctx.lit('#ffe9a8', 1.5);
    const parchment = ctx.mat('#f4ead8', { roughness: 0.8 }), red = ctx.mat('#ff8a8a', { roughness: 0.7 }), tints = Object.fromEntries(LETTERS.map((l) => [l, ctx.mat(TINT[l], { roughness: 0.7 })]));
    const INK = '#2a2140', DZ = 1.25, RAIL = 1.85;
    const [lineNo, scanned] = SCANNED[Math.floor(ctx.rng() * SCANNED.length) % SCANNED.length];
    const syl = syllables(scanned), marks = syl.map(() => false);
    const letters = SONNET.map((_, i) => (!hard && i < 4 ? SCHEME[i] : ''));
    const dx = (i) => (i - 4.5) * 0.7;

    // ----- part 1: ten drum-stones on a plinth, with a rail for the beat ball -----
    const set = [[box(7, 0.1, 1.0), '#8a5a3a', [0, 0.05, DZ]], [box(6.9, 0.05, 0.06), '#4a3f5c', [0, 0.125, RAIL]]];
    for (const s of [-1, 1]) set.push([box(0.1, 0.3, 0.1), '#4a3f5c', [s * 3.45, 0.15, RAIL]]);
    const drums = syl.map((x, i) => {
      const g = new THREE.Group(); g.position.set(dx(i), 0, DZ); group.add(g);
      const m = new THREE.Mesh(cyl(0.3, 0.33, 0.9), stone); m.position.y = -0.15; g.add(m);
      const word = ctx.sprite(x.s + (x.joins ? '-' : ''), { size: 0.26 }); word.position.set(0, 0.62, 0); g.add(word);
      return { g, m, y: 0, bump: 0, shake: 0 };
    });
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 8), gold); pointer.rotation.x = Math.PI; group.add(pointer);
    const beatBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), amber); beatBall.position.set(dx(0) - 0.25, 0.28, RAIL); group.add(beatBall);
    const beatGlow = ctx.glow('#ffe9a8', 0.7, 0.7); beatBall.add(beatGlow);

    // ----- part 2: fourteen rhyme blocks on four stepped shelves (three quatrains and a couplet) -----
    const col = (i) => Math.floor(i / 4), row = (i) => i % 4, bx = (i) => (col(i) - 1.5) * 1.72, by = (i) => 4.4 - row(i) * 0.58, bz = (i) => -1.7 + row(i) * 0.36;
    for (let c = 0; c < 4; c++) {
      const x = (c - 1.5) * 1.72, rows = c === 3 ? 2 : 4;
      for (const s of [-1, 1]) set.push([box(0.08, 4.75, 0.08), '#4a3f5c', [x + s * 0.74, 2.375, -2.1]]);
      for (let k = 0; k < rows; k++) { const front = -1.7 + k * 0.36 + 0.3, depth = front + 2.14; set.push([box(1.6, 0.05, depth), '#8a5a3a', [x, 4.4 - k * 0.58 - 0.235, front - depth / 2]]); }
    }
    group.add(new THREE.Mesh(fuse(THREE, set), paint));
    const blocks = SONNET.map((line, i) => {
      const m = new THREE.Mesh(box(1.5, 0.42, 0.5), parchment); m.position.set(bx(i), by(i), bz(i)); group.add(m);
      const word = ctx.sprite(lastWord(line), { size: 0.25, color: INK }); word.position.set(0.14, 0, 0.27); m.add(word);
      return { m, letter: null, out: 0, shake: 0, pulse: 0 };
    });
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), gold); marker.rotation.z = -Math.PI / 2; group.add(marker);
    function paintBlock(i, bad = false) {
      const b = blocks[i], l = letters[i];
      b.m.material = bad ? red : l ? tints[l] : parchment;
      if (b.letter && b.letter.userData.l !== l) { b.m.remove(b.letter); b.letter.material?.map?.dispose?.(); b.letter.material?.dispose?.(); b.letter = null; }
      if (l && !b.letter) { b.letter = ctx.sprite(l, { size: 0.36, color: INK }); b.letter.userData.l = l; b.letter.position.set(-0.56, 0, 0.27); b.m.add(b.letter); }
    }

    // ----- state and controls -----
    let sel = 0, lineSel = hard ? 0 : 4, letter = hard ? 'A' : 'C', stressDone = false, rhymeDone = false, stressTries = 0, rhymeTries = 0, predErr = null, completed = false;
    let beatT = -1, beatI = -1, wave = -1, cheer = -1, ac = null;
    const queue = []; let cool = 0;
    ui.note('Part 1. Iambic pentameter has 5 feet of 2 syllables. First predict how many syllables one line has.');
    const predS = ui.slider({ label: 'My prediction', min: 6, max: 14, step: 1, value: 8, unit: 'syllables', onInput: () => {} });
    ui.button('Lock in my prediction', () => lockPrediction());
    const lineNote = ui.note('Sonnet 18, line ' + (lineNo + 1) + ': ' + SONNET[lineNo]);
    ui.note('Tap the drum-stones of the strong syllables, or choose a syllable and mark it.');
    const sylS = ui.slider({ label: 'Syllable', min: 1, max: 10, step: 1, value: 1, unit: '', onInput: (v) => { sel = Math.max(0, Math.min(9, Math.round(v) - 1)); } });
    ui.button('Mark or unmark this syllable', () => toggleMark(sel));
    ui.button('🔊 Hear the beat', () => hearBeat(), 'btn sm ghost');
    ui.button('✔ Check stresses', () => checkStress(), 'btn');
    ui.note('Part 2. Find the rhyme scheme: choose a letter, then tap every block whose line ends with that sound.');
    const letterC = ui.choice(LETTERS.map((l) => [l, l]), letter, (v) => { letter = v; });
    const lineS = ui.slider({ label: 'Line of the sonnet', min: 1, max: 14, step: 1, value: lineSel + 1, unit: '', onInput: (v) => { lineSel = Math.max(0, Math.min(13, Math.round(v) - 1)); showLine(); } });
    const poemNote = ui.note('');
    ui.button('Give this line the letter', () => assign(lineSel));
    ui.button('✔ Check rhyme scheme', () => checkRhyme(), 'btn');
    ui.note('William Shakespeare, Sonnet 18 (1609)');
    const rMarks = ui.readout('Stressed syllables marked'), rSyl = ui.readout('Syllables in the line'), rLines = ui.readout('Lines labelled'), rSounds = ui.readout('Rhyme sounds used');
    const showLine = () => { if (poemNote) poemNote.textContent = t('Line') + ' ' + (lineSel + 1) + ': ' + SONNET[lineSel]; };
    const counts = () => { rMarks.set(marks.filter(Boolean).length + ' / 5'); rLines.set(letters.filter(Boolean).length + ' / 14 ' + t('lines')); rSounds.set(new Set(letters.filter(Boolean)).size + ' / 7'); };
    if (lineNote) lineNote.textContent = t('Sonnet 18, line') + ' ' + (lineNo + 1) + ': ' + SONNET[lineNo];
    rSyl.set('? ' + t('syllables'));

    function lockPrediction() {
      if (predErr !== null) return;
      predErr = Math.abs(Math.round(predS.value) - 10);
      rSyl.set('5 × 2 = 10 ' + t('syllables'));
      for (const d of drums) d.bump = 0.6;
      ctx.say(t('"Penta" means five and an iamb has two syllables, so 5 × 2 = 10. Count the drum-stones to test it.') + ' ' + t(predErr === 0 ? 'Your prediction was exactly right.' : 'Your prediction was close: now you know why it is ten.'));
    }
    function toggleMark(i) {
      if (stressDone) { ctx.say(t('The beats are found. Now label the rhymes on the shelves.')); return; }
      marks[i] = !marks[i]; drums[i].bump = 0.4; counts();
    }
    function hearBeat() { if (beatT < 0) { beatT = 0; beatI = -1; } }
    function tone(strong) {
      if (calm || typeof AudioContext === 'undefined') return;
      try {
        ac = ac || new AudioContext(); if (ac.state === 'suspended') ac.resume();
        const o = ac.createOscillator(), g = ac.createGain(), s = ac.currentTime + 0.01;
        o.type = 'sine'; o.frequency.value = strong ? 330 : 220;
        g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(strong ? 0.2 : 0.07, s + 0.015); g.gain.setValueAtTime(strong ? 0.2 : 0.07, s + (strong ? 0.2 : 0.12)); g.gain.linearRampToValueAtTime(0.0001, s + (strong ? 0.2 : 0.12) + 0.015);
        o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + 0.28);
      } catch { ac = null; }
    }
    function checkStress() {
      if (stressDone) return;
      stressTries++;
      const wrong = wrongStress(marks);
      if (wrong.length) {
        for (const n of wrong) drums[n - 1].shake = 1;
        ctx.say((marks.filter(Boolean).length !== 5 ? t('Pentameter means five beats: mark exactly five strong syllables.') + ' ' : '') + t('Say the line aloud like a heartbeat: da-DUM, da-DUM. Check syllable(s):') + ' ' + wrong.join(', '));
        return;
      }
      stressDone = true; wave = 0;
      ctx.say(t('Five iambs: 5 feet × 2 syllables = 10 syllables, with the stress on every second one.') + ' ' + t('An iamb is a weak syllable followed by a strong one, like a heartbeat. Five of them in a row make iambic pentameter, close to the rhythm of spoken English.'));
      finish();
    }
    function assign(i) {
      if (rhymeDone) return;
      letters[i] = letters[i] === letter ? '' : letter;
      blocks.forEach((_, k) => paintBlock(k)); blocks[i].pulse = 1; counts();
    }
    function checkRhyme() {
      if (rhymeDone) return;
      if (letters.includes('')) { ctx.say(t('Give every line a letter first.')); return; }
      rhymeTries++;
      const wrong = wrongRhyme(letters);
      if (wrong) {
        blocks.forEach((b, i) => { const bad = letters[i] !== SCHEME[i]; paintBlock(i, bad); if (bad) b.shake = 1; });
        ctx.say(wrong + ' ' + t('line(s) do not fit. The first line-ending is A; each new sound gets the next letter, and a line that rhymes with an earlier one reuses its letter.'));
        return;
      }
      rhymeDone = true; cheer = 0; blocks.forEach((_, k) => paintBlock(k));
      ctx.say('ABAB CDCD EFEF GG — ' + t('three quatrains and a couplet: 3 × 4 + 2 = 14 lines, using 7 rhyme sounds.') + ' ' + t('This is the English, or Shakespearean, sonnet: three groups of four lines build the thought, and the final rhyming pair sums it up.'));
      finish();
    }
    function finish() {
      if (completed || !stressDone || !rhymeDone) return;
      completed = true;
      const score = 1 - 0.1 * (stressTries - 1) - 0.1 * (rhymeTries - 1) - (predErr === 0 ? 0 : 0.05);
      ctx.complete(Math.max(0.4, score), 'Scanned a line of iambic pentameter and found the rhyme scheme ABAB CDCD EFEF GG of Sonnet 18.');
    }

    drums.forEach((d, i) => ctx.onTap(d.m, () => { sylS.set(i + 1); toggleMark(i); }));
    blocks.forEach((b, i) => ctx.onTap(b.m, () => { lineS.set(i + 1); assign(i); }));
    blocks.forEach((_, i) => paintBlock(i)); counts(); showLine();
    ctx.say('Poets measure lines in beats. Predict how many syllables the line has, mark its strong beats, then label the rhymes.');

    return {
      step(dt) {
        if (beatT >= 0) {                                   // da-DUM × 5: the ball hops low on weak syllables and high on strong ones
          beatT += dt;
          const i = Math.floor(beatT / 0.3);
          if (i !== beatI && i < 10) { beatI = i; drums[i].bump = stressed(i) ? 1 : 0.35; tone(stressed(i)); }
          if (beatT >= 3.1) { beatT = -1; beatI = -1; }
        }
        if (wave >= 0) { wave += dt; if (wave > 3) wave = -1; }
        if (cheer >= 0) { cheer += dt; if (cheer > 5) cheer = -1; }
        if (queue.length) { cool -= dt; if (cool <= 0) { cool = 0.12; queue.shift()(); } }
      },
      frame(dt, time) {
        const k = Math.min(1, dt * (calm ? 14 : 7));
        drums.forEach((d, i) => {
          d.y += ((marks[i] ? 0.45 : 0) - d.y) * k; d.bump = Math.max(0, d.bump - dt * 3.5); d.shake = Math.max(0, d.shake - dt * 1.6);
          const lift = wave >= 0 && !calm ? Math.max(0, Math.sin(wave * 6 - i * 0.6)) * 0.12 : 0;
          d.g.position.y = d.y - d.bump * 0.1 + lift; d.g.position.x = dx(i) + (calm ? 0 : Math.sin(time * 40) * 0.04 * d.shake);
          d.m.material = marks[i] ? gold : d.bump > 0.3 ? amber : stone;
        });
        pointer.position.set(dx(sel), drums[sel].g.position.y + 1.0 + (calm ? 0 : Math.sin(time * 4) * 0.04), DZ);
        if (beatT >= 0) {
          const f = Math.min(9.999, beatT / 0.3), i = Math.floor(f), u = f - i;
          beatBall.position.set(dx(i) + (u - 0.5) * 0.7, 0.28 + Math.sin(Math.PI * u) * (stressed(i) ? 0.7 : 0.2), RAIL);
        } else beatBall.position.set(dx(0) - 0.25, 0.28, RAIL);
        blocks.forEach((b, i) => {
          b.out += ((letters[i] ? 0.16 : 0) - b.out) * k; b.pulse = Math.max(0, b.pulse - dt * 3); b.shake = Math.max(0, b.shake - dt * 1.4);
          const pair = cheer >= 0 && !calm && SCHEME[i] === LETTERS[Math.floor(cheer / 0.6) % 7] ? Math.sin(Math.PI * ((cheer / 0.6) % 1)) * 0.22 : 0;
          b.m.position.set(bx(i) + (calm ? 0 : Math.sin(time * 38) * 0.04 * b.shake), by(i), bz(i) + b.out + pair);
          b.m.scale.setScalar(1 + 0.08 * b.pulse);
        });
        marker.position.set(bx(lineSel) - 0.95, by(lineSel), bz(lineSel) + 0.3);
      },
      // Shows a full solution through the same controls the player uses (used by tests).
      autoplay() {
        queue.push(() => predS.set(10), () => lockPrediction(), () => hearBeat());
        for (let i = 0; i < 10; i++) if (marks[i] !== stressed(i)) queue.push(() => sylS.set(i + 1), () => toggleMark(sel));
        queue.push(() => checkStress());
        for (let i = 0; i < 14; i++) if (letters[i] !== SCHEME[i]) queue.push(() => { if (letterC.set) letterC.set(SCHEME[i]); else letter = SCHEME[i]; }, () => lineS.set(i + 1), () => assign(lineSel));
        queue.push(() => checkRhyme());
      },
      dispose() { queue.length = 0; if (ac) { try { ac.close(); } catch { /* already closed */ } ac = null; } },
    };
  },
};
