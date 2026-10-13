// The game's 3D scenes: the universe of 20 worlds, the journey mountain of a level, and the duel arena.
import { THREE, createStage, orbit, sprite, stars, lights, character, glow, planetTexture, viewPad } from './kit3d.js';
import { WORLDS } from '../data/worlds.js';
import { t } from '../core/i18n.js';

const col = (hex) => new THREE.Color(hex);

// ---------- the universe: fly around 20 world-planets and tap one to travel there ----------
// opts: { progress(id) → 0..1, favourites: Set, onPick(id) }
export function mountUniverse(host, { progress, favourites = new Set(), onPick }) {
  const stage = createStage(host, { height: (w) => Math.round(Math.max(320, Math.min(560, w * 0.72))), background: 0x0b0f2a, alpha: false });
  stage.el.setAttribute('aria-label', t('The 20 worlds of knowledge'));
  const { scene } = stage;
  lights(scene, { ambient: 0.85, sun: 1.1 });
  scene.add(stars(1400, 190));
  // far-away nebula clouds give the sky depth and colour
  for (const [x, y, z, c, sz] of [[-90, 30, -110, 0x7a4cff, 150], [100, -20, -100, 0x1fb6ff, 140], [20, 60, -140, 0xff5fa2, 120], [-70, -40, 100, 0x2bd4a7, 130], [90, 40, 90, 0xffb347, 110]]) { const n = glow(c, sz, 0.22); n.position.set(x, y, z); scene.add(n); }
  // the knowledge star at the centre: a warm, softly pulsing sun
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3.4, 40, 28), new THREE.MeshBasicMaterial({ map: planetTexture('#fff3b0', '#ffb347', 'sun') }));
  const halo = glow(0xffd76a, 22, 0.9), corona = glow(0xff9d3c, 38, 0.35);
  const light = new THREE.PointLight(0xffe6a0, 900, 140); scene.add(sun, halo, corona, light);
  const planets = [];
  WORLDS.forEach((w, i) => {
    // an even spiral (golden angle), so no two worlds sit on top of each other
    const radius = 12 + i * 1.32, a = i * 2.39996, y = Math.sin(i * 1.9) * 2.2;
    const size = 1.9 + ((i * 7) % 5) * 0.16;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 40, 28), new THREE.MeshStandardMaterial({ map: planetTexture(w.c1, w.c2, w.id), emissive: col(w.c1), emissiveIntensity: 0.18, roughness: 0.72 }));
    ball.rotation.z = (i % 5 - 2) * 0.12; ball.userData.world = w.id; g.add(ball);
    const air = glow(w.c2, size * 3.4, 0.5); g.add(air);                                     // glowing atmosphere
    if (i % 3 === 1) { const ringMat = new THREE.MeshBasicMaterial({ color: col(w.c2).offsetHSL(0, 0, 0.18), transparent: true, opacity: 0.55, side: THREE.DoubleSide }); const rings = new THREE.Mesh(new THREE.RingGeometry(size * 1.35, size * 1.95, 64), ringMat); rings.rotation.x = Math.PI / 2 - 0.35; rings.rotation.y = 0.3; g.add(rings); }
    if (i % 4 === 2) { const moon = new THREE.Mesh(new THREE.SphereGeometry(size * 0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xdfe6ff, roughness: 0.9 })); moon.userData.moon = size * 1.7; g.add(moon); }
    // progress: a bright arc that grows around the world as it is mastered
    const p = Math.max(0, Math.min(1, progress(w.id)));
    if (p > 0) { const arc = new THREE.Mesh(new THREE.TorusGeometry(size * 1.22, 0.13, 8, 60, Math.PI * 2 * p), new THREE.MeshBasicMaterial({ color: 0x4dffb5 })); arc.rotation.x = Math.PI / 2; g.add(arc); }
    const icon = sprite(w.em, { size: 2.3 }); icon.position.y = size + 1.5; g.add(icon);
    const name = sprite(`${t(w.short)}${favourites.has(w.id) ? ' ♥' : ''}`, { size: 1.45, font: 60, bg: 'rgba(14,18,48,.82)' }); name.position.y = -(size + 1.25); g.add(name);
    scene.add(g); planets.push({ g, ball, base: g.position.clone(), w, icon, size });
  });
  let picked = false;
  const balls = planets.map((p) => p.ball);
  const ctl = orbit(stage, { dist: 58, minDist: 14, maxDist: 100, pitch: 0.8, autoSpin: 0.05,
    onTap: (e, pick) => { const hit = pick(e, balls); if (!hit || picked) return; picked = true; const p = planets.find((x) => x.ball === hit.object) || planets.find((x) => x.w.id === hit.object.parent?.userData?.world); ctl.flyTo(p.g.position, 10, () => onPick(p.w.id)); },
    onHover: (e, pick) => { stage.el.style.cursor = pick(e, balls) ? 'pointer' : 'grab'; } });
  viewPad(host, ctl, { minDist: 14, maxDist: 100, labels: { up: t('Tilt up'), down: t('Tilt down'), left: t('Turn left'), right: t('Turn right'), zoomIn: t('Zoom in'), zoomOut: t('Zoom out'), reset: t('Reset the view') } });
  stage.onFrame((dt, time) => {
    for (const [i, p] of planets.entries()) {
      p.ball.rotation.y += dt * (0.22 + (i % 5) * 0.05); p.g.position.y = p.base.y + Math.sin(time * 0.6 + i) * 0.35; p.icon.position.y = p.size + 1.5 + Math.sin(time * 1.4 + i) * 0.15;
      for (const ch of p.g.children) if (ch.userData.moon) ch.position.set(Math.cos(time * 0.8 + i) * ch.userData.moon, 0.3, Math.sin(time * 0.8 + i) * ch.userData.moon);
    }
    sun.rotation.y += dt * 0.08; const pulse = 1 + Math.sin(time * 1.3) * 0.05; halo.scale.set(22 * pulse, 22 * pulse, 1); corona.scale.set(38 / pulse, 38 / pulse, 1);
    ctl.update(dt);
  });
  return {
    dispose: stage.dispose,
    focus(id) { const p = planets[id - 1]; if (p) ctl.flyTo(p.g.position, 12); },
    // Where a world currently appears on screen (page coordinates).
    screenOf(id) { const v = planets[id - 1].g.position.clone().project(stage.camera); const r = stage.el.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }; },
  };
}

// ---------- the journey mountain: the ten stages of a level as a spiral climb ----------
// opts: { world, level, next (1–10), isDone(stage), avatar, band, onPick(stage) }
export function mountJourney(host, { world, level, next, isDone, avatar, band, onPick }) {
  const stage = createStage(host, { height: (w) => Math.round(Math.max(260, Math.min(420, w * 0.6))), background: 0x10163a, alpha: false });
  stage.el.setAttribute('aria-label', t('Journey'));
  const { scene } = stage;
  lights(scene, { ambient: 1.0, sun: 1.5 });
  scene.add(stars(500, 120, 'journey' + world.id));
  const hill = new THREE.Mesh(new THREE.ConeGeometry(7.5, 11, 28, 1), new THREE.MeshStandardMaterial({ color: col(world.c1), roughness: 0.9, flatShading: true })); hill.position.y = 5.2; scene.add(hill);
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 0.6, 36), new THREE.MeshStandardMaterial({ color: col(world.c2), roughness: 1 })); ground.position.y = -0.3; scene.add(ground);
  const nodes = [];
  for (let s = 1; s <= 10; s++) {
    const f = (s - 1) / 9, a = f * Math.PI * 3.2, y = 0.6 + f * 9.6, r = 8.4 - f * 6.6;
    const done = isDone(s), now = s === next, final = s === 10;
    const color = done ? 0x3ddc97 : now ? 0xffd76a : 0x7c86b8;
    const node = new THREE.Mesh(final ? new THREE.OctahedronGeometry(0.95) : new THREE.SphereGeometry(0.72, 20, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: now ? 0.9 : done ? 0.45 : 0.1, roughness: 0.4 }));
    node.position.set(Math.cos(a) * r, y, Math.sin(a) * r); node.userData.stage = s; scene.add(node);
    const tag = sprite(final ? '⚔️' : done ? '⭐' : String(s), { size: final ? 1.5 : 1.1, font: 80 }); tag.position.copy(node.position).add(new THREE.Vector3(0, 1.35, 0)); scene.add(tag);
    if (s > 1) { const prev = nodes[s - 2].node.position; const mid = prev.clone().add(node.position).multiplyScalar(0.5); const len = prev.distanceTo(node.position); const link = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 6), new THREE.MeshStandardMaterial({ color: isDone(s - 1) ? 0x3ddc97 : 0x596292 })); link.position.copy(mid); link.lookAt(node.position); link.rotateX(Math.PI / 2); scene.add(link); }
    nodes.push({ node, tag, s, open: done || now });
  }
  // the player stands on the next stage
  const me = character(avatar, { role: 'student', band, emblem: next > 9 }); me.scale.setScalar(0.7);
  const at = nodes[Math.min(next, 10) - 1].node.position; me.position.set(at.x, at.y + 0.6, at.z); scene.add(me);
  const list = nodes.map((n) => n.node);
  const ctl = orbit(stage, { target: new THREE.Vector3(0, 5, 0), dist: 27, minDist: 12, maxDist: 44, pitch: 0.3, yaw: Math.atan2(at.x, at.z), autoSpin: 0.08,
    onTap: (e, pick) => { const hit = pick(e, list); if (!hit) return; const n = nodes[hit.object.userData.stage - 1]; if (n.open) onPick(n.s); },
    onHover: (e, pick) => { const hit = pick(e, list); stage.el.style.cursor = hit && nodes[hit.object.userData.stage - 1].open ? 'pointer' : 'grab'; } });
  viewPad(host, ctl, { minDist: 12, maxDist: 44, labels: { up: t('Tilt up'), down: t('Tilt down'), left: t('Turn left'), right: t('Turn right'), zoomIn: t('Zoom in'), zoomOut: t('Zoom out'), reset: t('Reset the view') } });
  stage.onFrame((dt, time) => {
    for (const n of nodes) { if (n.s === next) n.node.scale.setScalar(1 + Math.sin(time * 4) * 0.12); if (n.s === 10) n.node.rotation.y += dt; }
    me.position.y = at.y + 0.6 + Math.abs(Math.sin(time * 2.2)) * 0.18; me.rotation.y = ctl.state.yaw; me.userData.head.rotation.z = Math.sin(time * 1.6) * 0.06;
    ctl.update(dt);
  });
  return { dispose: stage.dispose };
}

// ---------- the duel arena ----------
// opts: { student, master (avatar configs), band, total }. Returns { answer(i, youOK, themOK), finish(won), dispose }.
export function mountArena(host, { student, master, band, total }) {
  const stage = createStage(host, { height: (w) => Math.round(Math.max(190, Math.min(300, w * 0.48))), background: 0x17122b, alpha: false });
  stage.el.setAttribute('aria-label', t('Arena'));
  const { scene, camera } = stage;
  const L = lights(scene, { ambient: 0.85, sun: 1.1 });
  scene.add(stars(300, 90, 'arena'));
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3b2f66, emissive: 0x3b2f66, emissiveIntensity: 0.15, roughness: 0.6 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8, 0.5, 44), floorMat); floor.position.y = -0.25; scene.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.14, 8, 60), new THREE.MeshStandardMaterial({ color: 0x8a5cf6, emissive: 0x8a5cf6, emissiveIntensity: 0.8 })); rim.rotation.x = Math.PI / 2; scene.add(rim);
  const you = character(student, { role: 'student', band }), them = character(master, { role: 'master', band });
  you.position.set(-3.2, 0, 0); you.rotation.y = 0.75; them.position.set(3.2, 0, 0); them.rotation.y = -0.75; scene.add(you, them);
  // score pillars rise with every correct answer
  const pillar = (x, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 1.1), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 })); m.position.set(x, 0, -3.4); m.scale.y = 0.05; scene.add(m); return m; };
  const pYou = pillar(-3.2, 0x3ddc97), pThem = pillar(3.2, 0xff6b8b);
  const spotY = new THREE.SpotLight(0xffffff, 60, 30, 0.5, 0.6); spotY.position.set(-3.2, 9, 4); spotY.target = you; const spotT = new THREE.SpotLight(0xffb3c6, 60, 30, 0.5, 0.6); spotT.position.set(3.2, 9, 4); spotT.target = them; scene.add(spotY, spotT);
  you.scale.setScalar(1.15); them.scale.setScalar(1.15);
  you.rotation.y = 0.55; them.rotation.y = -0.55;
  camera.position.set(0, 3.2, 11.2); camera.lookAt(0, 1.75, 0);
  let sy = 0, st = 0, won = null, glow = 0;
  const hop = { you: 0, them: 0 }, shake = { you: 0, them: 0 };
  const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(240 * 3), 3)), new THREE.PointsMaterial({ color: 0xffd76a, size: 0.22, transparent: true, opacity: 0 })); scene.add(sparks);
  const vel = Array.from({ length: 240 }, () => [(Math.random() - 0.5) * 6, 3 + Math.random() * 6, (Math.random() - 0.5) * 6]);
  stage.onFrame((dt, time) => {
    const hY = total ? (sy / total) * 6 + 0.05 : 0.05, hT = total ? (st / total) * 6 + 0.05 : 0.05;
    pYou.scale.y += (hY - pYou.scale.y) * Math.min(1, dt * 5); pYou.position.y = pYou.scale.y / 2; pThem.scale.y += (hT - pThem.scale.y) * Math.min(1, dt * 5); pThem.position.y = pThem.scale.y / 2;
    for (const [k, c] of [['you', you], ['them', them]]) {
      hop[k] = Math.max(0, hop[k] - dt * 2.2); shake[k] = Math.max(0, shake[k] - dt * 2.5);
      c.position.y = Math.sin(hop[k] * Math.PI) * 1.1; c.userData.head.rotation.y = Math.sin(time * 22) * 0.35 * shake[k];
      c.userData.armL.rotation.z = -0.18 - Math.sin(hop[k] * Math.PI) * 2.2; c.userData.armR.rotation.z = 0.18 + Math.sin(hop[k] * Math.PI) * 2.2;
      c.userData.body.scale.y = 1 + Math.sin(time * 2 + (k === 'you' ? 0 : 1.5)) * 0.015; c.userData.head.rotation.z = Math.sin(time * 1.3 + (k === 'you' ? 0 : 2)) * 0.05;
    }
    if (won === true) {
      // the arena fills with light and a golden emblem appears on the student's uniform
      glow = Math.min(1, glow + dt * 0.7);
      scene.background.lerpColors(col(0x17122b), col(0xffe9a8), glow);
      floorMat.emissive.lerpColors(col(0x3b2f66), col(0xffc93c), glow); floorMat.emissiveIntensity = 0.15 + glow * 0.9;
      L.hemi.intensity = 0.85 + glow * 1.4; spotY.intensity = 60 + glow * 240; spotY.color.set(0xfff0b8);
      you.userData.emblem.visible = true; you.userData.emblem.rotation.y += dt * 3; you.userData.emblem.scale.setScalar(1 + glow * 1.4);
      if (hop.you <= 0) hop.you = 1;
      const pos = sparks.geometry.attributes.position; sparks.material.opacity = 1;
      for (let i = 0; i < 240; i++) { const life = (time * 0.6 + i / 240) % 1; pos.setXYZ(i, -3.2 + vel[i][0] * life, 1 + vel[i][1] * life - 6 * life * life, vel[i][2] * life); }
      pos.needsUpdate = true;
    } else if (won === false && hop.them <= 0) hop.them = 1;
  });
  return {
    answer(youOK, themOK) { if (youOK) { sy++; hop.you = 1; } else shake.you = 1; if (themOK) { st++; hop.them = 1; } else shake.them = 1; },
    finish(w) { won = w; },
    dispose: stage.dispose,
  };
}
