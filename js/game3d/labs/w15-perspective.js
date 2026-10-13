// 3D lab — Perspective Studio: a real road of posts, an artist's eye, a glass picture window and the picture it makes.
// No imports: everything arrives through ctx, so the model can be checked by tools/test-game3d.mjs without a browser.

// ----- the model (the same as the 2D lab) -----
// Pinhole (camera obscura) model of linear perspective. A point at distance d in front of the eye, a height Y above the
// eye and X to the side lands on the picture at   x = f·X / d,   y = f·Y / d   from the vanishing point (f = picture
// distance in pixels). So the drawn height of an object of real height H is   h = f · H / d : twice as far, half as tall.
const F = 240, EYE = 1.6, POST = 3, SIDE = -1.5; // px, m, m, m
export const drawnHeight = (d, H = POST, f = F) => (f * H) / d;
// Where a post at distance d lands on the picture, in pixels from the vanishing point (x to the right, y upwards).
export const project = (d) => ({ x: (F * SIDE) / d, base: -(F * EYE) / d, top: (F * (POST - EYE)) / d });
const fmt = (v) => String(Math.round(v * 10) / 10);

export function selfTest() {
  const a = drawnHeight(4), b = drawnHeight(8), c = drawnHeight(12.5), p = project(4), q = project(8);
  // the tops of equal posts lie on one straight line through the vanishing point (0, 0): the slopes must agree
  const sTop = [p.top / p.x, q.top / q.x], sBase = [p.base / p.x, q.base / q.x];
  const ok = a === 180 && b === 90 && Math.abs(c - 57.6) < 1e-9 && Math.abs(p.top - p.base - a) < 1e-9 && p.base === -96 && p.top === 84 && p.x === -90
    && Math.abs(sTop[0] - sTop[1]) < 1e-12 && Math.abs(sBase[0] - sBase[1]) < 1e-12;
  return { ok, detail: `3 m post at 4 m = ${a} px, at 8 m = ${b} px (half), at 12.5 m = ${c.toFixed(1)} px; post at 4 m spans ${p.base} to ${p.top} px at x = ${p.x} px; top and base lines pass through the vanishing point (slopes ${sTop[0].toFixed(4)} = ${sTop[1].toFixed(4)}, ${sBase[0].toFixed(4)} = ${sBase[1].toFixed(4)})` };
}

export default {
  id: 'w15-perspective',
  world: 15,
  levels: [5, 6],
  title: 'Perspective Studio',
  goal: 'Work out how tall a distant post must be drawn, then prove it with sight lines to the eye and lines to the vanishing point.',
  kind: 'validated',
  model: 'Ideal linear perspective for a single fixed eye (a pinhole camera) 1.6 m above the ground, looking level at a flat picture: drawn height = f × real height ÷ distance, with f = 240 px. No lens distortion, no curvature of the eye\'s view, no haze. The road is a scale model (1 m of road is 25 cm here) and the big picture is enlarged so it can be seen. This version shows one-point perspective only; it leaves out the two-point guides and the freehand drawing tools of the flat lab.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, own = [];
    const keep = (x) => { own.push(x); return x; };
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(keep(geo), material); m.position.set(x, y, z); parent.add(m); return m; };
    const UP = new THREE.Vector3(0, 1, 0);
    // a thin rod between two points (its length is set by scale, so it can be moved every frame)
    const rod = (material, thick, parent = group) => { const m = add(new THREE.CylinderGeometry(thick, thick, 1, 6), material, 0, 0, 0, parent); m.castShadow = false; return m; };
    const span = (m, a, b) => { const d = b.clone().sub(a), len = d.length() || 1e-4; m.position.copy(a).addScaledVector(d, 0.5); m.scale.y = len; m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / len)); };

    // ---- the road: a scale model along x. Real (distance d, side X, height Y) → scene (X0 + d·S, Y·S, −X·S) ----
    const S = 0.25, X0 = -3.3, GLASS = 3;                                  // scale, where the eye stands, real distance of the picture window (m)
    const P = (d, X, Y) => new THREE.Vector3(X0 + d * S, Y * S + 0.06, -X * S);
    const wood = ctx.mat('#7a4a21', { roughness: 0.8 }), red = ctx.lit('#d9485f', 0.5), grey = ctx.mat('#b9b4c9', { roughness: 0.9 }), metal = ctx.mat('#8d7aa8', { metalness: 0.4, roughness: 0.4 });
    const green = ctx.lit('#17c684', 1.1), blue = ctx.lit('#4f5bd5', 1.0), pale = ctx.mat('#f4f0e6', { roughness: 0.9 });
    add(new THREE.BoxGeometry(6.6, 0.06, 1.5), ctx.mat('#cfc8b8', { roughness: 1 }), 0, 0.03, 0);
    add(new THREE.BoxGeometry(6.6, 0.065, 0.5), ctx.mat('#8f8a9c', { roughness: 1 }), 0, 0.03, 0);
    // the artist: body, head and one eye, 1.6 m above the ground in the model
    add(new THREE.CylinderGeometry(0.07, 0.11, 0.3, 12), ctx.mat('#4f5bd5'), X0 - 0.08, 0.21, 0);
    add(new THREE.SphereGeometry(0.1, 16, 12), ctx.mat('#f1c9a5'), X0 - 0.08, 0.44, 0);
    const eyeAt = P(0, 0, EYE);
    add(new THREE.SphereGeometry(0.04, 10, 8), ctx.lit('#ffffff', 1.4), eyeAt.x, eyeAt.y, eyeAt.z);
    // the picture window: a sheet of glass 3 m in front of the eye. What is traced on it is the picture.
    const glassAt = P(GLASS, 0, 0).x;
    const glassMat = keep(new THREE.MeshStandardMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    add(new THREE.BoxGeometry(0.02, 0.95, 1.3), glassMat, glassAt, 0.06 + 0.475, 0.1).castShadow = false;
    for (const z of [-0.56, 0.76]) add(new THREE.BoxGeometry(0.04, 1.0, 0.04), metal, glassAt, 0.56, z);
    // the central sight line from the eye to the vanishing point, far down the road
    span(rod(blue, 0.008), eyeAt, P(26, 0, EYE));
    // marks on the glass (real size at the glass = px · GLASS / F)
    const onGlass = (px, py) => P(GLASS, (px * GLASS) / F, EYE + (py * GLASS) / F).setX(glassAt);
    const gNear = rod(wood, 0.018), gFar = rod(red, 0.018);

    // the posts: a row of pale ones along the road, and the two that matter
    const row = []; for (let i = 0; i < 6; i++) row.push(add(new THREE.CylinderGeometry(0.03, 0.03, POST * S, 8), pale, 0, 0, 0));
    const nearPost = add(new THREE.CylinderGeometry(0.05, 0.05, POST * S, 10), wood, 0, 0, 0), farPost = add(new THREE.CylinderGeometry(0.05, 0.05, POST * S, 10), red, 0, 0, 0);
    let tags = [];
    const tag = (text, at) => { const t = ctx.sprite(text, { size: 0.34 }); t.position.copy(at); group.add(t); tags.push(t); };
    const rays = [0, 1, 2, 3].map(() => rod(green, 0.007)), pulses = [0, 1, 2, 3].map(() => add(new THREE.SphereGeometry(0.05, 8, 6), green, 0, 0, 0));

    // ---- the picture, enlarged on an easel behind the road: 1 px = 1 cm, vanishing point at VP ----
    const K = 0.01, VP = new THREE.Vector3(0.6, 2.75, -2.1), TOPMAX = 165;
    const Q = (px, py, lift = 0.05) => new THREE.Vector3(VP.x + px * K, VP.y + Math.min(TOPMAX, py) * K, VP.z + lift);
    add(new THREE.BoxGeometry(4.4, 1.7, 0.08), ctx.mat('#e8f1ff', { roughness: 0.9 }), 0.4, VP.y + 0.85, VP.z);          // sky
    add(new THREE.BoxGeometry(4.4, 1.15, 0.08), ctx.mat('#e3ecd4', { roughness: 0.9 }), 0.4, VP.y - 0.575, VP.z);       // ground
    add(new THREE.BoxGeometry(4.4, 0.03, 0.1), ctx.mat('#5b6585'), 0.4, VP.y, VP.z);                                     // horizon = eye level
    add(new THREE.BoxGeometry(4.6, 0.1, 0.14), metal, 0.4, VP.y - 1.2, VP.z);
    for (const sx of [-1.4, 2.2]) add(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 8), metal, sx, 0.8, VP.z - 0.1);
    add(new THREE.SphereGeometry(0.09, 14, 10), blue, VP.x, VP.y, VP.z + 0.07);
    const vpTag = ctx.sprite('VP', { size: 0.36, color: '#4f5bd5' }); vpTag.position.set(VP.x + 0.3, VP.y + 0.22, VP.z + 0.1); group.add(vpTag);
    const hTag = ctx.sprite('horizon = eye level', { size: 0.3, color: '#5b6585' }); hTag.position.set(-1.0, VP.y + 0.16, VP.z + 0.1); group.add(hTag);
    const eNear = rod(wood, 0.04), eFar = rod(red, 0.04), proof = [rod(green, 0.014), rod(green, 0.014)];
    for (const edge of [-1, 1]) span(rod(grey, 0.012), Q(edge * 25, -TOPMAX * 0.69), Q(0, 0));                             // the road's two edges meet at the vanishing point

    // ---- the task ----
    let d1 = 4, d2 = 8, tries = 0, done = false, testing = 0, shownH = 100, proofOn = 0, pending = false;
    const rGoal = ui.readout('Task'), rNear = ui.readout('Near post: drawn height'), rRatio = ui.readout('Distance ratio d₂ ÷ d₁'), rMine = ui.readout('Far post: your drawn height'), rTruth = ui.readout('h = f × H ÷ d');
    const farH = ui.slider({ label: 'Drawn height of the far post', min: 4, max: 200, step: 1, value: 120, unit: 'px', onInput: (v) => { proofOn = 0; pending = false; testing = 0; rMine.set(`${Math.round(+v)} px`); } });
    const height = () => Math.min(200, Math.max(4, +farH.value || 4));

    function mission() {
      d1 = [4, 5, 6][Math.floor(ctx.rng() * 3)];
      d2 = [2, 2.5, 3, 4][Math.floor(ctx.rng() * 4)] * d1;
      tries = 0; done = false; pending = false; testing = 0; proofOn = 0;
      farH.set(Math.round(drawnHeight(d1) * (0.55 + 0.4 * ctx.rng())));
      rNear.set(fmt(drawnHeight(d1)) + ' px'); rRatio.set(fmt(d2 / d1)); rTruth.set(`${F} px × ${POST} m ÷ d`);
      rGoal.set(`Two identical posts, each ${POST} m tall, stand ${d1} m and ${d2} m from the eye. Give the far (red) post its correct drawn height.`);
      row.forEach((m, i) => { const d = d1 * (i + 1); m.visible = d <= 25 && d !== d2 && i > 0; m.position.copy(P(m.visible ? d : d1, SIDE, POST / 2)); });
      nearPost.position.copy(P(d1, SIDE, POST / 2)); farPost.position.copy(P(d2, SIDE, POST / 2));
      for (const t of tags) { t.removeFromParent(); t.material?.map?.dispose?.(); t.material?.dispose?.(); }
      tags = []; tag(`${d1} m`, P(d1, SIDE, POST + 0.9)); tag(`${d2} m`, P(d2, SIDE, POST + 0.9));
      const a = project(d1);
      span(gNear, onGlass(a.x, a.base), onGlass(a.x, a.top)); span(eNear, Q(a.x, a.base), Q(a.x, a.top));
      [[d1, POST], [d1, 0], [d2, POST], [d2, 0]].forEach(([d, y], i) => span(rays[i], P(d, SIDE, y), eyeAt));
      proof.forEach((m, i) => span(m, Q(a.x, i ? a.base : a.top, 0.06), Q(0, 0, 0.06)));
      place();
    }
    // the red far post as the player has drawn it: on the glass and on the easel, standing on its true base point
    function place() {
      const b = project(d2);
      span(gFar, onGlass(b.x, b.base), onGlass(b.x, b.base + shownH)); span(eFar, Q(b.x, b.base), Q(b.x, b.base + shownH));
    }
    function verdict() {
      const truth = drawnHeight(d2), h = height(), err = Math.abs(h - truth) / truth;
      rTruth.set(`${F} × ${POST} ÷ ${d2} = ${fmt(truth)} px`);
      if (err > 0.06) {
        ctx.say(`${h > truth ? 'Yours is too tall.' : 'Yours is too short.'} The green lines from the top and foot of the near post to the vanishing point show where the far post must fit. It is ${fmt(d2 / d1)} times as far away, so it must be drawn that many times smaller than ${fmt(drawnHeight(d1))} px.`);
        return;
      }
      ctx.say(`It fits! h = f × H ÷ d = ${F} × ${POST} ÷ ${d2} = ${fmt(truth)} px. Parallel lines in the world meet at the vanishing point in the picture, so equal posts shrink in proportion to 1 ÷ distance.`);
      if (!done) { done = true; ctx.complete(Math.max(0.4, 1 - 0.12 * (tries - 1)), 'Used h = f·H/d and vanishing-point lines to size a distant object.'); }
    }
    function test() {
      if (pending) return;
      tries++; pending = true; testing = 0; proofOn = 0;
      if (ctx.calm) { testing = 1; proofOn = 1; pending = false; verdict(); }
    }
    ui.button('✔ Test with sight lines', test, 'btn');
    ui.button('🔄 New mission', mission);
    ui.note('h = f × H ÷ d, with f = 240 px, H = real height in metres and d = distance in metres. The glass window is the picture: every sight line from a post to the eye crosses it at the spot where that post is drawn.');
    const hit = add(new THREE.BoxGeometry(0.4, 1.0, 0.4), keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })), 0, 0, 0, farPost); hit.castShadow = false;
    ctx.onTap(hit, () => test());
    mission();
    ctx.say('Artists since the Renaissance have used a vanishing point to make flat pictures look deep. The near post is drawn ' + fmt(drawnHeight(d1)) + ' px tall. Set the far post\'s drawn height, then test it.');

    return {
      step(dt) {
        if (!pending) return;
        testing = Math.min(1, testing + dt / 1.4);                     // the sight lines travel from the posts to the eye
        if (testing >= 1) { pending = false; proofOn = 1; verdict(); }
      },
      frame(dt) {
        const f = ctx.calm ? 1 : Math.min(1, dt * 8), h = height();
        if (Math.abs(shownH - h) > 0.01) { shownH += (h - shownH) * f; place(); }
        const on = pending || proofOn > 0;
        rays.forEach((m) => { m.visible = on; });
        proof.forEach((m) => { m.visible = proofOn > 0; });
        pulses.forEach((m, i) => {
          m.visible = pending;
          if (pending) { const [d, y] = [[d1, POST], [d1, 0], [d2, POST], [d2, 0]][i]; m.position.copy(P(d, SIDE, y)).lerp(eyeAt, testing); }
        });
      },
      autoplay() { farH.set(Math.round(drawnHeight(d2))); test(); },
      dispose() { for (const x of own) x.dispose?.(); },
    };
  },
};
