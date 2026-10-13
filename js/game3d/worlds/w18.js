// World 18 — Medicine: the Sunny Teaching Hospital.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: how much blood the heart moves each minute, and how much oxygen that carries to the body -----
// Typical textbook values for a healthy adult of 30. `need` is the oxygen the body uses (mL each minute),
// `extract` is the oxygen the body takes out of each litre of blood (mL), `svMax` the largest beat this heart can give (mL).
const AGE = 30;
export const model = {
  AGE,
  cases: {
    rest: { label: 'Resting', need: 250, extract: 50, svMax: 120 },
    walk: { label: 'Walking', need: 800, extract: 80, svMax: 120 },
    run: { label: 'Running', need: 2400, extract: 140, svMax: 120 },
    athlete: { label: 'Athlete running', need: 2400, extract: 140, svMax: 170, rateCap: 130 },
  },
  maxRate: (age) => 220 - age,                                             // a rough guide, beats per minute
  output: (rate, stroke) => rate * stroke / 1000,                          // cardiac output, litres per minute
  delivery: (rate, stroke, extract) => rate * stroke / 1000 * extract,     // oxygen delivered, mL per minute
  error: (delivered, need) => (delivered - need) / need,
  matches: (delivered, need, tol) => Math.abs(delivered - need) <= need * tol + 1e-9,
  tolerance: (level) => (level <= 2 ? 0.15 : level <= 4 ? 0.08 : 0.05),
  // The whole-number heart rate that comes closest to the need with this stroke volume.
  rateFor: (c, stroke) => Math.round(c.need / c.extract * 1000 / stroke),
  // 0…100: high when delivery matches need and the heart is not racing near its limit.
  comfort(rate, stroke, c) {
    const off = Math.abs(model.error(model.delivery(rate, stroke, c.extract), c.need)), top = model.maxRate(AGE);
    return Math.max(0, Math.round(100 - Math.min(80, off * 250) - Math.max(0, (rate - 0.85 * top) / (0.15 * top)) * 30));
  },
};
// Used by the automated tests: the arithmetic of the model and its tolerance check.
export function selfTest() {
  const c = model.cases, co = model.output(70, 70), d = model.delivery(70, 70, c.rest.extract);
  const runRate = model.rateFor(c.run, 120), runD = model.delivery(runRate, 120, c.run.extract);
  const athRate = model.rateFor(c.athlete, 160), athD = model.delivery(athRate, 160, c.athlete.extract);
  const ok = Math.abs(co - 4.9) < 1e-9 && Math.abs(d - 245) < 1e-9
    && model.matches(d, 250, 0.05) && !model.matches(d, 250, 0.01) && !model.matches(180, 250, 0.15)
    && model.maxRate(AGE) === 190 && runRate === 143 && model.matches(runD, 2400, 0.05) && runRate < model.maxRate(AGE)
    && athRate === 107 && athRate <= c.athlete.rateCap && runRate > c.athlete.rateCap && model.matches(athD, 2400, 0.05);
  return { ok, detail: `70 beats/min × 70 mL = ${co.toFixed(1)} L/min → ${d.toFixed(0)} mL O₂/min (need 250: within 5 %, not within 1 %); running ${runRate} × 120 mL → ${runD.toFixed(0)} mL/min; athlete ${athRate} × 160 mL → ${athD.toFixed(0)} mL/min; guide maximum ${model.maxRate(AGE)}` };
}

const sim = {
  title: 'The beating heart',
  goal: 'Choose an activity, then set how fast the heart beats and how much blood each beat pushes. Make the oxygen delivered match the oxygen the body needs, without going over the highest heart rate.',
  kind: 'simplified',
  model: 'Cardiac output = heart rate × stroke volume (70 beats a minute × 70 mL = 4.9 litres a minute). Oxygen delivered = cardiac output × the oxygen the body takes from each litre of blood. It uses typical textbook adult values: about 50 mL of oxygen per litre at rest, 80 when walking and 140 when running; needs of about 250, 800 and 2,400 mL a minute; and a highest heart rate of roughly 220 minus age (190 for a 30-year-old), which is only a rough guide. Real bodies vary a lot and adjust many things at once: breathing, blood vessels, blood pressure and how the blood is shared out, none of which are shown here. It is for learning how the heart works, not for judging anyone\'s health.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, level = ctx.level || 1, C = model.cases, TOP = model.maxRate(AGE), tol = model.tolerance(level);
    const required = level <= 2 ? ['rest'] : level <= 4 ? ['rest', 'walk', 'run'] : ['rest', 'walk', 'run', 'athlete'];
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const blue = ctx.lit('#4c8dff', 1.1), red = ctx.lit('#ff5a5a', 1.1), white = ctx.mat('#ffffff', { roughness: 0.5 });
    const HY = 2.6;
    // the stand and the four chambers (the heart's right side is on the viewer's left, as in a textbook picture)
    add(new THREE.CylinderGeometry(0.55, 0.85, 0.9, 20), white, 0, 0.45, 0); add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), white, 0, 1.15, 0);
    const sphere = new THREE.SphereGeometry(1, 24, 16);
    const chamber = (x, y, r, sy, material) => { const m = add(sphere, material, x, HY + y, 0); m.userData.s = [r, r * sy, r * 0.85]; m.scale.set(r, r * sy, r * 0.85); return m; };
    const softBlue = ctx.mat('#7aa7ff', { roughness: 0.45 }), softRed = ctx.mat('#ff7b7b', { roughness: 0.45 });
    const atria = [chamber(-0.4, 0.5, 0.36, 1, softBlue), chamber(0.4, 0.5, 0.36, 1, softRed)];
    const ventricles = [chamber(-0.33, -0.3, 0.48, 1.3, softBlue), chamber(0.36, -0.36, 0.55, 1.35, softRed)];
    // two glowing loops: left to the lungs, right to the body
    const tubeM = ctx.mat('#ffe3e3', { transparent: true, opacity: 0.5, roughness: 0.3 }), RX = 1.3, RY = 1.05, CX = 1.85;
    for (const sx of [-1, 1]) { const tube = add(new THREE.TorusGeometry(1, 0.06, 8, 56), tubeM, sx * CX, HY, -0.1); tube.scale.set(RX, RY, 1); }
    const lungs = [-3.2, -2.62].map((x) => { const l = add(sphere, ctx.mat('#ffb3c1', { roughness: 0.6 }), x, HY, 0.2); l.scale.set(0.27, 0.5, 0.24); return l; });
    const torso = add(new THREE.CapsuleGeometry(0.26, 0.5, 4, 12), ctx.mat('#63e6be', { roughness: 0.6 }), 2.95, HY - 0.15, 0.2);
    add(new THREE.SphereGeometry(0.22, 16, 12), ctx.mat('#63e6be', { roughness: 0.6 }), 0, 0.72, 0, torso);
    for (const [text, x] of [['Lungs', -2.9], ['Heart', 0], ['Body', 2.95]]) { const s = ctx.sprite(text, { size: 0.5 }); s.position.set(x, 4.35, 0); group.add(s); }
    const dotGeo = new THREE.SphereGeometry(0.085, 10, 8), N = 9;
    const dots = [-1, 1].flatMap((sx) => Array.from({ length: N }, (_, i) => ({ sx, u: i / N, m: add(dotGeo, blue, 0, 0, 0) })));
    // two bars at the front: the oxygen the body needs (white) and the oxygen delivered (colour)
    const barGeo = new THREE.BoxGeometry(1, 0.16, 0.16), calmGreen = ctx.lit('#51cf66', 0.7), amber = ctx.lit('#ffc94d', 0.7);
    const needBar = add(barGeo, white, 0, 0.78, 1.5), gotBar = add(barGeo, amber, 0, 0.52, 1.5);
    const lamp = add(new THREE.SphereGeometry(0.2, 16, 12), amber, 0, 3.85, 0), halo = ctx.glow('#ffffff', 1.2, 0.5); lamp.add(halo);
    const bar = (m, value) => { const w = Math.max(0.05, Math.min(6.4, value / 1000 * 2.2)); m.scale.x = w; m.position.x = -3.2 + w / 2; };

    let key = 'rest', rate = 60, stroke = 60, state = 'idle', testT = 0, tries = 0, auto = false, phase = 0, clock = 0, finished = false;
    const done = new Set();
    const rateS = ui.slider({ label: 'Heart rate', min: 40, max: 200, step: 1, value: rate, unit: 'beats/min', onInput: (v) => { rate = v; refresh(); } });
    const strokeS = ui.slider({ label: 'Stroke volume (blood pushed by each beat)', min: 40, max: 170, step: 1, value: stroke, unit: 'mL', onInput: (v) => { stroke = Math.min(v, C[key].svMax); if (v > stroke) { strokeS.set(stroke); ctx.say(`This heart can push at most ${C[key].svMax} mL with each beat. To move more blood it has to beat faster.`); } refresh(); } });
    const options = [['rest', '🧍 Resting'], ['walk', '🚶 Walking'], ['run', '🏃 Running']]; if (level >= 5) options.push(['athlete', '🏅 Athlete running']);
    const pick = ui.choice(options, key, (v) => choose(v, true));
    const rOut = ui.readout('Cardiac output, L/min'), rGot = ui.readout('Oxygen delivered, mL/min'), rNeed = ui.readout('Oxygen needed, mL/min'), rComfort = ui.readout('Comfort'), rTop = ui.readout('Highest heart rate, beats/min'), rDone = ui.readout('Activities matched');
    const cap = () => Math.min(TOP, C[key].rateCap || TOP);
    function refresh() {
      const c = C[key], got = model.delivery(rate, stroke, c.extract), comfort = model.comfort(rate, stroke, c), good = model.matches(got, c.need, tol) && rate <= cap();
      rOut.set(model.output(rate, stroke).toFixed(1)); rGot.set(Math.round(got)); rNeed.set(`${c.need} (±${Math.round(tol * 100)} %)`);
      rComfort.set(`${comfort} %`); rTop.set(cap()); rDone.set(`${required.filter((r) => done.has(r)).length} / ${required.length}`);
      bar(needBar, c.need); bar(gotBar, got);
      gotBar.material = lamp.material = good ? calmGreen : rate > cap() ? red : amber;
    }
    function choose(v, byPlayer) {
      if (!C[v]) return;
      key = v; const c = C[key];
      if (stroke > c.svMax) { stroke = c.svMax; strokeS.set(stroke); }
      refresh();
      if (byPlayer) ctx.say(key === 'athlete' ? `An athlete's heart is a well-trained muscle: it can push up to ${c.svMax} mL with each beat. Deliver ${c.need} mL of oxygen a minute while staying at or below ${c.rateCap} beats a minute.` : `${c.label}: the body needs about ${c.need} mL of oxygen a minute and takes about ${c.extract} mL from each litre of blood. That is ${(c.need / c.extract).toFixed(1)} litres of blood a minute.`);
    }
    const check = () => { if (state === 'test') return; state = 'test'; testT = 0; tries++; ctx.say('Listening to the heart for a few beats…'); };
    ui.button('🩺 Check the match', check, 'btn');
    ui.note(required.length === 1 ? 'Goal: match the resting body. The white bar is the oxygen the body needs; the coloured bar is the oxygen the heart delivers. Cardiac output = heart rate × stroke volume.' : `Goal: match ${required.length} activities, one after another${level >= 5 ? ', ending with the athlete\'s heart' : ''}. The white bar is the oxygen the body needs; the coloured bar is the oxygen the heart delivers.`);
    refresh();
    ctx.say('Blue dots carry little oxygen to the lungs; red dots carry fresh oxygen to the body. Set the two sliders, then check the match.');

    const judge = () => {
      state = 'idle';
      const c = C[key], got = model.delivery(rate, stroke, c.extract), err = model.error(got, c.need), out = model.output(rate, stroke).toFixed(1);
      if (rate > TOP) { ctx.say(`${rate} beats a minute is above the rough guide of ${TOP} (220 minus age). A heart that races has too little time to fill between beats. Try a bigger stroke volume and a slower rate.`); return; }
      if (c.rateCap && rate > c.rateCap) { ctx.say(`This works, but the athlete's bigger beat lets the heart go slower. Raise the stroke volume and bring the rate to ${c.rateCap} or below.`); return; }
      if (!model.matches(got, c.need, tol)) {
        ctx.say(err < 0 ? `${out} litres a minute carries ${Math.round(got)} mL of oxygen, but the body needs ${c.need}. The muscles would run short. Raise the heart rate or the stroke volume.` : `${out} litres a minute carries ${Math.round(got)} mL of oxygen, more than the ${c.need} needed. The heart is working harder than it has to. Ease the rate or the stroke volume down.`);
        return;
      }
      done.add(key); refresh();
      const left = required.filter((r) => !done.has(r));
      const why = key === 'rest' ? `At rest ${rate} beats × ${stroke} mL = ${out} litres a minute is enough: a quiet body uses little oxygen.`
        : key === 'walk' ? `Walking muscles use about three times more oxygen than resting ones, so the heart moves ${out} litres a minute and the muscles take more oxygen from each litre.`
          : key === 'run' ? `Running muscles use almost ten times more oxygen than at rest. Each beat can only grow a little (to about ${c.svMax} mL), so the heart has to beat faster: ${rate} beats a minute moves ${out} litres. That is why your heart speeds up when you run.`
            : `The athlete's heart pushes ${stroke} mL with each beat, so only ${rate} beats a minute are needed for the same run. Training makes the heart muscle stronger, so it can beat more slowly.`;
      if (!required.includes(key)) { ctx.say(`${why} Well matched! The goal on this level is the resting body.`); return; }
      if (left.length) { ctx.say(`${why} Matched! Next activity: ${C[left[0]].label.toLowerCase()}.`); if (auto) play(); return; }
      ctx.say(`${why} Every activity is matched!`);
      if (!finished) { finished = true; ctx.complete(tries <= required.length + 2 ? 1 : tries <= required.length * 3 ? 0.85 : 0.7, `cases=${required.length}, tries=${tries}, tol=${tol}`); }
    };
    // Sets a matching choice for the next unmatched activity and checks it.
    const play = () => {
      const next = required.find((r) => !done.has(r)); if (!next) return;
      pick.set?.(next); choose(next, false);
      const c = C[next]; stroke = { rest: 70, walk: 100, run: 120, athlete: 160 }[next]; rate = model.rateFor(c, stroke);
      strokeS.set(stroke); rateS.set(rate); refresh(); check();
    };
    return {
      step(dt) { if (state !== 'test') return; testT += dt; if (testT >= 2.4) judge(); },
      frame(dt) {
        const slow = ctx.calm ? 0.5 : 1, amp = ctx.calm ? 0.04 : 0.11 * Math.min(1.3, 0.6 + stroke / 150);
        phase = (phase + dt * rate / 60 * slow) % 1;
        // the two top chambers squeeze first, then the two bottom ones
        const a = Math.max(0, Math.sin(Math.PI * phase / 0.2)) * (phase < 0.2 ? 1 : 0), v = phase >= 0.2 && phase < 0.6 ? Math.sin(Math.PI * (phase - 0.2) / 0.4) : 0;
        for (const m of atria) m.scale.set(...m.userData.s.map((s) => s * (1 - amp * 0.8 * a)));
        for (const m of ventricles) m.scale.set(...m.userData.s.map((s) => s * (1 - amp * v)));
        const flow = model.output(rate, stroke) / 26 * slow;
        for (const d of dots) {
          d.u = (d.u + dt * flow) % 1; const ang = d.u * Math.PI * 2;
          d.m.position.set(d.sx * (CX - RX * Math.cos(ang)), HY - RY * Math.sin(ang), -0.1);
          d.m.material = (d.sx < 0) === (d.u < 0.5) ? blue : red;             // to the lungs blue, back red; to the body red, back blue
        }
        clock += dt * slow;
        const breath = 1 + 0.1 * Math.sin(clock * (key === 'rest' ? 1.4 : key === 'walk' ? 2.4 : 3.6));     // breathing quickens too
        for (const l of lungs) l.scale.set(0.27 * breath, 0.5 * breath, 0.24);
        torso.position.y = HY - 0.15 + Math.abs(Math.sin(clock * (key === 'walk' ? 4 : 7))) * (key === 'rest' ? 0 : key === 'walk' ? 0.05 : 0.12);
      },
      // Shows a successful run without the player (used by tests).
      autoplay() { auto = true; play(); },
      get state() { return state; },
    };
  },
};

export default {
  id: 18,
  theme: {
    sky: ['#7cc4f8', '#cfeaff', '#fff3ea'], fog: '#e2f2ff', fogNear: 60, fogFar: 190,
    ground: '#9fe3c0', ground2: '#bdf0d6', side: '#f0c9b8', stone: '#fbfbf8', accent: '#ff8787', glow: '#ff6b6b', metal: '#8ea3b5', wood: '#c99a6b', leaf: '#51cf66', water: '#74c0fc', crate: '#fff0e6',
    sun: '#fff7e0', sunPower: 2.5, ambient: 1.5, skyLight: '#ffffff', groundLight: '#bfe8d2', sunDir: [-0.4, 1, 0.35], particles: 'leaves',
  },
  layout: { shape: 'zigzag', mirror: -1, stones: 3, rise: 0.35, towerH: 4.5 },
  story: {
    title: 'The Sunny Teaching Hospital',
    crystal: 'heart badges', crystalEm: '❤️',
    intro: ['Welcome to the Sunny Teaching Hospital! Tomorrow is open day, and families are coming to see how doctors learn.', 'A playful breeze blew our five heart badges off the welcome board and across the garden islands. And the big beating-heart model in the teaching room still needs setting up.'],
    remind: 'The heart badges glow red. One floats over the stepping stones, one in the lagoon, and one on top of the white tower.',
    afterCrystals: 'All five heart badges! Now ride the lift from the tower to the teaching console and set up the beating-heart model.',
    afterSim: 'The heart model beats just right. Only the Head of the Hospital is left to meet — the quiz garden is up the steps.',
    notReady: 'The quiz garden is for young doctors who have done the work. Bring all five heart badges and set up the heart model first.',
    rival: ['So you set up our heart model. Good hands! Now let us see what you know.', 'We each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge is finished before mine. Careful thinking and a kind heart — the portal is yours, young doctor.'],
    lose: ['My bridge is finished and yours is not. Read the tablets once more, then come back and try me again.'],
    outro: 'The welcome board shines with five heart badges, the heart model beats in time, and the Head of the Hospital is smiling. Open day is ready, and so is your lesson.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, m = S.sim[0] < 0 ? -1 : 1;
    const part = (x, y, z, yaw = 0, s = 1) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s); return k.add(g); };
    const white = k.mat('#ffffff', { roughness: 0.55 }), coral = k.mat('#ff8787', { roughness: 0.6 }), steel = k.mat('#c5d0da', { metalness: 0.6, roughness: 0.3 }), wood = k.mat('#c99a6b');
    // the teaching hospital on the home island, with a gentle ramp to its door and a "care" sign
    const hx = 5.6 * m, hz = -6, hyaw = Math.atan2(-hx, -hz);
    k.prop('house', hx, 0, hz, { s: 1.3, yaw: hyaw, color: '#ffffff', solid: true });
    const door = part(hx, 0, hz, hyaw);
    k.mesh(new THREE.BoxGeometry(1.0, 0.08, 1.9), coral, 0, 0.13, 2.26, door).rotation.x = 0.12;
    k.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), steel, 0.55, 0.78, 2.26, door).rotation.x = Math.PI / 2 + 0.12;
    k.sign('❤️', hx, 4.9, hz, { size: 1.3, label: 'We care' });
    // a big friendly heart that beats
    const heart = part(-7.4 * m, 1.95, 0.2, -Math.PI / 2 * m), heartM = k.lit('#ff6b6b', 0.3);
    k.mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.5, 18), white, -7.4 * m, 0.25, 0.2);
    for (const sx of [-0.4, 0.4]) k.mesh(new THREE.SphereGeometry(0.6, 20, 14), heartM, sx, 0.3, 0, heart);
    const tip = k.mesh(new THREE.ConeGeometry(0.97, 1.45, 20), heartM, 0, -0.62, 0, heart); tip.rotation.x = Math.PI; tip.scale.z = 0.62;
    k.animate((dt, t) => { const b = (t * 1.1) % 1, s = 1 + 0.07 * (b < 0.15 ? Math.sin(b / 0.15 * Math.PI) : b > 0.25 && b < 0.45 ? 0.7 * Math.sin((b - 0.25) / 0.2 * Math.PI) : 0); heart.scale.setScalar(s); });
    // a bench, flower beds and bushes
    const bench = (x, y, z, yaw) => { const g = part(x, y, z, yaw); k.mesh(new THREE.BoxGeometry(1.6, 0.45, 0.5), white, 0, 0.225, 0, g); k.mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), wood, 0, 0.72, -0.24, g); };
    bench(-7.6 * m, 0, -2.6, Math.PI / 2 * m);
    for (const [x, z, c] of [[-6.2 * m, 2.1, '#ffd43b'], [-8.3 * m, -1.1, '#ff8787'], [2.6 * m, -7.4, '#ffffff'], [7.6 * m, -3.2, '#ffd43b']]) k.prop('flower', x, 0, z, { s: 1.5, color: c });
    k.prop('bush', 7.9 * m, 0, 2.6, { s: 1.1 }); k.prop('bush', -3.6 * m, 0, 7.9);
    // the middle island: a stethoscope sculpture, a microscope and a second bench
    const mid = S.mid, st = part(4.0 * m, mid[1], mid[2] - 3.4, 0.5 * m);
    k.mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.25, 16), white, 0, 0.125, 0, st);
    k.mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 24, Math.PI), k.mat('#4a5568', { roughness: 0.5 }), 0, 2.7, 0, st).rotation.z = Math.PI;
    for (const sx of [-0.6, 0.6]) k.mesh(new THREE.SphereGeometry(0.11, 10, 8), coral, sx, 2.76, 0, st);
    k.mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), k.mat('#4a5568', { roughness: 0.5 }), 0, 1.5, 0, st);
    k.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 20), steel, 0, 0.72, 0.03, st).rotation.x = Math.PI / 2;
    const sc = part(-2.2 * m, mid[1], mid[2] + 5.2, 2.6 * m, 1.5);
    k.mesh(new THREE.BoxGeometry(0.9, 0.15, 0.7), white, 0, 0.075, 0, sc);
    k.mesh(new THREE.BoxGeometry(0.16, 1.25, 0.16), white, 0, 0.72, -0.24, sc).rotation.x = 0.12;
    k.mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.8, 12), steel, 0, 1.15, 0.02, sc).rotation.x = 0.3;
    k.mesh(new THREE.BoxGeometry(0.6, 0.06, 0.5), coral, 0, 0.55, 0.12, sc);
    k.mesh(new THREE.SphereGeometry(0.08, 10, 8), k.lit('#ffe066', 1.2), 0, 0.64, 0.14, sc).castShadow = false;
    bench(-5.0 * m, mid[1], mid[2] + 0.6, Math.PI / 2 * m);
    // the far island: a giant model of the lungs that breathes in and out
    const lg = part(-4.5 * m, S.far[1], S.far[2] - 2.2, 0.6 * m), pink = k.mat('#ffa8a8', { roughness: 0.65 });
    k.mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.4, 18), white, 0, 0.2, 0, lg);
    k.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), white, 0, 2.0, 0, lg);
    const lobes = [-0.5, 0.5].map((sx) => k.mesh(new THREE.SphereGeometry(0.55, 18, 14), pink, sx, 1.25, 0, lg));
    k.animate((dt, t) => { const b = 1 + 0.1 * Math.sin(t * 1.3); for (const l of lobes) l.scale.set(0.78 * b, 1.2 * (1 + 0.04 * Math.sin(t * 1.3)), 0.62 * b); });
    // a helipad circle painted on top of the tower
    const tx = 0, ty = S.sim[1], tz = S.far[2] + 3.2, flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; mesh.castShadow = false; return mesh; };
    flat(k.mesh(new THREE.CircleGeometry(1.9, 40), k.mat('#ffc9c9', { roughness: 0.9 }), tx, ty + 0.015, tz));
    flat(k.mesh(new THREE.RingGeometry(1.5, 1.72, 40), white, tx, ty + 0.03, tz));
    for (const [x, w, d] of [[-0.45, 0.22, 1.4], [0.45, 0.22, 1.4], [0, 0.9, 0.22]]) k.mesh(new THREE.BoxGeometry(w, 0.02, d), white, tx + x, ty + 0.04, tz).castShadow = false;
    // the simulation island: a hand-washing station with bubbles, and a little helper cart with a soft light
    const sx0 = S.sim[0], sy0 = S.sim[1], sz0 = S.sim[2];
    const wash = part(sx0 + 3.6 * m, sy0, sz0 - 5.4, 0);
    k.mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.8, 10), white, 0, 0.4, 0, wash);
    k.mesh(new THREE.CylinderGeometry(0.5, 0.32, 0.36, 18), white, 0, 0.96, 0, wash);
    k.mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 14, Math.PI), steel, 0, 1.14, -0.34, wash).rotation.y = Math.PI / 2;
    const soap = k.mat('#e7f5ff', { transparent: true, opacity: 0.6, roughness: 0.1 });
    const bubbles = [0, 1, 2, 3].map((i) => { const b = k.mesh(new THREE.SphereGeometry(0.09 + i * 0.025, 12, 8), soap, 0, 1.2, 0, wash); b.castShadow = false; return b; });
    k.animate((dt, t) => { bubbles.forEach((b, i) => { const f = (t * 0.22 + i * 0.25) % 1; b.position.set(Math.sin(t * 1.1 + i * 2) * 0.25, 1.15 + f * 1.7, Math.cos(t * 0.9 + i) * 0.2); b.scale.setScalar(0.4 + f * 0.9); }); });
    k.sign('🫧', sx0 + 3.6 * m, sy0 + 3.5, sz0 - 5.4, { size: 0.8, label: 'Wash your hands' });
    const cart = part(sx0 - 3.8 * m, sy0, sz0 - 5.5, 0.35 * m);
    k.mesh(new THREE.BoxGeometry(1.9, 0.8, 1.0), white, 0, 0.78, 0, cart);
    k.mesh(new THREE.BoxGeometry(0.8, 0.45, 0.9), coral, 0.42, 1.4, 0, cart);
    for (const ax of [-0.6, 0.6]) k.mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.14, 14), k.mat('#4a5568', { roughness: 0.5 }), ax, 0.3, 0, cart).rotation.x = Math.PI / 2;
    const light = k.mesh(new THREE.SphereGeometry(0.14, 12, 8), k.lit('#ffe066', 1.2), -0.45, 1.32, 0, cart); light.castShadow = false;
    const soft = k.glow('#ffe9a8', 1.6, 0.5); light.add(soft);
    k.animate((dt, t) => { soft.material.opacity = 0.4 + 0.15 * Math.sin(t * 0.9); });
    // warm lamps beside the quiz garden
    for (const a of [2.6, 0.55]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6.2, S.arena[1], S.arena[2] + Math.sin(a) * 6.2, { color: '#fff3bf' });
  },
  sim,
};
