// Collision for the player and other walking characters. Pure maths (no rendering, no DOM), so it runs in tests.
//
// The level is a list of "solids":
//   { type: 'box', min: [x, y, z], max: [x, y, z] }      an axis-aligned block
//   { type: 'cyl', x, z, r, y0, y1 }                     an upright cylinder (round islands, pillars)
// A solid may carry `delta: [dx, dy, dz]` (how far it moved this step) so riders are carried along.
// Bodies are upright cylinders: { pos: [x, y, z] (feet), vel: [x, y, z], r, h, grounded, ground }.

export const topOf = (s) => (s.type === 'cyl' ? s.y1 : s.max[1]);
export const bottomOf = (s) => (s.type === 'cyl' ? s.y0 : s.min[1]);

// Does a circle (x, z, r) overlap the solid's footprint?
export function overlaps(s, x, z, r) {
  if (s.type === 'cyl') { const dx = x - s.x, dz = z - s.z, R = s.r + r; return dx * dx + dz * dz < R * R; }
  const cx = Math.max(s.min[0], Math.min(s.max[0], x)), cz = Math.max(s.min[2], Math.min(s.max[2], z));
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// How to push a circle out of the solid sideways: { nx, nz, depth } or null when they do not touch.
export function pushOut(s, x, z, r) {
  if (s.type === 'cyl') {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), R = s.r + r;
    if (d >= R) return null;
    return d > 1e-6 ? { nx: dx / d, nz: dz / d, depth: R - d } : { nx: 1, nz: 0, depth: R };
  }
  const cx = Math.max(s.min[0], Math.min(s.max[0], x)), cz = Math.max(s.min[2], Math.min(s.max[2], z));
  const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); return { nx: dx / d, nz: dz / d, depth: r - d }; }
  // the centre is inside the block: leave by the nearest side
  const opts = [[x - s.min[0], -1, 0], [s.max[0] - x, 1, 0], [z - s.min[2], 0, -1], [s.max[2] - z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
  return { nx: opts[1], nz: opts[2], depth: opts[0] + r };
}

// Moves a body for one time step with landing, head bumps, walls and small steps. Mutates and returns the body.
export function moveBody(b, solids, dt, { step = 0.42 } = {}) {
  const p = b.pos, v = b.vel;
  // carried by the thing it stands on
  if (b.ground?.delta) { p[0] += b.ground.delta[0]; p[1] += b.ground.delta[1]; p[2] += b.ground.delta[2]; }
  const wasGrounded = b.grounded;
  const y0 = p[1];
  let y1 = y0 + v[1] * dt, ground = null;
  for (const s of solids) {
    if (!overlaps(s, p[0], p[2], b.r * 0.8)) continue;
    const T = topOf(s), B = bottomOf(s), rise = s.delta ? Math.abs(s.delta[1]) : 0;
    if (v[1] <= 0 && y0 >= T - 0.06 - rise && y1 <= T) { y1 = T; ground = s; }
    else if (v[1] > 0 && y0 + b.h <= B + 0.02 + rise && y1 + b.h > B) { y1 = B - b.h; v[1] = 0; }
  }
  if (ground) v[1] = 0;
  p[1] = y1;
  p[0] += v[0] * dt; p[2] += v[2] * dt;
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) {
      const T = topOf(s), B = bottomOf(s);
      if (p[1] >= T - 1e-3 || p[1] + b.h <= B) continue;
      const hit = pushOut(s, p[0], p[2], b.r);
      if (!hit) continue;
      if ((ground || wasGrounded) && v[1] <= 0 && T - p[1] <= step) { p[1] = T; ground = s; continue; }   // a small step up
      p[0] += hit.nx * hit.depth; p[2] += hit.nz * hit.depth;
      b.wall = s;
    }
  }
  b.grounded = !!ground; b.ground = ground;
  return b;
}

// The height of the highest solid top at or below `y` under the point (x, z); -Infinity when there is none.
export function groundBelow(solids, x, y, z, r = 0.05) {
  let best = -Infinity;
  for (const s of solids) { const T = topOf(s); if (T <= y + 0.01 && T > best && overlaps(s, x, z, r)) best = T; }
  return best;
}

// Where a ray first meets a solid (cylinders are treated as their bounding block). Returns the distance or Infinity.
export function rayHit(s, o, d, maxT) {
  const min = s.type === 'cyl' ? [s.x - s.r, s.y0, s.z - s.r] : s.min, max = s.type === 'cyl' ? [s.x + s.r, s.y1, s.z + s.r] : s.max;
  let t0 = 0, t1 = maxT;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < min[i] || o[i] > max[i]) return Infinity; continue; }
    let a = (min[i] - o[i]) / d[i], b = (max[i] - o[i]) / d[i];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return Infinity;
  }
  return t0;
}
export function rayCast(solids, o, d, maxT) {
  let best = Infinity;
  for (const s of solids) { const t = rayHit(s, o, d, maxT); if (t < best) best = t; }
  return best;
}

// Is the point inside a zone { min, max }?
export const inZone = (z, x, y, zz) => x >= z.min[0] && x <= z.max[0] && y >= z.min[1] && y <= z.max[1] && zz >= z.min[2] && zz <= z.max[2];

// Shortest route over a graph of waypoints (A*). nodes: [[x, y, z], …]; links: [[a, b], …]. Returns node indices.
export function route(nodes, links, from, to) {
  const next = nodes.map(() => []);
  for (const [a, b] of links) { next[a].push(b); next[b].push(a); }
  const dist = (a, b) => Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1], nodes[a][2] - nodes[b][2]);
  const g = new Map([[from, 0]]), came = new Map(), open = new Set([from]);
  while (open.size) {
    let cur = null, bestF = Infinity;
    for (const n of open) { const f = g.get(n) + dist(n, to); if (f < bestF) { bestF = f; cur = n; } }
    if (cur === to) { const path = [cur]; while (came.has(cur)) { cur = came.get(cur); path.unshift(cur); } return path; }
    open.delete(cur);
    for (const n of next[cur]) { const cost = g.get(cur) + dist(cur, n); if (cost < (g.get(n) ?? Infinity)) { g.set(n, cost); came.set(n, cur); open.add(n); } }
  }
  return [];
}
export const nearestNode = (nodes, x, y, z) => nodes.reduce((best, n, i) => { const d = Math.hypot(n[0] - x, n[1] - y, n[2] - z); return d < best[1] ? [i, d] : best; }, [0, Infinity])[0];
