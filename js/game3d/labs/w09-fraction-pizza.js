// World 9 lab — Fraction Pizza in 3D: a thick pizza on a tilted serving board. Tapped slices lift away and are eaten,
// and a tall glass beside it fills with the eaten share so that equal fractions reach the same height.
// No imports: everything arrives through the context, so the file also runs in tools/test-game3d.mjs.

const CUTS = [2, 3, 4, 6, 8];

// ----- the model: exact whole-number fraction logic -----
export const model = {
  gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; },
  // How many of n equal slices make num/den of the pizza (null when no whole number of slices does).
  needed: (num, den, n) => ((num * n) % den === 0 ? (num * n) / den : null),
  // k slices out of n are the same amount as num/den when the cross products agree.
  same: (k, n, num, den) => k * den === num * n,
  simplest(k, n) { const g = model.gcd(k, n) || 1; return [k / g, n / g]; },
  angle: (n) => (2 * Math.PI) / n,
};

export function selfTest() {
  const checks = [
    model.needed(1, 2, 8) === 4, model.needed(2, 3, 6) === 4, model.needed(3, 4, 8) === 6, model.needed(1, 2, 3) === null, model.needed(1, 3, 4) === null,
    model.same(2, 4, 1, 2), model.same(6, 8, 3, 4), !model.same(3, 8, 1, 2), !model.same(1, 3, 1, 2),
    model.simplest(6, 8).join('/') === '3/4', model.simplest(4, 6).join('/') === '2/3',
    CUTS.every((n) => Math.abs(n * model.angle(n) - 2 * Math.PI) < 1e-12),
  ];
  return { ok: checks.every(Boolean), detail: `1/2 of 8 slices = ${model.needed(1, 2, 8)}, 2/3 of 6 = ${model.needed(2, 3, 6)}, 3/4 of 8 = ${model.needed(3, 4, 8)}, 1/2 of 3 slices is impossible, 6/8 = ${model.simplest(6, 8).join('/')}` };
}

export default {
  id: 'w09-fraction-pizza',
  world: 9,
  levels: [1, 2],
  title: 'Fraction Pizza',
  goal: 'Eat exactly the fraction of the pizza that the mission asks for. Tap a slice to eat it, and tap its empty place to put it back.',
  kind: 'validated',
  model: 'The pizza is cut into equal slices, so each of n slices is exactly 1/n of the whole. Eating k slices is the fraction k/n, and it equals the mission fraction a/b exactly when k × b = a × n; that whole-number rule is what is checked. Every slice is cut exactly equal, which real pizzas rarely are. Only unit-slice fractions up to eighths are shown, and the pizza is eaten, never shared.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = ctx.level, rnd = ctx.rng || Math.random;
    const pickOf = (list) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
    const den = pickOf(L <= 1 ? [2, 4] : CUTS), num = 1 + Math.min(den - 2, Math.floor(rnd() * (den - 1)));
    let n = den;
    if (L >= 2) n = pickOf(CUTS.filter((x) => x % den === 0));
    const R = 1.55, RIN = R - 0.17, THICK = 0.22, GH = 3, GY = 0.45, GX = 2.65;

    const label = (text, size, x, y, z) => { const s = ctx.sprite(text, { size, bg: 'rgba(70,30,100,0.85)' }); s.position.set(x, y, z); group.add(s); return s; };
    const drop = (s) => { if (!s) return; s.parent?.remove(s); s.material?.map?.dispose?.(); s.material?.dispose?.(); };

    // the stand and the tilted serving board
    const made = [];
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); made.push(geo); return m; };
    add(new THREE.CylinderGeometry(1.15, 1.3, 0.16, 28), ctx.mat('#b02a5b', { roughness: 0.6 }), -0.75, 0.08, -0.2);
    add(new THREE.BoxGeometry(0.26, 2.3, 0.26), ctx.mat('#5f3dc4', { roughness: 0.5, metalness: 0.2 }), -0.75, 1.2, -0.45);
    const pie = new THREE.Group(); pie.position.set(-0.75, 2.45, 0); pie.rotation.x = -0.7; group.add(pie);
    const boardGeo = new THREE.CylinderGeometry(R + 0.28, R + 0.28, 0.1, 48); boardGeo.rotateX(Math.PI / 2);
    add(boardGeo, ctx.mat('#fff4e6', { roughness: 0.8 }), 0, 0, -0.06, pie);
    label(`Eat ${num}/${den}`, 0.62, -0.75, 4.72, 0);

    // the glass: it fills with the eaten share; the gold ring marks the mission fraction
    add(new THREE.CylinderGeometry(0.62, 0.72, GY, 24), ctx.mat('#b02a5b', { roughness: 0.6 }), GX, GY / 2, 0);
    add(new THREE.CylinderGeometry(0.44, 0.44, GH, 28, 1, true), ctx.mat('#dff3ff', { transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }), GX, GY + GH / 2, 0);
    const fillGeo = new THREE.CylinderGeometry(0.38, 0.38, 1, 24); fillGeo.translate(0, 0.5, 0);
    const fill = add(fillGeo, ctx.mat('#f76707', { roughness: 0.4 }), GX, GY, 0); fill.scale.y = 0.001;
    const ringGeo = new THREE.TorusGeometry(0.52, 0.05, 10, 36); ringGeo.rotateX(Math.PI / 2);
    const goalRing = add(ringGeo, ctx.lit('#ffe066', 1.4), GX, GY + GH * num / den, 0);
    label(`${num}/${den}`, 0.36, GX - 0.95, GY + GH * num / den, 0.1);
    const tickGeo = new THREE.BoxGeometry(0.34, 0.035, 0.08); made.push(tickGeo);
    const ticks = new THREE.Group(); group.add(ticks);
    let eatenLabel = null;

    // the slices
    const cheese = ctx.mat('#ffd36b', { roughness: 0.6 }), crust = ctx.mat('#d98f3a', { roughness: 0.8 }), pepper = ctx.mat('#d6453d', { roughness: 0.5 });
    const slices = [];
    let sliceGeos = [], sel = -1, guess = 0, done = false, shownFill = 0, autoQ = 0, autoT = 0;
    const count = () => slices.filter((s) => s.eaten).length;
    const place = (s, i) => {
      const e = s.t * s.t * (3 - 2 * s.t), k = s.t < 0.55 ? 1 : Math.max(0, 1 - (s.t - 0.55) / 0.45), lift = i === sel && !s.eaten ? 0.09 : 0;
      s.g.position.set(s.dx * 0.75 * e, s.dy * 0.75 * e, 1.15 * e + lift); s.g.scale.setScalar(Math.max(0.001, k)); s.g.visible = k > 0.02;
    };
    const build = () => {
      for (const s of slices) pie.remove(s.g);
      for (const g of sliceGeos) g.dispose();
      slices.length = 0; sliceGeos = [];
      while (ticks.children.length) ticks.remove(ticks.children[0]);
      const step = model.angle(n), pad = 0.014, pr = Math.max(0.1, R / (n + 6));
      const pepGeo = new THREE.CylinderGeometry(pr, pr, 0.06, 14); pepGeo.rotateX(Math.PI / 2); sliceGeos.push(pepGeo);
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI / 2 - i * step - pad, a1 = Math.PI / 2 - (i + 1) * step + pad, am = (a0 + a1) / 2;      // slice 1 starts at the top and they run clockwise
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(Math.cos(a1) * RIN, Math.sin(a1) * RIN); sh.absarc(0, 0, RIN, a1, a0, false); sh.lineTo(0, 0);
        const cr = new THREE.Shape(); cr.moveTo(Math.cos(a1) * RIN, Math.sin(a1) * RIN); cr.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); cr.absarc(0, 0, R, a1, a0, false); cr.lineTo(Math.cos(a0) * RIN, Math.sin(a0) * RIN); cr.absarc(0, 0, RIN, a0, a1, true);
        const seg = Math.ceil(40 / n) + 2;
        const g1 = new THREE.ExtrudeGeometry(sh, { depth: THICK, bevelEnabled: false, curveSegments: seg }), g2 = new THREE.ExtrudeGeometry(cr, { depth: THICK + 0.1, bevelEnabled: false, curveSegments: seg });
        sliceGeos.push(g1, g2);
        const g = new THREE.Group(), base = new THREE.Mesh(g1, cheese), edge = new THREE.Mesh(g2, crust); base.castShadow = edge.castShadow = true; g.add(base, edge);
        for (const k of [0.45, 0.72]) { const p = new THREE.Mesh(pepGeo, pepper); p.position.set(Math.cos(am) * R * k, Math.sin(am) * R * k, THICK + 0.02); g.add(p); }
        pie.add(g);
        const s = { g, eaten: false, t: 0, dx: Math.cos(am), dy: Math.sin(am) }; slices.push(s);
        ctx.onTap(base, () => toggle(i)); ctx.onTap(edge, () => toggle(i));
        if (i > 0) { const tk = new THREE.Mesh(tickGeo, ctx.mat('#5f3dc4', { roughness: 0.5 })); tk.position.set(GX + 0.5, GY + GH * i / n, 0.1); ticks.add(tk); }
      }
    };

    const rGoal = ui.readout('Mission'), rEat = ui.readout('Eaten, slices'), rPct = ui.readout('Eaten, % of the pizza');
    rGoal.set(`${num}/${den}`);
    const show = () => {
      const k = count(); rEat.set(`${k} / ${n}`); rPct.set(`${Math.round(k / n * 100)} %`);
      drop(eatenLabel); eatenLabel = label(`${k}/${n}`, 0.4, GX, GY + GH + 0.4, 0);
    };
    const why = () => {
      const k = count(), need = model.needed(num, den, n);
      if (k === 0) return 'Nothing is eaten yet. Tap a slice to eat it.';
      if (model.same(k, n, num, den)) {
        const times = n / den;
        return k === num && n === den ? `Yes! The pizza has ${den} equal slices and you ate ${num} of them: that is exactly ${num}/${den}.`
          : `Yes! ${k}/${n} is the same amount of pizza as ${num}/${den}. Cutting every slice into ${times} smaller ones makes ${times} times as many slices, but each is ${times} times smaller, so the amount does not change.`;
      }
      if (need === null) return `With ${n} equal slices you cannot eat exactly ${num}/${den}: the gold ring sits between two cut marks on the glass. Choose a cut that ${den} divides evenly, such as ${den} slices.`;
      const each = `Each slice is 1/${n} of the pizza, so ${k} ${k === 1 ? 'slice is' : 'slices are'} ${k}/${n}.`;
      return k < need ? `${each} That is less than ${num}/${den}: the glass is still below the gold ring. Eat more.` : `${each} That is more than ${num}/${den}: the glass has gone above the gold ring. Tap an empty place to put a slice back.`;
    };
    const check = () => {
      const k = count(); show(); ctx.say(why());
      if (!done && k > 0 && model.same(k, n, num, den)) { done = true; ctx.complete(guess === 0 || guess === k ? 1 : 0.8, `${num}/${den} = ${k}/${n}`); }
    };
    function toggle(i) { const s = slices[i]; if (!s) return; s.eaten = !s.eaten; if (ctx.calm) { s.t = s.eaten ? 1 : 0; place(s, i); } check(); }
    const setCuts = (m) => { m = Math.round(m); if (!CUTS.includes(m)) return; n = m; if (sel >= n) sel = -1; build(); slices.forEach(place); show(); ctx.say(model.needed(num, den, n) === null ? why() : `The pizza is whole again, cut into ${n} equal slices. Each one is 1/${n} of the pizza.`); };
    const restart = () => { done = false; autoQ = 0; for (const s of slices) s.eaten = false; show(); };

    const selS = ui.slider({ label: 'Choose a slice (1 is at the top, counting clockwise)', min: 1, max: 8, step: 1, value: 1, unit: '', onInput: (v) => { const i = Math.round(v) - 1; if (i >= n) { selS.set(n); return; } sel = i; } });
    ui.button('🍕 Eat this slice or put it back', () => { if (sel < 0) sel = 0; toggle(sel); }, 'btn');
    ui.slider({ label: 'Guess first: how many slices will you eat? (0 = no guess)', min: 0, max: 8, step: 1, value: 0, unit: 'slices', onInput: (v) => { guess = Math.round(v); } });
    const cutC = L >= 2 ? ui.choice(CUTS.map((m) => [m, `${m} slices`]), n, setCuts) : null;
    ui.button('Start again', () => { restart(); ctx.say('The pizza is whole again. Tap the slices you want to eat.'); });
    ui.note('The glass fills with the share you have eaten. The gold ring marks the mission. Different cuts can reach the same height: they are the same amount of pizza.');

    build(); show();
    ctx.say(L >= 2 ? `Eat ${num}/${den} of the pizza. It is cut into ${n} slices, so you may need a different number of slices than the fraction says.` : `Eat ${num}/${den} of the pizza. Tap the slices you want to eat.`);

    return {
      step(dt) {
        if (!autoQ) return;
        autoT -= dt; if (autoT > 0) return;
        autoT = 0.35; const i = slices.findIndex((s) => !s.eaten); if (i >= 0) toggle(i); autoQ--;
      },
      frame(dt, time = 0) {
        slices.forEach((s, i) => { const to = s.eaten ? 1 : 0; if (s.t !== to) s.t = ctx.calm ? to : to > s.t ? Math.min(to, s.t + dt * 1.8) : Math.max(to, s.t - dt * 2.4); place(s, i); });
        const want = slices.length ? count() / n : 0; shownFill += (want - shownFill) * (ctx.calm ? 1 : Math.min(1, dt * 6));
        fill.scale.y = Math.max(0.001, shownFill * GH); fill.visible = shownFill > 0.004;
        goalRing.scale.setScalar(ctx.calm ? 1 : 1 + 0.05 * Math.sin(time * 3));
      },
      // Eats the right number of slices one after another, through the same toggle the player's taps use.
      autoplay() {
        if (model.needed(num, den, n) === null) { if (cutC?.set) cutC.set(den); else setCuts(den); }
        restart(); autoQ = model.needed(num, den, n); autoT = 0.2;
      },
      dispose() { for (const g of [...sliceGeos, ...made]) g.dispose(); drop(eatenLabel); },
    };
  },
};
