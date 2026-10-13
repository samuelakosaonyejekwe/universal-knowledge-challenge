// World 14 — Music: the Twilight Concert Garden.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: an ideal stretched string fixed at both ends -----
// Wave speed v = √(T/μ); the n-th standing wave fits n half-waves into the length, so f_n = (n / 2L)·√(T/μ).
const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const G0 = 9.81;                                // m/s², turns the tension into the hanging mass that makes it
export const model = {
  speed: (T, mu) => Math.sqrt(T / mu),                                   // m/s, T in newtons, μ in kg/m
  freq: (L, T, mu, n = 1) => (n / (2 * L)) * Math.sqrt(T / mu),          // Hz
  length: (f, T, mu, n = 1) => (n / (2 * f)) * Math.sqrt(T / mu),        // m: the length that sings f
  cents: (f, ref) => 1200 * Math.log2(f / ref),                          // 100 cents = one piano key
  // Nearest note in equal temperament with A4 = 440 Hz, and how many cents the pitch is above (+) or below (−) it.
  note(f) { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); return { name: NOTES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1), cents: Math.round((m - r) * 100), hz: 440 * 2 ** ((r - 69) / 12) }; },
  // Sideways position of the point x along the string, as a fraction of the largest swing.
  shape: (x, L, n, phase) => Math.sin(n * Math.PI * x / L) * Math.cos(phase),
};
// Used by the automated tests. By hand: L = 0.5 m, T = 90 N, μ = 1 g/m → v = √(90 / 0.001) = 300 m/s, f = 300 / (2 × 0.5) = 300 Hz.
export function selfTest() {
  const f = model.freq(0.5, 90, 0.001), half = model.freq(0.25, 90, 0.001), tight = model.freq(0.5, 360, 0.001), third = model.freq(0.5, 90, 0.001, 3);
  const a = model.note(440), c = model.note(261.63), back = model.length(f, 90, 0.001);
  const near = (x, y) => Math.abs(x - y) < 1e-9 * y;
  const ok = near(f, 300) && near(model.speed(90, 0.001), 300) && near(half, 2 * f) && near(tight, 2 * f) && near(third, 900) && near(back, 0.5)
    && a.name === 'A4' && a.cents === 0 && c.name === 'C4' && c.cents === 0 && Math.abs(model.cents(880, 440) - 1200) < 1e-9
    && Math.abs(model.shape(0.25, 0.5, 2, 0)) < 1e-12 && near(model.shape(0.25, 0.5, 1, 0), 1);
  return { ok, detail: `L 0.5 m, T 90 N, μ 1 g/m: ${f.toFixed(2)} Hz (by hand 300); half length ${half.toFixed(0)} Hz; four times the tension ${tight.toFixed(0)} Hz; 3rd harmonic ${third.toFixed(0)} Hz; 440 → ${a.name}, 261.63 → ${c.name}` };
}

// One goal per level: the note to reach, how close (in cents), where the controls start, and the harmonic to use.
const GOALS = [
  { hz: 440, tol: 35, L: 0.8, T: 80, text: 'Tune the string to concert A: 440 Hz. The tension is already right, so only the length needs to change.' },
  { hz: 440, tol: 25, L: 0.9, T: 60, text: 'Tune the string to concert A: 440 Hz. Slide the bridge to change the length.' },
  { hz: 392, tol: 12, L: 0.8, T: 49, text: 'The string sings G3, about 196 Hz. Make it sing exactly one octave higher: 392 Hz, twice as fast.' },
  { hz: 261.63 * 1.5, tol: 10, L: 0.75, T: 77, text: 'The string sings C4, 261.6 Hz. Make it sing a fifth higher: one and a half times as fast, 392.4 Hz.' },
  { hz: 880, tol: 8, L: 0.8, T: 62, need: 2, text: 'Use the 2nd harmonic (two loops) to sing A5: 880 Hz.' },
  { hz: 659.26, tol: 5, L: 0.6, T: 70, need: 3, text: 'Use the 3rd harmonic (three loops) to sing E5: 659.3 Hz. Tune roughly with the length, then finely with the tension.' },
];

const sim = {
  title: 'The singing string',
  goal: 'Tune the singing string. Change its length and how tightly it is pulled until it sings the target note, then pluck it.',
  kind: 'validated',
  model: 'An ideal string held at both ends: the wave speed is √(tension ÷ mass per metre) and the n-th standing wave has the frequency (n ÷ 2L) × wave speed. Notes are named in equal temperament with A4 = 440 Hz, and 100 cents is one piano key. The tension comes from a hanging weight (tension = mass × 9.81 m/s²). The picture is slowed down several hundred times and the swing is drawn much bigger than life. It leaves out the stiffness of the string, air drag and the way a real string fades, the small stretch that raises the tension when you pluck hard, and the mix of many harmonics that gives each instrument its own sound.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, lv = Math.max(1, Math.min(6, ctx.level || 1)), goal = GOALS[lv - 1];
    const X0 = -3.0, SC = 5.4, YS = 2.6, SEG = 64, HALF = 0.035;            // 1 m of string = 5.4 scene units
    const wood = ctx.mat('#8a4b2a', { roughness: 0.7 }), brass = ctx.mat('#d9a441', { metalness: 0.7, roughness: 0.3 }), cream = ctx.mat('#f3d9c0');
    const add = (geo, m, x, y, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); group.add(o); return o; };
    // the bench (a monochord), its two bridges, the pulley and the hanging weight
    add(new THREE.BoxGeometry(6.3, 0.25, 0.9), wood, -0.25, 2.1);
    for (const x of [-3.0, 2.5]) add(new THREE.BoxGeometry(0.3, 1.98, 0.7), wood, x, 0.99);
    const prism = new THREE.CylinderGeometry(0.02, 0.16, 0.375, 4);
    add(prism, cream, X0, 2.4125).rotation.y = Math.PI / 4;
    const bridge = add(prism, ctx.lit('#fd7e14', 0.9), 0, 2.4125); bridge.rotation.y = Math.PI / 4;
    const marker = ctx.glow('#fd7e14', 0.9, 0.7); marker.position.set(0, 0.35, 0); bridge.add(marker);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 20), brass, 3.1, 2.4).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.5, 0.1, 0.1), wood, 2.95, 2.25);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xfff1cf, side: THREE.DoubleSide });
    const rest = add(new THREE.BoxGeometry(1, 0.035, 0.035), stringMat, 0, YS);                    // the still part beyond the bridge
    add(new THREE.BoxGeometry(0.035, 0.9, 0.035), stringMat, 3.3, 1.95);
    const weight = add(new THREE.CylinderGeometry(1, 1, 1, 20), ctx.mat('#e64980', { metalness: 0.3, roughness: 0.4 }), 3.3, 1.2);
    const sign = ctx.sprite(`🎯 ${model.note(goal.hz).name} · ${goal.hz.toFixed(1)} Hz`, { size: 0.5 }); sign.position.set(0, 4.3, 0); group.add(sign);
    // the vibrating part: a thin ribbon that is reshaped every frame, and two faint lines for the widest swing
    const pos = new Float32Array((SEG + 1) * 6), idx = [];
    for (let i = 0; i < SEG; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const ribGeo = new THREE.BufferGeometry(); ribGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ribGeo.setIndex(idx);
    const ribbon = new THREE.Mesh(ribGeo, stringMat); ribbon.frustumCulled = false; group.add(ribbon);
    const envMat = new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.4 });
    const env = [1, -1].map((sgn) => { const p = new Float32Array((SEG + 1) * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const line = new THREE.Line(g, envMat); line.frustumCulled = false; group.add(line); return { p, g, sgn }; });

    let L = goal.L, T = goal.T, mu = 0.0005, n = 1, ring = 99, swing = 0, phase = 0, judge = false, tries = 0, lastWhy = '', audio = null;
    const canSound = typeof AudioContext !== 'undefined' && !ctx.calm;
    const freq = () => model.freq(L, T, mu, n), peak = () => (ctx.calm ? 0.16 : 0.34) / Math.sqrt(n);
    const why = (key, text) => { if (key !== lastWhy) { lastWhy = key; ctx.say(text); } };
    const lenS = ui.slider({ label: 'Vibrating length', min: 0.25, max: 1, step: 0.002, value: L, unit: 'm', onInput: (v) => {
      const shorter = +v < L; L = +v; refresh(0.45);
      why(shorter ? 'short' : 'long', shorter ? 'Shorter string: the wave has less far to run before it bounces back, so it goes to and fro more times each second. More swings a second is a higher note.' : 'Longer string: the wave has further to run before it bounces back, so it swings fewer times each second. That is a lower note.');
    } });
    const tenS = ui.slider({ label: 'Tension (pull of the hanging weight)', min: 20, max: 150, step: 0.5, value: T, unit: 'N', onInput: (v) => {
      const tighter = +v > T; T = +v; refresh(0.45);
      why(tighter ? 'tight' : 'loose', tighter ? 'Tighter string: it snaps back harder, so the wave runs along it faster and the note rises. To double the frequency you need four times the tension.' : 'Looser string: it springs back more gently, so the wave runs slower and the note falls.');
    } });
    if (lv >= 3) ui.choice([[0.3, 'Thin string: 0.3 g per metre'], [0.5, 'Medium string: 0.5 g per metre'], [1.2, 'Thick string: 1.2 g per metre']], 0.5, (v) => {
      const heavier = +v / 1000 > mu; mu = +v / 1000; refresh(0.45);
      why(heavier ? 'thick' : 'thin', heavier ? 'A thick string is heavy, so it is slow to get moving. The wave runs slower and the note is lower: that is why bass strings are fat.' : 'A thin string is light and quick to move, so the wave runs faster and the note is higher.');
    });
    const harmS = lv >= 5 ? ui.slider({ label: 'Harmonic (number of loops)', min: 1, max: 5, step: 1, value: 1, unit: '', onInput: (v) => {
      n = Math.round(+v); refresh(0.6);
      why('harm' + n, n === 1 ? 'One loop: the whole string swings together. This is the lowest note it can sing.' : `${n} loops: the string stands still at ${n - 1} point${n > 2 ? 's' : ''} between the bridges, and each loop is ${n} times shorter, so the note is ${n} times the frequency.`);
    } }) : null;
    const rF = ui.readout('Frequency, Hz'), rN = ui.readout('Nearest note'), rV = ui.readout('Wave speed, m/s'), rD = ui.readout('Away from target, cents'), rM = ui.readout('Hanging mass, kg');
    // Redraws everything that depends on the controls; `nudge` makes the string shiver so the new shape can be seen.
    function refresh(nudge = 0) {
      const f = freq(), nt = model.note(f), xb = X0 + L * SC, d = model.cents(f, goal.hz);
      bridge.position.x = xb; rest.position.x = (xb + 3.1) / 2; rest.scale.x = Math.max(0.01, 3.1 - xb);
      const h = 0.3 + T / 150 * 0.6, r = 0.2 + T / 150 * 0.2; weight.scale.set(r, h, r); weight.position.y = 1.5 - h / 2;
      for (const e of env) { for (let i = 0; i <= SEG; i++) { const x = L * i / SEG; e.p.set([X0 + x * SC, YS + e.sgn * peak() * model.shape(x, L, n, 0), 0], i * 3); } e.g.attributes.position.needsUpdate = true; }
      rF.set(f.toFixed(1)); rN.set(`${nt.name} ${nt.cents > 0 ? '+' : nt.cents < 0 ? '−' : '±'}${Math.abs(nt.cents)} cents`); rV.set(model.speed(T, mu).toFixed(0));
      rD.set(`${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d) >= 100 ? Math.abs(d).toFixed(0) : Math.abs(d).toFixed(1)}`); rM.set((T / G0).toFixed(2));
      if (nudge && ring > 1.2) { swing = Math.max(swing, nudge); }
      draw();
    }
    function draw() {
      const a = peak() * swing, c = Math.cos(phase);
      for (let i = 0; i <= SEG; i++) { const x = L * i / SEG, y = YS + a * Math.sin(n * Math.PI * x / L) * c, px = X0 + x * SC; pos.set([px, y - HALF, 0, px, y + HALF, 0], i * 6); }
      ribGeo.attributes.position.needsUpdate = true;
    }
    // A soft, short tone. Every step is guarded: with no sound system the string is still tuned by eye and by numbers.
    function sound(f) {
      if (!canSound) return;
      try {
        audio = audio || new AudioContext(); if (audio.state === 'suspended') audio.resume();
        const osc = audio.createOscillator(), gain = audio.createGain(), t0 = audio.currentTime;
        osc.type = 'sine'; osc.frequency.value = Math.max(40, Math.min(4000, f));
        gain.gain.setValueAtTime(0.0001, t0); gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
        osc.connect(gain); gain.connect(audio.destination); osc.start(t0); osc.stop(t0 + 1.6);
      } catch (e) { audio = null; }
    }
    function pluck() { ring = 0; swing = 1; phase = 0; judge = true; tries++; sound(freq()); }
    function check() {
      const f = freq(), d = model.cents(f, goal.hz), nt = model.note(f), v = model.speed(T, mu);
      if (goal.need && n !== goal.need) { ctx.say(`That was ${f.toFixed(0)} Hz with ${n} loop${n > 1 ? 's' : ''}. This goal needs harmonic ${goal.need}: set the number of loops to ${goal.need}, then tune again.`); return; }
      if (Math.abs(d) <= goal.tol) {
        ctx.say(`In tune! ${f.toFixed(1)} Hz is ${nt.name}. The wave runs along the string at ${v.toFixed(0)} m/s and fits ${n} half-wave${n > 1 ? 's' : ''} into ${L.toFixed(3)} m, so the string swings ${f.toFixed(0)} times every second.`);
        ctx.complete(Math.abs(d) <= goal.tol / 2 ? 1 : 0.8, `f=${f.toFixed(1)} Hz, ${d.toFixed(1)} cents, tries=${tries}`);
      } else if (d < 0) ctx.say(`${f.toFixed(0)} Hz is too low by ${Math.abs(d).toFixed(0)} cents. Make the string shorter or pull it tighter: both make it swing more times each second.`);
      else ctx.say(`${f.toFixed(0)} Hz is too high by ${d.toFixed(0)} cents. Make the string longer or loosen it a little: both make it swing fewer times each second.`);
    }
    ui.button('🎵 Pluck', pluck, 'btn');
    ui.note(`${goal.text} You are in tune within ${goal.tol} cents (100 cents is one piano key). ${canSound ? 'Pluck plays the note softly.' : 'Pluck shows the note; there is no sound here, so tune by the numbers.'}`);
    refresh();
    ctx.say(`${goal.text} Move a control, watch the frequency, then pluck the string.`);
    return {
      step(dt) {
        ring += dt; swing = ring < 30 ? Math.max(swing * Math.exp(-dt / 2.2), 0) : 0;
        if (judge && ring >= 1.2) { judge = false; check(); }
      },
      // The real string swings hundreds of times a second; the picture shows it a few hundred times slower.
      frame(dt) { if (swing < 0.004) return; phase += 2 * Math.PI * Math.max(0.6, Math.min(4, freq() / 220)) * (ctx.calm ? 0.5 : 1) * dt; draw(); },
      // Shows a successful run without the player (used by tests): the best length for a nearby tension, then a pluck.
      autoplay() {
        if (goal.need && harmS) { n = goal.need; harmS.set(n); }
        let best = null;
        for (let t = Math.max(20, T - 10); t <= Math.min(150, T + 10); t += 0.5) {
          const len = Math.max(0.25, Math.min(1, Math.round(model.length(goal.hz, t, mu, n) / 0.002) * 0.002)), off = Math.abs(model.cents(model.freq(len, t, mu, n), goal.hz));
          if (!best || off < best.off) best = { len: +len.toFixed(3), t, off };
        }
        L = best.len; T = best.t; lenS.set(L); tenS.set(T); refresh(); pluck();
      },
      dispose() { try { audio?.close?.(); } catch (e) { /* nothing to close */ } audio = null; },
      get frequency() { return freq(); },
    };
  },
};

export default {
  id: 14,
  theme: {
    sky: ['#6b3a7c', '#f0787a', '#ffc266'], fog: '#f29a78', fogNear: 55, fogFar: 185,
    ground: '#8fbf6a', ground2: '#a9d17e', side: '#a3503f', stone: '#f3d9c0', accent: '#e64980', glow: '#ffc46b', metal: '#b8862f', wood: '#8a4b2a', leaf: '#5fae5a', water: '#4fb8c4', crate: '#fd7e14',
    sun: '#ffb07a', sunPower: 2.3, ambient: 1.2, skyLight: '#ffd6c4', groundLight: '#8a3b4a', sunDir: [0.6, 0.5, 0.6], particles: 'notes',
  },
  layout: { mirror: -1, stones: 3, rise: 0.55, towerH: 4.5 },
  story: {
    title: 'The Twilight Concert Garden',
    crystal: 'tuning bells', crystalEm: '🔔',
    intro: ['Welcome to the Concert Garden! Tonight is our twilight concert, but the garden has gone quiet.', 'A gust of wind carried off our five tuning bells, and without them the great singing string is out of tune. Will you help us find them?'],
    remind: 'The tuning bells glow gold. One rings over the stepping stones, one floats in the lagoon, and one waits on top of the organ tower.',
    afterCrystals: 'All five bells! Now ride the lift from the organ tower to the console and tune the singing string.',
    afterSim: 'Listen: the string is in tune! Only the Academy Conductor is left. The arena is up the steps.',
    notReady: 'A concert needs practice first. Bring all five tuning bells and tune the singing string, then come back.',
    rival: ['So you tuned one string. A whole orchestra has hundreds of them!', 'Let us each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Bravo! Your bridge was finished first, and every answer rang true. The portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets once more, then come and try again.'],
    outro: 'The bells are home, the string sings, and the Academy Conductor has taken a bow. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, m = Math.sign(S.sim[0]) || 1;
    const brass = k.mat('#d9a441', { metalness: 0.7, roughness: 0.3 }), wood = k.mat('#8a4b2a'), cream = k.mat('#f3d9c0'), gold = k.lit('#ffc46b', 1.1);
    const set = (x, y, z, yaw = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; return k.add(g); };
    // a giant piano-key path from the middle of the home island to the gate (flat, so it never blocks the way)
    k.mesh(new THREE.BoxGeometry(2.2, 0.04, 7), k.mat('#fff6e6', { roughness: 0.5 }), 0, 0.02, 4).castShadow = false;
    for (const z of [1.2, 2.2, 4.2, 5.2, 6.2]) k.mesh(new THREE.BoxGeometry(1.3, 0.07, 0.45), k.mat('#3b2233', { roughness: 0.4 }), -0.45, 0.035, z).castShadow = false;
    // the bandstand
    const band = set(5, 0, -6);
    k.mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.3, 20), cream, 0, 0.15, 0, band);
    for (let i = 0; i < 4; i++) k.mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 8), wood, Math.cos(i * Math.PI / 2 + 0.8) * 1.3, 1.45, Math.sin(i * Math.PI / 2 + 0.8) * 1.3, band);
    k.mesh(new THREE.ConeGeometry(1.95, 0.9, 8), k.mat('#e64980', { flatShading: true }), 0, 3.05, 0, band);
    const finial = k.mesh(new THREE.SphereGeometry(0.2, 12, 10), gold, 0, 3.65, 0, band); finial.castShadow = false; finial.add(k.glow('#ffc46b', 2.2, 0.6));
    // two drums, a metronome and the stage lamps by the gate
    const skins = [[-7, -4.4, 0.75, 0.9, '#e64980'], [-6, -5.7, 0.5, 0.6, '#fd7e14']].map(([x, z, r, h, c]) => { k.mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 18), k.mat(c), x, h / 2, z); return { h, s: k.mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.06, 18), cream, x, h + 0.03, z) }; });
    const metro = set(7.4, 0, 0.4, -Math.PI / 2);
    k.mesh(new THREE.CylinderGeometry(0.15, 0.6, 1.8, 4), wood, 0, 0.9, 0, metro).rotation.y = Math.PI / 4;
    const pivot = new THREE.Group(); pivot.position.set(0, 0.4, 0.4); metro.add(pivot);
    k.mesh(new THREE.BoxGeometry(0.05, 1.5, 0.04), brass, 0, 0.75, 0, pivot); k.mesh(new THREE.BoxGeometry(0.2, 0.2, 0.08), gold, 0, 1.05, 0, pivot);
    k.prop('lamp', 4.6, 0, 7); k.prop('lamp', -4.6, 0, 7);
    // a harp and a rainbow xylophone on the middle island
    const mid = S.mid, harp = set(-3.4, mid[1], mid[2] - 3.4, 0.7);
    k.mesh(new THREE.BoxGeometry(2, 0.2, 0.6), wood, 0, 0.1, 0, harp);
    k.mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 10), brass, 0.8, 1.4, 0, harp);
    k.mesh(new THREE.BoxGeometry(1.68, 0.14, 0.14), brass, 0, 2.35, 0, harp).rotation.z = 0.303;
    k.mesh(new THREE.BoxGeometry(2.48, 0.16, 0.3), wood, 0, 1.15, 0, harp).rotation.z = -0.871;
    for (let i = 0; i < 5; i++) { const x = -0.5 + i * 0.26, top = 2.1 + (x + 0.8) / 1.6 * 0.5, bottom = 2.1 - (x + 0.8) / 1.6 * 1.9; k.mesh(new THREE.CylinderGeometry(0.014, 0.014, top - bottom, 5), gold, x, (top + bottom) / 2, 0, harp).castShadow = false; }
    const xylo = set(4.4, mid[1], mid[2] + 0.6, Math.PI / 2);
    for (const z of [-0.3, 0.3]) k.mesh(new THREE.BoxGeometry(2.1, 0.5, 0.08), wood, 0, 0.25, z, xylo);
    const bars = ['#e03131', '#fd7e14', '#fcc419', '#40c057', '#339af0', '#9c6ade'].map((c, i) => k.mesh(new THREE.BoxGeometry(0.26, 0.07, 1.5 - i * 0.13), k.mat(c, { roughness: 0.4 }), -0.85 + i * 0.34, 0.54, 0, xylo));
    // organ pipes of stepped heights on the front of the tower, either side of the ladder
    for (const sx of [-1, 1]) [3.6, 2.9, 2.2].forEach((h, i) => k.mesh(new THREE.CylinderGeometry(0.16, 0.16, h, 12), brass, sx * (1.15 + i * 0.45), S.far[1] + h / 2, S.far[2] + 0.72));
    // a big brass horn that points across the simulation floor, and a banner behind the console
    const hx = S.sim[0] + 6 * m, hz = S.sim[2] - 1, horn = set(hx, S.sim[1], hz, Math.atan2(-(S.pad[2] - hz), S.pad[0] - hx));
    k.mesh(new THREE.CylinderGeometry(0.1, 0.3, 1.1, 10), wood, 0, 0.55, 0, horn);
    const tilt = new THREE.Group(); tilt.position.y = 1.1; tilt.rotation.z = -0.75; horn.add(tilt);
    const bell = k.mesh(new THREE.CylinderGeometry(0.95, 0.1, 1.7, 24, 1, true), k.mat('#d9a441', { metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }), 0, 1.25, 0, tilt);
    k.mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 24), brass, 0, 0.1, 0, tilt); k.mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 8), brass, -0.4, -0.3, 0, tilt);
    k.prop('banner', S.sim[0] - 3.2 * m, S.sim[1], S.sim[2] - 5.8);
    // lamps for the arena and a low sun over the garden wall of the sky
    for (const a of [2.2, 5.4]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6, { color: '#ff8fa3' });
    const sun = k.mesh(new THREE.SphereGeometry(6, 24, 16), k.lit('#ffb347', 1.4, { fog: false }), 50, 16, 52); sun.castShadow = false; sun.add(k.glow('#ffb347', 30, 0.5));
    // floating notes drift beside the route
    const notes = [[4.5, 2.6, 13, '♪', '#ffc46b'], [-4.5, 3.2, 20, '♫', '#ff8fa3'], [4.5, 4, 27, '♪', '#fff1cf'], [5, 4.6, -6, '♫', '#ffc46b'], [-5, mid[1] + 3.4, mid[2] - 3.4, '♪', '#fff1cf'], [0, S.far[1] + 7.2, S.far[2] + 3.2, '♫', '#ffc46b'],
      [S.arena[0] - 5, S.arena[1] + 3.6, S.arena[2] - 3, '♪', '#ff8fa3'], [S.arena[0] + 5, S.arena[1] + 4, S.arena[2] + 3, '♫', '#fff1cf'], [S.end[0], S.end[1] + 5, S.end[2] - 3.4, '🎼', '#ffffff']]
      .map(([x, y, z, text, color], i) => { const s = k.sprite(text, { size: i === 8 ? 1.5 : 1.1, color }); s.position.set(x, y, z); k.add(s); return { s, y, i }; });
    k.animate((dt, t) => {
      pivot.rotation.z = Math.sin(t * 3.1) * 0.5;
      bars.forEach((b, i) => { b.position.y = 0.54 + Math.max(0, Math.sin(t * 3 - i * 0.9)) ** 6 * 0.1; });
      skins.forEach((d, i) => { d.s.position.y = d.h + 0.03 + Math.max(0, Math.sin(t * 6.2 + i * 2)) ** 8 * 0.03; });
      bell.scale.setScalar(1 + Math.sin(t * 2.4) * 0.025);
      for (const o of notes) { o.s.position.y = o.y + Math.sin(t * 1.2 + o.i * 1.7) * 0.3; o.s.material.rotation = Math.sin(t * 0.9 + o.i) * 0.2; }
    });
  },
  sim,
};
