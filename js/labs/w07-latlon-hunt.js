import { h, canvas, pointer, choice, fmt, button } from '../core/labkit.js';

const LAND = [ // rough blobs in lon/lat degrees [lon, lat, rx, ry] - stylised, not real outlines
  [-100, 45, 35, 22], [-60, -15, 15, 28], [20, 5, 20, 30], [15, 50, 20, 10], [85, 45, 45, 20], [135, -25, 15, 10], [0, -80, 150, 10],
];

export default {
  id: 'w07-latlon-hunt',
  world: 7,
  levels: [3, 4],
  kind: 'lab',
  icon: '📍',
  title: 'Latitude-Longitude Treasure Hunt',
  goal: 'Place your pin on the treasure coordinates. First say which quarter of the world it is in.',
  limits: 'A flat equirectangular grid with stylised land blobs (no real coastlines). Real maps stretch the globe in different ways, and one degree of longitude shrinks toward the poles.',
  mount(root, api) {
    const t = api.t;
    const rounds = 3, tol = 10;
    let r = 0, score = 0, guess = null, quad = null, pin = null, locked = false, done = false;
    let tgt;
    const c = canvas(240);
    const info = h('div', { class: 'lab-goal', style: { textAlign: 'center' } });
    const cur = h('div', { class: 'small', 'aria-live': 'polite' });
    const msg = h('div', { class: 'note', 'aria-live': 'polite' });
    const fmtLL = (lat, lon) => `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(Math.round(lon))}°${lon >= 0 ? 'E' : 'W'}`;
    const q = choice([['NE', 'N+E'], ['NW', 'N+W'], ['SE', 'S+E'], ['SW', 'S+W']], null, v => { quad = v; msg.className = 'note'; msg.textContent = t('Now tap the map to drop your pin.'); });
    const X = lon => (lon + 180) / 360 * c.w, Y = lat => (90 - lat) / 180 * 240;
    const toLL = p => ({ lon: p.x / c.w * 360 - 180, lat: 90 - p.y / 240 * 180 });
    function newT() {
      tgt = { lat: Math.round((api.rng() * 120 - 60) / 5) * 5 || 5, lon: Math.round((api.rng() * 320 - 160) / 5) * 5 || 5 };
      info.textContent = `🏴‍☠️ ${t('Treasure')} ${r + 1}/${rounds}: ${fmtLL(tgt.lat, tgt.lon)}`;
      pin = null; guess = null; quad = null; locked = false; cur.textContent = ''; draw();
    }
    function draw() {
      const { ctx, w } = c; ctx.clearRect(0, 0, w, 240);
      ctx.fillStyle = '#2a6fb0'; ctx.fillRect(0, 0, w, 240);
      ctx.fillStyle = '#6fbf73'; for (const [lo, la, rx, ry] of LAND) { ctx.beginPath(); ctx.ellipse(X(lo), Y(la), rx / 360 * w, ry / 180 * 240, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#ffffff55'; ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
      for (let lo = -180; lo <= 180; lo += 30) { ctx.beginPath(); ctx.moveTo(X(lo), 0); ctx.lineTo(X(lo), 240); ctx.stroke(); if (lo > -180 && lo < 180) ctx.fillText(Math.abs(lo) + (lo ? (lo > 0 ? 'E' : 'W') : ''), X(lo) + 2, 236); }
      for (let la = -60; la <= 60; la += 30) { ctx.beginPath(); ctx.moveTo(0, Y(la)); ctx.lineTo(w, Y(la)); ctx.stroke(); ctx.fillText(Math.abs(la) + (la ? (la > 0 ? 'N' : 'S') : ''), 2, Y(la) - 2); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), 240); ctx.stroke(); ctx.lineWidth = 1;
      if (pin) { ctx.fillText('📍', X(pin.lon) - 7, Y(pin.lat) + 5); ctx.font = '16px sans-serif'; }
      if (locked) { ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(X(tgt.lon), Y(tgt.lat), 6, 0, 7); ctx.fill(); }
    }
    function check() {
      if (!pin || locked) return;
      if (!quad) { msg.className = 'note warn'; msg.textContent = t('Pick the quarter first (N/S and E/W).'); return; }
      locked = true;
      const rightQ = quad === (tgt.lat >= 0 ? 'N' : 'S') + (tgt.lon >= 0 ? 'E' : 'W');
      const dlat = Math.abs(pin.lat - tgt.lat), dlon = Math.abs(pin.lon - tgt.lon);
      const ok = dlat <= tol && dlon <= tol;
      if (ok) score += rightQ ? 1 : 0.7;
      msg.className = 'note ' + (ok ? 'ok' : 'warn');
      msg.textContent = (ok ? '🎉 ' : '🔁 ') + t('You placed') + ` ${fmtLL(pin.lat, pin.lon)}. ` + t('Off by') + ` ${fmt(dlat, 2)}° ${t('latitude')}, ${fmt(dlon, 2)}° ${t('longitude')}.` + (rightQ ? '' : ' ' + t('Your quarter guess was off.'));
      api.say(t('Latitude is how far north or south of the equator; longitude is how far east or west of the prime meridian.'));
      draw(); r++;
      if (r >= rounds) { if (!done) { done = true; api.complete(score / rounds, t('Read and placed latitude and longitude coordinates.')); } }
      else next.style.display = '';
    }
    const next = button('➡️ ' + t('Next treasure'), () => { next.style.display = 'none'; msg.textContent = ''; newT(); }, 'btn ok');
    next.style.display = 'none';
    c.el.addEventListener('pointerdown', ev => {
      if (locked) return; pin = toLL(pointer(c.el, ev)); cur.textContent = t('Pin at') + ' ' + fmtLL(pin.lat, pin.lon); draw();
    });
    c.onResize = draw;
    root.append(h('div', { class: 'lab' }, info, q.el, c.el, cur,
      h('div', { class: 'lab-row' }, button('✔ ' + t('Dig here'), check, 'btn'), next), msg));
    newT();
    return () => {};
  },
};
