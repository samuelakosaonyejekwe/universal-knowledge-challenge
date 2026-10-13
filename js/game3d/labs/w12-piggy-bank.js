// 3D lab — Piggy Bank: a see-through piggy bank that fills with coins week by week, a plate with this week's
// pocket money, a treat stand, and the toy waiting on a shelf. No imports: everything arrives through ctx.

// ----- the model: a fixed allowance each week, treats cost coins, the rest goes into the bank -----
export const model = {
  // Fewest weeks needed when the same number of coins is spent on treats every week.
  weeks: (price, allowance, treats = 0) => (allowance - treats > 0 ? Math.ceil(price / (allowance - treats)) : Infinity),
  // One week: what is left after treats goes into the bank.
  save: (bank, allowance, spent) => bank + allowance - Math.min(spent, allowance),
  // Counts the weeks one by one until the bank holds the price.
  count(price, allowance, treats = 0) { let bank = 0, week = 0; while (bank < price && week < 99) { bank = this.save(bank, allowance, treats); week++; } return { week, bank }; },
};
export function selfTest() {
  const a = model.count(14, 4), b = model.count(14, 4, 1), c = model.count(29, 5), d = model.count(29, 5, 2), e = model.count(12, 3);
  const ok = model.weeks(14, 4) === 4 && a.week === 4 && a.bank === 16 && model.weeks(14, 4, 1) === 5 && b.week === 5 && b.bank === 15
    && model.weeks(29, 5) === 6 && c.week === 6 && c.bank === 30 && model.weeks(29, 5, 2) === 10 && d.week === 10 && d.bank === 30
    && model.weeks(12, 3) === 4 && e.bank === 12 && model.save(6, 5, 2) === 9 && model.save(6, 3, 9) === 6 && model.weeks(10, 2, 2) === Infinity;
  return { ok, detail: `14 coins at 4 a week: ${a.week} weeks (${a.bank} saved); with a 1-coin treat each week: ${b.week} weeks; 29 coins at 5 a week: ${c.week} weeks; with a 2-coin treat each week: ${d.week} weeks; 12 coins at 3 a week: exactly ${e.week} weeks` };
}

export default {
  id: 'w12-piggy-bank',
  world: 12,
  levels: [1, 2],
  title: 'Piggy Bank',
  goal: 'Save your pocket money week by week until you can buy the toy.',
  kind: 'validated',
  model: 'A small pretend world: a fixed weekly allowance, fixed prices and no interest. The counting is exact: weeks needed = price ÷ coins saved each week, rounded up. Real saving also depends on prices changing and on what you really need.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level;
    const ri = (n) => Math.floor(ctx.rng() * n);
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const label = (text, size, x, y, z) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); group.add(s); return s; };

    // the numbers: level 1 is a whole number of weeks with nothing left over; level 2 uses the full range
    const allowance = 3 + ri(3);                                                        // coins per week
    const price = L <= 1 ? allowance * (3 + ri(2)) : allowance * (3 + ri(3)) + ri(allowance);   // coins
    const minWeeks = model.weeks(price, allowance), maxWeeks = minWeeks + 3;
    const TREATS = [['Sweet', 1], ['Ice cream', 2]];

    // ----- the see-through piggy bank -----
    const pig = new THREE.Group(); pig.position.set(-1.5, 0, -0.2); pig.rotation.y = 0.35; group.add(pig);
    const pink = ctx.mat('#ff8fb1', { roughness: 0.4 }), glass = ctx.mat('#ffb3cb', { transparent: true, opacity: 0.3, roughness: 0.15, depthWrite: false });
    const body = add(new THREE.SphereGeometry(1, 28, 20), glass, 0, 1.35, 0, pig); body.scale.set(1.3, 0.98, 0.98); body.castShadow = false;
    const snout = add(new THREE.CylinderGeometry(0.3, 0.34, 0.3, 16), pink, 1.36, 1.3, 0, pig); snout.rotation.z = Math.PI / 2;
    for (const z of [-0.36, 0.36]) { const ear = add(new THREE.ConeGeometry(0.2, 0.36, 10), pink, 0.75, 2.2, z, pig); ear.rotation.z = -0.4; add(new THREE.SphereGeometry(0.07, 10, 8), ctx.mat('#2b2130'), 1.12, 1.68, z * 0.9, pig); }
    for (const [x, z] of [[-0.7, -0.5], [-0.7, 0.5], [0.7, -0.5], [0.7, 0.5]]) add(new THREE.CylinderGeometry(0.16, 0.14, 0.55, 10), pink, x, 0.27, z, pig);
    const tail = add(new THREE.TorusGeometry(0.16, 0.05, 8, 16), pink, -1.36, 1.5, 0, pig);
    add(new THREE.BoxGeometry(0.5, 0.05, 0.12), ctx.mat('#2b2130'), 0, 2.34, 0, pig);       // the slot
    // the coins inside: nine stacks, filled layer by layer
    const POOL = 45, coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.07, 14), gold = ctx.mat('#ffd43b', { metalness: 0.6, roughness: 0.3 });
    const inside = new THREE.InstancedMesh(coinGeo, gold, POOL); inside.frustumCulled = false; pig.add(inside);
    const SLOT = 2.25, dummy = new THREE.Object3D();
    const coins = Array.from({ length: POOL }, (_, i) => { const s = i % 9, layer = Math.floor(i / 9); return { x: (s % 3 - 1) * 0.3, z: (Math.floor(s / 3) - 1) * 0.28, ty: 0.62 + layer * 0.075, y: SLOT, v: 0, wait: 0, on: false }; });

    // ----- this week's pocket money on a plate, and the treat stand -----
    const PLATE = new THREE.Vector3(-0.2, 0.62, 1.6);
    add(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 10), ctx.mat('#0f3d4a'), PLATE.x, 0.25, PLATE.z);
    add(new THREE.CylinderGeometry(0.62, 0.5, 0.08, 20), ctx.mat('#e9f7f9'), PLATE.x, 0.54, PLATE.z);
    const plate = Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2, home = new THREE.Vector3(PLATE.x + Math.cos(a) * 0.34, PLATE.y, PLATE.z + Math.sin(a) * 0.34); const m = add(coinGeo, gold, home.x, home.y, home.z); return { m, home, from: home.clone(), to: home.clone(), t: 1, s: 0, want: 0 }; });
    const STAND = [new THREE.Vector3(1.0, 0, 1.6), new THREE.Vector3(1.9, 0, 1.6)];
    add(new THREE.BoxGeometry(1.7, 0.5, 0.6), ctx.mat('#3bc9db'), 1.45, 0.25, 1.6);
    const sweet = new THREE.Group(); sweet.position.set(1.0, 0.5, 1.6); group.add(sweet);
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), ctx.mat('#ffffff'), 0, 0.25, 0, sweet); add(new THREE.SphereGeometry(0.2, 14, 10), ctx.mat('#e64980', { roughness: 0.3 }), 0, 0.62, 0, sweet);
    const ice = new THREE.Group(); ice.position.set(1.9, 0.5, 1.6); group.add(ice);
    const cone = add(new THREE.ConeGeometry(0.17, 0.5, 12), ctx.mat('#d9903d'), 0, 0.27, 0, ice); cone.rotation.x = Math.PI; add(new THREE.SphereGeometry(0.21, 14, 10), ctx.mat('#fff3bf', { roughness: 0.4 }), 0, 0.64, 0, ice);
    const treatObj = [sweet, ice], treatPop = [0, 0];
    label('1 coin', 0.22, 1.0, 1.55, 1.6); label('2 coins', 0.22, 1.9, 1.55, 1.6); label('This week', 0.22, PLATE.x, 1.15, PLATE.z);

    // ----- the shelf, the toy and the "how close am I" tube -----
    add(new THREE.BoxGeometry(1.9, 0.1, 0.8), ctx.mat('#b98045'), 2.2, 2.0, -0.6);
    for (const x of [1.45, 2.95]) add(new THREE.BoxGeometry(0.1, 2.0, 0.6), ctx.mat('#8a5a3a'), x, 1.0, -0.6);
    const toy = new THREE.Group(), toyHome = new THREE.Vector3(2.2, 2.05, -0.6), toyOut = new THREE.Vector3(0.6, 0.9, 0.4); toy.position.copy(toyHome); group.add(toy);
    const kind = ri(3);
    if (kind === 0) {             // a teddy bear
      const fur = ctx.mat('#b0703c', { roughness: 0.95 });
      add(new THREE.SphereGeometry(0.36, 16, 12), fur, 0, 0.36, 0, toy); add(new THREE.SphereGeometry(0.27, 16, 12), fur, 0, 0.9, 0, toy);
      for (const x of [-0.2, 0.2]) add(new THREE.SphereGeometry(0.1, 10, 8), fur, x, 1.13, 0, toy);
      add(new THREE.SphereGeometry(0.1, 10, 8), ctx.mat('#f1c9a5'), 0, 0.86, 0.22, toy);
    } else if (kind === 1) {      // a kite
      const k = add(new THREE.OctahedronGeometry(0.5), ctx.mat('#e8590c', { flatShading: true }), 0, 0.75, 0, toy); k.scale.set(0.8, 1.3, 0.16);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), ctx.mat('#ffffff'), 0, 0.2, 0, toy); add(new THREE.SphereGeometry(0.09, 10, 8), ctx.mat('#1c7ed6'), 0, 0.05, 0, toy);
    } else {                      // a toy boat
      add(new THREE.BoxGeometry(0.95, 0.24, 0.4), ctx.mat('#1c7ed6'), 0, 0.14, 0, toy); add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), ctx.mat('#8a5a3a'), 0, 0.7, 0, toy);
      const sail = add(new THREE.ConeGeometry(0.36, 0.7, 4), ctx.mat('#ffffff', { flatShading: true }), 0.02, 0.78, 0, toy); sail.scale.z = 0.12;
    }
    label(`Costs ${price} coins`, 0.34, 2.2, 3.75, -0.6);
    const TUBE = 2.6, tubeX = 3.3;
    const tube = add(new THREE.CylinderGeometry(0.2, 0.2, TUBE, 16), ctx.mat('#cfeef5', { transparent: true, opacity: 0.28, depthWrite: false }), tubeX, TUBE / 2 + 0.1, 0.6); tube.castShadow = false;
    const fill = add(new THREE.CylinderGeometry(0.15, 0.15, 1, 14), ctx.lit('#ffd43b', 0.8), tubeX, 0.1, 0.6);
    add(new THREE.TorusGeometry(0.24, 0.04, 8, 20), ctx.lit('#2f9e44', 1.0), tubeX, TUBE + 0.1, 0.6).rotation.x = Math.PI / 2;
    label('Enough!', 0.22, tubeX, TUBE + 0.45, 0.6);
    // one block for every week you may take
    const weekGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3), weekOff = ctx.mat('#48606a'), weekOn = ctx.lit('#3bc9db', 0.9);
    const weeks = Array.from({ length: maxWeeks }, (_, i) => add(weekGeo, weekOff, -3.2 + i * 0.4, 0.15, 2.3));

    let bank = 0, week = 0, weekSpent = 0, guess = null, bought = false, auto = false, autoT = 0, shown = 0, fillH = 0, buyT = 0;
    const rW = ui.readout('Week'), rB = ui.readout('In my piggy, coins'), rL = ui.readout('To use this week, coins'), rC = ui.readout('The toy costs, coins');
    const show = () => {
      rW.set(String(week)); rB.set(String(bank)); rL.set(String(allowance - weekSpent)); rC.set(String(price));
      plate.forEach((c, i) => { c.want = !bought && i < allowance - weekSpent ? 1 : 0; });
      const want = Math.min(POOL, bought ? bank - price : bank);
      for (let i = 0; i < POOL; i++) { const c = coins[i], on = i < want; if (on && !c.on) { c.y = SLOT; c.v = 0; c.wait = 0.45 + (i - shown) * 0.09; } c.on = on; }
      shown = want;
      weeks.forEach((m, i) => { m.material = i < week ? weekOn : weekOff; });
    };
    const fly = (c, to) => { c.from.copy(c.m.position); c.to.copy(to); c.t = 0; };
    const slotAt = () => new THREE.Vector3(pig.position.x, 2.5, pig.position.z);
    const setGuess = (v) => { guess = v || null; if (guess) ctx.say(`Your guess: ${guess} ${guess === 1 ? 'week' : 'weeks'}. Each week you get ${allowance} coins. Spend some on a treat, or save it all, then go to next week.`); };
    const spend = (i) => {
      const c = TREATS[i][1];
      if (guess === null) return ctx.say('Make your guess first!');
      if (bought) return;
      if (weekSpent + c > allowance) return ctx.say(`Not enough coins left this week: the ${TREATS[i][0].toLowerCase()} costs ${c} and you have ${allowance - weekSpent}.`);
      for (let k = 0; k < c; k++) fly(plate[allowance - weekSpent - 1 - k], new THREE.Vector3(STAND[i].x, 0.7, STAND[i].z));
      weekSpent += c; treatPop[i] = 1; show();
      ctx.say(`Yum! But that ${TREATS[i][0].toLowerCase()} used ${c} ${c === 1 ? 'coin' : 'coins'}, so only ${allowance - weekSpent} will go into the piggy bank this week. Coins you spend now cannot be saved for the toy.`);
    };
    const nextWeek = () => {
      if (guess === null) return ctx.say('Make your guess first!');
      if (bought) return;
      const kept = allowance - weekSpent;
      for (let k = 0; k < kept; k++) fly(plate[k], slotAt());
      bank = model.save(bank, allowance, weekSpent); weekSpent = 0; week++;
      for (let k = 0; k < allowance; k++) plate[k].s = 0;      // the old coins shrink away at the slot and new ones pop up on the plate
      show();
      if (bank >= price) ctx.say(`You have enough! ${bank} coins are in the piggy bank and the toy costs ${price}. Buy it!`);
      else if (week >= maxWeeks) ctx.say(`Time is up, with ${price - bank} coins still to go. Treats cost savings: start again with fewer treats.`);
      else ctx.say(`Week ${week}: ${kept} ${kept === 1 ? 'coin' : 'coins'} dropped in. ${price - bank} coins still to go. ${kept < allowance ? 'The treat made this week\'s saving smaller, so the wait gets longer.' : 'Saving the whole allowance is the fastest way.'}`);
    };
    const buy = () => {
      if (bought) return;
      if (guess === null) return ctx.say('Make your guess first!');
      if (bank < price) return ctx.say(`Not enough yet: you need ${price - bank} more ${price - bank === 1 ? 'coin' : 'coins'}. Keep saving.`);
      bought = true; buyT = 0; show();
      ctx.say(`You bought it in ${week} weeks! ${guess === minWeeks ? `Your guess of ${guess} weeks was exactly the fastest possible. ` : `The fastest possible was ${minWeeks} weeks, because ${price} coins at ${allowance} a week needs ${minWeeks} weeks. `}Saving means not spending now so you can afford something bigger later. Every treat you skip makes the wait shorter.`);
      ctx.complete(week <= maxWeeks ? (guess === minWeeks ? 1 : 0.85) : 0.6, `Saved ${price} coins in ${week} weeks.`);
    };
    const reset = () => { bank = 0; week = 0; weekSpent = 0; bought = false; guess = null; guessC.set?.(0); buyT = 0; toy.position.copy(toyHome); toy.rotation.set(0, 0, 0); plate.forEach((c) => { c.m.position.copy(c.home); c.t = 1; }); show(); ctx.say('A fresh start: the piggy bank is empty and it is week 0. Make your guess again.'); };

    ui.note(`The toy costs ${price} coins. Each week you get ${allowance} coins. Guess: how many weeks will it take if you save everything?`);
    const guessC = ui.choice([[0, '?'], ...Array.from({ length: 8 }, (_, i) => [i + 1, String(i + 1)])], 0, setGuess);
    ui.button('🍬 Sweet −1 coin', () => spend(0), 'btn ghost'); ui.button('🍦 Ice cream −2 coins', () => spend(1), 'btn ghost');
    ui.button('➡️ Next week: save what is left', nextWeek, 'btn gold'); ui.button('🎁 Buy the toy!', buy, 'btn ok'); ui.button('Start again', reset, 'btn ghost sm');
    ctx.onTap?.(body, nextWeek); ctx.onTap?.(sweet.children[1], () => spend(0)); ctx.onTap?.(ice.children[1], () => spend(1)); ctx.onTap?.(toy.children[0], buy);
    show();
    ctx.say('Pocket money comes every week. First guess how many weeks you need, then choose how much to spend and how much to save.');

    const G = 9.81;
    return {
      step(dt) {
        if (!auto || bought) return;
        autoT -= dt; if (autoT > 0) return; autoT = ctx.calm ? 0.2 : 0.7;
        if (guess !== minWeeks) { guess = minWeeks; guessC.set?.(minWeeks); } else if (bank < price) nextWeek(); else buy();
      },
      frame(dt, time) {
        const k = Math.min(1, dt * 8);
        // coins fall through the slot onto their stacks
        for (let i = 0; i < POOL; i++) {
          const c = coins[i];
          if (c.on) { if (c.wait > 0) c.wait -= dt; else if (c.y > c.ty) { c.v += G * dt; c.y = Math.max(c.ty, c.y - c.v * dt); } }
          dummy.position.set(c.x, c.y, c.z); dummy.scale.setScalar(c.on && c.wait <= 0 ? 1 : 0.0001); dummy.updateMatrix(); inside.setMatrixAt(i, dummy.matrix);
        }
        inside.instanceMatrix.needsUpdate = true;
        // plate coins hop to the slot or the treat stand, then new ones pop up
        for (const c of plate) {
          if (c.t < 1) { c.t = Math.min(1, c.t + dt * 2.4); c.m.position.lerpVectors(c.from, c.to, c.t); c.m.position.y += Math.sin(c.t * Math.PI) * 0.8; c.m.scale.setScalar(Math.max(0.001, c.t > 0.85 ? (1 - c.t) / 0.15 : 1)); if (c.t >= 1) { c.m.position.copy(c.home); c.s = 0; } }
          else { c.s += (c.want - c.s) * k; c.m.scale.setScalar(Math.max(0.001, c.s)); c.m.rotation.y = time * 1.5; }
        }
        for (let i = 0; i < 2; i++) { treatPop[i] = Math.max(0, treatPop[i] - dt * 1.6); treatObj[i].position.y = 0.5 + Math.sin(treatPop[i] * Math.PI) * 0.5; treatObj[i].rotation.y += dt * (0.5 + treatPop[i] * 9); }
        const target = Math.min(1, bank / price) * TUBE; fillH += (target - fillH) * Math.min(1, dt * 3);
        fill.scale.y = Math.max(0.001, fillH); fill.position.y = 0.1 + fillH / 2;
        tail.rotation.x = Math.sin(time * 3) * 0.4; pig.position.y = bank >= price && !bought ? Math.abs(Math.sin(time * 5)) * 0.06 : 0;
        if (bought) { buyT = Math.min(1, buyT + dt * 0.9); toy.position.lerpVectors(toyHome, toyOut, buyT); toy.position.y += Math.sin(buyT * Math.PI) * 1.2; toy.rotation.y += dt * 2.4; }
        else toy.rotation.y = Math.sin(time * 1.2) * 0.3;
      },
      autoplay() { auto = true; autoT = 0; if (bought || bank > 0 || week > 0) reset(); },
      dispose() { auto = false; },
    };
  },
};
