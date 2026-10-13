// The animated character: one skinned body driven by a skeleton, blended animation clips, a face that blinks,
// talks and shows feelings, and inverse kinematics for reaching and looking.
// The head, hair and role pieces are the same ones as the storybook portraits (gfx/kit3d.js), so every person
// looks like themselves everywhere in the game. The body is shaped in code, ring by ring, not sculpted by an artist.
import { THREE, character as portrait3d, faceTexture } from '../gfx/kit3d.js';

// name, parent, offset from parent in the rest pose (metres; the character faces +Z and is about 1.65 m tall)
const BONES = [
  ['root', null, 0, 0, 0], ['hips', 'root', 0, 0.6, 0], ['spine', 'hips', 0, 0.13, 0], ['chest', 'spine', 0, 0.14, 0], ['neck', 'chest', 0, 0.17, 0], ['head', 'neck', 0, 0.07, 0],
  ['armL', 'chest', -0.2, 0.12, 0], ['foreL', 'armL', 0, -0.2, 0], ['handL', 'foreL', 0, -0.19, 0],
  ['armR', 'chest', 0.2, 0.12, 0], ['foreR', 'armR', 0, -0.2, 0], ['handR', 'foreR', 0, -0.19, 0],
  ['legL', 'hips', -0.1, -0.05, 0], ['shinL', 'legL', 0, -0.26, 0], ['footL', 'shinL', 0, -0.25, 0],
  ['legR', 'hips', 0.1, -0.05, 0], ['shinR', 'legR', 0, -0.26, 0], ['footR', 'shinR', 0, -0.25, 0],
];
const IDX = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

// ---------- the skinned body ----------
// One continuous mesh shaped ring by ring: neck, collar, shoulders, chest, waist, belt and hem; arms with sleeves,
// cuffs and hands with thumbs; legs, socks and shoes with soles and toe caps. Every vertex is bound to one or two
// bones, so elbows, knees, shoulders and the waist bend smoothly. look: { sex, sleeves: 'short' | 'long' }.
function bodyGeometry(colors, look = {}) {
  const pos = [], col = [], si = [], sw = [], index = [];
  const c = (hex) => new THREE.Color(hex);
  const vert = (x, y, z, color, b0, b1 = b0, w1 = 0) => { pos.push(x, y, z); col.push(color.r, color.g, color.b); si.push(IDX[b0], IDX[b1], 0, 0); sw.push(1 - w1, w1, 0, 0); return pos.length / 3 - 1; };
  // A tube through rings [{ y, rx, rz, b0, b1, w1, color, dz }] centred on (cx, cz), closed at both ends.
  const tube = (cx, cz, rings, seg = 14) => {
    const start = pos.length / 3;
    for (const r of rings) for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; vert(cx + Math.cos(a) * r.rx, r.y, cz + (r.dz || 0) + Math.sin(a) * (r.rz ?? r.rx), r.color, r.b0, r.b1, r.w1); }
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < seg; k++) { const a = start + i * seg + k, b = start + i * seg + (k + 1) % seg, d = a + seg, e = b + seg; index.push(a, b, d, b, e, d); }
    const f = rings[0], l = rings[rings.length - 1];
    const cap0 = vert(cx, f.y, cz + (f.dz || 0), f.color, f.b0, f.b1, f.w1), cap1 = vert(cx, l.y, cz + (l.dz || 0), l.color, l.b0, l.b1, l.w1);
    for (let k = 0; k < seg; k++) { index.push(cap0, start + (k + 1) % seg, start + k); const e = start + (rings.length - 1) * seg; index.push(cap1, e + k, e + (k + 1) % seg); }
  };
  const blob = (x, y, z, rx, ry, rz, color, bone, seg = 12, b1 = bone, w1 = 0) => {
    const start = pos.length / 3, rows = 8;
    for (let i = 0; i <= rows; i++) { const v = (i / rows) * Math.PI; for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; vert(x + Math.sin(v) * Math.cos(a) * rx, y + Math.cos(v) * ry, z + Math.sin(v) * Math.sin(a) * rz, color, bone, b1, w1); } }
    for (let i = 0; i < rows; i++) for (let k = 0; k < seg; k++) { const a = start + i * seg + k, b = start + i * seg + (k + 1) % seg; index.push(a, b, a + seg, b, b + seg, a + seg); }
  };
  const white = colors.outfit === '#ffffff';
  const outfit = c(colors.outfit), dark = c(colors.outfit).offsetHSL(0, 0.02, white ? -0.1 : -0.1), trim = c(colors.outfit).offsetHSL(0, 0, white ? -0.14 : 0.2), skin = c(colors.skin), skinD = c(colors.skin).offsetHSL(0, 0.02, -0.05);
  const legs = c('#2f3566'), belt = c('#27294d'), sock = c('#f4f4fa'), shoe = c('#fafaff'), sole = c('#1d2140'), gold = c('#f5c542');
  const R = (y, rx, rz, color, b0, b1, w1, dz) => ({ y, rx, rz, color, b0, b1, w1, dz });
  const skirt = look.sex === 'f', short = look.sleeves === 'short';
  // neck, collar, shoulders, chest, waist, belt, hem (listed from the top down so the faces point outwards)
  tube(0, 0, [
    R(1.13, 0.05, 0.05, skin, 'neck'), R(1.085, 0.053, 0.052, skin, 'neck'), R(1.06, 0.056, 0.054, skinD, 'neck', 'chest', 0.5),
    R(1.062, 0.088, 0.078, trim, 'chest'), R(1.04, 0.108, 0.09, trim, 'chest'), R(1.03, 0.1, 0.084, outfit, 'chest'),
    R(1.012, 0.165, 0.108, outfit, 'chest'), R(0.985, 0.195, 0.126, outfit, 'chest'), R(0.94, 0.204, 0.137, outfit, 'chest', 'spine', 0.15, 0.004),
    R(0.87, 0.198, 0.138, outfit, 'chest', 'spine', 0.45, 0.004), R(0.8, 0.186, 0.132, outfit, 'spine', 'hips', 0.3), R(0.735, 0.18, 0.128, dark, 'spine', 'hips', 0.6),
    R(0.69, 0.186, 0.133, outfit, 'hips'), R(0.672, 0.194, 0.139, belt, 'hips'), R(0.644, 0.194, 0.139, belt, 'hips'), R(0.636, 0.2, 0.148, outfit, 'hips'),
    ...(skirt ? [R(0.56, 0.235, 0.185, outfit, 'hips'), R(0.47, 0.268, 0.215, outfit, 'hips'), R(0.4, 0.292, 0.238, trim, 'hips'), R(0.39, 0.27, 0.22, dark, 'hips')]
      : [R(0.56, 0.222, 0.168, outfit, 'hips'), R(0.5, 0.232, 0.178, outfit, 'hips'), R(0.474, 0.236, 0.182, trim, 'hips'), R(0.466, 0.212, 0.162, dark, 'hips')]),
  ], 20);
  blob(0, 0.658, 0.142, 0.03, 0.022, 0.012, gold, 'hips', 8);                                         // belt buckle
  for (const y of [0.93, 0.84, 0.76]) blob(0, y, 0.136 + (y > 0.9 ? 0.004 : 0), 0.014, 0.014, 0.008, trim, y > 0.8 ? 'chest' : 'spine', 6);   // buttons
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    const A = 'arm' + side, F = 'fore' + side, H = 'hand' + side, Lg = 'leg' + side, Sh = 'shin' + side, Ft = 'foot' + side, ax = s * 0.2;
    blob(ax - s * 0.008, 0.995, 0, 0.086, 0.082, 0.084, outfit, A, 12, 'chest', 0.45);               // rounded shoulder
    tube(ax, 0, [
      R(1.0, 0.07, 0.07, outfit, A), R(0.95, 0.076, 0.076, outfit, A), R(0.89, 0.07, 0.07, outfit, A),
      ...(short ? [R(0.868, 0.073, 0.073, trim, A), R(0.86, 0.06, 0.06, skinD, A), R(0.83, 0.056, 0.056, skin, A, F, 0.2), R(0.79, 0.055, 0.055, skin, A, F, 0.5), R(0.75, 0.054, 0.054, skin, A, F, 0.8), R(0.68, 0.05, 0.05, skin, F), R(0.625, 0.044, 0.044, skin, F), R(0.61, 0.042, 0.042, skin, F, H, 0.5)]
        : [R(0.83, 0.064, 0.064, outfit, A, F, 0.2), R(0.79, 0.063, 0.063, outfit, A, F, 0.5), R(0.75, 0.061, 0.061, outfit, A, F, 0.8), R(0.67, 0.058, 0.058, outfit, F), R(0.648, 0.066, 0.066, trim, F), R(0.626, 0.066, 0.066, trim, F), R(0.618, 0.046, 0.046, skinD, F, H, 0.5)]),
    ]);
    blob(ax, 0.572, 0.004, 0.05, 0.058, 0.036, skin, H);                                              // palm
    blob(ax, 0.522, 0.008, 0.046, 0.04, 0.03, skin, H);                                               // fingers, gently curled
    blob(ax - s * 0.012, 0.572, 0.04, 0.02, 0.034, 0.02, skin, H, 8);                                 // thumb
    tube(s * 0.1, 0, [R(0.57, 0.096, 0.096, legs, Lg, 'hips', 0.4), R(0.5, 0.094, 0.094, legs, Lg), R(0.4, 0.084, 0.084, legs, Lg), R(0.34, 0.08, 0.08, legs, Lg, Sh, 0.2), R(0.29, 0.078, 0.078, legs, Lg, Sh, 0.5, 0.004), R(0.24, 0.074, 0.074, legs, Lg, Sh, 0.8), R(0.17, 0.07, 0.072, legs, Sh), R(0.135, 0.068, 0.068, legs, Sh), R(0.13, 0.058, 0.058, sock, Sh), R(0.085, 0.056, 0.056, sock, Sh, Ft, 0.5)]);
    blob(s * 0.1, 0.02, 0.04, 0.084, 0.022, 0.142, sole, Ft);                                         // sole
    blob(s * 0.1, 0.058, 0.03, 0.078, 0.05, 0.125, shoe, Ft);                                         // shoe upper
    blob(s * 0.1, 0.05, 0.125, 0.062, 0.036, 0.05, trim, Ft, 10);                                     // toe cap
    blob(s * 0.1, 0.092, 0.07, 0.03, 0.012, 0.04, trim, Ft, 8);                                       // laces
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(index); g.computeVertexNormals();
  return g;
}
// The body material: soft cloth with a gentle rim of light along its edges, so the figure reads clearly
// against any sky.
function bodyMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0.02 });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);\n  outgoingLight += diffuseColor.rgb * rim * 0.55 + vec3(rim * 0.06);\n  #include <opaque_fragment>');
  };
  return m;
}

// ---------- animation clips (made once, shared by every character) ----------
const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
function clip(name, dur, fn, n = 16) {
  // fn(phase 0…1) → { bone: [x, y, z] rotation in radians, hipsY: metres }
  const times = [], per = {};
  for (let i = 0; i <= n; i++) {
    const p = i / n, pose = fn(p === 1 ? 0 : p, p); times.push(p * dur);
    for (const [k, v] of Object.entries(pose)) (per[k] ||= []).push(v);
  }
  const tracks = [], q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [k, vals] of Object.entries(per)) {
    if (k === 'hipsY') { tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, vals.flatMap((y) => [0, y, 0]))); continue; }
    tracks.push(new THREE.QuaternionKeyframeTrack(k + '.quaternion', times, vals.flatMap((v) => { q.setFromEuler(e.set(v[0], v[1], v[2], 'XYZ')); return [q.x, q.y, q.z, q.w]; })));
  }
  return new THREE.AnimationClip(name, dur, tracks);
}
const REST = { hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, -0.1], armR: [0, 0, 0.1], foreL: [-0.15, 0, 0], foreR: [-0.15, 0, 0], handL: [0, 0, 0], handR: [0, 0, 0], legL: [0, 0, 0], legR: [0, 0, 0], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], hipsY: 0.6 };
const pose = (o) => ({ ...REST, ...o });
let CLIPS = null;
function clips() {
  if (CLIPS) return CLIPS;
  const stride = (leg, knee, arm, elbow, lean, bob, twist) => (p) => { const s = sin(TAU * p), k = cos(TAU * p); return pose({
    legL: [-leg * s, 0, 0], legR: [leg * s, 0, 0], shinL: [0.1 + knee * Math.max(0, k), 0, 0], shinR: [0.1 + knee * Math.max(0, -k), 0, 0],
    footL: [0.25 * s, 0, 0], footR: [-0.25 * s, 0, 0],
    armL: [arm * s, 0, -0.12], armR: [-arm * s, 0, 0.12], foreL: [-elbow - 0.2 * Math.max(0, s), 0, 0], foreR: [-elbow - 0.2 * Math.max(0, -s), 0, 0],
    spine: [lean * 0.5, twist * s, 0], chest: [lean * 0.5, twist * s, 0], neck: [-lean * 0.6, -twist * s, 0], hipsY: 0.6 - bob + bob * cos(2 * TAU * p) }); };
  CLIPS = {
    idle: clip('idle', 3.2, (p) => pose({ chest: [0.02 * sin(TAU * p), 0, 0], spine: [0.015 * sin(TAU * p), 0, 0], head: [0.02 * sin(TAU * p + 1), 0.1 * sin(TAU * p), 0], armL: [0.03 * sin(TAU * p), 0, -0.1 - 0.02 * sin(TAU * p)], armR: [-0.03 * sin(TAU * p), 0, 0.1 + 0.02 * sin(TAU * p)], hipsY: 0.6 + 0.004 * sin(TAU * p) })),
    walk: clip('walk', 0.86, stride(0.55, 0.8, 0.45, 0.3, 0.06, 0.012, 0.07)),
    run: clip('run', 0.56, stride(0.95, 1.45, 0.95, 1.15, 0.36, 0.03, 0.12)),
    jump: clip('jump', 0.6, (p) => pose({ legL: [-0.75, 0, 0], shinL: [1.25, 0, 0], legR: [-0.3, 0, 0], shinR: [0.85, 0, 0], armL: [-0.4, 0, -2.2 - 0.1 * sin(TAU * p)], armR: [-0.4, 0, 2.2 + 0.1 * sin(TAU * p)], chest: [0.08, 0, 0], head: [-0.15, 0, 0] })),
    fall: clip('fall', 0.5, (p) => pose({ legL: [-0.3 + 0.1 * sin(TAU * p), 0, -0.08], shinL: [0.45, 0, 0], legR: [0.25 - 0.1 * sin(TAU * p), 0, 0.08], shinR: [0.5, 0, 0], armL: [0, 0, -1.5 - 0.25 * sin(2 * TAU * p)], armR: [0, 0, 1.5 + 0.25 * sin(2 * TAU * p + 1)], head: [0.15, 0, 0] })),
    climb: clip('climb', 0.9, (p) => { const s = sin(TAU * p); return pose({ armL: [-2.5 + 0.45 * s, 0, -0.15], foreL: [-0.5 - 0.35 * s, 0, 0], armR: [-2.5 - 0.45 * s, 0, 0.15], foreR: [-0.5 + 0.35 * s, 0, 0], legL: [-0.75 - 0.4 * s, 0, 0], shinL: [1.2 + 0.4 * s, 0, 0], legR: [-0.75 + 0.4 * s, 0, 0], shinR: [1.2 - 0.4 * s, 0, 0], head: [-0.35, 0, 0] }); }),
    swim: clip('swim', 1.3, (p) => { const s = 0.5 + 0.5 * sin(TAU * p); return pose({ hips: [1.2, 0, 0], neck: [-0.55, 0, 0], head: [-0.5, 0, 0], armL: [-2.85, 0, -0.15 - 1.2 * s], armR: [-2.85, 0, 0.15 + 1.2 * s], foreL: [-0.2 - 0.5 * s, 0, 0], foreR: [-0.2 - 0.5 * s, 0, 0], legL: [0.35 * sin(2 * TAU * p), 0, 0], legR: [-0.35 * sin(2 * TAU * p), 0, 0], shinL: [0.25, 0, 0], shinR: [0.25, 0, 0] }); }),
    use: clip('use', 0.9, (p, raw) => { const k = sin(Math.PI * raw); return pose({ armR: [-1.45 * k, 0, 0.1], foreR: [-0.15 - 0.35 * k, 0, 0], spine: [0.1 * k, -0.12 * k, 0], head: [0.08 * k, 0, 0] }); }),
    cheer: clip('cheer', 0.8, (p) => { const s = sin(TAU * p); return pose({ armL: [0, 0, -2.6 - 0.25 * s], armR: [0, 0, 2.6 + 0.25 * s], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], legL: [0, 0, -0.06], legR: [0, 0, 0.06], shinL: [0.25 * Math.max(0, -s), 0, 0], shinR: [0.25 * Math.max(0, -s), 0, 0], head: [-0.2, 0, 0.08 * s], hipsY: 0.6 + 0.06 * Math.max(0, s) }); }),
    talk: clip('talk', 2.4, (p) => pose({ armR: [-0.55 + 0.2 * sin(TAU * p), 0, 0.2], foreR: [-1.15 + 0.3 * sin(2 * TAU * p), 0, 0], armL: [0.05, 0, -0.14], head: [0.06 * sin(2 * TAU * p), 0.08 * sin(TAU * p), 0], chest: [0.02 * sin(2 * TAU * p), 0, 0] })),
    think: clip('think', 3, (p) => pose({ armR: [-0.95, 0, 0.05], foreR: [-2.05 + 0.04 * sin(TAU * p), 0, 0], armL: [-0.25, 0, 0.35], foreL: [-1.3, 0, 0], head: [0.1, 0.12 * sin(TAU * p), 0.14], spine: [0.04, 0, 0] })),
    sad: clip('sad', 3, (p) => pose({ head: [0.4, 0, 0.04 * sin(TAU * p)], neck: [0.15, 0, 0], spine: [0.16, 0, 0], chest: [0.1, 0, 0], armL: [0.08, 0, -0.04], armR: [0.08, 0, 0.04], hipsY: 0.585 })),
  };
  return CLIPS;
}

const SCALE = { tiny: 0.8, kid: 0.88, teen: 0.96, young: 1, adult: 1 };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);

// cfg: avatar config ({ seed } or the player's choices). opts: { role, band, emblem }.
// Returns { group, bones, play(name, fade), once(name), setFace(expr), say(on), lookAt(point|null), reach(point|null),
//           update(dt), speed (clip speed), dispose() }.
export function createRig(cfg = {}, opts = {}) {
  const role = opts.role || 'student', band = opts.band || 'kid';
  const model = portrait3d(cfg, opts), U = model.userData;
  const bones = {};
  for (const [name, parent, x, y, z] of BONES) { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); bones[name] = b; if (parent) bones[parent].add(b); }
  const skeleton = new THREE.Skeleton(BONES.map((b) => bones[b[0]]));
  const mesh = new THREE.SkinnedMesh(bodyGeometry(U.colors, { sex: cfg.g, sleeves: role === 'student' || role === 'peer' || role === 'layman' ? 'short' : 'long' }), bodyMaterial());
  mesh.castShadow = true; mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(bones.root, mesh);
  group.updateMatrixWorld(true); mesh.bind(skeleton);
  // the storybook head (face, hair and what the role wears on it) rides on the head bone
  const head = U.head; head.removeFromParent(); head.position.set(0, 0.25, 0.01); head.scale.setScalar(0.345); bones.head.add(head);
  head.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  if (role === 'master') { const cape = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.78, 14, 1, true, Math.PI * 0.5, Math.PI), mat(0x2a1650, { side: THREE.DoubleSide, roughness: 0.8 })); cape.position.set(0, -0.26, -0.05); cape.castShadow = true; bones.chest.add(cape); const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(0xfffaf2, { emissive: 0x9be7ff, emissiveIntensity: 0.6 })); clasp.position.set(0, 0.12, 0.13); bones.chest.add(clasp); }
  if (role === 'teacher') { const shawl = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x1f9d7a, { side: THREE.DoubleSide })); shawl.scale.set(1, 0.55, 0.78); shawl.position.set(0, 0.04, 0); bones.chest.add(shawl); }
  if (role === 'doctor') { const badge = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(0x7fe0d2)); badge.scale.z = 0.5; badge.position.set(0.09, 0.05, 0.135); bones.chest.add(badge); }
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), new THREE.MeshStandardMaterial({ color: 0xf5b700, emissive: 0xf5b700, emissiveIntensity: 1.1, metalness: 0.7, roughness: 0.2 }));
  emblem.position.set(0.09, 0.02, 0.15); emblem.visible = !!opts.emblem; bones.chest.add(emblem);
  group.scale.setScalar((SCALE[band] || 1) * (role === 'master' || role === 'teacher' || role === 'doctor' ? 1.08 : 1));

  const mixer = new THREE.AnimationMixer(group), actions = {};
  for (const [name, c] of Object.entries(clips())) actions[name] = mixer.clipAction(c);
  let current = null, oneShot = null;
  const play = (name, fade = 0.18) => {
    if (oneShot || current === name || !actions[name]) return;
    const next = actions[name]; next.reset().setLoop(THREE.LoopRepeat).setEffectiveWeight(1).fadeIn(fade).play();
    if (current) actions[current].fadeOut(fade);
    current = name;
  };
  const once = (name, then) => {
    const a = actions[name]; if (!a) return;
    if (current) actions[current].fadeOut(0.12);
    a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.12).play(); a.clampWhenFinished = false; oneShot = name;
    const done = (e) => { if (e.action !== a) return; mixer.removeEventListener('finished', done); oneShot = null; const back = current; current = null; a.fadeOut(0.15); play(back || 'idle', 0.15); then?.(); };
    mixer.addEventListener('finished', done);
  };
  play('idle', 0);

  // face: the painted face is redrawn per expression and cached; blinking and speaking swap between them
  const faces = { neutral: U.face.material.map };
  const faceMap = (expr) => (faces[expr] ||= faceTexture({ ...U.faceArgs, expr }));
  let expr = 'neutral', shown = 'neutral', blinkIn = 1.5 + Math.random() * 3, blink = 0, talking = false, mouth = 0;
  const show = (e) => { if (e === shown) return; shown = e; const m = faceMap(e); U.face.material.map = m; U.face.material.emissiveMap = m; };

  let look = null, reach = null, lookW = 0, reachW = 0;
  const rig = {
    group, bones, mesh, emblem, role, height: 1.65 * group.scale.y, speed: 1,
    play, once, get current() { return oneShot || current; },
    setFace(e) { expr = e; }, say(on) { talking = on; },
    lookAt(p) { look = p ? (look || new THREE.Vector3()).copy(p) : null; },
    reach(p) { reach = p ? (reach || new THREE.Vector3()).copy(p) : null; },
    update(dt) {
      if (current && actions[current] && (current === 'walk' || current === 'run' || current === 'climb' || current === 'swim')) actions[current].timeScale = rig.speed;
      mixer.update(dt);
      blinkIn -= dt; if (blinkIn <= 0) { blink = 0.12; blinkIn = 2 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt); mouth += dt;
      show(blink > 0 && expr !== 'happy' ? 'blink' : talking && Math.floor(mouth * 7) % 2 ? 'talk' : expr);
      // look: turn the head (and a little of the neck) towards a point, within a natural range
      lookW += ((look ? 1 : 0) - lookW) * Math.min(1, dt * 6);
      if (lookW > 0.01 && look) {
        bones.neck.updateWorldMatrix(true, false);
        v1.copy(look); bones.neck.worldToLocal(v1);
        const yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(v1.x, v1.z))), pitch = Math.max(-0.6, Math.min(0.6, -Math.atan2(v1.y - 0.3, Math.hypot(v1.x, v1.z))));
        q1.setFromEuler(new THREE.Euler(pitch * 0.5, yaw * 0.5, 0, 'YXZ'));
        bones.neck.quaternion.slerp(q2.copy(bones.neck.quaternion).multiply(q1), lookW); bones.head.quaternion.slerp(q2.copy(bones.head.quaternion).multiply(q1), lookW);
      }
      // reach: two-bone inverse kinematics puts the right hand on a point
      reachW += ((reach ? 1 : 0) - reachW) * Math.min(1, dt * 8);
      if (reachW > 0.01 && reach) {
        const up = bones.armR, fore = bones.foreR, a = 0.2, b = 0.19;
        const S = up.getWorldPosition(v1);
        const sc = group.scale.y, to = v2.copy(reach).sub(S), d = Math.max(0.05, Math.min((a + b) * sc * 0.999, to.length())) / sc;
        to.normalize();
        const shoulder = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
        const axis = v3.crossVectors(to, DOWN); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
        const upDir = to.clone().applyAxisAngle(axis, shoulder);
        const parentQ = up.parent.getWorldQuaternion(new THREE.Quaternion());
        const upQ = new THREE.Quaternion().setFromUnitVectors(DOWN, upDir);
        up.quaternion.slerp(parentQ.clone().invert().multiply(upQ), reachW);
        const elbow = S.clone().addScaledVector(upDir, a * sc), foreDir = v2.copy(reach).sub(elbow).normalize();
        fore.quaternion.slerp(upQ.invert().multiply(new THREE.Quaternion().setFromUnitVectors(DOWN, foreDir)), reachW);
      }
    },
    dispose() {
      mixer.stopAllAction(); group.removeFromParent();
      group.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.dispose?.(); }); });
      Object.values(faces).forEach((f) => f.dispose());
    },
  };
  return rig;
}
export const CLIP_NAMES = ['idle', 'walk', 'run', 'jump', 'fall', 'climb', 'swim', 'use', 'cheer', 'talk', 'think', 'sad'];
