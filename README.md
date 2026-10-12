# The Universal Knowledge Challenge

A learning adventure across 20 worlds of knowledge for children and young people. Players learn with a teacher,
experiment in virtual labs, and then prove their understanding against each level's master.

It is a static, installable web app: no build step, no server, no accounts on anyone's machine. It runs in any
modern browser on computers, Android and iOS, installs to the home screen, and works in airplane mode.

## What is inside

| | |
|---|---|
| Worlds | 20 (Physics & Astronomy … Philosophy & Ethics), each with its own colours, soundtrack, credits and cast |
| Structure | 6 levels × 10 stages per world = 1,200 stages; World Languages has 12 separate language paths |
| Each stage | Discover → Understand → Remember → Recall → Experiment → Apply → Explain → Master Duel → College of Doctors |
| Each level final | Championship duel → teach a beginner → aptitude test |
| 3D | A WebGL universe of the 20 worlds to fly around, a 3D journey mountain per level, 3D characters and a 3D duel arena (three.js, bundled; switchable in Settings) |
| Labs | 60 interactive labs, virtual trips and studios (3 per world), each stating what its model leaves out |
| Languages | Interface in English, French, Spanish, Arabic, Russian, Hebrew, Italian, Greek, Turkish, Portuguese, Chinese, Japanese |
| Live knowledge | Fetched by the player's own browser from open sources, cached for offline use |

## Play it locally

```
node tools/serve.mjs 8080      # then open http://localhost:8080
```

Any static file server works. Opening `index.html` straight from disk does not (browsers block modules on `file:`).

## Layout

```
index.html, manifest.webmanifest, sw.js, precache.js, mirrors.json
css/app.css
js/app.js                 shell, routing, install, wellbeing timers
js/core/                  storage, safety, languages, audio, speech, avatars, names, live sources, spaced review
js/engine/                lesson loading, question marking, duel, aptitude, evaluation
js/views/                 screens
js/gfx/                   3D scenes (universe, journey mountain, duel arena) and the 3D toolkit
js/labs/                  one module per lab (see tools/LABS.md)
js/vendor/, models/       speech runtime and open speech models for on-device recognition (see models/NOTICE.txt)
js/data/                  worlds, curriculum titles, aspects atlas
content/wNN/lK.json       lesson packs (see tools/CONTENT.md)
i18n/<code>.json          interface translations
tools/                    validators, generators, local server
```

## Maintaining it

```
node tools/validate.mjs            # check every lesson pack against the format
node tools/options.mjs stat content/w06   # check for give-away answer options
node tools/build-index.mjs         # after adding labs, changing interface text, or editing any shipped file
node tools/check-i18n.mjs          # check interface translations are complete
node tools/review.mjs wiki content/w06    # check encyclopedia titles exist
node tools/norms.mjs <folder>      # build age-band norms from pooled anonymous puzzle results
```

`build-index.mjs` regenerates the lab catalogue, the list of interface strings and `precache.js` (whose version
string tells installed copies that an update is ready). Run it before every release.

## Hosting and redundancy

The whole folder is the site. Publish it on any static host; the same files can be served from several hosts at once.

- Installed copies keep working with no host at all: the service worker serves everything from the device and
  refreshes in the background when a host is reachable.
- `mirrors.json` lists alternative base URLs. If the main host is down and a file is not yet saved on the device,
  the service worker fetches it from a mirror.
- Live material (encyclopedia entries, courses, research, data feeds) is requested by each player's browser directly
  from the source, so freshness never depends on the publisher's computer being switched on.

## What is checked, and what still needs people

- **Content.** Every lesson set (31 sets: 19 worlds and 12 language paths) has had an independent second check:
  calculated answers recomputed by program, chess positions verified with a chess library and endgame tablebases,
  sound items computed from their notes, and every encyclopedia title confirmed to exist. The records — every
  correction made and every specific claim left for a human specialist — are in `content/_review/`. This is a
  machine second check, not peer review by subject specialists or native-speaking teachers; use the
  `needsSpecialist` lists as the starting agenda for that review, especially for medicine, nuclear engineering,
  history and the language paths.
- **Browsers.** The full play-through is exercised automatically in Chromium (Chrome, Edge, Android), WebKit
  (Safari, iPhone and iPad profiles) and Firefox, and sound output is measured in all three. Real devices differ, so
  *Settings → Check this device* reports what actually works on the device in hand.
- **Speech.** With the voice pack (Settings), spoken answers are recognised on the device in all 12 languages, in any
  modern browser, offline. Without it the browser's own recogniser is used where one exists, and every spoken task
  can be typed.
- **Languages.** The interface ships in 12 languages. Lesson packs are authored in English; a level can be prepared in
  the player's language with one tap and is then kept for offline use. Human-checked translations placed in
  `content/_tr/<lang>/wNN/lK.json` are used automatically (run `node tools/build-index.mjs` after adding any).
- **No server.** Accounts, consent, permissions and progress live on the device. Guardians can add the device's own
  fingerprint/face/screen lock to their PIN. Schools can create class packs (teacher-managed student players) and
  collect progress files; friends can play live device-to-device duels. None of this can prove a person's identity:
  organisations that need verified ages should use managed devices or their own verified sign-on.
- **The reasoning estimate** is an indication from in-game puzzles. It becomes a normed score only when pooled,
  anonymous results from at least 100 players of an age band are built into `js/data/norms.json` with
  `node tools/norms.mjs <folder>`. It is never an IQ test or a diagnosis.
- **The soundtrack** is designed to be calm, with an optional soft two-ear 10 Hz tone for headphones. Research on such
  tones is mixed; the game claims no effect on the brain.
- **Hosting.** Installed copies need no host. Lesson and lab files fall back to the mirrors in `mirrors.json`, which
  also lists other addresses that serve the whole game.
