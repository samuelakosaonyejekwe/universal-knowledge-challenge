// Trace the Letter in 3D: a big raised letter made of beads on an easel, inked by a pen that the player guides.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

// The same letters as the flat lab (js/labs/w10-script-tracer.js).
const SETS = {
  en: ['A', 'B', 'C', 'D', 'E', 'M', 'O', 'S', 'T', 'W'],
  es: ['A', 'E', 'I', 'O', 'U', 'Ñ', 'L', 'M', 'S', 'P'],
  fr: ['A', 'E', 'É', 'È', 'Ç', 'O', 'M', 'S', 'L', 'B'],
  ar: ['ا', 'ب', 'ت', 'ج', 'د', 'ر', 'س', 'م', 'ن', 'ه'],
  ru: ['А', 'Б', 'В', 'Д', 'Е', 'Ж', 'З', 'М', 'О', 'Я'],
  he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ל', 'מ', 'ש', 'ת'],
  it: ['A', 'E', 'I', 'O', 'U', 'M', 'S', 'L', 'G', 'B'],
  el: ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Λ', 'Ο', 'Σ', 'Ω', 'Π'],
  tr: ['A', 'E', 'İ', 'I', 'Ç', 'Ş', 'Ğ', 'Ö', 'Ü', 'O'],
  pt: ['A', 'E', 'Ã', 'Ç', 'Õ', 'O', 'M', 'S', 'L', 'B'],
  zh: ['一', '二', '三', '人', '大', '小', '山', '水', '日', '月'],
  ja: ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'さ', 'た', 'な'],
};

// ----- the model: the same scoring as the flat lab, on a 64 × 64 grid of cells -----
const G = 64, PEN = 3.2;            // grid size and pen radius, in cells
const NEED = 0.8, SPILL_MAX = 120;  // at least 80 % of the letter covered, at most 120 cells of ink far outside it
export const model = {
  G, PEN, NEED, SPILL_MAX,
  // A tracing sheet for one letter mask: the cells of the letter, and the cells within 3 cells of it (ink there is not counted as spill).
  sheet(mask) {
    const near = new Uint8Array(G * G); let n = 0;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (mask[y * G + x]) { n++; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < G && Y < G) near[Y * G + X] = 1; } }
    return { mask, near, n, cover: new Uint8Array(G * G), spill: new Uint8Array(G * G) };
  },
  // Presses the round pen tip down at (gx, gy).
  stamp(s, gx, gy) {
    for (let y = Math.max(0, Math.floor(gy - PEN)); y <= Math.min(G - 1, Math.ceil(gy + PEN)); y++)
      for (let x = Math.max(0, Math.floor(gx - PEN)); x <= Math.min(G - 1, Math.ceil(gx + PEN)); x++)
        if ((x - gx) ** 2 + (y - gy) ** 2 <= PEN * PEN) { const i = y * G + x; if (s.mask[i]) s.cover[i] = 1; else if (!s.near[i]) s.spill[i] = 1; }
  },
  score(s) { let cv = 0, sp = 0; for (let i = 0; i < G * G; i++) { cv += s.cover[i] & s.mask[i]; sp += s.spill[i]; } return { cov: s.n ? cv / s.n : 0, sp }; },
  passed(s) { const { cov, sp } = model.score(s); return s.n > 20 && cov >= NEED && sp <= SPILL_MAX; },
  // Splits the letter into beads: one for each block of the pad that holds part of the letter. A bead sits on a cell of
  // the letter, so pressing the pen on it never spills; a block whose cells are too spread out for one press is split in four.
  beads(mask, B, cap = 48) {
    const out = [], all = []; for (let i = 0; i < G * G; i++) if (mask[i]) all.push(i);
    const split = (cells, size, depth) => {
      const groups = new Map();
      for (const i of cells) { const k = Math.floor((i % G) / size) + 100 * Math.floor(Math.floor(i / G) / size); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
      for (const g of groups.values()) {
        let sx = 0, sy = 0; for (const i of g) { sx += i % G; sy += Math.floor(i / G); } sx /= g.length; sy /= g.length;
        let best = g[0], bd = 1e9, far = 0;
        for (const i of g) { const d = (i % G - sx) ** 2 + (Math.floor(i / G) - sy) ** 2; if (d < bd) { bd = d; best = i; } }
        const gx = best % G, gy = Math.floor(best / G);
        for (const i of g) far = Math.max(far, (i % G - gx) ** 2 + (Math.floor(i / G) - gy) ** 2);
        if (far > PEN * PEN && depth < 1) split(g, size / 2, depth + 1);
        else if (g.length >= 3) out.push({ gx, gy, cells: g, small: depth > 0 });
      }
    };
    split(all, G / B, 0);
    return out.sort((a, b) => b.cells.length - a.cells.length).slice(0, cap);
  },
  // Joins the beads into strokes: start at the top, keep stepping to the nearest bead that is close enough, lift the pen when none is.
  strokes(beads, reach) {
    const left = new Set(beads), out = [];
    while (left.size) {
      let cur = null; for (const b of left) if (!cur || b.gy < cur.gy || (b.gy === cur.gy && b.gx < cur.gx)) cur = b;
      const st = [cur]; left.delete(cur);
      for (;;) { let nx = null, nd = reach * reach; for (const b of left) { const d = (b.gx - cur.gx) ** 2 + (b.gy - cur.gy) ** 2; if (d <= nd) { nd = d; nx = b; } } if (!nx) break; st.push(nx); left.delete(nx); cur = nx; }
      out.push(st);
    }
    return out;
  },
  // A practice shape for devices that cannot draw the letter: one wavy line.
  wave() { const m = new Uint8Array(G * G); for (let x = 10; x <= 54; x++) { const y = 32 + 13 * Math.sin(((x - 10) / 44) * Math.PI * 2); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 7) { const X = x + dx, Y = Math.round(y) + dy; m[Y * G + X] = 1; } } return m; },
};
// Used by the automated tests. Hand-worked: a round pen of radius 3.2 cells covers 37 cells; pressed at (40, 32) on a bar that
// fills columns 30–49 and rows 30–35 (120 cells), 34 of them are on the bar (the 3 in the row three above it are not): 34 / 120 = 28.3 %.
export function selfTest() {
  const bar = new Uint8Array(G * G); for (let y = 30; y <= 35; y++) for (let x = 30; x <= 49; x++) bar[y * G + x] = 1;
  const s = model.sheet(bar); model.stamp(s, 40, 32); const one = model.score(s);
  model.stamp(s, 8, 8); const far = model.score(s).sp;                                  // far from the bar: all 37 cells are spill
  model.stamp(s, 40, 30); const edge = model.score(s).sp;                               // on the edge of the bar: the stray ink is within 3 cells of it, so no new spill
  for (let x = 30; x <= 49; x++) { model.stamp(s, x, 32); model.stamp(s, x, 33); } const full = model.score(s);
  // every bead plan must cover its shape without spilling
  let plans = true; const ring = new Uint8Array(G * G), tee = new Uint8Array(G * G);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const d = Math.hypot(x - 32, y - 32); if (d >= 14 && d <= 20) ring[y * G + x] = 1; if ((y >= 12 && y <= 17 && x >= 14 && x <= 50) || (x >= 29 && x <= 34 && y >= 12 && y <= 52)) tee[y * G + x] = 1; }
  const detail = [];
  for (const [name, m] of [['wave', model.wave()], ['ring', ring], ['tee', tee]]) for (const B of [10, 12]) {
    const sh = model.sheet(m), beads = model.beads(m, B); for (const b of beads) model.stamp(sh, b.gx, b.gy);
    const r = model.score(sh); if (!(r.cov >= NEED && r.sp === 0 && beads.length >= 4 && beads.length <= 48)) plans = false;
    if (B === 10) detail.push(`${name} ${beads.length} beads ${(r.cov * 100).toFixed(0)} %`);
  }
  const ok = Math.abs(one.cov - 34 / 120) < 1e-9 && one.sp === 0 && far === 37 && edge === 37 && full.cov === 1 && model.passed(s) && plans;
  return { ok, detail: `one press ${(one.cov * 100).toFixed(1)} % (34/120), far press ${far} spill cells, whole bar ${(full.cov * 100).toFixed(0)} %; ${detail.join(', ')}` };
}

export default {
  id: 'w10-script-tracer',
  world: 10,
  levels: [1, 2],
  title: 'Trace the Letter',
  goal: 'Trace the big raised letter with the pen until at least 80 % of it is covered, without inking far outside it.',
  kind: 'validated',
  model: 'The letter is drawn with your device font, so its shape may differ a little from handwriting, and it is turned into raised beads on a 64 × 64 grid. A round pen tip 3.2 cells wide in radius inks the cells it touches; the lab counts the share of the letter covered (80 % needed) and the ink more than 3 cells outside it (at most 120 cells). Only the covered area and the spill are scored, not stroke order or direction: the pen\'s own path simply joins neighbouring beads from the top down and is not the handwriting order. If the device cannot draw the letter, a wavy practice line is shown instead.',
  mount(ctx) {
    const { THREE, group, ui } = ctx;
    const lang = SETS[ctx.lang] ? ctx.lang : 'es', set = SETS[lang];
    const B = ctx.level >= 2 ? 12 : 10;                      // level 2: smaller beads, so more careful tracing
    const W = 4.2, cell = W / G;                             // the pad is 4.2 m wide
    const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const wood = ctx.mat('#a8643c', { roughness: 0.8 }), cream = ctx.mat('#fff7ef', { roughness: 0.7 });
    const mBase = ctx.mat('#b9a7e6', { roughness: 0.6 }), mHalf = ctx.lit('#ffd43b', 0.5), mFull = ctx.lit('#ff6b3d', 0.9), mNext = ctx.lit('#38d9a9', 0.7);

    // the easel: a tilted pad on legs, with a tray for the pen
    const pad = new THREE.Group(); pad.position.set(0, 2.55, 0.1); pad.rotation.x = -0.3; group.add(pad);
    const board = add(new THREE.BoxGeometry(W + 0.4, W + 0.4, 0.2), cream, 0, 0, -0.1, pad);
    add(new THREE.BoxGeometry(W + 0.7, 0.16, 0.5), wood, 0, -W / 2 - 0.28, 0.1, pad);
    for (const x of [-1.9, 1.9]) { const leg = add(new THREE.CylinderGeometry(0.09, 0.09, 4.9, 8), wood, x, 2.3, -1.45); leg.rotation.x = 0.42; }
    add(new THREE.BoxGeometry(4.2, 0.12, 0.12), wood, 0, 1.0, -1.05);
    // the grey letter printed on the pad (only where the device can draw it)
    let inkCanvas = null, inkTex = null;
    const fontStr = (s) => `${Math.round(s * 0.8)}px "Noto Sans","Noto Sans Arabic","Noto Sans Hebrew","Noto Sans CJK SC","Noto Sans CJK JP",sans-serif`;
    try {
      if (typeof document !== 'undefined') {
        inkCanvas = document.createElement('canvas'); inkCanvas.width = inkCanvas.height = 256;
        inkTex = new THREE.CanvasTexture(inkCanvas);
        const print = add(new THREE.PlaneGeometry(W, W), new THREE.MeshBasicMaterial({ map: inkTex, transparent: true, depthWrite: false }), 0, 0, 0.012, pad); print.castShadow = false;
      }
    } catch { inkCanvas = null; }
    // the pen
    const pen = new THREE.Group(); pen.position.set(W / 2 - 0.3, -W / 2 - 0.05, 0.7); pad.add(pen);
    const penBody = add(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 10), ctx.mat('#ffd43b', { roughness: 0.4 }), 0, 0, 0.8, pen); penBody.rotation.x = Math.PI / 2;
    const penTip = add(new THREE.ConeGeometry(0.11, 0.26, 10), ctx.mat('#2b1b4d', { roughness: 0.4 }), 0, 0, 0.12, pen); penTip.rotation.x = -Math.PI / 2;
    pen.rotation.set(-0.35, 0.3, 0);
    const blots = [0, 1, 2, 3].map(() => { const b = add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14), ctx.mat('#c2255c', { roughness: 0.9 }), 0, 0, 0.02, pad); b.rotation.x = Math.PI / 2; b.visible = false; return b; });
    let blotN = 0;
    const title = { s: null };
    const beadGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
    const toPad = (gx, gy) => [(gx + 0.5) / G * W - W / 2, W / 2 - (gy + 0.5) / G * W];

    let ch = null, sheet = null, beads = [], plan = [], strokeI = 0, queue = [], lifts = 0, guess = null, done = false, last = null, auto = false, autoWait = 0, usedFont = false, home = true;
    const rLetter = ui.readout('Letter'), rCov = ui.readout('Covered'), rSpill = ui.readout('Ink outside the letter'), rLifts = ui.readout('Pen lifts'), rLeft = ui.readout('Strokes left');
    ui.note('Guess first: how many times will the pen lift?');
    ui.choice([[1, '1'], [2, '2'], [3, '3'], [4, '4']], null, (v) => { guess = v; });
    ui.button('✍️ Trace the next stroke', () => nextStroke(), 'btn');
    ui.button('Clear', () => wipe(), 'btn ghost sm');
    ui.button('Next letter', () => newChar(), 'btn ghost sm');
    ui.note('Tap along the raised letter to ink it yourself, or let the pen trace one stroke at a time. Green beads show where the next stroke goes.');

    // Reads the letter's shape from the device font, exactly as the flat lab does; falls back to the practice wave.
    function glyphMask(c) {
      try {
        if (typeof document === 'undefined') return null;
        const off = document.createElement('canvas'); off.width = off.height = G;
        const o = off.getContext('2d');
        o.fillStyle = '#000'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.font = fontStr(G);
        o.fillText(c, G / 2, G / 2 + G * 0.04);
        const d = o.getImageData(0, 0, G, G).data, m = new Uint8Array(G * G); let n = 0;
        for (let i = 0; i < G * G; i++) if (d[i * 4 + 3] > 100) { m[i] = 1; n++; }
        return n > 20 ? m : null;
      } catch { return null; }
    }
    function printLetter() {
      if (!inkCanvas) return;
      try {
        const g = inkCanvas.getContext('2d'), S = 256; g.clearRect(0, 0, S, S);
        if (usedFont) { g.fillStyle = 'rgba(80,90,140,0.3)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = fontStr(S); g.fillText(ch, S / 2, S / 2 + S * 0.04); }
        inkTex.needsUpdate = true;
      } catch { /* no drawing surface */ }
    }
    function newChar() {
      let next; do { next = set[Math.floor(ctx.rng() * set.length) % set.length]; } while (next === ch && set.length > 1);
      ch = next;
      const m = glyphMask(ch); usedFont = !!m;
      sheet = model.sheet(m || model.wave());
      for (const b of beads) pad.remove(b.mesh);
      beads = model.beads(sheet.mask, B);
      for (const b of beads) {
        const [x, y] = toPad(b.gx, b.gy), r = (b.small ? 0.3 : 0.46) * (W / B);
        b.mesh = add(beadGeo, mBase, x, y, 0.1, pad); b.mesh.rotation.x = Math.PI / 2; b.mesh.scale.set(r * 2, 0.2, r * 2); b.h = 0.2; b.lit = 0;
        ctx.onTap(b.mesh, (o, p) => tapAt(p));
      }
      plan = model.strokes(beads, (G / B) * 1.7);
      if (title.s) { group.remove(title.s); title.s.material.map?.dispose?.(); title.s.material.dispose?.(); }
      title.s = ctx.sprite(ch, { size: 0.8, bg: 'rgba(14,18,48,.78)' }); title.s.position.set(-2.9, 4.55, 0.3); group.add(title.s);
      rLetter.set(usedFont ? ch : `${ch} (practice wave)`);
      printLetter(); wipe(true);
      ctx.say(usedFont ? 'Follow the raised letter with the pen. Tap along it, or trace it one stroke at a time.' : 'This device cannot draw the letter here, so trace the wavy practice line instead. Tap along it, or trace it one stroke at a time.');
    }
    function wipe(quiet) {
      sheet.cover.fill(0); sheet.spill.fill(0); strokeI = 0; queue = []; lifts = 0; done = false; last = null; home = true;
      for (const b of blots) b.visible = false;
      report(); mark();
      if (!quiet) ctx.say('The pad is clean. Start again from the top of the letter.');
    }
    // Lights each bead by how much of its part of the letter is inked, and shows where the next stroke will go.
    function mark() {
      const nextSet = new Set(queue.length ? [] : plan[strokeI] || []);
      for (const b of beads) {
        let c = 0; for (const i of b.cells) c += sheet.cover[i]; b.lit = c / b.cells.length;
        b.mesh.material = b.lit >= 0.7 ? mFull : b.lit >= 0.2 ? mHalf : nextSet.has(b) && !done ? mNext : mBase;
        b.h = b.lit >= 0.7 ? 0.55 : b.lit >= 0.2 ? 0.35 : 0.2;
      }
    }
    function report() {
      const { cov, sp } = model.score(sheet), pct = Math.round(cov * 100);
      rCov.set(`${pct} % (80 % needed)`); rSpill.set(`${sp} cells (120 allowed)`); rLifts.set(String(lifts)); rLeft.set(String(Math.max(0, plan.length - strokeI)));
      return { cov, sp, pct };
    }
    // Checks the tracing after the pen lifts, with the same rule as the flat lab.
    function judge(why) {
      const { cov, sp, pct } = report(); mark();
      if (done) return;
      if (model.passed(sheet)) {
        done = true;
        const bonus = guess === lifts;
        ctx.say(`Great tracing! ${pct} % of the letter is covered with ${lifts} pen lifts${guess == null ? '' : bonus ? ', just as you guessed' : `, and you guessed ${guess}`}. Tracing trains your hand to remember the shape of each letter.`);
        ctx.complete(Math.max(0.6, Math.min(1, (cov - 0.1) + (bonus ? 0.1 : 0))), `Traced "${ch}" with ${pct}% covered.`);
      } else if (sp > SPILL_MAX) ctx.say(`Too much ink landed outside the letter: ${sp} cells, and only 120 are allowed. Press Clear and stay on the raised beads.`);
      else ctx.say(why || `${pct} % of the letter is covered so far. It needs 80 %, so keep following the shape.`);
    }
    // One press of the pen at a point of the grid; a press close to the last one is joined to it, like dragging a finger.
    function press(gx, gy) {
      if (last && Math.hypot(gx - last[0], gy - last[1]) <= (G / B) * 1.8) { const n = Math.ceil(Math.hypot(gx - last[0], gy - last[1])); for (let k = 1; k <= n; k++) model.stamp(sheet, last[0] + ((gx - last[0]) * k) / n, last[1] + ((gy - last[1]) * k) / n); }
      else { lifts++; model.stamp(sheet, gx, gy); }
      last = [gx, gy];
    }
    const inv = new THREE.Matrix4();
    function tapAt(point) {
      if (done || queue.length || !point) return;
      pad.updateMatrix(); inv.copy(pad.matrix).invert();
      const p = point.clone().applyMatrix4(inv), gx = (p.x / W + 0.5) * G - 0.5, gy = (0.5 - p.y / W) * G - 0.5;
      if (gx < 0 || gy < 0 || gx > G - 1 || gy > G - 1) return;
      const before = model.score(sheet).sp;
      press(gx, gy); pen.position.set(p.x, p.y, 0.25); home = false;
      const sp = model.score(sheet).sp;
      if (sp > before) { const b = blots[blotN++ % blots.length]; b.position.set(p.x, p.y, 0.02); b.visible = true; judge('That press landed off the letter, so it left a blot. Ink outside the shape is spill: stay on the raised beads.'); }
      else judge();
    }
    ctx.onTap(board, (o, p) => tapAt(p));
    // The pen traces the next stroke of the plan; when every bead is done it touches up any part still bare.
    function nextStroke() {
      if (done || queue.length) return;
      let st = plan[strokeI];
      if (st) strokeI++;
      else {
        st = []; const seen = new Uint8Array(G * G);
        for (let i = 0; i < G * G && st.length < 12; i++) if (sheet.mask[i] && !sheet.cover[i] && !seen[i]) { st.push({ gx: i % G, gy: Math.floor(i / G) }); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = (i % G) + dx, Y = Math.floor(i / G) + dy; if (X >= 0 && Y >= 0 && X < G && Y < G) seen[Y * G + X] = 1; } }
        if (!st.length) { judge(); return; }
      }
      queue = st.slice(); last = null; lifts++; home = false; mark(); report();
    }
    newChar();

    const target = new THREE.Vector3();
    return {
      step(dt) {
        if (queue.length) {
          const b = queue[0], [x, y] = toPad(b.gx, b.gy); target.set(x, y, 0.25);
          const d = pen.position.distanceTo(target), go = 2.6 * dt;
          if (d <= go) { pen.position.copy(target); model.stamp(sheet, b.gx, b.gy); queue.shift(); if (queue.length) { mark(); report(); } else judge(); }
          else pen.position.lerp(target, go / d);
        } else if (auto && !done) { autoWait -= dt; if (autoWait <= 0) { autoWait = 0.35; nextStroke(); } }
        for (const b of beads) b.mesh.scale.y += (b.h - b.mesh.scale.y) * Math.min(1, dt * 10);
      },
      frame(dt, time) {
        if (!queue.length && !ctx.calm) pen.position.z += ((home ? 0.7 : 0.45) + Math.sin(time * 2) * 0.05 - pen.position.z) * Math.min(1, dt * 4);
      },
      // Traces the whole letter stroke by stroke with the same button the player uses.
      autoplay() { auto = true; autoWait = 0.2; },
      dispose() { if (title.s) { title.s.material.map?.dispose?.(); title.s.material.dispose?.(); } inkTex?.dispose?.(); beadGeo.dispose(); queue = []; auto = false; },
    };
  },
};
