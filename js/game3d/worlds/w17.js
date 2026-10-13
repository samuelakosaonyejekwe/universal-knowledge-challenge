// World 17 — How to Think, Knowledge and Strategy: the Labyrinth of Reason.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: one lantern behind one of N doors; the guide knows where it is and opens every other door but one -----
export const model = {
  // One round as an exact random experiment. rng() gives numbers from 0 up to (not including) 1.
  round(rng, doors, switchIt) {
    const lantern = Math.min(doors - 1, Math.floor(rng() * doors)), pick = Math.min(doors - 1, Math.floor(rng() * doors));
    // The guide leaves one other door shut: the lantern's door when the pick is wrong, any other door when it is right.
    let other = lantern;
    if (pick === lantern) { other = Math.min(doors - 2, Math.floor(rng() * (doors - 1))); if (other >= pick) other++; }
    const final = switchIt ? other : pick;
    return { lantern, pick, other, final, found: final === lantern };
  },
  // Every equally likely case: lantern door × picked door × the guide's free choice. Returns [times found, cases].
  exact(doors, switchIt) {
    let wins = 0, cases = 0;
    for (let lantern = 0; lantern < doors; lantern++) for (let pick = 0; pick < doors; pick++) for (let j = 0; j < doors - 1; j++) {
      const other = pick === lantern ? (j >= pick ? j + 1 : j) : lantern, final = switchIt ? other : pick;
      cases++; if (final === lantern) wins++;
    }
    return [wins, cases];
  },
  truth: (doors, switchIt) => (switchIt ? (doors - 1) / doors : 1 / doors),
  // A small seeded generator (mulberry32) so a long run can be repeated exactly.
  seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
};
// Used by the automated tests: counting every case gives exactly 1/3, 2/3 and (with 5 doors) 4/5, and a seeded run
// of 30,000 rounds lands within 3 standard errors of those values.
export function selfTest() {
  const [s3, c3] = model.exact(3, false), [w3, d3] = model.exact(3, true), [w5, d5] = model.exact(5, true), [s5, c5] = model.exact(5, false);
  const exactOk = s3 * 3 === c3 && w3 * 3 === 2 * d3 && w5 * 5 === 4 * d5 && s5 * 5 === c5;
  const N = 30000, rng = model.seeded(17), run = (doors, sw) => { let f = 0; for (let i = 0; i < N; i++) if (model.round(rng, doors, sw).found) f++; return f / N; };
  const z = (p, q) => Math.abs(p - q) / Math.sqrt(q * (1 - q) / N);
  const a = run(3, true), b = run(3, false), c = run(5, true), za = z(a, 2 / 3), zb = z(b, 1 / 3), zc = z(c, 4 / 5);
  return { ok: exactOk && za < 3 && zb < 3 && zc < 3, detail: `exact: stick ${s3}/${c3}, switch ${w3}/${d3}, 5 doors switch ${w5}/${d5}; 30,000 seeded rounds: switch ${(a * 100).toFixed(2)} % (${za.toFixed(2)} SE), stick ${(b * 100).toFixed(2)} % (${zb.toFixed(2)} SE), 5 doors ${(c * 100).toFixed(2)} % (${zc.toFixed(2)} SE)` };
}

const sim = {
  title: 'Three doors, one lantern',
  goal: 'A lantern hides behind one of three doors. Predict how often your strategy will find it, then test it over many rounds. Discover which strategy is better, and by how much.',
  kind: 'validated',
  model: 'Each round is an exact random experiment: the lantern is equally likely to be behind any door, you pick a door at random, the guide (who knows where the lantern is) opens every other door but one and never opens the lantern\'s door, and then you stick or switch. Counting every case gives exactly 1 in 3 for sticking and 2 in 3 for switching, or (N − 1) in N with N doors; a seeded run of 30,000 rounds is checked against those values. It leaves out a guide who opens doors without knowing, a guide who only sometimes offers the switch, and any clue such as light under a door.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rnd = ctx.rng || Math.random, lv = Math.max(1, Math.min(6, ctx.level || 1));
    const NEED = [20, 40, 100, 200, 300, 500][lv - 1], TOL = [15, 15, 10, 8, 5, 4][lv - 1], HARD = lv >= 5, MAXD = 7, X0 = -1.3, TOP = 4;
    // the stage: a white stone floor strip, up to seven doors, one lantern, a pointer for the chosen door
    const stone = ctx.mat('#f4f8fb'), dark = ctx.mat('#27455a', { roughness: 0.9 }), glass = ctx.mat('#bfe9f5', { metalness: 0.35, roughness: 0.15 }), knobM = ctx.lit('#7048e8', 0.5);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 2.2), stone); floor.position.set(0, 0.05, -0.4); floor.receiveShadow = true; group.add(floor);
    const backG = new THREE.BoxGeometry(1.2, 2.3, 0.08), lintelG = new THREE.BoxGeometry(1.4, 0.16, 0.7), slabG = new THREE.BoxGeometry(1.2, 2.3, 0.1), knobG = new THREE.SphereGeometry(0.08, 10, 8);
    const set = [];
    for (let i = 0; i < MAXD; i++) {
      const g = new THREE.Group(); g.position.set(0, 0.1, -0.5); group.add(g);
      const back = new THREE.Mesh(backG, dark); back.position.set(0, 1.15, -0.5); g.add(back);
      const lintel = new THREE.Mesh(lintelG, stone); lintel.position.set(0, 2.38, -0.2); lintel.castShadow = true; g.add(lintel);
      const pivot = new THREE.Group(); pivot.position.set(-0.6, 0, 0.05); g.add(pivot);
      const slab = new THREE.Mesh(slabG, glass); slab.position.set(0.6, 1.15, 0); slab.castShadow = true; pivot.add(slab);
      const knob = new THREE.Mesh(knobG, knobM); knob.position.set(1.05, 1.1, 0.09); pivot.add(knob);
      const num = ctx.sprite(String(i + 1), { size: 0.5 }); num.position.set(0, 2.8, -0.2); g.add(num);
      set.push({ g, pivot, open: 0, a: 0, x: 0 });
    }
    const lantern = new THREE.Group(); group.add(lantern); lantern.visible = false;
    const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.4, 10), ctx.lit('#ffc94d', 1.8)); flame.position.y = 0.3; lantern.add(flame);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 10), ctx.mat('#39566b', { metalness: 0.4 })); cap.position.y = 0.58; lantern.add(cap);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), cap.material); foot.position.y = 0.06; lantern.add(foot);
    const shine = ctx.glow('#ffc94d', 1.5, 0.8); shine.position.y = 0.3; lantern.add(shine);
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), ctx.lit('#7048e8', 1.2)); marker.rotation.x = Math.PI; marker.visible = false; group.add(marker);
    // the tally: two columns that share a height of 4 units (found / not found), with marks for the prediction and the exact answer
    const colG = new THREE.BoxGeometry(0.55, 1, 0.55); colG.translate(0, 0.5, 0);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.9), stone); plinth.position.set(2.85, 0.08, 0.2); group.add(plinth);
    const colF = new THREE.Mesh(colG, ctx.lit('#ffc94d', 0.6)); colF.position.set(2.45, 0.16, 0.2); group.add(colF);
    const colN = new THREE.Mesh(colG, ctx.mat('#8fb3c4', { roughness: 0.5 })); colN.position.set(3.25, 0.16, 0.2); group.add(colN);
    const tagF = ctx.sprite('🏮', { size: 0.5 }), tagN = ctx.sprite('🚪', { size: 0.5 }); group.add(tagF, tagN);
    const markG = new THREE.BoxGeometry(0.8, 0.05, 0.8);
    const predM = new THREE.Mesh(markG, ctx.lit('#7048e8', 1)); group.add(predM);
    const exactM = new THREE.Mesh(markG, ctx.lit('#1098ad', 1.1)); exactM.visible = false; group.add(exactM);

    let strat = 'stick', doors = 3, rounds = 100, pred = 50, played = 0, found = 0, revealed = false, done = false, misses = 0, auto = false, batch = null, slow = null, markAt = 0;
    const pass = { a: false, b: false };
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const stratC = ui.choice([['stick', 'Always stick'], ['switch', 'Always switch']], strat, (v) => setStrat(v));
    const predS = ui.slider({ label: 'My prediction: this strategy finds the lantern', min: 0, max: 100, step: 1, value: pred, unit: '%', onInput: (v) => { pred = v; refresh(); } });
    const roundsS = ui.slider({ label: 'How many rounds', min: 10, max: 1000, step: 10, value: rounds, unit: 'rounds', onInput: (v) => { rounds = v; } });
    const doorsS = lv >= 3 ? ui.slider({ label: 'Number of doors', min: 3, max: MAXD, step: 1, value: 3, unit: 'doors', onInput: (v) => setDoors(v) }) : null;
    const rPlayed = ui.readout('Rounds played'), rFound = ui.readout('Lantern found, %'), rPred = ui.readout('Your prediction, %'), rExact = ui.readout('Exact answer'), rNeed = ui.readout('Switch rounds needed');
    const closeAll = () => { for (const d of set) d.open = 0; lantern.visible = false; marker.visible = false; };
    const layout = () => {
      const sp = Math.min(1.55, 4.5 / doors);
      set.forEach((d, i) => { d.g.visible = i < doors; d.x = X0 + (i - (doors - 1) / 2) * sp; d.g.position.x = d.x; d.g.scale.x = sp / 1.55; });
    };
    const refresh = () => {
      const f = played ? found / played : 0, hF = played ? Math.max(0.02, TOP * f) : 0.02, hN = played ? Math.max(0.02, TOP * (1 - f)) : 0.02;
      colF.scale.y = hF; colN.scale.y = hN; tagF.position.set(2.45, 0.16 + hF + 0.35, 0.2); tagN.position.set(3.25, 0.16 + hN + 0.35, 0.2);
      predM.position.set(2.45, 0.16 + TOP * pred / 100, 0.2);
      const [w, c] = model.exact(doors, strat === 'switch'), q = gcd(w, c);
      exactM.visible = revealed; exactM.position.set(2.45, 0.16 + TOP * w / c, 0.2);
      rPlayed.set(String(played)); rFound.set(played ? (f * 100).toFixed(1) : '–'); rPred.set(String(pred));
      rExact.set(revealed ? `${w / q} in ${c / q} = ${(100 * w / c).toFixed(1)} %` : '? (run all rounds first)');
      rNeed.set(`${NEED}${HARD ? ' with 3 doors, then with 5 or more' : ''}`);
    };
    const reset = () => { played = found = 0; revealed = false; batch = null; slow = null; closeAll(); layout(); refresh(); };
    function setStrat(v) { if (v === strat) return; strat = v; reset(); ctx.say(v === 'switch' ? 'Always switch: after I open an empty door, you move to the other closed door. Predict first, then test it.' : 'Always stick: you keep your first door, whatever I open. Predict first, then test it.'); }
    function setDoors(v) { v = Math.round(v); if (v === doors) return; doors = v; reset(); ctx.say(`Now there are ${doors} doors and still one lantern. After your pick I open every other door but one, all empty. Predict before you test.`); }
    const tally = (r) => { played++; if (r.found) found++; };
    // Has the player shown the result with enough rounds, and does the prediction agree with the truth?
    const check = (quiet) => {
      if (done || strat !== 'switch') return;
      const truth = 100 * model.truth(doors, true), good = Math.abs(pred - truth) <= TOL, pct = (100 * found / Math.max(1, played)).toFixed(0);
      if (!good) { if (!quiet) { misses++; ctx.say(`Switching found the lantern ${pct} % of the time, but your prediction says ${pred} %. The evidence and the guess disagree, so change the guess: good thinkers change their minds when the evidence says so. Move the prediction and run again.`); } return; }
      if (played < NEED) { if (!quiet) ctx.say(`A good prediction, but ${played} rounds are too few to be sure: luck can fool a small test. Run at least ${NEED} rounds with switching.`); return; }
      if (doors === 3) pass.a = true; else pass.b = true;
      const why = doors === 3 ? 'Your first pick is wrong 2 times in 3. Each of those times I must open the other empty door, so the lantern has to be behind the door that is left, and switching finds it.' : `Your first pick is wrong ${doors - 1} times in ${doors}. Each of those times I open all the other empty doors, so the lantern has to be behind the one door that is left.`;
      if (pass.a && (!HARD || pass.b)) {
        done = true;
        ctx.say(`Switching found the lantern ${pct} % of the time: about ${doors - 1} times in ${doors}. ${why} You changed your mind when the evidence said so, and that is what good thinking looks like.`);
        ctx.complete(misses ? 0.8 : 1, `doors=${doors}, switch rounds=${played}, found=${pct}%, prediction=${pred}%, missed predictions=${misses}`);
      } else if (pass.a) ctx.say(`Yes: about 2 times in 3. ${why} Now set 5 or more doors, predict again and run ${NEED} rounds with switching.`);
      else ctx.say(`Yes: about ${doors - 1} times in ${doors}. ${why} Now show it with 3 doors as well.`);
    };
    const endBatch = () => {
      batch = null; revealed = true; refresh();
      const pct = (100 * found / Math.max(1, played)).toFixed(0);
      if (strat === 'stick') ctx.say(`Sticking found the lantern ${found} times in ${played}: about ${pct} %. Your first pick is right only 1 time in ${doors}, and opening an empty door does not move the lantern. Now predict and test switching.`);
      else check(false);
      if (auto && !done && strat === 'switch') { doorsS?.set(doors === 3 ? 5 : 3); predS.set(Math.round(100 * model.truth(doors, true))); runAll(); }
    };
    function runAll() { if (batch) return; slow = null; closeAll(); batch = { left: rounds, per: Math.max(1, Math.ceil(rounds / 80)) }; }
    const playSlow = () => { if (batch) return; closeAll(); slow = { r: model.round(rnd, doors, strat === 'switch'), t: 0, ph: 0 }; ctx.say('The lantern is hidden behind one door. All the doors look the same.'); };
    ui.button('🚪 Play one round slowly', playSlow, 'btn');
    ui.button('▶ Run all rounds', runAll, 'btn');
    ui.note('You pick a door. The guide knows where the lantern is and opens another door that is empty. Then you may stick with your door or switch. Does it matter? Guess first, then let many rounds decide.');
    layout(); refresh();
    ctx.say('First make a prediction: how often will your strategy find the lantern? Then play a round slowly, or run them all.');
    return {
      step(dt) {
        if (batch) {
          const sw = strat === 'switch';
          for (let i = Math.min(batch.per, batch.left); i > 0; i--) { tally(model.round(rnd, doors, sw)); batch.left--; }
          if (batch.left <= 0) endBatch(); else refresh();
          return;
        }
        if (!slow) return;
        slow.t += dt; const r = slow.r, others = doors - 2;
        if (slow.ph === 0 && slow.t > 0.8) { slow.ph = 1; markAt = r.pick; marker.visible = true; ctx.say(`You pick door ${r.pick + 1}. It is right 1 time in ${doors}.`); }
        else if (slow.ph === 1 && slow.t > 2) { slow.ph = 2; set.forEach((d, i) => { if (i < doors && i !== r.pick && i !== r.other) d.open = 1; }); ctx.say(others === 1 ? 'I know where the lantern is. I open another door that is empty.' : `I know where the lantern is. I open ${others} other doors, all empty, and leave one shut.`); }
        else if (slow.ph === 2 && slow.t > 3.4) { slow.ph = 3; markAt = r.final; ctx.say(strat === 'switch' ? `You switch to door ${r.final + 1}.` : `You stick with door ${r.final + 1}.`); }
        else if (slow.ph === 3 && slow.t > 4.4) {
          slow.ph = 4; set[r.final].open = 1; set[r.lantern].open = 1; lantern.position.set(set[r.lantern].x, 0.1, -0.75); lantern.visible = true; tally(r); refresh();
          if (strat === 'switch') ctx.say(r.found ? 'Found it! Your first pick was empty, so the lantern had to be behind the other closed door.' : `Not this time. Your first pick was right all along, and that happens only 1 time in ${doors}.`);
          else ctx.say(r.found ? `Found it. Your first pick was right, and that happens 1 time in ${doors}.` : `Empty. Your first pick was wrong, as it is ${doors - 1} times in ${doors}. Switching would have found the lantern.`);
        } else if (slow.ph === 4 && slow.t > 6) { slow = null; check(true); }
      },
      frame(dt, time) {
        const e = ctx.calm ? 1 : Math.min(1, dt * 6);
        for (const d of set) { d.a += (d.open - d.a) * e; d.pivot.rotation.y = -d.a * 1.85; }
        if (marker.visible) { marker.position.set(marker.position.x + (set[markAt].x - marker.position.x) * e, 3.5 + (ctx.calm ? 0 : Math.sin(time * 4) * 0.06), -0.7); }
        if (lantern.visible && !ctx.calm) shine.material.opacity = 0.7 + Math.sin(time * 5) * 0.1;
      },
      // Shows a successful run without the player (used by tests).
      autoplay() {
        auto = true; strat = 'stick'; setStrat('switch'); stratC.set?.('switch'); if (doors !== 3) { doorsS?.set(3); setDoors(3); }
        predS.set(Math.round(100 * model.truth(3, true))); roundsS.set(Math.ceil(NEED / 10) * 10); runAll();
      },
      get state() { return { strat, doors, played, found, pred, done }; },
    };
  },
};

export default {
  id: 17,
  theme: {
    sky: ['#2f96e0', '#a6e2f4', '#f3fdff'], fog: '#d6f2f9', fogNear: 55, fogFar: 180,
    ground: '#d5e9f0', ground2: '#eaf6fa', side: '#7fb6c9', stone: '#f4f8fb', accent: '#7048e8', glow: '#22c3dd', metal: '#7f9aab', wood: '#6f8aa0', leaf: '#7fe0d0', water: '#4cc9e8', crate: '#b9a7f5',
    sun: '#f4fdff', sunPower: 2.5, ambient: 1.3, skyLight: '#dff8ff', groundLight: '#9fd0e0', sunDir: [-0.55, 0.85, 0.3], particles: 'snow',
  },
  layout: { mirror: -1, stones: 5, rise: 0.4, towerH: 6.5 },
  story: {
    title: 'The Labyrinth of Reason',
    crystal: 'thinking prisms', crystalEm: '🔷',
    intro: ['Good morning, and welcome to the Labyrinth of Reason! In this garden of glass and ice, every path is a question.', 'Last night a cold wind blew our five thinking prisms out over the islands. Without them the lighthouse of ideas shines no light, and my three doors keep their secret.'],
    remind: 'The thinking prisms glow bright blue. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five prisms! Now ride the lift from the tower to the console. Three doors and one lantern are waiting to test a guess of yours.',
    afterSim: 'You let the evidence change your mind. That is rare and wonderful. Only the Keeper of the Maze is left: the arena is up the steps.',
    notReady: 'The arena is for thinkers who have done the work. Bring all five thinking prisms and solve the three doors first.',
    rival: ['So the doors surprised you. A surprise is easy. Knowing why is hard.', 'We each build a bridge of light, one piece for every right answer. Let us see whose thinking reaches the far side first.'],
    win: ['Your bridge is whole and mine is not. You asked, you tested, you changed your mind. The portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, think it through, then come back and try me.'],
    outro: 'The lighthouse of ideas shines again, the lantern is found, and the Keeper of the Maze has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, white = '#f4f8fb', mirror = k.mat('#cfeaf3', { metalness: 0.4, roughness: 0.12 }), violet = k.mat('#7048e8', { roughness: 0.4 }), teal = k.mat('#1098ad', { roughness: 0.4 });
    // a small labyrinth island joined to the west side of the home island: low walls to wander between, an idea at its heart
    const lx = -13.8, lz = 2;
    k.island(lx, 0, lz, 4.6);
    for (const [x, z, w, d, c] of [[-2.2, 0, 0.35, 4.2, white], [0, 2.6, 3.2, 0.35, '#bfe6f1'], [0.6, -2.4, 3.6, 0.35, white], [1.6, 0.6, 0.35, 2.4, '#bfe6f1'], [-0.6, -0.6, 2, 0.35, white], [-0.6, 1.2, 0.35, 1.6, '#bfe6f1']]) k.block(lx + x, 0.7, lz + z, w, 0.7, d, { color: c });
    const heart = k.mesh(new THREE.OctahedronGeometry(0.4), k.lit('#22c3dd', 1.4), lx + 0.5, 1.2, lz + 0.3); heart.castShadow = false; heart.add(k.glow('#22c3dd', 2.2, 0.6));
    // glowing "if → then" stepping tiles lead from the home island to the labyrinth
    const ifM = k.lit('#1fc4dc', 0.9), thenM = k.lit('#8a66f0', 0.9), tileG = new THREE.BoxGeometry(0.95, 0.06, 0.95);
    [[-6.8, 2.9], [-8, 2.6], [-9.2, 2.3], [-10.4, 2.1]].forEach(([x, z], i) => { const t = k.mesh(tileG, i % 2 ? thenM : ifM, x, 0.045, z); t.castShadow = false; t.rotation.y = 0.2 - i * 0.12; });
    k.sign('if', -6.8, 1.3, 2.9, { size: 0.7 }); k.sign('then', -10.4, 1.3, 2.1, { size: 0.7 });
    k.animate((dt, t) => { ifM.emissiveIntensity = 0.9 + Math.sin(t * 2.4) * 0.5; thenM.emissiveIntensity = 0.9 + Math.sin(t * 2.4 - 1.6) * 0.5; });
    // the big light bulb: an idea that pulses
    k.block(-6, 0.6, -5.5, 1.1, 0.6, 1.1);
    k.mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.5, 14), k.mat('#7f9aab', { metalness: 0.5, roughness: 0.35 }), -6, 0.85, -5.5);
    const bulbM = k.lit('#fff2a6', 1.31), bulb = k.mesh(new THREE.SphereGeometry(0.85, 22, 16), bulbM, -6, 1.85, -5.5), bulbGlow = k.glow('#fff2a6', 4.2, 0.6); bulb.castShadow = false; bulb.scale.y = 1.12; bulb.add(bulbGlow);
    k.animate((dt, t) => { const p = 0.5 + 0.5 * Math.sin(t * 2.2); bulbM.emissiveIntensity = 0.7 + p * 1.2; bulbGlow.material.opacity = 0.3 + p * 0.45; });
    // a magnifying glass leaning on its stand: look closely
    k.block(6.6, 0.5, 0.6, 0.9, 0.5, 0.9);
    const lens = k.add(new THREE.Group()); lens.position.set(7.2, 2.4, 0.6); lens.rotation.z = -0.3;
    k.mesh(new THREE.TorusGeometry(0.8, 0.1, 10, 32), violet, 0, 0, 0, lens);
    k.mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.04, 28), new THREE.MeshStandardMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0, 0, lens).rotation.x = Math.PI / 2;
    k.mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 10), violet, 0, -1.4, 0, lens);
    k.animate((dt, t) => { lens.rotation.y = Math.sin(t * 0.5) * 0.22; });
    // a question mark that turns slowly, and an exclamation mark for the moment you find out
    k.block(5.8, 0.5, -6.2, 0.9, 0.5, 0.9);
    const ask = k.add(new THREE.Group()); ask.position.set(5.8, 0.5, -6.2);
    k.mesh(new THREE.TorusGeometry(0.5, 0.15, 10, 24, Math.PI * 1.5), teal, 0, 2.1, 0, ask).rotation.z = -Math.PI / 2;
    k.mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.55, 10), teal, 0, 1.33, 0, ask);
    k.mesh(new THREE.SphereGeometry(0.2, 14, 10), teal, 0, 0.55, 0, ask);
    k.animate((dt) => { ask.rotation.y += dt * 0.5; });
    k.block(-1.2, 0.5, -8.2, 0.9, 0.5, 0.9);
    k.mesh(new THREE.CylinderGeometry(0.26, 0.12, 1.5, 12), violet, -1.2, 1.9, -8.2);
    k.mesh(new THREE.SphereGeometry(0.2, 14, 10), violet, -1.2, 0.8, -8.2);
    // two giant jigsaw pieces on the middle island: one waits, one hops as if it wants to fit
    const mid = S.mid, knobG = new THREE.SphereGeometry(0.36, 14, 10);
    k.block(mid[0] - 3.9, mid[1] + 1.7, mid[2] - 3.6, 1.6, 1.7, 0.45, { color: '#1098ad' });
    k.mesh(knobG, teal, mid[0] - 3.9, mid[1] + 1.95, mid[2] - 3.6).scale.z = 0.6;
    k.block(mid[0] + 5.2, mid[1] + 1.5, mid[2] + 0.6, 0.45, 1.5, 1.6, { color: '#7048e8' });
    const hop = k.mesh(knobG, violet, mid[0] + 5.2, mid[1] + 1.75, mid[2] + 0.6); hop.scale.x = 0.6;
    k.animate((dt, t) => { hop.position.y = mid[1] + 1.75 + Math.abs(Math.sin(t * 1.5)) * 0.25; });
    // the balance of evidence: its beam tips one way, then the other, as the evidence comes in
    const bx = mid[0] - 3, bz = mid[2] + 4;
    k.block(bx, mid[1] + 0.3, bz, 0.9, 0.3, 0.9);
    k.mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.2, 10), k.mat('#7f9aab', { metalness: 0.5, roughness: 0.35 }), bx, mid[1] + 1.4, bz);
    const beam = k.mesh(new THREE.BoxGeometry(2.2, 0.1, 0.14), violet, bx, mid[1] + 2.5, bz), hangG = new THREE.ConeGeometry(0.42, 0.75, 12, 1, true), panG = new THREE.CylinderGeometry(0.44, 0.36, 0.08, 16);
    const pans = [-1, 1].map((sx) => { const h = k.mesh(hangG, new THREE.MeshStandardMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.1 }), sx * 1.05, -0.42, 0, beam); k.mesh(panG, sx < 0 ? teal : mirror, 0, -0.4, 0, h); return h; });
    k.animate((dt, t) => { const a = Math.sin(t * 0.7) * 0.16; beam.rotation.z = a; for (const p of pans) p.rotation.z = -a; });
    // a signpost on the far island whose arrows point different ways; the middle one cannot make up its mind
    const far = S.far, arrow = new THREE.Shape(); arrow.moveTo(0, -0.16); arrow.lineTo(0.9, -0.16); arrow.lineTo(0.9, -0.3); arrow.lineTo(1.3, 0); arrow.lineTo(0.9, 0.3); arrow.lineTo(0.9, 0.16); arrow.lineTo(0, 0.16);
    const arrowG = new THREE.ExtrudeGeometry(arrow, { depth: 0.08, bevelEnabled: false });
    k.mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.1, 8), k.mat(white), 4.8, far[1] + 1.55, far[2] - 2.2);
    const arrows = [[2.7, 0.4, teal], [2.1, 2.5, violet], [1.5, -1.9, mirror]].map(([y, yaw, m]) => { const a = k.mesh(arrowG, m, 4.8, far[1] + y, far[2] - 2.2); a.rotation.y = yaw; return a; });
    k.animate((dt, t) => { arrows[1].rotation.y = 2.5 + Math.sin(t * 0.8) * 1.1; });
    // mirror pillars by the three doors, lamps round the arena
    k.prop('pillar', S.sim[0] + 4.9, S.sim[1], S.sim[2] + 4.9, { solid: true, color: '#cfeaf3' }); k.prop('pillar', S.sim[0] - 6.2, S.sim[1], S.sim[2] - 1.2, { solid: true, color: '#cfeaf3' });
    for (const a of [3.6, 5.8]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6, { color: '#9be9f5' });
    // the lighthouse of ideas stands on its own rock beyond the lagoon, sweeping a soft beam round the sky
    const hx = 24, hz = 47, far0 = (c, o = {}) => k.mat(c, { fog: false, ...o });
    const parts = [
      k.mesh(new THREE.DodecahedronGeometry(5, 0), far0('#9cc7d6', { flatShading: true }), hx, -4.5, hz),
      k.mesh(new THREE.CylinderGeometry(1.5, 2.3, 14, 16), far0('#ffffff'), hx, 5, hz),
      k.mesh(new THREE.CylinderGeometry(1.86, 2.02, 2.2, 16), far0('#1098ad'), hx, 5.4, hz),
      k.mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.6, 12), k.lit('#fff6c0', 2, { fog: false }), hx, 12.8, hz),
      k.mesh(new THREE.ConeGeometry(1.9, 1.8, 12), far0('#7048e8'), hx, 14.5, hz),
    ];
    const beamG = new THREE.ConeGeometry(3, 26, 16, 1, true); beamG.translate(0, -13, 0); beamG.rotateZ(Math.PI / 2);
    const sweep = k.mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }), hx, 12.8, hz); parts.push(sweep);
    for (const p of parts) p.castShadow = false;
    k.animate((dt) => { sweep.rotation.y += dt * 0.35; });
  },
  sim,
};
