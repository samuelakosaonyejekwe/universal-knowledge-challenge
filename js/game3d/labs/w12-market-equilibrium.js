// 3D lab — Market Balance: one stall, a stack of crates the sellers offer, a queue of buyers, and two rails
// (demand and supply) that cross at the balance price. No imports: everything arrives through ctx.

// ----- the model: straight-line demand and supply (quantity in hundreds per day, price in coins) -----
// Buyers want Qd = A − b·P. Sellers offer Qs = −c + d·P. They are equal at P* = (A + c) / (b + d).
export const model = {
  demand: (A, b, p) => Math.max(0, A - b * p),
  supply: (c, d, p) => Math.max(0, -c + d * p),
  price: (A, b, c, d) => (A + c) / (b + d),
  quantity(A, b, c, d) { return A - b * this.price(A, b, c, d); },
  shift: (A) => Math.round(A * 0.25),            // how far the news moves a line, in hundreds per day
};
export function selfTest() {
  const near = (x, y) => Math.abs(x - y) < 1e-9, A = 95, b = 7, c = 10, d = 8;
  const p0 = model.price(A, b, c, d), q0 = model.quantity(A, b, c, d), sh = model.shift(A);
  const up = model.price(A + sh, b, c, d), down = model.price(A - sh, b, c, d), dear = model.price(A, b, c + sh, d);
  const ok = near(p0, 7) && near(q0, 46) && near(model.demand(A, b, 7), 46) && near(model.supply(c, d, 7), 46)
    && near(model.demand(A, b, 5) - model.supply(c, d, 5), 30) && near(model.supply(c, d, 9) - model.demand(A, b, 9), 30)
    && sh === 24 && near(up, 8.6) && near(down, 5.4) && near(dear, 8.6) && near(model.quantity(A + sh, b, c, d), 58.8) && near(model.quantity(A, b, c + sh, d), 34.8)
    && model.supply(c, d, 1) === 0 && model.demand(A, b, 15) === 0;
  return { ok, detail: `A=95, b=7, c=10, d=8: balance ${p0} coins, ${q0} hundred a day; price 5: shortage 30; price 9: surplus 30; demand +${sh}: ${up} coins; demand −${sh}: ${down} coins; supply −${sh}: ${dear} coins` };
}

const GOODS = [['strawberries', '#e03131'], ['ice creams', '#f783ac'], ['loaves', '#d9903d'], ['juices', '#f08c00']];
const fmt = (v) => String(+v.toFixed(1));

export default {
  id: 'w12-market-equilibrium',
  world: 12,
  levels: [3, 4],
  title: 'Market Balance',
  goal: 'Set the price where buyers want exactly as much as sellers offer, then handle a surprise.',
  kind: 'validated',
  model: 'Straight-line demand and supply for one product in a perfectly competitive market with no taxes, no stock-keeping and instant price changes. The balance price is (A + c) ÷ (b + d), exact for these lines and checked by hand-worked sums. Each crate and each buyer in the scene stands for a share of the day\'s trade. Real curves bend and shift for many reasons.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level;
    const ri = (a, b) => a + Math.floor(ctx.rng() * (b - a + 1));
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const label = (text, size, x, y, z) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); group.add(s); return s; };

    // the numbers, drawn the same way as the flat lab
    const good = GOODS[ri(0, GOODS.length - 1)];
    const bD = ri(5, 10), dS = ri(5, 10), Pstar0 = ri(4, 8);
    let cS = ri(5, 15), A = Math.round(cS + (bD + dS) * Pstar0);
    const QM = A * 1.32, PM = 16, N = 12;
    const eqP = () => model.price(A, bD, cS, dS), Qd = (p) => model.demand(A, bD, p), Qs = (p) => model.supply(cS, dS, p);

    // ----- the two rails at the back: price up, quantity across; demand in front, supply behind -----
    const X = (q) => -2.6 + (Math.min(q, QM) / QM) * 5.2, Y = (p) => 0.5 + (p / PM) * 4.0, ZD = -1.3, ZS = -1.9;
    const railGeo = new THREE.BoxGeometry(1, 0.1, 0.1);
    const span = (m, q0, p0, q1, p1) => { const x0 = X(q0), y0 = Y(p0), x1 = X(q1), y1 = Y(p1); m.position.x = (x0 + x1) / 2; m.position.y = (y0 + y1) / 2; m.scale.x = Math.max(0.001, Math.hypot(x1 - x0, y1 - y0)); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); };
    for (const x of [-2.85, 2.85]) add(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 10), ctx.mat('#0f3d4a'), x, 2.3, -1.6);
    const demandRail = add(railGeo, ctx.lit('#5b6cff', 0.6), 0, 0, ZD), supplyRail = add(railGeo, ctx.lit('#f5a000', 0.6), 0, 0, ZS);
    const ballGeo = new THREE.SphereGeometry(0.17, 16, 12), ballD = add(ballGeo, ctx.lit('#8f9bff', 1.3), 0, 0, ZD + 0.02), ballS = add(ballGeo, ctx.lit('#ffc34d', 1.3), 0, 0, ZS + 0.02);
    const priceBar = add(new THREE.BoxGeometry(5.7, 0.06, 0.5), ctx.mat('#ffd43b', { transparent: true, opacity: 0.55 }), 0, 0, -1.6); priceBar.castShadow = false;
    const gapBar = add(new THREE.BoxGeometry(1, 0.12, 0.12), ctx.lit('#ff6b6b', 1.0), 0, 0, -1.6); gapBar.castShadow = false;
    label('Demand: buyers', 0.3, -1.9, 4.75, ZD); label('Supply: sellers', 0.3, 1.9, 4.75, ZS); label('Price', 0.26, -3.25, 4.4, -1.6); label('Quantity', 0.26, 2.3, 0.25, -1.2);
    const rails = () => {
      span(demandRail, Qd(Math.max(0, (A - QM) / bD)), Math.max(0, (A - QM) / bD), Qd(Math.min(PM, A / bD)), Math.min(PM, A / bD));
      const p0 = Math.max(0, cS / dS), p1 = Math.min(PM, (QM + cS) / dS); span(supplyRail, Qs(p0), p0, Qs(p1), p1);
    };

    // ----- the stall, the sellers' crates on the left and the queue of buyers on the right -----
    add(new THREE.BoxGeometry(1.5, 0.8, 0.8), ctx.mat('#b98045'), 0, 0.4, 1.1);
    for (const x of [-0.68, 0.68]) add(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), ctx.mat('#8a5a3a'), x, 1.45, 1.1);
    const awning = add(new THREE.BoxGeometry(1.8, 0.1, 1.1), ctx.mat('#3bc9db'), 0, 2.12, 1.15); awning.rotation.x = 0.18;
    const bell = add(new THREE.SphereGeometry(0.2, 14, 10), ctx.lit('#ffd43b', 0.9), 0, 1.0, 1.3);
    const crateGeo = new THREE.BoxGeometry(0.38, 0.3, 0.38), crateMat = ctx.mat(good[1], { roughness: 0.85 });
    const crates = Array.from({ length: N }, (_, i) => { const col = Math.floor(i / 3), home = new THREE.Vector3(-1.5 - col * 0.46, 0.15 + (i % 3) * 0.31, 0.9 + (col % 2) * 0.25); const m = add(crateGeo, crateMat, home.x, home.y, home.z); m.scale.setScalar(0.001); return { m, home, s: 0, on: false }; });
    const bodyGeo = new THREE.CapsuleGeometry(0.14, 0.32, 4, 10), headGeo = new THREE.SphereGeometry(0.13, 12, 10);
    const coats = ['#7048e8', '#2f9e44', '#d6336c', '#1c7ed6', '#e8590c', '#0ca678'], skins = ['#f1c9a5', '#c68a5b', '#8d5a3b', '#e3b08a'];
    const buyers = Array.from({ length: N }, (_, i) => {
      const g = new THREE.Group(), home = new THREE.Vector3(1.25 + (i % 6) * 0.4, 0, 1.35 - Math.floor(i / 6) * 0.6); g.position.copy(home); g.scale.setScalar(0.001); group.add(g);
      add(bodyGeo, ctx.mat(coats[i % coats.length]), 0, 0.34, 0, g); add(headGeo, ctx.mat(skins[i % skins.length]), 0, 0.8, 0, g);
      return { g, home, s: 0, on: false };
    });
    label('Sellers offer', 0.28, -2.3, 1.45, 1.1); label('Buyers want', 0.28, 2.3, 1.45, 1.1);

    // a balance beam over the stall: it tips towards whichever side is bigger
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8), ctx.mat('#0f3d4a'), 0, 2.6, 0.4);
    const beam = add(new THREE.BoxGeometry(2.6, 0.08, 0.14), ctx.mat('#e9f7f9', { metalness: 0.3 }), 0, 3.05, 0.4);
    const panGeo = new THREE.CylinderGeometry(0.3, 0.2, 0.12, 14); add(panGeo, ctx.lit('#f5a000', 0.5), -1.2, -0.1, 0, beam); add(panGeo, ctx.lit('#5b6cff', 0.5), 1.2, -0.1, 0, beam);

    let price = 1, round = 1, shiftDir = 1, side = 'demand', pending = 0, shocked = false, dirGuess = null, done = false, state = 'ready', tAnim = 0, nSold = 0, tries = 0, auto = false, tilt = 0;
    const rP = ui.readout('Price, coins'), rD = ui.readout('Buyers want, hundreds a day'), rS = ui.readout('Sellers offer, hundreds a day'), rG = ui.readout('Gap, hundreds a day');
    const units = (q) => Math.max(0, Math.min(N, Math.round((q / QM) * N)));
    const update = () => {
      const qd = Qd(price), qs = Qs(price), gap = qd - qs;
      rP.set(fmt(price)); rD.set(fmt(qd)); rS.set(fmt(qs)); rG.set(Math.abs(gap) < 0.5 ? 'balanced' : gap > 0 ? `shortage ${fmt(gap)}` : `surplus ${fmt(-gap)}`);
      priceBar.position.y = Y(price); ballD.position.set(X(qd), Y(price), ZD + 0.02); ballS.position.set(X(qs), Y(price), ZS + 0.02);
      gapBar.visible = Math.abs(gap) >= 0.5; gapBar.position.set((X(qd) + X(qs)) / 2, Y(price), -1.6); gapBar.scale.x = Math.max(0.001, Math.abs(X(qd) - X(qs)));
      const nS = units(qs), nD = units(qd); crates.forEach((c, i) => { c.on = i < nS; }); buyers.forEach((b, i) => { b.on = i < nD; });
      tilt = Math.max(-0.42, Math.min(0.42, ((qs - qd) / QM) * 2.2)); state = 'ready'; tAnim = 0;
    };
    const priceS = ui.slider({ label: 'Price per item', min: 0, max: 16, step: 0.25, value: price, unit: 'coins', onInput: (v) => { price = Math.round(v * 4) / 4; update(); } });
    const open = () => { if (state === 'trade') return; update(); nSold = Math.min(units(Qd(price)), units(Qs(price))); tries++; state = 'trade'; tAnim = 0; };
    const predict = (v) => {
      if (round !== 2) return ctx.say('Wait for the news first. Find the balance price and open the market.');
      if (shocked) return ctx.say(`You already predicted that the price will ${dirGuess > 0 ? 'go up' : 'go down'}. Now move the price to the new balance and open the market.`);
      dirGuess = v; shocked = true; if (side === 'demand') A += pending; else cS += pending;
      rails(); update();
      ctx.say(`You predicted: the price will ${v > 0 ? 'go up' : 'go down'}. The ${side} rail has moved. Now slide the price to where the two rails cross again and open the market.`);
    };
    ui.button('🔔 Open the market', open, 'btn');
    ui.button('⬆️ The balance price will go up', () => predict(1), 'btn gold');
    ui.button('⬇️ The balance price will go down', () => predict(-1), 'btn gold');
    ui.note(`A stall sells ${good[0]}. The blue ball rides the demand rail: how much buyers want at this price. The orange ball rides the supply rail: how much sellers offer. Each crate and each buyer stands for a share of the day's trade.`);
    ctx.onTap?.(bell, open); ctx.onTap?.(awning, open);
    rails(); update();
    ctx.say('Move the price. If buyers want more than sellers offer there is a shortage; if sellers offer more, a surplus. Open the market when the two sides match.');

    const news = () => {
      if (side === 'demand') return shiftDir > 0 ? 'News: a festival means more people want to buy.' : 'News: a rival shop opens, so fewer people want to buy here.';
      return shiftDir > 0 ? 'News: supplies cost more, so sellers bring less at every price.' : 'News: a bumper harvest makes supplies cheap, so sellers bring more at every price.';
    };
    const judge = () => {
      state = 'done';
      const qd = Qd(price), qs = Qs(price);
      if (Math.abs(price - eqP()) > 0.3) {
        return ctx.say(qd > qs ? `At ${fmt(price)} coins buyers want ${fmt(qd)} hundred but sellers offer only ${fmt(qs)} hundred. Some buyers go home with nothing: a shortage. A higher price brings more sellers and puts some buyers off.`
          : `At ${fmt(price)} coins sellers offer ${fmt(qs)} hundred but buyers want only ${fmt(qd)} hundred. Crates are left unsold: a surplus. A lower price brings more buyers and fewer crates.`);
      }
      if (round === 1) {
        round = 2; shiftDir = ctx.rng() < 0.5 ? -1 : 1; side = L >= 4 && ctx.rng() < 0.5 ? 'supply' : 'demand';
        pending = model.shift(A) * shiftDir;      // demand: buyers want more or less; supply: the sellers' line moves the other way shocked = false; dirGuess = null;
        return ctx.say(`Balanced! At about ${fmt(eqP())} coins no one is left empty-handed and no stock is left unsold. Now something changes. ${news()} Predict: will the balance price go up or go down?`);
      }
      if (!shocked) return ctx.say(`${news()} First predict what happens to the balance price: up or down?`);
      if (done) return;
      done = true;
      const why = side === 'demand'
        ? (shiftDir > 0 ? 'More demand at every price makes the old price too low: buyers compete and the price rises until supply catches up.' : 'Less demand at every price leaves stock unsold at the old price, so the price must fall to clear the market.')
        : (shiftDir > 0 ? 'Less supply at every price leaves buyers short at the old price, so the price rises until fewer people want to buy.' : 'More supply at every price leaves crates unsold at the old price, so the price falls until buyers take them all.');
      ctx.say(`Found the new balance price: about ${fmt(eqP())} coins. ${dirGuess === shiftDir ? 'Your prediction was right.' : 'Your prediction was the other way round.'} ${why}`);
      ctx.complete(dirGuess === shiftDir ? 1 : 0.8, `Equilibrium moved to ${fmt(eqP())} coins, tries=${tries}`);
    };
    const DUR = ctx.calm ? 0.8 : 2.6, stallAt = new THREE.Vector3(0, 0.95, 1.1);
    return {
      step(dt) {
        if (state === 'trade') { tAnim += dt; if (tAnim >= DUR) judge(); return; }
        if (!auto || done) return;
        const target = () => { price = Math.round(eqP() * 4) / 4; priceS.set(price); open(); };
        if (round === 1) target(); else if (!shocked) predict(shiftDir); else target();
      },
      frame(dt, time) {
        const k = Math.min(1, dt * 6), trading = state !== 'ready', u = Math.min(1, tAnim / DUR);
        beam.rotation.z += (tilt - beam.rotation.z) * Math.min(1, dt * 3);
        crates.forEach((c, i) => {
          const sold = trading && c.on && i < nSold, p = sold ? Math.max(0, Math.min(1, u * (nSold + 2) - i)) : 0, want = c.on ? 1 - p : 0;
          c.s += (want - c.s) * k; c.m.scale.setScalar(Math.max(0.001, c.s));
          c.m.position.lerpVectors(c.home, stallAt, p); c.m.position.y += Math.sin(p * Math.PI) * 0.9;
          c.m.rotation.y = !sold && trading && c.on ? Math.sin(time * 6 + i) * 0.25 : 0;      // unsold crates wobble
        });
        buyers.forEach((b, i) => {
          b.s += ((b.on ? 1 : 0) - b.s) * k; b.g.scale.setScalar(Math.max(0.001, b.s));
          const served = trading && b.on && i < nSold, p = served ? Math.max(0, Math.min(1, u * (nSold + 2) - i)) : 0;
          b.g.position.copy(b.home); b.g.position.y = served ? Math.abs(Math.sin(p * Math.PI * 2)) * 0.35 : 0;
          b.g.rotation.z = trading && b.on && !served ? Math.sin(time * 5 + i) * 0.2 : 0;      // buyers left without sway
        });
        bell.rotation.z = state === 'trade' ? Math.sin(time * 18) * 0.5 : 0;
        ballD.scale.setScalar(1 + Math.sin(time * 4) * 0.08); ballS.scale.setScalar(1 + Math.cos(time * 4) * 0.08);
      },
      autoplay() { auto = true; },
      dispose() { auto = false; },
    };
  },
};
