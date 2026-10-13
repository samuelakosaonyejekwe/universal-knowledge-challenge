# The 3D adventure — how it is built and how to add a world

Every one of the 20 worlds can be explored as a third-person 3D adventure (`#/explore/<world>`). The adventure is
an extra way to learn the *same* lesson: its questions, key ideas and memory hooks come from the lesson pack of the
stage the player has reached, answers are recorded in the same learning records, and credits use the same rules.

## Technical decisions

| Area | Choice | Why |
|---|---|---|
| Renderer | three.js r160 (already in `js/vendor`) | The game already used it for the universe, journey and arena. A second engine (Babylon.js, React Three Fiber) would double the download and split the code for no gain; the app has no React and no build step. |
| Rigid bodies | cannon-es 0.20 (`js/vendor/cannon-es.js`, MIT) | Plain JavaScript, no WebAssembly, 346 kB, works offline and under the page's security policy. Gravity, contacts, friction, hinges, distance links, kinematic platforms. |
| Player movement | Own kinematic controller (`collide.js`, `player.js`) | Predictable, testable without a browser, and tuned for play: coyote time, jump buffering, variable jump height, step-up, moving platforms, ladders, water. |
| Simulation step | Fixed 1/60 s, at most 5 steps per frame | Stable physics on slow and fast screens. |
| Characters | One skinned mesh per character on an 18-bone skeleton, 12 blended clips, two-bone arm IK, head look-at, painted faces with 6 expressions | Generated in code so they match the 2D portraits and need no downloads. They are **not** artist-sculpted models. |
| Quality | Three tiers (low / medium / high) and automatic resolution scaling from measured frame time | Keeps phones responsive; players can also choose. |

**Play physics and science are kept apart.** The player's jump and gravity are tuned for fun (24 m/s², not 9.81).
Pushed objects use real gravity in cannon-es. Each world's *simulation* has its own model and says whether it is a
`validated` model (checked against a known result by `selfTest()`) or a `simplified` one, and what it leaves out.

## Modules (`js/game3d/`)

| File | Responsibility |
|---|---|
| `engine.js` | Renderer, fixed-step loop, adaptive quality, frame statistics |
| `physics.js` | cannon-es world: boxes, balls, static level colliders, kinematic bodies, hinges, tethers |
| `collide.js` | Pure maths: body-versus-level collision, rays for the camera, waypoint route finding (A*) |
| `input.js` | Keyboard, mouse, game controller and touch (thumb stick + buttons) as one input state |
| `rig.js` | Skinned character, animation clips and blending, facial expressions, IK |
| `player.js` | Third-person controller (walk, run, jump, climb, swim) and the follow camera with collision and cut-scenes |
| `npc.js` | Other characters: state machine, waypoint navigation, attention, talking |
| `world.js` | World builder ("kit") and the shared adventure route (`buildCourse`) |
| `hud.js` | Mission list, prompt, subtitles, side panel, pause menu |
| `game.js` | One adventure: mission, crystals, tablets, simulation console, knowledge challenge, portal, saving |
| `worlds/wNN.js` | One file per world: theme, layout, story, scenery and simulation |

`js/views/explore.js` is the page that loads the lesson and starts the game.

## The mission every world shares

1. Meet the guide (the level's teacher) — the story and the stage's opening question.
2. Find five crystals; each opens when its question is answered. Tablets show the stage's key ideas; classmates give hints.
3. Operate the console: the world's own simulation.
4. Knowledge challenge against the level's master: two bridges of light, one piece per right answer, steady or bold.
5. Cross the finished bridge to the portal.

The route is the same shape everywhere (home island → stepping stones → middle island → lagoon → tower and ladder →
lift → simulation island → steps → arena → bridge → portal) so every system works in every world. Each world changes
its colours, sky, light, particles, proportions, scenery, story and simulation.

## A world file

No imports. Everything arrives through arguments, so the file also runs in `node tools/test-game3d.mjs`.

```js
export function selfTest() { return { ok: true, detail: '…numbers…' }; }   // required for kind: 'validated'
export default {
  id: 7,
  theme: { sky: [top, middle, horizon], fog, fogNear, fogFar, ground, ground2, side, stone, accent, glow, metal, wood,
           leaf, water, crate, sun, sunPower, ambient, skyLight, groundLight, sunDir: [x, y, z],
           particles: 'stars' | 'bubbles' | 'leaves' | 'sparks' | 'snow' | 'dust' | 'notes' },
  layout: { mirror: 1 | -1, stones: 3–5, rise: 0.35–0.6, towerH: 4–7, spawnZ: −5 (start point; move it forward if scenery stands behind it) },
  story: { title, crystal (plural noun, lower case), crystalEm, intro: [..], remind, afterCrystals, afterSim,
           notReady, rival: [..], win: [..], lose: [..], outro },
  decorate(k, S) { … },     // scenery only this world has
  sim: { title, goal, kind: 'validated' | 'simplified', model: 'what it includes and leaves out', mount(ctx) { … } },
};
```

All story, sim and label text is written in plain English; the game translates it on the player's device.

### `decorate(k, S)` — the kit

`S` holds the milestones as `[x, y, z]` (y is the ground height there): `S.home`, `S.mid`, `S.far`, `S.sim`,
`S.pad` (centre of the simulation floor — keep 4.5 m around it clear), `S.arena`, `S.end`, plus `S.gap`
`{ x, y, z0, z1 }`. Island radii: home 9.5, mid 6.2, far 6.6, sim 7.4, arena 7, end 4.6. Keep the walking route clear:
the line from each island to the next, the ladder at `(0, S.far[2] + 0.6)`, the console at `(S.sim[0], S.sim[2] − 2.6)`,
the arena centre and the bridge lanes.

- `k.prop(kind, x, y, z, { s, yaw, color, solid })` — `tree, pine, rock, crystal, column, arch, lamp, bush, flower,
  mushroom, tower, house, dome, gear, books, banner, cloud, pillar, ring, statue`.
- `k.mesh(geometry, material, x, y, z, parent?)` → `THREE.Mesh` (casts and receives shadows). `k.THREE` is three.js.
- `k.mat(color, { roughness, metalness, flatShading, … })`, `k.lit(color, power)` (glowing). Materials are cached — reuse them.
- `k.sprite(text, { size })`, `k.glow(color, size, opacity)`, `k.sign(text, x, y, z, { size })`.
- `k.animate((dt, time) => …)` for anything that moves.
- Extra playable pieces (optional): `k.island(x, y, z, r)`, `k.block(x, y, z, w, h, d)` (y = top), `k.mover(a, b, [w, h, d], period)`,
  `k.crate(x, y, z)`, `k.ball(x, y, z)`, `k.pendulum(x, y, z, length)`, `k.gate(x, y, z, { yaw })`.
- Far scenery in the sky should use `fog: false` materials and `castShadow = false`, and stay within 90 m of the route.

Budget: about 60 meshes of scenery per world; share materials; no textures loaded from files.

### `sim.mount(ctx)` — the simulation

Built on the open floor in front of the console. `ctx.group` is a `THREE.Group` at the floor centre; +Z faces the
viewer, +Y is up; use x −3.5…3.5, y 0…5, z −2.5…2.5. The player watches from about 10 m.

`ctx`: `THREE`, `CANNON`, `physics`, `group`, `level` (1–6), `lang` (the language being learnt in World 10, else null),
`band` (age band), `rng`, `calm` (reduced motion), `mat`, `lit`, `sprite`, `glow`, and

- `ctx.ui.slider({ label, min, max, step, value, unit, onInput })` → `{ value, set(v) }`
- `ctx.ui.button(label, onClick, cls?)`, `ctx.ui.choice([[value, label], …], value, onChange)` → `{ value }`
- `ctx.ui.readout(label)` → `{ set(text) }`, `ctx.ui.note(text)`
- `ctx.say(text)` — the guide comments on what happened (explain *why*, not just right/wrong)
- `ctx.complete(score 0…1, note)` — the goal was reached by the player's own choices

`mount` returns `{ step(dt)?, frame(dt, time)?, autoplay(), dispose()? }`. `step` runs at the fixed 1/60 s while the
console is open; `frame` every drawn frame. `autoplay()` sets the controls to a winning choice and starts it — the
tests call it and then step the simulation until `ctx.complete` fires (within 90 simulated seconds).

Rules: at least two controls and one readout; harder goals at higher `ctx.level`; the goal must not complete before
the player acts; give real units and numbers; say what the model leaves out; nothing frightening, violent or unsafe to copy.

## Checks

```
node tools/test-game3d.mjs          # collision, movement, routes; every world builds; every simulation completes; model self-tests
node tools/test-game3d.mjs w07      # one world
```
