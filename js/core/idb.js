// A tiny key–value store on IndexedDB for cached translations and live material. Falls back to memory.
const mem = new Map();
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open('ukc-cache', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}

export async function kvGet(key) {
  const db = await open();
  if (!db) return mem.get(key);
  return new Promise((resolve) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}

export async function kvSet(key, value) {
  const db = await open();
  if (!db) { mem.set(key, value); return; }
  return new Promise((resolve) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = tx.onerror = () => resolve();
  });
}

export async function kvClear(prefix) {
  const db = await open();
  if (!db) { for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k); return; }
  return new Promise((resolve) => {
    const tx = db.transaction('kv', 'readwrite');
    const store = tx.objectStore('kv');
    const req = store.openKeyCursor();
    req.onsuccess = () => { const c = req.result; if (!c) return; if (String(c.key).startsWith(prefix)) store.delete(c.key); c.continue(); };
    tx.oncomplete = tx.onerror = () => resolve();
  });
}
