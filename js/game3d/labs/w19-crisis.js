// World 19 lab — Flood Response Desk in 3D: a model town by a river, water gauges and three sandbag crews.
// No imports: everything arrives through the context, so the model can be checked without a browser.

// ----- the model: water rises by a fixed amount each turn; each crew holds back 0.15 m -----
const SITES = [
  { n: 'Clinic', ppl: 40, crit: 0.3, c: '#f8f9fa' },
  { n: 'Care flats', ppl: 60, crit: 0.4, c: '#ffc9c9' },
  { n: 'School shelter', ppl: 120, crit: 0.5, c: '#ffe066' },
  { n: 'Low street', ppl: 80, crit: 0.35, c: '#d0bfff' },
  { n: 'Market', ppl: 30, crit: 0.7, c: '#ffd8a8' },
];
const TURNS = 8, CREWS = 3, PUMP = 0.15;
const surge = (k) => (k >= 3 && k <= 4 ? 1.6 : 1);                 // the storm surge on turns 4 and 5
// One turn: changes depth[] in place and returns the sites that have water above their floor line.
export function turnStep(depth, rates, k, alloc) {
  const wet = [];
  depth.forEach((_, i) => { depth[i] = Math.max(0, depth[i] + rates[i] * surge(k) - PUMP * (alloc?.[i] || 0)); if (depth[i] > SITES[i].crit + 1e-9) wet.push(i); });
  return wet;
}
// People-turns with water indoors over the whole storm for a plan (a list of crew counts per site for each turn).
export function simulate(rates, plan) {
  const d = SITES.map(() => 0); let exp = 0;
  for (let k = 0; k < TURNS; k++) for (const i of turnStep(d, rates, k, plan[k])) exp += SITES[i].ppl;
  return exp;
}
// The turn on which a site first goes above its line with no help (0 = never).
export function firstWet(rate, crit) { let d = 0; for (let k = 0; k < TURNS; k++) { d += rate * surge(k); if (d > crit + 1e-9) return k + 1; } return 0; }
// A good plan, found by keeping the most promising part-plans turn by turn.
const OPTIONS = []; for (let a = 0; a < 5; a++) for (let b = a; b < 5; b++) for (let c = b; c < 5; c++) { const o = [0, 0, 0, 0, 0]; o[a]++; o[b]++; o[c]++; OPTIONS.push(o); }
export function plan(rates, width = 60) {
  let beam = [{ d: SITES.map(() => 0), e: 0, h: 0, plan: [] }];
  for (let k = 0; k < TURNS; k++) {
    const next = [];
    for (const s of beam) for (const o of OPTIONS) {
      const d = [...s.d]; let e = s.e, h = 0;
      for (const i of turnStep(d, rates, k, o)) e += SITES[i].ppl;
      d.forEach((v, i) => { h += SITES[i].ppl * v / SITES[i].crit; });
      next.push({ d, e, h, plan: [...s.plan, o] });
    }
    next.sort((p, q) => p.e - q.e || p.h - q.h); beam = next.slice(0, width);
  }
  return beam[0].plan;
}
export function selfTest() {
  // by hand, every rate 0.10 m: six normal turns and two surge turns give 0.10 × (6 + 3.2) = 0.92 m with no help
  const r = [0.1, 0.1, 0.1, 0.1, 0.1], d = SITES.map(() => 0); for (let k = 0; k < TURNS; k++) turnStep(d, r, k, null);
  // first wet turns by hand: clinic (0.30 m) turn 4, care flats (0.40) turn 4, school (0.50) turn 5, low street (0.35) turn 4, market (0.70) turn 6
  const first = SITES.map((s) => firstWet(0.1, s.crit)), bad = simulate(r, []), want = 40 * 5 + 60 * 5 + 120 * 4 + 80 * 5 + 30 * 3;
  const good = simulate(r, plan(r)), hard = [0.16, 0.16, 0.16, 0.16, 0.16], hardFrac = simulate(hard, plan(hard)) / simulate(hard, []);
  const one = SITES.map(() => 0); turnStep(one, r, 3, [1, 0, 0, 0, 0]);
  const ok = Math.abs(d[0] - 0.92) < 1e-9 && first.join() === '4,4,5,4,6' && bad === want && good <= bad * 0.3 && hardFrac <= 0.3 && Math.abs(one[0] - 0.01) < 1e-9 && Math.abs(one[1] - 0.16) < 1e-9;
  return { ok, detail: `rate 0.10 m: depth after 8 turns ${d[0].toFixed(2)} m (hand 0.92), first wet turns ${first.join(' ')} (hand 4 4 5 4 6), no help ${bad} people-turns (hand ${want}), planned ${good}; fastest water ${(hardFrac * 100).toFixed(0)} % of no help` };
}

export default {
  id: 'w19-crisis',
  world: 19,
  levels: [5, 6],
  title: 'Flood Response Desk',
  goal: 'Send three crews each turn to hold back rising water so as few people as possible have water indoors over eight turns.',
  kind: 'validated',
  model: 'Each turn water at a site rises by a fixed rate (m) and a crew with sandbags and a pump holds back 0.15 m; the storm surge on turns 4 and 5 speeds the rise by 60%. The score counts the people in a building for every turn its water is above the floor line. Real floods depend on terrain, drains, rainfall forecasts and many more resources. There is no single right plan, and the numbers are invented.',
  mount(ctx) {
    const { THREE, group, ui } = ctx;
    const rates = SITES.map(() => +(0.06 + ctx.rng() * 0.1).toFixed(2));
    const worst = 2, limit = ctx.level >= 6 ? 0.3 : 0.4, needGuess = ctx.level >= 6;
    const bad = simulate(rates, []);
    const depth = SITES.map(() => 0), alloc = SITES.map(() => 0);
    let turn = 0, exposure = 0, done = false, asked = false, won = false, auto = null, autoT = 0;

    // ----- the model town -----
    const SC = 2;                                                    // gauge: 1 m of water is drawn 2 m tall
    const land = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 3.3), ctx.mat('#7dd36c', { roughness: 1 })); land.position.set(0, 0.1, -0.62); group.add(land);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(7, 0.06, 1.7), ctx.mat('#a9744f', { roughness: 1 })); bed.position.set(0, 0.03, 1.65); group.add(bed);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x4dabf7, transparent: true, opacity: 0.8, roughness: 0.25 });
    const river = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 1.7), waterMat); river.position.set(0, 0.1, 1.65); group.add(river);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xe7f5ff, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false });
    const blue = ctx.lit('#339af0', 0.45), deep = ctx.lit('#1864ab', 0.45), lineMat = ctx.lit('#f76707', 1), bagMat = ctx.mat('#d9b382', { roughness: 1 });
    const okLamp = ctx.lit('#51cf66', 1.3), wetLamp = ctx.lit('#ffa94d', 1.3), roofMat = ctx.mat('#a0704a');
    const colGeo = new THREE.BoxGeometry(0.26, 1, 0.26), bagGeo = new THREE.BoxGeometry(0.95, 0.16, 0.32);
    const sites = SITES.map((s, i) => {
      const x = -2.7 + i * 1.35, h = 0.8 + s.ppl / 120 * 0.9;
      const house = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), ctx.mat(s.c, { roughness: 0.7 })); house.position.set(x - 0.12, 0.2 + h / 2, -1.2); group.add(house);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.position.set(x - 0.12, 0.2 + h + 0.22, -1.2); group.add(roof);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), okLamp); lamp.position.set(x - 0.12, 0.2 + h + 0.6, -1.2); group.add(lamp);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.2 * SC, 0.34), glassMat); glass.position.set(x + 0.5, 0.2 + 0.6 * SC, -0.45); glass.castShadow = false; group.add(glass);
      const col = new THREE.Mesh(colGeo, blue); col.position.set(x + 0.5, 0.2, -0.45); col.visible = false; group.add(col);
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), lineMat); line.position.set(x + 0.5, 0.2 + s.crit * SC, -0.45); group.add(line);
      const bags = [0, 1, 2].map((j) => { const b = new THREE.Mesh(bagGeo, bagMat); b.position.set(x + (j % 2 ? 0.06 : 0), 0.28 + j * 0.16, 0.2); b.visible = false; group.add(b); return b; });
      const label = ctx.sprite(`${s.n} · ${s.ppl}`, { size: 0.23, bg: 'rgba(14,18,48,.78)' }); label.position.set(x, 3.05 + (i % 2) * 0.3, -1.2); group.add(label);
      ctx.onTap(house, () => add(i, 1)); for (const b of bags) ctx.onTap(b, () => add(i, -1));
      return { x, col, lamp, bags, shown: 0 };
    });
    // the depot and the three crews (small figures in bright vests)
    const depot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), ctx.mat('#1c7ed6')); depot.position.set(-3.1, 0.45, 0.3); group.add(depot);
    const vest = ctx.lit('#ff922b', 0.5), skin = ctx.mat('#e8b98a'), bodyGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.38, 10), headGeo = new THREE.SphereGeometry(0.1, 12, 8);
    const crews = [0, 1, 2].map((j) => {
      const g = new THREE.Group(), b = new THREE.Mesh(bodyGeo, vest), hd = new THREE.Mesh(headGeo, skin);
      b.position.y = 0.19; hd.position.y = 0.47; g.add(b, hd); g.position.set(-3.1 + j * 0.3, 0.2, 0.62); group.add(g);
      return { g, tx: g.position.x, tz: 0.62 };
    });

    // ----- controls -----
    ui.note(`Predict: with no help, on which turn does the ${SITES[worst].n} first get water above its orange line? It rises ${rates[worst].toFixed(2)} m a turn, and 60% faster on turns 4 and 5.`);
    const guessS = ui.slider({ label: 'My prediction', min: 0, max: TURNS, step: 1, value: 0, unit: 'turn (0 = never)', onInput: () => {} });
    ui.button('Check my prediction', () => checkGuess(), 'btn ghost');
    const siteC = ui.choice(SITES.map((s, i) => [i, s.n]), 0, () => {});
    ui.button('+ Send a crew there', () => add(siteC.value, 1), 'btn ghost');
    ui.button('− Call a crew back', () => add(siteC.value, -1), 'btn ghost');
    ui.button('▶ Run this turn', () => run(), 'btn');
    ui.button('Start the storm again', () => reset(), 'btn ghost');
    const turnR = ui.readout('Turn'), leftR = ui.readout('Crews left'), exR = ui.readout('People-turns with water indoors');
    const siteR = SITES.map((s) => ui.readout(`${s.n} (${s.ppl} people)`));
    ui.note('Tap a building to send it a crew, or its sandbags to call one back. Each crew holds back 0.15 m of water this turn. The blue column is the water at that building and the orange line is its floor.');

    function draw() {
      const used = alloc.reduce((a, b) => a + b, 0);
      turnR.set(`${Math.min(turn + 1, TURNS)} of ${TURNS}`); leftR.set(`${CREWS - used} of ${CREWS}`);
      exR.set(`${exposure} (no help: ${bad})`);
      SITES.forEach((s, i) => siteR[i].set(`${depth[i].toFixed(2)} m of ${s.crit.toFixed(2)} m, next rise +${(rates[i] * surge(Math.min(turn, TURNS - 1))).toFixed(2)} m, crews ${alloc[i]}`));
      // crews walk to the sites they were given; the rest wait at the depot
      let j = 0;
      alloc.forEach((n, i) => { for (let q = 0; q < n; q++, j++) { crews[j].tx = sites[i].x - 0.3 + q * 0.3; crews[j].tz = 0.62; } });
      for (let q = 0; j < CREWS; j++, q++) { crews[j].tx = -3.1 + q * 0.3; crews[j].tz = 0.62; }
      sites.forEach((st, i) => st.bags.forEach((b, q) => { b.visible = q < alloc[i]; }));
    }
    function add(i, d) {
      if (done) return;
      const used = alloc.reduce((a, b) => a + b, 0);
      if (d > 0 && used >= CREWS) { ctx.say('All three crews are already out. Call one back before sending it somewhere else.'); return; }
      alloc[i] = Math.max(0, alloc[i] + d); draw();
    }
    function checkGuess() {
      const truth = firstWet(rates[worst], SITES[worst].crit), g = Math.round(guessS.value);
      asked = true;
      ctx.say((g === truth ? 'Right. ' : `It is turn ${truth}. `) + 'Add the rise each turn (rate in m, 60% more during the surge on turns 4 and 5) until the total passes the orange line.');
    }
    function run() {
      if (done) return;
      if (needGuess && !asked) { ctx.say('Make your prediction first, then check it.'); return; }
      const wet = turnStep(depth, rates, turn, alloc);
      for (const i of wet) exposure += SITES[i].ppl;
      turn++; alloc.fill(0);
      ctx.say(turn === 3 ? 'A storm surge is coming: the water will rise 60% faster for the next two turns. Get ahead of it now.'
        : wet.length ? `Water indoors this turn: ${wet.map((i) => SITES[i].n).join(', ')}. Everyone there has moved upstairs and is safe, but it counts ${wet.reduce((a, i) => a + SITES[i].ppl, 0)} people-turns.`
          : 'Every floor stayed dry this turn. Look at which blue column is closest to its orange line.');
      draw();
      if (turn >= TURNS) finish();
    }
    function finish() {
      done = true;
      const frac = exposure / bad, score = Math.max(0, 1 - exposure / (bad * 0.5));
      const why = 'Crews matter most where the most people are at risk and where the water is about to cross the line. Waiting until after the line is crossed is too late, because the water must then be brought back down as well.';
      if (frac <= limit) {
        won = true;
        ctx.say(`${exposure} people-turns with water indoors, compared with ${bad} if nobody had helped (${Math.round(frac * 100)}%). ${why}`);
        ctx.complete(Math.min(1, 0.7 + score * 0.3), 'Prioritised crews to protect the most people.');
      } else ctx.say(`${exposure} people-turns with water indoors, compared with ${bad} with no help (${Math.round(frac * 100)}%). The goal is ${Math.round(limit * 100)}% or less. ${why} Start the storm again and try a new plan.`);
    }
    function reset() {
      if (won) return;
      turn = 0; exposure = 0; done = false; depth.fill(0); alloc.fill(0); auto = null; draw();
      ctx.say('The same storm starts again, with the same rise at each building. Send your crews, then run the turn.');
    }
    draw();
    ctx.say(`The river will rise for eight turns. You have three crews. Keep the people-turns with water indoors to ${Math.round(limit * 100)}% or less of what would happen with no help.`);

    return {
      step(dt) {
        if (!auto || done) return;
        autoT -= dt; if (autoT > 0) return;
        autoT = 0.7;
        auto[turn].forEach((n, i) => { for (let q = 0; q < n; q++) add(i, 1); });
        run();
      },
      frame(dt, time) {
        const k = Math.min(1, dt * (ctx.calm ? 30 : 4));
        sites.forEach((st, i) => {
          st.shown += (Math.min(1.2, depth[i]) - st.shown) * k;
          st.col.visible = st.shown > 0.004; st.col.scale.y = Math.max(0.01, st.shown * SC); st.col.position.y = 0.2 + st.shown * SC / 2;
          const wet = depth[i] > SITES[i].crit + 1e-9; st.col.material = wet ? deep : blue; st.lamp.material = wet ? wetLamp : okLamp;
        });
        // the river climbs its bank a little each turn (and faster in the surge), but never over the town in this model
        let rise = 0; for (let q = 0; q < turn; q++) rise += surge(q); const lvl = 0.08 + rise / 9.2 * 0.5 + (ctx.calm ? 0 : Math.sin(time * 1.3) * 0.012);
        const cur = river.scale.y + (lvl - river.scale.y) * k; river.scale.y = cur; river.position.y = 0.04 + cur / 2;
        for (const c of crews) {
          const dx = c.tx - c.g.position.x, dz = c.tz - c.g.position.z, far = Math.hypot(dx, dz);
          c.g.position.x += dx * k; c.g.position.z += dz * k;
          c.g.position.y = 0.2 + (far > 0.05 && !ctx.calm ? Math.abs(Math.sin(time * 10)) * 0.06 : 0);
        }
      },
      // Works out a plan, checks the prediction, then sends crews and runs each turn like the player would.
      autoplay() {
        guessS.set(firstWet(rates[worst], SITES[worst].crit)); checkGuess();
        if (won) return;
        if (turn > 0) reset();
        auto = plan(rates); autoT = 0.3;
      },
      dispose() { waterMat.dispose(); glassMat.dispose(); colGeo.dispose(); bagGeo.dispose(); bodyGeo.dispose(); headGeo.dispose(); },
    };
  },
};
