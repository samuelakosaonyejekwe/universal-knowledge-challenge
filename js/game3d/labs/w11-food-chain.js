// 3D lab — Build a Food Chain: living things hop onto stepping stones that lead away from the Sun,
// and sparks of energy travel along the chain as far as the order is right.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

const CHAINS = [
  ['grass', 'rabbit', 'fox'],
  ['leaf', 'caterpillar', 'bird', 'hawk'],
  ['seeds', 'mouse', 'owl'],
  ['plankton', 'small fish', 'penguin'],
];
const EXTRA = ['cow', 'mushroom'];

// ----- the logic: is every stone holding the right living thing, and if not, where does the chain break? -----
export const model = {
  CHAINS, EXTRA,
  // slots: the names standing on the stones, in order from the Sun. bad = index of the first wrong stone, or -1.
  judge(chain, slots) { const bad = chain.findIndex((name, i) => slots[i] !== name); return { right: bad < 0 && slots.length === chain.length, bad }; },
  score: (producerGuessRight, tries) => Math.max(0.5, (producerGuessRight ? 1 : 0.85) - (tries - 1) * 0.15),
};
export function selfTest() {
  const a = model.judge(CHAINS[0], ['grass', 'rabbit', 'fox']), b = model.judge(CHAINS[0], ['rabbit', 'grass', 'fox']), c = model.judge(CHAINS[1], ['leaf', 'caterpillar', 'hawk', 'bird']), d = model.judge(CHAINS[2], ['seeds', 'cow', 'owl']);
  const producers = CHAINS.map((ch) => ch[0]).join(', ');
  const ok = a.right && a.bad === -1 && !b.right && b.bad === 0 && !c.right && c.bad === 2 && !d.right && d.bad === 1
    && model.score(true, 1) === 1 && model.score(false, 1) === 0.85 && Math.abs(model.score(true, 3) - 0.7) < 1e-9 && model.score(false, 9) === 0.5
    && producers === 'grass, leaf, seeds, plankton' && CHAINS.every((ch) => EXTRA.every((e) => !ch.includes(e)));
  return { ok, detail: `right order accepted; swapped start breaks at stone 1, swapped end at stone 3, a cow in the middle at stone 2; producers: ${producers}; score 1 → 0.85 → 0.7 → floor 0.5` };
}

// Low-poly figures made of a few simple shapes: [shape, colour, x, y, z, sx, sy, sz, turn about z]. Animals face +x.
const R = Math.PI / 2;
const SHAPES = {
  grass: [['ball', '#2f8f3e', 0, 0.05, 0, 0.32, 0.08, 0.32], ['cone', '#3fae4a', 0, 0.36, 0, 0.07, 0.62, 0.07], ['cone', '#4cc35b', 0.16, 0.3, 0.05, 0.06, 0.5, 0.06, -0.3], ['cone', '#4cc35b', -0.16, 0.3, -0.04, 0.06, 0.5, 0.06, 0.3], ['cone', '#3fae4a', 0.05, 0.27, 0.17, 0.05, 0.44, 0.05, -0.1], ['cone', '#2f9e44', -0.06, 0.27, -0.17, 0.05, 0.44, 0.05, 0.12]],
  leaf: [['cyl', '#2f8f3e', 0, 0.3, 0, 0.03, 0.6, 0.03], ['ball', '#4cc35b', 0.2, 0.42, 0, 0.22, 0.05, 0.13, 0.5], ['ball', '#3fae4a', -0.2, 0.3, 0, 0.22, 0.05, 0.13, -0.5], ['ball', '#4cc35b', 0, 0.62, 0, 0.13, 0.05, 0.22], ['ball', '#3fae4a', 0, 0.2, 0.16, 0.12, 0.04, 0.18]],
  seeds: [['cyl', '#b9a04a', 0, 0.3, 0, 0.025, 0.6, 0.025], ['ball', '#e6b84a', 0, 0.62, 0, 0.09, 0.11, 0.09], ['ball', '#f0c95c', 0.07, 0.74, 0, 0.07, 0.09, 0.07], ['ball', '#f0c95c', -0.07, 0.74, 0, 0.07, 0.09, 0.07], ['ball', '#e6b84a', 0, 0.86, 0, 0.07, 0.1, 0.07], ['ball', '#e6b84a', 0.2, 0.05, 0.12, 0.07, 0.05, 0.05], ['ball', '#f0c95c', -0.18, 0.05, -0.1, 0.07, 0.05, 0.05]],
  plankton: [['cyl', '#5aaee8', 0, 0.04, 0, 0.36, 0.08, 0.36], ['ball', '#58d08a', 0, 0.42, 0, 0.14], ['ball', '#7be0a4', 0.2, 0.3, 0.06, 0.09], ['ball', '#7be0a4', -0.19, 0.5, -0.05, 0.08], ['ball', '#58d08a', 0.08, 0.64, 0.1, 0.07], ['ball', '#3fbf7a', -0.1, 0.26, 0.14, 0.07]],
  rabbit: [['ball', '#cbb8a4', 0, 0.2, 0, 0.25, 0.19, 0.17], ['ball', '#cbb8a4', 0.24, 0.38, 0, 0.14], ['ball', '#cbb8a4', 0.22, 0.62, 0.06, 0.04, 0.15, 0.055], ['ball', '#cbb8a4', 0.22, 0.62, -0.06, 0.04, 0.15, 0.055], ['ball', '#ffffff', -0.25, 0.22, 0, 0.075], ['ball', '#2b2b33', 0.34, 0.42, 0.08, 0.025]],
  fox: [['ball', '#f08c3a', 0, 0.27, 0, 0.3, 0.17, 0.15], ['cone', '#f08c3a', 0.4, 0.4, 0, 0.14, 0.28, 0.14, -R], ['cone', '#f08c3a', 0.3, 0.57, 0.08, 0.05, 0.13, 0.05], ['cone', '#f08c3a', 0.3, 0.57, -0.08, 0.05, 0.13, 0.05], ['ball', '#f08c3a', -0.4, 0.32, 0, 0.2, 0.09, 0.09, -0.4], ['ball', '#fff4e0', -0.56, 0.4, 0, 0.07], ['ball', '#fff4e0', 0.2, 0.22, 0, 0.12, 0.1, 0.1]],
  caterpillar: [['ball', '#8fd14f', -0.3, 0.11, 0, 0.1], ['ball', '#a6e063', -0.15, 0.15, 0, 0.11], ['ball', '#8fd14f', 0, 0.12, 0, 0.11], ['ball', '#a6e063', 0.15, 0.15, 0, 0.11], ['ball', '#5fae2f', 0.31, 0.17, 0, 0.13], ['ball', '#2b2b33', 0.41, 0.21, 0.06, 0.025]],
  bird: [['ball', '#4aa3e0', 0, 0.27, 0, 0.2, 0.17, 0.16], ['ball', '#4aa3e0', 0.18, 0.45, 0, 0.11], ['cone', '#f5a623', 0.32, 0.45, 0, 0.04, 0.11, 0.04, -R], ['box', '#2f7fc0', -0.26, 0.3, 0, 0.16, 0.03, 0.1], ['ball', '#2f7fc0', -0.02, 0.29, 0.14, 0.13, 0.09, 0.04], ['ball', '#fff4e0', 0.1, 0.2, 0, 0.12, 0.09, 0.11]],
  hawk: [['ball', '#8a5a34', 0, 0.38, 0, 0.2, 0.3, 0.18], ['ball', '#f1e3c6', 0.07, 0.74, 0, 0.13], ['cone', '#f2c12e', 0.21, 0.7, 0, 0.04, 0.1, 0.04, -R - 0.5], ['ball', '#6e4526', -0.02, 0.42, 0.2, 0.12, 0.27, 0.05], ['ball', '#6e4526', -0.02, 0.42, -0.2, 0.12, 0.27, 0.05], ['box', '#6e4526', -0.16, 0.1, 0, 0.14, 0.03, 0.14], ['ball', '#2b2b33', 0.17, 0.78, 0.07, 0.025]],
  mouse: [['ball', '#a9a9b5', 0, 0.14, 0, 0.22, 0.13, 0.13], ['cone', '#a9a9b5', 0.26, 0.15, 0, 0.09, 0.2, 0.09, -R], ['ball', '#f3b6c0', 0.15, 0.3, 0.08, 0.07, 0.07, 0.025], ['ball', '#f3b6c0', 0.15, 0.3, -0.08, 0.07, 0.07, 0.025], ['cyl', '#f3b6c0', -0.34, 0.08, 0, 0.015, 0.28, 0.015, R], ['ball', '#2b2b33', 0.3, 0.2, 0.06, 0.02]],
  owl: [['ball', '#9b7b55', 0, 0.36, 0, 0.23, 0.32, 0.21], ['ball', '#9b7b55', 0.02, 0.72, 0, 0.2, 0.17, 0.19], ['ball', '#ffffff', 0.17, 0.74, 0.08, 0.07], ['ball', '#ffffff', 0.17, 0.74, -0.08, 0.07], ['ball', '#2b2b33', 0.23, 0.74, 0.08, 0.03], ['ball', '#2b2b33', 0.23, 0.74, -0.08, 0.03], ['cone', '#f2c12e', 0.21, 0.66, 0, 0.03, 0.07, 0.03, Math.PI], ['ball', '#f1e3c6', 0.13, 0.34, 0, 0.14, 0.22, 0.15]],
  'small fish': [['cyl', '#5aaee8', 0, 0.04, 0, 0.36, 0.08, 0.36], ['ball', '#ffa94d', 0, 0.42, 0, 0.26, 0.15, 0.09], ['cone', '#ff8c2e', -0.34, 0.42, 0, 0.14, 0.18, 0.04, -R], ['cone', '#ff8c2e', 0, 0.6, 0, 0.08, 0.1, 0.03], ['ball', '#2b2b33', 0.17, 0.46, 0.07, 0.025], ['ball', '#ffffff', 0.1, 0.72, 0, 0.03]],
  penguin: [['ball', '#2b3350', 0, 0.38, 0, 0.21, 0.35, 0.19], ['ball', '#ffffff', 0.07, 0.35, 0, 0.17, 0.28, 0.15], ['ball', '#2b3350', 0, 0.78, 0, 0.15], ['cone', '#f5a623', 0.17, 0.77, 0, 0.04, 0.11, 0.04, -R], ['ball', '#f5a623', 0.07, 0.03, 0.09, 0.1, 0.03, 0.06], ['ball', '#f5a623', 0.07, 0.03, -0.09, 0.1, 0.03, 0.06], ['ball', '#2b3350', 0, 0.4, 0.2, 0.05, 0.2, 0.04]],
  cow: [['ball', '#ffffff', 0, 0.42, 0, 0.34, 0.2, 0.18], ['ball', '#4a3a33', -0.1, 0.5, 0.1, 0.14, 0.1, 0.1], ['ball', '#4a3a33', 0.14, 0.4, -0.12, 0.1, 0.1, 0.08], ['ball', '#ffffff', 0.38, 0.5, 0, 0.13, 0.12, 0.11], ['ball', '#f3b6c0', 0.48, 0.46, 0, 0.07, 0.06, 0.08], ['cyl', '#ffffff', 0.2, 0.12, 0.1, 0.04, 0.24, 0.04], ['cyl', '#ffffff', 0.2, 0.12, -0.1, 0.04, 0.24, 0.04], ['cyl', '#ffffff', -0.2, 0.12, 0.1, 0.04, 0.24, 0.04], ['cyl', '#ffffff', -0.2, 0.12, -0.1, 0.04, 0.24, 0.04]],
  mushroom: [['cyl', '#f1e3c6', 0, 0.2, 0, 0.09, 0.4, 0.09], ['ball', '#b9794a', 0, 0.44, 0, 0.3, 0.16, 0.3], ['cyl', '#f1e3c6', 0.26, 0.1, 0.1, 0.05, 0.2, 0.05], ['ball', '#c98a5a', 0.26, 0.22, 0.1, 0.15, 0.09, 0.15]],
};
const PLANTS = ['grass', 'leaf', 'seeds', 'plankton', 'mushroom'];

export default {
  id: 'w11-food-chain',
  world: 11,
  levels: [1, 2],
  title: 'Build a Food Chain',
  goal: 'Put the living things on the stepping stones in order, starting next to the Sun: who gets energy from sunlight, and who eats whom. Then send the energy along the chain.',
  kind: 'validated',
  model: 'The order of each chain is checked exactly: a plant that makes its own food from sunlight comes first, and each animal stands after the thing it eats. Real food webs are tangled, with many animals eating many foods. This shows one simple line, and leaves out decomposers and the energy lost at each step.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, rng = ctx.rng || Math.random, L = ctx.level;
    const tap = ctx.onTap || (() => {});
    const chain = CHAINS[Math.floor(rng() * CHAINS.length) % CHAINS.length], extra = EXTRA[Math.floor(rng() * EXTRA.length) % EXTRA.length];
    const names = [...chain, ...(L >= 2 ? [extra] : [])].map((v) => [v, rng()]).sort((p, q) => p[1] - q[1]).map((v) => v[0]);
    const n = chain.length;

    // ----- ground, the Sun and the stepping stones -----
    const GEO = { ball: new THREE.SphereGeometry(1, 10, 8), cone: new THREE.ConeGeometry(1, 1, 6), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10) };
    const flat = (c) => ctx.mat(c, { roughness: 0.85, flatShading: true });
    const add = (parent, geo, material, x, y, z, sx, sy = sx, sz = sx, rz = 0) => { const m = new THREE.Mesh(GEO[geo], material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    add(group, 'cyl', ctx.mat('#69c15a', { roughness: 1 }), 0, 0.04, 0, 3.4, 0.08, 2.4);
    const SUN = new THREE.Vector3(-2.6, 2.9, -0.8);
    const sun = add(group, 'ball', ctx.lit('#ffcf5c', 1.8), SUN.x, SUN.y, SUN.z, 0.55); sun.castShadow = false;
    const halo = ctx.glow('#ffcf5c', 1.7, 0.7); halo.position.copy(SUN); group.add(halo);
    const rays = new THREE.Group(); rays.position.copy(SUN); group.add(rays);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, ray = add(rays, 'cone', ctx.lit('#ffe08a', 1.4), Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0, 0.09, 0.3, 0.09, a - R); ray.castShadow = false; }
    const sunTag = ctx.sprite('Sun', { size: 0.34 }); sunTag.position.set(SUN.x, SUN.y + 0.95, SUN.z); group.add(sunTag);
    const X0 = -1.45, X1 = 2.75, stoneMat = flat('#9aa4b8'), stoneLit = ctx.lit('#ffe08a', 0.9), stoneBad = ctx.lit('#ff9d5c', 0.8);
    const stones = Array.from({ length: n }, (_, i) => {
      const x = X0 + (X1 - X0) * i / (n - 1), top = 0.35 + i * 0.3;
      const mesh = add(group, 'cyl', stoneMat, x, top / 2, -0.8, 0.62, top, 0.62);
      const num = ctx.sprite(String(i + 1), { size: 0.3 }); num.position.set(x, top * 0.5, -0.1); group.add(num);
      return { mesh, top: new THREE.Vector3(x, top, -0.8) };
    });
    // glowing arrows: "gives energy to"
    const path = [SUN.clone(), ...stones.map((s) => s.top.clone().add(new THREE.Vector3(0, 0.55, 0.15)))];
    const arrows = stones.map((s, i) => { const a = path[i], b = path[i + 1], mid = a.clone().lerp(b, i ? 0.5 : 0.55), m = add(group, 'cone', ctx.lit('#fff3bf', 1.1), mid.x, mid.y + (i ? 0.75 : 0), mid.z, 0.11, 0.3, 0.11, Math.atan2(b.y - a.y, b.x - a.x) - R); m.castShadow = false; return m; });
    const sparks = Array.from({ length: 9 }, () => { const m = add(group, 'ball', ctx.lit('#ffd76a', 2), 0, 0, 0, 0.08); m.castShadow = false; m.visible = false; return m; });

    // ----- the living things, each waiting on its own little log at the front -----
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const cards = names.map((name, i) => {
      const home = new THREE.Vector3((i - (names.length - 1) / 2) * 1.3, 0.2, 1.55);
      add(group, 'cyl', flat('#b98045'), home.x, 0.1, home.z, 0.5, 0.2, 0.5);
      const g = new THREE.Group(), body = new THREE.Group(); g.position.copy(home); g.add(body); group.add(g);
      body.rotation.y = PLANTS.includes(name) ? 0.4 : Math.PI + 0.6;                 // animals look back along the chain, towards their food
      for (const [geo, color, x, y, z, sx, sy, sz, rz] of SHAPES[name]) add(body, geo, flat(color), x, y, z, sx, sy, sz, rz);
      const tag = ctx.sprite(name, { size: 0.26 }); tag.position.set(0, 1.12, 0); g.add(tag);
      const hit = new THREE.Mesh(GEO.box, hitMat); hit.position.y = 0.5; hit.scale.set(0.9, 1.0, 0.9); g.add(hit);
      const card = { name, g, body, home, slot: -1, from: home.clone(), to: home.clone(), t: 1, joy: 0, shake: 0 };
      tap(hit, () => toggle(card));
      return card;
    });

    // ----- state, controls and readouts -----
    let slots = Array(n).fill(null), guess = '', tries = 0, done = false, flow = null, said = false;
    const rFill = ui.readout('Stones filled'), rPath = ui.readout('Energy path'), rTry = ui.readout('Checks');
    const show = () => {
      rFill.set(`${slots.filter(Boolean).length} of ${n} stones`);
      rPath.set(['Sun', ...slots.map((c) => (c ? c.name : '?'))].join(' → '));
      rTry.set(`${tries}`);
    };
    const send = (card, to) => { card.from.copy(card.g.position); card.to.copy(to); card.t = ctx.calm ? 1 : 0; if (ctx.calm) card.g.position.copy(to); };
    const calmDown = () => { flow = null; for (const s of sparks) s.visible = false; for (const s of stones) s.mesh.material = stoneMat; };
    function toggle(card) {
      if (flow && !flow.over) return;
      calmDown();
      if (card.slot >= 0) { slots[card.slot] = null; card.slot = -1; send(card, card.home); }
      else {
        const i = slots.indexOf(null);
        if (i < 0) { ctx.say('Every stone is taken. Tap something on a stone to send it back first.'); return; }
        slots[i] = card; card.slot = i; send(card, stones[i].top);
      }
      show();
    }
    const clear = () => { if (flow && !flow.over) return; calmDown(); for (const c of cards) if (c.slot >= 0) { c.slot = -1; send(c, c.home); } slots = Array(n).fill(null); show(); };
    function check() {
      if (flow && !flow.over) return;
      if (slots.includes(null)) { ctx.say('Fill every stone first.'); return; }
      tries++; calmDown();
      const res = model.judge(chain, slots.map((c) => c.name));
      flow = { right: res.right, upto: res.right ? n : res.bad + 1, bad: res.bad, t: 0, over: false, lit: 0 };
      said = false; show();
    }
    ui.note('Who makes its own food from sunlight? Make your guess:');
    ui.choice([['', 'Not sure yet'], ...names.map((v) => [v, v])], '', (v) => { guess = v; });
    ui.note('Tap a living thing, or use its button, to hop it onto the next free stone. The arrows mean "gives energy to". Tap it again to send it back.');
    for (const c of cards) ui.button(`Move the ${c.name}`, () => toggle(c), 'btn ghost sm');
    ui.button('Send the energy', check, 'btn');
    ui.button('Clear the stones', clear, 'btn ghost sm');
    show();
    ctx.say('Every food chain starts with the Sun and a plant. Who comes next?');

    const verdict = () => {
      said = true;
      if (flow.right) {
        const g = guess === chain[0];
        ctx.say(`Yes! The ${chain[0]} is the producer: it makes food from sunlight. Each animal gets its energy from the one before it, so the energy travels all the way to the ${chain[n - 1]}.${guess && !g ? ` Your first guess was the ${guess}, but only the ${chain[0]} can make its own food.` : ''}`);
        if (!done) { done = true; ctx.complete(model.score(g, tries), chain.join(' → ')); }
      } else {
        const who = slots[flow.bad].name; stones[flow.bad].mesh.material = stoneBad; slots[flow.bad].shake = 1;
        if (flow.bad === 0) ctx.say(`The energy stopped at stone 1. The ${who} cannot make food from sunlight. The chain starts with something that makes its own food from light.`);
        else if (!chain.includes(who)) ctx.say(`The energy stopped at stone ${flow.bad + 1}. The ${who} does not eat the ${slots[flow.bad - 1].name} in this chain, so it does not belong here. Who eats the ${slots[flow.bad - 1].name}?`);
        else ctx.say(`The energy stopped at stone ${flow.bad + 1}. The ${who} does not eat the ${slots[flow.bad - 1].name}. Look again: who eats what comes before it?`);
      }
    };

    const V = new THREE.Vector3();
    const along = (s) => { const i = Math.min(n - 1, Math.max(0, Math.floor(s))), f = s - i; V.copy(path[i]).lerp(path[i + 1], f); V.y += Math.sin(Math.PI * f) * 0.45; return V; };
    return {
      step(dt) {
        if (!flow) return;
        flow.t += dt * (ctx.calm ? 3 : 1.3);
        const head = flow.t;
        // each stone lights up, and its creature gives a happy hop, as the first spark arrives
        while (flow.lit < flow.upto && head >= flow.lit + 1) { const i = flow.lit++; if (flow.right || i < flow.bad) { stones[i].mesh.material = stoneLit; slots[i].joy = 1; } }
        if (!said && head >= flow.upto) verdict();
        if (head >= flow.upto + 2.4 && !flow.right) { flow.over = true; for (const s of sparks) s.visible = false; }
        if (flow.right && head >= flow.upto) flow.over = true;
        sparks.forEach((m, j) => {
          let s = head - j * 0.28;
          if (flow.right && s > n) s %= n;                               // a finished chain keeps glowing
          m.visible = s >= 0 && s <= flow.upto && (flow.right || head < flow.upto + 2.4);
          if (m.visible) { m.position.copy(along(Math.min(s, flow.upto - 1e-4))); if (!flow.right && s > flow.upto - 0.02) m.position.y -= Math.min(0.5, (head - j * 0.28 - flow.upto) * 0.6); }
        });
      },
      frame(dt, time = 0) {
        rays.rotation.z += dt * (ctx.calm ? 0 : 0.5);
        arrows.forEach((a, i) => { a.scale.x = a.scale.z = 0.11 * (1 + (ctx.calm ? 0 : 0.18 * Math.sin(time * 3 - i))); });
        for (const c of cards) {
          if (c.t < 1) { c.t = Math.min(1, c.t + dt * 2.2); const e = c.t * c.t * (3 - 2 * c.t); c.g.position.copy(c.from).lerp(c.to, e); c.g.position.y += Math.sin(Math.PI * c.t) * 0.9; }
          c.joy = Math.max(0, c.joy - dt * 1.4); c.shake = Math.max(0, c.shake - dt * 0.9);
          c.body.position.y = ctx.calm ? 0 : Math.abs(Math.sin(c.joy * Math.PI * 2)) * 0.25 * c.joy;
          c.body.rotation.z = ctx.calm ? 0 : Math.sin(time * 16) * 0.12 * c.shake;
          c.body.scale.setScalar(1 + c.joy * 0.12);
        }
      },
      // Shows a successful run without the player (used by tests): the same moves a player would make.
      autoplay() {
        clear(); guess = chain[0];
        for (const name of chain) toggle(cards.find((c) => c.name === name));
        check();
      },
      dispose() { for (const k of Object.keys(GEO)) GEO[k].dispose(); hitMat.dispose(); },
    };
  },
};
