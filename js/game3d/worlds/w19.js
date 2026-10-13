// World 19 — Governance: Mayor for a Day in Little Linden.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: counting ranked ballots exactly, under three different rules -----
// A ballot set ("profile") is a list of groups { order: [first choice, second, …], n: how many ballots say so }.
const best = (v, alive) => { let i = -1, tie = false; v.forEach((x, j) => { if (alive && !alive[j]) return; if (i < 0 || x > v[i]) { i = j; tie = false; } else if (x === v[i]) tie = true; }); return { i, tie }; };
const worst = (v, alive) => { let i = -1, tie = false; v.forEach((x, j) => { if (alive && !alive[j]) return; if (i < 0 || x < v[i]) { i = j; tie = false; } else if (x === v[i]) tie = true; }); return { i, tie }; };
export const model = {
  total: (p) => p.reduce((s, g) => s + g.n, 0),
  majority: (n) => Math.floor(n / 2) + 1,                      // more than half
  // How many ballots have each project as their highest choice among those still in the count.
  firsts(p, m, alive) { const c = Array(m).fill(0); for (const g of p) { const f = g.order.find((i) => !alive || alive[i]); if (f != null) c[f] += g.n; } return c; },
  // Rule 1: the project with the most first choices wins.
  plurality(p, m) { const counts = model.firsts(p, m), t = best(counts); return { counts, winner: t.i, tie: t.tie }; },
  // Rule 2: instant run-off. Until one project has more than half, drop the last and pass its ballots on.
  runoff(p, m) {
    const alive = Array(m).fill(true), rounds = [], n = model.total(p); let tie = false;
    for (;;) {
      const counts = model.firsts(p, m, alive), t = best(counts, alive), round = { counts, drop: -1 }; rounds.push(round);
      if (counts[t.i] * 2 > n) return { rounds, winner: t.i, tie };
      const w = worst(counts, alive); if (w.tie) tie = true;
      round.drop = w.i; alive[w.i] = false;
    }
  },
  // Rule 3: points. A first choice is worth 3, a second 2, a third 1 (a fourth choice earns nothing).
  points(p, m) { const sum = Array(m).fill(0), rounds = []; for (let r = 0; r < 3; r++) { for (const g of p) sum[g.order[r]] += g.n * (3 - r); rounds.push([...sum]); } const t = best(sum); return { rounds, totals: sum, winner: t.i, tie: t.tie }; },
  // pairwise[a][b] = ballots that rank a above b.
  pairwise(p, m) { const w = Array.from({ length: m }, () => Array(m).fill(0)); for (const g of p) for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) w[g.order[a]][g.order[b]] += g.n; return w; },
  // The project that beats every other one head-to-head (the Condorcet winner), or -1 when there is none.
  condorcet(p, m) { const w = model.pairwise(p, m); for (let a = 0; a < m; a++) if (w[a].every((x, b) => b === a || x > w[b][a])) return a; return -1; },
  analyse(p, m) {
    const plur = model.plurality(p, m), irv = model.runoff(p, m), pts = model.points(p, m);
    return { n: model.total(p), plur, irv, pts, cond: model.condorcet(p, m), winners: [plur.winner, irv.winner, pts.winner], clean: !plur.tie && !irv.tie && !pts.tie };
  },
};

// ----- building a ballot set for a level -----
const perms = (m) => { const out = []; const go = (rest, done) => { if (!rest.length) out.push(done); rest.forEach((x, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, x])); }; go([...Array(m).keys()], []); return out; };
const shuffle = (list, rng) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rng() * (i + 1))); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SPEC = {
  1: { m: 3, groups: 4, most: 5, lo: 11, hi: 15 }, 2: { m: 3, groups: 5, most: 6, lo: 15, hi: 21 },
  3: { m: 3, groups: 4, most: 8, lo: 15, hi: 21 }, 4: { m: 3, groups: 5, most: 8, lo: 19, hi: 25 },
  5: { m: 4, groups: 6, most: 7, lo: 19, hi: 27 }, 6: { m: 4, groups: 6, most: 7, lo: 21, hi: 29 },
};
// What each level needs from its ballots. No level allows a tie anywhere in any of the three counts.
export function wanted(level, a) {
  if (!a.clean) return false;
  const [p, r] = a.winners;
  if (level <= 2) { const s = [...a.plur.counts].sort((x, y) => y - x); return level === 1 ? s[0] - s[1] >= 3 : s[0] - s[1] <= 2; }
  if (level <= 4) return p !== r && (level === 3 || a.cond >= 0);
  return a.cond >= 0 && a.winners.filter((w) => w === a.cond).length === 1 && (level === 5 || new Set(a.winners).size === 3);
}
// Hand-made ballot sets, used when the random search finds nothing (and checked by selfTest).
const HAND = [[[0, 2, 1], 8], [[1, 2, 0], 7], [[2, 1, 0], 5], [[2, 0, 1], 1]];
const SPARE = {
  1: [[[0, 1, 2], 9], [[1, 0, 2], 4], [[2, 0, 1], 2]],
  2: [[[0, 1, 2], 7], [[1, 0, 2], 6], [[2, 0, 1], 4]],
  3: HAND, 4: HAND,
  5: [[[0, 3, 2, 1], 9], [[1, 3, 2, 0], 7], [[2, 3, 1, 0], 6], [[3, 2, 1, 0], 3]],
  6: [[[0, 3, 2, 1], 9], [[1, 3, 2, 0], 7], [[2, 3, 1, 0], 6], [[3, 2, 1, 0], 3]],
};
const groups = (rows) => rows.map(([order, n]) => ({ order: [...order], n }));
export function makeBallots(level, rng) {
  const s = SPEC[level], all = perms(s.m);
  for (let tries = 0; tries < 3000; tries++) {
    const profile = shuffle(all, rng).slice(0, s.groups).map((order) => ({ order, n: 1 + Math.min(s.most - 1, Math.floor(rng() * s.most)) }));
    const a = model.analyse(profile, s.m);
    if (a.n >= s.lo && a.n <= s.hi && a.n % 2 === 1 && wanted(level, a)) return { profile: profile.sort((x, y) => y.n - x.n), m: s.m, a };
  }
  const swap = shuffle([...Array(s.m).keys()], rng), profile = SPARE[level].map(([order, n]) => ({ order: order.map((i) => swap[i]), n }));
  return { profile, m: s.m, a: model.analyse(profile, s.m) };
}

// Used by the automated tests. The 21 ballots below were counted by hand:
//   8 × A>C>B, 7 × B>C>A, 5 × C>B>A, 1 × C>A>B
//   most first choices: A 8, B 7, C 6 → A.   run-off: nobody has 11, C drops, 5 go to B and 1 to A → B wins 12–9.
//   points: A 24+7+5+2 = 38, B 8+21+10+1 = 40, C 16+14+15+3 = 48 → C.   head-to-head: C beats A 13–8 and B 14–7.
export function selfTest() {
  const p = groups(HAND), a = model.analyse(p, 3), w = model.pairwise(p, 3), last = a.irv.rounds[a.irv.rounds.length - 1].counts;
  const hand = a.n === 21 && model.majority(21) === 11 && a.plur.counts.join() === '8,7,6' && a.plur.winner === 0
    && a.irv.rounds.length === 2 && a.irv.rounds[0].drop === 2 && last.join() === '9,12,0' && a.irv.winner === 1
    && a.pts.totals.join() === '38,40,48' && a.pts.winner === 2 && a.cond === 2 && w[2][0] === 13 && w[2][1] === 14 && w[1][0] === 12 && a.clean;
  // four projects: 9 × A>D>C>B, 7 × B>D>C>A, 6 × C>D>B>A, 3 × D>C>B>A (25 ballots)
  //   first choices A 9 → A.   run-off: D (3) drops → C 9; then B (7) drops → C 16, A 9 → C.
  //   points: A 27, B 21+6+3 = 30, C 18+6+16 = 40, D 9+44 = 53 → D, which also wins every head-to-head (16–9, 18–7, 19–6).
  const q = groups(SPARE[6]), b = model.analyse(q, 4), v = model.pairwise(q, 4);
  const four = b.n === 25 && b.winners.join() === '0,2,3' && b.pts.totals.join() === '27,30,40,53' && b.irv.rounds.length === 3 && b.cond === 3 && v[3][0] === 16 && v[3][1] === 18 && v[3][2] === 19;
  // every level's ballots, random or spare, must have the property that level teaches
  let seed = 20240519, built = true; const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let level = 1; level <= 6; level++) {
    for (let i = 0; i < 20; i++) { const g = makeBallots(level, rng); built = built && wanted(level, g.a) && g.a.n === model.total(g.profile); }
    built = built && wanted(level, makeBallots(level, () => 0).a) && wanted(level, model.analyse(groups(SPARE[level]), SPEC[level].m));
  }
  return { ok: hand && four && built, detail: `21 ballots: first choices A 8-7-6, run-off B 12-9, points C 48 (40, 38), head-to-head C 13-8 and 14-7; 25 ballots, four projects: A / C / D, points ${b.pts.totals.join('-')}; level ballot sets ${built ? 'valid' : 'INVALID'}` };
}

const PROJECTS = [['playground', '🎠', '#ff922b'], ['library corner', '📚', '#1c7ed6'], ['bus shelter', '🚏', '#ae3ec9'], ['garden', '🌻', '#2f9e44']];
const RULES = [['first', 'Most first choices'], ['runoff', 'Run-off: drop the last, pass its ballots on'], ['points', 'Points: 3, 2, 1']];
const SHORT = { first: 'Most first choices', runoff: 'Run-off', points: 'Points' };

const sim = {
  title: 'The fair count',
  goal: 'Little Linden has voted on which project to build first. Choose a counting rule, predict the winner, then count round by round. At higher levels, show that fair-looking rules can choose different winners.',
  kind: 'validated',
  model: 'An exact count of ranked ballots under three rules: most first choices; instant run-off (while no project has more than half, the one with the fewest ballots drops out and its ballots pass to their next choice); and points (3 for a first choice, 2 for a second, 1 for a third). It also works out which project would beat each other one head-to-head. The counts are checked against two ballot sets worked out by hand (21 ballots and 25 ballots) where the three rules choose three different winners. It leaves out ties (the ballot sets are chosen so that none happen), ballots that rank only some projects, people who vote cleverly instead of honestly, people who do not vote, and the many other counting rules that exist.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = Math.max(1, Math.min(6, Math.round(ctx.level) || 1)), tier = L <= 2 ? 'low' : L <= 4 ? 'mid' : 'high';
    const { profile, m, a } = makeBallots(L, ctx.rng), n = a.n, need = model.majority(n);
    const P = shuffle(PROJECTS, ctx.rng).slice(0, m).map(([name, em, color]) => ({ name, em, color }));
    const full = (i) => `${P[i].em} ${P[i].name}`, winnerOf = (r) => (r === 'first' ? a.plur.winner : r === 'runoff' ? a.irv.winner : a.pts.winner);
    const TOP = 0.5, colX = P.map((_, i) => (i - (m - 1) / 2) * (m === 4 ? 1.8 : 2.3)), pileX = (g) => (g - (profile.length - 1) / 2) * Math.min(1.05, 6.4 / profile.length);

    // the counting table, a tray for uncounted ballots, and one coloured mat, points column and sign per project
    const add = (geo, material, x, y, z) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; group.add(o); return o; };
    add(new THREE.BoxGeometry(7.6, TOP, 4.6), ctx.mat('#f1e3c8'), 0, TOP / 2, 0);
    add(new THREE.BoxGeometry(7.1, 0.04, 0.95), ctx.mat('#dee2e6'), 0, TOP + 0.02, 1.6);
    const matGeo = new THREE.BoxGeometry(1.15, 0.08, 0.9), barGeo = new THREE.BoxGeometry(0.55, 1, 0.3), cardGeo = new THREE.BoxGeometry(0.8, 0.055, 0.52);
    const signs = [], bars = [], barH = P.map(() => 0), labels = P.map(() => null);
    P.forEach((p, i) => {
      add(matGeo, ctx.mat(p.color, { roughness: 0.6 }), colX[i], TOP + 0.04, -0.4);
      const bar = add(barGeo, ctx.mat(p.color, { roughness: 0.6 }), colX[i], TOP, -1.65); bar.visible = false; bar.scale.y = 0.001; bars.push(bar);
      const s = ctx.sprite(p.em, { size: 0.62 }); s.position.set(colX[i], 4.5, -0.4); group.add(s); signs.push(s);
    });
    const halo = ctx.glow('#ffd43b', 2.4, 0.85); halo.visible = false; group.add(halo);
    const cup = ctx.sprite('🏆', { size: 0.5 }); cup.visible = false; group.add(cup);
    const cards = [], tmp = new THREE.Vector3();
    profile.forEach((g, gi) => { for (let i = 0; i < g.n; i++) { const mesh = add(cardGeo, ctx.mat(P[g.order[0]].color, { roughness: 0.6 }), pileX(gi), TOP + 0.07 + i * 0.075, 1.6); cards.push({ mesh, order: g.order, g: gi, from: mesh.position.clone(), to: mesh.position.clone(), t: 1 }); } });
    const setLabel = (i, text) => {
      const old = labels[i]; if (old) { group.remove(old); old.material.map?.dispose(); old.material.dispose(); labels[i] = null; }
      if (text === '') return;
      const s = ctx.sprite(String(text), { size: 0.46, bg: 'rgba(14,18,48,.78)' }); s.position.set(colX[i], 3.8, -0.4); group.add(s); labels[i] = s;
    };
    // Sends every ballot card to a project's stack (or back to the tray when where() gives -1).
    const send = (where) => {
      const k = P.map(() => 0), pk = profile.map(() => 0); let moved = 0;
      for (const c of cards) {
        const i = where(c);
        if (i < 0) tmp.set(pileX(c.g), TOP + 0.07 + pk[c.g]++ * 0.075, 1.6); else tmp.set(colX[i], TOP + 0.12 + k[i]++ * 0.075, -0.4);
        if (tmp.distanceToSquared(c.to) < 1e-6) continue;
        c.from.copy(c.mesh.position); c.to.copy(tmp);
        if (ctx.calm) { c.mesh.position.copy(tmp); c.t = 1; } else c.t = -(moved++) * 0.05;
      }
    };

    // ----- the count -----
    let rule = 'first', guess = null, locked = null, round = 0, done = false, finished = false, answer = null, wrong = 0, auto = false, autoT = 0;
    const seen = { first: null, runoff: null, points: null };
    ui.note(`The projects: ${P.map((_, i) => full(i)).join(' · ')}. Every one of them is a good idea, so the town must choose which to build first.`);
    ui.note(`Each of the ${n} ballots ranks the projects from first choice to last choice:`);
    for (const g of profile) ui.note(`${g.n} × ${g.order.map((i) => P[i].em).join(' › ')}`);
    const reset = () => {
      round = 0; done = false; locked = null; send(() => -1); halo.visible = cup.visible = false;
      P.forEach((_, i) => { setLabel(i, ''); barH[i] = 0; signs[i].material.opacity = 1; });
      rRound.set('0'); rVotes.set('–'); rWin.set('–');
    };
    ui.choice(RULES, rule, (v) => { rule = v; reset(); ctx.say(v === 'first' ? 'Most first choices: only the top line of each ballot counts. Predict the winner, then count.' : v === 'runoff' ? `Run-off: a project needs more than half of the ballots, so ${need} of ${n}. While nobody has that, the last project drops out and its ballots pass to their next choice. Predict the winner, then count.` : 'Points: every first choice earns 3 points, every second choice 2 and every third choice 1. Predict the winner, then count.'); });
    ui.note('Your prediction: which project will win under this rule?');
    ui.choice(P.map((_, i) => [i, full(i)]), null, (v) => { guess = v; });
    const rN = ui.readout('Ballots'), rRound = ui.readout('Round'), rVotes = ui.readout('Votes per project this round'), rMaj = ui.readout('Majority needed'), rWin = ui.readout('Winner');
    const rSeen = tier === 'low' ? null : ui.readout('Winners so far'), rHead = tier === 'high' ? ui.readout('Beats every other head-to-head') : null;
    rN.set(String(n)); rMaj.set(`${need} of ${n}`); rHead?.set(full(a.cond));
    const showSeen = () => rSeen?.set(Object.keys(seen).map((r) => `${SHORT[r]}: ${seen[r] ? P[seen[r].winner].em : '?'}`).join(' · '));
    const show = (values, alive) => { P.forEach((_, i) => setLabel(i, alive[i] ? values[i] : '–')); rVotes.set(P.map((p, i) => `${p.em} ${alive[i] ? values[i] : '–'}`).join('  ')); };
    const win = (score, note) => { finished = true; auto = false; ctx.complete(Math.max(0.4, Math.min(1, score)), note); };
    const PERFECT = 'No rule is perfect. That is why neighbours should agree on the rule fairly, before the count, and not pick the rule that helps their own favourite.';

    const finish = (w, text) => {
      done = true; rWin.set(full(w));
      halo.position.set(colX[w], 4.5, -0.45); cup.position.set(colX[w], 5.0, -0.4); halo.visible = cup.visible = true;
      const right = locked === w, s = seen[rule] || (seen[rule] = { winner: w, tries: 0, firstRight: right }); s.tries++; s.right = right; showSeen();
      let msg = `${text} ${right ? 'Your prediction was right!' : `You predicted the ${P[locked].name}.`}`;
      if (tier === 'low') {
        if (rule !== 'first') msg += ' Your task here is the first rule: switch to "Most first choices", predict and count.';
        else if (right) { msg += ` ${PERFECT}`; ctx.say(msg); win(s.tries === 1 ? 1 : 0.7, `plurality, tries=${s.tries}`); return; }
        else msg += ' Add up the first choices on the ballot list, press "Start again" and predict once more.';
      } else if (tier === 'mid') {
        if (!seen.first) msg += ' Now count the same ballots with "Most first choices" and compare the winners.';
        else if (!seen.runoff) msg += ' Now switch to the run-off, predict its winner and count the same ballots again.';
        else if (!seen.runoff.right) msg += ' Switch to the run-off again and predict its winner correctly before you count.';
        else { msg = `${text} Same ballots, different rule, different winner: most first choices picks the ${P[seen.first.winner].name}, the run-off picks the ${P[seen.runoff.winner].name}. ${PERFECT}`; ctx.say(msg); win(seen.runoff.tries === 1 ? 1 : 0.7, `plurality≠run-off, tries=${seen.runoff.tries}`); return; }
      } else {
        const left = Object.keys(seen).filter((r) => !seen[r]);
        msg += left.length ? ` Still to count: ${left.map((r) => SHORT[r]).join(', ')}.` : ` All three rules are counted. Head-to-head, the ${P[a.cond].name} beats every other project: choose the rule that elected it and press "Check my answer".`;
      }
      ctx.say(msg);
    };
    const next = () => {
      if (finished && done) { ctx.say('This count is finished. Press "Start again" or choose another rule to explore.'); return; }
      if (done) { ctx.say('This count is finished. Choose another rule, or press "Start again".'); return; }
      if (guess == null) { ctx.say('A good counter predicts first. Read the ballot list, choose the project you think will win, then count.'); return; }
      if (round === 0) locked = guess;
      round++; rRound.set(String(round));
      const all = P.map(() => true);
      if (rule === 'first') {
        const c = a.plur.counts, w = a.plur.winner; send((card) => card.order[0]); show(c, all);
        finish(w, `Most first choices: the ${P[w].name} wins with ${c[w]} of ${n} ballots. This rule listens only to each neighbour's favourite. It is quick and simple, but ${n - c[w]} neighbours put something else first.`);
      } else if (rule === 'runoff') {
        const R = a.irv.rounds[round - 1], alive = P.map(() => true); for (let r = 0; r < round - 1; r++) alive[a.irv.rounds[r].drop] = false;
        send((card) => card.order.find((i) => alive[i])); show(R.counts, alive); P.forEach((_, i) => { signs[i].material.opacity = alive[i] ? 1 : 0.3; });
        if (R.drop < 0) { const w = a.irv.winner; finish(w, `Run-off: the ${P[w].name} wins with ${R.counts[w]} of ${n}, more than half. This rule keeps passing ballots on until most neighbours stand behind one project. But a project that many people like second-best can drop out early.`); }
        else ctx.say(`Round ${round}: nobody has ${need} yet. The ${P[R.drop].name} has the fewest ballots (${R.counts[R.drop]}), so next round it drops out and each of its ballots passes to that neighbour's next choice.`);
      } else {
        const c = a.pts.rounds[round - 1]; send((card) => card.order[round - 1]); show(c, all); c.forEach((v, i) => { barH[i] = v * 2.6 / (3 * n); });
        if (round === 3) { const w = a.pts.winner; finish(w, `Points: the ${P[w].name} wins with ${c[w]} points. This rule listens to every line of every ballot, so a project that nearly everyone quite likes can beat one that a few people love.`); }
        else ctx.say(round === 1 ? 'Round 1: every first choice earned 3 points. Next, every second choice earns 2 points.' : 'Round 2: second choices added 2 points each. Last, every third choice earns 1 point.');
      }
    };
    const check = () => {
      if (Object.values(seen).some((s) => !s)) { ctx.say('Count the ballots with all three rules first, predicting each winner. Then you will know which rule chose which project.'); return; }
      if (answer == null) { ctx.say('Choose the rule you think elected the head-to-head winner, then check.'); return; }
      if (winnerOf(answer) === a.cond) {
        const firstTry = Object.values(seen).filter((s) => s.firstRight).length;
        ctx.say(`Yes! Only "${SHORT[answer]}" elected the ${P[a.cond].name}, the project that beats each other one head-to-head. The three rules picked the ${Object.keys(seen).map((r) => P[seen[r].winner].name).join(', the ')}. With other ballots a different rule would be the one that finds it. ${PERFECT}`);
        win(0.55 + 0.15 * firstTry - 0.1 * wrong, `rule=${answer}, predicted=${firstTry}/3, wrong=${wrong}`);
      } else { wrong++; ctx.say(`Not that one: "${SHORT[answer]}" elected the ${P[winnerOf(answer)].name}. Look at "Winners so far" and find the rule that chose the ${P[a.cond].name}.`); }
    };
    ui.button('🗳️ Count next round', next, 'btn');
    ui.button('↺ Start again', () => { reset(); ctx.say('The ballots are back in the tray. Predict, then count.'); });
    if (tier === 'high') {
      ui.note('Which rule elected the project that beats every other one head-to-head?');
      ui.choice(RULES.map(([r]) => [r, SHORT[r]]), null, (v) => { answer = v; });
      ui.button('✔ Check my answer', check);
    }
    ui.note('Most first choices values being the favourite. Run-off values having more than half behind you in the end. Points values being liked by nearly everyone. Each is fair in its own way, and each can miss something.');
    showSeen(); rRound.set('0'); rVotes.set('–'); rWin.set('–');
    ctx.say(tier === 'low' ? 'Read the ballots and add up the first choices for each project. Predict which has the most, then press "Count next round".'
      : tier === 'mid' ? 'Count with "Most first choices" first. Then switch to the run-off, predict its winner and count again. Does the same project win?'
        : `Head-to-head, the ${P[a.cond].name} would beat every other project. Count with all three rules, predicting each winner first, and find the one rule that elects it.`);

    // Plays a winning game without the player (used by tests).
    const drive = () => {
      if (finished) { auto = false; return; }
      const plan = tier === 'low' ? ['first'] : tier === 'mid' ? ['first', 'runoff'] : ['first', 'runoff', 'points'];
      if (done || !plan.includes(rule)) {
        const todo = plan.find((r) => !seen[r] || !seen[r].right);
        if (todo) { rule = todo; reset(); guess = winnerOf(todo); } else { answer = plan.find((r) => winnerOf(r) === a.cond); check(); }
        return;
      }
      if (round === 0) guess = winnerOf(rule);
      next();
    };
    return {
      step(dt) { if (!auto) return; autoT -= dt; if (autoT <= 0) { autoT = 0.8; drive(); } },
      frame(dt, time = 0) {
        for (const c of cards) {
          if (c.t >= 1) continue;
          c.t += dt * 1.7;
          if (c.t >= 1) { c.t = 1; c.mesh.position.copy(c.to); } else if (c.t > 0) { const u = c.t * c.t * (3 - 2 * c.t); c.mesh.position.lerpVectors(c.from, c.to, u); c.mesh.position.y += Math.sin(u * Math.PI) * 0.7; }
        }
        bars.forEach((b, i) => { const h = Math.max(0.001, b.scale.y + (barH[i] - b.scale.y) * Math.min(1, dt * 5)); b.scale.y = h; b.position.y = TOP + h / 2; b.visible = h > 0.01; });
        if (cup.visible) cup.position.y = 5.0 + (ctx.calm ? 0 : Math.sin(time * 3) * 0.06);
      },
      autoplay() { auto = true; autoT = 0; },
      dispose() { labels.forEach((_, i) => setLabel(i, '')); matGeo.dispose(); barGeo.dispose(); cardGeo.dispose(); },
      get state() { return { rule, round, done, finished }; },
    };
  },
};

export default {
  id: 19,
  theme: {
    sky: ['#1f7fe0', '#86caff', '#eaf8ff'], fog: '#cdeaff', fogNear: 60, fogFar: 190,
    ground: '#58b955', ground2: '#7dd36c', side: '#a9744f', stone: '#e9ecef', accent: '#1c7ed6', glow: '#ffd43b', metal: '#495057', wood: '#a0704a',
    leaf: '#2f9e44', water: '#4dabf7', crate: '#ffa94d',
    sun: '#fff7e0', sunPower: 2.6, ambient: 1.5, skyLight: '#e3f3ff', groundLight: '#7cc36a', sunDir: [-0.4, 1, 0.3], particles: 'leaves',
  },
  layout: { shape: 'chain', mirror: -1, spawnZ: 1.5, stones: 5, rise: 0.4, towerH: 4.5 },
  story: {
    title: 'Mayor for a Day',
    crystal: 'neighbour notes', crystalEm: '📝',
    intro: ['Welcome to Little Linden, and good morning, Mayor! For one whole day, the town is in your care.', 'Five neighbours wrote notes about what our town needs, but the breeze blew them out of the Listening Box. A good mayor listens first, so please find them all.'],
    remind: 'The neighbour notes shine yellow. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'You found every note, and you read every one. Now ride the lift from the tower to the counting table: the town has voted, and the count must be fair.',
    afterSim: 'The votes are counted and everyone can see how. Only the Mayor\'s Challenge is left. The Town Clerk is waiting in the arena, up the steps.',
    notReady: 'The Mayor\'s Challenge is for a mayor who has listened. Bring all five neighbour notes and finish the fair count first.',
    rival: ['So you are our mayor for a day. Wearing the sash is easy. Being fair to everyone is hard.', 'We each build a bridge of light, one piece for every right answer. Let us see who reaches the far side first.'],
    win: ['Your bridge is finished before mine. You listened, you counted fairly, and you knew your answers. The portal is yours, Mayor.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again and talk to the neighbours, then come back and try me.'],
    outro: 'The notes are back in the Listening Box, the town knows what to build first, and the Town Clerk tips a hat to you. Your day as mayor went well. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, box = (w, h, d) => new THREE.BoxGeometry(w, h, d), flat = (o) => { o.castShadow = false; return o; };
    // City Hall behind the starting point: steps, a blue roof and a clock whose hand goes round
    k.block(0, 2.4, -7.5, 4.4, 2.4, 1.8, { color: '#fff3d6' }); k.block(0, 0.3, -6.3, 3.6, 0.3, 0.6); k.block(0, 0.15, -5.75, 3.6, 0.15, 0.5);
    k.mesh(box(4.9, 0.28, 2.4), k.mat('#1c7ed6'), 0, 2.54, -7.4); k.mesh(box(1.2, 1.5, 1.2), k.mat('#fff3d6'), 0, 3.43, -7.5);
    k.mesh(box(0.8, 1.4, 0.06), k.mat('#a0704a'), 0, 1.0, -6.58);
    flat(k.mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 24), k.mat('#ffffff'), 0, 3.5, -6.88)).rotation.x = Math.PI / 2;
    const hand = flat(k.mesh(box(0.06, 0.36, 0.03).translate(0, 0.15, 0), k.mat('#343a40'), 0, 3.5, -6.83));
    k.animate((dt) => { hand.rotation.z -= dt * 0.5; });
    // the way to the gate: street lamps and a zebra crossing
    k.prop('lamp', 3.6, 0, 6.6); k.prop('lamp', -3.6, 0, 6.6);
    for (const z of [5.6, 6.2, 6.8, 7.4]) flat(k.mesh(box(2.1, 0.02, 0.32), k.mat('#ffffff', { roughness: 1 }), 0, 0.03, z));
    // the Listening Box (a ballot box with a card that dips into the slot) and three recycling bins
    k.mesh(box(0.85, 0.9, 0.6), k.mat('#1c7ed6'), 3.6, 0.45, -6.3);
    const card = k.mesh(box(0.42, 0.5, 0.03), k.mat('#ffffff'), 3.6, 1.3, -6.3); k.sign('🗳️', 3.6, 2.3, -6.3, { size: 0.6 });
    k.animate((dt, t) => { card.position.y = 1.22 + Math.sin(t * 1.5) * 0.2; });
    [['#2f9e44', -7.3, -3.6], ['#1c7ed6', -7.75, -2.8], ['#f08c00', -8.1, -2.0]].forEach(([c, x, z]) => k.mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.75, 12), k.mat(c), x, 0.375, z));
    k.prop('house', 7.3, 0, 0.6, { color: '#ffd8a8', yaw: -Math.PI / 2, solid: true });
    // the park on the middle island: a fountain whose jets bob, and trees
    const mid = S.mid, fx = mid[0] - 3.7, fz = mid[2] - 3.3;
    k.block(fx, mid[1] + 0.35, fz, 1.7, 0.35, 1.7);
    flat(k.mesh(box(1.4, 0.05, 1.4), k.mat('#4dabf7', { roughness: 0.15 }), fx, mid[1] + 0.36, fz));
    const jets = [-0.28, 0.28].map((dx) => flat(k.mesh(new THREE.CylinderGeometry(0.05, 0.09, 1, 6), k.lit('#a5d8ff', 0.7), fx + dx, mid[1] + 0.9, fz - dx)));
    k.animate((dt, t) => { jets.forEach((j, i) => { const h = 0.9 + Math.sin(t * 2.4 + i * 2.1) * 0.45; j.scale.y = h; j.position.y = mid[1] + 0.38 + h / 2; }); });
    k.prop('tree', mid[0] + 5.3, mid[1], mid[2] + 0.3, { solid: true }); k.prop('tree', mid[0] + 2.4, mid[1], mid[2] + 5.3, { s: 0.85, color: '#51cf66', solid: true });
    // a town square beside the home island: school, library and flats inside a ring road, and a bus that drives the loop
    const px = 15.6, py = -0.3, pz = 4.5;
    k.block(px, py, pz, 9.6, 0.9, 9.6, { color: '#dee2e6' });
    flat(k.mesh(new THREE.RingGeometry(3.3, 4.5, 48), k.mat('#6c757d', { roughness: 1 }), px, py + 0.02, pz)).rotation.x = -Math.PI / 2;
    k.block(px - 1.3, py + 1.4, pz + 1.2, 2.0, 1.4, 1.4, { color: '#ff8787' });
    const roof = k.mesh(new THREE.ConeGeometry(1.5, 0.7, 4), k.mat('#e03131'), px - 1.3, py + 1.75, pz + 1.2); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.7; k.sign('🏫', px - 1.3, py + 2.9, pz + 1.2, { size: 0.6 });
    k.block(px + 1.4, py + 1.7, pz + 1.1, 1.8, 1.7, 1.4, { color: '#74c0fc' });
    k.mesh(box(2.1, 0.18, 1.7), k.mat('#2f9e44'), px + 1.4, py + 1.79, pz + 1.1); k.sign('📚', px + 1.4, py + 2.7, pz + 1.1, { size: 0.6 });
    k.block(px - 0.9, py + 3.2, pz - 1.5, 1.4, 3.2, 1.4, { color: '#ffe066' }); k.block(px + 0.9, py + 2.3, pz - 1.6, 1.3, 2.3, 1.3, { color: '#b197fc' });
    k.prop('lamp', px + 4.3, py, pz + 4.3);
    const bus = k.mesh(box(1.5, 0.75, 0.7), k.mat('#ffd43b', { roughness: 0.5 }), px + 3.9, py + 0.6, pz);
    flat(k.mesh(box(1.3, 0.24, 0.72), k.lit('#d0ebff', 0.35), 0, 0.12, 0, bus)); flat(k.mesh(box(1.1, 0.22, 0.76), k.mat('#343a40'), 0, -0.42, 0, bus));
    k.animate((dt, t) => { const an = t * 0.42; bus.position.set(px + Math.cos(an) * 3.9, py + 0.6, pz + Math.sin(an) * 3.9); bus.rotation.y = -an - Math.PI / 2; });
    // a pink house by the tower, a lamp by the counting table, and a wind turbine that turns above the arena
    k.prop('house', S.far[0] + 4.7, S.far[1], S.far[2] - 1.6, { s: 0.85, color: '#ffc9c9', yaw: -Math.PI / 2, solid: true });
    k.prop('lamp', S.sim[0] - 3.4, S.sim[1], S.sim[2] - 6.2);
    const tx = S.arena[0] - 6.2, ty = S.arena[1], tz = S.arena[2] - 1.2;
    k.mesh(new THREE.CylinderGeometry(0.1, 0.2, 6.5, 10), k.mat('#f8f9fa'), tx, ty + 3.25, tz);
    const hub = k.mesh(new THREE.SphereGeometry(0.2, 12, 8), k.mat('#f8f9fa'), tx, ty + 6.5, tz + 0.3), bladeGeo = box(0.18, 2.3, 0.05).translate(0, 1.15, 0);
    for (let i = 0; i < 3; i++) k.mesh(bladeGeo, k.mat('#f8f9fa'), 0, 0, 0, hub).rotation.z = i * Math.PI * 2 / 3;
    k.animate((dt) => { hub.rotation.z += dt * 1.3; });
    // fair-weather clouds drifting on the breeze
    const clouds = [[-18, 12, 20], [15, 15, 42], [-32, 14, 62]].map(([x, y, z]) => { const c = flat(k.mesh(new THREE.SphereGeometry(1, 12, 8), k.lit('#ffffff', 0.25, { roughness: 1, fog: false }), x, y, z)); c.scale.set(3.4, 0.9, 1.8); return { c, x, z }; });
    k.animate((dt, t) => { for (const o of clouds) o.c.position.x = o.x + Math.sin(t * 0.07 + o.z) * 4; });
  },
  sim,
};
