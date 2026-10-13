// World 20 lab — Fair Share in 3D: cookies on a picnic table, three friends, and two ideas of what fair means.
// No imports: everything arrives through the context, so the rule can also be checked without a browser.

const KIDS = ['Bear', 'Rabbit', 'Fox'];
const ROUNDS = [{ need: false, text: 'Everybody is hungry in the same way.' }, { need: true, text: 'This friend has had no lunch today!' }];

// ----- the rule: does a sharing match the idea of fair that was chosen? -----
export const model = {
  total: (level) => (level >= 2 ? 9 : 6),                      // cookies on the tray
  used: (give) => give.reduce((a, b) => a + b, 0),
  equal: (give) => give.every((g) => g === give[0]),
  more: (give, hungry) => give[hungry] > Math.max(...give.filter((_, i) => i !== hungry)),
  matches(idea, need, give, hungry) { return idea === 'same' ? model.equal(give) : need ? model.more(give, hungry) : model.equal(give); },
  // a sharing that fits: equal thirds, or two extra for the friend who needs more
  plan(idea, need, total, hungry) { const e = total / 3; return idea === 'need' && need ? [0, 1, 2].map((i) => (i === hungry ? e + 2 : e - 1)) : [e, e, e]; },
};
export function selfTest() {
  const checks = [
    model.matches('same', false, [2, 2, 2], 0) === true,
    model.matches('same', true, [4, 1, 1], 0) === false,
    model.matches('need', true, [4, 1, 1], 0) === true,
    model.matches('need', true, [3, 3, 0], 0) === false,         // a tie is not "more"
    model.matches('need', true, [2, 5, 2], 1) === true,
    model.matches('need', false, [3, 3, 3], 1) === true,         // nobody needs more, so equal is what the idea asks for
    model.matches('need', false, [4, 1, 1], 0) === false,
    model.total(1) === 6 && model.total(2) === 9,
    model.plan('need', true, 6, 2).join() === '1,1,4' && model.plan('need', true, 9, 0).join() === '5,2,2' && model.plan('same', true, 9, 0).join() === '3,3,3',
    [6, 9].every((n) => [0, 1, 2].every((h) => model.used(model.plan('need', true, n, h)) === n && model.matches('need', true, model.plan('need', true, n, h), h))),
  ];
  return { ok: checks.every(Boolean), detail: `${checks.filter(Boolean).length}/${checks.length} sharing cases agree with the rule (2+2+2 equal, 4+1+1 more for one, 3+3+0 is a tie)` };
}

export default {
  id: 'w20-fair-share',
  world: 20,
  levels: [1, 2],
  title: 'Fair Share',
  goal: 'Share the cookies. First say what you think fair means, then share in a way that matches.',
  kind: 'simplified',
  model: 'Six or nine cookies are shared between three friends, and the lab checks whether the plates match the idea of fair you picked: the same number for everyone, or more for the friend who needs more. Only these two simple ideas of fairness are included. People also think about effort, promises and other ideas. Neither idea is declared the winner here.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x), rnd = ctx.rng || Math.random;
    const total = model.total(ctx.level), hungry = Math.min(2, Math.floor(rnd() * 3));
    const geos = [], holders = [];
    const geo = (g) => { geos.push(g); return g; };
    const put = (g, m, x, y, z, parent = group) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
    const holder = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); group.add(g); holders.push(g); return g; };
    const label = (hold, text, opts) => {
      while (hold.children.length) { const s = hold.children[0]; hold.remove(s); s.material?.map?.dispose?.(); s.material?.dispose?.(); }
      if (text) hold.add(ctx.sprite(text, { font: 56, bg: 'rgba(40,28,60,.78)', ...opts }));
    };

    // ----- the picnic table, the plates and the tray -----
    const X = [-2.3, 0, 2.3], PLATE_Z = 0.15, PLATE_TOP = 1.06, TRAY_TOP = 0.6, TRAY_Z = 1.75;
    const wood = ctx.mat('#8a5a3a', { roughness: 0.8 }), cloth = ctx.mat('#f6eedb', { roughness: 0.9 });
    put(geo(new THREE.BoxGeometry(6.7, 0.14, 1.8)), wood, 0, 0.93, 0);
    const legGeo = geo(new THREE.BoxGeometry(0.3, 0.86, 1.4)); put(legGeo, wood, -2.7, 0.43, 0); put(legGeo, wood, 2.7, 0.43, 0);
    const plateGeo = geo(new THREE.CylinderGeometry(0.52, 0.42, 0.06, 28)), plateMat = ctx.mat('#ffffff', { roughness: 0.35 }), plateLit = ctx.lit('#fff3c4', 0.7);
    const plates = X.map((x) => put(plateGeo, plateMat, x, PLATE_TOP - 0.03, PLATE_Z));
    put(geo(new THREE.CylinderGeometry(0.28, 0.5, 0.5, 16)), ctx.mat('#7a5a8c', { roughness: 0.5 }), 0, 0.25, TRAY_Z);
    put(geo(new THREE.BoxGeometry(3.0, 0.1, 1.2)), cloth, 0, TRAY_TOP - 0.05, TRAY_Z);

    // ----- the cookies: real discs that fly in an arc from the tray to a plate -----
    const cookieGeo = geo(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20)), chipGeo = geo(new THREE.SphereGeometry(0.045, 8, 6));
    const cookieMat = ctx.mat('#d9a05b', { roughness: 0.9 }), chipMat = ctx.mat('#5a3420', { roughness: 0.7 });
    const cols = Math.ceil(total / 2);
    const home = (j) => new THREE.Vector3((Math.floor(j / 2) - (cols - 1) / 2) * 0.56, TRAY_TOP + 0.035, TRAY_Z + (j % 2 - 0.5) * 0.52);
    const onPlate = (i, slot) => { const layer = Math.floor(slot / 3), a = slot * 2.094 + layer * 1.05; return new THREE.Vector3(X[i] + Math.cos(a) * 0.2, PLATE_TOP + 0.035 + layer * 0.075, PLATE_Z + Math.sin(a) * 0.2); };
    const cookies = [];
    for (let j = 0; j < total; j++) {
      const g = new THREE.Group(); g.position.copy(home(j)); group.add(g);
      put(cookieGeo, cookieMat, 0, 0, 0, g); put(chipGeo, chipMat, 0.08, 0.035, 0.05, g); put(chipGeo, chipMat, -0.07, 0.035, -0.06, g);
      cookies.push({ g, at: -1, slot: 0, from: g.position.clone(), to: g.position.clone(), k: 1 });
    }
    const fly = (c, to) => { c.from.copy(c.g.position); c.to.copy(to); c.k = 0; };

    // ----- three friends sitting behind the table -----
    const FUR = ['#8a5a3a', '#f1ebe4', '#e8590c'], dark = ctx.mat('#2b2140', { roughness: 0.4 }), pale = ctx.mat('#fff4e0', { roughness: 0.8 });
    const bodyGeo = geo(new THREE.SphereGeometry(0.55, 20, 14)), headGeo = geo(new THREE.SphereGeometry(0.42, 20, 14)), eyeGeo = geo(new THREE.SphereGeometry(0.06, 8, 6)), snoutGeo = geo(new THREE.SphereGeometry(0.15, 10, 8));
    const earGeo = [geo(new THREE.SphereGeometry(0.16, 10, 8)), geo(new THREE.CylinderGeometry(0.09, 0.1, 0.62, 10)), geo(new THREE.ConeGeometry(0.17, 0.36, 4))];
    const friends = X.map((x, i) => {
      const g = new THREE.Group(); g.position.set(x, 0, -1.1); group.add(g);
      const fur = ctx.mat(FUR[i], { roughness: 0.85 });
      const body = put(bodyGeo, fur, 0, 1.0, 0, g); body.scale.set(1, 1.15, 0.9);
      const head = put(headGeo, fur, 0, 2.0, 0, g);
      put(eyeGeo, dark, -0.15, 0.09, 0.37, head); put(eyeGeo, dark, 0.15, 0.09, 0.37, head); put(snoutGeo, pale, 0, -0.08, 0.34, head);
      const earY = [0.36, 0.62, 0.46][i], earX = [0.3, 0.17, 0.26][i];
      for (const s of [-1, 1]) { const ear = put(earGeo[i], fur, s * earX, earY, 0, head); if (i === 1) ear.rotation.z = -s * 0.16; }
      return { g, body, head, name: holder(x, 3.25, -1.1), hop: 0 };
    });
    const noLunch = holder(X[hungry], 3.75, -1.1);
    const box = put(geo(new THREE.BoxGeometry(0.5, 0.2, 0.36)), ctx.mat('#4c6ef5', { roughness: 0.5 }), X[hungry] + 0.95, 1.1, -0.35);
    const lid = put(geo(new THREE.BoxGeometry(0.5, 0.04, 0.36)), ctx.mat('#748ffc', { roughness: 0.5 }), 0, 0.26, -0.26, box); lid.rotation.x = -1.1;
    box.visible = false;

    // ----- the two ideas of fair: a balance and a heart -----
    const offA = ctx.mat('#8f7f9c', { roughness: 0.6 }), onA = ctx.lit('#ffb92e', 0.9), offB = ctx.mat('#b58a98', { roughness: 0.6 }), onB = ctx.lit('#ff6b9d', 0.9), stone = ctx.mat('#f6eedb', { roughness: 0.9 });
    const baseGeo = geo(new THREE.CylinderGeometry(0.42, 0.52, 0.14, 18)), postGeo = geo(new THREE.CylinderGeometry(0.06, 0.09, 1.25, 10));
    const balance = new THREE.Group(); balance.position.set(-2.75, 0, 1.75); group.add(balance);
    put(baseGeo, stone, 0, 0.07, 0, balance); put(postGeo, stone, 0, 0.75, 0, balance);
    const beam = put(geo(new THREE.BoxGeometry(1.25, 0.08, 0.12)), offA, 0, 1.4, 0, balance);
    const panGeo = geo(new THREE.CylinderGeometry(0.24, 0.16, 0.09, 16)); const pans = [put(panGeo, offA, -0.52, -0.24, 0, beam), put(panGeo, offA, 0.52, -0.24, 0, beam)];
    const heartPost = new THREE.Group(); heartPost.position.set(2.75, 0, 1.75); group.add(heartPost);
    put(baseGeo, stone, 0, 0.07, 0, heartPost); put(postGeo, stone, 0, 0.6, 0, heartPost);
    const heart = new THREE.Group(); heart.position.set(0, 1.45, 0); heartPost.add(heart);
    const lobeGeo = geo(new THREE.SphereGeometry(0.25, 14, 10)), tipGeo = geo(new THREE.ConeGeometry(0.4, 0.56, 16));
    const heartParts = [put(lobeGeo, offB, -0.18, 0.14, 0, heart), put(lobeGeo, offB, 0.18, 0.14, 0, heart), put(tipGeo, offB, 0, -0.2, 0, heart)];
    heartParts[2].rotation.x = Math.PI; heartParts[2].scale.z = 0.6;
    label(holder(-2.75, 2.15, 1.75), t('Same for all'), { size: 0.26 }); label(holder(2.75, 2.15, 1.75), t('More for who needs'), { size: 0.26 });

    // ----- state and controls -----
    let ri = 0, idea = null, locked = false, wait = 0, done = false, auto = false, autoT = 0, tilt = 0;
    const give = [0, 0, 0];
    const rRound = ui.readout('Round'), rLeft = ui.readout('Left on the tray, cookies'), rPlates = ui.readout('Bear, Rabbit, Fox, cookies');
    const draw = () => {
      rRound.set(`${ri + 1}/2`); rLeft.set(String(total - model.used(give))); rPlates.set(give.join(' + '));
      friends.forEach((f, i) => label(f.name, `${t(KIDS[i])}: ${give[i]}`, { size: 0.36 }));
      beam.material = pans[0].material = pans[1].material = idea === 'same' ? onA : offA;
      heartParts.forEach((m) => { m.material = idea === 'need' ? onB : offB; });
      plates.forEach((p, i) => { p.material = ROUNDS[ri].need && i === hungry ? plateLit : plateMat; });
    };
    const setIdea = (v) => {
      if (locked) return;
      idea = v ?? null; draw();
      if (idea) ctx.say(idea === 'same' ? 'You say fair means the same for everyone. Now share out all the cookies so the plates match that idea.' : 'You say fair means more for whoever needs more. Now share out all the cookies so the plates match that idea.');
    };
    const ideaC = ui.choice([['same', 'Same for all'], ['need', 'More for who needs']], null, setIdea);
    const move = (i, d) => {
      if (locked) return;
      if (idea === null) { ctx.say('Pick what you think fair means first. Tap the balance or the heart.'); return; }
      if (d > 0) {
        if (model.used(give) >= total) { ctx.say('The tray is empty. Take a cookie back from a plate if you want to change the sharing.'); return; }
        let c = null; for (const k of cookies) if (k.at === -1) c = k;
        c.at = i; c.slot = give[i]; give[i]++; fly(c, onPlate(i, c.slot));
      } else {
        if (give[i] === 0) return;
        const c = cookies.find((k) => k.at === i && k.slot === give[i] - 1);
        give[i]--; c.at = -1; fly(c, home(cookies.indexOf(c)));
      }
      draw();
    };
    const start = () => {
      give.fill(0); cookies.forEach((c, j) => { if (c.at !== -1) { c.at = -1; fly(c, home(j)); } });
      locked = false; idea = null; ideaC.set(null);
      const need = ROUNDS[ri].need; box.visible = need; label(noLunch, need ? t('No lunch today!') : '', { size: 0.3, color: '#ffe066' });
      draw();
      ctx.say(`${t('Round')} ${ri + 1}/2. ${t(ROUNDS[ri].text)}${need ? ' (' + t(KIDS[hungry]) + ')' : ''} ${t('Pick what you think fair means first.')}`);
    };
    const finish = () => {
      if (locked) return;
      if (idea === null || model.used(give) < total) { ctx.say('Share out all the cookies, after choosing what fair means.'); return; }
      const need = ROUNDS[ri].need, ok = model.matches(idea, need, give, hungry), counts = give.join(', ');
      if (!ok) {
        ctx.say(idea === 'same' || !need
          ? `${t('Your sharing and your idea do not match. Look at the cookies again.')} ${t('The plates hold')} ${counts}. ${t(idea === 'same' ? 'Same for all means every plate has the same number.' : 'Nobody needs more this time, so your idea asks for the same number on every plate.')}`
          : `${t('Your sharing and your idea do not match. Look at the cookies again.')} ${t('The plates hold')} ${counts}. ${t('More for who needs means the friend with no lunch gets more than each of the others.')}`);
        return;
      }
      locked = true; friends.forEach((f) => { f.hop = 1.5; });
      ctx.say(`${t('Your sharing matches your idea of fair!')} ${t(need ? 'Some people say fair is the same for everyone. Others say fair is giving more to who needs more. Both are ideas people use.' : 'When everyone needs the same, sharing equally is an easy way to be fair.')}`);
      if (ri === 0) { ri = 1; wait = 1.5; } else { done = true; ctx.complete(1, 'Shared fairly and explained why in two situations.'); }
    };
    KIDS.forEach((k, i) => { ui.button(`+ ${k}`, () => move(i, 1)); ui.button(`− ${k}`, () => move(i, -1)); ctx.onTap(plates[i], () => move(i, 1)); ctx.onTap(friends[i].head, () => move(i, -1)); });
    ui.button('Done sharing', finish, 'btn ok');
    ui.note('Tap a plate to give a cookie and a friend\'s head to take one back. The balance means the same for all; the heart means more for who needs more.');
    ctx.onTap(beam, () => ideaC.set('same')); ctx.onTap(heartParts[2], () => ideaC.set('need'));
    start();

    return {
      step(dt) {
        for (const c of cookies) {
          if (c.k >= 1) continue;
          c.k = Math.min(1, c.k + dt / (ctx.calm ? 0.35 : 0.6));
          const e = c.k * c.k * (3 - 2 * c.k);
          c.g.position.lerpVectors(c.from, c.to, e); c.g.position.y += Math.sin(Math.PI * c.k) * (ctx.calm ? 0.25 : 0.9);
          c.g.rotation.x = ctx.calm ? 0 : Math.PI * 2 * e;
        }
        if (wait > 0) { wait -= dt; if (wait <= 0) start(); }
        if (auto && !done && !locked && wait <= 0) {
          autoT -= dt;
          if (autoT <= 0) {
            autoT = 0.3;
            const want = ri === 0 ? 'same' : 'need', plan = model.plan(want, ROUNDS[ri].need, total, hungry), i = plan.findIndex((n, k) => give[k] < n);
            if (idea !== want) ideaC.set(want); else if (i >= 0) move(i, 1); else finish();
          }
        }
      },
      frame(dt, time = 0) {
        const still = ctx.calm;
        friends.forEach((f, i) => {
          if (f.hop > 0) f.hop = Math.max(0, f.hop - dt);
          const rumble = ROUNDS[ri].need && i === hungry && !locked && !still ? Math.sin(time * 9) * 0.03 : 0;
          f.g.position.y = f.hop > 0 && !still ? Math.abs(Math.sin(f.hop * 7 + i)) * 0.3 : 0;
          f.body.rotation.z = rumble; f.head.rotation.z = still ? 0 : Math.sin(time * 1.3 + i * 2) * 0.06;
        });
        // the balance stays level only while every plate holds the same number
        const want = model.equal(give) ? 0 : (give[0] > give[2] || (give[0] === give[2] && give[1] > give[0]) ? 0.28 : -0.28);
        tilt += (want - tilt) * Math.min(1, dt * 5); beam.rotation.z = tilt; pans.forEach((p) => { p.rotation.z = -tilt; });
        const pulse = still ? 1 : 1 + Math.sin(time * 4) * 0.06;
        heart.scale.setScalar(idea === 'need' ? 1.15 * pulse : 1); balance.scale.setScalar(idea === 'same' ? 1.08 : 1);
      },
      autoplay() { auto = true; autoT = 0.2; },
      dispose() { holders.forEach((h) => label(h, '')); geos.forEach((g) => g.dispose()); },
    };
  },
};
