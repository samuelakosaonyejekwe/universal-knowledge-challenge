// World 7 lab — Compass and Continents, on a turning globe with raised continent shapes and a standing compass.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

// Stylised continents as polygons on a 100 x 50 grid (x: west->east, y: north->south). Not real map data.
const C = {
  'North America': { col: '#e8a33d', p: [[6, 6], [24, 4], [32, 8], [28, 18], [22, 24], [16, 22], [10, 14]] },
  'South America': { col: '#4caf7a', p: [[22, 27], [32, 27], [36, 34], [30, 46], [26, 46], [24, 36]] },
  'Europe': { col: '#8e6fd1', p: [[44, 8], [54, 6], [58, 12], [52, 16], [44, 15]] },
  'Africa': { col: '#d9654a', p: [[44, 18], [56, 18], [60, 28], [54, 40], [48, 40], [44, 28]] },
  'Asia': { col: '#4aa3d9', p: [[58, 6], [84, 6], [90, 16], [82, 26], [70, 26], [60, 20]] },
  'Australia': { col: '#e0709c', p: [[78, 34], [90, 34], [92, 42], [80, 44]] },
  'Antarctica': { col: '#cfe3ee', p: [[20, 47.5], [80, 47.5], [80, 50], [20, 50]] },
};
const NAMES = Object.keys(C);
const DIRS = ['north', 'east', 'south', 'west'];
const cen = (n) => { const p = C[n].p; return [p.reduce((s, v) => s + v[0], 0) / p.length, p.reduce((s, v) => s + v[1], 0) / p.length]; };
const inside = (pt, poly) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) r = !r; } return r; };
// grid <-> globe: the grid is wrapped once around the globe and squeezed a little away from the poles
const lonOf = (x) => x * 3.6 - 180, latOf = (y) => 80 - 3.1 * y, xOf = (lon) => (lon + 180) / 3.6, yOf = (lat) => (80 - lat) / 3.1;
const ANT_LAT = latOf(47.5);

export const model = {
  centre: cen,
  // The compass direction of the longer part of the trip from a to b (north is up on the grid, east is right).
  direction(a, b) { const [ax, ay] = cen(a), [bx, by] = cen(b), dx = bx - ax, dy = by - ay; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north'); },
  // On a globe you could also go the other way round, so only pairs less than a third of the way round are asked.
  clear(a, b) { return a !== b && Math.abs(cen(b)[0] - cen(a)[0]) * 3.6 <= 120; },
  // Which continent lies under this point of the globe (null = ocean).
  at(lon, lat) { const pt = [xOf(lon), yOf(lat)]; if (pt[1] >= 47.5) return 'Antarctica'; return NAMES.find((n) => n !== 'Antarctica' && inside(pt, C[n].p)) || null; },
  // Where the panel pointer has to be to sit on a continent (rounded to the 5 degree steps of the sliders).
  aim(n) { if (n === 'Antarctica') return [0, -75]; const [x, y] = cen(n); return [Math.round(lonOf(x) / 5) * 5, Math.round(latOf(y) / 5) * 5]; },
};

export function selfTest() {
  const e = cen('Europe'), a = cen('Africa');
  const checks = [
    Math.abs(e[0] - 50.4) < 1e-9 && Math.abs(e[1] - 11.4) < 1e-9,              // (44+54+58+52+44)/5, (8+6+12+16+15)/5
    Math.abs(a[0] - 51) < 1e-9 && Math.abs(a[1] - 86 / 3) < 1e-9,              // 306/6, 172/6
    model.direction('Africa', 'Europe') === 'north',                            // dx -0.6, dy -17.3
    model.direction('Europe', 'Asia') === 'east',                               // dx 23.6, dy 5.3
    model.direction('North America', 'South America') === 'south',              // dx 8.6, dy 22.3
    model.direction('Asia', 'Europe') === 'west',
    model.at(-172.8, -13) === null,                                             // grid point (2, 30): open ocean
    !model.clear('North America', 'Australia') && model.clear('Europe', 'Africa'),
    NAMES.every((n) => model.at(...model.aim(n)) === n),
    NAMES.every((n) => n === 'Antarctica' || NAMES.some((m) => m !== 'Antarctica' && model.clear(n, m))),
  ];
  return { ok: checks.every(Boolean), detail: `Europe centre ${e.map((v) => v.toFixed(1))}, Africa→Europe ${model.direction('Africa', 'Europe')}, Europe→Asia ${model.direction('Europe', 'Asia')}, checks ${checks.map((c) => (c ? 1 : 0)).join('')}` };
}

// A raised low-poly patch on a sphere: a fan from the centre to the outline, bent to the globe, with a skirt down to the sea.
function landGeo(THREE, ring, centre, R, h, n, closed) {
  const pos = [], D = Math.PI / 180;
  const P = (ll, r) => { const lo = ll[0] * D, la = ll[1] * D; return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const tri = (a, b, c, out) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const d = (uy * vz - uz * vy) * out[0] + (uz * vx - ux * vz) * out[1] + (ux * vy - uy * vx) * out[2];
    if (d >= 0) pos.push(...a, ...b, ...c); else pos.push(...a, ...c, ...b);
  };
  const c0 = P(centre, R), edges = closed ? ring.length : ring.length - 1;
  for (let i = 0; i < edges; i++) {
    const B = ring[i], E = ring[(i + 1) % ring.length];
    const pt = (u, v) => P([centre[0] + (B[0] - centre[0]) * u / n + (E[0] - centre[0]) * v / n, centre[1] + (B[1] - centre[1]) * u / n + (E[1] - centre[1]) * v / n], R + h);
    for (let u = 0; u < n; u++) for (let v = 0; v < n - u; v++) {
      const a = pt(u, v); tri(a, pt(u + 1, v), pt(u, v + 1), a);
      if (u + v < n - 1) tri(pt(u + 1, v), pt(u + 1, v + 1), pt(u, v + 1), a);
    }
    for (let s = 0; s < n; s++) {
      const e0 = mix(B, E, s / n), e1 = mix(B, E, (s + 1) / n), t0 = P(e0, R + h), t1 = P(e1, R + h), b0 = P(e0, R - 0.03), b1 = P(e1, R - 0.03);
      const out = [t0[0] - c0[0], t0[1] - c0[1], t0[2] - c0[2]];
      tri(t0, t1, b1, out); tri(t0, b1, b0, out);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

export default {
  id: 'w07-continents-compass',
  world: 7,
  levels: [1, 2],
  title: 'Compass and Continents',
  goal: 'Find the continent you are asked for on the turning globe, then choose the compass direction for the trip from A to B.',
  kind: 'validated',
  model: 'A stylised cartoon world made of simple shapes: sizes, positions and outlines are only roughly right, and the globe is a perfect ball. The direction of a trip is the larger of its east-west and north-south parts between the two shape centres, which is exact for these shapes. Only trips less than a third of the way round the globe are asked, because further than that you could also travel the other way.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x), D = Math.PI / 180;
    const R = 1.5, G = new THREE.Vector3(-1.2, 2.75, 0), K = new THREE.Vector3(2.2, 2.3, 0.3), easy = ctx.level <= 1, total = 6;
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const onSphere = (lon, lat, r) => new THREE.Vector3(r * Math.cos(lat * D) * Math.sin(lon * D), r * Math.sin(lat * D), r * Math.cos(lat * D) * Math.cos(lon * D));

    // ----- the globe on its stand -----
    const dark = ctx.mat('#5b6470', { metalness: 0.4, roughness: 0.45 }), wood = ctx.mat('#9a6a3c');
    add(new THREE.CylinderGeometry(0.75, 0.9, 0.22, 24), wood, G.x, 0.11, 0);
    add(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 10), dark, G.x, 0.62, 0);
    const arc = add(new THREE.TorusGeometry(R + 0.2, 0.045, 8, 36, Math.PI), dark, G.x, G.y, 0); arc.rotation.order = 'YZX'; arc.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    add(new THREE.CylinderGeometry(0.04, 0.04, 2 * R + 0.44, 8), dark, G.x, G.y, 0);
    const globe = new THREE.Group(); globe.position.copy(G); group.add(globe);
    const ocean = add(new THREE.SphereGeometry(R, 36, 24), ctx.mat('#2a6fb0', { roughness: 0.5 }), 0, 0, 0, globe);
    const eq = add(new THREE.TorusGeometry(R + 0.012, 0.012, 6, 64), ctx.mat('#cfe8ff'), 0, 0, 0, globe); eq.rotation.x = Math.PI / 2; eq.castShadow = false;
    const lands = {}, tags = {}, pop = {};
    for (const n of NAMES) {
      let geo;
      if (n === 'Antarctica') { const ring = []; for (let lo = 0; lo <= 360; lo += 30) ring.push([lo, ANT_LAT]); geo = landGeo(THREE, ring, [0, -90], R, 0.1, 3, false); }
      else { const c = cen(n); geo = landGeo(THREE, C[n].p.map(([x, y]) => [lonOf(x), latOf(y)]), [lonOf(c[0]), latOf(c[1])], R, 0.09, 4, true); }
      lands[n] = add(geo, ctx.mat(C[n].col, { flatShading: true, side: THREE.DoubleSide, roughness: 0.85 }), 0, 0, 0, globe); pop[n] = 0;
      const [lon, lat] = model.aim(n), tag = ctx.sprite(t(n), { size: 0.3, bg: 'rgba(14,18,48,.72)' });
      tag.position.copy(onSphere(lon, n === 'Antarctica' ? -84 : lat, R + 0.42)); tag.visible = false; globe.add(tag); tags[n] = tag;
      ctx.onTap(lands[n], () => pick(n));
    }
    ctx.onTap(ocean, () => { if (q && q.type === 'find' && !locked) ctx.say('That is ocean. Try again!'); });
    // markers for the two ends of a trip, and the little traveller that makes it
    const pinMat = ctx.mat('#1c2233'), pins = ['A', 'B'].map((letter) => {
      const g = new THREE.Group(); add(new THREE.SphereGeometry(0.13, 12, 8), pinMat, 0, 0, 0, g);
      const s = ctx.sprite(letter, { size: 0.34, bg: 'rgba(14,18,48,.8)' }); s.position.set(0, 0.3, 0); g.add(s); g.visible = false; globe.add(g); return g;
    });
    const traveller = add(new THREE.SphereGeometry(0.1, 12, 8), ctx.lit('#ffe07a', 1.4), 0, 0, 0, globe); traveller.visible = false;
    // the pointer the panel moves: a ring that floats in front of the globe
    const pointer = add(new THREE.TorusGeometry(0.17, 0.035, 8, 20), ctx.lit('#ffffff', 0.9), 0, 0, 0); pointer.castShadow = false;

    // ----- the compass -----
    add(new THREE.CylinderGeometry(0.45, 0.6, 0.18, 20), wood, K.x, 0.09, K.z);
    add(new THREE.CylinderGeometry(0.07, 0.1, K.y - 0.8, 10), dark, K.x, (K.y - 0.8) / 2 + 0.1, K.z);
    const compass = new THREE.Group(); compass.position.copy(K); group.add(compass);
    add(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 36), ctx.mat('#f4ead8'), 0, 0, 0, compass).rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(0.7, 0.06, 8, 36), ctx.mat('#c9a34a', { metalness: 0.6, roughness: 0.35 }), 0, 0, 0.04, compass);
    const needle = new THREE.Group(); needle.position.z = 0.11; compass.add(needle);
    const red = add(new THREE.ConeGeometry(0.09, 0.5, 4), ctx.mat('#e0463c'), 0, 0.25, 0, needle); red.scale.z = 0.4;
    const white = add(new THREE.ConeGeometry(0.09, 0.5, 4), ctx.mat('#ffffff'), 0, -0.25, 0, needle); white.scale.z = 0.4; white.rotation.z = Math.PI;
    add(new THREE.SphereGeometry(0.07, 10, 8), dark, 0, 0, 0.03, needle);
    const way = new THREE.Group(); way.position.z = 0.2; way.visible = false; compass.add(way);
    add(new THREE.BoxGeometry(0.1, 0.4, 0.05), ctx.lit('#ffd23c', 0.9), 0, 0.2, 0, way); add(new THREE.ConeGeometry(0.17, 0.26, 4), ctx.lit('#ffd23c', 0.9), 0, 0.5, 0, way).scale.z = 0.4;
    const coneMat = ctx.mat('#1b9c5a', { flatShading: true }), cones = {};
    DIRS.forEach((d, i) => {
      const a = -i * Math.PI / 2, cone = add(new THREE.ConeGeometry(0.22, 0.36, 5), coneMat, -Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0, compass); cone.rotation.z = a; cones[d] = cone;
      const s = ctx.sprite(d[0].toUpperCase(), { size: 0.26 }); s.position.set(-Math.sin(a) * 0.48, Math.cos(a) * 0.48, 0.16); compass.add(s);
      ctx.onTap(cone, () => answerDir(d));
    });

    // ----- the questions -----
    let q = null, score = 0, asked = 0, locked = true, done = false, wait = 0, auto = false, autoT = 0;
    let frontLon = 0, ptrLat = 0, spin = 0, wayTo = 0, trip = null, bump = {};
    const rQ = ui.readout('Question'), rP = ui.readout('Pointer at'), rS = ui.readout('Score');
    const ll = (lat, lon) => `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(Math.round(lon))}°${lon >= 0 ? 'E' : 'W'}`;
    const showPtr = () => { pointer.position.copy(G).add(onSphere(0, ptrLat, R + 0.16)); pointer.rotation.x = -ptrLat * D; rP.set(ll(ptrLat, frontLon)); };
    const turnS = ui.slider({ label: 'Turn the globe', min: -180, max: 180, step: 5, value: 0, unit: '°', onInput: (v) => { frontLon = +v; showPtr(); } });
    const tiltS = ui.slider({ label: 'Move the pointer up or down', min: -75, max: 75, step: 5, value: 0, unit: '°', onInput: (v) => { ptrLat = +v; showPtr(); } });
    const setAim = (lon, lat) => { frontLon = lon; ptrLat = lat; turnS.set?.(lon); tiltS.set?.(lat); showPtr(); };
    ui.button('Pick the land under the pointer', () => pickFront(), 'btn');
    for (const d of DIRS) ui.button(d[0].toUpperCase() + d.slice(1), () => answerDir(d), 'btn');
    ui.button('Start again', () => { if (!done) { score = 0; asked = 0; newQ(); } }, 'btn ghost');
    ui.note('On a globe, north is toward the top, south toward the bottom, east is to the right and west to the left. The red end of the compass needle always points north.');

    function newQ() {
      for (const n of NAMES) tags[n].visible = false;
      pins[0].visible = pins[1].visible = false; traveller.visible = false; way.visible = false; trip = null;
      const a = NAMES[Math.floor(ctx.rng() * NAMES.length) % NAMES.length];
      if (asked % 2 === 0 || a === 'Antarctica') {
        q = { type: 'find', a };
        rQ.set(`${asked + 1}/${total}: ${t('Find')} ${t(a)}`);
        ctx.say(`Find ${a}. Turn the globe and tap it, or put the pointer on it.`);
      } else {
        const others = NAMES.filter((n) => n !== 'Antarctica' && model.clear(a, n)), b = others[Math.floor(ctx.rng() * others.length) % others.length];
        q = { type: 'dir', a, b, ans: model.direction(a, b) };
        [a, b].forEach((n, i) => { const c = cen(n); pins[i].position.copy(onSphere(lonOf(c[0]), latOf(c[1]), R + 0.22)); pins[i].visible = true; tags[n].visible = easy; });
        rQ.set(`${asked + 1}/${total}: ${t('Which way from')} A (${t(a)}) ${t('to')} B (${t(b)})?`);
        if (easy) setAim(Math.round((lonOf(cen(a)[0]) + lonOf(cen(b)[0])) / 10) * 5, ptrLat);
        ctx.say(easy ? `Which way do you travel from A (${a}) to B (${b})? Tap a green arrow on the compass.` : `Turn the globe until you can see A (${a}) and B (${b}). Which way is the trip from A to B?`);
      }
      rS.set(`${score}/${asked}`); locked = false; autoT = 0;
    }
    function result(ok, why) {
      if (locked) return; locked = true; asked++; if (ok) score++;
      rS.set(`${score}/${asked}`); ctx.say(why);
      if (asked >= total) {
        if (!done) { done = true; rQ.set(t('All done!')); ctx.complete(score / total, `Found continents and used compass directions: ${score}/${total}.`); }
      } else wait = 1.6;
    }
    function pick(n) {
      if (!q || locked) return;
      if (q.type !== 'find') { ctx.say(`That is ${n}. For this question use the compass arrows.`); return; }
      tags[n].visible = true; bump[n] = 1;
      const ok = n === q.a; if (!ok) { tags[q.a].visible = true; bump[q.a] = 1; }
      result(ok, ok ? `Yes! That is ${n}. A continent is one of the seven great pieces of land on Earth.` : `That is ${n}. ${q.a} is the shape that is jumping now, so look where it sits on the globe.`);
    }
    function pickFront() {
      if (!q || locked) return;
      const n = model.at(frontLon, ptrLat);
      if (!n) { ctx.say(q.type === 'find' ? 'That is ocean. Try again!' : 'For this question use the compass arrows.'); return; }
      pick(n);
    }
    function answerDir(d) {
      if (!q || locked) return;
      if (q.type !== 'dir') { ctx.say('The compass is for the next question. First find the continent on the globe.'); return; }
      const ok = d === q.ans, ca = cen(q.a), cb = cen(q.b);
      wayTo = -DIRS.indexOf(q.ans) * Math.PI / 2; way.visible = true;
      trip = { from: onSphere(lonOf(ca[0]), latOf(ca[1]), 1), to: onSphere(lonOf(cb[0]), latOf(cb[1]), 1), k: 0 }; traveller.visible = true;
      const why = q.ans === 'north' || q.ans === 'south' ? `B is much further ${q.ans} than it is east or west, and ${q.ans} is toward the ${q.ans === 'north' ? 'top' : 'bottom'} of the globe.` : `B is much further ${q.ans} than it is north or south, and ${q.ans} is to the ${q.ans === 'east' ? 'right' : 'left'} when north is up.`;
      result(ok, (ok ? 'Correct! ' : `It is ${q.ans}. `) + `Watch the yellow light travel from ${q.a} to ${q.b}. ${why}`);
    }

    showPtr(); newQ();
    const v = new THREE.Vector3();
    return {
      step(dt) {
        if (wait > 0) { wait -= dt; if (wait <= 0 && !done) newQ(); }
        if (auto && !locked && !done && q) {
          autoT += dt;
          if (autoT > 0.5) { if (q.type === 'find') { setAim(...model.aim(q.a)); pickFront(); } else answerDir(q.ans); }
        }
      },
      frame(dt, time) {
        const k = ctx.calm ? 1 : Math.min(1, dt * 5);
        let d = -frontLon * D - spin; d = Math.atan2(Math.sin(d), Math.cos(d)); spin += d * k; globe.rotation.y = spin;
        needle.rotation.z = ctx.calm ? 0 : Math.sin(time * 2.1) * 0.06 * (1 + Math.min(2, Math.abs(d) * 4));
        if (way.visible) { let w = wayTo - way.rotation.z; w = Math.atan2(Math.sin(w), Math.cos(w)); way.rotation.z += w * k; }
        for (const n of NAMES) { if (bump[n] > 0) bump[n] = Math.max(0, bump[n] - dt * 0.8); lands[n].scale.setScalar(1 + 0.07 * Math.abs(Math.sin((bump[n] || 0) * Math.PI * 3)) * (bump[n] ? 1 : 0)); }
        pointer.scale.setScalar(1 + (ctx.calm ? 0 : 0.08 * Math.sin(time * 4)));
        if (trip) {
          trip.k = Math.min(1, trip.k + dt / 1.3);
          v.copy(trip.from).lerp(trip.to, trip.k).normalize().multiplyScalar(R + 0.3 + 0.25 * Math.sin(trip.k * Math.PI)); traveller.position.copy(v);
        }
      },
      autoplay() { auto = true; autoT = 0; },
      dispose() { group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); else if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); },
    };
  },
};
