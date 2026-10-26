// Cloud sync with Supabase: sign in by email link, then books, notes, settings and files
// follow you across devices. The local IndexedDB stays the source the app reads from;
// sync pushes local changes and pulls newer rows (last write wins per record).
import { db, onLocalChange } from './db.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const BUCKET = 'nook';
const TABLES = ['books', 'annotations', 'settings'];
let sb = null, user = null, timer = 0, running = null, dirty = new Map(), onRemote = () => {};
const status = { state: 'off', at: 0, error: '' };
const statusListeners = new Set();

export const cloudConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
export const currentUser = () => user;
export const syncStatus = () => ({ ...status });
export const onSyncStatus = fn => { statusListeners.add(fn); return () => statusListeners.delete(fn); };

function setStatus(state, error = '') {
  status.state = state; status.error = error;
  if (state === 'synced') status.at = Date.now();
  statusListeners.forEach(fn => fn(syncStatus()));
}

export async function initSync({ onRemoteChange }) {
  if (!cloudConfigured()) return;
  onRemote = onRemoteChange;
  dirty = new Map(Object.entries(await db.getSetting('sync:dirty', {})));
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((event, session) => {
    user = session ? session.user : null;
    setStatus(user ? 'idle' : 'signed-out');
    if (user) schedule(400);
  });
  onLocalChange(ch => {
    dirty.set(`${ch.store}/${ch.key}`, ch);
    saveDirty();
    schedule(2500);
  });
  window.addEventListener('online', () => schedule(300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(300); });
}

export async function signIn(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function signOut() {
  await sb.auth.signOut();
  user = null;
  setStatus('signed-out');
}

export function syncNow() { return schedule(0); }

function schedule(ms) {
  clearTimeout(timer);
  return new Promise(resolve => {
    timer = setTimeout(async () => {
      if (!user || !navigator.onLine) { resolve(); return; }
      if (running) await running;
      running = runSync().finally(() => { running = null; });
      await running;
      resolve();
    }, ms);
  });
}

let saveT = 0;
function saveDirty() {
  clearTimeout(saveT);
  saveT = setTimeout(() => db.setSetting('sync:dirty', Object.fromEntries(dirty), { silent: true }), 300);
}

const path = (store, key) => `${user.id}/${store}/${key}`;

async function runSync() {
  setStatus('syncing');
  try {
    // First sync for this account on this device: upload everything already here.
    const owner = await db.getSetting('sync:user');
    if (owner !== user.id) {
      await markEverythingDirty();
      await db.setSetting('sync:user', user.id, { silent: true });
      await db.setSetting('sync:cursor', null, { silent: true });
    }
    const changedLocally = await pull();
    await push();
    setStatus('synced');
    if (changedLocally) onRemote();
  } catch (e) {
    console.error('sync failed', e);
    setStatus('error', e.message || String(e));
  }
}

async function markEverythingDirty() {
  for (const store of ['books', 'annotations', 'files', 'covers', 'settings']) {
    const rows = await db.all(store);
    rows.forEach(r => {
      const key = r.id ?? r.key;
      if (store === 'settings' && String(key).startsWith('sync:')) return;
      dirty.set(`${store}/${key}`, { store, key, deleted: false });
    });
  }
  saveDirty();
}

// ---------- pull ----------

async function pull() {
  const cursor = await db.getSetting('sync:cursor', null);
  let latest = cursor, changed = false;
  for (const table of TABLES) {
    let q = sb.from(table).select('*').order('synced_at', { ascending: true }).limit(1000);
    if (cursor) q = q.gt('synced_at', cursor);
    const { data, error } = await q;
    if (error) throw error;
    for (const row of data) {
      if (!latest || row.synced_at > latest) latest = row.synced_at;
      if (await applyRow(table, row)) changed = true;
    }
  }
  if (latest !== cursor) await db.setSetting('sync:cursor', latest, { silent: true });
  return changed;
}

async function applyRow(table, row) {
  const key = table === 'settings' ? row.key : row.id;
  const pending = dirty.get(`${table}/${key}`);
  const local = await db.get(table, key);
  const localAt = local ? local.updatedAt || 0 : 0;
  if (pending && localAt >= row.updated_at) return false; // our unsent change is newer

  if (row.deleted) {
    if (!local) return false;
    await db.del(table, key, { silent: true });
    if (table === 'books') {
      await db.del('files', key, { silent: true });
      await db.del('covers', key, { silent: true });
    }
    return true;
  }
  if (local && localAt >= row.updated_at) return false;

  if (table === 'settings') {
    let value = row.data;
    if (value && value.__blob) value = await download(path('settings', key));
    if (value === null) return false;
    await db.put('settings', { key, value, updatedAt: row.updated_at }, { silent: true });
  } else {
    const rec = { ...row.data, updatedAt: row.updated_at };
    if (table === 'books' && local && local.locations) rec.locations = local.locations;
    await db.put(table, rec, { silent: true });
    if (table === 'books' && !(await db.get('covers', key))) {
      const blob = await download(path('covers', key));
      if (blob) await db.put('covers', { id: key, blob }, { silent: true });
    }
  }
  return true;
}

async function download(p) {
  const { data, error } = await sb.storage.from(BUCKET).download(p);
  return error ? null : data;
}

// Files stay in the cloud until a book is opened on this device.
export async function fetchFile(id) {
  if (!user) return null;
  const blob = await download(path('files', id));
  if (!blob) return null;
  const file = { id, blob: new Blob([blob], { type: 'application/epub+zip' }) };
  await db.put('files', file, { silent: true });
  return file;
}

// ---------- push ----------

async function push() {
  const entries = [...dirty.entries()];
  const rows = { books: [], annotations: [], settings: [] };
  const done = [];

  for (const [k, ch] of entries) {
    const { store, key, deleted } = ch;
    if (store === 'files' || store === 'covers') {
      if (deleted) await sb.storage.from(BUCKET).remove([path(store, key)]);
      else {
        const rec = await db.get(store, key);
        if (rec) {
          const { error } = await sb.storage.from(BUCKET).upload(path(store, key), rec.blob, { upsert: true, contentType: rec.blob.type || 'application/octet-stream' });
          if (error) throw error;
        }
      }
      done.push(k);
      continue;
    }
    const now = Date.now();
    if (deleted) {
      const base = { user_id: user.id, data: null, deleted: true, updated_at: now };
      rows[store].push(store === 'settings' ? { ...base, key } : { ...base, id: key, ...(store === 'annotations' ? { book_id: null } : {}) });
    } else {
      const rec = await db.get(store, key);
      if (!rec) { done.push(k); continue; }
      if (store === 'settings') {
        let data = rec.value;
        if (data instanceof Blob) {
          const { error } = await sb.storage.from(BUCKET).upload(path('settings', key), data, { upsert: true, contentType: data.type });
          if (error) throw error;
          data = { __blob: true };
        }
        rows.settings.push({ user_id: user.id, key, data, deleted: false, updated_at: rec.updatedAt || now });
      } else {
        const { locations, updatedAt, ...data } = rec;
        const row = { user_id: user.id, id: key, data, deleted: false, updated_at: updatedAt || now };
        if (store === 'annotations') row.book_id = rec.bookId;
        rows[store].push(row);
      }
    }
    done.push(k);
  }

  for (const table of TABLES) {
    if (!rows[table].length) continue;
    const { error } = await sb.from(table).upsert(rows[table], { onConflict: table === 'settings' ? 'user_id,key' : 'user_id,id' });
    if (error) throw error;
  }
  // Only forget changes that haven't been touched again while we were uploading.
  done.forEach(k => { if (dirty.get(k) === entries.find(e => e[0] === k)[1]) dirty.delete(k); });
  saveDirty();
}
