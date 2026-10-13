// Build an Atom in 3D: a nucleus of red protons and grey neutrons, with blue electrons circling on three shells.
// No imports: everything arrives through the context, so the file also runs in tools/test-game3d.mjs.

const EL = ['', 'Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen'];
const SYM = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O'];
const NEU = [0, 0, 2, 4, 5, 6, 6];          // neutrons in the most common form of each target element
const SHELLS = [2, 8, 2];                    // how many electrons each ring can hold in this lab
const MAX = 12;

export const model = {
  element: (p) => (p >= 1 && p <= 8 ? EL[p] : ''),
  charge: (p, e) => p - e,                   // in elementary charges
  mass: (p, n) => p + n,                     // mass number, close to the mass in atomic mass units
  // Fills the rings from the inside out.
  shells(e) { const out = []; let left = e; for (const cap of SHELLS) { const c = Math.min(cap, left); out.push(c); left -= c; } return out; },
  built: (p, n, e, target) => p === target && e === target && n === NEU[target],
};
// Used by the automated tests: carbon, lithium and a charged atom worked by hand.
export function selfTest() {
  const a = model.shells(6), b = model.shells(11), c = model.shells(1);
  const ok = model.element(6) === 'Carbon' && model.mass(6, 6) === 12 && model.charge(6, 6) === 0 && model.charge(3, 2) === 1 && model.charge(8, 10) === -2
    && a.join() === '2,4,0' && b.join() === '2,8,1' && c.join() === '1,0,0' && model.mass(3, NEU[3]) === 7
    && model.built(6, 6, 6, 6) && !model.built(6, 6, 5, 6) && !model.built(5, 6, 6, 6) && model.built(1, 0, 1, 1) && model.element(9) === '';
  return { ok, detail: `carbon: 6 p + 6 n = mass ${model.mass(6, 6)}, rings ${a.slice(0, 2).join(' + ')}; lithium-7 with 2 electrons has charge +${model.charge(3, 2)}; 11 electrons fill ${b.join(' + ')}` };
}

export default {
  id: 'w06-build-atom',
  world: 6,
  levels: [1, 2],
  title: 'Build an Atom',
  goal: 'Add red protons, grey neutrons and blue electrons to build the atom you are asked for.',
  kind: 'validated',
  model: 'Exact counting: the number of protons names the element, protons minus electrons gives the charge, and protons plus neutrons gives the mass number. The picture is a simple one with electrons on rings. Real electrons form clouds, not tiny planets. Only the first eight elements are included.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rng = ctx.rng || Math.random;
    const level = Math.max(1, Math.min(2, Math.round(ctx.level || 1)));
    const target = level <= 1 ? 1 + Math.floor(rng() * 3) : 3 + Math.floor(rng() * 4);      // hydrogen to lithium, then lithium to carbon
    const C = new THREE.Vector3(0, 2.75, 0), RAD = [0.95, 1.55, 2.1], TILT = [[0.32, 0.1], [-0.2, -0.16], [0.12, 0.26]], SPIN = [1.5, 0.95, 0.7];
    const red = ctx.mat('#e2504a', { roughness: 0.45 }), grey = ctx.mat('#b4bccb', { roughness: 0.5 }), blue = ctx.lit('#4aa3ff', 1.1);
    const steel = ctx.mat('#8d9bb8', { metalness: 0.5, roughness: 0.35 }), white = ctx.mat('#f2f6fc', { roughness: 0.5 });
    const ringMat = ctx.mat('#7fd6ff', { transparent: true, opacity: 0.45, roughness: 0.4 });
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

    // the stand, the three rings and the soft light that shows whether the atom is balanced
    add(new THREE.CylinderGeometry(0.55, 0.8, 0.3, 24), white, 0, 0.15, 0);
    add(new THREE.CylinderGeometry(0.05, 0.08, 1.9, 10), steel, 0, 1.2, 0);
    const atom = new THREE.Group(); atom.position.copy(C); group.add(atom);
    const planes = RAD.map((r, i) => {
      const g = new THREE.Group(); g.rotation.set(TILT[i][0], 0, TILT[i][1]); atom.add(g);
      const ring = add(new THREE.TorusGeometry(r, 0.018, 8, 72), ringMat, 0, 0, 0, g); ring.rotation.x = Math.PI / 2;
      return g;
    });
    const nucleus = new THREE.Group(); atom.add(nucleus);
    const haloOk = ctx.glow('#5fe08a', 2.2, 0.75), haloPlus = ctx.glow('#ff9a7a', 2.2, 0.6), haloMinus = ctx.glow('#6fb8ff', 2.2, 0.6);
    for (const hlo of [haloOk, haloPlus, haloMinus]) { hlo.visible = false; atom.add(hlo); }

    // three dispensers at the front: tap one to send a particle into the atom
    const DISP = [[-2.5, 'p'], [0, 'n'], [2.5, 'e']], spots = {};
    const big = { p: red, n: grey, e: blue }, names = { p: 'Proton +', n: 'Neutron 0', e: 'Electron −' };
    for (const [x, kind] of DISP) {
      add(new THREE.CylinderGeometry(0.34, 0.42, 0.5, 18), steel, x, 0.25, 1.9);
      const ball = add(new THREE.SphereGeometry(kind === 'e' ? 0.26 : 0.32, 20, 14), big[kind], x, 0.86, 1.9);
      const tag = ctx.sprite(names[kind], { size: 0.3 }); tag.position.set(x, 1.45, 1.9); group.add(tag);
      spots[kind] = { ball, from: new THREE.Vector3(x, 0.86, 1.9).sub(C) };
    }
    const ask = ctx.sprite(`Build ${EL[target]} (${SYM[target]})`, { size: 0.46 }); ask.position.set(0, 4.75, 0); group.add(ask);
    const nameTags = EL.map((nm, i) => { if (!i) return null; const s = ctx.sprite(`${SYM[i]} · ${nm}`, { size: 0.34 }); s.position.set(0, 0.62, 0.9); s.visible = false; group.add(s); return s; });

    // pools of particles, hidden until they are added
    const geoN = new THREE.SphereGeometry(0.15, 16, 12), geoE = new THREE.SphereGeometry(0.1, 14, 10);
    const pool = (count, geo, m, parent) => Array.from({ length: count }, () => { const o = add(geo, m, 0, 0, 0, parent); o.visible = false; return { o, k: 0, to: new THREE.Vector3(), from: new THREE.Vector3(), on: false }; });
    const prot = pool(MAX, geoN, red, nucleus), neut = pool(MAX, geoN, grey, nucleus), elec = pool(MAX, geoE, blue, atom);
    // where the i-th particle of the nucleus sits: a tight ball that grows outwards
    const seat = (i, v) => { const r = i ? 0.21 * Math.cbrt(i) : 0, a = i * 2.39996, u = 1 - 2 * ((i * 0.618034) % 1); const q = Math.sqrt(Math.max(0, 1 - u * u)); return v.set(r * q * Math.cos(a), r * u, r * q * Math.sin(a)); };

    let p = 0, n = 0, e = 0, done = false, moves = 0, clock = 0, bump = 0;
    const rP = ui.readout('Protons'), rN = ui.readout('Neutrons'), rE = ui.readout('Electrons'), rQ = ui.readout('Charge, e'), rM = ui.readout('Mass number, u'), rEl = ui.readout('Element');
    const signed = (q) => (q > 0 ? '+' + q : q < 0 ? '−' + (-q) : '0');
    // Gives every proton and neutron its seat: the two kinds take turns so the nucleus looks mixed.
    const arrange = () => {
      let i = 0, a = 0, b = 0;
      while (a < p || b < n) {
        if (a < p) seat(i++, prot[a++].to);
        if (b < n) seat(i++, neut[b++].to);
      }
    };
    const show = (list, count, kind) => list.forEach((it, i) => {
      const want = i < count;
      if (want && !it.on) { it.k = 0; it.from.copy(spots[kind].from); it.o.position.copy(it.from); }
      it.on = want; it.o.visible = want;
    });
    const explain = () => {
      const q = model.charge(p, e), name = model.element(p);
      if (!p && !n && !e) return 'The stand is empty. Start with a proton: protons decide which element you are building.';
      if (!p) return 'Without a proton there is no element yet. The protons in the middle give the atom its name.';
      if (p !== target) return `${p} ${p === 1 ? 'proton makes' : 'protons make'} ${name || 'an element beyond this lab'}, because the proton count names the element. ${EL[target]} needs exactly ${target}.`;
      if (n !== NEU[target]) return `It is ${name} now. Neutrons do not change the name, but they hold the nucleus together and add mass. This ${name} needs ${NEU[target]}.`;
      if (q > 0) return `The nucleus is right. There are more protons (+) than electrons (−), so the atom has charge ${signed(q)}. Add ${q === 1 ? 'one more electron' : q + ' more electrons'} to balance it.`;
      if (q < 0) return `The nucleus is right. There are more electrons (−) than protons (+), so the atom has charge ${signed(q)}. Take ${q === -1 ? 'one electron' : -q + ' electrons'} away.`;
      return 'The number of protons decides which element it is. With the same number of electrons, the atom is balanced.';
    };
    const update = (spoken = true) => {
      arrange(); show(prot, p, 'p'); show(neut, n, 'n'); show(elec, e, 'e');
      const q = model.charge(p, e), name = model.element(p);
      rP.set(String(p)); rN.set(String(n)); rE.set(String(e)); rQ.set(signed(q)); rM.set(String(model.mass(p, n))); rEl.set(name || (p ? '?' : '–'));
      nameTags.forEach((s, i) => { if (s) s.visible = i === p; });
      haloOk.visible = p > 0 && q === 0; haloPlus.visible = q > 0; haloMinus.visible = q < 0;
      if (spoken) ctx.say(explain());
      if (!done && moves > 0 && model.built(p, n, e, target)) {
        done = true; bump = 1;
        ctx.complete(1, 'Built an atom by matching protons and electrons.');
      }
    };
    const change = (kind, d) => {
      const cl = (v) => Math.max(0, Math.min(MAX, v + d));
      if (kind === 'p') p = cl(p); else if (kind === 'n') n = cl(n); else e = cl(e);
      moves++; update();
    };
    ui.note(`Build ${EL[target]} (${SYM[target]}): it has ${target} ${target === 1 ? 'proton' : 'protons'}, ${NEU[target]} ${NEU[target] === 1 ? 'neutron' : 'neutrons'} and ${target} ${target === 1 ? 'electron' : 'electrons'}.`);
    ui.button('➕ 🔴 Proton', () => change('p', 1), 'btn'); ui.button('➖ Proton', () => change('p', -1), 'btn ghost');
    ui.button('➕ ⚪ Neutron', () => change('n', 1), 'btn'); ui.button('➖ Neutron', () => change('n', -1), 'btn ghost');
    ui.button('➕ 🔵 Electron', () => change('e', 1), 'btn'); ui.button('➖ Electron', () => change('e', -1), 'btn ghost');
    ui.button('↺ Clear', () => { p = n = e = 0; moves++; update(); }, 'btn ghost');
    ui.note('Protons are +, electrons are −, neutrons have no charge. You can also tap the three big balls at the front.');
    for (const [, kind] of DISP) ctx.onTap(spots[kind].ball, () => change(kind, 1));
    update(false);
    ctx.say(`Build ${EL[target]}. Tap a big ball or use the buttons to send particles into the atom.`);

    let plan = [], wait = 0;
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    return {
      step(dt) {
        if (plan.length) { wait -= dt; if (wait <= 0) { change(plan.shift(), 1); wait = 0.3; } }
      },
      frame(dt, time) {
        clock = time ?? clock + dt;
        const slow = ctx.calm ? 0.35 : 1;
        nucleus.rotation.y += dt * 0.5 * slow; nucleus.rotation.x = Math.sin(clock * 0.4) * 0.25;
        bump = Math.max(0, bump - dt * 1.2);
        nucleus.scale.setScalar(1 + Math.sin(bump * Math.PI) * 0.25);
        for (const list of [prot, neut]) for (const it of list) {
          if (!it.on) continue;
          it.k = Math.min(1, it.k + dt * 2.2);
          if (it.k < 1) { nucleus.worldToLocal(atom.localToWorld(v.copy(it.from))); it.o.position.lerpVectors(v, it.to, it.k * it.k * (3 - 2 * it.k)); it.o.position.y += Math.sin(it.k * Math.PI) * 0.5; }
          else it.o.position.lerp(it.to, Math.min(1, dt * 8));
        }
        const fill = model.shells(e); let idx = 0;
        fill.forEach((cnt, s) => {
          for (let i = 0; i < cnt; i++, idx++) {
            const it = elec[idx], a = clock * SPIN[s] * slow + (i / cnt) * Math.PI * 2 + s;
            w.set(Math.cos(a) * RAD[s], 0, Math.sin(a) * RAD[s]).applyEuler(planes[s].rotation);
            it.k = Math.min(1, it.k + dt * 1.8);
            if (it.k < 1) it.o.position.lerpVectors(it.from, w, it.k * it.k * (3 - 2 * it.k)); else it.o.position.copy(w);
          }
        });
        const pulse = 1 + Math.sin(clock * 2.2) * 0.05; haloOk.scale.setScalar(2.2 * pulse);
      },
      // Adds the particles one by one through the same code path as the buttons and taps.
      autoplay() {
        plan = [];
        for (let i = p; i < target; i++) plan.push('p');
        for (let i = n; i < NEU[target]; i++) plan.push('n');
        for (let i = e; i < target; i++) plan.push('e');
        if (p > target || n > NEU[target] || e > target) { p = Math.min(p, target); n = Math.min(n, NEU[target]); e = Math.min(e, target); moves++; update(); }
        wait = 0.2;
      },
      dispose() { plan = []; },
    };
  },
};
