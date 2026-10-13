// World 6 — Nuclear Engineering: the Nuclear Safety Academy.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: a small sealed gamma source, a flat shield, a detector on a rail and a clock -----
//   I = I0 · e^(−μx) · (d0/d)² · (1/2)^(t/T½)
const I0 = 400;                     // detector reading with no shield at d0 at the start, µSv/h
const D0 = 1;                       // reference distance, m
const HALF = 6;                     // half-life of the practice source, hours
const CPS = 5;                      // detector counts per second for each µSv/h
// Linear attenuation coefficients for gamma rays of about 1 MeV (narrow beam), per cm, and densities in g/cm³.
const MATS = {
  water: { name: 'Water', mu: 0.0707, rho: 1.0, color: '#4fc8f0' },
  concrete: { name: 'Concrete', mu: 0.147, rho: 2.3, color: '#c3c8d2' },
  steel: { name: 'Steel', mu: 0.472, rho: 7.87, color: '#8fa0b8' },
  lead: { name: 'Lead', mu: 0.806, rho: 11.35, color: '#5a6079' },
};
export const model = {
  I0, D0, HALF, CPS, MATS,
  shield: (mu, cm) => Math.exp(-mu * cm),                 // the part of the rays that passes the shield
  spread: (m) => (D0 / m) ** 2,                           // inverse-square law
  decay: (hours) => 0.5 ** (hours / HALF),                // the part of the source that is still active
  reading: (mu, cm, m, hours) => I0 * model.shield(mu, cm) * model.spread(m) * model.decay(hours),
  hvl: (mu) => Math.LN2 / mu,                             // half-value layer, cm
};
// Used by the automated tests: one half-value layer, twice the distance and one half-life give ½, ¼ and ½.
export function selfTest() {
  const mu = MATS.lead.mu, base = model.reading(mu, 0, 1, 0), layer = model.hvl(mu);
  const a = model.reading(mu, layer, 1, 0) / base, b = model.reading(mu, 0, 2, 0) / base, c = model.reading(mu, 0, 1, HALF) / base;
  const all = Object.values(MATS).every((m) => Math.abs(model.shield(m.mu, model.hvl(m.mu)) - 0.5) < 1e-12);
  const both = model.reading(mu, 2 * layer, 2, 2 * HALF) / base;                       // ¼ · ¼ · ¼ = 1/64
  return { ok: all && Math.abs(a - 0.5) < 1e-12 && Math.abs(b - 0.25) < 1e-12 && Math.abs(c - 0.5) < 1e-12 && Math.abs(both - 1 / 64) < 1e-12 && base === I0,
    detail: `lead half-value layer ${layer.toFixed(3)} cm → ×${a.toFixed(3)}, 2 m → ×${b.toFixed(3)}, ${HALF} h → ×${c.toFixed(3)}, all three twice → 1/${(1 / both).toFixed(0)}` };
}

// One row per level: safe limit (µSv/h), width of the shield slot (cm), length of the rail (m), longest wait (hours).
const LEVELS = [[10, 40, 4, 24], [5, 30, 4, 24], [2.5, 12, 4, 18], [2, 6, 3.5, 12], [1, 5, 3, 12], [1, 4, 3, 9]];
const STEP_CM = 0.5;
const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
const pct = (f) => (f >= 0.1 ? (f * 100).toFixed(0) : f >= 0.001 ? (f * 100).toFixed(1) : 'less than 0.1');

const sim = {
  title: 'Shield and wait',
  goal: 'A sealed medical source sits on the test bench. Bring the detector reading below the safe limit with shielding, distance and waiting time — and use as little shielding as you can.',
  kind: 'validated',
  model: 'Reading = 400 µSv/h × e^(−μx) × (1 m ÷ d)² × (½)^(t ÷ 6 h): exponential attenuation in a flat shield of thickness x, the inverse-square law for distance d, and radioactive decay over time t. The attenuation coefficients are for gamma rays of about 1 MeV: water 0.0707, concrete 0.147, steel 0.472 and lead 0.806 per cm. The detector gives 5 counts each second for every µSv/h, with natural counting scatter. It is checked against three known results: one half-value layer (ln 2 ÷ μ) halves the reading, twice the distance quarters it, and one half-life halves it. It leaves out scattered rays that build up behind thick shields, natural background radiation, the size of the source and the air in between. The source is a practice one with a 6-hour half-life, not a particular real isotope.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rng = ctx.rng || Math.random;
    const [limit, slot, maxD, maxW] = LEVELS[Math.max(1, Math.min(6, Math.round(ctx.level || 1))) - 1];
    const SX = -3, M = 1.5, CM = M / 100, X0 = SX + 0.45, BY = 1.5, EM = SX + 0.2, END = 3.7;     // 1.5 scene units per metre
    const white = ctx.mat('#f2f6fc', { roughness: 0.5 }), steel = ctx.mat('#8d9bb8', { metalness: 0.5, roughness: 0.35 }), cyan = ctx.lit('#6fe8ff', 0.9);
    const add = (geo, m, x, y, z, parent = group) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    // the bench, the source in its holder and the half-life dial
    add(new THREE.BoxGeometry(7.2, 0.5, 1.7), white, 0.1, 0.25, 0);
    add(new THREE.BoxGeometry(0.4, 1.4, 1.2), steel, SX - 0.35, 1.2, 0);
    add(new THREE.CylinderGeometry(0.04, 0.06, 0.95, 8), steel, SX, 0.97, 0);
    const capsule = add(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 14), ctx.lit('#c95be0', 1.5), SX, BY, 0); capsule.rotation.z = Math.PI / 2;
    const aura = ctx.glow('#c95be0', 1.5, 0.8); aura.position.set(SX, BY, 0); group.add(aura);
    add(new THREE.CircleGeometry(0.4, 32), white, SX - 0.35, 2.45, 0); add(new THREE.TorusGeometry(0.4, 0.035, 8, 36), steel, SX - 0.35, 2.45, 0);
    const hand = new THREE.Group(); hand.position.set(SX - 0.35, 2.45, 0.02); group.add(hand); add(new THREE.BoxGeometry(0.04, 0.34, 0.02), ctx.lit('#7a4be0', 1), 0, 0.17, 0, hand);
    // the shield slot: a glowing strip as wide as the slot, and one mark for every metre of rail
    const slotU = slot * CM;
    add(new THREE.BoxGeometry(slotU + 0.04, 0.04, 1.4), cyan, X0 + slotU / 2, 0.52, 0);
    for (const sz of [-0.68, 0.68]) add(new THREE.BoxGeometry(0.025, 1.4, 0.04), steel, X0 + slotU + 0.02, 1.2, sz);
    for (let i = 1; i <= Math.ceil(maxD); i++) add(new THREE.BoxGeometry(0.03, 0.03, 1.0), cyan, SX + i * M, 0.515, 0);
    const slabMats = {}; for (const key of Object.keys(MATS)) slabMats[key] = ctx.mat(MATS[key].color, key === 'water' ? { transparent: true, opacity: 0.55, roughness: 0.1 } : { roughness: key === 'concrete' ? 0.95 : 0.35, metalness: key === 'concrete' ? 0 : 0.5 });
    const slab = add(new THREE.BoxGeometry(1, 1.3, 1.3), slabMats.water, X0, 1.15, 0); slab.visible = false;
    // the detector on its rail
    const det = new THREE.Group(); group.add(det);
    add(new THREE.BoxGeometry(0.4, 0.7, 0.7), ctx.mat('#39406b', { roughness: 0.4 }), 0.2, BY, 0, det); add(new THREE.CylinderGeometry(0.05, 0.08, 0.65, 8), steel, 0.2, 0.82, 0, det);
    const lampIdle = ctx.lit('#6fe8ff', 0.7), lampGood = ctx.lit('#5fe08a', 1.4), lampHigh = ctx.lit('#ffb84d', 1.4);
    const face = add(new THREE.BoxGeometry(0.02, 0.5, 0.5), lampIdle, -0.01, BY, 0, det);
    // gamma rays drawn as points: each one may stop inside the shield, miss the detector, or reach it
    const N = ctx.calm ? 90 : 240, SPEED = ctx.calm ? 1.8 : 3.2, pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rays = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc8f7ff, size: 0.075, transparent: true, opacity: 0.9, depthWrite: false })); rays.frustumCulled = false; group.add(rays);
    const parts = Array.from({ length: N }, () => ({ x: EM, a: 0, b: 0, stop: Infinity, on: false }));

    let mi = 'water', x = 0, d = 1, wait = 0, shownX = 0, shownD = 1, hours = 0, state = 'ready', clock = 0, total = 0, tries = 0, T2 = 0;
    const spawn = (p) => {
      p.x = EM; p.a = (rng() - 0.5) * 0.44; p.b = (rng() - 0.5) * 0.44;
      const path = -Math.log(1 - rng() * 0.999999) / MATS[mi].mu;                         // how far this ray travels in the shield, cm
      p.stop = x > 0 && path < x ? X0 + path * CM : Infinity;
    };
    for (const p of parts) { spawn(p); p.x = EM + rng() * (END - EM); p.on = true; }
    const rRead = ui.readout('Detector reading, µSv/h'), rLimit = ui.readout('Safe limit, µSv/h'), rCounts = ui.readout('Counts in 10 s'), rLeft = ui.readout('Source strength left, %'), rHvl = ui.readout('Half-value layer, cm'), rMass = ui.readout('Shield mass, kg per m²');
    const info = () => { rHvl.set(model.hvl(MATS[mi].mu).toFixed(1)); rMass.set(Math.round(MATS[mi].rho * x * 10)); };
    // Any change puts the bench back to "ready": the clock returns to zero and the reading waits for a new measurement.
    const touch = () => { state = 'ready'; hours = 0; clock = 0; total = 0; face.material = lampIdle; slab.material = slabMats[mi]; rRead.set('–'); rCounts.set('–'); rLeft.set('100'); info(); };
    const matC = ui.choice(Object.keys(MATS).map((key) => [key, `${MATS[key].name} (μ = ${MATS[key].mu} per cm)`]), mi, (v) => { mi = v; touch(); });
    const xS = ui.slider({ label: `Shield thickness (the slot holds ${slot} cm)`, min: 0, max: slot, step: STEP_CM, value: 0, unit: 'cm', onInput: (v) => { x = v; touch(); } });
    const dS = ui.slider({ label: 'Distance from the source', min: 1, max: maxD, step: 0.25, value: 1, unit: 'm', onInput: (v) => { d = v; touch(); } });
    const wS = ui.slider({ label: `Waiting time (half-life ${HALF} hours)`, min: 0, max: maxW, step: 1, value: 0, unit: 'h', onInput: (v) => { wait = v; touch(); } });
    const measure = () => { touch(); state = 'run'; tries++; T2 = wait ? 1 + wait / 6 : 0; };
    ui.button('📟 Measure', measure, 'btn');
    ui.note(`With no shield, at 1 m, the detector reads ${I0} µSv/h. Three helpers bring it down: shielding in between, more distance, and time for the source to fade. Each half-value layer of shield halves the reading.`);
    rLimit.set(fmt(limit)); touch();
    ctx.say(`Our goal is a reading below ${fmt(limit)} µSv/h. Choose a shield, a distance and a waiting time, then press Measure. Time, distance and shielding are the three helpers of every safety team.`);

    // The thinnest lead shield that works when distance and waiting are used fully: the mark for a perfect score.
    const least = Math.ceil(Math.max(0, Math.log(I0 * model.spread(maxD) * model.decay(maxW) / limit) / MATS.lead.mu) / STEP_CM - 1e-9) * STEP_CM;
    const finish = () => {
      const mu = MATS[mi].mu, fs = model.shield(mu, x), fd = model.spread(d), ft = model.decay(wait), I = I0 * fs * fd * ft;
      const parts3 = `The shield lets ${pct(fs)} % of the rays through, the distance leaves ${pct(fd)} %, and after ${wait} h the source has ${pct(ft)} % of its strength.`;
      if (I <= limit) {
        state = 'done'; face.material = lampGood;
        const score = x <= least ? 1 : Math.max(0.6, 1 - 0.4 * (x - least) / (slot - least));
        ctx.say(`Safe! The detector reads ${fmt(I)} µSv/h, below the limit of ${fmt(limit)}. ${parts3} ${x <= least ? 'And you used very little shielding — a tidy, clever answer.' : `You used ${x} cm of the ${slot} cm slot. More distance or a longer wait could do the same job with a thinner shield.`}`);
        ctx.complete(+score.toFixed(2), `${mi} ${x} cm, ${d} m, ${wait} h → ${fmt(I)} µSv/h, tries=${tries}`);
      } else {
        state = 'high'; face.material = lampHigh;
        const tip = x < slot && mi !== 'lead' ? `A denser shield helps: ${MATS[mi].name.toLowerCase()} needs ${model.hvl(mu).toFixed(1)} cm to halve the rays, but lead needs only ${model.hvl(MATS.lead.mu).toFixed(1)} cm.`
          : x < slot ? `Each extra ${model.hvl(mu).toFixed(1)} cm of lead halves the reading again.`
            : d < maxD ? 'The slot is full, so move the detector back: at twice the distance the rays spread over four times the area, so only a quarter arrive.'
              : wait < maxW ? `Now let time help: every ${HALF} hours, half of the source has quietly faded away.`
                : 'Try the densest shield and fill the slot.';
        ctx.say(`The detector reads ${fmt(I)} µSv/h. That is still above the limit of ${fmt(limit)}, so we keep working. ${parts3} ${tip}`);
      }
    };
    return {
      step(dt) {
        const kk = Math.min(1, dt * 7); shownX += (x - shownX) * kk; shownD += (d - shownD) * kk;
        if (state !== 'run') return;
        clock += dt;
        const mu = MATS[mi].mu;
        hours = clock < 1 ? 0 : T2 && clock < 1 + T2 ? wait * (clock - 1) / T2 : wait;
        if (clock >= 0.9) { rRead.set(fmt(model.reading(mu, x, d, hours))); rLeft.set((model.decay(hours) * 100).toFixed(0)); }
        if (clock >= 1 + T2) {
          if (!total) { const mean = model.reading(mu, x, d, wait) * CPS * 10; total = Math.max(1, Math.round(mean + Math.sqrt(mean) * (rng() + rng() + rng() - 1.5) * 2)); }
          const f = Math.min(1, (clock - 1 - T2) / 2); rCounts.set(Math.round(total * f));
          if (f >= 1) { total = 0; finish(); }
        }
      },
      frame(dt, time) {
        const th = Math.max(0, shownX) * CM; slab.visible = th > 0.002; slab.scale.x = Math.max(0.002, th); slab.position.x = X0 + th / 2;
        const dx = SX + shownD * M; det.position.x = dx;
        const left = model.decay(hours), active = Math.round(N * left);
        hand.rotation.z = -hours / HALF * Math.PI * 2; aura.scale.setScalar(0.6 + 0.9 * left); capsule.rotation.x += dt * 0.6;
        for (let i = 0; i < N; i++) {
          const p = parts[i];
          if (i >= active) { p.on = false; pos[i * 3 + 1] = -50; continue; }
          if (!p.on) { spawn(p); p.on = true; }
          p.x += SPEED * Math.min(dt, 0.1);
          const run = p.x - EM, py = BY + p.a * run, pz = p.b * run;
          if (p.x >= p.stop || p.x > END || (p.x >= dx && Math.abs(py - BY) < 0.3 && Math.abs(pz) < 0.3)) { spawn(p); pos[i * 3] = EM; pos[i * 3 + 1] = BY; pos[i * 3 + 2] = 0; continue; }
          pos[i * 3] = p.x; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
        }
        geo.attributes.position.needsUpdate = true;
        if (state === 'run') face.material = Math.sin((time || 0) * 14) > 0 ? lampIdle : cyan;
      },
      // Shows a successful run without the player (used by tests): lead, the far end of the rail, the longest wait.
      autoplay() {
        mi = 'lead'; x = Math.min(slot, least); d = maxD; wait = maxW;
        matC?.set?.(mi); xS.set(x); dS.set(d); wS.set(wait);
        mi = 'lead'; x = Math.min(slot, least); d = maxD; wait = maxW;
        measure();
      },
      dispose() { geo.dispose(); rays.material.dispose(); },
      get state() { return state; },
    };
  },
};

export default {
  id: 6,
  theme: {
    sky: ['#0b5c73', '#34399a', '#b7a5ee'], fog: '#4650ad', fogNear: 55, fogFar: 185,
    ground: '#e3ebf5', ground2: '#f3f7fc', side: '#8a9cc0', stone: '#f1f5fb', accent: '#7a4be0', glow: '#6fe8ff', metal: '#8d9bb8', wood: '#c6d0e4', leaf: '#57c9a6', water: '#3fc6e8', crate: '#c9b3f5',
    sun: '#dfeaff', sunPower: 1.7, ambient: 1.4, skyLight: '#bff3ff', groundLight: '#6a58c0', sunDir: [-0.4, 0.85, 0.5], particles: 'dust',
  },
  layout: { shape: 'line', mirror: -1, stones: 5, rise: 0.4, towerH: 4.5 },
  story: {
    title: 'The Nuclear Safety Academy',
    crystal: 'safety badges', crystalEm: '🛡️',
    intro: ['Welcome to the Nuclear Safety Academy! Here we learn how tiny atoms help doctors see inside the body and help make clean electricity.', 'A playful wind has carried our five safety badges across the islands, and a small medical source on the test bench is waiting for its safety check. Will you help me?'],
    remind: 'The safety badges glow soft blue. One floats over the stepping stones, one in the lagoon, and one on top of the white tower.',
    afterCrystals: 'All five badges — well done! Now ride the lift from the tower to the test bench and show me how to keep the detector reading low.',
    afterSim: 'A calm, careful check. Only the Guardian of the Safety Academy is left to meet — the arena is up the steps.',
    notReady: 'A good guardian checks twice. Bring all five safety badges and finish the test bench first, then come and see me.',
    rival: ['So you kept the reading low. Good. But do you know why it worked?', 'We each build a bridge of light, one piece for every right answer. Let us see who reaches the far side first.'],
    win: ['Your bridge is finished before mine. You think carefully and you stay calm — that is what safety means. The portal is yours.'],
    lose: ['My bridge is done and yours is not, but there is no hurry here. Read the tablets again, then come back and try once more.'],
    outro: 'The badges are home, the source is safely checked, and the Guardian is smiling. Time, distance and shielding — you know all three now. The lesson is ready whenever you are.',
  },
  // Scenery that belongs to this world only.
  decorate(k, S) {
    const { THREE } = k, m = S.sim[0] < 0 ? -1 : 1;
    const hard = (x, z, r, y0, y1) => { const s = { type: 'cyl', x, z, r, y0, y1 }; k.level.solids.push(s); k.physics.addSolid(s); };
    const white = k.mat('#f4f8ff', { roughness: 0.55 }), rail = k.mat('#8d9bb8', { metalness: 0.5, roughness: 0.35 }), cyan = k.lit('#6fe8ff', 1.1);
    // the white laboratory on the home island, with a row of four shields to compare
    k.block(-4.6 * m, 2.2, -6.4, 2.6, 2.2, 2.0, { color: '#f4f8ff' }); k.prop('dome', -4.6 * m, 2.2, -6.4, { s: 0.62, color: '#dff6ff' });
    k.mesh(new THREE.BoxGeometry(2.0, 0.4, 0.05), cyan, -4.6 * m, 1.35, -5.38).castShadow = false;
    k.prop('lamp', 3.5, 0, 6.5); k.prop('lamp', -3.5, 0, 6.5);
    [['#4fc8f0', 1.5, 0.35], ['#c3c8d2', 1.0, 0], ['#8fa0b8', 0.5, 0], ['#5a6079', 0.3, 0]].forEach(([c, w, glow], i) => k.block(-7.7 * m, 1.1, -1.8 + i * 1.25, w, 1.1, 0.9, { color: c, emissive: glow }));
    k.sign('🧱 Water · Concrete · Steel · Lead', -7.7 * m, 2.2, 0.1, { size: 0.42 }); k.sign('🧤 Safety first', -4.6 * m, 3.7, -6.4, { size: 0.5 });
    // a giant atom on the middle island: a small nucleus and three electrons on tilted rings
    const mid = S.mid, ax = -4.2 * m, az = mid[2] + 3.6;
    k.mesh(new THREE.CylinderGeometry(0.08, 0.22, 1.7, 8), rail, ax, mid[1] + 0.85, az);
    const core = k.mesh(new THREE.SphereGeometry(0.3, 16, 12), k.mat('#ff9aa8', { roughness: 0.5 }), ax, mid[1] + 2.5, az); core.add(k.glow('#c95be0', 2.6, 0.45));
    for (const [px, py, pz, c] of [[0.27, 0.1, 0.05, '#9fd8ff'], [-0.2, 0.2, 0.12, '#9fd8ff'], [0, -0.22, -0.18, '#ff9aa8']]) k.mesh(new THREE.SphereGeometry(0.26, 14, 10), k.mat(c, { roughness: 0.5 }), px, py, pz, core);
    const electrons = [[0.3, 0, 1.25, 1.7], [1.3, 0.9, 1.25, -1.3], [1.3, -0.9, 1.25, 1.1]].map(([rx, ry, r, w]) => {
      const ring = k.mesh(new THREE.TorusGeometry(r, 0.018, 6, 48), k.lit('#b9a6ff', 0.6), 0, 0, 0, core); ring.rotation.set(rx, ry, 0); ring.castShadow = false;
      const e = k.mesh(new THREE.SphereGeometry(0.1, 12, 8), cyan, r, 0, 0, ring); e.castShadow = false; return { e, r, w };
    });
    k.animate((dt, t) => { core.rotation.y += dt * 0.15; for (const o of electrons) o.e.position.set(Math.cos(t * o.w) * o.r, Math.sin(t * o.w) * o.r, 0); });
    k.sign('⚛️ Atom', ax, mid[1] + 4.3, az, { size: 0.5 });
    // the blue pool on the far island: deep water is a shield, seen safely from the railing
    const px = -4.3 * m, pz = S.far[2] - 2.3, fy = S.far[1];
    k.mesh(new THREE.CylinderGeometry(1.45, 1.5, 0.5, 28), white, px, fy + 0.25, pz);
    const pool = k.mesh(new THREE.CircleGeometry(1.3, 28), k.lit('#38b6ff', 1.3, { roughness: 0.1 }), px, fy + 0.51, pz); pool.rotation.x = -Math.PI / 2; pool.castShadow = false;
    const shine = k.glow('#4fc8ff', 4.2, 0.55); shine.position.set(px, fy + 0.9, pz); k.add(shine);
    k.mesh(new THREE.TorusGeometry(1.5, 0.045, 8, 36), rail, px, fy + 1.1, pz).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) k.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), rail, px + Math.cos(i * Math.PI / 2 + 0.8) * 1.5, fy + 0.8, pz + Math.sin(i * Math.PI / 2 + 0.8) * 1.5);
    hard(px, pz, 1.55, fy, fy + 1.1);
    k.animate((dt, t) => { pool.material.emissiveIntensity = 1.25 + Math.sin(t * 1.1) * 0.25; shine.material.opacity = 0.5 + Math.sin(t * 1.1) * 0.1; });
    k.sign('💧 Water is a shield', px, fy + 2.2, pz, { size: 0.42 });
    // the hospital scanner and the three helpers beside the test bench
    const sx = S.sim[0] + 3.6 * m, sz = S.sim[2] - 5.6, sy = S.sim[1];
    k.mesh(new THREE.BoxGeometry(2.6, 0.3, 1.0), white, sx, sy + 0.15, sz);
    k.mesh(new THREE.TorusGeometry(1.0, 0.3, 14, 36), white, sx, sy + 1.45, sz).rotation.y = Math.PI / 2;
    const scan = k.mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 36), cyan, sx, sy + 1.45, sz); scan.rotation.y = Math.PI / 2; scan.castShadow = false;
    k.mesh(new THREE.BoxGeometry(2.3, 0.1, 0.55), k.mat('#c9b3f5', { roughness: 0.6 }), sx, sy + 1.05, sz);
    hard(sx, sz, 1.3, sy, sy + 2.6);
    k.animate((dt, t) => { scan.position.x = sx + Math.sin(t * 0.7) * 0.25; });
    k.sign('🏥 Scanner', sx, sy + 3.2, sz, { size: 0.45 });
    k.sign('⏱️ Time · 📏 Distance · 🧱 Shielding', S.sim[0], sy + 3.3, S.sim[2] - 4.8, { size: 0.45 });
    k.prop('pillar', S.sim[0] - 5.0 * m, sy, S.sim[2] + 5.2, { solid: true });
    // soft lights around the arena and by the portal
    for (const a of [0.6, 2.2, 3.9, 5.4]) k.prop('lamp', S.arena[0] + Math.cos(a) * 6, S.arena[1], S.arena[2] + Math.sin(a) * 6, { color: '#b9a6ff' });
    for (const s of [-1, 1]) k.prop('lamp', S.end[0] + s * 3.3, S.end[1], S.end[2] - 1.4);
    // far away: two cooling towers with slow, clean water steam, a white hall and a pale moon
    const far = k.mat('#eef3fb', { roughness: 0.9, fog: false, side: THREE.DoubleSide }), steam = k.lit('#eaf6ff', 0.3, { roughness: 1, fog: false, transparent: true, opacity: 0.55 });
    const shape = new THREE.LatheGeometry(Array.from({ length: 12 }, (_, i) => { const h = i / 11; return new THREE.Vector2(7 * (0.62 + 0.38 * ((h - 0.7) / 0.7) ** 2), h * 22); }), 28);
    const puffGeo = new THREE.SphereGeometry(3.2, 12, 8), puffs = [];
    for (const [tx, tz] of [[-46 * m, S.far[2] - 6], [-58 * m, S.far[2] + 16]]) {
      k.mesh(shape, far, tx, -10, tz).castShadow = false;
      for (let i = 0; i < 3; i++) { const p = k.mesh(puffGeo, steam, tx, 12, tz); p.castShadow = false; p.receiveShadow = false; puffs.push({ p, tx, tz, ph: i * 4 + tz * 0.1 }); }
    }
    k.animate((dt, t) => { for (const o of puffs) { const f = ((t * 0.5 + o.ph) % 12) / 12; o.p.position.set(o.tx + f * 5, 13 + f * 16, o.tz + Math.sin(o.ph) * 1.5); o.p.scale.setScalar(0.6 + f * 1.1); } });
    k.mesh(new THREE.SphereGeometry(7, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), far, -44 * m, -8, S.far[2] + 40).castShadow = false;
    k.mesh(new THREE.SphereGeometry(4, 24, 16), k.lit('#eef2ff', 0.5, { roughness: 1, fog: false }), 40 * m, 40, 60).castShadow = false;
  },
  sim,
};
