// Radiation Protection Planner in 3D: an inspector walks in to check a sealed practice source, stands for a
// while and walks out. The dose badge fills as the minutes pass. No imports: everything arrives through the context.

// Conceptual, in abstract "dose units". Half-value layers (cm) are illustrative round numbers for gamma rays.
const MAT = {
  none: { name: 'No shield', hvl: Infinity, color: '#ffffff' },
  water: { name: 'Water', hvl: 10, color: '#4fc8f0' },
  concrete: { name: 'Concrete', hvl: 6, color: '#c3c8d2' },
  steel: { name: 'Steel', hvl: 2.5, color: '#8fa0b8' },
  lead: { name: 'Lead', hvl: 1.2, color: '#5a6079' },
};

export const model = {
  MAT,
  pass: (mat, cm) => (MAT[mat].hvl === Infinity ? 1 : Math.pow(0.5, cm / MAT[mat].hvl)),      // the part that gets through the shield
  rate: (k, d, mat, cm) => (k / (d * d)) * model.pass(mat, cm),                                // units per hour at distance d (m)
  dose: (k, d, mat, cm, minutes) => model.rate(k, d, mat, cm) * minutes / 60,                  // units collected in that time
  score: (dose, limit) => Math.min(1, 0.6 + 0.4 * (limit - dose) / limit),
};
// Used by the automated tests: values worked by hand.
export function selfTest() {
  const a = model.rate(400, 2, 'none', 0), b = model.rate(800, 2, 'lead', 2.4), c = model.dose(800, 2, 'lead', 2.4, 30), d = model.rate(1000, 1, 'steel', 2.5);
  const e = model.dose(1200, 3, 'concrete', 12, 15), f = model.rate(600, 10, 'water', 20);
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  const ok = near(a, 100) && near(b, 50) && near(c, 25) && near(d, 500) && near(e, 1200 / 9 / 4 / 4) && near(f, 1.5)
    && near(model.rate(400, 2, 'none', 0) / model.rate(400, 1, 'none', 0), 0.25) && model.pass('none', 20) === 1 && near(model.score(10, 40), 0.9) && model.score(0, 20) === 1;
  return { ok, detail: `400 units/h at 1 m → ${a} at 2 m; 800 at 2 m behind 2.4 cm lead (two half-value layers) → ${b.toFixed(1)}, so 30 min gives ${c.toFixed(1)} units; 12 cm concrete at 3 m for 15 min from 1200 → ${e.toFixed(2)} units` };
}

const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(2) : v > 0 ? 'less than 0.01' : '0');

export default {
  id: 'w06-radiation-protection',
  world: 6,
  levels: [5, 6],
  title: 'Radiation Protection Planner',
  goal: 'Plan a short inspection of a sealed practice source so the total dose stays under the limit: use time, distance and shielding.',
  kind: 'validated',
  model: 'Conceptual only. Point source, inverse-square law D = k/d², gamma shielding by half-value layers (HVL), abstract dose units, no scatter or build-up, and only the time spent standing at the chosen spot is counted, not the walk. HVLs are illustrative; real work follows trained professionals, regulations and measured dose rates.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rng = ctx.rng || Math.random;
    const hard = Math.round(ctx.level || 5) >= 6;
    const k = (hard ? 800 : 400) + Math.floor(rng() * 3) * 200;           // dose rate at 1 m, units/h
    const limit = hard ? 20 : [40, 60][Math.floor(rng() * 2)];            // dose units allowed
    const tMin = hard ? 15 : 5, maxD = hard ? 3 : 10;                      // the job needs this long, and must be done from this close
    const SX = -3.1, SC = 6 / maxD, BY = 1.25, DOOR = 3.35, FLOOR = 0.2;
    const white = ctx.mat('#f2f6fc', { roughness: 0.5 }), steel = ctx.mat('#8d9bb8', { metalness: 0.5, roughness: 0.35 }), dark = ctx.mat('#39406b', { roughness: 0.4 });
    const cyan = ctx.lit('#6fe8ff', 0.9), violet = ctx.lit('#c95be0', 1.5), green = ctx.lit('#5fe08a', 1.2), amber = ctx.lit('#ffb84d', 1.3);
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

    // the walkway with one mark for every metre, the sealed source in its holder and the door
    const walk = add(new THREE.BoxGeometry(7.2, FLOOR, 2.2), white, 0.1, FLOOR / 2, 0);
    for (let i = 1; i <= maxD; i++) add(new THREE.BoxGeometry(0.04, 0.02, i % 5 === 0 || hard ? 1.6 : 1.0), cyan, SX + i * SC, FLOOR + 0.01, 0);
    add(new THREE.BoxGeometry(0.5, 0.85, 0.7), steel, SX, FLOOR + 0.42, 0);
    add(new THREE.BoxGeometry(0.12, 0.5, 0.5), dark, SX - 0.16, BY, 0);
    const capsule = add(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 14), violet, SX, BY, 0); capsule.rotation.z = Math.PI / 2;
    const aura = ctx.glow('#c95be0', 1.4, 0.8); aura.position.set(SX, BY, 0); group.add(aura);
    const door = add(new THREE.BoxGeometry(0.12, 2.2, 1.3), ctx.mat('#4f8fd8', { roughness: 0.5 }), DOOR + 0.2, FLOOR + 1.1, -0.2);
    add(new THREE.BoxGeometry(0.2, 2.4, 0.16), steel, DOOR + 0.2, FLOOR + 1.2, -0.95); add(new THREE.BoxGeometry(0.2, 2.4, 0.16), steel, DOOR + 0.2, FLOOR + 1.2, 0.95); add(new THREE.BoxGeometry(0.2, 0.16, 2.06), steel, DOOR + 0.2, FLOOR + 2.48, 0);
    // the shield stands just in front of the source
    const slabMats = {}; for (const key of Object.keys(MAT)) slabMats[key] = ctx.mat(MAT[key].color, key === 'water' ? { transparent: true, opacity: 0.55, roughness: 0.1 } : { roughness: key === 'concrete' ? 0.95 : 0.35, metalness: key === 'concrete' ? 0 : 0.5 });
    const X0 = SX + 0.3, slab = add(new THREE.BoxGeometry(1, 1.5, 1.5), slabMats.water, X0, FLOOR + 0.75, 0); slab.visible = false;

    // the inspector: a small friendly figure with a helmet and a dose badge
    const who = new THREE.Group(); who.position.set(DOOR - 0.2, FLOOR, 0.15); group.add(who);
    const coat = ctx.mat('#ff9d5c', { roughness: 0.6 });
    add(new THREE.CylinderGeometry(0.17, 0.2, 0.62, 14), coat, 0, 0.78, 0, who);
    add(new THREE.SphereGeometry(0.17, 16, 12), ctx.mat('#f1c9a5', { roughness: 0.7 }), 0, 1.26, 0, who);
    add(new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ctx.mat('#ffd76a', { roughness: 0.4 }), 0, 1.3, 0, who);
    const legs = [-0.09, 0.09].map((z) => { const g = new THREE.Group(); g.position.set(0, 0.48, z); who.add(g); add(new THREE.BoxGeometry(0.11, 0.48, 0.11), dark, 0, -0.24, 0, g); return g; });
    const arms = [-0.22, 0.22].map((z) => { const g = new THREE.Group(); g.position.set(0, 1.02, z); who.add(g); add(new THREE.BoxGeometry(0.09, 0.42, 0.09), coat, 0, -0.2, 0, g); return g; });
    const badge = add(new THREE.BoxGeometry(0.03, 0.14, 0.12), cyan, -0.18, 0.9, 0, who);

    // the big dose badge at the back: a tube that fills, a ring at the limit and a marker for the plan
    const TX = 1.2, TZ = -1.7, T0 = 0.5, TH = 3.2, LIM = T0 + TH * (2 / 3);
    add(new THREE.CylinderGeometry(0.45, 0.55, 0.5, 20), dark, TX, 0.25, TZ);
    add(new THREE.CylinderGeometry(0.3, 0.3, TH, 20, 1, true), ctx.mat('#dff3ff', { transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide }), TX, T0 + TH / 2, TZ);
    const fillGeo = new THREE.CylinderGeometry(0.24, 0.24, 1, 18); fillGeo.translate(0, 0.5, 0);
    const fill = add(fillGeo, green, TX, T0, TZ); fill.scale.y = 0.001;
    add(new THREE.TorusGeometry(0.34, 0.04, 8, 28), amber, TX, LIM, TZ).rotation.x = Math.PI / 2;
    const planRing = add(new THREE.TorusGeometry(0.4, 0.025, 8, 28), cyan, TX, T0, TZ); planRing.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 20), dark, TX, T0 + TH + 0.05, TZ);
    const limTag = ctx.sprite(`Limit ${limit}`, { size: 0.3 }); limTag.position.set(TX + 1.0, LIM, TZ); group.add(limTag);
    const topTag = ctx.sprite('Dose badge', { size: 0.3 }); topTag.position.set(TX, T0 + TH + 0.45, TZ); group.add(topTag);
    const srcTag = ctx.sprite(`${k} units/h at 1 m`, { size: 0.28 }); srcTag.position.set(SX + 0.5, 2.5, 0); group.add(srcTag);
    const height = (dose) => T0 + TH * Math.min(1, dose / (1.5 * limit));

    // gamma rays drawn as points: they fan out with distance, and some stop inside the shield
    const N = ctx.calm ? 70 : 180, SPEED = ctx.calm ? 1.6 : 3, END = 3.5, pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rays = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe9c8ff, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false })); rays.frustumCulled = false; group.add(rays);
    const parts = Array.from({ length: N }, () => ({ x: SX, a: 0, b: 0, stop: Infinity }));

    let d = 1, minutes = 30, mat = 'none', cm = 0, state = 'ready', clock = 0, got = 0, done = false, tries = 0, shownD = 1, shownCm = 0, phase = 0;
    const thick = () => (mat === 'none' || cm <= 0 ? 0 : Math.max(0.03 + cm * 0.012, cm / 100 * SC));
    const spawn = (p) => {
      p.x = SX + 0.1; p.a = (rng() - 0.5) * 0.5; p.b = (rng() - 0.5) * 0.5;
      p.stop = rng() < model.pass(mat, cm) ? Infinity : X0 + rng() * thick();
    };
    for (const p of parts) { spawn(p); p.x = SX + rng() * (END - SX); if (p.x > p.stop) p.x = SX + 0.1; }
    const rRate = ui.readout('Dose rate, units/h'), rPlan = ui.readout('Planned dose, units'), rLim = ui.readout('Limit, units'), rGot = ui.readout('Dose received, units'), rClock = ui.readout('Time near source, min'), rHvl = ui.readout('Half-value layer, cm');
    const rate = () => model.rate(k, d, mat, cm), plan = () => model.dose(k, d, mat, cm, minutes);
    // Any change sends the inspector back to the door: the plan comes first, then the walk.
    const touch = () => {
      state = 'ready'; clock = 0; got = 0; badge.material = cyan; fill.material = green;
      rRate.set(fmt(rate())); rPlan.set(fmt(plan())); rLim.set(String(limit)); rGot.set('–'); rClock.set('–'); rHvl.set(MAT[mat].hvl === Infinity ? '–' : String(MAT[mat].hvl));
      slab.material = slabMats[mat]; planRing.position.y = height(plan()); planRing.material = plan() <= limit ? cyan : amber;
    };
    const dS = ui.slider({ label: hard ? `Distance d (the label can be read from ${maxD} m or closer)` : 'Distance d', min: 1, max: maxD, step: 0.5, value: d, unit: 'm', onInput: (v) => { d = v; touch(); } });
    const tS = ui.slider({ label: `Time near source (the check needs at least ${tMin} min)`, min: tMin, max: 60, step: 1, value: minutes, unit: 'min', onInput: (v) => { minutes = v; touch(); } });
    const pick = (v) => { mat = v; touch(); };
    const mC = ui.choice(Object.keys(MAT).map((key) => [key, MAT[key].hvl === Infinity ? MAT[key].name : `${MAT[key].name} (halves every ${MAT[key].hvl} cm)`]), mat, pick);
    const xS = ui.slider({ label: 'Shield thickness', min: 0, max: 20, step: 0.5, value: cm, unit: 'cm', onInput: (v) => { cm = v; touch(); } });
    const start = () => { if (state !== 'ready' && state !== 'result') return; touch(); state = 'in'; tries++; ctx.say('The inspector walks in. Watch the dose badge fill while the minutes pass.'); };
    ui.button('🚶 Start the inspection', start, 'btn');
    ui.note(`Source: ${k} units/h at 1 m. Keep total dose at or below ${limit}. D = k/d² · (½)^(x/HVL) · t. Rule: keep doses as low as reasonably achievable. You can tap the walkway to choose where to stand, and the door to start.`);
    ctx.onTap(walk, (o, point) => { if (!point) return; const v = Math.max(1, Math.min(maxD, Math.round((point.x - SX) / SC * 2) / 2)); dS.set(v); });
    ctx.onTap(door, start);
    touch();
    ctx.say(`Plan the check so the dose badge stays under ${limit} units, then start the inspection. Three things help: less time, more distance, more shielding.`);

    const finish = () => {
      state = 'result';
      const D = got, r = rate(), layers = MAT[mat].hvl === Infinity ? 0 : cm / MAT[mat].hvl;
      const why = `At ${d} m from the source the dose rate is ${fmt(k / (d * d))} units/h${layers > 0 ? `, and ${cm} cm of ${MAT[mat].name.toLowerCase()} is ${+layers.toFixed(1)} half-value layers, which leaves ${fmt(r)} units/h` : ''}. ${minutes} minutes there adds up to ${fmt(D)} units.`;
      if (D <= limit) {
        badge.material = green;
        ctx.say(`Under the limit of ${limit}. ${why} Less time, more distance and more shielding each cut the dose. Doubling distance cuts it to a quarter; each half-value layer halves it.`);
        if (!done) { done = true; ctx.complete(model.score(D, limit), 'Planned a low-dose job with time, distance and shielding.'); }
      } else {
        badge.material = amber;
        const tip = d * 2 <= maxD ? 'Standing twice as far away would cut the rate to a quarter, because the rays spread out.' : d < maxD ? 'A step further back helps a little, and shielding helps a lot.' : mat === 'none' || cm < 20 ? `You are as far back as the job allows, so add shielding: every ${mat === 'none' ? 'half-value layer' : MAT[mat].hvl + ' cm of ' + MAT[mat].name.toLowerCase()} halves the rate.` : 'Try a material with a smaller half-value layer, such as lead.';
        ctx.say(`Over the limit of ${limit}. ${why} ${minutes > tMin ? 'A shorter visit collects less. ' : ''}${tip}`);
      }
    };
    const STAY = ctx.calm ? 3 : 4.5, PACE = ctx.calm ? 1.3 : 1.9;
    return {
      step(dt) {
        const spot = SX + d * SC + 0.2, home = DOOR - 0.2;
        if (state === 'in') { who.position.x = Math.max(spot, who.position.x - PACE * dt); phase += dt * 9; if (who.position.x <= spot) state = 'stay'; }
        else if (state === 'stay') {
          clock = Math.min(minutes, clock + minutes * dt / STAY); got = rate() * clock / 60;
          rGot.set(fmt(got)); rClock.set(clock.toFixed(0));
          if (got > limit) { fill.material = amber; badge.material = amber; }
          if (clock >= minutes) { got = plan(); rGot.set(fmt(got)); state = 'out'; }
        } else if (state === 'out') { who.position.x = Math.min(home, who.position.x + PACE * dt); phase += dt * 9; if (who.position.x >= home) finish(); }
        else if (state === 'ready') { who.position.x += (home - who.position.x) * Math.min(1, dt * 6); }
      },
      frame(dt, time) {
        const walking = state === 'in' || state === 'out', swing = walking ? Math.sin(phase) * 0.6 : 0;
        legs[0].rotation.z = swing; legs[1].rotation.z = -swing; arms[0].rotation.z = -swing * 0.7; arms[1].rotation.z = swing * 0.7;
        who.rotation.y = state === 'out' ? Math.PI : 0;
        who.position.y = FLOOR + (walking ? Math.abs(Math.sin(phase)) * 0.03 : 0);
        shownD += (d - shownD) * Math.min(1, dt * 6); shownCm += (thick() - shownCm) * Math.min(1, dt * 6);
        slab.visible = shownCm > 0.015; slab.scale.x = Math.max(0.01, shownCm); slab.position.x = X0 + shownCm / 2;
        const want = Math.max(0.001, height(state === 'ready' ? 0 : got) - T0); fill.scale.y += (want - fill.scale.y) * Math.min(1, dt * 8);
        aura.scale.setScalar(1.4 * (1 + Math.sin((time || 0) * 2) * 0.06));
        for (const p of parts) {
          p.x += SPEED * dt;
          if (p.x > END || p.x >= p.stop) spawn(p);
        }
        for (let i = 0; i < N; i++) { const p = parts[i], run = p.x - SX; pos[i * 3] = p.x; pos[i * 3 + 1] = BY + run * p.a; pos[i * 3 + 2] = run * p.b; }
        geo.attributes.position.needsUpdate = true;
      },
      // A careful plan made through the same controls: lead shield, as far back as allowed, the shortest visit.
      autoplay() {
        mC.set?.('lead'); pick('lead');
        xS.set(20); dS.set(maxD); tS.set(tMin);
        start();
      },
      dispose() { state = 'ready'; geo.dispose(); },
    };
  },
};
