# Virtual lab contract

A lab is one ES module in `js/labs/` named `wNN-<slug>.js` that default-exports:

```js
import { h, slider, readout, button, choice, canvas, loop, predict, fmt, pointer } from '../core/labkit.js';

export default {
  id: 'w01-orbit',            // same as the file name without .js
  world: 1,                   // 1–20
  levels: [3, 4, 5, 6],       // which of the six levels this lab suits
  kind: 'lab',                // 'lab' (experiment/simulation) or 'tour' (virtual trip/exploration) or 'studio' (creative tool)
  icon: '🪐',
  title: 'Orbit Lab',
  goal: 'Give the satellite the right sideways speed for a circular orbit.',   // the mission, one sentence
  limits: 'Two bodies, Newtonian gravity, no air drag. Real orbits are also nudged by the Moon, the Sun and Earth\'s bulge.',
  mount(root, api) { /* build UI inside root */ return () => { /* stop loops, remove listeners */ }; },
};
```

`api` passed to `mount`:

- `api.level` — the learner's level 1–6 (scale difficulty and wording to it; level 1 is ages ~5–7)
- `api.rng()` — seeded random 0–1 (use it instead of `Math.random()` so missions vary between visits)
- `api.say(text)` — the teacher says something (speech bubble + optional voice)
- `api.complete(score, note)` — call when the mission is achieved; `score` 0–1, `note` a short sentence on what was shown.
  Call it once per achieved mission; the learner may keep exploring afterwards.
- `api.reducedMotion` — true if animations should be minimal
- `api.t(text)` — returns the text translated to the learner's language when available (synchronous; may return the input)

Rules:

- Pure browser JavaScript, no external libraries, no network requests, no images — draw with canvas or DOM/SVG/emoji.
- Use the labkit helpers and existing CSS classes (`lab`, `lab-row`, `lab-ctl`, `lab-canvas`, `readout`, `lab-goal`,
  `btn`, `btn sm`, `btn ghost`, `chip`, `note`, `card`, `row`, `grid c2`, `small`, `muted`). Inline styles are fine for specifics.
- Must work with touch and mouse (pointer events) and at 320 px width. Buttons and sliders need text labels.
- The model must be credible: use the real equation, SI units, and say what is simplified in `limits`.
- Every lab has an interactive mission with a checkable success condition, and lets the learner predict before they test.
- Module top level must not touch `document` or `window` (the module is also imported by Node for indexing);
  do all DOM work inside `mount`. `mount` must return a cleanup function.
- Child-safe: nothing frightening, no violence. Medicine labs are fictional cases; nuclear labs are conceptual and safety-oriented.
- Keep each lab focused: roughly 120–260 lines.

Check syntax with `node --check js/labs/<file>.js` and that it loads with
`node -e "import('./js/labs/<file>.js').then(m=>console.log(m.default.id, m.default.levels))"`.
