// 3D toolkit: a WebGL stage that fits its container, touch/mouse orbit controls, picture sprites, a star field,
// and stylised 3D characters built from simple shapes. Built on the bundled three.js (js/vendor), so it works offline.
import * as THREE from '../vendor/three.module.min.js';
import { rngFrom } from '../core/util.js';
import { SKINS, HAIR_COLORS, OUTFITS } from '../core/avatar.js';

export { THREE };

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

// Creates a stage inside `host`. Returns { scene, camera, renderer, el, onFrame(fn), render(), dispose(), size }.
// Rendering pauses automatically when the stage is off-screen or the tab is hidden.
export function createStage(host, { height = 360, fov = 50, background = null, alpha = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const el = renderer.domElement;
  el.style.cssText = 'display:block;width:100%;border-radius:20px;touch-action:none;outline:none';
  el.setAttribute('role', 'img');
  host.append(el);
  const scene = new THREE.Scene();
  if (background != null) scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(fov, 2, 0.1, 400);
  const size = { w: 300, h: height };
  const fit = () => {
    size.w = Math.max(220, host.clientWidth || 300);
    size.h = typeof height === 'function' ? height(size.w) : height;
    renderer.setSize(size.w, size.h, false);
    el.style.height = size.h + 'px';
    camera.aspect = size.w / size.h; camera.updateProjectionMatrix();
  };
  fit();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null; ro?.observe(host);
  let visible = true;
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; }) : null; io?.observe(el);
  const frames = [];
  let raf = 0, last = 0, t = 0, alive = true;
  const tick = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; t += dt;
    for (const f of frames) f(dt, t);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  return {
    scene, camera, renderer, el, size,
    onFrame: (fn) => frames.push(fn),
    render: () => renderer.render(scene, camera),
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
      renderer.dispose(); renderer.forceContextLoss?.(); el.remove();
    },
  };
}

// Drag to look around, pinch or wheel to zoom, and tap to pick. Returns { update(dt), flyTo(target, dist), state }.
export function orbit(stage, { target = new THREE.Vector3(), dist = 30, minDist = 8, maxDist = 80, yaw = 0, pitch = 0.35, autoSpin = 0.05, onTap, onHover } = {}) {
  const st = { yaw, pitch, dist, target: target.clone(), goal: null, spin: autoSpin, busy: false };
  const el = stage.el, pts = new Map();
  let moved = 0, pinch = 0, idle = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickAt = (ev, list) => {
    const r = el.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    return ray.intersectObjects(list, true)[0] || null;
  };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; idle = 0; });
  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) { onHover?.(e, pickAt); return; }
    const dx = e.clientX - p[0], dy = e.clientY - p[1];
    if (pts.size === 1) { st.yaw -= dx * 0.006; st.pitch = Math.max(-0.15, Math.min(1.2, st.pitch + dy * 0.005)); moved += Math.abs(dx) + Math.abs(dy); }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) st.dist = Math.max(minDist, Math.min(maxDist, st.dist * (pinch / d))); pinch = d; moved += 10; }
    idle = 0;
  });
  const up = (e) => { if (pts.has(e.pointerId) && pts.size === 1 && moved < 8) onTap?.(e, pickAt); pts.delete(e.pointerId); pinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = 0; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); st.dist = Math.max(minDist, Math.min(maxDist, st.dist * (1 + Math.sign(e.deltaY) * 0.1))); idle = 0; }, { passive: false });
  const apply = () => {
    const c = stage.camera, cp = Math.cos(st.pitch);
    c.position.set(st.target.x + st.dist * cp * Math.sin(st.yaw), st.target.y + st.dist * Math.sin(st.pitch), st.target.z + st.dist * cp * Math.cos(st.yaw));
    c.lookAt(st.target);
  };
  apply();
  return {
    state: st,
    flyTo(to, d, done) { st.goal = { to: to.clone(), d, done }; st.busy = true; },
    update(dt) {
      idle += dt;
      if (st.goal) {
        st.target.lerp(st.goal.to, Math.min(1, dt * 3.2)); st.dist += (st.goal.d - st.dist) * Math.min(1, dt * 3.2);
        if (st.target.distanceTo(st.goal.to) < 0.15 && Math.abs(st.dist - st.goal.d) < 0.3) { const g = st.goal; st.goal = null; st.busy = false; g.done?.(); }
      } else if (!pts.size && idle > 2.5) st.yaw += st.spin * dt;
      apply();
    },
  };
}

// A flat picture (emoji and/or text) that always faces the camera.
export function sprite(text, { size = 2, color = '#ffffff', bg = null, font = 96, bold = true, label = '' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const lines = [text, label].filter(Boolean);
  g.font = `${bold ? '800 ' : ''}${font}px ui-rounded, system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  const w = Math.ceil(Math.max(...lines.map((l, i) => g.measureText(l).width * (i ? 0.42 : 1))) + font * 0.5);
  c.width = Math.min(1024, Math.max(64, w)); c.height = Math.ceil(font * (label ? 1.95 : 1.35));
  if (bg) { g.fillStyle = bg; const r = c.height / 2.4; g.beginPath(); g.roundRect ? g.roundRect(0, 0, c.width, c.height, r) : g.rect(0, 0, c.width, c.height); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.font = `${bold ? '800 ' : ''}${font}px ui-rounded, system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  g.fillText(text, c.width / 2, font * 0.7, c.width - 8);
  if (label) { g.font = `800 ${Math.round(font * 0.4)}px ui-rounded, system-ui, sans-serif`; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.fillText(label, c.width / 2, font * 1.5, c.width - 8); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size * (c.width / c.height), size, 1);
  return s;
}

export function stars(n = 900, radius = 160, seed = 'stars') {
  const rng = rngFrom(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rng() * 2 - 1, a = rng() * Math.PI * 2, r = radius * (0.55 + rng() * 0.45), s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    const tint = rng(); col.set([0.8 + 0.2 * tint, 0.82 + 0.15 * rng(), 1], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9 }));
}

export function lights(scene, { ambient = 0.75, sun = 1.6, color = 0xffffff } = {}) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x334477, ambient);
  const dir = new THREE.DirectionalLight(color, sun); dir.position.set(6, 12, 8);
  scene.add(hemi, dir);
  return { hemi, dir };
}

// A stylised character made of simple shapes. cfg: { seed } or { skin, hair, hairColor, outfit }.
// opts: { role: 'student' | 'teacher' | 'master' | 'doctor' | 'layman' | 'peer', band, emblem }.
// Returns a THREE.Group about 3 units tall with userData { head, armL, armR, emblem } for animation.
export function character(cfg = {}, opts = {}) {
  const rng = rngFrom('ava' + (cfg.seed ?? JSON.stringify(cfg)));
  const r = (n) => Math.floor(rng() * n);
  const role = opts.role || 'student', young = opts.band === 'tiny' || opts.band === 'kid';
  const skin = new THREE.Color(SKINS[cfg.skin ?? r(SKINS.length)]);
  const hairStyle = cfg.hair ?? r(8);
  const hairCol = new THREE.Color(HAIR_COLORS[cfg.hairColor ?? r(role === 'student' ? HAIR_COLORS.length : 6)]);
  const outfit = new THREE.Color(OUTFITS[cfg.outfit ?? r(OUTFITS.length)]);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0.02, ...o });
  const g = new THREE.Group();
  const headR = young ? 0.78 : 0.66;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.9, 6, 14), mat(role === 'doctor' ? 0xffffff : outfit)); body.position.y = 1.15; g.add(body);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.55, 14), mat(0x2a2f55)); legs.position.y = 0.28; g.add(legs);
  const head = new THREE.Group(); head.position.y = 2.28 + (headR - 0.66);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(headR, 24, 18), mat(skin)));
  for (const x of [-0.26, 0.26]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(young ? 0.17 : 0.13, 12, 10), mat(0xffffff, { roughness: 0.3 })); white.position.set(x * (headR / 0.66), 0.06, headR * 0.86); head.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(young ? 0.095 : 0.075, 10, 8), mat(0x1c1730, { roughness: 0.2 })); pupil.position.set(x * (headR / 0.66), 0.06, headR * 0.86 + (young ? 0.11 : 0.08)); head.add(pupil);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 14, Math.PI), mat(0x7a2e2e)); smile.position.set(0, -0.22, headR * 0.9); smile.rotation.z = Math.PI; if (role === 'master') { smile.rotation.z = Math.PI * 1.08; smile.scale.set(0.8, 0.5, 1); } head.add(smile);
  // hair
  const hm = mat(role !== 'student' && role !== 'peer' && rng() < 0.25 ? 0xb9bfcc : hairCol, { roughness: 0.9 });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.04, 20, 14, 0, Math.PI * 2, 0, Math.PI * (hairStyle === 7 ? 0.36 : 0.5)), hm); cap.rotation.x = -0.25; head.add(cap);
  if (hairStyle === 1 || hairStyle === 6) { const back = new THREE.Mesh(new THREE.CapsuleGeometry(headR * 0.82, 0.7, 4, 12), hm); back.position.set(0, -0.45, -0.28); head.add(back); }
  if (hairStyle === 2) for (const [x, y] of [[-0.55, 0.3], [0.55, 0.3], [0, 0.72], [-0.36, 0.6], [0.36, 0.6]]) { const puff = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), hm); puff.position.set(x, y, -0.05); head.add(puff); }
  if (hairStyle === 3) { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), hm); bun.position.set(0, headR + 0.12, -0.15); head.add(bun); }
  if (hairStyle === 4) for (const x of [-1, 1]) { const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.6, 4, 8), hm); tail.position.set(x * (headR + 0.05), -0.35, 0); head.add(tail); }
  if (hairStyle === 5) for (let i = 0; i < 5; i++) { const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), hm); const a = (i - 2) * 0.42; spike.position.set(Math.sin(a) * headR * 0.8, headR * 0.92 * Math.cos(a * 0.6), 0.05); spike.rotation.z = -a; head.add(spike); }
  if (role === 'teacher' || role === 'doctor') for (const x of [-0.26, 0.26]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), mat(0x1c1730)); rim.position.set(x * (headR / 0.66), 0.06, headR * 0.98); head.add(rim); }
  if (role === 'layman') { const hat = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.95, 0.6, 14), mat(outfit)); hat.position.y = headR * 0.98; head.add(hat); }
  g.add(head);
  const arm = (x) => { const a = new THREE.Group(); a.position.set(x * 0.72, 1.72, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.62, 4, 8), mat(role === 'doctor' ? 0xffffff : outfit)); m.position.y = -0.42; a.add(m); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(skin)); hand.position.y = -0.86; a.add(hand); a.rotation.z = x * 0.18; g.add(a); return a; };
  const armL = arm(-1), armR = arm(1);
  if (role === 'master') { const cape = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.9, 16, 1, true, Math.PI * 0.5, Math.PI), mat(0x7a1f3d, { side: THREE.DoubleSide })); cape.position.set(0, 1.05, -0.15); g.add(cape); const collar = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 6, 18), mat(0xffcf5c, { metalness: 0.5, roughness: 0.3 })); collar.position.y = 1.86; collar.rotation.x = Math.PI / 2; g.add(collar); }
  if (role === 'teacher') { const tie = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.6, 4), mat(0xffffff)); tie.position.set(0, 1.4, 0.62); tie.rotation.x = Math.PI; g.add(tie); }
  // golden emblem on the uniform (hidden until earned)
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshStandardMaterial({ color: 0xf5b700, emissive: 0xf5b700, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.2 }));
  emblem.position.set(0.3, 1.55, 0.6); emblem.visible = !!opts.emblem; g.add(emblem);
  g.userData = { head, armL, armR, emblem, body };
  return g;
}

// A soft round glow (for suns, atmospheres and nebulae).
export function glow(color, size, opacity = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = new THREE.Color(color), rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  grad.addColorStop(0, `rgba(${rgb},1)`); grad.addColorStop(0.25, `rgba(${rgb},.55)`); grad.addColorStop(0.6, `rgba(${rgb},.14)`); grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(size, size, 1);
  return sp;
}

// A painted planet surface: flowing bands, soft continents and bright swirls in the world's two colours.
export function planetTexture(c1, c2, seed) {
  const rng = rngFrom('planet' + seed), W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const a = new THREE.Color(c1), b = new THREE.Color(c2);
  const mix = (t, l = 0) => { const m = a.clone().lerp(b, t); m.offsetHSL(0, 0, l); return `rgb(${Math.round(m.r * 255)},${Math.round(m.g * 255)},${Math.round(m.b * 255)})`; };
  const base = g.createLinearGradient(0, 0, 0, H); base.addColorStop(0, mix(0.1, 0.12)); base.addColorStop(0.5, mix(0.5)); base.addColorStop(1, mix(0.95, -0.1));
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const kind = Math.floor(rng() * 3); // banded, continents, swirled
  g.globalAlpha = 0.5;
  for (let i = 0; i < (kind === 0 ? 9 : 4); i++) {
    const y = rng() * H, hgt = 8 + rng() * 26, amp = 4 + rng() * 10, ph = rng() * 6;
    g.fillStyle = mix(rng(), (rng() - 0.5) * 0.3);
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin((x / W) * Math.PI * 4 + ph) * amp);
    for (let x = W; x >= 0; x -= 16) g.lineTo(x, y + hgt + Math.sin((x / W) * Math.PI * 4 + ph + 1) * amp);
    g.closePath(); g.fill();
  }
  g.globalAlpha = 0.55;
  for (let i = 0; i < (kind === 1 ? 14 : 6); i++) {
    const x = rng() * W, y = 30 + rng() * (H - 60), r = 14 + rng() * 34;
    g.fillStyle = mix(rng() * 0.4, 0.2 + rng() * 0.15);
    g.beginPath();
    for (let k = 0; k < 9; k++) { const an = (k / 9) * Math.PI * 2, rr = r * (0.6 + rng() * 0.6); g.lineTo(x + Math.cos(an) * rr * 1.5, y + Math.sin(an) * rr * 0.8); }
    g.closePath(); g.fill();
    if (x < 60) { g.translate(W, 0); g.fill(); g.translate(-W, 0); }
  }
  g.globalAlpha = 0.35; g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < (kind === 2 ? 12 : 6); i++) { const x = rng() * W, y = rng() * H, len = 30 + rng() * 70; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y - 8, x + len * 0.6, y + 8, x + len, y - 2); g.stroke(); }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}
