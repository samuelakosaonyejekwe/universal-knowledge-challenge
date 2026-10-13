// World 16 — Literature, Shakespeare and World Folktales: the Living Library.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: five scenes of one small tale, what each needs to have happened first, and the plot's tension line -----
// `needs` are facts the reader must already hold, `gives` are facts the scene adds, `ends` are facts it closes.
// `feel` is how tense the scene is on a scale of 0 (calm) to 10 (as tense as the tale gets).
const SCENES = {
  village: { name: 'A quiet village', needs: [], gives: ['who'], ends: [], feel: 2 },
  lost: { name: 'The lantern is lost', needs: ['who'], gives: ['problem'], ends: [], feel: 5 },
  storm: { name: 'Storm on the bridge', needs: ['who', 'problem'], gives: ['danger'], ends: [], feel: 9 },
  found: { name: 'The lantern is found', needs: ['problem'], gives: ['solved'], ends: ['problem'], feel: 4 },
  home: { name: 'Home again', needs: ['solved'], gives: ['ending'], ends: [], feel: 1 },
};
const PARTS = ['beginning (exposition)', 'rising action', 'climax', 'falling action', 'resolution'];
export const model = {
  SCENES, PARTS,
  // The order the tale was written in: three scenes on the first level, all five after that.
  intended: (n) => (n <= 3 ? ['village', 'lost', 'found'] : ['village', 'lost', 'storm', 'found', 'home']),
  // Walks through the scenes and stops at the first one whose causes have not happened yet.
  checkOrder(order) {
    const have = new Set(), gone = new Set();
    for (let i = 0; i < order.length; i++) {
      const sc = SCENES[order[i]], need = sc.needs.find((t) => !have.has(t));
      if (need) return { ok: false, at: i, scene: order[i], need, ended: gone.has(need) };
      for (const t of sc.gives) have.add(t);
      for (const t of sc.ends) { have.delete(t); gone.add(t); }
    }
    return { ok: true, at: -1 };
  },
  // One peak: a single highest value, not at either end, with every step rising before it and falling after it.
  peak(curve) {
    const top = Math.max(...curve), at = curve.indexOf(top), ties = curve.filter((v) => v === top).length;
    let rises = true, falls = true;
    for (let i = 0; i < curve.length - 1; i++) { if (i < at && !(curve[i] < curve[i + 1])) rises = false; if (i >= at && !(curve[i] > curve[i + 1])) falls = false; }
    const inside = at > 0 && at < curve.length - 1;
    return { ok: ties === 1 && inside && rises && falls, at, ties, inside, rises, falls };
  },
  // The climax is the tensest scene of the tale.
  climaxOf: (order) => order.reduce((best, id, i) => (SCENES[id].feel > SCENES[order[best]].feel ? i : best), 0),
  // Levels 1–2 judge the order; levels 3–4 add the tension line; levels 5–6 also ask which slot is the climax.
  score(order, curve, pick, level) {
    if (order.some((id) => !SCENES[id]) || new Set(order).size !== order.length) return { ok: false, reason: 'empty' };
    const o = model.checkOrder(order);
    if (!o.ok) return { ok: false, reason: 'order', ...o };
    const climax = model.climaxOf(order);
    if (level >= 3) {
      const p = model.peak(curve);
      if (!p.ok) return { ok: false, reason: 'shape', climax, ...p };
      if (p.at !== climax) return { ok: false, reason: 'peakSlot', climax, at: p.at };
    }
    if (level >= 5 && pick !== climax) return { ok: false, reason: 'pick', climax };
    return { ok: true, climax };
  },
};
const orders = (list) => (list.length < 2 ? [list] : list.flatMap((x, i) => orders([...list.slice(0, i), ...list.slice(i + 1)]).map((r) => [x, ...r])));
// Used by the automated tests: the scorer takes the written order and no other, catches a broken cause-and-effect
// link at the right slot, and the one-peak test sorts sample curves correctly.
export function selfTest() {
  const five = model.intended(5), three = model.intended(3);
  const good = model.score(five, [2, 5, 9, 4, 1], 2, 6).ok && model.score(three, [], null, 1).ok;
  const valid5 = orders(five).filter((o) => model.checkOrder(o).ok).length, valid3 = orders(three).filter((o) => model.checkOrder(o).ok).length;
  const early = model.checkOrder(['village', 'found', 'lost', 'storm', 'home']), late = model.checkOrder(['village', 'lost', 'found', 'storm', 'home']);
  const breaks = !early.ok && early.at === 1 && early.need === 'problem' && !early.ended && !late.ok && late.at === 3 && late.ended;
  const curves = [[2, 5, 9, 4, 1], [2, 6, 3, 8, 1], [5, 5, 5, 5, 5], [9, 7, 5, 3, 1], [1, 3, 5, 7, 9], [3, 8, 8, 4, 1]], pass = curves.map((c) => model.peak(c).ok);
  const peaks = pass.join() === 'true,false,false,false,false,false' && model.peak(curves[0]).at === 2;
  const strict = model.score(five, [2, 9, 6, 4, 1], 1, 6).reason === 'peakSlot' && model.score(five, [2, 5, 9, 4, 1], 1, 6).reason === 'pick' && model.score(five, [2, 6, 3, 8, 1], 2, 3).reason === 'shape';
  return { ok: good && valid5 === 1 && valid3 === 1 && breaks && peaks && strict, detail: `valid orders ${valid5} of 120 (five scenes) and ${valid3} of 6 (three scenes); broken links caught at slots ${early.at + 1} and ${late.at + 1}; one-peak test passes ${pass.filter(Boolean).length} of ${curves.length} sample curves, peak at slot ${model.peak(curves[0]).at + 1}` };
}

// Joins many small coloured shapes into one geometry, so a detailed set piece costs a single mesh.
// parts: [geometry, colour, [x, y, z], [rx, ry, rz], [sx, sy, sz]]
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

const WINGS = ['storm', 'home', 'village', 'found', 'lost'];          // the order the scenes wait in, so it gives nothing away
const sim = {
  title: 'The story stage',
  goal: 'Put the scenes on the stage in an order where every scene is caused by what came before. On harder levels, also shape the tension line so it climbs to one peak at the climax and falls again, and mark which slot is the climax.',
  kind: 'simplified',
  model: 'The classic five-part plot shape: beginning (exposition), rising action, climax, falling action and resolution. Each scene lists what a reader must already know, and the order is accepted only when nothing happens before its cause. Tension is a simple score from 0 to 10 for each scene, and the line must rise to a single peak at the climax and then fall. This is one useful pattern among many, not a rule. Many great stories and many cultures\' tales are shaped differently: some begin in the middle, some go round in a circle, some are a chain of episodes, and some have no single peak at all. The model leaves out character, language, theme, humour and everything else that makes a story worth reading.',
  mount(ctx) {
    const { THREE, group, ui, level } = ctx, n = level <= 1 ? 3 : 5, wings = WINGS.filter((id) => model.intended(n).includes(id));
    const sx = (i) => (i - (n - 1) / 2) * 1.3, ty = (v) => 3.15 + v * 0.16, Z = -0.5;
    const paint = ctx.mat('#ffffff', { vertexColors: true }), amber = ctx.lit('#ffc55c', 1.5);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s), cone = (r, h, s = 4) => new THREE.ConeGeometry(r, h, s), ball = (r) => new THREE.SphereGeometry(r, 12, 8);
    // the little theatre: floor, backdrop, curtains, a tile for each slot, and the bottom and top of the tension scale
    const stage = [[box(7, 0.3, 3.2), '#8a5a3a', [0, 0.15, -0.3]], [box(7, 2.4, 0.1), '#1f3a5f', [0, 1.5, -1.85]], [box(7, 0.3, 0.3), '#c2255c', [0, 2.85, -1.6]], [box(6.6, 0.02, 0.02), '#f4ead8', [0, ty(0), Z]], [box(6.6, 0.012, 0.012), '#8d99ae', [0, ty(10), Z]]];
    for (const s of [-1, 1]) stage.push([box(0.5, 2.4, 0.3), '#c2255c', [s * 3.25, 1.5, -1.6]]);
    for (let i = 0; i < n; i++) stage.push([cyl(0.55, 0.55, 0.04, 24), '#d9c79a', [sx(i), 0.31, Z]]);
    group.add(new THREE.Mesh(fuse(THREE, stage), paint));
    for (let i = 0; i < n; i++) { const num = ctx.sprite(String(i + 1), { size: 0.34 }); num.position.set(sx(i), 0.16, 1.36); group.add(num); }
    // the five scene tableaux
    const set = (parts, lamps) => {
      const g = new THREE.Group(); g.add(new THREE.Mesh(fuse(THREE, parts), paint));
      if (lamps) { g.add(new THREE.Mesh(fuse(THREE, lamps), amber)); const h = ctx.glow('#ffc55c', 0.9, 0.6); h.position.set(...lamps[0][2]); g.add(h); }
      group.add(g); return g;
    };
    const post = (x, z, h = 0.6) => [cyl(0.02, 0.02, h, 6), '#4a3f5c', [x, h / 2, z]];
    const build = {
      village: () => set([[box(0.34, 0.3, 0.3), '#f1e3c8', [-0.28, 0.15, 0]], [cone(0.3, 0.22), '#c2553f', [-0.28, 0.41, 0], [0, Math.PI / 4, 0]], [box(0.28, 0.24, 0.26), '#e8d2a8', [0.27, 0.12, -0.05]], [cone(0.25, 0.2), '#5f3dc4', [0.27, 0.34, -0.05], [0, Math.PI / 4, 0]], [cyl(0.03, 0.04, 0.2, 6), '#8a5a3a', [0.02, 0.1, -0.3]], [cone(0.16, 0.4, 7), '#1f6f6b', [0.02, 0.4, -0.3]], post(0.02, 0.3)],
        [[box(0.1, 0.13, 0.1), '#ffffff', [0.02, 0.66, 0.3]]]),
      lost: () => { const g = set([post(0, 0), [box(0.2, 0.03, 0.03), '#4a3f5c', [0.08, 0.6, 0]], [new THREE.IcosahedronGeometry(0.16, 1), '#1f6f6b', [-0.3, 0.12, 0.1]], ...[0, 1, 2].map((i) => [box(0.06, 0.012, 0.1), '#7a6a4a', [0.18 + i * 0.11, 0.006, 0.12 + i * 0.1], [0, 0.5, 0]])]); const q = ctx.sprite('❓', { size: 0.4 }); q.position.set(0.14, 0.95, 0); g.add(q); return g; },
      storm: () => set([[box(1, 0.03, 0.5), '#3b5bdb', [0, 0.015, 0]], [new THREE.TorusGeometry(0.4, 0.05, 6, 14, Math.PI), '#8a5a3a', [0, 0.03, 0]], [ball(0.22), '#8d99ae', [-0.16, 1.05, 0]], [ball(0.2), '#8d99ae', [0.16, 1.1, 0]], [ball(0.2), '#a7b1c2', [0, 1.2, -0.05]], ...[0, 1, 2, 3, 4, 5].map((i) => [box(0.015, 0.16, 0.015), '#9bd0ff', [-0.3 + i * 0.12, 0.62 + (i % 3) * 0.1, (i % 2) * 0.1 - 0.05], [0, 0, 0.3]])]),
      found: () => { const g = set([[new THREE.DodecahedronGeometry(0.22, 0), '#9a9a9a', [0, 0.14, 0], [0, 0, 0], [1.3, 0.7, 1]], [box(0.13, 0.02, 0.13), '#4a3f5c', [0, 0.3, 0]], [cone(0.1, 0.07), '#4a3f5c', [0, 0.49, 0], [0, Math.PI / 4, 0]], [cone(0.05, 0.3, 5), '#1f6f6b', [-0.32, 0.15, 0.1]], [cone(0.05, 0.22, 5), '#1f6f6b', [-0.25, 0.11, 0.18]]], [[box(0.1, 0.14, 0.1), '#ffffff', [0, 0.38, 0]]]); const q = ctx.sprite('✨', { size: 0.36 }); q.position.set(0.28, 0.72, 0); g.add(q); return g; },
      home: () => set([[box(0.5, 0.4, 0.4), '#f1e3c8', [-0.1, 0.2, 0]], [cone(0.42, 0.28), '#c2553f', [-0.1, 0.54, 0], [0, Math.PI / 4, 0]], [box(0.1, 0.2, 0.02), '#8a5a3a', [-0.22, 0.1, 0.21]], post(0.34, 0.15, 0.5)],
        [[box(0.09, 0.12, 0.09), '#ffffff', [0.34, 0.56, 0.15]], [box(0.12, 0.12, 0.02), '#ffffff', [0.02, 0.24, 0.21]]]),
    };
    const sets = Object.fromEntries(wings.map((id) => [id, build[id]()]));
    // the tension line, a ring round the chosen slot, a star for the climax and a spotlight for the telling
    const linePos = new Float32Array(n * 3), lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffc55c })); line.frustumCulled = false; group.add(line);
    const dots = Array.from({ length: n }, () => { const d = new THREE.Mesh(ball(0.07), ctx.lit('#ffe9a8', 1.4)); group.add(d); return d; });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.03, 6, 32), amber); ring.rotation.x = Math.PI / 2; group.add(ring);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), ctx.lit('#ff8fb1', 1.6)); star.visible = false; group.add(star);
    const spot = ctx.glow('#ffe9a8', 1.1, 0.9); spot.visible = false; group.add(spot);

    const slots = Array(n).fill(null), tension = Array(n).fill(level >= 3 ? 5 : 0), shown = tension.slice();
    let scene = wings[0], slot = 0, pick = null, tries = 0, state = 'ready', pt = 0;
    const name = (id) => model.SCENES[id].name;
    ui.note('Choose a scene, choose a slot, then place it. Slot 1 is told first.');
    ui.choice(wings.map((id) => [id, name(id)]), scene, (v) => { scene = v; });
    ui.choice(slots.map((_, i) => [i, `Slot ${i + 1}`]), 0, (v) => { slot = v; tensionS?.set(tension[slot]); refresh(); });
    const place = () => {
      if (state === 'play') return;
      const from = slots.indexOf(scene), old = slots[slot];
      if (from >= 0) slots[from] = old;
      slots[slot] = scene; refresh();
      ctx.say(`"${name(scene)}" will be told ${['first', 'second', 'third', 'fourth', 'last'][n === 3 && slot === 2 ? 4 : slot]}. Ask yourself: does the reader already know everything this scene needs?`);
    };
    ui.button('Place the scene in the slot', place);
    const tensionS = level >= 3 ? ui.slider({ label: 'Tension in the chosen slot', min: 0, max: 10, step: 1, value: 5, unit: 'out of 10', onInput: (v) => { tension[slot] = v; refresh(); } }) : null;
    if (level >= 5) ui.button('⭐ Mark the chosen slot as the climax', () => { pick = slot; refresh(); });
    const rPlaced = ui.readout('Scenes placed'), rLine = ui.readout('Tension, slot by slot (0–10)'), rTop = ui.readout('Highest point'), rPick = level >= 5 ? ui.readout('Climax marked') : null, rTries = ui.readout('Tellings');
    function refresh() {
      rPlaced.set(`${slots.filter(Boolean).length} of ${n}`);
      rLine.set(level >= 3 || state === 'done' ? tension.join(' · ') : 'shown after the telling');
      const p = model.peak(tension); rTop.set(level < 3 && state !== 'done' ? '–' : p.ties > 1 ? `${p.ties} slots tie` : `slot ${p.at + 1}`);
      rPick?.set(pick == null ? 'not yet' : `slot ${pick + 1}`); rTries.set(String(tries));
    }
    const explain = (r) => {
      if (r.reason === 'empty') return `Only ${slots.filter(Boolean).length} of ${n} slots are filled. Give every slot a scene, then tell the story.`;
      if (r.reason === 'order') {
        const where = `slot ${r.at + 1}`;
        if (r.scene === 'lost') return `The lantern goes missing in ${where}, but the reader has not met the village yet. Show who lives here and why the lantern matters first; then losing it means something.`;
        if (r.scene === 'storm') return r.ended ? `By ${where} the lantern has already been found, so there is nothing left to search for in the storm. The hardest moment has to come while the problem is still open.` : `The storm on the bridge in ${where} is the search for the lantern. Nobody would cross a bridge in a storm before the lantern is lost.`;
        if (r.scene === 'found') return `The lantern is found in ${where} before the reader knows it was lost. An effect cannot come before its cause.`;
        return `Everyone goes home in ${where}, but the lantern is still missing. An ending feels like an ending only after the problem is solved.`;
      }
      if (r.reason === 'shape') {
        if (r.ties > 1) return `${r.ties} slots share the highest tension, so the line has no single peak. Choose one moment to be the most tense of all.`;
        if (r.at === 0) return 'The tension is highest in the very first slot. The reader does not know anyone yet, so there is nothing to worry about. Start calm and build up.';
        if (!r.inside) return 'The tension is still at its highest in the last slot, so the story stops without letting the reader breathe. Let it fall after the peak.';
        if (!r.rises) return 'The tension dips or stays flat on the way up. In this plot shape each step towards the peak feels a little more tense than the one before.';
        return 'The tension stays level or climbs again after the peak. After the climax, let it fall step by step to a calm ending.';
      }
      if (r.reason === 'peakSlot') return `The order makes sense, but the highest point of the line sits on slot ${r.at + 1}, "${name(slots[r.at])}". Is that really the moment when it is hardest to know how things will turn out? Move the peak to that scene.`;
      return pick == null ? 'The order and the tension line both work. One thing is left: choose the slot that holds the climax and mark it with the star.' : `You marked "${name(slots[pick])}" as the climax. The climax is the turning point: the moment of greatest worry, just before the big question — will the lantern come back? — is answered.`;
    };
    const tell = () => {
      if (state === 'play') return;
      tries++; const r = model.score(slots, tension, pick, level);
      if (!r.ok) { state = 'ready'; refresh(); ctx.say(explain(r)); return; }
      if (level < 3) slots.forEach((id, i) => { tension[i] = model.SCENES[id].feel; });
      state = 'play'; pt = 0; refresh(); ctx.say('Curtain up! Watch the spotlight travel along the tension line as each scene is told.');
    };
    ui.button('🎭 Tell the story', tell, 'btn');
    ui.button('Clear the stage', () => { if (state === 'play') return; slots.fill(null); pick = null; state = 'ready'; refresh(); });
    ui.note(level >= 5 ? 'A scene only works if the reader already knows what caused it. Then shape the tension: one peak, at the climax, and mark that slot.' : level >= 3 ? 'A scene only works if the reader already knows what caused it. Then shape the tension so it climbs to one peak and falls.' : 'A scene only works if the reader already knows what caused it.');
    refresh();
    ctx.say(n === 3 ? 'Three scenes from one small tale are waiting in front of the stage. Which must come first for the others to make sense?' : 'Five scenes from one small tale are waiting in front of the stage. Put them in an order where each one is caused by what came before.');
    const finish = () => {
      state = 'done'; refresh();
      const top = Math.max(...tension), at = tension.indexOf(top);
      ctx.say(n === 3 ? 'That works: a beginning, a middle and an end. We meet the village, the lantern is lost, and then it is found. Each scene is caused by the one before it.'
        : level < 3 ? `That is the classic five-part shape: ${model.PARTS.join(', ')}. Look at the line: tension climbs to ${top} at the storm in slot ${at + 1} and falls to ${tension[n - 1]} at home.`
          : `A well-shaped plot! Tension climbs from ${tension[0]} to ${top} at the storm, then falls to ${tension[n - 1]} at home. The climax cannot come early: readers need time to meet the village and begin to worry. After it, the story lets them breathe. Many tales are shaped differently, but this is a useful shape to know.`);
      ctx.complete(tries <= 2 ? 1 : tries <= 4 ? 0.8 : 0.6, `scenes=${n}, tries=${tries}, tension=${tension.join('-')}`);
    };
    const at = new THREE.Vector3();
    return {
      step(dt) { if (state !== 'play') return; pt += dt; if (pt >= n * 0.8 + 0.4) finish(); },
      frame(dt, time) {
        const ease = 1 - Math.exp(-dt * 8), cue = state === 'play' ? Math.min(n - 1, Math.floor(pt / 0.8)) : -1;
        wings.forEach((id, j) => {
          const i = slots.indexOf(id), g = sets[id], hop = i === cue && !ctx.calm ? Math.abs(Math.sin(pt * 8)) * 0.12 : 0;
          if (i >= 0) at.set(sx(i), 0.33 + hop, Z); else at.set((j - (wings.length - 1) / 2) * 1.05, 0, 2.05);
          g.position.lerp(at, ease); g.scale.setScalar(g.scale.x + ((i >= 0 ? 1 : 0.6) - g.scale.x) * ease);
        });
        for (let i = 0; i < n; i++) { shown[i] += (tension[i] - shown[i]) * ease; linePos.set([sx(i), ty(shown[i]), Z], i * 3); dots[i].position.set(sx(i), ty(shown[i]), Z); }
        lineGeo.attributes.position.needsUpdate = true;
        ring.position.set(sx(slot), 0.35, Z); ring.rotation.z = ctx.calm ? 0 : time * 0.6;
        star.visible = pick != null; if (pick != null) { star.position.set(sx(pick), ty(shown[pick]) + 0.3, Z); star.rotation.y = ctx.calm ? 0 : time * 1.5; }
        spot.visible = cue >= 0; if (cue >= 0) spot.position.set(sx(cue), ty(shown[cue]), Z + 0.05);
      },
      // Shows a successful run without the player (used by tests).
      autoplay() {
        const want = model.intended(n); want.forEach((id, i) => { slots[i] = id; if (level >= 3) tension[i] = model.SCENES[id].feel; });
        if (level >= 5) pick = model.climaxOf(want);
        tensionS?.set(tension[slot]); state = 'ready'; tell();
      },
      get state() { return state; },
    };
  },
};

export default {
  id: 16,
  theme: {
    sky: ['#16224a', '#3a4f7a', '#f2a65a'], fog: '#3d5673', fogNear: 45, fogFar: 160,
    ground: '#d9c79a', ground2: '#8fae6a', side: '#5b4a36', stone: '#bfae8c', accent: '#5f3dc4', glow: '#ffc55c', metal: '#4a3f5c', wood: '#8a5a3a', leaf: '#1f6f6b', water: '#3b5bdb', crate: '#d9a05b',
    sun: '#ffd2a1', sunPower: 1.9, ambient: 1.2, skyLight: '#c9d6ff', groundLight: '#6b5a3a', sunDir: [-0.6, 0.55, 0.4], particles: 'leaves',
  },
  layout: { mirror: -1, stones: 4, rise: 0.5, towerH: 6 },
  story: {
    title: 'The Living Library',
    crystal: 'story pages', crystalEm: '📜',
    intro: ['Welcome to the Living Library, where the books grow on trees and the stories walk about at dusk.', 'A playful wind blew through last night. Five story pages flew away, and the scenes on our story stage are all in a muddle.'],
    remind: 'The story pages glow like lantern light. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five pages! Now ride the lift from the tower to the story stage and put the scenes of the lantern tale back in order.',
    afterSim: 'The tale makes sense again. Only the Keeper of Tales stands between you and the portal — the arena is up the steps.',
    notReady: 'The arena is for readers who have done the work. Bring all five story pages and mend the tale on the stage first.',
    rival: ['So you can put scenes in a row. But do you know why a story moves us?', 'We each build a bridge of light, one piece for every right answer. Let us see whose tale reaches the far side first.'],
    win: ['Your bridge reached the end before mine. You read closely and you think clearly — the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and try me.'],
    outro: 'The pages are home, the lantern tale is whole, and the Keeper of Tales has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, paint = k.mat('#ffffff', { vertexColors: true }), hedge = k.mat('#ffffff', { vertexColors: true, flatShading: true });
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s), ico = (r) => new THREE.IcosahedronGeometry(r, 1);
    const spines = ['#d6336c', '#3b5bdb', '#f5b700', '#2f9e44', '#5f3dc4', '#e8590c', '#0c8599'];
    // two towering bookshelves at the back of the home island
    for (const [x, z] of [[-5.8, -6.2], [4.6, -7.2]]) {
      k.block(x, 4.2, z, 2.2, 4.2, 0.7, { color: '#6f4a2e' });
      const books = [];
      for (let r = 0; r < 3; r++) { books.push([box(2.1, 0.08, 0.2), '#b98045', [0, 0.3 + r * 1.3, 0]]); for (let i = 0; i < 9; i++) { const h = 0.7 + ((i * 7 + r * 3) % 5) * 0.07; books.push([box(0.19, h, 0.14), spines[(i * 3 + r * 2) % 7], [-0.88 + i * 0.22, 0.34 + r * 1.3 + h / 2, 0], [0, 0, i === 6 - r ? 0.12 : 0]]); } }
      k.mesh(fuse(THREE, books), paint, x, 0, z + 0.4);
    }
    // a giant open book to step across, with a ribbon down the middle
    k.block(6.55, 0.28, 0.4, 1.2, 0.28, 1.7, { color: '#f4ead8' }); k.block(7.8, 0.28, 0.4, 1.2, 0.28, 1.7, { color: '#f4ead8' });
    const print = [[box(2.75, 0.08, 1.95), '#5f3dc4', [0, 0.04, 0]], [box(0.1, 0.02, 2.15), '#d6336c', [0, 0.285, 0.1]]];
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) print.push([box(0.85 - (i === 4 ? 0.3 : 0), 0.012, 0.05), '#6b5a3a', [s * 0.625 - (i === 4 ? 0.15 : 0), 0.286, -0.55 + i * 0.27]]);
    k.mesh(fuse(THREE, print), paint, 7.175, 0, 0.4);
    // a writing desk with a quill standing in its inkpot
    k.block(-7.9, 0.9, 3.3, 1.2, 0.9, 0.9, { color: '#8a5a3a' });
    k.mesh(cyl(0.2, 0.24, 0.32, 12), k.mat('#232a5c', { roughness: 0.3 }), -7.9, 1.06, 3.3);
    const quill = k.mesh(fuse(THREE, [[cyl(0.015, 0.02, 0.95, 6), '#f4ead8', [0, 0.47, 0]], [new THREE.SphereGeometry(0.5, 10, 8), '#ffffff', [0, 0.78, 0], [0, 0, 0], [0.26, 0.9, 0.04]]]), paint, -7.9, 1.1, 3.3);
    k.prop('lamp', -4.4, 0, 6.9); k.prop('lamp', 4.4, 0, 6.9); k.prop('pine', 8, 0, -3.2, { s: 1.15, solid: true });
    // a small round wooden theatre with curtains and the masks of comedy and tragedy
    const tx = -0.6, tz = -7.7;
    k.island(tx, 0.3, tz, 1.5, { h: 0.8, top: '#b98045', side: '#8a5a3a' });
    const curtains = [-1, 1].map((s) => k.mesh(box(0.6, 2.5, 0.1), k.mat('#c2255c', { roughness: 0.9 }), tx + s * 1.15, 1.55, tz - 1.05));
    const mask = (x, colour, glad) => [[new THREE.SphereGeometry(0.3, 14, 10), colour, [x, 2.85, 0.1], [0, 0, 0], [1, 1.2, 0.35]], [new THREE.SphereGeometry(0.05, 8, 6), '#2b2440', [x - 0.11, 2.93, 0.2]], [new THREE.SphereGeometry(0.05, 8, 6), '#2b2440', [x + 0.11, 2.93, 0.2]],
      [new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), '#2b2440', [x, glad ? 2.78 : 2.64, 0.2], [0, 0, glad ? Math.PI : 0]]];
    k.mesh(fuse(THREE, [[box(0.12, 3, 0.12), '#5f3dc4', [-1.5, 1.5, 0]], [box(0.12, 3, 0.12), '#5f3dc4', [1.5, 1.5, 0]], [box(3.2, 0.42, 0.14), '#5f3dc4', [0, 2.85, 0]], [box(3.2, 0.05, 0.16), '#ffc55c', [0, 2.62, 0]], ...mask(-0.45, '#ffd76a', true), ...mask(0.45, '#bcd4ff', false)]), paint, tx, 0.3, tz - 1.1);
    // middle island: a spider-web arch for the trickster tales and a storyteller's fire circle with log seats
    const mid = S.mid;
    k.prop('arch', 0, mid[1], mid[2] - 4.4, { s: 1.3, color: '#8a5a3a' });
    const thread = new THREE.MeshBasicMaterial({ color: 0xf4ead8, wireframe: true, transparent: true, opacity: 0.75 });
    for (const r of [1.45, 0.8]) k.mesh(new THREE.CircleGeometry(r, 8, 0, Math.PI), thread, 0, mid[1] + 3.9, mid[2] - 4.4).castShadow = false;
    const spider = k.mesh(new THREE.SphereGeometry(0.13, 10, 8), k.mat('#5f3dc4', { roughness: 0.4 }), 0.5, mid[1] + 3.2, mid[2] - 4.4);
    const fx = -3.7, fz = mid[2] - 3.5, ringOfSeats = [[cyl(0.1, 0.1, 0.5, 7), '#6f4a2e', [0, 0.1, 0], [0, 0.4, Math.PI / 2]], [cyl(0.1, 0.1, 0.5, 7), '#6f4a2e', [0, 0.16, 0], [0, 2, Math.PI / 2]]];
    for (let i = 0; i < 8; i++) ringOfSeats.push([new THREE.DodecahedronGeometry(0.15, 0), '#9a9a9a', [Math.cos(i * 0.785) * 0.5, 0.08, Math.sin(i * 0.785) * 0.5]]);
    for (const a of [0.5, 2.6, 4.5]) ringOfSeats.push([cyl(0.2, 0.2, 0.95, 10), '#8a5a3a', [Math.cos(a) * 1.2, 0.2, Math.sin(a) * 1.2], [0, Math.PI / 2 - a, Math.PI / 2]]);
    k.mesh(fuse(THREE, ringOfSeats), paint, fx, mid[1], fz);
    const flame = k.mesh(new THREE.ConeGeometry(0.2, 0.5, 8), k.lit('#ffb347', 1.8), fx, mid[1] + 0.45, fz); flame.castShadow = false; flame.add(k.glow('#ffb347', 3.2, 0.6));
    k.prop('pine', 5.2, mid[1], mid[2] + 0.4, { s: 1.1, solid: true });
    // far island: a friendly dragon clipped from a hedge, nodding by the tower
    const dx = 3.9, dz = S.far[2] - 3.2, G = '#1f6f6b', G2 = '#2a8a7f';
    k.mesh(fuse(THREE, [[box(2.9, 0.24, 1.1), '#8a5a3a', [0.1, 0.12, 0]], [ico(0.6), G, [0, 0.75, 0], [0, 0, 0], [1.3, 0.9, 0.9]], [ico(0.45), G2, [0.85, 0.62, 0]], [ico(0.5), G2, [-0.75, 0.8, 0]], [ico(0.34), G, [-1.2, 1.25, 0]],
      [new THREE.ConeGeometry(0.26, 0.9, 7), G, [1.5, 0.5, 0], [0, 0, -Math.PI / 2]], [new THREE.ConeGeometry(0.4, 0.8, 5), G2, [0.05, 1.45, 0.38], [0.5, 0, -0.3], [1, 1, 0.3]], [new THREE.ConeGeometry(0.4, 0.8, 5), G2, [0.05, 1.45, -0.38], [-0.5, 0, -0.3], [1, 1, 0.3]],
      ...[-0.5, 0.1, 0.7].map((x) => [new THREE.ConeGeometry(0.1, 0.24, 5), '#8fae6a', [x, 1.28 - Math.abs(x - 0.1) * 0.35, 0]])]), hedge, dx, S.far[1], dz);
    const head = k.mesh(fuse(THREE, [[ico(0.38), G, [0, 0, 0]], [box(0.42, 0.24, 0.32), G2, [-0.4, -0.06, 0]], ...[-1, 1].flatMap((s) => [[new THREE.SphereGeometry(0.08, 8, 6), '#ffffff', [-0.2, 0.16, s * 0.24]], [new THREE.SphereGeometry(0.04, 8, 6), '#2b2440', [-0.26, 0.17, s * 0.27]], [new THREE.ConeGeometry(0.06, 0.22, 5), '#f4ead8', [0.12, 0.38, s * 0.16]]]),
      [new THREE.TorusGeometry(0.1, 0.02, 5, 10, Math.PI), '#2b2440', [-0.62, -0.04, 0], [0, Math.PI / 2, Math.PI]]]), hedge, dx - 1.5, S.far[1] + 1.7, dz);
    k.prop('lamp', -5.6, S.far[1], S.far[2] - 0.5); k.prop('pine', 5.3, S.far[1], S.far[2] + 1.2, { s: 1.2, solid: true });
    // the stage island and the arena
    k.prop('pine', S.sim[0] - 6.6, S.sim[1], S.sim[2] - 1.6, { solid: true }); k.prop('banner', S.sim[0] + 3.2, S.sim[1], S.sim[2] - 6.2, { color: '#c2255c' });
    for (const a of [3.5, 5.9]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6);
    // loose pages drift and flutter between the shelves
    const sheet = k.mat('#f4ead8', { side: THREE.DoubleSide, roughness: 0.9 });
    const pages = [[-4.4, 3.3, -4.4], [3.1, 3.7, -5.4], [7.1, 2.3, 0.5], [1.6, mid[1] + 3.1, mid[2] + 1], [S.sim[0] + 4.2, S.sim[1] + 3.3, S.sim[2] - 4.6]].map(([x, y, z], i) => { const m = k.mesh(new THREE.PlaneGeometry(0.5, 0.68), sheet, x, y, z); m.castShadow = false; return { m, x, y, z, i }; });
    k.animate((dt, t) => {
      for (const p of pages) { p.m.position.set(p.x + Math.sin(t * 0.5 + p.i * 2) * 0.7, p.y + Math.sin(t * 0.9 + p.i) * 0.35, p.z + Math.cos(t * 0.4 + p.i) * 0.5); p.m.rotation.set(Math.sin(t * 1.7 + p.i) * 0.6, t * 0.5 + p.i, Math.sin(t * 2.3 + p.i * 3) * 0.4); }
      quill.rotation.z = -0.3 + Math.sin(t * 1.1) * 0.06; head.rotation.z = Math.sin(t * 0.8) * 0.1; head.position.y = S.far[1] + 1.7 + Math.sin(t * 0.8) * 0.05;
      spider.position.y = mid[1] + 3.1 + Math.sin(t * 0.7) * 0.25; flame.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 7 + 1) * 0.14, 1 + Math.cos(t * 8) * 0.08);
      curtains.forEach((c, i) => { c.scale.x = 1 + Math.sin(t * 1.2 + i * 2) * 0.06; });
    });
  },
  sim,
};
