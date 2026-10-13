// World 4 lab — Rocket Staging, in 3D: a rocket whose tanks you size, which climbs, drops its first stage and
// shows the speed each stage adds. No imports: everything arrives through ctx.

// ----- the model (the same as the 2D lab): Tsiolkovsky's rocket equation, stage by stage -----
const G0 = 9.80665, ISP1 = 300, ISP2 = 350, EPS = 0.07, PROP = 450e3;   // kg of propellant available in total
const NEED_MAX = 9400;                                                  // m/s: 7.8 km/s orbit speed plus losses

// Delta-v of a one or two stage rocket; masses in kg, split = stage-1 share of the propellant.
export function deltaV(payload, split, stages) {
  if (stages === 1) {
    const m0 = payload + (1 + EPS) * PROP, mf = payload + EPS * PROP;
    return [ISP1 * G0 * Math.log(m0 / mf)];
  }
  const p1 = PROP * split, p2 = PROP - p1;
  const m01 = payload + (1 + EPS) * PROP, mf1 = m01 - p1;
  const m02 = mf1 - EPS * p1, mf2 = m02 - p2;
  return [ISP1 * G0 * Math.log(m01 / mf1), ISP2 * G0 * Math.log(m02 / mf2)];
}
const sum = (a) => a.reduce((x, y) => x + y, 0);
// The best two-stage split (1% steps, as on the slider) and the speed gain it gives.
export function bestSplit(payload) { let best = 0, at = 0.05; for (let i = 5; i <= 95; i++) { const v = sum(deltaV(payload, i / 100, 2)); if (v > best) { best = v; at = i / 100; } } return { best, at }; }

// Hand-worked: a 10 t payload. One stage: 491.5 t at lift-off, 41.5 t empty, 300 × 9.80665 × ln(491.5 / 41.5) = 7271.9 m/s.
// Two stages at 60 %: stage 1 burns 270 t (491.5 → 221.5 t), drops an 18.9 t tank (→ 202.6 t), stage 2 burns 180 t (→ 22.6 t).
export function selfTest() {
  const one = deltaV(10e3, 0, 1)[0], two = deltaV(10e3, 0.6, 2);
  const h1 = 300 * 9.80665 * Math.log(491.5 / 41.5), h2a = 300 * 9.80665 * Math.log(491.5 / 221.5), h2b = 350 * 9.80665 * Math.log(202.6 / 22.6);
  const b = bestSplit(10e3);
  const ok = Math.abs(one - h1) < 1e-6 && Math.abs(one - 7271.93) < 0.01 && Math.abs(two[0] - h2a) < 1e-6 && Math.abs(two[1] - h2b) < 1e-6 && Math.abs(two[0] - 2344.89) < 0.01 && Math.abs(two[1] - 7528.07) < 0.01 && b.best > one && b.best > NEED_MAX && one < NEED_MAX;
  return { ok, detail: `10 t payload: one stage ${one.toFixed(0)} m/s (by hand 7272); two stages at 60 % ${two[0].toFixed(0)} + ${two[1].toFixed(0)} m/s (by hand 2345 + 7528); best split ${Math.round(b.at * 100)} % gives ${b.best.toFixed(0)} m/s` };
}

const km = (v, d = 2) => (v / 1000).toFixed(d);

export default {
  id: 'w04-rocket-staging',
  world: 4,
  levels: [5, 6],
  title: 'Rocket Staging',
  goal: 'Split the propellant between two stages to reach orbit speed with your payload.',
  kind: 'validated',
  model: 'Ideal rocket equation, Δv = Isp·g0·ln(m0/mf), with a fixed 450 tonnes of propellant, tanks that weigh 7% of the propellant they hold, and engine efficiency Isp 300 s for stage 1 and 350 s for stage 2. Gravity and air-drag losses are lumped into the required Δv; real rockets also have thrust limits and an Isp that changes with height. The climb you see is shortened and not to scale: only the speeds and masses are calculated.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, calm = !!ctx.calm, lv = ctx.level || 5;
    // a heavier payload at the higher level leaves a much narrower range of splits that work
    const payload = (lv >= 6 ? 10 + Math.floor(ctx.rng() * 4) : 6 + Math.floor(ctx.rng() * 4)) * 1e3;
    const top = bestSplit(payload), need = Math.min(NEED_MAX, Math.floor(top.best * 0.97 / 50) * 50 || NEED_MAX);
    const oneBest = deltaV(payload, 0, 1)[0];

    const white = ctx.mat('#ffffff', { roughness: 0.45 }), blue = ctx.mat('#1f8fe5', { roughness: 0.5 }), orange = ctx.mat('#ff8a3c', { roughness: 0.5 }), gold = ctx.mat('#ffd23f', { roughness: 0.5 }), steel = ctx.mat('#5b6b82', { metalness: 0.4, roughness: 0.4 });
    const own = [];
    const clear = (color, opacity) => { const m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.4, depthWrite: false }); own.push(m); return m; };
    const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

    // ----- launch pad and tower -----
    const RX = -1.1, BASE = 0.36, HP = 1.7;                             // rocket axis, pad top, height of 450 t of propellant
    add(new THREE.CylinderGeometry(1.15, 1.3, 0.3, 24), ctx.mat('#56637a', { roughness: 0.9 }), RX, 0.15, 0);
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20), gold, RX, 0.33, 0);
    const tower = add(new THREE.BoxGeometry(0.22, 2.9, 0.22), steel, RX - 0.95, 1.75, -0.35);
    const arms = [0.9, 1.7, 2.4].map((y) => add(new THREE.BoxGeometry(0.6, 0.07, 0.1), gold, RX - 0.6, y, -0.35));

    // ----- the rocket: unit-height tanks that are stretched to match the split -----
    const rocket = new THREE.Group(); group.add(rocket);
    const s1 = new THREE.Group(), s2 = new THREE.Group(); rocket.add(s1, s2);
    const tank1 = add(new THREE.CylinderGeometry(0.3, 0.3, 1, 20), blue, 0, 0.5, 0, s1);
    const skirt = add(new THREE.CylinderGeometry(0.3, 0.36, 0.14, 20), steel, 0, 0.07, 0, s1);
    const fins = [0, 1, 2, 3].map((i) => { const f = add(new THREE.BoxGeometry(0.3, 0.34, 0.04), gold, 0, 0.17, 0, s1); f.position.set(Math.cos(i * Math.PI / 2) * 0.4, 0.17, Math.sin(i * Math.PI / 2) * 0.4); f.rotation.y = -i * Math.PI / 2; return f; });
    const chute = add(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ctx.mat('#ff6b5a', { roughness: 0.8, side: THREE.DoubleSide }), 0, 0, 0, s1); chute.visible = false;
    const tank2 = add(new THREE.CylinderGeometry(0.24, 0.24, 1, 20), orange, 0, 0.5, 0, s2);
    const ring = add(new THREE.CylinderGeometry(0.25, 0.3, 0.1, 20), white, 0, 0.05, 0, s2);
    const nose = add(new THREE.ConeGeometry(0.24, 0.5, 20), white, 0, 0, 0, s2);
    const sat = new THREE.Group(); s2.add(sat);
    add(new THREE.BoxGeometry(0.16, 0.16, 0.16), gold, 0, 0, 0, sat);
    add(new THREE.BoxGeometry(0.62, 0.02, 0.14), ctx.mat('#2a4fa8', { roughness: 0.3, metalness: 0.3 }), 0, 0, 0, sat);
    const chute2 = add(new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ctx.mat('#ffd23f', { roughness: 0.8, side: THREE.DoubleSide }), 0, 0, 0, s2); chute2.visible = false;
    const flameM = ctx.lit('#ffb347', 2.2);
    const flame = add(new THREE.ConeGeometry(0.2, 0.9, 14), flameM, 0, 0, 0, rocket); flame.rotation.x = Math.PI; flame.castShadow = false; flame.visible = false;
    const fglow = ctx.glow('#ffb347', 1.3, 0.8); flame.add(fglow);
    const plabel = ctx.sprite((payload / 1e3) + ' t payload', { size: 0.4 }); plabel.position.set(RX + 1.25, 2.75, 0.3); group.add(plabel);

    // ----- a small Earth with the orbit the payload must reach -----
    const EC = new THREE.Vector3(0.7, 4.1, -0.4);
    const earth = add(new THREE.SphereGeometry(0.42, 28, 18), ctx.mat('#2f7fe0', { roughness: 0.6 }), EC.x, EC.y, EC.z);
    for (const [lon, lat, sz] of [[0.4, 0.5, 0.2], [2.5, -0.3, 0.17], [4.3, 0.6, 0.14]]) { const d = 0.44 - sz; add(new THREE.SphereGeometry(sz, 10, 8), ctx.mat('#4fc36a', { roughness: 0.9 }), Math.cos(lat) * Math.cos(lon) * d, Math.sin(lat) * d, Math.cos(lat) * Math.sin(lon) * d, earth); }
    const orbit = add(new THREE.TorusGeometry(0.8, 0.012, 6, 60), ctx.lit('#9be7ff', 0.9), EC.x, EC.y, EC.z); orbit.rotation.x = Math.PI / 2 - 0.35; orbit.castShadow = false;

    // ----- clouds that rush past as the rocket gains speed -----
    const puffM = ctx.mat('#ffffff', { roughness: 1 });
    const clouds = [[-3.0, 1.6, -1.6, 0.34], [-2.3, 3.2, -1.9, 0.28], [0.4, 2.2, -2.1, 0.36], [-0.2, 0.9, -1.8, 0.26], [1.3, 3.0, -1.7, 0.3]].map(([x, y, z, r]) => { const m = add(new THREE.SphereGeometry(r, 12, 8), puffM, x, y, z); m.scale.set(1.8, 0.7, 1); m.castShadow = false; return m; });

    // ----- the speed column: what each stage adds, and the goal -----
    const GX = 2.7, GY = 0.35, GS = 0.36, vy = (v) => GY + (v / 1000) * GS;                  // 0…12 km/s
    add(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 20), steel, GX, 0.15, 0);
    add(new THREE.CylinderGeometry(0.2, 0.2, 12 * GS, 20, 1, true), clear('#dff3ff', 0.22), GX, GY + 6 * GS, 0).castShadow = false;
    const bar1 = add(new THREE.CylinderGeometry(0.15, 0.15, 1, 18), ctx.lit('#1f8fe5', 0.5), GX, GY, 0), bar2 = add(new THREE.CylinderGeometry(0.15, 0.15, 1, 18), ctx.lit('#ff8a3c', 0.5), GX, GY, 0);
    const goalRing = add(new THREE.TorusGeometry(0.3, 0.045, 8, 28), ctx.lit('#2bc48a', 1.2), GX, vy(need), 0); goalRing.rotation.x = Math.PI / 2;
    const needle = add(new THREE.SphereGeometry(0.13, 14, 10), ctx.lit('#ffffff', 1.6), GX + 0.36, GY, 0.2); needle.castShadow = false;
    for (const v of [0, 4, 8, 12]) { add(new THREE.BoxGeometry(0.16, 0.025, 0.025), white, GX - 0.3, vy(v * 1000), 0); const s = ctx.sprite(v + ' km/s', { size: 0.3 }); s.position.set(GX - 0.75, vy(v * 1000), 0.1); group.add(s); }
    const gl = ctx.sprite('goal ' + km(need, 1), { size: 0.34, color: '#7dffc5' }); gl.position.set(GX + 0.1, vy(need) + 0.3, 0.45); group.add(gl);

    // ----- state -----
    let stages = 2, split = 0.6, guess = null, told = false, done = false, tries = 0;
    let state = 'ready', T = 0, plan = null, speed = 0, h1 = 0, h2 = 0, climb = 0, flick = 0;
    const drop = { on: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0 };       // the empty first stage on its way down
    const fall = { x: 0, y: 0 }, orb = { a: 0 };

    ui.note(`Mission: lift a ${payload / 1e3} t payload to a speed gain (Δv) of at least ${km(need, 1)} km/s. That is 7.8 km/s for orbit plus what gravity and air take away. You have 450 t of propellant. First, guess: do two stages beat one?`);
    const guessC = ui.choice([['yes', 'My guess: two stages are better'], ['no', 'My guess: one stage is as good']], null, (g) => { guess = g; });
    const stagesC = ui.choice([[1, '1 stage'], [2, '2 stages']], 2, (v) => { stages = v; build(); });
    const splitS = ui.slider({ label: 'Propellant in stage 1', min: 5, max: 95, step: 1, value: 60, unit: '%', onInput: (v) => { split = v / 100; build(); } });
    const r1 = ui.readout('Stage 1 Δv, km/s'), r2 = ui.readout('Stage 2 Δv, km/s'), rt = ui.readout('Total Δv, km/s'), rg = ui.readout('Goal, km/s'), rv = ui.readout('Speed gained now, km/s'), rm = ui.readout('Mass now, t');
    rg.set(km(need, 1));

    // Puts the rocket back on the pad with tanks that match the controls.
    function build() {
      state = 'ready'; T = 0; speed = 0; climb = 0; drop.on = false; flame.visible = false; chute.visible = false; chute2.visible = false;
      const d = deltaV(payload, split, stages), two = stages === 2;
      h1 = two ? HP * split : HP; h2 = two ? HP * (1 - split) : 0;
      rocket.position.set(RX, BASE, 0); rocket.rotation.set(0, 0, 0);
      if (s1.parent !== rocket) rocket.add(s1); s1.position.set(0, 0, 0); s1.rotation.set(0, 0, 0);
      tank1.scale.y = h1; tank1.position.y = 0.14 + h1 / 2;
      s2.position.set(0, 0.14 + h1, 0); s2.rotation.set(0, 0, 0);
      tank2.visible = ring.visible = two; tank2.scale.y = Math.max(0.01, h2); tank2.position.y = 0.1 + h2 / 2;
      const ny = two ? 0.1 + h2 : 0; nose.position.y = ny + 0.25; nose.scale.setScalar(two ? 1 : 1.25); nose.visible = true;
      sat.position.set(0, ny + 0.12, 0); sat.rotation.set(0, 0, 0); sat.visible = false; if (sat.parent !== s2) s2.add(sat);
      bar1.scale.y = Math.max(0.001, d[0] / 1000 * GS); bar1.position.y = GY + d[0] / 1000 * GS / 2;
      const dv2 = d[1] || 0; bar2.visible = dv2 > 0; bar2.scale.y = Math.max(0.001, dv2 / 1000 * GS); bar2.position.y = vy(d[0]) + dv2 / 1000 * GS / 2;
      needle.position.y = GY; arms.forEach((a) => { a.visible = true; });
      r1.set(km(d[0])); r2.set(d[1] != null ? km(d[1]) : '–'); rt.set(km(sum(d))); rv.set('0.00'); rm.set(((payload + (1 + EPS) * PROP) / 1e3).toFixed(1));
    }

    function launch() {
      if (state !== 'ready') build();
      const d = deltaV(payload, split, stages), two = stages === 2, p1 = two ? PROP * split : PROP, p2 = two ? PROP - p1 : 0, m01 = payload + (1 + EPS) * PROP;
      plan = { d, total: sum(d), two, p1, p2, m01, m02: m01 - p1 - EPS * p1, t1: 1.4 + 4.2 * p1 / PROP, t2: two ? 1.4 + 4.2 * p2 / PROP : 0 };
      plan.all = plan.t1 + (two ? 0.7 + plan.t2 : 0);
      state = 'burn1'; T = 0; tries++; arms.forEach((a) => { a.visible = false; });
      if (!told && guess) { told = true; ctx.say(`Lift-off! One stage gives ${km(oneBest)} km/s at best; a good two-stage split gives ${km(top.best)} km/s. Watch what happens when the empty tank is dropped.`); }
      else ctx.say(two ? `Lift-off! Stage 1 burns ${Math.round(p1 / 1e3)} t of propellant, then drops away.` : 'Lift-off! One big stage has to carry its whole empty tank all the way up.');
    }
    function finish() {
      const d = plan.total, parts = plan.two ? `${km(plan.d[0])} + ${km(plan.d[1])} = ${km(d)}` : km(d);
      if (d >= need) {
        state = 'orbit'; sat.visible = true; nose.visible = false; group.attach(sat); orb.a = Math.PI;
        ctx.say(`Orbit reached! Δv = ${parts} km/s, and the goal was ${km(need, 1)} km/s. Each stage's gain is Isp × g0 × ln(mass before ÷ mass after). Stage 2 started light because the empty stage 1 tank (${(EPS * plan.p1 / 1e3).toFixed(1)} t) was dropped, so the same push sped it up much more.`);
        if (!done) { done = true; ctx.complete(guess === 'yes' ? 1 : 0.85, `payload ${payload / 1e3} t, split ${Math.round(split * 100)} %, Δv ${Math.round(d)} m/s, need ${need}, tries ${tries}`); }
      } else {
        state = 'fall'; fall.x = rocket.position.x; fall.y = rocket.position.y; chute2.visible = true; chute2.position.y = (plan.two ? 0.1 + h2 : 0) + 0.8;
        const gap = km(need - d);
        if (!plan.two) ctx.say(`Only ${parts} km/s: short by ${gap} km/s, so the payload floats back down on its parachute. One stage must push its whole 31.5 t empty tank to the very end. Try two stages, so the dead weight can be dropped on the way.`);
        else if (split < top.at) ctx.say(`Only ${parts} km/s: short by ${gap} km/s. Stage 1 was too small, so stage 2 had to haul a big, heavy tank for a long time. Give stage 1 more of the propellant.`);
        else ctx.say(`Only ${parts} km/s: short by ${gap} km/s. Stage 1 took almost everything, so little was left for the lighter, more efficient stage 2. Give stage 1 a little less.`);
      }
    }
    ctx.onTap(tank1, launch); ctx.onTap(tank2, launch); ctx.onTap(nose, launch);
    build();
    ctx.say('Size the two tanks with the slider, then press Launch (or tap the rocket). The blue and orange columns show the speed each stage will add.');
    ui.button('🚀 Launch', launch, 'btn');

    return {
      step(dt) {
        if (state === 'burn1' || state === 'coast' || state === 'burn2') {
          T += dt * (calm ? 1.5 : 1);
          const p = plan; let mass;
          if (T < p.t1) { const u = T / p.t1; mass = p.m01 - p.p1 * u; speed = ISP1 * G0 * Math.log(p.m01 / mass); state = 'burn1'; }
          else if (p.two && T < p.t1 + 0.7) {
            mass = p.m02; speed = p.d[0];
            if (state === 'burn1') {                                       // stage separation
              state = 'coast'; group.attach(s1); drop.on = true; drop.x = s1.position.x; drop.y = s1.position.y; drop.vx = -0.55; drop.vy = 0.5; drop.rot = 0; chute.visible = true; chute.position.y = 0.14 + h1 + 0.3;
              ctx.say(`Stage 1 is empty at ${km(p.d[0])} km/s and drops away under a parachute. The rocket just lost ${(EPS * p.p1 / 1e3).toFixed(1)} t of empty tank it no longer has to push.`);
            }
          } else if (p.two && T < p.all) { const u = (T - p.t1 - 0.7) / p.t2; mass = p.m02 - p.p2 * u; speed = p.d[0] + ISP2 * G0 * Math.log(p.m02 / mass); state = 'burn2'; }
          else { speed = p.total; mass = p.two ? p.m02 - p.p2 : p.m01 - p.p1; rv.set(km(speed)); rm.set((mass / 1e3).toFixed(1)); needle.position.y = vy(speed); finish(); return; }
          climb = 2.5 * Math.pow(Math.min(1, T / p.all), 1.4);
          rocket.position.y = BASE + climb; rocket.position.x = RX + 0.55 * Math.pow(Math.min(1, T / p.all), 2); rocket.rotation.z = -0.3 * Math.pow(Math.min(1, T / p.all), 2);
          needle.position.y = vy(speed); rv.set(km(speed)); rm.set((mass / 1e3).toFixed(1));
        } else if (state === 'orbit') {
          orb.a += dt * 1.6;
          const a = orb.a, tilt = 0.35, target = new THREE.Vector3(EC.x + Math.cos(a) * 0.8, EC.y + Math.sin(a) * 0.8 * Math.sin(tilt), EC.z + Math.sin(a) * 0.8 * Math.cos(tilt));
          sat.position.lerp(target, Math.min(1, dt * 3)); sat.rotation.y += dt * 0.8;
        } else if (state === 'fall') {
          fall.y = Math.max(BASE + 0.3, fall.y - dt * 0.7); fall.x += (1.0 - fall.x) * Math.min(1, dt * 0.6);
          rocket.position.set(fall.x, fall.y, 0); rocket.rotation.z += (0 - rocket.rotation.z) * Math.min(1, dt * 2);
          if (fall.y <= BASE + 0.31) state = 'down';
        }
        if (drop.on) {
          drop.vy = Math.max(-0.75, drop.vy - 1.6 * dt); drop.x += drop.vx * dt; drop.y += drop.vy * dt; drop.vx *= 1 - 0.6 * dt; drop.rot += (0.25 - drop.rot) * Math.min(1, dt * 2);
          if (drop.y <= 0.02) { drop.y = 0.02; drop.on = false; chute.visible = false; }
          s1.position.set(drop.x, drop.y, 0.2); s1.rotation.z = drop.rot * Math.sin(drop.y * 3);
        }
      },
      frame(dt, time) {
        const t = time || 0, burning = state === 'burn1' || state === 'burn2';
        earth.rotation.y += dt * 0.25;
        flame.visible = burning;
        if (burning) {
          flick = calm ? 1 : 0.85 + 0.3 * Math.abs(Math.sin(t * 31)) * Math.abs(Math.cos(t * 17));
          const up = state === 'burn2', w = up ? 0.75 : 1.1; flame.scale.set(w, flick * (up ? 0.8 : 1.15), w);
          flame.position.y = (up ? 0.14 + h1 : 0) - 0.45 * flick * (up ? 0.8 : 1.15) + 0.04;
        }
        const rush = burning || state === 'coast' ? 0.25 + speed / 2500 : 0;
        for (const c of clouds) { c.position.y -= rush * dt; if (c.position.y < 0.5) c.position.y += 3.6; }
        goalRing.scale.setScalar(1 + (calm ? 0 : 0.06 * Math.sin(t * 3)));
        if (state === 'ready' && !calm) rocket.position.y = BASE + 0.004 * Math.sin(t * 9);
      },
      // Shows a successful run without the player (used by tests): the best split, two stages.
      autoplay() { guessC.set('yes'); stagesC.set(2); splitS.set(Math.round(top.at * 100)); launch(); },
      dispose() { group.traverse((o) => { if (o.isMesh || o.isLine) o.geometry?.dispose?.(); }); own.forEach((m) => m.dispose()); },
      get state() { return done ? 'orbit' : state; },
    };
  },
};
