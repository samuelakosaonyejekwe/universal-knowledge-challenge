// World 11 — Biology and Life Sciences: the Whispering Canopy.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: rabbits (x) and foxes (y), the Lotka–Volterra equations, fourth-order Runge–Kutta steps -----
//   dx/dt = a·x − b·x·y      rabbits are born, and some are caught by foxes
//   dy/dt = d·x·y − g·y      foxes raise cubs when they find rabbits, and some foxes are lost each year
const H = 0.005;                    // step, years (about two days)
const BASE = { a: 1.0, b: 0.1, d: 0.02, g: 1.0 };      // per year; balance point 50 rabbits and 10 foxes
export const model = {
  H, BASE,
  start: (rabbits, foxes) => ({ x: rabbits, y: foxes, t: 0 }),
  // Advances the state by one fixed step of H years.
  step(s, p) {
    const fx = (x, y) => x * (p.a - p.b * y), fy = (x, y) => y * (p.d * x - p.g);
    const k1x = fx(s.x, s.y), k1y = fy(s.x, s.y);
    const k2x = fx(s.x + 0.5 * H * k1x, s.y + 0.5 * H * k1y), k2y = fy(s.x + 0.5 * H * k1x, s.y + 0.5 * H * k1y);
    const k3x = fx(s.x + 0.5 * H * k2x, s.y + 0.5 * H * k2y), k3y = fy(s.x + 0.5 * H * k2x, s.y + 0.5 * H * k2y);
    const k4x = fx(s.x + H * k3x, s.y + H * k3y), k4y = fy(s.x + H * k3x, s.y + H * k3y);
    s.x += H / 6 * (k1x + 2 * k2x + 2 * k3x + k4x); s.y += H / 6 * (k1y + 2 * k2y + 2 * k3y + k4y); s.t += H;
    return s;
  },
  // The quantity the exact equations never change: every run stays on one closed loop of constant V.
  V: (s, p) => p.d * s.x - p.g * Math.log(s.x) + p.b * s.y - p.a * Math.log(s.y),
  balance: (p) => ({ x: p.g / p.d, y: p.a / p.b }),
  smallSwingPeriod: (p) => 2 * Math.PI / Math.sqrt(p.a * p.g),
};
// Used by the automated tests: V must stay constant over 50 years, the balance point must not move, and a tiny
// swing around the balance point must take the time the linearised equations predict.
export function selfTest() {
  const p = BASE, steps = Math.round(50 / H);
  const s = model.start(80, 5), v0 = model.V(s, p); let drift = 0;
  for (let i = 0; i < steps; i++) { model.step(s, p); drift = Math.max(drift, Math.abs((model.V(s, p) - v0) / v0)); }
  const b = model.balance(p), e = model.start(b.x, b.y); let moved = 0;
  for (let i = 0; i < steps; i++) { model.step(e, p); moved = Math.max(moved, Math.abs(e.x - b.x), Math.abs(e.y - b.y)); }
  const w = model.start(b.x * 1.01, b.y), ups = []; let prev = w.x;
  for (let i = 0; i < steps && ups.length < 4; i++) { model.step(w, p); if (prev < b.x && w.x >= b.x) ups.push(w.t - H * (w.x - b.x) / (w.x - prev)); prev = w.x; }
  const T = (ups[ups.length - 1] - ups[0]) / (ups.length - 1), T0 = model.smallSwingPeriod(p);
  return { ok: drift < 1e-3 && moved < 1e-9 && Math.abs(T - T0) / T0 < 1e-3, detail: `V drift ${(drift * 100).toExponential(1)} % over 50 years, balance point (${b.x}, ${b.y}) moved ${moved.toExponential(1)} animals, small swing ${T.toFixed(4)} years (theory ${T0.toFixed(4)})` };
}

const LAYOUT = { mirror: -1, stones: 5, rise: 0.4, towerH: 6.5 };

const sim = {
  title: 'Meadow in balance',
  goal: 'Choose how many rabbits and foxes start in the meadow, then let the years run. Keep both kinds of animal living there to the end. On harder levels, also keep the rabbit numbers steady by starting near the balance point.',
  kind: 'validated',
  model: 'The Lotka–Volterra equations for one kind of grass-eater (rabbits) and one kind of hunter (foxes), solved with the fourth-order Runge–Kutta method in steps of 0.005 years. The quantity that the exact equations keep constant is checked to drift by less than 0.1 % over 50 years, and the balance point is checked to stay still. It is a very simple picture. A real ecosystem has limits on food and space, good and bad luck, seasons, weather, illness, animals moving in and out, and many more species that eat and are eaten. In the equations the numbers can never reach zero, so here a kind of animal counts as gone when fewer than two are left.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level, rng = ctx.rng || Math.random;
    const YEARS = L <= 1 ? 20 : L <= 4 ? 30 : 40, LIMIT = L >= 3 ? [40, 25, 20, 12][Math.min(3, L - 3)] : 0, LOW = 2;
    const RATE = YEARS / 18;                                    // simulated years per second
    const PER_R = 4, PER_F = 2, NR = 50, NF = 30, TOP = 200;    // animals per figure, pool sizes, top of the graph

    // ----- the meadow -----
    const D = new THREE.Object3D();
    const meadow = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 40), ctx.mat('#69c15a', { roughness: 1 })); meadow.scale.set(3.45, 1, 2.15); meadow.position.y = 0.08; meadow.receiveShadow = true; group.add(meadow);
    const spot = () => { const r = Math.sqrt(rng()) * 0.9, a = rng() * Math.PI * 2; return [Math.cos(a) * r * 3.2, Math.sin(a) * r * 1.9]; };
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.22, 4), ctx.mat('#2f9e44', { flatShading: true }), 40);
    for (let i = 0; i < 40; i++) { const [x, z] = spot(); D.position.set(x, 0.26, z); D.rotation.set(0, rng() * 3, (rng() - 0.5) * 0.4); D.scale.setScalar(0.7 + rng() * 0.8); D.updateMatrix(); tufts.setMatrixAt(i, D.matrix); }
    group.add(tufts);
    const burrow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), ctx.mat('#a9825a', { flatShading: true })); burrow.position.set(-2.7, 0.15, -1.0); burrow.scale.y = 0.6; group.add(burrow);
    const den = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), ctx.mat('#8d9a86', { flatShading: true })); den.position.set(2.75, 0.3, -0.95); den.scale.set(1.2, 0.8, 1); group.add(den);

    // ----- the animals: each kind is a few instanced shapes, so a whole herd costs only a handful of draw calls -----
    const ball = new THREE.SphereGeometry(1, 10, 8), cone = new THREE.ConeGeometry(1, 1, 6);
    const part = (geo, material, n, locals) => {
      const im = new THREE.InstancedMesh(geo, material, n * locals.length); im.castShadow = true; im.frustumCulled = false; group.add(im);
      return { im, locals: locals.map(([x, y, z, sx = 1, sy = sx, sz = sx, rz = 0]) => { D.position.set(x, y, z); D.rotation.set(0, 0, rz); D.scale.set(sx, sy, sz); D.updateMatrix(); return D.matrix.clone(); }) };
    };
    const rabbitParts = [
      part(ball, ctx.mat('#cbb8a4', { roughness: 0.9 }), NR, [[0, 0.12, 0, 0.16, 0.12, 0.11], [0.15, 0.22, 0, 0.085], [0.13, 0.36, 0.04, 0.022, 0.09, 0.035], [0.13, 0.36, -0.04, 0.022, 0.09, 0.035]]),
      part(ball, ctx.mat('#ffffff', { roughness: 0.9 }), NR, [[-0.16, 0.13, 0, 0.045]]),
    ];
    const foxParts = [
      part(ball, ctx.mat('#f08c3a', { roughness: 0.85 }), NF, [[0, 0.2, 0, 0.24, 0.13, 0.12], [-0.3, 0.24, 0, 0.16, 0.07, 0.07]]),
      part(cone, ctx.mat('#f08c3a', { roughness: 0.85, flatShading: true }), NF, [[0.3, 0.3, 0, 0.11, 0.2, 0.11, -Math.PI / 2], [0.24, 0.43, 0.06, 0.04, 0.1, 0.04], [0.24, 0.43, -0.06, 0.04, 0.1, 0.04]]),
      part(ball, ctx.mat('#fff4e0', { roughness: 0.9 }), NF, [[-0.44, 0.26, 0, 0.06], [0.16, 0.17, 0, 0.1, 0.09, 0.09]]),
    ];
    const herd = (n) => Array.from({ length: n }, () => { const [hx, hz] = spot(); return { hx, hz, ph: rng() * 6.28, sp: 0.5 + rng() * 0.6, sc: 0 }; });
    const rabbits = herd(NR), foxes = herd(NF);
    const F = new THREE.Matrix4(), M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const draw = (list, parts, shown, size, hop, dt, time) => {
      for (let i = 0; i < list.length; i++) {
        const f = list[i], th = ctx.calm ? f.ph : time * f.sp + f.ph;
        f.sc += ((i < shown ? 1 : 0) - f.sc) * Math.min(1, dt * 6);
        P.set(f.hx + Math.cos(th) * 0.25, 0.16 + (ctx.calm ? 0 : Math.abs(Math.sin(time * 5 + f.ph)) * hop), f.hz + Math.sin(th * 0.7) * 0.2);
        Q.setFromAxisAngle(UP, Math.atan2(-Math.cos(th * 0.7) * 0.14, -Math.sin(th) * 0.25));
        F.compose(P, Q, SC.setScalar(Math.max(1e-4, f.sc * size)));
        for (const p of parts) for (let j = 0; j < p.locals.length; j++) { M.multiplyMatrices(F, p.locals[j]); p.im.setMatrixAt(i * p.locals.length + j, M); }
      }
      for (const p of parts) p.im.instanceMatrix.needsUpdate = true;
    };
    const figures = (animals, per, pool) => (animals < LOW ? 0 : Math.min(pool, Math.ceil(animals / per)));

    // ----- the live graph: rabbits and foxes over the years -----
    const GX = -3.1, GW = 6.2, GY = 1.95, GH = 2.6, GZ = -2.3;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 3.0), new THREE.MeshBasicMaterial({ color: 0x0f3d2a, transparent: true, opacity: 0.62 })); board.position.set(0, GY + GH / 2, GZ - 0.05); group.add(board);
    const axis = new THREE.Mesh(new THREE.BoxGeometry(GW, 0.025, 0.02), ctx.lit('#ffffff', 0.7)); axis.position.set(0, GY, GZ); group.add(axis);
    const MAX = 520, EVERY = Math.ceil(YEARS / H / 500);
    const curve = (color) => { const pos = new Float32Array(MAX * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0); const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color })); line.frustumCulled = false; group.add(line); return { pos, geo }; };
    const lineR = curve(0xfff3bf), lineF = curve(0xff922b);
    const tagR = ctx.sprite('🐇', { size: 0.42 }), tagF = ctx.sprite('🦊', { size: 0.42 }); group.add(tagR, tagF);
    const gy = (v) => GY + GH * Math.min(1, v / TOP);
    let nPts = 0;
    const plot = (t, x, y) => {
      const px = GX + GW * Math.min(1, t / YEARS), ry = gy(x), fy = gy(y * 4);
      if (nPts < MAX) { lineR.pos.set([px, ry, GZ], nPts * 3); lineF.pos.set([px, fy, GZ], nPts * 3); nPts++; for (const l of [lineR, lineF]) { l.geo.setDrawRange(0, nPts); l.geo.attributes.position.needsUpdate = true; } }
      tagR.position.set(px + 0.12, ry + 0.2, GZ + 0.05); tagF.position.set(px + 0.12, fy - 0.2, GZ + 0.05);
    };

    // ----- controls, readouts and the run -----
    let p = { ...BASE }, aSel = L >= 3 ? 1.2 : BASE.a, dSel = L >= 5 ? 0.025 : BASE.d;
    const chosen = () => ({ ...BASE, a: aSel, d: dSel });
    let x0 = L >= 3 ? 80 : 110, y0 = L >= 3 ? 5 : 2, s = model.start(x0, y0), state = 'ready', acc = 0, n = 0, tries = 0, loX = 0, hiX = 0, loY = 0, prevX = 0, rising = false, told = false;
    const preview = () => { if (state === 'run') return; s = model.start(x0, y0); nPts = 0; lineR.geo.setDrawRange(0, 0); lineF.geo.setDrawRange(0, 0); plot(0, x0, y0); nPts = 0; show(); };
    const rabS = ui.slider({ label: 'Rabbits at the start', min: 10, max: 120, step: 1, value: x0, unit: 'animals', onInput: (v) => { x0 = Math.round(v); preview(); } });
    const foxS = ui.slider({ label: 'Foxes at the start', min: 2, max: 40, step: 1, value: y0, unit: 'animals', onInput: (v) => { y0 = Math.round(v); preview(); } });
    const birthS = L >= 3 ? ui.slider({ label: 'Rabbit birth rate', min: 0.6, max: 1.6, step: 0.1, value: aSel, unit: 'per year', onInput: (v) => { aSel = Math.round(v * 10) / 10; } }) : null;
    const effS = L >= 5 ? ui.slider({ label: 'Fox efficiency: growth for each rabbit nearby', min: 1, max: 4, step: 0.5, value: dSel * 100, unit: '% per year', onInput: (v) => { dSel = Math.round(v * 2) / 200; } }) : null;
    const rT = ui.readout('Time, years'), rR = ui.readout('Rabbits, animals'), rF = ui.readout('Foxes, animals'), rRange = ui.readout('Fewest and most rabbits, animals'), rSwing = ui.readout('Rabbit swing, animals'), rLoF = ui.readout('Fewest foxes, animals');
    function show() {
      rT.set(s.t.toFixed(1)); rR.set(Math.round(s.x)); rF.set(Math.round(s.y));
      if (state === 'ready') { rRange.set('–'); rSwing.set('–'); rLoF.set('–'); } else { rRange.set(`${Math.round(loX)} to ${Math.round(hiX)}`); rSwing.set(Math.round(hiX - loX)); rLoF.set(Math.round(loY)); }
    }
    const start = () => {
      p = chosen(); s = model.start(x0, y0); state = 'run'; acc = 0; n = 0; tries++; loX = hiX = prevX = x0; loY = y0; rising = false; told = false;
      nPts = 0; plot(0, x0, y0);
      ctx.say('Watch the two lines. Foxes need rabbits to feed their cubs, so the fox line can only climb after the rabbit line has climbed.');
    };
    ui.button('▶ Start the years', start, 'btn');
    ui.note(LIMIT ? `Keep both animals in the meadow for ${YEARS} years, and keep the gap between the fewest and the most rabbits under ${LIMIT} animals. There is one balance point where both numbers stay still.` : `Keep both animals in the meadow for ${YEARS} years. A kind of animal is gone when fewer than ${LOW} are left.`);
    ui.note(`Each rabbit figure stands for ${PER_R} rabbits and each fox figure for ${PER_F} foxes. On the graph the fox line is drawn 4 times taller so it is easy to see; the top of the graph is ${TOP} rabbits.`);
    preview();
    ctx.say('Set the starting numbers and press Start. Will the rabbits and the foxes both still be here at the end?');

    const nearer = () => { const b = model.balance(p); return `about ${Math.round(b.x)} rabbits and ${Math.round(b.y)} foxes`; };
    const end = (kind) => {
      state = kind; show();
      const b = model.balance(p), swing = hiX - loX, a = Math.round(loX), z = Math.round(hiX);
      if (kind === 'noRabbits') ctx.say(`After ${s.t.toFixed(1)} years fewer than two rabbits were left. There were too many foxes for the rabbits to keep up, and soon the foxes would have had no food either. Big swings are risky: try starting nearer to ${nearer()}.`);
      else if (kind === 'noFoxes') ctx.say(`After ${s.t.toFixed(1)} years fewer than two foxes were left. When rabbits became scarce the foxes could not feed their cubs, and the last ones left the meadow. Big swings are risky: try starting nearer to ${nearer()}.`);
      else if (LIMIT && swing > LIMIT) {
        const offY = (y0 - b.y) / b.y, offX = (x0 - b.x) / b.x;
        const hint = tries >= 2 ? `With these settings the balance point is ${nearer()}.` : Math.abs(offY) >= Math.abs(offX) ? `You started with too ${offY > 0 ? 'many' : 'few'} foxes for this rabbit birth rate.` : `You started with too ${offX > 0 ? 'many' : 'few'} rabbits for these foxes.`;
        state = 'ready';
        ctx.say(`Both lived, but the rabbits swung from ${a} to ${z}: a gap of ${Math.round(swing)} animals, and the limit is ${LIMIT}. At the balance point, rabbit births exactly match the rabbits the foxes catch, and new fox cubs exactly match the foxes that are lost. ${hint}`);
      } else if (LIMIT) {
        ctx.say(`Steady! Rabbits only moved between ${a} and ${z}. You started close to the balance point (${nearer()}), where births and losses cancel out for both animals, so neither line has a reason to move. Start further away and they take turns: many rabbits feed many fox cubs, many foxes leave few rabbits, hungry foxes become few, and the rabbits come back.`);
        ctx.complete(swing <= LIMIT / 2 ? 1 : 0.8, `swing=${swing.toFixed(1)}, limit=${LIMIT}, tries=${tries}`);
      } else {
        ctx.say(`Both lived through all ${YEARS} years. Rabbits moved between ${a} and ${z}, and the fewest foxes were ${Math.round(loY)}. Why do they rise and fall in turn? Many rabbits mean well-fed fox cubs, so foxes grow. Many foxes mean fewer rabbits, so the foxes go hungry and shrink. Then the rabbits come back, and it all begins again. The fox line always follows the rabbit line.`);
        ctx.complete(Math.min(loX, loY) >= 5 ? 1 : 0.8, `rabbits ${a}-${z}, fewest foxes ${loY.toFixed(1)}, tries=${tries}`);
      }
    };
    return {
      step(dt) {
        if (state !== 'run') return;
        acc += RATE * dt;
        while (acc >= H && state === 'run') {
          acc -= H; model.step(s, p); n++;
          loX = Math.min(loX, s.x); hiX = Math.max(hiX, s.x); loY = Math.min(loY, s.y);
          if (s.x > prevX) rising = true;
          else if (rising && !told && hiX - x0 > 3) { told = true; ctx.say(`The rabbits have stopped rising at about ${Math.round(s.x)}. There are now ${Math.round(s.y)} foxes: just enough to match the rabbit births. The foxes will keep growing for a while, so the rabbits will fall.`); }
          prevX = s.x;
          if (n % EVERY === 0) plot(s.t, s.x, s.y);
          if (s.x < LOW) end('noRabbits'); else if (s.y < LOW) end('noFoxes'); else if (s.t >= YEARS - H / 2) end('done');
        }
        if (state === 'run') show();
      },
      frame(dt, time) {
        draw(rabbits, rabbitParts, figures(s.x, PER_R, NR), 1.25, 0.07, dt, time);
        draw(foxes, foxParts, figures(s.y, PER_F, NF), 1.3, 0, dt, time);
      },
      // Shows a successful run without the player (used by tests): start exactly on the balance point.
      autoplay() { birthS?.set(1.0); effS?.set(2); const b = model.balance(chosen()); rabS.set(Math.round(b.x)); foxS.set(Math.round(b.y)); start(); },
      get state() { return state; },
    };
  },
};

export default {
  id: 11,
  theme: {
    sky: ['#6fb7d9', '#bfe8c9', '#fff1c1'], fog: '#cfeedd', fogNear: 30, fogFar: 130,
    ground: '#3f9d4f', ground2: '#57b865', side: '#5c4632', stone: '#9aa68a', accent: '#20c997', glow: '#fff3a0', metal: '#4f6b52', wood: '#8a5a3a', leaf: '#2b8a3e', water: '#3bc9db', crate: '#d8a45c',
    sun: '#fff0cf', sunPower: 2.3, ambient: 1.3, skyLight: '#e6fff0', groundLight: '#3c6b3f', sunDir: [-0.6, 0.75, 0.35], particles: 'dust',
  },
  layout: LAYOUT,
  story: {
    title: 'The Whispering Canopy',
    crystal: 'seed pods', crystalEm: '🌱',
    intro: ['Welcome to the Whispering Canopy, high in the morning mist! I study every living thing up here, from the smallest cell to the tallest tree.', 'Last night a great wind shook five golden seed pods out of the Heart Tree. And far below, the meadow has lost its balance: the rabbits and the foxes need our help.'],
    remind: 'The seed pods glow gold. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five seed pods! Now ride the lift from the tower to the meadow console and help the rabbits and foxes live side by side.',
    afterSim: 'The meadow is in balance again. Only the Canopy Keeper stands between you and the portal: the arena is up the steps.',
    notReady: 'The arena is for those who have done the work. Bring all five seed pods and put the meadow in balance first.',
    rival: ['So you balanced one little meadow. A forest has ten thousand living things, and each one depends on the others.', 'We each grow a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge grew faster than mine. You notice things, as a good naturalist should. The portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and try me.'],
    outro: 'The seed pods are back in the Heart Tree, the meadow is calm, and the Canopy Keeper has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, m = Math.sign(S.sim[0]) || 1, D = new THREE.Object3D();
    // many copies of one shape as a single mesh: items are [x, y, z, rx, ry, rz, sx, sy, sz]
    const many = (geo, material, items, colors, parent = k.root) => {
      const im = new THREE.InstancedMesh(geo, material, items.length);
      items.forEach(([x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx], i) => { D.position.set(x, y, z); D.rotation.set(rx, ry, rz); D.scale.set(sx, sy, sz); D.updateMatrix(); im.setMatrixAt(i, D.matrix); if (colors) im.setColorAt(i, new THREE.Color(colors[i % colors.length])); });
      im.castShadow = im.receiveShadow = true; parent.add(im); return im;
    };
    const white = k.mat('#ffffff', { flatShading: true, side: THREE.DoubleSide });

    // a cut-away model of a plant cell on the home island, tilted so its inside faces the path
    const cx = -5.2 * m, cz = -6.0, cell = k.add(new THREE.Group()); cell.position.set(cx, 1.55, cz); cell.rotation.order = 'YXZ'; cell.rotation.set(0.55, Math.atan2(-cx, -cz), 0);
    k.mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.3, 10), k.mat(k.theme.stone), cx, 0.65, cz);
    k.mesh(new THREE.BoxGeometry(2.6, 0.8, 1.9), k.mat('#2b8a3e'), 0, 0, 0, cell);                                   // cell wall
    k.mesh(new THREE.BoxGeometry(2.36, 0.8, 1.66), k.mat('#b2f2bb', { roughness: 0.5 }), 0, 0.06, 0, cell);          // cytoplasm
    k.mesh(new THREE.SphereGeometry(0.36, 16, 12), k.mat('#9c36b5', { roughness: 0.5 }), -0.55, 0.5, 0.2, cell);     // nucleus
    k.mesh(new THREE.SphereGeometry(0.5, 16, 12), k.mat('#74c0fc', { roughness: 0.3 }), 0.45, 0.46, -0.05, cell).scale.set(1.5, 0.5, 1.1);   // vacuole
    many(new THREE.SphereGeometry(1, 10, 8), k.mat('#37b24d', { roughness: 0.6 }), [[-1.0, 0.48, -0.55, 0, 0.4], [-0.2, 0.48, -0.66, 0, -0.3], [0.2, 0.48, 0.64, 0, 0.2], [0.95, 0.48, 0.6, 0, -0.5], [-0.95, 0.48, 0.64, 0, 0.9]].map((c) => [...c, 0, 0.22, 0.1, 0.13]), null, cell);   // chloroplasts
    many(new THREE.CapsuleGeometry(0.07, 0.2, 3, 8), k.mat('#ff922b', { roughness: 0.6 }), [[-1.02, 0.5, -0.12, 0, 0.3, 1.57], [-0.3, 0.5, 0.7, 0, -0.2, 1.57], [1.05, 0.5, -0.7, 0, 0.5, 1.57]], null, cell);                                                                 // mitochondria
    // giant mushrooms, huge flowers and bushes
    k.prop('mushroom', 7.2 * m, 0, -4.4, { s: 4, color: '#e8590c' }); k.prop('mushroom', -7.8 * m, 0, 0.8, { s: 2.8, color: '#f06595' }); k.prop('mushroom', 7.4 * m, 0, 3.4, { s: 2, color: '#fcc419' });
    const mid = S.mid, far = S.far, sm = S.sim, ar = S.arena;
    const blooms = [[3.6 * m, 0, 7.2, 2.6, 1, '#ff8787'], [-3.8 * m, 0, 7.0, 3.1, 1.15, '#da77f2'], ...[0.6, 2.2, 3.9, 5.4].map((a, i) => [ar[0] + Math.cos(a) * 6.3, ar[1], ar[2] + Math.sin(a) * 6.3, 2.4 + (i % 2) * 0.7, 1.1, ['#ffa94d', '#f783ac', '#ffe066', '#b197fc'][i]])];
    many(new THREE.CylinderGeometry(0.07, 0.1, 1, 6), k.mat('#2f9e44'), blooms.map(([x, y, z, h]) => [x, y + h / 2, z, 0, 0, 0, 1, h, 1]));
    many(new THREE.CylinderGeometry(1, 0.18, 0.4, 8, 1, true), white, blooms.map(([x, y, z, h, s], i) => [x, y + h + 0.1, z, 0.25, i * 1.3, 0, s]), blooms.map((b) => b[5]));
    many(new THREE.SphereGeometry(0.32, 10, 8), k.mat('#ffd43b', { roughness: 0.9 }), blooms.map(([x, y, z, h, s]) => [x, y + h + 0.08, z, 0, 0, 0, s]));
    k.prop('bush', -5.4 * m, mid[1], mid[2] + 0.4, { s: 1.3 }); k.prop('bush', 5.5 * m, mid[1], mid[2] - 0.9, { s: 1.1, color: '#51cf66' }); k.prop('bush', 4.8 * m, far[1], far[2] - 2.2, { s: 1.2 });
    k.prop('mushroom', -4.6 * m, far[1], far[2] - 2.6, { s: 1.6, color: '#e8590c' });
    // giant leaves reach out over the edge of every island: [island, radius, direction x (before mirroring), direction z, size]
    const leaves = [[S.home, 9.5, -1, -0.5, 1.7], [S.home, 9.5, 0.2, -1, 1.4], [S.home, 9.5, 1, 0.1, 1.8], [mid, 6.2, 1, 0.1, 1.5], [mid, 6.2, -1, 0.2, 1.3], [far, 6.6, -1, -0.4, 1.6], [sm, 7.4, 1, 0.25, 1.8], [sm, 7.4, 0.5, -1, 1.4], [ar, 7, -1, 0, 1.6], [ar, 7, 1, 0.35, 1.4]];
    many(new THREE.SphereGeometry(1, 8, 5), white, leaves.map(([c, R, ux, dz, s], i) => { const a = Math.atan2(dz, ux * m), tilt = 0.45 + (i % 3) * 0.12, r = R - 0.4 + Math.cos(tilt) * 1.5 * s; return [c[0] + Math.cos(a) * r, c[1] - 0.1 + Math.sin(tilt) * 1.5 * s, c[2] + Math.sin(a) * r, 0, -a, tilt, 1.5 * s, 0.05 * s, 0.62 * s]; }), ['#2b8a3e', '#37b24d', '#2f9e44', '#40c057']);

    // a DNA double helix turns slowly on the middle island
    const HT = 3.6, HR = 0.5, TURNS = 1.75;
    class Helix extends THREE.Curve { constructor(ph) { super(); this.ph = ph; } getPoint(t, target = new THREE.Vector3()) { const a = t * TURNS * Math.PI * 2 + this.ph; return target.set(Math.cos(a) * HR, t * HT, Math.sin(a) * HR); } }
    const dx = -3.2 * m, dz = mid[2] + 4.6, dna = k.add(new THREE.Group()); dna.position.set(dx, mid[1] + 0.6, dz);
    k.mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.3, 14), k.mat(k.theme.stone), dx, mid[1] + 0.15, dz);
    k.mesh(new THREE.TubeGeometry(new Helix(0), 60, 0.07, 6), k.mat('#4dabf7', { roughness: 0.4 }), 0, 0, 0, dna);
    k.mesh(new THREE.TubeGeometry(new Helix(Math.PI), 60, 0.07, 6), k.mat('#f783ac', { roughness: 0.4 }), 0, 0, 0, dna);
    many(new THREE.CylinderGeometry(0.035, 0.035, HR * 2, 6), k.mat('#ffffff', { roughness: 0.5 }), Array.from({ length: 13 }, (_, i) => { const t = (i + 0.5) / 13; return [0, t * HT, 0, 0, -(t * TURNS * Math.PI * 2), Math.PI / 2]; }), ['#ffd43b', '#69db7c', '#ff8787', '#74c0fc'], dna);
    k.animate((dt) => { dna.rotation.y += dt * 0.5; });
    // a pond with lily pads
    const px = 3.4 * m, pz = mid[2] - 3.4, py = mid[1];
    k.mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 28), k.mat(k.theme.water, { transparent: true, opacity: 0.82, roughness: 0.15 }), px, py + 0.03, pz).castShadow = false;
    k.mesh(new THREE.TorusGeometry(1.25, 0.13, 5, 14), k.mat(k.theme.stone, { flatShading: true }), px, py + 0.05, pz).rotation.x = Math.PI / 2;
    const pads = many(new THREE.CircleGeometry(0.3, 12, 0.35, 5.6).rotateX(-Math.PI / 2), k.mat('#37b24d', { side: THREE.DoubleSide }), [[px - 0.5, py + 0.075, pz - 0.3, 0, 0.4], [px + 0.45, py + 0.075, pz + 0.35, 0, 2.2, 0, 1.2], [px + 0.3, py + 0.075, pz - 0.6, 0, 4.1, 0, 0.8], [px - 0.35, py + 0.075, pz + 0.55, 0, 5.3, 0, 0.9]]); pads.castShadow = false;
    k.mesh(new THREE.ConeGeometry(0.15, 0.2, 6), k.mat('#ffc9de', { flatShading: true }), px + 0.45, py + 0.19, pz + 0.35).rotation.x = Math.PI;
    // butterflies: two wings that flap, circling
    const wingR = new THREE.PlaneGeometry(0.46, 0.56).rotateX(-Math.PI / 2).translate(0.23, 0, 0), wingL = new THREE.PlaneGeometry(0.46, 0.56).rotateX(-Math.PI / 2).translate(-0.23, 0, 0);
    const flyers = [[px, py + 1.7, pz, 1.9, 0.7, '#ffa94d'], [dx, mid[1] + 2.6, dz, 1.5, -0.9, '#74c0fc'], [ar[0], ar[1] + 3.1, ar[2], 3.2, 0.5, '#f783ac']].map(([x, y, z, r, w, c]) => {
      const g = k.add(new THREE.Group()), wm = k.mat(c, { side: THREE.DoubleSide, roughness: 0.6 }), a = k.mesh(wingR, wm, 0, 0, 0, g), b = k.mesh(wingL, wm, 0, 0, 0, g); a.castShadow = b.castShadow = false;
      return { g, a, b, x, y, z, r, w };
    });
    k.animate((dt, t) => { for (const f of flyers) { const a = t * f.w, flap = Math.sin(t * 9 + f.r) * 0.9; f.g.position.set(f.x + Math.cos(a) * f.r, f.y + Math.sin(t * 1.7 + f.r) * 0.25, f.z + Math.sin(a) * f.r); f.g.rotation.y = -a + (f.w > 0 ? Math.PI : 0); f.a.rotation.z = flap; f.b.rotation.z = -flap; } });

    // vines hang down the tower, well away from the ladder, and wind over the arch by the portal
    const top = far[1] + LAYOUT.towerH, zf = far[2] + 0.9, vineM = k.mat('#2f9e44', { roughness: 0.9 });
    for (const vx of [-2.1, 2.1]) k.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0.15, 0.3], [0, 0, -0.08], [0.15, -2, -0.12], [-0.15, -4, -0.1], [0.1, -5.4, -0.14]].map(([x, y, z]) => new THREE.Vector3(vx + x, top + y, zf + z))), 24, 0.06, 5), vineM, 0, 0, 0);
    k.prop('arch', S.end[0], S.end[1], S.end[2] - 3.4, { s: 0.9 });
    k.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-1.3, 0.2], [-1.5, 1.6], [-1.2, 2.9], [0, 4.05], [1.2, 2.9], [1.5, 1.6], [1.3, 0.2]].map(([x, y], i) => new THREE.Vector3(S.end[0] + x, S.end[1] + y, S.end[2] - 3.4 + (i % 2 ? 0.3 : -0.3)))), 40, 0.06, 5), vineM, 0, 0, 0);
    // a beehive in a tree and a fallen log on the meadow island (the simulation floor stays clear)
    const tx = sm[0] + 6.3 * m, tz = sm[2] - 2.2, hx = tx - 0.75 * m, hy = sm[1] + 1.55, hz = tz + 0.3;
    k.prop('tree', tx, sm[1], tz, { s: 1.5 });
    k.mesh(new THREE.LatheGeometry([[0.02, -0.42], [0.2, -0.38], [0.17, -0.3], [0.3, -0.26], [0.27, -0.18], [0.36, -0.13], [0.33, -0.04], [0.37, 0.02], [0.33, 0.1], [0.34, 0.16], [0.28, 0.24], [0.27, 0.3], [0.16, 0.38], [0.02, 0.42]].map(([r, y]) => new THREE.Vector2(r, y)), 14), k.mat('#e9b44c', { roughness: 0.9 }), hx, hy, hz);
    k.mesh(new THREE.SphereGeometry(0.08, 8, 6), k.mat('#5c3d1e'), hx - 0.3 * m, hy - 0.1, hz + 0.12);
    const bees = [0, 2.1, 4.2].map((ph) => { const b = k.mesh(new THREE.SphereGeometry(0.05, 8, 6), k.mat('#ffd43b', { roughness: 0.5 }), hx, hy, hz); b.castShadow = false; b.scale.x = 1.4; return { b, ph }; });
    k.animate((dt, t) => { for (const { b, ph } of bees) { const a = t * 1.6 + ph; b.position.set(hx + Math.cos(a) * 0.75, hy + Math.sin(a * 2.3 + ph) * 0.3, hz + Math.sin(a) * 0.75); b.rotation.y = -a; } });
    const lx = sm[0] - 5.0 * m, lz = sm[2] + 4.6, ln = Math.hypot(5.0, 4.6), ax = -4.6 / ln, az = -5.0 * m / ln, yawL = Math.atan2(-az, ax);
    k.mesh(new THREE.CylinderGeometry(0.45, 0.5, 2.6, 10), k.mat(k.theme.wood, { flatShading: true }), lx, sm[1] + 0.46, lz).rotation.set(0, yawL, Math.PI / 2);
    k.mesh(new THREE.CylinderGeometry(0.35, 0.39, 2.64, 10), k.mat('#e0b98a'), lx, sm[1] + 0.46, lz).rotation.set(0, yawL, Math.PI / 2);
    k.prop('mushroom', lx + ax * 0.6, sm[1] + 0.88, lz + az * 0.6, { s: 0.6, color: '#f06595' }); k.prop('mushroom', lx - ax * 0.7, sm[1] + 0.86, lz - az * 0.7, { s: 0.45, color: '#fcc419' });

    // giant canopy trees stand far off in the mist
    const giants = [[-30 * m, 26], [34 * m, 44], [-26 * m, 78], [46 * m, 92]];
    many(new THREE.CylinderGeometry(2.2, 3.2, 70, 10), k.mat('#6b5440', { roughness: 1, fog: false }), giants.map(([x, z]) => [x, 5, z])).castShadow = false;
    many(new THREE.IcosahedronGeometry(14, 1), k.mat('#2f9e44', { roughness: 1, flatShading: true, fog: false }), giants.map(([x, z], i) => [x, 42 + i * 2, z, 0, i, 0, 1, 0.5, 1])).castShadow = false;
    const mist = many(new THREE.SphereGeometry(1, 12, 8), k.mat('#ffffff', { roughness: 1, transparent: true, opacity: 0.3, depthWrite: false }), [[-14 * m, -2.5, 16], [13 * m, -1.5, 31], [-13 * m, -1, 50], [32 * m, 3, 70], [4 * m, 3.5, 86], [34 * m, 4, 98]].map(([x, y, z], i) => [x, y, z, 0, i, 0, 6 + i % 3, 1, 4])); mist.castShadow = mist.receiveShadow = false;
    k.animate((dt, t) => { mist.position.x = Math.sin(t * 0.05) * 4; });
  },
  sim,
};
