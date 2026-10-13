// World 9 — Mathematics and Statistics: the Number Labyrinth.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: a ball meets n pegs and goes right at each with probability p (n independent Bernoulli trials) -----
export const model = {
  // Number of different paths with k rights among n pegs (the binomial coefficient, built up without factorials).
  choose(n, k) { if (k < 0 || k > n) return 0; let c = 1; for (let i = 1; i <= Math.min(k, n - k); i++) c = c * (n - i + 1) / i; return Math.round(c); },
  pmf(n, p, k) { return model.choose(n, k) * p ** k * (1 - p) ** (n - k); },
  dist(n, p) { return Array.from({ length: n + 1 }, (_, k) => model.pmf(n, p, k)); },
  // Every bin that shares the largest probability (two bins tie when (n + 1)·p is a whole number).
  modes(n, p) { const d = model.dist(n, p), top = Math.max(...d); return d.map((v, k) => (v >= top * (1 - 1e-9) ? k : -1)).filter((k) => k >= 0); },
  mean: (n, p) => n * p,
  spread: (n, p) => Math.sqrt(n * p * (1 - p)),
  // One ball: returns its path as bits (bit i = 1 when it went right at row i) and the bin it ends in.
  drop(n, p, rng) { let bits = 0, k = 0; for (let i = 0; i < n; i++) if (rng() < p) { bits |= 1 << i; k++; } return { bits, k }; },
};
// A small seeded generator (mulberry32) so the check below gives the same numbers on every run.
const seeded = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Used by the automated tests: the probabilities add up to 1, B(10, 0.5) peaks at 5 with 252/1024,
// the mean is n·p, and 20,000 seeded drops agree with the formula within 3 standard errors in every bin.
export function selfTest() {
  let sumErr = 0, meanErr = 0;
  for (const [n, p] of [[1, 0.5], [6, 0.5], [10, 0.5], [12, 0.3], [12, 0.9], [8, 0.15]]) {
    const d = model.dist(n, p);
    sumErr = Math.max(sumErr, Math.abs(d.reduce((a, b) => a + b, 0) - 1));
    meanErr = Math.max(meanErr, Math.abs(d.reduce((a, v, k) => a + v * k, 0) - model.mean(n, p)));
  }
  const m = model.modes(10, 0.5), pTop = model.pmf(10, 0.5, 5), N = 20000, n = 10, p = 0.5, rng = seeded(9), got = new Array(n + 1).fill(0);
  for (let i = 0; i < N; i++) got[model.drop(n, p, rng).k]++;
  let z = 0, sum = 0; model.dist(n, p).forEach((q, k) => { z = Math.max(z, Math.abs(got[k] - N * q) / Math.sqrt(N * q * (1 - q))); sum += got[k] * k; });
  const ok = sumErr < 1e-12 && meanErr < 1e-12 && m.length === 1 && m[0] === 5 && Math.abs(pTop - 252 / 1024) < 1e-15 && z < 3 && Math.abs(sum / N - 5) < 3 * model.spread(n, p) / Math.sqrt(N);
  return { ok, detail: `pmf sum error ${sumErr.toExponential(1)}, mode of B(10, 0.5) = ${m.join('/')} with P = ${pTop.toFixed(6)} (252/1024 = ${(252 / 1024).toFixed(6)}), mean error ${meanErr.toExponential(1)}, 20,000 drops: fullest bin ${got.indexOf(Math.max(...got))} with ${got[5]} balls (expected ${(N * pTop).toFixed(0)}), mean ${(sum / N).toFixed(3)}, worst bin ${z.toFixed(2)} standard errors` };
}

const CANDY = ['#ff6b9d', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];

const sim = {
  title: 'The bean machine',
  goal: 'First predict which bin will collect the most balls. Then drop a big run of balls through the pegs and see whether the pile agrees with you.',
  kind: 'validated',
  model: 'Every ball meets one peg in each row and goes right with the chance you choose, otherwise left; every choice is independent of the ones before it. The number of rights decides the bin, so the piles follow the binomial distribution: the chance of bin k is (number of paths to k) × p^k × (1 − p)^(rows − k). The model is checked against that formula: the chances add up to 1, 10 rows at 50% peak in bin 5 with 252/1024, and 20,000 drops match every bin within 3 standard errors. It leaves out everything a real board adds: balls bumping into each other and the walls, spin, friction and pegs that are not perfectly even. The hops you see are a drawing of each ball\'s path, not a physics calculation.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level, rnd = ctx.rng || Math.random;
    const NMIN = L >= 5 ? 6 : L >= 3 ? 4 : 3, NMAX = L >= 5 ? 12 : L >= 3 ? 10 : 8, NEED = [60, 60, 100, 150, 200, 300, 400][L] || 60;
    const stage = L >= 5 ? 3 : L >= 3 ? 2 : 1, shareTol = L >= 4 ? 3 : 5, meanTol = L >= 6 ? 0.15 : 0.25, sdTol = L >= 6 ? 0.1 : 0.2;
    const TOP = 4.5, BASE = 0.5, HMAX = 1.45, POOL = 72, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // the board: a backing sheet, a hopper, pegs (one instanced mesh), one column and one label per bin
    const board = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.9, 0.08), ctx.mat('#fff4e6', { roughness: 0.9 })); board.position.set(0, 2.6, -0.3); group.add(board);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.1, 0.7), ctx.mat('#d6336c', { roughness: 0.5 })); shelf.position.set(0, BASE - 0.05, 0); group.add(shelf);
    const hopper = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 16, 1, true), ctx.mat('#f76707', { roughness: 0.4, side: THREE.DoubleSide })); hopper.rotation.x = Math.PI; hopper.position.set(0, TOP + 0.95, 0); group.add(hopper);
    const pegGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10); pegGeo.rotateX(Math.PI / 2);
    const pegs = new THREE.InstancedMesh(pegGeo, ctx.mat('#7048e8', { roughness: 0.35, metalness: 0.2 }), NMAX * (NMAX + 1) / 2); group.add(pegs);
    const colGeo = new THREE.BoxGeometry(1, 1, 0.34); colGeo.translate(0, 0.5, 0);
    const markGeo = new THREE.BoxGeometry(1, 0.035, 0.4), ballGeo = new THREE.SphereGeometry(0.075, 10, 8);
    const cols = [], labels = [], marks = [];
    for (let k = 0; k <= NMAX; k++) {
      const c = new THREE.Mesh(colGeo, ctx.mat(CANDY[k % CANDY.length], { roughness: 0.45 })); group.add(c); cols.push(c);
      const s = ctx.sprite(String(k), { size: 0.34 }); group.add(s); labels.push(s);
      const mk = new THREE.Mesh(markGeo, ctx.lit('#ffffff', 0.9)); mk.visible = false; group.add(mk); marks.push(mk);
    }
    const pickBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.8), ctx.lit('#ffe066', 1.5)); group.add(pickBar);
    const pool = []; for (let i = 0; i < POOL; i++) { const b = new THREE.Mesh(ballGeo, ctx.mat(CANDY[(i * 5) % CANDY.length], { roughness: 0.3 })); b.visible = false; group.add(b); pool.push(b); }

    let n = Math.min(6, NMAX), p = 0.5, ballsN = 60, pick = 0, sharePct = 50, meanP = 1, sdP = 0.5, dx = 0.8, dy = 0.4;
    let landed = [], sent = 0, done = 0, target = 0, running = false, rate = 20, acc = 0, dirty = true, wrong = 0, won = false, auto = false, shown = false;
    const flying = [], M4 = new THREE.Matrix4();
    const rSent = ui.readout('Balls dropped'), rTop = ui.readout('Fullest bin'), rSeen = ui.readout('Share in fullest bin, %'), rPred = ui.readout(stage === 2 ? 'Share you predicted, %' : 'Share the formula predicts, %');
    const rMean = stage === 3 ? ui.readout('Mean bin seen') : null, rSd = stage === 3 ? ui.readout('Spread seen, bins') : null;

    const scale = () => Math.max(12, ...landed), colH = (k) => landed[k] / scale() * HMAX;
    const way = (i, r) => (i < 0 ? [0, TOP + 0.7] : i < n ? [(r - i / 2) * dx, TOP - i * dy + 0.12] : [(r - n / 2) * dx, BASE + colH(r) + 0.07]);
    const stats = () => {
      let top = 0, sum = 0, sq = 0; landed.forEach((c, k) => { if (c > landed[top]) top = k; sum += c * k; sq += c * k * k; });
      const mean = done ? sum / done : 0; return { top, share: done ? landed[top] / done : 0, mean, sd: done ? Math.sqrt(Math.max(0, sq / done - mean * mean)) : 0 };
    };
    const draw = () => {
      dirty = false; const st = stats();
      for (let k = 0; k <= NMAX; k++) { const c = cols[k], on = k <= n && landed[k] > 0; c.visible = on; if (on) { c.position.set((k - n / 2) * dx, BASE, 0); c.scale.set(dx * 0.82, Math.max(0.01, colH(k)), 1); } }
      rSent.set(String(done)); rTop.set(done ? `${st.top} (${landed[st.top]} balls)` : '–'); rSeen.set(done ? (st.share * 100).toFixed(1) : '–');
      if (stage === 2) rPred.set(String(sharePct));
      rMean?.set(done ? st.mean.toFixed(2) : '–'); rSd?.set(done ? st.sd.toFixed(2) : '–');
    };
    const showPick = () => { pickBar.position.set((pick - n / 2) * dx, BASE + 0.04, 0); pickBar.scale.x = dx * 0.94; labels.forEach((s, k) => { const z = k === pick ? 1.5 : 1; s.scale.set(s.userData.w * z, s.userData.h * z, 1); }); };
    const clear = () => {
      for (const b of flying) { b.m.visible = false; pool.push(b.m); } flying.length = 0;
      landed = new Array(n + 1).fill(0); sent = done = target = 0; running = false; shown = false; for (const mk of marks) mk.visible = false;
      if (stage !== 2) rPred.set('–'); dirty = true;
    };
    const build = () => {
      dx = Math.min(0.8, 6.6 / (n + 1)); dy = Math.min(0.42, 2.3 / n);
      let c = 0; for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) pegs.setMatrixAt(c++, M4.makeTranslation((j - i / 2) * dx, TOP - i * dy, 0));
      pegs.count = c; pegs.instanceMatrix.needsUpdate = true;
      labels.forEach((s, k) => { s.visible = k <= n; s.position.set((k - n / 2) * dx, 0.2, 0.42); });
      if (pick > n) { pick = n; pickS.set(pick); }
      clear(); showPick();
    };
    // Shows where the formula says the tops of the columns should be (only once the prediction has been judged right).
    const showFormula = () => { const d = model.dist(n, p); shown = true; marks.forEach((mk, k) => { mk.visible = k <= n; if (k <= n) { mk.position.set((k - n / 2) * dx, BASE + d[k] * done / scale() * HMAX, 0.05); mk.scale.x = dx * 0.9; } }); };
    const why = () => {
      const k = model.modes(n, p)[0], paths = model.choose(n, k);
      if (p === 0.5) return `Every ball makes ${n} left-or-right choices. Only 1 path ends in bin 0 (left every time), but ${paths} different paths end in bin ${k}. More paths lead to the middle, so more balls land there.`;
      if (paths === 1) return `Each peg sends a ball right ${Math.round(p * 100)}% of the time. Only one path reaches bin ${k}, but every step of that path is so likely that it still collects the most.`;
      return `Each peg sends a ball right ${Math.round(p * 100)}% of the time, so the hill leans ${p > 0.5 ? 'right' : 'left'}: its middle is near rows × chance = ${n} × ${p} = ${(n * p).toFixed(1)}. Bin ${k} wins because ${paths} different paths lead there and each one is fairly likely.`;
    };

    const setRows = (v) => { v = clamp(Math.round(v), NMIN, NMAX); if (v === n && landed.length) return; n = v; build(); };
    const setP = (v) => { v = Math.round(v * 100) / 100; if (v === p) return; p = v; clear(); };
    const guard = () => { if (done || running) { clear(); ctx.say('The bins were emptied. A prediction only counts when it is made before the balls fall.'); } };
    const setPick = (v) => { v = clamp(Math.round(v), 0, n); if (v === pick) return; pick = v; guard(); showPick(); };
    const rowsS = ui.slider({ label: 'Rows of pegs', min: NMIN, max: NMAX, step: 1, value: n, unit: 'rows', onInput: setRows });
    const pS = ui.slider({ label: 'Chance of going right at each peg', min: 0.1, max: 0.9, step: 0.05, value: p, unit: '', onInput: setP });
    const ballsS = ui.slider({ label: 'Balls to drop', min: 20, max: 500, step: 20, value: ballsN, unit: 'balls', onInput: (v) => { ballsN = v; } });
    const pickS = ui.slider({ label: 'My prediction: the fullest bin', min: 0, max: NMAX, step: 1, value: pick, unit: '', onInput: (v) => { setPick(v); if (v > n) pickS.set(pick); } });
    const shareS = stage === 2 ? ui.slider({ label: 'My prediction: share of the balls in that bin', min: 5, max: 100, step: 1, value: sharePct, unit: '%', onInput: (v) => { if (v !== sharePct) { sharePct = v; guard(); dirty = true; } } }) : null;
    const meanS = stage === 3 ? ui.slider({ label: 'My prediction: the mean bin', min: 0, max: NMAX, step: 0.1, value: meanP, unit: '', onInput: (v) => { if (v !== meanP) { meanP = v; guard(); } } }) : null;
    const sdS = stage === 3 ? ui.slider({ label: 'My prediction: the spread', min: 0.3, max: 2, step: 0.05, value: sdP, unit: 'bins', onInput: (v) => { if (v !== sdP) { sdP = v; guard(); } } }) : null;

    const drop = () => {
      if (running) return;
      target = sent + ballsN; running = true; acc = 0; rate = ballsN / clamp(ballsN / 45, 2.5, 8); shown = false; for (const mk of marks) mk.visible = false;
      ctx.say(`Dropping ${ballsN} balls. Each one makes ${n} left-or-right choices on its way down.`);
    };
    ui.button('🎱 Drop the balls', drop, 'btn');
    ui.button('Empty the bins', () => { clear(); ctx.say('The bins are empty. Make your prediction, then drop the balls.'); });
    ui.note(`Bins are numbered by how many times a ball went right: bin 0 is far left. Your prediction is tested once at least ${NEED} balls have fallen${stage === 2 ? `, and the share must be right to within ${shareTol} percentage points` : stage === 3 ? `. The mean is rows × chance, and the spread is the square root of rows × chance × (1 − chance); be within ${meanTol} and ${sdTol} bins` : ''}.`);
    for (const s of labels) { s.userData.w = s.scale.x; s.userData.h = s.scale.y; }
    build(); draw();
    ctx.say('Before any ball falls, guess: which bin will end up fullest? Set your prediction, then drop the balls.');

    const more = (text) => { ctx.say(text); if (auto) drop(); };
    const miss = (text) => { wrong++; auto = false; ctx.say(text); };
    const judge = () => {
      const st = stats(), d = model.dist(n, p), modes = model.modes(n, p), q = d[pick];
      if (stage !== 2) rPred.set((d[modes[0]] * 100).toFixed(1));
      if (done < NEED) return more(`${done} balls so far. In a small run luck can fool you: drop at least ${NEED} in total to test your prediction fairly.`);
      const right = modes.includes(pick), seen = landed[pick] === landed[st.top] || (right && modes.includes(st.top));
      if (!right && seen) return more(`Bin ${pick} is in front for now, but it may only be luck. Drop more balls and watch whether it stays ahead.`);
      if (!right) return miss(`The fullest bin is ${st.top}, not bin ${pick}. ${why()} Empty the bins, change your prediction and try again.`);
      if (!seen) return more(`Good thinking, but luck put bin ${st.top} a few balls ahead. Drop more balls: the bigger the run, the less luck matters.`);
      if (stage === 2) {
        const seenPct = landed[pick] / done * 100, se = 100 * Math.sqrt(q * (1 - q) / done);
        if (Math.abs(sharePct - q * 100) > shareTol) return miss(`Right bin! But it holds ${seenPct.toFixed(1)}% of the balls and you predicted ${sharePct}%. Count the paths: ${model.choose(n, pick)} paths lead to bin ${pick}, and each has the chance ${p}^${pick} × ${(1 - p).toFixed(2)}^${n - pick}. Multiply them for the share.`);
        if (Math.abs(seenPct - sharePct) > shareTol + 3 * se) return more(`Your share looks sensible, but this run gave ${seenPct.toFixed(1)}%. Drop more balls to let the luck even out.`);
      }
      if (stage === 3) {
        const mu = model.mean(n, p), sg = model.spread(n, p);
        if (Math.abs(meanP - mu) > meanTol) return miss(`Right bin! But the mean bin came out near ${st.mean.toFixed(2)} and you predicted ${meanP}. The mean is rows × chance = ${n} × ${p}.`);
        if (Math.abs(sdP - sg) > sdTol) return miss(`Right bin and a good mean! But the spread came out near ${st.sd.toFixed(2)} and you predicted ${sdP}. The spread is the square root of rows × chance × (1 − chance) = √(${n} × ${p} × ${(1 - p).toFixed(2)}).`);
        if (Math.abs(st.mean - meanP) > meanTol + 3 * sg / Math.sqrt(done) || Math.abs(st.sd - sdP) > sdTol + 4 * sg / Math.sqrt(2 * done)) return more(`Your numbers look sensible, but this run gave a mean of ${st.mean.toFixed(2)} and a spread of ${st.sd.toFixed(2)}. Drop more balls to let the luck even out.`);
      }
      showFormula(); auto = false;
      const extra = stage === 2 ? ` The formula gives ${(q * 100).toFixed(1)}% and the bins show ${(landed[pick] / done * 100).toFixed(1)}%.` : stage === 3 ? ` The formula gives a mean of ${model.mean(n, p).toFixed(2)} and a spread of ${model.spread(n, p).toFixed(2)}; the bins show ${st.mean.toFixed(2)} and ${st.sd.toFixed(2)}.` : '';
      ctx.say(`Your prediction was right: bin ${pick} collected the most of ${done} balls. ${why()}${extra} The white lines show where the formula says each pile should reach.`);
      if (!won) { won = true; ctx.complete(Math.max(0.5, 1 - 0.15 * wrong), `rows=${n}, p=${p}, balls=${done}, bin=${pick}, wrong=${wrong}`); }
    };
    const land = (k) => { landed[k]++; done++; dirty = true; };
    const release = () => {
      const { bits, k } = model.drop(n, p, rnd); sent++;
      if (ctx.calm || !pool.length) return land(k);
      const m = pool.pop(); m.visible = true; m.position.set(0, TOP + 0.7, 0.02); flying.push({ m, bits, k, i: 0, r0: 0, r1: 0, t: 0 });
    };
    return {
      step(dt) {
        if (running && sent < target) { acc += rate * dt; while (acc >= 1 && sent < target) { acc -= 1; release(); } }
        for (let f = flying.length - 1; f >= 0; f--) {
          const b = flying[f]; b.t += dt;
          for (;;) {
            const dur = b.i === 0 ? 0.14 : b.i === n ? 0.17 : 0.1;
            if (b.t < dur) {
              const u = b.t / dur, [x0, y0] = way(b.i - 1, b.r0), [x1, y1] = way(b.i, b.r1), edge = b.i === 0 || b.i === n;
              b.m.position.set(x0 + (x1 - x0) * u, edge ? y0 + (y1 - y0) * u * u : y0 + (y1 - y0) * u + 0.36 * u * (1 - u), 0.02); break;
            }
            b.t -= dur;
            if (b.i === n) { b.m.visible = false; pool.push(b.m); flying.splice(f, 1); land(b.k); break; }
            b.r0 = b.r1; b.r1 += (b.bits >> b.i) & 1; b.i++;
          }
        }
        if (dirty) draw();
        if (running && sent >= target && !flying.length) { running = false; draw(); judge(); }
      },
      frame(dt, time) { pickBar.material.emissiveIntensity = 1.2 + Math.sin(time * 4) * 0.4; },
      // Shows a successful run without the player (used by tests): six rows of fair pegs, the middle bin, a big run.
      autoplay() {
        clear(); setRows(6); rowsS.set(6); setP(0.5); pS.set(0.5); ballsN = 500; ballsS.set(500);
        const k = model.modes(n, p)[0]; setPick(k); pickS.set(k);
        if (shareS) { sharePct = Math.round(model.pmf(n, p, k) * 100); shareS.set(sharePct); }
        if (meanS) { meanP = Math.round(model.mean(n, p) * 10) / 10; meanS.set(meanP); sdP = Math.round(model.spread(n, p) * 20) / 20; sdS.set(sdP); }
        clear(); draw(); auto = true; drop();
      },
      dispose() { flying.length = 0; pool.length = 0; },
      get state() { return { n, p, done, pick, running, won }; },
    };
  },
};

export default {
  id: 9,
  theme: {
    sky: ['#f0589a', '#ff8e72', '#ffd98a'], fog: '#ffb48f', fogNear: 60, fogFar: 190,
    ground: '#63d8c0', ground2: '#8eead4', side: '#b02a5b', stone: '#fff1e0', accent: '#d6336c', glow: '#ffe066', metal: '#5f3dc4', wood: '#f76707', leaf: '#51cf66', water: '#4dabf7', crate: '#ffa94d',
    sun: '#fff3d6', sunPower: 2.5, ambient: 1.5, skyLight: '#ffe3f0', groundLight: '#ff9d6c', sunDir: [-0.4, 1, 0.3], particles: 'bubbles',
  },
  layout: { shape: 'chain', mirror: -1, stones: 3, rise: 0.5, towerH: 6.5 },
  story: {
    title: 'The Number Labyrinth',
    crystal: 'number keys', crystalEm: '🗝️',
    intro: ['Welcome to the Number Labyrinth! Every path here is made of shapes, patterns and counting.', 'This morning the five number keys rolled away across the islands, and without them the old bean machine will not start. Will you help me find them?'],
    remind: 'The number keys glow yellow. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five keys! Now ride the lift from the tower to the bean machine, and see if you can guess where the balls will pile up.',
    afterSim: 'You read the pattern in the piles. Only the Master of the Maze is left — the arena is up the steps.',
    notReady: 'The arena is for those who have done the work. Bring all five number keys and run the bean machine first.',
    rival: ['So the bean machine did what you said. One good guess is luck. Many good guesses are mathematics.', 'We each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge is complete and mine is not. You counted well and you reasoned well — the portal is yours.'],
    lose: ['My bridge is finished first this time. Read the tablets again, then come back and try me.'],
    outro: 'The keys are home, the bean machine is clicking away, and the Master of the Maze has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, m = Math.sign(S.sim[0]) || 1, shiny = { roughness: 0.35, flatShading: true };
    // the five Platonic solids turn slowly on plinths around the back of the home island
    const solids = [new THREE.TetrahedronGeometry(0.62), new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.OctahedronGeometry(0.6), new THREE.DodecahedronGeometry(0.56), new THREE.IcosahedronGeometry(0.58)].map((geo, i) => {
      const a = (205 + i * 27) * Math.PI / 180, x = Math.cos(a) * 8.1, z = Math.sin(a) * 8.1;
      k.block(x, 0.9, z, 0.9, 0.9, 0.9);
      return k.mesh(geo, k.mat(CANDY[i], shiny), x, 1.75, z);
    });
    k.animate((dt, t) => { solids.forEach((s, i) => { s.rotation.y += dt * (0.35 + i * 0.05); s.rotation.x += dt * 0.2; s.position.y = 1.75 + Math.sin(t * 1.2 + i) * 0.08; }); });
    // a number line of tiles from the start to the gate: 0, 1, 2 … 10
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.05, 0.82), k.mat('#ffffff', { roughness: 0.6 }), 11), M4 = new THREE.Matrix4(), tint = new THREE.Color();
    for (let i = 0; i <= 10; i++) {
      tiles.setMatrixAt(i, M4.makeTranslation(0, 0.03, -3 + i * 0.95)); tiles.setColorAt(i, tint.set(CANDY[i % CANDY.length]));
      const d = k.sprite(String(i), { size: 0.4 }); d.position.set(0.95 * m, 0.42, -3 + i * 0.95); k.add(d);
    }
    tiles.receiveShadow = true; k.add(tiles);
    // a spiral of cubes whose sides follow the Fibonacci numbers 1, 1, 2, 3, 5, 8
    [1, 1, 2, 3, 5, 8].forEach((f, i) => { const s = f * 0.17, a = (i - 5) * 1.25, r = 0.2 + 0.26 * i; k.mesh(new THREE.BoxGeometry(s, s, s), k.mat(CANDY[(i + 2) % CANDY.length], { roughness: 0.4 }), 6.6 + Math.cos(a) * r, s / 2, Math.sin(a) * r).rotation.y = a; });
    k.sign('1 · 1 · 2 · 3 · 5 · 8', 6.8, 2.2, 0, { size: 0.45 });
    // a big abacus on the middle island; its beads slide back and forth
    const mid = S.mid, ab = k.add(new THREE.Group()); ab.position.set(-3.4, mid[1], mid[2] - 4); ab.rotation.y = 0.45;
    for (const sx of [-1.3, 1.3]) k.mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), k.mat('#f76707'), sx, 1.2, 0, ab);
    for (const y of [0.1, 2.3]) k.mesh(new THREE.BoxGeometry(2.76, 0.16, 0.24), k.mat('#f76707'), 0, y, 0, ab);
    const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6); rodGeo.rotateZ(Math.PI / 2);
    const rodY = [0.55, 0.97, 1.39, 1.81]; for (const y of rodY) k.mesh(rodGeo, k.mat('#5f3dc4', { metalness: 0.5, roughness: 0.3 }), 0, y, 0, ab);
    const beadGeo = new THREE.SphereGeometry(0.17, 12, 8); beadGeo.scale(0.75, 1, 1);
    const beads = new THREE.InstancedMesh(beadGeo, k.mat('#ffffff', { roughness: 0.3 }), 20); beads.castShadow = true; ab.add(beads);
    for (let i = 0; i < 20; i++) beads.setColorAt(i, tint.set(CANDY[(i / 5 | 0) + (i % 5 < 2 ? 0 : 2)]));
    const slide = (t) => { for (let r = 0; r < 4; r++) { const s = 2.5 + 2.5 * Math.sin(t * 0.4 + r * 1.3); for (let j = 0; j < 5; j++) { const f = Math.max(0, Math.min(1, s - j)); beads.setMatrixAt(r * 5 + j, M4.makeTranslation((-1.1 + j * 0.27) * f + (1.1 - (4 - j) * 0.27) * (1 - f), rodY[r], 0)); } } beads.instanceMatrix.needsUpdate = true; };
    slide(0); k.animate((dt, t) => slide(t));
    k.prop('banner', 4.6, mid[1], mid[2] + 3.6, { color: '#f76707' });
    // a Pythagoras model on the far island: squares of 9, 16 and 25 on the sides of a 3-4-5 triangle
    const far = S.far, u = 0.3, py = k.add(new THREE.Group()); py.position.set(4.3, far[1] + 4 * u + 0.02, far[2] - 2.6); py.rotation.y = -2.1;
    const tri = new THREE.Shape(); tri.moveTo(-2 * u, 0); tri.lineTo(2 * u, 0); tri.lineTo(-2 * u, 3 * u); tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.24, bevelEnabled: false }); triGeo.translate(0, 0, -0.12);
    k.mesh(triGeo, k.mat('#fff1e0', { roughness: 0.5 }), 0, 0, 0, py);
    k.mesh(new THREE.BoxGeometry(4 * u, 4 * u, 0.24), k.mat('#4dabf7', { roughness: 0.5 }), 0, -2 * u, 0, py);
    k.mesh(new THREE.BoxGeometry(3 * u, 3 * u, 0.24), k.mat('#69db7c', { roughness: 0.5 }), -3.5 * u, 1.5 * u, 0, py);
    k.mesh(new THREE.BoxGeometry(5 * u, 5 * u, 0.24), k.mat('#ff6b9d', { roughness: 0.5 }), 1.5 * u, 3.5 * u, 0, py).rotation.z = Math.atan2(3, -4);
    k.sign('3² + 4² = 5²', 4.3, far[1] + 4.1, far[2] - 2.6, { size: 0.5 });
    // a twisted ring with only one side floats above the tower
    const mp = [], mi = [], US = 80;
    for (let i = 0; i <= US; i++) { const a = i / US * Math.PI * 2; for (const v of [-0.48, 0.48]) mp.push((1.6 + v * Math.cos(a / 2)) * Math.cos(a), v * Math.sin(a / 2), (1.6 + v * Math.cos(a / 2)) * Math.sin(a)); }
    for (let i = 0; i < US; i++) { const a = i * 2; mi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const mobGeo = new THREE.BufferGeometry(); mobGeo.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); mobGeo.setIndex(mi); mobGeo.computeVertexNormals();
    const mob = k.mesh(mobGeo, k.mat('#ffe066', { side: THREE.DoubleSide, roughness: 0.3, metalness: 0.3, flatShading: true }), 0, S.sim[1] + 4.4, far[2] + 3.2); mob.rotation.x = 0.5;
    k.animate((dt) => { mob.rotation.y += dt * 0.35; });
    // a bar-chart sculpture beside the bean machine: the same hill shape the balls will make
    const bx = S.sim[0] + 5.9 * m, bz = S.sim[2] - 1.4, heights = [0.45, 1.15, 1.9, 1.15, 0.45];
    k.mesh(new THREE.BoxGeometry(1, 0.16, 3.7), k.mat('#fff1e0'), bx, S.sim[1] + 0.08, bz);
    const barGeo = new THREE.BoxGeometry(0.6, 1, 0.56); barGeo.translate(0, 0.5, 0);
    const bars = heights.map((hh, i) => k.mesh(barGeo, k.mat(CANDY[i], { roughness: 0.45 }), bx, S.sim[1] + 0.16, bz + (i - 2) * 0.7));
    k.animate((dt, t) => { bars.forEach((b, i) => { b.scale.y = heights[i] * (1 + 0.08 * Math.sin(t * 1.5 + i * 0.9)); }); });
    k.prop('banner', S.sim[0] - 5.4 * m, S.sim[1], S.sim[2] - 4.6);
    // candy lamps round the arena and an arch before the portal
    [0.6, 2.2, 3.9, 5.4].forEach((a, i) => k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6, { color: CANDY[i * 2 % CANDY.length] }));
    k.prop('arch', S.end[0], S.end[1], S.end[2] - 3.4, { s: 0.9, color: '#ffa94d' });
    // giant digits drift in the air, a wire shape hangs in the sky and a faint grid lies far below everything
    const digits = [['1', -12, 7, 6], ['2', 11, 9, 18], ['3', -10, 11, 34], ['5', 12, 12, 48], ['8', 9, 17, 64], ['π', 30 * m, 16, 74], ['∞', 4, 20, 92], ['13', -16, 14, 54]].map(([txt, x, y, z], i) => {
      const s = k.sprite(txt, { size: 3.2, color: i % 2 ? '#ffffff' : '#fff9db' }); s.position.set(x, y, z); s.material.fog = false; s.material.opacity = 0.9; k.add(s); return { s, y };
    });
    k.animate((dt, t) => { digits.forEach((d, i) => { d.s.position.y = d.y + Math.sin(t * 0.5 + i * 1.7) * 0.7; }); });
    const wire = k.mesh(new THREE.IcosahedronGeometry(13, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5, fog: false }), 52 * -m, 38, 88); wire.castShadow = false; wire.receiveShadow = false;
    k.animate((dt) => { wire.rotation.y += dt * 0.05; wire.rotation.x += dt * 0.03; });
    const grid = new THREE.GridHelper(220, 44, 0xffffff, 0xffffff); grid.material.transparent = true; grid.material.opacity = 0.22; grid.material.fog = false; grid.position.set(S.sim[0] / 2, -12.5, 50); k.add(grid);
    k.prop('cloud', 18 * -m, 12, 30, { s: 1.7, color: '#ffd6e8' });
  },
  sim,
};
