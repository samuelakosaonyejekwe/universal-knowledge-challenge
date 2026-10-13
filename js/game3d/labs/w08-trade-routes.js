// World 8 lab — Trade Route Planner in 3D: a relief map on a slanted table, with a caravan or a ship that travels stop to stop.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

// Approximate overland / sea-lane distances (km) between stops. Rounded; routes were networks, not single lines.
const ROUTES = {
  silk: { n: 'Silk Roads', icon: '🐪', mode: 'caravan', v: 30, stops: [
    ['Chang\'an (Xi\'an), China', 0, 'Silk, paper and tea began their journeys west from this great capital.'],
    ['Dunhuang, China', 1700, 'An oasis gateway to the deserts, famous for its painted caves.'],
    ['Samarkand, Central Asia', 2800, 'Sogdian merchants ran trade and carried ideas and languages along the route.'],
    ['Baghdad, Iraq', 2300, 'A centre of learning and a market for goods from three continents.'],
    ['Antioch, Mediterranean coast', 900, 'Goods reached Mediterranean ports and then travelled on by sea.']] },
  sahara: { n: 'Trans-Saharan routes', icon: '🐫', mode: 'caravan', v: 25, stops: [
    ['Sijilmasa, Morocco', 0, 'A northern desert-edge city where caravans prepared for the crossing.'],
    ['Taghaza, Sahara', 750, 'A salt-mining settlement: salt was prized in the south.'],
    ['Timbuktu, Mali', 800, 'A market and a famous centre of scholars and manuscripts.'],
    ['Gao, Songhai', 400, 'A trading city on the Niger River, linked to West African gold.']] },
  ocean: { n: 'Indian Ocean trade', icon: '⛵', mode: 'dhow', v: 120, stops: [
    ['Kilwa, East Africa', 0, 'A Swahili coast port trading gold, ivory and timber.'],
    ['Aden, Arabia', 3700, 'Ships waited here for the right monsoon wind.'],
    ['Calicut, India', 3000, 'A spice port: pepper and cotton cloth.'],
    ['Malacca, Southeast Asia', 2600, 'A strait where sailors from many lands met.'],
    ['Guangzhou, China', 2800, 'Porcelain and silk were loaded for the return voyage.']] },
};
const KEYS = Object.keys(ROUTES);

export const model = {
  ROUTES,
  total: (key) => ROUTES[key].stops.reduce((s, x) => s + x[1], 0),                               // km
  legs: (key) => ROUTES[key].stops.length - 1,
  // Journey time in days: distance ÷ daily distance, plus the rest days before each leg.
  days: (key, daily, rest) => model.total(key) / daily + rest * model.legs(key),
  daily: (key, percent) => Math.round(ROUTES[key].v * percent / 100),                            // km per day
  base: (key) => model.days(key, ROUTES[key].v, 2),
  deadline: (key, factor) => Math.round(model.base(key) * factor / 5) * 5,
  minRest: (level) => (level >= 6 ? 1 : 0),
  // The most restful plan that still arrives in time: [percent of the typical pace, rest days], or null.
  plan(key, deadline, minRest) {
    for (let rest = 6; rest >= minRest; rest--) for (let p = 60; p <= 180; p += 2) if (model.days(key, model.daily(key, p), rest) <= deadline) return [p, rest];
    return null;
  },
};

export function selfTest() {
  const a = model.total('silk'), b = model.days('silk', 30, 2), c = model.days('sahara', 25, 2), d = model.days('ocean', 120, 2), e = model.days('ocean', 216, 0);
  let fine = true;
  for (const k of KEYS) for (const [f, mr] of [[0.8, 0], [1.1, 0], [0.75, 1], [0.95, 1]]) { const dl = model.deadline(k, f), p = model.plan(k, dl, mr); if (!p || model.days(k, model.daily(k, p[0]), p[1]) > dl || p[1] < mr) fine = false; }
  const ok = a === 7700 && model.total('sahara') === 1950 && model.total('ocean') === 12100 && Math.abs(b - (7700 / 30 + 8)) < 1e-9 && Math.abs(b - 264.667) < 1e-3 && c === 84 && Math.abs(d - 108.833) < 1e-3 && Math.abs(e - 56.019) < 1e-3
    && model.daily('silk', 100) === 30 && model.daily('ocean', 180) === 216 && model.deadline('sahara', 1) === 85 && fine;
  return { ok, detail: `Silk Roads 7,700 km at 30 km/day with 2 rest days before each of 4 legs → ${b.toFixed(2)} days; Sahara 1,950 km at 25 → ${c} days; Indian Ocean 12,100 km at 120 → ${d.toFixed(2)} days; every deadline can be met: ${fine}` };
}

const fmt = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const short = (name) => name.split(',')[0].split(' (')[0];

export default {
  id: 'w08-trade-routes',
  world: 8,
  levels: [5, 6],
  title: 'Trade Route Planner',
  goal: 'Tour a historic trade route stop by stop, then plan the journey: set your daily distance and rest days, set off, and arrive before the deadline.',
  kind: 'validated',
  model: 'Journey time = total distance ÷ distance per travel day, plus the rest days before each leg. Real trade was a web of many roads and sea lanes, carried out by many peoples, usually in relays rather than one traveller going end to end. Distances are rounded approximations and speeds are typical averages (monsoon winds, weather and danger changed everything).',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = Math.max(1, Math.min(6, Math.round(ctx.level) || 5)), rnd = ctx.rng || Math.random, T = ctx.t || ((x) => x);
    const M = (geo, material, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const wood = ctx.mat('#8a5a2e', { roughness: 0.8 }), sandM = ctx.mat('#d9b46a', { roughness: 1, flatShading: true }), duneM = ctx.mat('#e2a85a', { roughness: 1 }), rockM = ctx.mat('#8f7a66', { roughness: 1, flatShading: true });
    const snow = ctx.mat('#f4f1ea', { roughness: 0.8 }), sea = ctx.mat('#2f7fc9', { roughness: 0.3 }), land = ctx.mat('#6aa857', { roughness: 1, flatShading: true }), leaf = ctx.mat('#3f9a55', { roughness: 0.9 });
    const brick = ctx.mat('#c96f43', { roughness: 0.9 }), camelM = ctx.mat('#c89a5a', { roughness: 0.9 }), cream = ctx.mat('#f4ead0', { roughness: 0.9 }), cloth = ctx.mat('#c0445a', { roughness: 1 }), dot = ctx.mat('#7a5a3c', { roughness: 1 });
    const gold = ctx.lit('#ffd76a', 1.4), green = ctx.lit('#59d98a', 1.3), red = ctx.lit('#ff7a5c', 1.2), glass = ctx.mat('#cfe8ff', { transparent: true, opacity: 0.25, roughness: 0.1 });
    const minRest = model.minRest(L);

    // the map table, tilted towards the viewer, on two legs
    const board = new THREE.Group(); board.position.set(-0.25, 1.75, 0); board.rotation.x = 0.5; group.add(board);
    M(new THREE.BoxGeometry(6.3, 0.14, 3.1), wood, 0, -0.07, 0, board);
    for (const x of [-2.6, 2.1]) M(new THREE.BoxGeometry(0.2, 1.7, 0.2), wood, x, 0.85, -0.3);
    let scene = null, key = KEYS[Math.floor(rnd() * KEYS.length) % KEYS.length], R = ROUTES[key], deadline = 0, stops = [], dots = [], mover = null, tent = null, ph = 0;
    const path = (f) => [-2.6 + 5.2 * f, 0.1, 0.8 * Math.sin(f * 5.4 + ph)];
    const fracs = () => { const tot = model.total(key); let s = 0; return R.stops.map((x) => (s += x[1]) / tot); };

    // the deadline glass on the right: it drains as the days pass
    M(new THREE.CylinderGeometry(0.3, 0.36, 0.16, 16), wood, 3.15, 0.08, 1.7);
    M(new THREE.CylinderGeometry(0.24, 0.24, 2.2, 16), glass, 3.15, 1.26, 1.7);
    const fill = M(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 16), green, 3.15, 0.16, 1.7); fill.geometry.translate(0, 1.1, 0);
    const glassTag = ctx.sprite('Days left', { size: 0.26, bg: 'rgba(14,18,48,.78)' }); glassTag.position.set(3.05, 2.7, 1.7); group.add(glassTag);

    function camel(g) {
      M(new THREE.BoxGeometry(0.36, 0.17, 0.15), camelM, 0, 0.3, 0, g); M(new THREE.SphereGeometry(0.09, 10, 8), camelM, -0.02, 0.41, 0, g);
      M(new THREE.BoxGeometry(0.07, 0.24, 0.07), camelM, 0.2, 0.42, 0, g).rotation.z = -0.5; M(new THREE.BoxGeometry(0.15, 0.08, 0.08), camelM, 0.3, 0.53, 0, g);
      for (const [x, z] of [[-0.13, -0.05], [-0.13, 0.05], [0.13, -0.05], [0.13, 0.05]]) M(new THREE.BoxGeometry(0.045, 0.23, 0.045), camelM, x, 0.11, z, g);
      M(new THREE.BoxGeometry(0.16, 0.1, 0.2), cloth, -0.02, 0.37, 0, g);
    }
    function dhow(g) {
      M(new THREE.SphereGeometry(0.16, 12, 8), wood, 0, 0.07, 0, g).scale.set(2.2, 0.55, 0.8); M(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 6), wood, 0, 0.34, 0, g);
      const sail = M(new THREE.ConeGeometry(0.26, 0.46, 3), cream, 0.04, 0.38, 0, g); sail.scale.z = 0.12; sail.rotation.z = -0.25;
      M(new THREE.BoxGeometry(0.1, 0.05, 0.1), cloth, -0.18, 0.15, 0, g);
    }
    function build() {
      if (scene) { scene.traverse((o) => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } else if (o.geometry) o.geometry.dispose(); }); board.remove(scene); }
      scene = new THREE.Group(); board.add(scene); R = ROUTES[key]; ph = key === 'silk' ? 0.4 : key === 'sahara' ? 2.2 : 3.6;
      const water = R.mode === 'dhow';
      M(new THREE.BoxGeometry(6.1, 0.1, 2.9), water ? sea : sandM, 0, 0.05, 0, scene);
      // relief: mountains, dunes and palms on land; coasts and islands at sea (kept clear of the route)
      const clear = (x, z) => { const f = (x + 2.6) / 5.2; return Math.abs(z - path(Math.max(0, Math.min(1, f)))[2]) > 0.55; };
      const spots = [[-2.3, -1.0], [-1.5, 1.05], [-0.7, -1.1], [0.1, 1.1], [0.9, -1.05], [1.7, 1.0], [2.4, -1.0], [-2.5, 1.0], [2.6, 0.9], [0, -0.2], [-1.2, 0], [1.3, 0.1]].filter(([x, z]) => clear(x, z)).slice(0, 7);
      spots.forEach(([x, z], i) => {
        if (water) { M(new THREE.SphereGeometry(0.42, 10, 6), land, x, 0.08, z, scene).scale.set(1.3, 0.3, 0.8); if (i % 2) { M(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), wood, x, 0.33, z, scene); M(new THREE.SphereGeometry(0.12, 8, 6), leaf, x, 0.5, z, scene).scale.y = 0.5; } }
        else if (key === 'silk') { const h = 0.5 + (i % 3) * 0.15; M(new THREE.ConeGeometry(0.36, h, 6), rockM, x, 0.1 + h / 2, z, scene); M(new THREE.ConeGeometry(0.13, h * 0.36, 6), snow, x, 0.1 + h * 0.83, z, scene); }
        else if (i % 3 === 2) { M(new THREE.CylinderGeometry(0.02, 0.03, 0.36, 6), wood, x, 0.28, z, scene); M(new THREE.SphereGeometry(0.15, 8, 6), leaf, x, 0.48, z, scene).scale.y = 0.5; M(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12), sea, x + 0.22, 0.11, z, scene); }
        else M(new THREE.SphereGeometry(0.45, 12, 6), duneM, x, 0.08, z, scene).scale.set(1.4, 0.4, 0.7);
      });
      // the stops and the dotted track between them
      const fr = fracs();
      stops = R.stops.map((s, i) => {
        const [x, y, z] = path(fr[i]), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
        if (water) M(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 12), land, 0, 0.02, 0, g);
        const tower = M(new THREE.CylinderGeometry(0.13, 0.16, 0.36, 10), brick, 0, 0.2, 0, g), roof = M(new THREE.ConeGeometry(0.2, 0.2, 10), i ? cream : gold, 0, 0.48, 0, g);
        const tag = ctx.sprite(short(s[0]), { size: 0.22, bg: 'rgba(14,18,48,.78)' }); tag.position.set(0, i % 2 ? 1.05 : 0.8, 0); g.add(tag);
        ctx.onTap(tower, () => info(i)); ctx.onTap(roof, () => info(i));
        return { g, roof, f: fr[i] };
      });
      const dotGeo = new THREE.SphereGeometry(0.045, 8, 6);
      dots = []; for (let i = 1; i < 26; i++) { const f = i / 26; if (fr.some((q) => Math.abs(q - f) < 0.02)) continue; const [x, y, z] = path(f); dots.push({ m: M(dotGeo, dot, x, y + 0.03, z, scene), f }); }
      mover = new THREE.Group(); mover.scale.setScalar(1.25); scene.add(mover); (water ? dhow : camel)(mover);
      tent = M(new THREE.ConeGeometry(0.17, 0.26, 4), cloth, 0, 0, 0, scene); tent.visible = false;
      placeMover(0);
    }
    function placeMover(f) {
      const [x, y, z] = path(f), [x2, , z2] = path(Math.min(1, f + 0.01)), [x1, , z1] = path(Math.max(0, f - 0.01));
      mover.position.set(x, y + (R.mode === 'dhow' ? 0.02 : 0), z + 0.24); mover.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    }

    let pct = 100, rest = 2, si = 0, state = 'plan', run = null, done = false, tries = 0, shownF = 0;
    const routeC = ui.choice(KEYS.map((k) => [k, `${ROUTES[k].icon} ${ROUTES[k].n}`]), key, (v) => { if (state === 'go') { ctx.say('Wait until this journey has ended before you choose another route.'); return; } key = v; setup(); });
    ui.button('🧭 Next stop on the tour', () => info((si + 1) % R.stops.length));
    const paceS = ui.slider({ label: 'Daily pace (100 % is the typical speed)', min: 60, max: 180, step: 2, value: 100, unit: '%', onInput: (v) => { pct = v; update(); } });
    const restS = ui.slider({ label: 'Rest days before each leg', min: 0, max: 6, step: 1, value: 2, unit: 'days', onInput: (v) => { rest = v; update(); } });
    ui.button('🚩 Set off', () => go(), 'btn');
    const rTot = ui.readout('Distance, km'), rDaily = ui.readout('Distance per day, km'), rDays = ui.readout('Planned journey, days'), rDL = ui.readout('Deadline, days'), rNow = ui.readout('Day of the journey'), rAt = ui.readout('Position');
    ui.note('Travel time = distance ÷ distance per day, plus the rest days. Tap a town on the map to hear what was traded there.');
    const daily = () => model.daily(key, pct), planned = () => model.days(key, daily(), rest);
    function gauge(left) { const k = Math.max(0, Math.min(1, left / deadline)); fill.scale.y = Math.max(0.01, k); fill.material = left >= 0 ? green : red; }
    function update() {
      rTot.set(fmt(model.total(key))); rDaily.set(`${daily()} km`); rDays.set(planned().toFixed(1)); rDL.set(String(deadline));
      if (state !== 'go') { rNow.set('0'); rAt.set(T(short(R.stops[0][0]))); gauge(deadline); }
    }
    function setup() {
      R = ROUTES[key]; si = 0; state = 'plan'; run = null; shownF = 0;
      deadline = model.deadline(key, L >= 6 ? 0.75 + rnd() * 0.2 : 0.8 + rnd() * 0.3);
      build(); update();
      ctx.say(`${R.n}: ${R.stops.length} stops and ${fmt(model.total(key))} km. At the typical ${R.v} km a day with 2 rest days before each leg it takes ${model.base(key).toFixed(1)} days, and you must arrive within ${deadline} days.${minRest ? ' Animals and crews need at least 1 rest day before each leg.' : ''}`);
    }
    function info(i) {
      si = i; const s = R.stops[i];
      for (const [k, st] of stops.entries()) st.g.scale.setScalar(k === i ? 1.35 : 1);
      ctx.say(`Stop ${i + 1} of ${R.stops.length}: ${s[0]}. ${s[2]}${i ? ` It lies ${fmt(s[1])} km from the previous stop.` : ''}`);
    }
    function go() {
      if (state === 'go') return false;
      if (rest < minRest) { ctx.say('Animals and crews cannot go on without rest. Give them at least 1 rest day before each leg, then set off.'); return false; }
      tries++; state = 'go'; shownF = 0;
      const D = planned();
      run = { daily: daily(), rest, leg: 0, phase: rest > 0 ? 'rest' : 'move', t: 0, day: 0, D, rate: D / 12 };
      stops.forEach((s, i) => { s.roof.material = i ? cream : gold; }); for (const d of dots) d.m.material = dot;
      ctx.say(`Setting off from ${short(R.stops[0][0])} at ${run.daily} km a day, with ${rest} rest days before each leg.`);
      return true;
    }
    function arrive() {
      const D = run.D, r = run.rest, d = run.daily; state = 'plan'; rNow.set(D.toFixed(1)); gauge(deadline - D);
      const sum = `${fmt(model.total(key))} km ÷ ${d} km a day = ${(model.total(key) / d).toFixed(1)} travel days, plus ${r} × ${model.legs(key)} = ${r * model.legs(key)} rest days: ${D.toFixed(1)} days in all.`;
      if (D <= deadline) {
        ctx.say(`You arrive at ${short(R.stops[R.stops.length - 1][0])} in time! ${sum} The deadline was ${deadline}. Faster days may mean more risk to animals and travellers, so merchants balanced speed with safety.`);
        if (!done) { done = true; ctx.complete(Math.min(1, 0.7 + 0.1 * r), 'Planned a journey along a historic trade route.'); }
      } else ctx.say(`Too slow: ${sum} The deadline was ${deadline} days. Travel further each day or rest a little less, then set off again.`);
      run = null;
    }
    setup();

    return {
      step(dt) {
        if (state !== 'go' || !run) return;
        let left = dt * run.rate;                                    // days of the journey that pass in this step
        while (left > 0 && run) {
          const legDays = R.stops[run.leg + 1][1] / run.daily, len = run.phase === 'rest' ? run.rest : legDays, use = Math.min(left, len - run.t);
          run.t += use; run.day += use; left -= use;
          const f0 = stops[run.leg].f, f1 = stops[run.leg + 1].f;
          shownF = run.phase === 'rest' ? f0 : f0 + (f1 - f0) * (run.t / len);
          if (run.t >= len - 1e-9) {
            run.t = 0;
            if (run.phase === 'rest') run.phase = 'move';
            else {
              run.leg++; stops[run.leg].roof.material = gold; shownF = stops[run.leg].f;
              if (run.leg >= R.stops.length - 1) { arrive(); break; }
              const s = R.stops[run.leg]; ctx.say(`Day ${Math.round(run.day)}: ${s[0]}. ${s[2]}`);
              run.phase = run.rest > 0 ? 'rest' : 'move';
            }
          }
        }
        if (run) { rNow.set(run.day.toFixed(0)); rAt.set(run.phase === 'rest' ? `${T('resting at')} ${T(short(R.stops[run.leg][0]))}` : `${fmt(run.t * run.daily)} / ${fmt(R.stops[run.leg + 1][1])} km`); gauge(deadline - run.day); }
        for (const d of dots) if (d.f <= shownF && d.m.material !== gold) d.m.material = gold;
      },
      frame(dt, time = 0) {
        if (!mover) return;
        placeMover(shownF);
        const moving = state === 'go' && run && run.phase === 'move', water = R.mode === 'dhow';
        if (!ctx.calm) { mover.position.y += moving ? Math.abs(Math.sin(time * (water ? 3 : 9))) * (water ? 0.03 : 0.05) : 0; mover.rotation.z = water ? Math.sin(time * 2) * 0.08 : 0; }
        const resting = state === 'go' && run && run.phase === 'rest';
        tent.visible = !!resting; if (resting) { const [x, y, z] = path(shownF); tent.position.set(x - 0.32, y + 0.13, z + 0.2); }
      },
      // Finds the most restful plan that still meets the deadline, sets the sliders to it and sets off.
      autoplay() {
        const p = model.plan(key, deadline, minRest) || [180, minRest];
        paceS.set(p[0]); restS.set(p[1]); info(1); go();
      },
      dispose() { run = null; state = 'plan'; },
    };
  },
};
