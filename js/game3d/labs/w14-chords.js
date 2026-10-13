// Chord Composer in 3D: a tilted keyboard whose keys press down and light up as chords are built from Roman numerals,
// a staircase of bar blocks to fill, and six chord pads to tap. No imports: everything arrives through ctx.

// ---------- music theory (pure) ----------
const LETTERS = 'CDEFGAB', NATURAL = [0, 2, 4, 5, 7, 9, 11], MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const KEYS = [['C', 48], ['G', 55], ['D', 50], ['A', 57], ['F', 53], ['B♭', 58], ['E♭', 51]]; // tonic as a MIDI note in octave 3
export const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12); // equal temperament, A4 = 440 Hz
// Spell a note that lies `semis` above the tonic and `steps` letters above it (so F major gets B♭, not A♯).
export function spell(tonicName, tonicMidi, steps, semis) {
  const li = (LETTERS.indexOf(tonicName[0]) + steps) % 7, diff = ((tonicMidi + semis) - NATURAL[li] + 120) % 12;
  return LETTERS[li] + (diff === 0 ? '' : diff === 1 ? '♯' : diff === 11 ? '♭' : '?');
}
// Chord on scale degree d (0 = I): stack every other note of the major scale. seventh adds a minor 7th (dominant 7th).
export function chord(key, d, seventh = false) {
  const [name, tonic] = key;
  const at = (i) => tonic + MAJOR[(d + i) % 7] + 12 * Math.floor((d + i) / 7);
  const midi = [at(0), at(2), at(4)], names = [0, 2, 4].map((i) => spell(name, tonic, d + i, MAJOR[(d + i) % 7]));
  const minor = midi[1] - midi[0] === 3;
  if (seventh) { midi.push(midi[0] + 10); names.push(spell(name, tonic, d + 6, (MAJOR[d] + 10) % 12)); }
  return { midi, names, label: names[0] + (minor ? 'm' : '') + (seventh ? '7' : ''), roman: ROMAN[d] + (seventh ? '7' : '') };
}
export const MISSIONS = [
  { name: 'I – V – vi – IV', bars: [0, 4, 5, 3], about: 'This four-chord loop is used in a great many pop songs.' },
  { name: 'I – IV – V – vi', bars: [0, 3, 4, 5], about: 'I, IV and V are the three major chords of the key; vi is the relative minor, built from the same scale.' },
  { name: 'I – vi – IV – V', bars: [0, 5, 3, 4], about: 'The "doo-wop" turnaround: V at the end pulls strongly back home to I.' },
  { name: '12-bar blues', bars: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 0], blues: true, about: 'Twelve bars: four of I, two of IV, two of I, then V, IV, I, I. Blues, rock and roll and jazz are all built on it.' },
];
// The numbers of the bars that do not match the mission (the last bar of a blues may also be V, the "turnaround").
export const wrongBars = (mission, slots) => slots.map((d, i) => (d === mission.bars[i] || (mission.blues && i === 11 && d === 4) ? null : i + 1)).filter(Boolean);

// Used by the automated tests. By hand: C major I = C E G (MIDI 48 52 55), vi = A C E (minor), F major IV = B♭,
// G major V = D F♯ A, C7 adds B♭; A4 = 440 Hz, A3 = 220 Hz, C3 = 130.81 Hz; a fifth is 2^(7/12) = 1.4983.
export function selfTest() {
  const C = chord(KEYS[0], 0), Am = chord(KEYS[0], 5), Bb = chord(KEYS[4], 3), D = chord(KEYS[1], 4), C7 = chord(KEYS[0], 0, true);
  const blues = MISSIONS[3], turn = blues.bars.slice(0, 11).concat(4), bad = [0, 4, 3, 3];
  const ok = C.midi.join() === '48,52,55' && C.names.join('') === 'CEG' && C.label === 'C'
    && Am.midi.join() === '57,60,64' && Am.names.join('') === 'ACE' && Am.label === 'Am' && Am.roman === 'vi'
    && Bb.label === 'B♭' && Bb.names.join(' ') === 'B♭ D F' && D.names.join(' ') === 'D F♯ A' && D.label === 'D'
    && C7.label === 'C7' && C7.names[3] === 'B♭' && C7.midi[3] === 58
    && Math.abs(hz(69) - 440) < 1e-9 && Math.abs(hz(57) - 220) < 1e-9 && Math.abs(hz(48) - 130.8128) < 1e-3
    && Math.abs(2 ** (7 / 12) - 1.498307) < 1e-6
    && wrongBars(blues, blues.bars).length === 0 && wrongBars(blues, turn).length === 0 && wrongBars(MISSIONS[0], bad).join() === '3';
  return { ok, detail: `C: I = ${C.names.join(' ')}, vi = ${Am.label} (${Am.names.join(' ')}); F: IV = ${Bb.label}; G: V = ${D.names.join(' ')}; C7 adds ${C7.names[3]}; C3 = ${hz(48).toFixed(2)} Hz (by hand 130.81); fifth ${(2 ** (7 / 12)).toFixed(4)}` };
}

// Soft tones only: a 15 ms fade-in, a smooth fade-out, and silence in calm mode or where there is no sound system.
function makeSound(ctx) {
  const can = typeof AudioContext !== 'undefined' && !ctx.calm; let ac = null;
  return {
    can,
    tone(f, { vol = 0.06, dur = 0.5, type = 'sine', delay = 0 } = {}) {
      if (!can) return;
      try {
        ac = ac || new AudioContext(); if (ac.state === 'suspended') ac.resume();
        const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + 0.01 + delay;
        o.type = type; o.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); g.gain.linearRampToValueAtTime(0, t0 + dur + 0.02);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { ac = null; }
    },
    close() { try { ac?.close?.(); } catch (e) { /* nothing to close */ } ac = null; },
  };
}

const DEG = ['#e5484d', '#f08c00', '#f5c400', '#2bb673', '#3b82f6', '#8a5cf6'];   // one colour per chord I … vi
const LOW = 48, HIGH = 77, BAR = 1.2;                                               // keyboard range (C3 … F5); seconds per bar

export default {
  id: 'w14-chords',
  world: 14,
  levels: [5, 6],
  title: 'Chord Composer',
  goal: 'Turn Roman-numeral chord symbols into real chords in a given key. Fill every bar block, watch the keys go down, then check your progression.',
  kind: 'validated',
  model: 'Equal temperament with A4 = 440 Hz: every semitone multiplies frequency by 2^(1/12), so a fifth is 1.498 rather than the pure 3 : 2. Chords are plain close-position triads (or dominant sevenths) built by stacking every other note of the major scale, and the keyboard shows exactly which keys they use. They are played by simple, soft electronic tones; real music adds inversions, voice leading, rhythm and melody.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, hard = ctx.level >= 6, snd = makeSound(ctx);
    const tr = typeof ctx.t === 'function' ? ctx.t : (x) => x, tap = (o, fn) => ctx.onTap?.(o, fn);
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    const wood = ctx.mat('#8a4b2a', { roughness: 0.7 }), ivory = ctx.mat('#fff6e6', { roughness: 0.4 }), ebony = ctx.mat('#3b2233', { roughness: 0.4 }), cream = ctx.lit('#ffc46b', 0.9);
    const made = [];                                                                // sprites made here, to free in dispose()
    // Replaces the text sprite held by `holder`.
    function label(holder, text, size, color) {
      const old = holder.userData.tag;
      if (old) { holder.remove(old); old.material?.map?.dispose?.(); old.material?.dispose?.(); made.splice(made.indexOf(old), 1); }
      const s = ctx.sprite(text, { size, color: color || '#ffffff' }); holder.add(s); holder.userData.tag = s; made.push(s); return s;
    }

    // ----- the keyboard: 18 white and 12 black keys on a sloping case, hinged at the far end -----
    const kb = new THREE.Group(); kb.position.set(0, 1.55, 0.35); kb.rotation.x = 0.9; group.add(kb);
    add(new THREE.BoxGeometry(6.95, 0.2, 1.75), wood, 0, -0.19, 0, kb);
    add(new THREE.BoxGeometry(6.95, 0.42, 0.14), wood, 0, 0, -0.86, kb);
    for (const x of [-3.3, 3.3]) add(new THREE.BoxGeometry(0.16, 1.5, 0.5), wood, x, 0.75, -0.2);
    const whiteGeo = new THREE.BoxGeometry(0.34, 0.16, 1.5), blackGeo = new THREE.BoxGeometry(0.21, 0.16, 0.9), keys = [];
    for (let m = LOW, w = 0; m <= HIGH; m++) {
      const black = [1, 3, 6, 8, 10].includes(m % 12), x = (w - 8.5) * 0.37;
      const mesh = black ? add(blackGeo, ebony, x - 0.185, 0.13, -0.3, kb) : add(whiteGeo, ivory, x, 0, 0, kb);
      const k = { mesh, off: black ? ebony : ivory, y0: mesh.position.y, v: 0, target: 0, midi: m };
      keys.push(k); if (!black) w++;
      tap(mesh, () => { if (playT >= 0) return; release(); press(k, cream); holdT = 0.5; snd.tone(hz(m + 12), { type: 'triangle', vol: 0.07, dur: 0.6 }); rHz.set(`${hz(m).toFixed(2)} Hz`); });
    }
    const press = (k, m) => { k.target = 1; k.v = Math.min(k.v, 0.3); k.mesh.material = m; };
    const release = () => { for (const k of keys) { k.target = 0; k.mesh.material = k.off; } };
    const tag = new THREE.Group(); tag.position.set(0, 2.72, -0.35); group.add(tag);       // the name and notes of the chord

    // ----- six chord pads at the front, one per Roman numeral -----
    const pads = ROMAN.map((r, d) => {
      const g = new THREE.Group(); g.position.set((d - 2.5) * 1.1, 0, 1.9); group.add(g);
      const top = add(new THREE.CylinderGeometry(0.42, 0.46, 0.36, 20), ctx.mat(DEG[d], { roughness: 0.45 }), 0, 0.2, 0, g);
      const name = new THREE.Group(); name.position.set(0, hard ? 0.72 : 0.62, 0); g.add(name);
      if (!hard) { const s = ctx.sprite(r, { size: 0.36 }); s.position.set(0, 0.98, 0); g.add(s); made.push(s); }
      tap(top, () => place(d));
      return { top, name, v: 0 };
    });

    // ----- the bars to fill: blocks on a staircase, a frame round the chosen bar and a ball over the sounding one -----
    const barBox = new THREE.Group(); group.add(barBox);
    const blockGeo = new THREE.BoxGeometry(1.1, 0.45, 0.5), empty = ctx.mat('#b9a6c9', { roughness: 0.6 });
    const cursor = new THREE.Group(); cursor.scale.set(1.27, 0.62, 1); group.add(cursor);
    add(new THREE.TorusGeometry(0.62, 0.035, 8, 4), ctx.lit('#ffc46b', 1.4), 0, 0, 0, cursor).rotation.z = Math.PI / 4;
    const head = add(new THREE.SphereGeometry(0.14, 16, 12), ctx.lit('#fff1cf', 1.8), 0, 0, 0); head.add(ctx.glow('#ffc46b', 0.8, 0.8)); head.visible = false;
    const sign = new THREE.Group(); group.add(sign);
    let bars = [];

    let key = KEYS[0], mission = MISSIONS[0], slots = [], cur = 0, sevenths = false, tries = 0, done = false, predErr = null, predTruth = 0;
    let playT = -1, lastHalf = -1, holdT = 0, time = 0;

    const rGoal = ui.readout('Mission'), rBar = ui.readout('Selected bar');
    const padBtns = ROMAN.map((r, d) => ui.button(r, () => place(d), 'btn sm ghost'));
    ui.button('◀ Bar', () => select(cur - 1), 'btn sm ghost'); ui.button('Bar ▶', () => select(cur + 1), 'btn sm ghost');
    const sevenC = ui.choice([[false, 'Triads'], [true, 'Sevenths (blues)']], false, (v) => { sevenths = !!v; names(); describe(slots[cur]); });
    ui.button('▶️ Play', () => play(), 'btn'); ui.button('⏹ Stop', () => stop(), 'btn sm ghost');
    ui.button('✔ Check', () => check(), 'btn'); ui.button('🔄 New mission', () => fresh(), 'btn sm ghost');
    const rNotes = ui.readout('Notes of the selected chord'), rHz = ui.readout('Frequencies (Hz)'), rRatio = ui.readout('Ratios to the chord root');
    const ask = ui.note('');
    const predS = ui.slider({ label: 'My prediction: frequency of that root', min: 120, max: 400, step: 0.5, value: 200, unit: 'Hz' });
    ui.button('Check my prediction', () => judgePrediction(), 'btn sm ghost');
    ui.note('Capital numerals are major chords, small ones are minor. f = 440 Hz × 2^((n − 69) / 12), where n is the MIDI note number. Tap a bar block, then tap a chord pad to put it there. Tap any key to hear it.');

    function describe(d) {
      if (d == null) { rNotes.set('–'); rHz.set('–'); rRatio.set('–'); return; }
      const c = chord(key, d, sevenths);
      rNotes.set(c.label + ' = ' + c.names.join(' – '));
      rHz.set(c.midi.map((m) => hz(m).toFixed(2)).join(' · '));
      rRatio.set(c.midi.map((m) => (2 ** ((m - c.midi[0]) / 12)).toFixed(4)).join(' : '));
    }
    // Presses and lights the keys of the chord on degree d and names it above the keyboard.
    function show(d, hold) {
      const c = chord(key, d, sevenths), m = ctx.lit(DEG[d], 1.1);
      release(); for (const n of c.midi) press(keys[n - LOW], m);
      label(tag, c.label + ' = ' + c.names.join(' – '), 0.42, '#fff1cf'); holdT = hold;
      pads[d].v = 1;
      return c;
    }
    function strum(c, dur) {
      snd.tone(hz(c.midi[0] - 12), { type: 'sine', vol: 0.09, dur });
      c.midi.forEach((m, i) => snd.tone(hz(m + 12), { type: 'triangle', vol: 0.045, dur, delay: 0.02 * i }));
    }
    function names() {                                                            // pad and button labels follow the key
      ROMAN.forEach((r, d) => {
        const c = chord(key, d, sevenths);
        label(pads[d].name, c.label, hard ? 0.4 : 0.3, hard ? '#ffffff' : '#fff1cf');
        if (padBtns[d]) padBtns[d].textContent = hard ? c.label : `${c.roman} = ${c.label}`;
      });
      bars.forEach((b, i) => paint(i));
    }
    function paint(i) {
      const b = bars[i], d = slots[i];
      b.mesh.material = d == null ? empty : ctx.mat(DEG[d], { roughness: 0.45 });
      label(b.g, d == null ? String(i + 1) : chord(key, d, sevenths).label, d == null ? 0.3 : 0.36).position.set(0, 0, 0.3);
    }
    function select(i) {
      cur = Math.max(0, Math.min(slots.length - 1, i));
      rBar.set(`${cur + 1} / ${slots.length}`); describe(slots[cur]);
    }
    function place(d) {
      if (playT >= 0) stop();
      slots[cur] = d; paint(cur); bars[cur].v = 1;
      strum(show(d, 0.9), BAR * 0.5);
      if (cur < slots.length - 1) select(cur + 1); else rBar.set(`${cur + 1} / ${slots.length}`);
      describe(d);
      const c = chord(key, d, sevenths), gap = c.midi[1] - c.midi[0];
      ctx.say(`${c.roman} ${tr('in')} ${key[0]} ${tr('major')}: ${c.label} = ${c.names.join(' – ')}. ${tr(gap === 4 ? 'The middle note is 4 semitones above the root, so the chord is major and sounds bright.' : 'The middle note is only 3 semitones above the root, so the chord is minor and sounds softer.')}`);
    }
    function play() { if (slots.every((d) => d == null)) { ctx.say('Put a chord on a bar block first, then play.'); return; } playT = 0; lastHalf = -1; }
    function stop() { playT = -1; head.visible = false; release(); }
    function check() {
      if (slots.includes(null)) { ctx.say('Fill every bar first.'); return; }
      tries++;
      const wrong = wrongBars(mission, slots);
      if (wrong.length) {
        for (const n of wrong) bars[n - 1].shake = 0.6;
        ctx.say(`${tr('Check bar(s):')} ${wrong.join(', ')}. ${tr('Count up the major scale from the tonic: I is note 1, IV is note 4, V is note 5, vi is note 6.')}`);
        return;
      }
      ctx.say(mission.about);
      play();
      if (!done) {
        done = true;
        const score = Math.max(0.4, 1 - 0.12 * (tries - 1) - (predErr == null ? 0.1 : predErr > 0.02 ? 0.05 : 0));
        ctx.complete(score, `${tr('Composed the progression')} ${mission.name} ${tr('in the key of')} ${key[0]} ${tr('major')}.`);
      }
    }
    function judgePrediction() {
      predErr = Math.abs(predS.value - predTruth) / predTruth;
      ctx.say(`${tr(predErr <= 0.02 ? 'Well predicted!' : 'Not quite.')} ${tr('Each semitone multiplies the frequency by 2^(1/12) ≈ 1.0595, so')} ${predSemis} ${tr('semitones multiply it by')} ${(2 ** (predSemis / 12)).toFixed(4)}: ${predTruth.toFixed(1)} Hz.`);
    }
    let predSemis = 7;
    function fresh() {
      stop();
      key = KEYS[Math.floor(ctx.rng() * KEYS.length) % KEYS.length];
      mission = MISSIONS[Math.floor(ctx.rng() * MISSIONS.length) % MISSIONS.length];
      slots = Array(mission.bars.length).fill(null); tries = 0; done = false; predErr = null;
      // rebuild the blocks: one row of four, or three rows of four for the twelve-bar blues
      for (const b of bars) { const s = b.g.userData.tag; if (s) { s.material?.map?.dispose?.(); s.material?.dispose?.(); made.splice(made.indexOf(s), 1); } barBox.remove(b.g); }
      bars = slots.map((_, i) => {
        const row = Math.floor(i / 4), g = new THREE.Group(); g.position.set((i % 4 - 1.5) * 1.3, 3.1 + row * 0.6, -0.9 - row * 0.5); barBox.add(g);
        const mesh = add(blockGeo, empty, 0, 0, 0, g), b = { g, mesh, y0: g.position.y, v: 0, shake: 0 };
        tap(mesh, () => select(i));
        return b;
      });
      const rows = Math.ceil(slots.length / 4);
      sign.position.set(0, 3.1 + (rows - 1) * 0.6 + 0.7, -0.9 - (rows - 1) * 0.5);
      label(sign, `🎯 ${tr(mission.name)} · ${key[0]} ${tr('major')}`, 0.42, '#ffc46b');
      rGoal.set(`${tr(mission.name)}, ${key[0]} ${tr('major')}`);
      if (sevenC.value !== !!mission.blues) { if (sevenC.set) sevenC.set(!!mission.blues); else sevenths = !!mission.blues; }
      sevenths = !!mission.blues;
      names(); select(0);
      const d = [3, 4, 5][Math.floor(ctx.rng() * 3) % 3], f0 = hz(key[1]);
      predSemis = MAJOR[d]; predTruth = f0 * 2 ** (predSemis / 12);
      if (ask) ask.textContent = `${tr('Predict: the tonic')} ${key[0]} ${tr('is')} ${f0.toFixed(1)} Hz. ${tr('The root of')} ${ROMAN[d]} ${tr('is')} ${predSemis} ${tr('semitones higher. Its frequency?')}`;
      label(tag, `${key[0]} ${tr('major')}`, 0.42, '#fff1cf');
      ctx.say(`${tr('Compose')} ${tr(mission.name)} ${tr('in the key of')} ${key[0]} ${tr('major')}. ${mission.blues ? tr('Bars: I I I I · IV IV I I · V IV I I. ') : ''}${tr(hard ? 'The pads show only chord names: count up the scale to find which numeral each one is.' : 'Roman numerals name chords by their place in the scale, so the same progression works in any key.')}`);
    }
    fresh();

    return {
      step(dt) {
        if (holdT > 0 && playT < 0) { holdT -= dt; if (holdT <= 0) release(); }
        if (playT < 0) return;
        const half = Math.floor(playT / (BAR / 2)), bar = half >> 1;
        if (half !== lastHalf) {                                                  // two strums in every bar
          lastHalf = half;
          if (bar >= slots.length) { stop(); return; }
          const d = slots[bar];
          head.visible = true; head.position.copy(bars[bar].g.position); head.position.y += 0.42;
          if (d != null) { strum(show(d, 9), BAR * 0.46); bars[bar].v = 1; describe(d); } else release();
        }
        playT += dt;
      },
      frame(dt, t) {
        time = t ?? time + dt;
        const ease = Math.min(1, dt * 16);
        for (const k of keys) { k.v += (k.target - k.v) * ease; k.mesh.position.y = k.y0 - 0.085 * k.v; }
        for (const p of pads) { p.v = Math.max(0, p.v - dt * 3); p.top.position.y = 0.2 - 0.1 * Math.sin(p.v * Math.PI); }
        bars.forEach((b, i) => {
          b.v = Math.max(0, b.v - dt * 2.5); b.shake = Math.max(0, b.shake - dt);
          b.g.position.y = b.y0 + 0.14 * Math.sin(b.v * Math.PI); b.g.rotation.z = b.shake ? Math.sin(time * 40) * 0.08 * b.shake : 0;
          if (i === cur) { cursor.position.copy(b.g.position); cursor.position.z += 0.02; }
        });
        cursor.rotation.y = ctx.calm ? 0 : Math.sin(time * 2.2) * 0.25;
        if (head.visible && !ctx.calm) head.position.y += Math.sin(time * 9) * 0.004;
      },
      // Shows a successful run without the player (used by tests): the same select, place and check the pads use.
      autoplay() { mission.bars.forEach((d, i) => { select(i); place(d); }); check(); },
      dispose() {
        stop(); snd.close();
        for (const s of made) { s.material?.map?.dispose?.(); s.material?.dispose?.(); }
        made.length = 0;
      },
    };
  },
};
