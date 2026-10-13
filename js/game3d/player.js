// The third-person character controller: walking, running, jumping, climbing and swimming, with gravity,
// landing, walls, small steps and moving platforms. Used by the player and (with a simpler brain) by other characters.
// The movement feel is tuned for play (snappy jumps); it is not a measurement of real gravity.
import { THREE } from '../gfx/kit3d.js';
import { moveBody, inZone, topOf, groundBelow } from './collide.js';

export const FEEL = { walk: 3.3, run: 6.4, accel: 38, airAccel: 14, gravity: 24, jump: 9.2, climb: 2.6, swim: 2.7, coyote: 0.12, buffer: 0.14, turn: 13 };

// level: { solids, zones (type 'climb' | 'water'), killY }. Returns the controller.
export function createController(rig, level, { r = 0.3, h = 1.5 } = {}) {
  const body = { pos: [0, 0, 0], vel: [0, 0, 0], r, h, grounded: false, ground: null };
  const c = {
    rig, body, yaw: 0, mode: 'air', safe: [0, 0, 0], frozen: false, onLand: null, onJump: null, onRespawn: null, zone: null,
    get pos() { return body.pos; },
    place(x, y, z, yaw = c.yaw) { body.pos = [x, y, z]; body.vel = [0, 0, 0]; body.ground = null; c.yaw = yaw; c.safe = [x, y, z]; c.mode = 'air'; sync(0); },
    // input: { move: {x, y}, run, jump, jumpPressed }; camYaw: the direction the camera looks along.
    update(dt, input, camYaw = 0) {
      const p = body.pos, v = body.vel, mv = c.frozen ? { x: 0, y: 0 } : input.move;
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);                      // camera forward on the ground
      let wx = fx * mv.y + -fz * mv.x, wz = fz * mv.y + fx * mv.x;               // wanted direction in the world
      const wantLen = Math.min(1, Math.hypot(wx, wz));
      coyote = body.grounded ? FEEL.coyote : coyote - dt;
      buffer = !c.frozen && input.jumpPressed ? FEEL.buffer : buffer - dt;
      const water = level.zones.find((z) => z.type === 'water' && inZone(z, p[0], p[1] + 0.95, p[2]));
      const ladder = level.zones.find((z) => z.type === 'climb' && inZone(z, p[0], p[1] + 0.6, p[2]));

      if (c.mode === 'climb') {
        if (!ladder) c.mode = 'air';
        else {
          v[0] = v[1] = v[2] = 0;
          p[0] += (ladder.at[0] - p[0]) * Math.min(1, dt * 10); p[2] += (ladder.at[1] - p[2]) * Math.min(1, dt * 10);
          p[1] += mv.y * FEEL.climb * dt; c.yaw = ladder.face; rig.speed = Math.abs(mv.y) > 0.1 ? 1.2 * Math.sign(mv.y) : 0;
          if (p[1] >= ladder.topY) { p[0] = ladder.out[0]; p[1] = ladder.topY + 0.02; p[2] = ladder.out[1]; c.mode = 'air'; }   // step off at the top
          else if (p[1] <= ladder.baseY) { p[1] = ladder.baseY; if (mv.y < -0.2) c.mode = 'air'; }
          else if (buffer > 0) { buffer = 0; c.mode = 'air'; v[0] = -Math.sin(ladder.face) * 3; v[2] = -Math.cos(ladder.face) * 3; v[1] = 4; }
          if (c.mode === 'climb') { sync(dt); return; }
        }
      }
      if (ladder && c.mode !== 'swim' && mv.y > 0.3 && Math.abs(angle(Math.atan2(wx, wz) - ladder.face)) < 1.2) { c.mode = 'climb'; body.grounded = false; body.ground = null; sync(dt); return; }

      if (water) {
        // swimming: float with the chest at the surface, glide more slowly, and climb out at an edge
        c.mode = 'swim';
        const surface = water.max[1], want = surface - 1.02;
        v[1] += ((want - p[1]) * 18 - v[1] * 6) * dt;
        v[0] += (wx * FEEL.swim - v[0]) * Math.min(1, dt * 4); v[2] += (wz * FEEL.swim - v[2]) * Math.min(1, dt * 4);
        if (wantLen > 0.05) c.yaw = turn(c.yaw, Math.atan2(wx, wz), FEEL.turn * 0.5 * dt);
        body.grounded = false; body.wall = null;
        moveBody(body, level.solids, dt, { step: 0 });
        if (body.wall && wantLen > 0.2 && topOf(body.wall) - p[1] < 1.7 && topOf(body.wall) > p[1]) {      // pull up onto the bank
          const T = topOf(body.wall); p[1] = T + 0.02; p[0] += wx / (wantLen || 1) * 0.5; p[2] += wz / (wantLen || 1) * 0.5; v[1] = 0; c.mode = 'air';
        } else if (buffer > 0 && p[1] > want - 0.25) { buffer = 0; v[1] = FEEL.jump * 0.9; p[1] = surface - 0.9; c.mode = 'air'; c.onJump?.(); }
        rig.speed = 0.6 + Math.hypot(v[0], v[2]) / FEEL.swim;
        sync(dt); return;
      }

      const top = (input.run && !c.frozen ? FEEL.run : FEEL.walk) * wantLen;
      const acc = (body.grounded ? FEEL.accel : FEEL.airAccel) * dt;
      const tx = wantLen ? (wx / wantLen) * top : 0, tz = wantLen ? (wz / wantLen) * top : 0;
      const dx = tx - v[0], dz = tz - v[2], dl = Math.hypot(dx, dz);
      if (dl <= acc) { v[0] = tx; v[2] = tz; } else { v[0] += (dx / dl) * acc; v[2] += (dz / dl) * acc; }
      if (wantLen > 0.05) c.yaw = turn(c.yaw, Math.atan2(wx, wz), FEEL.turn * dt);
      if (buffer > 0 && coyote > 0) { v[1] = FEEL.jump; buffer = 0; coyote = 0; body.grounded = false; body.ground = null; c.onJump?.(); }
      if (v[1] > 0 && !input.jump && !c.frozen) v[1] -= FEEL.gravity * 1.2 * dt;        // let go early for a shorter jump
      v[1] = Math.max(-30, v[1] - FEEL.gravity * dt);
      const wasAir = !body.grounded, fallSpeed = v[1];
      moveBody(body, level.solids, dt);
      if (body.grounded) {
        if (wasAir && fallSpeed < -4) c.onLand?.(fallSpeed);
        c.mode = 'ground';
        if (!body.ground.moving && !body.ground.dynamic) c.safe = [p[0], p[1], p[2]];
      } else c.mode = 'air';
      if (p[1] < level.killY) { c.place(c.safe[0], c.safe[1] + 0.3, c.safe[2]); c.onRespawn?.(); }
      sync(dt);
    },
  };
  let coyote = 0, buffer = 0;
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const turn = (from, to, max) => { const d = angle(to - from); return from + Math.max(-max, Math.min(max, d)); };
  function sync(dt) {
    const p = body.pos, v = body.vel, g = rig.group, sp = Math.hypot(v[0], v[2]);
    g.position.set(p[0], p[1], p[2]); g.rotation.y = c.yaw;
    if (c.mode === 'climb') rig.play('climb', 0.12);
    else if (c.mode === 'swim') rig.play('swim', 0.25);
    else if (c.mode === 'air') { if (body.vel[1] > 1 || body.vel[1] < -2.5) rig.play(v[1] > 0 ? 'jump' : 'fall', 0.1); }
    else if (sp > FEEL.walk + 0.6) { rig.play('run', 0.15); rig.speed = sp / FEEL.run; }
    else if (sp > 0.25) { rig.play('walk', 0.15); rig.speed = Math.max(0.5, sp / FEEL.walk); }
    else if (!c.pose) rig.play('idle', 0.2); else rig.play(c.pose, 0.25);
    rig.update(dt);
  }
  return c;
}

// ---------- the camera that follows the player ----------
import { rayCast } from './collide.js';
export function createFollowCamera(camera, level, { dist = 6.2, minDist = 2.4, maxDist = 12, pitch = 0.32, yaw = Math.PI } = {}) {
  const st = { yaw, pitch, dist, want: dist, target: new THREE.Vector3(), shake: 0, calm: false };
  let shot = null;       // a cinematic move: { from, to, lookFrom, lookTo, t, dur, hold, done }
  const look = new THREE.Vector3(), pos = new THREE.Vector3();
  const ease = (t) => t * t * (3 - 2 * t);
  return {
    state: st,
    // A cinematic shot: glide to `pos` looking at `at`, hold, then hand back to the player (or stay with hold = Infinity).
    cut(to, at, { dur = 1.2, hold = 0, done } = {}) { shot = { from: camera.position.clone(), to: to.clone(), lookFrom: look.clone(), lookTo: at.clone(), t: 0, dur: st.calm ? 0.01 : dur, hold, done }; },
    release() { shot = null; },
    get busy() { return !!shot; },
    update(dt, targetPos, lookInput) {
      st.yaw -= lookInput.x; st.pitch = Math.max(-0.35, Math.min(1.25, st.pitch + lookInput.y));
      st.want = Math.max(minDist, Math.min(maxDist, st.want + lookInput.zoom));
      st.target.lerp(v.set(targetPos[0], targetPos[1] + 1.25, targetPos[2]), st.calm ? 1 : Math.min(1, dt * 12));
      if (shot) {
        shot.t += dt; const k = ease(Math.min(1, shot.t / shot.dur));
        camera.position.lerpVectors(shot.from, shot.to, k); look.lerpVectors(shot.lookFrom, shot.lookTo, k); camera.lookAt(look);
        if (shot.t >= shot.dur + shot.hold) { const d = shot.done; shot = null; d?.(); }
        return;
      }
      const cp = Math.cos(st.pitch), dir = [cp * Math.sin(st.yaw), Math.sin(st.pitch), cp * Math.cos(st.yaw)];
      // keep the view clear: pull the camera in front of anything between it and the player
      const hit = rayCast(level.solids, [st.target.x, st.target.y, st.target.z], dir, st.want + 0.4);
      const free = Math.max(0.9, Math.min(st.want, hit - 0.35));
      st.dist += (free - st.dist) * Math.min(1, dt * (free < st.dist ? 20 : 4));
      pos.set(st.target.x + dir[0] * st.dist, st.target.y + dir[1] * st.dist, st.target.z + dir[2] * st.dist);
      if (st.shake > 0 && !st.calm) { st.shake = Math.max(0, st.shake - dt * 2.5); pos.x += (Math.random() - 0.5) * st.shake * 0.25; pos.y += (Math.random() - 0.5) * st.shake * 0.25; }
      camera.position.copy(pos); look.copy(st.target); camera.lookAt(look);
    },
  };
}
const v = new THREE.Vector3();
