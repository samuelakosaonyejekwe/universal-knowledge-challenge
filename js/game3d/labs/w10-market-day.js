// Market Day in 3D: a fruit stall where each right phrase moves the purchase one step along.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

// The phrasebook is the same one the flat lab uses (js/labs/w10-market-day.js).
const P = {
  en: { v: 'en-GB', g: 'Hello', n: ['one', 'two', 'three', 'four', 'five'], pl: 'Please', th: 'Thank you', hm: 'How much is it?' },
  es: { v: 'es-ES', g: 'Hola', n: ['uno', 'dos', 'tres', 'cuatro', 'cinco'], pl: 'Por favor', th: 'Gracias', hm: '¿Cuánto cuesta?' },
  fr: { v: 'fr-FR', g: 'Bonjour', n: ['un', 'deux', 'trois', 'quatre', 'cinq'], pl: "S'il vous plaît", th: 'Merci', hm: "C'est combien ?" },
  ar: { v: 'ar-SA', g: 'مرحبا', n: ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة'], pl: 'من فضلك', th: 'شكرا', hm: 'بكم هذا؟',
    r: { g: 'marhaban', n: ['wāḥid', 'ithnān', 'thalātha', 'arbaʿa', 'khamsa'], pl: 'min faḍlak', th: 'shukran', hm: 'bikam hādhā?' } },
  ru: { v: 'ru-RU', g: 'Здравствуйте', n: ['один', 'два', 'три', 'четыре', 'пять'], pl: 'Пожалуйста', th: 'Спасибо', hm: 'Сколько стоит?',
    r: { g: 'Zdravstvuyte', n: ['odin', 'dva', 'tri', 'chetyre', 'pyat’'], pl: 'Pozhaluysta', th: 'Spasibo', hm: 'Skol’ko stoit?' } },
  he: { v: 'he-IL', g: 'שלום', n: ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש'], pl: 'בבקשה', th: 'תודה', hm: 'כמה זה עולה?',
    r: { g: 'shalom', n: ['achat', 'shtayim', 'shalosh', 'arba', 'chamesh'], pl: 'bevakasha', th: 'toda', hm: 'kama ze ole?' } },
  it: { v: 'it-IT', g: 'Buongiorno', n: ['uno', 'due', 'tre', 'quattro', 'cinque'], pl: 'Per favore', th: 'Grazie', hm: 'Quanto costa?' },
  el: { v: 'el-GR', g: 'Γεια σας', n: ['ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε'], pl: 'Παρακαλώ', th: 'Ευχαριστώ', hm: 'Πόσο κάνει;',
    r: { g: 'Ya sas', n: ['éna', 'dío', 'tría', 'tésera', 'pénte'], pl: 'Parakaló', th: 'Efharistó', hm: 'Póso káni?' } },
  tr: { v: 'tr-TR', g: 'Merhaba', n: ['bir', 'iki', 'üç', 'dört', 'beş'], pl: 'Lütfen', th: 'Teşekkür ederim', hm: 'Bu ne kadar?' },
  pt: { v: 'pt-PT', g: 'Olá', n: ['um', 'dois', 'três', 'quatro', 'cinco'], pl: 'Por favor', th: 'Obrigado / Obrigada', hm: 'Quanto custa?' },
  zh: { v: 'zh-CN', g: '你好', n: ['一', '二', '三', '四', '五'], pl: '请', th: '谢谢', hm: '多少钱？',
    r: { g: 'nǐ hǎo', n: ['yī', 'èr', 'sān', 'sì', 'wǔ'], pl: 'qǐng', th: 'xièxie', hm: 'duōshao qián?' } },
  ja: { v: 'ja-JP', g: 'こんにちは', n: ['一', '二', '三', '四', '五'], pl: 'お願いします', th: 'ありがとう', hm: 'いくらですか？',
    r: { g: 'konnichiwa', n: ['ichi', 'ni', 'san', 'yon', 'go'], pl: 'onegai shimasu', th: 'arigatō', hm: 'ikura desu ka?' } },
};

const FRUIT = [['apples', '#e03131'], ['bananas', '#ffd43b'], ['oranges', '#ff922b'], ['pears', '#94d82d']];
// What to say after a wrong pick: what that phrase means and when it is used.
const WRONG = {
  g: 'That sign means hello. You say it when you arrive, not now.',
  pl: 'That sign means please. You add it when you ask for something.',
  th: 'That sign means thank you. You say it after someone has given you something.',
  hm: 'That sign means how much is it. You say it to ask the price.',
};
const TOTAL = 5;

export default {
  id: 'w10-market-day',
  world: 10,
  levels: [5, 6],
  title: 'Market Day',
  goal: 'Buy fruit at the market stall by choosing the right phrase at each of the five steps.',
  kind: 'simplified',
  model: 'A short shopping role-play in five steps: greet, ask the price, understand a number, say please, say thank you. Only a few polite, common phrases (hello, numbers 1 to 5, please, thank you, how much) in a standard form; real speech has many more ways to say them, formal and informal. The price is simply one coin for each piece of fruit, and the phrases are shown as writing only: this stall does not speak them aloud.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x);
    const L = P[ctx.lang] ? ctx.lang : 'es', D = P[L], R = D.r || null;
    const hard = ctx.level >= 6;
    const fruit = FRUIT[Math.min(3, Math.floor(ctx.rng() * 4))];
    const qty = Math.min(5, (hard ? 4 : 2) + Math.floor(ctx.rng() * 2));          // level 5: two or three pieces; level 6: four or five
    const word = (key, i) => (key === 'n' ? D.n[i] : D[key]);
    const roman = (key, i) => (R ? (key === 'n' ? R.n[i] : R[key]) : '');

    // ----- the stall -----
    const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const wood = ctx.mat('#a8643c', { roughness: 0.8 }), cream = ctx.mat('#fff7ef', { roughness: 0.6 }), rose = ctx.mat('#c2255c', { roughness: 0.6 }), violet = ctx.mat('#845ef7', { roughness: 0.5 });
    const dark = ctx.mat('#2b1b4d', { roughness: 0.5 }), gold = ctx.mat('#e8b84a', { metalness: 0.6, roughness: 0.3 }), steel = ctx.mat('#cfd6ee', { metalness: 0.5, roughness: 0.3 });
    add(new THREE.BoxGeometry(4.6, 1.0, 1.1), wood, 0.3, 0.5, -0.4);
    add(new THREE.BoxGeometry(4.9, 0.1, 1.3), cream, 0.3, 1.05, -0.4);
    const TOP = 1.1;                                                              // height of the counter top
    for (const [x, z] of [[-2.25, -1.2], [2.85, -1.2], [-2.25, 0.4], [2.85, 0.4]]) add(new THREE.CylinderGeometry(0.07, 0.07, 3.9, 8), wood, x, 1.95, z);
    for (let i = 0; i < 6; i++) { const s = add(new THREE.BoxGeometry(0.88, 0.08, 2.1), i % 2 ? cream : rose, -1.9 + i * 0.88, 3.95, -0.4); s.rotation.x = 0.22; }

    // the stallholder, behind the counter
    const seller = new THREE.Group(); seller.position.set(-1.75, 0, -1.25); group.add(seller);
    add(new THREE.CylinderGeometry(0.3, 0.46, 1.5, 16), violet, 0, 0.75, 0, seller);
    add(new THREE.BoxGeometry(0.5, 0.75, 0.1), cream, 0, 0.95, 0.36, seller);
    const head = add(new THREE.SphereGeometry(0.32, 18, 14), ctx.mat('#e8b48a', { roughness: 0.7 }), 0, 1.92, 0, seller);
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 18), gold, 0, 0.27, 0, head); add(new THREE.CylinderGeometry(0.24, 0.3, 0.22, 16), gold, 0, 0.38, 0, head);
    add(new THREE.SphereGeometry(0.045, 8, 6), dark, -0.12, 0.06, 0.29, head); add(new THREE.SphereGeometry(0.045, 8, 6), dark, 0.12, 0.06, 0.29, head);
    const smile = add(new THREE.TorusGeometry(0.11, 0.022, 6, 12, Math.PI), rose, 0, -0.07, 0.29, head); smile.rotation.z = Math.PI;
    const arms = [-1, 1].map((sd) => { const a = new THREE.Group(); a.position.set(sd * 0.4, 1.42, 0); seller.add(a); add(new THREE.CylinderGeometry(0.075, 0.075, 0.7, 8), violet, 0, -0.35, 0, a); add(new THREE.SphereGeometry(0.1, 10, 8), head.material, 0, -0.74, 0, a); a.rotation.z = sd * 0.25; return a; });

    // the fruit crate, the scale, the basket, the price tag and the coins
    const crate = add(new THREE.BoxGeometry(1.5, 0.3, 0.95), ctx.mat('#7a4a2a', { roughness: 0.9 }), 2.0, TOP + 0.15, -0.45);
    const fruitMat = ctx.mat(fruit[1], { roughness: 0.45 });
    const fruitGeo = fruit[0] === 'bananas' ? new THREE.TorusGeometry(0.15, 0.06, 8, 12, Math.PI * 0.95) : new THREE.SphereGeometry(0.17, 14, 10);
    const crateSlot = (i) => [1.46 + (i % 4) * 0.36, TOP + 0.47, -0.65 + Math.floor(i / 4) * 0.4];
    const panSlot = (i) => (i === 0 ? [0.55, TOP + 0.62, -0.5] : [0.55 + Math.cos(i * 1.57 + 0.8) * 0.27, TOP + 0.62, -0.5 + Math.sin(i * 1.57 + 0.8) * 0.27]);
    const bagSlot = (i) => (i === 0 ? [-0.75, TOP + 0.5, -0.3] : [-0.75 + Math.cos(i * 1.57 + 0.8) * 0.24, TOP + 0.5, -0.3 + Math.sin(i * 1.57 + 0.8) * 0.24]);
    const fruits = []; for (let i = 0; i < 8; i++) { const [x, y, z] = crateSlot(i); const f = add(fruitGeo, fruitMat, x, y, z); if (fruit[0] === 'pears') f.scale.set(0.85, 1.25, 0.85); fruits.push(f); }
    add(new THREE.CylinderGeometry(0.3, 0.36, 0.14, 16), steel, 0.55, TOP + 0.07, -0.5); add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), steel, 0.55, TOP + 0.27, -0.5);
    const pan = add(new THREE.CylinderGeometry(0.5, 0.42, 0.07, 20), steel, 0.55, TOP + 0.42, -0.5);
    const bag = new THREE.Group(); bag.position.set(-0.75, TOP, -0.3); group.add(bag);
    add(new THREE.CylinderGeometry(0.45, 0.34, 0.36, 18), ctx.mat('#d9a05b', { roughness: 0.9 }), 0, 0.18, 0, bag);
    add(new THREE.TorusGeometry(0.4, 0.035, 6, 16, Math.PI), wood, 0, 0.36, 0, bag);
    const tag = new THREE.Group(); tag.position.set(1.45, TOP, 0.05); tag.scale.setScalar(0.001); group.add(tag);
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), wood, 0, 0.15, 0, tag); add(new THREE.BoxGeometry(0.62, 0.44, 0.05), ctx.mat('#ffd43b', { roughness: 0.5 }), 0, 0.5, 0, tag);
    const coins = []; for (let i = 0; i < 5; i++) { const c = add(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 14), gold, -0.25 + i * 0.26, TOP + 0.02, 0.1); c.visible = false; coins.push(c); }

    // text that changes: one sprite per holder, replaced whenever its words change
    const made = [];
    const holder = (parent, x, y, z, maxW) => { const hd = { parent, p: new THREE.Vector3(x, y, z), maxW, s: null }; made.push(hd); return hd; };
    const clear = (hd) => { if (hd.s) { hd.parent.remove(hd.s); hd.s.material.map?.dispose?.(); hd.s.material.dispose?.(); hd.s = null; } };
    const write = (hd, text, opts) => { clear(hd); if (!text) return; const s = ctx.sprite(text, opts); if (s.scale.x > hd.maxW) s.scale.multiplyScalar(hd.maxW / s.scale.x); s.position.copy(hd.p); hd.parent.add(s); hd.s = s; };
    const bubble = holder(group, -1.75, 3.0, -1.0, 2.6), tagText = holder(tag, 0, 0.5, 0.06, 0.55);

    // three answer signs standing in front of the stall
    const signBase = ctx.mat('#5b3f8c', { roughness: 0.5 }), signPick = ctx.lit('#ffd43b', 0.5), signOk = ctx.lit('#38d9a9', 0.7), signNo = ctx.mat('#b98a9c', { roughness: 0.8 });
    const signs = [0, 1, 2].map((i) => {
      const g = new THREE.Group(); g.position.set(-2.35 + i * 2.35, 0.62, 1.95); g.rotation.x = -0.32; group.add(g);
      const board = add(new THREE.BoxGeometry(2.15, 1.0, 0.14), signBase, 0, 0, 0, g);
      const letter = ctx.sprite('ABC'[i], { size: 0.26 }); letter.position.set(-0.9, 0.36, 0.12); g.add(letter);
      const s = { g, board, text: holder(g, 0.06, -0.02, 0.14, 1.7), shake: 0, hop: 0 };
      ctx.onTap(board, () => { choose(i); speak(); });
      return s;
    });

    // ----- the role-play -----
    const steps = [
      { q: 'You reach the stall. How do you greet the seller?', keys: ['g', 'th', 'pl'], right: 'g', why: 'Yes! A greeting comes first: it is friendly to say hello before you ask for anything.' },
      { q: `You want ${qty} ${fruit[0]}. How do you ask the price?`, keys: ['hm', 'g', 'th'], right: 'hm', why: 'Yes! That asks the price, so the seller weighs your fruit and tells you a number. Look at the speech bubble.' },
      { q: 'The seller says the price as a number word. Which number is that? Counting the fruit on the scale will help.', num: true, why: `Yes! That word is the number ${qty}, so you count out ${qty} coins.` },
      { q: 'You are ready to ask for your fruit politely. Which word do you add?', keys: ['pl', 'hm', 'g'], right: 'pl', why: 'Yes! Please turns an order into a polite request, so the seller packs your basket.' },
      { q: 'The seller hands you the basket. What do you say?', keys: ['th', 'hm', 'pl'], right: 'th', why: 'Yes! Thank you ends the visit kindly. Using polite words like please and thank you makes shopping friendlier in any language.' },
    ];
    let si = 0, correct = 0, tried = false, pick = null, opts = [], busy = 0, after = null, finished = false, auto = false, autoWait = 0, wave = 0, inBag = 0;
    const tweens = [];
    const move = (o, to, d, delay = 0, arc = 0) => tweens.push({ o, a: null, b: to, t: -delay, d, arc });
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(ctx.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    const rStep = ui.readout('Step'), rSeller = ui.readout('The seller says');
    const rSign = ['Sign A', 'Sign B', 'Sign C'].map((n) => ui.readout(n));
    const rFirst = ui.readout('Right first time'), rPrice = ui.readout('Price'), rBag = ui.readout('Fruit in your basket');
    const pickC = ui.choice([[0, 'Sign A'], [1, 'Sign B'], [2, 'Sign C']], null, (v) => choose(v));
    ui.button('🗣️ Say it', () => speak(), 'btn');
    ui.note(hard ? 'Tap a sign or choose A, B or C, then say it. At this level the signs show the writing only.' : 'Tap a sign or choose A, B or C, then say it. Each right phrase moves your shopping one step along.');

    function paint() { signs.forEach((s, i) => { s.board.material = opts[i]?.state === 'ok' ? signOk : opts[i]?.state === 'no' ? signNo : pick === i ? signPick : signBase; }); }
    function ask() {
      const s = steps[si]; tried = false; pick = null;
      if (s.num) { const others = shuffle([0, 1, 2, 3, 4].filter((k) => k !== qty - 1)).slice(0, 2); opts = shuffle([qty - 1, ...others]).map((k) => ({ text: String(k + 1), sub: '', ok: k === qty - 1, wrong: 'Not that number. Count the fruit on the scale: the seller said the word for that many.' })); }
      else opts = shuffle(s.keys.map((k) => ({ text: word(k), sub: hard ? '' : roman(k), ok: k === s.right, wrong: WRONG[k] })));
      opts.forEach((o, i) => { write(signs[i].text, o.text, { size: 0.5, label: o.sub }); rSign[i].set(o.sub ? `${o.text}  (${o.sub})` : o.text); });
      rStep.set(`${si + 1} / ${TOTAL}`); rFirst.set(`${correct} / ${TOTAL}`); paint();
      ctx.say(t(s.q));
    }
    function choose(i) { if (finished || busy > 0 || !opts[i] || opts[i].state) return; pick = i; paint(); }
    function sellerSays(key, i) { const w = word(key, i), r = roman(key, i); write(bubble, w, { size: 0.55, bg: 'rgba(14,18,48,.78)', label: r }); rSeller.set(r ? `${w}  (${r})` : w); }
    function speak() {
      if (finished || busy > 0) return;
      if (pick === null) { ctx.say('Choose a sign first: A, B or C.'); return; }
      const o = opts[pick], s = steps[si], sg = signs[pick];
      if (!o.ok) { tried = true; o.state = 'no'; sg.shake = 0.5; pick = null; paint(); ctx.say(t(o.wrong) + ' ' + t('Think about when you would say it, then try another sign.')); return; }
      if (!tried) correct++;
      o.state = 'ok'; sg.hop = 0.6; paint(); rFirst.set(`${correct} / ${TOTAL}`); ctx.say(t(s.why));
      act(si);
    }
    // What happens at the stall after each right phrase.
    function act(k) {
      if (k === 0) { wave = 1.8; sellerSays('g'); busy = 2.2; }
      else if (k === 1) {
        for (let i = 0; i < qty; i++) move(fruits[i], panSlot(i), 0.55, i * 0.35, 0.7);
        sellerSays('n', qty - 1); tag.scale.setScalar(1); write(tagText, '?', { size: 0.34, color: '#2b1b4d' }); rPrice.set('?');
        busy = qty * 0.35 + 1.2;
      } else if (k === 2) {
        write(tagText, String(qty), { size: 0.34, color: '#2b1b4d' }); rPrice.set(`${qty} coins`);
        for (let i = 0; i < qty; i++) { const c = coins[i]; c.visible = true; const to = [c.position.x, TOP + 0.02, 0.1]; c.position.y = TOP + 1.6; move(c, to, 0.4, i * 0.22); }
        busy = qty * 0.22 + 1.2;
      } else if (k === 3) {
        for (let i = 0; i < qty; i++) { const f = fruits[i]; tweens.push({ o: f, a: null, b: bagSlot(i), t: -i * 0.35, d: 0.55, arc: 0.6, done: () => { inBag++; rBag.set(`${inBag} pieces`); } }); }
        busy = qty * 0.35 + 1.2;
      } else {
        wave = 2.2; const dz = 1.05, dy = -0.25;
        move(bag, [bag.position.x, bag.position.y + dy, bag.position.z + dz], 1.2, 0.2, 0.5);
        for (let i = 0; i < qty; i++) { const b = bagSlot(i); move(fruits[i], [b[0], b[1] + dy, b[2] + dz], 1.2, 0.2, 0.5); }
        busy = 2.4;
      }
      after = () => {
        si++;
        if (si < TOTAL) { ask(); return; }
        finished = true; rStep.set(`${TOTAL} / ${TOTAL}`);
        ctx.say(`Your basket holds ${qty} ${fruit[0]}, and you got ${correct} of ${TOTAL} phrases right first time. Using polite words like please and thank you makes shopping friendlier in any language.`);
        ctx.complete(correct / TOTAL, `Market role-play: ${correct}/${TOTAL} first-try.`);
      };
    }

    rPrice.set('–'); rBag.set('0 pieces'); rSeller.set('–');
    ask();

    return {
      step(dt) {
        for (let i = tweens.length - 1; i >= 0; i--) {
          const w = tweens[i]; w.t += dt; if (w.t < 0) continue;
          if (!w.a) w.a = [w.o.position.x, w.o.position.y, w.o.position.z];
          const k = Math.min(1, w.t / w.d), e = k * k * (3 - 2 * k);
          w.o.position.set(w.a[0] + (w.b[0] - w.a[0]) * e, w.a[1] + (w.b[1] - w.a[1]) * e + Math.sin(Math.PI * k) * w.arc, w.a[2] + (w.b[2] - w.a[2]) * e);
          if (k >= 1) { tweens.splice(i, 1); w.done?.(); }
        }
        if (wave > 0) { wave -= dt; arms[1].rotation.z = wave > 0 ? 2.5 + Math.sin(wave * 11) * 0.35 : 0.25; }
        for (const s of signs) {
          if (s.shake > 0) { s.shake = Math.max(0, s.shake - dt); s.g.rotation.z = Math.sin(s.shake * 40) * 0.08 * (s.shake / 0.5); }
          if (s.hop > 0) { s.hop = Math.max(0, s.hop - dt); s.g.position.y = 0.62 + Math.sin((1 - s.hop / 0.6) * Math.PI) * 0.35; }
        }
        if (busy > 0) { busy -= dt; if (busy <= 0 && after) { const f = after; after = null; f(); } }
        else if (auto && !finished) {
          autoWait -= dt;
          if (autoWait <= 0) { autoWait = 0.5; pickC.set(opts.findIndex((o) => o.ok)); speak(); }
        }
      },
      frame(dt, time) {
        if (ctx.calm) return;
        head.rotation.z = Math.sin(time * 1.3) * 0.06; pan.position.y = TOP + 0.42 + Math.sin(time * 2.1) * 0.008;
        if (bubble.s) bubble.s.position.y = bubble.p.y + Math.sin(time * 1.7) * 0.04;
      },
      // Buys the fruit by choosing the right sign at every step, through the same choice and button the player uses.
      autoplay() { auto = true; autoWait = 0.3; },
      dispose() { for (const hd of made) clear(hd); tweens.length = 0; },
    };
  },
};
