// 3D lab — Sculpture Wheel: a potter's wheel spins a red profile line into a real lathe-turned form, which the player reshapes.
// No imports: everything arrives through ctx, so the model can be checked by tools/test-game3d.mjs without a browser.

// ----- the model (the same as the 2D lab) -----
// A profile is the distance from the spin axis (0–1) at N heights, top to bottom. Spinning it makes a solid of revolution.
const N = 28;
const bump = (u, c, w) => Math.exp(-(((u - c) / w) ** 2));
export const SHAPES = [
  ['Vase', (u) => 0.28 + 0.5 * bump(u, 0.62, 0.25) + 0.18 * bump(u, 0, 0.1)],
  ['Bowl', (u) => (u < 0.35 ? 0 : 0.2 + 0.75 * Math.sqrt(1 - ((u - 0.35) / 0.65) ** 2))],
  ['Bell', (u) => 0.12 + 0.8 * u * u + 0.1 * bump(u, 0.05, 0.08)],
  ['Ball', (u) => 0.9 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))],
  ['Cone', (u) => 0.04 + 0.85 * u],
  ['Hourglass', (u) => 0.15 + 0.75 * Math.abs(2 * u - 1)],
  ['Bottle', (u) => (u < 0.35 ? 0.18 : u < 0.5 ? 0.18 + (u - 0.35) / 0.15 * 0.47 : 0.65)],
  ['Spinning top', (u) => (u < 0.3 ? 0.08 : 0.08 + 0.85 * Math.sin(Math.PI * (u - 0.3) / 0.7) ** 0.7 * (1 - 0.5 * (u - 0.3)))],
];
export const profileOf = (fn) => Array.from({ length: N }, (_, i) => Math.max(0, Math.min(1, fn(i / (N - 1)))));
const ROUNDS = 3;
// The pot stands 30 cm tall and a profile value of 1 is 13.5 cm from the axis.
const TALL = 30, WIDE = 13.5;
// Volume of the turned solid, in litres: every slice between two heights is a cone frustum,  V = π·h/3 · (r₀² + r₀·r₁ + r₁²).
export const volume = (prof) => { let v = 0; const h = TALL / (prof.length - 1); for (let i = 0; i < prof.length - 1; i++) { const a = prof[i] * WIDE, b = prof[i + 1] * WIDE; v += (Math.PI * h / 3) * (a * a + a * b + b * b); } return v / 1000; };
// Pushing or pulling the clay at one height moves its neighbours a little too (the same weights as the 2D lab).
export const press = (prof, i, r) => { for (let k = -2; k <= 2; k++) if (i + k >= 0 && i + k < prof.length) { const w = [1, 0.6, 0.25][Math.abs(k)]; prof[i + k] += (r - prof[i + k]) * w; } return prof; };

export function selfTest() {
  const cone = profileOf(SHAPES[4][1]), glass = profileOf(SHAPES[5][1]), ball = profileOf(SHAPES[3][1]);
  // a straight profile from 0.04 to 0.89 is one exact frustum: π·30/3 · (0.54² + 0.54·12.015 + 12.015²) cm³
  const exact = (Math.PI * TALL / 3) * ((0.04 * WIDE) ** 2 + 0.04 * WIDE * 0.89 * WIDE + (0.89 * WIDE) ** 2) / 1000, got = volume(cone);
  // a ball of radius 0.9 × 13.5 cm squeezed into 30 cm of height: (4/3)·π·a²·c with a = 12.15 cm, c = 15 cm (slices come out a little under)
  const egg = (4 / 3) * Math.PI * 12.15 * 12.15 * 15 / 1000, gotBall = volume(ball);
  const p = press([0.5, 0.5, 0.5, 0.5, 0.5], 2, 1);
  const ok = Math.abs(cone[0] - 0.04) < 1e-12 && Math.abs(cone[N - 1] - 0.89) < 1e-12 && Math.abs(got - exact) < 1e-9 && Math.abs(glass[0] - 0.9) < 1e-12 && Math.abs(glass[13] - (0.15 + 0.75 / 27)) < 1e-12
    && ball[0] === 0 && Math.abs(gotBall - egg) / egg < 0.02 && gotBall < egg && p.join() === '0.625,0.8,1,0.8,0.625';
  return { ok, detail: `cone ${got.toFixed(4)} L, exact frustum ${exact.toFixed(4)} L; ball ${gotBall.toFixed(3)} L against ${egg.toFixed(3)} L; hourglass waist ${glass[13].toFixed(4)}; pressing the middle of a tube gives ${p.join(', ')}` };
}

export default {
  id: 'w15-wheel',
  world: 15,
  levels: [1, 2],
  title: 'Sculpture Wheel',
  goal: 'Guess which shape the spinning wheel will make from a line, then shape your own clay.',
  kind: 'validated',
  model: 'The wheel makes perfectly round shapes from one line, like a potter\'s wheel or a lathe: every point of the line travels in a circle round the axis. The clay is measured as a stack of 27 thin slices, each a cone frustum, for a pot 30 cm tall. Real clay can sag, wobble and be hollow; this clay is solid and never slumps.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, lvl = (ctx.level || 1) <= 1 ? 1 : 2, own = [];
    const keep = (x) => { own.push(x); return x; };
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(keep(geo), material); m.position.set(x, y, z); parent.add(m); return m; };
    const R = 0.9, H = 2.0, BASE = 1.06, SEG = 40;                         // widest radius, height and foot of the clay in metres
    const yOf = (i) => BASE + H * (1 - i / (N - 1));
    const metal = ctx.mat('#8d7aa8', { metalness: 0.4, roughness: 0.4 }), stone = ctx.mat('#a8947c', { roughness: 0.9 }), redLine = ctx.lit('#d9485f', 0.9);
    const clayMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }));
    const thumbMat = ctx.mat('#c9773f', { roughness: 0.8, side: THREE.DoubleSide });

    // the wheel: a heavy base, a turning head and the dashed spin axis
    add(new THREE.CylinderGeometry(0.7, 0.9, 0.86, 24), ctx.mat('#5d4a6e', { roughness: 0.7 }), 0, 0.43, 0);
    const head = add(new THREE.CylinderGeometry(1.1, 1.1, 0.14, 40), stone, 0, 0.96, 0);
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.16, 0.03, 0.16), metal, Math.cos(k * Math.PI / 2) * 0.95, 0.08, Math.sin(k * Math.PI / 2) * 0.95, head);   // marks that show the head turning
    for (let y = 1.1; y < 3.5; y += 0.3) add(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), metal, 0, y, 0).castShadow = false;

    // the lathe form: points run from the foot up to the top, closed on the axis at both ends
    const lathe = (prof, r, h, y0, sweep = Math.PI * 2, stripes = false) => {
      const pts = [new THREE.Vector2(0, y0)];
      for (let i = prof.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(Math.max(0.001, prof[i] * r), y0 + h * (1 - i / (prof.length - 1))));
      pts.push(new THREE.Vector2(0, y0 + h));
      const g = new THREE.LatheGeometry(pts, SEG, Math.PI / 2, sweep);
      if (stripes) {                                                       // bands painted on the clay travel round as it turns
        const n = g.attributes.position.count, col = new Float32Array(n * 3), per = pts.length;
        for (let v = 0; v < n; v++) { const s = Math.floor(v / per), dark = s % 10 < 2; col.set(dark ? [0.56, 0.3, 0.17] : [0.86, 0.52, 0.32], v * 3); }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      return g;
    };
    const clay = new THREE.Mesh(new THREE.BufferGeometry(), clayMat); clay.visible = false; group.add(clay);
    const line = new THREE.Mesh(new THREE.BufferGeometry(), redLine); line.castShadow = false; group.add(line);
    const ring = add(new THREE.TorusGeometry(1, 0.025, 8, 40), ctx.lit('#ffd76a', 1.2), 0, 2, 0); ring.rotation.x = Math.PI / 2; ring.visible = false; ring.castShadow = false;

    let prof = profileOf(SHAPES[0][1]), stage = 'guess', reveal = 0, round = 0, right = 0, done = false, answer = 0, firstTry = true, shaped = false, picks = [], quiet = false, auto = false, wait = 0, dirty = false, spin = 0;
    const rAsk = ui.readout('Task'), rStars = ui.readout('Stars'), rWide = ui.readout('Widest part, cm across'), rVol = ui.readout('Clay used, litres');
    const rebuildLine = () => {
      line.geometry.dispose();
      const curve = new THREE.CatmullRomCurve3(prof.map((r, i) => new THREE.Vector3(r * R + 0.03, yOf(i), 0)), false, 'catmullrom', 0);
      line.geometry = new THREE.TubeGeometry(curve, 80, stage === 'guess' ? 0.05 : 0.028, 6, false);
    };
    const rebuildClay = () => { clay.geometry.dispose(); clay.geometry = lathe(prof, R, H, BASE, Math.max(0.02, reveal) * Math.PI * 2, true); clay.visible = reveal > 0; };
    const measure = () => { rWide.set((2 * Math.max(...prof) * WIDE).toFixed(1)); rVol.set(volume(prof).toFixed(2)); };

    // the candidate shapes stand in a row at the front; tap one, or choose it on the panel
    const spots = lvl === 1 ? [-2.3, 2.3] : [-2.5, 0, 2.5], stands = spots.map((x, k) => {
      const g = new THREE.Group(); g.position.set(x, 0, 2.1); group.add(g);
      add(new THREE.CylinderGeometry(0.42, 0.48, 0.12, 20), metal, 0, 0.06, 0, g);
      const form = new THREE.Mesh(new THREE.BufferGeometry(), thumbMat); g.add(form);
      const hit = add(new THREE.CylinderGeometry(0.45, 0.45, 0.85, 12), keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })), 0, 0.5, 0, g); hit.castShadow = false;
      const tag = ctx.sprite(String(k + 1), { size: 0.4 }); tag.position.set(0, 1.08, 0); g.add(tag);
      ctx.onTap(hit, () => pick(k));
      return { g, form, out: false };
    });
    ui.choice(spots.map((_, k) => [k, `Shape ${k + 1}`]), null, (k) => pick(+k));

    function ask() {
      stage = 'guess'; reveal = 0; firstTry = true; spin = 0; clay.rotation.y = 0; clay.visible = false; ring.visible = false;
      picks = SHAPES.map((s, i) => [ctx.rng(), i]).sort((a, b) => a[0] - b[0]).slice(0, spots.length).map((x) => x[1]);
      answer = picks[Math.floor(ctx.rng() * picks.length)];
      prof = profileOf(SHAPES[answer][1]);
      stands.forEach((s, k) => { s.out = false; s.g.visible = true; s.form.geometry.dispose(); s.form.geometry = lathe(profileOf(SHAPES[picks[k]][1]), 0.36, 0.78, 0.12); });
      rAsk.set('What will the wheel make from the red line? Tap a shape.');
      rebuildLine(); measure();
    }
    function pick(k) {
      if (stage !== 'guess' || !(k >= 0 && k < picks.length) || stands[k].out) return;
      if (picks[k] !== answer) { firstTry = false; stands[k].out = true; ctx.say('Not that one. Look at where the red line is far from the middle: the shape is wide there.'); return; }
      stage = 'spin'; round++; if (firstTry) right++;
      rStars.set(`${right} ★ · ${Math.min(round, ROUNDS)} / ${ROUNDS}`);
      if (ctx.calm) reveal = 1;
      rebuildLine(); rebuildClay(); ring.visible = true; moveRing();
      rAsk.set(`${SHAPES[answer][0]}! Now push and pull the clay to change it.`);
      ctx.say('Spinning copies the line all the way round. Both sides match: that is symmetry.');
      if (round >= ROUNDS && !done) { done = true; ctx.complete(Math.max(0.4, right / ROUNDS), 'Predicted the solid that a spinning profile makes, and shaped clay on the wheel.'); }
    }
    // shaping: choose a height, then set how wide the clay is there; the wheel shapes it all the way round
    const at = () => Math.round((1 - heightS.value / 100) * (N - 1));
    const moveRing = () => { const i = at(), r = Math.max(0.12, prof[i] * R + 0.07); ring.position.y = yOf(i); ring.scale.set(r, r, 1); };
    function shape(width) {
      if (stage !== 'spin') { ctx.say('Guess first! Tap one of the shapes.'); return; }
      press(prof, at(), Math.min(1, Math.max(0, width / 100)));
      dirty = true; measure(); moveRing();
      if (!shaped) { shaped = true; ctx.say('You only move one side, and the wheel shapes the whole way round.'); }
    }
    const heightS = ui.slider({ label: 'Height on the clay', min: 0, max: 100, step: 4, value: 48, unit: '%', onInput: () => { if (stage !== 'spin') return; quiet = true; widthS.set(Math.round(prof[at()] * 100)); quiet = false; moveRing(); } });
    const widthS = ui.slider({ label: 'Width of the clay there', min: 0, max: 100, step: 2, value: 50, unit: '%', onInput: (v) => { if (!quiet) shape(+v); } });
    const next = () => { if (stage !== 'spin') { ctx.say('Guess first! Tap one of the shapes.'); return; } ask(); };
    ui.button('▶️ Next line', next, 'btn');
    ui.note('The red line is one side of the shape. The wheel carries every point of it round in a circle, so the finished form is the same all the way round.');
    // tapping the clay chooses the height to work on
    ctx.onTap(clay, (o, point) => { if (stage !== 'spin' || !point) return; heightS.set(Math.round(Math.min(1, Math.max(0, (point.y - BASE) / H)) * 25) * 4); });
    rStars.set(`0 ★ · 0 / ${ROUNDS}`);
    ask();
    ctx.say('A potter\'s wheel spins a line round and round to make a round shape. Guess the shape first!');

    return {
      step(dt) {
        if (stage === 'spin' && reveal < 1) { reveal = Math.min(1, reveal + dt * 0.9); dirty = true; }
        if (!auto) return;
        // the demonstration: guess, watch the wheel turn the form, push the clay in once, then ask for the next line
        wait -= dt; if (wait > 0) return;
        if (stage === 'guess') { pick(picks.indexOf(answer)); wait = 0.3; }
        else if (reveal >= 1) { if (!done) { heightS.set(48); widthS.set(30); next(); wait = 0.3; } else auto = false; }
      },
      frame(dt) {
        if (dirty) { dirty = false; rebuildLine(); rebuildClay(); }
        stands.forEach((s) => { if (s.out && s.g.visible) { s.g.position.y -= dt * 1.5; if (s.g.position.y < -1.2 || ctx.calm) { s.g.visible = false; } } else if (!s.out) s.g.position.y = 0; });
        if (stage === 'spin' && reveal >= 1 && !ctx.calm) { spin += dt * 2.2; clay.rotation.y = spin; }
        if (!ctx.calm) head.rotation.y += dt * (stage === 'spin' ? 2.2 : 0.3);
      },
      autoplay() { auto = true; wait = 0; },
      dispose() { for (const x of own) x.dispose?.(); clay.geometry.dispose(); line.geometry.dispose(); for (const s of stands) s.form.geometry.dispose(); },
    };
  },
};
