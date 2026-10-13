// 3D lab — Molecule Builder: ball-and-stick atoms joined in space on a slowly turning table.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

// valence (bonds wanted), colour, ball radius in metres of scene, atomic mass in u
const EL = {
  H: { v: 1, c: '#f4f4f4', r: 0.2, m: 1.008, name: 'hydrogen' },
  O: { v: 2, c: '#ff5a5a', r: 0.3, m: 15.999, name: 'oxygen' },
  N: { v: 3, c: '#5a86ff', r: 0.3, m: 14.007, name: 'nitrogen' },
  C: { v: 4, c: '#59606e', r: 0.32, m: 12.011, name: 'carbon' },
};
// name, formula, atoms needed, and one correct way to join them (used by autoplay and the self-test)
const TARGETS = [
  { name: 'water', f: 'H₂O', need: { H: 2, O: 1 }, atoms: ['O', 'H', 'H'], bonds: [[0, 1, 1], [0, 2, 1]] },
  { name: 'ammonia', f: 'NH₃', need: { N: 1, H: 3 }, atoms: ['N', 'H', 'H', 'H'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  { name: 'methane', f: 'CH₄', need: { C: 1, H: 4 }, atoms: ['C', 'H', 'H', 'H', 'H'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
  { name: 'carbon dioxide', f: 'CO₂', need: { C: 1, O: 2 }, atoms: ['C', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2]] },
  { name: 'oxygen gas', f: 'O₂', need: { O: 2 }, atoms: ['O', 'O'], bonds: [[0, 1, 2]] },
  { name: 'nitrogen gas', f: 'N₂', need: { N: 2 }, atoms: ['N', 'N'], bonds: [[0, 1, 3]] },
  { name: 'hydrogen cyanide', f: 'HCN', need: { H: 1, C: 1, N: 1 }, atoms: ['H', 'C', 'N'], bonds: [[0, 1, 1], [1, 2, 3]] },
  { name: 'formaldehyde', f: 'CH₂O', need: { C: 1, H: 2, O: 1 }, atoms: ['C', 'H', 'H', 'O'], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 2]] },
];
const MAX = 12;

// ----- the model: exact bookkeeping of bonds. `atoms` is a list of symbols, `bonds` maps 'i-j' to 1, 2 or 3 -----
export const model = {
  key: (i, j) => (i < j ? i + '-' + j : j + '-' + i),
  // Bonds an atom is using; a double bond counts as two, a triple as three.
  used(bonds, i) { let s = 0; for (const k of Object.keys(bonds)) { const [a, b] = k.split('-').map(Number); if (a === i || b === i) s += bonds[k]; } return s; },
  connected(n, bonds) {
    if (!n) return false;
    const seen = new Set([0]), q = [0];
    while (q.length) { const c = q.pop(); for (const k of Object.keys(bonds)) { const [a, b] = k.split('-').map(Number); const o = a === c ? b : b === c ? a : -1; if (o >= 0 && !seen.has(o)) { seen.add(o); q.push(o); } } }
    return seen.size === n;
  },
  mass: (atoms) => atoms.reduce((s, a) => s + EL[a].m, 0),
  // why: '' when the molecule is right, else 'atoms' (wrong set), 'valence' (atom `bad` has the wrong number of bonds) or 'split'.
  judge(atoms, bonds, need) {
    const cnt = {}; atoms.forEach((a) => { cnt[a] = (cnt[a] || 0) + 1; });
    const same = Object.keys({ ...cnt, ...need }).every((k) => (cnt[k] || 0) === (need[k] || 0));
    if (!same) return { ok: false, why: 'atoms', bad: -1 };
    const bad = atoms.findIndex((a, i) => model.used(bonds, i) !== EL[a].v);
    if (bad >= 0) return { ok: false, why: 'valence', bad };
    if (!model.connected(atoms.length, bonds)) return { ok: false, why: 'split', bad: -1 };
    return { ok: true, why: '', bad: -1 };
  },
};
// Used by the automated tests: every target's worked answer must pass, known mistakes must fail, masses must match the tables.
export function selfTest() {
  const build = (t) => { const b = {}; for (const [i, j, o] of t.bonds) b[model.key(i, j)] = o; return b; };
  const all = TARGETS.every((t) => model.judge(t.atoms, build(t), t.need).ok);
  const co2 = TARGETS[3], single = model.judge(co2.atoms, { '0-1': 1, '0-2': 1 }, co2.need);            // C left with 2 of 4 bonds
  const water = TARGETS[0], tooMany = model.judge(water.atoms, { '0-1': 2, '0-2': 1 }, water.need);     // O with 3 bonds
  const wrongSet = model.judge(['O', 'H'], { '0-1': 1 }, water.need);
  const split = model.judge(['O', 'O', 'O', 'O'], { '0-1': 2, '2-3': 2 }, { O: 4 });                     // two separate O₂
  const mW = model.mass(water.atoms), mC = model.mass(co2.atoms), mM = model.mass(TARGETS[2].atoms);
  const near = (a, b) => Math.abs(a - b) < 0.0015;
  const ok = all && single.why === 'valence' && single.bad === 0 && tooMany.why === 'valence' && wrongSet.why === 'atoms' && split.why === 'split'
    && model.used({ '0-1': 2, '0-2': 2 }, 0) === 4 && near(mW, 18.015) && near(mC, 44.009) && near(mM, 16.043);
  return { ok, detail: `8 worked molecules pass; CO₂ with single bonds leaves C at 2 of 4; H₂O ${mW.toFixed(3)} u, CO₂ ${mC.toFixed(3)} u, CH₄ ${mM.toFixed(3)} u` };
}

export default {
  id: 'w02-molecule-builder',
  world: 2,
  levels: [3, 4],
  title: 'Molecule Builder',
  goal: 'Build the molecule so that every atom has exactly its number of bonds.',
  kind: 'validated',
  model: 'Atoms are joined by single, double or triple bonds with fixed valences (H 1, O 2, N 3, C 4), and the check counts them exactly. The shape in space comes from one simple rule: atoms push each other apart while bonds hold them together. That gives methane its true pyramid shape, but it leaves out the lone pairs of electrons, so water comes out straight when the real molecule is bent. Some atoms can also bond in other ways in real molecules.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rnd = ctx.rng || Math.random;
    const L = Math.round(ctx.level || 3), pool = L <= 3 ? TARGETS.slice(0, 3) : TARGETS.slice(3);     // level 3: single bonds; level 4: double and triple bonds
    const target = pool[Math.floor(rnd() * pool.length) % pool.length];
    const total = target.atoms.length;
    const own = [], keep = (o) => { own.push(o); return o; };
    const add3 = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };

    let atoms = [], bonds = {}, sel = -1, done = false, guess = 1, spin = 0, cheer = 0, queue = [], wait = 0;
    const CY = 2.75, mol = new THREE.Group(); mol.position.set(0, CY, 0); group.add(mol);

    // the turntable under the molecule
    const table = new THREE.Group(); group.add(table);
    add3(keep(new THREE.CylinderGeometry(1.45, 1.6, 0.16, 36)), ctx.mat('#17624f', { roughness: 0.5, metalness: 0.2 }), 0, 0.08, 0, table);
    const studG = keep(new THREE.SphereGeometry(0.09, 10, 8));
    for (let i = 0; i < 6; i++) add3(studG, ctx.lit('#9fffe0', 1.2), Math.cos(i * Math.PI / 3) * 1.25, 0.18, Math.sin(i * Math.PI / 3) * 1.25, table);
    const aura = ctx.glow('#9fffe0', 3.4, 0.25); aura.position.set(0, CY, -0.4); group.add(aura);
    const sign = ctx.sprite('Build ' + target.name + ': ' + target.f, { size: 0.5 }); sign.position.set(0, 4.75, 0); group.add(sign);

    // the four atom stores at the front: tap one to take an atom
    const ballG = keep(new THREE.SphereGeometry(1, 24, 16)), ringG = keep(new THREE.TorusGeometry(1, 0.07, 8, 28)), stickG = keep(new THREE.CylinderGeometry(0.05, 0.05, 1, 10));
    const standG = keep(new THREE.CylinderGeometry(0.38, 0.46, 0.6, 16)), ballM = {}, store = {};
    Object.keys(EL).forEach((s, i) => {
      ballM[s] = ctx.mat(EL[s].c, { roughness: 0.3 });
      const x = -2.55 + i * 1.7, stand = add3(standG, ctx.mat('#2c8f77', { roughness: 0.6 }), x, 0.3, 1.6);
      const ball = add3(ballG, ballM[s], x, 0.6 + EL[s].r * 1.3, 1.6); ball.scale.setScalar(EL[s].r * 1.3);
      const tag = ctx.sprite(s, { size: 0.42 }); tag.position.set(x, 1.55, 1.6); group.add(tag);
      const hint = ctx.sprite(EL[s].v + (EL[s].v === 1 ? ' bond' : ' bonds'), { size: 0.2 }); hint.position.set(x, 0.3, 2.1); group.add(hint);
      store[s] = { x, ball, y: 0.6 + EL[s].r * 1.3 };
      ctx.onTap(ball, () => add(s)); ctx.onTap(stand, () => add(s));
    });

    // atoms on the table: slots are made when first needed and reused
    const slots = [], sticks = [];
    const ringM = { full: ctx.lit('#2bc48a', 1.3), less: ctx.lit('#ffb347', 1.3), more: ctx.lit('#f0708a', 1.3), sel: ctx.lit('#ffd24a', 1.8) };
    const stickM = ctx.mat('#dfe6ff', { roughness: 0.35 });
    const slot = (i) => {
      if (slots[i]) return slots[i];
      const mesh = new THREE.Mesh(ballG, ballM.H), ring = new THREE.Mesh(ringG, ringM.less), num = ctx.sprite(String(i + 1), { size: 0.2, color: '#ffe9a8' });
      mol.add(mesh, ring, num); ctx.onTap(mesh, () => tapAtom(i));
      return (slots[i] = { mesh, ring, num, tags: {}, p: new THREE.Vector3(), pop: 0 });
    };
    const showSlot = (i) => {
      const s = slot(i), a = atoms[i]; s.mesh.visible = s.ring.visible = s.num.visible = !!a;
      for (const k of Object.keys(s.tags)) s.tags[k].visible = false;
      if (!a) return;
      s.mesh.material = ballM[a];
      if (!s.tags[a]) { s.tags[a] = ctx.sprite(a, { size: 0.26, color: a === 'H' ? '#1b2a33' : '#ffffff' }); mol.add(s.tags[a]); }
      s.tags[a].visible = true;
    };

    const rAtoms = ui.readout('Atoms'), rBonds = ui.readout('Bonds made'), rMass = ui.readout('Mass of your molecule, u');
    const refresh = () => {
      for (let i = 0; i < Math.max(slots.length, atoms.length); i++) showSlot(i);
      rAtoms.set(atoms.length + ' of ' + MAX + (atoms.length ? ': ' + atoms.join(' ') : ''));
      rBonds.set(String(Object.values(bonds).reduce((a, b) => a + b, 0)));
      rMass.set(model.mass(atoms).toFixed(3));
    };
    const front = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();

    function add(sym) {
      if (atoms.length >= MAX) { ctx.say('The table holds 12 atoms at most. Remove one first.'); return; }
      const i = atoms.length, s = slot(i), st = store[sym];
      atoms.push(sym);
      // start where the store stands (in the turning molecule's own space), nudged in depth so the shape can open up in 3D
      const g = i * 2.4;
      s.p.set(st.x, st.y - CY, 1.6).applyAxisAngle(up, -mol.rotation.y).add(tmp.set(Math.cos(g) * 0.25, ((i % 3) - 1) * 0.25, Math.sin(g) * 0.25));
      s.pop = 1; sel = -1; refresh();
      ctx.say(`One ${EL[sym].name} atom. It wants ${EL[sym].v} ${EL[sym].v === 1 ? 'bond' : 'bonds'}.`);
    }
    function join(a, b) {
      if (a === b || !atoms[a] || !atoms[b]) { ctx.say('Pick two different atoms that are on the table.'); return; }
      const k = model.key(a, b), o = ((bonds[k] || 0) + 1) % 4;
      if (o) bonds[k] = o; else delete bonds[k];
      slots[a].pop = slots[b].pop = 0.6; refresh();
      ctx.say(o === 1 ? 'A single bond: the two atoms share one pair of electrons. It uses one bond from each atom.'
        : o === 2 ? 'A double bond: two shared pairs. It counts as two bonds for each atom, and pulls them closer.'
          : o === 3 ? 'A triple bond: three shared pairs. It counts as three bonds for each atom.' : 'Bond removed. The two atoms are free again.');
    }
    function tapAtom(i) {
      if (!atoms[i]) return;
      if (sel < 0 || sel === i) { sel = sel === i ? -1 : i; if (sel >= 0) ctx.say(`Atom ${i + 1} (${atoms[i]}) is picked. Now tap the atom to join it to.`); }
      else { const a = sel; sel = -1; join(a, i); }
    }
    function removeLast() {
      const n = atoms.length - 1; if (n < 0) return;
      for (const k of Object.keys(bonds)) if (k.split('-').map(Number).includes(n)) delete bonds[k];
      atoms.pop(); sel = -1; refresh();
    }
    function clear() { atoms = []; bonds = {}; sel = -1; refresh(); }
    function check() {
      const r = model.judge(atoms, bonds, target.need);
      if (r.why === 'atoms') ctx.say(`You need exactly these atoms: ${target.f}. You have ${atoms.length} ${atoms.length === 1 ? 'atom' : 'atoms'} on the table. The little numbers in the formula say how many of each.`);
      else if (r.why === 'valence') { const a = atoms[r.bad]; slots[r.bad].pop = 1; ctx.say(`Atom ${r.bad + 1} (${a}) has ${model.used(bonds, r.bad)} bonds but wants ${EL[a].v}. Each atom wants its own number of bonds: H 1, O 2, N 3, C 4. A double bond counts as two.`); }
      else if (r.why === 'split') ctx.say('Some atoms are not joined to the rest. A molecule is one piece: every atom must be linked to the others.');
      else if (!done) {
        done = true; cheer = 1;
        const right = Math.round(guess) === total;
        ctx.say(`You built ${target.name} (${target.f})! Every atom has all the bonds it wants, so the molecule is stable. Sharing electrons makes those bonds. It has ${total} atoms and a mass of ${model.mass(atoms).toFixed(3)} u.`);
        ctx.complete(right ? 1 : 0.85, 'Atoms bond so each has its full number of bonds (valence): H 1, O 2, N 3, C 4.');
      }
    }

    ui.note(`Mission: build ${target.name} (${target.f}). Tap an atom store to add an atom. Tap one atom, then another, to join them. Join the same two again for a double or triple bond.`);
    const guessS = ui.slider({ label: 'My guess: atoms in one molecule of ' + target.f, min: 1, max: 8, step: 1, value: 1, unit: 'atoms', onInput: (v) => { guess = v; } });
    for (const s of Object.keys(EL)) ui.button(`Add ${s} (${EL[s].v})`, () => add(s), 'btn ghost sm');
    let pa = 1, pb = 2;
    ui.slider({ label: 'First atom number', min: 1, max: MAX, step: 1, value: 1, unit: '', onInput: (v) => { pa = v; } });
    ui.slider({ label: 'Second atom number', min: 1, max: MAX, step: 1, value: 2, unit: '', onInput: (v) => { pb = v; } });
    ui.button('Join first and second atom', () => join(Math.round(pa) - 1, Math.round(pb) - 1), 'btn ghost sm');
    ui.button('Remove last atom', removeLast, 'btn ghost sm');
    ui.button('Clear the table', clear, 'btn ghost sm');
    ui.button('Check molecule', check, 'btn');
    ui.note('Ring colours: green = full, orange = wants more bonds, red = too many. The molecule turns so you can see its shape from every side.');
    refresh();
    ctx.say(`Build ${target.name}, ${target.f}. First guess how many atoms it has, then take atoms from the stores.`);

    // atoms push apart, bonds pull to their length, and a gentle pull keeps everything over the table
    const force = [], REST = [0, 1.0, 0.9, 0.82];
    function relax(dt) {
      const n = atoms.length;
      for (let i = 0; i < n; i++) (force[i] || (force[i] = new THREE.Vector3())).copy(slots[i].p).multiplyScalar(-1.2);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        tmp.subVectors(slots[j].p, slots[i].p); let d = tmp.length();
        if (d < 1e-4) { tmp.set(Math.cos(i * 2.4 + j), 0.3, Math.sin(i * 2.4 + j)); d = 1e-4; }
        tmp.normalize();
        const o = bonds[i + '-' + j] || 0, f = (o ? 7 * (d - REST[o]) : 0) - 0.5 / (d * d + 0.05);
        force[i].addScaledVector(tmp, f); force[j].addScaledVector(tmp, -f);
      }
      for (let i = 0; i < n; i++) { const f = force[i], m = f.length(), cap = 6; if (m > cap) f.multiplyScalar(cap / m); slots[i].p.addScaledVector(f, Math.min(dt, 0.05) * 1.6); }
    }
    function draw(dt) {
      front.set(-Math.sin(mol.rotation.y), 0, Math.cos(mol.rotation.y));                    // the viewer's side, in the molecule's space
      atoms.forEach((a, i) => {
        const s = slots[i], e = EL[a], u = model.used(bonds, i);
        s.pop = Math.max(0, s.pop - dt * 2.5);
        const r = e.r * (1 + 0.25 * s.pop + (i === sel ? 0.12 : 0));
        s.mesh.position.copy(s.p); s.mesh.scale.setScalar(r);
        s.ring.position.copy(s.p); s.ring.scale.setScalar(r * 1.22); s.ring.rotation.y = -mol.rotation.y;
        s.ring.material = i === sel ? ringM.sel : u === e.v ? ringM.full : u > e.v ? ringM.more : ringM.less;
        s.tags[a].position.copy(s.p).addScaledVector(front, r + 0.03);
        s.num.position.copy(s.p).addScaledVector(front, r * 0.6); s.num.position.y -= r + 0.17;
      });
      let k = 0;
      for (const key of Object.keys(bonds)) {
        const [a, b] = key.split('-').map(Number), o = bonds[key], A = slots[a].p, B = slots[b].p;
        tmp.subVectors(B, A); const len = tmp.length() || 1e-4; tmp.multiplyScalar(1 / len);
        side.crossVectors(tmp, front); if (side.lengthSq() < 1e-6) side.crossVectors(tmp, up); side.normalize();
        for (let q = 0; q < o; q++) {
          const st = sticks[k] || (sticks[k] = add3(stickG, stickM, 0, 0, 0, mol)); k++;
          st.visible = true; st.position.addVectors(A, B).multiplyScalar(0.5).addScaledVector(side, (q - (o - 1) / 2) * 0.13);
          st.quaternion.setFromUnitVectors(up, tmp); st.scale.set(1, len, 1);
        }
      }
      for (; k < sticks.length; k++) sticks[k].visible = false;
    }

    return {
      step(dt) {
        relax(dt);
        if (queue.length && (wait -= dt) <= 0) { wait = 0.3; queue.shift()(); }
      },
      frame(dt, time) {
        cheer = Math.max(0, cheer - dt * 0.4);
        spin += dt * (ctx.calm ? 0.12 : 0.4 + cheer * 2.5);
        mol.rotation.y = spin; table.rotation.y = spin;
        mol.position.y = CY + (ctx.calm ? 0 : Math.sin((time || 0) * 1.3) * 0.05);
        aura.material.opacity = 0.25 + cheer * 0.5;
        for (const s of Object.keys(store)) store[s].ball.rotation.y += dt * 0.6;
        draw(dt);
      },
      // Builds the target the way a player would: take the atoms, join them pair by pair, guess, check.
      autoplay() {
        queue = [clear, () => guessS.set(total)];
        for (const s of target.atoms) queue.push(() => add(s));
        for (const [a, b, o] of target.bonds) for (let q = 0; q < o; q++) queue.push(() => { sel = -1; tapAtom(a); }, () => tapAtom(b));
        queue.push(check); wait = 0;
      },
      dispose() {
        queue = [];
        group.traverse((o) => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
        for (const g of own) g.dispose();
      },
    };
  },
};
