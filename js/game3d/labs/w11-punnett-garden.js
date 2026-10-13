// 3D lab — Punnett Garden: two parent pea plants pass one allele each to the four plots of a terraced
// Punnett square, and a batch of 16 seeds sprouts tall or short in the bed at the front.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

const GENO = ['TT', 'Tt', 'tt'];
const TARGETS = [0, 25, 50, 100];

// ----- the model: one gene, two alleles, T (tall) fully dominant over t (short) -----
export const model = {
  GENO, TARGETS,
  gametes: (g) => g.split(''),
  // the four boxes of the square: rows are parent 1's alleles, columns are parent 2's
  cross: (p1, p2) => p1.split('').flatMap((x) => p2.split('').map((y) => [x, y].sort((u, v) => (u < v ? -1 : 1)).join(''))),
  isShort: (g) => g === 'tt',
  shortPct: (p1, p2) => model.cross(p1, p2).filter(model.isShort).length / 4 * 100,
};
export function selfTest() {
  const want = { 'TT×TT': 0, 'TT×Tt': 0, 'TT×tt': 0, 'Tt×TT': 0, 'Tt×Tt': 25, 'Tt×tt': 50, 'tt×TT': 0, 'tt×Tt': 50, 'tt×tt': 100 };
  let ok = true; const seen = new Set();
  for (const p of GENO) for (const q of GENO) { const v = model.shortPct(p, q); seen.add(v); if (v !== want[`${p}×${q}`]) ok = false; }
  const mono = model.cross('Tt', 'Tt'), count = (g) => mono.filter((x) => x === g).length;
  ok = ok && count('TT') === 1 && count('Tt') === 2 && count('tt') === 1 && model.cross('TT', 'tt').every((g) => g === 'Tt') && TARGETS.every((t) => seen.has(t));
  return { ok, detail: `Tt × Tt gives ${mono.join(', ')} (1 : 2 : 1, 25 % short); Tt × tt 50 %; tt × tt 100 %; any cross with TT 0 %; every target ${TARGETS.join(', ')} % has a cross` };
}

export default {
  id: 'w11-punnett-garden',
  world: 11,
  levels: [3, 4],
  title: 'Punnett Garden',
  goal: 'Choose parent pea plants so that the right share of their seeds grow short, then grow 16 seeds to test your cross.',
  kind: 'validated',
  model: 'One gene with two alleles and complete dominance (T tall over t short): each parent passes on one of its two alleles with equal chance, and the four plots of the square are the four equally likely seeds. Real traits often involve many genes, partial dominance and environment. A small batch of seeds will not match the exact ratio. The flower colours here are only markers for tall and short.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rng = ctx.rng || Math.random, L = ctx.level;
    const tap = ctx.onTap || (() => {});
    const target = TARGETS[Math.min(3, Math.floor(rng() * 4))];
    const HIDE = L >= 4;                       // at the higher level the square stays covered until the seeds are grown

    // ----- shared shapes and colours -----
    const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 8), ball = new THREE.SphereGeometry(1, 10, 8);
    const soil = ctx.mat('#6b4a33', { roughness: 1 }), stemMat = ctx.mat('#2f9e44', { roughness: 0.8 }), leafMat = ctx.mat('#4cc35b', { roughness: 0.8, flatShading: true });
    const tallMat = ctx.mat('#b072e0', { roughness: 0.6 }), shortMat = ctx.mat('#ffd76a', { roughness: 0.6 });
    const plotTall = ctx.mat('#a8e6bf', { roughness: 0.9 }), plotShort = ctx.mat('#ffcf5c', { roughness: 0.9 }), plotHidden = ctx.mat('#9aa4b8', { roughness: 0.9 });
    const add = (parent, geo, material, x, y, z, sx, sy = sx, sz = sx) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const label = (parent, text, x, y, z, size = 0.3) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); parent.add(s); return s; };
    // a pea plant drawn at full (tall) height; its inner group is squashed for a short plant and grows from the ground
    const makePlant = (x, y, z, size) => {
      const g = new THREE.Group(), inner = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(size); g.add(inner); group.add(g);
      add(inner, cyl, stemMat, 0, 0.8, 0, 0.045, 1.6, 0.045);
      const leaves = add(inner, ball, leafMat, 0, 0.85, 0, 0.3, 0.55, 0.22);
      const flower = add(inner, ball, tallMat, 0, 1.68, 0, 0.17);
      return { g, inner, leaves, flower, h: 0.02, want: 1, sway: rng() * 6 };
    };
    const SHORT = 0.42;

    // ----- the garden: lawn, two terraces carrying the 2 × 2 square, and the seed bed at the front -----
    add(group, box, ctx.mat('#7ccf6a', { roughness: 1 }), 0, 0.03, 0, 6.8, 0.06, 4.9);
    const RZ = [-1.65, -0.55], RY = [0.7, 0.4], CX = [-0.65, 0.65];
    add(group, box, soil, 0, RY[0] / 2, RZ[0], 2.9, RY[0], 1.1); add(group, box, soil, 0, RY[1] / 2, RZ[1], 2.9, RY[1], 1.1);
    const plots = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const tile = add(group, box, plotTall, CX[j], RY[i] + 0.03, RZ[i], 1.15, 0.06, 0.95);
      const plant = makePlant(CX[j] + 0.22, RY[i] + 0.06, RZ[i] - 0.1, 0.8);
      const tags = {}; for (const g of GENO) { tags[g] = label(group, g, CX[j] - 0.28, RY[i] + 0.36, RZ[i] + 0.3, 0.3); tags[g].visible = false; }
      plots.push({ tile, plant, tags });
    }
    const parentAt = [new THREE.Vector3(-2.75, 0.06, -1.0), new THREE.Vector3(2.75, 0.06, -1.0)];
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const parents = parentAt.map((p, k) => {
      add(group, cyl, ctx.mat('#b9794a', { roughness: 0.9 }), p.x, p.y + 0.2, p.z, 0.36, 0.4, 0.36);
      const plant = makePlant(p.x, p.y + 0.4, p.z, 1);
      const tags = {}; for (const g of GENO) { tags[g] = label(group, `Parent ${k + 1}: ${g}`, p.x + (k ? -0.15 : 0.15), 2.75, p.z, 0.32); tags[g].visible = false; }
      const hit = add(group, box, hitMat, p.x, 1.2, p.z, 0.9, 2.4, 0.9); hit.castShadow = false;
      return { plant, tags, hit };
    });
    // allele tokens: parent 1's two wait beside the rows, parent 2's two float over the columns
    const slotsAt = [new THREE.Vector3(-1.7, RY[0] + 0.4, RZ[0]), new THREE.Vector3(-1.7, RY[1] + 0.4, RZ[1]), new THREE.Vector3(CX[0], 2.85, RZ[0]), new THREE.Vector3(CX[1], 2.85, RZ[0])];
    const bigT = ctx.lit('#2f9e44', 0.5), smallT = ctx.lit('#ffcf5c', 0.7);
    const tokens = slotsAt.map((to, k) => {
      const g = new THREE.Group(); g.position.copy(to); group.add(g);
      const orb = add(g, ball, bigT, 0, 0, 0, 0.2); orb.castShadow = false;
      const big = label(g, 'T', 0, 0.38, 0, 0.3), small = label(g, 't', 0, 0.38, 0, 0.3);
      return { g, orb, big, small, to, from: parentAt[k < 2 ? 0 : 1].clone().setY(2.2), t: 1 };
    });
    // the seed bed: 16 sprouts as two instanced shapes
    const BY = 0.25, NB = 16, D = new THREE.Object3D(), tint = new THREE.Color();
    add(group, box, soil, 0, BY / 2, 1.55, 5.9, BY, 1.5);
    const stems = new THREE.InstancedMesh(cyl, stemMat, NB), tops = new THREE.InstancedMesh(ball, ctx.mat('#ffffff', { roughness: 0.6 }), NB);
    stems.frustumCulled = tops.frustumCulled = false; stems.castShadow = tops.castShadow = true; group.add(stems, tops);
    const sprouts = Array.from({ length: NB }, (_, i) => ({ x: -2.45 + (i % 8) * 0.7, z: 1.2 + Math.floor(i / 8) * 0.7, short: false, h: 0 }));
    const drawSprouts = () => {
      sprouts.forEach((sp, i) => {
        const full = sp.short ? 0.45 : 1.05, hh = Math.max(1e-4, full * sp.h);
        D.rotation.set(0, 0, 0); D.position.set(sp.x, BY + hh / 2, sp.z); D.scale.set(0.035, hh, 0.035); D.updateMatrix(); stems.setMatrixAt(i, D.matrix);
        D.position.set(sp.x, BY + hh, sp.z); D.scale.setScalar(Math.max(1e-4, 0.17 * Math.min(1, sp.h * 1.5))); D.updateMatrix(); tops.setMatrixAt(i, D.matrix);
        tops.setColorAt(i, tint.set(sp.short ? '#ffd76a' : '#b072e0'));
      });
      stems.instanceMatrix.needsUpdate = tops.instanceMatrix.needsUpdate = true; if (tops.instanceColor) tops.instanceColor.needsUpdate = true;
    };
    label(group, `Goal: ${target} % short`, 0, 3.75, RZ[0], 0.4);

    // ----- state, controls and readouts -----
    let p1 = 'Tt', p2 = 'Tt', pred = 0, guessed = false, done = false, grown = false, batch = null, tries = 0;
    const rS = ui.readout('Short seeds expected'), rT = ui.readout('Tall seeds expected'), rB = ui.readout('This batch of 16 seeds');
    const pct = () => model.shortPct(p1, p2);
    function refresh() {
      const cr = model.cross(p1, p2), open = !HIDE || grown;
      plots.forEach((pl, k) => {
        const g = cr[k], short = model.isShort(g);
        pl.tile.material = !open ? plotHidden : short ? plotShort : plotTall;
        pl.plant.want = !open ? 0.02 : short ? SHORT : 1; pl.plant.flower.material = short ? shortMat : tallMat;
        for (const q of GENO) pl.tags[q].visible = open && q === g;
      });
      [p1, p2].forEach((g, k) => { const pa = parents[k], short = model.isShort(g); pa.plant.want = short ? SHORT : 1; pa.plant.flower.material = short ? shortMat : tallMat; for (const q of GENO) pa.tags[q].visible = q === g; });
      [...model.gametes(p1), ...model.gametes(p2)].forEach((al, k) => { const tk = tokens[k], isT = al === 'T'; tk.orb.material = isT ? bigT : smallT; tk.orb.scale.setScalar(isT ? 0.2 : 0.13); tk.big.visible = isT; tk.small.visible = !isT; });
      rS.set(open ? `${pct()} %` : '? %'); rT.set(open ? `${100 - pct()} %` : '? %');
      rB.set(batch == null ? '–' : `${NB - batch.short} tall · ${batch.short} short (expected ${pct() / 100 * NB} short)`);
    }
    const setParent = (k, g) => {
      if (batch && !batch.over) return;
      if (k === 0) p1 = g; else p2 = g;
      grown = false; batch = null; for (const sp of sprouts) sp.h = 0; drawSprouts();
      for (let i = k * 2; i < k * 2 + 2; i++) tokens[i].t = ctx.calm ? 1 : 0;
      refresh();
      ctx.say(`Parents: ${p1} × ${p2}. ${HIDE ? 'Work out the four plots in your head, set your prediction, then grow 16 seeds to uncover the square.' : 'Look at the four plots: each one is a possible seed. Press “Grow 16 seeds” to test.'}`);
    };
    ui.note('Parent 1 (T = tall allele, t = short allele). You can also tap a parent plant to change it.');
    const c1 = ui.choice(GENO.map((g) => [g, g]), p1, (v) => setParent(0, v));
    ui.note('Parent 2');
    const c2 = ui.choice(GENO.map((g) => [g, g]), p2, (v) => setParent(1, v));
    const pick = (k, g) => { const c = k ? c2 : c1; if (c && typeof c.set === 'function') c.set(g); else setParent(k, g); };
    parents.forEach((pa, k) => tap(pa.hit, () => pick(k, GENO[(GENO.indexOf(k ? p2 : p1) + 1) % 3])));
    const pS = ui.slider({ label: 'My prediction: short seeds from these parents', min: 0, max: 100, step: 25, value: pred, unit: '%', onInput: (v) => { pred = Math.round(v / 25) * 25; guessed = true; } });
    function grow() {
      if (batch && !batch.over) return;
      const share = pct() / 100; let short = 0; tries++;
      for (const sp of sprouts) { sp.short = rng() < share; sp.h = 0; if (sp.short) short++; }
      batch = { short, t: 0, over: false, right: guessed && pred === pct() };
      grown = true; refresh();
    }
    ui.button('Grow 16 seeds', grow, 'btn');
    ui.note(`Mission: make ${target} % short seeds. Rows of the square get one allele from parent 1, columns one from parent 2. A gold plot is a short plant (tt); a green plot is a tall one.`);
    refresh(); drawSprouts();
    ctx.say(HIDE ? 'Each plot of the square is one possible seed. Predict how many are tt before you uncover it.' : 'Fill in the square: each plot is one possible seed. Count the plots with tt.');

    const verdict = () => {
      batch.over = true;
      const sp = pct(), chance = batch.short === sp / 100 * NB ? '' : ` This batch had ${batch.short} short plants, not exactly ${sp / 100 * NB}: a small batch wobbles by chance.`;
      if (sp === target) {
        ctx.say(`That cross gives the share you wanted: ${sp} % short. Each parent passes on one allele at random. A short plant needs two t alleles, so it only appears when both parents give a t.${chance}${guessed && !batch.right ? ' Your prediction did not match the square this time.' : ''}`);
        if (!done) { done = true; ctx.complete(batch.right ? 1 : 0.8, `${p1} × ${p2} gives ${sp}% short seeds, tries=${tries}.`); }
      } else {
        const why = sp > target ? 'Too many plots are tt. A parent with a T hides the short allele in every seed that gets it, so give at least one parent more T.' : 'Too few plots are tt. A short plant needs a t from both parents, so pick parents that carry more t.';
        ctx.say(`${p1} × ${p2} gives ${sp} % short seeds, not ${target} %. ${why}${chance}`);
      }
    };

    const ease = (t) => t * t * (3 - 2 * t);
    return {
      step(dt) {
        if (!batch || batch.over) return;
        batch.t += dt * (ctx.calm ? 4 : 1);
        sprouts.forEach((sp, i) => { sp.h = ease(Math.min(1, Math.max(0, (batch.t - i * 0.11) / 0.9))); });
        drawSprouts();
        if (batch.t >= (NB - 1) * 0.11 + 0.9) verdict();
      },
      frame(dt, time = 0) {
        const k = ctx.calm ? 1 : Math.min(1, dt * 4);
        for (const pl of [...plots.map((p) => p.plant), ...parents.map((p) => p.plant)]) {
          pl.h += (pl.want - pl.h) * k; pl.inner.scale.y = Math.max(0.02, pl.h);
          pl.flower.scale.set(0.17, 0.17 / Math.max(0.3, pl.h), 0.17);                 // keep the flower round when the plant is short
          pl.g.rotation.z = ctx.calm ? 0 : Math.sin(time * 1.3 + pl.sway) * 0.03;
        }
        for (const tk of tokens) {
          if (tk.t < 1) tk.t = Math.min(1, tk.t + dt * 1.6);
          const e = ease(tk.t); tk.g.position.copy(tk.from).lerp(tk.to, e); tk.g.position.y += Math.sin(Math.PI * tk.t) * 0.5 + (ctx.calm ? 0 : Math.sin(time * 2 + tk.to.x) * 0.04);
        }
      },
      // Shows a successful run without the player (used by tests): picks the cross for the target share and grows it.
      autoplay() {
        const [g1, g2] = { 0: ['TT', 'Tt'], 25: ['Tt', 'Tt'], 50: ['Tt', 'tt'], 100: ['tt', 'tt'] }[target];
        pick(0, g1); pick(1, g2); pS.set(model.shortPct(g1, g2));
        grow();
      },
      dispose() { for (const g of [box, cyl, ball]) g.dispose(); hitMat.dispose(); },
    };
  },
};
