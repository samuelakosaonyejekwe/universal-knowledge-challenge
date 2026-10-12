import { h, button, readout, canvas, loop, predict, pointer } from '../core/labkit.js';

const EL = { H: { v: 1, c: '#f4f4f4', r: 14 }, O: { v: 2, c: '#ff5a5a', r: 19 }, N: { v: 3, c: '#5a86ff', r: 19 }, C: { v: 4, c: '#8a8f9c', r: 20 } };
const TARGETS = [
  ['water', 'H₂O', { H: 2, O: 1 }], ['ammonia', 'NH₃', { N: 1, H: 3 }], ['methane', 'CH₄', { C: 1, H: 4 }],
  ['carbon dioxide', 'CO₂', { C: 1, O: 2 }], ['oxygen gas', 'O₂', { O: 2 }], ['nitrogen gas', 'N₂', { N: 2 }],
  ['hydrogen cyanide', 'HCN', { H: 1, C: 1, N: 1 }], ['formaldehyde', 'CH₂O', { C: 1, H: 2, O: 1 }],
];

// Molecule builder: atoms want a full set of bonds (valence).
export default {
  id: 'w02-molecule-builder',
  world: 2,
  levels: [3, 4],
  kind: 'lab',
  icon: '🧪',
  title: 'Molecule Builder',
  goal: 'Build the molecule so that every atom has exactly its number of bonds.',
  limits: 'Atoms are joined by single, double or triple bonds with fixed valences (H 1, O 2, N 3, C 4). Real molecules have 3D shapes and some atoms can bond in other ways; here the drawing is flat.',
  mount(root, api) {
    const t = api.t;
    const target = TARGETS[Math.floor(api.rng() * TARGETS.length)];
    const total = Object.values(target[2]).reduce((a, b) => a + b, 0);
    let atoms = [], bonds = {}, sel = -1, drag = null, done = false, predictedOk = false;

    const cv = canvas(280);
    const msg = h('div', { class: 'note', 'aria-live': 'polite' }, t('Mission: build ') + t(target[0]) + ' (' + target[1] + t('). Tap an atom button to add it. Tap one atom, then another, to join them. Tap again for a double or triple bond.'));
    const pred = predict({ question: t('How many atoms are in one molecule of ') + target[1] + '?', truth: total, tolerance: 0.01, onResult: (e) => { predictedOk = predictedOk || e < 0.01; } });
    const stat = readout(t('Atoms'), '0');

    const key = (i, j) => (i < j ? i + '-' + j : j + '-' + i);
    const used = (i) => Object.entries(bonds).reduce((s, [k, o]) => { const [a, b] = k.split('-').map(Number); return s + (a === i || b === i ? o : 0); }, 0);
    const add = (sym) => {
      if (atoms.length >= 12) return;
      const n = atoms.length, a = n * 2.4;
      const W = cv.w, R = Math.min(W, 280) * 0.32;
      atoms.push({ s: sym, x: W / 2 + R * Math.cos(a) * (n ? 1 : 0), y: 140 + R * Math.sin(a) * (n ? 1 : 0) });
      stat.set(String(atoms.length));
    };
    const at = (p) => atoms.findIndex((a) => Math.hypot(a.x - p.x, a.y - p.y) < EL[a.s].r + 6);

    cv.el.addEventListener('pointerdown', (e) => {
      const i = at(pointer(cv.el, e));
      if (i < 0) { sel = -1; return; }
      cv.el.setPointerCapture?.(e.pointerId);
      drag = { i, moved: false, sx: e.clientX, sy: e.clientY };
    });
    cv.el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      if (drag.moved) { const p = pointer(cv.el, e); atoms[drag.i].x = Math.max(16, Math.min(cv.w - 16, p.x)); atoms[drag.i].y = Math.max(16, Math.min(264, p.y)); }
    });
    const up = () => {
      if (drag && !drag.moved) {
        const i = drag.i;
        if (sel < 0 || sel === i) sel = sel === i ? -1 : i;
        else {
          const k = key(sel, i), o = ((bonds[k] || 0) + 1) % 4;
          if (o) bonds[k] = o; else delete bonds[k];
          sel = -1;
        }
      }
      drag = null;
    };
    cv.el.addEventListener('pointerup', up); cv.el.addEventListener('pointercancel', up);

    const connected = () => {
      if (!atoms.length) return false;
      const seen = new Set([0]), q = [0];
      while (q.length) { const c = q.pop(); for (const k of Object.keys(bonds)) { const [a, b] = k.split('-').map(Number); const o = a === c ? b : b === c ? a : -1; if (o >= 0 && !seen.has(o)) { seen.add(o); q.push(o); } } }
      return seen.size === atoms.length;
    };
    const check = () => {
      const cnt = {}; atoms.forEach((a) => { cnt[a.s] = (cnt[a.s] || 0) + 1; });
      const same = Object.keys({ ...cnt, ...target[2] }).every((k) => (cnt[k] || 0) === (target[2][k] || 0));
      const bad = atoms.findIndex((a, i) => used(i) !== EL[a.s].v);
      if (!same) { msg.className = 'note warn'; msg.textContent = t('You need exactly these atoms: ') + target[1] + '. ' + t('You have ') + atoms.length + t(' atoms.'); }
      else if (bad >= 0) { msg.className = 'note warn'; const a = atoms[bad]; msg.textContent = t('Atom ') + a.s + t(' has ') + used(bad) + t(' bonds but wants ') + EL[a.s].v + '.'; api.say(t('Each atom wants its own number of bonds: H 1, O 2, N 3, C 4. A double bond counts as two.')); }
      else if (!connected()) { msg.className = 'note warn'; msg.textContent = t('Some atoms are not joined to the rest.'); }
      else if (!done) {
        done = true; msg.className = 'note ok'; msg.textContent = t('You built ') + t(target[0]) + ' (' + target[1] + ')! 🎉';
        api.say(t('Every atom has all the bonds it wants, so the molecule is stable. Sharing electrons makes those bonds.'));
        api.complete(predictedOk ? 1 : 0.85, t('Atoms bond so each has its full number of bonds (valence): H 1, O 2, N 3, C 4.'));
      }
    };

    const stop = loop(() => {
      const c = cv.ctx, W = cv.w;
      c.fillStyle = '#10183d'; c.fillRect(0, 0, W, 280);
      for (const [k, o] of Object.entries(bonds)) {
        const [a, b] = k.split('-').map(Number), A = atoms[a], B = atoms[b];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d * 4, ny = dx / d * 4;
        c.strokeStyle = '#dfe6ff'; c.lineWidth = 3;
        for (let q = 0; q < o; q++) { const f = q - (o - 1) / 2; c.beginPath(); c.moveTo(A.x + nx * f, A.y + ny * f); c.lineTo(B.x + nx * f, B.y + ny * f); c.stroke(); }
      }
      c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      atoms.forEach((a, i) => {
        const u = used(i), v = EL[a.s].v;
        c.fillStyle = EL[a.s].c; c.beginPath(); c.arc(a.x, a.y, EL[a.s].r, 0, 7); c.fill();
        c.lineWidth = i === sel ? 5 : 3; c.strokeStyle = i === sel ? '#ffd24a' : u === v ? '#2bc48a' : u > v ? '#f0708a' : '#ffb347'; c.stroke();
        c.fillStyle = '#111'; c.fillText(a.s, a.x, a.y);
        c.fillStyle = '#fff'; c.font = '11px sans-serif'; c.fillText(u + '/' + v, a.x, a.y + EL[a.s].r + 10); c.font = 'bold 14px sans-serif';
      });
      if (!atoms.length) { c.fillStyle = '#9fb0ff'; c.fillText(t('Add atoms with the buttons below'), W / 2, 140); }
    });

    root.append(h('div', { class: 'lab' },
      h('div', { class: 'lab-goal' }, t('Build the molecule so that every atom has exactly its number of bonds.')),
      msg, pred, cv.el,
      h('div', { class: 'lab-row' }, ...Object.keys(EL).map((s) => button(s + ' (' + EL[s].v + ')', () => add(s), 'btn ghost sm'))),
      h('div', { class: 'lab-row' },
        button(t('↶ Remove last'), () => { const n = atoms.length - 1; if (n < 0) return; for (const k of Object.keys(bonds)) if (k.split('-').map(Number).includes(n)) delete bonds[k]; atoms.pop(); sel = -1; stat.set(String(atoms.length)); }, 'btn ghost sm'),
        button(t('🗑 Clear'), () => { atoms = []; bonds = {}; sel = -1; stat.set('0'); }, 'btn ghost sm'),
        button(t('✔ Check molecule'), check, 'btn ok sm'), stat.el),
      h('div', { class: 'small muted' }, t('Ring colours: green = full, orange = wants more bonds, red = too many.'))));
    return () => { stop(); };
  },
};
