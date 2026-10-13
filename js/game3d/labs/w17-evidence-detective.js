// World 17 lab — Evidence Detective in 3D: a detective's desk with a case card, a balance scale that weighs the
// evidence against doubt, and five flags for the thinking traps.
// No imports: everything arrives through the context, so the lab also runs in the automated tests without a browser.

const FALL = [['ad', 'Attacking the person'], ['pop', 'Everyone does it'], ['one', 'One example only'], ['cause', 'Mixing up cause and chance'], ['none', 'No fallacy']];
const FLAG_COLOR = { ad: '#e8590c', pop: '#7048e8', one: '#1098ad', cause: '#d6336c', none: '#2f9e44' };
const CASES = [
  { claim: 'Our class bought ice cream on three hot days, so ice cream makes the weather hot.', src: 'a pupil\'s notebook', rel: 1, fall: 'cause', why: 'Hot weather makes people buy ice cream; the reverse is not shown. Two things happening together are not always cause and effect.' },
  { claim: 'You cannot trust Mia\'s idea about the school garden, because she is always late.', src: 'a classmate', rel: 1, fall: 'ad', why: 'Being late says nothing about whether the garden idea is good. Judge the idea, not the person.' },
  { claim: 'Everybody in my street uses this brand of torch, so it must be the best.', src: 'an advert', rel: 0, fall: 'pop', why: 'Many people choosing something is not proof of quality. Tests are better evidence.' },
  { claim: 'My uncle ate a lemon every day and never caught a cold, so lemons stop colds.', src: 'a family story', rel: 0, fall: 'one', why: 'One person is a story, not a study. We need many people compared with and without lemons.' },
  { claim: 'A museum guide says the bridge was built in 1890; the town records and an engineer\'s book agree.', src: 'museum plus two records', rel: 2, fall: 'none', why: 'Several independent sources agree, and they have a reason to be accurate.' },
  { claim: 'A measured test of 200 plants found those given more light grew taller on average.', src: 'a science report', rel: 2, fall: 'none', why: 'A large measured sample with a comparison is good evidence, though it still may not apply to every plant.' },
];
const REL = [[0, 'Weak'], [1, 'Medium'], [2, 'Strong']];
const DOUBT = 2, TILT = 0.42;        // two grey blocks of doubt sit on the claim's pan; the beam tips 0.42 rad per block of difference

// ----- the rules of the game, kept apart from the scene so they can be checked -----
export const model = {
  // Points for one case: the strength rating counts half (a near miss earns half of that), the trap counts half.
  points(relPick, falPick, c) { const a = relPick === c.rel ? 1 : Math.abs(relPick - c.rel) === 1 ? 0.5 : 0, b = falPick === c.fall ? 1 : 0; return (a + b) / 2; },
  blocks: (rel) => rel + 1,                                                             // weak 1, medium 2, strong 3 blocks of evidence
  tilt: (blocks) => Math.max(-TILT, Math.min(TILT, -TILT * (blocks - DOUBT))),          // radians; negative = the evidence pan goes down
};
// Used by the automated tests: hand-worked scores and beam angles.
export function selfTest() {
  const c = CASES[0];                                   // medium strength, trap: cause and chance
  const p = [model.points(1, 'cause', c), model.points(0, 'cause', c), model.points(2, 'none', c), model.points(1, 'ad', c), model.points(0, 'none', CASES[4])];      // the last: strong source rated weak (0), trap right (1) → 0.5
  const t = [0, 1, 2].map((r) => model.tilt(model.blocks(r)));
  const ok = p.join() === '1,0.75,0.25,0.5,0.5' && Math.abs(t[0] - TILT) < 1e-12 && t[1] === 0 && Math.abs(t[2] + TILT) < 1e-12 && CASES.every((k) => REL.some((r) => r[0] === k.rel) && FALL.some((f) => f[0] === k.fall));
  return { ok, detail: `points ${p.join(', ')} (by hand 1, 0.75, 0.25, 0.5, 0.5); beam weak ${t[0].toFixed(2)}, medium ${t[1].toFixed(2)}, strong ${t[2].toFixed(2)} rad` };
}

const wrap = (text, width) => { const out = []; let line = ''; for (const w of String(text).split(/\s+/)) { if (line && (line + ' ' + w).length > width) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } if (line) out.push(line); return out; };

export default {
  id: 'w17-evidence-detective',
  world: 17,
  levels: [3, 4],
  title: 'Evidence Detective',
  goal: 'Rate how strong the source is and spot the thinking trap in each invented claim. Then watch the scale weigh the evidence.',
  kind: 'validated',
  model: 'Each claim has a set answer: a source strength (weak, medium or strong) and one thinking trap or none. The scale shows the strength as one, two or three blocks of evidence against two blocks of doubt, and the scoring is exact: half for the strength (a near miss earns half of that), half for the trap. The claims are invented and short. Real evidence is messier, and a source rated weak can still turn out to be true; the rating is about how much to trust it, not whether it is right.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rnd = ctx.rng || Math.random, lv = Math.max(1, Math.min(6, ctx.level || 3)), T = ctx.t || ((x) => x);
    const COUNT = lv >= 4 ? 6 : 5, PASS = 0.7;
    const geos = [], G = (g) => { geos.push(g); return g; };
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    const wood = ctx.mat('#6f8aa0', { roughness: 0.7 }), woodDark = ctx.mat('#4c6577', { roughness: 0.8 }), paper = ctx.mat('#fff8e1', { roughness: 0.9 }), brass = ctx.mat('#d9a441', { metalness: 0.6, roughness: 0.3 });
    const steel = ctx.mat('#7f9aab', { metalness: 0.5, roughness: 0.35 }), grey = ctx.mat('#8a98a3', { roughness: 0.6 }), gold = ctx.lit('#ffc94d', 0.45), plain = ctx.mat('#dfe9ee', { roughness: 0.6 });
    const pickM = ctx.lit('#7048e8', 1.1), rightM = ctx.lit('#2fbf71', 1.3);
    const DESK = 0.97;

    // ----- the desk -----
    add(G(new THREE.BoxGeometry(6.8, 0.14, 2.7)), wood, 0, DESK - 0.07, 0);
    const legG = G(new THREE.BoxGeometry(0.2, DESK - 0.14, 0.2));
    for (const [x, z] of [[-3.1, -1.1], [3.1, -1.1], [-3.1, 1.1], [3.1, 1.1]]) add(legG, woodDark, x, (DESK - 0.14) / 2, z);
    // ----- the case card on its stand, with the claim written on it -----
    const CX = -1.75, CY = 2.5, CZ = -0.7;
    const card = add(G(new THREE.BoxGeometry(3.2, 2.2, 0.08)), paper, CX, CY, CZ); card.rotation.x = -0.1;
    add(G(new THREE.BoxGeometry(3.4, 0.12, 0.3)), woodDark, CX, CY - 1.2, CZ + 0.08);
    const standG = G(new THREE.BoxGeometry(0.12, 2.7, 0.12));
    add(standG, woodDark, CX - 1.2, DESK + 1.3, CZ - 0.25).rotation.x = -0.1; add(standG, woodDark, CX + 1.2, DESK + 1.3, CZ - 0.25).rotation.x = -0.1;
    let cardText = [];
    const clearText = () => { for (const s of cardText) { s.removeFromParent(); s.material?.map?.dispose?.(); s.material?.dispose?.(); } cardText = []; };
    const write = (c, n) => {
      clearText();
      const lines = wrap('“' + T(c.claim) + '”', 30), top = CY + 0.72;
      const head = ctx.sprite(`📁 ${n + 1} / ${COUNT}`, { size: 0.24, color: '#7048e8', font: 56 }); head.position.set(CX, CY + 0.92, CZ + 0.12); group.add(head); cardText.push(head);
      lines.forEach((l, k) => { const s = ctx.sprite(l, { size: 0.21, color: '#1d2b36', font: 56 }); s.position.set(CX, top - 0.3 - k * 0.24, CZ + 0.1 + k * 0.02); group.add(s); cardText.push(s); });
      const src = ctx.sprite('🔎 ' + T(c.src), { size: 0.2, color: '#0b7285', font: 56 }); src.position.set(CX, CY - 0.88, CZ + 0.24); group.add(src); cardText.push(src);
    };
    // ----- the case files: a pile to do, the open one under the card, a pile that is done -----
    const fileG = G(new THREE.BoxGeometry(0.62, 0.06, 0.8)), fileM = { todo: ctx.mat('#b9a7f5', { roughness: 0.7 }), good: ctx.mat('#69db7c', { roughness: 0.7 }), part: ctx.mat('#ffd43b', { roughness: 0.7 }) };
    const files = [];
    for (let k = 0; k < COUNT; k++) { const m = add(fileG, fileM.todo, -3.0, DESK + 0.03 + k * 0.065, 0.3); files.push({ m, to: new THREE.Vector3(), tilt: 0 }); }
    // ----- the balance scale -----
    const SX = 1.75, SZ = -0.35, PIV = 2.6, ARM = 1.05, HANG = 0.95;
    add(G(new THREE.CylinderGeometry(0.5, 0.6, 0.14, 24)), steel, SX, DESK + 0.07, SZ);
    add(G(new THREE.CylinderGeometry(0.07, 0.09, PIV - DESK, 12)), steel, SX, (PIV + DESK) / 2, SZ);
    const beam = new THREE.Group(); beam.position.set(SX, PIV, SZ); group.add(beam);
    add(G(new THREE.BoxGeometry(ARM * 2 + 0.1, 0.09, 0.12)), brass, 0, 0, 0, beam);
    add(G(new THREE.SphereGeometry(0.13, 14, 10)), brass, 0, 0, 0.02, beam);
    add(G(new THREE.ConeGeometry(0.07, 1.0, 8)), ctx.lit('#22c3dd', 0.9), 0, 0.55, 0, beam);
    const panG = G(new THREE.CylinderGeometry(0.5, 0.42, 0.07, 24)), cordG = G(new THREE.CylinderGeometry(0.015, 0.015, HANG, 6));
    const pans = [-1, 1].map((side) => {
      const p = new THREE.Group(); p.position.set(side * ARM, 0, 0); beam.add(p);
      add(panG, brass, 0, -HANG, 0, p);
      for (const [dx, dz] of [[-0.38, 0], [0.38, 0], [0, 0.38]]) { const c = add(cordG, steel, dx / 2, -HANG / 2, dz / 2, p); c.rotation.z = Math.atan2(dx, HANG); c.rotation.x = -Math.atan2(dz, HANG); c.castShadow = false; }
      return p;
    });
    const blockG = G(new THREE.BoxGeometry(0.34, 0.2, 0.34));
    for (let k = 0; k < DOUBT; k++) add(blockG, grey, 0, -HANG + 0.135 + k * 0.2, 0, pans[0]);
    const doubtTag = ctx.sprite('❓', { size: 0.34 }); doubtTag.position.set(0, -HANG + 0.75, 0.2); pans[0].add(doubtTag);
    const evid = [0, 1, 2].map((k) => { const m = add(blockG, gold, 0, -HANG + 0.135 + k * 0.2, 0, pans[1]); m.visible = false; return { m, y: 0, v: 0, rest: -HANG + 0.135 + k * 0.2, wait: 0, landed: false, on: false }; });
    const evTag = ctx.sprite('📄', { size: 0.34 }); evTag.position.set(0, -HANG + 0.95, 0.2); pans[1].add(evTag);
    // the dial: three lamps the needle can point at — the player's rating lights one of them
    const lampG = G(new THREE.SphereGeometry(0.21, 16, 12));
    const lamps = REL.map(([v, name]) => {
      const a = model.tilt(model.blocks(v)), R = 1.28;
      const m = add(lampG, plain, SX - Math.sin(a) * R, PIV + Math.cos(a) * R, SZ - 0.05);
      const tag = ctx.sprite(name, { size: 0.24 }); tag.position.set(SX - Math.sin(a) * (R + 0.75) * 1.25, PIV + Math.cos(a) * R + 0.42, SZ); group.add(tag);
      ctx.onTap?.(m, () => { if (relC.set) relC.set(v); else pickRel(v); });
      return m;
    });
    // ----- five flags on the front edge of the desk: one for each thinking trap, and a green one for "no trap" -----
    const poleG = G(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8)), clothG = G(new THREE.BoxGeometry(0.62, 0.4, 0.05)), footG = G(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12));
    const LOW = DESK + 0.32, HIGH = DESK + 0.95;
    const flags = FALL.map(([v, name], k) => {
      const x = -2.7 + k * 1.35, z = 1.05;
      add(footG, steel, x, DESK + 0.04, z); const pole = add(poleG, steel, x, DESK + 0.55, z);
      const cloth = add(clothG, ctx.mat(FLAG_COLOR[v], { roughness: 0.6 }), x + 0.33, LOW, z);
      const tag = ctx.sprite(name, { size: 0.17, font: 56 }); tag.position.set(x + 0.2, k % 2 ? 0.34 : 0.66, z + 0.35); group.add(tag);
      const tap = () => { if (falC.set) falC.set(v); else pickFall(v); };
      ctx.onTap?.(cloth, tap); ctx.onTap?.(pole, tap);
      return { v, cloth, y: LOW, up: 0, wave: 0 };
    });
    const halo = ctx.glow('#2fbf71', 1.5, 0.75); halo.visible = false; group.add(halo);

    // ----- the game -----
    let order = [], i = 0, pts = 0, relPick = null, falPick = null, shown = false, closed = false, auto = false, autoT = 0, ang = 0, vel = 0, free = false, landed = 0, wonOnce = false;
    const relC = ui.choice(REL.map(([v, s]) => [v, s]), null, (v) => pickRel(v));
    const falC = ui.choice(FALL.map(([v, s]) => [v, s]), null, (v) => pickFall(v));
    ui.button('⚖️ Check', () => check(), 'btn');
    ui.button('📁 Next case', () => next(), 'btn ghost');
    ui.button('🗂️ Open a new file', () => restart(), 'btn ghost');
    const rCase = ui.readout('Case'), rSrc = ui.readout('Source'), rEv = ui.readout('Evidence on the scale, blocks'), rPts = ui.readout('Points');
    ui.note('1. How strong is the evidence? Decide before you check: light a lamp above the scale. 2. Which trap, if any? Raise a flag. Then press Check and the scale weighs the evidence against two blocks of doubt.');
    const fallName = (v) => FALL.find((f) => f[0] === v)[1];
    const paintLamps = () => { const c = order[i]; lamps.forEach((m, v) => { m.material = shown && c && v === c.rel ? rightM : v === relPick ? pickM : plain; }); };
    const stats = () => {
      const c = order[i];
      rCase.set(closed ? `${COUNT} / ${COUNT}` : `${i + 1} / ${COUNT}`); rSrc.set(c ? T(c.src) : '–');
      rEv.set(shown && c ? `${model.blocks(c.rel)} against ${DOUBT} of doubt` : `? against ${DOUBT} of doubt`); rPts.set(`${+pts.toFixed(2)} / ${COUNT}`);
    };
    const place = () => {
      let todo = 0, doneN = 0;
      files.forEach((f, k) => {
        if (k < i || closed) { f.to.set(-0.55, DESK + 0.03 + doneN * 0.065, 0.3); f.tilt = 0; doneN++; }
        else if (k === i) { f.to.set(CX, DESK + 0.36, CZ + 0.42); f.tilt = 1.1; }
        else { f.to.set(-3.0, DESK + 0.03 + todo * 0.065, 0.3); f.tilt = 0; todo++; }
      });
    };
    function load() {
      const c = order[i]; shown = false; free = false; landed = 0; relPick = null; falPick = null;
      relC.set?.(null); falC.set?.(null);
      for (const e of evid) { e.on = false; e.landed = false; e.m.visible = false; }
      for (const f of flags) { f.up = 0; f.wave = 0; }
      halo.visible = false;
      write(c, i); place(); paintLamps(); stats();
      ctx.say(`Case ${i + 1} of ${COUNT}. The claim: “${c.claim}” The source: ${c.src}. How strong is this evidence, and is there a thinking trap in it?`);
    }
    function pickRel(v) { if (shown) return; relPick = v == null ? null : +v; paintLamps(); }
    function pickFall(v) { if (shown) return; falPick = v == null ? null : v; for (const f of flags) f.up = f.v === falPick ? 1 : 0; }
    function check() {
      if (closed) return;
      if (shown) return next();
      if (relPick == null || falPick == null) { ctx.say('Pick both answers first: light one lamp for the strength, and raise one flag for the trap.'); return; }
      const c = order[i], got = model.points(relPick, falPick, c), n = model.blocks(c.rel); shown = true; pts += got;
      evid.forEach((e, k) => { e.on = k < n; e.landed = false; e.y = 1.2 + k * 0.4; e.v = 0; e.wait = 0.35 * k; e.m.visible = e.on; e.m.position.y = e.y; });
      free = true; landed = 0;
      for (const f of flags) { f.up = f.v === c.fall ? 1 : 0; f.wave = f.v === c.fall ? 1 : 0; }
      const fc = flags.find((f) => f.v === c.fall); halo.visible = true; halo.position.set(fc.cloth.position.x, HIGH, 1.1);
      files[i].m.material = got === 1 ? fileM.good : fileM.part;
      paintLamps(); stats();
      const tip = c.rel === 0 ? 'Only one block of evidence drops on the scale, so doubt stays heavier' : c.rel === 1 ? 'Two blocks of evidence drop on the scale and just balance the doubt' : 'Three blocks of evidence drop on the scale and outweigh the doubt';
      const mine = got === 1 ? 'Both right!' : relPick === c.rel ? `You rated the strength well, but the trap was: ${fallName(c.fall)}.` : falPick === c.fall ? `You found the trap, but the strength was: ${REL[c.rel][1]}.` : `Strength: ${REL[c.rel][1]}. Trap: ${fallName(c.fall)}.`;
      ctx.say(`${mine} ${tip}: this source is ${REL[c.rel][1].toLowerCase()}. ${c.why}`);
    }
    function next() {
      if (closed) return;
      if (!shown) { ctx.say('Check this case first: light a lamp, raise a flag, then press Check.'); return; }
      i++; if (i >= COUNT) return finish();
      load();
    }
    function finish() {
      closed = true; i = COUNT - 1; place(); stats();
      const score = pts / COUNT, pct = Math.round(score * 100);
      if (score >= PASS) {
        wonOnce = true;
        ctx.say(`Case closed: ${pct}% accurate. A good detective asks two things about every claim: how much can I trust the source, and is the reasoning sound?`);
        ctx.complete(score, `cases=${COUNT}, points=${+pts.toFixed(2)}, accuracy=${pct}%`);
      } else ctx.say(`Case closed: ${pct}% accurate. You need 70%. Open a new file and try again: look at who is speaking and what they measured before you rate the source.`);
    }
    function restart() {
      order = [...CASES].map((c) => [rnd(), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, COUNT);
      i = 0; pts = 0; closed = false; for (const f of files) f.m.material = fileM.todo;
      load();
    }
    restart();
    for (const f of files) f.m.position.copy(f.to);

    return {
      step(dt) {
        // the evidence blocks fall onto their pan one after another
        for (const e of evid) {
          if (!e.on || e.landed) continue;
          if (e.wait > 0) { e.wait -= dt; continue; }
          e.v -= 9.81 * dt; e.y += e.v * dt;
          if (e.y <= e.rest || ctx.calm) { e.y = e.rest; e.landed = true; landed++; vel -= 0.5; }
          e.m.position.y = e.y;
        }
        // the beam: a damped swing towards the angle the blocks on the pans call for (held level until the check)
        const want = free ? model.tilt(landed) : 0;
        vel += ((want - ang) * 26 - vel * 3.2) * dt; ang += vel * dt;
        if (ctx.calm) { ang = want; vel = 0; }
        if (ang > TILT + 0.03) { ang = TILT + 0.03; vel = -vel * 0.3; } else if (ang < -TILT - 0.03) { ang = -TILT - 0.03; vel = -vel * 0.3; }
        beam.rotation.z = ang; pans[0].rotation.z = pans[1].rotation.z = -ang;
        if (auto && !closed) {
          autoT -= dt;
          if (autoT <= 0) {
            const c = order[i];
            if (!shown) { if (relC.set) relC.set(c.rel); else pickRel(c.rel); if (falC.set) falC.set(c.fall); else pickFall(c.fall); check(); autoT = 2.4; }
            else { next(); autoT = 0.8; }
          }
        }
      },
      frame(dt, time) {
        const e = ctx.calm ? 1 : Math.min(1, dt * 6);
        for (const f of flags) {
          f.y += ((f.up ? HIGH : LOW) - f.y) * e; f.cloth.position.y = f.y;
          f.cloth.rotation.y = f.wave && !ctx.calm ? Math.sin(time * 6) * 0.35 : 0;
        }
        for (const f of files) { f.m.position.lerp(f.to, e); f.m.rotation.x += (f.tilt - f.m.rotation.x) * e; }
        if (halo.visible && !ctx.calm) halo.material.opacity = 0.6 + Math.sin(time * 5) * 0.15;
      },
      // Shows a successful run without the player (used by tests).
      autoplay() { auto = true; autoT = 0.3; if (closed && !wonOnce) restart(); },
      dispose() { clearText(); for (const g of geos) g.dispose(); },
      get state() { return { i, pts, shown, closed, relPick, falPick }; },
    };
  },
};
