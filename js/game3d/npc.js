// Other characters in the world: guides, classmates and rivals. Each has a small state machine
// (wait → walk → wait, attend to the player when near, talk) and finds its way over the level's waypoints.
// Nothing here needs a network connection or an AI service.
import { THREE } from '../gfx/kit3d.js';
import { route, groundBelow } from './collide.js';

// opts: { nodes: [indices it may visit], at: [x, y, z], speed, wander (bool), name, role, lines }
export function createNpc(rig, level, opts = {}) {
  const pos = [...(opts.at || level.nodes[opts.nodes?.[0] ?? 0] || [0, 0, 0])];
  const n = {
    rig, pos, yaw: opts.yaw ?? 0, state: 'wait', name: opts.name || '', role: opts.role || 'peer', lines: opts.lines || [], wander: opts.wander !== false && (opts.nodes?.length || 0) > 1,
    timer: 1 + Math.random() * 3, path: [], here: opts.nodes?.[0] ?? -1, busy: false, mood: 'neutral', pose: null,
    // Walk to a waypoint by the shortest route.
    goTo(node) { if (n.here < 0) return; const p = route(level.nodes, level.links, n.here, node); if (p.length > 1) { n.path = p.slice(1); n.state = 'walk'; } },
    // Stand at a place (used for races and cut-scenes).
    place(x, y, z, yaw = n.yaw) { pos[0] = x; pos[1] = y; pos[2] = z; n.yaw = yaw; n.state = 'hold'; n.path = []; },
    release() { n.state = 'wait'; n.timer = 1; },
    update(dt, player, talkingTo) {
      const dx = player[0] - pos[0], dz = player[2] - pos[2], d = Math.hypot(dx, dz), near = d < 4.2 && Math.abs(player[1] - pos[1]) < 2.5;
      const talking = talkingTo === n;
      let moving = false;
      if (talking) { face(Math.atan2(dx, dz), dt * 8); }
      else if (n.state === 'hold') { /* placed by the game */ }
      else if (near) { face(Math.atan2(dx, dz), dt * 5); }                                   // attend: turn to the player
      else if (n.state === 'walk' && n.path.length) {
        const t = level.nodes[n.path[0]], tx = t[0] - pos[0], tz = t[2] - pos[2], td = Math.hypot(tx, tz), sp = opts.speed || 1.5;
        if (td < 0.15) { n.here = n.path.shift(); if (!n.path.length) { n.state = 'wait'; n.timer = 2 + Math.random() * 5; } }
        else { pos[0] += (tx / td) * sp * dt; pos[2] += (tz / td) * sp * dt; face(Math.atan2(tx, tz), dt * 6); moving = true; rig.speed = sp / 3.3 * 1.6; }
        const gy = groundBelow(level.solids, pos[0], pos[1] + 1, pos[2]); if (gy > -1e6) pos[1] += (gy - pos[1]) * Math.min(1, dt * 12);
      } else if (n.wander) { n.timer -= dt; if (n.timer <= 0) { const pick = opts.nodes[Math.floor(Math.random() * opts.nodes.length)]; if (pick !== n.here) n.goTo(pick); else n.timer = 1.5; } }
      rig.group.position.set(pos[0], pos[1], pos[2]); rig.group.rotation.y = n.yaw;
      rig.play(talking ? 'talk' : moving ? 'walk' : n.pose || 'idle', 0.25);
      rig.say(talking && n.speaking);
      rig.setFace(talking || near ? (n.mood === 'neutral' ? 'neutral' : n.mood) : n.mood);
      if (near || talking) rig.lookAt(look.set(player[0], player[1] + 1.35, player[2])); else rig.lookAt(null);
      rig.update(dt);
      n.near = near; n.dist = d;
    },
  };
  const look = new THREE.Vector3();
  const face = (to, k) => { const d = Math.atan2(Math.sin(to - n.yaw), Math.cos(to - n.yaw)); n.yaw += d * Math.min(1, k); };
  rig.group.position.set(pos[0], pos[1], pos[2]);
  return n;
}
