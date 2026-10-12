// Offline speech recognition, run on the device in a background thread (no audio ever leaves the device).
// It uses the open multilingual Whisper speech model through the Transformers.js runtime bundled in js/vendor.
// The model itself (about 40 MB, or 75 MB for the more accurate one) is fetched once from the game's own files
// and then kept by the browser, so it also works offline.
import { pipeline, env } from '../vendor/transformers.min.js';

env.allowLocalModels = true;
env.allowRemoteModels = false; // the speech models ship with the game, in /models — no outside service is contacted
env.localModelPath = new URL('../../models/', import.meta.url).href;
env.backends.onnx.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1; // works without special server headers, on every browser

const MODELS = { small: 'whisper-tiny', large: 'whisper-base' };
const NAMES = { en: 'english', fr: 'french', es: 'spanish', ar: 'arabic', ru: 'russian', he: 'hebrew', it: 'italian', el: 'greek', tr: 'turkish', pt: 'portuguese', zh: 'chinese', ja: 'japanese' };
let asr = null, loaded = null;

async function load(size) {
  if (asr && loaded === size) return;
  const files = new Map();
  asr = await pipeline('automatic-speech-recognition', MODELS[size] || MODELS.small, {
    dtype: 'q8', device: 'wasm',
    progress_callback: (p) => {
      if (p.status !== 'progress') return;
      files.set(p.file, [p.loaded, p.total]);
      let a = 0, b = 0; for (const [x, y] of files.values()) { a += x; b += y; }
      postMessage({ type: 'progress', loaded: a, total: b });
    },
  });
  loaded = size;
}

onmessage = async (e) => {
  const { type, id, size, audio, lang } = e.data;
  try {
    if (type === 'load') { await load(size); postMessage({ type: 'ready', id }); }
    if (type === 'run') {
      await load(size);
      const out = await asr(audio, { language: NAMES[lang] || 'english', task: 'transcribe', chunk_length_s: 30 });
      postMessage({ type: 'result', id, text: String(out.text || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').trim() });
    }
  } catch (err) { postMessage({ type: 'error', id, message: String(err?.message || err) }); }
};
