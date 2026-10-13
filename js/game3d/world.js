// The world builder: turns a world definition (js/game3d/worlds/wNN.js) into a playable 3D place.
// It owns the level geometry (solids and zones for the controller, bodies for the physics), the sky and lights,
// and a "kit" of building pieces that every world shares: islands, blocks, moving platforms, ladders, water,
// crates, gates, crystals, tablets, consoles, portals and scenery. See tools/GAME3D.md for the world contract.
import { THREE, sprite, glow } from '../gfx/kit3d.js';
import { CANNON } from './physics.js';

const col = (c) => new THREE.Color(c);

export function createWorld(eng, physics, def, { rng = Math.random } = {}) {
  const { scene } = eng, th = def.theme;
  const level = { solids: [], zones: [], killY: -14, movers: [], dynamic: [], orbs: [], tablets: [], spots: {}, nodes: [], links: [], animated: [], bridges: [] };
  const root = new THREE.Group(); scene.add(root);

  // ----- sky, fog and light -----
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256;
  const sg = skyC.getContext('2d'), grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, th.sky[0]); grad.addColorStop(0.55, th.sky[1]); grad.addColorStop(1, th.sky[2] || th.sky[1]);
  sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyC); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(96, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  root.add(sky);
  scene.fog = new THREE.Fog(col(th.fog || th.sky[1]), th.fogNear ?? 45, th.fogFar ?? 150);
  const hemi = new THREE.HemisphereLight(col(th.skyLight || '#ffffff'), col(th.groundLight || th.side || '#445'), th.ambient ?? 1.15);
  const sun = new THREE.DirectionalLight(col(th.sun || '#fff4dd'), th.sunPower ?? 2.2);
  sun.castShadow = true; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -22; sc.right = sc.top = 22; sc.near = 1; sc.far = 90;
  root.add(hemi, sun, sun.target);
  const sunDir = new THREE.Vector3(...(th.sunDir || [0.45, 1, -0.35])).normalize();
  eng.onQuality = (q) => { if (q.shadowMap) { sun.shadow.mapSize.set(q.shadowMap, q.shadowMap); sun.shadow.map?.dispose(); sun.shadow.map = null; } };

  // ----- shared materials and shapes -----
  const mats = new Map();
  const mat = (color, o = {}) => { const key = color + JSON.stringify(o); if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.78, metalness: 0.02, ...o })); return mats.get(key); };
  const lit = (color, power = 1.2, o = {}) => mat(color, { emissive: col(color), emissiveIntensity: power, roughness: 0.35, ...o });
  const mesh = (geo, material, x = 0, y = 0, z = 0, parent = root) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const solid = (s) => { level.solids.push(s); physics.addSolid(s); return s; };

  const k = {
    THREE, CANNON, root, level, theme: th, rng, mat, lit, mesh, sprite, glow, physics,
    add: (o) => { root.add(o); return o; },
    // Something that moves every frame: fn(dt, time).
    animate: (fn) => level.animated.push(fn),

    // A round floating island whose top is at height y.
    island(x, y, z, r, { h = 3.2, top = th.ground, side = th.side } = {}) {
      const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
      mesh(new THREE.CylinderGeometry(r, r * 0.97, 0.5, 40), mat(top), 0, -0.25, 0, g).castShadow = false;
      mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.62, h - 0.5, 28), mat(side, { flatShading: true }), 0, -0.5 - (h - 0.5) / 2, 0, g);
      mesh(new THREE.ConeGeometry(r * 0.62, r * 0.9, 20), mat(side, { flatShading: true }), 0, -h - r * 0.45, 0, g).rotation.x = Math.PI;
      // a ring of lighter ground and a few tufts make the top less flat
      const ring = mesh(new THREE.RingGeometry(r * 0.55, r * 0.93, 40), mat(th.ground2 || th.ground, { roughness: 1 }), 0, 0.012, 0, g); ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
      return solid({ type: 'cyl', x, z, r, y0: y - h, y1: y, group: g });
    },
    // A block whose top is at height y (x, z is its centre).
    block(x, y, z, w, h, d, { color = th.stone, emissive = 0 } = {}) {
      const m = mesh(new THREE.BoxGeometry(w, h, d), emissive ? lit(color, emissive) : mat(color), x, y - h / 2, z);
      return solid({ type: 'box', min: [x - w / 2, y - h, z - d / 2], max: [x + w / 2, y, z + d / 2], mesh: m });
    },
    // A platform that glides between a and b ([x, y, z] of its top centre) every `period` seconds.
    mover(a, b, [w, h, d], period = 6, { color = th.accent, phase = 0 } = {}) {
      const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color, { roughness: 0.4 }), a[0], a[1] - h / 2, a[2]);
      const trim = mesh(new THREE.BoxGeometry(w * 0.86, 0.06, d * 0.86), lit(th.glow || '#ffffff', 0.9), 0, h / 2 + 0.01, 0, m); trim.castShadow = false;
      const s = { type: 'box', min: [0, 0, 0], max: [0, 0, 0], moving: true, delta: [0, 0, 0], mesh: m };
      const put = (c) => { s.min = [c[0] - w / 2, c[1] - h, c[2] - d / 2]; s.max = [c[0] + w / 2, c[1], c[2] + d / 2]; };
      put(a); solid(s);
      level.movers.push({ s, a, b, w, h, d, period, phase, t: 0, c: [...a], put });
      return s;
    },
    // A ladder standing at (x, z) against a wall; the climber faces `face` (radians, 0 = +Z).
    ladder(x, z, baseY, topY, face = 0, { color = th.wood || '#b98045' } = {}) {
      const g = new THREE.Group(); const fx = Math.sin(face), fz = Math.cos(face);
      g.position.set(x + fx * 0.3, baseY, z + fz * 0.3); g.rotation.y = face; root.add(g);
      const hgt = topY - baseY + 0.5;
      for (const sx of [-0.33, 0.33]) mesh(new THREE.CylinderGeometry(0.05, 0.05, hgt, 8), mat(color), sx, hgt / 2, 0, g);
      for (let y = 0.3; y < hgt - 0.1; y += 0.38) mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), mat(color), 0, y, 0, g).rotation.z = Math.PI / 2;
      level.zones.push({ type: 'climb', min: [x - 0.55, baseY - 0.7, z - 0.55], max: [x + 0.55, topY + 0.7, z + 0.55], at: [x, z], face, baseY, topY, out: [x + fx * 1.0, z + fz * 1.0] });
    },
    // A pool of water to swim in: centre (x, z), size w × d, surface at height y.
    water(x, z, w, d, y, { depth = 2.2, color = th.water || '#2fb5e6' } = {}) {
      const m = mesh(new THREE.BoxGeometry(w, depth, d), new THREE.MeshStandardMaterial({ color: col(color), transparent: true, opacity: 0.62, roughness: 0.12, metalness: 0.1 }), x, y - depth / 2, z);
      m.castShadow = false; m.renderOrder = 2;
      level.animated.push((dt, t) => { m.position.y = y - depth / 2 + Math.sin(t * 1.3) * 0.03; });
      level.zones.push({ type: 'water', min: [x - w / 2, y - depth - 3, z - d / 2], max: [x + w / 2, y, z + d / 2] });
    },
    // A crate that can be pushed, stacked and stood on.
    crate(x, y, z, size = 0.9, { mass = 5, color = th.crate || '#d9a05b' } = {}) {
      const m = mesh(new THREE.BoxGeometry(size, size, size), mat(color), x, y, z);
      mesh(new THREE.BoxGeometry(size * 1.02, size * 0.12, size * 1.02), mat(th.accent), 0, 0, 0, m);
      const body = physics.box(m, [size, size, size], [x, y + size / 2 + 0.02, z], { mass });
      const s = { type: 'box', min: [0, 0, 0], max: [0, 0, 0], dynamic: true, body }; level.solids.push(s); level.dynamic.push(s);
      return body;
    },
    ball(x, y, z, r = 0.45, { mass = 1.5, color = th.accent } = {}) {
      const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat(color, { roughness: 0.35 }), x, y, z);
      mesh(new THREE.TorusGeometry(r * 1.005, r * 0.07, 6, 24), mat('#ffffff'), 0, 0, 0, m);
      return physics.ball(m, r, [x, y + r + 0.02, z], { mass });
    },
    // A swing gate on a hinge: walk into it to push it open. yaw = direction the closed gate spans.
    gate(x, y, z, { w = 2.2, h = 1.3, yaw = 0, color = th.wood || '#b98045' } = {}) {
      const m = mesh(new THREE.BoxGeometry(w, h, 0.12), mat(color), x, y + h / 2 + 0.15, z);
      for (const sx of [-0.3, 0.3]) mesh(new THREE.BoxGeometry(0.08, h * 0.9, 0.14), mat(th.accent), sx * w, 0, 0, m);
      const body = physics.box(m, [w, h, 0.12], [x, y + h / 2 + 0.15, z], { mass: 2 });
      body.quaternion.setFromEuler(0, yaw, 0); body.angularDamping = 0.85; body.linearDamping = 0.4; body.allowSleep = false;
      const px = x - Math.cos(yaw) * w / 2, pz = z + Math.sin(yaw) * w / 2;
      mesh(new THREE.CylinderGeometry(0.11, 0.13, h + 0.5, 10), mat(th.stone), px, y + (h + 0.5) / 2, pz);
      physics.hinge(body, [px, y + h / 2 + 0.15, pz], [0, 1, 0]);
      return body;
    },
    // A weight hanging on a rope from (x, y, z): bump it and it swings.
    pendulum(x, y, z, length = 2.2, { r = 0.4, color = th.accent } = {}) {
      const bob = mesh(new THREE.SphereGeometry(r, 18, 12), mat(color, { metalness: 0.3, roughness: 0.3 }), x, y - length, z);
      const body = physics.ball(bob, r, [x, y - length, z], { mass: 3 }); body.position.y = y - length; body.linearDamping = 0.02; body.allowSleep = false;
      physics.tether(body, [x, y, z], length);
      const rope = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), mat('#e9e2d0'), x, y, z); rope.castShadow = false;
      const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
      level.animated.push(() => { dir.set(body.position.x - x, body.position.y - y, body.position.z - z); const L = dir.length(); rope.scale.y = L; rope.position.set(x + dir.x / 2, y + dir.y / 2, z + dir.z / 2); rope.quaternion.setFromUnitVectors(up, dir.normalize()); });
      return body;
    },
    // A knowledge crystal to collect.
    orb(x, y, z) {
      const g = new THREE.Group(); g.position.set(x, y + 1.1, z); root.add(g);
      const gem = mesh(new THREE.OctahedronGeometry(0.38), lit(th.glow || '#ffd76a', 1.5, { metalness: 0.3 }), 0, 0, 0, g); gem.scale.y = 1.35;
      const halo = glow(th.glow || '#ffd76a', 2.6, 0.75); g.add(halo);
      const beam = mesh(new THREE.CylinderGeometry(0.05, 0.3, 1.1, 10, 1, true), new THREE.MeshBasicMaterial({ color: col(th.glow || '#ffd76a'), transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }), 0, -0.6, 0, g); beam.castShadow = false;
      const o = { g, gem, x, y: y + 1.1, z, taken: false, i: level.orbs.length }; level.orbs.push(o);
      return o;
    },
    // A glowing tablet that shows one key idea of the lesson when the player reads it.
    tablet(x, y, z, yaw = 0) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; root.add(g);
      mesh(new THREE.BoxGeometry(1.0, 0.25, 0.5), mat(th.stone), 0, 0.125, 0, g);
      const face = mesh(new THREE.BoxGeometry(0.9, 1.15, 0.1), lit(th.accent, 0.55), 0, 0.9, 0, g); face.rotation.x = -0.18;
      const mark = sprite('📖', { size: 0.5 }); mark.position.set(0, 1.85, 0); g.add(mark);
      const tb = { g, x, y, z, i: level.tablets.length, mark }; level.tablets.push(tb);
      return tb;
    },
    // The console that runs this world's simulation; `pad` is the open floor where the simulation is built.
    console(x, y, z, yaw = 0) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; root.add(g);
      mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.95, 12), mat(th.stone), 0, 0.475, 0, g);
      const deck = mesh(new THREE.BoxGeometry(1.3, 0.12, 0.75), mat(th.metal || '#39406b', { metalness: 0.5, roughness: 0.35 }), 0, 1.02, 0, g); deck.rotation.x = 0.3;
      const screen = mesh(new THREE.BoxGeometry(1.1, 0.03, 0.55), lit(th.glow || '#7fe3ff', 1.1), 0, 1.09, 0.02, g); screen.rotation.x = 0.3; screen.castShadow = false;
      solid({ type: 'cyl', x, z, r: 0.5, y0: y, y1: y + 1.0 });
      level.spots.console = { x, y, z, yaw, g, screen };
      return g;
    },
    // The way out once the mission is complete.
    portal(x, y, z, yaw = 0) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; root.add(g);
      const ring = mesh(new THREE.TorusGeometry(1.5, 0.16, 12, 40), lit(th.glow || '#ffd76a', 0.4), 0, 1.9, 0, g);
      const disc = mesh(new THREE.CircleGeometry(1.42, 40), new THREE.MeshBasicMaterial({ color: col(th.glow || '#ffd76a'), transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), 0, 1.9, 0, g); disc.castShadow = false;
      mesh(new THREE.BoxGeometry(3.4, 0.3, 1), mat(th.stone), 0, 0.15, 0, g);
      const p = { g, ring, disc, x, y, z, open: false }; level.spots.portal = p;
      level.animated.push((dt, t) => { disc.material.opacity = p.open ? 0.55 + Math.sin(t * 3) * 0.15 : 0.1; ring.material.emissiveIntensity = p.open ? 1.6 : 0.3; if (p.open) disc.rotation.z += dt * 0.8; });
      return p;
    },
    // A waypoint characters can walk to; link(a, b) joins two so routes can be found between them.
    node(x, y, z) { level.nodes.push([x, y, z]); return level.nodes.length - 1; },
    link(a, b) { level.links.push([a, b]); },
    // A floating label or picture.
    sign(text, x, y, z, { size = 1, bg = 'rgba(14,18,48,.78)', label = '' } = {}) { const s = sprite(text, { size, bg, label, font: 72 }); s.position.set(x, y, z); root.add(s); return s; },

    // ----- scenery: prop(kind, x, y, z, { s (scale), yaw, color, solid }) -----
    prop(kind, x, y, z, { s = 1, yaw = 0, color, solid: hard } = {}) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s); root.add(g);
      const P = (geo, c, px = 0, py = 0, pz = 0, o) => mesh(geo, typeof c === 'string' ? mat(c, o) : c, px, py, pz, g);
      let radius = 0, height = 1;
      switch (kind) {
        case 'tree': P(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 8), th.wood || '#8a5a3a', 0, 0.75); P(new THREE.IcosahedronGeometry(1.0, 1), color || th.leaf || '#3fbf6f', 0, 2.1, 0, { flatShading: true }); P(new THREE.IcosahedronGeometry(0.7, 1), color || th.leaf || '#3fbf6f', 0.5, 2.7, 0.2, { flatShading: true }); radius = 0.3; height = 3; break;
        case 'pine': P(new THREE.CylinderGeometry(0.14, 0.2, 0.9, 8), th.wood || '#8a5a3a', 0, 0.45); for (let i = 0; i < 3; i++) P(new THREE.ConeGeometry(1.0 - i * 0.25, 1.3, 9), color || th.leaf || '#2f9e6a', 0, 1.3 + i * 0.75, 0, { flatShading: true }); radius = 0.3; height = 3.4; break;
        case 'rock': P(new THREE.DodecahedronGeometry(0.7, 0), color || th.stone, 0, 0.45, 0, { flatShading: true }).scale.set(1.2, 0.8, 1); radius = 0.75; height = 0.95; break;
        case 'crystal': for (const [px, pz, hh, r] of [[0, 0, 1.6, 0.3], [0.35, 0.15, 1.0, 0.2], [-0.3, 0.2, 0.8, 0.18]]) { const c = P(new THREE.ConeGeometry(r, hh, 6), lit(color || th.glow || '#9be7ff', 0.7, { flatShading: true }), px, hh / 2, pz); c.rotation.z = px * -0.5; } radius = 0.4; height = 1.4; break;
        case 'column': P(new THREE.CylinderGeometry(0.34, 0.4, 0.3, 14), color || th.stone, 0, 0.15); P(new THREE.CylinderGeometry(0.26, 0.28, 2.7, 14), color || th.stone, 0, 1.65); P(new THREE.BoxGeometry(0.85, 0.25, 0.85), color || th.stone, 0, 3.12); radius = 0.4; height = 3.2; break;
        case 'arch': for (const sx of [-1.4, 1.4]) P(new THREE.BoxGeometry(0.5, 3, 0.5), color || th.stone, sx, 1.5); P(new THREE.TorusGeometry(1.4, 0.26, 8, 20, Math.PI), color || th.stone, 0, 3, 0); break;
        case 'lamp': P(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8), th.metal || '#39406b', 0, 1.1); P(new THREE.SphereGeometry(0.24, 14, 10), lit(color || th.glow || '#ffe9a8', 1.6), 0, 2.35).castShadow = false; { const gl = glow(color || th.glow || '#ffe9a8', 2.4, 0.5); gl.position.set(0, 2.35, 0); g.add(gl); } radius = 0.12; height = 2.4; break;
        case 'bush': P(new THREE.IcosahedronGeometry(0.55, 1), color || th.leaf || '#3fbf6f', 0, 0.4, 0, { flatShading: true }).scale.y = 0.75; break;
        case 'flower': P(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 5), '#3f9e5a', 0, 0.2); P(new THREE.SphereGeometry(0.12, 8, 6), color || th.accent, 0, 0.45).scale.y = 0.6; break;
        case 'mushroom': P(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8), '#f4ead8', 0, 0.25); P(new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), color || th.accent, 0, 0.45); break;
        case 'tower': P(new THREE.CylinderGeometry(0.9, 1.05, 4, 14), color || th.stone, 0, 2); P(new THREE.ConeGeometry(1.2, 1.4, 14), th.accent, 0, 4.7); radius = 1.05; height = 4; break;
        case 'house': P(new THREE.BoxGeometry(2.4, 1.8, 2), color || '#f1e3c8', 0, 0.9); { const r = P(new THREE.ConeGeometry(2, 1.2, 4), th.accent, 0, 2.4); r.rotation.y = Math.PI / 4; } P(new THREE.BoxGeometry(0.55, 1, 0.06), th.wood || '#8a5a3a', 0, 0.5, 1.01); radius = 1.5; height = 1.8; break;
        case 'dome': P(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), color || '#cfd6ee', 0, 0, 0, { metalness: 0.1, roughness: 0.4 }); radius = 1.6; height = 1.5; break;
        case 'gear': { const w = P(new THREE.TorusGeometry(0.7, 0.16, 8, 20), color || th.metal || '#c9a24b', 0, 1.1, 0, { metalness: 0.6, roughness: 0.35 }); for (let i = 0; i < 8; i++) { const tth = mesh(new THREE.BoxGeometry(0.26, 0.3, 0.3), w.material, Math.cos(i * Math.PI / 4) * 0.9, Math.sin(i * Math.PI / 4) * 0.9, 0, w); tth.rotation.z = i * Math.PI / 4 + Math.PI / 2; } P(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8), th.stone, 0, 0.55); level.animated.push((dt) => { w.rotation.z += dt * 0.8; }); break; }
        case 'books': for (let i = 0; i < 4; i++) P(new THREE.BoxGeometry(0.8 - i * 0.06, 0.16, 0.56), ['#d6336c', '#1f8fe5', '#f5b700', '#2f9e44'][i], (i % 2) * 0.05, 0.08 + i * 0.16, 0).rotation.y = i * 0.25; radius = 0.45; height = 0.64; break;
        case 'banner': P(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), th.metal || '#39406b', 0, 1.6); { const f = P(new THREE.PlaneGeometry(1.1, 1.6, 6, 1), mat(color || th.accent, { side: THREE.DoubleSide }), 0.6, 2.3, 0); level.animated.push((dt, t) => { f.rotation.y = Math.sin(t * 1.6 + x) * 0.22; }); } break;
        case 'cloud': for (const [px, py, r] of [[0, 0, 1], [1, 0.2, 0.8], [-1, 0.1, 0.75], [0.4, 0.5, 0.7]]) P(new THREE.SphereGeometry(r, 12, 8), mat(color || '#ffffff', { roughness: 1, emissive: col('#ffffff'), emissiveIntensity: 0.25 }), px, py, 0).castShadow = false; level.animated.push((dt, t) => { g.position.x = x + Math.sin(t * 0.08 + z) * 3; }); break;
        case 'pillar': P(new THREE.BoxGeometry(0.8, 2.4, 0.8), color || th.stone, 0, 1.2); P(new THREE.BoxGeometry(0.5, 0.5, 0.5), lit(th.glow || '#9be7ff', 1.2), 0, 2.7).rotation.y = Math.PI / 4; radius = 0.5; height = 2.4; break;
        case 'ring': { const r = P(new THREE.TorusGeometry(1.1, 0.08, 8, 36), lit(color || th.glow || '#9be7ff', 1.1), 0, 1.6, 0); r.castShadow = false; level.animated.push((dt) => { r.rotation.y += dt * 0.6; r.rotation.x += dt * 0.25; }); break; }
        case 'statue': P(new THREE.BoxGeometry(0.9, 0.5, 0.9), th.stone, 0, 0.25); P(new THREE.CapsuleGeometry(0.26, 0.7, 4, 10), color || '#e9e2d0', 0, 1.1); P(new THREE.SphereGeometry(0.24, 12, 10), color || '#e9e2d0', 0, 1.85); radius = 0.5; height = 2; break;
        default: P(new THREE.BoxGeometry(0.8, 0.8, 0.8), color || th.accent, 0, 0.4);
      }
      if (hard && radius) solid({ type: 'cyl', x, z, r: radius * s, y0: y, y1: y + height * s });
      return g;
    },
  };

  // ----- ambient particles that drift around the player -----
  const kinds = { stars: [0.1, 0], bubbles: [0.16, 0.6], leaves: [0.14, -0.5], sparks: [0.1, 0.9], snow: [0.12, -0.7], dust: [0.07, 0.08], notes: [0.14, 0.4] };
  const [psize, drift] = kinds[th.particles] || kinds.dust;
  const N = Math.round(260 * eng.quality.particles * (eng.calm ? 0.3 : 1));
  const pp = new Float32Array(N * 3), seeds = Array.from({ length: N }, () => [rng() * 40 - 20, rng() * 16 - 3, rng() * 40 - 20, rng() * 6]);
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const points = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: col(th.glow || '#ffffff'), size: psize, transparent: true, opacity: 0.8, depthWrite: false, sizeAttenuation: true }));
  points.frustumCulled = false; root.add(points);

  level.kit = k; level.root = root;
  // Fixed-step update: platforms move, pushed objects report where they are.
  level.step = (dt) => {
    for (const m of level.movers) {
      m.t += dt; const f = 0.5 - 0.5 * Math.cos((m.t / m.period + m.phase) * Math.PI * 2);
      const c = [m.a[0] + (m.b[0] - m.a[0]) * f, m.a[1] + (m.b[1] - m.a[1]) * f, m.a[2] + (m.b[2] - m.a[2]) * f];
      m.s.delta = [c[0] - m.c[0], c[1] - m.c[1], c[2] - m.c[2]]; m.c = c; m.put(c);
      m.s.mesh.position.set(c[0], c[1] - m.h / 2, c[2]);
      m.s.body.position.set(c[0], c[1] - m.h / 2, c[2]); m.s.body.velocity.set(m.s.delta[0] / dt, m.s.delta[1] / dt, m.s.delta[2] / dt);
    }
    for (const s of level.dynamic) { const b = s.body; b.updateAABB(); s.min = [b.aabb.lowerBound.x, b.aabb.lowerBound.y, b.aabb.lowerBound.z]; s.max = [b.aabb.upperBound.x, b.aabb.upperBound.y, b.aabb.upperBound.z]; if (b.position.y < level.killY) { b.position.y = 30; b.velocity.set(0, 0, 0); } }
  };
  // Per-frame update: scenery animation, crystals, particles, and the sun's shadow following the player.
  level.frame = (dt, t, focus) => {
    for (const f of level.animated) f(dt, t);
    for (const o of level.orbs) { if (o.taken) continue; o.g.position.y = o.y + Math.sin(t * 2 + o.i) * 0.14; o.gem.rotation.y += dt * 1.6; }
    for (const tb of level.tablets) tb.mark.position.y = 1.85 + Math.sin(t * 2.2 + tb.i) * 0.07;
    sky.position.set(focus[0], 0, focus[2]);
    sun.target.position.set(focus[0], focus[1], focus[2]); sun.position.set(focus[0] + sunDir.x * 40, focus[1] + sunDir.y * 40, focus[2] + sunDir.z * 40);
    for (let i = 0; i < N; i++) {
      const s = seeds[i]; let y = s[1] + ((t * drift + s[3]) % 16); y = ((y + 3) % 16 + 16) % 16 - 3;
      pp[i * 3] = focus[0] + ((s[0] + Math.sin(t * 0.3 + s[3]) * 1.5 + 2000) % 40) - 20; pp[i * 3 + 1] = focus[1] + y; pp[i * 3 + 2] = focus[2] + s[2];
    }
    pgeo.attributes.position.needsUpdate = true;
  };
  level.dispose = () => { root.removeFromParent(); mats.clear(); };
  return level;
}

// ---------- the shared course ----------
// Every world is laid out as one adventure route with the same milestones, so the reusable systems (movement,
// crystals, simulation, challenge arena, portal) work everywhere; each world moves, recolours and furnishes it.
// lay: { mirror (−1 | 1), stones (3–5), rise, towerH, spawnZ (where the player starts on the home island) }. Fills level.spots and returns them.
export function buildCourse(k, lay = {}) {
  const { level, theme: th } = k, m = lay.mirror || 1, rise = lay.rise ?? 0.5, n = lay.stones || 4, TH = lay.towerH ?? 5.5;
  const S = level.spots;
  // 1. home island: where the guide waits
  k.island(0, 0, 0, 9.5);
  S.spawn = [0, 0.05, lay.spawnZ ?? -5, 0]; S.guide = [2.2 * m, 0, 2.5]; S.home = [0, 0, 0];
  const homeNodes = [[2.2 * m, 2.5], [-4 * m, 1], [-2 * m, -5], [4.5 * m, -3], [5 * m, 4.5], [-3.5 * m, 5.5]].map(([x, z]) => k.node(x, 0, z));
  homeNodes.forEach((a, i) => homeNodes.forEach((b, j) => { if (j > i) k.link(a, b); }));
  S.homeNodes = homeNodes;
  k.tablet(-5.2 * m, 0, 3.5, 0.9 * m); k.tablet(5.6 * m, 0, -1.5, -1.2 * m);
  k.orb(-5.5 * m, 0, -3.5);
  k.crate(4.5 * m, 0, 0.5); k.crate(5.6 * m, 0, 1.2); k.ball(3 * m, 0, -6);
  k.gate(0, 0, 8.6, { yaw: 0 });
  for (const sx of [-1, 1]) k.prop('pillar', sx * 2.1, 0, 8.6, { s: 0.6, solid: true });
  // 2. stepping stones rising to the middle island
  let z = 11.6, y = 0;
  for (let i = 0; i < n; i++) { y += rise; const x = (i % 2 ? 1.5 : -1.3) * m; k.island(x, y, z, 1.55, { h: 1.6 }); if (i === Math.min(2, n - 1)) k.orb(x, y + 1.2, z); z += 3.5; }
  const midY = y + rise, midZ = z + 4.4;
  k.island(0, midY, midZ, 6.2); S.mid = [0, midY, midZ];
  const midNodes = [[-3, -2], [3, -1.5], [0, 3], [-3.5, 2.5]].map(([x, zz]) => k.node(x * m, midY, midZ + zz));
  midNodes.forEach((a, i) => midNodes.forEach((b, j) => { if (j > i) k.link(a, b); })); S.midNodes = midNodes;
  k.tablet(4.3 * m, midY, midZ + 1.5, -1.3 * m);
  k.pendulum(-3.6 * m, midY + 3.6, midZ - 3.2, 2.6);
  { const post = k.mesh(new k.THREE.CylinderGeometry(0.1, 0.14, 3.7, 8), k.mat(th.stone), -4.6 * m, midY + 1.85, midZ - 3.2); const arm = k.mesh(new k.THREE.BoxGeometry(1.3, 0.12, 0.12), k.mat(th.stone), -4.05 * m, midY + 3.62, midZ - 3.2); post.receiveShadow = arm.receiveShadow = true; }
  // 3. the lagoon: swim across (a crystal floats in the middle) or ride the raft
  const lz0 = midZ + 5.6, lz1 = lz0 + 12, farZ = lz1 + 6.2, wy = midY - 0.45;
  k.block(0, wy - 2.2, (lz0 + lz1) / 2, 15, 0.8, lz1 - lz0 + 5, { color: th.side });
  k.water(0, (lz0 + lz1) / 2, 14, lz1 - lz0 + 3, wy);
  k.orb(-2.5 * m, wy - 0.75, (lz0 + lz1) / 2);
  k.mover([4.6 * m, midY, lz0 + 1.2], [4.6 * m, midY, lz1 - 1.2], [2.6, 0.4, 2.6], 9);
  // 4. the far island with the tower: climb the ladder
  k.island(0, midY, farZ, 6.6); S.far = [0, midY, farZ];
  const tw = k.block(0, midY + TH, farZ + 3.2, 5.4, TH + 0.4, 4.6, { color: th.stone });
  k.block(0, midY + TH + 0.35, farZ + 5.25, 5.4, 0.35, 0.5, { color: th.accent });                // parapet at the back
  k.ladder(0, farZ + 0.6, midY, midY + TH, 0);
  k.orb(-1.6 * m, midY + TH, farZ + 3.4);
  const topY = midY + TH;
  // 5. a lift carries the player across to the simulation island
  const simX = 19 * m, simZ = farZ + 3.2;
  k.mover([4.1 * m, topY, simZ], [10.6 * m, topY, simZ], [2.6, 0.4, 2.6], 8);
  k.island(simX, topY, simZ, 7.4); S.sim = [simX, topY, simZ];
  S.pad = [simX, topY, simZ + 2.2]; k.console(simX, topY, simZ - 2.6, Math.PI);
  k.orb(simX + 5.2 * m, topY, simZ + 3.6);
  const simNodes = [[-5, -3.5], [5, -4], [-5.5, 2]].map(([x, zz]) => k.node(simX + x * m, topY, simZ + zz)); k.link(simNodes[0], simNodes[1]); k.link(simNodes[0], simNodes[2]); S.simNodes = simNodes;
  // 6. steps up to the challenge arena
  let sy = topY, sz = simZ + 8.2;
  for (let i = 0; i < 4; i++) { sy += 0.38; k.block(simX, sy, sz, 3, 0.5, 1.5, { color: th.stone }); sz += 1.5; }
  const arZ = sz + 6.2, arY = sy;
  k.island(simX, arY, arZ, 7); S.arena = [simX, arY, arZ];
  S.rival = [simX + 2.8, arY, arZ + 2.5]; S.raceStart = [simX - 1.6, arY, arZ + 5.4]; S.rivalStart = [simX + 1.6, arY, arZ + 5.4];
  const ringM = k.mesh(new k.THREE.TorusGeometry(5.6, 0.1, 8, 60), k.lit(th.glow || '#ffd76a', 0.9), simX, arY + 0.06, arZ); ringM.rotation.x = Math.PI / 2; ringM.castShadow = false;
  // 7. the gap the two light bridges cross, and the portal island beyond it
  S.gap = { z0: arZ + 7, z1: arZ + 7 + 9.6, y: arY, x: simX, segments: 6 };
  k.island(simX, arY, S.gap.z1 + 4, 4.6); k.portal(simX, arY, S.gap.z1 + 5.6, 0);
  S.end = [simX, arY, S.gap.z1 + 4];
  return S;
}
