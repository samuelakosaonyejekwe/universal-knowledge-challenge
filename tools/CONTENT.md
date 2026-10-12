# Content pack format

Every world keeps its lessons in `content/wNN/lK.json` (world `NN` = 01–20, level `K` = 1–6).
Stage titles come from `js/data/curriculum.json` (`curriculum[world-1][level-1][stage-1]`); stages 1–9 are
learning stages, stage 10 is the level's Master Duel and needs no authored file content (it draws from stages 1–9).

Run `node tools/validate.mjs content/wNN` after every file you write. It must print `OK`.

## Level file

```json
{ "world": 1, "level": 2, "stages": [ /* exactly 9 stage objects, n = 1..9 */ ] }
```

## Stage object

| field | required | meaning |
|---|---|---|
| `n` | yes | 1–9 |
| `title` | yes | exactly the curriculum title for this stage |
| `icon` | yes | one emoji for the map node |
| `hook` | yes | a curiosity question the learner investigates **before** any explanation (1–2 sentences) |
| `explain` | yes | 2–4 short paragraphs (array of strings). The teacher's explanation: what it is, **why** it works, how it connects to earlier stages |
| `example` | yes | `{ "q": problem, "steps": [2–5 reasoning steps], "a": final answer }` — a worked example |
| `analogies` | yes | object with **at least 3** of these keys: `home`, `city`, `farm`, `sport`, `sea`, `music`, `nature`, `tech`. Each value explains the same idea through that everyday setting (1–2 sentences) |
| `mnemonic` | yes | a memory hook: image, rhyme, acronym or story (1–2 sentences) |
| `terms` | yes | 3–5 `[term, plain definition]` pairs |
| `misc` | yes | `{ "wrong": a common misconception, "right": the correction }` |
| `limits` | when relevant | what the model/simplification leaves out, or where scholars disagree (1–2 sentences) |
| `trip` | yes | `{ "wiki": "English Wikipedia article title", "prompt": "what to look for on this virtual trip" }` |
| `sources` | yes | 1–3 English Wikipedia article titles that back the stage |
| `questions` | yes | exactly 10 question items (see below) |
| `panel` | yes | exactly 3 nuanced question items for the College of Doctors: `k` must be `"reason"`, type `mc` or `text` |
| `teach` | yes | `{ "topic": what the learner must teach a complete beginner, "model": a plain-language model explanation (2–4 sentences), "points": [3–5 of { "k": [keywords], "ask": follow-up question the beginner asks if that point is missing }] }` |

## Question items

Common fields: `t` (type), `q` (question), `why` (1–2 sentence explanation of the correct reasoning — shown as
feedback), `d` (difficulty 1–3), `k` (`recall` · `concept` · `apply` · `reason`).

| `t` | extra fields |
|---|---|
| `mc` | `o`: 3–4 options (strings, all distinct), `a`: index of the correct option. Options are shuffled at run time, so never write "all of the above" or refer to option positions |
| `num` | `a`: number, `tol`: absolute tolerance (≥ 0), `unit`: optional unit string. State needed constants and rounding in `q` |
| `text` | `rubric`: 2–5 keyword groups (each an array of lowercase words/stems, any of which counts), `min`: groups needed for credit, `model`: model answer |
| `order` | `items`: 3–6 strings **in the correct order** |
| `match` | `pairs`: 3–5 `[left, right]` pairs (all lefts distinct, all rights distinct) |

Optional on any item: `au` — `{ "notes": [60, 64, [60, 64, 67]], "dur": 0.5 }` plays MIDI notes/chords (music), or
`{ "rhythm": [1, 0.5, 0.5, 1] }` plays a clapped rhythm in beats; `fen` — a chess position (FEN string) drawn above the question.

Per stage: at least 5 `mc`; at least one of `num`/`order`/`match`; from level 2 upward at least one `text`;
at least 3 items with `k` of `apply` or `reason`; a spread of difficulty.

## Rules for every word of content

- **Accuracy first.** Every question has one defensible key (or an explicit rubric). Use SI units, state assumptions
  and tolerances, and keep numbers consistent between `q`, `a` and `why`. Do not invent facts, dates, quotations or citations.
- **Understanding over memorising.** Ask *why* and *what would happen if*, not only *what is it called*.
- **Level voice.** L1 ≈ ages 5–7 (very short sentences, concrete things, no jargon); L2 ≈ 8–10; L3 ≈ 11–13;
  L4 ≈ 14–16; L5 ≈ 17–18; L6 = first-year university. Levels are proficiency bands, so never mention ages.
- **Child-safe.** No sexual content, no strong language, no graphic violence, nothing frightening. Hard history
  (war, slavery, genocide) is told factually, briefly and with dignity. Medical content is fictional-case based,
  never personal advice. Nuclear content is conceptual and safety-oriented.
- **Fair and global.** Examples, names and settings from every continent; no stereotypes; no civilisation, culture,
  religion, gender or group presented as superior. Contested questions are presented as contested.
- **Plain text only.** No HTML or Markdown. Unicode maths is fine (×, ÷, ², √, π, →).
- Keep it tight: about 3.5–4.5 KB of JSON per stage.

## World 10 (languages)

Each language has its own path: `content/w10/<code>/lK.json` with `code` ∈ en es fr ar ru he it el tr pt zh ja.

```json
{ "world": 10, "lang": "es", "level": 1, "stages": [ {
  "n": 3, "title": "Greetings and introductions", "icon": "👋",
  "hook": "…", "explain": ["…", "…"], "mnemonic": "…",
  "items": [ ["Hello", "Hola", ""], ["Good morning", "Buenos días", ""] ],
  "sentences": [ ["My name is Ana.", ["Me", "llamo", "Ana"]] ],
  "gq": [ { "t": "mc", "q": "…", "o": ["…"], "a": 0, "why": "…", "d": 1, "k": "concept" } ],
  "panel": [ /* 3 items, as above */ ],
  "teach": { "topic": "…", "model": "…", "points": [ { "k": ["…"], "ask": "…" } ] },
  "trip": { "wiki": "…", "prompt": "…" }, "sources": ["…"]
} ] }
```

`items`: exactly 8 `[English meaning, target-language text, romanisation]` (romanisation `""` for Latin scripts).
`sentences`: exactly 3 `[English meaning, [target tokens in correct order]]` with 3–8 tokens.
`gq`: exactly 2 authored questions about grammar, usage or culture. The engine generates the translation,
listening, speaking, word-order and matching questions from `items` and `sentences`.
