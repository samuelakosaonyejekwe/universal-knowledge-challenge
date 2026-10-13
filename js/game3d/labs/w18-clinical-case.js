// World 18 lab — Clinical Reasoning Case in 3D: a consulting room with an invented patient, question bubbles,
// test stations, a notes board and a tower of possible causes that the player keeps in order.
// No imports: everything arrives through the context, so the file also runs in tools/test-game3d.mjs.

// ----- the model: the same two fictional cases, evidence points and scoring as the flat lab -----
// A question is [question, answer, evidence points, is it a danger check]; a test is [test, result, evidence points, value, short name].
const CASES = [
  {
    name: 'Tomas, 7', who: 'Tomas, 7 (invented), has had a cough and fever for 3 days.', truth: 'chest',
    dx: [['cold', 'Common cold'], ['chest', 'Chest infection'], ['asthma', 'Asthma flare'], ['object', 'Small object breathed in']],
    qs: [
      ['Is breathing fast or hard?', 'Yes, quick breaths and the skin between the ribs pulls in.', { chest: 1, asthma: 1, cold: -1 }, true],
      ['Any wheeze, or asthma in the past?', 'No wheeze and no asthma history.', { asthma: -2 }],
      ['How high and how long is the fever?', '38.9 °C for three days.', { chest: 1, cold: -0.5 }],
      ['Did it start suddenly while playing or eating?', 'No, it built up slowly.', { object: -2 }],
      ['Is he drinking enough?', 'Drinking much less than usual.', { chest: 1 }, true],
      ['Any runny nose or sore throat?', 'A little runny nose.', { cold: 0.5 }],
    ],
    tests: [
      ['Check oxygen level and breathing rate', 'Oxygen 93%, 38 breaths a minute.', { chest: 1, cold: -1 }, 'key', 'Oxygen check'],
      ['Chest X-ray', 'A cloudy patch in one lung.', { chest: 2, object: -1 }, 'useful', 'Chest X-ray'],
      ['Try a reliever inhaler and re-check', 'No change in breathing.', { asthma: -1 }, 'useful', 'Inhaler check'],
      ['Ankle X-ray', 'Not related to the problem.', {}, 'low', 'Ankle X-ray'],
      ['Allergy skin test', 'Not related to this illness.', {}, 'low', 'Allergy test'],
    ],
    net: 'Come back or call urgently if breathing gets harder, he is very sleepy, or he stops drinking.',
  },
  {
    name: 'Maya, 15', who: 'Maya, 15 (invented), felt dizzy and nearly fainted after sports on a hot day.', truth: 'dehyd',
    dx: [['dehyd', 'Dehydration'], ['sugar', 'Low blood sugar'], ['anaemia', 'Low iron (anaemia)'], ['heart', 'Heart rhythm problem']],
    qs: [
      ['Did she drink during the sport?', 'Hardly anything for two hours.', { dehyd: 1.5 }],
      ['Did she skip meals?', 'She ate breakfast and lunch normally.', { sugar: -1.5 }],
      ['Any chest pain, racing heart, or fainting during exercise before?', 'No chest pain, no earlier faints, no family history.', { heart: -2 }, true],
      ['Is her urine dark?', 'Yes, quite dark.', { dehyd: 1 }],
      ['Is she often tired or pale?', 'No, she has normal energy.', { anaemia: -1.5 }],
      ['Did she recover after resting and drinking?', 'Yes, within twenty minutes.', { dehyd: 1, heart: -0.5 }, true],
    ],
    tests: [
      ['Check pulse and blood pressure lying and standing', 'Pulse fast and pressure drops a little on standing.', { dehyd: 1.5 }, 'key', 'Pulse check'],
      ['Finger-prick blood sugar', 'Normal.', { sugar: -2 }, 'useful', 'Blood sugar'],
      ['Heart tracing (ECG)', 'Normal rhythm.', { heart: -2 }, 'useful', 'Heart tracing'],
      ['Hearing test', 'Not related to the problem.', {}, 'low', 'Hearing test'],
      ['Knee scan', 'Not related to the problem.', {}, 'low', 'Knee scan'],
    ],
    net: 'Seek urgent help if she faints again, has chest pain, or her heart races without a reason.',
  },
];
const UNSAFE = ['Nothing more is needed; no need to watch for changes.', 'Only come back if it is still there in two months.'];
const PASS = 0.65;
export const model = {
  CASES, PASS,
  // Adds up the evidence points of every question asked and test done, for each possible cause.
  evidence(c, asked, tested) {
    const sc = {}; c.dx.forEach((d) => { sc[d[0]] = 0; });
    for (const n of asked) for (const [k, v] of Object.entries(c.qs[n][2])) sc[k] += v;
    for (const n of tested) for (const [k, v] of Object.entries(c.tests[n][2])) sc[k] += v;
    return sc;
  },
  // order: cause ids, most likely first. net: true (safe advice), false (unsafe advice) or null (none chosen).
  score(c, asked, tested, order, net) {
    const ev = model.evidence(c, asked, tested); let agree = 0, pairs = 0;
    for (let a = 0; a < order.length; a++) for (let b = a + 1; b < order.length; b++) { pairs++; if (ev[order[a]] - ev[order[b]] >= 0) agree++; }
    const consistent = agree / pairs, has = (list, n) => [...list].includes(n);
    const reds = c.qs.map((q, n) => (q[3] ? n : -1)).filter((n) => n >= 0), redHit = reds.filter((n) => has(asked, n)).length / reds.length;
    const keyOk = has(tested, c.tests.findIndex((x) => x[3] === 'key')) ? 1 : 0;
    const waste = [...tested].filter((n) => c.tests[n][3] === 'low').length;
    const place = order.indexOf(c.truth), top = place === 0 ? 1 : place === 1 ? 0.5 : 0;
    const safety = redHit * 0.4 + keyOk * 0.3 + (net ? 0.3 : 0);
    const score = Math.max(0, consistent * 0.35 + safety * 0.4 + top * 0.15 + ([...asked].length >= 3 ? 0.1 : 0) - waste * 0.05);
    return { ev, consistent, safety, top, waste, score };
  },
  best: (c, ev) => c.dx.map((d) => d[0]).sort((a, b) => ev[b] - ev[a] || (a === c.truth ? -1 : b === c.truth ? 1 : 0)),
};
// Used by the automated tests: evidence totals and scores worked out by hand for both cases.
export function selfTest() {
  const [tom, maya] = CASES, all = [0, 1, 2, 3, 4, 5], near = (a, b) => Math.abs(a - b) < 1e-9;
  const e1 = model.evidence(tom, all, [0, 1, 2]), e2 = model.evidence(maya, all, [0, 1, 2]);
  const full = model.score(tom, all, [0, 1, 2], ['chest', 'cold', 'asthma', 'object'], true);
  const wasteful = model.score(tom, all, [0, 1, 2, 3, 4], ['chest', 'cold', 'asthma', 'object'], true);
  const unsafe = model.score(tom, all, [0, 1, 2], ['chest', 'cold', 'asthma', 'object'], false);
  const upside = model.score(maya, all, [0, 1, 2], ['heart', 'sugar', 'anaemia', 'dehyd'], true);
  const thin = model.score(maya, [0, 3], [], ['dehyd', 'sugar', 'anaemia', 'heart'], true);       // no danger checks, no key test
  const ok = e1.chest === 6 && e1.cold === -2 && e1.asthma === -2 && e1.object === -3 && e2.dehyd === 5 && e2.sugar === -3.5 && e2.anaemia === -1.5 && e2.heart === -4.5
    && near(full.score, 1) && near(wasteful.score, 0.9) && near(unsafe.score, 0.88) && near(unsafe.safety, 0.7)
    && near(upside.consistent, 0) && near(upside.score, 0.5) && upside.score < PASS && near(thin.score, 0.62) && thin.score < PASS
    && model.best(tom, e1)[0] === 'chest' && model.best(maya, e2).join() === 'dehyd,anaemia,sugar,heart';
  return { ok, detail: `Tomas with every question and the three helpful tests: chest ${e1.chest}, cold ${e1.cold}, asthma ${e1.asthma}, object ${e1.object} → score ${full.score.toFixed(2)}; two unneeded tests → ${wasteful.score.toFixed(2)}; unsafe advice → ${unsafe.score.toFixed(2)}; Maya ranked upside down → ${upside.score.toFixed(2)}; skipping the danger checks → ${thin.score.toFixed(2)} (pass mark ${PASS})` };
}

export default {
  id: 'w18-clinical-case',
  world: 18,
  levels: [5, 6],
  title: 'Clinical Reasoning Case',
  goal: 'Ask good questions, choose sensible tests, rank the possible causes, and set a safety net. You are scored on reasoning and safety, not speed.',
  kind: 'validated',
  model: 'Each answer and test result adds or takes away evidence points for four possible causes. The score is 35 % for a ranking that fits the evidence you collected, 40 % for safety (asking the danger-check questions, doing the key test, giving safe advice to the family), 15 % for placing the most likely cause first, 10 % for asking at least three questions, minus 5 % for each unneeded test; 65 % passes. Fictional cases and an educational simulation, never medical advice. Real diagnosis involves many more possibilities, an examination, and a clinician who knows the patient. No treatments or doses are included on purpose.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, T = ctx.t || ((x) => x), level = ctx.level || 5, calm = !!ctx.calm, rng = ctx.rng || Math.random;
    const c = CASES[Math.floor(rng() * CASES.length) % CASES.length];
    const own = [];
    const keep = (x) => { own.push(x); return x; };
    const add = (g, m, x, y, z, parent = group) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    const label = (text, o) => { const s = ctx.sprite(text, o); own.push(s.material.map, s.material); return s; };
    const white = ctx.mat('#ffffff', { roughness: 0.55 }), wood = ctx.mat('#c99a6b'), coral = ctx.mat('#ff8787', { roughness: 0.6 });
    const askM = ctx.lit('#ffd43b', 0.6), testM = ctx.lit('#74c0fc', 0.6), noteQ = ctx.mat('#fff3bf', { roughness: 0.8 }), noteT = ctx.mat('#d0ebff', { roughness: 0.8 });
    const ball = keep(new THREE.SphereGeometry(1, 18, 14));

    // the seated patient (invented), calm and comfortable
    const PX = -2.3, PZ = -0.5;
    add(keep(new THREE.BoxGeometry(0.8, 0.5, 0.8)), white, PX, 0.25, PZ); add(keep(new THREE.BoxGeometry(0.8, 0.9, 0.12)), coral, PX, 0.95, PZ - 0.4);
    const patient = new THREE.Group(); patient.position.set(PX, 0.5, PZ); group.add(patient);
    add(keep(new THREE.CylinderGeometry(0.22, 0.32, 0.9, 14)), ctx.mat('#63e6be', { roughness: 0.7 }), 0, 0.45, 0, patient);
    const head = add(ball, ctx.mat('#ffd9b8', { roughness: 0.7 }), 0, 1.14, 0, patient); head.scale.setScalar(0.27);
    const who = label(c.name, { size: 0.34 }); who.position.set(PX, 0.2, PZ + 1.0); group.add(who);

    // the notes board: every finding becomes a note pinned here
    const BX = -0.1, BY = 2.5, BZ = -2.0;
    add(keep(new THREE.BoxGeometry(2.5, 1.9, 0.1)), wood, BX, BY, BZ); add(keep(new THREE.CylinderGeometry(0.07, 0.07, BY - 0.9, 8)), white, BX, (BY - 0.9) / 2, BZ - 0.05);
    const pin = (n) => [BX - 0.9 + (n % 4) * 0.6, BY + 0.58 - Math.floor(n / 4) * 0.58, BZ + 0.12];

    // six question bubbles float around the patient; five test stations stand along the front
    const tokens = [];
    const token = (kind, n, home, material) => { const m = add(ball, material, ...home); m.scale.setScalar(0.25); const t = { kind, n, m, home, to: null, f: 0, done: false }; tokens.push(t); return t; };
    c.qs.forEach((q, n) => {
      const a = Math.PI * (0.08 + 0.84 * n / 5), t = token('q', n, [PX + 0.25 - Math.cos(a) * 1.05, 2.25 + Math.sin(a) * 1.0, PZ + 0.3 + (n % 2) * 0.25], askM);
      const s = label(String(n + 1), { size: 1.3, color: '#5c3d00' }); s.position.z = 1.05; t.m.add(s);
      ctx.onTap(t.m, () => ask(n));
    });
    const SZ = 1.55, stX = (n) => -2.8 + n * 1.1, standG = keep(new THREE.CylinderGeometry(0.36, 0.42, 0.6, 18));
    c.tests.forEach((x, n) => {
      const stand = add(standG, white, stX(n), 0.3, SZ), t = token('t', n, [stX(n), 0.88, SZ], testM);
      const s = label(T(x[4]), { size: 0.24 }); s.position.set(stX(n), 1.42, SZ); group.add(s);
      ctx.onTap(stand, () => runTest(n)); ctx.onTap(t.m, () => runTest(n));
    });
    const scan = add(keep(new THREE.TorusGeometry(0.4, 0.035, 8, 28)), ctx.lit('#ffffff', 1.3), 0, 0, SZ); scan.rotation.x = Math.PI / 2; scan.visible = false; scan.castShadow = false;

    // the tower of possible causes: the top block is the one the player thinks most likely
    const TX = 2.35, TZ = -1.2, rankY = (i) => 3.55 - i * 0.78;
    add(keep(new THREE.BoxGeometry(2.1, 0.2, 0.9)), white, TX, 0.1, TZ); add(keep(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 8)), white, TX, 0.62, TZ);
    const slabG = keep(new THREE.BoxGeometry(1.7, 0.6, 0.6)), barG = keep(new THREE.BoxGeometry(1, 0.16, 0.16));
    const up = ctx.lit('#51cf66', 0.7), down = ctx.mat('#9aa7c7', { roughness: 0.6 });
    const slabs = {};
    c.dx.forEach(([id, name], i) => {
      const m = add(slabG, ctx.mat(['#b197fc', '#ffc078', '#74c0fc', '#f783ac'][i], { roughness: 0.6 }), TX - 0.2, 1, TZ);
      const s = label(T(name), { size: 0.26 }); s.position.set(0, 0, 0.36); m.add(s);
      const bar = add(barG, down, 0.9, 0, 0, m); bar.visible = false; bar.castShadow = false;
      const halo = ctx.glow('#ffe066', 2.6, 0); m.add(halo);
      slabs[id] = { id, name, m, bar, halo, len: 0, want: 0, bump: 0 };
      ctx.onTap(m, () => { selected = id; mv(order.indexOf(id), -1); });
    });

    // three take-home advice cards: A, B and C match the choices in the panel
    const nets = [[c.net, true], [UNSAFE[0], false], [UNSAFE[1], false]];
    for (let i = nets.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [nets[i], nets[j]] = [nets[j], nets[i]]; }
    const cardG = keep(new THREE.BoxGeometry(0.55, 0.7, 0.08)), cardM = ctx.mat('#e6fcf5', { roughness: 0.7 }), cardOn = ctx.lit('#63e6be', 0.9);
    const cards = nets.map((x, i) => {
      const m = add(cardG, cardM, 0.25 + i * 0.75, 0.75, 0.1); m.rotation.x = -0.25;
      const s = label('ABC'[i], { size: 0.42, color: '#0b5c4a' }); s.position.z = 0.08; m.add(s);
      ctx.onTap(m, () => setNet(i));
      return m;
    });
    add(keep(new THREE.BoxGeometry(2.3, 0.4, 0.5)), white, 1.0, 0.2, 0.05);

    const asked = new Set(), tested = new Set();
    let order = c.dx.map((d) => d[0]), netPick = null, netAt = -1, done = false, selected = order[0], pinned = 0, nod = 0, scanT = 0, scanAt = 0, shown = level <= 5, auto = null, autoT = 0;
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const name = (id) => c.dx.find((d) => d[0] === id)[1];

    const rFind = ui.readout('Findings on the board'), rRank = ui.readout('Your top cause'), rEv = ui.readout('Evidence points'), rFit = ui.readout('Reasoning fit, %'), rSafe = ui.readout('Safety, %'), rScore = ui.readout('Score, %');
    ui.note(c.who);
    ui.note('1. Take a history (ask what you think matters)');
    c.qs.forEach((q, n) => ui.button(`${n + 1}. ${T(q[0])}`, () => ask(n), 'btn ghost sm'));
    ui.note('2. Choose tests (only what helps)');
    c.tests.forEach((x, n) => ui.button(x[0], () => runTest(n), 'btn ghost sm'));
    ui.note('3. Predict: rank the causes, most likely first');
    ui.choice(c.dx.map(([id, text]) => [id, text]), selected, (id) => { selected = id; slabs[id].bump = 0.4; });
    ui.button('Move up', () => mv(order.indexOf(selected), -1), 'btn ghost sm'); ui.button('Move down', () => mv(order.indexOf(selected), 1), 'btn ghost sm');
    ui.note('4. Safety net: what should the family be told?');
    ui.choice(nets.map((x, i) => [i, `${'ABC'[i]}: ${T(x[0])}`]), null, (i) => setNet(i));
    ui.button('Submit my reasoning', () => submit(), 'btn');
    ui.note('Fictional case. An educational simulation, never medical advice.');

    function refresh() {
      const ev = model.evidence(c, asked, tested);
      for (const id of order) { const s = slabs[id]; s.want = Math.abs(ev[id]) * 0.09; s.bar.material = ev[id] > 0 ? up : down; s.bar.visible = shown && ev[id] !== 0; }
      rFind.set(`${asked.size + tested.size} (${asked.size} + ${tested.size})`); rRank.set(T(name(order[0])));
      rEv.set(shown ? order.map((id) => `${T(name(id))} ${ev[id] > 0 ? '+' : ''}${ev[id]}`).join(', ') : T('shown after you submit'));
    }
    function find(t, material) { t.done = true; t.to = pin(pinned++); t.f = 0; t.m.material = material; done = false; }
    function ask(n) {
      if (asked.has(n)) return;
      asked.add(n); find(tokens.find((t) => t.kind === 'q' && t.n === n), noteQ); nod = 1;
      ctx.say(`${c.qs[n][0]} → ${c.qs[n][1]}`); refresh();
    }
    function runTest(n) {
      if (tested.has(n)) return;
      tested.add(n); find(tokens.find((t) => t.kind === 't' && t.n === n), noteT); scanT = 1.2; scanAt = stX(n);
      ctx.say(`${c.tests[n][0]} → ${c.tests[n][1]}`); refresh();
    }
    function mv(i, d) { const j = i + d; if (i < 0 || j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; slabs[order[j]].bump = 0.4; done = false; refresh(); }
    function setNet(i) { netAt = i; netPick = nets[i][1]; done = false; cards.forEach((m, k) => { m.material = k === i ? cardOn : cardM; }); }
    function submit() {
      if (done) return;
      const r = model.score(c, asked, tested, order, netPick);
      shown = true; refresh();
      rFit.set(String(Math.round(r.consistent * 100))); rSafe.set(String(Math.round(r.safety * 100))); rScore.set(String(Math.round(r.score * 100)));
      for (const id of order) slabs[id].glowTo = id === c.truth ? 0.6 : 0;
      ctx.say(`Reasoning fit with your evidence: ${Math.round(r.consistent * 100)}%. Safety: ${Math.round(r.safety * 100)}%. Most likely cause in this case: ${name(c.truth)}.`
        + (r.waste ? ' Unneeded tests cost the patient time and worry.' : '') + (netPick === null ? ' Pick a safety-net plan.' : netPick ? '' : ' That safety-net advice is unsafe.')
        + ' Good reasoning follows the evidence you collected, checks the dangerous possibilities, and tells the family what to watch for.');
      if (netPick !== null && r.score >= PASS) { done = true; ctx.complete(Math.min(1, r.score), 'Reasoned from evidence and kept the patient safe.'); }
    }
    refresh();
    ctx.say(`${c.who} Ask the numbered questions, choose only the tests that help, put the causes in order, pick the safe advice, then submit.`);

    return {
      step(dt) {
        if (!auto) return;
        autoT -= dt; if (autoT > 0) return;
        autoT = 0.45; const job = auto.shift(); if (job) job(); else auto = null;
      },
      frame(dt, time) {
        for (const t of tokens) {
          if (t.to) {
            t.f = Math.min(1, t.f + dt * 1.4); const e = t.f * t.f * (3 - 2 * t.f), lift = Math.sin(e * Math.PI) * 0.6;
            t.m.position.set(t.home[0] + (t.to[0] - t.home[0]) * e, t.home[1] + (t.to[1] - t.home[1]) * e + lift, t.home[2] + (t.to[2] - t.home[2]) * e);
            t.m.scale.set(0.25, 0.25 - 0.05 * e, 0.25 - 0.2 * e);                          // the bubble flattens into a note
          } else if (t.kind === 'q') t.m.position.y = t.home[1] + (calm ? 0 : Math.sin(time * 1.3 + t.n) * 0.06);
          else t.m.rotation.y += dt * (calm ? 0.2 : 0.8);
        }
        order.forEach((id, i) => {
          const s = slabs[id]; s.bump = Math.max(0, s.bump - dt);
          s.m.position.y += (rankY(i) - s.m.position.y) * Math.min(1, dt * 7); s.m.position.z = TZ + Math.sin(s.bump / 0.4 * Math.PI) * 0.35;
          s.m.position.x = TX - 0.2 + (id === selected && !done ? 0.08 : 0);
          s.len += (s.want - s.len) * Math.min(1, dt * 5); s.bar.scale.x = Math.max(0.01, s.len); s.bar.position.x = 0.87 + s.len / 2;
          s.halo.material.opacity += ((s.glowTo || 0) - s.halo.material.opacity) * Math.min(1, dt * 3);
        });
        nod = Math.max(0, nod - dt); head.position.y = 1.14 - Math.sin(nod * Math.PI * 2) * 0.04 * (nod > 0 ? 1 : 0);
        patient.scale.y = 1 + (calm ? 0 : Math.sin(time * 1.6) * 0.012);
        scanT = Math.max(0, scanT - dt); scan.visible = scanT > 0; if (scan.visible) scan.position.set(scanAt, 0.75 + Math.abs(Math.sin(scanT * 5)) * 0.55, SZ);
        cards.forEach((m, k) => { m.position.y += ((k === netAt ? 1.0 : 0.75) - m.position.y) * Math.min(1, dt * 6); });
      },
      // Asks every question, runs the helpful tests, orders the causes by the evidence, picks the safe advice and submits,
      // all through the same functions the player's taps and buttons call (used by tests).
      autoplay() {
        auto = [...c.qs.map((q, n) => () => ask(n)), ...c.tests.map((x, n) => (x[3] === 'low' ? null : () => runTest(n))).filter(Boolean)];
        auto.push(() => {
          const want = model.best(c, model.evidence(c, asked, tested));
          want.forEach((id, i) => { for (let at = order.indexOf(id); at > i; at--) mv(at, -1); });
        }, () => setNet(nets.findIndex((x) => x[1])), () => submit());
        autoT = 0.2;
      },
      dispose() { for (const x of own) x.dispose?.(); },
      get state() { return done ? 'done' : 'open'; },
    };
  },
};
