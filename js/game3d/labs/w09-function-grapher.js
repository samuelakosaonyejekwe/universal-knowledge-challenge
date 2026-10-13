// World 9 lab — Function Grapher in 3D: the rule y = ax² + bx + c is a thick rail standing above a grid floor.
// It bends as the numbers change, stilts show its height at every whole x, a ball rolls along it, and the
// player must thread it through floating target rings.
// No imports: everything arrives through the context, so the file also runs in tools/test-game3d.mjs.

const X = 6, Y = 7, TOL = 0.3;

// ----- the model: a quadratic rule, exact target points and the hit test -----
export const model = {
  X, Y, TOL,
  f: (co, x) => co.a * x * x + co.b * x + co.c,
  hit: (co, p) => Math.abs(model.f(co, p.x) - p.y) <= TOL,
  hits: (co, targets) => targets.filter((p) => model.hit(co, p)).length,
  // A secret rule on the slider grid and the points it passes through (two for a line, three for a curve).
  mission(mode, rnd) {
    const ri = (lo, hi) => lo + Math.min(hi - lo, Math.floor(rnd() * (hi - lo + 1)));
    for (let tries = 0; tries < 500; tries++) {
      const secret = mode === 'lin' ? { a: 0, b: ri(-2, 2) || 1, c: ri(-3, 3) } : { a: [-1, -0.5, 0.5, 1][ri(0, 3)], b: ri(-2, 2), c: ri(-3, 3) };
      const xs = mode === 'lin' ? [-3, 2] : [-4, ri(-1, 1), 3];
      const targets = xs.map((x) => ({ x, y: model.f(secret, x) }));
      if (targets.every((p) => Math.abs(p.y) <= 6)) return { secret, targets };
    }
    return { secret: { a: 0, b: 1, c: 0 }, targets: [{ x: -3, y: -3 }, { x: 2, y: 2 }] };
  },
  // The one line through two points, and the one parabola through three (used to check the missions).
  line(p, q) { const b = (q.y - p.y) / (q.x - p.x); return { a: 0, b, c: p.y - b * p.x }; },
  parabola(p, q, r) {
    const d = (p.x - q.x) * (p.x - r.x) * (q.x - r.x);
    const a = (r.x * (q.y - p.y) + q.x * (p.y - r.y) + p.x * (r.y - q.y)) / d;
    const b = (r.x * r.x * (p.y - q.y) + q.x * q.x * (r.y - p.y) + p.x * p.x * (q.y - r.y)) / d;
    return { a, b, c: p.y - a * p.x * p.x - b * p.x };
  },
  rule(co, mode) {
    const parts = [], num = (v) => String(+Math.abs(v).toFixed(2));
    const add = (v, sym) => { if (!v) return; parts.push((parts.length ? (v < 0 ? ' − ' : ' + ') : (v < 0 ? '−' : '')) + (sym && Math.abs(v) === 1 ? '' : num(v)) + sym); };
    if (mode === 'quad') add(co.a, 'x²');
    add(co.b, 'x'); add(co.c, '');
    return 'y = ' + (parts.join('') || '0');
  },
};

export function selfTest() {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ln = model.line({ x: -3, y: -5 }, { x: 2, y: 5 }), pb = model.parabola({ x: -4, y: 14 }, { x: 0, y: 2 }, { x: 3, y: 3.5 });
  let bad = 0;
  for (let i = 0; i < 400; i++) {
    const mode = i % 2 ? 'quad' : 'lin', { secret, targets } = model.mission(mode, rnd);
    const fit = mode === 'lin' ? model.line(targets[0], targets[1]) : model.parabola(targets[0], targets[1], targets[2]);
    const onGrid = [secret.a, secret.b, secret.c].every((v) => near(v * 2, Math.round(v * 2))) && Math.abs(secret.a) <= 2 && Math.abs(secret.b) <= 4 && Math.abs(secret.c) <= 6;
    if (!onGrid || model.hits(secret, targets) !== targets.length || targets.some((p) => Math.abs(p.y) > 6) || !near(fit.a, secret.a) || !near(fit.b, secret.b) || !near(fit.c, secret.c)) bad++;
  }
  const checks = [
    near(model.f({ a: 0.5, b: -1, c: 2 }, 4), 6), near(model.f({ a: -1, b: 2, c: 3 }, -2), -5),
    near(ln.b, 2) && near(ln.c, 1), near(pb.a, 0.5) && near(pb.b, -1) && near(pb.c, 2),
    model.hit({ a: 0, b: 2, c: 1.25 }, { x: 2, y: 5 }), !model.hit({ a: 0, b: 2, c: 1.5 }, { x: 2, y: 5 }),
    model.rule({ a: 0.5, b: -1, c: 2 }, 'quad') === 'y = 0.5x² − x + 2', model.rule({ a: 0, b: 0, c: 0 }, 'lin') === 'y = 0', bad === 0,
  ];
  return { ok: checks.every(Boolean), detail: `line through (−3, −5) and (2, 5): ${model.rule(ln, 'lin')}; parabola through (−4, 14), (0, 2), (3, 3.5): ${model.rule(pb, 'quad')}; 400 random missions, ${bad} not recovered exactly` };
}

export default {
  id: 'w09-function-grapher',
  world: 9,
  levels: [3, 4],
  title: 'Function Grapher',
  goal: 'Shape the rail so that it threads every target ring. Change the numbers in the rule and watch the rail tilt, lift and bend.',
  kind: 'validated',
  model: 'The rail is the exact graph of y = ax² + bx + c (a straight line when a = 0), drawn for x from −6 to 6 with one grid square for each unit. Each target ring sits on a secret rule; the missions are checked by solving for the one line through two points and the one parabola through three. Coefficients move in steps of 0.5, and a ring counts as threaded when the rail is within 0.3 of its centre. The rolling ball only follows the rail to show its shape: it has no weight or speed of its own. Other kinds of rule (cubes, roots, waves) are left out.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level, rnd = ctx.rng || Math.random;
    const U = 0.35, CY = 2.55, TUBE = 0.07, BALL = 0.17;
    const geos = [], keep = (g) => { geos.push(g); return g; };
    const add = (geo, material, x, y, z) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; group.add(m); return m; };
    const label = (text, size, x, y, z) => { const s = ctx.sprite(text, { size, bg: 'rgba(70,30,100,0.85)' }); s.position.set(x, y, z); group.add(s); return s; };
    const drop = (s) => { if (!s) return; s.parent?.remove(s); s.material?.map?.dispose?.(); s.material?.dispose?.(); };

    // the grid floor, a standing grid behind the rail, and the two axes
    add(keep(new THREE.BoxGeometry(X * 2 * U + 0.5, 0.08, 2.4)), ctx.mat('#fff4e6', { roughness: 0.9 }), 0, 0.04, 0).receiveShadow = true;
    const lines = (pts, color, opacity) => { const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity })); group.add(l); return l; };
    const floorPts = [], wallPts = [];
    for (let x = -X; x <= X; x++) { floorPts.push(x * U, 0.09, -1.1, x * U, 0.09, 1.1); wallPts.push(x * U, CY - Y * U, -0.55, x * U, CY + Y * U, -0.55); }
    for (let z = -3; z <= 3; z++) floorPts.push(-X * U, 0.09, z * U, X * U, 0.09, z * U);
    for (let y = -Y; y <= Y; y++) wallPts.push(-X * U, CY + y * U, -0.55, X * U, CY + y * U, -0.55);
    lines(floorPts, 0xb02a5b, 0.55); lines(wallPts, 0xffffff, 0.5);
    const axisM = ctx.mat('#5f3dc4', { roughness: 0.4, metalness: 0.2 });
    add(keep(new THREE.BoxGeometry(X * 2 * U + 0.3, 0.06, 0.06)), axisM, 0, CY, 0);
    add(keep(new THREE.BoxGeometry(0.06, Y * 2 * U, 0.06)), axisM, 0, CY, 0);
    for (const v of [-6, -4, -2, 2, 4, 6]) { label(String(v), 0.2, v * U, CY - 0.2, 0.25); label(String(v), 0.2, -0.24, CY + v * U, 0.25); }
    label('x', 0.26, X * U + 0.32, CY, 0.25); label('y', 0.26, 0, CY + Y * U + 0.12, 0.25);

    // stilts: the height of the rail above (blue) or below (orange) the x-axis at every whole x
    const stiltGeo = keep(new THREE.BoxGeometry(0.1, 1, 0.1)); stiltGeo.translate(0, 0.5, 0);
    const up = ctx.mat('#4dabf7', { roughness: 0.5 }), down = ctx.mat('#f76707', { roughness: 0.5 }), stilts = [];
    for (let x = -X; x <= X; x++) { const m = add(stiltGeo, up, x * U, CY, 0); m.userData.x = x; stilts.push(m); }
    // target rings (their opening faces along x, so the rail passes through) and the rolling ball
    const ringGeo = keep(new THREE.TorusGeometry(0.3, 0.055, 10, 28)); ringGeo.rotateY(Math.PI / 2);
    const amber = ctx.lit('#ff922b', 1.2), green = ctx.lit('#51cf66', 1.4), railM = ctx.mat('#7048e8', { roughness: 0.35, metalness: 0.2 });
    const rings = [0, 1, 2].map(() => { const m = add(ringGeo, amber, 0, CY, 0); m.visible = false; return m; });
    const ringLabels = [];
    const ball = add(keep(new THREE.SphereGeometry(BALL, 18, 12)), ctx.lit('#ffe066', 0.9), 0, CY, 0);
    const stripe = add(keep(new THREE.TorusGeometry(BALL, 0.03, 6, 18)), ctx.mat('#d6336c', { roughness: 0.4 }), 0, 0, 0); ball.add(stripe);
    let rails = [];

    let mode = L >= 4 ? 'quad' : 'lin', secret = { a: 0, b: 1, c: 0 }, targets = [], done = false, ready = false, locked = false, predTouched = false, predVal = null, ballX = -X, ballDir = 1, pulse = 0;
    const co = { a: 0, b: 0, c: 0 }, sh = { a: 0, b: 0, c: 0 };
    const rRule = ui.readout('Your rule'), rHits = ui.readout('Rings threaded'), rGap = ui.readout('Biggest gap, squares');

    // Rebuilds the rail for the rule being shown (only the parts that fit between y = −7 and y = 7).
    const drawRail = () => {
      for (const r of rails) { group.remove(r); r.geometry.dispose(); } rails = [];
      let run = [];
      const flush = () => { if (run.length >= 2) { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), Math.max(8, run.length * 2), TUBE, 8, false), railM); m.castShadow = true; group.add(m); rails.push(m); } run = []; };
      for (let i = 0; i <= 96; i++) { const x = -X + (i / 96) * 2 * X, y = model.f(sh, x); if (Math.abs(y) <= Y + 0.1) run.push(new THREE.Vector3(x * U, CY + y * U, 0)); else flush(); }
      flush();
      for (const s of stilts) { const y = model.f(sh, s.userData.x), on = Math.abs(y) <= Y + 0.1 && Math.abs(y) > 0.02; s.visible = on; if (on) { s.scale.y = y * U; s.material = y > 0 ? up : down; } }
    };
    const fmt = (v) => String(+v.toFixed(2)).replace('-', '−');
    const hint = () => {
      const gaps = targets.map((p) => model.f(co, p.x) - p.y), miss = targets.findIndex((p) => !model.hit(co, p)), p = targets[miss], g = gaps[miss];
      const where = `At x = ${fmt(p.x)} your ${mode === 'lin' ? 'line' : 'curve'} is at y = ${fmt(model.f(co, p.x))}, but the ring is at y = ${fmt(p.y)}: ${fmt(Math.abs(g))} squares too ${g > 0 ? 'high' : 'low'}.`;
      const allSame = gaps.every((d) => Math.abs(d - gaps[0]) < 1e-9);
      if (allSame) return `${where} Every ring is off by the same amount, so the shape is right. Change c: it lifts or lowers the whole ${mode === 'lin' ? 'line' : 'curve'} without turning it.`;
      if (mode === 'lin') return `${where} The gaps are different at each ring, so the tilt is wrong. Change b: it is the slope, how far the line climbs for each step to the right.`;
      return `${where} The gaps are different at each ring. a bends the curve (bigger a means a tighter bend, a negative a turns it upside down) and b slides the turning point sideways.`;
    };
    const evaluate = (acted) => {
      const n = model.hits(co, targets), worst = Math.max(...targets.map((p) => Math.abs(model.f(co, p.x) - p.y)));
      targets.forEach((p, i) => { rings[i].material = model.hit(co, p) ? green : amber; });
      rRule.set(model.rule(co, mode)); rHits.set(`${n} / ${targets.length}`); rGap.set(fmt(worst));
      if (!acted) return;
      if (n === targets.length) {
        if (done) return;
        done = true; pulse = 1.2;
        ctx.say(mode === 'lin' ? `All rings threaded with ${model.rule(co, mode)}. b is the slope: how much y changes when x goes up by 1. c is where the line crosses the y-axis.` : `All rings threaded with ${model.rule(co, mode)}. a bends the curve: positive opens up, negative opens down. c is where it crosses the y-axis.`);
        ctx.complete(predVal !== null && Math.abs(predVal - secret.c) < 0.01 ? 1 : 0.85, mode === 'lin' ? 'Found a line through two points.' : 'Fitted a quadratic through three points.');
      } else ctx.say(hint());
    };
    const onCoef = (key, v) => {
      if (!ready) return;
      if (key === 'a' && mode === 'lin' && v !== 0) { sA?.set(0); ctx.say('A straight line has no x² part, so a stays at 0. Choose "Curve" to bend the rail.'); return; }
      if (co[key] === v) return;
      co[key] = v; if (!locked) { locked = true; if (!predTouched) predVal = null; }
      if (ctx.calm) { Object.assign(sh, co); drawRail(); }
      evaluate(true);
    };
    const newMission = () => {
      ready = false; done = false; locked = false; predTouched = false; predVal = null;
      ({ secret, targets } = model.mission(mode, rnd));
      sA?.set(0); sB.set(0); sC.set(0); co.a = co.b = co.c = 0;
      while (ringLabels.length) drop(ringLabels.pop());
      rings.forEach((r, i) => { const p = targets[i]; r.visible = !!p; if (p) { r.position.set(p.x * U, CY + p.y * U, 0); ringLabels.push(label(`(${fmt(p.x)}, ${fmt(p.y)})`, 0.24, p.x * U, CY + p.y * U + 0.55, 0.3)); } });
      ready = true; evaluate(false);
      if (ctx.calm) { Object.assign(sh, co); drawRail(); }
    };

    const modeC = L >= 4 ? ui.choice([['lin', 'Straight line'], ['quad', 'Curve']], mode, (v) => { if (v !== 'lin' && v !== 'quad') return; mode = v; newMission(); ctx.say(v === 'lin' ? 'A new straight-line mission: two rings to thread with b and c.' : 'A new curve mission: three rings to thread with a, b and c.'); }) : null;
    const sA = L >= 4 ? ui.slider({ label: 'a (bends the curve: the x² part)', min: -2, max: 2, step: 0.5, value: 0, unit: '', onInput: (v) => onCoef('a', v) }) : null;
    const sB = ui.slider({ label: 'b (the slope: the x part)', min: -4, max: 4, step: 0.5, value: 0, unit: '', onInput: (v) => onCoef('b', v) });
    const sC = ui.slider({ label: 'c (lifts or lowers everything)', min: -6, max: 6, step: 0.5, value: 0, unit: '', onInput: (v) => onCoef('c', v) });
    ui.slider({ label: 'Guess first: y where the target crosses x = 0', min: -6, max: 6, step: 0.5, value: 0, unit: '', onInput: (v) => { if (!ready) return; if (locked) { ctx.say('Your guess was locked when you first moved the rail. Start a new mission to guess again.'); return; } predVal = v; predTouched = true; } });
    ui.button('New mission', () => { newMission(); ctx.say('New rings. Guess where the target crosses the y-axis, then shape the rail.'); });
    ui.note('One grid square is one unit. A ring turns green when the rail is within 0.3 of its centre. The blue and orange stilts show y at every whole x.');

    newMission(); Object.assign(sh, co); drawRail();
    ctx.say(mode === 'lin' ? 'Guess first, then move b and c until the rail passes through both orange rings.' : 'Guess first, then move a, b and c until the rail passes through all three orange rings.');

    return {
      frame(dt, time = 0) {
        // the rail glides to the new rule instead of jumping
        let moved = false;
        for (const k of ['a', 'b', 'c']) { const d = co[k] - sh[k]; if (d !== 0) { sh[k] = Math.abs(d) < 0.01 || ctx.calm ? co[k] : sh[k] + d * Math.min(1, dt * 9); moved = true; } }
        if (moved) drawRail();
        // the ball rolls to and fro along the rail
        const step = (ctx.calm ? 0.6 : 2.6) * dt; ballX += ballDir * step; if (ballX > X) { ballX = X; ballDir = -1; } else if (ballX < -X) { ballX = -X; ballDir = 1; }
        const y = model.f(sh, ballX), slope = 2 * sh.a * ballX + sh.b, inv = 1 / Math.hypot(1, slope);
        ball.visible = Math.abs(y) <= Y; ball.position.set(ballX * U - slope * inv * (TUBE + BALL), CY + y * U + inv * (TUBE + BALL), 0);
        ball.rotation.z -= ballDir * step * U / inv / BALL;
        if (pulse > 0) pulse = Math.max(0, pulse - dt);
        rings.forEach((r, i) => { if (r.visible) r.scale.setScalar(1 + (ctx.calm ? 0 : 0.06 * Math.sin(time * 3 + i) + pulse * 0.25)); });
      },
      // Sets the sliders to the secret rule, through the same handlers the player's sliders use.
      autoplay() { if (done) newMission(); sA?.set(secret.a); sB.set(secret.b); sC.set(secret.c); },
      dispose() { for (const r of rails) { group.remove(r); r.geometry.dispose(); } rails = []; for (const g of geos) g.dispose(); while (ringLabels.length) drop(ringLabels.pop()); },
      get mode() { return modeC?.value ?? mode; },
    };
  },
};
