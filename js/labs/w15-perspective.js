import { h, button, choice, slider, canvas, readout, predict, pointer, fmt } from '../core/labkit.js';

// Pinhole (camera obscura) model of linear perspective. A point at distance d in front of the eye, a height Y above the
// eye and X to the side lands on the picture at   x = f·X / d,   y = f·Y / d   from the vanishing point (f = picture
// distance in pixels). So the drawn height of an object of real height H is   h = f · H / d : twice as far, half as tall.
const F = 240, EYE = 1.6, POST = 3, SIDE = -1.5; // px, m, m, m
export const drawnHeight = (d, H = POST, f = F) => (f * H) / d;

export default {
  id: 'w15-perspective',
  world: 15,
  levels: [5, 6],
  kind: 'studio',
  icon: '📐',
  title: 'Perspective Studio',
  goal: 'Work out how tall a distant post must be drawn, prove it with lines to the vanishing point, then draw with one- or two-point guides.',
  limits: 'Ideal linear perspective for a single fixed eye (a pinhole camera) looking level at a flat picture: no lens distortion, no curvature of the eye\'s view, no haze. Two-point guides assume the object\'s vertical edges stay vertical; tilting the view needs a third vanishing point.',
  mount(root, api) {
    const t = api.t;
    const cv = canvas(300, { light: true });
    let pts = 1, hy = 112, vp = [150, 262], tool = 'ruler', strokes = [], live = null, drag = -1, placed = false;
    let d1, d2, showProof = false, done = false, tries = 0, predErr = null;
    const farH = slider({ label: t('Drawn height of the far post'), min: 4, max: 200, step: 1, value: 120, unit: 'px', onInput: () => { showProof = false; draw(); } });
    const nearOut = readout(t('Near post: drawn height'), '–');
    const ratioOut = readout(t('Distance ratio d₂ / d₁'), '–');
    const goal = h('div', { class: 'lab-goal' });
    const msg = h('div', { class: 'small', 'aria-live': 'polite' });
    const predictBox = h('div');

    const post = (d) => ({ x: vp[0] + (F * SIDE) / d, base: hy + (F * EYE) / d, top: hy - (F * (POST - EYE)) / d });

    function draw() {
      const { ctx } = cv, w = cv.w, H = cv.h;
      if (!placed) { vp = [Math.round(w * 0.55), Math.round(w * 0.95)]; placed = true; }
      ctx.clearRect(0, 0, w, H);
      ctx.fillStyle = '#e8f1ff'; ctx.fillRect(0, 0, w, hy); ctx.fillStyle = '#eef3e6'; ctx.fillRect(0, hy, w, H - hy);
      ctx.lineWidth = 1;
      const ends = pts === 1 ? [vp[0]] : vp;
      ends.forEach((x, k) => { // faint guide rays from each vanishing point
        ctx.strokeStyle = k ? 'rgba(217, 72, 95, .28)' : 'rgba(79, 91, 213, .28)';
        for (let a = 0; a < 360; a += 15) { if (a % 180 === 0) continue; const r = (a * Math.PI) / 180; ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(x + Math.cos(r) * 900, hy + Math.sin(r) * 900); ctx.stroke(); }
      });
      ctx.strokeStyle = '#5b6585'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(w, hy); ctx.stroke();
      ctx.font = '700 11px system-ui, sans-serif'; ctx.fillStyle = '#5b6585'; ctx.fillText(t('horizon = eye level'), 6, hy - 5);
      // the two posts
      const a = post(d1), b = post(d2), hb = farH.value;
      if (showProof) {
        ctx.setLineDash([5, 4]); ctx.strokeStyle = '#17a673'; ctx.lineWidth = 1.5;
        for (const y of [a.top, a.base]) { ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(vp[0], hy); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      ctx.lineCap = 'round'; ctx.strokeStyle = '#7a4a21'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a.x, a.base); ctx.lineTo(a.x, a.top); ctx.stroke();
      ctx.strokeStyle = '#d9485f'; ctx.lineWidth = Math.max(2.5, 6 * d1 / d2); ctx.beginPath(); ctx.moveTo(b.x, b.base); ctx.lineTo(b.x, b.base - hb); ctx.stroke();
      ctx.fillStyle = '#1c2340'; ctx.fillText(`${d1} m`, a.x - 10, a.base + 13); ctx.fillText(`${d2} m`, b.x - 8, b.base + 13);
      // the learner's drawing
      ctx.strokeStyle = '#1c2340'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      for (const s of live ? [...strokes, live] : strokes) { ctx.beginPath(); s.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.stroke(); }
      ends.forEach((x, k) => { // draggable vanishing points
        ctx.fillStyle = k ? '#d9485f' : '#4f5bd5'; ctx.beginPath(); ctx.arc(x, hy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillText('VP' + (pts === 2 ? k + 1 : ''), Math.min(w - 26, x + 10), hy + 16);
      });
    }

    // Ruler: snap the line to the nearest allowed direction (vertical, towards a vanishing point, or level in one-point).
    function snap(s, p) {
      const dirs = [[0, 1], ...(pts === 1 ? [[1, 0], [vp[0] - s[0], hy - s[1]]] : vp.map((x) => [x - s[0], hy - s[1]]))];
      const v = [p[0] - s[0], p[1] - s[1]], len = Math.hypot(...v) || 1;
      let best = null, bestCos = -1;
      for (const d of dirs) { const dl = Math.hypot(...d); if (dl < 1) continue; const u = [d[0] / dl, d[1] / dl], dot = v[0] * u[0] + v[1] * u[1], c = Math.abs(dot) / len; if (c > bestCos) { bestCos = c; best = [s[0] + u[0] * dot, s[1] + u[1] * dot]; } }
      return best || p;
    }
    const down = (e) => {
      const p = pointer(cv.el, e); cv.el.setPointerCapture?.(e.pointerId);
      drag = (pts === 1 ? [vp[0]] : vp).findIndex((x) => Math.hypot(p.x - x, p.y - hy) < 22);
      if (drag < 0) live = [[p.x, p.y], [p.x, p.y]];
    };
    const move = (e) => {
      const p = pointer(cv.el, e);
      if (drag >= 0) { vp[drag] = Math.max(8, Math.min(cv.w - 8, p.x)); hy = Math.max(90, Math.min(170, p.y)); showProof = false; }
      else if (live) { if (tool === 'ruler') live[1] = snap(live[0], [p.x, p.y]); else live.push([p.x, p.y]); } else return;
      draw();
    };
    const up = () => { if (live && Math.hypot(live[live.length - 1][0] - live[0][0], live[live.length - 1][1] - live[0][1]) > 3) strokes.push(live); live = null; drag = -1; draw(); };
    cv.el.addEventListener('pointerdown', down); cv.el.addEventListener('pointermove', move);
    cv.el.addEventListener('pointerup', up); cv.el.addEventListener('pointercancel', up);
    cv.el.setAttribute('aria-label', t('Drawing canvas with a horizon, vanishing points and two posts'));
    cv.onResize = draw;

    function test() {
      tries++; showProof = true; draw();
      const truth = drawnHeight(d2), err = Math.abs(farH.value - truth) / truth;
      if (err > 0.06) {
        msg.textContent = `🔁 ${t('The green lines from the near post to the vanishing point show where the far post must fit.')} ${t(farH.value > truth ? 'Yours is too tall.' : 'Yours is too short.')}`;
        return;
      }
      msg.textContent = `✅ h = f·H / d = ${F} × ${POST} / ${d2} = ${fmt(truth)} px. ${t('The post fits exactly between the two lines that meet at the vanishing point.')}`;
      api.say(t('Parallel lines in the world meet at the vanishing point in the picture, so equal posts shrink in proportion to 1 ÷ distance.'));
      if (!done) { done = true; api.complete(Math.max(0.4, 1 - 0.12 * (tries - 1) - (predErr == null ? 0.1 : predErr > 0.05 ? 0.05 : 0)), t('Used h = f·H/d and vanishing-point lines to size a distant object.')); }
    }

    function mission() {
      d1 = [4, 5, 6][Math.floor(api.rng() * 3)];
      d2 = [2, 2.5, 3, 4][Math.floor(api.rng() * 4)] * d1;
      showProof = false; done = false; tries = 0; predErr = null; msg.textContent = '';
      farH.set(Math.round(drawnHeight(d1) * (0.55 + 0.4 * api.rng())));
      nearOut.set(fmt(drawnHeight(d1)) + ' px'); ratioOut.set(fmt(d2 / d1));
      goal.textContent = `🎯 ${t('Two identical posts, each')} ${POST} ${t('m tall, stand')} ${d1} m ${t('and')} ${d2} m ${t('away. Give the far (red) post its correct drawn height.')}`;
      predictBox.replaceChildren(predict({
        question: `${t('Predict: the near post is drawn')} ${fmt(drawnHeight(d1))} px ${t('tall. How tall is the far one?')}`, unit: 'px', truth: drawnHeight(d2), tolerance: 0.05,
        onResult: (err) => { predErr = err; api.say(`${t('Drawn height is proportional to 1 ÷ distance. The far post is')} ${fmt(d2 / d1)} ${t('times as far away, so it is drawn that many times smaller.')}`); },
      }));
      draw();
    }

    const ptsChoice = choice([[1, t('One-point')], [2, t('Two-point')]], 1, (v) => { pts = v; draw(); api.say(t(v === 1 ? 'One-point: you face the object squarely; only the lines going away from you converge.' : 'Two-point: you look at a corner; both sets of level lines converge, each to its own vanishing point on the horizon.')); });
    const toolChoice = choice([['ruler', '📏 ' + t('Ruler (snaps to guides)')], ['free', '✏️ ' + t('Freehand')]], 'ruler', (v) => { tool = v; });

    root.append(h('div', { class: 'lab' }, goal, h('div', { class: 'note small' }, 'h = f · H / d  —  f = ' + F + ' px, ' + t('H = real height (m), d = distance (m). Drag a vanishing point to move it and the horizon.')),
      predictBox, cv.el, h('div', { class: 'lab-row' }, farH.el, button('✔ ' + t('Test with guide lines'), test)),
      h('div', { class: 'lab-row' }, nearOut.el, ratioOut.el), msg, ptsChoice.el, toolChoice.el,
      h('div', { class: 'lab-row' }, button('↩️ ' + t('Undo line'), () => { strokes.pop(); draw(); }, 'btn sm ghost'), button('🧽 ' + t('Clear drawing'), () => { strokes = []; draw(); }, 'btn sm ghost'), button('🔄 ' + t('New mission'), mission, 'btn sm ghost'))));
    mission();
    api.say(t('Artists since the Renaissance have used a vanishing point to make flat pictures look deep. Predict the far post\'s height, then test it.'));

    return () => {
      cv.onResize = null;
      cv.el.removeEventListener('pointerdown', down); cv.el.removeEventListener('pointermove', move);
      cv.el.removeEventListener('pointerup', up); cv.el.removeEventListener('pointercancel', up);
    };
  },
};
