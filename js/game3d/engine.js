// The game loop and renderer for the 3D adventure: fixed-step simulation, smooth drawing, shadows, and picture
// quality that adapts to the device so the game stays responsive.
import { THREE } from '../gfx/kit3d.js';
import { STEP } from './physics.js';

export const QUALITY = {
  low: { ratio: 0.75, shadows: false, particles: 0.4, far: 120 },
  medium: { ratio: 1, shadows: true, shadowMap: 1024, particles: 0.7, far: 170 },
  high: { ratio: 1.5, shadows: true, shadowMap: 2048, particles: 1, far: 220 },
};

// host: the element the picture fills. opts: { quality: 'auto' | 'low' | 'medium' | 'high', calm (reduced motion) }.
export function createEngine(host, { quality = 'auto', calm = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const el = renderer.domElement;
  el.className = 'g3d-canvas'; el.tabIndex = 0; el.setAttribute('role', 'application');
  host.append(el);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 2, 0.1, 220);
  const coarse = matchMedia('(pointer: coarse)').matches;
  let tier = quality === 'auto' ? (coarse || (navigator.hardwareConcurrency || 4) <= 4 ? 'medium' : 'high') : quality;
  let scale = 1;                      // extra automatic scaling on top of the tier
  const size = { w: 300, h: 300 };
  const apply = () => {
    const q = QUALITY[tier];
    renderer.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2) * q.ratio * scale));
    renderer.shadowMap.enabled = q.shadows; camera.far = q.far; camera.updateProjectionMatrix();
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    eng.onQuality?.(q, tier);
  };
  // An open panel covers part of the picture; the view is shifted so the action stays in the part still visible.
  const inset = [0, 0];
  const fit = () => {
    size.w = Math.max(200, host.clientWidth); size.h = Math.max(200, host.clientHeight); renderer.setSize(size.w, size.h, false); camera.aspect = size.w / size.h;
    if (inset[0] || inset[1]) camera.setViewOffset(size.w, size.h, inset[0] / 2, inset[1] / 2, size.w, size.h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit); ro.observe(host);

  const fixed = [], frame = [];
  const stats = { fps: 60, ms: 16, calls: 0, triangles: 0, steps: 0, frames: 0, worst: 0, tier, scale };
  let raf = 0, last = 0, acc = 0, alive = true, paused = false, slow = 0, fast = 0, time = 0;
  const tick = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (document.hidden || paused) { last = 0; return; }
    const raw = last ? (now - last) / 1000 : STEP; last = now;
    const dt = Math.min(0.1, raw);
    acc += dt; let n = 0;
    while (acc >= STEP && n < 5) { for (const f of fixed) f(STEP); acc -= STEP; n++; stats.steps++; }
    if (n === 5) acc = 0;                                                    // never spiral after a long pause
    time += dt;
    for (const f of frame) f(dt, time, acc / STEP);
    renderer.render(scene, camera);
    stats.frames++; stats.ms += (raw * 1000 - stats.ms) * 0.05; stats.fps = 1000 / stats.ms; stats.worst = Math.max(stats.worst * 0.995, raw * 1000);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    // adapt: step the picture down when frames run long, and back up when there is room
    if (quality === 'auto' && stats.frames > 90) {
      if (stats.ms > 24) { slow++; fast = 0; } else if (stats.ms < 13) { fast++; slow = 0; } else slow = fast = 0;
      if (slow > 90) { slow = 0; if (scale > 0.62) scale -= 0.12; else if (tier !== 'low') { tier = tier === 'high' ? 'medium' : 'low'; scale = 1; } stats.tier = tier; stats.scale = scale; apply(); }
      if (fast > 480) { fast = 0; if (scale < 1) { scale = Math.min(1, scale + 0.12); stats.scale = scale; apply(); } }
    }
  };
  const eng = {
    THREE, renderer, scene, camera, el, size, stats, calm, onQuality: null,
    get quality() { return QUALITY[tier]; }, get tier() { return tier; },
    setQuality(q) { quality = q; if (q !== 'auto') { tier = q; scale = 1; } stats.tier = tier; apply(); },
    onFixed: (fn) => fixed.push(fn), onFrame: (fn) => frame.push(fn),
    setInset(right, bottom) { if (inset[0] === right && inset[1] === bottom) return; inset[0] = right; inset[1] = bottom; fit(); },
    // How wide the uncovered part of the picture is compared with its height.
    get openAspect() { return (size.w - inset[0]) / Math.max(1, size.h - inset[1]); },
    pause(v) { paused = v; }, get paused() { return paused; },
    start() { fit(); apply(); raf = requestAnimationFrame(tick); },
    // Runs the game forward without drawing (used by tests and to settle a scene).
    advance(seconds, draw = true) { for (let i = 0; i < Math.round(seconds / STEP); i++) { for (const f of fixed) f(STEP); } for (const f of frame) f(seconds, time += seconds, 0); if (draw) renderer.render(scene, camera); },
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
      renderer.dispose(); renderer.forceContextLoss?.(); el.remove();
    },
  };
  return eng;
}
