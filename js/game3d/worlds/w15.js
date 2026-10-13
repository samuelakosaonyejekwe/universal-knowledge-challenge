// World 15 — Fine Arts and Sculpture: the Gallery of Lost Colours.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: idealised colour mixing. Colours are [red, green, blue], each from 0 to 1. -----
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const LIGHTS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];           // what each lamp sends out: red, green, blue
const PIGMENTS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];         // what each paint soaks up: cyan takes red, magenta takes green, yellow takes blue
export const model = {
  // Additive mixing: start in the dark and add up the light of every lamp in each channel (amounts 0…1).
  additive(amounts) { const c = [0, 0, 0]; LIGHTS.forEach((l, i) => { for (let ch = 0; ch < 3; ch++) c[ch] += l[ch] * clamp01(amounts[i]); }); return c.map(clamp01); },
  // Subtractive mixing: start with white paper and let every pigment remove its share of one channel (R = 1 − C, …).
  subtractive(amounts) { const c = [1, 1, 1]; PIGMENTS.forEach((p, i) => { for (let ch = 0; ch < 3; ch++) c[ch] *= 1 - p[ch] * clamp01(amounts[i]); }); return c.map(clamp01); },
  mix: (mode, amounts) => (mode === 'paint' ? model.subtractive(amounts) : model.additive(amounts)),
  // The amounts that make a colour in each mode (used for hints and the demonstration).
  recipe: (mode, c) => (mode === 'paint' ? c.map((v) => 1 - v) : c.slice()),
  complement: (c) => c.map((v) => 1 - v),
  // How far apart two colours are: 0 % = the same, 100 % = black against white.
  distance: (a, b) => 100 * Math.sqrt(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / 3),
  // The everyday name of the family a colour belongs to.
  family(c) {
    const max = Math.max(...c), min = Math.min(...c);
    if (max < 0.2) return 'black';
    if ((max - min) / max < 0.15) return max > 0.85 ? 'white' : 'grey';
    const [r, g, b] = c, d = max - min;
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
    const pale = min > 0.5;
    if (h < 20 || h >= 340) return pale ? 'pink' : 'red';
    if (h < 45) return 'orange';
    if (h < 70) return 'yellow';
    if (h < 165) return 'green';
    if (h < 200) return 'cyan';
    if (h < 260) return 'blue';
    if (h < 300) return 'purple';
    return pale ? 'pink' : 'magenta';
  },
};
// Used by the automated tests: the textbook results of mixing light and mixing pigment.
export function selfTest() {
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-12), f = (c) => c.join(',');
  const rg = model.additive([1, 1, 0]), rgb = model.additive([1, 1, 1]), cy = model.subtractive([1, 0, 1]), cmy = model.subtractive([1, 1, 1]);
  const t = [1, 0.5, 0], d0 = model.distance(model.mix('paint', model.recipe('paint', t)), t), dMax = model.distance([0, 0, 0], [1, 1, 1]);
  const ok = same(rg, [1, 1, 0]) && same(rgb, [1, 1, 1]) && same(cy, [0, 1, 0]) && same(cmy, [0, 0, 0]) && d0 === 0 && Math.abs(dMax - 100) < 1e-9
    && model.family(rg) === 'yellow' && model.family(rgb) === 'white' && model.family(cy) === 'green' && model.family(cmy) === 'black';
  return { ok, detail: `red+green light = ${f(rg)} (${model.family(rg)}), all lights = ${f(rgb)} (${model.family(rgb)}), cyan+yellow paint = ${f(cy)} (${model.family(cy)}), all paints = ${f(cmy)} (${model.family(cmy)}), distance at target ${d0} %, black to white ${dMax.toFixed(0)} %` };
}

// One task per level: which mixing to use, the colour to make, and how close is close enough (in %).
const TASKS = [
  { mode: 'light', target: [1, 1, 0], name: 'yellow', tol: 30 },
  { mode: 'light', target: [1, 1, 1], name: 'white', tol: 25 },
  { mode: 'paint', target: [0, 1, 0], name: 'green', tol: 18 },
  { mode: 'paint', target: [1, 0.5, 0], name: 'orange', tol: 14 },
  { mode: 'light', target: [0.8, 0.6, 0], name: 'the opposite of the blue on the panel', tol: 12, shown: [0.2, 0.4, 1] },
  { mode: 'paint', target: [1, 0.7, 0.8], name: 'soft pink (a tint: a colour with lots of white left in it)', tol: 8 },
];
const pct = (v) => Math.round(v * 100);

const sim = {
  title: 'The colour studio',
  goal: 'Mix colour for the white sculpture until your swatch matches the target swatch. Three lamps add red, green and blue light. At higher levels, three paints take light away instead.',
  kind: 'validated',
  model: 'Two idealised models. Light (additive): the red, green and blue lamps are added together in each channel, so red + green = yellow and all three = white. Paint (subtractive): each pigment removes only its opposite colour from white paper (red = 1 − cyan, green = 1 − magenta, blue = 1 − yellow), so cyan + yellow = green and all three = black. Distance is the straight-line gap between two colours, 0 % to 100 %. Real paints and screens are less pure than this: real pigments soak up some of every colour, so mixed paint looks duller and all three make a muddy brown, and real lamps and screens cannot show every colour the eye can see. It also leaves out how the eye judges brightness.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, task = TASKS[Math.min(6, Math.max(1, ctx.level || 1)) - 1], own = [];
    const keep = (m) => { own.push(m); return m; };
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const white = ctx.mat('#ffffff', { roughness: 0.6 }), metal = ctx.mat('#8d7aa8', { metalness: 0.4, roughness: 0.4 });
    // the white sculpture on its plinth: stacked blocks and balls
    add(new THREE.CylinderGeometry(0.75, 0.9, 1.0, 24), ctx.mat('#e9e4f2', { roughness: 0.7 }), 0, 0.5, 0);
    const form = new THREE.Group(); form.position.y = 1.0; group.add(form);
    const clay = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
    add(new THREE.BoxGeometry(0.8, 0.5, 0.8), clay, 0, 0.25, 0, form).rotation.y = 0.5;
    add(new THREE.SphereGeometry(0.44, 28, 20), clay, 0.06, 0.92, 0, form);
    add(new THREE.BoxGeometry(0.75, 0.22, 0.4), clay, -0.05, 1.45, 0, form).rotation.set(0.2, 0.9, 0.35);
    add(new THREE.SphereGeometry(0.22, 20, 14), clay, 0.12, 1.86, 0.02, form);
    // three spotlights on a rail: red, green, blue
    add(new THREE.BoxGeometry(4.8, 0.1, 0.1), metal, 0, 4.7, 1.9);
    for (const sx of [-2.35, 2.35]) add(new THREE.CylinderGeometry(0.05, 0.07, 4.7, 8), metal, sx, 2.35, 1.9);
    const HEX = [0xff0000, 0x00ff00, 0x0000ff], lamps = [-1.5, 0, 1.5].map((x, i) => {
      const light = new THREE.SpotLight(HEX[i], 0, 14, 0.5, 0.6, 1.4); light.position.set(x, 4.45, 1.9); light.target.position.set(0, 1.9, 0); group.add(light, light.target);
      add(new THREE.CylinderGeometry(0.16, 0.24, 0.4, 14), metal, x, 4.5, 1.9).rotation.x = 0.6;
      const lens = add(new THREE.SphereGeometry(0.17, 14, 10), keep(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: HEX[i], emissiveIntensity: 0, roughness: 0.3 })), x, 4.36, 1.8);
      return { light, lens };
    });
    // three paint pots: cyan, magenta, yellow (only shown in paint mode)
    const pots = new THREE.Group(); group.add(pots);
    const fills = ['#00ffff', '#ff00ff', '#ffff00'].map((c, i) => {
      add(new THREE.CylinderGeometry(0.2, 0.17, 0.36, 16), white, (i - 1) * 0.6, 0.18, 1.5, pots);
      return add(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 16), ctx.mat(c, { roughness: 0.3 }), (i - 1) * 0.6, 0.23, 1.5, pots);
    });
    // the two swatch panels: the target on the left, the player's mix on the right
    const panel = (x, mark) => {
      add(new THREE.CylinderGeometry(0.06, 0.1, 1.2, 8), metal, x, 0.6, 0.5);
      add(new THREE.BoxGeometry(1.6, 1.6, 0.08), white, x, 1.95, 0.5);
      const face = add(new THREE.BoxGeometry(1.3, 1.3, 0.06), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), x, 1.95, 0.56);
      const tag = ctx.sprite(mark, { size: 0.7 }); tag.position.set(x, 3.15, 0.5); group.add(tag);
      return face.material.color;
    };
    const targetCol = panel(-2.9, '🎯'), mixCol = panel(2.9, '🎨');
    const shown = task.shown || task.target; targetCol.setRGB(shown[0], shown[1], shown[2], THREE.SRGBColorSpace);

    let mode = 'light', tries = 0, done = false; const amounts = [0, 0, 0], seen = [0, 0, 0];
    const names = { light: ['red', 'green', 'blue'], paint: ['cyan', 'magenta', 'yellow'] };
    const rRGB = ui.readout('Your colour: R, G, B, %'), rFam = ui.readout('Colour family'), rDist = ui.readout('Distance from target, %'), rTol = ui.readout('Close enough at, %'), rT = ui.readout('Target: R, G, B, %');
    const now = () => model.mix(mode, amounts);
    const show = () => {
      const c = now(); rRGB.set(`${pct(c[0])}, ${pct(c[1])}, ${pct(c[2])}`); rFam.set(model.family(c)); rDist.set(model.distance(c, task.target).toFixed(1));
      pots.visible = mode === 'paint'; fills.forEach((f, i) => { f.scale.y = 0.1 + 0.9 * amounts[i]; f.position.y = 0.05 + 0.15 * f.scale.y; });
    };
    const labels = ctx.level >= 3 ? ['Red light or cyan paint', 'Green light or magenta paint', 'Blue light or yellow paint'] : ['Red light', 'Green light', 'Blue light'];
    const sliders = labels.map((label, i) => ui.slider({ label, min: 0, max: 100, step: 5, value: 0, unit: '%', onInput: (v) => { amounts[i] = clamp01(v / 100); show(); } }));
    const setMode = (m) => {
      if (m === mode) return; mode = m; show();
      ctx.say(mode === 'paint' ? 'Paint mode. The paper starts white and each paint takes one colour of light away: cyan takes red, magenta takes green, yellow takes blue.' : 'Light mode. The room starts dark and each lamp adds its own colour of light.');
    };
    const modeC = ctx.level >= 3 ? ui.choice([['light', '💡 Mix light'], ['paint', '🖌️ Mix paint']], 'light', setMode) : null;
    const check = () => {
      if (done) return; tries++;
      if (mode !== task.mode) { ctx.say(task.mode === 'paint' ? 'This one must be mixed with paint. Switch to paint mode: paint works by taking light away from white.' : 'This one must be mixed with light. Switch to light mode: lamps work by adding light to the dark.'); return; }
      const c = now(), d = model.distance(c, task.target);
      if (d <= task.tol) {
        done = true;
        ctx.say(mode === 'paint' ? `A match, only ${d.toFixed(1)} % away! Paint takes light away: every pigment you added removed one colour from white, and what was left is your colour.` : `A match, only ${d.toFixed(1)} % away! Light adds: every lamp you turned up added its colour, and together they made a new one.`);
        ctx.complete(d <= task.tol / 2 && tries <= 2 ? 1 : 0.8, `d=${d.toFixed(1)}%, tries=${tries}, ${mode}`);
        return;
      }
      // the channel that is furthest off tells the player which control to move, and why
      const diff = c.map((v, i) => v - task.target[i]), i = diff.reduce((best, v, j) => (Math.abs(v) > Math.abs(diff[best]) ? j : best), 0), ch = names.light[i];
      if (mode === 'light') ctx.say(`${d.toFixed(1)} % away. There is too ${diff[i] > 0 ? 'much' : 'little'} ${ch} in your mix. Lamps add light, so turn the ${ch} lamp ${diff[i] > 0 ? 'down' : 'up'}.`);
      else ctx.say(`${d.toFixed(1)} % away. There is too ${diff[i] > 0 ? 'much' : 'little'} ${ch} in your mix. ${names.paint[i][0].toUpperCase() + names.paint[i].slice(1)} paint takes ${ch} away, so use ${diff[i] > 0 ? 'more' : 'less'} ${names.paint[i]}.`);
    };
    ui.button('🔍 Check my mix', check, 'btn');
    ui.note('Light adds: lamps start in the dark and build colour up, so all three make white. Paint takes away: pigments start on white and remove colour, so all three make black. Real paints are less pure than these.');
    rTol.set(task.tol); rT.set(task.shown ? `opposite of ${task.shown.map(pct).join(', ')}` : task.target.map(pct).join(', '));
    show();
    ctx.say(`Make ${task.name} with ${task.mode === 'paint' ? 'paint' : 'light'}. Move the sliders, compare the two swatches, then check your mix.`);
    return {
      frame(dt) {
        const c = now(), f = ctx.calm ? 1 : Math.min(1, dt * 6);
        for (let i = 0; i < 3; i++) seen[i] += (c[i] - seen[i]) * f;
        mixCol.setRGB(seen[0], seen[1], seen[2], THREE.SRGBColorSpace);
        // light mode: a white sculpture under coloured lamps; paint mode: a painted sculpture under white lamps
        if (mode === 'paint') clay.color.setRGB(seen[0], seen[1], seen[2], THREE.SRGBColorSpace); else clay.color.setRGB(1, 1, 1);
        lamps.forEach((l, i) => {
          const a = mode === 'paint' ? 0.45 : amounts[i];
          l.light.color.setHex(mode === 'paint' ? 0xffffff : HEX[i]); l.light.intensity += (a * 45 - l.light.intensity) * f;
          l.lens.material.emissive.setHex(mode === 'paint' ? 0xffffff : HEX[i]); l.lens.material.emissiveIntensity = 0.15 + a * 2;
        });
        if (!ctx.calm) form.rotation.y += dt * 0.25;
      },
      // Shows a successful run without the player (used by tests).
      autoplay() {
        modeC?.set?.(task.mode); setMode(task.mode);
        model.recipe(task.mode, task.target).forEach((v, i) => { amounts[i] = v; sliders[i].set(pct(v)); });
        show(); check();
      },
      dispose() { for (const l of lamps) { l.light.removeFromParent(); l.light.target.removeFromParent(); l.light.dispose(); } for (const m of own) m.dispose(); },
      get state() { return { mode, amounts: amounts.slice(), done }; },
    };
  },
};

export default {
  id: 15,
  theme: {
    sky: ['#b9a4f0', '#ffc9de', '#fff3b8'], fog: '#ffe3ee', fogNear: 55, fogFar: 180,
    ground: '#f4efe8', ground2: '#ffe1ec', side: '#d9b3e6', stone: '#f2eef7', accent: '#ae3ec9', glow: '#f06595', metal: '#8d7aa8', wood: '#c98f5a', leaf: '#63c69a', water: '#7fd3f0', crate: '#ffd8a8',
    sun: '#fff6dc', sunPower: 2.2, ambient: 1.2, skyLight: '#fff0fa', groundLight: '#e7c6f2', sunDir: [-0.4, 1, 0.5], particles: 'leaves',
  },
  layout: { shape: 'descent', mirror: -1, stones: 5, rise: 0.4, towerH: 4.5 },
  story: {
    title: 'The Gallery of Lost Colours',
    crystal: 'colour drops', crystalEm: '🎨',
    intro: ['Welcome to the Artist\'s Memory Gallery! I am the Gallery Curator. This morning a pale mist rolled over the hill and washed the colour out of our pictures.', 'Five colour drops were carried off across the painted islands, and the white sculpture in the colour studio is still waiting for its light.'],
    remind: 'The colour drops glow pink. One floats over the stepping stones, one in the lagoon, and one on top of the tower.',
    afterCrystals: 'All five colour drops! Now ride the lift from the tower to the colour studio and mix the right colour for the white sculpture.',
    afterSim: 'The sculpture is glowing with colour. Only the Gallery Master is left to meet. The arena is up the steps.',
    notReady: 'The arena is for artists who have done the work. Bring all five colour drops and finish the colour studio first.',
    rival: ['So you can mix a colour. Mixing is the easy part. Knowing why it works is the art.', 'We each paint a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge was finished before mine, and every piece was true. Well done, artist. The portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and try me.'],
    outro: 'The colours are back in every frame, the sculpture shines, and the Gallery Master has bowed. The lesson is ready for you whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, wood = k.mat('#c98f5a'), canvas = k.mat('#ffffff', { roughness: 0.9 }), paints = ['#ff6b6b', '#ffd43b', '#4dabf7', '#63c69a', '#ae3ec9', '#f06595'];
    const part = (x, y, z, yaw = 0) => { const g = k.add(new THREE.Group()); g.position.set(x, y, z); g.rotation.y = yaw; return g; };
    // easels with plain colour-block canvases
    const easel = (x, y, z, yaw, [a, b]) => {
      const g = part(x, y, z, yaw);
      for (const sx of [-1, 1]) k.mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), wood, sx * 0.45, 1.15, 0, g).rotation.z = sx * 0.13;
      k.mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), wood, 0, 1.1, -0.42, g).rotation.x = 0.36;
      const c = k.mesh(new THREE.BoxGeometry(1.4, 1.05, 0.06), canvas, 0, 1.55, 0.1, g); c.rotation.x = -0.12;
      k.mesh(new THREE.BoxGeometry(0.6, 0.75, 0.02), k.mat(a), -0.3, 0.02, 0.04, c); k.mesh(new THREE.BoxGeometry(0.45, 0.4, 0.02), k.mat(b), 0.36, -0.15, 0.04, c);
    };
    easel(-7.3, 0, -4.4, 1.0, [paints[2], paints[1]]); easel(4.6, 0, -7, -0.5, [paints[5], paints[3]]);
    // a giant paint palette leaning on the home island
    const pal = part(7.6, 1.25, 0, -Math.PI / 2), board = k.mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 28), wood, 0, 0, 0, pal); board.rotation.x = Math.PI / 2 - 0.3; board.scale.x = 1.25;
    paints.slice(0, 4).forEach((c, i) => { k.mesh(new THREE.SphereGeometry(0.24, 12, 8), k.mat(c, { roughness: 0.3 }), Math.cos(0.5 + i * 0.8) * 0.8, 0.08, -Math.sin(0.5 + i * 0.8) * 0.8, board).scale.y = 0.4; });
    // a mosaic floor patch in the middle of the home island
    [[-0.9, 0.9, 0], [0, 0.9, 4], [0.9, 0.9, 1], [-0.45, 1.8, 5], [0.45, 1.8, 2]].forEach(([x, z, c]) => { k.mesh(new THREE.BoxGeometry(0.82, 0.04, 0.82), k.mat(paints[c], { roughness: 0.4 }), x, 0.02, z).castShadow = false; });
    // the middle island: a potter's wheel that spins, and a sculpture on a plinth
    const mid = S.mid, wheelG = part(-4.6, mid[1], mid[2] - 3.2);
    k.mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.6, 14), k.mat('#8d7aa8'), 0, 0.3, 0, wheelG);
    const wheel = k.mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 7), k.mat('#f2eef7', { flatShading: true }), 0, 0.66, 0, wheelG);
    k.mesh(new THREE.LatheGeometry([[0.2, 0], [0.34, 0.2], [0.3, 0.42], [0.16, 0.56], [0.22, 0.66]].map(([r, y]) => new THREE.Vector2(r, y)), 9), k.mat('#d98a5f', { flatShading: true, side: THREE.DoubleSide }), 0, 0.05, 0, wheel);
    k.animate((dt) => { wheel.rotation.y += dt * 2.2; });
    const sculpture = (x, y, z, [a, b, c]) => {
      k.block(x, y + 1, z, 0.9, 1, 0.9, { color: '#ffffff' });
      k.mesh(new THREE.SphereGeometry(0.36, 18, 12), k.mat(a, { roughness: 0.4 }), x, y + 1.36, z);
      k.mesh(new THREE.BoxGeometry(0.85, 0.24, 0.4), k.mat(b, { roughness: 0.4 }), x, y + 1.82, z).rotation.set(0.15, 0.6, 0.3);
      return k.mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 20), k.mat(c, { roughness: 0.4 }), x, y + 2.4, z);
    };
    const hoopA = sculpture(5, mid[1], mid[2] + 0.4, [paints[0], paints[1], paints[2]]), hoopB = sculpture(S.end[0] + 2.2, S.end[1], S.end[2] - 3.6, [paints[4], paints[5], paints[1]]);
    k.animate((dt) => { hoopA.rotation.y += dt * 0.7; hoopB.rotation.y -= dt * 0.7; });
    // picture frames hanging in the air beside the route
    const lz = mid[2] + 11.6, frames = [[5.6, 3.4, 17, -0.5, 0, 5], [-8.2, mid[1] + 3.6, lz - 1, 0.9, 3, 1], [8.4, mid[1] + 4.2, lz + 3, -0.9, 4, 2]].map(([x, y, z, yaw, a, b], i) => {
      const g = part(x, y, z, yaw);
      k.mesh(new THREE.BoxGeometry(2.3, 1.8, 0.14), k.mat('#e8b84a', { metalness: 0.4, roughness: 0.4 }), 0, 0, 0, g);
      k.mesh(new THREE.BoxGeometry(1.9, 1.4, 0.16), k.mat(paints[a]), 0, 0, 0, g); k.mesh(new THREE.BoxGeometry(0.8, 0.8, 0.18), k.mat(paints[b]), 0.35, -0.15, 0, g);
      return { g, y, i };
    });
    k.animate((dt, t) => { for (const f of frames) { f.g.position.y = f.y + Math.sin(t * 0.8 + f.i * 2) * 0.18; f.g.rotation.z = Math.sin(t * 0.6 + f.i) * 0.05; } });
    // an oversized pencil and brush stand beside the tower
    const far = S.far, pencil = part(4.4, far[1], far[2] - 3.4); pencil.rotation.z = -0.1;
    k.mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 6), k.mat(paints[1], { flatShading: true }), 0, 1.3, 0, pencil); k.mesh(new THREE.ConeGeometry(0.22, 0.5, 6), k.mat('#f1d3a8', { flatShading: true }), 0, 2.85, 0, pencil); k.mesh(new THREE.ConeGeometry(0.08, 0.18, 6), k.mat('#4a4458'), 0, 3.02, 0, pencil);
    const brush = part(5.4, far[1], far[2] - 1.2); brush.rotation.z = 0.12;
    k.mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.4, 10), wood, 0, 1.2, 0, brush); k.mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.36, 10), k.mat('#8d7aa8', { metalness: 0.5, roughness: 0.35 }), 0, 2.55, 0, brush); k.mesh(new THREE.ConeGeometry(0.2, 0.8, 10), k.mat(paints[5]), 0, 3.1, 0, brush);
    // a mobile sculpture that turns, behind the colour studio
    const mob = part(S.sim[0] + 3, S.sim[1], S.sim[2] - 6);
    k.mesh(new THREE.CylinderGeometry(0.06, 0.12, 3.6, 8), k.mat('#8d7aa8'), 0, 1.8, 0, mob);
    const arm = k.mesh(new THREE.BoxGeometry(2.6, 0.06, 0.06), k.mat('#8d7aa8'), 0, 3.6, 0, mob);
    k.mesh(new THREE.SphereGeometry(0.26, 14, 10), k.mat(paints[0]), -1.2, -0.55, 0, arm); k.mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), k.mat(paints[2]), 1.2, -0.75, 0, arm).rotation.set(0.6, 0.4, 0); k.mesh(new THREE.ConeGeometry(0.24, 0.45, 4), k.mat(paints[1]), 0.3, -1.1, 0, arm);
    k.animate((dt, t) => { arm.rotation.y += dt * 0.5; arm.rotation.z = Math.sin(t * 0.9) * 0.06; });
    // a banner by the arena and a soft cloud in the watercolour sky
    k.prop('banner', S.arena[0] - 5.6, S.arena[1], S.arena[2] - 3.2, { color: '#f06595' });
    k.prop('cloud', -16, 14, 40, { s: 1.8, color: '#fff5fb' });
  },
  sim,
};
