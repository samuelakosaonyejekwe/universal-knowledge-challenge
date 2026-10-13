// World 12 — Economics: the Riverside Token Market.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: one market for bread with straight-line demand and supply, and a tax per loaf -----
// Shoppers want Qd = a − b·P loaves at price P. Bakers bring Qs = c + d·(P − tax): they plan with what they keep.
const A0 = 100, B = 10, C = 10, D = 5;      // loaves, loaves per token, loaves, loaves per token
const FESTIVAL = 30;                        // extra loaves wanted at every price on a festival day
const CAP = 5;                              // the price ceiling the council can switch on, tokens per loaf
export const model = {
  a: A0, b: B, c: C, d: D, festival: FESTIVAL, cap: CAP,
  demand: (price, a = A0) => Math.max(0, a - B * price),
  supply: (price, tax = 0) => Math.max(0, C + D * (price - tax)),
  // Where the two lines cross: P* = (a − c + d·tax) / (b + d).
  equilibrium(a = A0, tax = 0) { const price = (a - C + D * tax) / (B + D); return { price, keep: price - tax, loaves: a - B * price }; },
  // How a tax is shared: shoppers pay d/(b + d) of it, bakers lose b/(b + d) of it. The side that reacts less pays more.
  incidence: (tax) => ({ shoppers: tax * D / (B + D), bakers: tax * B / (B + D) }),
  // One market day at a chosen price (a ceiling, when given, holds the price down).
  day(asked, a = A0, tax = 0, cap = null) {
    const price = cap == null ? asked : Math.min(asked, cap);
    const wanted = Math.round(this.demand(price, a)), offered = Math.round(this.supply(price, tax)), sold = Math.min(wanted, offered);
    return { price, keep: price - tax, wanted, offered, sold, left: offered - sold, short: wanted - sold, taxPaid: tax * sold };
  },
};
// Used by the automated tests: the crossing points and the tax split must match the sums done by hand.
export function selfTest() {
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  const e0 = model.equilibrium(100, 0), e1 = model.equilibrium(100, 3), e2 = model.equilibrium(130, 0), e3 = model.equilibrium(130, 3), inc = model.incidence(3);
  const high = model.day(8), capped = model.day(9, 100, 0, CAP), taxed = model.day(7, 100, 3);
  const ok = near(e0.price, 6) && near(e0.loaves, 40) && near(e1.price, 7) && near(e1.keep, 4) && near(e1.loaves, 30)
    && near(e2.price, 8) && near(e2.loaves, 50) && near(e3.price, 9) && near(e3.keep, 6) && near(e3.loaves, 40)
    && near(model.demand(7), model.supply(7, 3)) && near(model.demand(9, 130), model.supply(9, 3))
    && near(inc.shoppers, 1) && near(inc.bakers, 2) && near(inc.bakers / inc.shoppers, B / D) && near(e1.price - e0.price, inc.shoppers) && near(e0.price - e1.keep, inc.bakers)
    && high.offered === 50 && high.wanted === 20 && high.left === 30 && capped.price === 5 && capped.offered === 35 && capped.wanted === 50 && capped.short === 15
    && taxed.sold === 30 && taxed.left === 0 && taxed.short === 0 && taxed.taxPaid === 90;
  return { ok, detail: `no tax: ${e0.price} tokens, ${e0.loaves} loaves; tax 3: ${e1.price} tokens, bakers keep ${e1.keep}, ${e1.loaves} loaves, tax paid ${taxed.taxPaid}; split bakers ${inc.bakers} : shoppers ${inc.shoppers} = b:d = ${B}:${D}; festival: ${e2.price} tokens, ${e2.loaves} loaves; festival + tax: ${e3.price} tokens, ${e3.loaves} loaves; price 8: ${high.left} left over; cap 5: ${capped.short} short` };
}

const sim = {
  title: 'The bread market',
  goal: 'Set the price of a loaf and open the market. Find the price where no loaves are left over and no shopper goes home without bread.',
  kind: 'validated',
  model: 'A textbook market with two straight lines. Shoppers want 100 loaves minus 10 for every token of price (130 on a festival day). Bakers bring 10 loaves plus 5 for every token they keep after tax. The lines cross at price = (a − c + d × tax) ÷ (b + d), and a tax is shared in the ratio b : d. These answers are exact for this model and are checked by hand-worked sums. Real markets are not straight lines and people are not identical: some shoppers love bread and some do not, bakers have different ovens and costs, prices change slowly, and people also think about quality, habit and fairness. Money here is the game\'s pretend tokens.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level, live = L < 5;
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const label = (text, size, x, y, z) => { const s = ctx.sprite(text, { size }); s.position.set(x, y, z); group.add(s); return s; };

    // the stall: a trestle table with loaves; each loaf shown stands for five
    add(new THREE.BoxGeometry(3.8, 0.12, 1.0), ctx.mat('#b98045'), 0, 0.8, 1.2);
    for (const sx of [-1.6, 1.6]) add(new THREE.BoxGeometry(0.14, 0.74, 0.8), ctx.mat('#8a5a3a'), sx, 0.37, 1.2);
    add(new THREE.BoxGeometry(3.8, 0.4, 0.04), ctx.mat('#3bc9db'), 0, 0.62, 1.71);
    const loafGeo = new THREE.CapsuleGeometry(0.11, 0.2, 4, 8), loafMat = ctx.mat('#d9903d', { roughness: 0.9 });
    const loaves = Array.from({ length: 14 }, (_, i) => { const m = add(loafGeo, loafMat, -1.5 + (i % 7) * 0.5, 0.97, i < 7 ? 1.0 : 1.4); m.rotation.z = Math.PI / 2; m.visible = false; return { m, x: m.position.x, z: m.position.z }; });

    // bakers (supply) on the left, shoppers (demand) on the right; each figure stands for about ten loaves
    const bodyGeo = new THREE.CapsuleGeometry(0.13, 0.3, 4, 10), headGeo = new THREE.SphereGeometry(0.115, 12, 10), hatGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.15, 10), bagGeo = new THREE.BoxGeometry(0.15, 0.11, 0.11);
    const skins = ['#f1c9a5', '#c68a5b', '#8d5a3b', '#e3b08a'], coats = ['#e8590c', '#7048e8', '#2f9e44', '#d6336c', '#1c7ed6', '#f08c00'];
    const figure = (i, x, z, baker) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(0.5); group.add(g);
      add(bodyGeo, ctx.mat(baker ? '#f4f1ea' : coats[i % coats.length]), 0, 0.33, 0, g); add(headGeo, ctx.mat(skins[(i + (baker ? 1 : 0)) % skins.length]), 0, 0.74, 0, g);
      if (baker) add(hatGeo, ctx.mat('#ffffff'), 0, 0.9, 0, g); else add(bagGeo, ctx.mat('#b98045'), 0.17, 0.36, 0.06, g);
      return { g, i, x, z, on: false, served: false };
    };
    const bakers = Array.from({ length: 8 }, (_, i) => figure(i, -3.15 + (i % 4) * 0.55, -0.3 - Math.floor(i / 4) * 0.65, true));
    const shoppers = Array.from({ length: 12 }, (_, i) => figure(i, 0.55 + (i % 6) * 0.5, -0.3 - Math.floor(i / 6) * 0.65, false));
    label('Bakers', 0.3, -2.3, 1.35, -0.6); label('Shoppers', 0.3, 1.8, 1.35, -0.6);

    // the chart behind: price up the side, loaves along the bottom, a line for supply and a line for demand
    const QM = 130, PM = 13, ZC = -2.2, X = (q) => -1.9 + (q / QM) * 3.8, Y = (p) => 2.0 + (p / PM) * 2.6;
    add(new THREE.BoxGeometry(4.8, 3.5, 0.08), ctx.mat('#0f3d4a', { roughness: 0.9 }), 0, 3.3, ZC - 0.1);
    const rod = (color, thick, glowing) => add(new THREE.BoxGeometry(1, thick, thick), glowing ? ctx.lit(color, glowing) : ctx.mat(color), 0, 0, ZC);
    const span = (m, q0, p0, q1, p1) => { const x0 = X(q0), y0 = Y(p0), x1 = X(q1), y1 = Y(p1); m.position.x = (x0 + x1) / 2; m.position.y = (y0 + y1) / 2; m.scale.x = Math.max(0.001, Math.hypot(x1 - x0, y1 - y0)); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); };
    span(rod('#e9f7f9', 0.035), 0, 0, QM, 0); span(rod('#e9f7f9', 0.035), 0, 0, 0, PM);
    const supplyLine = rod('#3bc9db', 0.06, 0.7), demandLine = rod('#ffa94d', 0.06, 0.7), priceBar = rod('#ffd43b', 0.045, 1.3), capLine = rod('#f783ac', 0.03, 0.9);
    const overBar = rod('#ff922b', 0.11, 1.0), shortBar = rod('#748ffc', 0.11, 1.0);
    for (const m of [priceBar, capLine, overBar, shortBar]) m.castShadow = false;
    priceBar.position.z = ZC + 0.04; overBar.position.z = shortBar.position.z = ZC + 0.06;
    const dotGeo = new THREE.SphereGeometry(0.09, 12, 10), dotS = add(dotGeo, ctx.lit('#3bc9db', 1.2), 0, 0, ZC + 0.08), dotD = add(dotGeo, ctx.lit('#ffa94d', 1.2), 0, 0, ZC + 0.08);
    label('Price, tokens', 0.24, -1.55, 4.78, ZC + 0.05); label('Loaves', 0.24, 1.75, 1.8, ZC + 0.05); label('Supply', 0.26, X(60), Y(12.4), ZC + 0.1); label('Demand', 0.26, X(104), Y(1.6), ZC + 0.1);
    for (const p of [4, 8, 12]) label(String(p), 0.2, X(0) - 0.2, Y(p), ZC + 0.05);
    for (const q of [50, 100]) label(String(q), 0.2, X(q), Y(0) - 0.17, ZC + 0.05);

    let price = 3, tax = 0, fest = false, cap = false, who = 'none', state = 'ready', tAnim = 0, tries = 0, day = null, nLoaf = 0, nSold = 0, nServed = 0;
    const a = () => A0 + (fest ? FESTIVAL : 0);
    const priceS = ui.slider({ label: 'Price of a loaf', min: 1, max: 12, step: 0.2, value: price, unit: 'tokens', onInput: (v) => { price = Math.round(v * 5) / 5; changed(); } });
    if (L >= 3) ui.choice([[0, 'Ordinary day'], [1, '🎉 Festival day']], 0, (v) => { fest = !!v; changed(); });
    const taxS = L >= 4 ? ui.slider({ label: 'Town tax on each loaf', min: 0, max: 4, step: 1, value: 0, unit: 'tokens', onInput: (v) => { tax = Math.round(v); changed(); } }) : null;
    if (L >= 5) ui.choice([[0, 'No price cap'], [1, `Price cap: ${CAP} tokens`]], 0, (v) => { cap = !!v; changed(); });
    if (L >= 4) ui.choice([['none', 'Who pays a tax of 3?'], ['b1', 'Shoppers 1, bakers 2'], ['half', 'Half each'], ['b2', 'Shoppers 2, bakers 1'], ['b3', 'Shoppers all 3']], 'none', (v) => { who = v; });
    const rP = ui.readout('Shoppers pay, tokens'), rK = L >= 4 ? ui.readout('Bakers keep, tokens') : null, rO = ui.readout('Loaves offered'), rW = ui.readout('Loaves wanted'), rS = ui.readout('Loaves sold'), rL = ui.readout('Left over'), rSh = ui.readout('Shortage'), rT = L >= 4 ? ui.readout('Tax collected, tokens') : null;
    const fix = (v) => String(+v.toFixed(1));

    // Draws the two lines for a day with this much demand and this tax.
    const lines = (aa, tx) => {
      span(demandLine, aa - B * Math.max(0, (aa - QM) / B), Math.max(0, (aa - QM) / B), aa - B * Math.min(PM, aa / B), Math.min(PM, aa / B));
      const p0 = Math.max(0, tx - C / D); span(supplyLine, model.supply(p0, tx), p0, model.supply(PM, tx), PM);
    };
    // Shows one day's numbers on the chart, the stall, the figures and the readouts (null hides them).
    const show = (r) => {
      const shownPrice = cap ? Math.min(price, CAP) : price;
      span(priceBar, 0, shownPrice, QM, shownPrice); capLine.visible = cap; if (cap) span(capLine, 0, CAP, QM, CAP);
      rP.set(fix(shownPrice)); rK?.set(fix(shownPrice - tax));
      dotS.visible = dotD.visible = !!r; overBar.visible = !!r && r.left > 0; shortBar.visible = !!r && r.short > 0;
      nLoaf = r ? Math.min(14, Math.round(r.offered / 5)) : 0; nSold = r ? Math.min(nLoaf, Math.round(r.sold / 5)) : 0; nServed = r ? Math.round(r.sold / 10) : 0;
      bakers.forEach((f) => { f.on = !!r && f.i < Math.round(r.offered / 10); }); shoppers.forEach((f) => { f.on = !!r && f.i < Math.round(r.wanted / 10); f.served = f.on && f.i < nServed; });
      if (!r) { for (const x of [rO, rW, rS, rL, rSh, rT]) x?.set('?'); return; }
      dotS.position.set(X(r.offered), Y(r.price), ZC + 0.08); dotD.position.set(X(r.wanted), Y(r.price), ZC + 0.08);
      if (r.left > 0) span(overBar, r.wanted, r.price, r.offered, r.price); if (r.short > 0) span(shortBar, r.offered, r.price, r.wanted, r.price);
      rO.set(r.offered); rW.set(r.wanted); rS.set(state === 'ready' ? '–' : r.sold); rL.set(state === 'ready' ? '–' : r.left); rSh.set(state === 'ready' ? '–' : r.short); rT?.set(state === 'ready' ? '–' : r.taxPaid);
    };
    // At the lower levels the chart follows the controls; at the top levels the player must predict before opening.
    const changed = () => { state = 'ready'; tAnim = 0; if (live) { lines(a(), tax); show(model.day(price, a(), tax, cap ? CAP : null)); } else show(null); };
    const open = () => { day = model.day(price, a(), tax, cap ? CAP : null); tries++; tAnim = 0; state = 'trade'; lines(a(), tax); show(day); };
    ui.button('🔔 Open the market', open, 'btn');
    ui.note(`Shoppers want 100 loaves, minus 10 for every token of price${L >= 3 ? ' (130 on a festival day)' : ''}. Bakers bring 10 loaves, plus 5 for every token they keep${L >= 4 ? ' after the tax' : ''}. Each loaf on the stall stands for 5, and each figure for about 10.`);
    lines(A0, 0); changed();
    const needFest = L === 3 || L >= 5, needTax = L >= 4 ? 3 : 0, tol = L === 1 ? 6 : L <= 3 ? 3 : 0;
    ctx.say(L <= 2 ? 'Choose a price, then ring the bell. A surplus means bread is left over. A shortage means shoppers go without.'
      : L === 3 ? 'It is a festival day, so more people want bread at every price. Switch the festival on and find the new price that clears the market.'
        : L === 4 ? 'The town asks for a tax of 3 tokens on each loaf. Set the tax to 3, find the price that clears the market, and tell me who really pays.'
          : 'Festival day, and a tax of 3 tokens on each loaf. The chart waits until the bell rings, so work out the price first. Then tell me who really pays the tax.');

    const finish = () => {
      state = 'done';
      const r = day, gap = r.offered - r.wanted, held = cap && price > CAP ? `The price cap holds the price at ${CAP} tokens. ` : '';
      if (gap > tol) return ctx.say(`${held}At ${fix(r.price)} tokens the bakers bring ${r.offered} loaves but shoppers want only ${r.wanted}. ${r.left} loaves are left over: that is a surplus. A lower price brings more shoppers and fewer loaves.`);
      if (gap < -tol) return ctx.say(`${held}At ${fix(r.price)} tokens shoppers want ${r.wanted} loaves but the bakers bring only ${r.offered}. Shoppers go without ${r.short} loaves: that is a shortage. ${cap ? 'A cap below the clearing price keeps bread cheap, but there is not enough of it. Switch the cap off to clear the market.' : 'A higher price brings more loaves and fewer shoppers.'}`);
      if (fest !== needFest || tax !== needTax) return ctx.say(`That price clears this market: ${r.sold} loaves sold. But today's task is ${needFest ? 'a festival day' : 'an ordinary day'} with ${needTax ? 'a tax of 3 tokens' : 'no tax'}. Set that and try again.`);
      const clear = gap === 0 ? `At ${fix(r.price)} tokens the market clears: ${r.sold} loaves offered, ${r.sold} wanted, none left over and nobody without bread.` : `Close enough! At ${fix(r.price)} tokens only ${Math.abs(gap)} loaves are ${gap > 0 ? 'left over' : 'missing'}. The lines cross exactly at ${fix(model.equilibrium(a(), tax).price)} tokens.`;
      if (L < 4) { ctx.say(`${clear} That price is called the equilibrium.${fest ? ' The festival pushed demand up, so both the price and the number of loaves rose.' : ''}`); return ctx.complete(gap === 0 ? 1 : 0.8, `P=${r.price}, gap=${gap}, tries=${tries}`); }
      if (who === 'none') return ctx.say(`${clear} Now choose who really pays the tax, and ring the bell again.`);
      const e0 = model.equilibrium(a(), 0), inc = model.incidence(tax);
      const split = `Without the tax the price would be ${fix(e0.price)} tokens. Now shoppers pay ${fix(r.price)}, which is ${fix(inc.shoppers)} more, and bakers keep ${fix(r.keep)}, which is ${fix(inc.bakers)} less. Shoppers change their plans faster than bakers here, so the bakers carry more of the tax.`;
      ctx.say(`${clear} ${who === 'b1' ? 'And you are right about the tax.' : 'But look again at who pays.'} ${split} The town collects ${r.taxPaid} tokens.`);
      ctx.complete(who !== 'b1' ? 0.7 : L === 6 && tries > 3 ? 0.85 : 1, `P=${r.price}, who=${who}, tries=${tries}`);
    };
    const DUR = ctx.calm ? 0.8 : 2.6;
    return {
      step(dt) { if (state !== 'trade') return; tAnim += dt; if (tAnim >= DUR) finish(); },
      frame(dt, time) {
        const f = Math.min(1, dt * 6), trading = state !== 'ready';
        for (const b of bakers) b.g.scale.setScalar(b.g.scale.x + ((b.on ? 1 : 0.5) - b.g.scale.x) * f);
        for (const s of shoppers) {
          s.g.scale.setScalar(s.g.scale.x + ((s.on ? 1 : 0.5) - s.g.scale.x) * f);
          s.g.position.y = trading && s.served && state === 'trade' && !ctx.calm ? Math.abs(Math.sin(time * 5 + s.i)) * 0.1 : 0;
          s.g.rotation.y = trading && s.on && !s.served && !ctx.calm ? Math.sin(time * 1.6 + s.i) * 0.5 : 0;
        }
        loaves.forEach((l, i) => {
          l.m.visible = i < nLoaf;
          let u = trading && i < nSold ? Math.min(1, Math.max(0, (tAnim / DUR * 2.6 - 0.3 - i * 0.07) / 1.1)) : 0; u = u * u * (3 - 2 * u);
          const to = shoppers[i % Math.max(1, nServed)];
          l.m.position.set(l.x + (to.x + 0.17 - l.x) * u, 0.97 + (0.52 - 0.97) * u + Math.sin(Math.PI * u) * 0.9, l.z + (to.z + 0.06 - l.z) * u);
        });
      },
      // Shows a successful run without the player (used by tests).
      autoplay() { fest = needFest; tax = needTax; cap = false; who = 'b1'; price = model.equilibrium(a(), tax).price; priceS.set(price); taxS?.set(tax); changed(); open(); },
      get state() { return state; },
    };
  },
};

export default {
  id: 12,
  theme: {
    sky: ['#0b7285', '#66d9e8', '#fff3bf'], fog: '#a5e3ea', fogNear: 60, fogFar: 185,
    ground: '#cdbb9c', ground2: '#ddcdb0', side: '#8c7358', stone: '#e8dfcb', accent: '#0b7285', glow: '#ffd43b', metal: '#5c6b73', wood: '#a8703c', leaf: '#5fbf5a', water: '#3bc9db', crate: '#e8a85a',
    sun: '#fff4d6', sunPower: 2.7, ambient: 1.5, skyLight: '#dff9ff', groundLight: '#b89a6a', sunDir: [-0.45, 1, 0.3], particles: 'leaves',
  },
  layout: { shape: 'hook', mirror: -1, stones: 4, rise: 0.35, towerH: 4.5 },
  story: {
    title: 'The Riverside Token Market',
    crystal: 'market tokens', crystalEm: '🪙',
    intro: ['Welcome to the Riverside Market! Every morning our bell rings and the bakers set out their bread.', 'But the five golden market tokens that help us set fair prices have rolled away. Now some days bread is left over, and some days shoppers go home with empty baskets.'],
    remind: 'The market tokens shine gold. One sits over the stepping stones, one floats in the river pool, and one waits on top of the mill tower.',
    afterCrystals: 'All five tokens! Now ride the lift from the mill tower to the bread stall and find the price that is fair for bakers and shoppers.',
    afterSim: 'The bread stall is busy and nobody goes without. Only the Master of the Market is left — the arena is up the steps.',
    notReady: 'The arena is for traders who have done the work. Bring all five market tokens and settle the bread market first.',
    rival: ['So you found one good price. A price is easy to guess. Knowing why it works is harder.', 'We each build a bridge of light, one piece for every right answer. Reach the far side before I do.'],
    win: ['Your bridge crossed the river before mine. A fair trade, well reasoned — the portal is yours.'],
    lose: ['My bridge is finished and yours is not. Read the tablets again, then come back and trade answers with me.'],
    outro: 'The bell rings, the windmill turns, and every stall has just enough for everyone. The Master of the Market has tipped a hat to you. The lesson is ready whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, wood = k.mat('#a8703c'), cream = k.mat('#f6ecd4'), gold = k.mat('#f2b830', { metalness: 0.6, roughness: 0.3 }), teal = k.mat('#0b7285');
    // the town hall with its clock, behind where the player starts
    k.prop('house', 3, 0, -7.2, { s: 1.15, color: '#f6e7c6', solid: true });
    k.mesh(new THREE.BoxGeometry(0.9, 1.7, 0.9), cream, 3, 3.3, -7.2); k.mesh(new THREE.ConeGeometry(0.8, 0.8, 4), teal, 3, 4.55, -7.2).rotation.y = Math.PI / 4;
    k.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), k.mat('#ffffff'), 3, 3.55, -6.73).rotation.x = Math.PI / 2;
    const hand = (len, w) => { const g = new THREE.BoxGeometry(w, len, 0.02); g.translate(0, len / 2, 0); const m = k.mesh(g, k.mat('#2b3a42'), 3, 3.55, -6.68); m.castShadow = false; return m; };
    const minute = hand(0.3, 0.04), hour = hand(0.2, 0.06);
    // the windmill: its sails turn in the river breeze
    k.prop('tower', -5.8, 0, -5.4, { s: 0.95, color: '#f4ecd8', solid: true });
    const hub = k.add(new THREE.Group()); hub.rotation.order = 'YXZ'; hub.position.set(-5.8 + Math.sin(0.82) * 1.0, 3.3, -5.4 + Math.cos(0.82) * 1.0); hub.rotation.y = 0.82;
    k.mesh(new THREE.SphereGeometry(0.2, 10, 8), wood, 0, 0, 0, hub);
    for (const r of [0, Math.PI / 2]) k.mesh(new THREE.BoxGeometry(0.5, 5, 0.05), cream, 0, 0, 0.12, hub).rotation.z = r;
    // two market stalls with awnings and crates of fruit
    const stall = (x, z, awning, fruit) => {
      const side = Math.sign(x);
      k.block(x, 0.85, z, 0.9, 0.85, 2.2, { color: '#a8703c' });
      for (const sz of [-1, 1]) k.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), wood, x + side * 0.4, 1.2, z + sz);
      k.mesh(new THREE.BoxGeometry(1.4, 0.08, 2.5), k.mat(awning), x - side * 0.1, 2.35, z).rotation.z = side * 0.22;
      k.mesh(new THREE.BoxGeometry(0.6, 0.26, 0.7), k.mat('#e8a85a'), x, 0.98, z);
      k.mesh(new THREE.IcosahedronGeometry(0.3, 1), k.mat(fruit, { flatShading: true }), x, 1.14, z).scale.set(0.85, 0.5, 1);
    };
    stall(7.4, 0.4, '#ff8787', '#fa5252'); stall(-7.0, 4.4, '#ffd43b', '#fd7e14');
    // wheat sheaves by the gate and beside the mill
    const sheaf = new THREE.CylinderGeometry(0.34, 0.12, 1.0, 9), straw = k.mat('#e9c46a', { flatShading: true });
    for (const [x, z] of [[-3.8, 7.2], [4.0, 7.0], [-7.6, -2.8]]) k.mesh(sheaf, straw, x, 0.5, z);
    // a balance scale on the middle island: tokens on one side, bread on the other, tipping slowly
    const mid = S.mid, bx = mid[0] - 3.6, bz = mid[2] - 3.4;
    k.mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.2, 16), k.mat('#5c6b73', { metalness: 0.4, roughness: 0.4 }), bx, mid[1] + 0.1, bz); k.mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.1, 8), gold, bx, mid[1] + 1.25, bz);
    const beam = k.mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), gold, bx, mid[1] + 2.3, bz);
    const pans = [-1.1, 1.1].map((px) => k.mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.1, 16), gold, px, -0.6, 0, beam));
    k.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 14), teal, 0, 0.16, 0, pans[0]);
    // stacks of token discs
    for (const [dx, dz, hh] of [[0, 0, 0.9], [0.62, 0.2, 0.55], [0.25, 0.66, 0.3]]) k.mesh(new THREE.CylinderGeometry(0.28, 0.28, hh, 16), gold, mid[0] + 4.5 + dx, mid[1] + hh / 2, mid[2] + 1.0 + dz);
    // the mill wheel beside the pool on the far island
    const far = S.far, rim = k.mesh(new THREE.TorusGeometry(1.3, 0.1, 6, 22), wood, far[0] + 4.7, far[1] + 1.55, far[2] - 1.6);
    for (const r of [0, Math.PI / 2]) k.mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), wood, 0, 0, 0, rim).rotation.z = r;
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; k.mesh(new THREE.BoxGeometry(0.45, 0.06, 0.5), wood, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0, rim).rotation.z = a; }
    k.mesh(new THREE.BoxGeometry(0.26, 1.6, 0.26), k.mat('#e8dfcb'), far[0] + 4.7, far[1] + 0.8, far[2] - 1.25);
    // a cargo cart of flour on the market island, well away from the stall floor
    const cx = S.sim[0] - 6.3, cy = S.sim[1], cz = S.sim[2] - 0.6;
    k.mesh(new THREE.BoxGeometry(1.0, 0.5, 1.7), wood, cx, cy + 0.75, cz); k.mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), wood, cx, cy + 0.7, cz - 1.3);
    for (const sx of [-0.58, 0.58]) k.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 14), k.mat('#5c6b73'), cx + sx, cy + 0.42, cz).rotation.z = Math.PI / 2;
    k.mesh(new THREE.SphereGeometry(0.42, 12, 8), k.mat('#efe6d0', { roughness: 1 }), cx, cy + 1.12, cz + 0.2).scale.set(1, 0.6, 1.5);
    // bar-chart planters: each one a step taller than the last
    [26, 37, 48].forEach((deg, i) => { const a = deg * Math.PI / 180, x = S.sim[0] + Math.sin(a) * 6.4, z = S.sim[2] + Math.cos(a) * 6.4, hh = 0.5 + i * 0.4; k.block(x, S.sim[1] + hh, z, 0.9, hh, 0.9, { color: i % 2 ? '#3bc9db' : '#0b7285' }); k.prop('bush', x, S.sim[1] + hh, z, { s: 0.8 }); });
    // market flags round the arena
    k.prop('banner', S.arena[0] + 5, S.arena[1], S.arena[2] + 3.4, { color: '#3bc9db' }); k.prop('banner', S.arena[0] - 4.4, S.arena[1], S.arena[2] - 4.1, { color: '#ffd43b' });
    k.animate((dt, t) => {
      hub.rotation.z += dt * 0.7; rim.rotation.z -= dt * 0.5;
      beam.rotation.z = Math.sin(t * 0.5) * 0.16; for (const p of pans) p.rotation.z = -beam.rotation.z;
      minute.rotation.z = -t * 0.3; hour.rotation.z = -t * 0.025;
    });
  },
  sim,
};
