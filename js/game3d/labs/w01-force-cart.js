// Push the Cart in 3D: a real cart on a 10 m track, pushed and pulled with short shoves until it parks on the star.
// No imports: everything arrives through the context, so the model can be checked without a browser.

// ----- the model: one cart on a straight track, F = m × a, with a steady rolling friction -----
const TRACK = 10, PUSH = 3, FRIC = 1, SHOVE = 0.4;      // metres, newtons, newtons, seconds per shove
export const model = {
  TRACK, PUSH, FRIC, SHOVE,
  mass: (boxes) => 1 + boxes,                             // kg: the empty cart is 1 kg, each box 1 kg
  // Advances { x, v } by dt seconds under the given push (newtons, signed). Returns the speed-up in m/s².
  step(s, force, m, dt) {
    let a = force / m;
    if (Math.abs(s.v) > 0.001) a -= Math.sign(s.v) * FRIC / m;
    else if (force === 0 || Math.abs(force) <= FRIC) { a = 0; s.v = 0; }           // at rest, friction holds it still
    else a -= Math.sign(force) * FRIC / m;
    const v0 = s.v;
    s.v += a * dt;
    if (Math.abs(v0) > 0.001 && Math.sign(s.v) !== Math.sign(v0) && force === 0) s.v = 0;   // friction cannot reverse the motion
    s.x += s.v * dt;
    if (s.x < 0) { s.x = 0; s.v = 0; } else if (s.x > TRACK) { s.x = TRACK; s.v = 0; }
    return a;
  },
  // Where the cart comes to rest if it gets one shove now (dir 1, −1) or none (0), finishing any shove in progress.
  restAfter(s, m, dir, held = 0, heldDir = 0) {
    const c = { x: s.x, v: s.v }; let left = dir ? SHOVE : held; const d = dir || heldDir;
    for (let i = 0; i < 3000; i++) {
      const f = left > 0 ? d * PUSH : 0; model.step(c, f, m, 1 / 60); left -= 1 / 60;
      if (left <= 0 && Math.abs(c.v) < 0.002) break;
    }
    return c.x;
  },
};

// Hand-worked values: 3 N on 1 kg with 1 N friction gives 2 m/s²; after 1 s that is 2 m/s and 1 m travelled;
// friction alone then takes 2 s and 2 m to stop it. The same push on 4 kg gives only 0.5 m/s².
export function selfTest() {
  const s = { x: 1, v: 0 }; let a1 = 0;
  for (let i = 0; i < 1000; i++) a1 = model.step(s, PUSH, 1, 0.001);
  const v1 = s.v, x1 = s.x; let n = 0;
  while (s.v !== 0 && n < 100000) { model.step(s, 0, 1, 0.001); n++; }
  const h = { x: 1, v: 0 }, a4 = model.step(h, PUSH, model.mass(3), 0.001);
  const ok = Math.abs(a1 - 2) < 1e-9 && Math.abs(v1 - 2) < 1e-6 && Math.abs(x1 - 2) < 0.005 && Math.abs(n * 0.001 - 2) < 0.01 && Math.abs(s.x - 4) < 0.01 && Math.abs(a4 - 0.5) < 1e-9;
  return { ok, detail: `1 kg: ${a1.toFixed(2)} m/s², ${v1.toFixed(2)} m/s after 1 s, coasts ${(n * 0.001).toFixed(2)} s to ${s.x.toFixed(2)} m; 4 kg: ${a4.toFixed(2)} m/s²` };
}

export default {
  id: 'w01-force-cart',
  world: 1,
  levels: [1, 2],
  title: 'Push the Cart',
  goal: 'Push and pull the cart so it stops on the star.',
  kind: 'validated',
  model: 'One cart on a straight 10 metre track. Every shove is a constant push of 3 newtons for 0.4 seconds, there is a small steady rolling friction of 1 newton and no air. The empty cart is 1 kg and each box adds 1 kg, and the speed-up follows F = m × a. Real carts also have wheel bearings and air drag.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, U = 0.68, X = (m) => (m - TRACK / 2) * U;      // metres → scene units
    const hard = ctx.level >= 2, need = hard ? 2 : 0;
    const target = 3 + Math.floor(ctx.rng() * 6);                                       // 3…8 m
    const geos = [], add = (geo, mat, x, y, z, parent = group) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    const metal = ctx.mat('#39406b', { metalness: 0.4, roughness: 0.4 }), rail = ctx.mat('#cfd6ee', { metalness: 0.6, roughness: 0.3 }), wood = ctx.mat('#b98045', { roughness: 0.8 });
    const gold = ctx.lit('#ffd76a', 1.4), green = ctx.lit('#6be28a', 1.1), amber = ctx.lit('#ffb347', 1.1);

    // the track: a bed, two rails, buffers at both ends and a post every 2 metres
    add(new THREE.BoxGeometry(TRACK * U + 0.9, 0.12, 1.3), metal, 0, 0.06, 0);
    for (const z of [-0.24, 0.24]) add(new THREE.BoxGeometry(TRACK * U + 0.7, 0.06, 0.07), rail, 0, 0.15, z);
    for (const m of [-0.45, TRACK + 0.45]) add(new THREE.BoxGeometry(0.14, 0.5, 0.8), ctx.mat('#8a5cf6', { roughness: 0.5 }), X(m) + Math.sign(m) * 0.12, 0.37, 0);
    for (let m = 0; m <= TRACK; m += 2) {
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), rail, X(m), 0.3, -0.85);
      const lab = ctx.sprite(m + ' m', { size: 0.42 }); lab.position.set(X(m), 0.82, -0.85); group.add(lab);
    }
    // the star to park under, and its glowing pad on the track (0.4 m either side)
    add(new THREE.BoxGeometry(0.8 * U, 0.03, 1.0), gold, X(target), 0.135, 0);
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.17 : 0.4, a = Math.PI / 2 + i * Math.PI / 5; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false }); starGeo.translate(0, 0, -0.07);
    const star = add(starGeo, gold, X(target), 2.1, 0); star.castShadow = false;
    const halo = ctx.glow('#ffd76a', 1.6, 0.7); star.add(halo);

    // the cart: a deck on four turning wheels, a handle, and up to three boxes
    const cart = new THREE.Group(); group.add(cart);
    add(new THREE.BoxGeometry(0.8, 0.14, 0.62), ctx.mat('#3d7bf0', { roughness: 0.4 }), 0, 0.36, 0, cart);
    add(new THREE.BoxGeometry(0.06, 0.5, 0.56), ctx.mat('#3d7bf0', { roughness: 0.4 }), -0.4, 0.66, 0, cart);
    const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 18); wheelGeo.rotateX(Math.PI / 2); geos.push(wheelGeo);
    const spokeGeo = new THREE.BoxGeometry(0.22, 0.05, 0.1); geos.push(spokeGeo);
    const wheels = [];
    for (const wx of [-0.27, 0.27]) for (const wz of [-0.24, 0.24]) { const w = new THREE.Mesh(wheelGeo, ctx.mat('#20243f', { roughness: 0.7 })); w.position.set(wx, 0.31, wz); w.castShadow = true; w.add(new THREE.Mesh(spokeGeo, rail)); cart.add(w); wheels.push(w); }
    const crates = [[-0.12, 0.6, 0], [0.2, 0.6, 0], [0.04, 0.92, 0]].map(([x, y, z]) => { const c = add(new THREE.BoxGeometry(0.3, 0.3, 0.42), wood, x, y, z, cart); c.userData = { y, drop: 0 }; c.visible = false; return c; });
    // the pusher: a soft padded arm that gives each shove, and two big arrows to tap
    const pusher = new THREE.Group(); group.add(pusher); pusher.visible = false;
    add(new THREE.SphereGeometry(0.2, 16, 12), green, 0, 0, 0, pusher);
    const rodGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8); rodGeo.rotateZ(Math.PI / 2);
    add(rodGeo, rail, -0.42, 0, 0, pusher);
    const arrowGeo = new THREE.ConeGeometry(0.34, 0.6, 4); geos.push(arrowGeo);
    const arrowR = new THREE.Mesh(arrowGeo, green); arrowR.position.set(1.2, 0.45, 1.6); arrowR.rotation.z = -Math.PI / 2; group.add(arrowR);
    const arrowL = new THREE.Mesh(arrowGeo, amber); arrowL.position.set(-1.2, 0.45, 1.6); arrowL.rotation.z = Math.PI / 2; group.add(arrowL);
    // a shelf of spare boxes: tap it to load one more
    const shelf = add(new THREE.BoxGeometry(1.1, 0.1, 0.6), metal, -2.6, 0.5, -1.7);
    for (const lx of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.1, 0.5, 0.5), metal, -2.6 + lx, 0.25, -1.7);
    const spare = [-0.3, 0.05, 0.4].map((dx) => add(new THREE.BoxGeometry(0.3, 0.3, 0.42), wood, -2.6 + dx, 0.7, -1.7));

    const s = { x: 1, v: 0 };
    let boxes = 0, held = 0, dir = 0, a = 0, still = 0, done = false, guess = null, guessed = false, firstPush = true, auto = false, told = false, wheelTurn = 0, flash = 0;
    const rV = ui.readout('Speed (m/s)'), rA = ui.readout('Speed-up (m/s²)'), rX = ui.readout('Position (m)'), rM = ui.readout('Cart mass (kg)'), rD = ui.readout('Distance to the star (m)');
    const shove = (d) => { if (done) return; dir = d; held = SHOVE; };
    const setGuess = (g) => { guess = g; ctx.say('Good guess. Now push the empty cart, then add boxes and push again.'); };
    const setLoad = (b) => {
      b = Math.max(0, Math.min(3, Math.round(b)));
      crates.forEach((c, i) => { if (i < b && !c.visible) c.userData.drop = 1.2; c.visible = i < b; }); spare.forEach((c, i) => { c.visible = i >= b; });
      boxes = b; rM.set(String(model.mass(boxes)));
    };
    const restart = () => { s.x = 1; s.v = 0; held = 0; dir = 0; still = 0; told = false; ctx.say('Back to the start!'); };
    ui.note(hard ? `Delivery: park the cart on the star at ${target} m with at least two boxes on board. Each tap is one short shove of 3 newtons.` : `Park the cart on the star at ${target} m. Each tap is one short shove of 3 newtons.`);
    ui.button('⬅ Pull', () => shove(-1), 'btn gold'); ui.button('Push ➡', () => shove(1), 'btn ok');
    ui.note('Which cart speeds up faster when you push?');
    const guessC = ui.choice([['light', '🧸 Empty cart'], ['heavy', '📦 Full cart']], null, setGuess);
    ui.note('Load:');
    const loadC = ui.choice([[0, 'Empty'], [1, '📦'], [2, '📦📦'], [3, '📦📦📦']], 0, (b) => setLoad(+b));
    ui.button('↺ Start again', restart, 'btn ghost sm');
    ctx.onTap(arrowR, () => shove(1)); ctx.onTap(arrowL, () => shove(-1)); ctx.onTap(cart, () => shove(1));
    const loadMore = () => { const b = (boxes + 1) % 4; loadC.set?.(b); setLoad(b); };
    ctx.onTap(shelf, loadMore); for (const c of spare) ctx.onTap(c, loadMore);
    setLoad(0);
    ctx.say(hard ? 'This cart must deliver at least two boxes to the star. Load it, then push and pull. A heavy cart is slow to start and slow to stop!' : 'Which cart speeds up faster when you push? Choose, then tap Push and see. Pull to slow the cart down so it stops on the star.');

    const place = () => { cart.position.x = X(s.x); for (const w of wheels) w.rotation.z = wheelTurn; };
    place();
    return {
      step(dt) {
        const m = model.mass(boxes);
        if (auto && !done && held <= 0) {
          // the same shoves a player would give: choose the one that leaves the cart nearest the star
          const none = Math.abs(model.restAfter(s, m, 0) - target), push = Math.abs(model.restAfter(s, m, 1) - target), pull = Math.abs(model.restAfter(s, m, -1) - target);
          if (push < none - 0.01 && push <= pull) shove(1); else if (pull < none - 0.01) shove(-1);
        }
        const force = held > 0 ? dir * PUSH : 0, x0 = s.x;
        a = model.step(s, force, m, dt); held -= dt;
        wheelTurn -= (s.x - x0) * U / 0.13;
        rV.set(Math.abs(s.v).toFixed(2)); rA.set(Math.abs(a).toFixed(2)); rX.set(s.x.toFixed(1)); rD.set(Math.abs(s.x - target).toFixed(1));
        if (force !== 0 && firstPush) { firstPush = false; ctx.say('Pushing gives the cart a speed-up. The more boxes, the smaller the speed-up!'); }
        if (boxes >= 2 && force !== 0 && guess && !guessed) {
          guessed = true;
          ctx.say(guess === 'light' ? 'Yes! An empty cart is easier to speed up. Heavy things need a bigger push.' : 'Look at the speed-up number: the full cart gets less. Heavy things need a bigger push!');
        }
        const parked = Math.abs(s.v) < 0.05 && Math.abs(s.x - target) < 0.4;
        if (!done && parked && held <= 0) still += dt; else still = 0;
        if (!done && still > 0.7) {
          if (boxes < need) { if (!told) { told = true; ctx.say('Nicely parked, but this delivery needs at least two boxes. Load the cart, go back to the start and feel how much more pushing a heavy cart needs.'); } }
          else {
            done = true; flash = 1;
            ctx.say('Great parking! A push makes it go, and a pull in the other direction slows it down.');
            ctx.complete(guess ? 1 : 0.85, 'A bigger force or a smaller mass gives a bigger speed-up (F = m × a).');
          }
        }
        if (!parked) told = false;
        place();
      },
      frame(dt, time) {
        star.rotation.y += dt * (done ? 4 : 1.2); star.position.y = 2.1 + (ctx.calm ? 0 : Math.sin(time * 2) * 0.08);
        const pushing = held > 0;
        pusher.visible = pushing;
        if (pushing) { pusher.position.set(cart.position.x - dir * 0.66, 0.6, 0); pusher.scale.x = dir; }
        arrowR.scale.setScalar(pushing && dir > 0 ? 1.25 : 1); arrowL.scale.setScalar(pushing && dir < 0 ? 1.25 : 1);
        for (const c of crates) { if (c.userData.drop > 0) c.userData.drop = Math.max(0, c.userData.drop - dt * 4); c.position.y = c.userData.y + c.userData.drop; }
        if (flash > 0) { flash = Math.max(0, flash - dt); halo.scale.setScalar(1.6 + flash * 1.5); }
      },
      // Plays the lab the way a player would: guess, load the boxes the task asks for, then shove until parked.
      autoplay() { guessC.set?.('light'); if (guess !== 'light') setGuess('light'); loadC.set?.(need); setLoad(need); auto = true; },
      dispose() { for (const g of geos) g.dispose(); },
    };
  },
};
