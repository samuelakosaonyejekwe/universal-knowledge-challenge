// Echo Piano in 3D: eight big keys on a sloping keyboard, with a row of organ pipes behind them that get shorter as
// the notes get higher. A key that sounds goes down and glows, and the ball on its pipe jumps. No imports.

// C major scale from middle C (MIDI 60) to the C above. Equal temperament: f = 440 Hz × 2^((n − 69) / 12).
const KEYS = [[60, 'C', '#e5484d'], [62, 'D', '#f08c00'], [64, 'E', '#f5c400'], [65, 'F', '#2bb673'],
  [67, 'G', '#12a5a5'], [69, 'A', '#3b82f6'], [71, 'B', '#8a5cf6'], [72, 'C', '#e5484d']];
export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Length in metres of an open pipe that sings f: half a wave fits inside it, and sound travels at 343 m/s in room air.
export const pipe = (f) => 343 / (2 * f);
const ROUNDS = 4, DRAWN = 5;                                    // tunes to echo; the pipes are drawn five times life size
// How many notes the next tune has, and how many keys it may use (level 1 stays on the five lowest keys).
export const tuneShape = (lvl, round) => ({ len: (lvl === 1 ? 2 : 3) + Math.min(round, 2), span: lvl === 1 ? 5 : 8 });

// Used by the automated tests. By hand: A = 440 Hz, middle C = 261.63 Hz, the C above = 523.25 Hz (exactly double),
// and an open pipe for middle C is 343 ÷ (2 × 261.63) = 0.656 m, half as long for the C above.
export function selfTest() {
  const c = hz(60), c2 = hz(72), rising = KEYS.every((k, i) => i === 0 || hz(k[0]) > hz(KEYS[i - 1][0]));
  const a = tuneShape(1, 0), b = tuneShape(2, 3);
  const ok = Math.abs(hz(69) - 440) < 1e-9 && Math.abs(c - 261.6256) < 1e-3 && Math.abs(c2 - 2 * c) < 1e-9 && rising
    && Math.abs(pipe(c) - 0.6555) < 1e-3 && Math.abs(pipe(c2) - pipe(c) / 2) < 1e-9
    && a.len === 2 && a.span === 5 && b.len === 5 && b.span === 8;
  return { ok, detail: `C ${c.toFixed(2)} Hz (by hand 261.63), A ${hz(69).toFixed(0)} Hz, high C ${c2.toFixed(2)} Hz; open pipe for C ${pipe(c).toFixed(3)} m (by hand 0.656), for high C ${pipe(c2).toFixed(3)} m` };
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

export default {
  id: 'w14-piano',
  world: 14,
  levels: [1, 2],
  title: 'Echo Piano',
  goal: 'Guess which key is higher, listen to the little tune, then play it back on the big piano.',
  kind: 'validated',
  model: 'Eight white keys of one octave, tuned in equal temperament (A = 440 Hz): each key\'s pitch is 440 Hz × 2^((n − 69) ÷ 12). The pipes behind the keys show the length of an open pipe that would sing each note (343 m/s ÷ twice the frequency), drawn five times life size, so the highest C has a pipe exactly half as long as the lowest. The sound is a simple, soft electronic tone, not a real piano string or organ pipe, and there are no black keys here.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, lvl = ctx.level <= 1 ? 1 : 2, snd = makeSound(ctx);
    const tap = (o, fn) => ctx.onTap?.(o, fn);
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    const wood = ctx.mat('#8a4b2a', { roughness: 0.7 }), ivory = ctx.mat('#fff6e6', { roughness: 0.4 }), grey = ctx.mat('#b9a6c9', { roughness: 0.6 }), green = ctx.lit('#40c057', 1.3), gold = ctx.lit('#ffc46b', 1.4);
    const made = [];
    const emoji = (text, size, x, y, z, parent = group) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); parent.add(s); made.push(s); return s; };

    // ----- the keyboard: eight wide keys on a sloping case -----
    const kb = new THREE.Group(); kb.position.set(0, 1.15, 1.0); kb.rotation.x = 0.75; group.add(kb);
    add(new THREE.BoxGeometry(6.9, 0.25, 2.15), wood, 0, -0.27, 0, kb);
    add(new THREE.BoxGeometry(6.9, 1.0, 0.3), wood, 0, 0.5, -0.1);
    const keyGeo = new THREE.BoxGeometry(0.74, 0.3, 1.9), dotGeo = new THREE.SphereGeometry(0.2, 16, 12), pipeGeo = new THREE.CylinderGeometry(0.23, 0.23, 1, 18), ballGeo = new THREE.SphereGeometry(0.17, 16, 12);
    // ----- the pipes: length = 343 ÷ (2 f), five times life size, each with a ball resting on its mouth -----
    add(new THREE.BoxGeometry(6.9, 0.5, 0.8), wood, 0, 0.25, -1.5);
    const keys = KEYS.map(([midi, name, colour], i) => {
      const x = (i - 3.5) * 0.82, f = hz(midi), len = pipe(f) * DRAWN, glow = ctx.lit(colour, 1.2);
      const mesh = add(keyGeo, ivory, x, 0, 0, kb);
      add(dotGeo, ctx.mat(colour, { roughness: 0.4 }), 0, 0.14, 0.55, mesh);
      const tag = ctx.sprite(name, { size: 0.36, color: '#1c2340' }); tag.position.set(0, 0.32, 0.05); mesh.add(tag); made.push(tag);
      const tube = add(pipeGeo, ctx.mat(colour, { metalness: 0.5, roughness: 0.35 }), x, 0.5 + len / 2, -1.5); tube.scale.y = len;
      const ball = add(ballGeo, glow, x, 0.5 + len + 0.17, -1.5);
      const k = { mesh, glow, tube, ball, top: 0.5 + len + 0.17, f, lit: 0, v: 0, hop: 0 };
      tap(mesh, () => press(i)); tap(tube, () => press(i));
      return k;
    });
    // two spinning stars mark the pair to compare; a row of beads counts the notes of the tune
    const stars = [0, 1].map(() => { const s = add(new THREE.OctahedronGeometry(0.2), gold, 0, 0.75, 0.2, kb); s.visible = false; return s; });
    const beads = [0, 1, 2, 3, 4].map((j) => { const b = add(new THREE.SphereGeometry(0.14, 14, 10), grey, 0, 4.65, -0.6); b.visible = false; return b; });
    const faces = { ask: emoji('❓', 0.6, -3.0, 4.6, -0.6), ear: emoji('👂', 0.6, -3.0, 4.6, -0.6), play: emoji('🎹', 0.6, -3.0, 4.6, -0.6), star: emoji('🌟', 0.6, -3.0, 4.6, -0.6) };
    const status = (which) => { for (const k in faces) faces[k].visible = k === which; };
    status('');

    let stage = 'idle', busy = false, tune = [], pos = 0, round = 0, slips = 0, done = false, pair = [0, 1], rightGuess = 0, auto = false, autoT = 0, time = 0;
    const queue = [];                                             // things to do later, on the simulation clock
    const later = (fn, s) => queue.push({ at: time + s, fn });

    ui.button('▶️ Start / Next tune', () => next(), 'btn');
    ui.button('🔊 Hear it again', () => { if (stage === 'echo' && tune.length) playTune(); else ctx.say('Press Start first: then you can hear the tune as often as you like.'); }, 'btn sm ghost');
    ui.choice(KEYS.map((k, i) => [i, i === 7 ? 'High C' : k[1]]), null, (v) => press(+v));
    const rRound = ui.readout('Tunes'), rHz = ui.readout('Pitch'), rPipe = ui.readout('Open pipe for this note');
    rRound.set('0 / ' + ROUNDS); rHz.set('–'); rPipe.set('–');
    ui.note('Tap the big keys (or the buttons above). Keys further to the right have shorter pipes and sound higher.');

    function sound(i) {
      const k = keys[i];
      snd.tone(k.f, { type: 'triangle', vol: 0.09, dur: 0.5 }); snd.tone(k.f * 2, { type: 'sine', vol: 0.022, dur: 0.5 });
      k.lit = 0.32; k.hop = 1; k.mesh.material = k.glow;
      rHz.set(Math.round(k.f) + ' Hz'); rPipe.set(pipe(k.f).toFixed(2) + ' m');
    }
    function showBeads() {
      beads.forEach((b, j) => { b.visible = j < tune.length; b.position.x = (j - (tune.length - 1) / 2) * 0.45; b.material = j < pos ? green : grey; });
    }
    function playTune() {
      if (busy || !tune.length) return;
      busy = true; pos = 0; showBeads(); status('ear');
      ctx.say('Listen… and watch which keys go down.');
      const gap = ctx.calm ? 0.65 : 0.56;
      tune.forEach((k, i) => later(() => sound(k), 0.25 + i * gap));
      later(() => { busy = false; status('play'); ctx.say('Your turn! Play it back.'); }, 0.25 + tune.length * gap);
    }
    // Predict first: which of two keys will sound higher? Then hear them.
    function askHigher() {
      stage = 'guess';
      let a = Math.floor(ctx.rng() * 8) % 8, b = Math.floor(ctx.rng() * 8) % 8;
      if (a === b) b = (a + 3) % 8;
      pair = [a, b]; tune = []; pos = 0; showBeads(); status('ask');
      stars.forEach((s, j) => { s.visible = true; s.position.x = keys[pair[j]].mesh.position.x; });
      ctx.say('Which key will sound higher? Tap one of the two keys under the spinning stars.');
    }
    function answerHigher(k) {
      if (stage !== 'guess' || busy) return;
      if (!pair.includes(k)) { ctx.say('Tap one of the two keys under the spinning stars.'); return; }
      const [a, b] = pair, top = Math.max(a, b), ok = k === top;
      if (ok) rightGuess++;
      busy = true; for (const s of stars) s.visible = false;
      later(() => sound(Math.min(a, b)), 0.1); later(() => sound(top), 0.7);
      ctx.say(ok ? 'Yes! Keys further to the right sound higher, because the air shakes faster. Look: the higher key has the shorter pipe.' : 'Listen: the key further to the right sounds higher, because the air shakes faster. Look: it has the shorter pipe.');
      later(() => { busy = false; startTune(); }, 1.5);
    }
    function startTune() {
      stage = 'echo';
      const { len, span } = tuneShape(lvl, round);
      let k = Math.floor(ctx.rng() * span) % span;
      tune = [k];
      while (tune.length < len) {                                 // small steps, like a real melody
        const step = [-2, -1, 1, 2, lvl === 1 ? 1 : 0][Math.floor(ctx.rng() * 5) % 5];
        k = Math.max(0, Math.min(span - 1, k + step));
        tune.push(k);
      }
      playTune();
    }
    function next() {
      if (busy || stage === 'guess') return;
      if (stage === 'echo' && tune.length) { ctx.say('Finish this tune first. Press "Hear it again" if you need to.'); return; }
      askHigher();
    }
    function press(i) {
      if (!(i >= 0 && i < 8)) return;
      if (stage === 'guess') { answerHigher(i); return; }
      sound(i);
      if (stage !== 'echo' || busy || !tune.length) return;
      if (i === tune[pos]) {
        pos++; showBeads();
        if (pos < tune.length) return;
        round++; rRound.set(Math.min(round, ROUNDS) + ' / ' + ROUNDS); status('star');
        ctx.say('You played it! A melody is a chain of notes going up and down. You remembered every step.');
        tune = [];
        if (round >= ROUNDS && !done) {
          done = true;
          ctx.complete(Math.max(0.4, Math.min(1, 0.7 + 0.3 * rightGuess / ROUNDS - 0.04 * slips)), 'Echoed melodies by ear and told higher notes from lower ones.');
        }
      } else {
        const high = i > tune[pos];
        slips++; pos = 0; showBeads();
        ctx.say(high ? 'Not quite: that key was too high. The note you need is further to the left. Listen once more.' : 'Not quite: that key was too low. The note you need is further to the right. Listen once more.');
        busy = true; later(() => { busy = false; playTune(); }, 0.8);
      }
    }
    ctx.say('First guess which key is higher. Then listen to a tune and play it back. Press Start.');

    return {
      step(dt) {
        time += dt;
        for (let i = 0; i < queue.length; i++) if (queue[i].at <= time) { const job = queue.splice(i--, 1)[0]; job.fn(); }
        for (const k of keys) if (k.lit > 0) { k.lit -= dt; if (k.lit <= 0) k.mesh.material = ivory; }
        if (auto && !busy && !done) {                             // the demonstration presses the same keys a player would
          autoT += dt;
          if (autoT >= 0.45) { autoT = 0; if (stage === 'guess') press(Math.max(pair[0], pair[1])); else if (stage === 'echo' && tune.length) press(tune[pos]); else next(); }
        }
      },
      frame(dt, t = 0) {
        const ease = Math.min(1, dt * 18);
        for (const k of keys) {
          k.v += ((k.lit > 0 ? 1 : 0) - k.v) * ease; k.mesh.position.y = -0.12 * k.v;
          k.hop = Math.max(0, k.hop - dt * 2.2); k.ball.position.y = k.top + (ctx.calm ? 0.25 : 0.8) * Math.sin(k.hop * Math.PI);
        }
        stars.forEach((s, j) => { if (s.visible) { s.rotation.y = t * 2.5 + j; s.position.y = 0.75 + (ctx.calm ? 0 : Math.sin(t * 4 + j * 2) * 0.08); } });
      },
      // Shows a successful run without the player (used by tests): it starts, answers and echoes through press() and next().
      autoplay() { auto = true; autoT = 0; if (stage === 'idle') next(); },
      dispose() {
        queue.length = 0; auto = false; snd.close();
        for (const s of made) { s.material?.map?.dispose?.(); s.material?.dispose?.(); }
        made.length = 0;
      },
    };
  },
};
