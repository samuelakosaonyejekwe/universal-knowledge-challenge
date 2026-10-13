// World 16 — Folktale Journey in 3D: a turning globe above a ring of six little story stages.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

// Six widely shared folktales, retold very briefly, each with the people who tell it. [latitude, longitude] in degrees.
export const STOPS = [
  { id: 'anansi', continent: 'Africa', place: 'Ghana, West Africa', at: [6.7, -1.6], icon: '🕷️', title: 'How Anansi Won the Stories', base: '#d9a05b',
    teller: 'the Akan (Asante) people of Ghana', hero: ['🕷️', 'a spider'], decoys: [['🦁', 'a lion'], ['🐘', 'an elephant']],
    tale: 'Long ago every story belonged to Nyame, the sky god. Anansi the spider asked to buy them, and Nyame named a price no one had ever paid: bring me the hornets, the python and the leopard. Anansi was small, but he caught each one with a clever trick, and Nyame kept his word. That is why stories are called Anansesem, "spider stories".',
    idea: 'A small character wins by thinking, not by strength.' },
  { id: 'monkey', continent: 'Asia', place: 'India, South Asia', at: [25.3, 83.0], icon: '🐒', title: 'The Monkey and the Crocodile', base: '#e8b04a',
    teller: 'storytellers of India, in the ancient Panchatantra', hero: ['🐒', 'a monkey'], decoys: [['🐅', 'a tiger'], ['🦚', 'a peacock']],
    tale: 'A monkey shared the sweet fruit of his tree with a crocodile every day. One day the crocodile offered him a ride across the river, and halfway over admitted it was a trap. "What a pity," said the monkey calmly, "I left my heart at home in the tree. Take me back for it." The crocodile turned round, and the monkey leapt to safety.',
    idea: 'Staying calm and thinking fast can get you out of trouble.' },
  { id: 'bremen', continent: 'Europe', place: 'Germany, Europe', at: [53.1, 8.8], icon: '🐓', title: 'The Bremen Town Musicians', base: '#9fb4d9',
    teller: 'German storytellers, written down by the Brothers Grimm', hero: ['🐓', 'a rooster and three friends'], decoys: [['👑', 'a king'], ['🐺', 'a wolf']],
    tale: 'A donkey, a dog, a cat and a rooster were thought too old to work, so they set off for the town of Bremen to become musicians. At night they found a house full of robbers. They climbed on one another\'s backs and sang all at once. The noise was so strange that the robbers ran away, and the four friends made the house their home.',
    idea: 'Friends who work together can do what none could do alone.' },
  { id: 'raven', continent: 'North America', place: 'Pacific Northwest Coast, North America', at: [53.0, -132.0], icon: '🐦', title: 'Raven Brings the Light', base: '#7fb0a0',
    teller: 'the Haida, Tlingit and Tsimshian peoples', hero: ['🐦', 'a raven'], decoys: [['🐻', 'a bear'], ['🦌', 'a deer']],
    tale: 'In the beginning the world was dark, because an old man kept all the light shut in a box. Raven, the clever trickster, changed his shape to get into the house. When the box was opened at last, Raven took the light and flew up through the smoke hole, and so the sun, the moon and the stars came into the sky. Each nation and family tells this story in its own way.',
    idea: 'A trickster changes the world for everyone.' },
  { id: 'hummingbird', continent: 'South America', place: 'The Andes, South America', at: [-13.5, -72.0], icon: '🌺', title: 'The Hummingbird and the Fire', base: '#7ac77a',
    teller: 'the Quechua people of the Andes', hero: ['🐦', 'a hummingbird'], decoys: [['🐆', 'a jaguar'], ['🦙', 'a llama']],
    tale: 'A great fire broke out in the forest, and all the animals fled to the river. Only the tiny hummingbird flew back and forth, carrying one drop of water in her beak each time. "What do you think you are doing?" asked the big animals. "I am doing what I can," said the hummingbird.',
    idea: 'Everyone can do their part, however small.' },
  { id: 'maui', continent: 'Oceania', place: 'Aotearoa New Zealand, Oceania', at: [-39.3, 175.6], icon: '🎣', title: 'Māui Fishes Up the Land', base: '#5aa9e6',
    teller: 'the Māori of Aotearoa New Zealand', hero: ['🎣', 'a young fisherman'], decoys: [['🦈', 'a shark'], ['🐋', 'a whale']],
    tale: 'Māui\'s older brothers would not take him fishing, so he hid in their canoe. Far out at sea he let down a magic hook handed down from his ancestor, and pulled with all his might. Up came a giant fish, which became the North Island: Te Ika-a-Māui, "the fish of Māui". Tales of Māui are told right across the Pacific, from Hawaiʻi to Tonga.',
    idea: 'A daring hero explains how the land itself came to be.' },
];
const LAND = [ // very rough outlines, [longitude, latitude]
  [[-165, 65], [-125, 70], [-95, 72], [-60, 55], [-78, 25], [-97, 17], [-83, 9], [-105, 22], [-125, 40], [-165, 58]],
  [[-80, 10], [-60, 10], [-35, -7], [-55, -35], [-70, -54], [-75, -20], [-81, -5]],
  [[-10, 36], [-9, 43], [0, 50], [5, 60], [25, 70], [40, 66], [40, 45], [27, 37], [10, 44], [0, 38]],
  [[-17, 15], [-6, 35], [10, 37], [32, 31], [43, 11], [51, 11], [40, -15], [32, -28], [20, -35], [13, -10], [9, 4], [-8, 5]],
  [[40, 45], [40, 66], [70, 73], [110, 75], [170, 68], [140, 50], [122, 30], [108, 12], [100, 3], [95, 18], [80, 8], [70, 22], [57, 25], [45, 13], [35, 30], [27, 37]],
  [[114, -22], [131, -12], [142, -11], [153, -27], [146, -39], [131, -32], [115, -34]],
  [[173, -35], [178, -38], [174, -41], [168, -46], [171, -41]],
];
const RAD = Math.PI / 180;
// Great-circle distance on a sphere of radius 6371 km (haversine formula).
export function km([la1, lo1], [la2, lo2]) {
  const a = Math.sin(((la2 - la1) * RAD) / 2) ** 2 + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * Math.sin(((lo2 - lo1) * RAD) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
// A place on the unit globe: longitude 0 faces +Z, north is +Y.
export const unit = ([lat, lon]) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
// A point on the great circle from a to b (both unit vectors), f from 0 to 1.
export function along(a, b, f) {
  const w = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), s = Math.sin(w);
  if (s < 1e-6) return a.slice();
  const p = Math.sin((1 - f) * w) / s, q = Math.sin(f * w) / s;
  return [p * a[0] + q * b[0], p * a[1] + q * b[1], p * a[2] + q * b[2]];
}

export function selfTest() {
  const quarter = km([0, 0], [0, 90]), half = km([90, 0], [-90, 0]), same = km(STOPS[0].at, STOPS[0].at);
  // the same distance from the angle between the two places (a different formula)
  const a = unit(STOPS[0].at), b = unit(STOPS[1].at), angle = Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 6371, hav = km(STOPS[0].at, STOPS[1].at);
  const mid = along(a, b, 0.5), midLen = Math.hypot(...mid);
  const ok = Math.abs(quarter - 10007.54) < 0.01 && Math.abs(half - 20015.09) < 0.01 && same === 0 && Math.abs(angle - hav) < 0.5 && hav > 8500 && hav < 9500 && Math.abs(midLen - 1) < 1e-9
    && STOPS.length === 6 && new Set(STOPS.map((s) => s.teller)).size === 6 && STOPS.every((s) => s.decoys.length === 2);
  return { ok, detail: `quarter of the equator ${quarter.toFixed(1)} km (10007.5), pole to pole ${half.toFixed(1)} km (20015.1), Ghana to India ${hav.toFixed(0)} km by haversine and ${angle.toFixed(0)} km by angle` };
}

function fuse(THREE, parts) {
  const pos = [], nor = [], tint = [], c = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [geo, colour, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m.compose(new THREE.Vector3(...p), q.setFromEuler(e.set(r[0], r[1], r[2], r[3] || 'XYZ')), new THREE.Vector3(...s)));
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
  id: 'w16-folktales',
  world: 16,
  levels: [3, 4],
  title: 'Folktale Journey',
  goal: 'Travel to six parts of the world, hear a folktale in each, and collect its token by naming the people who tell it.',
  kind: 'validated',
  model: 'A globe with six story stops at their real latitude and longitude. The length of each hop is the great-circle distance on a perfectly round Earth of radius 6371 km (haversine formula), and the lantern flies along that great circle. Each tale is squeezed into a few sentences, and every folktale has many versions: the people named here tell them far more richly, and some tales are shared by several peoples. The land on the globe is a rough sketch and the little stages are toy scenes, not pictures of real places.',
  mount(ctx) {
    const { THREE, group, ui, level } = ctx, t = ctx.t || ((x) => x), calm = !!ctx.calm;
    const R = 0.95, GY = 3.45, RING = 1.9, FRONT = 1.9;
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s), cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s), ball = (r, a = 12, b = 8) => new THREE.SphereGeometry(r, a, b);
    const torus = (r, tube, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, 5, 14, arc);
    const paint = ctx.mat('#ffffff', { vertexColors: true, roughness: 0.8 }), gold = ctx.lit('#ffc55c', 1.5), white = ctx.lit('#ffffff', 1.1), green = ctx.lit('#7be0a8', 1.4);
    const H = Math.PI / 2;

    // ----- the stand and the globe -----
    const stand = new THREE.Mesh(fuse(THREE, [[cyl(0.1, 0.16, 2.3), '#4a3f5c', [0, 1.15, 0]], [cyl(0.5, 0.6, 0.12, 20), '#4a3f5c', [0, 0.14, 0]], [torus(R + 0.12, 0.03), '#8a5a3a', [0, GY, 0], [0, H, 0]], [cyl(0.05, 0.05, 0.3), '#8a5a3a', [0, GY - R - 0.2, 0]]]), paint);
    group.add(stand);
    const globe = new THREE.Group(); globe.position.set(0, GY, 0); group.add(globe);
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), ctx.mat('#3b6fd4', { roughness: 0.55 })));
    const land = LAND.map((poly) => {
      const lons = poly.map((p) => p[0]), lats = poly.map((p) => p[1]);
      const lon = (Math.min(...lons) + Math.max(...lons)) / 2, lat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const sx = Math.min(0.6, Math.max(0.12, R * (Math.max(...lons) - Math.min(...lons)) * RAD * Math.cos(lat * RAD) / 2)), sy = Math.min(0.6, Math.max(0.12, R * (Math.max(...lats) - Math.min(...lats)) * RAD / 2));
      const u = unit([lat, lon]), d = R - 0.26;
      return [ball(1, 16, 10), '#3f9f6a', [u[0] * d, u[1] * d, u[2] * d], [-lat * RAD, lon * RAD, 0, 'YXZ'], [sx, sy, 0.3]];
    });
    globe.add(new THREE.Mesh(fuse(THREE, land), paint));
    const pins = STOPS.map((s) => { const p = new THREE.Mesh(ball(0.075), white), u = unit(s.at); p.position.set(u[0] * (R + 0.05), u[1] * (R + 0.05), u[2] * (R + 0.05)); globe.add(p); return p; });
    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), gold); globe.add(lantern);
    const halo = ctx.glow('#ffc55c', 0.7, 0.8); lantern.add(halo);
    const MAXP = 400, trailPos = new Float32Array(MAXP * 3), trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffd866 })); trail.frustumCulled = false; globe.add(trail);
    let trailN = 0;

    // ----- the ring of six stages -----
    const ring = new THREE.Group(); group.add(ring);
    ring.add(new THREE.Mesh(fuse(THREE, [[cyl(2.48, 2.48, 0.08, 40), '#8a5a3a', [0, 0.04, 0]], [torus(RING, 0.03), '#f4ead8', [0, 0.09, 0], [H, 0, 0]]]), paint));
    const scenery = {
      anansi: [[cyl(0.04, 0.06, 0.6), '#7a5230', [-0.3, 0.46, -0.15]], [ball(0.26), '#4f9a4a', [-0.3, 0.84, -0.15], [0, 0, 0], [1.3, 0.5, 1.3]], [torus(0.22, 0.012), '#f4ead8', [0.2, 0.62, -0.25]], [torus(0.11, 0.012), '#f4ead8', [0.2, 0.62, -0.25]],
        [box(0.44, 0.012, 0.012), '#f4ead8', [0.2, 0.62, -0.25], [0, 0, 0.78]], [box(0.44, 0.012, 0.012), '#f4ead8', [0.2, 0.62, -0.25], [0, 0, -0.78]], [box(0.18, 0.16, 0.18), '#c2553f', [0.32, 0.24, 0.2]], [box(0.2, 0.03, 0.2), '#ffc55c', [0.32, 0.335, 0.2]]],
      monkey: [[cyl(0.5, 0.5, 0.02, 20), '#3b8bdb', [0.08, 0.17, 0.1], [0, 0, 0], [1, 1, 0.62]], [cyl(0.04, 0.06, 0.7), '#7a5230', [-0.33, 0.51, -0.22]], [ball(0.27), '#3f9f4a', [-0.33, 0.95, -0.22]], [ball(0.05), '#e8452c', [-0.2, 0.84, -0.05]], [ball(0.05), '#e8452c', [-0.43, 0.8, -0.03]],
        [box(0.46, 0.08, 0.15), '#4f8a3a', [0.08, 0.22, 0.15]], [box(0.2, 0.05, 0.11), '#4f8a3a', [0.38, 0.21, 0.15]], [box(0.2, 0.04, 0.06), '#4f8a3a', [-0.22, 0.2, 0.15]]],
      bremen: [[box(0.4, 0.4, 0.3), '#f1e3c8', [-0.24, 0.36, -0.2]], [cone(0.34, 0.24, 4), '#c2553f', [-0.24, 0.68, -0.2], [0, Math.PI / 4, 0]], [box(0.12, 0.12, 0.02), '#ffd866', [-0.24, 0.4, -0.045]], [cone(0.12, 0.4), '#2f6f5e', [0.38, 0.36, -0.28]], [box(0.5, 0.012, 0.16), '#bfae8c', [0.15, 0.166, 0.3]]],
      raven: [[box(0.46, 0.34, 0.3), '#8a5a3a', [-0.22, 0.33, -0.2]], [box(0.3, 0.04, 0.36), '#5b4a36', [-0.35, 0.56, -0.2], [0, 0, 0.45]], [box(0.3, 0.04, 0.36), '#5b4a36', [-0.09, 0.56, -0.2], [0, 0, -0.45]], [box(0.18, 0.16, 0.18), '#5b4a36', [0.26, 0.24, 0.2]], [box(0.2, 0.03, 0.2), '#3a2f24', [0.26, 0.38, 0.12], [-0.9, 0, 0]],
        [cone(0.11, 0.5), '#2f6f5e', [0.38, 0.41, -0.3]]],
      hummingbird: [[cone(0.16, 0.5), '#2f7f4f', [-0.32, 0.41, -0.22]], [cone(0.14, 0.42), '#3f9f5a', [-0.06, 0.37, -0.33]], [cone(0.15, 0.46), '#2f7f4f', [0.3, 0.39, -0.26]], [cone(0.09, 0.24, 5), '#ff9f43', [-0.26, 0.28, 0.08]], [cone(0.06, 0.16, 5), '#ffd866', [-0.2, 0.24, 0.14]],
        [cyl(0.24, 0.24, 0.02, 16), '#3b8bdb', [0.28, 0.17, 0.22], [0, 0, 0], [1, 1, 0.7]]],
      maui: [[cyl(0.52, 0.52, 0.03, 20), '#2f7fd0', [0, 0.175, 0]], [box(0.46, 0.08, 0.14), '#8a5a3a', [-0.12, 0.24, 0.12]], [box(0.1, 0.14, 0.04), '#8a5a3a', [-0.38, 0.3, 0.12], [0, 0, 0.5]], [ball(0.2), '#4fae5a', [0.24, 0.2, -0.22], [0, 0, 0], [1.4, 0.5, 0.9]],
        [cone(0.07, 0.14, 4), '#4fae5a', [0.5, 0.22, -0.22], [0, 0, -H]]],
    };
    const heroes = {
      anansi: [[ball(0.12), '#3a2a4a', [0, 0.34, 0.14]], [ball(0.08), '#3a2a4a', [0, 0.39, 0.27]], [ball(0.022), '#ffffff', [-0.03, 0.42, 0.34]], [ball(0.022), '#ffffff', [0.03, 0.42, 0.34]], ...[-0.9, -0.3, 0.3, 0.9].map((a) => [box(0.5, 0.025, 0.025), '#3a2a4a', [0, 0.29, 0.14], [0, a, 0]])],
      monkey: [[ball(0.11), '#8a5a3a', [0.05, 0.37, 0.15]], [ball(0.085), '#8a5a3a', [0.05, 0.53, 0.15]], [ball(0.05), '#e8c9a0', [0.05, 0.52, 0.21]], [ball(0.035), '#8a5a3a', [-0.04, 0.57, 0.15]], [ball(0.035), '#8a5a3a', [0.14, 0.57, 0.15]], [torus(0.07, 0.015, Math.PI), '#8a5a3a', [-0.1, 0.4, 0.15]]],
      bremen: [[box(0.32, 0.18, 0.16), '#9a9aa5', [0.2, 0.3, 0.12]], [box(0.1, 0.13, 0.1), '#9a9aa5', [0.4, 0.42, 0.12]], [box(0.03, 0.1, 0.03), '#9a9aa5', [0.4, 0.53, 0.09]], [box(0.03, 0.1, 0.03), '#9a9aa5', [0.4, 0.53, 0.15]], ...[[0.08, 0.07], [0.08, 0.17], [0.32, 0.07], [0.32, 0.17]].map(([x, z]) => [box(0.04, 0.06, 0.04), '#77778a', [x, 0.19, z]]),
        [box(0.24, 0.13, 0.13), '#8a5a3a', [0.2, 0.455, 0.12]], [box(0.09, 0.09, 0.09), '#8a5a3a', [0.34, 0.52, 0.12]], [box(0.18, 0.1, 0.11), '#e89b3c', [0.2, 0.57, 0.12]], [box(0.08, 0.08, 0.08), '#e89b3c', [0.3, 0.63, 0.12]], [ball(0.07), '#ffffff', [0.2, 0.69, 0.12]], [box(0.03, 0.05, 0.02), '#e8452c', [0.2, 0.78, 0.12]], [cone(0.02, 0.06), '#ffc55c', [0.28, 0.7, 0.12], [0, 0, -H]]],
      raven: [[ball(0.11), '#22223a', [0.2, 0.78, 0.2], [0, 0, 0], [1.4, 1, 1]], [ball(0.07), '#22223a', [0.37, 0.83, 0.2]], [cone(0.03, 0.1), '#22223a', [0.47, 0.83, 0.2], [0, 0, -H]], [box(0.14, 0.02, 0.5), '#2f2f4f', [0.2, 0.82, 0.2]], [box(0.12, 0.02, 0.1), '#22223a', [0.02, 0.8, 0.2]], [ball(0.07), '#ffd866', [0.56, 0.8, 0.2]]],
      hummingbird: [[ball(0.075), '#2ec4b6', [0.06, 0.72, 0.16], [0, 0, 0], [1.3, 1, 1]], [ball(0.05), '#d6336c', [0.16, 0.77, 0.16]], [cyl(0.008, 0.008, 0.14, 5), '#3a2f24', [0.27, 0.77, 0.16], [0, 0, H]], [box(0.03, 0.16, 0.09), '#8ce0d6', [0.05, 0.8, 0.22], [0.6, 0, 0]], [box(0.03, 0.16, 0.09), '#8ce0d6', [0.05, 0.8, 0.1], [-0.6, 0, 0]], [ball(0.04), '#74c0fc', [0.36, 0.74, 0.16]]],
      maui: [[cyl(0.05, 0.06, 0.2), '#c97b4a', [-0.12, 0.38, 0.12]], [ball(0.065), '#c97b4a', [-0.12, 0.54, 0.12]], [ball(0.067), '#2a2018', [-0.12, 0.56, 0.11], [0, 0, 0], [1, 0.7, 1]], [cyl(0.01, 0.01, 0.52, 5), '#5b4a36', [0.08, 0.62, 0.12], [0, 0, -1.0]], [cyl(0.004, 0.004, 0.24, 4), '#f4ead8', [0.3, 0.64, 0.12]],
        [torus(0.05, 0.014, Math.PI), '#f4ead8', [0.3, 0.5, 0.12], [0, 0, Math.PI]]],
    };
    const stages = STOPS.map((s, i) => {
      const a = (i / STOPS.length) * Math.PI * 2, g = new THREE.Group(); g.position.set(Math.sin(a) * RING, 0.08, Math.cos(a) * RING); g.rotation.y = a; ring.add(g);
      const base = new THREE.Mesh(fuse(THREE, [[cyl(0.56, 0.6, 0.16, 24), s.base, [0, 0.08, 0]], [torus(0.56, 0.025, Math.PI), '#4a3f5c', [0, 0.16, -0.3]], ...scenery[s.id]]), paint); g.add(base);
      const hero = new THREE.Mesh(fuse(THREE, heroes[s.id]), paint); hero.scale.setScalar(0.001); hero.visible = false; g.add(hero);
      const medal = new THREE.Mesh(cyl(0.15, 0.15, 0.05, 16), gold); medal.rotation.x = H; medal.position.set(0, 0.2, 0.62); medal.visible = false; g.add(medal);
      const label = ctx.sprite(s.icon, { size: 0.52, label: t(s.continent) }); label.position.set(0, 1.45, 0); g.add(label);
      return { s, i, a, g, base, hero, medal, label, shown: 0 };
    });

    // ----- three guess cards and the flying token -----
    const cardMat = ctx.mat('#f4ead8', { roughness: 0.7 });
    const cards = [-2.35, 0, 2.35].map((x) => { const m = new THREE.Mesh(box(1, 0.62, 0.1), cardMat); m.position.set(x, 2.02, 2.3); m.scale.setScalar(0.001); m.visible = false; group.add(m); return { m, x, face: null, show: 0, pulse: 0 }; });
    const token = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), gold); token.visible = false; group.add(token);
    const tokenGlow = ctx.glow('#ffc55c', 0.9, 0.8); token.add(tokenGlow);

    // ----- the journey -----
    const byId = Object.fromEntries(stages.map((x) => [x.s.id, x]));
    const stamps = new Set(), firstTry = new Set();
    let cur = null, from = null, phase = 'travel', fly = 1, flyTime = 1, total = 0, wrong = false, done = false, options = [], tokenT = -1, tokenFor = null, auto = false, cool = 0;
    let ringTo = 0, yawTo = 0, tiltTo = 0;
    ui.note('Tap a story stage, or choose a part of the world, to travel there.');
    const first = stages[Math.floor(ctx.rng() * stages.length) % stages.length];       // start at a stop chosen by chance, as the 2D lab does
    const travelC = ui.choice(STOPS.map((s) => [s.id, s.continent]), first.s.id, (v) => go(byId[v]));
    ui.note('Before you hear the tale: tap a card, or choose one here, to guess the hero.');
    const guessC = ui.choice([[0, 'Left card'], [1, 'Middle card'], [2, 'Right card']], '', (v) => guess(+v));
    const scroll = ui.note('The tale will appear here when you have made your guess.');
    ui.note('Which people tell this tale?');
    const tellerC = ui.choice(STOPS.map((s) => [s.id, s.teller]), '', (v) => pickTeller(v));
    const rTokens = ui.readout('Tokens'), rKm = ui.readout('Journey so far'), rHop = ui.readout('Last hop'), rPlace = ui.readout('You are in');
    rTokens.set('0 / 6'); rKm.set('0 km'); rHop.set('0 km');
    const setScroll = (text) => { if (scroll) scroll.textContent = text; };
    const near = (now, to) => now + Math.atan2(Math.sin(to - now), Math.cos(to - now));     // the same angle, reached the short way round
    const shuffled = (arr) => arr.map((x) => [ctx.rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const clearFaces = () => { for (const c of cards) { if (c.face) { group.remove(c.face); c.face.material?.map?.dispose?.(); c.face.material?.dispose?.(); c.face = null; } } };

    function go(st) {
      if (!st || st === cur || fly < 1 || tokenT >= 0) return;
      from = cur; cur = st; phase = 'travel'; wrong = false; clearFaces();
      const hop = from ? km(from.s.at, st.s.at) : 0; total += hop;
      rKm.set(Math.round(total / 100) * 100 + ' km'); rHop.set(Math.round(hop / 100) * 100 + ' km'); rPlace.set(t(st.s.continent));
      ringTo = near(ring.rotation.y, -st.a); yawTo = near(globe.rotation.y, -st.s.at[1] * RAD); tiltTo = st.s.at[0] * RAD;
      flyTime = from ? (calm ? 0.5 : 0.9 + hop / 9000) : 0.3; fly = 0;
      if (from && trailN + 13 <= MAXP) {
        const a = unit(from.s.at), b = unit(st.s.at);
        for (let k = trailN ? 1 : 0; k <= 12; k++) { const p = along(a, b, k / 12), l = Math.hypot(...p) || 1; trailPos.set([p[0] / l * (R + 0.03), p[1] / l * (R + 0.03), p[2] / l * (R + 0.03)], trailN * 3); trailN++; }
        trailGeo.setDrawRange(0, trailN); trailGeo.attributes.position.needsUpdate = true;
      }
      ctx.say(t('Off we go to') + ' ' + t(st.s.place) + (from ? '. ' + t('This hop is about') + ' ' + Math.round(hop / 100) * 100 + ' km.' : '.'));
    }
    function arrive() {
      const s = cur.s;
      if (stamps.has(s.id)) { phase = 'read'; tell(); ctx.say(t('You already have this token. This tale is told by') + ' ' + t(s.teller) + '.'); return; }
      phase = 'guess';
      options = shuffled([s.hero, ...s.decoys]);
      options.forEach(([icon, name], k) => { const f = ctx.sprite(icon, { size: 0.66, label: t(name) }); f.position.set(cards[k].x, 2.02, 2.42); f.visible = false; group.add(f); cards[k].face = f; });
      setScroll('📍 ' + t(s.place) + '. ' + t('Before you hear it: who do you think is the hero of this tale?'));
      ctx.say((from ? '' : t('Folktales were told aloud long before they were written down.') + ' ') + t('Before you hear it: who do you think is the hero of this tale?'));
    }
    function tell() { const s = cur.s; setScroll('📍 ' + t(s.place) + ' — ' + t(s.title) + '. ' + t(s.tale) + ' 💡 ' + t(s.idea)); }
    function guess(k) {
      if (phase !== 'guess' || !options[k]) { if (phase !== 'guess') ctx.say(t('The guessing cards appear when you arrive at a new stage.')); return; }
      const right = options[k][1] === cur.s.hero[1];
      cards[k].pulse = 1; phase = 'read'; tell();
      ctx.say(t(right ? 'Good guess! In folktales the hero is often someone small or unexpected.' : 'A surprise! In folktales the hero is often someone small or unexpected.') + ' ' + t('The hero is') + ' ' + t(cur.s.hero[1]) + '. ' + t('Read the tale, then choose the people who tell it.'));
    }
    function pickTeller(id) {
      if (!cur || fly < 1) return;
      if (phase === 'guess') { ctx.say(t('First guess the hero, then listen to the tale.')); return; }
      if (phase !== 'read' || stamps.has(cur.s.id)) { ctx.say(t('You already have this token. Travel to another stage.')); return; }
      if (id !== cur.s.id) {
        wrong = true;
        ctx.say(t('Not this one. Think about where on the globe you are standing.') + (level <= 3 ? ' ' + t('The lantern is over') + ' ' + t(cur.s.continent) + '.' : ''));
        return;
      }
      stamps.add(id); if (!wrong) firstTry.add(id);
      rTokens.set(stamps.size + ' / 6');
      tokenT = 0; tokenFor = cur; token.visible = true;
      ctx.say(t('Token collected! This tale is told by') + ' ' + t(cur.s.teller) + '. ' + t(cur.s.idea));
    }
    function finish() {
      if (done || stamps.size < STOPS.length) return;
      done = true;
      ctx.say(t('You have heard a tale from six parts of the world, travelling about') + ' ' + Math.round(total / 1000) * 1000 + ' km. ' + t('Small, clever or brave heroes turn up everywhere: people far apart tell stories about the same hopes.'));
      ctx.complete(Math.max(0.4, firstTry.size / STOPS.length), 'Toured six folktales and named the peoples who tell them.');
    }

    for (const st of stages) { ctx.onTap(st.base, () => (travelC.set ? travelC.set(st.s.id) : go(st))); ctx.onTap(st.hero, () => (travelC.set ? travelC.set(st.s.id) : go(st))); }
    cards.forEach((c, k) => ctx.onTap(c.m, () => guess(k)));

    ring.rotation.y = -first.a; globe.rotation.y = -first.s.at[1] * RAD; globe.rotation.x = first.s.at[0] * RAD;
    { const u = unit(first.s.at); lantern.position.set(u[0] * (R + 0.2), u[1] * (R + 0.2), u[2] * (R + 0.2)); }
    go(first);
    ctx.say('Folktales were told aloud long before they were written down. Guess the hero, listen, then name the people who tell the tale.');

    return {
      step(dt) {
        if (fly < 1) {
          fly = Math.min(1, fly + dt / flyTime);
          const a = unit((from || cur).s.at), b = unit(cur.s.at), e = fly * fly * (3 - 2 * fly), p = along(a, b, e), l = Math.hypot(...p) || 1, h = R + 0.2 + (from ? 0.35 * Math.sin(Math.PI * e) : 0);
          lantern.position.set(p[0] / l * h, p[1] / l * h, p[2] / l * h);
          if (fly >= 1) arrive();
        }
        if (tokenT >= 0) {
          tokenT += dt / (calm ? 0.5 : 1.3);
          const e = Math.min(1, tokenT), k = e * e * (3 - 2 * e);
          token.position.set(0, 0.9 + (GY - 0.9) * k + Math.sin(Math.PI * k) * 0.3, FRONT + (R + 0.12 - FRONT) * k); token.scale.setScalar(1 - 0.5 * k);
          if (tokenT >= 1) { tokenT = -1; token.visible = false; pins[tokenFor.i].material = green; tokenFor.medal.visible = true; finish(); }
        }
        if (auto && !done && fly >= 1 && tokenT < 0) {
          cool -= dt;
          if (cool <= 0) {
            cool = 0.4;
            if (phase === 'guess') { const k = options.findIndex((o) => o[1] === cur.s.hero[1]); if (guessC.set) guessC.set(k); else guess(k); }
            else if (phase === 'read' && !stamps.has(cur.s.id)) { if (tellerC.set) tellerC.set(cur.s.id); else pickTeller(cur.s.id); }
            else { const next = stages.find((x) => !stamps.has(x.s.id)); if (next) { if (travelC.set) travelC.set(next.s.id); else go(next); } }
          }
        }
      },
      frame(dt, time) {
        const k = Math.min(1, dt * (calm ? 12 : 4));
        ring.rotation.y += (ringTo - ring.rotation.y) * k; globe.rotation.y += (yawTo - globe.rotation.y) * k; globe.rotation.x += (tiltTo - globe.rotation.x) * k;
        lantern.rotation.y += dt * 2; token.rotation.y += dt * 5;
        for (const st of stages) {
          const on = st === cur && phase === 'read' && fly >= 1 ? 1 : stamps.has(st.s.id) ? 1 : 0;
          st.shown += (on - st.shown) * Math.min(1, dt * 5);
          st.hero.visible = st.shown > 0.02; st.hero.scale.setScalar(Math.max(0.001, st.shown));
          st.hero.position.y = st === cur && !calm ? Math.abs(Math.sin(time * 3)) * 0.07 * st.shown : 0;
          st.medal.rotation.z = time * 1.5;
          pins[st.i].scale.setScalar((pins[st.i].material === green ? 1.5 : 1) * (st === cur && !calm ? 1.25 + 0.25 * Math.sin(time * 5) : 1));
        }
        cards.forEach((c) => {
          const want = phase === 'guess' && fly >= 1 && c.face ? 1 : 0;
          c.show += (want - c.show) * Math.min(1, dt * 7); c.pulse = Math.max(0, c.pulse - dt * 2);
          c.m.visible = c.show > 0.02; c.m.scale.setScalar(Math.max(0.001, c.show * (1 + 0.2 * c.pulse)));
          c.m.position.y = 2.02 + (calm ? 0 : Math.sin(time * 2 + c.x) * 0.04);
          if (c.face) { c.face.visible = c.show > 0.5; c.face.position.y = c.m.position.y; }
        });
      },
      autoplay() { auto = true; cool = 0.2; },
      dispose() { clearFaces(); trailGeo.dispose(); },
    };
  },
};
