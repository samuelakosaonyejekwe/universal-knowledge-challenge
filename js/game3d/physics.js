// Rigid-body physics (cannon-es): gravity, contacts, friction, joints and moving platforms, at a fixed time step.
// The walking characters use their own controller (collide.js); this world is for the objects they push and use.
import * as CANNON from '../vendor/cannon-es.js';

export { CANNON };
export const STEP = 1 / 60;

export function createPhysics({ gravity = -9.81 } = {}) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, gravity, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = 8;
  const ground = new CANNON.Material('ground'), object = new CANNON.Material('object');
  world.addContactMaterial(new CANNON.ContactMaterial(ground, object, { friction: 0.45, restitution: 0.15 }));
  world.addContactMaterial(new CANNON.ContactMaterial(object, object, { friction: 0.35, restitution: 0.2 }));
  world.defaultContactMaterial.friction = 0.3;
  const pairs = [];   // { body, mesh }

  const api = {
    world, CANNON, materials: { ground, object },
    // A fixed collider for a level solid (see collide.js).
    addSolid(s) {
      const body = new CANNON.Body({ type: s.moving ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC, material: ground });
      if (s.type === 'cyl') { body.addShape(new CANNON.Cylinder(s.r, s.r, s.y1 - s.y0, 14)); body.position.set(s.x, (s.y0 + s.y1) / 2, s.z); }
      else { body.addShape(new CANNON.Box(new CANNON.Vec3((s.max[0] - s.min[0]) / 2, (s.max[1] - s.min[1]) / 2, (s.max[2] - s.min[2]) / 2))); body.position.set((s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2); }
      world.addBody(body); s.body = body;
      return body;
    },
    box(mesh, size, pos, { mass = 1, friction } = {}) {
      const body = new CANNON.Body({ mass, material: object, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), linearDamping: 0.05, angularDamping: 0.25 });
      body.position.set(...pos); if (friction != null) body.material = new CANNON.Material({ friction });
      world.addBody(body); if (mesh) pairs.push({ body, mesh });
      return body;
    },
    ball(mesh, radius, pos, { mass = 1 } = {}) {
      const body = new CANNON.Body({ mass, material: object, shape: new CANNON.Sphere(radius), linearDamping: 0.05, angularDamping: 0.2 });
      body.position.set(...pos); world.addBody(body); if (mesh) pairs.push({ body, mesh });
      return body;
    },
    // A body the game moves by hand (the player's "bumper", lifts). It pushes dynamic bodies but is not pushed.
    kinematic(shape, pos) {
      const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: object, shape });
      body.position.set(...pos); world.addBody(body);
      return body;
    },
    // A door or lever turning about an axis through `pivot` (world space) on `body`.
    hinge(body, pivot, axis = [0, 1, 0], { anchor = null } = {}) {
      const base = anchor || new CANNON.Body({ type: CANNON.Body.STATIC });
      if (!anchor) { base.position.set(...pivot); world.addBody(base); }
      const local = new CANNON.Vec3(pivot[0] - body.position.x, pivot[1] - body.position.y, pivot[2] - body.position.z);
      const c = new CANNON.HingeConstraint(base, body, { pivotA: anchor ? new CANNON.Vec3(pivot[0] - base.position.x, pivot[1] - base.position.y, pivot[2] - base.position.z) : new CANNON.Vec3(), axisA: new CANNON.Vec3(...axis), pivotB: local, axisB: new CANNON.Vec3(...axis) });
      world.addConstraint(c);
      return c;
    },
    // A rope-like link that keeps a body a fixed distance from a point (pendulums, hanging signs).
    tether(body, point, length) {
      const base = new CANNON.Body({ type: CANNON.Body.STATIC }); base.position.set(...point); world.addBody(base);
      const c = new CANNON.DistanceConstraint(base, body, length); world.addConstraint(c);
      return c;
    },
    track(body, mesh) { pairs.push({ body, mesh }); },
    remove(body) { world.removeBody(body); const i = pairs.findIndex((p) => p.body === body); if (i >= 0) pairs.splice(i, 1); },
    step() { world.step(STEP); },
    // Copies body positions to their pictures; `alpha` blends between the last two steps for smooth drawing.
    sync() { for (const { body, mesh } of pairs) { mesh.position.set(body.position.x, body.position.y, body.position.z); mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w); } },
    bodies: () => world.bodies.length,
  };
  return api;
}
