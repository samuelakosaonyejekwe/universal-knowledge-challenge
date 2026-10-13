// 3D lab — Colour Mixer: three lamps shine on a white ball, or three ink tanks pour into a glass mixing jar.
// No imports: everything arrives through ctx, so the model can be checked by tools/test-game3d.mjs without a browser.

// ----- the model (the same as the 2D lab) -----
// Additive (light): start from black and add red, green and blue light.           R = r, G = g, B = b
// Subtractive (ink): start from white paper; each ink removes one colour.          R = 1 − c, G = 1 − m, B = 1 − y
export const MODES = {
  add: { names: ['Red light', 'Green light', 'Blue light'], hues: ['#ff0000', '#00ff00', '#0000ff'], toRGB: (v) => v.map((x) => x / 100) },
  sub: { names: ['Cyan ink', 'Magenta ink', 'Yellow ink'], hues: ['#00b7eb', '#ff00a8', '#ffe600'], toRGB: (v) => v.map((x) => 1 - x / 100) },
};
const QUIZ = {
  add: [[[0, 1], 'yellow'], [[1, 2], 'cyan'], [[0, 2], 'magenta']],
  sub: [[[0, 1], 'blue'], [[1, 2], 'red'], [[0, 2], 'green']],
};
const NAMED = { yellow: [1, 1, 0], cyan: [0, 1, 1], magenta: [1, 0, 1], red: [1, 0, 0], green: [0, 1, 0], blue: [0, 0, 1] };
const pairRGB = (mode, pair) => MODES[mode].toRGB([0, 1, 2].map((i) => (pair.includes(i) ? 100 : 0)));
// The largest gap in any one of red, green and blue, in percentage points, and which channel it is.
export const gap = (mine, target) => { const diff = mine.map((x, i) => Math.round((x - target[i]) * 100)), worst = Math.max(...diff.map(Math.abs)); return { diff, worst, channel: diff.map(Math.abs).indexOf(worst) }; };

export function selfTest() {
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-12);
  const rg = MODES.add.toRGB([100, 100, 0]), all = MODES.add.toRGB([100, 100, 100]), cy = MODES.sub.toRGB([100, 0, 100]), cmy = MODES.sub.toRGB([100, 100, 100]), part = MODES.sub.toRGB([50, 25, 0]);
  const quizOk = ['add', 'sub'].every((m) => QUIZ[m].every(([pair, name]) => same(pairRGB(m, pair), NAMED[name])));
  const g = gap([0.5, 0.75, 1], [0.5, 0.5, 1]);
  const ok = same(rg, [1, 1, 0]) && same(all, [1, 1, 1]) && same(cy, [0, 1, 0]) && same(cmy, [0, 0, 0]) && same(part, [0.5, 0.75, 1]) && quizOk && g.worst === 25 && g.channel === 1;
  return { ok, detail: `red+green light = ${rg.join(',')}, all lights = ${all.join(',')}, cyan+yellow ink = ${cy.join(',')}, all inks = ${cmy.join(',')}, 50 % cyan + 25 % magenta = ${part.join(',')}, six two-colour predictions ${quizOk ? 'agree' : 'disagree'}, gap ${g.worst} points in channel ${g.channel}` };
}

export default {
  id: 'w15-mix',
  world: 15,
  levels: [3, 4],
  title: 'Colour Mixer',
  goal: 'Mix three lights, or three inks, until your colour matches the target.',
  kind: 'validated',
  model: 'Ideal lights and ideal inks. Light adds: red, green and blue light are added up, so all three make white. Ink takes away: each ink removes exactly one of red, green or blue from white (red = 100 % − cyan, green = 100 % − magenta, blue = 100 % − yellow), so all three make black. Real pigments are muddier (which is why printers add black), percentages here are screen values rather than measured light, and screens differ from one another.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, lvl = (ctx.level || 3) <= 3 ? 3 : 4, own = [];
    const keep = (x) => { own.push(x); return x; };
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(keep(geo), material); m.position.set(x, y, z); parent.add(m); return m; };
    const paint = (color, c) => color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    const metal = ctx.mat('#8d7aa8', { metalness: 0.4, roughness: 0.4 }), dark = ctx.mat('#2a2440', { roughness: 0.8 }), white = ctx.mat('#ffffff', { roughness: 0.6 });
    const glass = keep(new THREE.MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));

    // ---- the light rig: a white ball on a dark plinth and three lamps on stands around it ----
    const lightRig = new THREE.Group(); group.add(lightRig);
    add(new THREE.CylinderGeometry(0.8, 0.95, 0.9, 24), dark, 0, 0.45, 0, lightRig);
    const ballMat = keep(new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const ball = add(new THREE.SphereGeometry(0.75, 32, 22), ballMat, 0, 1.65, 0, lightRig);
    const lamps = [[-2.1, 0.9], [0, 2.0], [2.1, 0.9]].map(([x, z], i) => {
      const hex = MODES.add.hues[i], head = new THREE.Vector3(x, 3.9, z), aim = new THREE.Vector3(0, 1.65, 0);
      add(new THREE.CylinderGeometry(0.05, 0.08, 3.9, 8), metal, x, 1.95, z, lightRig);
      add(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 14), metal, x, 0.05, z, lightRig);
      const lensMat = keep(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: hex, emissiveIntensity: 0, roughness: 0.3 }));
      const lens = add(new THREE.SphereGeometry(0.24, 16, 12), lensMat, head.x, head.y, head.z, lightRig);
      // the beam: a see-through cone from the lamp (tip) to the ball (wide end)
      const len = head.distanceTo(aim), beamMat = keep(new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      const beam = add(new THREE.ConeGeometry(0.7, len, 20, 1, true), beamMat, 0, 0, 0, lightRig);
      beam.position.copy(head).lerp(aim, 0.5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), head.clone().sub(aim).normalize()); beam.castShadow = false;
      return { lensMat, beamMat, lens };
    });

    // ---- the ink rig: three tanks on a rail pour into a glass jar of white liquid ----
    const inkRig = new THREE.Group(); group.add(inkRig);
    add(new THREE.CylinderGeometry(1.0, 1.1, 0.3, 28), metal, 0, 0.15, 0, inkRig);
    add(new THREE.CylinderGeometry(0.95, 0.95, 1.9, 28, 1, true), glass, 0, 1.25, 0, inkRig).castShadow = false;
    const liquidMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }));
    const liquid = add(new THREE.CylinderGeometry(0.9, 0.9, 1, 28), liquidMat, 0, 0.8, 0, inkRig);
    const paddle = add(new THREE.BoxGeometry(1.3, 0.12, 0.12), white, 0, 1.5, 0, inkRig);
    add(new THREE.BoxGeometry(5.4, 0.12, 0.12), metal, 0, 4.75, 0, inkRig);
    for (const sx of [-2.65, 2.65]) add(new THREE.CylinderGeometry(0.06, 0.08, 4.75, 8), metal, sx, 2.37, 0, inkRig);
    const tanks = [-1.5, 0, 1.5].map((x, i) => {
      const hex = MODES.sub.hues[i], ink = ctx.mat(hex, { roughness: 0.3 });
      add(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 20, 1, true), glass, x, 4.15, 0, inkRig).castShadow = false;
      const fill = add(new THREE.CylinderGeometry(0.38, 0.38, 1, 20), ink, x, 4.1, 0, inkRig);
      add(new THREE.CylinderGeometry(0.1, 0.06, 0.3, 10), metal, x, 3.5, 0, inkRig);
      // the stream runs from the spout down and inwards to the jar
      const from = new THREE.Vector3(x, 3.4, 0), to = new THREE.Vector3(x * 0.33, 1.3, 0), len = from.distanceTo(to);
      const stream = add(new THREE.CylinderGeometry(0.07, 0.07, len, 10), ink, 0, 0, 0, inkRig);
      stream.position.copy(from).lerp(to, 0.5); stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
      const drop = add(new THREE.SphereGeometry(0.11, 10, 8), ink, x, 3.4, 0, inkRig);
      return { fill, stream, drop, from, to };
    });

    // ---- the target: a painted ball on a stand, with the three channels shown as bars on both sides ----
    add(new THREE.CylinderGeometry(0.08, 0.14, 1.5, 10), metal, -3.0, 0.75, 1.6);
    const targetMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    add(new THREE.SphereGeometry(0.42, 24, 16), targetMat, -3.0, 1.9, 1.6);
    const tag = ctx.sprite('🎯', { size: 0.6 }); tag.position.set(-3.0, 2.65, 1.6); group.add(tag);
    // three little columns show how much red, green and blue light reaches the eye from the player's mix
    const meters = ['#ff3030', '#30d050', '#4070ff'].map((c, i) => {
      add(new THREE.BoxGeometry(0.26, 0.06, 0.26), metal, 2.6 + i * 0.34, 0.03, 1.6);
      return add(new THREE.BoxGeometry(0.22, 1, 0.22), ctx.lit(c, 0.7), 2.6 + i * 0.34, 0.5, 1.6);
    });
    const eye = ctx.sprite('👁️', { size: 0.55 }); eye.position.set(2.94, 2.0, 1.6); group.add(eye);

    // ---- the task ----
    let mode = ctx.rng() < 0.5 ? 'add' : 'sub', recipe = [0, 0, 0], target = [0, 0, 0], tries = 0, done = false, quizPair = null, quizResult = '', quizRight = null, quiet = false, time = 0;
    const values = [0, 0, 0], seen = [0, 0, 0], flow = [0, 0, 0];
    const mine = () => MODES[mode].toRGB(values);
    const rGoal = ui.readout('Task'), rQuiz = ui.readout('Predict first'), rLight = ui.readout('Light reaching your eye: R · G · B, %'), rNeed = ui.readout('Close enough within, % points');
    const show = () => { rLight.set(mine().map((x) => Math.round(x * 100) + ' %').join(' · ')); };
    const sliders = ['Red light or cyan ink', 'Green light or magenta ink', 'Blue light or yellow ink'].map((label, i) =>
      ui.slider({ label, min: 0, max: 100, step: 5, value: 0, unit: '%', onInput: (v) => { values[i] = Math.min(100, Math.max(0, +v || 0)); if (!quiet) show(); } }));
    const setAll = (v) => { quiet = true; sliders.forEach((s, i) => { s.set(v[i]); values[i] = v[i]; }); quiet = false; show(); };

    function mission() {
      const steps = lvl <= 3 ? [0, 50, 100] : [0, 25, 50, 75, 100];
      do { recipe = [0, 1, 2].map(() => steps[Math.floor(ctx.rng() * steps.length)]); } while (recipe.every((x) => x === recipe[0]) || recipe.filter((x) => x > 0).length < 2);
      target = MODES[mode].toRGB(recipe); paint(targetMat.color, target);
      tries = 0; done = false; quizRight = null;
      [quizPair, quizResult] = QUIZ[mode][Math.floor(ctx.rng() * 3)];
      lightRig.visible = mode === 'add'; inkRig.visible = mode === 'sub';
      setAll([0, 0, 0]);
      rGoal.set(mode === 'add' ? 'Shine the three lamps on the white ball until it matches the target ball.' : 'Pour the three inks into the white jar until it matches the target ball.');
      rQuiz.set(`${MODES[mode].names[quizPair[0]]} + ${MODES[mode].names[quizPair[1]]} = ?`);
      rNeed.set(lvl <= 3 ? 12 : 8);
    }
    function guess(name) {
      if (!quizPair || !NAMED[name]) return;
      if (quizRight === null) quizRight = name === quizResult;
      setAll([0, 1, 2].map((i) => (quizPair.includes(i) ? 100 : 0)));
      rQuiz.set(`${name === quizResult ? '✅' : '🔁'} ${MODES[mode].names[quizPair[0]]} + ${MODES[mode].names[quizPair[1]]} = ${quizResult}`);
      ctx.say((name === quizResult ? 'Yes! ' : `It makes ${quizResult}. `) + (mode === 'add'
        ? 'Lights add up: each new light sends more colour to your eye, and all three together make white. The lamps now show it. Go on and match the target.'
        : 'Inks take light away: each ink soaks up one colour from the white, and all three together leave black. The jar now shows it. Go on and match the target.'));
    }
    function check() {
      if (done) return;
      tries++;
      const g = gap(mine(), target);
      if (g.worst <= (lvl <= 3 ? 12 : 8)) {
        done = true;
        ctx.say(`Matched! Recipe: ${values.map((v, i) => `${MODES[mode].names[i]} ${v} %`).join(', ')}. ` + (mode === 'add' ? 'A screen makes every colour this way, from tiny red, green and blue lights.' : 'A printer makes every colour this way, from cyan, magenta and yellow inks.'));
        ctx.complete(Math.max(0.4, 1 - 0.1 * (tries - 1) - (quizRight ? 0 : 0.1)), mode === 'add' ? 'Matched a colour by adding red, green and blue light.' : 'Matched a colour by mixing cyan, magenta and yellow inks.');
        return;
      }
      const ch = ['red', 'green', 'blue'][g.channel], tooMuch = g.diff[g.channel] > 0, name = MODES[mode].names[g.channel].toLowerCase();
      if (mode === 'add') ctx.say(`Your mix sends too ${tooMuch ? 'much' : 'little'} ${ch} light to the eye. Lamps add light, so turn the ${name} ${tooMuch ? 'down' : 'up'}.`);
      else ctx.say(`Your mix sends too ${tooMuch ? 'much' : 'little'} ${ch} light to the eye. Think backwards: cyan removes red, magenta removes green, yellow removes blue. So use ${tooMuch ? 'more' : 'less'} ${name}.`);
    }
    const modeC = ui.choice([['add', '💡 Light (R G B)'], ['sub', '🖨️ Ink (C M Y)']], mode, (m) => { if (m === mode || !MODES[m]) return; mode = m; mission(); ctx.say(mode === 'add' ? 'Light: the stage starts dark and each lamp adds its own colour.' : 'Ink: the jar starts white and each ink takes one colour of light away.'); });
    ui.choice(['yellow', 'cyan', 'magenta', 'red', 'green', 'blue'].map((n) => [n, n]), null, guess);
    ui.button('✔ Check match', check, 'btn');
    ui.button('🔄 New target', () => mission());
    ui.note('Lights and inks mix in opposite ways. Light adds: all three lamps make white. Ink takes away: all three inks make black. Real inks are muddier than these.');
    // tapping a lamp or a tank gives it a quarter more; a full one starts again from zero
    const nudge = (i) => { const v = values[i] >= 100 ? 0 : Math.min(100, values[i] + 25); sliders[i].set(v); };
    lamps.forEach((l, i) => ctx.onTap(l.lens, () => nudge(i)));
    tanks.forEach((t, i) => ctx.onTap(t.fill, () => nudge(i)));
    mission();
    ctx.say('Lights and inks mix in opposite ways. Predict what two of them make together, then mix your own colour and check it against the target ball.');

    return {
      frame(dt) {
        time += dt;
        const c = mine(), f = ctx.calm ? 1 : Math.min(1, dt * 5);
        for (let i = 0; i < 3; i++) { seen[i] += (c[i] - seen[i]) * f; flow[i] += (values[i] / 100 - flow[i]) * f; }
        meters.forEach((m, i) => { const h = 0.04 + 1.6 * seen[i]; m.scale.y = h; m.position.y = 0.06 + h / 2; });
        if (mode === 'add') {
          paint(ballMat.color, seen);
          lamps.forEach((l, i) => { l.lensMat.emissiveIntensity = 0.1 + flow[i] * 2.4; l.beamMat.opacity = flow[i] * 0.3; });
          if (!ctx.calm) ball.position.y = 1.65 + Math.sin(time * 1.3) * 0.03;
        } else {
          paint(liquidMat.color, seen);
          const total = (flow[0] + flow[1] + flow[2]) / 3, h = 0.9 + 0.8 * total;      // the jar fills as more ink runs in
          liquid.scale.y = h; liquid.position.y = 0.3 + h / 2; paddle.position.y = 0.3 + h * 0.6;
          if (!ctx.calm) paddle.rotation.y += dt * (0.6 + 3 * total);
          tanks.forEach((t, i) => {
            const k = flow[i], left = 1 - 0.85 * k;
            t.fill.scale.y = left; t.fill.position.y = 3.68 + left / 2;                 // the tank empties as its ink is used
            t.stream.visible = k > 0.02; t.stream.scale.set(0.3 + k, 1, 0.3 + k);
            t.drop.visible = k > 0.02 && !ctx.calm;
            if (t.drop.visible) t.drop.position.copy(t.from).lerp(t.to, (time * (0.8 + k) + i * 0.37) % 1);
          });
        }
      },
      autoplay() { guess(quizResult); setAll(recipe); check(); },
      dispose() { for (const x of own) x.dispose?.(); },
      get mode() { return modeC.value; },
    };
  },
};
