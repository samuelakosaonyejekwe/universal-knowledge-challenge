// World 10 — World Languages: the Market of Many Voices.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.
// The same file serves every language path, so the scenery, story and simulation are about language itself.

// ----- the model: tongue height, tongue frontness and lip rounding (each 0…1) → the first two resonances -----
// Typical adult formant values in hertz, [F1, F2], at the eight corners of (height, frontness, rounding).
// The open central "a" is halfway between the two low unrounded corners: (700 + 800) / 2 = 750, (1000 + 1600) / 2 = 1300.
const CORNERS = {
  '000': [700, 1000], '010': [800, 1600], '100': [310, 1390], '110': [280, 2250],      // lips spread
  '001': [680, 880], '011': [780, 1450], '101': [310, 870], '111': [270, 1900],        // lips rounded
};
// [symbol, height, frontness, rounding, plain description]
const VOWELS = [
  ['i', 1, 1, 0, 'as in \'see\''],
  ['y', 1, 1, 1, 'an \'ee\' said with rounded lips; many languages use it, most English does not'],
  ['e', 0.65, 1, 0, 'close to the start of the vowel in \'say\''],
  ['ø', 0.65, 1, 1, 'like the start of \'say\', held steady with rounded lips'],
  ['ɛ', 0.35, 1, 0, 'as in \'bed\''],
  ['æ', 0.1, 1, 0, 'as in \'cat\''],
  ['a', 0, 0.5, 0, 'an open \'ah\', mouth wide and tongue low'],
  ['ə', 0.5, 0.5, 0, 'the relaxed sound at the start of \'about\''],
  ['ɑ', 0, 0, 0, 'as in \'father\' in many accents'],
  ['ɔ', 0.35, 0, 1, 'as in \'saw\' in many accents'],
  ['o', 0.65, 0, 1, 'close to the start of the vowel in \'go\' in some accents'],
  ['u', 1, 0, 1, 'as in \'too\''],
  ['ɯ', 1, 0, 0, 'an \'oo\' said with spread lips'],
];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const model = {
  CORNERS, VOWELS,
  // Straight-line (trilinear) blend between the eight corner values.
  formants(height, front, round) {
    const h = clamp01(height), f = clamp01(front), r = clamp01(round), out = [0, 0];
    for (const key in CORNERS) { const w = (key[0] === '1' ? h : 1 - h) * (key[1] === '1' ? f : 1 - f) * (key[2] === '1' ? r : 1 - r); out[0] += CORNERS[key][0] * w; out[1] += CORNERS[key][1] * w; }
    return out;
  },
  distance: (v, h, f, r) => Math.hypot(v[1] - h, v[2] - f, v[3] - r),
  nearest(h, f, r) { let best = VOWELS[0]; for (const v of VOWELS) if (model.distance(v, h, f, r) < model.distance(best, h, f, r)) best = v; return best; },
  vowel: (symbol) => VOWELS.find((v) => v[0] === symbol),
};
// Used by the automated tests: the corner settings give the corner values, a higher tongue always lowers F1,
// and rounder lips always lower F2.
export function selfTest() {
  const i = model.formants(1, 1, 0), a = model.formants(0, 0.5, 0), u = model.formants(1, 0, 1);
  const near = (p, f1, f2) => Math.abs(p[0] - f1) < 0.5 && Math.abs(p[1] - f2) < 0.5;
  let falls = true, rounds = true;
  for (let f = 0; f <= 1; f += 0.25) for (let r = 0; r <= 1; r += 0.25) for (let n = 0; n < 10; n++) if (model.formants((n + 1) / 10, f, r)[0] >= model.formants(n / 10, f, r)[0]) falls = false;
  for (let f = 0; f <= 1; f += 0.25) for (let h = 0; h <= 1; h += 0.25) for (let n = 0; n < 10; n++) if (model.formants(h, f, (n + 1) / 10)[1] >= model.formants(h, f, n / 10)[1]) rounds = false;
  const fmt = (p) => `${p[0].toFixed(0)}/${p[1].toFixed(0)} Hz`;
  return { ok: near(i, 280, 2250) && near(a, 750, 1300) && near(u, 310, 870) && falls && rounds && model.nearest(1, 1, 0)[0] === 'i' && model.nearest(1, 0, 1)[0] === 'u', detail: `i ${fmt(i)}, a ${fmt(a)}, u ${fmt(u)}; raising the tongue lowers F1: ${falls}; rounding lowers F2: ${rounds}` };
}

const sim = {
  title: 'The vowel machine',
  goal: 'Shape the machine\'s mouth: set how high the tongue is, how far forward it is and how round the lips are. Then press Say it and match the target vowel.',
  kind: 'simplified',
  model: 'A simplified picture of the mouth, not a full model of a voice. The first two resonances (formants F1 and F2) are found by a straight-line blend between typical adult values for the corner vowels: i about 280 / 2250 Hz, a about 750 / 1300 Hz and u about 310 / 870 Hz. A higher tongue lowers F1, a tongue further forward raises F2, and rounding the lips lowers F2. Real voices differ: children and smaller speakers have higher formants, every language and accent places its vowels a little differently, and real formants do not change in straight lines. It leaves out the third and higher resonances, the nose, the pitch and loudness of the voice, and all consonants. The Listen sound is a plain buzz passed through two filters, not a recording of a person.',
  mount(ctx) {
    const { THREE, group, ui } = ctx;
    const multi = ctx.level >= 3, tol = ctx.level <= 2 ? 0.34 : ctx.level <= 4 ? 0.22 : 0.15;
    const targets = (ctx.level <= 2 ? ['i'] : ctx.level <= 4 ? ['i', 'u', 'y'] : ['a', 'y', 'ø']).map(model.vowel);
    const pink = ctx.mat('#ff8fab', { roughness: 0.55 }), shell = ctx.mat('#845ef7', { roughness: 0.5 }), white = ctx.mat('#fff7ef', { roughness: 0.4 }), lipM = ctx.mat('#c2255c', { roughness: 0.45 });
    const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

    // the cut-away mouth, seen from the side with the lips on the left
    const head = new THREE.Group(); head.position.set(-1.7, 2.7, 0); group.add(head);
    add(new THREE.CylinderGeometry(0.2, 0.55, 1.3, 16), ctx.mat('#5b3f8c', { metalness: 0.4, roughness: 0.4 }), -1.7, 0.65, -0.3, group);
    add(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 40), shell, 0, 0.25, -0.5, head).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(1.8, 0.14, 0.7), pink, -0.05, 0.62, 0, head);                                   // roof of the mouth
    add(new THREE.BoxGeometry(0.12, 0.22, 0.6), white, -0.98, 0.45, 0, head);                                 // upper teeth
    add(new THREE.SphereGeometry(0.2, 14, 10), shell, -1.2, 0.9, 0, head);                                    // nose
    add(new THREE.SphereGeometry(0.09, 10, 8), ctx.mat('#2b1b4d'), -0.75, 1.2, -0.38, head);                  // eye
    add(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 14), pink, 0.92, -0.45, 0, head);                           // throat
    const buzz = add(new THREE.SphereGeometry(0.13, 12, 8), ctx.lit('#ffd43b', 1.5), 0.92, -1.05, 0.2, head); // the voice box: where the buzz starts
    const upLip = add(new THREE.SphereGeometry(0.15, 14, 10), lipM, -1.2, 0.42, 0, head);
    const jaw = new THREE.Group(); jaw.position.set(0.8, 0.3, 0); head.add(jaw);
    add(new THREE.BoxGeometry(1.7, 0.14, 0.7), pink, -0.95, -0.5, 0, jaw);
    add(new THREE.BoxGeometry(0.12, 0.22, 0.6), white, -1.78, -0.32, 0, jaw);
    add(new THREE.BoxGeometry(0.14, 0.6, 0.7), shell, -0.12, -0.25, 0, jaw);
    const loLip = add(new THREE.SphereGeometry(0.15, 14, 10), lipM, -2.0, -0.14, 0, jaw);
    add(new THREE.SphereGeometry(0.28, 14, 10), pink, 0.5, -0.3, 0, head);                                    // tongue root
    const tongue = add(new THREE.SphereGeometry(0.3, 20, 14), ctx.mat('#f06595', { roughness: 0.5 }), 0, 0, 0, head); tongue.scale.set(1.5, 0.8, 1);
    const waves = [0, 1, 2].map(() => { const w = add(new THREE.TorusGeometry(0.3, 0.025, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd6f0, transparent: true, opacity: 0, depthWrite: false }), -1.5, 0.3, 0, head); w.rotation.y = Math.PI / 2; return w; });

    // the vowel chart: left–right is front–back, up–down is tongue height, and the near face is rounded lips
    const chart = new THREE.Group(); chart.position.set(2.0, 2.6, 0); group.add(chart);
    const at = (h, f, r) => new THREE.Vector3(1.1 - f * (2.2 - (1 - h) * 0.7), (h - 0.5) * 1.8, (r - 0.5) * 1.2);
    const edges = []; const edge = (a, b) => edges.push(at(...a), at(...b));
    for (const r of [0, 1]) { edge([1, 1, r], [1, 0, r]); edge([1, 0, r], [0, 0, r]); edge([0, 0, r], [0, 1, r]); edge([0, 1, r], [1, 1, r]); }
    for (const [h, f] of [[1, 1], [1, 0], [0, 0], [0, 1]]) edge([h, f, 0], [h, f, 1]);
    chart.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges), new THREE.LineBasicMaterial({ color: 0xffe3f1, transparent: true, opacity: 0.8 })));
    for (const [symbol, dx, dy] of [['i', -0.28, 0.25], ['y', -0.28, 0.25], ['u', 0.28, 0.25], ['a', 0, -0.3]]) { const v = model.vowel(symbol), s = ctx.sprite(symbol, { size: 0.42 }); s.position.copy(at(v[1], v[2], v[3])); s.position.x += dx; s.position.y += dy; chart.add(s); }
    const mark = add(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xb197fc, transparent: true, opacity: 0.28, depthWrite: false }), 0, 0, 0, chart); mark.scale.setScalar(tol * 1.5);
    const dot = add(new THREE.SphereGeometry(0.09, 14, 10), ctx.lit('#ffd43b', 1.7), 0, 0, 0, chart); dot.add(ctx.glow('#ffd43b', 0.7, 0.9));

    let h = 0.5, f = 0.5, r = 0, ch = h, cf = f, cr = r;                 // chosen shape, and the shape the model is showing
    let state = 'ready', timer = 0, wave = 0, done = 0, tries = 0, auto = false;
    const hS = ui.slider({ label: 'Tongue height (0 low, 100 high)', min: 0, max: 100, step: 5, value: 50, unit: '%', onInput: (v) => { h = v / 100; show(); } });
    const fS = ui.slider({ label: 'Tongue position (0 back, 100 front)', min: 0, max: 100, step: 5, value: 50, unit: '%', onInput: (v) => { f = v / 100; show(); } });
    const rS = ui.slider({ label: 'Lip rounding (0 spread, 100 round)', min: 0, max: 100, step: 5, value: 0, unit: '%', onInput: (v) => { r = v / 100; show(); } });
    const rF1 = ui.readout('F1, Hz'), rF2 = ui.readout('F2, Hz'), rNear = ui.readout('Nearest vowel'), rTarget = ui.readout('Target vowel'), rDone = ui.readout('Sounds matched');
    function show() { const p = model.formants(h, f, r), v = model.nearest(h, f, r); rF1.set(p[0].toFixed(0)); rF2.set(p[1].toFixed(0)); rNear.set(`${v[0]} — ${v[4]}`); }
    const pose = () => {
      jaw.rotation.z = 0.03 + (1 - ch) * 0.3;
      tongue.position.set(0.3 - cf * 0.8, -0.12 + ch * 0.36, 0); tongue.rotation.z = (0.5 - cf) * 0.35;
      for (const [lip, x] of [[upLip, -1.2], [loLip, -2.0]]) { lip.position.x = x - cr * 0.16; lip.scale.set(1 + cr * 0.4, 1, 1.7 - cr * 1.0); }
      dot.position.copy(at(ch, cf, cr));
    };
    const aim = () => {
      const v = targets[done], p = model.formants(v[1], v[2], v[3]);
      mark.position.copy(at(v[1], v[2], v[3])); rTarget.set(`${v[0]} — ${v[4]} (about ${p[0].toFixed(0)} / ${p[1].toFixed(0)} Hz)`); rDone.set(`${done} of ${targets.length}`);
    };
    // Why the two resonances came out as they did.
    const why = () => {
      const p = model.formants(h, f, r), high = h > 0.66, low = h < 0.34, fore = f > 0.66, back = f < 0.34;
      return `The tongue is ${high ? 'high' : low ? 'low' : 'halfway up'} and ${fore ? 'at the front' : back ? 'at the back' : 'in the middle'}, with ${r > 0.5 ? 'rounded' : 'spread'} lips. `
        + `${high ? 'A high tongue leaves little room above it, so F1 is low' : low ? 'A low tongue and an open jaw make F1 high' : 'A half-open mouth puts F1 in the middle'} (${p[0].toFixed(0)} Hz). `
        + `${fore ? 'A tongue pushed forward leaves only a small space in front of it, so F2 is high' : back ? 'A tongue pulled back leaves a big space in front of it, so F2 is low' : 'A tongue in the middle puts F2 in the middle'}${r > 0.5 ? ', and round lips make the tube longer, which lowers F2 even more' : ''} (${p[1].toFixed(0)} Hz).`;
    };
    // Which change would bring the sound closest to the target.
    const hint = (v) => {
      const d = [v[1] - h, v[2] - f, v[3] - r], n = d.map(Math.abs), k = n.indexOf(Math.max(...n));
      return [['Raise the tongue: a higher tongue lowers F1.', 'Lower the tongue and open the jaw: that raises F1.'], ['Move the tongue forward: that raises F2.', 'Pull the tongue back: that lowers F2.'], ['Round the lips more: that lowers F2.', 'Spread the lips: that raises F2.']][k][d[k] > 0 ? 0 : 1];
    };

    // A short two-formant buzz. Everything is guarded, so the machine also works with no sound at all.
    const canHear = typeof AudioContext !== 'undefined' && !ctx.calm;
    let ac = null;
    const quiet = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };
    const listen = () => {
      if (!canHear) return;
      try {
        ac = ac || new AudioContext(); if (ac.state === 'suspended') quiet(ac.resume());
        const p = model.formants(h, f, r), t0 = ac.currentTime + 0.02, osc = ac.createOscillator(), out = ac.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(130, t0); osc.frequency.linearRampToValueAtTime(108, t0 + 0.7);
        out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(0.3, t0 + 0.06); out.gain.setValueAtTime(0.3, t0 + 0.5); out.gain.linearRampToValueAtTime(0, t0 + 0.7);
        for (const [freq, level] of [[p[0], 1], [p[1], 0.6]]) { const band = ac.createBiquadFilter(), g = ac.createGain(); band.type = 'bandpass'; band.frequency.value = freq; band.Q.value = 9; g.gain.value = level; osc.connect(band); band.connect(g); g.connect(out); }
        out.connect(ac.destination); osc.start(t0); osc.stop(t0 + 0.75);
      } catch (e) { /* no sound on this device: the pictures and numbers still tell the story */ }
    };
    const speak = () => { if (state !== 'ready') return; state = 'speak'; timer = ctx.calm ? 0.2 : 0.7; wave = 1; tries++; listen(); };
    const judge = () => {
      const v = targets[done], near = model.nearest(h, f, r);
      if (model.distance(v, h, f, r) > tol) { state = 'ready'; ctx.say(`Not quite: that was closest to ${near[0]} (${near[4]}). ${hint(v)}`); return; }
      done++; rDone.set(`${done} of ${targets.length}`);
      if (done < targets.length) { state = 'ready'; aim(); ctx.say(`That is ${v[0]}! ${why()} Next: ${targets[done][0]}, ${targets[done][4]}.`); return; }
      state = 'done'; mark.visible = false;
      ctx.say(`That is ${v[0]}! ${why()} Every language picks its own set of mouth shapes like these.`);
      ctx.complete(Math.max(0.6, 1 - 0.1 * (tries - targets.length)), `targets=${targets.length}, tries=${tries}, tol=${tol}`);
    };
    const setAll = (v) => { hS.set(Math.round(v[1] * 100)); fS.set(Math.round(v[2] * 100)); rS.set(Math.round(v[3] * 100)); h = v[1]; f = v[2]; r = v[3]; show(); };
    ui.button('🗣️ Say it', speak, 'btn');
    if (canHear) ui.button('🔊 Listen', listen);
    ui.note('Your voice box makes a buzz. The shape of your mouth changes which parts of the buzz ring loudest: those are the resonances F1 and F2. On the chart, left is tongue forward, up is tongue high, and the near side is rounded lips.');
    if (multi) ui.note('Match three vowels in a row. One of them needs the tongue at the front and the lips rounded at the same time.');
    show(); aim(); pose();
    ctx.say(`Move the tongue and the lips, then press Say it. First target: ${targets[0][0]}, ${targets[0][4]}.`);
    return {
      step(dt) {
        if (state === 'speak') { timer -= dt; if (timer <= 0) judge(); }
        else if (auto && state === 'ready') { setAll(targets[done]); speak(); }
      },
      frame(dt, time) {
        const a = ctx.calm ? 1 : Math.min(1, dt * 7); ch += (h - ch) * a; cf += (f - cf) * a; cr += (r - cr) * a; pose();
        if (wave > 0) wave = Math.max(0, wave - dt * 1.4);
        waves.forEach((w, i) => { const q = (1 - wave) + i * 0.22; w.position.x = -1.5 - q * 0.6; w.scale.setScalar(0.6 + q * 1.3); w.material.opacity = wave > 0 ? Math.max(0, 0.75 - q * 0.6) * wave : 0; });
        if (!ctx.calm) buzz.scale.setScalar(1 + Math.sin(time * 24) * (state === 'speak' ? 0.3 : 0.06));
      },
      // Shows a successful run without the player (used by tests): shapes each target in turn and says it.
      autoplay() { auto = true; if (state === 'ready') { setAll(targets[done]); speak(); } },
      dispose() { auto = false; try { if (ac) quiet(ac.close()); } catch (e) { /* nothing to close */ } ac = null; },
      get state() { return state; },
    };
  },
};

export default {
  id: 10,
  theme: {
    sky: ['#7d6cf2', '#f5a3c4', '#ffdca8'], fog: '#f3b3cd', fogNear: 55, fogFar: 185,
    ground: '#dc8fae', ground2: '#eaa9c2', side: '#7a4a8f', stone: '#f3e1ea', accent: '#c2255c', glow: '#ff9ed2', metal: '#5b3f8c', wood: '#a8643c', leaf: '#58b88a', water: '#6fb8e8', crate: '#845ef7',
    sun: '#ffd9b0', sunPower: 2.3, ambient: 1.3, skyLight: '#ffe3f1', groundLight: '#7a4a8f', sunDir: [-0.7, 0.45, 0.5], particles: 'notes',
  },
  layout: { mirror: -1, stones: 5, rise: 0.4, towerH: 4.5 },
  story: {
    title: 'The Market of Many Voices',
    crystal: 'word lanterns', crystalEm: '🏮',
    intro: ['Welcome to the Market of Many Voices! Every sunrise, travellers climb our hill from far and near.', 'Today the five word lanterns that help them understand each other have blown away, and our vowel machine has gone quiet. Will you help?'],
    remind: 'The word lanterns glow rose pink. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five lanterns! Now ride the lift from the tower to the vowel machine and help it make the sounds the travellers need.',
    afterSim: 'The machine is speaking clearly again. Only the Master of the Market is left — the arena is up the steps.',
    notReady: 'The arena is for those who have done the work. Bring all five word lanterns and wake the vowel machine first.',
    rival: ['So you made a machine say a sound. Making sounds is easy. Making sense is harder.', 'We each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge reached the far side first. You listened well and you thought well — the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets once more, then come back and try again.'],
    outro: 'The lanterns are lit, the travellers are chatting happily, and the Master of the Market has bowed. Your Language Passport has a new stamp, and the lesson is ready whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, rose = '#c2255c', violet = '#845ef7', gold = k.mat('#e8b84a', { metalness: 0.6, roughness: 0.3 });
    const group = (x, y, z) => { const g = k.add(new THREE.Group()); g.position.set(x, y, z); return g; };
    // A string of plain coloured flags from (ax, y, az) to (bx, y, bz): one mesh, swaying about its own line.
    const flagColors = ['#c2255c', '#845ef7', '#ffd43b', '#ff8fab', '#38d9a9', '#fff7ef'].map((c) => new THREE.Color(c));
    const bunting = (ax, y, az, bx, bz, n, sag = 0.5) => {
      const L = Math.hypot(bx - ax, bz - az), drop = (t) => -sag * 4 * t * (1 - t), pos = [], colors = [], line = [];
      for (let i = 0; i < n; i++) {
        const t0 = (i + 0.12) / n, t1 = (i + 0.88) / n, c = flagColors[i % flagColors.length];
        pos.push(t0 * L, drop(t0), 0, t1 * L, drop(t1), 0, (t0 + t1) / 2 * L, (drop(t0) + drop(t1)) / 2 - 0.42, 0);
        for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b);
      }
      for (let i = 0; i <= 16; i++) line.push(new THREE.Vector3(i / 16 * L, drop(i / 16), 0));
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
      const m = k.mesh(geo, k.mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), ax, y, az); m.castShadow = false;
      m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(-(bz - az), bx - ax);
      m.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: 0x5b3f8c })));
      k.animate((dt, t) => { m.rotation.x = Math.sin(t * 1.3 + ax) * 0.09; });
    };
    // A market stall: a counter to walk around, two posts and a sloping awning.
    const stall = (x, z, color) => {
      k.block(x, 0.9, z, 2.2, 0.9, 1.0, { color: k.theme.wood });
      for (const sx of [-1, 1]) k.mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.3, 6), k.mat(k.theme.metal), x + sx, 1.65, z - 0.45);
      k.mesh(new THREE.BoxGeometry(2.6, 0.08, 1.7), k.mat(color, { roughness: 0.9 }), x, 2.55, z + 0.25).rotation.x = 0.25;
    };

    // the market square on the home island: two stalls, flags, the bell tower, lanterns and a post box
    stall(-5.8, -5.8, rose); stall(5.6, -6.0, violet);
    bunting(-4.8, 3.3, -6.25, 4.6, -6.45, 13);
    k.prop('tower', 7.2, 0, 0.6, { solid: true });
    k.mesh(new THREE.BoxGeometry(1.3, 0.1, 0.1), k.mat(k.theme.metal), 6.1, 3.4, 0.6);
    const bell = group(5.6, 3.4, 0.6);
    k.mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, -0.75, 0, bell).scale.y = 1.4;
    k.animate((dt, t) => { bell.rotation.z = Math.sin(t * 1.8) * 0.22; });
    k.prop('lamp', -3.8, 0, 7.0, { color: '#ffd9a0' }); k.prop('lamp', -7.6, 0, -1.6, { color: '#ffd9a0' });
    k.mesh(new THREE.CylinderGeometry(0.32, 0.34, 1.1, 14), k.mat(rose, { roughness: 0.5 }), 3.6, 0.55, 7.3);
    k.mesh(new THREE.SphereGeometry(0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), k.mat(rose, { roughness: 0.5 }), 3.6, 1.1, 7.3).scale.y = 0.6;
    k.mesh(new THREE.BoxGeometry(0.3, 0.05, 0.04), k.mat('#2b1b4d'), 3.6, 0.85, 6.97);

    // the middle island: a giant open book, a globe that turns, and flags strung from the pendulum post
    const mid = S.mid, cream = k.mat('#fff7ef', { roughness: 0.9 });
    k.block(-4.0, mid[1] + 0.5, mid[2] - 3.4, 1.7, 0.5, 1.1);
    for (const sx of [-1, 1]) k.mesh(new THREE.BoxGeometry(0.85, 0.07, 1.0), cream, -4.0 + sx * 0.4, mid[1] + 0.66, mid[2] - 3.4).rotation.z = sx * 0.3;
    k.mesh(new THREE.CylinderGeometry(0.08, 0.22, 1.1, 8), k.mat(k.theme.metal), 4.7, mid[1] + 0.55, mid[2] + 0.6);
    const globe = k.mesh(new THREE.SphereGeometry(0.55, 24, 16), k.mat('#5aa9e6', { roughness: 0.5 }), 4.7, mid[1] + 1.7, mid[2] + 0.6); globe.rotation.order = 'ZYX'; globe.rotation.z = 0.41;
    for (const [lon, lat, sz] of [[0.5, 0.4, 0.26], [3.4, -0.3, 0.3]]) { const d = 0.58 - sz; k.mesh(new THREE.SphereGeometry(sz, 10, 8), k.mat('#58b88a', { roughness: 0.9 }), Math.cos(lat) * Math.cos(lon) * d, Math.sin(lat) * d, Math.cos(lat) * Math.sin(lon) * d, globe); }
    k.mesh(new THREE.TorusGeometry(0.66, 0.03, 6, 32), gold, 4.7, mid[1] + 1.7, mid[2] + 0.6).rotation.z = 0.41;
    k.animate((dt) => { globe.rotation.y += dt * 0.5; });
    k.mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.7, 8), k.mat(k.theme.stone), -5.4, mid[1] + 1.85, mid[2] - 0.6);
    bunting(-5.4, mid[1] + 3.7, mid[2] - 0.6, 4.6, mid[2] - 3.2, 12, 0.6);

    // the far island: two speech-bubble sculptures that bob as if they were chatting
    [[4.6, -2.2, rose, 0.5], [-5.0, -1.0, violet, -0.5]].forEach(([x, dz, color, yaw], i) => {
      const g = group(x, S.far[1], S.far[2] + dz); g.rotation.y = yaw;
      k.mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.9, 8), k.mat(k.theme.metal), 0, 0.95, 0, g);
      const b = new THREE.Group(); g.add(b);
      k.mesh(new THREE.SphereGeometry(0.62, 20, 14), k.mat(color, { roughness: 0.4 }), 0, 2.45, 0, b).scale.set(1.25, 0.9, 0.5);
      const tail = k.mesh(new THREE.ConeGeometry(0.2, 0.5, 4), k.mat(color, { roughness: 0.4 }), -0.4, 1.9, 0, b); tail.rotation.z = Math.PI - 0.5; tail.scale.z = 0.5;
      k.animate((dt, t) => { b.position.y = Math.sin(t * 1.5 + i * 2.2) * 0.12; });
    });

    // the simulation island: a horn that plays to the square, and a banner (the floor in front of the console stays clear)
    const horn = group(S.sim[0] + 3, S.sim[1], S.sim[2] - 5.8);
    k.mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), k.mat(k.theme.wood), 0, 0.25, 0, horn);
    k.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), gold, 0, 0.7, -0.17, horn);
    const bellMouth = k.mesh(new THREE.ConeGeometry(0.75, 1.3, 24, 1, true), k.mat('#e8b84a', { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }), 0, 1.25, 0.35, horn); bellMouth.rotation.x = -2.214;
    k.animate((dt, t) => { bellMouth.scale.setScalar(1 + Math.sin(t * 6) * 0.025); });
    k.prop('banner', S.sim[0] - 6.2, S.sim[1], S.sim[2] - 2.6, { color: violet });

    // the arena and the portal island
    for (const a of [0.6, 2.2]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6, { color: '#ffd9a0' });
    k.prop('banner', S.arena[0] + Math.cos(3.9) * 6, S.arena[1], S.arena[2] + Math.sin(3.9) * 6, { color: rose }); k.prop('banner', S.arena[0] + Math.cos(5.4) * 6, S.arena[1], S.arena[2] + Math.sin(5.4) * 6, { color: violet });
    for (const sx of [-1, 1]) k.prop('lamp', S.end[0] + sx * 3.6, S.end[1], S.end[2] - 1.5, { color: '#ffd9a0' });

    // a sunrise cloud, and paper lanterns drifting over the route
    k.prop('cloud', 14, 13, 36, { s: 1.7, color: '#ffc9de' });
    const lanterns = [[9, 7, 15, '#ffd43b'], [-10, 9.5, 42, '#ff8fab'], [-27, 13, 64, '#b197fc']].map(([x, y, z, c], i) => { const m = k.mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.55, 8), k.lit(c, 1.3), x, y, z); m.castShadow = false; m.add(k.glow(c, 2.2, 0.6)); return { m, y, i }; });
    k.animate((dt, t) => { for (const l of lanterns) { l.m.position.y = l.y + Math.sin(t * 0.6 + l.i * 1.9) * 0.6; l.m.rotation.y += dt * 0.3; } });
  },
  sim,
};
