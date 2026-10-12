// The game's 3D scenes: the universe of 20 worlds, the journey mountain of a level, and the duel arena.
import { THREE, createStage, orbit, sprite, stars, lights, character } from './kit3d.js';
import { WORLDS } from '../data/worlds.js';
import { t } from '../core/i18n.js';

const col = (hex) => new THREE.Color(hex);

// ---------- the universe: fly around 20 world-planets and tap one to travel there ----------
// opts: { progress(id) → 0..1, favourites: Set, onPick(id) }
export function mountUniverse(host, { progress, favourites = new Set(), onPick }) {
  const stage = createStage(host, { height: (w) => Math.round(Math.max(320, Math.min(560, w * 0.72))), background: 0x0b0f2a, alpha: false });
  stage.el.setAttribute('aria-label', t('The 20 worlds of knowledge'));
  const { scene } = stage;
  lights(scene, { ambient: 0.9, sun: 1.3 });
  scene.add(stars(1100, 170));
  // the knowledge star at the centre
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  const halo = sprite('✨', { size: 13 }); halo.material.opacity = 0.5;
  const glow = new THREE.PointLight(0xffe6a0, 600, 120); scene.add(sun, halo, glow);
  const planets = [];
  WORLDS.forEach((w, i) => {
    const ring = i < 8 ? 0 : 1, n = ring ? 12 : 8, k = ring ? i - 8 : i;
    const radius = ring ? 25 : 14, a = (k / n) * Math.PI * 2 + (ring ? 0.26 : 0), y = Math.sin(i * 1.7) * (ring ? 2.6 : 1.6);
    const g = new THREE.Group(); g.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.1, 32, 24), new THREE.MeshStandardMaterial({ color: col(w.c1), emissive: col(w.c2), emissiveIntensity: 0.35, roughness: 0.55 }));
    ball.userData.world = w.id; g.add(ball);
    // surface bands so the spin is visible
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.16, 8, 40), new THREE.MeshStandardMaterial({ color: col(w.c2), emissive: col(w.c2), emissiveIntensity: 0.5 })); band.rotation.x = Math.PI / 2 + 0.3; ball.add(band);
    // progress ring: fills as the world is mastered
    const p = Math.max(0, Math.min(1, progress(w.id)));
    const track = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.07, 6, 60), new THREE.MeshBasicMaterial({ color: 0x55608f, transparent: true, opacity: 0.6 })); track.rotation.x = Math.PI / 2; g.add(track);
    if (p > 0) { const arc = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.16, 8, 60, Math.PI * 2 * p), new THREE.MeshBasicMaterial({ color: 0x3ddc97 })); arc.rotation.x = Math.PI / 2; g.add(arc); }
    const icon = sprite(w.em, { size: 2.6 }); icon.position.y = 3.5; g.add(icon);
    const name = sprite(`${String(w.id).padStart(2, '0')} · ${t(w.short)}${favourites.has(w.id) ? ' ♥' : ''}`, { size: 1.3, font: 64, bg: 'rgba(20,24,60,.78)' }); name.position.y = -3.4; g.add(name);
    scene.add(g); planets.push({ g, ball, base: g.position.clone(), w, icon });
  });
  // orbit paths
  for (const r of [14, 25]) { const path = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 4, 120), new THREE.MeshBasicMaterial({ color: 0x8a93c8, transparent: true, opacity: 0.35 })); path.rotation.x = Math.PI / 2; scene.add(path); }
  let picked = false;
  const balls = planets.map((p) => p.ball);
  const ctl = orbit(stage, { dist: 52, minDist: 16, maxDist: 86, pitch: 0.6, autoSpin: 0.06,
    onTap: (e, pick) => { const hit = pick(e, balls); if (!hit || picked) return; picked = true; const p = planets.find((x) => x.ball === hit.object) || planets.find((x) => x.w.id === hit.object.parent?.userData?.world); ctl.flyTo(p.g.position, 9, () => onPick(p.w.id)); },
    onHover: (e, pick) => { stage.el.style.cursor = pick(e, balls) ? 'pointer' : 'grab'; } });
  stage.onFrame((dt, time) => {
    for (const [i, p] of planets.entries()) { p.ball.rotation.y += dt * (0.25 + (i % 5) * 0.05); p.g.position.y = p.base.y + Math.sin(time * 0.6 + i) * 0.35; p.icon.position.y = 3.5 + Math.sin(time * 1.4 + i) * 0.15; }
    sun.rotation.y += dt * 0.1; halo.material.rotation += dt * 0.08;
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
  const me = character(avatar, { role: 'student', band, emblem: next > 9 }); me.scale.setScalar(0.62);
  const at = nodes[Math.min(next, 10) - 1].node.position; me.position.set(at.x, at.y + 0.6, at.z); scene.add(me);
  const list = nodes.map((n) => n.node);
  const ctl = orbit(stage, { target: new THREE.Vector3(0, 5, 0), dist: 27, minDist: 12, maxDist: 44, pitch: 0.3, yaw: Math.atan2(at.x, at.z), autoSpin: 0.08,
    onTap: (e, pick) => { const hit = pick(e, list); if (!hit) return; const n = nodes[hit.object.userData.stage - 1]; if (n.open) onPick(n.s); },
    onHover: (e, pick) => { const hit = pick(e, list); stage.el.style.cursor = hit && nodes[hit.object.userData.stage - 1].open ? 'pointer' : 'grab'; } });
  stage.onFrame((dt, time) => {
    for (const n of nodes) { if (n.s === next) n.node.scale.setScalar(1 + Math.sin(time * 4) * 0.12); if (n.s === 10) n.node.rotation.y += dt; }
    me.position.y = at.y + 0.6 + Math.abs(Math.sin(time * 2.2)) * 0.18; me.rotation.y = ctl.state.yaw;
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
  const L = lights(scene, { ambient: 0.55, sun: 0.9 });
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
  you.scale.setScalar(1.25); them.scale.setScalar(1.25);
  camera.position.set(0, 3.6, 10.5); camera.lookAt(0, 1.9, 0);
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
      c.userData.body.scale.y = 1 + Math.sin(time * 2 + (k === 'you' ? 0 : 1.5)) * 0.015;
    }
    if (won === true) {
      // the arena fills with light and a golden emblem appears on the student's uniform
      glow = Math.min(1, glow + dt * 0.7);
      scene.background.lerpColors(col(0x17122b), col(0xffe9a8), glow);
      floorMat.emissive.lerpColors(col(0x3b2f66), col(0xffc93c), glow); floorMat.emissiveIntensity = 0.15 + glow * 0.9;
      L.hemi.intensity = 0.55 + glow * 1.6; spotY.intensity = 60 + glow * 240; spotY.color.set(0xfff0b8);
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
