// World 20 lab — Argument Builder in 3D: two premise pillars carry a conclusion beam. The arch stands when the
// argument is valid and the beam drops when a counter-example exists. No imports: everything arrives through the context.

const SC = [
  { p: ['it rains', 'it does not rain'], q: ['the match is cancelled', 'the match is not cancelled'] },
  { p: ['Ana has a ticket', 'Ana has no ticket'], q: ['Ana enters the hall', 'Ana does not enter the hall'] },
  { p: ['the cat is hungry', 'the cat is not hungry'], q: ['the cat meows', 'the cat does not meow'] },
];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const T = {
  cond: { f: (p, q) => !p || q, s: (S) => `If ${S.p[0]}, then ${S.q[0]}` },
  or: { f: (p, q) => p || q, s: (S) => `Either ${S.p[0]} or ${S.q[0]}` },
  p: { f: (p) => p, s: (S) => cap(S.p[0]) }, np: { f: (p) => !p, s: (S) => cap(S.p[1]) },
  q: { f: (p, q) => q, s: (S) => cap(S.q[0]) }, nq: { f: (p, q) => !q, s: (S) => cap(S.q[1]) },
};
const FORMS = [
  { name: 'Modus ponens', prem: ['cond', 'p'], conc: 'q' },
  { name: 'Affirming the consequent', prem: ['cond', 'q'], conc: 'p' },
  { name: 'Denying the antecedent', prem: ['cond', 'np'], conc: 'nq' },
  { name: 'Modus tollens', prem: ['cond', 'nq'], conc: 'np' },
  { name: 'Disjunctive syllogism', prem: ['or', 'np'], conc: 'q' },
];
const HIDDEN = [
  { arg: 'Mia has a ticket, so Mia can go in.', opts: ['Everyone with a ticket can go in.', 'Mia is tall.', 'Mia likes the film.'] },
  { arg: 'The road is wet, so it rained.', opts: ['The road gets wet only when it rains.', 'The road is long.', 'Rain is common in autumn.'] },
  { arg: 'Leo is a cat, so Leo likes fish.', opts: ['All cats like fish.', 'Leo is small.', 'Fish are healthy.'] },
];
const ROWS = [[true, true], [true, false], [false, true], [false, false]];      // the four possible worlds for p and q
const ARGS = 3;

// ----- the model: two-statement propositional logic, checked row by row -----
export const model = {
  premises: (f, p, q) => f.prem.every((id) => T[id].f(p, q)),
  conclusion: (f, p, q) => T[f.conc].f(p, q),
  // rows where every premise is true and the conclusion is false
  counter: (f) => ROWS.map(([p, q], i) => (model.premises(f, p, q) && !model.conclusion(f, p, q) ? i : -1)).filter((i) => i >= 0),
  valid: (f) => model.counter(f).length === 0,
  built: (f, ids) => ids[2] === f.conc && [ids[0], ids[1]].sort().join() === [...f.prem].sort().join(),
  marksRight: (f, marks) => { const c = model.counter(f); return c.length === marks.size && c.every((i) => marks.has(i)); },
  roundScore: (f, marks, pred) => (model.marksRight(f, marks) ? 0.5 : 0) + (pred === model.valid(f) ? 0.5 : 0),
};
export function selfTest() {
  const want = { 'Modus ponens': '', 'Affirming the consequent': '2', 'Denying the antecedent': '2', 'Modus tollens': '', 'Disjunctive syllogism': '' };
  const got = FORMS.map((f) => model.counter(f).join());
  const checks = [
    FORMS.every((f, i) => got[i] === want[f.name]),
    T.cond.f(true, false) === false && T.cond.f(false, false) === true && T.or.f(false, false) === false && T.or.f(false, true) === true,
    model.built(FORMS[0], ['p', 'cond', 'q']) && !model.built(FORMS[0], ['cond', 'q', 'p']),
    model.roundScore(FORMS[1], new Set([2]), false) === 1 && model.roundScore(FORMS[1], new Set(), true) === 0 && model.roundScore(FORMS[3], new Set(), true) === 1 && model.roundScore(FORMS[3], new Set([1]), true) === 0.5,
  ];
  return { ok: checks.every(Boolean), detail: `counter-example rows: ${FORMS.map((f, i) => `${f.name} [${got[i] ? 'p false, q true' : 'none'}]`).join(', ')}; ${checks.filter(Boolean).length}/${checks.length} checks` };
}

export default {
  id: 'w20-argument-builder',
  world: 20,
  levels: [5, 6],
  title: 'Argument Builder',
  goal: 'Assemble premises and a conclusion, predict whether it is valid, find counterexamples in the truth table, and fill in a hidden premise.',
  kind: 'validated',
  model: 'Exact propositional logic with two statements (p, q) and the connectives if–then, or and not: each of the four rows is one possible world, and an argument is valid when no row has true premises with a false conclusion. Valid means the conclusion must be true whenever the premises are, not that the premises are actually true. The falling beam is only a picture of a counter-example. Real arguments need more logic and judgement about whether the premises are true.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x), rnd = ctx.rng || Math.random, hints = ctx.level <= 5;
    const geos = [], sprites = [];
    const geo = (g) => { geos.push(g); return g; };
    const put = (g, m, x, y, z, parent = group) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
    const text = (s, opts, x, y, z, parent = group) => { const sp = ctx.sprite(s, opts); sp.position.set(x, y, z); parent.add(sp); sprites.push(sp); return sp; };
    const free = (sp) => { sp.material?.map?.dispose?.(); sp.material?.dispose?.(); };
    const holder = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); group.add(g); return g; };
    const label = (hold, s, opts = {}) => {
      while (hold.children.length) { const sp = hold.children[0]; hold.remove(sp); free(sp); }
      if (!s) return;
      const sp = ctx.sprite(s, { font: 48, bg: 'rgba(40,28,60,.8)', ...opts }), w = opts.maxW || 4.6;
      if (sp.scale.x > w) sp.scale.multiplyScalar(w / sp.scale.x);
      hold.add(sp);
    };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rnd() * (i + 1))); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pick = (a) => a[Math.min(a.length - 1, Math.floor(rnd() * a.length))];
    const relabel = (b, s) => { if (b && typeof b === 'object' && 'textContent' in b) b.textContent = s; };

    // three arguments, at least one valid and one that only looks valid
    let forms = shuffle([...FORMS]).slice(0, ARGS);
    for (let n = 0; n < 30 && new Set(forms.map(model.valid)).size < 2; n++) forms = shuffle([...FORMS]).slice(0, ARGS);
    const hid = pick(HIDDEN);

    // ----- the building site: a base, four waiting blocks, three places in the arch -----
    const stone = ctx.mat('#f6eedb', { roughness: 0.9 }), plinth = ctx.mat('#b89a78', { roughness: 0.9 });
    const trueMat = ctx.lit('#ffd24a', 0.95), falseMat = ctx.mat('#4a4458', { roughness: 0.7 });
    const HOME = [[-3.1, -0.5], [-2.25, -0.5], [2.25, -0.5], [3.1, -0.5]], LETTER = ['A', 'B', 'C', 'D'], COLOR = ['#6741d9', '#f59f00', '#12a594', '#d6336c'];
    const SLOT = [{ x: -0.7, y: 1.2, r: 0 }, { x: 0.7, y: 1.2, r: 0 }, { x: 0, y: 2.5, r: Math.PI / 2 }];
    put(geo(new THREE.BoxGeometry(2.8, 0.2, 1.1)), plinth, 0, 0.1, 0);
    const padGeo = geo(new THREE.CylinderGeometry(0.46, 0.52, 0.2, 16)); HOME.forEach(([x, z]) => put(padGeo, plinth, x, 0.1, z));
    const blockGeo = geo(new THREE.BoxGeometry(0.6, 2.0, 0.6));
    const mover = (mesh, own) => ({ mesh, own, pos: mesh.position.clone(), rot: 0, rz: 0, sy: 1, vy: 0, fall: false, wob: false });
    const blocks = HOME.map(([x, z], i) => {
      const own = ctx.mat(COLOR[i], { roughness: 0.55 }), mesh = put(blockGeo, own, x, 1.2, z);
      text(LETTER[i], { size: 0.5 }, 0, 0.55, 0.4, mesh);
      return mover(mesh, own);
    });
    const reason = mover(put(blockGeo, stone, SLOT[0].x, 1.2, 0), stone), spare = mover(put(blockGeo, stone, 0, 2.5, 0), stone);
    reason.mesh.visible = spare.mesh.visible = false;
    const movers = [...blocks, reason, spare];
    const send = (o, x, y, z, rot = 0) => { o.pos.set(x, y, z); o.rot = rot; o.fall = false; o.sy = 1; };
    const goHome = (i) => send(blocks[i], HOME[i][0], 1.2, HOME[i][1]);
    const goSlot = (o, k) => send(o, SLOT[k].x, SLOT[k].y, 0, SLOT[k].r);
    const drop = (o) => { o.pos.set(0.15, 0.3, 1.0); o.rot = Math.PI / 2 + 0.22; o.fall = !ctx.calm; o.vy = 0; };
    const halo = ctx.glow('#ffd24a', 5, 0.6); halo.position.set(0, 1.7, -0.4); halo.visible = false; group.add(halo);

    // labels: the sentences, the names of the three places, and true / false tags during a test
    const legend = [0, 1, 2, 3].map((i) => holder(0, 4.8 - i * 0.3, -0.7)), pqLine = holder(0, 3.5, -0.7);
    const caption = [holder(-0.9, 0.42, 0.85), holder(0.9, 0.42, 0.85), holder(0, 3.05, 0)];
    const tagAt = [[-0.7, 0.85, 0.45], [0.7, 0.85, 0.45], [0.55, 2.5, 0.45]];
    const tags = tagAt.map(([x, y, z]) => { const yes = text(t('true'), { size: 0.26, font: 56, color: '#2b2140', bg: '#ffd24a' }, x, y, z), no = text(t('false'), { size: 0.26, font: 56, bg: '#4a4458' }, x, y, z); yes.visible = no.visible = false; return [yes, no]; });

    // the four possible worlds: a lit lamp means that statement is true there
    const rowsG = new THREE.Group(); rowsG.visible = false; group.add(rowsG);
    const lampOn = ctx.lit('#ffd24a', 1.3), lampOff = ctx.mat('#4a4458', { roughness: 0.6 }), rowMat = ctx.mat('#7a5a8c', { roughness: 0.5 }), rowLit = ctx.lit('#b197fc', 0.8), ringMat = ctx.lit('#ff922b', 1.1);
    const rowGeo = geo(new THREE.CylinderGeometry(0.46, 0.52, 0.3, 20)), lampGeo = geo(new THREE.SphereGeometry(0.17, 14, 10)), ringGeo = geo(new THREE.TorusGeometry(0.6, 0.06, 8, 32));
    const rows = ROWS.map(([p, q], i) => {
      const x = -2.55 + i * 1.7, base = put(rowGeo, rowMat, x, 0.15, 1.9, rowsG);
      put(lampGeo, p ? lampOn : lampOff, -0.2, 0.34, 0, base); put(lampGeo, q ? lampOn : lampOff, 0.2, 0.34, 0, base);
      text('p', { size: 0.24 }, -0.2, 0.72, 0, base); text('q', { size: 0.24 }, 0.2, 0.72, 0, base); text(String(i + 1), { size: 0.26, color: '#fff7c2' }, 0, 0, 0.6, base);
      const ring = put(ringGeo, ringMat, 0, 0.18, 0, base); ring.rotation.x = Math.PI / 2; ring.visible = false;
      return { base, ring };
    });

    // ----- state -----
    let ri = 0, stage = 'build', pred = null, scoreSum = 0, S = SC[0], f = forms[0], tiles = [], slots = [null, null, null], order = [0, 1, 2];
    let tt = 0, cur = -1, shake = 0, clock = 0, auto = false, autoT = 0;
    const marks = new Set();
    const rStep = ui.readout('Step'), rArg = ui.readout('Argument'), rMarks = ui.readout('Rows marked, rows'), rScore = ui.readout('Score, points out of 4');
    const STEP = { build: 'Build the arch', predict: 'Predict: valid or not?', table: 'Mark the counter-examples', testing: 'Testing every row', result: 'Tested', hidden: 'Find the hidden premise', done: 'Finished', fail: 'Try again' };
    const show = () => {
      rStep.set(t(STEP[stage])); rArg.set(stage === 'hidden' || stage === 'done' || stage === 'fail' ? t('Hidden premise') : `${ri + 1}/${ARGS}`); rMarks.set(String(marks.size)); rScore.set(scoreSum.toFixed(1));
      rows.forEach((r, i) => { r.ring.visible = marks.has(i); });
    };
    const unpaint = () => { blocks.forEach((b) => { b.mesh.material = b.own; b.wob = false; }); spare.mesh.material = reason.mesh.material = stone; tags.forEach(([a, b]) => { a.visible = b.visible = false; }); };
    // shows one row on the arch: gold and "true", or dark and "false", for each premise and the conclusion
    const paint = (k) => {
      const [p, q] = ROWS[k];
      slots.forEach((bi, s) => { if (bi === null) return; const v = T[tiles[bi]].f(p, q); blocks[bi].mesh.material = v ? trueMat : falseMat; tags[s][0].visible = v; tags[s][1].visible = !v; });
    };
    const sentence = (id) => t(T[id].s(S));

    function round() {
      if (ri >= ARGS) return hidden();
      f = forms[ri]; S = pick(SC); stage = 'build'; pred = null; marks.clear(); slots = [null, null, null]; cur = -1;
      const ids = [...f.prem, f.conc], others = ['p', 'q', 'np', 'nq', 'or', 'cond'].filter((x) => !ids.includes(x));
      tiles = shuffle([...ids, pick(others)]);
      unpaint(); halo.visible = false; rowsG.visible = false; reason.mesh.visible = spare.mesh.visible = false;
      blocks.forEach((b, i) => { b.mesh.visible = true; goHome(i); });
      tiles.forEach((id, i) => { label(legend[i], `${LETTER[i]}: ${sentence(id)}`, { size: 0.25 }); relabel(blockBtn[i], `${LETTER[i]}: ${sentence(id)}`); });
      label(pqLine, `p: ${t(S.p[0])}  ·  q: ${t(S.q[0])}`, { size: 0.23, color: '#fff7c2' });
      ['Premise 1', 'Premise 2', 'Conclusion'].forEach((c, i) => label(caption[i], t(c), { size: 0.2, maxW: 1.5 }));
      rows.forEach((r) => { r.base.material = rowMat; });
      predC.set(null); show();
      ctx.say(`${t('Argument')} ${ri + 1}/${ARGS}. ${t('Tap sentence blocks to build the arch: two premise pillars, then the conclusion beam on top. One block is a distractor.')}`);
    }
    function tapBlock(i) {
      if (stage === 'hidden') return chooseHidden(i);
      if (stage !== 'build') { ctx.say('The arch is already built. Carry on with the step shown in the panel.'); return; }
      const k = slots.indexOf(i);
      if (k >= 0) { slots[k] = null; goHome(i); return; }
      const e = slots.indexOf(null);
      if (e < 0) { ctx.say('The arch is full. Tap a block in the arch to take it out again.'); return; }
      slots[e] = i; goSlot(blocks[i], e);
    }
    function check() {
      if (stage !== 'build') return;
      if (slots.includes(null)) { ctx.say('Fill both pillars and the beam first: two premises, then the conclusion.'); return; }
      if (!model.built(f, slots.map((i) => tiles[i]))) { shake = 0.8; ctx.say('Not quite: the conclusion is what the premises are meant to prove, so it is the sentence that follows from the other two.'); return; }
      stage = 'predict'; show();
      ctx.say(`${t('Built: ')}${t(f.name)}. ${t('Predict: is this argument valid? Valid means the beam can never fall while both pillars stand, whatever is true in the world.')}`);
    }
    function predict(v) {
      if (v == null || (stage !== 'predict' && stage !== 'table')) return;
      pred = v;
      if (stage === 'table') return;
      stage = 'table'; rowsG.visible = true; show();
      ctx.say(hints ? 'Each stand is one possible world: a lit lamp means that statement is true there. Tap a row to see it on the arch, and mark every row that is a counterexample (all premises true, conclusion false).'
        : 'Each stand is one possible world: a lit lamp means that statement is true there. Work out each row in your head and mark every row that is a counterexample (all premises true, conclusion false).');
    }
    function tapRow(i) {
      if (stage !== 'table') { ctx.say(stage === 'predict' ? 'Predict first: valid or invalid?' : 'The rows are used after the arch is built and you have made a prediction.'); return; }
      marks.has(i) ? marks.delete(i) : marks.add(i);
      rows.forEach((r, k) => { r.base.material = hints && k === i ? rowLit : rowMat; });
      if (hints) { unpaint(); paint(i); }
      show();
    }
    function test() {
      if (stage !== 'table') { ctx.say('Build the arch, predict, and mark the rows first.'); return; }
      stage = 'testing'; tt = 0; cur = -1; show();
      ctx.say('Testing all four possible worlds, one row at a time. Watch for a row where both pillars are true and the beam is false.');
    }
    function endTest() {
      const truth = model.counter(f), valid = truth.length === 0, ok = model.marksRight(f, marks), predOk = pred === valid;
      scoreSum += model.roundScore(f, marks, pred);
      unpaint(); rows.forEach((r, i) => { r.base.material = truth.includes(i) ? rowLit : rowMat; });
      if (valid) halo.visible = true;
      else { paint(truth[0]); drop(blocks[slots[2]]); blocks[slots[0]].rot = 0.1; blocks[slots[1]].rot = -0.1; }
      stage = 'result'; show();
      ctx.say((valid ? t('Valid: no row has true premises with a false conclusion.') : t('Invalid: a counterexample row has true premises and a false conclusion.')) + ' ' + (predOk ? t('Your prediction was right.') : t('Your prediction was wrong.')) + (ok ? '' : ' ' + t('Your marked rows were not exactly the counterexamples.')) + ' '
        + (valid ? t('A valid form guarantees the conclusion if the premises are true. Validity is about structure, not about whether the sentences are true.') : t('This form looks convincing but a counterexample shows it can fail. Many everyday mistakes have this shape.')) + ' ' + t('Press Next to go on.'));
    }
    function next() {
      if (stage === 'result') { ri++; round(); } else if (stage === 'fail') { ri = 0; scoreSum = 0; round(); } else if (stage !== 'done') ctx.say('Finish this step first, then press Next.');
    }
    function hidden() {
      stage = 'hidden'; marks.clear(); slots = [null, null, null]; order = shuffle([0, 1, 2]);
      unpaint(); halo.visible = false; rowsG.visible = false;
      blocks.forEach((b, i) => { b.mesh.visible = i < 3; goHome(i); });
      reason.mesh.visible = spare.mesh.visible = true; goSlot(reason, 0); send(spare, 0, 2.42, 0, Math.PI / 2 - 0.14);
      label(legend[0], t(hid.arg), { size: 0.27, color: '#fff7c2' });
      order.forEach((o, i) => { label(legend[i + 1], `${LETTER[i]}: ${t(hid.opts[o])}`, { size: 0.25 }); relabel(blockBtn[i], `${LETTER[i]}: ${t(hid.opts[o])}`); });
      relabel(blockBtn[3], '–');
      label(pqLine, t('Which block holds up the conclusion?'), { size: 0.23, color: '#fff7c2' });
      ['Reason', 'Hidden premise', 'Conclusion'].forEach((c, i) => label(caption[i], t(c), { size: 0.2, maxW: 1.7 }));
      show();
      ctx.say(`${t('This argument has a hidden premise (an unstated assumption).')} ${t(hid.arg)} ${t('Which statement, if added, makes the conclusion follow? Tap its block to stand it under the sagging beam.')}`);
    }
    function chooseHidden(i) {
      if (i > 2) return;
      const ok = order[i] === 0, b = blocks[i];
      goSlot(b, 1); scoreSum += ok ? 1 : 0;
      const sc = scoreSum / (ARGS + 1);
      if (ok) { goSlot(spare, 2); b.mesh.material = trueMat; halo.visible = true; } else { b.sy = 0.8; b.pos.y = 1.0; b.mesh.material = falseMat; drop(spare); }
      stage = sc >= 0.6 ? 'done' : 'fail'; show();
      ctx.say((ok ? t('Yes: it links the reason to the conclusion.') : t('That does not link the reason to the conclusion. The needed one is: ') + t(hid.opts[0])) + ' ' + t('Hidden premises can be false too, so always ask whether they are true.') + ' ' + t('Spotting hidden premises lets you challenge an argument at its weakest point.') + (sc >= 0.6 ? '' : ' ' + t('Press Next to try the arguments again.')));
      if (sc >= 0.6) ctx.complete(sc, 'Built arguments, tested validity with truth tables and found a hidden premise.');
    }

    // ----- controls -----
    ui.note('Tap a block to move it into the arch, and tap it again to take it out. The same buttons are below.');
    const blockBtn = LETTER.map((L, i) => ui.button(`Block ${L}`, () => tapBlock(i)));
    ui.button('Check my argument', check, 'btn');
    const predC = ui.choice([[true, 'Valid: the arch always stands'], [false, 'Invalid: the beam can fall']], null, predict);
    ROWS.forEach(([p, q], i) => ui.button(`Row ${i + 1}: p ${p ? 'true' : 'false'}, q ${q ? 'true' : 'false'}`, () => tapRow(i)));
    ui.button('Test the arch', test, 'btn');
    ui.button('Next', next, 'btn ok');
    blocks.forEach((b, i) => ctx.onTap(b.mesh, () => tapBlock(i)));
    rows.forEach((r, i) => ctx.onTap(r.base, () => tapRow(i)));
    round();

    const act = () => {
      if (stage === 'build') {
        const want = [...f.prem, f.conc].map((id) => tiles.indexOf(id)), k = want.findIndex((w, s) => slots[s] !== w);
        if (k < 0) check(); else if (slots[k] !== null) tapBlock(slots[k]); else if (slots.includes(want[k])) tapBlock(want[k]); else if (slots.indexOf(null) === k) tapBlock(want[k]); else tapBlock(slots.find((x, s) => s > k && x !== null));
      } else if (stage === 'predict') predC.set(model.valid(f));
      else if (stage === 'table') { const truth = model.counter(f), i = ROWS.findIndex((_, k) => marks.has(k) !== truth.includes(k)); if (i >= 0) tapRow(i); else test(); }
      else if (stage === 'result' || stage === 'fail') next();
      else if (stage === 'hidden') tapBlock(order.indexOf(0));
    };

    return {
      step(dt) {
        clock += dt; if (shake > 0) shake -= dt;
        if (stage === 'testing') {
          tt += dt; const k = Math.floor(tt / (ctx.calm ? 0.8 : 1.1));
          if (k !== cur) {
            cur = k;
            if (k >= ROWS.length) endTest();
            else { unpaint(); paint(k); rows.forEach((r, i) => { r.base.material = i === k ? rowLit : rowMat; }); blocks[slots[2]].wob = model.counter(f).includes(k); }
          }
        }
        for (const o of movers) {
          const m = o.mesh, a = Math.min(1, dt * 6);
          m.position.x += (o.pos.x - m.position.x) * a; m.position.z += (o.pos.z - m.position.z) * a;
          if (o.fall) {
            o.vy -= 9.8 * dt; m.position.y += o.vy * dt;
            if (m.position.y <= o.pos.y) { m.position.y = o.pos.y; if (o.vy < -1.5) o.vy = -o.vy * 0.3; else o.fall = false; }
          } else m.position.y += (o.pos.y - m.position.y) * a;
          o.rz += (o.rot - o.rz) * a; m.scale.y += (o.sy - m.scale.y) * a;
          m.rotation.z = o.rz + (!ctx.calm && (o.wob || (shake > 0 && slots.includes(blocks.indexOf(o)))) ? Math.sin(clock * 18) * 0.05 : 0);
        }
        if (auto && stage !== 'done' && stage !== 'testing') { autoT -= dt; if (autoT <= 0) { autoT = 0.45; act(); } }
      },
      frame(dt, time = 0) { if (halo.visible) halo.material.opacity = ctx.calm ? 0.5 : 0.45 + Math.sin(time * 3) * 0.2; },
      autoplay() { auto = true; autoT = 0.2; },
      dispose() { [...legend, pqLine, ...caption].forEach((h) => label(h, '')); sprites.forEach(free); geos.forEach((g) => g.dispose()); },
    };
  },
};
