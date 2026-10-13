// World 8 lab — Archaeology Dig in 3D: a block of earth in four layers, dug away tile by tile.
// No imports: everything arrives through the context, so the lab also runs in tools/test-game3d.mjs.

const COLS = 5, ROWS = 4;
// Finds by layer (index 0 = top = youngest). A fictional site, used for general reasoning about layers.
const FINDS = [
  [['nail', 'iron nail'], ['lid', 'tin can lid'], ['coin', 'coin']],
  [['glazed', 'glazed pot piece'], ['coin', 'coin'], ['cloth', 'woven cloth scrap']],
  [['needle', 'bronze needle'], ['pot', 'plain clay pot piece'], ['bone', 'animal bone']],
  [['scraper', 'stone scraper'], ['charcoal', 'charcoal from a hearth'], ['bead', 'shell bead']],
];
const LAYER_COLORS = ['#d8b98a', '#c19a63', '#a67c4a', '#8a6038'];

export const model = {
  COLS, ROWS, FINDS,
  // A tile can be dug only when everything above it has been removed.
  canDig: (cells, r, k) => r >= 0 && r < ROWS && !cells[r][k].dug && (r === 0 || cells[r - 1][k].dug),
  nextRow: (cells, k) => { for (let r = 0; r < ROWS; r++) if (!cells[r][k].dug) return r; return -1; },
  // Law of superposition for undisturbed ground: the deeper layer was laid down earlier.
  older: (layerA, layerB) => (layerA === layerB ? 'same' : layerA > layerB ? 'A' : 'B'),
  // The site: about 7 tiles in 10 hold a find; the three finds the questions talk about are always there.
  site(rng) {
    const cells = [];
    for (let r = 0; r < ROWS; r++) { cells.push([]); for (let c = 0; c < COLS; c++) cells[r].push({ dug: false, find: rng() < 0.7 ? FINDS[r][Math.floor(rng() * 3) % 3] : null }); }
    cells[0][Math.floor(rng() * COLS) % COLS].find = FINDS[0][0];
    cells[1][Math.floor(rng() * COLS) % COLS].find = FINDS[1][1];
    cells[3][Math.floor(rng() * COLS) % COLS].find = FINDS[3][0];
    return { cells, coinYear: 1400 + (Math.floor(rng() * 8) % 8) * 50 };
  },
  questions(coinYear, level) {
    const qs = [
      { q: 'The stone scraper was in layer 4 and the iron nail in layer 1. Which is probably older?', o: ['Stone scraper', 'Iron nail'], a: 0, show: ['scraper', 'nail'],
        why: 'Deeper layers were laid down earlier (the law of superposition), as long as the ground is undisturbed.' },
      { q: `A coin stamped ${coinYear} CE was found in layer 2. What does that show about layer 2?`, o: [`It formed before ${coinYear}`, `It formed in or after ${coinYear}`, `It is exactly ${coinYear} years old`], a: 1, show: [null, 'coin', null],
        why: 'A coin cannot be buried before it is made, so the layer is no older than the coin. It may be much younger.' },
      { q: 'A diary written by someone who lived at the site and a story written 500 years later disagree. Which is usually stronger evidence?', o: ['The later story', 'The diary, being a primary source'], a: 1, show: ['scroll', 'book'],
        why: 'Primary sources come from the time. Later accounts can be useful but should be checked against other evidence.' },
    ];
    if (level >= 4) qs.push({ q: 'A burrowing animal dug a tunnel, and a tin can lid slid down from layer 1 into layer 3. Does that make the lid as old as layer 3?', o: ['Yes, it was found there', 'No, the ground was disturbed'], a: 1, show: ['lid', 'bone'],
      why: 'Layers only show the order of time when nothing has mixed them. That is why archaeologists record every find and use other evidence too.' });
    return qs;
  },
};

export function selfTest() {
  let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const { cells, coinYear } = model.site(rng);
  const a = model.canDig(cells, 0, 2), b = model.canDig(cells, 1, 2);
  cells[0][2].dug = true;
  const c = model.canDig(cells, 1, 2), d = model.canDig(cells, 0, 2), e = model.nextRow(cells, 2);
  const kept = cells[0].some((x) => x.find && x.find[0] === 'nail') && cells[1].some((x) => x.find && x.find[0] === 'coin') && cells[3].some((x) => x.find && x.find[0] === 'scraper');
  const q3 = model.questions(coinYear, 3), q4 = model.questions(coinYear, 4);
  const ok = a && !b && c && !d && e === 1 && kept && model.older(4, 1) === 'A' && model.older(1, 3) === 'B' && coinYear >= 1400 && coinYear <= 1750 && coinYear % 50 === 0
    && q3.length === 3 && q4.length === 4 && q3[0].a === 0 && q3[1].a === 1 && q3[2].a === 1;
  return { ok, detail: `top tile diggable ${a}, tile under it ${b} then ${c}; layer 4 against layer 1 → ${model.older(4, 1)} is older; coin ${coinYear} CE; ${q3.length} and ${q4.length} questions` };
}

export default {
  id: 'w08-archaeology-dig',
  world: 8,
  levels: [3, 4],
  title: 'Archaeology Dig',
  goal: 'Dig down through the layers of earth, record what you find, then reason about which things are older and what the evidence really tells us.',
  kind: 'simplified',
  model: 'A fictional site with four neat, flat layers: the deepest was laid down first, so in undisturbed ground deeper finds are older. Real layers can be tilted, mixed by digging animals or builders, or upside down, so archaeologists combine many kinds of evidence (such as radiocarbon dating) with careful written records.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, L = Math.max(1, Math.min(6, Math.round(ctx.level) || 3)), rnd = ctx.rng || Math.random, T = ctx.t || ((x) => x);
    const M = (geo, material, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
    const CW = 0.8, CH = 0.62, CD = 1.0, TOP = 3.0, ZC = -0.5, BASE = TOP - ROWS * CH, NEED = 8;
    const cx = (k) => (k - (COLS - 1) / 2) * CW, cy = (r) => TOP - CH * (r + 0.5);
    const { cells, coinYear } = model.site(rnd), qs = model.questions(coinYear, L);

    // materials
    const iron = ctx.mat('#6f7780', { metalness: 0.7, roughness: 0.4 }), tin = ctx.mat('#c9d0d6', { metalness: 0.8, roughness: 0.3 }), goldM = ctx.mat('#e8b93c', { metalness: 0.8, roughness: 0.3 });
    const glaze = ctx.mat('#2f9c93', { roughness: 0.25 }), clay = ctx.mat('#c96f43', { roughness: 0.9 }), cloth = ctx.mat('#c0445a', { roughness: 1 }), bronze = ctx.mat('#b07a3a', { metalness: 0.6, roughness: 0.4 });
    const boneM = ctx.mat('#f3ead6', { roughness: 0.6 }), stone = ctx.mat('#8d8f96', { roughness: 0.9, flatShading: true }), coal = ctx.mat('#2a2522', { roughness: 1, flatShading: true }), shell = ctx.mat('#fff4e2', { roughness: 0.4 });
    const paper = ctx.mat('#f1e3bd', { roughness: 0.9 }), leather = ctx.mat('#7a4a2c', { roughness: 0.8 }), dark = ctx.mat('#4a3426', { roughness: 1 }), wood = ctx.mat('#b98045', { roughness: 0.8 });
    const gold = ctx.lit('#ffd76a', 1.4), green = ctx.lit('#59d98a', 1.3), red = ctx.lit('#ff8a6a', 1.1), plain = ctx.mat('#e9dcc0', { roughness: 0.8 });

    // the finds as small solid objects
    const shapes = {
      nail: (g) => { const n = M(new THREE.CylinderGeometry(0.03, 0.012, 0.4, 8), iron, 0, 0, 0, g); n.rotation.z = 1.1; M(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10), iron, 0, 0.2, 0, n); },
      lid: (g) => { const d = M(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18), tin, 0, 0, 0, g); d.rotation.x = 1.1; M(new THREE.TorusGeometry(0.2, 0.02, 6, 18), tin, 0, 0, 0, d).rotation.x = Math.PI / 2; },
      coin: (g) => { const d = M(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 18), goldM, 0, 0, 0, g); d.rotation.x = Math.PI / 2; M(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14), goldM, 0, 0, 0, d); },
      glazed: (g) => { M(new THREE.SphereGeometry(0.24, 12, 8, 0, 1.9, 0.5, 1.3), glaze, 0, -0.03, -0.1, g).material.side = THREE.DoubleSide; },
      pot: (g) => { M(new THREE.SphereGeometry(0.24, 12, 8, 0, 1.9, 0.5, 1.3), clay, 0, -0.03, -0.1, g).material.side = THREE.DoubleSide; },
      cloth: (g) => { const c = M(new THREE.BoxGeometry(0.36, 0.03, 0.26), cloth, 0, 0, 0, g); c.rotation.set(0.7, 0.3, 0.2); M(new THREE.BoxGeometry(0.36, 0.035, 0.05), plain, 0, 0, 0, c); },
      needle: (g) => { const n = M(new THREE.CylinderGeometry(0.022, 0.006, 0.44, 8), bronze, 0, 0, 0, g); n.rotation.z = -1.0; M(new THREE.TorusGeometry(0.035, 0.012, 6, 10), bronze, 0, 0.24, 0, n); },
      bone: (g) => { const b = M(new THREE.CapsuleGeometry(0.045, 0.3, 4, 8), boneM, 0, 0, 0, g); b.rotation.z = 1.1; M(new THREE.SphereGeometry(0.07, 8, 6), boneM, 0, 0.19, 0, b); M(new THREE.SphereGeometry(0.07, 8, 6), boneM, 0, -0.19, 0, b); },
      scraper: (g) => { M(new THREE.DodecahedronGeometry(0.2, 0), stone, 0, 0, 0, g).scale.set(1.2, 0.8, 0.35); },
      charcoal: (g) => { M(new THREE.DodecahedronGeometry(0.15, 0), coal, -0.08, 0, 0, g); M(new THREE.DodecahedronGeometry(0.1, 0), coal, 0.13, -0.04, 0.05, g); },
      bead: (g) => { M(new THREE.TorusGeometry(0.11, 0.055, 8, 16), shell, 0, 0, 0, g); },
      scroll: (g) => { const s = M(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 12), paper, 0, 0, 0, g); s.rotation.z = Math.PI / 2; M(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), cloth, 0, 0, 0, s); },
      book: (g) => { M(new THREE.BoxGeometry(0.34, 0.09, 0.26), leather, 0, 0, 0, g); M(new THREE.BoxGeometry(0.31, 0.06, 0.27), paper, 0.02, 0, 0, g); },
    };
    const make = (key, parent, scale = 1) => { const g = new THREE.Group(); g.scale.setScalar(scale); parent.add(g); shapes[key](g); return g; };

    // the block of earth: a plinth, a back wall, and twenty tiles in four coloured layers
    M(new THREE.BoxGeometry(COLS * CW + 0.5, BASE, CD + 0.5), dark, 0, BASE / 2, ZC);
    M(new THREE.BoxGeometry(COLS * CW + 0.5, ROWS * CH + 0.1, 0.16), dark, 0, BASE + (ROWS * CH + 0.1) / 2, ZC - CD / 2 - 0.08);
    for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.12, ROWS * CH + 0.3, 0.12), wood, sx * (COLS * CW / 2 + 0.16), BASE + (ROWS * CH + 0.3) / 2, ZC + CD / 2);
    const tileGeo = new THREE.BoxGeometry(CW - 0.03, CH - 0.02, CD);
    const layerMat = LAYER_COLORS.map((c) => ctx.mat(c, { roughness: 1, flatShading: true }));
    cells.forEach((row, r) => row.forEach((c, k) => {
      c.mesh = M(tileGeo, layerMat[r], cx(k), cy(r), ZC); c.anim = -1; c.pop = -1;
      if (c.find) {
        c.fm = make(c.find[0], group, 1.15); c.fm.position.set(cx(k), cy(r), ZC + 0.1); c.fm.visible = false;
        if (r === 1 && c.find[0] === 'coin') { const s = ctx.sprite(String(coinYear), { size: 0.2, bg: 'rgba(14,18,48,.78)' }); s.position.set(0, 0.24, 0.1); c.fm.add(s); }
      }
      ctx.onTap(c.mesh, () => { colC.set(k); dig(r, k); });
    }));
    const head = ctx.sprite('Layer', { size: 0.26 }); head.position.set(-COLS * CW / 2 - 0.85, TOP + 0.3, ZC + CD / 2); group.add(head);
    ['1 newest', '2', '3', '4 oldest'].forEach((txt, r) => { const s = ctx.sprite(txt, { size: 0.28, bg: 'rgba(14,18,48,.78)' }); s.position.set(-COLS * CW / 2 - 0.85, cy(r), ZC + CD / 2); group.add(s); });

    // the brush that hovers over the chosen column, and crumbs of soil that fly out
    const brush = new THREE.Group(); group.add(brush);
    M(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 10), wood, 0, 0.45, 0, brush); M(new THREE.BoxGeometry(0.26, 0.2, 0.08), gold, 0, 0.1, 0, brush);
    const crumbGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const crumbs = Array.from({ length: 6 }, () => { const m = M(crumbGeo, layerMat[1]); m.visible = false; return { m, vx: 0, vy: 0, vz: 0, life: 0 }; });

    // answer stands for the questions: tap a stand, or use the answer buttons
    const stands = [0, 1, 2].map((i) => {
      const g = new THREE.Group(); g.position.set(0, 0, 1.75); g.visible = false; group.add(g);
      const post = M(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 16), wood, 0, 0.25, 0, g), cap = M(new THREE.CylinderGeometry(0.38, 0.38, 0.07, 16), plain, 0, 0.53, 0, g);
      const tag = ctx.sprite('ABC'[i], { size: 0.36, bg: 'rgba(14,18,48,.78)' }); tag.position.set(0, 0.27, 0.42); g.add(tag);
      const show = new THREE.Group(); show.position.y = 0.9; g.add(show);
      ctx.onTap(post, () => answer(i)); ctx.onTap(cap, () => answer(i));
      return { g, cap, show };
    });

    let col = 0, dugCount = 0, deepest = 0, phase = 'dig', qi = 0, right = 0, done = false, brushT = 0, flash = 0;
    const log = [], queue = []; let wait = 0;
    const colC = ui.choice([0, 1, 2, 3, 4].map((k) => [k, `Column ${k + 1}`]), 0, (v) => { col = v; });
    ui.button('🖌️ Dig down here', () => digColumn(col), 'btn');
    const rDug = ui.readout('Tiles dug'), rDeep = ui.readout('Deepest layer reached'), rFinds = ui.readout('Finds in the notebook'), rLast = ui.readout('Latest find'), rQ = ui.readout('Question');
    ui.button('Answer A', () => answer(0)); ui.button('Answer B', () => answer(1)); ui.button('Answer C', () => answer(2));
    ui.note('Tap a tile of earth, or choose a column and dig down. The top layer was laid down last, so it is the youngest. Deeper means older, as long as nothing has mixed the ground.');
    const show = () => { rDug.set(`${dugCount} / ${NEED}`); rDeep.set(deepest ? `${deepest} / ${ROWS}` : '–'); rFinds.set(String(log.length)); rQ.set(phase === 'dig' ? '–' : `${Math.min(qi + 1, qs.length)} / ${qs.length}`); };

    function burst(r, k) {
      crumbs.forEach((c, i) => { c.m.material = layerMat[r]; c.m.visible = true; c.m.position.set(cx(k) + (i - 2.5) * 0.1, cy(r), ZC + CD / 2); c.vx = (i - 2.5) * 0.5; c.vy = 1.6 + (i % 3) * 0.5; c.vz = 1 + (i % 2) * 0.7; c.life = 0.9; });
    }
    function dig(r, k) {
      if (phase !== 'dig') { ctx.say('The digging is finished. Use your finds to answer the questions.'); return false; }
      const c = cells[r] && cells[r][k]; if (!c || c.dug) return false;
      if (!model.canDig(cells, r, k)) { ctx.say('Dig the layer above first: it lies on top, so it is younger.'); return false; }
      c.dug = true; c.anim = 0; dugCount++; deepest = Math.max(deepest, r + 1); col = k; brushT = 0.5; burst(r, k);
      if (c.find) {
        c.fm.visible = true; c.fm.scale.setScalar(0.01); c.pop = 0; log.push([c.find[1], r + 1]); rLast.set(`${T(c.find[1])} (${T('layer')} ${r + 1})`);
        ctx.say(`Found: ${c.find[1]}, in layer ${r + 1}. Things lying in the same layer were buried at about the same time.`);
      } else ctx.say(`Only soil here in layer ${r + 1}. Finding nothing is a result too, so it goes in the notebook.`);
      if (dugCount >= NEED && (L < 4 || deepest === ROWS)) startQuiz();
      else if (dugCount >= NEED) ctx.say('Good work. Now dig one column all the way down to layer 4, the oldest layer, before you answer the questions.');
      show(); return true;
    }
    function digColumn(k) {
      const r = model.nextRow(cells, k);
      if (r < 0) { ctx.say('This column is already dug down to the bottom. Choose another column.'); return false; }
      return dig(r, k);
    }
    function ask(prefix) {
      const q = qs[qi], n = q.o.length;
      stands.forEach((s, i) => {
        s.g.visible = i < n; s.g.position.x = (i - (n - 1) / 2) * (n === 2 ? 2.2 : 1.8); s.cap.material = plain;
        while (s.show.children.length) s.show.remove(s.show.children[0]);
        if (i < n && q.show[i]) make(q.show[i], s.show, 1.7);
      });
      ctx.say(`${prefix}Question ${qi + 1} of ${qs.length}: ${q.q} ${q.o.map((o, i) => `${'ABC'[i]}: ${o}.`).join(' ')}`);
      show();
    }
    function startQuiz() { phase = 'quiz'; qi = 0; brush.visible = false; ask('You have dug enough to reason about the site. '); }
    function answer(i) {
      if (phase !== 'quiz') { if (phase === 'dig') ctx.say('Dig first: the questions come once you have dug 8 tiles.'); return; }
      const q = qs[qi]; if (i >= q.o.length) { ctx.say('This question has only two answers: A or B.'); return; }
      const ok = i === q.a; if (ok) right++;
      stands[i].cap.material = ok ? green : red; if (!ok) stands[q.a].cap.material = green; flash = 0.6;
      const said = `${ok ? 'Yes.' : 'Not quite.'} ${q.why} `;
      qi++;
      if (qi >= qs.length) {
        phase = 'done'; show(); stands.forEach((s) => { s.g.visible = false; });
        ctx.say(`${said}You answered ${right} of ${qs.length} correctly. Layers tell us the order of time, and other evidence helps us check it.`);
        if (!done) { done = true; ctx.complete(right / qs.length, 'Used layers and sources to reason about the past.'); }
      } else ask(said);
    }
    show();
    ctx.say(L >= 4 ? 'Dig at least 8 tiles and take one column down to layer 4. You can only dig a tile when the one above it is gone.' : 'Dig at least 8 tiles. You can only dig a tile when the one above it is gone.');

    return {
      step(dt) {
        if (queue.length) { wait -= dt; if (wait <= 0) { queue.shift()(); wait = 0.55; } }
      },
      frame(dt, time = 0) {
        for (const row of cells) for (const c of row) {
          if (c.anim >= 0 && c.anim < 1) {
            c.anim = Math.min(1, c.anim + dt / 0.45); const s = 1 - c.anim;
            c.mesh.scale.set(0.6 + 0.4 * s, Math.max(0.001, s), 0.6 + 0.4 * s); c.mesh.position.y = cy(cells.indexOf(row)) - CH * c.anim / 2;
            if (c.anim >= 1) c.mesh.visible = false;
          }
          if (c.pop >= 0) { c.pop = Math.min(1, c.pop + dt / 0.5); c.fm.scale.setScalar(1.15 * (c.pop < 1 ? c.pop * (1.3 - 0.3 * c.pop) : 1)); c.fm.rotation.y = ctx.calm ? 0.4 : time * 0.9 + c.fm.position.x; }
        }
        for (const c of crumbs) if (c.life > 0) { c.life -= dt; c.vy -= 9.81 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.m.rotation.x += dt * 6; if (c.life <= 0 || c.m.position.y < 0.05) { c.life = 0; c.m.visible = false; } }
        const r = model.nextRow(cells, col), ty = (r < 0 ? BASE : TOP - CH * r) + 0.12;
        brushT = Math.max(0, brushT - dt);
        brush.position.x += (cx(col) - brush.position.x) * Math.min(1, dt * 8); brush.position.y += (ty - brush.position.y) * Math.min(1, dt * 8); brush.position.z = ZC + 0.2;
        brush.rotation.z = brushT > 0 ? Math.sin(time * 30) * 0.5 : Math.sin(time * 2) * 0.08;
        for (const s of stands) if (s.g.visible) s.show.rotation.y = ctx.calm ? 0.5 : time * 0.8;
        flash = Math.max(0, flash - dt);
      },
      // Digs two whole columns the way a player would, then gives the reasoned answer to each question.
      autoplay() {
        for (const k of [1, 3]) for (let r = 0; r < ROWS; r++) queue.push(() => { colC.set(k); digColumn(k); });
        for (const q of qs) queue.push(() => answer(q.a));
      },
      dispose() { queue.length = 0; },
    };
  },
};
