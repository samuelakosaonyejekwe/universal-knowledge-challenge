// World 20 lab — Thought Experiment Explorer in 3D: a fork in a garden path and three lantern-bearing guides,
// each lighting the path their way of thinking recommends. No imports: everything arrives through the context.

const LENS = [['Virtue', 'what would a good person be like?'], ['Duty', 'what rules or promises apply?'], ['Consequences', 'what makes things go best for everyone?']];
const D = [
  { story: 'You find a purse with a name card. If you hand it in now, you will miss the start of a party. If you finish the party first, the owner waits a few hours.', opts: ['Hand it in right now', 'Go to the party, then hand it in'],
    view: [[0, 'An honest, caring person puts the worried owner first.'], [0, 'Lost things should go back as soon as we can; that is a basic rule.'], [0, 'A short wait for you costs less than hours of worry for the owner, but it is close.']],
    reasons: [[0, 0, 'Being honest and kind matters most to me.'], [0, 1, 'Returning lost things quickly is the rule I follow.'], [0, 2, 'The owner may be very worried; that is a bigger cost than a late party.'], [1, 0, 'A good person also keeps their own plans and friends.'], [1, 1, 'Nothing says it must be this minute, only that I do return it.'], [1, 2, 'Handing it in later makes little difference and I enjoy the party.']],
    twist: 'Twist: the owner is not worried at all and is going to be away until tomorrow.', shifts: [false, false, true], why: ['Virtue and duty look at what kind of person you are and the rule, not just this outcome.', '', 'Consequences care about how worried the owner is, so the answer can move.'] },
  { story: 'You promised to help your friend Sam practise for a race. On the way, a classmate trips and needs someone to walk them to the nurse. Sam will wait.', opts: ['Keep the promise to Sam', 'Walk the classmate to the nurse first'],
    view: [[1, 'A kind person helps who needs it, then makes it up to Sam.'], [0, 'A promise is a promise, unless the other person lets you off.'], [1, 'The classmate needs help most, and Sam only loses a little time.']],
    reasons: [[0, 0, 'Being reliable is part of being a good friend.'], [0, 1, 'I made a promise, and promises should be kept.'], [0, 2, 'Sam would be let down and trust would be damaged.'], [1, 0, 'Kindness to someone hurt matters most to me.'], [1, 1, 'Helping someone in need is also a duty.'], [1, 2, 'The classmate needs help now, and Sam only loses a bit of time.']],
    twist: 'Twist: Sam shouts, "Go and help, I do not mind!"', shifts: [false, true, false], why: ['A kind person would help either way.', 'A promise can be released by the person it was made to, so duty can change.', 'Consequences already favoured helping the classmate.'] },
];

// ----- the scoring: how well the reasons fit the choice and each other, not which side was picked -----
export const model = {
  // chosen = indices into d.reasons
  judge(d, pick, chosen) {
    const rs = chosen.map((i) => d.reasons[i]), counts = [0, 0, 0];
    rs.forEach((x) => counts[x[1]]++);
    const top = Math.max(...counts);
    return { support: rs.filter((x) => x[0] === pick).length / rs.length, same: top / rs.length, lens: counts.indexOf(top) };
  },
  consistent: (d, lens, changed) => changed === d.shifts[lens],
  score: (s, ok) => 0.35 * s.support + 0.3 * s.same + 0.35 * (ok ? 1 : 0),
  // the path a way of thinking lights, before and after the twist
  lean: (d, l, twisted) => (twisted && d.shifts[l] ? 1 - d.view[l][0] : d.view[l][0]),
};
export function selfTest() {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const a = model.judge(D[0], 0, [0, 1]), b = model.judge(D[0], 0, [0, 5]), c = model.judge(D[1], 0, [1, 4]);
  const checks = [
    a.support === 1 && a.same === 0.5 && a.lens === 0 && near(model.score(a, model.consistent(D[0], a.lens, false)), 0.85),
    b.support === 0.5 && b.lens === 0 && near(model.score(b, true), 0.675),
    c.support === 0.5 && c.same === 1 && c.lens === 1 && near(model.score(c, model.consistent(D[1], 1, true)), 0.825) && near(model.score(c, model.consistent(D[1], 1, false)), 0.475),
    model.lean(D[0], 2, false) === 0 && model.lean(D[0], 2, true) === 1 && model.lean(D[1], 1, true) === 1 && model.lean(D[1], 0, true) === 1,
    D.every((d) => d.reasons.every(([o, l], i) => i === o * 3 + l)),
  ];
  return { ok: checks.every(Boolean), detail: `two reasons backing the choice from two lenses, steady after the twist: 0.35 + 0.15 + 0.35 = ${model.score(a, true).toFixed(2)}; ${checks.filter(Boolean).length}/${checks.length} checks` };
}

export default {
  id: 'w20-dilemma-explorer',
  world: 20,
  levels: [3, 4],
  title: 'Thought Experiment Explorer',
  goal: 'Choose what to do, compare how three ways of thinking reason about it, then give consistent reasons and handle a twist.',
  kind: 'simplified',
  model: 'Two gentle, invented dilemmas and three simplified ways of thinking, shown as guides who light the path they recommend. Real philosophers disagree about each of them, and no answer is announced as the correct one here: you are scored on giving reasons and staying consistent, not on picking a side.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x), rnd = ctx.rng || Math.random, tinted = ctx.level <= 3;
    const geos = [], sprites = [], holders = [];
    const geo = (g) => { geos.push(g); return g; };
    const put = (g, m, x, y, z, parent = group) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
    const free = (sp) => { sp.material?.map?.dispose?.(); sp.material?.dispose?.(); };
    const text = (s, opts, x, y, z, parent = group) => { const sp = ctx.sprite(s, { font: 56, ...opts }); sp.position.set(x, y, z); parent.add(sp); sprites.push(sp); return sp; };
    const holder = (x, y, z, parent = group) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); holders.push(g); return g; };
    const label = (hold, s, opts = {}) => {
      while (hold.children.length) { const sp = hold.children[0]; hold.remove(sp); free(sp); }
      if (!s) return;
      const sp = ctx.sprite(s, { font: 48, bg: 'rgba(40,28,60,.8)', ...opts }), w = opts.maxW || 3;
      if (sp.scale.x > w) sp.scale.multiplyScalar(w / sp.scale.x);
      hold.add(sp);
    };
    const line = (first) => { const el = ui.note(first); return (s) => { if (el && typeof el === 'object') el.textContent = s; }; };
    const relabel = (b, s) => { if (b && typeof b === 'object' && 'textContent' in b) b.textContent = s; };

    // ----- the garden: a stem path that forks to two gates -----
    const FORK = [0, 0.7], START = [0, 2.2];
    const branch = (o, s) => [(o ? 1 : -1) * 2.7 * s, 0.7 - 2.5 * s + 0.45 * Math.sin(Math.PI * s)];
    const spot = (o, l) => { const [x, z] = branch(o, 0.4 + 0.2 * l); return [x - (o ? 1 : -1) * 0.45, z - 0.35]; };
    const lawn = put(geo(new THREE.CylinderGeometry(3.5, 3.5, 0.05, 40)), ctx.mat('#c9dc9a', { roughness: 1 }), 0, 0.025, 0); lawn.scale.z = 0.72;
    const stoneGeo = geo(new THREE.CylinderGeometry(0.27, 0.3, 0.08, 14)), stoneMat = ctx.mat('#f6eedb', { roughness: 0.9 });
    [2.2, 1.7, 1.2].forEach((z) => put(stoneGeo, stoneMat, 0, 0.09, z));
    const stones = [0, 1].map((o) => [0.14, 0.31, 0.48, 0.65, 0.82].map((s) => { const [x, z] = branch(o, s); return put(stoneGeo, stoneMat, x, 0.09, z); }));
    const wood = ctx.mat('#8a5a3a', { roughness: 0.8 }), leaf = ctx.mat('#7fb069', { roughness: 0.9 });
    const gatePost = geo(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8)), gateBar = geo(new THREE.BoxGeometry(1.5, 0.16, 0.16));
    const gates = [0, 1].map((o) => { const [x, z] = branch(o, 1); return [put(gatePost, wood, x - 0.6, 0.95, z), put(gatePost, wood, x + 0.6, 0.95, z), put(gateBar, wood, x, 1.9, z)]; });
    const signs = [holder(-1.95, 2.55, -1.8), holder(1.95, 2.95, -1.8)];
    const bushGeo = geo(new THREE.SphereGeometry(0.42, 12, 8));
    for (const [x, z] of [[-3.1, 1.2], [3.1, 1.2], [-1.0, -1.95], [1.0, -1.95]]) put(bushGeo, leaf, x, 0.35, z).scale.y = 0.8;
    put(geo(new THREE.CylinderGeometry(0.12, 0.18, 1.5, 8)), wood, 0, 0.75, -1.85); put(geo(new THREE.SphereGeometry(0.62, 14, 10)), leaf, 0, 1.9, -1.85);

    // ----- the three guides and the traveller -----
    const LCOL = ['#f59f00', '#6741d9', '#12a594'], dim = ctx.mat('#6b6078', { roughness: 0.6 }), skin = ctx.mat('#f2c078', { roughness: 0.8 });
    const lensLit = LCOL.map((c) => ctx.lit(c, 1.3)), pathLit = LCOL.map((c) => ctx.lit(c, 0.75)), plainLit = ctx.lit('#fff3c4', 1.2);
    const robeGeo = geo(new THREE.ConeGeometry(0.32, 0.95, 14)), headGeo = geo(new THREE.SphereGeometry(0.2, 14, 10)), armGeo = geo(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6)), lampGeo = geo(new THREE.SphereGeometry(0.15, 12, 8));
    const GHOME = [[-0.95, -0.6], [0, -0.95], [0.95, -0.6]];
    const actor = (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g); return { g, path: [], hop: 0, seed: x * 3 }; };
    const guides = LENS.map(([name], l) => {
      const a = actor(GHOME[l][0], GHOME[l][1]);
      put(robeGeo, ctx.mat(LCOL[l], { roughness: 0.7 }), 0, 0.475, 0, a.g); put(headGeo, skin, 0, 1.1, 0, a.g);
      const arm = put(armGeo, wood, 0.3, 0.95, 0.12, a.g); arm.rotation.z = -1.1;
      a.lamp = put(lampGeo, dim, 0.52, 0.86, 0.14, a.g);
      text(t(name), { size: 0.24, bg: 'rgba(40,28,60,.8)' }, 0, 1.62, 0, a.g);
      return a;
    });
    const you = actor(START[0], START[1]);
    put(geo(new THREE.CylinderGeometry(0.18, 0.28, 0.8, 12)), ctx.mat('#fff4e0', { roughness: 0.7 }), 0, 0.4, 0, you.g); put(headGeo, skin, 0, 1.0, 0, you.g);
    put(geo(new THREE.ConeGeometry(0.22, 0.3, 12)), ctx.mat('#e8590c', { roughness: 0.6 }), 0, 1.3, 0, you.g);
    text(t('You'), { size: 0.24, bg: 'rgba(40,28,60,.8)' }, 0, 1.8, 0, you.g);
    const walk = (a, ...pts) => { a.path = pts.map((p) => [p[0], p[1]]); };

    // ----- six reason lanterns: three beside each path, one for each way of thinking -----
    const postGeo = geo(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 8)), bulbGeo = geo(new THREE.SphereGeometry(0.25, 14, 10)), bulbOff = ctx.mat('#8f7f9c', { roughness: 0.5 });
    const bulbs = [0, 1, 2, 3, 4, 5].map((i) => {
      const o = Math.floor(i / 3), l = i % 3, [bx, bz] = branch(o, 0.25 + 0.25 * l), x = bx + (o ? 1 : -1) * 0.6, z = bz + 0.42;
      put(postGeo, wood, x, 0.45, z);
      const bulb = put(bulbGeo, bulbOff, x, 1.05, z); text(String(i + 1), { size: 0.26, color: '#fff7c2' }, 0, 0.45, 0, bulb);
      return bulb;
    });
    // the twist arrives on a board under the tree
    const board = put(geo(new THREE.BoxGeometry(1.7, 0.55, 0.1)), ctx.lit('#ffb92e', 0.7), 0, 1.2, -1.45); board.visible = false;
    text(t('Twist!'), { size: 0.36, color: '#2b2140' }, 0, 0, 0.12, board);

    // ----- state -----
    const order = rnd() < 0.5 ? [D[0], D[1]] : [D[1], D[0]], scores = [];
    let di = 0, d = order[0], pick = null, lens = null, changed = null, stage = 'pick', judged = null, revealed = false, twisted = false, litN = 0, auto = false, autoT = 0;
    const picked = new Set();
    const rD = ui.readout('Dilemma'), rLit = ui.readout('Reasons lit, reasons'), rLens = ui.readout('Your reasons follow'), rScore = ui.readout('Reasoning consistency, %');
    const storyLine = line('The story appears here.'), optLine = line('Left path and right path.');
    const pathC = ui.choice([[0, 'Take the left path'], [1, 'Take the right path']], null, (v) => choose(v));
    const lensLine = [0, 1, 2].map(() => line('–'));
    const reasonBtn = [0, 1, 2, 3, 4, 5].map((i) => ui.button(`Reason lantern ${i + 1}`, () => toggle(i)));
    ui.button('Submit my reasons', () => submit(), 'btn');
    const twistLine = line('–');
    const changeC = ui.choice([[true, 'Yes, I would change'], [false, 'No, I would stay']], null, (v) => { changed = v ?? null; });
    ui.button('Finish this one', () => finishOne(), 'btn');
    ui.button('Next', () => next(), 'btn ok');
    const draw = () => {
      rD.set(`${Math.min(di + 1, order.length)}/${order.length}`); rLit.set(String(picked.size)); rLens.set(lens === null ? '–' : t(LENS[lens][0]));
      bulbs.forEach((b, i) => { b.material = picked.has(i) ? (tinted ? lensLit[i % 3] : plainLit) : bulbOff; });
      guides.forEach((g, l) => { g.lamp.material = revealed ? lensLit[l] : dim; });
    };

    function show() {
      d = order[di]; pick = null; lens = null; changed = null; judged = null; stage = 'pick'; revealed = false; twisted = false; picked.clear(); litN = 0;
      storyLine(`(${di + 1}/${order.length}) ${t(d.story)}`); optLine(`${t('Left path')}: ${t(d.opts[0])}. ${t('Right path')}: ${t(d.opts[1])}.`);
      lensLine.forEach((set) => set('–')); twistLine('–'); reasonBtn.forEach((b, i) => relabel(b, `${t('Reason lantern')} ${i + 1}`));
      d.opts.forEach((o, i) => label(signs[i], t(o), { size: 0.27, maxW: 3.1 }));
      board.visible = false; pathC.set(null); changeC.set(null);
      guides.forEach((g, l) => walk(g, GHOME[l])); walk(you, START);
      draw();
      ctx.say(`${t(d.story)} ${t('Predict first: what would you do? Tap a gate or choose a path.')}`);
    }
    function choose(v) {
      if (v == null) return;
      if (stage !== 'pick') { ctx.say('You have already chosen a path for this dilemma. Carry on with your reasons.'); return; }
      pick = v; stage = 'reasons'; revealed = true; litN = 0;
      walk(you, FORK); guides.forEach((g, l) => walk(g, spot(d.view[l][0], l)));
      d.view.forEach(([lean, txt], l) => lensLine[l](`${t(LENS[l][0])}: ${t(LENS[l][1])} → ${t(d.opts[lean])}. ${t(txt)}`));
      d.reasons.forEach((x, i) => relabel(reasonBtn[i], `${i + 1}. ${t(x[2])}`));
      draw();
      const agree = new Set(d.view.map((x) => x[0])).size === 1;
      ctx.say(`${t(agree ? 'The lenses agree on the action here but for different reasons.' : 'The three lenses can disagree. That is allowed: thinking carefully means giving reasons.')} ${t('Each guide lights the path their way of thinking recommends. Now pick two or three reasons that support YOUR choice: tap the reason lanterns.')}`);
    }
    function toggle(i) {
      if (stage !== 'reasons') { ctx.say(stage === 'pick' ? 'Choose a path first.' : 'Your reasons are already handed in for this dilemma.'); return; }
      picked.has(i) ? picked.delete(i) : picked.add(i);
      draw();
      ctx.say(`${t('Reason lantern')} ${i + 1} ${t(picked.has(i) ? 'is lit' : 'is out')}: ${t(d.reasons[i][2])}`);
    }
    function submit() {
      if (stage !== 'reasons') return;
      if (picked.size < 2 || picked.size > 3) { ctx.say('Choose two or three reasons.'); return; }
      judged = model.judge(d, pick, [...picked]); lens = judged.lens; stage = 'twist';
      walk(you, branch(pick, 0.45)); guides[lens].hop = 1.2; board.visible = true; twistLine(t(d.twist)); draw();
      ctx.say(`${t('Your reasons mostly follow the lens:')} ${t(LENS[lens][0])}. ${t(judged.support < 1 ? 'Some reasons you picked back the other option, which is a sign of a tension worth noticing.' : 'Your reasons all back your choice.')} ${t(d.twist)} ${t('Does your answer change?')}`);
    }
    function finishOne() {
      if (stage !== 'twist') return;
      if (changed === null) { ctx.say('Decide first: does the twist change your answer, or do you stay?'); return; }
      const ok = model.consistent(d, lens, changed);
      scores.push(model.score(judged, ok)); stage = 'result'; twisted = true; litN = 0;
      if (changed) walk(you, FORK, branch(1 - pick, 0.9)); else walk(you, branch(pick, 0.9));
      guides.forEach((g, l) => { if (d.shifts[l]) walk(g, spot(model.lean(d, l, true), l)); });
      if (ok) { you.hop = 1.2; guides[lens].hop = 1.2; }
      rScore.set(String(Math.round(scores[scores.length - 1] * 100)));
      ctx.say((ok ? t('Consistent: ') + t(d.why[lens] || 'Your lens does not depend on that fact, so the answer stays.') : t('Check your lens: ') + t(d.shifts[lens] ? 'the twist changes a fact that this way of thinking cares about.' : 'this way of thinking does not depend on the changed fact, so the answer would stay.'))
        + ' ' + t('Philosophers use thought experiments to test whether our reasons stay consistent when the facts change.') + ' ' + t('Press Next to go on.'));
    }
    function next() {
      if (stage === 'fail') { di = 0; scores.length = 0; show(); return; }
      if (stage !== 'result') { if (stage !== 'done') ctx.say('Finish this dilemma first, then press Next.'); return; }
      di++;
      if (di < order.length) return show();
      const sc = scores.reduce((a, b) => a + b, 0) / scores.length, pct = Math.round(sc * 100);
      rScore.set(String(pct)); stage = sc >= 0.6 ? 'done' : 'fail';
      ctx.say(`${t('Reasoning consistency:')} ${pct}%. ${t('Not a right-answer score: it shows how well your reasons matched each other.')}${sc >= 0.6 ? '' : ' ' + t('Press Next to explore again.')}`);
      if (sc >= 0.6) ctx.complete(sc, 'Compared virtue, duty and consequence reasoning with consistent reasons.');
    }

    gates.forEach((parts, o) => parts.forEach((m) => ctx.onTap(m, () => pathC.set(o))));
    bulbs.forEach((b, i) => ctx.onTap(b, () => toggle(i)));
    show();

    const act = () => {
      if (stage === 'pick') pathC.set(0);
      else if (stage === 'reasons') { const want = [pick * 3, pick * 3 + 1], extra = [...picked].find((i) => !want.includes(i)), miss = want.find((i) => !picked.has(i)); if (extra !== undefined) toggle(extra); else if (miss !== undefined) toggle(miss); else submit(); }
      else if (stage === 'twist') { if (changed !== d.shifts[lens]) changeC.set(d.shifts[lens]); else finishOne(); }
      else if (stage === 'result' || stage === 'fail') next();
    };
    const moveActor = (a, dt) => {
      const p = a.path[0]; if (!p) return;
      const dx = p[0] - a.g.position.x, dz = p[1] - a.g.position.z, L = Math.hypot(dx, dz), go = (ctx.calm ? 3.2 : 1.9) * dt;
      if (L <= go) { a.g.position.x = p[0]; a.g.position.z = p[1]; a.path.shift(); if (!a.path.length) a.g.rotation.y = 0; return; }
      a.g.position.x += dx / L * go; a.g.position.z += dz / L * go; a.g.rotation.y = Math.atan2(dx, dz);
    };

    return {
      step(dt) {
        guides.forEach((g) => moveActor(g, dt)); moveActor(you, dt);
        // the path stones light up one after another, in the colours of the guides who recommend that path
        if (revealed) litN = Math.min(5, litN + dt * 4);
        for (const o of [0, 1]) {
          const who = [0, 1, 2].filter((l) => model.lean(d, l, twisted) === o);
          stones[o].forEach((s, j) => { s.material = revealed && who.length && j < litN ? pathLit[who[j % who.length]] : stoneMat; });
        }
        if (auto && stage !== 'done') { autoT -= dt; if (autoT <= 0) { autoT = 0.6; act(); } }
      },
      frame(dt, time = 0) {
        for (const a of [...guides, you]) {
          if (a.hop > 0) a.hop = Math.max(0, a.hop - dt);
          const moving = a.path.length > 0;
          a.g.position.y = ctx.calm ? 0 : a.hop > 0 ? Math.abs(Math.sin(a.hop * 8)) * 0.25 : moving ? Math.abs(Math.sin(time * 9 + a.seed)) * 0.06 : 0;
        }
        if (!ctx.calm) { guides.forEach((g, l) => { g.lamp.position.y = 0.86 + Math.sin(time * 2.2 + l * 2) * 0.03; }); if (board.visible) board.rotation.z = Math.sin(time * 2) * 0.04; }
      },
      autoplay() { auto = true; autoT = 0.3; },
      dispose() { holders.forEach((h) => label(h, '')); sprites.forEach(free); geos.forEach((g) => g.dispose()); },
    };
  },
};
