// World 3 lab — See-saw Balance, in 3D.
// A lab file has no imports: everything arrives through the context, so the model can be checked without a browser.

// ----- the model: a weightless plank on one pivot; turning push (moment) = weight × distance from the middle -----
const NS = 3;                                   // seats on each side, 1, 2 and 3 m from the middle
const FRIENDS = [null, ['Mouse', 1], ['Cat', 2], ['Dog', 3], ['Bear', 4]];
const G = 9.81;                                 // m/s²
const UNIT = 10;                                // one weight unit is shown as 10 kg when the plank swings
const TILT = 0.31;                              // the plank's end touches the ground at this angle, rad
export const model = {
  NS, FRIENDS,
  // left and right are lists of weights at 1, 2, 3 m from the middle
  push: (side) => side.reduce((s, m, i) => s + m * (i + 1), 0),
  torque: (left, right) => model.push(right) - model.push(left),          // positive: the right side goes down
  result(left, right) { const t = model.torque(left, right); return t < 0 ? 'L' : t > 0 ? 'R' : 'B'; },
  inertia: (left, right) => [...left, ...right].reduce((s, m, i) => s + m * UNIT * ((i % NS) + 1) ** 2, 0),   // kg·m²
  // One time step of the swinging plank. angle > 0 means the right side is down. Returns true when it hits the ground.
  swing(s, left, right, dt) {
    const I = Math.max(1, model.inertia(left, right)), acc = model.torque(left, right) * UNIT * G * Math.cos(s.angle) / I;
    s.speed += (acc - 0.6 * s.speed) * dt; s.angle += s.speed * dt;
    if (Math.abs(s.angle) > TILT) { s.angle = Math.sign(s.angle) * TILT; const hit = Math.abs(s.speed) > 0.25; s.speed *= -0.25; return hit; }
    return false;
  },
  // The fewest friends on the right that balance the left side. `closed` is a right seat (0-based) that may not be used.
  solve(left, closed = -1) {
    const want = model.push(left); let best = null;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) for (let c = 0; c < 5; c++) {
      const r = [a, b, c]; if (closed >= 0 && r[closed]) continue; if (model.push(r) !== want) continue;
      const n = r.filter(Boolean).length; if (n && (!best || n < best.n)) best = { r, n };
    }
    return best && best.r;
  },
};
// Used by the automated tests: hand-worked moments, and every task the lab can set has an answer.
export function selfTest() {
  const a = model.torque([0, 0, 2], [3, 0, 0]);                 // 2 at 3 m against 3 at 1 m: 6 against 3, left goes down
  const b = model.torque([0, 4, 0], [0, 0, 2]) + model.torque([0, 0, 2], [0, 3, 0]);   // 8 against 6, then 6 against 6
  const c = model.result([0, 0, 4], [4, 4, 0]);                 // 12 against 4 + 8
  let all = true;
  for (let d = 0; d < NS; d++) for (let m = 2; m <= 4; m++) { const left = [0, 0, 0]; left[d] = m; if (!model.solve(left) || !model.solve(left, d)) all = false; }
  const s = { angle: 0, speed: 0 }; for (let i = 0; i < 600; i++) model.swing(s, [0, 0, 2], [3, 0, 0], 1 / 60);
  const still = { angle: 0, speed: 0 }; for (let i = 0; i < 600; i++) model.swing(still, [0, 0, 2], [0, 3, 0], 1 / 60);
  const ok = a === -3 && b === -2 && c === 'B' && model.push([1, 2, 3]) === 14 && all && Math.abs(s.angle + TILT) < 0.02 && still.angle === 0;
  return { ok, detail: `2 at 3 m against 3 at 1 m: 6 against 3, tips left (angle ${s.angle.toFixed(2)} rad); 2 at 3 m balances 3 at 2 m (6 = 6); 4 at 3 m = 4 at 1 m + 4 at 2 m; every task solvable: ${all}` };
}

export default {
  id: 'w03-seesaw',
  world: 3,
  levels: [1, 2],
  title: 'See-saw Balance',
  goal: 'Put friends on the right side so the see-saw balances.',
  kind: 'validated',
  model: 'A weightless plank on one pivot, with seats 1, 2 and 3 metres from the middle and animals with weights of 1 to 4 units. Each side\'s turning push is its weights × distances added up; the plank tips to the side with the bigger push and balances when they are equal. No friction at the pivot. Real see-saws also have the weight of the plank and the seat, and a real mouse is far more than four times lighter than a bear.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, hard = ctx.level >= 2;
    const PY = 1.05, HALF = 3.4;                                             // pivot height and half the plank's length, m
    const wood = ctx.mat('#c98a4b', { roughness: 0.7 }), iron = ctx.mat('#4a4038', { metalness: 0.5, roughness: 0.5 }), brass = ctx.mat('#e3b341', { metalness: 0.65, roughness: 0.3 });
    const seatL = ctx.mat('#8a5a2b', { roughness: 0.8 }), seatR = ctx.lit('#ffc94d', 0.5), seatOff = ctx.mat('#7d7770', { roughness: 0.9 }), dark = ctx.mat('#2e2925', { roughness: 0.9 }), white = ctx.mat('#fff6e6', { roughness: 0.8 });
    const fur = [null, ctx.mat('#b9b2a6', { roughness: 0.9 }), ctx.mat('#f5a524', { roughness: 0.9 }), ctx.mat('#d08b4c', { roughness: 0.9 }), ctx.mat('#7a4a2a', { roughness: 0.9 })];
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const ball = new THREE.SphereGeometry(0.5, 16, 12), cone = new THREE.ConeGeometry(0.5, 1, 10), boxG = new THREE.BoxGeometry(1, 1, 1);

    // the ground mat, the pivot and the plank
    add(boxG, ctx.mat('#93ad4c', { roughness: 1 }), 0, 0.04, 0).scale.set(7, 0.08, 2.6);
    const wedge = new THREE.CylinderGeometry(0.06, 0.62, PY - 0.1, 3); wedge.rotateY(Math.PI / 6); wedge.scale(1, 1, 1.5);
    add(wedge, brass, 0, (PY - 0.1) / 2 + 0.08, 0);
    const pin = new THREE.CylinderGeometry(0.09, 0.09, 1.25, 12); pin.rotateX(Math.PI / 2); add(pin, iron, 0, PY - 0.06, 0);
    const plank = new THREE.Group(); plank.position.set(0, PY, 0); group.add(plank);
    add(boxG, wood, 0, 0.06, 0, plank).scale.set(HALF * 2, 0.12, 0.95);
    for (const sx of [-1, 1]) { const h = add(new THREE.TorusGeometry(0.16, 0.035, 8, 14, Math.PI), iron, sx * (HALF - 0.12), 0.12, 0, plank); h.rotation.y = Math.PI / 2; }

    // the task: one friend is already sitting on the left
    const lockedD = Math.floor(ctx.rng() * NS), lockedM = 2 + Math.floor(ctx.rng() * 3);
    const left = [0, 0, 0], right = [0, 0, 0]; left[lockedD] = lockedM;
    const closed = hard ? lockedD : -1;                                      // level 2: the matching seat is closed

    // seats: slot index 0..2 on each side is 1, 2, 3 m from the middle
    const seats = [-1, 1].map((sx) => [0, 1, 2].map((i) => {
      const off = sx > 0 && i === closed, s = add(boxG, off ? seatOff : sx > 0 ? seatR : seatL, sx * (i + 1), 0.15, 0, plank); s.scale.set(0.72, 0.07, 0.8);
      const tag = ctx.sprite(`${i + 1} m`, { size: 0.26 }); tag.position.set(sx * (i + 1), -0.22, 0.6); plank.add(tag);
      if (off) { const c = add(cone, ctx.mat('#e0662a'), sx * (i + 1), 0.43, 0, plank); c.scale.set(0.42, 0.5, 0.42); add(boxG, white, 0, -0.1, 0, c).scale.set(1.04, 0.22, 1.04); }
      return s;
    }));

    // a friend made of round shapes; bigger friends are heavier
    const figures = [[null, null, null], [null, null, null]];
    const build = (kind) => {
      const g = new THREE.Group(), s = 0.3 + kind * 0.115, f = fur[kind];
      const part = (geo, material, x, y, z, sx, sy = sx, sz = sx) => { const m = add(geo, material, x * s, y * s, z * s, g); m.scale.set(sx * s, sy * s, sz * s); return m; };
      part(ball, f, 0, 0.52, 0, 1, 1.05, 0.9); part(ball, f, 0, 1.25, 0.06, 0.74);
      part(ball, white, 0, 0.5, 0.33, 0.55, 0.62, 0.4); part(ball, white, 0, 1.15, 0.36, 0.3, 0.24, 0.2); part(ball, dark, 0, 1.2, 0.46, 0.09);
      for (const e of [-1, 1]) {
        part(ball, dark, e * 0.15, 1.36, 0.36, 0.08);
        if (kind === 1) part(ball, f, e * 0.33, 1.62, 0, 0.42, 0.42, 0.14);                                // mouse: big round ears
        else if (kind === 2) part(cone, f, e * 0.24, 1.68, 0, 0.26, 0.34, 0.2);                            // cat: pointed ears
        else if (kind === 3) part(ball, fur[4], e * 0.4, 1.28, 0, 0.2, 0.5, 0.26);                         // dog: floppy ears
        else part(ball, f, e * 0.3, 1.58, 0, 0.26, 0.26, 0.18);                                            // bear: small round ears
        part(ball, f, e * 0.34, 0.12, 0.3, 0.3, 0.22, 0.42);
      }
      if (kind === 1) part(ball, ctx.mat('#f0a0a8'), 0.3, 0.2, -0.5, 0.1, 0.1, 0.7);
      if (kind === 2) part(ball, f, 0.3, 0.5, -0.5, 0.14, 0.7, 0.14);
      const n = ctx.sprite(String(FRIENDS[kind][1]), { size: 0.42 }); n.position.set(0, s * 1.7 + 0.32, 0); g.add(n);
      g.userData.h = 0;
      return g;
    };
    const clearFig = (g) => { g.traverse((o) => { if (o.isSprite) { o.material.map?.dispose?.(); o.material.dispose?.(); } }); plank.remove(g); };
    const seat = (side, i, kind) => {
      const arr = side ? right : left; arr[i] = kind;
      if (figures[side][i]) { clearFig(figures[side][i]); figures[side][i] = null; }
      if (kind) { const g = build(kind); g.position.set((side ? 1 : -1) * (i + 1), 0.19, 0); g.rotation.y = side ? -0.35 : 0.35; plank.add(g); figures[side][i] = g; g.userData.h = 1; }
    };

    // two props hold the plank level until the player lets go
    const props = [-1, 1].map((sx) => { const p = add(boxG, iron, sx * 3.1, (PY - 0.02) / 2, -0.75); p.scale.set(0.2, PY - 0.02, 0.2); const arm = add(boxG, iron, 0, 0.5, 0.75 / 0.2 / 2, p); arm.scale.set(1, 0.08, 0.75 / 0.2 + 1); return p; });
    const arrowL = add(cone, ctx.lit('#ff8a5c', 1.1), -3.1, 3.3, 0), arrowR = add(cone, ctx.lit('#ff8a5c', 1.1), 3.1, 3.3, 0);
    for (const a of [arrowL, arrowR]) { a.scale.set(0.5, 0.6, 0.5); a.rotation.x = Math.PI; a.visible = false; a.castShadow = false; }
    const star = add(new THREE.OctahedronGeometry(0.3), ctx.lit('#ffd76a', 1.6), 0, 3.4, 0); star.visible = false; star.castShadow = false;
    const title = ctx.sprite('? = ?', { size: 0.5 }); title.position.set(0, 4.3, 0); group.add(title);
    let board = title;
    const show = (text) => { group.remove(board); board.material.map?.dispose?.(); board.material.dispose?.(); board = ctx.sprite(text, { size: 0.5 }); board.position.set(0, 4.3, 0); group.add(board); };

    let s = { angle: 0, speed: 0 }, released = false, guess = null, done = false, first = true, firstOK = false, hold = 0, propDown = 0, tries = 0;
    const rL = ui.readout('Left push (weight × metres)'), rR = ui.readout('Right push (weight × metres)'), rA = ui.readout('Tilt, degrees');
    const sum = (side) => side.map((m, i) => (m ? `${m}×${i + 1}` : '')).filter(Boolean).join(' + ') || '0';
    const refresh = () => { rL.set(`${model.push(left)}  (${sum(left)})`); rR.set(`${model.push(right)}  (${sum(right)})`); };
    const reset = () => { released = false; hold = 0; arrowL.visible = arrowR.visible = false; star.visible = false; show('? = ?'); };
    let sliders = [];
    const setRight = (i, kind, quiet) => {
      kind = Math.max(0, Math.min(4, Math.round(kind)));
      if (i === closed) { if (!quiet) ctx.say(`That seat is closed today. Try a seat nearer or farther: a friend who sits farther from the middle pushes harder.`); if (sliders[i] && sliders[i].value !== 0) sliders[i].set(0); return; }
      if (right[i] === kind) return;
      seat(1, i, kind); reset(); refresh();
      if (sliders[i] && sliders[i].value !== kind) sliders[i].set(kind);
      if (!quiet && !done) ctx.say(kind ? `${FRIENDS[kind][0]} (weight ${kind}) sits ${i + 1} m from the middle: a push of ${kind} × ${i + 1} = ${kind * (i + 1)}. Guess which way it tips, then let go.` : 'Seat emptied. Guess again, then let go.');
    };
    sliders = [0, 1, 2].map((i) => ui.slider({ label: `Right seat at ${i + 1} m: 0 empty, 1 mouse, 2 cat, 3 dog, 4 bear`, min: 0, max: 4, step: 1, value: 0, unit: '', onInput: (v) => setRight(i, v) }));
    seats[1].forEach((mesh, i) => ctx.onTap(mesh, () => setRight(i, (right[i] + 1) % 5)));
    const guessC = ui.choice([['L', '⬅ Left goes down'], ['B', '⚖ Balanced'], ['R', 'Right goes down ➡']], null, (g) => { guess = g; });
    const release = () => {
      if (done) return;
      if (!guess) { ctx.say('Pick a guess first: left down, balanced, or right down?'); return; }
      const res = model.result(left, right), l = model.push(left), r = model.push(right);
      released = true; hold = 0; tries++; s.speed = 0;
      if (first) { first = false; firstOK = res === 'B' && right.some(Boolean); }
      arrowL.visible = res === 'L'; arrowR.visible = res === 'R';
      show(`${l} ${res === 'B' ? '=' : res === 'L' ? '>' : '<'} ${r}`);
      const told = res === guess ? 'Your guess was right! ' : 'Not what you guessed. ';
      if (res === 'B' && !right.some(Boolean)) ctx.say('Nothing to balance yet. Put a friend on the right side.');
      else if (res === 'B') ctx.say(`${told}Balanced! Both sides push with ${l}. Heavy and close to the middle can match light and far away.`);
      else ctx.say(`${told}The ${res === 'L' ? 'left' : 'right'} side goes down because its push is bigger: ${l} on the left against ${r} on the right. Push = weight × distance from the middle, so ${res === 'L' ? 'add weight on the right or move a friend farther out' : 'take weight off the right or move a friend closer in'}.`);
    };
    ui.button('▶ Let go!', release, 'btn');
    ui.button('🧹 Clear right side', () => { for (let i = 0; i < NS; i++) setRight(i, 0, true); reset(); ctx.say('The right side is empty again.'); }, 'btn ghost');
    ui.note(`Tap a glowing seat on the right to change the friend sitting there. Mouse 1, cat 2, dog 3, bear 4. ${hard ? 'The seat straight across from your friend is closed, so use a different distance.' : 'The see-saw balances when weight × distance is the same on both sides.'}`);

    seat(0, lockedD, lockedM); refresh();
    ctx.say(`${FRIENDS[lockedM][0]} (weight ${lockedM}) is sitting ${lockedD + 1} m from the middle on the left. Put friends on the right so the see-saw stays level${hard ? ', without using the closed seat' : ''}.`);

    return {
      step(dt) {
        if (released) { const hit = model.swing(s, left, right, dt); if (hit && !ctx.calm) for (const side of figures) for (const g of side) if (g) g.userData.h = 0.6; }
        else { s.speed = 0; s.angle += (0 - s.angle) * Math.min(1, dt * 5); if (Math.abs(s.angle) < 1e-4) s.angle = 0; }
        propDown += ((released ? 1 : 0) - propDown) * Math.min(1, dt * 6);
        if (released && !done && model.result(left, right) === 'B' && right.some(Boolean) && Math.abs(s.angle) < 0.01) {
          hold += dt;
          if (hold > 0.8) {
            done = true; star.visible = true;
            for (const side of figures) for (const g of side) if (g) g.userData.h = 1;
            ctx.complete(firstOK ? 1 : 0.7, `push ${model.push(left)} = ${model.push(right)}, tries=${tries}`);
          }
        } else if (!done) hold = 0;
      },
      frame(dt, time) {
        plank.rotation.z = -s.angle; rA.set((s.angle * 180 / Math.PI).toFixed(1) + (s.angle > 0.005 ? ' (right down)' : s.angle < -0.005 ? ' (left down)' : ' (level)'));
        props.forEach((p) => { p.position.y = (PY - 0.02) / 2 - propDown * (PY + 0.1); p.visible = propDown < 0.97; });
        for (const side of figures) for (const g of side) if (g) { g.userData.h = Math.max(0, g.userData.h - dt * 2.2); g.position.y = 0.19 + (ctx.calm ? 0 : Math.abs(Math.sin(g.userData.h * Math.PI * 2)) * 0.22 * g.userData.h); }
        const bob = ctx.calm ? 0 : Math.sin(time * 4) * 0.1; arrowL.position.y = arrowR.position.y = 3.3 + bob;
        if (star.visible) { star.rotation.y = time * 1.5; star.position.y = 3.4 + bob; }
        if (done && !ctx.calm) for (const side of figures) for (const g of side) if (g && g.userData.h <= 0 && Math.sin(time * 3 + g.position.x) > 0.98) g.userData.h = 0.5;
      },
      // Shows a successful run without the player (used by tests).
      autoplay() {
        const want = model.solve(left, closed);
        for (let i = 0; i < NS; i++) { setRight(i, want[i], true); sliders[i].set(want[i]); }
        guess = 'B'; guessC.set?.('B'); release();
      },
      dispose() {
        for (const side of figures) for (const g of side) if (g) clearFig(g);
        ball.dispose(); cone.dispose(); boxG.dispose(); wedge.dispose(); pin.dispose();
      },
    };
  },
};
