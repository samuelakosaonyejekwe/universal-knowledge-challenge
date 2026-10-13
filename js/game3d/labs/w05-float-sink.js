// World 5 lab — Float or Sink? Things dropped into a glass tank settle at the depth their density gives them,
// and a toy boat sinks deeper with every box until its side goes under.
// No imports: everything arrives through the context, so the model can be checked without a browser.

const WATER = 1000;                 // density of water, kg/m³
// name, density kg/m³
const ITEMS = [
  ['wood', 600], ['apple', 800], ['rock', 2600], ['ice', 917], ['key', 7800], ['ball', 120],
  ['rubber duck', 300], ['potato', 1100], ['candle', 900], ['coin', 8900], ['grape', 1050], ['leaf', 400],
];
const CLOSE = ['ice', 'candle', 'grape', 'potato'];      // close to water: the hard ones
const BOAT = { len: 0.4, wid: 0.2, hull: 1, box: 1 };    // toy boat: 40 cm × 20 cm, hull 1 kg, each box 1 kg

export const model = {
  WATER, ITEMS, BOAT,
  floats: (d) => d < WATER,
  // Archimedes: a floating thing sinks until the water it pushes aside weighs as much as it does.
  under: (d) => Math.min(1, d / WATER),
  // How deep the boat sits with n boxes, m: mass = water density × length × width × depth under water.
  draught: (n) => (BOAT.hull + n * BOAT.box) / (WATER * BOAT.len * BOAT.wid),
  // Side height of a boat made to carry `cap` boxes, m.
  side: (cap) => 0.0125 * (cap + 1.5),
  capacity(side) { let n = 0; while (model.draught(n + 1) <= side + 1e-12) n++; return n; },
};
// By hand: ice 917/1000 = 0.917 under water, wood 0.6; rock 2600 > 1000 sinks.
// Boat with 3 boxes: 4 kg / (1000 × 0.4 × 0.2) = 0.05 m. A 5-box boat has sides 0.0125 × 6.5 = 0.08125 m:
// 5 boxes sit 0.075 m deep (floats), 6 boxes need 0.0875 m (sinks).
export function selfTest() {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const ok = near(model.under(917), 0.917) && near(model.under(600), 0.6) && model.under(2600) === 1 && !model.floats(2600) && model.floats(917) && !model.floats(1050)
    && near(model.draught(3), 0.05) && near(model.side(5), 0.08125) && near(model.draught(5), 0.075) && near(model.draught(6), 0.0875)
    && [4, 5, 6, 7].every((c) => model.capacity(model.side(c)) === c);
  return { ok, detail: `ice ${model.under(917) * 100}% under water (by hand 91.7); boat with 3 boxes sits ${(model.draught(3) * 100).toFixed(2)} cm deep (by hand 5.00); a 5-box boat carries ${model.capacity(model.side(5))}` };
}

export default {
  id: 'w05-float-sink',
  world: 5,
  levels: [1, 2],
  title: 'Float or Sink?',
  goal: 'Guess if each thing floats or sinks, then drop it in the water. Then load the boat!',
  kind: 'validated',
  model: 'Uses density only (water is 1000 kg/m³): a thing floats when it is lighter than the same amount of water, and a floating thing sits with the fraction density ÷ 1000 under water. The boat is a box 40 cm × 20 cm; it sinks 1.25 cm deeper for every 1 kg box, and goes under when the water reaches the top of its side. Real objects can have air inside, and shape and surface tension matter for small things. The speed of falling through the water is only for show.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, hard = ctx.level >= 2, own = [];
    const FLOOR = 0.5, WY = 2.0, AX = -1.75, BX = 1.75, S = 5.5;          // tank floor, water surface, tank centres, boat scale
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const clear = (color, opacity) => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), transparent: true, opacity, roughness: 0.15, metalness: 0.1, depthWrite: false }); own.push(m); return m; };
    const label = (text, size, x, y, z, parent = group) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); parent.add(s); return s; };

    // two glass tanks
    const waterMat = clear('#19b8c9', 0.45), glassMat = clear('#dffaff', 0.1), steel = ctx.mat('#2c5870', { metalness: 0.4, roughness: 0.4 });
    const glassGeo = new THREE.BoxGeometry(2.7, 2.1, 2.1), lineMat = new THREE.LineBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.7 }); own.push(lineMat);
    for (const cx of [AX, BX]) {
      add(new THREE.BoxGeometry(2.9, FLOOR, 2.3), steel, cx, FLOOR / 2, 0);
      add(new THREE.BoxGeometry(2.6, WY - FLOOR, 2.0), waterMat, cx, (WY + FLOOR) / 2, 0).renderOrder = 2;
      add(glassGeo, glassMat, cx, FLOOR + 1.05, 0).renderOrder = 3;
      const fr = new THREE.LineSegments(new THREE.EdgesGeometry(glassGeo), lineMat); fr.position.set(cx, FLOOR + 1.05, 0); group.add(fr);
    }
    const splash = add(new THREE.TorusGeometry(0.3, 0.03, 6, 20), ctx.lit('#ffffff', 0.9), AX, WY + 0.01, 0); splash.rotation.x = Math.PI / 2; splash.visible = false;
    let splashT = 9;

    // things to drop, made from simple shapes; h is the height used to work out how much is under water
    const M = (c, o) => ctx.mat(c, { roughness: 0.7, ...o });
    const makers = {
      wood: (g) => { add(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 12), M('#a9744a'), 0, 0, 0, g).rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(0.1, 0.1, 0.56, 10), M('#e2bd84'), 0, 0, 0, g).rotation.z = Math.PI / 2; return 0.32; },
      apple: (g) => { add(new THREE.SphereGeometry(0.2, 16, 12), M('#e0362f', { roughness: 0.4 }), 0, 0, 0, g); add(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), M('#6b4a2b'), 0, 0.22, 0, g); return 0.4; },
      rock: (g) => { add(new THREE.DodecahedronGeometry(0.22), M('#8a8f96', { flatShading: true }), 0, 0, 0, g); return 0.4; },
      ice: (g) => { add(new THREE.BoxGeometry(0.34, 0.34, 0.34), clear('#d8f6ff', 0.75), 0, 0, 0, g); return 0.34; },
      key: (g) => { add(new THREE.TorusGeometry(0.1, 0.035, 8, 16), M('#d9b23c', { metalness: 0.7, roughness: 0.3 }), -0.14, 0, 0, g); add(new THREE.BoxGeometry(0.3, 0.05, 0.05), M('#d9b23c', { metalness: 0.7, roughness: 0.3 }), 0.1, 0, 0, g); add(new THREE.BoxGeometry(0.05, 0.1, 0.05), M('#d9b23c', { metalness: 0.7, roughness: 0.3 }), 0.2, -0.06, 0, g); return 0.26; },
      ball: (g) => { add(new THREE.SphereGeometry(0.23, 18, 12), M('#f2812a'), 0, 0, 0, g); add(new THREE.TorusGeometry(0.232, 0.012, 6, 24), M('#3a2a1c'), 0, 0, 0, g); return 0.46; },
      'rubber duck': (g) => { add(new THREE.SphereGeometry(0.19, 16, 12), M('#ffd23a', { roughness: 0.4 }), 0, -0.04, 0, g).scale.set(1.25, 0.85, 1); add(new THREE.SphereGeometry(0.12, 14, 10), M('#ffd23a', { roughness: 0.4 }), 0.14, 0.16, 0, g); add(new THREE.ConeGeometry(0.05, 0.12, 8), M('#f2812a'), 0.29, 0.15, 0, g).rotation.z = -Math.PI / 2; return 0.4; },
      potato: (g) => { add(new THREE.SphereGeometry(0.2, 12, 9), M('#c8a36a', { roughness: 0.95 }), 0, 0, 0, g).scale.set(1.3, 0.8, 0.85); return 0.32; },
      candle: (g) => { add(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12), M('#f6ecd2'), 0, 0, 0, g).rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5), M('#333333'), 0.25, 0, 0, g).rotation.z = Math.PI / 2; return 0.18; },
      coin: (g) => { add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), M('#e3b23c', { metalness: 0.8, roughness: 0.25 }), 0, 0, 0, g); add(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), M('#f5d87a', { metalness: 0.8, roughness: 0.25 }), 0, 0, 0, g); return 0.06; },
      grape: (g) => { for (const [x, y, z] of [[0, 0.06, 0], [-0.11, -0.05, 0.03], [0.11, -0.05, -0.03]]) add(new THREE.SphereGeometry(0.11, 12, 9), M('#7b3fa6', { roughness: 0.35 }), x, y, z, g); return 0.3; },
      leaf: (g) => { add(new THREE.SphereGeometry(0.22, 12, 8), M('#4fb04a'), 0, 0, 0, g).scale.set(1.3, 0.1, 0.7); add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), M('#2f7a34'), 0, 0.02, 0, g).rotation.z = Math.PI / 2; return 0.05; },
    };

    // the five things for this visit: clear ones at level 1, at least three close-to-water ones at level 2
    const shuffle = (a) => { const b = [...a]; for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(ctx.rng() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; } return b; };
    const easy = ITEMS.filter(([n]) => !CLOSE.includes(n)), close = ITEMS.filter(([n]) => CLOSE.includes(n));
    const pool = hard ? shuffle([...shuffle(close).slice(0, 3), ...shuffle(easy).slice(0, 2)]) : shuffle(easy).slice(0, 5);

    // the choosers beside the tank: a life ring (floats) and an anchor weight (sinks)
    const ring = add(new THREE.TorusGeometry(0.3, 0.11, 10, 24), ctx.mat('#f2812a', { roughness: 0.5 }), AX - 0.9, 0.45, 1.75);
    label('Floats', 0.3, 0, 0.6, 0, ring);
    const weight = new THREE.Group(); weight.position.set(AX + 0.9, 0, 1.75); group.add(weight);
    const wBody = add(new THREE.CylinderGeometry(0.2, 0.32, 0.5, 14), ctx.mat('#51606b', { metalness: 0.6, roughness: 0.4 }), 0, 0.25, 0, weight);
    add(new THREE.TorusGeometry(0.11, 0.035, 8, 16), ctx.mat('#51606b', { metalness: 0.6, roughness: 0.4 }), 0, 0.6, 0, weight);
    label('Sinks', 0.3, 0, 1.05, 0, weight);
    ctx.onTap(ring, () => choose('float')); ctx.onTap(wBody, () => choose('sink'));

    // the toy boat in the second tank
    const cap = 4 + Math.floor(ctx.rng() * 4), side = model.side(cap);
    const boat = new THREE.Group(); boat.position.set(BX, WY - model.draught(0) * S, 0); group.add(boat);
    add(new THREE.BoxGeometry(BOAT.len * S, side * S, BOAT.wid * S), ctx.mat('#b5482f', { roughness: 0.6 }), 0, side * S / 2, 0, boat);
    add(new THREE.BoxGeometry(BOAT.len * S + 0.02, 0.03, BOAT.wid * S + 0.02), ctx.lit('#ffffff', 0.9), 0, model.draught(cap) * S, 0, boat);       // the load line
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), ctx.mat('#f4f4f4'), 0.98, side * S + 0.45, 0, boat);
    const flag = add(new THREE.BoxGeometry(0.3, 0.2, 0.02), ctx.mat('#ffd23a'), 0.82, side * S + 0.78, 0, boat);
    const crateMat = ctx.mat('#f2a23a', { roughness: 0.8 }), crateGeo = new THREE.BoxGeometry(0.34, 0.3, 0.34);
    const crates = []; for (let k = 0; k < 8; k++) { const c = add(crateGeo, crateMat, -0.72 + 0.4 * (k % 4), side * S + 0.15, k < 4 ? -0.24 : 0.24, boat); c.visible = false; crates.push(c); }
    const pile = add(new THREE.BoxGeometry(0.5, 0.45, 0.5), crateMat, BX, 0.225, 1.75); label('Add a box', 0.3, 0, 0.55, 0, pile);
    ctx.onTap(pile, () => addBox());

    // ----- state -----
    let i = 0, right = 0, phase = 'ask', t = 0, guess = null, cur = null, cargo = 0, sinks = 0, roundsDone = false, finished = false, auto = false, autoT = 0, clock = 0, boatY = boat.position.y, boatTilt = 0;
    const live = [];
    const rRound = ui.readout('Round'), rRight = ui.readout('Right so far'), rDen = ui.readout('This thing, kg/m³ (water is 1000)'), rUnder = ui.readout('Part under water, %');
    const rBox = ui.readout('Boxes on the boat'), rDeep = ui.readout('Boat sits this deep, cm'), rDry = ui.readout('Dry side left, cm');
    ui.button('🏊 Floats', () => choose('float'), 'btn'); ui.button('⚓ Sinks', () => choose('sink'), 'btn ghost'); ui.button('➡️ Next', () => next(), 'btn ok');
    ui.button('➕ 📦 Add a box', () => addBox(), 'btn'); ui.button('♻️ Empty', () => empty(), 'btn ghost');
    if (hard) ui.button('⛵ Set sail', () => setSail(), 'btn ok');
    ui.note(hard ? 'Water has a density of 1000 kg/m³. Compare each number with 1000 before you guess. Then load the boat right up to its white line, but not past it, and set sail.' : 'Tap the life ring if you think it floats, or the weight if you think it sinks. Then try loading boxes on the boat.');

    function show() {
      const [name, d] = pool[i], g = new THREE.Group(), h = makers[name](g);
      g.position.set(AX - 1 + 0.5 * i, 2.95, i % 2 ? 0.35 : -0.35); label(name, 0.26, 0, 0.42, 0, g); group.add(g);
      cur = { g, name, d, h, y: 2.95, vy: 0, wet: false }; guess = null; phase = 'ask';
      rRound.set(`${i + 1} / 5`); rRight.set(String(right)); rDen.set(hard ? String(d) : '?'); rUnder.set('–');
      ctx.say(hard ? `Round ${i + 1}: the ${name} has a density of ${d} kg/m³. Will it float or sink?` : `Round ${i + 1}: will the ${name} float or sink?`);
    }
    function choose(g) {
      if (phase !== 'ask') return;
      guess = g; phase = 'drop'; t = 0; live.push(cur);
    }
    function reveal() {
      const { name, d } = cur, floats = model.floats(d), ok = (guess === 'float') === floats;
      if (ok) right++;
      phase = 'shown'; rRight.set(String(right)); rDen.set(String(d)); rUnder.set(floats ? (model.under(d) * 100).toFixed(0) : '100 (on the bottom)');
      const pct = (model.under(d) * 100).toFixed(0);
      ctx.say((ok ? 'Yes! ' : 'Not this time. ') + (floats
        ? `The ${name} floats. It is lighter than the same amount of water (${d} against 1000), so the water pushes it up. About ${pct} parts in 100 of it sit under the water.`
        : `The ${name} sinks. It is heavier than the same amount of water (${d} against 1000), so the push of the water is not enough to hold it up.`) + ' Press Next.');
    }
    function next() {
      if (phase !== 'shown') return;
      i++;
      if (i < pool.length) return show();
      phase = 'done'; roundsDone = true; rRound.set('5 / 5');
      if (!hard) { finished = true; ctx.say(`${right} out of 5! Things lighter than water float, things heavier than water sink. Now try the boat: how many boxes can it carry?`); ctx.complete(right / 5, 'Predicted floating and sinking by comparing things with water.'); }
      else ctx.say(`${right} out of 5. Now load the boat: each box pushes it 1.25 cm deeper. Fill it right up to the white line, then set sail.`);
    }
    function drawBoat() {
      const sunk = cargo > cap, deep = model.draught(cargo);
      crates.forEach((c, k) => { c.visible = k < cargo; });
      rBox.set(String(cargo)); rDeep.set(sunk ? 'under water' : (deep * 100).toFixed(2)); rDry.set(sunk ? '0' : ((side - deep) * 100).toFixed(2));
    }
    function addBox() {
      if (cargo > cap) return ctx.say('The boat is on the bottom. Press Empty to lift it out and try again.');
      cargo++; drawBoat();
      if (cargo > cap) { sinks++; ctx.say(`Glug! Too heavy. With ${cargo} boxes the boat would need to sit ${(model.draught(cargo) * 100).toFixed(2)} cm deep, but its side is only ${(side * 100).toFixed(2)} cm high. It pushed away all the water it could, and one more box was too much. Press Empty.`); }
      else if (cargo === cap) ctx.say(`The water is at the white line. The boat and its ${cargo} boxes weigh ${cargo + 1} kg, and it has pushed aside ${cargo + 1} kg of water. Only ${((side - model.draught(cargo)) * 100).toFixed(2)} cm of side is still dry.`);
      else ctx.say(`Each 1 kg box makes the boat push aside 1 kg more water, so it sinks 1.25 cm deeper. It now sits ${(model.draught(cargo) * 100).toFixed(2)} cm deep.`);
    }
    function empty() { cargo = 0; drawBoat(); ctx.say('The boat is empty and floats high again. It only has to push aside 1 kg of water now.'); }
    function setSail() {
      if (finished) return;
      if (cargo > cap) return ctx.say('The boat cannot sail from the bottom of the tank. Press Empty first.');
      if (!roundsDone) return ctx.say('Finish the five float-or-sink rounds first, then sail.');
      if (cargo < cap) return ctx.say(`The boat floats, but it could carry more: ${((side - model.draught(cargo)) * 100).toFixed(2)} cm of side is still dry and each box needs 1.25 cm. Load it up to the white line.`);
      finished = true;
      ctx.say(`Full and floating! The boat carries ${cap} boxes because it pushes aside ${cap + 1} kg of water, exactly its own weight with the cargo. That is how real ships are loaded.`);
      ctx.complete(Math.max(0.2, 0.7 * right / 5 + (sinks === 0 ? 0.3 : 0.15)), `right=${right}/5, boxes=${cap}, sinkings=${sinks}`);
    }

    drawBoat(); show();
    return {
      step(dt) {
        clock += dt;
        // the dropped things: weight down, the push of the water up, and water drag
        for (const o of live) {
          const sub = Math.max(0, Math.min(1, (WY - (o.y - o.h / 2)) / o.h));
          if (sub > 0 && !o.wet) { o.wet = true; splashT = 0; splash.position.set(o.g.position.x, WY + 0.01, o.g.position.z); }
          const a = -7 + 7 * (WATER / o.d) * sub - (sub > 0 ? (ctx.calm ? 9 : 4) * o.vy : 0);
          o.vy += a * dt; o.y += o.vy * dt;
          const low = FLOOR + o.h / 2; if (o.y < low) { o.y = low; o.vy = 0; }
          o.g.position.y = o.y;
        }
        if (splashT < 1) { splashT += dt * 1.6; splash.visible = splashT < 1; splash.scale.setScalar(0.6 + splashT * 1.6); }
        if (phase === 'drop') { t += dt; if (t >= 2.4) reveal(); }
        // the boat settles to its new depth, or to the bottom
        const sunk = cargo > cap, wantY = sunk ? FLOOR + 0.02 : WY - model.draught(cargo) * S + (ctx.calm ? 0 : Math.sin(clock * 1.7) * 0.012);
        boatY += (wantY - boatY) * Math.min(1, dt * (sunk ? 1.6 : 4)); boatTilt += ((sunk ? 0.1 : 0) - boatTilt) * Math.min(1, dt * 2);
        boat.position.y = boatY; boat.rotation.z = boatTilt;
        if (auto && !finished) {
          autoT += dt; if (autoT < 0.45) return; autoT = 0;
          if (phase === 'ask') choose(model.floats(cur.d) ? 'float' : 'sink');
          else if (phase === 'shown') next();
          else if (phase === 'done' && hard) { if (cargo > cap) empty(); else if (cargo < cap) addBox(); else setSail(); }
        }
      },
      frame(dt, time) {
        if (phase === 'ask' && cur && !ctx.calm) { cur.g.rotation.y += dt * 0.8; cur.g.position.y = 2.95 + Math.sin(time * 2) * 0.04; }
        if (!ctx.calm) { flag.rotation.y = Math.sin(time * 3) * 0.3; ring.rotation.y = Math.sin(time * 0.9) * 0.4; }
      },
      // Shows a successful run without the player (used by tests): the right guess each round, then a full boat.
      autoplay() { auto = true; autoT = 0; },
      dispose() { for (const m of own) m.dispose(); },
      get state() { return phase; },
    };
  },
};
