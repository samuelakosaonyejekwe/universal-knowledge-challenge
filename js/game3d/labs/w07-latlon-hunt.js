// World 7 lab — Latitude-Longitude Treasure Hunt, on a globe with latitude and longitude rings and a movable pin.
// No imports: everything arrives through ctx, so the lab also runs in tools/test-game3d.mjs.

const LAND = [ // rough blobs in lon/lat degrees [lon, lat, rx, ry] - stylised, not real outlines
  [-100, 45, 35, 22], [-60, -15, 15, 28], [20, 5, 20, 30], [15, 50, 20, 10], [85, 45, 45, 20], [135, -25, 15, 10], [0, -80, 150, 10],
];
const D = Math.PI / 180;
const wrap = (d) => { d = Math.abs(d) % 360; return d > 180 ? 360 - d : d; };

export const model = {
  R: 6371,                                   // Earth's mean radius, km
  // Great-circle distance between two places (haversine formula), in km.
  distance(lat1, lon1, lat2, lon2) {
    const a = Math.sin((lat2 - lat1) * D / 2) ** 2 + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin((lon2 - lon1) * D / 2) ** 2;
    return 2 * this.R * Math.asin(Math.min(1, Math.sqrt(a)));
  },
  quarter: (lat, lon) => (lat >= 0 ? 'N' : 'S') + (lon >= 0 ? 'E' : 'W'),
  // One dig: how far off the pin is, whether it counts, and the points it earns.
  judge(pin, tgt, quad, tol) {
    const dlat = Math.abs(pin.lat - tgt.lat), dlon = wrap(pin.lon - tgt.lon), ok = dlat <= tol && dlon <= tol, rightQ = quad === this.quarter(tgt.lat, tgt.lon);
    return { dlat, dlon, ok, rightQ, gain: ok ? (rightQ ? 1 : 0.7) : 0, km: this.distance(pin.lat, pin.lon, tgt.lat, tgt.lon) };
  },
  target: (rng) => ({ lat: Math.round((rng() * 120 - 60) / 5) * 5 || 5, lon: Math.round((rng() * 320 - 160) / 5) * 5 || 5 }),
};

export function selfTest() {
  const one = model.distance(0, 0, 1, 0), quarterRound = model.distance(0, 0, 0, 90), at60 = model.distance(60, 0, 60, 1);
  const a = model.judge({ lat: 40, lon: -75 }, { lat: 45, lon: -80 }, 'NW', 10), b = model.judge({ lat: 40, lon: -75 }, { lat: 45, lon: -80 }, 'NE', 10), c = model.judge({ lat: 30, lon: -80 }, { lat: 45, lon: -80 }, 'NW', 10);
  const ok = Math.abs(one - 111.19) < 0.01 && Math.abs(quarterRound - 10007.5) < 0.1 && Math.abs(at60 - 55.6) < 0.05      // 2πR/360, 2πR/4, half a degree's width at 60°
    && a.ok && a.gain === 1 && a.dlat === 5 && a.dlon === 5 && b.ok && b.gain === 0.7 && !c.ok && c.gain === 0 && c.dlat === 15
    && wrap(175 - -175) === 10 && model.quarter(-20, 30) === 'SE';
  return { ok, detail: `1° of latitude ${one.toFixed(2)} km, a quarter of the equator ${quarterRound.toFixed(1)} km, 1° of longitude at 60°N ${at60.toFixed(2)} km, right dig ${a.gain}, wrong quarter ${b.gain}, 15° off ${c.gain}` };
}

// A raised low-poly patch on a sphere: a fan from the centre to the outline, bent to the globe, with a skirt down to the sea.
function landGeo(THREE, ring, centre, R, h, n) {
  const pos = [];
  const P = (ll, r) => { const lo = ll[0] * D, la = ll[1] * D; return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)]; };
  const tri = (a, b, c, out) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const d = (uy * vz - uz * vy) * out[0] + (uz * vx - ux * vz) * out[1] + (ux * vy - uy * vx) * out[2];
    if (d >= 0) pos.push(...a, ...b, ...c); else pos.push(...a, ...c, ...b);
  };
  const c0 = P(centre, R);
  for (let i = 0; i < ring.length; i++) {
    const B = ring[i], E = ring[(i + 1) % ring.length];
    const pt = (u, v) => P([centre[0] + (B[0] - centre[0]) * u / n + (E[0] - centre[0]) * v / n, centre[1] + (B[1] - centre[1]) * u / n + (E[1] - centre[1]) * v / n], R + h);
    for (let u = 0; u < n; u++) for (let v = 0; v < n - u; v++) {
      const a = pt(u, v); tri(a, pt(u + 1, v), pt(u, v + 1), a);
      if (u + v < n - 1) tri(pt(u + 1, v), pt(u + 1, v + 1), pt(u, v + 1), a);
    }
    const t0 = P(B, R + h), t1 = P(E, R + h), b0 = P(B, R - 0.03), b1 = P(E, R - 0.03), out = [t0[0] + t1[0] - 2 * c0[0], t0[1] + t1[1] - 2 * c0[1], t0[2] + t1[2] - 2 * c0[2]];
    tri(t0, t1, b1, out); tri(t0, b1, b0, out);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

export default {
  id: 'w07-latlon-hunt',
  world: 7,
  levels: [3, 4],
  title: 'Latitude-Longitude Treasure Hunt',
  goal: 'Move your pin over the globe to the treasure coordinates. First say which quarter of the world it is in.',
  kind: 'validated',
  model: 'A perfect ball with rings every 30 degrees and stylised land blobs (no real coastlines). Distances use the great-circle (haversine) formula with Earth\'s mean radius of 6,371 km, checked against the length of one degree. The real Earth is slightly flattened at the poles, and flat maps stretch the globe in different ways; on the globe you can see that one degree of longitude shrinks toward the poles.',
  mount(ctx) {
    const { THREE, group, ui } = ctx, t = ctx.t || ((x) => x);
    const R = 1.6, G = new THREE.Vector3(0, 2.75, 0), rounds = 3, tol = ctx.level <= 3 ? 10 : 5;
    const add = (geo, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const onSphere = (lon, lat, r) => new THREE.Vector3(r * Math.cos(lat * D) * Math.sin(lon * D), r * Math.sin(lat * D), r * Math.cos(lat * D) * Math.cos(lon * D));
    const own = [];                                                        // materials made here (not shared), removed in dispose()
    const basic = (color, opacity) => { const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide }); own.push(m); return m; };

    // ----- the globe on its stand -----
    const dark = ctx.mat('#5b6470', { metalness: 0.4, roughness: 0.45 }), wood = ctx.mat('#9a6a3c');
    add(new THREE.CylinderGeometry(0.8, 0.95, 0.22, 24), wood, 0, 0.11, 0);
    add(new THREE.CylinderGeometry(0.09, 0.14, 0.75, 10), dark, 0, 0.58, 0);
    add(new THREE.CylinderGeometry(0.04, 0.04, 2 * R + 0.4, 8), dark, G.x, G.y, 0);
    const globe = new THREE.Group(); globe.position.copy(G); group.add(globe);
    const ocean = add(new THREE.SphereGeometry(R, 40, 26), ctx.mat('#2a6fb0', { roughness: 0.5 }), 0, 0, 0, globe);
    const landMat = ctx.mat('#6fbf73', { flatShading: true, side: THREE.DoubleSide, roughness: 0.9 }), tappable = [ocean];
    for (const [lo, la, rx, ry] of LAND) {
      const ring = []; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; ring.push([lo + rx * Math.cos(a), Math.max(-88, Math.min(88, la + ry * Math.sin(a)))]); }
      tappable.push(add(landGeo(THREE, ring, [lo, la], R, 0.06, 4), landMat, 0, 0, 0, globe));
    }
    const thin = ctx.mat('#cfe8ff', { roughness: 0.6 }), bold = ctx.lit('#ffffff', 0.7);
    for (let la = -60; la <= 60; la += 30) { const ring = add(new THREE.TorusGeometry((R + 0.066) * Math.cos(la * D), la ? 0.009 : 0.022, 5, 64), la ? thin : bold, 0, (R + 0.066) * Math.sin(la * D), 0, globe); ring.rotation.x = Math.PI / 2; ring.castShadow = false; }
    const merGeo = new THREE.TorusGeometry(R + 0.066, 0.009, 5, 64);
    for (let k = 0; k < 6; k++) { const m = add(merGeo, thin, 0, 0, 0, globe); m.rotation.y = k * 30 * D + Math.PI / 2; m.castShadow = false; }
    const halfArc = new THREE.TorusGeometry(1, 0.014, 5, 40, Math.PI);       // a half circle from pole to pole, radius 1
    const prime = add(halfArc, bold, 0, 0, 0, globe); prime.rotation.order = 'YZX'; prime.rotation.set(0, -Math.PI / 2, -Math.PI / 2); prime.scale.setScalar(R + 0.07); prime.castShadow = false;
    for (let lo = -150; lo <= 180; lo += 30) { const s = ctx.sprite(lo === 0 || lo === 180 ? `${lo}°` : `${Math.abs(lo)}°${lo > 0 ? 'E' : 'W'}`, { size: 0.2 }); s.position.copy(onSphere(lo, -7, R + 0.16)); globe.add(s); }
    for (let la = -60; la <= 60; la += 30) { const s = ctx.sprite(la === 0 ? '0°' : `${Math.abs(la)}°${la > 0 ? 'N' : 'S'}`, { size: 0.26, bg: 'rgba(14,18,48,.72)' }); s.position.set(G.x - R * Math.cos(la * D) - 0.5, G.y + R * Math.sin(la * D), 0.2); group.add(s); }
    // the four quarters of the world as see-through shells (three.js spheres start at longitude -90°)
    const shells = {}, shellMat = basic('#ffe07a', 0.24);
    for (const [key, phi, theta] of [['NE', 0.5, 0], ['NW', 1.5, 0], ['SE', 0.5, 0.5], ['SW', 1.5, 0.5]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(R + 0.13, 20, 10, phi * Math.PI, Math.PI, theta * Math.PI, Math.PI / 2), shellMat); s.visible = false; globe.add(s); shells[key] = s; }
    // the pin, with the ring of its latitude and the half circle of its longitude
    const pinG = new THREE.Group(); globe.add(pinG);
    add(new THREE.ConeGeometry(0.06, 0.34, 8), ctx.mat('#f4ead8', { metalness: 0.3 }), 0, 0.17, 0, pinG).rotation.x = Math.PI;
    add(new THREE.SphereGeometry(0.14, 14, 10), ctx.lit('#e0463c', 0.5), 0, 0.44, 0, pinG);
    const guide = ctx.lit('#ffd23c', 1.1), latRing = add(new THREE.TorusGeometry(1, 0.014, 5, 64), guide, 0, 0, 0, globe); latRing.rotation.x = Math.PI / 2; latRing.castShadow = false;
    const lonArc = add(halfArc, guide, 0, 0, 0, globe); lonArc.rotation.order = 'YZX'; lonArc.scale.setScalar(R + 0.1); lonArc.castShadow = false;
    // the treasure chest that comes up where the treasure really was
    const chest = new THREE.Group(); chest.visible = false; globe.add(chest);
    add(new THREE.BoxGeometry(0.34, 0.2, 0.24), ctx.mat('#8a5a2b'), 0, 0.1, 0, chest);
    const lid = new THREE.Group(); lid.position.set(0, 0.2, -0.12); chest.add(lid); add(new THREE.BoxGeometry(0.34, 0.08, 0.24), ctx.mat('#b98045'), 0, 0.04, 0.12, lid);
    const gold = add(new THREE.SphereGeometry(0.1, 10, 8), ctx.lit('#ffd23c', 1.6), 0, 0.2, 0, chest); const shine = ctx.glow('#ffe07a', 0.9, 0.8); shine.position.y = 0.3; chest.add(shine);

    // ----- the hunt -----
    let r = 0, score = 0, quad = null, locked = false, done = false, auto = false, autoT = 0, tgt = null, spin = 0, face = 0, chestK = 0, open = false;
    const pin = { lat: 0, lon: 0 }, up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
    const fmtLL = (lat, lon) => `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(Math.round(lon))}°${lon >= 0 ? 'E' : 'W'}`;
    const rT = ui.readout('Treasure'), rP = ui.readout('Pin at'), rO = ui.readout('Off by, degrees'), rD = ui.readout('Distance off, km'), rS = ui.readout('Score');
    const place = (g, lat, lon, r0) => { v.copy(onSphere(lon, lat, 1)); g.position.copy(v).multiplyScalar(r0); g.quaternion.setFromUnitVectors(up, v); };
    const show = () => {
      place(pinG, pin.lat, pin.lon, R + 0.02); face = pin.lon;
      const c = Math.max(0.03, Math.cos(pin.lat * D)); latRing.scale.set((R + 0.1) * c, (R + 0.1) * c, 1); latRing.position.y = (R + 0.1) * Math.sin(pin.lat * D);
      lonArc.rotation.set(0, pin.lon * D - Math.PI / 2, -Math.PI / 2);
      rP.set(fmtLL(pin.lat, pin.lon));
    };
    const latS = ui.slider({ label: 'Latitude (north is +, south is −)', min: -90, max: 90, step: 5, value: 0, unit: '°', onInput: (x) => { if (locked) return; pin.lat = +x; show(); } });
    const lonS = ui.slider({ label: 'Longitude (east is +, west is −)', min: -180, max: 180, step: 5, value: 0, unit: '°', onInput: (x) => { if (locked) return; pin.lon = +x; show(); } });
    const setPin = (lat, lon) => { if (locked) return; pin.lat = lat; pin.lon = lon; latS.set?.(lat); lonS.set?.(lon); pin.lat = lat; pin.lon = lon; show(); };
    const setQuad = (x) => { quad = x; for (const k in shells) shells[k].visible = k === x; if (!locked) ctx.say('That quarter of the globe is lit. Now move the pin with the sliders, or tap the globe.'); };
    const quadC = ui.choice([['NE', 'North + East'], ['NW', 'North + West'], ['SE', 'South + East'], ['SW', 'South + West']], null, setQuad);
    for (const m of tappable) ctx.onTap(m, (o, p) => {
      if (locked || !p) return;
      const dx = p.x - G.x, dy = p.y - G.y, dz = p.z - G.z, len = Math.hypot(dx, dy, dz) || 1;
      let lon = (Math.atan2(dx, dz) - spin) / D; lon = ((lon + 180) % 360 + 360) % 360 - 180;
      setPin(Math.max(-90, Math.min(90, Math.round(Math.asin(dy / len) / D / 5) * 5)), Math.round(lon / 5) * 5);
    });
    function newT() {
      tgt = model.target(ctx.rng); locked = false; quad = null; for (const k in shells) shells[k].visible = false; chest.visible = false; chestK = 0; open = false; autoT = 0;
      rT.set(`${r + 1}/${rounds}: ${fmtLL(tgt.lat, tgt.lon)}`); rO.set('–'); rD.set('–'); rS.set(`${+score.toFixed(1)}/${r}`); show();
      ctx.say(`Treasure ${r + 1} is at ${fmtLL(tgt.lat, tgt.lon)}. The first number is the latitude: how far north or south of the equator. The second is the longitude: how far east or west of the white line from pole to pole.`);
    }
    function dig() {
      if (locked || done) return;
      if (!quad) { ctx.say('Pick the quarter first: is the treasure north or south of the equator, and east or west of the prime meridian?'); return; }
      locked = true;
      const j = model.judge(pin, tgt, quad, tol); score += j.gain; r++; open = j.ok;
      place(chest, tgt.lat, tgt.lon, R + 0.04); chest.visible = true; chestK = 0; gold.visible = shine.visible = j.ok; face = tgt.lon;
      for (const k in shells) shells[k].visible = k === model.quarter(tgt.lat, tgt.lon);
      rO.set(`${j.dlat}° ${t('latitude')}, ${j.dlon}° ${t('longitude')}`); rD.set(Math.round(j.km).toLocaleString('en')); rS.set(`${+score.toFixed(1)}/${r}`);
      const hint = j.ok ? '' : ` The chest is ${j.dlat > tol ? `further ${tgt.lat > pin.lat ? 'north' : 'south'}` : ''}${j.dlat > tol && j.dlon > tol ? ' and ' : ''}${j.dlon > tol ? `further ${((tgt.lon - pin.lon) % 360 + 540) % 360 - 180 > 0 ? 'east' : 'west'}` : ''}.`;
      ctx.say(`${j.ok ? 'You found it!' : 'Not quite.'} You placed ${fmtLL(pin.lat, pin.lon)}: off by ${j.dlat}° of latitude and ${j.dlon}° of longitude, about ${Math.round(j.km).toLocaleString('en')} km on the real Earth.${hint}${j.rightQ ? '' : ' Your quarter guess was off: the right quarter is lit now.'} Latitude is how far north or south of the equator; longitude is how far east or west of the prime meridian.`);
      if (r >= rounds) { done = true; ctx.complete(score / rounds, `Read and placed latitude and longitude coordinates: ${+score.toFixed(1)}/${rounds}.`); }
    }
    const next = () => { if (locked && !done) newT(); };
    ui.button('Dig here', dig, 'btn');
    ui.button('Next treasure', next, 'btn ok');
    ui.note(`A dig counts when the pin is within ${tol}° both ways. The rings are 30° apart. Look how the longitude lines squeeze together near the poles.`);
    newT();

    return {
      step(dt) {
        if (!auto || done) return;
        autoT += dt;
        if (!locked && autoT > 0.6) { setPin(tgt.lat, tgt.lon); const k = model.quarter(tgt.lat, tgt.lon); quadC.set?.(k); if (quad !== k) setQuad(k); dig(); autoT = 0; }
        else if (locked && autoT > 1.2) next();
      },
      frame(dt, time) {
        const k = ctx.calm ? 1 : Math.min(1, dt * 4);
        let d = -face * D - spin; d = Math.atan2(Math.sin(d), Math.cos(d)); spin += d * k; globe.rotation.y = spin;
        pinG.scale.setScalar(1 + (ctx.calm || locked ? 0 : 0.06 * Math.sin(time * 4)));
        if (chest.visible) {
          chestK = Math.min(1, chestK + dt / 0.9); chest.scale.setScalar(0.2 + 1.3 * chestK);
          lid.rotation.x = open ? -1.9 * Math.max(0, chestK * 2 - 1) : 0;
          gold.position.y = 0.2 + (open ? 0.25 * Math.max(0, chestK * 2 - 1) + (ctx.calm ? 0 : 0.03 * Math.sin(time * 5)) : 0);
        }
      },
      autoplay() { auto = true; autoT = 0; },
      dispose() { group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); else if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } }); own.forEach((m) => m.dispose()); },
    };
  },
};
