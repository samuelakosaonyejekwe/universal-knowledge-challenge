// Sound Studio in 3D: a row of pillars whose heights are the pitch of a word, and a voice ball that rolls or hops along them.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

// The same tones and words as the flat lab (js/labs/w10-sound-studio.js).
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

// ----- the model: pitch levels, their frequencies, and how close a drawn contour is to a tone -----
const SAMPLES = 21, CLOSE = 0.2;       // contours are compared at 21 points; an RMS gap under 0.2 counts as a match
export const model = {
  // pitch level 0 (low) … 1 (high) → frequency in hertz: 130 Hz at the bottom, 1.2 octaves higher at the top
  hz: (p) => 130 * Math.pow(2, p * 1.2),
  // height of a contour (a list of [time, pitch] points joined by straight lines) at time x
  sample(pts, x) { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1); } return pts[pts.length - 1][1]; },
  line: (pts) => Array.from({ length: SAMPLES }, (_, i) => model.sample(pts, i / (SAMPLES - 1))),
  // RMS gap between two contours after removing each one's average pitch (tones are relative: any voice, high or low, can say them)
  gap(a, b) { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; return Math.sqrt(a.reduce((s, v, i) => s + (v - ma - (b[i] - mb)) ** 2, 0) / a.length); },
  // Which of the four tones a drawn contour is closest to, and how far it is from the wanted one.
  judge(pts, tone) {
    const my = model.line(pts), gaps = TONES.map((tn) => model.gap(model.line(tn.pts), my));
    let best = 0; for (let i = 1; i < 4; i++) if (gaps[i] < gaps[best] - 1e-9) best = i;
    const rmse = gaps[tone.n - 1];
    return { rmse, nearest: TONES[best], ok: rmse < CLOSE && TONES[best].n === tone.n };
  },
  // The tones played for a word when syllable s is the strong (or high) one: [start s, length s, hertz] for each syllable.
  beats(count, s, pitch) { return Array.from({ length: count }, (_, i) => { const on = i === s; return pitch ? [i * 0.45, 0.4, on ? 300 : 190] : [i * 0.45, on ? 0.55 : 0.32, on ? 250 : 190]; }); },
};
// Used by the automated tests. Hand-worked: 130 × 2^1.2 = 298.66 Hz; the dipping tone is at its lowest (0.12) at time 0.45 and
// half-way back up at 0.725 → 0.12 + 0.53 × 0.5 = 0.385; a level line against the rising tone (0.35 → 0.85) leaves 21 evenly
// spaced gaps from −0.25 to +0.25, whose RMS is 0.5 × √(22 / 240) = 0.1514.
export function selfTest() {
  const top = model.hz(1), dip = model.sample(TONES[2].pts, 0.45), half = model.sample(TONES[2].pts, 0.725);
  const flat = [[0, 0.5], [1, 0.5]], flatVsRise = model.gap(model.line(TONES[1].pts), model.line(flat));
  const shifted = model.judge([[0, 0.15], [1, 0.65]], TONES[1]);                       // a rising line drawn lower down is still the rising tone
  const each = TONES.every((tn) => { const j = model.judge(tn.pts, tn); return j.ok && j.rmse < 1e-9; });
  const five = TONES.every((tn) => model.judge([0, 0.25, 0.5, 0.75, 1].map((x) => [x, Math.round(model.sample(tn.pts, x) / 0.05) * 0.05]), tn).ok);
  const flatIsLevel = model.judge(flat, TONES[0]).ok && !model.judge(flat, TONES[1]).ok && !model.judge(flat, TONES[3]).ok;
  const b = model.beats(3, 1, false);
  const ok = Math.abs(model.hz(0) - 130) < 1e-9 && Math.abs(top - 298.66) < 0.01 && Math.abs(dip - 0.12) < 1e-9 && Math.abs(half - 0.385) < 1e-9 && Math.abs(flatVsRise - 0.5 * Math.sqrt(22 / 240)) < 1e-9
    && shifted.ok && shifted.rmse < 1e-9 && each && five && flatIsLevel && b[1][2] === 250 && b[1][1] === 0.55 && b[2][0] === 0.9 && b[0][2] === 190;
  return { ok, detail: `top pitch ${top.toFixed(2)} Hz, dip ${dip.toFixed(2)} then ${half.toFixed(3)}, level against rising ${flatVsRise.toFixed(4)}, five-pillar shapes ${five ? 'match' : 'do not match'} their tones` };
}

export default {
  id: 'w10-sound-studio',
  world: 10,
  levels: [3, 4],
  title: 'Sound Studio',
  goal: 'Show how the pitch or stress of a word is shaped, then play it to check your idea.',
  kind: 'validated',
  model: 'Pitch is shown as the height of pillars: 130 Hz at the bottom, 1.2 octaves higher (about 299 Hz) at the top. For Mandarin, your pillar line is compared with the four tone shapes at 21 points after removing its average height, because tones are relative. For other languages one syllable is made stronger: 250 Hz for 0.55 s against 190 Hz for 0.32 s (Japanese: 300 Hz against 190 Hz, the same length). Simple soft sine tones stand in for a voice, played slower than speech so you can follow them. Real speech also changes loudness, length and vowel quality, and stress rules have exceptions. Needs sound on your device; the pillars show the same pattern without it.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x);
    const lang = WORDS[ctx.lang] || ctx.lang === 'zh' ? ctx.lang : 'es';
    const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const mPillar = ctx.mat('#ff8fab', { roughness: 0.5 }), mPick = ctx.lit('#ffd43b', 0.6), mOk = ctx.lit('#38d9a9', 0.8), mModel = ctx.lit('#17a673', 1.0);
    const Y0 = 0.5, H = 3.3, SPAN = 5.4;                                  // top of the stage, height of the pitch scale, width of the row
    const yOf = (p) => Y0 + 0.25 + p * H;

    // the stage, two pitch posts and the voice ball
    add(new THREE.BoxGeometry(6.8, Y0, 2.4), ctx.mat('#5b3f8c', { metalness: 0.3, roughness: 0.45 }), 0, Y0 / 2, 0);
    add(new THREE.BoxGeometry(6.8, 0.08, 0.5), ctx.mat('#845ef7', { roughness: 0.5 }), 0, Y0 + 0.04, 0.95);
    for (const x of [-3.2, 3.2]) { add(new THREE.CylinderGeometry(0.06, 0.06, H + 0.5, 8), ctx.mat('#fff7ef', { roughness: 0.6 }), x, Y0 + (H + 0.5) / 2, -0.9); for (const p of [0, 0.5, 1]) add(new THREE.TorusGeometry(0.13, 0.03, 6, 14), ctx.mat('#c2255c', { roughness: 0.5 }), x, yOf(p), -0.9); }
    const hi = ctx.sprite(`${Math.round(model.hz(1))} Hz`, { size: 0.3 }); hi.position.set(-3.2, yOf(1) + 0.4, -0.9); group.add(hi);
    const lo = ctx.sprite(`${Math.round(model.hz(0))} Hz`, { size: 0.3 }); lo.position.set(-3.2, yOf(0) - 0.4, -0.9); group.add(lo);
    const ball = add(new THREE.SphereGeometry(0.24, 18, 12), ctx.lit('#ffd43b', 1.5), -3.0, Y0 + 0.24, 0.95); ball.add(ctx.glow('#ffd43b', 0.9, 0.8));
    const texts = [];
    const label = (text, x, y, z, opts, maxW) => { const s = ctx.sprite(text, opts); if (maxW && s.scale.x > maxW) s.scale.multiplyScalar(maxW / s.scale.x); s.position.set(x, y, z); group.add(s); texts.push(s); return s; };
    const drop = (s) => { if (!s) return; group.remove(s); s.material.map?.dispose?.(); s.material.dispose?.(); const i = texts.indexOf(s); if (i >= 0) texts.splice(i, 1); };

    // soft tones, only where the page can make sound and motion is not reduced
    let actx = null;
    const audio = () => { if (ctx.calm || typeof AudioContext === 'undefined') return null; try { actx = actx || new AudioContext(); actx.resume?.(); } catch { actx = null; } return actx; };
    // one gliding sine tone through a list of [time s, hertz] points
    const tone = (points, start, gain = 0.12) => {
      const a = audio(); if (!a || points.length < 2) return;
      try {
        const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + 0.03 + start, dur = points[points.length - 1][0];
        o.type = 'sine'; o.frequency.setValueAtTime(points[0][1], t0); for (const [x, f] of points.slice(1)) o.frequency.linearRampToValueAtTime(f, t0 + x);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.015); g.gain.setValueAtTime(gain, t0 + Math.max(0.016, dur - 0.015)); g.gain.linearRampToValueAtTime(0, t0 + Math.max(0.031, dur));
        o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
      } catch { /* no sound */ }
    };
    const closeAudio = () => { try { actx?.close?.(); } catch { /* closed */ } actx = null; };
    const pickWord = (list, prev) => { let w; do { w = list[Math.floor(ctx.rng() * list.length) % list.length]; } while (w === prev && list.length > 1); return w; };

    // =============== Mandarin: shape the pitch line of a tone ===============
    if (lang === 'zh') {
      const N = ctx.level >= 4 ? 7 : 5, LEN = 1.4;                        // level 4: seven pillars, so the shape must be finer; the tone lasts 1.4 s
      const xs = Array.from({ length: N }, (_, i) => i / (N - 1)), px = (x) => -SPAN / 2 + x * SPAN, w = (SPAN / (N - 1)) * 0.62;
      let cur = null, sel = 0, touched = false, done = false, play = null, auto = null, head = null, showModel = false;
      const hs = xs.map(() => 0.5);
      const pillars = xs.map((x, i) => {
        const m = add(new THREE.BoxGeometry(w, 1, 1.1), mPillar, px(x), Y0, 0);
        const track = add(new THREE.BoxGeometry(w * 0.5, H + 0.5, 0.08), ctx.mat('#3a2a66', { roughness: 0.8 }), px(x), Y0 + (H + 0.5) / 2, -0.62); track.castShadow = false;
        const setFrom = (o, p) => { if (!p) return; pillarC.set(i); pitchS.set(Math.max(0, Math.min(1, Math.round(((p.y - Y0 - 0.25) / H) / 0.05) * 0.05))); };
        ctx.onTap(m, setFrom); ctx.onTap(track, setFrom);
        return m;
      });
      const ribbon = xs.slice(1).map(() => add(new THREE.BoxGeometry(1, 0.09, 0.5), ctx.mat('#fff7ef', { roughness: 0.4 }), 0, 0, 0.2));
      const dots = Array.from({ length: 11 }, (_, i) => { const d = add(new THREE.SphereGeometry(0.13, 12, 8), mModel, px(i / 10), 0, -0.62 + 0.14); d.visible = false; d.castShadow = false; return d; });
      const rWord = ui.readout('Word'), rSel = ui.readout('This pillar'), rLine = ui.readout('Your line, start to end'), rGap = ui.readout('Gap to the tone');
      const pillarC = ui.choice(xs.map((_, i) => [i, `Pillar ${i + 1}`]), 0, (v) => { sel = v; draw(); });
      const pitchS = ui.slider({ label: 'Pitch of this pillar (0 low, 1 high)', min: 0, max: 1, step: 0.05, value: 0.5, unit: '', onInput: (v) => { if (play) return; hs[sel] = +v; touched = true; showModel = false; draw(); } });
      ui.button('▶ Play my line', () => check(), 'btn');
      ui.button('▶ Hear the model', () => hear(), 'btn ghost sm');
      ui.button('Flatten', () => { if (play) return; hs.fill(0.5); touched = false; showModel = false; draw(); ctx.say('All pillars are level again. Shape the pitch line you think this tone makes.'); }, 'btn ghost sm');
      ui.button('New word', () => { if (!play) newTone(); }, 'btn ghost sm');
      ui.note('Tap a pillar\'s track at the height you want, or choose a pillar and move the slider. Left is the start of the syllable, right is the end; higher means a higher voice.');
      const mine = () => xs.map((x, i) => [x, hs[i]]);
      function draw() {
        pillars.forEach((m, i) => { const top = yOf(hs[i]); m.scale.y = top - Y0; m.position.y = Y0 + (top - Y0) / 2; m.material = i === sel ? mPick : mPillar; });
        ribbon.forEach((r, i) => { const x0 = px(xs[i]), x1 = px(xs[i + 1]), y0 = yOf(hs[i]) + 0.06, y1 = yOf(hs[i + 1]) + 0.06; r.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.2); r.scale.x = Math.hypot(x1 - x0, y1 - y0); r.rotation.z = Math.atan2(y1 - y0, x1 - x0); });
        dots.forEach((d, i) => { d.visible = showModel && !!cur; if (cur) d.position.y = yOf(model.sample(cur.pts, i / 10)); });
        rSel.set(`pitch ${hs[sel].toFixed(2)} = ${Math.round(model.hz(hs[sel]))} Hz`);
        rLine.set(`${Math.round(model.hz(hs[0]))} Hz → ${Math.round(model.hz(hs[N - 1]))} Hz`);
        if (pitchS.value !== hs[sel] && !play) { const keep = touched, shownNow = showModel; pitchS.set(hs[sel]); touched = keep; if (shownNow && !showModel) { showModel = true; draw(); } }
      }
      function newTone() {
        let n; do { n = TONES[Math.floor(ctx.rng() * 4) % 4]; } while (n === cur);
        cur = n; hs.fill(0.5); touched = false; done = false; showModel = false; sel = 0;
        drop(head); head = label(`${cur.han}  ${cur.word}`, 0, 4.75, -0.3, { size: 0.6, bg: 'rgba(14,18,48,.78)', label: `= ${t(cur.gloss)}` }, 4);
        rWord.set(`${cur.han}  ${cur.word}  = ${t(cur.gloss)}`); rGap.set('–'); draw();
        ctx.say('Guess the shape first: set the pillars to the pitch line you think this tone makes, left to right. Then play it to see if it fits.');
      }
      // The ball rolls along a contour while its tone plays; `then` runs when it reaches the end.
      function run(pts, then) { play = { pts, t: 0, then }; tone(Array.from({ length: 13 }, (_, i) => [(i / 12) * LEN, model.hz(model.sample(pts, i / 12))]), 0); }
      function hear() { if (play || !cur) return; showModel = true; draw(); run(cur.pts, () => ctx.say(`The green beads show the model: ${t(cur.name).toLowerCase()}. Compare it with your pillars.`)); }
      function check() {
        if (play || !cur) return;
        if (!touched) { ctx.say('Shape the pillars first: move at least one, so the line shows your own idea.'); return; }
        const pts = mine();
        run(pts, () => {
          const j = model.judge(pts, cur); showModel = true; draw(); rGap.set(`${j.rmse.toFixed(2)} (under 0.20 matches)`);
          if (j.ok) {
            if (!done) { done = true; ctx.say(`Your line matches the tone: ${t(cur.name).toLowerCase()}. In Mandarin the same syllable changes meaning with the pitch contour: mā, má, mǎ and mà are four different words.`); ctx.complete(Math.max(0.6, 1 - j.rmse * 2), `Drew tone ${cur.n} (${cur.name}).`); }
          } else if (j.nearest.n !== cur.n) ctx.say(`Not quite. Your line sounds most like the ${t(j.nearest.name).toLowerCase()} tone, but this word is ${t(cur.name).toLowerCase()}. The green beads are the model: try again!`);
          else ctx.say('Not quite. The shape is right but it bends too much or too little. The green beads are the model: try again!');
        });
      }
      newTone();
      return {
        step(dt) {
          if (play) {
            play.t += dt; const k = Math.min(1, play.t / LEN);
            ball.position.set(px(k), yOf(model.sample(play.pts, k)) + 0.32, 0.2);
            if (k >= 1) { const f = play.then; play = null; f?.(); }
          } else if (auto) {
            auto.wait -= dt;
            if (auto.wait <= 0) {
              auto.wait = 0.12;
              if (done) auto = null;
              else if (auto.i < N) { pillarC.set(auto.i); pitchS.set(Math.round(model.sample(cur.pts, xs[auto.i]) / 0.05) * 0.05); auto.i++; }
              else { check(); auto.i = 0; auto.wait = 1; }
            }
          }
        },
        frame(dt, time) { if (!play && !ctx.calm) ball.position.y += Math.sin(time * 3) * 0.002; },
        // Sets every pillar to the tone's own shape with the same controls the player uses, then plays the line.
        autoplay() { auto = { i: 0, wait: 0.2 }; },
        dispose() { for (const s of texts.slice()) drop(s); closeAudio(); play = null; auto = null; },
      };
    }

    // =============== other languages: find the strong (or high) syllable ===============
    const list = WORDS[lang], pitch = lang === 'ja', NEEDED = ctx.level >= 4 ? 2 : 1;       // level 4: two words in a row
    let word = null, syl = [], pick = null, shown = null, done = false, solved = 0, play = null, auto = null, wait = 0, head = null, sylText = [], right = false;
    const blocks = [0, 1, 2, 3].map((i) => { const m = add(new THREE.BoxGeometry(1, 1, 1.1), mPillar, 0, Y0, 0); ctx.onTap(m, () => choose(i)); return { m, h: 0.9, w: 1 }; });
    const rWord = ui.readout('Word'), rN = ui.readout('Syllables'), rPick = ui.readout('Your pick'), rHear = ui.readout('Pattern played'), rDone = ui.readout('Words found');
    const pickC = ui.choice([[0, 'Syllable 1'], [1, 'Syllable 2'], [2, 'Syllable 3'], [3, 'Syllable 4']], null, (v) => choose(v));
    ui.button('▶ Play my pick', () => { if (play) return; if (pick === null) ctx.say('Pick a syllable first.'); else run(pick, null); }, 'btn ghost sm');
    ui.button('Check', () => check(), 'btn gold');
    ui.button('New word', () => { if (!play) newWord(); }, 'btn ghost sm');
    ui.note(pitch ? 'Which syllable is high in pitch? Tap its block or choose its number, then check.' : 'Which syllable is stressed (louder, longer, higher)? Tap its block or choose its number, then check.');
    const bx = (i) => (i - (syl.length - 1) / 2) * (SPAN / Math.max(syl.length, 3) + 0.25);
    const describe = (s) => model.beats(syl.length, s, pitch).map((b) => `${b[2]} Hz ${b[1].toFixed(2)} s`).join(' · ');
    function paint() {
      blocks.forEach((b, i) => {
        b.m.visible = i < syl.length; if (!b.m.visible) return;
        const on = shown === i;
        b.h = on ? 2.6 : pick === i && shown === null ? 1.5 : 0.9; b.w = on && !pitch ? 1.55 : 1.05;
        b.m.material = on && right ? mOk : pick === i ? mPick : mPillar; b.m.position.x = bx(i);
      });
      rPick.set(pick === null ? '–' : `syllable ${pick + 1}`); rDone.set(`${solved} / ${NEEDED}`);
    }
    function choose(i) {
      if (play || done) return;
      if (i >= syl.length) { ctx.say(`This word has only ${syl.length} syllables. Pick one of them.`); return; }
      pick = i; shown = null; right = false; paint();
    }
    function newWord() {
      word = pickWord(list, word); syl = word[0].split('-'); pick = null; shown = null; right = false;
      drop(head); head = label(word[1], 0, 4.7, -0.3, { size: 0.6, bg: 'rgba(14,18,48,.78)' }, 6);
      sylText.forEach(drop); sylText = syl.map((s, i) => label(s.toLowerCase(), bx(i), Y0 - 0.02, 1.3, { size: 0.4 }, 1.5));
      rWord.set(word[1]); rN.set(String(syl.length)); rHear.set('–'); paint();
      ctx.say('Choose a syllable before you listen, then check your prediction.');
    }
    // Plays the word with syllable s made strong: the ball hops from block to block and the strong block grows.
    function run(s, then) {
      const beats = model.beats(syl.length, s, pitch); shown = s; paint(); rHear.set(describe(s));
      for (const [st, len, f] of beats) tone([[0, f], [len, pitch ? f : f - 5]], st, f > 200 && !pitch ? 0.16 : 0.09);
      play = { beats, t: 0, then, end: beats[beats.length - 1][0] + 0.7 };
    }
    function check() {
      if (play || done) return;
      if (pick === null) { ctx.say('Pick a syllable first.'); return; }
      right = pick === word[2];
      run(word[2], () => {
        if (!right) { ctx.say(`Not that one. You just heard the real pattern: the tall block is the ${pitch ? 'high' : 'strong'} syllable, at ${pitch ? 300 : 250} Hz. Listen again, pick it, and check.`); return; }
        solved++; rDone.set(`${solved} / ${NEEDED}`);
        if (solved < NEEDED) { ctx.say('Correct! You hear the pattern. Here comes one more word.'); wait = 1.6; return; }
        done = true;
        ctx.say(pitch ? 'Correct! In Japanese the pitch falls after the accented mora, and it can change the word: hashi means chopsticks or bridge.' : 'Correct! Stressed syllables are made longer, louder and higher, which helps listeners hear where a word is.');
        ctx.complete(1, `Found the ${pitch ? 'accent' : 'stress'} in ${word[1]}.`);
      });
    }
    newWord();
    return {
      step(dt) {
        for (const b of blocks) { if (!b.m.visible) continue; const k = Math.min(1, dt * 9); b.m.scale.y += (b.h - b.m.scale.y) * k; b.m.scale.x += (b.w - b.m.scale.x) * k; b.m.position.y = Y0 + b.m.scale.y / 2; }
        if (play) {
          play.t += dt;
          const i = Math.min(syl.length - 1, Math.floor(play.t / 0.45)), into = Math.min(1, (play.t - i * 0.45) / 0.45);
          ball.position.set(bx(i), Y0 + blocks[i].m.scale.y + 0.26 + Math.sin(Math.PI * into) * 0.5, 0.1);
          if (play.t >= play.end) { const f = play.then; play = null; f?.(); }
        } else if (wait > 0) { wait -= dt; if (wait <= 0) newWord(); }
        else if (auto && !done) { auto.wait -= dt; if (auto.wait <= 0) { auto.wait = 0.5; pickC.set(word[2]); check(); } }
      },
      frame(dt, time) { if (!play && !ctx.calm) ball.position.y += Math.sin(time * 3) * 0.002; },
      // Picks the strong syllable of each word with the same choice and button the player uses.
      autoplay() { auto = { wait: 0.3 }; },
      dispose() { for (const s of texts.slice()) drop(s); closeAudio(); play = null; auto = null; },
    };
  },
};
