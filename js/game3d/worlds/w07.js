// World 7 — Geography: the High Meadow Expedition.
// A world file has no imports: it receives everything through the kit (decorate) and the context (sim.mount),
// so its model can also be checked by tools/test-game3d.mjs without a browser.

// ----- the model: where the Sun stands for a place (latitude) on a day of the year, on a tilted, spinning globe -----
const TILT = 23.44;                 // Earth's axial tilt, degrees
const RAD = Math.PI / 180;
const JUNE = 172.5, MARCH = 81.25;  // day numbers of the June solstice and the March equinox in this model
export const model = {
  TILT,
  // Solar declination in degrees on day N (1 = 1 January): the latitude where the noon Sun is straight overhead.
  declination: (N, tilt = TILT) => -tilt * Math.cos(2 * Math.PI * (N + 10) / 365),
  // Hours between sunrise and sunset: cos ω = −tan φ · tan δ, with the Sun up all day or down all day near the poles.
  dayLength(lat, dec) {
    const x = -Math.tan(lat * RAD) * Math.tan(dec * RAD);
    return x >= 1 ? 0 : x <= -1 ? 24 : Math.acos(x) * 24 / Math.PI;
  },
  // Height of the Sun above the horizon at noon, degrees (below zero: it does not rise).
  noonAltitude: (lat, dec) => 90 - Math.abs(lat - dec),
  // Distance from the Earth to the Sun in millions of kilometres (closest on about 3 January).
  distance: (N) => 149.6 * (1 - 0.0167 * Math.cos(2 * Math.PI * (N - 3) / 365)),
};
// Used by the automated tests: four results every atlas agrees on.
export function selfTest() {
  let eq = 0, nox = 0;
  for (let N = 1; N <= 365; N++) eq = Math.max(eq, Math.abs(model.dayLength(0, model.declination(N)) - 12));
  for (let lat = -85; lat <= 85; lat += 5) nox = Math.max(nox, Math.abs(model.dayLength(lat, model.declination(MARCH)) - 12));
  const dJ = model.declination(JUNE), polar = model.dayLength(90 - TILT, dJ), cancer = model.noonAltitude(TILT, dJ), near = model.distance(3);
  return {
    ok: eq < 1e-9 && nox < 1e-6 && polar > 23.99 && Math.abs(cancer - 90) < 1e-6 && Math.abs(dJ - TILT) < 1e-9 && Math.abs(near - 147.1) < 0.05,
    detail: `equator 12 h all year (max error ${eq.toExponential(1)} h), equinox 12 h at every latitude (max error ${nox.toExponential(1)} h), 66.56°N June solstice ${polar.toFixed(2)} h, Tropic of Cancer noon Sun ${cancer.toFixed(2)}°, declination ${dJ.toFixed(2)}°`,
  };
}

const MONTHS = [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]];
const dateOf = (N) => { let d = Math.round(N); for (const [name, len] of MONTHS) { if (d <= len) return `${d} ${name}`; d -= len; } return '31 December'; };
const placeOf = (lat) => (lat > 0 ? `${lat}° north` : lat < 0 ? `${-lat}° south` : 'the equator');

// What the player has to find at each level.
const TASKS = {
  1: { text: 'Find a place and a day where day and night are equal: 12 hours of daylight.', test: (r) => Math.abs(r.h - 12) <= 0.2 },
  2: { text: 'Stay at least 30° away from the equator and find a day when day and night are equal: 12 hours of daylight.', test: (r) => Math.abs(r.h - 12) <= 0.2 && Math.abs(r.lat) >= 30 },
  3: { text: 'Find a place and a day with at least 16 hours of daylight.', test: (r) => r.h >= 16 },
  4: { text: 'Find a place in the southern half of the Earth with at least 16 hours of daylight.', test: (r) => r.h >= 16 && r.lat < 0 },
  5: { text: 'Find the midnight Sun: a place and a day where the Sun does not set for the whole 24 hours.', test: (r) => r.h > 23.99 },
  6: { text: 'Find a place and a day where the noon Sun is 50° high (1° more or less is fine) and daylight lasts at least 15 hours.', test: (r) => Math.abs(r.alt - 50) <= 1 && r.h >= 15 },
};
const WINNING = { 1: [0, 100], 2: [45, 81], 3: [55, 172], 4: [-55, 355], 5: [75, 172], 6: [63.5, 172] };

const sim = {
  title: 'Sun and seasons',
  goal: 'Choose a latitude and a day of the year, then check that place. Watch the tilted globe circle the lamp and find where the daylight matches the expedition\'s target.',
  kind: 'validated',
  model: 'A globe tilted by 23.44° circling the Sun once in 365 days. The Sun\'s declination is −tilt × cos(2π(N + 10) / 365) for day N, the length of the day comes from cos ω = −tan(latitude) × tan(declination) with the Sun up or down all day near the poles, and the noon Sun stands 90° − |latitude − declination| above the horizon. It is checked against four known results: 12 hours at the equator all year, 12 hours everywhere at an equinox, 24 hours at 66.56° north on the June solstice, and an overhead noon Sun on the Tropic of Cancer that day. It leaves out the bending of light by the air and the width of the Sun\'s disc (together they add a few minutes of daylight), the slightly uneven speed of the Earth along its orbit, leap years, mountains and time zones. The lamp, globe and orbit are not drawn to scale.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, level = Math.min(6, Math.max(1, Math.round(ctx.level || 1))), task = TASKS[level];
    const C = new THREE.Vector3(0, 2.6, 0), R = 2.3, GR = 0.5;
    // the lamp-sun on its stand, and the path the globe follows around it
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.34, 2.2, 12), ctx.mat('#5b6470', { metalness: 0.4, roughness: 0.4 })); stand.position.y = 1.1; group.add(stand);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 18), ctx.lit('#ffd24a', 1.8)); lamp.position.copy(C); group.add(lamp);
    const shine = ctx.glow('#ffd24a', 2.8, 0.8); lamp.add(shine);
    const path = new THREE.Mesh(new THREE.RingGeometry(R - 0.014, R + 0.014, 96), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); path.position.copy(C); path.rotation.x = -Math.PI / 2; group.add(path);
    const dotGeo = new THREE.SphereGeometry(0.06, 10, 8);
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(dotGeo, ctx.lit(i % 2 ? '#9be7a8' : '#ffffff', 0.9)); d.position.set(C.x - Math.cos(i * Math.PI / 2) * R, C.y, C.z + Math.sin(i * Math.PI / 2) * R); group.add(d); }   // solstices (white) and equinoxes (green)
    // the globe: `holder` travels, `lean` carries the tilt (the north pole always leans the same way), `earth` spins
    const holder = new THREE.Group(), lean = new THREE.Group(); holder.add(lean); group.add(holder);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(GR, 36, 24), ctx.mat('#2f7fe0', { roughness: 0.6 })); lean.add(earth);
    for (const [lon, la, sz] of [[0.4, 0.5, 0.23], [2.3, -0.3, 0.2], [3.9, 0.7, 0.16], [5.2, -0.6, 0.17], [1.3, -0.9, 0.12]]) { const land = new THREE.Mesh(new THREE.SphereGeometry(sz, 12, 8), ctx.mat('#4fc36a', { roughness: 0.9 })); const d = GR + 0.015 - sz; land.position.set(Math.cos(la) * Math.cos(lon) * d, Math.sin(la) * d, Math.cos(la) * Math.sin(lon) * d); earth.add(land); }
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, GR * 3, 6), ctx.lit('#ffffff', 0.8)); lean.add(axis);
    const circle = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 48), ctx.lit('#ff7a59', 0.9)); circle.rotation.x = Math.PI / 2; lean.add(circle);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), ctx.lit('#ff4d3d', 1.6)); earth.add(pin);
    const night = new THREE.Mesh(new THREE.SphereGeometry(GR + 0.02, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050a26, transparent: true, opacity: 0.66, depthWrite: false })); holder.add(night);
    const up = new THREE.Vector3(0, 1, 0), away = new THREE.Vector3();

    let lat = 40, day = 30, tilt = TILT, shown = day, pending = false, tries = 0;
    const read = () => { const dec = model.declination(day, tilt); return { lat, day, tilt, dec, h: model.dayLength(lat, dec), alt: model.noonAltitude(lat, dec), dist: model.distance(day) }; };
    const rDate = ui.readout('Date'), rH = ui.readout('Hours of daylight'), rAlt = ui.readout('Noon Sun height, degrees'), rDec = ui.readout('Solar declination, degrees'), rDist = ui.readout('Distance to the Sun, million km');
    const show = () => {
      const r = read();
      rDate.set(dateOf(day)); rH.set(r.h.toFixed(1) + (r.h >= 23.995 ? ' (the Sun never sets)' : r.h <= 0.005 ? ' (the Sun never rises)' : ''));
      rAlt.set(r.alt.toFixed(1) + (r.alt < 0 ? ' (below the horizon)' : '')); rDec.set(r.dec.toFixed(1)); rDist.set(r.dist.toFixed(1));
      const a = lat * RAD; circle.scale.setScalar(Math.max(0.03, Math.cos(a) * (GR + 0.005))); circle.position.y = Math.sin(a) * (GR + 0.005);
      pin.position.set(Math.cos(a) * (GR + 0.02), Math.sin(a) * (GR + 0.02), 0);
      lean.rotation.z = -tilt * RAD;
    };
    const place = () => {
      const L = 2 * Math.PI * (shown - JUNE) / 365;                         // at the June solstice the north pole leans toward the lamp
      holder.position.set(C.x - Math.cos(L) * R, C.y, C.z + Math.sin(L) * R);
      away.copy(holder.position).sub(C).normalize(); night.quaternion.setFromUnitVectors(up, away);
    };
    const latS = ui.slider({ label: 'Latitude (north +, south −)', min: -90, max: 90, step: 0.5, value: lat, unit: '°', onInput: (v) => { lat = +v; show(); } });
    const dayS = ui.slider({ label: 'Day of the year', min: 1, max: 365, step: 1, value: day, unit: '', onInput: (v) => { day = +v; show(); } });
    if (level >= 4) ui.choice([[0, 'No tilt: 0°'], [TILT, 'Earth: 23.44°'], [45, 'Big tilt: 45°']], TILT, (v) => { tilt = +v; show(); });
    const judge = () => {
      const r = read(), where = `On ${dateOf(day)} at ${placeOf(lat)} the Sun is up for ${r.h.toFixed(1)} hours and its noon height is ${r.alt.toFixed(1)}°.`;
      if (task.test(r)) {
        const why = level <= 2
          ? (Math.abs(lat) < 1 ? 'At the equator day and night are equal all year, because the tilt leans it neither toward nor away from the Sun.' : 'This is an equinox: the tilted axis points neither toward nor away from the Sun, so every place on Earth gets 12 hours of light.')
          : level === 5 ? 'This pole leans toward the Sun so far that the place stays in the light for a whole spin of the Earth.'
          : `This half of the Earth leans toward the Sun now (declination ${r.dec.toFixed(1)}°), so the Sun climbs higher and stays up longer.`;
        ctx.say(`${where} ${why} The tilt makes the seasons, not the distance: today the Sun is ${r.dist.toFixed(1)} million km away, and the Earth is closest to it in early January, in the middle of the northern winter.`);
        ctx.complete(tries <= 2 ? 1 : tries <= 4 ? 0.85 : 0.7, `level=${level}, lat=${lat}, day=${day}, tilt=${tilt}, h=${r.h.toFixed(2)}, alt=${r.alt.toFixed(1)}, tries=${tries}`);
        return;
      }
      let hint;
      if (tilt === 0) hint = 'With no tilt every place gets 12 hours of light on every day and the noon Sun never changes: no seasons at all. Put the tilt back.';
      else if (level <= 2) hint = Math.abs(r.h - 12) <= 0.2 ? 'Day and night are equal there, but near the equator they always are. Go at least 30° away and find the right day.' : 'That is not 12 hours. Slide the day until the axis leans neither toward nor away from the Sun: look for the green dots on the path.';
      else if (level === 4 && lat >= 0) hint = 'That place is in the northern half. In the south the long days come around December, when the south pole leans toward the Sun.';
      else if (level <= 4) hint = 'We need 16 hours. Go further from the equator, and choose the time of year when that half of the Earth leans toward the Sun.';
      else if (level === 5) hint = 'The Sun still sets there. Go closer to a pole, in the months when that pole leans toward the Sun.';
      else hint = Math.abs(r.alt - 50) > 1 ? 'We need a noon Sun 50° high. Each degree of latitude you move changes the noon Sun by one degree.' : 'The noon Sun is right, but the day is shorter than 15 hours. Try the same Sun height in that place\'s summer, further from the equator.';
      ctx.say(`${where} ${hint}`);
    };
    const check = () => { tries++; pending = true; if (ctx.calm) shown = day; };
    ui.button('☀️ Check this place', check, 'btn');
    ui.note(task.text);
    ui.note('The red dot is your place. The dark half of the globe is night. The globe always leans the same way as it goes round the lamp.');
    show(); place();
    ctx.say(`${task.text} Set the sliders, then press Check.`);
    return {
      step(dt) {
        const gap = day - shown;
        if (Math.abs(gap) > 0.4) shown += Math.sign(gap) * Math.min(Math.abs(gap), Math.max(30, Math.abs(gap) * 3) * dt); else shown = day;
        place();
        if (pending && shown === day) { pending = false; judge(); }
      },
      frame(dt) { earth.rotation.y += dt * (ctx.calm ? 0.3 : 0.9); },
      // Shows a successful run without the player (used by tests).
      autoplay() { [lat, day] = WINNING[level]; tilt = TILT; latS.set(lat); dayS.set(day); show(); check(); },
      get state() { return read(); },
    };
  },
};

export default {
  id: 7,
  theme: {
    sky: ['#2a86e0', '#8fd2ff', '#eaf8dc'], fog: '#c4e9ee', fogNear: 60, fogFar: 200,
    ground: '#4fb65c', ground2: '#7cc93d', side: '#8b6b47', stone: '#cdc6b0', accent: '#1b9c5a', glow: '#ffe07a', metal: '#5b6470', wood: '#9a6a3c', leaf: '#2f9e55', water: '#35b6e8', crate: '#e0a860',
    sun: '#fff3cf', sunPower: 2.6, ambient: 1.35, skyLight: '#e2f4ff', groundLight: '#5d8a4a', sunDir: [-0.45, 1, 0.3], particles: 'leaves',
  },
  layout: { shape: 'hook', mirror: -1, stones: 4, rise: 0.6, towerH: 6 },
  story: {
    title: 'The High Meadow Expedition',
    crystal: 'compass stones', crystalEm: '🧭',
    intro: ['Welcome to High Meadow Camp! A big wind blew through last night and carried off our five compass stones.', 'Without them our maps are just pretty pictures. Find the stones and we can set out to explore the whole world.'],
    remind: 'The compass stones shine like gold. Look over the stepping stones, in the lagoon and on top of the waterfall tower.',
    afterCrystals: 'All five compass stones! Now ride the lift from the tower to the sun globe and help us plan the trip.',
    afterSim: 'Now we know where the long days are. Only the Chief Map-Maker is left: the arena is up the steps.',
    notReady: 'A good explorer gets ready first. Bring all five compass stones and finish the sun globe, then come back.',
    rival: ['So you can read a globe. I have drawn every map in this camp by hand.', 'We each build a bridge of light, one piece for every right answer. Let us see who reaches the far side first.'],
    win: ['Your bridge is finished and mine is not. You know the world well: the portal is yours, explorer.'],
    lose: ['My bridge is done first this time. Read the tablets again, then come back and try me once more.'],
    outro: 'The compass stones are home, the maps are true again and the Chief Map-Maker has tipped her hat. The lesson is ready whenever you are.',
  },
  // Scenery that belongs to this world only. North is +Z, the way the route leads.
  decorate(k, S) {
    const { THREE } = k, m = S.sim[0] < 0 ? -1 : 1, flat = -Math.PI / 2;
    const soft = (mesh) => { mesh.castShadow = false; return mesh; };
    // the camp on the home island: two tents with their doors toward the middle, and a lantern by the gate
    for (const [x, z, c] of [[-7 * m, -0.5, '#f2a03d'], [6.4 * m, -4.6, '#e9604a']]) {
      const yaw = Math.atan2(-x, -z);
      k.mesh(new THREE.ConeGeometry(1.5, 1.7, 4), k.mat(c, { flatShading: true }), x, 0.85, z).rotation.y = yaw + Math.PI / 4;
      k.mesh(new THREE.ConeGeometry(0.62, 1.0, 4), k.mat('#4a3a2c', { flatShading: true }), x + Math.sin(yaw) * 0.66, 0.5, z + Math.cos(yaw) * 0.66).rotation.y = yaw + Math.PI / 4;
    }
    k.prop('lamp', -3.6 * m, 0, 6.8);
    // a compass rose painted on the ground in the middle of camp
    soft(k.mesh(new THREE.RingGeometry(2.3, 2.5, 48), k.mat('#ffe07a', { roughness: 1 }), 0, 0.02, 0)).rotation.x = flat;
    const ew = soft(k.mesh(new THREE.CircleGeometry(1, 4), k.mat('#fff6d8', { roughness: 1 }), 0, 0.03, 0)); ew.rotation.x = flat; ew.scale.set(1.5, 0.3, 1);
    const ns = soft(k.mesh(new THREE.CircleGeometry(1, 4), k.mat('#fff6d8', { roughness: 1 }), 0, 0.04, 0)); ns.rotation.x = flat; ns.scale.set(0.42, 2.2, 1);
    soft(k.mesh(new THREE.CircleGeometry(0.42, 3), k.mat('#e2553d', { roughness: 1 }), 0, 0.05, 1.95)).rotation.set(flat, 0, flat);
    // the signpost: four arms for north, east, south and west
    const px = 3.6 * m, pz = 6.6;
    k.mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.7, 8), k.mat(k.theme.wood), px, 1.35, pz);
    for (const [name, dx, dz, y] of [['N', 0, 1, 2.4], ['E', -1, 0, 2.1], ['S', 0, -1, 1.8], ['W', 1, 0, 1.5]]) {
      k.mesh(new THREE.BoxGeometry(dx ? 0.95 : 0.07, 0.22, dz ? 0.95 : 0.07), k.mat('#f4ead8'), px + dx * 0.5, y, pz + dz * 0.5);
      k.sign(name, px + dx * 1.2, y + 0.05, pz + dz * 1.2, { size: 0.42 });
    }
    // the warm middle island: two palms and a weather vane that turns with the wind
    const mid = S.mid, fronds = [];
    for (const [x, z] of [[-4.6 * m, 3.6], [-5.6 * m, 0.6]]) {
      k.mesh(new THREE.CylinderGeometry(0.1, 0.17, 3.2, 7), k.mat(k.theme.wood), mid[0] + x, mid[1] + 1.6, mid[2] + z).rotation.z = 0.12;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + x, f = k.mesh(new THREE.ConeGeometry(0.3, 1.7, 5), k.mat('#3fae4f', { flatShading: true }), mid[0] + x - 0.19 + Math.sin(a) * 0.75, mid[1] + 3.1, mid[2] + z + Math.cos(a) * 0.75);
        f.rotation.order = 'YXZ'; f.rotation.set(1.75, a, 0); f.scale.z = 0.3; fronds.push(f);
      }
    }
    const vx = mid[0] + 4 * m, vz = mid[2] - 3;
    k.mesh(new THREE.CylinderGeometry(0.05, 0.09, 3, 8), k.mat(k.theme.metal, { metalness: 0.5, roughness: 0.35 }), vx, mid[1] + 1.5, vz);
    k.mesh(new THREE.BoxGeometry(1.1, 0.05, 0.05), k.mat(k.theme.metal, { metalness: 0.5, roughness: 0.35 }), vx, mid[1] + 2.5, vz);
    k.mesh(new THREE.BoxGeometry(0.05, 0.05, 1.1), k.mat(k.theme.metal, { metalness: 0.5, roughness: 0.35 }), vx, mid[1] + 2.5, vz);
    const vane = k.add(new THREE.Group()); vane.position.set(vx, mid[1] + 3, vz);
    k.mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), k.mat('#e2553d'), 0, 0, 0, vane);
    k.mesh(new THREE.ConeGeometry(0.16, 0.4, 4), k.mat('#e2553d'), 0.8, 0, 0, vane).rotation.z = flat;
    // a quiet volcano beyond the lagoon, with a warm glow and a puff of steam
    const vol = [-24 * m, 4.4, mid[2] + 11.6];
    k.mesh(new THREE.CylinderGeometry(1.7, 8, 13, 14), k.mat('#7a6658', { flatShading: true, roughness: 1 }), vol[0], vol[1] - 6.5, vol[2]);
    soft(k.mesh(new THREE.CircleGeometry(1.5, 16), k.lit('#ff9a3c', 1.3), vol[0], vol[1] + 0.03, vol[2])).rotation.x = flat;
    const ember = k.add(k.glow('#ff9a3c', 10, 0.4)); ember.position.set(vol[0], vol[1] + 1, vol[2]);
    const steam = soft(k.mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false }), vol[0], vol[1], vol[2]));
    // the cool far island: a waterfall down the tower beside the ladder, and a pine
    const far = S.far, top = S.sim[1], fall = top - far[1], wx = -1.75 * m, wz = far[2] + 0.86;
    const waterM = new THREE.MeshStandardMaterial({ color: 0x8fdcff, emissive: 0x4fb8f0, emissiveIntensity: 0.4, transparent: true, opacity: 0.82, roughness: 0.2, side: THREE.DoubleSide });
    const foamM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    soft(k.mesh(new THREE.PlaneGeometry(1.2, fall), waterM, wx, far[1] + fall / 2, wz));
    const streak = soft(k.mesh(new THREE.PlaneGeometry(0.3, fall), foamM, wx, far[1] + fall / 2, wz - 0.02));
    soft(k.mesh(new THREE.CircleGeometry(1.1, 20), waterM, wx, far[1] + 0.03, wz - 0.75)).rotation.x = flat;
    k.mesh(new THREE.BoxGeometry(1.4, 0.24, 0.5), k.mat(k.theme.stone), wx, top + 0.12, wz + 0.2);
    const spray = k.add(k.glow('#ffffff', 2.2, 0.5)); spray.position.set(wx, far[1] + 0.4, wz - 0.3);
    k.prop('pine', -5 * m, far[1], far[2] - 1.5, { s: 1.1, color: '#2a7d5c', solid: true });
    // the sun-globe island, the arena flags and the last island
    k.prop('pine', S.sim[0] - 4.8 * m, S.sim[1], S.sim[2] + 5, { color: '#2a7d5c', solid: true });
    for (const sx of [-1, 1]) k.prop('banner', S.arena[0] + sx * 4.95, S.arena[1], S.arena[2] + 3.4, { color: sx < 0 ? '#1b9c5a' : '#7cc93d' });
    for (const sx of [-1, 1]) k.prop('bush', S.end[0] + sx * 3.2, S.end[1], S.end[2] + 0.5, { color: '#7cc93d' });
    // snow peaks on the horizon
    const rockM = k.mat('#7f9189', { flatShading: true, roughness: 1, fog: false }), snowM = k.mat('#ffffff', { flatShading: true, roughness: 0.9, fog: false });
    for (const [x, z, r, h] of [[-64, 28, 26, 46], [-72, 78, 30, 54], [60, 12, 24, 42], [68, 96, 28, 50]]) {
      soft(k.mesh(new THREE.ConeGeometry(r, h, 7), rockM, x, h / 2 - 14, z)).rotation.y = x;
      soft(k.mesh(new THREE.ConeGeometry(r * 0.44, h * 0.43, 7), snowM, x, h - 14 - h * 0.43 / 2 + 0.3, z)).rotation.y = x;
    }
    k.animate((dt, t) => {
      vane.rotation.y = Math.sin(t * 0.45) * 1.3 + Math.sin(t * 1.7) * 0.2;
      for (let i = 0; i < fronds.length; i++) fronds[i].rotation.x = 1.75 + Math.sin(t * 1.3 + i) * 0.07;
      waterM.emissiveIntensity = 0.4 + Math.sin(t * 5) * 0.14; foamM.opacity = 0.45 + Math.sin(t * 7.3) * 0.2;
      streak.position.x = wx + Math.sin(t * 2.1) * 0.35; spray.material.opacity = 0.4 + Math.sin(t * 6) * 0.12;
      ember.material.opacity = 0.36 + Math.sin(t * 0.8) * 0.1;
      const p = (t * 0.1) % 1; steam.position.y = vol[1] + 0.4 + p * 5; steam.scale.setScalar(0.7 + p * 1.6); steam.material.opacity = 0.5 * (1 - p);
    });
  },
  sim,
};
