// One input state for keyboard, mouse, game controller and touch screen.
// state: { move: {x, y} (−1…1, y forward), look: {x, y} (camera turn since last read), zoom, run, jump (held),
//          jumpPressed / actPressed / pausePressed (true for one read), device: 'keys' | 'pad' | 'touch' }
import { h } from '../core/util.js';

export function createInput(el, overlay) {
  const keys = new Set();
  const st = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, zoom: 0, run: false, jump: false, jumpPressed: false, actPressed: false, pausePressed: false, device: matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys', locked: false };
  const edge = { jump: false, act: false, pause: false };
  const touch = { x: 0, y: 0, jump: false, run: false };
  const off = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); off.push(() => target.removeEventListener(type, fn, opts)); };
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;

  on(window, 'keydown', (e) => {
    if (typing(e) || st.locked) return;
    const k = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    if (!keys.has(k)) { if (k === 'Space') edge.jump = true; if (k === 'KeyE' || k === 'Enter') edge.act = true; if (k === 'Escape' || k === 'KeyP') edge.pause = true; }
    keys.add(k); st.device = 'keys';
  });
  on(window, 'keyup', (e) => keys.delete(e.code));
  on(window, 'blur', () => keys.clear());

  // drag on the picture to look around; pinch or wheel to zoom
  const pts = new Map(); let pinch = 0;
  on(el, 'pointerdown', (e) => { el.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (e.pointerType === 'touch') st.device = 'touch'; });
  on(el, 'pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { st.look.x += (e.clientX - p[0]) * 0.006; st.look.y += (e.clientY - p[1]) * 0.005; }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) st.zoom += (pinch - d) * 0.02; pinch = d; }
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  on(el, 'pointerup', up); on(el, 'pointercancel', up);
  on(el, 'wheel', (e) => { e.preventDefault(); st.zoom += Math.sign(e.deltaY) * 0.8; }, { passive: false });
  on(el, 'contextmenu', (e) => e.preventDefault());

  // touch screen: a thumb stick on the left and buttons on the right
  const knob = h('i'), stick = h('div', { class: 'g3d-stick', 'aria-hidden': 'true' }, knob);
  const btn = (cls, label, down, upFn) => {
    const b = h('button', { class: 'g3d-tb ' + cls, type: 'button', tabindex: '-1', 'aria-hidden': 'true' }, label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); st.device = 'touch'; down(); });
    const rel = () => upFn?.(); b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel);
    return b;
  };
  const pad = h('div', { class: 'g3d-touch' }, stick,
    btn('jump', '⤒', () => { edge.jump = true; touch.jump = true; }, () => { touch.jump = false; }),
    btn('run', '»', () => { touch.run = !touch.run; pad.classList.toggle('running', touch.run); }));
  overlay?.append(pad);
  let stickId = null;
  const moveStick = (e) => {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    touch.x = dx; touch.y = -dy; knob.style.transform = `translate(${dx * R * 0.55}px, ${dy * R * 0.55}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture?.(e.pointerId); st.device = 'touch'; moveStick(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  const padPrev = {};
  const dead = (v) => (Math.abs(v) < 0.18 ? 0 : v);
  return {
    state: st, touch, pad,
    // Call once per frame before using the state.
    poll(dt) {
      let x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      let run = keys.has('ShiftLeft') || keys.has('ShiftRight'), jump = keys.has('Space');
      if (keys.has('KeyQ')) st.look.x -= 2.2 * dt; if (keys.has('KeyR')) st.look.x += 2.2 * dt;
      if (touch.x || touch.y) { x = touch.x; y = touch.y; }
      run = run || touch.run; jump = jump || touch.jump;
      const gp = [...(navigator.getGamepads?.() || [])].find((g) => g && g.connected);
      if (gp && !st.locked) {
        const ax = dead(gp.axes[0] || 0), ay = dead(gp.axes[1] || 0);
        if (ax || ay) { x = ax; y = -ay; st.device = 'pad'; }
        st.look.x += dead(gp.axes[2] || 0) * 2.6 * dt; st.look.y += dead(gp.axes[3] || 0) * 1.8 * dt;
        const b = (i) => !!gp.buttons[i]?.pressed;
        const press = (i, name) => { if (b(i) && !padPrev[i]) { edge[name] = true; st.device = 'pad'; } padPrev[i] = b(i); };
        press(0, 'jump'); press(2, 'act'); press(1, 'act'); press(9, 'pause');
        jump = jump || b(0); run = run || b(7) || b(10) || b(5);
        if (b(12)) st.zoom -= 4 * dt; if (b(13)) st.zoom += 4 * dt;
      }
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      if (st.locked) { x = y = 0; run = jump = false; edge.jump = edge.act = false; }
      st.move.x = x; st.move.y = y; st.run = run; st.jump = jump;
      st.jumpPressed = edge.jump; st.actPressed = edge.act; st.pausePressed = edge.pause;
      edge.jump = edge.act = edge.pause = false;
      return st;
    },
    // Lets on-screen buttons (and tests) trigger the same actions as keys.
    press(name) { edge[name] = true; },
    takeLook() { const l = { x: st.look.x, y: st.look.y, zoom: st.zoom }; st.look.x = st.look.y = st.zoom = 0; return l; },
    dispose() { off.forEach((f) => f()); pad.remove(); },
  };
}
