// World 17 lab — Sort and Spot in 3D: things ride in on a conveyor belt and hop into the basket the player chooses;
// then a row of solid shapes rides in and the player picks the shape that continues the pattern.
// No imports: everything arrives through the context, so the lab also runs in the automated tests without a browser.

const RULES = {
  colour: { bins: [['🔴', 'red'], ['🔵', 'blue']], why: 'Every item went in the bin with the same colour.' },
  size: { bins: [['🐘', 'big'], ['🐭', 'small']], why: 'Only the size matters here, not the colour.' },
  kind: { bins: [['🐶', 'animal'], ['🍎', 'fruit']], why: 'Animals go together and fruits go together.' },
};
const SHAPES = ['triangle', 'cube', 'star', 'heart', 'moon'];
const UNITS = [[0, 1], [0, 0, 1], [0, 1, 2]];        // the three rounds: AB AB…, AAB AAB…, ABC ABC…
const ITEMS = 8, ROUNDS = 3, PASS = 0.7;

// ----- the rules, kept apart from the scene so they can be checked -----
export const model = {
  // The shape at place i (counting from 0) of a pattern that repeats `unit` for ever.
  at: (unit, i) => unit[i % unit.length],
  row(unit, pool, n = 5) { const seq = []; for (let i = 0; i < n; i++) seq.push(pool[model.at(unit, i)]); return seq; },
  score: (right, pRight) => right / ITEMS * 0.6 + pRight / ROUNDS * 0.4,
};
// Used by the automated tests: the fifth shape of each pattern, worked by hand, and the score.
export function selfTest() {
  const pool = ['a', 'b', 'c', 'd', 'e'], fifth = UNITS.map((u) => model.row(u, pool)[4]);      // ABAB→A, AABA→A, ABCA→B
  const rows = UNITS.map((u) => model.row(u, pool).join(''));
  const s = [model.score(8, 3), model.score(6, 2), model.score(8, 0), model.score(4, 3)];
  const ok = fifth.join('') === 'aab' && rows.join() === 'ababa,aabaa,abcab' && Math.abs(s[0] - 1) < 1e-12 && Math.abs(s[1] - (0.45 + 0.8 / 3)) < 1e-12 && Math.abs(s[2] - 0.6) < 1e-12 && Math.abs(s[3] - 0.7) < 1e-12;
  return { ok, detail: `rows ${rows.join(' ')} (by hand ababa aabaa abcab); scores ${s.map((x) => x.toFixed(3)).join(', ')} (by hand 1, 0.717, 0.6, 0.7)` };
}

export default {
  id: 'w17-sort-pattern',
  world: 17,
  levels: [1, 2],
  title: 'Sort and Spot',
  goal: 'Put each thing in the right basket, then find what comes next in the pattern.',
  kind: 'validated',
  model: 'Sorting by one exact rule (colour, size or kind), and patterns that repeat a short group of shapes for ever, so the next shape is certain. The hops and the belt are drawn for clarity, not measured. Only one simple rule at a time and short repeating patterns. Real sorting often has several rules at once, and many patterns have more than one answer.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rnd = ctx.rng || Math.random, lv = Math.max(1, Math.min(6, ctx.level || 1));
    const ri = (n) => Math.min(n - 1, Math.floor(rnd() * n)), shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // Level 1 sorts by what is easy to see (colour or kind). Level 2 sorts by size, where the colours are there to distract, or by kind.
    const ruleName = lv <= 1 ? ['colour', 'kind'][ri(2)] : ['size', 'size', 'kind'][ri(3)], rule = RULES[ruleName];
    const geos = [], G = (g) => { geos.push(g); return g; };
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    const M = (c, o) => ctx.mat(c, { roughness: 0.55, ...o });

    // ----- the conveyor belt -----
    const BY = 1.06, BZ = -0.9;                                   // top of the belt, and its distance behind the centre
    add(G(new THREE.BoxGeometry(6.9, 0.14, 1.0)), M('#27455a', { roughness: 0.9 }), 0, BY - 0.07, BZ);
    add(G(new THREE.BoxGeometry(7.0, 0.2, 0.08)), M('#7f9aab', { metalness: 0.5, roughness: 0.35 }), 0, BY - 0.08, BZ + 0.54);
    const legG = G(new THREE.BoxGeometry(0.16, BY - 0.14, 0.16));
    for (const x of [-3.2, 0, 3.2]) for (const z of [BZ - 0.4, BZ + 0.4]) add(legG, M('#7f9aab', { metalness: 0.5, roughness: 0.35 }), x, (BY - 0.14) / 2, z);
    const rollG = G(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 6)), rollM = ctx.mat('#f4f8fb', { flatShading: true });
    const rollers = [-3.3, -2.2, -1.1, 0, 1.1, 2.2, 3.3].map((x) => { const r = add(rollG, rollM, x, BY - 0.08, BZ + 0.62); r.rotation.x = Math.PI / 2; return r; });
    const cleatG = G(new THREE.BoxGeometry(0.06, 0.03, 0.9)), cleatM = M('#22c3dd');
    const cleats = Array.from({ length: 9 }, (_, k) => add(cleatG, cleatM, -3.4 + k * 0.85, BY + 0.01, BZ));
    // ----- two baskets -----
    const wicker = M('#c98f4e', { roughness: 0.9 }), wickerDark = M('#9c6a34', { roughness: 0.9 });
    const wallG = G(new THREE.BoxGeometry(1.1, 0.75, 0.07)), sideG = G(new THREE.BoxGeometry(0.07, 0.75, 0.9)), floorG = G(new THREE.BoxGeometry(1.1, 0.07, 0.9)), bandG = G(new THREE.BoxGeometry(1.14, 0.16, 0.09));
    const bandColor = ruleName === 'colour' ? ['#e03131', '#1c7ed6'] : ['#7048e8', '#7048e8'];
    const baskets = [-2.7, 2.7].map((x, k) => {
      const g = new THREE.Group(); g.position.set(x, 0, 1.0); group.add(g);
      const parts = [add(floorG, wickerDark, 0, 0.035, 0, g), add(wallG, wicker, 0, 0.375, 0.45, g), add(wallG, wicker, 0, 0.375, -0.45, g), add(sideG, wicker, -0.55, 0.375, 0, g), add(sideG, wicker, 0.55, 0.375, 0, g), add(bandG, M(bandColor[k]), 0, 0.62, 0.46, g)];
      for (const p of parts) ctx.onTap?.(p, () => choose(k ? 2 : 0));
      const tag = ctx.sprite(rule.bins[k][0], { size: 0.55, label: rule.bins[k][1] }); tag.position.set(0, 1.55, 0); g.add(tag);
      return { g, x, n: 0, bump: 0 };
    });
    // ----- three pedestals for the pattern answers (they rise from the floor for the second part) -----
    const pedG = G(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 20)), pedM = M('#f4f8fb');
    const peds = [-1.25, 0, 1.25].map((x, k) => { const p = add(pedG, pedM, x, 0.3, 1.1); p.scale.y = 0.02; p.position.y = 0.006; p.visible = false; ctx.onTap?.(p, () => choose(k)); return p; });
    const slotRing = add(G(new THREE.TorusGeometry(0.36, 0.05, 8, 24)), ctx.lit('#ffc94d', 1.3), 2.4, BY + 0.06, BZ); slotRing.rotation.x = Math.PI / 2; slotRing.visible = false;
    const ask = ctx.sprite('❓', { size: 0.6 }); ask.position.set(2.4, BY + 0.6, BZ); ask.visible = false; group.add(ask);

    // ----- things to sort, made from simple solid shapes -----
    const ballG = G(new THREE.SphereGeometry(0.24, 18, 12)), boxG = G(new THREE.BoxGeometry(0.4, 0.4, 0.4)), drumG = G(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 16));
    const smallG = G(new THREE.SphereGeometry(0.1, 10, 8)), earG = G(new THREE.ConeGeometry(0.07, 0.16, 6)), longEarG = G(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 6)), eyeG = G(new THREE.SphereGeometry(0.035, 8, 6));
    const bananaG = G(new THREE.TorusGeometry(0.22, 0.07, 8, 14, Math.PI * 0.9)), berryG = G(new THREE.ConeGeometry(0.2, 0.4, 12)), leafG = G(new THREE.ConeGeometry(0.16, 0.08, 6));
    const eyeM = M('#1d2b36');
    const animal = (name) => {
      const g = new THREE.Group(), c = { cat: '#f08c00', rabbit: '#f1f3f5', frog: '#40c057' }[name], m = M(c);
      const body = add(ballG, m, 0, 0.2, 0, g); body.scale.set(1, 0.85, 1.1);
      const head = add(ballG, m, 0, 0.5, 0.12, g); head.scale.setScalar(0.72);
      for (const s of [-1, 1]) {
        if (name === 'cat') add(earG, m, s * 0.1, 0.7, 0.1, g);
        else if (name === 'rabbit') add(longEarG, m, s * 0.07, 0.78, 0.08, g);
        else { const e = add(smallG, m, s * 0.1, 0.66, 0.16, g); e.scale.setScalar(0.8); }
        add(eyeG, eyeM, s * 0.08, name === 'frog' ? 0.69 : 0.55, name === 'frog' ? 0.23 : 0.28, g);
      }
      if (name === 'cat') { const t = add(longEarG, m, 0, 0.3, -0.3, g); t.rotation.x = -0.7; }
      if (name === 'rabbit') add(smallG, m, 0, 0.2, -0.27, g);
      return g;
    };
    const fruit = (name) => {
      const g = new THREE.Group();
      if (name === 'banana') { const b = add(bananaG, M('#ffd43b'), 0, 0.34, 0, g); b.rotation.z = Math.PI * 1.05; }
      else if (name === 'grapes') { const m = M('#9c36b5'); for (const [x, y, z] of [[-0.11, 0.42, 0], [0.11, 0.42, 0], [0, 0.42, 0.11], [-0.06, 0.26, 0.04], [0.07, 0.26, 0.03], [0, 0.11, 0.03]]) add(smallG, m, x, y, z, g); add(leafG, M('#40c057'), 0, 0.54, 0, g); }
      else { const b = add(berryG, M('#e03131'), 0, 0.22, 0, g); b.rotation.x = Math.PI; add(leafG, M('#40c057'), 0, 0.45, 0, g); }
      return g;
    };
    const solid = (color) => { const g = new THREE.Group(), k = ri(3), geo = [ballG, boxG, drumG][k]; add(geo, M(color), 0, k === 0 ? 0.24 : k === 1 ? 0.2 : 0.21, 0, g); return g; };
    // One thing for the belt, by the same rules as the flat lab: its basket is 0 (left) or 1 (right).
    const makeItem = () => {
      const bin = rnd() < 0.5 ? 0 : 1; let g, size = 1, name;
      if (ruleName === 'colour') { g = solid(bin ? '#1c7ed6' : '#e03131'); name = bin ? 'blue' : 'red'; }
      else if (ruleName === 'size') { g = solid(['#9c36b5', '#ffd43b', '#40c057'][ri(3)]); size = bin ? 0.62 : 1.68; name = bin ? 'small' : 'big'; }      // 1.4 : 3.8, as in the flat lab
      else { name = bin ? ['banana', 'grapes', 'strawberry'][ri(3)] : ['cat', 'rabbit', 'frog'][ri(3)]; g = bin ? fruit(name) : animal(name); size = 1.15; }
      g.scale.setScalar(size); group.add(g);
      return { g, bin, size, name };
    };
    // ----- the five pattern shapes, each a solid with real thickness -----
    const ext = (shape) => { const g = G(new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 14 })); g.center(); return g; };
    const starS = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.14 : 0.32, a = Math.PI / 2 + k * Math.PI / 5; if (k) starS.lineTo(Math.cos(a) * r, Math.sin(a) * r); else starS.moveTo(Math.cos(a) * r, Math.sin(a) * r); } starS.closePath();
    const heartS = new THREE.Shape(); heartS.moveTo(0, -0.28); heartS.bezierCurveTo(-0.5, 0.05, -0.3, 0.42, 0, 0.16); heartS.bezierCurveTo(0.3, 0.42, 0.5, 0.05, 0, -0.28);
    const moonS = new THREE.Shape(); moonS.absarc(0, 0, 0.3, Math.PI * 0.5, Math.PI * 1.5, false); moonS.absarc(0.22, 0, 0.37, Math.PI * 1.3, Math.PI * 0.7, true);
    const SHAPE = {
      triangle: [G(new THREE.ConeGeometry(0.32, 0.56, 3)), '#f76707'], cube: [G(new THREE.BoxGeometry(0.46, 0.46, 0.46)), '#1c7ed6'],
      star: [ext(starS), '#fab005'], heart: [ext(heartS), '#e64980'], moon: [ext(moonS), '#9775fa'],
    };
    const makeShape = (name) => { const [geo, c] = SHAPE[name], m = new THREE.Mesh(geo, M(c)); m.castShadow = true; group.add(m); return m; };

    // ----- the game -----
    let speed = 1.2, phase = 'sort', n = 0, right = 0, pRound = 0, pRight = 0, cur = null, state = 'idle', t = 0, hop = null, kept = [], auto = false, beltOn = false;
    let row = [], opts = [], ans = '', rowX = 0, chosen = -1, pedUp = 0, celebrate = 0;
    const speedS = ui.slider({ label: 'Belt speed', min: 0.5, max: 2.5, step: 0.1, value: speed, unit: 'm/s', onInput: (v) => { speed = +v; } });
    ui.button('⬅ Left', () => choose(0), 'btn');
    ui.button('⬆ Middle (patterns only)', () => choose(1), 'btn');
    ui.button('➡ Right', () => choose(2), 'btn');
    ui.button('🔁 Try again', () => restart(), 'btn ghost');
    const rSort = ui.readout('Sorted right'), rPat = ui.readout('Patterns found'), rBelt = ui.readout('Belt speed, m/s');
    ui.note(`Each thing stops in the middle of the belt. Tap the basket it belongs in, or use the buttons. The baskets are for: ${rule.bins[0][1]} (left) and ${rule.bins[1][1]} (right). After 8 things, three patterns ride in: pick the shape that comes next.`);
    const stats = () => { rSort.set(`${right} / ${ITEMS}`); rPat.set(`${pRight} / ${ROUNDS}`); rBelt.set(speed.toFixed(1)); };
    const drop = (o) => { o?.removeFromParent(); };
    const clearRow = () => { for (const s of row) drop(s.m); for (const o of opts) drop(o.m); row = []; opts = []; slotRing.visible = false; ask.visible = false; };

    function nextSort() {
      if (n >= ITEMS) return startPattern();
      cur = makeItem(); cur.g.position.set(-3.9, BY, BZ); state = 'enter'; beltOn = true; stats();
      ctx.say(n === 0 ? `Here comes the first thing. Which basket: ${rule.bins[0][1]} or ${rule.bins[1][1]}?` : `Thing ${n + 1} of ${ITEMS}. Which basket? Tap one.`);
    }
    // The hop: an arc from where the thing is to a place in a basket.
    const hopTo = (k, then) => {
      const b = baskets[k], from = cur.g.position.clone(), slot = b.n % 4, to = new THREE.Vector3(b.x + (slot % 2 ? 0.22 : -0.22), 0.1 + Math.floor(b.n / 4) * 0.3, 1.0 + (slot > 1 ? 0.16 : -0.16));
      hop = { from, to, k, then, T: 0.7 }; t = 0; state = 'hop';
    };
    function pickBasket(k) {
      if (phase !== 'sort' || state !== 'wait') return;
      const ok = k === cur.bin; if (ok) right++; n++;
      if (ok) { ctx.say(ruleName === 'size' ? `Yes! It is ${cur.name}, whatever its colour.` : ruleName === 'colour' ? `Yes! It is ${cur.name}, so it goes with the ${cur.name} things.` : `Yes! A ${cur.name} is ${cur.bin ? 'a fruit' : 'an animal'}.`); hopTo(k, 'land'); }
      else {
        ctx.say(ruleName === 'size' ? `Not that one. Do not look at the colour: this one is ${cur.name}. Watch where it goes.` : ruleName === 'colour' ? `Not that one. This one is ${cur.name}. Watch where it goes.` : `Not that one. A ${cur.name} is ${cur.bin ? 'a fruit' : 'an animal'}. Watch where it goes.`);
        const b = baskets[k], from = cur.g.position.clone();
        hop = { from, to: new THREE.Vector3(b.x, 0.95, 1.0), k, then: 'bounce', T: 0.6 }; t = 0; state = 'hop';
      }
      stats();
    }
    function startPattern() {
      phase = 'pattern'; cur = null; pedUp = 1; for (const p of peds) p.visible = true;
      ctx.say(`${rule.why} You sorted ${right} of ${ITEMS}. Now a row of shapes is coming. Look for the part that repeats.`);
      nextPattern(true);
    }
    function nextPattern(keepSay) {
      clearRow();
      if (pRound >= ROUNDS) return finish();
      const pool = shuffle(SHAPES), seq = model.row(UNITS[pRound], pool); ans = seq.pop();
      const names = shuffle([ans, ...pool.filter((s) => s !== ans).slice(0, 2)]);
      rowX = -7.2; chosen = -1;
      row = seq.map((name, k) => ({ name, m: makeShape(name), x: -2.4 + k * 1.2 }));
      opts = names.map((name, k) => { const m = makeShape(name); m.position.set(peds[k].position.x, 1.0, 1.1); ctx.onTap?.(m, () => choose(k)); return { name, m, home: new THREE.Vector3(peds[k].position.x, 1.0, 1.1) }; });
      for (const s of row) s.m.position.set(s.x + rowX, BY + 0.34, BZ);
      state = 'rowin'; beltOn = true; stats();
      if (!keepSay) ctx.say(`Pattern ${pRound + 1} of ${ROUNDS} is riding in. What comes next?`);
    }
    function pickShape(k) {
      if (phase !== 'pattern' || state !== 'ask' || !opts[k]) return;
      const ok = opts[k].name === ans; if (ok) pRight++; pRound++; chosen = k;
      const unit = UNITS[pRound - 1].length;
      if (ok) { ctx.say(`Yes! The pattern repeats every ${unit} shapes, so the ${ans} comes next.`); hop = { o: opts[k], to: new THREE.Vector3(2.4, BY + 0.34, BZ), then: 'cheer', T: 0.7 }; }
      else { ctx.say(`Not quite. The pattern repeats every ${unit} shapes: count them along the row. The ${ans} comes next. Watch it hop into place.`); hop = { o: opts[k], to: opts[k].home.clone(), then: 'fix', T: 0.6, shake: true }; }
      hop.from = hop.o.m.position.clone(); t = 0; state = 'phop'; ask.visible = false; stats();
    }
    function choose(pos) {
      if (phase === 'sort') { if (pos === 1) { if (state === 'wait') ctx.say('The middle button is for the patterns. Choose the left or the right basket.'); return; } pickBasket(pos === 0 ? 0 : 1); }
      else if (phase === 'pattern') pickShape(pos);
    }
    function finish() {
      phase = 'done'; state = 'idle'; beltOn = false;
      const score = model.score(right, pRight);
      if (score >= PASS) {
        ctx.say(`Sorted ${right} of ${ITEMS} and found ${pRight} of ${ROUNDS} patterns! Patterns are things that repeat. Spotting a rule lets you guess what comes next.`);
        ctx.complete(score, `rule=${ruleName}, sorted=${right}/${ITEMS}, patterns=${pRight}/${ROUNDS}`);
      } else ctx.say(`Sorted ${right} of ${ITEMS} and found ${pRight} of ${ROUNDS} patterns. Press Try again: look for the one thing that every item in a basket shares.`);
    }
    function restart() {
      clearRow(); if (cur) drop(cur.g); for (const k of kept) drop(k); kept = []; for (const b of baskets) b.n = 0;
      n = 0; right = 0; pRound = 0; pRight = 0; phase = 'sort'; pedUp = 0; hop = null; cur = null; stats(); nextSort();
    }
    const arc = (from, to, u, h) => new THREE.Vector3(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u + Math.sin(Math.PI * u) * h, from.z + (to.z - from.z) * u);
    stats(); nextSort();

    return {
      step(dt) {
        t += dt;
        if (state === 'enter') {
          cur.g.position.x += speed * dt;
          if (cur.g.position.x >= 0) { cur.g.position.x = 0; state = 'wait'; beltOn = false; }
        } else if (state === 'wait') { if (auto) pickBasket(cur.bin); }
        else if (state === 'hop') {
          const u = Math.min(1, ctx.calm ? 1 : t / hop.T); cur.g.position.copy(arc(hop.from, hop.to, u, 1.1));
          if (!ctx.calm) cur.g.rotation.y += dt * 5;
          if (u >= 1) {
            if (hop.then === 'bounce') { baskets[hop.k].bump = 1; hopTo(cur.bin, 'land'); }
            else { const b = baskets[hop.k]; b.n++; b.bump = 0.6; kept.push(cur.g); cur = null; state = 'pause'; t = 0; }
          }
        } else if (state === 'pause') { if (t > (ctx.calm ? 0.4 : 0.5)) nextSort(); }
        else if (state === 'rowin') {
          rowX = Math.min(0, rowX + speed * 1.6 * dt);
          for (const s of row) s.m.position.x = s.x + rowX;
          if (rowX >= 0) { state = 'ask'; beltOn = false; slotRing.visible = true; ask.visible = true; }
        } else if (state === 'ask') { if (auto) pickShape(opts.findIndex((o) => o.name === ans)); }
        else if (state === 'phop') {
          const u = Math.min(1, ctx.calm ? 1 : t / hop.T);
          if (hop.shake) hop.o.m.position.set(hop.from.x + Math.sin(u * Math.PI * 6) * 0.12 * (1 - u), hop.from.y, hop.from.z);
          else hop.o.m.position.copy(arc(hop.from, hop.to, u, 1.2));
          if (u >= 1) {
            if (hop.then === 'fix') { const o = opts.find((x) => x.name === ans); hop = { o, from: o.m.position.clone(), to: new THREE.Vector3(2.4, BY + 0.34, BZ), then: 'cheer', T: 0.7 }; t = 0; }
            else { slotRing.visible = false; row.push({ name: ans, m: hop.o.m, x: 2.4 }); opts = opts.filter((x) => x !== hop.o); celebrate = 1; state = 'ppause'; t = 0; }
          }
        } else if (state === 'ppause') { if (t > 1.3) nextPattern(false); }
      },
      frame(dt, time) {
        const e = ctx.calm ? 1 : Math.min(1, dt * 6);
        if (beltOn) {
          const v = state === 'rowin' ? speed * 1.6 : speed;
          for (const c of cleats) { c.position.x += v * dt; if (c.position.x > 3.4) c.position.x -= 7.65; }
          for (const r of rollers) r.rotation.y -= v * dt / 0.11;
        }
        for (const b of baskets) { b.bump = Math.max(0, b.bump - dt * 3); b.g.scale.set(1 + b.bump * 0.08, 1 - b.bump * 0.1, 1 + b.bump * 0.08); }
        for (const p of peds) { p.scale.y += ((pedUp ? 1 : 0.02) - p.scale.y) * e; p.position.y = 0.3 * p.scale.y; }
        celebrate = Math.max(0, celebrate - dt * 0.9);
        row.forEach((s, k) => {
          if (state !== 'phop' || s.m !== hop?.o?.m) s.m.position.y = BY + 0.34 + (ctx.calm ? 0 : Math.abs(Math.sin(time * 7 - k * 0.6)) * 0.3 * celebrate);
          if (!ctx.calm) s.m.rotation.y = Math.sin(time * 1.2 + k * 0.5) * 0.6;
        });
        for (const o of opts) if (!ctx.calm && !(state === 'phop' && hop?.o === o)) { o.m.rotation.y = time * 0.9; o.m.position.y = o.home.y + Math.sin(time * 2 + o.home.x) * 0.04; }
        if (ask.visible && !ctx.calm) ask.position.y = BY + 0.62 + Math.sin(time * 3) * 0.06;
      },
      // Shows a successful run without the player (used by tests).
      autoplay() { auto = true; speedS.set(2.5); if (phase === 'done' && model.score(right, pRight) < PASS) restart(); },
      dispose() { clearRow(); for (const g of geos) g.dispose(); },
      get state() { return { ruleName, phase, state, n, right, pRound, pRight }; },
    };
  },
};
