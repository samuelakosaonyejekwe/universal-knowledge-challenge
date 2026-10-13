// The game loop and renderer for the 3D adventure: fixed-step simulation, smooth drawing, shadows, and picture
// quality that adapts to the device so the game stays responsive.
import { THREE } from '../gfx/kit3d.js';
import { STEP } from './physics.js';
import { EffectComposer } from '../vendor/post/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/post/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/post/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/post/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/post/postprocessing/ShaderPass.js';
import { GTAOPass } from '../vendor/post/postprocessing/GTAOPass.js';
import { setDetail } from '../gfx/kit3d.js';

// The finishing pass: a touch more colour and contrast, and gently darkened corners that draw the eye to the middle.
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uSaturation: { value: 1.12 }, uContrast: { value: 1.04 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uVignette, uSaturation, uContrast; varying vec2 vUv;\nvoid main() { vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, uSaturation); c.rgb = (c.rgb - 0.5) * uContrast + 0.5; vec2 d = vUv - 0.5; c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.95, dot(d, d) * 2.2); gl_FragColor = c; }',
};

// Picture quality tiers. Low is for weak devices (no shadows, no glow). Medium adds shadows and sky-lit materials.
// High adds a soft glow around bright things and finer shadows. Ultra sharpens everything for strong graphics cards.
export const QUALITY = {
  low: { ratio: 0.75, maxRatio: 1, shadows: false, particles: 0.4, far: 120, bloom: 0, samples: 0, detail: 1, aniso: 2 },
  medium: { ratio: 1, maxRatio: 1.5, shadows: true, shadowMap: 1024, particles: 0.7, far: 170, bloom: 0, samples: 0, detail: 1, aniso: 4 },
  high: { ratio: 1, maxRatio: 2, shadows: true, shadowMap: 2048, particles: 1, far: 240, bloom: 0.5, samples: 4, detail: 2, aniso: 8, finish: true },
  ultra: { ratio: 1.5, maxRatio: 3, shadows: true, shadowMap: 4096, particles: 1.5, far: 300, bloom: 0.6, samples: 8, detail: 2, aniso: 16, finish: true, ao: true },
};
const DOWN = { ultra: 'high', high: 'medium', medium: 'low' };

// host: the element the picture fills. opts: { quality: 'auto' | 'low' | 'medium' | 'high', calm (reduced motion) }.
export function createEngine(host, { quality = 'auto', calm = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  const el = renderer.domElement;
  el.className = 'g3d-canvas'; el.tabIndex = 0; el.setAttribute('role', 'application');
  host.append(el);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 2, 0.1, 220);
  const coarse = matchMedia('(pointer: coarse)').matches;
  let tier = quality === 'auto' ? (coarse || (navigator.hardwareConcurrency || 4) <= 4 ? 'medium' : 'high') : quality;
  setDetail(QUALITY[tier].detail, Math.min(QUALITY[tier].aniso, renderer.capabilities.getMaxAnisotropy()));
  let scale = 1;                      // extra automatic scaling on top of the tier
  const size = { w: 300, h: 300 };
  const apply = () => {
    const q = QUALITY[tier];
    // the screen's own pixels are used in full (ultra draws even more of them and scales down, for the smoothest edges)
    renderer.setPixelRatio(Math.max(0.5, Math.min((window.devicePixelRatio || 1) * q.ratio, q.maxRatio) * scale));
    renderer.shadowMap.enabled = q.shadows; camera.far = q.far; camera.updateProjectionMatrix();
    buildPost(q);
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    eng.onQuality?.(q, tier);
  };
  // The glow pass: bright things (lamps, crystals, the sun) bleed a little light, on a floating-point picture that is
  // smoothed at its edges. If the device cannot do it, the plain picture is drawn instead.
  let composer = null, bloomPass = null, postFailed = false;
  function buildPost(q) {
    if (composer) { composer.dispose?.(); composer.renderTarget1?.dispose(); composer.renderTarget2?.dispose(); composer = bloomPass = null; }
    if (!q.bloom || postFailed) return;
    try {
      const pr = renderer.getPixelRatio(), target = new THREE.WebGLRenderTarget(Math.round(size.w * pr), Math.round(size.h * pr), { type: THREE.HalfFloatType, samples: q.samples });
      composer = new EffectComposer(renderer, target); composer.setPixelRatio(pr); composer.setSize(size.w, size.h);
      composer.addPass(new RenderPass(scene, camera));
      if (q.ao) { try { const ao = new GTAOPass(scene, camera, size.w, size.h); ao.output = GTAOPass.OUTPUT.Default; ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 }); ao.blendIntensity = 0.85; composer.addPass(ao); } catch (e) { console.warn('[g3d] ao-unavailable', e); } }
      bloomPass = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), q.bloom, 0.55, 0.86); composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
      if (q.finish) composer.addPass(new ShaderPass(FinishShader));
    } catch (e) { console.warn('[g3d] glow-unavailable', e); composer = null; postFailed = true; }
  }
  const draw = () => { renderer.info.reset(); if (composer) { try { composer.render(); return; } catch (e) { console.warn('[g3d] glow-failed', e); composer = null; postFailed = true; } } renderer.render(scene, camera); };
  // If the browser takes the graphics context away (another tab, a driver reset), wait and carry on when it returns.
  el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; eng.onLost?.(); });
  el.addEventListener('webglcontextrestored', () => { lost = false; last = 0; apply(); eng.onRestored?.(); });
  let lost = false;

  // An open panel covers part of the picture; the view is shifted so the action stays in the part still visible.
  const inset = [0, 0];
  const fit = () => {
    size.w = Math.max(200, host.clientWidth); size.h = Math.max(200, host.clientHeight); renderer.setSize(size.w, size.h, false); camera.aspect = size.w / size.h;
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(size.w, size.h); }
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
    if (document.hidden || paused || lost) { last = 0; return; }
    const raw = last ? (now - last) / 1000 : STEP; last = now;
    const dt = Math.min(0.1, raw);
    acc += dt; let n = 0;
    while (acc >= STEP && n < 5) { for (const f of fixed) f(STEP); acc -= STEP; n++; stats.steps++; }
    if (n === 5) acc = 0;                                                    // never spiral after a long pause
    time += dt;
    for (const f of frame) f(dt, time, acc / STEP);
    draw();
    stats.frames++; stats.ms += (raw * 1000 - stats.ms) * 0.05; stats.fps = 1000 / stats.ms; stats.worst = Math.max(stats.worst * 0.995, raw * 1000);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    // adapt: step the picture down when frames run long, and back up when there is room
    if (quality === 'auto' && stats.frames > 90) {
      if (stats.ms > 24) { slow++; fast = 0; } else if (stats.ms < 13) { fast++; slow = 0; } else slow = fast = 0;
      if (slow > 90) { slow = 0; if (scale > 0.74) scale -= 0.12; else if (DOWN[tier]) { tier = DOWN[tier]; scale = 1; } stats.tier = tier; stats.scale = scale; apply(); fit(); }
      if (fast > 480) { fast = 0; if (scale < 1) { scale = Math.min(1, scale + 0.12); stats.scale = scale; apply(); } }
    }
  };
  const eng = {
    THREE, renderer, scene, camera, el, size, stats, calm, onQuality: null, onLost: null, onRestored: null,
    get glow() { return !!composer; },
    get quality() { return QUALITY[tier]; }, get tier() { return tier; },
    setQuality(q) { quality = q; if (q !== 'auto') { tier = q; scale = 1; } stats.tier = tier; apply(); fit(); },
    onFixed: (fn) => fixed.push(fn), onFrame: (fn) => frame.push(fn),
    setInset(right, bottom) { if (inset[0] === right && inset[1] === bottom) return; inset[0] = right; inset[1] = bottom; fit(); },
    // How wide the uncovered part of the picture is compared with its height.
    get openAspect() { return (size.w - inset[0]) / Math.max(1, size.h - inset[1]); },
    pause(v) { paused = v; }, get paused() { return paused; },
    start() { fit(); apply(); raf = requestAnimationFrame(tick); },
    // Runs the game forward without drawing (used by tests and to settle a scene).
    advance(seconds, show = true) { for (let i = 0; i < Math.round(seconds / STEP); i++) { for (const f of fixed) f(STEP); } for (const f of frame) f(seconds, time += seconds, 0); if (show) draw(); },
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
      composer?.dispose?.(); renderer.dispose(); renderer.forceContextLoss?.(); el.remove();
    },
  };
  return eng;
}
