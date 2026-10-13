// World 18 lab — Tour of the Body in 3D: a friendly see-through model figure whose parts can be tapped.
// No imports: everything arrives through the context, so the file also runs in tools/test-game3d.mjs.

// The same five parts, jobs and questions as the flat lab. `at` is the place inside the figure, `side` where its name hangs.
const ORGANS = [
  { id: 'brain', name: 'Brain', color: '#f783ac', at: [0, 4.24, 0.1], side: 1, fn: 'The brain is your control centre. It helps you think, feel and move.', q: 'Which part helps you think?' },
  { id: 'lungs', name: 'Lungs', color: '#74c0fc', at: [0, 2.98, 0.1], side: -1, fn: 'Lungs take in air so your body gets oxygen. You breathe in and out.', q: 'Which part helps you breathe?' },
  { id: 'heart', name: 'Heart', color: '#ff6b6b', at: [0.1, 2.8, 0.32], side: 1, fn: 'The heart is a pump. It pushes blood all around your body.', q: 'Which part pumps blood?' },
  { id: 'stomach', name: 'Stomach', color: '#ffa94d', at: [-0.12, 2.08, 0.16], side: -1, fn: 'The stomach mixes up the food you eat so your body can use it.', q: 'Which part mixes your food?' },
  { id: 'bones', name: 'Bones', color: '#fff3bf', at: [0, 0.8, 0.06], side: 1, fn: 'Bones hold you up and keep you strong, like a frame.', q: 'Which part holds you up?' },
];
const QUESTIONS = 4, PASS = 0.5;
const HEART_RATE = 70, BREATHS = 15;       // how fast the model beats and breathes, each minute (a calm, resting pace)

export default {
  id: 'w18-body-tour',
  world: 18,
  levels: [1, 2],
  title: 'Tour of the Body',
  goal: 'Tap each part of the body to meet it, then match each job to the right part.',
  kind: 'simplified',
  model: 'A friendly model figure with five parts inside: brain, lungs, heart, stomach and bones. The heart of the model beats 70 times a minute and the lungs breathe 15 times a minute, a calm resting pace. This is a simple cartoon, not a real body map: organs are drawn in rough places and sizes, and many organs are left out. It is an educational simulation, never medical advice.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, T = ctx.t || ((x) => x), level = ctx.level || 1, calm = !!ctx.calm, rng = ctx.rng || Math.random;
    const own = [];                                                              // geometries, materials and textures made here
    const keep = (x) => { own.push(x); return x; };
    const add = (g, m, x, y, z, parent = group) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    const label = (text, size) => { const s = ctx.sprite(text, { size }); own.push(s.material.map, s.material); return s; };
    const white = ctx.mat('#ffffff', { roughness: 0.55 }), dark = ctx.mat('#4a5568', { roughness: 0.5 });
    const skin = ctx.mat('#ffd9b8', { roughness: 0.7, transparent: true, opacity: 0.3, depthWrite: false });
    const ball = keep(new THREE.SphereGeometry(1, 22, 16));

    // the stand and the see-through figure
    add(keep(new THREE.CylinderGeometry(1.25, 1.4, 0.3, 28)), white, 0, 0.15, 0);
    const fig = new THREE.Group(); fig.position.y = 0.3; group.add(fig);
    const legG = keep(new THREE.CapsuleGeometry(0.21, 1.2, 6, 14)), armG = keep(new THREE.CapsuleGeometry(0.14, 1.15, 6, 12));
    for (const sx of [-1, 1]) { add(legG, skin, sx * 0.27, 0.8, 0, fig); add(armG, skin, sx * 0.82, 2.55, 0, fig).rotation.z = sx * 0.16; }
    add(keep(new THREE.CapsuleGeometry(0.58, 0.9, 8, 18)), skin, 0, 2.5, 0, fig).scale.z = 0.62;
    add(ball, skin, 0, 4.05, 0, fig).scale.setScalar(0.5);
    for (const sx of [-1, 1]) add(ball, dark, sx * 0.17, 3.93, 0.45, fig).scale.setScalar(0.045);
    const smile = add(keep(new THREE.TorusGeometry(0.13, 0.022, 6, 14, Math.PI)), dark, 0, 3.8, 0.45, fig); smile.rotation.z = Math.PI;

    // the five parts, each with its own softly glowing material
    const parts = {};
    for (const o of ORGANS) {
      const m = keep(new THREE.MeshStandardMaterial({ color: o.color, emissive: o.color, emissiveIntensity: 0.25, roughness: 0.5 }));
      const g = new THREE.Group(); g.position.set(...o.at); fig.add(g);
      if (o.id === 'brain') for (const sx of [-1, 1]) add(ball, m, sx * 0.13, 0, 0, g).scale.set(0.2, 0.18, 0.25);
      if (o.id === 'lungs') for (const sx of [-1, 1]) add(ball, m, sx * 0.28, 0, 0, g).scale.set(0.2, 0.36, 0.17);
      if (o.id === 'heart') { for (const sx of [-1, 1]) add(ball, m, sx * 0.075, 0.05, 0, g).scale.setScalar(0.115); const tip = add(keep(new THREE.ConeGeometry(0.185, 0.28, 16)), m, 0, -0.12, 0, g); tip.rotation.x = Math.PI; tip.scale.z = 0.62; }
      if (o.id === 'stomach') { const s = add(ball, m, 0, 0, 0, g); s.scale.set(0.27, 0.18, 0.16); s.rotation.z = 0.5; }
      if (o.id === 'bones') for (const sx of [-1, 1]) { add(keep(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8)), m, sx * 0.27, 0, 0, g); for (const sy of [-1, 1]) add(ball, m, sx * 0.27, sy * 0.55, 0, g).scale.setScalar(0.095); }
      const tag = label(T(o.name), 0.36); tag.position.set(o.side * 2.25, 0.3 + o.at[1], 0.2); tag.visible = false; group.add(tag);
      const len = 1.75 - o.side * o.at[0] - (o.id === 'bones' ? 0.27 : 0);
      const line = add(keep(new THREE.CylinderGeometry(0.018, 0.018, len, 6)), white, o.side * (1.75 - len / 2), 0.3 + o.at[1], 0.2); line.rotation.z = Math.PI / 2; line.visible = false; line.castShadow = false;
      const halo = ctx.glow(o.color, 1.1, 0); g.add(halo);
      parts[o.id] = { o, g, m, tag, line, halo, pop: 0, hold: 0, shake: 0 };
      ctx.onTap(g, () => tap(o));
    }
    // air drifting in and out of the lungs, and little sparks of thought around the brain
    const airM = ctx.lit('#d0ebff', 0.9), sparkM = ctx.lit('#ffe066', 1.4);
    const air = [0, 1, 2].map(() => { const a = add(ball, airM, 0, 0, 0, fig); a.scale.setScalar(0.05); a.castShadow = false; return a; });
    const sparks = [0, 1, 2].map(() => { const s = add(ball, sparkM, 0, 0, 0, fig); s.scale.setScalar(0.04); s.castShadow = false; return s; });
    const ask3d = label('?', 0.9); ask3d.position.set(-1.5, 4.5, 0.3); ask3d.visible = false; group.add(ask3d);

    const seen = new Set(); let phase = 'tour', q = 0, right = 0, order = [], locked = false, wait = 0, after = null, auto = false, autoT = 0, beat = 0, breath = 0;
    const rMet = ui.readout('Parts met'), rQ = ui.readout('Question'), rRight = ui.readout('Right answers'), rBeat = ui.readout('Model heartbeat'), rBreath = ui.readout('Model breathing');
    for (const o of ORGANS) ui.button(o.name, () => tap(o), 'btn ghost');
    ui.note('This is a simple cartoon, not a real body map, and never medical advice.');
    rBeat.set(`${HEART_RATE} ${T('beats a minute')}`); rBreath.set(`${BREATHS} ${T('breaths a minute')}`);
    const upd = () => { rMet.set(`${seen.size} / ${ORGANS.length}`); rQ.set(phase === 'quiz' ? `${Math.min(q + 1, QUESTIONS)} / ${QUESTIONS}` : '–'); rRight.set(phase === 'tour' ? '–' : `${right} / ${QUESTIONS}`); };
    const later = (seconds, fn) => { wait = seconds; after = fn; };
    const focus = (id, seconds = 1.6) => { for (const p of Object.values(parts)) p.hold = p.o.id === id ? seconds : 0; };
    const names = (show) => { for (const p of Object.values(parts)) p.tag.visible = p.line.visible = show(p); };

    function tap(o) {
      if (phase !== 'quiz') {
        focus(o.id); ctx.say(o.fn);
        if (phase === 'done') return;
        seen.add(o.id); names((p) => seen.has(p.o.id)); upd();
        if (seen.size === ORGANS.length && !after) later(1.8, startQuiz);
      } else if (!locked) {
        locked = true; const want = order[q], ok = o.id === want.id; if (ok) right++; else parts[o.id].shake = 0.6;
        focus(want.id);                                                       // the right part steps forward either way
        ctx.say(ok ? `Yes! ${want.fn}` : `That is the ${o.name}. The answer is the ${want.name}. ${want.fn}`);
        q++; upd();
        later(1.6, () => { if (q >= QUESTIONS) finish(); else ask(); });
      }
    }
    function startQuiz() {
      phase = 'quiz'; q = 0; right = 0;
      const pool = [...ORGANS]; for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      order = pool.slice(0, QUESTIONS); names(() => level <= 1); ask3d.visible = true; ask();     // from level 2 the name tags are put away
    }
    function ask() { locked = false; focus(null); ctx.say(order[q].q); upd(); }
    function finish() {
      const score = right / QUESTIONS; ask3d.visible = false; names(() => true);
      if (score >= PASS) {
        phase = 'done'; upd();
        ctx.say(`You matched ${right} of ${QUESTIONS} jobs! Every part of your body has a job, and they all work together.`);
        ctx.complete(score, 'Explored the body and matched parts to jobs.');
      } else {
        phase = 'tour'; q = 0; seen.clear(); names(() => false); upd();
        ctx.say(`You matched ${right} of ${QUESTIONS} jobs. Tap the parts again to learn more, because every part has its own job.`);
      }
    }
    upd();
    ctx.say('Tap a part of the body, or use the buttons, to meet it.');

    return {
      step(dt) {
        if (after) { wait -= dt; if (wait <= 0) { const fn = after; after = null; fn(); } }
        if (auto && !after && phase !== 'done') {
          autoT -= dt;
          if (autoT <= 0) { autoT = 0.5; if (phase === 'tour') { const o = ORGANS.find((x) => !seen.has(x.id)); if (o) tap(o); } else if (!locked) tap(order[q]); }
        }
      },
      frame(dt, time) {
        beat = (beat + dt * HEART_RATE / 60) % 1; breath = (breath + dt * BREATHS / 60) % 1;
        const amp = calm ? 0.4 : 1, lub = beat < 0.15 ? Math.sin(beat / 0.15 * Math.PI) : beat > 0.25 && beat < 0.45 ? 0.6 * Math.sin((beat - 0.25) / 0.2 * Math.PI) : 0, inOut = Math.sin(breath * Math.PI * 2);
        for (const p of Object.values(parts)) {
          p.hold = Math.max(0, p.hold - dt); p.shake = Math.max(0, p.shake - dt);
          p.pop += ((p.hold > 0 ? 1 : 0) - p.pop) * Math.min(1, dt * 6);
          const id = p.o.id, s = 1 + p.pop * (id === 'bones' ? 0.25 : 0.8);
          p.g.position.set(p.o.at[0] + (p.shake > 0 ? Math.sin(p.shake * 40) * 0.05 * amp : 0), p.o.at[1], p.o.at[2] + p.pop * (id === 'bones' ? 0.35 : 0.7));
          if (id === 'heart') p.g.scale.setScalar(1.3 * s * (1 + 0.12 * lub * amp));
          else if (id === 'lungs') p.g.scale.set(s * (1 + 0.1 * inOut * amp), s * (1 + 0.05 * inOut * amp), s * (1 + 0.14 * inOut * amp));
          else p.g.scale.setScalar(s);
          if (id === 'stomach') p.g.rotation.z = Math.sin(time * 1.4) * 0.14 * amp;
          p.m.emissiveIntensity = 0.22 + 0.08 * Math.sin(time * 1.6 + p.o.at[1]) + p.pop * 0.7;
          p.halo.material.opacity = p.pop * 0.55;
        }
        // air goes down to the lungs while they grow and comes back up while they shrink
        air.forEach((a, i) => { const f = (breath * 2 + i * 0.22) % 1, down = breath < 0.5 ? f : 1 - f; a.position.set((i - 1) * 0.07 * down, 3.9 - down * 0.85, 0.5 - down * 0.35); a.visible = !calm || i === 0; });
        const head = parts.brain.g.position;
        sparks.forEach((s, i) => { const a = time * (calm ? 0.6 : 1.7) + i * 2.1; s.position.set(head.x + Math.cos(a) * 0.42, head.y + 0.12 + Math.sin(a * 1.3) * 0.12, head.z + Math.sin(a) * 0.42); });
        if (ask3d.visible) ask3d.position.y = 4.5 + Math.sin(time * 2) * 0.08 * amp;
      },
      // Meets every part and answers every question through the same tap() the player uses (used by tests).
      autoplay() { auto = true; autoT = 0; },
      dispose() { for (const x of own) x.dispose?.(); },
      get state() { return phase; },
    };
  },
};
