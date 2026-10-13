// World 20 — Philosophy and Ethics: the Lantern Council on Sunrise Summit.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: statements about three groups A, B, C drawn as three overlapping rings -----
// The rings cut the table into 8 regions. Region r (0…7) lies inside ring i when bit i of r is set; region 0 is outside
// all three. An "arrangement" says, for each region, whether anything lives there: a number 0…255 (bit r = inhabited).
// A statement is [kind, subject ring, predicate ring] with kind 'all' | 'no' | 'some' | 'not' ("some … are not …").
const inside = (r, i) => ((r >> i) & 1) === 1;
const bits = (w) => { let n = 0; for (; w; w >>= 1) n += w & 1; return n; };
export const logic = {
  // Is the statement true in this arrangement?
  holds([q, s, p], w) {
    let both = false, sOnly = false;
    for (let r = 0; r < 8; r++) if (((w >> r) & 1) && inside(r, s)) { if (inside(r, p)) both = true; else sOnly = true; }
    return q === 'all' ? !sOnly : q === 'no' ? !both : q === 'some' ? both : sOnly;
  },
  // Tries every arrangement. Valid means: none of them makes all the premises true and the conclusion false.
  check(premises, conclusion) {
    let models = 0, breaks = 0, example = -1;
    for (let w = 0; w < 256; w++) {
      if (!premises.every((st) => logic.holds(st, w))) continue;
      models++;
      if (!logic.holds(conclusion, w)) { breaks++; if (example < 0 || bits(w) < bits(example)) example = w; }
    }
    return { valid: breaks === 0, total: 256, models, breaks, example };
  },
  // Regions inside the rings that a statement talks about: where "all" and "no" say nothing lives, or where
  // "some" says something lives (returned as a mask over regions 1…7).
  regions([q, s, p]) { let m = 0; for (let r = 1; r < 8; r++) if (inside(r, s) && inside(r, p) === (q === 'no' || q === 'some')) m |= 1 << r; return m; },
  universal: ([q]) => q === 'all' || q === 'no',
  // The finished diagram for a set of premises: shaded regions are empty, starred regions hold the "something".
  diagram(premises) {
    let shade = 0, mark = 0;
    for (const st of premises) if (logic.universal(st)) shade |= logic.regions(st);
    for (const st of premises) if (!logic.universal(st)) mark |= logic.regions(st) & ~shade;
    return { shade, mark };
  },
  text: ([q, s, p], T) => (q === 'all' ? `All ${T[s]} are ${T[p]}` : q === 'no' ? `No ${T[s]} are ${T[p]}` : q === 'some' ? `Some ${T[s]} are ${T[p]}` : `Some ${T[s]} are not ${T[p]}`),
  where(r, T) {
    if (!r) return 'outside all three rings';
    const ins = [], outs = []; for (let i = 0; i < 3; i++) (inside(r, i) ? ins : outs).push(T[i]);
    return `inside ${ins.join(' and ')}${outs.length ? `, outside ${outs.join(' and ')}` : ''}`;
  },
};

// The library of arguments. t = the three groups (rings A, B, C); p = premises; c = conclusion; valid = what the
// checker must say; real = whether the conclusion is true in everyday life; odd = a premise that is not true in real life.
const A = (t, p, c, valid, real, odd = false) => ({ t, p, c, valid, real, odd });
const VALID = [
  A(['kites', 'things that fly', 'things with strings'], [['all', 0, 1], ['some', 2, 0]], ['some', 2, 1], true, true),
  A(['puppies', 'dogs', 'animals'], [['all', 0, 1], ['all', 1, 2]], ['all', 0, 2], true, true),
  A(['goldfish', 'fish', 'birds'], [['all', 0, 1], ['no', 1, 2]], ['no', 0, 2], true, true),
  A(['squares', 'shapes with four sides', 'floor tiles'], [['all', 0, 1], ['some', 2, 0]], ['some', 2, 1], true, true),
  A(['apples', 'fruit', 'things that grow on plants'], [['all', 0, 1], ['all', 1, 2]], ['all', 0, 2], true, true),
];
const TRICKY = [
  A(['kites', 'things that fly', 'paper planes'], [['all', 0, 1], ['all', 2, 1]], ['all', 2, 0], false, false),
  A(['bikes', 'things with wheels', 'scooters'], [['all', 0, 1], ['all', 2, 1]], ['all', 2, 0], false, false),
  A(['ducks', 'birds', 'good swimmers'], [['all', 0, 2], ['all', 0, 1]], ['all', 1, 2], false, false),
  A(['drums', 'instruments', 'flutes'], [['all', 0, 1], ['no', 2, 0]], ['no', 2, 1], false, false),
];
const TRUE_BUT = [
  A(['puppies', 'animals', 'dogs'], [['all', 0, 1], ['all', 2, 1]], ['all', 0, 2], false, true),
  A(['pets', 'cats', 'stripy animals'], [['some', 0, 1], ['some', 1, 2]], ['some', 0, 2], false, true),
  A(['roses', 'flowers', 'red things'], [['all', 0, 1], ['some', 1, 2]], ['some', 0, 2], false, true),
  A(['sparrows', 'things with wings', 'birds'], [['all', 0, 1], ['all', 2, 1]], ['all', 0, 2], false, true),
];
const ODD = [
  A(['goldfish', 'fish', 'tree climbers'], [['all', 0, 1], ['all', 1, 2]], ['all', 0, 2], true, false, true),
  A(['clouds', 'things made of cotton', 'things in the sky'], [['all', 0, 1], ['some', 2, 0]], ['some', 2, 1], true, false, true),
];

// Used by the automated tests: four textbook forms with known answers, and every argument in the library.
export function selfTest() {
  const barbara = logic.check([['all', 0, 1], ['all', 1, 2]], ['all', 0, 2]);
  const darii = logic.check([['all', 1, 2], ['some', 0, 1]], ['some', 0, 2]);
  const middle = logic.check([['all', 0, 1], ['all', 2, 1]], ['all', 2, 0]);
  const some = logic.check([['some', 0, 1], ['some', 1, 2]], ['some', 0, 2]);
  const lib = [...VALID, ...TRICKY, ...TRUE_BUT, ...ODD], agree = lib.filter((a) => logic.check(a.p, a.c).valid === a.valid).length;
  // every finished diagram must be possible: no premise may have all of its stars shaded away
  const drawable = lib.every((a) => a.p.every((st) => logic.universal(st) || (logic.regions(st) & ~logic.diagram(a.p).shade) !== 0));
  return {
    ok: barbara.valid && darii.valid && !middle.valid && !some.valid && barbara.total === 256 && agree === lib.length && drawable,
    detail: `of 256 arrangements — Barbara: ${barbara.models} fit the premises, ${barbara.breaks} break it; Darii: ${darii.models} fit, ${darii.breaks} break; undistributed middle: ${middle.models} fit, ${middle.breaks} break; some-some: ${some.models} fit, ${some.breaks} break; library ${agree}/${lib.length} agree`,
  };
}

const sim = {
  title: 'The rings of reason',
  goal: 'Record each premise on the three rings, then judge the argument: must the conclusion follow, or could the premises be true while the conclusion is false?',
  kind: 'validated',
  model: 'Statements of the kinds "All A are B", "No A are B", "Some A are B" and "Some A are not B" about three groups, drawn as three overlapping rings. The rings make 8 regions (7 inside, 1 outside), so there are exactly 256 ways for the regions to be empty or lived in, and the checker tries every one: an argument is valid only when none of them makes the premises true and the conclusion false. It is checked against four textbook forms. "All A are B" is read the modern way: it does not promise that any A exists. It leaves out whether the premises are really true, arguments with more than three groups, words such as "most" or "probably", and words that change their meaning half way through.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, easy = ctx.level <= 2;
    const pick = (list, not) => { const pool = list.filter((a) => a !== not); return pool[Math.min(pool.length - 1, Math.floor(ctx.rng() * pool.length))]; };
    // which arguments this level asks for
    let round;
    if (easy) round = [pick(VALID)];
    else if (ctx.level <= 4) { const v = pick(VALID), x = pick(TRICKY); round = [v, x, ctx.rng() < 0.5 ? pick(VALID, v) : pick(TRICKY, x)]; }
    else if (ctx.level === 5) round = [pick(TRICKY), pick(TRUE_BUT), pick(ODD)];
    else { const a = pick(TRUE_BUT); round = [a, pick(ODD), pick(TRUE_BUT, a)]; }

    // ----- the tilted table and the three rings -----
    const COL = ['#6741d9', '#f59f00', '#12a594'], R = 1.25, CEN = [[-0.75, 0.5], [0.75, 0.5], [0, -0.75]];
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.6, 1.9, 16), ctx.mat('#7a5a8c', { roughness: 0.5 })); stand.position.set(0, 0.95, -0.5); group.add(stand);
    const board = new THREE.Group(); board.position.set(0, 2.7, 0); board.rotation.x = -0.5; group.add(board);
    const table = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5, 0.16), ctx.mat('#f6eedb', { roughness: 0.9 })); table.position.set(0, -0.12, -0.1); board.add(table);
    const made = [table.geometry, stand.geometry];
    CEN.forEach(([x, y], i) => {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 56), new THREE.MeshBasicMaterial({ color: COL[i], transparent: true, opacity: 0.26, depthWrite: false })); disc.position.set(x, y, 0.01 + i * 0.006); disc.renderOrder = 1; board.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 8, 72), ctx.lit(COL[i], 0.55)); rim.position.set(x, y, 0.03); board.add(rim);
      made.push(disc.geometry, disc.material, rim.geometry);
    });
    // each region is built from small squares, so its shape is exact enough to shade
    const CELL = 0.07, quads = Array.from({ length: 8 }, () => []), mid = Array.from({ length: 8 }, () => [0, 0, 0]);
    for (let x = -2.05; x < 2.05; x += CELL) for (let y = -2.05; y < 1.8; y += CELL) {
      let r = 0; CEN.forEach(([cx, cy], i) => { if (Math.hypot(x + CELL / 2 - cx, y + CELL / 2 - cy) < R) r |= 1 << i; });
      if (!r) continue;
      quads[r].push(x, y, 0, x + CELL, y, 0, x + CELL, y + CELL, 0, x, y, 0, x + CELL, y + CELL, 0, x, y + CELL, 0);
      mid[r][0] += x + CELL / 2; mid[r][1] += y + CELL / 2; mid[r][2]++;
    }
    const shadeMat = new THREE.MeshBasicMaterial({ color: 0x2b2140, transparent: true, opacity: 0.74, depthWrite: false }); made.push(shadeMat);
    const pebbleGeo = new THREE.SphereGeometry(0.11, 14, 10), pebbleMat = ctx.lit('#fffaf0', 0.9); made.push(pebbleGeo);
    const shadeM = [], star = [], pebble = [], at = [[2.7, -2.1]];
    for (let r = 0; r < 8; r++) {
      if (r) {
        at[r] = [mid[r][0] / mid[r][2], mid[r][1] / mid[r][2]];
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(quads[r]), 3)); made.push(geo);
        shadeM[r] = new THREE.Mesh(geo, shadeMat); shadeM[r].position.z = 0.045; shadeM[r].renderOrder = 2; shadeM[r].visible = false; board.add(shadeM[r]);
        star[r] = ctx.sprite('★', { size: 0.46, color: '#fff7c2' }); star[r].position.set(at[r][0], at[r][1], 0.2); star[r].visible = false; board.add(star[r]);
      }
      pebble[r] = new THREE.Mesh(pebbleGeo, pebbleMat); pebble[r].position.set(at[r][0] + (r ? 0.12 : 0), at[r][1] - (r ? 0.12 : 0), 0.13); pebble[r].visible = false; board.add(pebble[r]);
    }
    const cursor = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 28), ctx.lit('#ffd43b', 1.4)); cursor.position.z = 0.1; cursor.visible = !easy; board.add(cursor); made.push(cursor.geometry);
    let labels = [];
    const setLabels = (T) => {
      for (const l of labels) { l.removeFromParent(); l.material.map?.dispose(); l.material.dispose(); }
      labels = T.map((name, i) => { const l = ctx.sprite(name, { size: 0.34, bg: COL[i] }); l.position.set([-1.7, 1.7, 0][i], [2.05, 2.05, -2.32][i], 0.16); board.add(l); return l; });
    };

    // ----- state and controls -----
    const ORDER = [1, 2, 4, 3, 5, 6, 7];                                   // slider position → region
    let idx = 0, arg = round[0], st = new Array(8).fill(0), applied = [false, false], sel = 1, verdict = null, solved = false, wrong = 0, slips = 0, auto = null;
    const rN = ui.readout('Argument'), rP1 = ui.readout('Premise 1'), rP2 = ui.readout('Premise 2'), rC = ui.readout('Conclusion');
    const rR = easy ? null : ui.readout('Chosen region'), rT = ui.readout('Arrangements tried'), rB = ui.readout('Arrangements that break it');
    const draw = () => {
      for (let r = 1; r < 8; r++) { shadeM[r].visible = st[r] === 1; star[r].visible = st[r] === 2; }
      cursor.position.x = at[sel][0]; cursor.position.y = at[sel][1];
      rR?.set(logic.where(sel, arg.t));
    };
    const load = (i) => {
      idx = i; arg = round[i]; st = new Array(8).fill(0); applied = [false, false]; solved = false;
      for (const p of pebble) p.visible = false;
      setLabels(arg.t);
      rN.set(`${i + 1} of ${round.length}`); rP1.set(logic.text(arg.p[0], arg.t)); rP2.set(logic.text(arg.p[1], arg.t)); rC.set(`So: ${logic.text(arg.c, arg.t).toLowerCase()}`); rT.set('–'); rB.set('–');
      draw();
    };
    // Records one whole premise (the helper used at the first levels).
    const apply = (i) => {
      if (solved) return;
      const p = arg.p[i], sentence = logic.text(p, arg.t), want = logic.diagram(arg.p), m = logic.regions(p); let n = 0;
      for (let r = 1; r < 8; r++) if ((m >> r) & 1) { if (logic.universal(p)) { st[r] = 1; n++; } else if (!((want.shade >> r) & 1)) { st[r] = 2; n++; } }
      applied[i] = true; draw();
      if (logic.universal(p)) ctx.say(`"${sentence}." So the part of the ${arg.t[p[1]]} ring that is ${p[0] === 'all' ? 'outside' : 'inside'} the ${arg.t[p[2]]} ring must be empty. I shaded ${n} ${n === 1 ? 'region' : 'regions'}: nothing lives there.`);
      else ctx.say(`"${sentence}." So something lives where those two rings overlap. ${n === 1 ? 'Only one region is left for it, so the star is certain.' : `It is in one of the ${n} starred regions. We do not know which.`}`);
    };
    const put = (v) => { if (solved) return; st[sel] = v; draw(); };
    // What is still missing from the diagram, as a hint (null when it is right).
    const hint = () => {
      if (easy) return applied[0] && applied[1] ? null : `Record ${applied[0] ? 'premise 2' : 'premise 1'} on the rings first. A fair thinker writes down what was said before judging it.`;
      const want = logic.diagram(arg.p);
      for (let i = 0; i < 2; i++) {
        const p = arg.p[i], need = logic.regions(p) & (logic.universal(p) ? 255 : ~want.shade), state = logic.universal(p) ? 1 : 2; let left = 0;
        for (let r = 1; r < 8; r++) if (((need >> r) & 1) && st[r] !== state) left++;
        if (!left) continue;
        return logic.universal(p)
          ? `Premise ${i + 1} says "${logic.text(p, arg.t)}". Shade every part of the ${arg.t[p[1]]} ring that is ${p[0] === 'all' ? 'outside' : 'inside'} the ${arg.t[p[2]]} ring. ${left} ${left === 1 ? 'region still needs' : 'regions still need'} shading.`
          : `Premise ${i + 1} says "${logic.text(p, arg.t)}". Put a star in every unshaded region that is inside ${arg.t[p[1]]} and ${p[0] === 'some' ? 'inside' : 'outside'} ${arg.t[p[2]]}. ${left} ${left === 1 ? 'star is' : 'stars are'} still missing.`;
      }
      for (let r = 1; r < 8; r++) {
        if (st[r] === 1 && !((want.shade >> r) & 1)) return `You shaded the region ${logic.where(r, arg.t)}. No premise says it is empty, so clear it. Only record what was really said.`;
        if (st[r] === 2 && !((want.mark >> r) & 1)) return `You put a star ${logic.where(r, arg.t)}. No premise says something lives there, so clear it.`;
      }
      return null;
    };
    const score = () => Math.round(Math.max(0.4, 1 - 0.2 * wrong - 0.05 * slips) * 100) / 100;
    const check = () => {
      if (solved) return;
      const h = hint();
      if (h) { slips++; ctx.say(h); return; }
      if (!verdict) { ctx.say('The diagram matches both premises. Now choose: must the conclusion follow, or not?'); return; }
      const res = logic.check(arg.p, arg.c), right = (verdict === 'valid') === res.valid, last = idx === round.length - 1;
      rT.set(String(res.total)); rB.set(String(res.breaks));
      for (let r = 0; r < 8; r++) pebble[r].visible = !res.valid && ((res.example >> r) & 1) === 1;
      let why;
      if (res.valid) {
        why = `It is valid. I tried all 256 ways the 8 regions can be empty or lived in. ${res.models} of them make both premises true, and the conclusion is true in every one. No arrangement breaks it.`;
        if (arg.odd) why += ' But valid does not mean true! One premise is not true in real life. Valid only says: if the premises were true, the conclusion would have to be true too.';
      } else {
        const homes = []; for (let r = 0; r < 8; r++) if ((res.example >> r) & 1) homes.push(logic.where(r, arg.t));
        why = `It is not valid. Of the 256 arrangements, ${res.breaks} make both premises true and the conclusion false. The pebbles show one: ${homes.length ? `something ${homes.join(', and something ')}, and nothing anywhere else` : 'nothing anywhere at all'}.`;
        why += arg.real ? ' The conclusion happens to be true in real life, but these premises do not prove it. True and valid are different things.' : ' It sounded convincing, but the premises leave room for the conclusion to be false.';
      }
      if (!right) { wrong++; ctx.say(`Not quite, and that is fine: changing your mind for a good reason is good thinking. ${why}`); return; }
      solved = true;
      if (!last) { ctx.say(`Well judged. ${why} Press "Next argument" when you are ready.`); return; }
      ctx.say(`Well judged. ${why} When friends disagree kindly and check each step together, everyone thinks better.`);
      ctx.complete(score(), `arguments=${round.length}, wrong=${wrong}, slips=${slips}`);
    };
    const next = () => { if (solved && idx < round.length - 1) { load(idx + 1); ctx.say('A new argument. Record both premises on the rings, then judge it.'); } };

    let regS = null;
    if (easy) { ui.button('Record premise 1', () => apply(0), 'btn'); ui.button('Record premise 2', () => apply(1), 'btn'); }
    else {
      regS = ui.slider({ label: 'Region', min: 1, max: 7, step: 1, value: 1, unit: '', onInput: (v) => { sel = ORDER[Math.max(0, Math.min(6, Math.round(v) - 1))]; draw(); } });
      ui.button('Shade: nothing here', () => put(1), 'btn'); ui.button('Mark: something here', () => put(2), 'btn'); ui.button('Clear this region', () => put(0), 'btn ghost');
    }
    const verdictC = ui.choice([['valid', 'Valid: it must follow'], ['not', 'Not valid: it need not follow']], null, (v) => { verdict = v; });
    ui.button('Check', check, 'btn gold');
    if (!easy) ui.button('Next argument', next, 'btn ghost');
    ui.note('A shaded region is empty. A star means something lives in one of the starred regions. An argument is valid when no arrangement of the regions makes the premises true and the conclusion false.');
    load(0);
    ctx.say(easy ? 'Two premises and a conclusion. Record each premise on the rings, then decide whether the conclusion must follow.' : `${round.length} arguments are waiting. Choose a region, then shade it or star it until the rings show both premises. Then judge the conclusion. Careful: one of them only sounds right.`);

    return {
      // Only the demonstration needs time: it takes one small action at a time, the way a player would.
      step(dt) {
        if (!auto) return;
        auto.t -= dt; if (auto.t > 0) return; auto.t = 0.45;
        if (solved) { if (idx < round.length - 1) next(); else auto = null; return; }
        if (easy) { if (!applied[0]) return apply(0); if (!applied[1]) return apply(1); }
        else {
          const want = logic.diagram(arg.p);
          for (let i = 0; i < 7; i++) { const r = ORDER[i], w = (want.shade >> r) & 1 ? 1 : (want.mark >> r) & 1 ? 2 : 0; if (st[r] !== w) { sel = r; regS.set(i + 1); return put(w); } }
        }
        verdict = logic.check(arg.p, arg.c).valid ? 'valid' : 'not'; verdictC.set?.(verdict); check();
      },
      frame(dt, time) {
        const s = ctx.calm ? 1 : 1 + Math.sin(time * 4) * 0.12; cursor.scale.set(s, s, 1);
        if (!ctx.calm) for (let r = 0; r < 8; r++) if (pebble[r].visible) pebble[r].position.z = 0.13 + Math.abs(Math.sin(time * 2.4 + r)) * 0.08;
      },
      // Shows a successful run without the player (used by tests).
      autoplay() { auto = { t: 0 }; },
      dispose() { setLabels([]); for (const s of star) { s?.material.map?.dispose(); s?.material.dispose(); } for (const g of made) g.dispose(); },
      get state() { return { idx, solved, wrong, slips }; },
    };
  },
};

export default {
  id: 20,
  theme: {
    sky: ['#6fa8e8', '#ffc98a', '#fff0cf'], fog: '#ffe6bf', fogNear: 55, fogFar: 180,
    ground: '#efe2c0', ground2: '#c9dc9a', side: '#b89a78', stone: '#f6eedb', accent: '#6741d9', glow: '#ffb92e', metal: '#7a5a8c', wood: '#8a5a3a', leaf: '#7fb069', water: '#7fd3e6', crate: '#f2c078',
    sun: '#ffe0a3', sunPower: 2.5, ambient: 1.45, skyLight: '#fff3d6', groundLight: '#d9b38c', sunDir: [-0.6, 0.55, 0.5], particles: 'sparks',
  },
  layout: { mirror: -1, stones: 4, rise: 0.6, towerH: 4.5 },
  story: {
    title: 'The Lantern Council',
    crystal: 'question lanterns', crystalEm: '🏮',
    intro: ['Welcome to Sunrise Summit, home of the Lantern Council! Our thinkers used to solve hard questions together.', 'But they have forgotten how. Now everyone talks at once and nobody listens. The five question lanterns went out and drifted away across the garden.'],
    remind: 'The question lanterns glow gold. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five lanterns are lit! Now ride the lift from the tower to the table of rings and show the council how to test an argument fairly.',
    afterSim: 'You tested every argument step by step. The Council Master is waiting in the ring of stone seats, up the steps.',
    notReady: 'The council seats are for those who have done the thinking. Bring all five question lanterns and finish the rings of reason first.',
    rival: ['So you can fill in three rings. A good thinker also listens, and changes their mind when the reason is good.', 'We each build a bridge of light, one piece for every right answer. Let us see whose reasons reach the far side first.'],
    win: ['Your bridge is finished first, and every step was well reasoned. I learned something today. The portal is yours.'],
    lose: ['My bridge is finished and yours is not. That is all right. Read the tablets again, then come back and we will reason together once more.'],
    outro: 'The lanterns are glowing, the council is listening to one another again, and the Council Master has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, m = S.sim[0] < 0 ? -1 : 1, cream = k.mat('#f6eedb'), plum = k.mat('#7a5a8c', { roughness: 0.5 });
    // home island: a reflecting pool, a spiral of stepping tiles, lantern posts by the gate
    const pool = k.mesh(new THREE.CircleGeometry(1.5, 36), k.mat('#8fd9e8', { roughness: 0.08, metalness: 0.25 }), 0, 0.03, 0); pool.rotation.x = -Math.PI / 2; pool.castShadow = false;
    const rim = k.mesh(new THREE.RingGeometry(1.5, 1.8, 36), cream, 0, 0.035, 0); rim.rotation.x = -Math.PI / 2; rim.castShadow = false;
    const tileGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.06, 10);
    for (let i = 0; i < 6; i++) { const a = 0.5 + i * 0.78, r = 2.6 + i * 0.62; k.mesh(tileGeo, i % 2 ? plum : cream, Math.cos(a) * r, 0.04, Math.sin(a) * r).castShadow = false; }
    k.prop('lamp', 3.6, 0, 6.9); k.prop('lamp', -3.6, 0, 6.9);
    // the thinking-bench under a blossom tree
    k.prop('tree', 6.8 * m, 0, -4.6, { s: 1.25, color: '#e3a1c8', solid: true });
    k.block(5.3 * m, 0.5, -6, 1.7, 0.5, 0.6, { color: '#f6eedb' });
    k.mesh(new THREE.BoxGeometry(1.7, 0.6, 0.12), plum, 5.3 * m, 0.8, -6.3);
    // the wise owl: a statue made of simple shapes, looking at the pool
    const ox = -7.6 * m, oz = 0.2, owl = k.add(new THREE.Group()); owl.position.set(ox, 0.7, oz); owl.rotation.y = Math.PI / 2 * m;
    k.block(ox, 0.7, oz, 1.2, 0.7, 1.2, { color: '#f6eedb' });
    k.mesh(new THREE.SphereGeometry(0.55, 16, 12), plum, 0, 0.62, 0, owl).scale.set(1, 1.22, 0.9);
    k.mesh(new THREE.SphereGeometry(0.42, 16, 12), plum, 0, 1.42, 0.04, owl);
    const eyeGeo = new THREE.SphereGeometry(0.12, 12, 8), tuftGeo = new THREE.ConeGeometry(0.1, 0.3, 4);
    for (const sx of [-1, 1]) { k.mesh(eyeGeo, k.lit('#ffb92e', 1.2), sx * 0.17, 1.5, 0.39, owl).castShadow = false; k.mesh(tuftGeo, plum, sx * 0.25, 1.84, 0, owl); }
    k.mesh(new THREE.ConeGeometry(0.07, 0.2, 4), k.mat('#f59f00'), 0, 1.36, 0.46, owl).rotation.x = Math.PI / 2;
    // bonsai-like trees growing from rocks
    k.prop('rock', -5.9 * m, 0, -6.2, { s: 0.8 }); k.prop('tree', -5.9 * m, 0.55, -6.2, { s: 0.5 });
    const mid = S.mid;
    k.prop('rock', -3.6 * m, mid[1], mid[2] + 4.2, { s: 0.8 }); k.prop('tree', -3.6 * m, mid[1] + 0.55, mid[2] + 4.2, { s: 0.5, color: '#e3a1c8' });
    k.prop('tree', S.sim[0] - 5.2 * m, S.sim[1], S.sim[2] + 4.3, { s: 0.55 });
    // a balance scale on the middle island: it rocks gently and never quite settles
    const bx = 3.9 * m, bz = mid[2] - 3.6;
    k.mesh(new THREE.CylinderGeometry(0.07, 0.14, 1.9, 8), plum, bx, mid[1] + 0.95, bz);
    const beam = k.mesh(new THREE.BoxGeometry(2, 0.07, 0.07), k.mat('#f59f00', { metalness: 0.5, roughness: 0.35 }), bx, mid[1] + 1.9, bz);
    const panGeo = new THREE.ConeGeometry(0.34, 0.5, 14, 1, true), pans = [-1, 1].map((sx) => k.mesh(panGeo, k.mat('#f59f00', { metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }), sx * 0.95, -0.27, 0, beam));
    k.animate((dt, t) => { beam.rotation.z = Math.sin(t * 0.7) * 0.12; for (const p of pans) p.rotation.z = -beam.rotation.z; });
    // paper lanterns rise and bob over the stepping stones and the lagoon
    const lanternGeo = new THREE.CylinderGeometry(0.27, 0.2, 0.5, 8);
    const lanterns = [[-3.6, 2.6, 14], [3.9, 3.6, 21.5], [-5.6, 4.2, mid[2] + 9], [5.2, 4.8, mid[2] + 15], [8 * m, 7.5, S.far[2] + 1]].map(([x, y, z], i) => {
      const l = k.mesh(lanternGeo, k.lit(i % 2 ? '#ff9f6b' : '#ffc14d', 1.4), x, y, z); l.castShadow = false; l.add(k.glow('#ffc14d', 2.2, 0.55)); return { l, y, i };
    });
    k.animate((dt, t) => { for (const { l, y, i } of lanterns) { const u = (t * 0.045 + i * 0.23) % 1, s = Math.min(1, u * 6, (1 - u) * 6); l.position.y = y + u * 4 + Math.sin(t * 1.4 + i * 2) * 0.15; l.rotation.y = t * 0.3 + i; l.scale.setScalar(Math.max(0.01, s)); } });
    // the archway of questions on the far island, and tall banners
    const az = S.far[2] - 4.6;
    k.prop('arch', 0, S.far[1], az);
    const marks = [[-1.5, 4.4], [0, 5.3], [1.5, 4.4]].map(([x, y]) => k.sign('?', x, S.far[1] + y, az, { size: 0.8, bg: 'rgba(103,65,217,.88)' }));
    k.animate((dt, t) => { marks.forEach((s, i) => { s.position.y = S.far[1] + [4.4, 5.3, 4.4][i] + Math.sin(t * 1.5 + i * 1.3) * 0.14; }); });
    k.prop('banner', -5.2, S.far[1], S.far[2] - 1.6, { s: 1.3 }); k.prop('banner', 5.2, S.far[1], S.far[2] - 1.6, { s: 1.3, color: '#f59f00' });
    k.prop('banner', S.sim[0] + 5.8 * m, S.sim[1], S.sim[2] - 1.9, { s: 1.3, color: '#f59f00' });
    k.prop('lamp', S.sim[0] - 5.4 * m, S.sim[1], S.sim[2] - 4.3);
    // the council: a ring of stone seats around the arena, open at the steps and at the bridges
    for (const sx of [-1, 1]) for (const a of [-0.75, -0.25, 0.25, 0.75]) k.block(S.arena[0] + sx * Math.cos(a) * 6.2, S.arena[1] + 0.5, S.arena[2] + Math.sin(a) * 6.2, 0.9, 0.5, 0.9, { color: '#f6eedb' });
    // the rising sun, and the sea of clouds far below the islands
    const sun = k.mesh(new THREE.SphereGeometry(9, 28, 18), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }), -72, 10, 62); sun.castShadow = false; sun.receiveShadow = false;
    for (const [x, y, z, s] of [[-14, -7, 4, 3.2], [13, -9, 12, 3.6], [-9, -6, 26, 2.8], [12, -8, 36, 3.4], [-15, -9, 48, 3.8], [8, -6, 60, 3], [-34, -4, 54, 3.6], [-6, -5, 74, 3.2], [-33, -3, 76, 3.4], [-8, -4, 94, 3.6], [-31, -3, 98, 3.2]]) k.prop('cloud', x, y, z, { s, color: '#fff6e6' });
  },
  sim,
};
