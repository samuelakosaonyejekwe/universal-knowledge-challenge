// 3D toolkit: a WebGL stage that fits its container, touch/mouse orbit controls, picture sprites, a star field,
// and stylised 3D characters built from simple shapes. Built on the bundled three.js (js/vendor), so it works offline.
import * as THREE from '../vendor/three.module.min.js';
import { rngFrom } from '../core/util.js';
import { SKINS, HAIR_COLORS, OUTFITS } from '../core/avatar.js';

export { THREE };

// How finely pictures are painted: 1 for small or slow screens, 2 for high definition (faces, labels, planets).
let DETAIL = 1, ANISO = 4;
export function setDetail(detail = 1, aniso = 4) { DETAIL = detail; ANISO = aniso; }

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

// A pad of view buttons for a stage with orbit controls: turn, tilt, zoom and reset, each acting while held.
// labels: { up, down, left, right, zoomIn, zoomOut, reset } (already in the player's language).
export function viewPad(host, ctl, { minDist = 8, maxDist = 80, labels = {} } = {}) {
  const st = ctl.state, home = { yaw: st.yaw, pitch: st.pitch, dist: st.dist }, held = new Set();
  host.classList.add('has-viewpad');
  const pad = document.createElement('div'); pad.className = 'viewpad'; pad.setAttribute('role', 'group');
  for (const [name, text, cls, title] of [['up', '▲', 'u', labels.up], ['left', '◀', 'l', labels.left], ['reset', '⟲', 'c', labels.reset], ['right', '▶', 'r', labels.right], ['down', '▼', 'd', labels.down], ['in', '＋', 'zi', labels.zoomIn], ['out', '－', 'zo', labels.zoomOut]]) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g3d-vb ' + cls; b.textContent = text; if (title) { b.title = title; b.setAttribute('aria-label', title); }
    const on = (e) => { e.preventDefault(); e.stopPropagation(); if (name === 'reset') { st.yaw = home.yaw; st.pitch = home.pitch; st.dist = home.dist; } else held.add(name); }, off = () => held.delete(name);
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { on(e); setTimeout(off, 200); } });
    pad.append(b);
  }
  host.append(pad);
  let last = performance.now(), raf = 0;
  const tick = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (held.has('left')) st.yaw += 1.6 * dt; if (held.has('right')) st.yaw -= 1.6 * dt; if (held.has('up')) st.pitch = Math.min(1.2, st.pitch + dt); if (held.has('down')) st.pitch = Math.max(-0.15, st.pitch - dt); if (held.has('in')) st.dist = Math.max(minDist, st.dist * (1 - 0.9 * dt)); if (held.has('out')) st.dist = Math.min(maxDist, st.dist * (1 + 0.9 * dt)); if (pad.isConnected) raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  return pad;
}

// A flat picture (emoji and/or text) that always faces the camera.
export function sprite(text, { size = 2, color = '#ffffff', bg = null, font = 96, bold = true, label = '' } = {}) {
  font = Math.round(font * (DETAIL > 1 ? 1.5 : 1));                 // sharper lettering in high definition
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const lines = [text, label].filter(Boolean);
  g.font = `${bold ? '800 ' : ''}${font}px ui-rounded, system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  const w = Math.ceil(Math.max(...lines.map((l, i) => g.measureText(l).width * (i ? 0.42 : 1))) + font * 0.5);
  c.width = Math.min(2048, Math.max(64, w)); c.height = Math.ceil(font * (label ? 1.95 : 1.35));
  if (bg) { g.fillStyle = bg; const r = c.height / 2.4; g.beginPath(); g.roundRect ? g.roundRect(0, 0, c.width, c.height, r) : g.rect(0, 0, c.width, c.height); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.font = `${bold ? '800 ' : ''}${font}px ui-rounded, system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  g.fillText(text, c.width / 2, font * 0.7, c.width - 8);
  if (label) { g.font = `800 ${Math.round(font * 0.4)}px ui-rounded, system-ui, sans-serif`; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.fillText(label, c.width / 2, font * 1.5, c.width - 8); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
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

const EYE_COLORS = ['#5b3a1e', '#6b4a2a', '#3f6b4f', '#3d6f9c', '#7a5a2e', '#4a4f6b'];
const tint = (hex, amt) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, amt); return c; };

// The face is painted in the same storybook style as the 2D portraits (large bright eyes with lashes and sparkles,
// soft blush, a small nose and a smile) and wrapped onto the head.
// expr: 'neutral' | 'blink' | 'happy' | 'wow' | 'sad' | 'talk' — the same face with a different look, for animation.
export function faceTexture({ skin, eye, brow, role, young, sex = 'n', expr = 'neutral' }) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W * DETAIL; c.height = H * DETAIL;
  const g = c.getContext('2d'), cx = W / 2, cy = H * 0.52; g.scale(DETAIL, DETAIL);
  const base = g.createLinearGradient(0, 0, 0, H); base.addColorStop(0, '#' + tint(skin, 0.06).getHexString()); base.addColorStop(1, '#' + tint(skin, -0.07).getHexString());
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const master = role === 'master', older = role !== 'student' && role !== 'peer';
  const gap = young ? 31 : 29, erx = young ? 17 : older ? 12.5 : 14.5, ery = young ? 22 : older ? 14 : 17;
  for (const sx of [-1, 1]) { g.fillStyle = 'rgba(255,110,140,' + (young ? 0.34 : 0.2) + ')'; g.beginPath(); g.ellipse(cx + sx * (gap + 14), cy + 30, 15, 9, 0, 0, 7); g.fill(); }
  for (const sx of [-1, 1]) {
    const x = cx + sx * gap, y = cy;
    if (expr === 'blink' || expr === 'happy') {                       // closed eyes: a soft lid line (curving up when happy)
      g.strokeStyle = '#231a33'; g.lineCap = 'round'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - erx, y + 2); g.quadraticCurveTo(x, y + (expr === 'happy' ? -ery * 0.7 : ery * 0.45), x + erx, y + 2); g.stroke();
    } else {
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, erx, ery, 0, 0, 7); g.fill();
    const ir = Math.min(erx, ery) * 0.8, ig = g.createRadialGradient(x, y + ir * 0.5, 1, x, y, ir);
    ig.addColorStop(0, '#' + tint(eye, 0.28).getHexString()); ig.addColorStop(1, eye);
    g.fillStyle = ig; g.beginPath(); g.arc(x + sx, y + 2, ir, 0, 7); g.fill();
    g.fillStyle = '#1b1430'; g.beginPath(); g.arc(x + sx, y + 2, ir * 0.5, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 5, y - 5, erx * 0.3, 0, 7); g.fill(); g.beginPath(); g.arc(x - 5, y + 7, erx * 0.14, 0, 7); g.fill();
    g.strokeStyle = '#231a33'; g.lineCap = 'round'; g.lineWidth = older ? 4 : 5;
    g.beginPath(); g.moveTo(x - erx - 2, y - 3); g.quadraticCurveTo(x, y - ery - 8, x + erx + 2, y - 3); g.stroke();
    if (sex === 'f' || (sex === 'n' && (!older || role === 'teacher'))) { g.lineWidth = sex === 'f' ? 4.5 : 3.5; g.beginPath(); g.moveTo(x + sx * (erx + 1), y - 4); g.lineTo(x + sx * (erx + 9), y - 11); g.stroke(); if (sex === 'f') { g.beginPath(); g.moveTo(x + sx * (erx - 3), y - 10); g.lineTo(x + sx * (erx + 4), y - 17); g.stroke(); } }
    }
    g.strokeStyle = brow; g.lineWidth = master ? 7 : sex === 'm' ? 7 : sex === 'f' ? 4 : 5;
    g.beginPath();
    if (master) { g.moveTo(x - sx * 19, y - ery - 6); g.lineTo(x + sx * 16, y - ery - 19); }
    else if (expr === 'sad') { g.moveTo(x - sx * 15, y - ery - 20); g.lineTo(x + sx * 15, y - ery - 11); }
    else if (expr === 'wow') { g.moveTo(x - 15, y - ery - 20); g.quadraticCurveTo(x, y - ery - 29, x + 15, y - ery - 20); }
    else { g.moveTo(x - 15, y - ery - 14); g.quadraticCurveTo(x, y - ery - 21, x + 15, y - ery - 14); }
    g.stroke();
  }
  const line = '#' + tint(skin, -0.3).getHexString(), lip = '#' + tint(skin, -0.24).offsetHSL(-0.02, 0.15, 0).getHexString();
  g.strokeStyle = line; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 4, cy + 24); g.quadraticCurveTo(cx, cy + 29, cx + 4, cy + 24); g.stroke();
  g.strokeStyle = lip; g.lineWidth = 4.5; g.lineJoin = 'round';
  if (expr === 'wow' || expr === 'talk') { g.fillStyle = '#5a2233'; g.beginPath(); g.ellipse(cx, cy + 47, expr === 'wow' ? 10 : 13, expr === 'wow' ? 13 : 8, 0, 0, 7); g.fill(); g.stroke(); }
  else if (expr === 'sad') { g.beginPath(); g.moveTo(cx - 15, cy + 51); g.quadraticCurveTo(cx, cy + 39, cx + 15, cy + 51); g.stroke(); }
  else if (master && expr !== 'happy') { g.beginPath(); g.moveTo(cx - 17, cy + 43); g.quadraticCurveTo(cx + 3, cy + 50, cx + 20, cy + 38); g.stroke(); }
  else { g.fillStyle = young ? '#fff' : lip; g.beginPath(); g.moveTo(cx - 19, cy + 40); g.quadraticCurveTo(cx, cy + (young ? 64 : 58), cx + 19, cy + 40); g.quadraticCurveTo(cx, cy + 47, cx - 19, cy + 40); g.closePath(); g.fill(); g.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
  return tex;
}

// A storybook-style 3D character matching the 2D portraits: a large head with a painted face, sculpted hair with
// a soft shine, and a rounded body with collar, hands and shoes.
// cfg: { seed } or { skin, hair, hairColor, outfit }. opts: { role, band, emblem }.
// Returns a THREE.Group about 3.4 units tall with userData { head, armL, armR, emblem, body } for animation.
export function character(cfg = {}, opts = {}) {
  const rng = rngFrom('ava' + (cfg.seed ?? JSON.stringify(cfg)));
  const r = (n) => Math.floor(rng() * n);
  const role = opts.role || 'student', band = opts.band || 'kid';
  const older = role !== 'student' && role !== 'peer', young = band === 'tiny' || band === 'kid';
  // the same choices, in the same order, as the 2D portrait, so both show the same person
  const skinHex = SKINS[cfg.skin ?? r(SKINS.length)];
  const style = cfg.hair ?? r(8);
  const grey = older && rng() < 0.22;
  const hairHex = grey ? '#c9ced8' : HAIR_COLORS[cfg.hairColor ?? r(role === 'student' ? HAIR_COLORS.length : 6)];
  const outfitHex = role === 'doctor' ? '#ffffff' : OUTFITS[cfg.outfit ?? r(OUTFITS.length)];
  const eye = EYE_COLORS[r(EYE_COLORS.length)];
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.02, ...o });
  const skin = new THREE.Color(skinHex), hm = mat(hairHex, { roughness: 0.42 }), hm2 = mat(tint(hairHex, 0.12), { roughness: 0.35 });
  const outfit = mat(outfitHex), trim = mat(tint(outfitHex, role === 'doctor' ? -0.12 : 0.2));
  const g = new THREE.Group();
  const add = (parent, geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; };
  const ball = (rad, seg = 18) => new THREE.SphereGeometry(rad, seg, Math.max(10, seg - 4));

  // body: rounded torso, collar, short legs, shoes
  const body = add(g, new THREE.CapsuleGeometry(0.56, 0.62, 8, 18), outfit, 0, 1.05, 0, 1, 1, 0.82);
  add(g, new THREE.TorusGeometry(0.36, 0.09, 8, 20), trim, 0, 1.68, 0.02).rotation.x = Math.PI / 2;
  add(g, new THREE.SphereGeometry(0.2, 12, 10), mat(skin), 0, 1.72, 0);                                  // neck
  for (const x of [-0.24, 0.24]) { add(g, new THREE.CapsuleGeometry(0.17, 0.26, 4, 10), mat(0x2f3566), x, 0.36, 0); add(g, ball(0.2, 12), mat(0x1d2140), x, 0.1, 0.1, 1, 0.6, 1.5); }
  for (let i = 0; i < 2; i++) add(g, ball(0.045, 8), trim, 0, 1.3 - i * 0.3, 0.47);                         // buttons
  const arm = (sx) => { const a = new THREE.Group(); a.position.set(sx * 0.6, 1.5, 0); add(a, new THREE.CapsuleGeometry(0.14, 0.52, 4, 10), outfit, 0, -0.36, 0); add(a, new THREE.TorusGeometry(0.14, 0.04, 6, 12), trim, 0, -0.66, 0).rotation.x = Math.PI / 2; add(a, ball(0.15, 12), mat(skin), 0, -0.78, 0); a.rotation.z = sx * 0.2; g.add(a); return a; };
  const armL = arm(-1), armR = arm(1);

  // head: big, with the painted face
  const headR = young ? 0.92 : 0.82;
  const head = new THREE.Group(); head.position.y = 1.78 + headR * 0.92;
  const faceArgs = { skin: skinHex, eye, brow: '#' + tint(hairHex, -0.2).getHexString(), role, young, sex: cfg.g || 'n' };
  const face = add(head, new THREE.SphereGeometry(headR, 40, 30), (() => { const map = faceTexture(faceArgs); return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.38, roughness: 0.8 }); })(), 0, 0, 0, 1, 1.04, 0.96);
  face.rotation.y = -Math.PI / 2;
  for (const x of [-1, 1]) add(head, ball(0.16, 12), mat(tint(skinHex, -0.04)), x * headR * 0.97, -0.02, 0, 0.6, 1, 0.8);   // ears
  add(head, ball(0.06, 8), mat(tint(skinHex, -0.03)), 0, -0.1, headR * 0.95);                                              // nose

  // hair: a cap over the crown plus a style on top
  const R = headR * 1.06;
  const crown = (thetaLen, tilt = -0.62) => { const o = add(head, new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, 0, thetaLen), hm, 0, 0.02, -0.02); o.rotation.x = tilt; return o; };
  const lock = (x, y, z, rx, ry, rz, m = hm) => add(head, ball(1, 14), m, x, y, z, rx, ry, rz);
  switch (style) {
    case 0: crown(Math.PI * 0.46); lock(-0.3, headR * 0.86, headR * 0.42, 0.52, 0.18, 0.32, hm2).rotation.z = 0.35; lock(0.34, headR * 0.86, headR * 0.38, 0.4, 0.16, 0.3).rotation.z = -0.3; break;
    case 1: crown(Math.PI * 0.47); lock(0, -0.55, -headR * 0.55, R * 0.92, 1.05, 0.5); for (const x of [-1, 1]) { lock(x * R * 0.92, -0.5, -0.05, 0.2, 0.9, 0.32); lock(x * R * 0.78, -1.15, -0.2, 0.17, 0.5, 0.26, hm2); } lock(-0.22, headR * 0.86, headR * 0.42, 0.5, 0.18, 0.3, hm2).rotation.z = 0.3; break;
    case 2: crown(Math.PI * 0.45); for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2, ring = i % 2; lock(Math.cos(an) * R * (ring ? 0.95 : 0.6), headR * (ring ? 0.35 : 0.85) + (i % 3) * 0.05, Math.sin(an) * R * (ring ? 0.95 : 0.6) - 0.1, 0.34, 0.34, 0.34, i % 4 === 0 ? hm2 : hm); } lock(0, headR * 1.05, -0.05, 0.42, 0.36, 0.42); break;
    case 3: crown(Math.PI * 0.46); lock(0, headR * 1.22, -0.12, 0.36, 0.34, 0.36, hm2); add(head, new THREE.TorusGeometry(0.25, 0.05, 6, 14), mat(0xff8fa3), 0, headR * 0.98, -0.1).rotation.x = Math.PI / 2; lock(-0.2, headR * 0.87, headR * 0.42, 0.46, 0.16, 0.3).rotation.z = 0.3; break;
    case 4: crown(Math.PI * 0.46); for (const x of [-1, 1]) { for (let i = 0; i < 4; i++) lock(x * (R + 0.02 + i * 0.03), -0.25 - i * 0.36, 0.05, 0.2 - i * 0.02, 0.22, 0.2 - i * 0.02, i % 2 ? hm2 : hm); add(head, ball(0.1, 8), mat(0xffcf5c, { metalness: 0.4 }), x * R * 0.98, 0.02, 0.05); } lock(0, headR * 0.88, headR * 0.42, 0.5, 0.16, 0.3, hm2); break;
    case 5: crown(Math.PI * 0.46);                                   // soft tousled waves with a gentle quiff
      for (const [x, y, z, rx, ry, rz, lite] of [[-0.34, 0.98, 0.3, 0.36, 0.24, 0.34, 1], [0.1, 1.06, 0.28, 0.4, 0.26, 0.36, 0], [0.42, 0.94, 0.2, 0.32, 0.22, 0.32, 1], [-0.1, 1.08, -0.1, 0.44, 0.24, 0.4, 0], [-0.5, 0.86, -0.05, 0.3, 0.24, 0.36, 0], [0.5, 0.84, -0.1, 0.3, 0.24, 0.36, 0]]) lock(x * headR, y * headR, z * headR + 0.1, rx, ry, rz, lite ? hm2 : hm).rotation.z = x * 0.5;
      break;
    case 6: { const scarf = add(head, new THREE.SphereGeometry(R * 1.05, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.62), hm, 0, 0.02, -0.06); scarf.rotation.x = -0.5; lock(0, -headR * 0.95, -0.12, R * 0.98, 0.5, R * 0.9); lock(0, -headR * 0.7, headR * 0.62, 0.5, 0.26, 0.2, hm2); break; }
    default: crown(Math.PI * 0.4, -0.5); break;
  }

  // what each role wears: the same ocean pieces as in the portraits — pearls, shells, coral and starfish
  const pearlM = mat(0xfffaf2, { roughness: 0.25, metalness: 0.1 }), coralM = mat(0xff5f8f, { roughness: 0.5 }), goldM = mat(0xffcf5c, { metalness: 0.6, roughness: 0.25 });
  for (let i = 0; i < 9; i++) { const an = Math.PI * (0.12 + (i / 8) * 0.76); add(g, ball(0.055, 8), pearlM, Math.cos(an) * 0.4, 1.6 - Math.sin(an) * 0.1, Math.sin(an) * 0.36 + 0.06); }   // pearl necklace
  const topY = headR * 1.02;
  const sprig = (x, z, hgt) => { add(head, new THREE.CapsuleGeometry(0.05, hgt, 3, 8), coralM, x, topY + hgt / 2, z); const br = add(head, new THREE.CapsuleGeometry(0.04, hgt * 0.5, 3, 8), coralM, x + 0.09, topY + hgt * 0.7, z); br.rotation.z = -0.6; add(head, ball(0.06, 8), pearlM, x, topY + hgt + 0.1, z); };
  if (role === 'teacher' || role === 'doctor') for (const x of [-1, 1]) { const rim = add(head, new THREE.TorusGeometry(headR * 0.25, 0.025, 6, 20), mat(0x2a2140), x * headR * 0.36, 0.02, headR * 0.93); rim.rotation.y = x * 0.32; }
  if (role === 'teacher') {                                             // pearl circlet with a little coral
    const band = add(head, new THREE.TorusGeometry(headR * 0.9, 0.04, 6, 30), goldM, 0, headR * 0.52, 0); band.rotation.x = Math.PI / 2 - 0.25;
    for (let i = -2; i <= 2; i++) add(head, ball(0.06, 8), pearlM, Math.sin(i * 0.3) * headR * 0.9, headR * 0.6 + Math.abs(i) * 0.02, Math.cos(i * 0.3) * headR * 0.86);
    sprig(0, headR * 0.5, 0.28);
    add(g, new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x1f9d7a, { side: THREE.DoubleSide }), 0, 1.3, 0, 1, 0.55, 0.9);   // kelp shawl
  }
  if (role === 'doctor') {                                              // healer's band with a sea-star
    const band = add(head, new THREE.TorusGeometry(headR * 0.9, 0.045, 6, 30), mat(0xffffff), 0, headR * 0.52, 0); band.rotation.x = Math.PI / 2 - 0.25;
    add(head, new THREE.OctahedronGeometry(0.14), mat(0x5fd3c4), 0, headR * 0.66, headR * 0.82, 1, 1, 0.5);
    add(g, ball(0.1, 10), mat(0x7fe0d2), 0.26, 1.22, 0.47, 1, 0.9, 0.5);
  }
  if (role === 'layman') { const cap = add(head, new THREE.SphereGeometry(headR * 1.05, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(0xffb38a), 0, headR * 0.3, -0.04); cap.rotation.x = -0.35; for (let i = -2; i <= 2; i++) { const rib = add(head, new THREE.CapsuleGeometry(0.025, headR * 0.9, 3, 6), mat(0xd9825c), i * 0.2, headR * 0.98, 0.1 - Math.abs(i) * 0.04); rib.rotation.x = -1.0; rib.rotation.z = -i * 0.22; } }
  if (role === 'peer') add(head, ball(0.14, 10), mat(0xffc2d4), headR * 0.78, headR * 0.5, headR * 0.4, 1, 0.9, 0.5);
  if (role === 'student') {                                             // a starfish or a shell tucked into the hair
    if (cfg.g === 'm') add(head, ball(0.14, 10), mat(0xffe1a8), headR * 0.78, headR * 0.52, headR * 0.4, 1, 0.9, 0.5);
    else { const star = add(head, new THREE.OctahedronGeometry(0.19), mat(0xff8a5c), headR * 0.74, headR * 0.55, headR * 0.45, 1, 1, 0.45); star.rotation.z = 0.5; }
  }
  if (role === 'master') {                                              // tall coral crown, fan collar, pearl clasp
    const band = add(head, new THREE.TorusGeometry(headR * 0.86, 0.05, 6, 30), goldM, 0, headR * 0.6, 0); band.rotation.x = Math.PI / 2 - 0.2;
    for (const [x, hgt] of [[-0.5, 0.26], [-0.25, 0.36], [0, 0.46], [0.25, 0.36], [0.5, 0.26]]) sprig(x * headR, headR * 0.28 - Math.abs(x) * 0.2, hgt);
    add(g, new THREE.ConeGeometry(1.05, 2.0, 22, 1, true, Math.PI * 0.5, Math.PI), mat(0x2a1650, { side: THREE.DoubleSide, roughness: 0.8 }), 0, 0.98, -0.12);
    const fan = add(g, new THREE.CircleGeometry(0.95, 20, 0, Math.PI), mat(0x3c1f6e, { side: THREE.DoubleSide }), 0, 1.55, -0.32); fan.rotation.x = -0.25;
    add(g, new THREE.TorusGeometry(0.44, 0.06, 8, 22), goldM, 0, 1.72, 0).rotation.x = Math.PI / 2;
    add(g, ball(0.11, 10), mat(0xfffaf2, { emissive: 0x9be7ff, emissiveIntensity: 0.5, roughness: 0.2 }), 0, 1.5, 0.5);
  }
  g.add(head);
  // golden emblem on the uniform (hidden until earned)
  const emblem = add(g, new THREE.OctahedronGeometry(0.17), new THREE.MeshStandardMaterial({ color: 0xf5b700, emissive: 0xf5b700, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.2 }), 0.26, 1.42, 0.5);
  emblem.visible = !!opts.emblem;
  g.userData = { head, armL, armR, emblem, body, face, faceArgs, headR, colors: { skin: skinHex, outfit: outfitHex, hair: hairHex } };
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
