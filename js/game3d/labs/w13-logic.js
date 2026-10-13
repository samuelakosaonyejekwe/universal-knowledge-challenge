// World 13 lab — Race Detective, in 3D: runners on a track, a podium, and clue lamps.
// No imports: the puzzle logic below is the same as the flat lab's (js/labs/w13-logic.js), copied here.

const RUNNERS = [['🦊', 'Fox'], ['🦉', 'Owl'], ['🐢', 'Turtle'], ['🐇', 'Hare'], ['🦔', 'Hedgehog'], ['🐿️', 'Squirrel'], ['🦆', 'Duck']];
const COAT = { Fox: ['#e8762c', '#fff3e0'], Owl: ['#8a6240', '#f3ead8'], Turtle: ['#6fbf73', '#2f7d4f'], Hare: ['#c9c5bd', '#ffffff'], Hedgehog: ['#e0c39a', '#5a4636'], Squirrel: ['#b5532a', '#d9793f'], Duck: ['#ffd43b', '#f08c00'] };
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
const MAXC = 7;                                                         // most clues shown at once

// ---------- pure puzzle logic (order[i] = runner who finished in place i) ----------
export function permutations(n) {
  const out = [], go = (cur, left) => { if (!left.length) out.push(cur); else left.forEach((x, i) => go([...cur, x], left.filter((_, j) => j !== i))); };
  go([], [...Array(n).keys()]);
  return out;
}
const place = (order, who) => order.indexOf(who);
export const holds = (c, order) => {
  const a = place(order, c.a), b = c.b == null ? -1 : place(order, c.b);
  if (a < 0 || (c.b != null && b < 0)) return null; // not decided yet
  switch (c.type) {
    case 'before': return a < b;
    case 'justBefore': return a + 1 === b;
    case 'next': return Math.abs(a - b) === 1;
    case 'apart': return Math.abs(a - b) > 1;
    case 'at': return a === c.k;
    case 'notAt': return a !== c.k;
    default: return a === 0 || a === order.length - 1; // 'end'
  }
};
export const consistent = (clues, n) => permutations(n).filter((p) => clues.every((c) => holds(c, p)));

// Build a set of true clues with exactly one solution, then drop any clue that is not needed.
export function generate(n, hard, rng) {
  const sol = permutations(n)[Math.floor(rng() * permutations(n).length)];
  const pool = [];
  for (let a = 0; a < n; a++) {
    for (let k = 0; k < n; k++) pool.push({ type: hard ? 'notAt' : (rng() < 0.3 ? 'at' : 'notAt'), a, k });
    pool.push({ type: 'end', a });
    for (let b = 0; b < n; b++) if (a !== b) for (const type of ['before', 'justBefore', 'next', 'apart']) pool.push({ type, a, b });
  }
  const truths = pool.filter((c) => holds(c, sol)).map((c) => [rng(), c]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  let clues = [], left = permutations(n).length;
  for (const c of truths) { // keep a clue only if it rules something out
    if (left === 1) break;
    if (!hard && c.type === 'at' && clues.some((x) => x.type === 'at')) continue;
    const now = consistent([...clues, c], n).length;
    if (now < left) { clues.push(c); left = now; }
  }
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.filter((_, j) => j !== i);
    if (consistent(without, n).length === 1) clues = without;
  }
  return { sol, clues };
}

// Model check: counts worked out by hand, and every generated puzzle must have exactly one answer.
export function selfTest() {
  const fact = [3, 4, 5].map((n) => permutations(n).length);                                   // 6, 24, 120
  const c = (clue, n) => consistent([clue], n).length;
  const got = [c({ type: 'before', a: 0, b: 1 }, 3), c({ type: 'at', a: 0, k: 0 }, 3), c({ type: 'justBefore', a: 0, b: 1 }, 3), c({ type: 'next', a: 0, b: 1 }, 3),
    c({ type: 'apart', a: 0, b: 1 }, 3), c({ type: 'end', a: 0 }, 4), c({ type: 'notAt', a: 0, k: 0 }, 4), c({ type: 'before', a: 0, b: 1 }, 5), c({ type: 'next', a: 0, b: 1 }, 5), c({ type: 'apart', a: 0, b: 1 }, 5)];
  const want = [3, 2, 2, 4, 2, 12, 18, 60, 48, 72];
  let seed = 12345, unique = true, made = 0;
  const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (const [n, hard] of [[3, false], [4, false], [5, true]]) for (let i = 0; i < 12; i++) {
    const p = generate(n, hard, rng), fits = consistent(p.clues, n); made++;
    if (fits.length !== 1 || fits[0].join() !== p.sol.join() || !p.clues.every((x) => holds(x, p.sol))) unique = false;
  }
  const open = holds({ type: 'before', a: 0, b: 1 }, [0, null, null]) === null;                // a clue is undecided until both runners stand
  return { ok: fact.join() === '6,24,120' && got.join() === want.join() && unique && open,
    detail: `orders for 3, 4, 5 runners: ${fact.join(', ')} (6, 24, 120); orders left by single clues: ${got.join(', ')} (expected ${want.join(', ')}); ${made} generated puzzles each have exactly one answer: ${unique}` };
}

export default {
  id: 'w13-logic',
  world: 13,
  levels: [3, 4, 5, 6],
  title: 'Race Detective',
  goal: 'Use the clues to work out the one finishing order that fits them all.',
  kind: 'validated',
  model: 'A small made-up puzzle with no ties. Every puzzle is checked by trying all possible orders, so exactly one answer fits. The race you see at the end is only a replay of your answer: the runners have no real speeds. Real detectives rarely get clues this tidy.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, T = ctx.t || ((x) => x), onTap = ctx.onTap || (() => {}), rng = ctx.rng || Math.random;
    const lvl = Math.round(ctx.level) || 3, n = lvl <= 3 ? 3 : lvl === 4 ? 4 : 5, hard = lvl >= 5;
    const total = permutations(n).length;
    const geos = [], G = (g) => { geos.push(g); return g; };
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); m.castShadow = true; return m; };
    const cast = RUNNERS.map((r) => [rng(), r]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
    const name = (i) => cast[i][0] + ' ' + T(cast[i][1]);

    // ---------- the scene ----------
    const W = 0.95, PZ = -0.95, FRONT = -0.2, LANE = 0.4, Z0 = 0.4, STARTX = -3.0, ENDX = 2.75;
    const PX = (k) => (k - (n - 1) / 2) * W, PH = (k) => 1.3 - k * 0.2, laneZ = (i) => Z0 + (i + 0.5) * LANE, homeX = (i) => (i - (n - 1) / 2) * 1.15;
    // the running track with lane lines, a start line and a finish gate
    const track = add(G(new THREE.BoxGeometry(6.9, 0.08, n * LANE + 0.1)), ctx.mat('#c9553f', { roughness: 0.9 }), 0, 0.04, Z0 + n * LANE / 2); track.castShadow = false; track.receiveShadow = true;
    const white = ctx.mat('#fbf6ea', { roughness: 0.6 }), lineGeo = G(new THREE.BoxGeometry(6.9, 0.02, 0.03));
    for (let i = 0; i <= n; i++) add(lineGeo, white, 0, 0.09, Z0 + i * LANE).castShadow = false;
    const crossGeo = G(new THREE.BoxGeometry(0.08, 0.02, n * LANE));
    add(crossGeo, white, STARTX + 0.25, 0.09, Z0 + n * LANE / 2).castShadow = false; add(crossGeo, ctx.lit('#ffc94d', 0.8), ENDX, 0.09, Z0 + n * LANE / 2).castShadow = false;
    const dark = ctx.mat('#343a40', { roughness: 0.5 }), postGeo = G(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 10));
    add(postGeo, dark, ENDX, 0.85, Z0 - 0.08); add(postGeo, dark, ENDX, 0.85, Z0 + n * LANE + 0.08);
    add(G(new THREE.BoxGeometry(0.14, 0.3, n * LANE + 0.4)), ctx.lit('#ffc94d', 0.5), ENDX, 1.75, Z0 + n * LANE / 2);
    // the podium: one step for each place, the winner's the tallest
    const stepM = ['#ffc94d', '#c8ccd2', '#c98a4b', '#ece7dc', '#ece7dc'].map((c, i) => ctx.mat(c, { roughness: 0.4, metalness: i < 3 ? 0.35 : 0 }));
    const steps = [];
    for (let k = 0; k < n; k++) {
      const m = add(G(new THREE.BoxGeometry(W * 0.96, PH(k), 0.9)), stepM[k], PX(k), PH(k) / 2, PZ); m.receiveShadow = true; steps.push(m);
      onTap(m, () => { stopAuto(); tapPlace(k); });
      const s = ctx.sprite(T(ORD[k]), { size: 0.3, color: '#23272b' }); s.position.set(PX(k), PH(k) * 0.5, PZ + 0.47); group.add(s);
    }
    // the clue lamps: grey until a runner it talks about stands on the podium, then green (fits) or red (does not)
    const lampM = [ctx.mat('#8d949c', { roughness: 0.4 }), ctx.lit('#51cf66', 1.4), ctx.lit('#ff6b5e', 1.5)], lampGeo = G(new THREE.SphereGeometry(0.17, 16, 12));
    const ringGeo = G(new THREE.TorusGeometry(0.25, 0.035, 6, 20)), goldLit = ctx.lit('#ffe08a', 1.4);
    add(G(new THREE.BoxGeometry(6.2, 0.1, 0.1)), dark, 0, 3.1, -2.1);
    add(G(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 10)), dark, -3.0, 1.55, -2.1); add(geos[geos.length - 1], dark, 3.0, 1.55, -2.1);
    const lamps = Array.from({ length: MAXC }, (_, i) => {
      const x = (i - (MAXC - 1) / 2) * 0.82, m = add(lampGeo, lampM[0], x, 3.35, -2.1), ring = add(ringGeo, goldLit, x, 3.35, -2.1);
      ring.castShadow = false; ring.visible = false;
      const tag = ctx.sprite(String(i + 1), { size: 0.3 }); tag.position.set(x, 3.78, -2.1); group.add(tag);
      onTap(m, () => { stopAuto(); toggleClue(i); });
      return { m, ring, tag };
    });

    // the runners: small round animals built from a few simple shapes
    const ball = G(new THREE.SphereGeometry(1, 16, 12)), cone = G(new THREE.ConeGeometry(1, 1, 10)), tube = G(new THREE.CylinderGeometry(1, 1, 1, 8));
    const legGeo = G(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8)); legGeo.translate(0, -0.11, 0);
    const beakGeo = G(new THREE.BoxGeometry(0.15, 0.05, 0.16)), eyeM = ctx.mat('#22262b', { roughness: 0.3 });
    const part = (geo, mt, g, x, y, z, sx, sy = sx, sz = sx) => { const m = add(geo, mt, x, y, z, g); m.scale.set(sx, sy, sz); return m; };
    const R = cast.map(([, kind], i) => {
      const g = new THREE.Group(), [c1, c2] = COAT[kind], A = ctx.mat(c1, { roughness: 0.7 }), B = ctx.mat(c2, { roughness: 0.7 });
      part(ball, A, g, 0, 0.44, 0, 0.26, 0.3, 0.25); part(ball, A, g, 0, 0.86, 0.05, 0.19);
      part(ball, eyeM, g, -0.07, 0.9, 0.225, 0.035); part(ball, eyeM, g, 0.07, 0.9, 0.225, 0.035);
      const legs = [add(legGeo, B, -0.11, 0.22, 0, g), add(legGeo, B, 0.11, 0.22, 0, g)];
      if (kind === 'Fox') { part(cone, A, g, -0.11, 1.08, 0.03, 0.07, 0.17, 0.07); part(cone, A, g, 0.11, 1.08, 0.03, 0.07, 0.17, 0.07); part(cone, B, g, 0, 0.5, -0.34, 0.1, 0.42, 0.1).rotation.x = -2.1; part(cone, B, g, 0, 0.82, 0.26, 0.06, 0.14, 0.06).rotation.x = Math.PI / 2; }
      else if (kind === 'Owl') { part(cone, A, g, -0.13, 1.05, 0.04, 0.05, 0.14, 0.05); part(cone, A, g, 0.13, 1.05, 0.04, 0.05, 0.14, 0.05); part(ball, B, g, -0.08, 0.9, 0.16, 0.075); part(ball, B, g, 0.08, 0.9, 0.16, 0.075); part(cone, ctx.mat('#f2b632'), g, 0, 0.83, 0.25, 0.04, 0.1, 0.04).rotation.x = Math.PI / 2; }
      else if (kind === 'Turtle') { part(ball, B, g, 0, 0.47, -0.1, 0.31, 0.3, 0.27); }
      else if (kind === 'Hare') { part(tube, A, g, -0.08, 1.2, 0.02, 0.04, 0.36, 0.04).rotation.z = 0.15; part(tube, A, g, 0.08, 1.2, 0.02, 0.04, 0.36, 0.04).rotation.z = -0.15; part(ball, B, g, 0, 0.32, -0.26, 0.08); }
      else if (kind === 'Hedgehog') { for (const [x, y, z] of [[0, 0.74, -0.16], [-0.15, 0.56, -0.2], [0.15, 0.56, -0.2], [0, 0.42, -0.27], [0, 0.6, -0.26]]) part(cone, B, g, x, y, z, 0.07, 0.24, 0.07).rotation.x = -1.2; part(ball, eyeM, g, 0, 0.84, 0.25, 0.04); }
      else if (kind === 'Squirrel') { part(ball, B, g, 0, 0.62, -0.32, 0.15, 0.3, 0.15); part(cone, A, g, -0.1, 1.05, 0.03, 0.05, 0.12, 0.05); part(cone, A, g, 0.1, 1.05, 0.03, 0.05, 0.12, 0.05); }
      else { part(beakGeo, B, g, 0, 0.83, 0.27, 1); part(cone, A, g, 0, 0.5, -0.28, 0.1, 0.22, 0.1).rotation.x = -1.9; }
      const tag = ctx.sprite(name(i), { size: 0.26, bg: 'rgba(14,18,48,.72)' }); tag.position.y = 1.5; g.add(tag);
      g.position.set(homeX(i), 0, 1.5); group.add(g);
      g.traverse((o) => { if (o.isMesh) onTap(o, () => { stopAuto(); pickRunner(i); }); });
      return { g, legs, segs: [], seg: null, rest: 0, shake: 0 };
    });
    const halo = add(G(new THREE.TorusGeometry(0.36, 0.04, 6, 24)), goldLit, 0, 0.12, 0); halo.rotation.x = Math.PI / 2; halo.visible = false; halo.castShadow = false;

    // ---------- movement: each runner follows a list of legs [x, y, z, seconds, hop height] ----------
    const send = (r, pts) => { r.segs = pts; r.seg = null; };
    const far = (ax, az, bx, bz) => Math.max(0.25, Math.hypot(bx - ax, bz - az) / 3.2);
    // Walk runner i to where the order says it belongs: its podium step, or back to the waiting line.
    function route(i) {
      const r = R[i], p = r.g.position, k = order.indexOf(i), pts = [];
      let x = p.x, z = p.z;
      if (p.y > 0.05) { z = FRONT; pts.push([x, 0, z, 0.35, 0.3]); }                       // hop down first
      if (k >= 0) { pts.push([PX(k), 0, FRONT, far(x, z, PX(k), FRONT), 0], [PX(k), PH(k), PZ, 0.45, 0.4]); r.rest = PH(k); }
      else { pts.push([homeX(i), 0, 1.5, far(x, z, homeX(i), 1.5), 0]); r.rest = 0; }
      send(r, pts);
    }
    // Replay the answer as a race: everyone lines up, runs, and crosses the line in the order on the podium.
    function race() {
      order.forEach((i, k) => {
        const r = R[i], p = r.g.position, z = laneZ(i);
        send(r, [[p.x, 0, FRONT, 0.35, 0.3], [STARTX, 0, z, 1.1, 0], [STARTX, 0, z, 0.5, 0], [ENDX + 0.3, 0, z, 2.0 + 0.45 * k, 0], [PX(k), 0, FRONT, 1.0, 0], [PX(k), PH(k), PZ, 0.45, 0.4]]);
        r.rest = PH(k);
      });
    }

    // ---------- the puzzle ----------
    let puzzle, order, hand = null, tries = 0, used = new Set(), done = false, queue = [], wait = 0;
    const text = (c) => {
      const A = name(c.a), B = c.b == null ? '' : name(c.b);
      switch (c.type) {
        case 'before': return `${A} ${T('finished somewhere ahead of')} ${B}.`;
        case 'justBefore': return `${A} ${T('finished just ahead of')} ${B}.`;
        case 'next': return `${A} ${T('and')} ${B} ${T('finished right next to each other.')}`;
        case 'apart': return `${A} ${T('and')} ${B} ${T('did not finish next to each other.')}`;
        case 'at': return `${A} ${T('finished')} ${T(ORD[c.k])}.`;
        case 'notAt': return `${A} ${T('did not finish')} ${T(ORD[c.k])}.`;
        default: return `${A} ${T('finished either first or last.')}`;
      }
    };
    const rLeft = ui.readout('Orders that still fit'), rTries = ui.readout('Checks'), rFilled = ui.readout('Places filled');
    ui.note(`Before any clue: how many different finishing orders can ${n} runners have?`);
    const options = n === 3 ? [3, 6, 9] : n === 4 ? [12, 16, 24] : [25, 60, 120];
    ui.choice([[0, '?'], ...options.map((v) => [v, String(v)])], 0, (v) => {
      if (!v) return;
      const sum = [...Array(n).keys()].map((i) => n - i).join(' × ') + ' = ' + total;
      ctx.say(v === total ? `Right: multiply the choices for each place. ${n} runners could be first, then ${n - 1} are left for second, and so on. ${sum}`
        : `Count the choices place by place and multiply them: ${sum}. ${n} runners could be first, then only ${n - 1} are left for second.`);
    });
    ui.note('Pick a runner, then a place. Picking a place with no runner chosen sends the runner standing there back to the track.');
    const runC = ui.choice([[-1, 'No runner'], ...cast.map((c, i) => [i, name(i)])], -1, (v) => { hand = v < 0 ? null : v; draw(); });
    ui.choice([[-1, 'Place'], ...Array.from({ length: n }, (_, k) => [k, ORD[k]])], -1, (v) => { stopAuto(); if (v >= 0) tapPlace(v); });
    const clueS = ui.slider({ label: 'Count the first clues (watch the orders shrink)', min: 0, max: MAXC, step: 1, value: 0, unit: 'clues', onInput: (v) => { used = new Set([...Array(Math.min(puzzle ? puzzle.clues.length : 0, Math.max(0, Math.round(v)))).keys()]); draw(); } });
    ui.button('Check my order', () => { stopAuto(); check(); }, 'btn');
    ui.button('New puzzle', () => { stopAuto(); fresh(); ctx.say('A new race with the same runners. Read every clue before you place anyone.'); });
    const notes = Array.from({ length: MAXC }, () => ui.note(''));

    function draw() {
      rLeft.set(String(consistent(puzzle.clues.filter((_, i) => used.has(i)), n).length));
      rTries.set(String(tries)); rFilled.set(`${order.filter((x) => x != null).length} / ${n}`);
      lamps.forEach((L, i) => {
        const c = puzzle.clues[i], ok = c ? holds(c, order) : null;
        L.m.visible = L.tag.visible = !!c; L.ring.visible = !!c && used.has(i);
        L.m.material = lampM[!c || !tries || ok == null ? 0 : ok ? 1 : 2];
        const mark = !tries || ok == null ? '•' : ok ? '✅' : '❌';
        if (notes[i]) notes[i].textContent = c ? `${i + 1}. ${mark} ${text(c)}` : '';
      });
    }
    // Tap a runner: it becomes the chosen one (tap again to let go).
    function pickRunner(i) { hand = hand === i ? null : i; draw(); }
    // Tap a place: the chosen runner goes there; with no runner chosen, the one standing there steps down.
    function tapPlace(k) {
      const moved = [];
      if (hand != null) {
        const old = order.indexOf(hand); if (old >= 0) order[old] = null;
        if (order[k] != null) moved.push(order[k]);
        order[k] = hand; moved.push(hand); hand = null;
      } else if (order[k] != null) { moved.push(order[k]); order[k] = null; }
      for (const i of moved) route(i);
      draw();
    }
    function toggleClue(i) { if (!puzzle.clues[i]) return; if (used.has(i)) used.delete(i); else used.add(i); draw(); }

    function check() {
      if (order.includes(null)) { ctx.say('Place every runner first: each step of the podium needs someone on it.'); return; }
      tries++;
      const bad = puzzle.clues.filter((c) => !holds(c, order)).length;
      draw();
      if (bad) {
        for (const r of R) r.shake = 0.9;
        ctx.say(`${bad} clue(s) do not fit this order. Their lamps are red. An answer must fit every clue at once. Find a red clue and ask: who has to move to make it true?`);
        return;
      }
      race();
      if (!done) {
        done = true;
        ctx.say('Every clue fits, and no other order does. You solved it by elimination: each clue crossed out orders until only one was left. Watch the race run again in your order!');
        ctx.complete(Math.max(0.4, 1 - 0.15 * (tries - 1)), 'Deduced the only order that satisfies every clue.');
      } else ctx.say('Every clue fits, and no other order does.');
    }

    function fresh() {
      do { puzzle = generate(n, hard, rng); } while (puzzle.clues.length > MAXC);
      order = Array(n).fill(null); hand = null; tries = 0; used = new Set(); done = false;
      for (let i = 0; i < n; i++) route(i);
      draw();
    }
    function stopAuto() { queue = []; }

    fresh();
    ctx.say('Each clue rules out some orders. Count the clues one by one and watch the number of possible orders shrink to 1. Then send each runner to its place on the podium.');

    return {
      step(dt) {
        if (!queue.length) return;
        wait -= dt; if (wait > 0) return;
        queue.shift()(); wait = 0.55;
      },
      frame(dt, time) {
        R.forEach((r, i) => {
          const g = r.g, p = g.position;
          if (!r.seg && r.segs.length) { const [x, y, z, dur, hop] = r.segs.shift(); r.seg = { a: p.clone(), b: new THREE.Vector3(x, y, z), dur, hop, t: 0 }; }
          let turn = 0, swing = 0;
          if (r.seg) {
            const s = r.seg; s.t = Math.min(1, s.t + dt / s.dur);
            p.lerpVectors(s.a, s.b, s.t); p.y += s.hop * Math.sin(Math.PI * s.t);
            const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z;
            if (Math.hypot(dx, dz) > 0.05) { turn = Math.atan2(dx, dz); swing = Math.sin(time * 14 + i) * 0.8; }
            if (s.t >= 1) r.seg = null;
          } else {
            p.y = r.rest + (hand === i && !ctx.calm ? Math.abs(Math.sin(time * 6)) * 0.14 : 0);
          }
          r.shake = Math.max(0, r.shake - dt);
          g.rotation.y += (turn - g.rotation.y) * Math.min(1, dt * 10);
          g.rotation.z = r.shake > 0 && !ctx.calm ? Math.sin(time * 22) * 0.12 : 0;
          r.legs[0].rotation.x = swing; r.legs[1].rotation.x = -swing;
        });
        halo.visible = hand != null;
        if (hand != null) { const p = R[hand].g.position; halo.position.set(p.x, R[hand].rest + 0.12, p.z); }
        for (const L of lamps) if (L.ring.visible) L.ring.rotation.y = ctx.calm ? 0 : time * 1.5;
      },
      // Solves the puzzle the way a player does: count every clue, choose each runner, send it to its place, then check.
      autoplay() {
        queue = [() => { clueS.set(puzzle.clues.length); }];
        for (let k = 0; k < n; k++) { if (order[k] != null) queue.push(() => { hand = null; tapPlace(k); }); }
        puzzle.sol.forEach((who, k) => queue.push(() => { runC.set?.(who); if (hand !== who) pickRunner(who); }, () => tapPlace(k)));
        queue.push(() => check());
        wait = 0.3;
      },
      dispose() { queue = []; for (const g of geos) g.dispose(); },
    };
  },
};
