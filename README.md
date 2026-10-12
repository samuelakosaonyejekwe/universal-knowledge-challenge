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
js/labs/                  one module per lab (see tools/LABS.md)
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

## Honest limits

- **No server.** Age assurance, guardian consent and permissions are enforced on the device. They are layered and
  safe by default (no open chat, no public profiles, no contact with strangers), but they cannot prove identity.
  Organisations that need verified ages should deploy on managed devices or add their own verified sign-on.
- **Progress lives on the device.** Use *Settings → Export my player* to move to another device.
- **Lesson translation** uses the browser's on-device translator where one exists, otherwise an online service with a
  daily allowance, otherwise English. The interface itself is fully translated.
- **Speech recognition** is provided by the browser; where it is missing every spoken task can be typed.
- **Content review.** Lessons and answer keys were written to be accurate and are checked for format, but they have
  not yet been reviewed by subject specialists or native-speaking language teachers. Treat that review as required
  before formal classroom use — especially for medicine, nuclear engineering, history and the language paths.
- **The reasoning estimate** is an un-normed indication from in-game puzzles, not an IQ test.
- **The soundtrack** is designed to be calm; it is not a medical or neurological intervention.
