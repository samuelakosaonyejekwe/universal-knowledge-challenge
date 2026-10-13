// Groove Builder in 3D: a tilted turntable with four rings of drum pads (one ring per sound, eight steps round the
// bar), a play-head arm that sweeps round once per bar, and four instruments that jump when they are hit.
// With swing, the off-beat pads really slide later round the ring. No imports: everything arrives through ctx.

// One bar of 4/4 split into 8 eighth-notes: steps 0 2 4 6 are beats 1 2 3 4, steps 1 3 5 7 are the "ands".
const ROWS = [['hat', '🥢', 'Cymbal', '#ffc46b', '#7d6435', 1.95], ['snare', '🥁', 'Snare', '#ff5c93', '#70253f', 1.6],
  ['kick', '🦶', 'Kick', '#4d94ff', '#1f4079', 1.25], ['chop', '🎸', 'Chop', '#3fd07f', '#175c3a', 0.9]];
const COUNT = ['1', '+', '2', '+', '3', '+', '4', '+'];
export const GROOVES = [
  { id: 'rock', name: 'Rock backbeat', bpm: [100, 120, 150], swing: 50,
    recipe: 'Kick on beats 1 and 3, snare on beats 2 and 4 (the backbeat), cymbal on every eighth.',
    why: 'The snare on 2 and 4 is the backbeat: it answers the kick on 1 and 3 and makes you clap along.',
    pat: { hat: [0, 1, 2, 3, 4, 5, 6, 7], snare: [2, 6], kick: [0, 4], chop: [] },
    need: { snare: [2, 6], kick: [0, 4] }, sw: [50, 56] },
  { id: 'reggae', name: 'Reggae off-beat', bpm: [75, 80, 96], swing: 50,
    recipe: 'Guitar chop on every "and" (the off-beats). Kick and snare together only on beat 3: the "one drop". Leave beat 1 empty.',
    why: 'Reggae leaves beat 1 empty and puts the chop between the beats, so the music seems to bounce.',
    pat: { hat: [0, 2, 4, 6], snare: [4], kick: [4], chop: [1, 3, 5, 7] },
    need: { chop: [1, 3, 5, 7], kick: [4], snare: [4] }, sw: [50, 56] },
  { id: 'swing', name: 'Jazz swing', bpm: [100, 120, 150], swing: 67,
    recipe: 'Ride cymbal: "ding, ding-ga, ding, ding-ga" — beats 1, 2, the "and" of 2, 3, 4, the "and" of 4. Then slide Swing up to about 67 %.',
    why: 'With swing, each beat is split long–short (about 2 : 1) instead of evenly, which gives jazz its lilt.',
    pat: { hat: [0, 2, 3, 4, 6, 7], snare: [], kick: [0, 4], chop: [] },
    need: { hat: [0, 2, 3, 4, 6, 7] }, sw: [60, 72] },
];
const same = (set, arr) => set.size === arr.length && arr.every((x) => set.has(x));
// Time of step i within the bar, in seconds: the off-beat eighth is delayed by the swing ratio.
export const stepTime = (i, bpm, swing) => (60 / bpm) * (Math.floor(i / 2) + (i % 2 ? swing / 100 : 0));
// Which rows of the grid do not match the groove, and whether the swing is in its range.
export const judge = (target, grid, swing) => ({ wrong: Object.entries(target.need).filter(([id, arr]) => !same(grid[id], arr)).map(([id]) => id), swOk: swing >= target.sw[0] && swing <= target.sw[1] });

// Used by the automated tests. By hand: at 120 BPM a beat is 0.5 s and a bar 2 s; the first "and" comes at 0.25 s
// when even and 0.335 s with 67 % swing; step 7 at 100 BPM is 0.6 × 3.5 = 2.1 s.
export function selfTest() {
  const near = (a, b) => Math.abs(a - b) < 1e-9, sets = (p) => Object.fromEntries(ROWS.map(([id]) => [id, new Set(p[id] || [])]));
  const [rock, , jazz] = GROOVES, r1 = judge(rock, sets(rock.pat), 50), r2 = judge(rock, sets({ ...rock.pat, snare: [2] }), 50), j1 = judge(jazz, sets(jazz.pat), 50), j2 = judge(jazz, sets(jazz.pat), 67);
  const ok = near(stepTime(1, 120, 50), 0.25) && near(stepTime(1, 120, 67), 0.335) && near(stepTime(2, 120, 67), 0.5) && near(stepTime(7, 100, 50), 2.1) && near(240 / 120, 2)
    && near(stepTime(3, 120, 67) - stepTime(2, 120, 67), 0.335) && near(stepTime(4, 120, 67) - stepTime(3, 120, 67), 0.165)
    && !r1.wrong.length && r1.swOk && r2.wrong.join() === 'snare' && !j1.swOk && j2.swOk && !j2.wrong.length;
  return { ok, detail: `120 BPM: bar ${(240 / 120).toFixed(2)} s, first "and" at ${stepTime(1, 120, 50).toFixed(3)} s even and ${stepTime(1, 120, 67).toFixed(3)} s with 67 % swing (by hand 0.250 and 0.335); step 8 at 100 BPM ${stepTime(7, 100, 50).toFixed(2)} s (by hand 2.10)` };
}

// Soft tones only: a 15 ms fade-in, a smooth fade-out, and silence in calm mode or where there is no sound system.
function makeSound(ctx) {
  const can = typeof AudioContext !== 'undefined' && !ctx.calm; let ac = null;
  return {
    can,
    tone(f0, { f1 = f0, vol = 0.06, dur = 0.2, type = 'sine' } = {}) {
      if (!can) return;
      try {
        ac = ac || new AudioContext(); if (ac.state === 'suspended') ac.resume();
        const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + 0.01;
        o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); g.gain.linearRampToValueAtTime(0, t0 + dur + 0.02);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { ac = null; }
    },
    close() { try { ac?.close?.(); } catch (e) { /* nothing to close */ } ac = null; },
  };
}

export default {
  id: 'w14-rhythm',
  world: 14,
  levels: [3, 4],
  title: 'Groove Builder',
  goal: 'Build the named groove on the turntable so that it matches the one you hear. Switch pads on, set the swing, then check.',
  kind: 'validated',
  model: 'One bar of eight eighth-notes. A beat lasts 60 ÷ BPM seconds and a bar of four beats 240 ÷ BPM seconds; with swing, the off-beat arrives the swing percentage of the way through its beat, and the pads sit round the turntable exactly where they fall in time. The drum sounds are soft, simple electronic tones. Real grooves vary from bar to bar, use many more sounds, and musicians count reggae and swing in more than one way.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, lvl = ctx.level, snd = makeSound(ctx);
    const tr = typeof ctx.t === 'function' ? ctx.t : (x) => x, tap = (o, fn) => ctx.onTap?.(o, fn);
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    const wood = ctx.mat('#8a4b2a', { roughness: 0.7 }), plum = ctx.mat('#3b2233', { roughness: 0.5 }), brass = ctx.mat('#d9a441', { metalness: 0.7, roughness: 0.3 }), cream = ctx.mat('#f3d9c0');
    const made = [];
    const text = (s, size, color) => { const o = ctx.sprite(s, { size, color: color || '#ffffff' }); made.push(o); return o; };

    // ----- the turntable -----
    add(new THREE.CylinderGeometry(1.0, 1.15, 0.16, 24), wood, 0, 0.08, -0.5);
    add(new THREE.CylinderGeometry(0.28, 0.4, 2.6, 14), wood, 0, 1.3, -0.5);
    const deck = new THREE.Group(); deck.position.set(0, 2.35, 0); deck.rotation.x = 1.0; group.add(deck);
    add(new THREE.CylinderGeometry(2.45, 2.45, 0.14, 48), plum, 0, -0.07, 0, deck);
    add(new THREE.TorusGeometry(2.45, 0.05, 8, 48), brass, 0, 0, 0, deck).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.3, 0.36, 0.3, 20), brass, 0, 0.15, 0, deck);
    const arm = new THREE.Group(); arm.position.y = 0.26; deck.add(arm);
    add(new THREE.BoxGeometry(0.07, 0.07, 2.3), ctx.lit('#fff1cf', 1.5), 0, 0, -1.15, arm);
    const tip = add(new THREE.SphereGeometry(0.11, 14, 10), ctx.lit('#ffc46b', 1.8), 0, 0, -2.3, arm); tip.add(ctx.glow('#ffc46b', 0.7, 0.8));
    const padGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 18), white = ctx.lit('#ffffff', 1.6);
    const grid = Object.fromEntries(ROWS.map(([id]) => [id, new Set()])), pads = {};
    for (const [id, , , colour, dark, r] of ROWS) {
      const on = ctx.lit(colour, 1.1), off = ctx.mat(dark, { roughness: 0.5 });
      pads[id] = COUNT.map((c, i) => {
        const mesh = add(padGeo, off, 0, 0.06, 0, deck); if (i % 2 === 0) mesh.scale.set(1.15, 1, 1.15);
        tap(mesh, () => toggle(id, i));
        return { mesh, on, off, r, v: 0, flash: 0 };
      });
    }
    const counts = COUNT.map((c, i) => { const s = text(c, i % 2 ? 0.28 : 0.4, i % 2 ? '#fff1cf' : '#ffc46b'); deck.add(s); return s; });
    // Puts every pad where its step falls in time: an off-beat with 67 % swing sits two thirds of the way to the next beat.
    function layout(sw) {
      for (let i = 0; i < 8; i++) {
        const a = 2 * Math.PI * (Math.floor(i / 2) + (i % 2 ? sw / 100 : 0)) / 4, sx = Math.sin(a), cz = -Math.cos(a);
        for (const [id] of ROWS) { const p = pads[id][i]; p.mesh.position.x = sx * p.r; p.mesh.position.z = cz * p.r; }
        counts[i].position.set(sx * 2.25, 0.2, cz * 2.25);
      }
    }

    // ----- the four instruments, each in the colour of its ring -----
    const inst = {};
    { const g = new THREE.Group(); g.position.set(-3.05, 0, 1.7); group.add(g); add(new THREE.CylinderGeometry(0.03, 0.05, 1.3, 8), brass, 0, 0.65, 0, g);
      inst.hat = { g, part: add(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), ctx.mat('#ffc46b', { metalness: 0.7, roughness: 0.3 }), 0, 1.32, 0, g), v: 0 }; }
    { const g = new THREE.Group(); g.position.set(-1.95, 0, 2.05); group.add(g); add(new THREE.CylinderGeometry(0.05, 0.2, 0.5, 8), brass, 0, 0.25, 0, g);
      inst.snare = { g, part: add(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 20), ctx.mat('#ff5c93', { roughness: 0.4 }), 0, 0.65, 0, g), v: 0 }; add(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 20), cream, 0, 0.16, 0, inst.snare.part); }
    { const g = new THREE.Group(); g.position.set(1.95, 0, 2.05); group.add(g);
      inst.kick = { g, part: add(new THREE.CylinderGeometry(0.48, 0.48, 0.42, 24), ctx.mat('#4d94ff', { roughness: 0.4 }), 0, 0.48, 0, g), v: 0 }; inst.kick.part.rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 24), cream, 0, 0.215, 0, inst.kick.part); }
    { const g = new THREE.Group(); g.position.set(3.05, 0, 1.7); group.add(g);
      inst.chop = { g, part: add(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 20), ctx.mat('#3fd07f', { roughness: 0.4 }), 0, 0.42, 0, g), v: 0 }; inst.chop.part.rotation.x = Math.PI / 2; add(new THREE.BoxGeometry(0.1, 0.14, 0.7), wood, 0, 0, -0.7, inst.chop.part); }
    ROWS.forEach(([id, icon]) => { const s = text(icon, 0.34); s.position.set(0, id === 'hat' ? 1.75 : id === 'chop' ? 1.75 : 1.2, 0); inst[id].g.add(s); });
    const sign = new THREE.Group(); sign.position.set(0, 4.75, -1.3); group.add(sign);

    let playing = null, barPos = 0, prev = -1, done = false, tries = 0, target = GROOVES[0], predicted = false, row = 'hat', shown = 50, gi = 0, bpmGoal = 100;
    const order = GROOVES.map((g) => [ctx.rng(), g]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

    const hit = {
      hat: () => snd.tone(5200, { type: 'triangle', vol: 0.03, dur: 0.07 }),
      snare: () => { snd.tone(190, { f1: 140, type: 'triangle', vol: 0.1, dur: 0.14 }); snd.tone(930, { f1: 700, type: 'triangle', vol: 0.03, dur: 0.1 }); },
      kick: () => snd.tone(150, { f1: 45, type: 'sine', vol: 0.16, dur: 0.24 }),
      chop: () => { for (const f of [220, 277.18, 329.63]) snd.tone(f, { type: 'triangle', vol: 0.04, dur: 0.11 }); },   // a short A major chord
    };
    const strike = (id, i, ghost) => { hit[id](); inst[id].v = 1; const p = pads[id][i]; p.v = 1; if (ghost) p.flash = 0.2; };

    const rGoal = ui.readout('Groove');
    const tempoS = ui.slider({ label: 'Tempo', min: 60, max: 180, step: 1, value: 100, unit: 'BPM', onInput: () => upd() });
    const swingS = ui.slider({ label: 'Swing (long part of each beat)', min: 50, max: 75, step: 1, value: 50, unit: '%', onInput: (v) => {
      upd(); if (+v >= 60 && !saidSwing) { saidSwing = true; ctx.say('See the off-beat pads slide later round the ring? Each beat is now split long–short instead of evenly: that is swing.'); }
    } });
    let saidSwing = false;
    ui.choice(ROWS.map(([id, icon, name]) => [id, `${icon} ${name}`]), 'hat', (v) => { row = v; });
    ui.choice(COUNT.map((c, i) => [i, c === '+' ? `${i / 2 + 0.5 | 0} +` : c]), null, (v) => toggle(row, +v));
    ui.button('🎧 Hear the target', () => start('target'), 'btn'); ui.button('▶️ Play mine', () => start('mine'), 'btn'); ui.button('⏹ Stop', () => stop(), 'btn sm ghost');
    ui.button('✔ Check', () => check(), 'btn'); ui.button('⏭ Next groove', () => { stop(); gi++; mission(); }, 'btn sm ghost');
    const rBar = ui.readout('One bar lasts'), rBeat = ui.readout('One beat lasts'), rOff = ui.readout('Off-beat comes after');
    const predS = ui.slider({ label: 'My prediction: one bar of 4 beats lasts', min: 1, max: 4.5, step: 0.05, value: 3, unit: 's' });
    ui.button('Check my prediction', () => {
      const truth = 240 / bpmGoal, err = Math.abs(predS.value - truth) / truth; predicted = true; upd();
      ctx.say(`${tr(err <= 0.05 ? 'Yes: one beat lasts 60 ÷ BPM seconds, and a bar has 4 beats.' : 'One beat lasts 60 ÷ BPM seconds, so a bar of 4 beats lasts 240 ÷ BPM seconds.')} ${bpmGoal} BPM: ${truth.toFixed(2)} s.`);
    }, 'btn sm ghost');
    ui.note('Pick a sound, then a step, or tap the pads. The big pads are the beats 1 2 3 4; the small ones are the off-beats ("and") in between. The arm goes round once per bar.');

    function upd() {
      if (!predicted) { rBar.set('?'); rBeat.set('?'); rOff.set('?'); return; }
      const bpm = tempoS.value; rBar.set((240 / bpm).toFixed(2) + ' s'); rBeat.set((60 / bpm).toFixed(2) + ' s'); rOff.set((60 / bpm * swingS.value / 100).toFixed(2) + ' s');
    }
    const source = () => (playing === 'target' ? { pat: target.pat, bpm: tempoS.value, swing: target.swing } : { pat: Object.fromEntries(ROWS.map(([id]) => [id, [...grid[id]]])), bpm: tempoS.value, swing: swingS.value });
    function start(what) { playing = what; barPos = 0; prev = -1; if (what === 'target') ctx.say(lvl <= 3 ? target.recipe : 'Listen, and watch which pads flash as the arm passes. Count "1 and 2 and 3 and 4 and".'); }
    function stop() { playing = null; }
    function paint(id, i) { const p = pads[id][i], on = grid[id].has(i); p.mesh.material = on ? p.on : p.off; }
    function toggle(id, i) {
      if (!(i >= 0 && i < 8) || !grid[id]) return;
      const on = !grid[id].has(i), name = ROWS.find((r) => r[0] === id)[2];
      if (on) { grid[id].add(i); strike(id, i); } else grid[id].delete(i);
      paint(id, i);
      ctx.say(`${tr(name)}: ${tr(on ? 'on' : 'off')} — ${i % 2 ? tr('the off-beat ("and") after beat') : tr('beat')} ${Math.floor(i / 2) + 1}.`);
    }
    function mission() {
      target = order[gi % order.length];
      bpmGoal = target.bpm[Math.floor(ctx.rng() * target.bpm.length) % target.bpm.length];
      done = false; tries = 0; predicted = false; saidSwing = false;
      tempoS.set(bpmGoal); swingS.set(50);
      for (const [id] of ROWS) { grid[id].clear(); for (let i = 0; i < 8; i++) paint(id, i); }
      rGoal.set(`${tr(target.name)} — ${bpmGoal} BPM`); upd();
      const old = sign.userData.tag; if (old) { sign.remove(old); old.material?.map?.dispose?.(); old.material?.dispose?.(); made.splice(made.indexOf(old), 1); }
      sign.userData.tag = text(`🎯 ${tr(target.name)} · ${bpmGoal} BPM`, 0.42, '#ffc46b'); sign.add(sign.userData.tag);
      ctx.say(`${tr('Build this groove:')} ${tr(target.name)} — ${bpmGoal} BPM. ${tr(lvl <= 3 ? target.recipe : 'Listen to the target, then rebuild it by ear. Count "1 and 2 and 3 and 4 and".')}`);
    }
    function check() {
      tries++;
      const { wrong, swOk } = judge(target, grid, swingS.value);
      if (wrong.length || !swOk) {
        for (const id of wrong) inst[id].v = 1;
        ctx.say((wrong.length ? `${tr('Listen again to:')} ${wrong.map((id) => tr(ROWS.find((r) => r[0] === id)[2])).join(', ')}. ` : '') + (swOk ? '' : tr(target.id === 'swing' ? 'The beats are still split evenly: add swing.' : 'This groove has even eighths: take the swing off.')));
        return;
      }
      ctx.say(target.why);
      if (!playing) start('mine'); else playing = 'mine';
      if (!done) { done = true; ctx.complete(Math.max(0.4, 1 - 0.12 * (tries - 1) - (predicted ? 0 : 0.1)), `${tr('Built a groove on the step grid:')} ${tr(target.name)}`); }
    }
    layout(50); mission();

    return {
      step(dt) {
        if (!playing) return;
        const { pat, bpm, swing } = source(), len = 240 / bpm, ghost = playing === 'target';
        const fire = (from, to) => { for (const [id] of ROWS) for (const i of pat[id]) { const t = stepTime(i, bpm, swing); if (t > from && t <= to) strike(id, i, ghost); } };
        barPos += dt;
        if (barPos >= len) { fire(prev, len + 1); barPos -= len; prev = -1; }
        fire(prev, barPos); prev = barPos;
      },
      frame(dt) {
        const want = playing === 'target' ? target.swing : swingS.value;
        if (Math.abs(want - shown) > 0.01) { shown += (want - shown) * Math.min(1, dt * 8); if (Math.abs(want - shown) < 0.05) shown = want; layout(shown); }
        arm.rotation.y = playing ? -2 * Math.PI * barPos / (240 / tempoS.value) : arm.rotation.y;
        for (const [id] of ROWS) {
          pads[id].forEach((p, i) => {
            p.v = Math.max(0, p.v - dt * 5); const on = grid[id].has(i);
            p.mesh.position.y = 0.06 + (on ? 0.07 : 0) + 0.12 * Math.sin(p.v * Math.PI);
            if (p.flash > 0) { p.flash -= dt; p.mesh.material = p.flash > 0 ? white : on ? p.on : p.off; }
          });
          const o = inst[id]; o.v = Math.max(0, o.v - dt * 4.5); const k = Math.sin(o.v * Math.PI) * (ctx.calm ? 0.4 : 1);
          if (id === 'hat') { o.part.rotation.z = 0.28 * k; o.part.rotation.x = 0.12 * k; }
          else if (id === 'snare') { o.part.position.y = 0.65 - 0.1 * k; o.part.scale.y = 1 - 0.18 * k; }
          else if (id === 'kick') o.part.scale.setScalar(1 + 0.14 * k);
          else o.part.rotation.z = 0.35 * k;
        }
      },
      // Shows a successful run without the player (used by tests): the same toggle, swing slider and check a player uses.
      autoplay() {
        for (const [id] of ROWS) for (let i = 0; i < 8; i++) if (grid[id].has(i) !== target.pat[id].includes(i)) toggle(id, i);
        swingS.set(target.swing); start('mine'); check();
      },
      dispose() {
        stop(); snd.close();
        for (const s of made) { s.material?.map?.dispose?.(); s.material?.dispose?.(); }
        made.length = 0;
      },
    };
  },
};
