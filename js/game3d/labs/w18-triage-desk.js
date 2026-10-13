// World 18 lab — Triage Desk in 3D: six invented patients wait on a bench and are sent to the right chairs.
// No imports: everything arrives through the context, so the file also runs in tools/test-game3d.mjs.

// ----- the model: the same invented adult ranges and the same scoring as the flat lab (a teaching game only) -----
const NORMAL = { hr: [60, 100], rr: [12, 20], t: [36.1, 37.8], o2: [95, 100] };
const CRIT = { hr: [40, 130], rr: [8, 30], t: [35, 39.5], o2: [90, 100] };
const KEYS = ['hr', 'rr', 't', 'o2'];
const SIGN = { hr: 'heart rate', rr: 'breathing rate', t: 'temperature', o2: 'oxygen' };
const NAMES = ['Sam', 'Ada', 'Leo', 'Ines', 'Omar', 'Kai'];
const CAT = [['Routine', '#51cf66'], ['Soon', '#fcc419'], ['Urgent', '#ff6b6b']];
const SHOW = { hr: [30, 170], rr: [4, 44], t: [34, 41], o2: [80, 100] };      // what each measuring tube can show, bottom to top
export const model = {
  NORMAL, CRIT,
  // 0 routine, 1 soon (a sign outside the normal range), 2 urgent (a sign in the danger range)
  level(v) {
    let sev = 0;
    for (const k of KEYS) {
      if (v[k] < CRIT[k][0] || (v[k] > CRIT[k][1] && k !== 'o2')) return 2;
      if (v[k] < NORMAL[k][0] || v[k] > NORMAL[k][1]) sev = Math.max(sev, 1);
    }
    return sev;
  },
  outside: (v) => KEYS.filter((k) => v[k] < NORMAL[k][0] || v[k] > NORMAL[k][1]),
  // exactly right scores 1, more urgent than needed is safe and scores 0.6, less urgent than needed scores nothing
  mark: (guess, answer) => (guess === answer ? 1 : guess > answer ? 0.6 : 0),
  passes: (score, under) => score >= 0.7 && !under,
  patient(cat, r) {
    const between = (a, b, d = 0) => +(a + r() * (b - a)).toFixed(d), pick = (arr) => arr[Math.floor(r() * arr.length)];
    const v = { hr: between(65, 95), rr: between(13, 19), t: between(36.3, 37.6, 1), o2: between(96, 99) };
    if (cat >= 1) { const k = pick(KEYS); v[k] = { hr: between(105, 125), rr: between(22, 27), t: between(38.0, 39.2, 1), o2: between(91, 94) }[k]; }
    if (cat === 2) { const k = pick(KEYS); v[k] = { hr: between(135, 160), rr: between(32, 40), t: between(39.7, 40.5, 1), o2: between(82, 89) }[k]; }
    return v;
  },
};
// Used by the automated tests: hand-worked patients, the edges of each range, the scoring, and 600 generated patients.
export function selfTest() {
  const base = { hr: 72, rr: 16, t: 36.8, o2: 98 }, L = (o) => model.level({ ...base, ...o });
  const hand = [[{}, 0], [{ hr: 100 }, 0], [{ hr: 110 }, 1], [{ hr: 130 }, 1], [{ hr: 131 }, 2], [{ hr: 38 }, 2], [{ rr: 24 }, 1], [{ rr: 35 }, 2], [{ t: 38.5 }, 1], [{ t: 39.9 }, 2], [{ o2: 95 }, 0], [{ o2: 93 }, 1], [{ o2: 90 }, 1], [{ o2: 85 }, 2], [{ hr: 110, o2: 85 }, 2]];
  const bad = hand.filter(([o, want]) => L(o) !== want);
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let made = 0; for (let i = 0; i < 600; i++) { const cat = i % 3; if (model.level(model.patient(cat, r)) === cat) made++; }
  const allUrgent = (2 * 1 + 4 * 0.6) / 6, oneMissed = (5 * 1 + 0) / 6;
  const ok = !bad.length && made === 600 && model.mark(1, 1) === 1 && model.mark(2, 0) === 0.6 && model.mark(0, 2) === 0
    && model.passes(1, 0) && model.passes(allUrgent, 0) && !model.passes(oneMissed, 1) && !model.passes(0.6, 0) && model.outside({ ...base, t: 38.5, o2: 93 }).join() === 't,o2';
  return { ok, detail: `${hand.length - bad.length}/${hand.length} hand-worked patients sorted correctly (heart 110 → soon, 131 → urgent; oxygen 93 % → soon, 85 % → urgent); ${made}/600 generated patients match their group; one missed urgent patient fails the shift even at ${(oneMissed * 100).toFixed(0)} %` };
}

export default {
  id: 'w18-triage-desk',
  world: 18,
  levels: [3, 4],
  title: 'Triage Desk',
  goal: 'Sort six invented patients by urgency using the normal ranges. When unsure, escalate.',
  kind: 'validated',
  model: 'Each invented patient has four vital signs. A sign outside the normal range (heart 60–100 beats a minute, breaths 12–20 a minute, temperature 36.1–37.8 °C, oxygen 95–100 %) means "soon"; a sign in the danger range (heart under 40 or over 130, breaths under 8 or over 30, temperature under 35 or over 39.5, oxygen under 90) means "urgent". Exactly right scores 1, more urgent than needed scores 0.6 and less urgent scores nothing; the shift passes at 70 % with no patient under-triaged. All patients are fictional and this is an educational simulation, never medical advice. Real triage also uses age, symptoms, history and clinical judgement, and ranges differ for children. Only four vital signs are used here.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, T = ctx.t || ((x) => x), level = ctx.level || 3, calm = !!ctx.calm, rng = ctx.rng || Math.random;
    const own = [];
    const keep = (x) => { own.push(x); return x; };
    const add = (g, m, x, y, z, parent = group) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    const label = (text, o) => { const s = ctx.sprite(text, o); s.userData.own = [s.material.map, s.material]; return s; };
    const drop = (s) => { s.removeFromParent(); for (const x of s.userData.own || []) x.dispose(); };
    const white = ctx.mat('#ffffff', { roughness: 0.55 }), wood = ctx.mat('#c99a6b'), grey = ctx.mat('#ced4da', { roughness: 0.6 });
    const lamp = CAT.map(([, c]) => ctx.lit(c, 0.9)), soft = CAT.map(([, c]) => ctx.mat(c, { roughness: 0.8 }));
    const shirts = ['#74c0fc', '#b197fc', '#63e6be', '#ffc078', '#f783ac', '#a9e34b'].map((c) => ctx.mat(c, { roughness: 0.7 })), face = ctx.mat('#ffd9b8', { roughness: 0.7 });

    // the waiting bench at the back, and three mats with chairs at the front: green, amber, red
    const BZ = -1.5, SEAT = 0.5, ZX = [-2.35, 0, 2.35], ZZ = 1.35;
    add(keep(new THREE.BoxGeometry(6.6, SEAT, 0.7)), wood, 0, SEAT / 2, BZ);
    const matG = keep(new THREE.BoxGeometry(2.0, 0.06, 1.7)), stoolG = keep(new THREE.CylinderGeometry(0.3, 0.34, 0.4, 16));
    const mats = CAT.map(([name], k) => {
      const m = add(matG, soft[k], ZX[k], 0.03, ZZ); m.castShadow = false;
      for (const sx of [-0.5, 0.5]) add(stoolG, white, ZX[k] + sx, 0.2, ZZ - 0.25);
      const s = label(T(name), { size: 0.42 }); s.position.set(ZX[k], 0.5, ZZ + 1.0); group.add(s); own.push(...s.userData.own);
      ctx.onTap(m, () => pick(k));
      return m;
    });
    const slot = (k, n) => [ZX[k] + (n % 2 ? 0.5 : -0.5), n < 2 ? 0.4 : 0, ZZ - 0.25 + Math.floor(n / 2) * 0.7];

    // four measuring tubes on a shelf show the chosen patient's signs; at the easier level they carry the range marks
    const TY = 3.0, TH = 1.7, tubeG = keep(new THREE.CylinderGeometry(0.2, 0.2, TH, 18, 1, true)), fillG = keep(new THREE.CylinderGeometry(0.16, 0.16, 1, 18));
    const glass = ctx.mat('#e7f5ff', { roughness: 0.15, transparent: true, opacity: 0.3, depthWrite: false }), band = ctx.mat('#51cf66', { roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false });
    add(keep(new THREE.BoxGeometry(4.6, 0.12, 0.7)), white, 0, TY - 0.06, -2.1);
    for (const sx of [-2.1, 2.1]) add(keep(new THREE.CylinderGeometry(0.07, 0.07, TY - 0.12, 8)), white, sx, (TY - 0.12) / 2, -2.1);
    const frac = (k, v) => Math.max(0.02, Math.min(1, (v - SHOW[k][0]) / (SHOW[k][1] - SHOW[k][0])));
    const tubeColor = { hr: '#ff8787', rr: '#74c0fc', t: '#ffa94d', o2: '#63e6be' }, tubeName = { hr: 'Heart', rr: 'Breaths', t: 'Temp', o2: 'Oxygen' };
    const tubes = {};
    KEYS.forEach((k, i) => {
      const x = -1.65 + i * 1.1; add(tubeG, glass, x, TY + TH / 2, -2.1).castShadow = false;
      const fill = add(fillG, ctx.lit(tubeColor[k], 0.5), x, TY, -2.1); fill.castShadow = false;
      const s = label(T(tubeName[k]), { size: 0.3 }); s.position.set(x, TY + TH + 0.28, -2.1); group.add(s); own.push(...s.userData.own);
      if (level <= 3) {
        const a = frac(k, NORMAL[k][0]), b = frac(k, NORMAL[k][1]);
        const ring = add(keep(new THREE.CylinderGeometry(0.24, 0.24, (b - a) * TH, 18, 1, true)), band, x, TY + (a + b) / 2 * TH, -2.1); ring.castShadow = false;
        for (const edge of k === 'o2' ? [CRIT[k][0]] : CRIT[k]) { const d = add(keep(new THREE.TorusGeometry(0.25, 0.025, 6, 20)), lamp[2], x, TY + frac(k, edge) * TH, -2.1); d.rotation.x = Math.PI / 2; d.castShadow = false; }
      }
      tubes[k] = { fill, now: 0.02, want: 0.02 };
    });

    // six patient figures: a body, a head, a badge that shows the answer afterwards, and a floating tag of vital signs
    const bodyG = keep(new THREE.CylinderGeometry(0.2, 0.3, 0.9, 14)), headG = keep(new THREE.SphereGeometry(0.25, 16, 12)), badgeG = keep(new THREE.SphereGeometry(0.09, 10, 8));
    const cats = [0, 0, 1, 1, 2, 2];
    const pts = NAMES.map((name, i) => {
      const g = new THREE.Group(); group.add(g);
      add(bodyG, shirts[i], 0, 0.45, 0, g); add(headG, face, 0, 1.12, 0, g);
      const badge = add(badgeG, grey, 0, 0.62, 0.27, g);
      ctx.onTap(g, () => select(i));
      return { name, i, g, badge, tag: null, v: null, ans: 0, guess: null, queue: [], pause: 0, home: [-2.75 + i * 1.1, SEAT, BZ] };
    });
    const ring = add(keep(new THREE.TorusGeometry(0.42, 0.045, 8, 28)), ctx.lit('#ffffff', 1.2), 0, 0, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false;

    let sel = 0, score = 0, under = 0, sorted = 0, closed = false, used = [0, 0, 0], auto = false, autoT = 0, shifts = 0;
    const rd = { hr: ui.readout('Heart rate, beats/min'), rr: ui.readout('Breaths, per min'), t: ui.readout('Temperature, °C'), o2: ui.readout('Oxygen, %') };
    const rWho = ui.readout('Patient'), rDone = ui.readout('Sorted'), rScore = ui.readout('Shift score, %'), rUnder = ui.readout('Under-triaged');
    ui.note('Normal: heart 60–100, breaths 12–20, temp 36.1–37.8, oxygen 95–100. Danger: heart under 40 or over 130, breaths under 8 or over 30, temp under 35 or over 39.5, oxygen under 90.');
    ui.button('Next waiting patient', () => next(1), 'btn ghost');
    CAT.forEach(([name], k) => ui.button(name, () => pick(k), 'btn'));
    ui.button('New shift', () => newShift(), 'btn ghost');
    ui.note('All patients are invented. This is a teaching game, never medical advice.');

    function newShift() {
      for (let i = cats.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cats[i], cats[j]] = [cats[j], cats[i]]; }
      pts.forEach((p, i) => {
        p.v = model.patient(cats[i], rng); p.ans = model.level(p.v); p.guess = null; p.queue = []; p.pause = 0;
        p.g.position.set(...p.home); p.badge.material = grey;
        if (p.tag) drop(p.tag);
        p.tag = label(p.name, { size: 0.62, label: `${p.v.hr} · ${p.v.rr} · ${p.v.t.toFixed(1)}° · ${p.v.o2}%` }); p.tag.position.set(0, 1.8 + (i % 2) * 0.5, 0); p.g.add(p.tag); Object.assign(p.tag.userData, { w: p.tag.scale.x, h: p.tag.scale.y, k: 1 });
      });
      score = 0; under = 0; sorted = 0; closed = false; used = [0, 0, 0]; shifts++;
      rScore.set('–'); rUnder.set('0'); select(0);
      ctx.say('Six people are waiting. Read the four signs of the chosen patient, then choose Routine, Soon or Urgent.');
    }
    function select(i) {
      if (pts[i].guess != null) return;
      sel = i; const p = pts[i];
      for (const k of KEYS) { rd[k].set(k === 't' ? p.v.t.toFixed(1) : String(p.v[k])); tubes[k].want = frac(k, p.v[k]); }
      rWho.set(p.name); rDone.set(`${sorted} / ${pts.length}`);
    }
    function next(dir) { for (let n = 1; n <= pts.length; n++) { const i = (sel + dir * n + pts.length) % pts.length; if (pts[i].guess == null) return select(i); } }
    function pick(k) {
      const p = pts[sel]; if (closed || !p || p.guess != null) return;
      p.guess = k; sorted++;
      const d = k - p.ans, why = model.outside(p.v).map((x) => SIGN[x]);
      score += model.mark(k, p.ans); if (d < 0) under++;
      p.queue.push({ to: slot(k, used[k]++), then: () => { p.badge.material = lamp[p.ans]; } });
      if (d !== 0) p.queue.push({ wait: 0.9, to: slot(p.ans, used[p.ans]++) });           // the nurse moves them to the right chairs
      const reason = why.length ? `Outside normal: ${why.join(', ')}.` : 'All four signs are in the normal range.';
      ctx.say((d === 0 ? 'Right. ' : d > 0 ? 'Safe, but more urgent than needed. ' : 'Too low. Missing an urgent patient is the worst mistake. When in doubt, escalate: checking a well person costs little, missing a sick one can cost a lot. ') + `${p.name}: ${CAT[p.ans][0]}. ${reason}`);
      rDone.set(`${sorted} / ${pts.length}`); rUnder.set(String(under));
      if (sorted < pts.length) next(1);
    }
    function close() {
      closed = true; const sc = score / pts.length; rScore.set(String(Math.round(sc * 100)));
      if (model.passes(sc, under)) {
        ctx.say(`Desk closed: ${Math.round(sc * 100)}% with nobody under-triaged. The most urgent patients are seen first, and nobody who needed help was left waiting.`);
        ctx.complete(sc, 'Triaged all patients safely using stated ranges.');
      } else ctx.say(`Desk closed: ${Math.round(sc * 100)}% with ${under} under-triaged. ${under ? 'A patient who needed help quickly was sent to wait, so the shift does not pass.' : 'Too many were marked more urgent than their signs show.'} Press New shift to try again.`);
    }
    newShift();

    return {
      step(dt) {
        let busy = false;
        for (const p of pts) {
          const q = p.queue[0]; if (!q) continue; busy = true;
          if (q.wait > 0) { q.wait -= dt; continue; }
          const pos = p.g.position, dx = q.to[0] - pos.x, dz = q.to[2] - pos.z, far = Math.hypot(dx, dz), go = 2.4 * dt;
          if (far <= go) { pos.set(...q.to); p.g.rotation.y = 0; p.queue.shift(); q.then?.(); }
          else { pos.x += dx / far * go; pos.z += dz / far * go; pos.y = calm ? 0 : Math.abs(Math.sin(far * 5)) * 0.07; p.g.rotation.y = Math.atan2(dx, dz); }
        }
        if (!busy && !closed && sorted === pts.length) close();
        if (auto && !closed && sorted < pts.length) { autoT -= dt; if (autoT <= 0) { autoT = 0.6; pick(pts[sel].ans); } }
      },
      frame(dt, time) {
        for (const k of KEYS) { const t = tubes[k]; t.now += (t.want - t.now) * Math.min(1, dt * 5); t.fill.scale.y = t.now * TH; t.fill.position.y = TY + t.now * TH / 2; }
        const cur = pts[sel];
        for (const p of pts) {
          const on = p === cur && p.guess == null, s = on ? 1.5 : 1;
          const u = p.tag.userData; u.k += (s - u.k) * Math.min(1, dt * 8); p.tag.scale.set(u.w * u.k, u.h * u.k, 1);
          if (!p.queue.length && p.guess == null) p.g.rotation.y = Math.sin(time * 0.7 + p.i) * 0.15 * (calm ? 0 : 1);
        }
        ring.visible = !closed && cur.guess == null; ring.position.set(cur.g.position.x, cur.g.position.y + 0.06 + (calm ? 0 : Math.sin(time * 3) * 0.03), cur.g.position.z);
      },
      // Sends each patient to the group their signs call for, through the same pick() the player uses (used by tests).
      autoplay() { auto = true; autoT = 0.2; if (closed) newShift(); },
      dispose() { for (const p of pts) if (p.tag) drop(p.tag); for (const x of own) x.dispose?.(); },
      get state() { return closed ? 'closed' : 'open'; },
    };
  },
};
