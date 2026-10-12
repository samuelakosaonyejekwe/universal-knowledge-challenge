import { h, canvas, pointer, button } from '../core/labkit.js';

// Stylised continents as polygons on a 100 x 50 grid (x: west->east, y: north->south). Not real map data.
const C = {
  'North America': { col: '#e8a33d', p: [[6, 6], [24, 4], [32, 8], [28, 18], [22, 24], [16, 22], [10, 14]] },
  'South America': { col: '#4caf7a', p: [[22, 27], [32, 27], [36, 34], [30, 46], [26, 46], [24, 36]] },
  'Europe': { col: '#8e6fd1', p: [[44, 8], [54, 6], [58, 12], [52, 16], [44, 15]] },
  'Africa': { col: '#d9654a', p: [[44, 18], [56, 18], [60, 28], [54, 40], [48, 40], [44, 28]] },
  'Asia': { col: '#4aa3d9', p: [[58, 6], [84, 6], [90, 16], [82, 26], [70, 26], [60, 20]] },
  'Australia': { col: '#e0709c', p: [[78, 34], [90, 34], [92, 42], [80, 44]] },
  'Antarctica': { col: '#cfe3ee', p: [[20, 47.5], [80, 47.5], [80, 50], [20, 50]] },
};
const DIRS = ['north', 'east', 'south', 'west'];
const cen = n => { const p = C[n].p; return [p.reduce((s, v) => s + v[0], 0) / p.length, p.reduce((s, v) => s + v[1], 0) / p.length]; };
const inside = (pt, poly) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) r = !r; } return r; };

export default {
  id: 'w07-continents-compass',
  world: 7,
  levels: [1, 2],
  kind: 'lab',
  icon: '🧭',
  title: 'Compass and Continents',
  goal: 'Tap the continent you are asked for, then find the way with the compass.',
  limits: 'A stylised cartoon world made of simple shapes: sizes, positions and outlines are only roughly right.',
  mount(root, api) {
    const t = api.t;
    const names = Object.keys(C).filter(n => n !== 'Antarctica').concat(['Antarctica']);
    let q = null, score = 0, asked = 0, locked = false, done = false;
    const total = 6;
    const c = canvas(230);
    const ask = h('div', { class: 'lab-goal', style: { fontSize: '1.15rem', textAlign: 'center' } });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const dirBtns = h('div', { class: 'lab-row', style: { justifyContent: 'center' } });
    let flash = null; const tm = [];

    function newQ() {
      dirBtns.replaceChildren();
      const a = names[Math.floor(api.rng() * names.length)];
      if (asked % 2 === 0 || a === 'Antarctica') q = { type: 'find', a };
      else {
        let b = a; while (b === a || b === 'Antarctica') b = names[Math.floor(api.rng() * names.length)];
        const [ax, ay] = cen(a), [bx, by] = cen(b);
        const dx = bx - ax, dy = by - ay;
        const ans = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
        q = { type: 'dir', a, b, ans };
        dirBtns.append(...DIRS.map(d => button((d === 'north' ? '⬆️ ' : d === 'east' ? '➡️ ' : d === 'south' ? '⬇️ ' : '⬅️ ') + t(d[0].toUpperCase() + d.slice(1)), () => answerDir(d), 'btn')));
      }
      ask.textContent = q.type === 'find' ? '👆 ' + t('Tap') + ' ' + t(q.a) : `🧭 ${t('Which way from')} ${t(q.a)} ${t('to')} ${t(q.b)}?`;
      locked = false; flash = null; draw();
    }
    function result(ok, why) {
      if (locked) return; locked = true; asked++; if (ok) score++;
      msg.className = 'note ' + (ok ? 'ok' : 'warn'); msg.textContent = (ok ? '🎉 ' : '🤔 ') + why;
      if (ok) api.say(q.type === 'find' ? t('Yes! Well done.') : t('North is up on this map, east is to the right.'));
      if (asked >= total) {
        if (!done) { done = true; api.complete(score / total, t('Found continents and used compass directions.')); }
        msg.textContent += ' ⭐ ' + score + '/' + total;
      } else tm.push(setTimeout(newQ, 1400));
    }
    function answerDir(d) { result(d === q.ans, d === q.ans ? t('Correct!') : t('It is') + ' ' + t(q.ans) + '.'); }

    function draw() {
      const { ctx, w } = c, H = 230, sx = w / 100, sy = Math.min(H / 50, sx * 1.0) ;
      c.sx = sx; c.sy = H / 50;
      ctx.fillStyle = '#2a6fb0'; ctx.fillRect(0, 0, w, H);
      for (const [n, v] of Object.entries(C)) {
        ctx.beginPath(); v.p.forEach(([x, y], i) => i ? ctx.lineTo(x * sx, y * c.sy) : ctx.moveTo(x * sx, y * c.sy)); ctx.closePath();
        ctx.fillStyle = v.col; ctx.fill(); ctx.strokeStyle = (flash === n) ? '#fff' : '#0003'; ctx.lineWidth = flash === n ? 4 : 1; ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('N ⬆', w - 44, 22); ctx.font = '12px sans-serif'; ctx.fillText('E →', w - 40, 40);
      if (q && q.type === 'dir') for (const n of [q.a, q.b]) { const [x, y] = cen(n); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x * sx, y * c.sy, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(n === q.a ? 'A' : 'B', x * sx - 4, y * c.sy + 4); }
    }
    c.el.addEventListener('pointerdown', ev => {
      if (!q || q.type !== 'find' || locked) return;
      const p = pointer(c.el, ev), pt = [p.x / c.sx, p.y / c.sy];
      const hit = Object.keys(C).find(n => inside(pt, C[n].p));
      if (!hit) { msg.className = 'note'; msg.textContent = t('That is ocean. Try again!'); return; }
      flash = hit; draw();
      result(hit === q.a, hit === q.a ? t('Correct!') : t('That is') + ' ' + t(hit) + '.');
    });
    c.onResize = draw;
    root.append(h('div', { class: 'lab' }, ask, c.el, dirBtns, msg));
    newQ();
    return () => { tm.forEach(clearTimeout); };
  },
};
