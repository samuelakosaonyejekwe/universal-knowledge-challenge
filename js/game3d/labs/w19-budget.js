// World 19 lab — City Budget Allocator in 3D: six service buildings that grow as coins are allotted.
// No imports: everything arrives through the context, so the model can be checked without a browser.

// ----- the model: diminishing returns for each service, and four transparent measures -----
// [name, k (coins needed for about 63% satisfaction), colour]
const AREAS = [['Health', 18, '#e8590c'], ['Schools', 18, '#1c7ed6'], ['Transport', 14, '#7048e8'], ['Parks and nature', 10, '#2f9e44'], ['Housing help', 16, '#c2255c'], ['Repairs', 12, '#868e96']];
const CRIT = ['Services', 'Fairness', 'Sustainability', 'Balance'];
const BUDGET = 60, START = [20, 14, 4, 2, 16, 4];              // last year's lopsided split
const BASE = [0.48, 0.3, 0.55, 0.5], FOCUS = [0.5, 0.42, 0.6, 0.75];
const sat = (x, k) => 1 - Math.exp(-x / k);
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
export function satisfaction(x) { return x.map((v, i) => sat(v, AREAS[i][1])); }
export function scores(x) {
  const s = satisfaction(x);
  return [mean(s), Math.min(...s), mean([s[2], s[3], s[5]]), 1 - (Math.max(...s) - Math.min(...s))];
}
export function targetsFor(level, focus) { const t = [...BASE]; if (level >= 4) t[focus] = FOCUS[focus]; return t; }
const margin = (x, targets) => { const s = scores(x), m = s.map((v, i) => v - targets[i]); return Math.min(...m) + 0.01 * mean(m); };
// A split of all 60 coins that meets the targets: start level and keep moving one coin to wherever it helps most.
export function solve(targets) {
  const x = AREAS.map(() => BUDGET / AREAS.length);
  for (let n = 0; n < 200; n++) {
    let best = margin(x, targets), move = null;
    for (let i = 0; i < x.length; i++) for (let j = 0; j < x.length; j++) {
      if (i === j || x[i] < 1 || x[j] >= 30) continue;
      x[i]--; x[j]++; const m = margin(x, targets); x[i]++; x[j]--;
      if (m > best + 1e-9) { best = m; move = [i, j]; }
    }
    if (!move) break;
    x[move[0]]--; x[move[1]]++;
  }
  return x;
}
export function selfTest() {
  const even = scores([10, 10, 10, 10, 10, 10]), want = [0.5041, 0.4262, 0.5692, 0.7941];
  const one = sat(18, 18), old = scores(START);
  let ok = even.every((v, i) => Math.abs(v - want[i]) < 0.0006) && Math.abs(one - 0.6321) < 0.0001 && Math.abs(old[1] - 0.1813) < 0.0006;
  for (let f = 0; f < 4; f++) for (const level of [3, 4]) {
    const t = targetsFor(level, f), x = solve(t), s = scores(x);
    if (x.reduce((p, q) => p + q, 0) !== BUDGET || !s.every((v, i) => v >= t[i])) ok = false;
  }
  return { ok, detail: `even split: ${even.map((v) => (v * 100).toFixed(1)).join(', ')} % (hand: 50.4, 42.6, 56.9, 79.4); 18 coins at k = 18 gives ${(one * 100).toFixed(1)} % (1 − 1/e = 63.2); every target set has a 60-coin answer` };
}

export default {
  id: 'w19-budget',
  world: 19,
  levels: [3, 4],
  title: 'City Budget Allocator',
  goal: 'Spend all 60 coins across six services so the town meets every target on four transparent measures.',
  kind: 'validated',
  model: 'Each service has smoothly diminishing returns, 1 − e^(−coins/k), with invented values of k. Each building\'s height shows how satisfied people are with that service, and the coin stack beside it shows what it costs. Real budgets involve debt, taxes, local costs and values that people disagree about; there is no single correct split here, and no party or policy is endorsed.',
  mount(ctx) {
    const { THREE, group, ui } = ctx;
    const focus = Math.min(3, Math.floor(ctx.rng() * 4)), targets = targetsFor(ctx.level, focus);
    const vals = [...START];
    let done = false, guessed = false, wave = 0;

    // ----- the town square -----
    const floor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 4.6), ctx.mat('#7dd36c', { roughness: 1 })); floor.position.y = 0.05; group.add(floor);
    const gold = ctx.lit('#ffd43b', 0.5), dark = ctx.mat('#495057'), glowWin = ctx.lit('#fff3bf', 1.4), white = ctx.mat('#f8f9fa');
    const bodyGeo = new THREE.BoxGeometry(0.82, 1, 0.82), coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 18);
    const H = (s) => 0.35 + 2.3 * s;                                     // building height in metres for a satisfaction of s
    const sites = AREAS.map(([name, , colour], i) => {
      const x = -3 + i * 1.2;
      const body = new THREE.Mesh(bodyGeo, ctx.mat(colour, { roughness: 0.6 })); body.position.set(x, 0.1, 0); group.add(body);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.86), dark); win.position.set(x, 0.3, 0); group.add(win);
      const roof = new THREE.Mesh(i % 2 ? new THREE.ConeGeometry(0.62, 0.4, 4) : new THREE.CylinderGeometry(0.3, 0.5, 0.3, 12), white); roof.rotation.y = Math.PI / 4; roof.position.set(x, 1, 0); group.add(roof);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.03), ctx.lit(colour, 0.7)); flag.position.set(x + 0.2, 1, 0); flag.visible = false; group.add(flag);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), white); pole.position.set(x, 1, 0); pole.visible = false; group.add(pole);
      const coins = new THREE.Mesh(coinGeo, gold); coins.position.set(x, 0.1, 1.35); group.add(coins);
      const label = ctx.sprite(name, { size: 0.24, bg: 'rgba(14,18,48,.78)' }); label.position.set(x, i % 2 ? 0.42 : 0.72, 2.15); group.add(label);
      ctx.onTap(body, () => nudge(i, 1)); ctx.onTap(coins, () => nudge(i, -1));
      return { x, body, win, roof, flag, pole, coins, h: H(0), c: 0 };
    });
    // the scoreboard: four tall gauges on a beam behind the buildings, each with an orange target line
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.12, 0.5), dark); beam.position.set(0, 3.0, -1.8); group.add(beam);
    for (const sx of [-3.2, 3.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3, 0.14), dark); post.position.set(sx, 1.5, -1.8); group.add(post); }
    const fillGeo = new THREE.BoxGeometry(0.5, 1, 0.3), blue = ctx.lit('#4dabf7', 0.5), green = ctx.lit('#40c057', 0.8), GH = 1.6;
    const gauges = CRIT.map((name, i) => {
      const x = -2.4 + i * 1.6;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, GH, 0.1), white); back.position.set(x, 3.06 + GH / 2, -2.02); group.add(back);
      const fill = new THREE.Mesh(fillGeo, blue); fill.position.set(x, 3.06, -1.8); group.add(fill);
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 0.4), ctx.lit('#f76707', 1)); line.position.set(x, 3.06 + targets[i] * GH, -1.8); group.add(line);
      const label = ctx.sprite(name, { size: 0.22, bg: 'rgba(14,18,48,.78)' }); label.position.set(x, 2.78, -1.5); group.add(label);
      return { fill, v: 0 };
    });

    // ----- controls -----
    ui.note('Last year\'s split is on the table. Predict first: with this split, which measure is lowest?');
    const pick = ui.choice(CRIT.map((c, i) => [i, c]), null, (v) => guess(v));
    const sl = AREAS.map(([name], i) => ui.slider({ label: name, min: 0, max: 30, step: 1, value: vals[i], unit: 'coins', onInput: (v) => { vals[i] = Math.round(v); refresh(); } }));
    const left = ui.readout('Coins left'), reads = CRIT.map((c) => ui.readout(c + ', % of target %'));
    ui.button('Present the budget', () => present(), 'btn');
    ui.note('Tap a building to give it one more coin, or its coin stack to take one back. Services = average satisfaction. Fairness = the worst-served area. Sustainability = transport, parks and repairs. Balance = 100% minus the gap between best and worst. Orange lines are the targets.');

    function nudge(i, d) {
      const total = vals.reduce((p, q) => p + q, 0);
      if (d > 0 && total >= BUDGET) { ctx.say('All 60 coins are already spent. Take a coin back from another stack first.'); return; }
      const v = Math.max(0, Math.min(30, vals[i] + d)); vals[i] = v; sl[i].set(v); refresh();
    }
    function refresh() {
      const s = scores(vals), total = vals.reduce((p, q) => p + q, 0);
      left.set(`${BUDGET - total} coins`);
      s.forEach((v, i) => reads[i].set(`${(v * 100).toFixed(1)} % of ${Math.round(targets[i] * 100)} %`));
    }
    function guess(v) {
      if (guessed) return;
      guessed = true;
      const s = scores(START), low = s.indexOf(Math.min(...s));
      ctx.say(v === low ? 'Right: Fairness is lowest. Parks got only 2 coins, and Fairness looks at the worst-served area.' : `Not quite: ${CRIT[low]} is lowest right now, because it looks only at the worst-served area and parks got just 2 coins.`);
    }
    function present() {
      if (done) return;
      const s = scores(vals), total = vals.reduce((p, q) => p + q, 0);
      if (!guessed) { ctx.say('Make your prediction first: which measure is lowest with last year\'s split?'); return; }
      if (total > BUDGET) { ctx.say(`Over budget by ${total - BUDGET} coins. Take some coins back.`); return; }
      if (total < BUDGET) { ctx.say(`${BUDGET - total} coins are still unspent. Coins left in the drawer help nobody: give them to a service.`); return; }
      const miss = s.findIndex((v, i) => v < targets[i]);
      if (miss >= 0) {
        const st = satisfaction(vals), lowest = st.indexOf(Math.min(...st)), highest = st.indexOf(Math.max(...st));
        ctx.say(`${CRIT[miss]} is at ${(s[miss] * 100).toFixed(1)} %, below its target of ${Math.round(targets[miss] * 100)} %. ${AREAS[highest][0]} is the tallest building, and its last coins added very little. Try moving a few of them to ${AREAS[lowest][0]}, where each coin does more.`);
        return;
      }
      done = true; wave = 3;
      ctx.say('Every target met. Spending more on one area has smaller and smaller benefits, so a spread usually beats putting everything in one place. Other splits could work too, and different towns might still choose differently.');
      ctx.complete(0.8 + 0.2 * Math.min(1, Math.min(...s.map((v, i) => v - targets[i])) / 0.1), 'Balanced four measures with a fixed budget.');
    }
    refresh();
    ctx.say('The tall buildings got many coins last year and the small ones very few. Move coins until every gauge on the scoreboard passes its orange line.');

    return {
      frame(dt, time) {
        const k = Math.min(1, dt * (ctx.calm ? 30 : 6)), st = satisfaction(vals), s = scores(vals);
        sites.forEach((b, i) => {
          b.h += (H(st[i]) - b.h) * k; b.c += (vals[i] * 0.045 - b.c) * k;
          b.body.scale.y = b.h; b.body.position.y = 0.1 + b.h / 2;
          b.win.scale.y = Math.max(0.2, b.h - 0.3) / 0.5; b.win.position.y = 0.1 + b.h / 2;
          const lit = st[i] >= targets[1]; b.win.material = lit ? glowWin : dark;
          const hop = wave > 0 && !ctx.calm ? Math.abs(Math.sin(time * 6 + i)) * 0.08 : 0;
          b.roof.position.y = 0.1 + b.h + (i % 2 ? 0.2 : 0.15) + hop;
          b.flag.visible = b.pole.visible = lit;
          b.pole.position.y = b.roof.position.y + 0.4; b.flag.position.y = b.pole.position.y + 0.2;
          b.flag.rotation.y = ctx.calm ? 0 : Math.sin(time * 3 + i) * 0.3;
          b.coins.visible = b.c > 0.01; b.coins.scale.y = Math.max(0.01, b.c); b.coins.position.y = 0.1 + b.c / 2;
        });
        gauges.forEach((g, i) => {
          g.v += (Math.max(0, Math.min(1, s[i])) - g.v) * k;
          g.fill.scale.y = Math.max(0.01, g.v * GH); g.fill.position.y = 3.06 + g.v * GH / 2;
          g.fill.material = s[i] >= targets[i] ? green : blue;
        });
        if (wave > 0) wave -= dt;
      },
      // Solves the split, then acts through the same handlers as the player's sliders and buttons.
      autoplay() {
        const s0 = scores(START); (pick.set ? pick.set(s0.indexOf(Math.min(...s0))) : guess(s0.indexOf(Math.min(...s0))));
        solve(targets).forEach((v, i) => sl[i].set(v));
        present();
      },
      dispose() { bodyGeo.dispose(); coinGeo.dispose(); fillGeo.dispose(); },
    };
  },
};
