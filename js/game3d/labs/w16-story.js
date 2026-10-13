// World 16 — Story Builder in 3D: a toy theatre whose painted stage flats are slid into beginning, middle and end.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

// Four short original fables, five beats each: beginning, three middle beats, end. Level 1 uses beats 1, 3 and 5.
export const FABLES = [
  { title: 'The Little Cloud', beats: [['☁️', 'A little cloud wishes it were big.'], ['💧', 'It drinks and drinks from the lake.'], ['🌬️', 'The wind carries it over a dry garden.'], ['🌧️', 'The cloud gives all its rain away.'], ['🌈', 'The flowers grow, and a rainbow smiles.']],
    guess: [['🌻', 'The cloud shares its rain.'], ['🙈', 'The cloud keeps its rain.']], moral: 'Giving can make you happy.' },
  { title: 'The Ant and the Crumb', beats: [['🍞', 'Ant finds a huge crumb.'], ['😓', 'It is far too heavy to carry alone.'], ['📣', 'Ant calls her friends.'], ['🐜', 'Together they lift the crumb.'], ['🎉', 'At home, everybody eats.']],
    guess: [['🤝', 'Friends help to carry it.'], ['🚶', 'Ant walks away hungry.']], moral: 'Together we are strong.' },
  { title: 'The Firefly', beats: [['🌙', 'Night comes. Firefly is afraid of the dark.'], ['🐭', 'A little mouse is lost.'], ['✨', 'Firefly switches on her tiny light.'], ['🏡', 'She leads the mouse all the way home.'], ['😊', 'Now Firefly knows: a small light is a big help.']],
    guess: [['🏡', 'Firefly lights the way home.'], ['🛌', 'Firefly hides until morning.']], moral: 'Even a small light can help.' },
  { title: 'The Apple Seed', beats: [['🌰', 'A tiny seed falls to the ground.'], ['🤲', 'A girl covers it with soil.'], ['🚿', 'Every day she waters it, and waits.'], ['🌱', 'One morning a green shoot peeps out.'], ['🍎', 'At last it is a tree full of apples.']],
    guess: [['🍎', 'The seed becomes a tree.'], ['🐦', 'A bird flies off with the seed.']], moral: 'Good things take time.' },
];
const PART = [['🟢', 'Beginning', '#17a673'], ['🟡', 'Middle', '#e89b0c'], ['🔴', 'End', '#d9485f']];
// Which beats a level uses, and which part of the story a place on the stage belongs to.
export const beatsFor = (level) => (level <= 1 ? [0, 2, 4] : [0, 1, 2, 3, 4]);
export const partOf = (i, n) => (i === 0 ? 0 : i === n - 1 ? 2 : 1);
// The places whose card is not the one that belongs there (cards are numbered in story order).
export const misplaced = (slots) => slots.map((n, i) => (n === i ? -1 : i)).filter((i) => i >= 0);

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

export default {
  id: 'w16-story',
  world: 16,
  levels: [1, 2],
  title: 'Story Builder',
  goal: 'Guess the ending, then put the story cards in order: beginning, middle, end.',
  kind: 'simplified',
  model: 'A toy theatre with one painted stage flat for each part of a story. The order is right only when every flat stands in the place where that part happens: the beginning first, the end last. These are very short fables written for this game, with one clear order. Real stories can begin in the middle, jump back in time or end in surprising ways.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x), calm = !!ctx.calm, lvl = ctx.level <= 1 ? 1 : 2;
    const picks = beatsFor(lvl), n = picks.length, gap = n === 3 ? 1.9 : 1.3;
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s = 24) => new THREE.CylinderGeometry(a, b, h, s);
    const paint = ctx.mat('#ffffff', { vertexColors: true, roughness: 0.8 }), gold = ctx.lit('#ffc55c', 1.5), velvet = ctx.mat('#c2255c', { roughness: 0.9 });
    const sx = (i) => (i - (n - 1) / 2) * gap, RY = 0.9, RZ = -0.9, TY = 0.1, TZ = 1.45;

    // ----- the theatre: floor, raised stage, backdrop, arch, a coloured tile for each place -----
    const set = [[box(7, 0.1, 4.6), '#8a5a3a', [0, 0.05, 0]], [box(7, RY - 0.1, 1.7), '#6f4a30', [0, 0.1 + (RY - 0.1) / 2, RZ - 0.15]], [box(7, 0.06, 1.74), '#b98045', [0, RY - 0.03, RZ - 0.15]],
      [box(7, 3.3, 0.1), '#1f3a5f', [0, RY + 1.65, -2.2]], [box(7, 0.4, 0.4), '#5f3dc4', [0, 4.4, 0.2]], [new THREE.SphereGeometry(0.3, 14, 10), '#fff3c4', [2.3, 3.7, -2.1]]];
    for (const s of [-1, 1]) set.push([box(0.4, 4.2, 0.4), '#5f3dc4', [s * 3.3, 2.1, 0.2]]);
    for (const [x, y] of [[-2.6, 3.9], [-1.5, 3.3], [-0.4, 3.95], [0.8, 3.4], [1.5, 4.0], [3.0, 3.1]]) set.push([new THREE.OctahedronGeometry(0.07), '#ffe9a8', [x, y, -2.12]]);
    for (let i = 0; i < n; i++) { set.push([box(1.08, 0.04, 0.9), PART[partOf(i, n)][2], [sx(i), RY + 0.02, RZ]]); set.push([cyl(0.5, 0.5, 0.03), '#d9c79a', [sx(i), TY + 0.015, TZ]]); }
    group.add(new THREE.Mesh(fuse(THREE, set), paint));
    const partX = [sx(0), 0, sx(n - 1)];
    PART.forEach(([dot, name], p) => { const s = ctx.sprite(dot, { size: 0.5, label: t(name) }); s.position.set(partX[p], RY + 2.1, RZ - 0.5); group.add(s); });
    for (let i = 0; i < n; i++) { const s = ctx.sprite(String(i + 1), { size: 0.3 }); s.position.set(sx(i), 0.3, 2.2); group.add(s); }
    const curtains = [-1, 1].map((s) => { const m = new THREE.Mesh(box(3.1, 3.4, 0.12), velvet); m.position.set(s * 1.55, RY + 1.7, 0.2); group.add(m); return { m, s }; });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 32), gold); ring.rotation.x = Math.PI / 2; ring.visible = false; group.add(ring);
    const spot = ctx.glow('#ffe9a8', 2.2, 0.75); spot.visible = false; group.add(spot);

    // ----- the stage flats: a painted panel on a base with a brace behind, like real theatre scenery -----
    const flatGeo = (w, h, colour) => fuse(THREE, [[box(w, 0.12, 0.5), '#5b4a36', [0, 0.06, 0]], [box(w, h, 0.08), colour, [0, 0.12 + h / 2, 0.05]], [box(w + 0.06, 0.06, 0.1), '#8a5a3a', [0, 0.12 + h + 0.03, 0.05]],
      [box(0.06, h * 0.9, 0.06), '#5b4a36', [-w * 0.3, 0.12 + h * 0.4, -0.14], [0.32, 0, 0]], [box(0.06, h * 0.9, 0.06), '#5b4a36', [w * 0.3, 0.12 + h * 0.4, -0.14], [0.32, 0, 0]]]);
    const makeFlat = (w, h, colour) => { const m = new THREE.Mesh(flatGeo(w, h, colour), paint); m.visible = false; group.add(m); return { m, h, face: null, at: [0, 0, 0], to: [0, 0, 0], show: 0, want: 0, hop: 0, shake: 0 }; };
    const flats = picks.map(() => makeFlat(1, 1.2, '#f4ead8')), endings = [-1, 1].map((s) => Object.assign(makeFlat(1.2, 0.95, '#cfe3ff'), { side: s }));
    const setFace = (f, icon, label, size) => {
      if (f.face) { f.m.remove(f.face); f.face.material?.map?.dispose?.(); f.face.material?.dispose?.(); }
      f.face = ctx.sprite(icon, label ? { size, label } : { size }); f.face.position.set(0, 0.12 + f.h / 2, 0.16); f.m.add(f.face);
    };
    const jump = (f, p) => { f.at = p.slice(); f.to = p.slice(); };

    // ----- the task -----
    let fable = null, last = -1, told = 0, phase = 'guess', opts = [0, 1], guessed = null, wrongTurns = 0, tray = [], slots = [], sel = 0, checkIn = -1, tellT = -1, open = 0, auto = false, cool = 0;
    ui.note('First look at how the story begins, and guess how it will end.');
    const guessC = ui.choice([[0, 'The ending on the left'], [1, 'The ending on the right']], '', (v) => guess(+v));
    ui.note('Then tap the cards in story order. You can also choose a card here and put it in the next free place.');
    const cardC = ui.choice(picks.map((_, k) => [k, 'Card ' + (k + 1)]), 0, (v) => select(+v));
    ui.button('Put this card in the next free place', () => place(tray[sel]), 'btn');
    ui.button('Take the last card back', () => takeBack());
    ui.button('▶️ Another story', () => { if (phase === 'done') begin(); else ctx.say(t('Finish this story first: every card needs its place.')); }, 'btn sm ghost');
    const rTitle = ui.readout('Story'), rPlaced = ui.readout('Cards in place'), rTold = ui.readout('Stories told');
    const counts = () => { rPlaced.set(slots.filter(Boolean).length + ' / ' + n + ' ' + t('cards')); rTold.set(told + ' ' + t(told === 1 ? 'story' : 'stories')); };
    const trayPos = (k) => [sx(k), TY, TZ], slotPos = (i) => [sx(i), RY, RZ];

    function begin() {
      let i; do { i = Math.floor(ctx.rng() * FABLES.length) % FABLES.length; } while (i === last);
      last = i; fable = FABLES[i];
      phase = 'guess'; guessed = null; wrongTurns = 0; slots = Array(n).fill(null); checkIn = -1; tellT = -1; sel = 0; open = 0; spot.visible = false;
      flats.forEach((f, k) => { f.n = k; f.text = fable.beats[picks[k]][1]; setFace(f, fable.beats[picks[k]][0], '', 0.78); f.want = k === 0 ? 1 : 0; f.show = 0; jump(f, [0, RY, RZ]); });
      opts = ctx.rng() < 0.5 ? [0, 1] : [1, 0];
      endings.forEach((f, k) => { const [icon, text] = fable.guess[opts[k]]; setFace(f, icon, t(text), 0.72); f.want = 1; f.show = 0; jump(f, [f.side * 2.15, TY, TZ]); });
      // shuffle the tray; if chance leaves it already in order, turn it round
      tray = flats.map((f) => [ctx.rng(), f]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      if (tray.every((f, k) => f.n === k)) tray.reverse();
      rTitle.set(t(fable.title)); counts();
      ctx.say('📖 ' + t(fable.title) + '. ' + t(flats[0].text) + ' ' + t('How will it end?') + ' ' + t('Left') + ': ' + t(fable.guess[opts[0]][1]) + ' ' + t('Right') + ': ' + t(fable.guess[opts[1]][1]));
    }
    function guess(side) {
      if (phase !== 'guess') { ctx.say(t('You have already guessed. Now put the cards in order.')); return; }
      guessed = opts[side]; phase = 'order'; endings[side].hop = 1;
      for (const f of endings) f.want = 0;
      tray.forEach((f, k) => { f.want = 1; if (f.n !== 0) jump(f, trayPos(k)); else f.to = trayPos(k); });
      ctx.say(t('Good guess! Now put the story in order to find out.') + ' ' + t('What happens first? Tap the cards in order.'));
    }
    function select(k) {
      sel = Math.max(0, Math.min(n - 1, k));
      const f = tray[sel];
      if (phase === 'guess' || !f) return;
      f.hop = 1; ctx.say(t(f.text));
    }
    function place(f) {
      if (phase === 'guess') { ctx.say(t('First guess how the story will end.')); return; }
      if (phase !== 'order' || !f || checkIn >= 0) return;
      if (slots.includes(f)) { ctx.say(t('That card is already on the stage. Choose one that is still waiting.')); return; }
      const at = slots.indexOf(null); if (at < 0) return;
      slots[at] = f; f.to = slotPos(at); f.hop = 0.6; counts();
      ctx.say(t(f.text));
      if (!slots.includes(null)) checkIn = 0.5;
    }
    function takeBack() {
      if (phase !== 'order' || checkIn >= 0) return;
      let at = -1; slots.forEach((f, i) => { if (f) at = i; });
      if (at >= 0) remove(at);
    }
    function remove(at) {
      const f = slots[at]; if (!f || phase !== 'order') return;
      slots[at] = null; f.to = trayPos(tray.indexOf(f)); counts();
    }
    function check() {
      const bad = misplaced(slots.map((f) => f.n));
      if (bad.length) {
        wrongTurns++;
        for (const i of bad) { slots[i].shake = 1; remove(i); }
        ctx.say(t(bad[0] === 0 ? 'Hmm. A story starts by showing who it is about. Which card does that?' : 'Almost! Ask: what had to happen before this could happen?'));
        return;
      }
      phase = 'done'; told++; tellT = 0; counts();
      ctx.say(slots.map((f) => t(f.text)).join(' ') + ' 🌟 ' + t(fable.moral) + ' ' + t(guessed === 0 ? 'You guessed the ending!' : 'The ending was a surprise!'));
      ctx.complete(Math.max(0.4, 1 - 0.15 * wrongTurns), 'Put a story in order: beginning, middle and end.');
    }

    flats.forEach((f) => ctx.onTap(f.m, () => {
      if (phase !== 'order') { if (phase === 'guess') ctx.say(t(f.text) + ' ' + t('How will it end?')); return; }
      const at = slots.indexOf(f);
      if (at >= 0) { if (checkIn < 0) remove(at); } else { sel = tray.indexOf(f); place(f); }
    }));
    endings.forEach((f, k) => ctx.onTap(f.m, () => guess(k)));
    begin();

    return {
      step(dt) {
        if (checkIn >= 0) { checkIn -= dt; if (checkIn < 0) { checkIn = -1; check(); } }
        if (tellT >= 0) tellT += dt;
        if (auto && phase !== 'done' && checkIn < 0) {
          cool -= dt;
          if (cool <= 0) {
            cool = 0.45;
            if (phase === 'guess') { const side = opts.indexOf(0); if (guessC.set) guessC.set(side); else guess(side); }
            else { const want = slots.indexOf(null), k = tray.findIndex((f) => f.n === want); if (k >= 0) { if (cardC.set) cardC.set(k); else select(k); place(tray[sel]); } }
          }
        }
      },
      frame(dt, time) {
        const k = Math.min(1, dt * (calm ? 14 : 5));
        open += (1 - open) * Math.min(1, dt * (calm ? 10 : 1.6));
        for (const c of curtains) { const w = 1 - 0.86 * open; c.m.scale.x = w; c.m.position.x = c.s * (3.1 - 1.55 * w); }
        const teller = tellT >= 0 ? Math.floor(tellT / 0.9) % (n + 2) : -1;
        for (const f of [...flats, ...endings]) {
          for (let a = 0; a < 3; a++) f.at[a] += (f.to[a] - f.at[a]) * k;
          f.show += (f.want - f.show) * Math.min(1, dt * 6); f.hop = Math.max(0, f.hop - dt * 2.2); f.shake = Math.max(0, f.shake - dt * 1.5);
          const moving = Math.hypot(f.to[0] - f.at[0], f.to[1] - f.at[1], f.to[2] - f.at[2]), told1 = phase === 'done' && slots[teller] === f && !calm ? Math.abs(Math.sin((tellT / 0.9) * Math.PI)) * 0.18 : 0;
          f.m.visible = f.show > 0.02; f.m.scale.setScalar(Math.max(0.001, f.show));
          f.m.position.set(f.at[0] + (calm ? 0 : Math.sin(time * 36) * 0.05 * f.shake), f.at[1] + (calm ? 0 : Math.sin(Math.PI * f.hop) * 0.22 + Math.min(0.35, moving * 0.25)) + told1, f.at[2]);
        }
        const chosen = tray[sel];
        ring.visible = phase === 'order' && !!chosen && !slots.includes(chosen);
        if (ring.visible) ring.position.set(sx(sel), TY + 0.06, TZ);
        spot.visible = phase === 'done' && teller >= 0 && teller < n;
        if (spot.visible) spot.position.set(sx(teller), RY + 0.9, RZ + 0.35);
      },
      autoplay() { auto = true; cool = 0.3; },
      dispose() { for (const f of [...flats, ...endings]) { f.face?.material?.map?.dispose?.(); f.face?.material?.dispose?.(); } },
    };
  },
};
