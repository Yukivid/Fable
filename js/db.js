// IndexedDB storage: books, epub files, covers, annotations and settings.
// Every local change is stamped and announced so cloud sync can pick it up.
const DB_NAME = 'nook-bookshelf';
const DB_VERSION = 1;
const SYNCED = new Set(['books', 'annotations', 'settings', 'files', 'covers']);
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('annotations')) {
        const s = db.createObjectStore('annotations', { keyPath: 'id' });
        s.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

const isLocalKey = (name, key) => name === 'settings' && String(key).startsWith('sync:');

// Listeners get { store, key, deleted } for every local (non-sync) write.
const listeners = new Set();
export const onLocalChange = fn => listeners.add(fn);
function changed(name, key, deleted = false) {
  if (!SYNCED.has(name) || isLocalKey(name, key)) return;
  listeners.forEach(fn => fn({ store: name, key, deleted }));
}

export const db = {
  async get(name, key) { return wrap((await store(name)).get(key)); },
  async all(name) { return wrap((await store(name)).getAll()); },
  async put(name, value, { silent = false } = {}) {
    if (!silent && (name === 'books' || name === 'annotations' || name === 'settings')) value.updatedAt = Date.now();
    const r = await wrap((await store(name, 'readwrite')).put(value));
    if (!silent) changed(name, value.id ?? value.key);
    return r;
  },
  async del(name, key, { silent = false } = {}) {
    const r = await wrap((await store(name, 'readwrite')).delete(key));
    if (!silent) changed(name, key, true);
    return r;
  },
  async clear(name) { return wrap((await store(name, 'readwrite')).clear()); },
  async byIndex(name, index, value) {
    return wrap((await store(name)).index(index).getAll(value));
  },
  async getSetting(key, fallback) {
    const row = await this.get('settings', key);
    return row ? row.value : fallback;
  },
  async setSetting(key, value, opts) { return this.put('settings', { key, value }, opts); },
};

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
