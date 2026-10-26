import { db, uid } from './db.js';
import * as meta from './meta.js';
import { DECOR_TYPES, decorSvg } from './decor.js';
import { icon, esc, $, $$, openSheet, toast, confirmSheet, stars, sheetOpen, closeAllSheets, closeSheet } from './ui.js';
import { setSound, setVolume, dust, SOUND_NAMES } from './ambience.js';
import { openReader, readerOpen } from './reader.js';
import { openPdfReader, pdfReaderOpen } from './pdfreader.js';
import { initSync, cloudConfigured, currentUser, syncStatus, onSyncStatus, signIn, signOut, syncNow, fetchFile } from './sync.js';

// ---------- constants ----------

const SHELVES = [
  { key: 'read', label: 'Read', title: 'Finished' },
  { key: 'reading', label: 'Reading', title: 'Currently reading' },
  { key: 'tbr', label: 'TBR', title: 'To be read' },
];
const SHELF_LABEL = { read: 'Read', reading: 'Reading', tbr: 'TBR', none: 'Off shelf' };

const WOODS = {
  honey:  { name: 'Honey',  hi: '#cf9170', mid: '#a9694b', lo: '#6c3c27' },
  walnut: { name: 'Walnut', hi: '#9a6a45', mid: '#744a2c', lo: '#43281a' },
  oak:    { name: 'Oak',    hi: '#e2b583', mid: '#bb8a5c', lo: '#7d5533' },
  cherry: { name: 'Cherry', hi: '#b8603f', mid: '#8a3d27', lo: '#521e12' },
  ebony:  { name: 'Ebony',  hi: '#544740', mid: '#2f2621', lo: '#15100d' },
  birch:  { name: 'White',  hi: '#ffffff', mid: '#ebe5da', lo: '#b3aa9b' },
};
const WALLS = {
  charcoal: { name: 'Charcoal', bg: '#25282d', ink: '#f3eee6' },
  midnight: { name: 'Midnight', bg: '#1a2132', ink: '#eef0f7' },
  forest:   { name: 'Forest',   bg: '#1c2a22', ink: '#eef3ec' },
  plum:     { name: 'Plum',     bg: '#2b1f2d', ink: '#f6edf4' },
  oxblood:  { name: 'Oxblood',  bg: '#331b1c', ink: '#f8ece9' },
  cream:    { name: 'Cream',    bg: '#efe5d2', ink: '#3a2e22' },
  sage:     { name: 'Sage',     bg: '#c8d1bd', ink: '#2a3324' },
  blush:    { name: 'Blush',    bg: '#ecd8d0', ink: '#43292a' },
  glass:    { name: 'Glass',    bg: 'rgba(22, 24, 30, .42)', ink: '#ffffff', glass: true },
  walnutpanel: { name: 'Walnut panel', bg: '#3a2416', ink: '#f6ecdf', wood: true },
  oakpanel:    { name: 'Oak panel',    bg: '#7d5536', ink: '#fbf3e6', wood: true },
  ashpanel:    { name: 'Pale wood',    bg: '#b89a78', ink: '#2e2116', wood: true },
};
const BACKDROPS = {
  sky:    { name: 'Sky',    css: 'linear-gradient(180deg,#25518c 0%,#5a8ac3 38%,#a9c4e2 66%,#dfe8f2 100%)' },
  dusk:   { name: 'Dusk',   css: 'linear-gradient(180deg,#221a3a 0%,#5b3a64 35%,#c06c62 70%,#f1b77f 100%)' },
  night:  { name: 'Night',  css: 'radial-gradient(ellipse at 70% 0%,#2b3768 0%,#121834 45%,#070a17 100%)' },
  forest: { name: 'Woods',  css: 'linear-gradient(180deg,#1d3328 0%,#2f4a39 50%,#7f8f6a 100%)' },
  paper:  { name: 'Paper',  css: 'linear-gradient(180deg,#f3ede2,#e6dccb)' },
  ink:    { name: 'Ink',    css: 'linear-gradient(180deg,#121316,#1d1f24)' },
  custom: { name: 'Photo',  css: '' },
};

const DEFAULT_PREFS = {
  wood: 'honey', wall: 'charcoal', backdrop: 'sky',
  view: { read: 'cover', reading: 'cover', tbr: 'spine' },
  bookSize: 1, roomLight: 0.85, dust: true, titles: true,
  sound: 'off', volume: 0.45,
};

const DEFAULT_DECOR = {
  read: [['roses', 0], ['pillar', -1]],
  reading: [['jar', 0], ['mug', -1]],
  tbr: [['succulent', 0], ['taper', -1], ['pothos', -1]],
};

// ---------- state ----------

const S = {
  books: new Map(),
  covers: new Map(),
  prefs: structuredClone(DEFAULT_PREFS),
  layouts: { read: [], reading: [], tbr: [] },
  decor: {},
  current: 'reading',
  arrange: false,
  backdropUrl: null,
  installEvent: null,
  dustStops: [],
};

const booksOn = shelf => [...S.books.values()].filter(b => b.shelf === shelf);

// ---------- boot ----------

async function boot() {
  const params = new URLSearchParams(location.search);
  S.widget = params.get('widget') ? { shelf: params.get('widget'), rows: Math.max(1, Math.min(6, +params.get('rows') || 4)) } : null;
  buildChrome();
  await loadState();
  applyTheme();
  if (S.widget) document.body.classList.add('widget-mode');
  renderAll();
  renderGreeting();
  setInterval(renderGreeting, 5 * 60 * 1000);
  goTo(S.widget ? S.widget.shelf : booksOn('reading').length || !S.books.size ? 'reading' : 'read', false);
  if (!S.widget && !S.profile) setTimeout(openWelcome, 600);
  else if (!S.widget) setTimeout(rescanFolder, 1500);
  if (S.prefs.sound !== 'off') armSound();
  document.body.classList.add('ready');
  initSync({ onRemoteChange: reloadFromDb });
  onSyncStatus(st => document.body.dataset.sync = st.state);
}

async function loadState() {
  const [books, prefs, layouts, decor, backdrop, profile] = await Promise.all([
    db.all('books'), db.getSetting('prefs'), db.getSetting('layouts'), db.getSetting('decor'), db.getSetting('backdropImage'), db.getSetting('profile'),
  ]);
  S.profile = profile || null;
  S.books = new Map(books.map(b => [b.id, b]));
  S.prefs = { ...structuredClone(DEFAULT_PREFS), ...(prefs || {}) };
  S.prefs.view = { ...DEFAULT_PREFS.view, ...(prefs && prefs.view) };
  S.layouts = { read: [], reading: [], tbr: [], ...(layouts || {}) };
  if (decor) S.decor = decor;
  else { S.decor = {}; seedDecor(); }
  if (S.backdropUrl) URL.revokeObjectURL(S.backdropUrl);
  S.backdropUrl = backdrop ? URL.createObjectURL(backdrop) : null;
  await loadCovers();
}

// Called after cloud sync brought in changes from another device.
async function reloadFromDb() {
  await loadState();
  applyTheme();
  renderAll();
  renderGreeting();
  setCurrent(S.current);
}

function seedDecor() {
  for (const [shelf, list] of Object.entries(DEFAULT_DECOR)) {
    for (const [type, pos] of list) {
      const id = uid('d_');
      S.decor[id] = { type, lit: true };
      if (pos === 0) S.layouts[shelf].unshift(id); else S.layouts[shelf].push(id);
    }
  }
  // Stamped as oldest-possible so a synced layout from another device always wins.
  db.put('settings', { key: 'layouts', value: S.layouts, updatedAt: 1 }, { silent: true });
  db.put('settings', { key: 'decor', value: S.decor, updatedAt: 1 }, { silent: true });
}

async function loadCovers() {
  S.covers.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
  S.covers = new Map();
  const rows = await db.all('covers');
  rows.forEach(r => S.covers.set(r.id, URL.createObjectURL(r.blob)));
  for (const b of S.books.values()) if (!S.covers.has(b.id) && b.coverUrl) S.covers.set(b.id, b.coverUrl);
}

function armSound() {
  // Browsers need a user gesture before audio can start.
  const start = () => { setSound(S.prefs.sound, S.prefs.volume); window.removeEventListener('pointerdown', start); };
  window.addEventListener('pointerdown', start);
}

// ---------- persistence ----------

const savePrefs = () => db.setSetting('prefs', S.prefs);
const saveLayouts = () => db.setSetting('layouts', S.layouts);
const saveDecor = () => db.setSetting('decor', S.decor);

async function saveBook(b) {
  b.updatedAt = Date.now();
  S.books.set(b.id, b);
  await db.put('books', b);
}

// ---------- chrome ----------

function buildChrome() {
  $('#app').innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">${icon('flame')}</span><span>Fable</span></div>
    <div class="top-actions">
      <button class="icon-btn" data-act="search" title="Find books online">${icon('search')}</button>
      <button class="icon-btn" data-act="view" title="Covers or spines">${icon('spines')}</button>
      <button class="icon-btn" data-act="arrange" title="Arrange & decorate">${icon('move')}</button>
      <button class="icon-btn" data-act="customize" title="Customize">${icon('sliders')}</button>
      <button class="icon-btn" data-act="menu" title="More">${icon('dots')}</button>
    </div>
  </header>
  <p class="greeting" id="greeting"></p>
  <nav class="tabs" role="tablist">
    ${SHELVES.map(s => `<button class="tab" role="tab" data-tab="${s.key}">${s.label}<span class="count" data-count="${s.key}"></span></button>`).join('')}
    <span class="tab-ink"></span>
  </nav>
  <main class="pages" id="pages">
    ${SHELVES.map(s => `<section class="page" data-shelf="${s.key}"><div class="page-inner">
      <div class="continue-slot"></div>
      <div class="case" data-case="${s.key}">
        <div class="case-head"><h2>${s.title}</h2><span class="case-sub"></span></div>
        <div class="rows"></div>
        <div class="glows"></div>
        <canvas class="dust"></canvas>
      </div>
      <p class="hint"></p>
    </div></section>`).join('')}
  </main>
  <button class="fab" data-act="add" title="Add books">${icon('plus')}</button>
  <div class="arrange-bar">
    <div class="ab-head"><span>Drag books & decor anywhere. Tap a piece below to add it.</span>
      <button class="btn small primary" data-act="arrange-done">${icon('check')} Done</button></div>
    <div class="palette">${Object.entries(DECOR_TYPES).map(([k, d]) =>
      `<button class="pal" data-add-decor="${k}" title="${d.name}"><div class="pal-art decor-${k} lit">${decorSvg(k)}</div><span>${d.name}</span></button>`).join('')}</div>
  </div>
  <div class="drop-ind"></div>`;

  document.addEventListener('click', onClick);
  $('#pages').addEventListener('scroll', onPagesScroll, { passive: true });
  $('#pages').addEventListener('pointerdown', onPointerDown);
  $('#pages').addEventListener('contextmenu', e => { if (e.target.closest('.item')) e.preventDefault(); });
  document.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderAll(); goTo(S.current, false); }, 120); });
  window.addEventListener('keydown', e => {
    if (readerOpen() || pdfReaderOpen() || sheetOpen() || e.target.closest('input,textarea')) return;
    const i = SHELVES.findIndex(s => s.key === S.current);
    if (e.key === 'ArrowRight' && i < 2) goTo(SHELVES[i + 1].key);
    if (e.key === 'ArrowLeft' && i > 0) goTo(SHELVES[i - 1].key);
  });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvent = e; });
  // Drop EPUB files anywhere to add them to the shelf you're looking at.
  window.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', e => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])].filter(meta.isBookFile);
    if (files.length && !readerOpen() && !pdfReaderOpen()) importFiles(files, S.current);
  });
  // Opening .epub files with the installed app.
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async params => {
      const files = await Promise.all((params.files || []).map(h => h.getFile()));
      if (files.length) importFiles(files, 'reading');
    });
  }
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));
}

function onClick(e) {
  const t = e.target;
  if (S.widget) { location.href = './'; return; }
  const act = t.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'search') return openSearch();
    if (a === 'view') return toggleView();
    if (a === 'arrange') return setArrange(!S.arrange);
    if (a === 'arrange-done') return setArrange(false);
    if (a === 'customize') return openCustomize();
    if (a === 'menu') return openMenu();
    if (a === 'add') return openAdd();
    if (a === 'continue') return openBook(act.dataset.id);
    if (a === 'empty-import') return pickAndImport(S.current === 'reading' ? 'reading' : S.current);
    if (a === 'empty-search') return openSearch();
    if (a === 'find') return findOnDevice();
  }
  const tab = t.closest('[data-tab]');
  if (tab) return goTo(tab.dataset.tab);
  const add = t.closest('[data-add-decor]');
  if (add) return addDecor(add.dataset.addDecor);
  if (suppressClick) return;
  const x = t.closest('.decor-x');
  if (x) return removeDecor(x.closest('.item').dataset.id);
  const item = t.closest('#pages .item');
  if (item && !S.arrange) {
    if (item.classList.contains('book')) return openBookSheet(item.dataset.id);
    if (item.dataset.candle) return toggleCandle(item);
    item.classList.remove('wobble'); void item.offsetWidth; item.classList.add('wobble');
  }
}

// ---------- pages / tabs ----------

function goTo(key, smooth = true) {
  const i = SHELVES.findIndex(s => s.key === key);
  const pages = $('#pages');
  pages.scrollTo({ left: i * pages.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  setCurrent(key);
}

function setCurrent(key) {
  S.current = key;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === key));
  const i = SHELVES.findIndex(s => s.key === key);
  const ink = $('.tab-ink');
  const tab = $$('.tab')[i];
  if (tab) { ink.style.width = tab.offsetWidth + 'px'; ink.style.transform = `translateX(${tab.offsetLeft}px)`; }
  $('[data-act="view"]').innerHTML = icon(S.prefs.view[key] === 'cover' ? 'spines' : 'covers');
}

function onPagesScroll() {
  const pages = $('#pages');
  const i = Math.round(pages.scrollLeft / pages.clientWidth);
  const key = SHELVES[Math.max(0, Math.min(2, i))].key;
  if (key !== S.current) setCurrent(key);
}

// ---------- theme ----------

function applyTheme() {
  const p = S.prefs, w = WOODS[p.wood] || WOODS.honey, wall = WALLS[p.wall] || WALLS.charcoal;
  const r = document.documentElement.style;
  r.setProperty('--wood-hi', w.hi); r.setProperty('--wood', w.mid); r.setProperty('--wood-lo', w.lo);
  r.setProperty('--wall', wall.bg); r.setProperty('--wall-ink', wall.ink);
  r.setProperty('--room', p.roomLight);
  r.setProperty('--glow', (0.35 + (1 - p.roomLight) * 1.1).toFixed(2));
  const bd = p.backdrop === 'custom' && S.backdropUrl ? `center / cover no-repeat url("${S.backdropUrl}")` : (BACKDROPS[p.backdrop] || BACKDROPS.sky).css;
  r.setProperty('--backdrop', bd);
  document.body.classList.toggle('glass-wall', !!wall.glass);
  document.body.classList.toggle('wood-wall', !!wall.wood);
  document.body.classList.toggle('light-wall', !wall.glass && !wall.wood && isLight(wall.bg));
  document.body.classList.toggle('light-backdrop', ['paper'].includes(p.backdrop));
  document.body.classList.toggle('no-titles', !p.titles);
  document.querySelector('meta[name=theme-color]').setAttribute('content', p.backdrop === 'paper' ? '#efe8dc' : '#1b2638');
}

function isLight(hex) {
  if (!hex.startsWith('#')) return false;
  const { r, g, b } = meta.hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

// ---------- shelf rendering ----------

function itemsFor(shelf) {
  const books = booksOn(shelf);
  const ids = new Set(books.map(b => b.id));
  const layout = S.layouts[shelf].filter(id => ids.has(id) || S.decor[id]);
  const seen = new Set(layout);
  books.filter(b => !seen.has(b.id)).sort((a, b) => a.addedAt - b.addedAt).forEach(b => layout.push(b.id));
  S.layouts[shelf] = layout;
  return layout;
}

function measure(shelf, caseEl) {
  const inner = Math.max(240, caseEl.clientWidth - 36);
  const cw = Math.min(104, Math.max(56, inner / 5.3)) * S.prefs.bookSize;
  const u = cw / 72;
  return { inner, cw, u, coverH: cw * 1.5, rowH: cw * 1.5 + 22 * u };
}

function describe(id, view, m) {
  const d = S.decor[id];
  if (d) {
    const T = DECOR_TYPES[d.type];
    return { id, kind: 'decor', type: d.type, w: T.w * m.u, h: T.h * m.u };
  }
  const b = S.books.get(id);
  const h = meta.hash(b.id);
  const v = b.face || view; // a book can face differently from the rest of its shelf
  if (v === 'cover') return { id, kind: 'book', view: v, b, w: m.cw, h: m.coverH * (0.94 + (h % 7) / 100) };
  const pages = b.pages || 300;
  const w = Math.max(15, Math.min(42, 9 + pages * 0.036)) * m.u;
  return { id, kind: 'book', view: v, b, w, h: m.coverH * (0.83 + (h % 15) / 100) };
}

function pack(items, view, m) {
  const rows = [[]];
  let x = 0;
  items.forEach((it, i) => {
    const prev = rows[rows.length - 1].at(-1);
    const both = prev && prev.kind === 'book' && it.kind === 'book';
    const gap = !prev ? 0 : !both ? 8 * m.u : prev.view === 'spine' && it.view === 'spine' ? 1.4 * m.u : prev.view === 'cover' && it.view === 'cover' ? 9 * m.u : 4 * m.u;
    if (prev && x + gap + it.w > m.inner) { rows.push([]); x = 0; }
    const row = rows[rows.length - 1];
    it.ml = row.length ? gap : 0;
    row.push(it);
    x += it.ml + it.w;
  });
  return rows;
}

function renderAll() {
  SHELVES.forEach(s => renderShelf(s.key));
  SHELVES.forEach(s => { $(`[data-count="${s.key}"]`).textContent = booksOn(s.key).length || ''; });
}

function renderShelf(shelf) {
  const page = $(`.page[data-shelf="${shelf}"]`);
  const caseEl = $('.case', page);
  const view = S.prefs.view[shelf];
  const m = measure(shelf, caseEl);
  caseEl.style.setProperty('--u', m.u + 'px');
  caseEl.classList.toggle('spine-view', view === 'spine');

  const items = itemsFor(shelf).map(id => describe(id, view, m));
  const rows = pack(items, view, m);
  if (S.widget) rows.length = Math.min(rows.length, S.widget.rows);
  const minRows = Math.max(3, Math.ceil((window.innerHeight - 200) / (m.rowH + 20 * m.u)));
  if (S.widget) { while (rows.length < S.widget.rows) rows.push([]); }
  else {
    while (rows.length < minRows) rows.push([]);
    rows.push([]); // always leave an empty shelf to grow into
  }

  $('.rows', caseEl).innerHTML = rows.map(r => `<div class="row" style="height:${m.rowH}px">
      <div class="row-items">${r.map(it => itemHtml(it, it.view || view, shelf, m)).join('')}</div>
      <div class="plank"><i class="plank-top"></i><i class="plank-front"></i></div></div>`).join('');

  const books = booksOn(shelf);
  const sub = $('.case-sub', caseEl);
  if (shelf === 'read') {
    const pages = books.reduce((a, b) => a + (b.pages || 0) * Math.max(1, b.readCount || 1), 0);
    sub.textContent = books.length ? `${books.length} book${books.length > 1 ? 's' : ''} · ${pages.toLocaleString()} pages` : '';
  } else if (shelf === 'reading') sub.textContent = books.length ? `${books.length} in progress` : '';
  else sub.textContent = books.length ? `${books.length} waiting` : '';

  const hint = $('.hint', page);
  if (!books.length) {
    hint.innerHTML = shelf === 'reading'
      ? `Nothing on the go. <button class="link" data-act="empty-import">Import an EPUB or PDF</button> or <button class="link" data-act="find">find books on this device</button>.`
      : `This shelf is empty. <button class="link" data-act="empty-search">Search for a book</button> or <button class="link" data-act="empty-import">import an EPUB or PDF</button>.`;
  } else hint.textContent = '';

  renderContinue(shelf, page);
  requestAnimationFrame(() => placeGlows(caseEl));
  startDust(caseEl);
}

function itemHtml(it, view, shelf, m) {
  const style = `width:${it.w}px;height:${it.h}px;margin-left:${it.ml}px`;
  if (it.kind === 'decor') {
    const d = S.decor[it.id], T = DECOR_TYPES[it.type];
    return `<div class="item decor decor-${it.type} ${d.lit !== false ? 'lit' : ''}" data-id="${it.id}" ${T.candle ? 'data-candle="1"' : ''} style="${style}">
      ${decorSvg(it.type)}<button class="decor-x" aria-label="Remove">${icon('x')}</button></div>`;
  }
  const b = it.b;
  const color = b.spineColor || meta.hashColor(b.title);
  const ink = meta.textColorFor(color);
  const cover = S.covers.get(b.id);
  const ribbon = shelf === 'reading' ? `<i class="ribbon"></i>` : '';
  const prog = shelf === 'reading' && b.progress ? `<i class="prog" style="--p:${Math.round(b.progress * 100)}%"></i>` : '';
  const tip = `${b.title} — ${b.author}`;
  if (view === 'cover') {
    const face = cover
      ? `<img src="${esc(cover)}" alt="" draggable="false" loading="lazy">`
      : genCover(b, color, ink);
    return `<div class="item book cover-book" data-id="${b.id}" style="${style};--spine:${color}" title="${esc(tip)}">
      <div class="book-face">${face}<i class="crease"></i><i class="sheen"></i></div><i class="pages-edge"></i>${ribbon}${prog}</div>`;
  }
  const h = meta.hash(b.id);
  const variant = h % 4, font = ['serif', 'sans', 'display', 'serif'][(h >> 3) % 4];
  const surname = (b.author || '').split(',')[0].trim().split(' ').pop();
  // Shrink type until the title fits along the spine, like a real printed spine.
  // Long titles wrap onto a second line down the spine.
  const along = it.h * 0.66, len = b.title.length * 0.56;
  let fs = Math.min(it.w * 0.46, 12 * m.u, along / len), wrap = false;
  if (fs < 7.5 && it.w > 22) { fs = Math.min(it.w * 0.32, (along * 2) / len); wrap = true; }
  fs = Math.max(6.5, fs);
  const afs = Math.min(fs * 0.78, (it.h * 0.26) / (surname.length * 0.62));
  return `<div class="item book spine-book v${variant} f-${font} ${wrap ? 'wrap' : ''}" data-id="${b.id}" style="${style};--spine:${color};--ink:${ink};--fs:${fs}px;--afs:${afs}px" title="${esc(tip)}">
    <div class="spine"><i class="band top"></i><span class="sp-title">${esc(b.title)}</span>${afs >= 5 ? `<span class="sp-author">${esc(surname)}</span>` : ''}<i class="band bottom"></i></div>${ribbon}</div>`;
}

function genCover(b, color, ink) {
  return `<div class="gen-cover" style="background:${color};color:${ink}">
    <span class="gc-title">${esc(b.title)}</span><i></i><span class="gc-author">${esc(b.author)}</span></div>`;
}

function renderContinue(shelf, page) {
  const slot = $('.continue-slot', page);
  if (shelf !== 'reading') { slot.innerHTML = ''; return; }
  const b = booksOn('reading').filter(x => x.hasFile).sort((a, c) => (c.lastOpened || c.addedAt) - (a.lastOpened || a.addedAt))[0];
  if (!b) { slot.innerHTML = ''; return; }
  const pct = Math.round((b.progress || 0) * 100);
  const cover = S.covers.get(b.id);
  slot.innerHTML = `<div class="continue">
    <div class="c-cover" style="--spine:${b.spineColor || '#555'}">${cover ? `<img src="${esc(cover)}" alt="">` : ''}</div>
    <div class="c-body"><span class="c-label">${b.progress ? 'Pick up where you left off' : 'Ready when you are'}</span>
      <strong>${esc(b.title)}</strong><span class="c-author">${esc(b.author)}</span>
      <div class="bar"><i style="width:${pct}%"></i></div><span class="c-pct">${pct}% · ${b.lastPageLabel || (b.pages ? b.pages + ' pages' : '')}</span></div>
    <button class="btn primary" data-act="continue" data-id="${b.id}">${icon('open')} ${b.progress ? 'Continue reading' : 'Start reading'}</button></div>`;
}

function placeGlows(caseEl) {
  const host = $('.glows', caseEl);
  const base = caseEl.getBoundingClientRect();
  host.innerHTML = $$('.decor.lit .flame-wrap', caseEl).map(f => {
    const r = f.getBoundingClientRect();
    const x = r.left - base.left + r.width / 2, y = r.top - base.top + r.height * 0.7;
    return `<i class="glow" style="left:${x}px;top:${y}px;animation-delay:${(-Math.random() * 3).toFixed(2)}s"></i>`;
  }).join('');
}

function startDust(caseEl) {
  const canvas = $('.dust', caseEl);
  if (canvas._stop) { canvas._stop(); canvas._stop = null; }
  canvas.hidden = !S.prefs.dust;
  if (S.prefs.dust && !matchMedia('(prefers-reduced-motion: reduce)').matches) canvas._stop = dust(canvas);
}

// ---------- decor ----------

function toggleCandle(el) {
  const d = S.decor[el.dataset.id];
  d.lit = d.lit === false;
  el.classList.toggle('lit', d.lit);
  if (!d.lit) {
    const smoke = document.createElement('i');
    smoke.className = 'smoke';
    el.appendChild(smoke);
    setTimeout(() => smoke.remove(), 3000);
  }
  saveDecor();
  placeGlows(el.closest('.case'));
}

function addDecor(type) {
  const id = uid('d_');
  S.decor[id] = { type, lit: true };
  S.layouts[S.current].push(id);
  saveDecor(); saveLayouts();
  renderShelf(S.current);
  const el = $(`.item[data-id="${id}"]`);
  if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('pop'); }
}

function removeDecor(id) {
  delete S.decor[id];
  for (const k of Object.keys(S.layouts)) S.layouts[k] = S.layouts[k].filter(x => x !== id);
  saveDecor(); saveLayouts();
  renderShelf(S.current);
}

function setArrange(on) {
  S.arrange = on;
  document.body.classList.toggle('arranging', on);
  if (on) toast('Arrange mode: drag to rearrange, tap × to remove decor');
}

function toggleView() {
  const v = S.prefs.view;
  v[S.current] = v[S.current] === 'cover' ? 'spine' : 'cover';
  savePrefs();
  renderShelf(S.current);
  setCurrent(S.current);
  toast(v[S.current] === 'cover' ? 'Covers facing out' : 'Spines facing out');
}

// ---------- drag & drop ----------

let drag = null, press = null, suppressClick = false;

function onPointerDown(e) {
  const item = e.target.closest('.item');
  if (!item || e.button > 0 || e.target.closest('.decor-x')) return;
  if (S.arrange) { e.preventDefault(); startDrag(item, e); return; }
  // Long-press (touch) or press-and-hold (mouse) starts arranging.
  const x0 = e.clientX, y0 = e.clientY;
  const cancel = () => { clearTimeout(press); press = null; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); };
  const mv = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) cancel(); };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', cancel);
  window.addEventListener('pointercancel', cancel);
  press = setTimeout(() => {
    cancel();
    if (navigator.vibrate) navigator.vibrate(12);
    setArrange(true);
    startDrag(item, e);
  }, 480);
}

function startDrag(item, e) {
  const rect = item.getBoundingClientRect();
  const ghost = item.cloneNode(true);
  ghost.classList.add('drag-ghost');
  Object.assign(ghost.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', marginLeft: 0 });
  ghost.style.setProperty('--u', getComputedStyle(item.closest('.case')).getPropertyValue('--u'));
  document.body.appendChild(ghost);
  item.classList.add('dragging');
  drag = { item, ghost, id: item.dataset.id, dx: e.clientX - rect.left, dy: e.clientY - rect.top, target: null, moved: false, x: e.clientX, y: e.clientY };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
  autoScroll();
}

function onDragMove(e) {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (Math.abs(e.clientX - (drag.ghost.offsetLeft + drag.dx)) > 3) drag.moved = true;
  drag.ghost.style.left = e.clientX - drag.dx + 'px';
  drag.ghost.style.top = e.clientY - drag.dy + 'px';
  findDropTarget(e.clientX, e.clientY);
}

function findDropTarget(x, y) {
  const caseEl = $(`.case[data-case="${S.current}"]`);
  const rows = $$('.row', caseEl);
  let row = null, best = Infinity;
  for (const r of rows) {
    const rr = r.getBoundingClientRect();
    const d = y < rr.top ? rr.top - y : y > rr.bottom ? y - rr.bottom : 0;
    if (d < best) { best = d; row = r; }
  }
  const ind = $('.drop-ind');
  if (!row) { ind.classList.remove('show'); drag.target = null; return; }
  const items = $$('.item', row).filter(i => i !== drag.item);
  const rr = $('.row-items', row).getBoundingClientRect();
  let target, ix;
  if (!items.length) {
    // Empty shelf: drop after the last item of the previous non-empty rows.
    const all = $$('.item', caseEl).filter(i => i !== drag.item && i.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING);
    const last = all.at(-1);
    target = last ? { id: last.dataset.id, after: true } : { id: null, after: true };
    ix = rr.left + rr.width / 2;
  } else {
    const before = items.find(i => { const r = i.getBoundingClientRect(); return x < r.left + r.width / 2; });
    if (before) { target = { id: before.dataset.id, after: false }; ix = before.getBoundingClientRect().left - 3; }
    else { const l = items.at(-1); target = { id: l.dataset.id, after: true }; ix = l.getBoundingClientRect().right + 3; }
  }
  drag.target = target;
  Object.assign(ind.style, { left: ix - 2 + 'px', top: rr.top + rr.height * 0.12 + 'px', height: rr.height * 0.86 + 'px' });
  ind.classList.add('show');
}

function autoScroll() {
  if (!drag) return;
  const page = $(`.page[data-shelf="${S.current}"]`);
  const r = page.getBoundingClientRect();
  if (drag.y < r.top + 70) page.scrollTop -= 9;
  else if (drag.y > r.bottom - 70) page.scrollTop += 9;
  requestAnimationFrame(autoScroll);
}

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
  const d = drag; drag = null;
  $('.drop-ind').classList.remove('show');
  d.ghost.remove();
  d.item.classList.remove('dragging');
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
  if (!d.target || !d.moved) return;
  const list = S.layouts[S.current].filter(id => id !== d.id);
  let idx = d.target.id ? list.indexOf(d.target.id) : list.length - 1;
  if (d.target.after) idx += 1;
  list.splice(Math.max(0, idx), 0, d.id);
  S.layouts[S.current] = list;
  saveLayouts();
  renderShelf(S.current);
}

// ---------- book actions ----------

function setShelf(b, shelf) {
  for (const k of Object.keys(S.layouts)) S.layouts[k] = S.layouts[k].filter(x => x !== b.id);
  if (S.layouts[shelf]) S.layouts[shelf].push(b.id);
  b.shelf = shelf;
}

async function moveBook(id, shelf, { quiet = false } = {}) {
  const b = S.books.get(id);
  if (shelf === 'reading' && !b.hasFile) {
    const ok = await confirmSheet({ title: 'Needs an EPUB file', text: 'Only books with an EPUB in the app can sit on the Reading shelf. Attach the EPUB for this book now?', ok: 'Attach EPUB' });
    if (!ok) return false;
    if (!await attachFile(b)) return false;
  }
  if (shelf === 'reading' && b.shelf !== 'reading') { b.startedAt = Date.now(); }
  setShelf(b, shelf);
  await saveBook(b); saveLayouts();
  renderAll();
  if (!quiet) toast(`Moved to ${SHELF_LABEL[shelf]}`, { action: 'View', onAction: () => goTo(shelf) });
  return true;
}

async function markFinished(b) {
  b.readCount = (b.readCount || 0) + 1;
  b.finishedAt = Date.now();
  b.progress = 1;
  b.lastCfi = null;
  setShelf(b, 'read');
  await saveBook(b); saveLayouts();
  renderAll();
}

async function rereadBook(id) {
  const b = S.books.get(id);
  if (!b.hasFile) {
    const ok = await confirmSheet({ title: 'Read it again', text: 'To read inside the app, attach the EPUB for this book. Or move it to TBR for later.', ok: 'Attach EPUB' });
    if (!ok || !await attachFile(b)) return;
  }
  b.progress = 0; b.lastCfi = null; b.startedAt = Date.now();
  setShelf(b, 'reading');
  await saveBook(b); saveLayouts();
  renderAll();
  openBook(id);
}

// goto: an annotation (highlight, bookmark or favourite) to open the book at.
async function openBook(id, goto = null) {
  const b = S.books.get(id);
  if (!b.hasFile) return attachFile(b).then(ok => ok && openBook(id, goto));
  let file = await db.get('files', id);
  if (!file && currentUser()) {
    const t = toast('Downloading book from your cloud…', { ms: 60000 });
    file = await fetchFile(id).catch(() => null);
    t.close();
  }
  if (!file) { toast('Book file missing — attach it again'); b.hasFile = false; await saveBook(b); return; }
  if (b.shelf !== 'reading') { setShelf(b, 'reading'); b.startedAt = b.startedAt || Date.now(); saveLayouts(); }
  b.lastOpened = Date.now();
  await saveBook(b);
  closeAllSheets();
  const isPdfBook = b.format === 'pdf';
  const prefsKey = isPdfBook ? 'pdfReaderPrefs' : 'readerPrefs';
  const readerPrefs = await db.getSetting(prefsKey, {});
  (isPdfBook ? openPdfReader : openReader)({
    book: b, blob: file.blob, goto,
    prefs: readerPrefs,
    savePrefs: p => db.setSetting(prefsKey, p),
    saveBook: async bk => { await saveBook(bk); },
    onFinished: bk => markFinished(bk),
    onClose: () => { renderAll(); goTo(S.books.get(id).shelf, false); },
    rate: (bk, r) => { bk.rating = r; saveBook(bk); },
  });
}

async function deleteBook(id) {
  const b = S.books.get(id);
  const ok = await confirmSheet({ title: 'Delete permanently?', text: `"${b.title}" and its EPUB, highlights and notes will be removed from this device. This can't be undone.`, ok: 'Delete', danger: true });
  if (!ok) return false;
  await Promise.all([db.del('books', id), db.del('files', id), db.del('covers', id)]);
  const anns = await db.byIndex('annotations', 'bookId', id);
  await Promise.all(anns.map(a => db.del('annotations', a.id)));
  const url = S.covers.get(id);
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  S.covers.delete(id); S.books.delete(id);
  for (const k of Object.keys(S.layouts)) S.layouts[k] = S.layouts[k].filter(x => x !== id);
  saveLayouts();
  renderAll();
  toast('Book deleted');
  return true;
}

async function removeFromShelf(id) {
  const b = S.books.get(id);
  setShelf(b, 'none');
  await saveBook(b); saveLayouts();
  renderAll();
  toast('Removed from shelf — find it in Library', { action: 'Undo', onAction: () => moveBook(id, 'tbr') });
}

// ---------- book sheet ----------

async function openBookSheet(id) {
  const b = S.books.get(id);
  if (!b) return;
  const anns = await db.byIndex('annotations', 'bookId', id);
  const cover = S.covers.get(id);
  const color = b.spineColor || meta.hashColor(b.title);
  const pct = Math.round((b.progress || 0) * 100);
  let primary = '';
  if (b.shelf === 'reading') primary = `<button class="btn primary big" data-b="open">${icon('open')} ${b.progress ? `Continue reading · ${pct}%` : 'Start reading'}</button>`;
  else if (b.shelf === 'read') primary = `<button class="btn primary big" data-b="reread">${icon('reread')} Read again</button>`;
  else if (b.hasFile) primary = `<button class="btn primary big" data-b="open">${icon('open')} Start reading</button>`;
  if (!b.hasFile) primary += `<button class="btn ghost big" data-b="attach">${icon('file')} Attach EPUB or PDF to read in app</button>`;

  const moves = ['read', 'reading', 'tbr'].map(s => `<button class="chip ${b.shelf === s ? 'on' : ''}" data-move="${s}" ${s === 'reading' && !b.hasFile ? 'data-needs-file="1"' : ''}>${SHELF_LABEL[s]}</button>`).join('');
  const hl = anns.filter(a => a.type === 'highlight').length, notes = anns.filter(a => a.note).length, favs = anns.filter(a => a.type === 'fav').length, marks = anns.filter(a => a.type === 'bookmark').length;
  const facts = [b.pages ? `${b.pages} pages` : '', b.readCount ? `Read ${b.readCount}×` : '', b.finishedAt ? `Finished ${new Date(b.finishedAt).toLocaleDateString()}` : '', b.hasFile ? (b.format === 'pdf' ? 'PDF' : 'EPUB') : 'Shelf only'].filter(Boolean);
  const faces = [['', 'Shelf default'], ['cover', 'Cover'], ['spine', 'Spine']].map(([k, n]) => `<button class="chip ${(b.face || '') === k ? 'on' : ''}" data-face-book="${k}">${n}</button>`).join('');

  openSheet(`<div class="book-sheet">
    <div class="bs-top">
      <div class="bs-cover" style="--spine:${color}">${cover ? `<img src="${esc(cover)}" alt="">` : genCover(b, color, meta.textColorFor(color))}</div>
      <div class="bs-info"><h3>${esc(b.title)}</h3><p class="bs-author">${esc(b.author)}</p>
        <p class="bs-facts">${facts.map(esc).join(' · ')}</p>
        ${stars(b.rating || 0, 'big')}
        ${b.shelf === 'reading' ? `<div class="bar"><i style="width:${pct}%"></i></div><span class="muted small">${pct}% read</span>` : ''}
      </div>
    </div>
    <div class="bs-actions">${primary}</div>
    <div class="bs-section"><span class="label">Shelf</span><div class="chips">${moves}</div></div>
    <div class="bs-section"><span class="label">Show this book as</span><div class="chips">${faces}</div></div>
    ${b.hasFile && anns.length ? savedPlacesHtml(anns, { hl, marks, favs }) : ''}
    ${b.description ? `<details class="bs-desc"><summary>About this book</summary><p>${esc(b.description)}</p></details>` : ''}
    <div class="bs-list">
      <button data-b="edit">${icon('edit')} Edit details & spine colour</button>
      <button data-b="remove">${icon('library')} Remove from shelf (keep in Library)</button>
      <button data-b="delete" class="danger">${icon('trash')} Delete permanently from device</button>
    </div></div>`, {
    onMount: (sheet, close) => {
      sheet.addEventListener('click', async e => {
        const st = e.target.closest('[data-star]');
        if (st) {
          const r = +st.dataset.star;
          b.rating = b.rating === r ? 0 : r;
          await saveBook(b);
          $$('.star', sheet).forEach((s, i) => s.classList.toggle('on', i < b.rating));
          return;
        }
        const tab = e.target.closest('[data-saved-tab]');
        if (tab) {
          $$('[data-saved-tab]', sheet).forEach(t => t.classList.toggle('on', t === tab));
          $$('[data-saved-pane]', sheet).forEach(p => { p.hidden = p.dataset.savedPane !== tab.dataset.savedTab; });
          return;
        }
        const place = e.target.closest('[data-ann]');
        if (place) { const a = anns.find(x => x.id === place.dataset.ann); close(); openBook(id, a); return; }
        const fb = e.target.closest('[data-face-book]');
        if (fb) {
          b.face = fb.dataset.faceBook || null;
          await saveBook(b);
          $$('[data-face-book]', sheet).forEach(c => c.classList.toggle('on', c === fb));
          renderShelf(b.shelf);
          return;
        }
        const mv = e.target.closest('[data-move]');
        if (mv) { if (await moveBook(id, mv.dataset.move)) close(); return; }
        const a = e.target.closest('[data-b]');
        if (!a) return;
        const act = a.dataset.b;
        if (act === 'open') openBook(id);
        if (act === 'reread') { close(); rereadBook(id); }
        if (act === 'attach') { if (await attachFile(b)) { close(); openBookSheet(id); } }
        if (act === 'edit') { close(); openEdit(id); }
        if (act === 'remove') { close(); removeFromShelf(id); }
        if (act === 'delete') { if (await deleteBook(id)) close(); }
      });
    },
  });
}

// Highlights, bookmarks and liked pages under the book's details; tapping one opens the book right there.
function savedPlacesHtml(anns, counts) {
  const order = (x, y) => (x.page || 0) - (y.page || 0) || x.createdAt - y.createdAt;
  const hls = anns.filter(a => a.type === 'highlight').sort(order);
  const marks = anns.filter(a => a.type === 'bookmark').sort(order);
  const favs = anns.filter(a => a.type === 'fav').sort(order);
  const row = (a, kind) => kind === 'highlight'
    ? `<button class="saved-row" data-ann="${a.id}"><span class="saved-quote" style="--hl:${HL[a.color] || HL.yellow}">“${esc(a.text)}”</span>
        ${a.note ? `<span class="saved-note">${icon('note')} ${esc(a.note)}</span>` : ''}
        <small>${esc([a.chapter, typeof a.page === 'number' ? `p. ${a.page}` : ''].filter(Boolean).join(' · '))}</small></button>`
    : `<button class="saved-row" data-ann="${a.id}"><span class="saved-mark">${icon(kind === 'fav' ? 'heart' : 'bookmark')} ${esc(typeof a.page === 'number' ? `Page ${a.page}` : a.page || a.chapter || 'Saved page')}</span>
        ${a.text ? `<small>${esc(a.text.slice(0, 110))}…</small>` : ''}</button>`;
  const pane = (key, list, kind, empty) => `<div class="saved-pane" data-saved-pane="${key}" ${key === 'h' ? '' : 'hidden'}>${list.length ? list.map(a => row(a, kind)).join('') : `<p class="muted small">${empty}</p>`}</div>`;
  return `<div class="bs-section saved"><span class="label">Your places in this book</span>
    <div class="seg"><button class="on" data-saved-tab="h">Highlights (${counts.hl})</button><button data-saved-tab="b">Saved (${counts.marks})</button><button data-saved-tab="f">Liked (${counts.favs})</button></div>
    ${pane('h', hls, 'highlight', 'No highlights yet.')}${pane('b', marks, 'bookmark', 'No bookmarked pages yet.')}${pane('f', favs, 'fav', 'No liked pages yet.')}</div>`;
}
const HL = { yellow: '#ffd84d', green: '#86df8a', blue: '#78c3ff', pink: '#ff8db5', purple: '#c4a0ff' };

function openEdit(id) {
  const b = S.books.get(id);
  const color = b.spineColor || meta.hashColor(b.title);
  openSheet(`<div class="form">
    <h3>Edit book</h3>
    <label>Title<input name="title" value="${esc(b.title)}"></label>
    <label>Author<input name="author" value="${esc(b.author)}"></label>
    <label>Pages<input name="pages" type="number" min="1" value="${b.pages || ''}"></label>
    <label>Spine colour<div class="color-row"><input name="color" type="color" value="${color}">
      <button class="btn small ghost" data-c="auto">Pick from cover</button></div></label>
    <label>Cover<div class="color-row"><button class="btn small ghost" data-c="cover">${icon('upload')} Choose image</button><span class="muted small" data-cover-name></span></div></label>
    <div class="btn-row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-c="save">Save</button></div></div>`, {
    onMount: (sheet, close) => {
      let newCover = null;
      sheet.addEventListener('click', async e => {
        const c = e.target.closest('[data-c]');
        if (!c) return;
        if (c.dataset.c === 'auto') {
          const src = newCover || (await db.get('covers', id))?.blob || S.covers.get(id);
          const col = src ? await meta.dominantColor(src).catch(() => null) : null;
          if (col) $('[name=color]', sheet).value = col; else toast('Could not read colours from this cover');
        }
        if (c.dataset.c === 'cover') {
          const [f] = await pickFiles('image/*');
          if (f) { newCover = f; $('[data-cover-name]', sheet).textContent = f.name; }
        }
        if (c.dataset.c === 'save') {
          b.title = $('[name=title]', sheet).value.trim() || b.title;
          b.author = $('[name=author]', sheet).value.trim() || b.author;
          b.pages = parseInt($('[name=pages]', sheet).value, 10) || b.pages;
          b.spineColor = $('[name=color]', sheet).value;
          if (newCover) {
            await db.put('covers', { id, blob: newCover });
            S.covers.set(id, URL.createObjectURL(newCover));
          }
          await saveBook(b);
          renderAll();
          close();
          toast('Saved');
        }
      });
    },
  });
}

// ---------- importing ----------

function pickFiles(accept, multiple = false) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.multiple = multiple;
    input.onchange = () => resolve([...input.files]);
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BOOK_ACCEPT = '.epub,.pdf,application/epub+zip,application/pdf';

async function pickAndImport(shelf) {
  const files = await pickFiles(BOOK_ACCEPT, true);
  if (files.length) importFiles(files, shelf);
}

async function importFiles(files, shelf) {
  let lastId = null;
  for (const file of files) {
    const t = toast(`Opening ${file.name}…`, { ms: 120000 });
    try {
      const buf = await file.arrayBuffer();
      const pdf = meta.isPdf(file);
      const info = await meta.parseBookFile(file, buf, m => t.update(`${file.name}: ${m}…`));
      const existing = [...S.books.values()].find(b => !b.hasFile && norm(b.title) === norm(info.title));
      const id = existing ? existing.id : uid('b_');
      await db.put('files', { id, blob: new Blob([buf], { type: pdf ? 'application/pdf' : 'application/epub+zip' }) });
      let color = null;
      if (info.coverBlob && !(existing && S.covers.has(id) && S.covers.get(id).startsWith('blob:'))) {
        await db.put('covers', { id, blob: info.coverBlob });
        S.covers.set(id, URL.createObjectURL(info.coverBlob));
        color = await meta.dominantColor(info.coverBlob).catch(() => null);
      }
      let pages = info.pages;
      if (navigator.onLine && !existing?.pages && !pdf) {
        t.update(`${info.title}: looking up page count…`);
        const g = await Promise.race([meta.lookupPageCount(info.title, info.author), sleep(3500).then(() => 0)]);
        if (g > 0) pages = g;
      }
      const b = existing || { id, addedAt: Date.now(), rating: 0, readCount: 0, progress: 0, source: 'file' };
      Object.assign(b, {
        format: pdf ? 'pdf' : 'epub', sourceName: file.name, sourceSize: file.size,
        title: existing?.title || info.title, author: existing?.author || info.author,
        description: b.description || info.description,
        pages: existing?.pages || pages, hasFile: true,
        spineColor: color || b.spineColor || meta.hashColor(info.title),
      });
      if (!existing) setShelf(b, shelf);
      else if (shelf === 'reading') setShelf(b, 'reading');
      await saveBook(b);
      lastId = id;
      t.update(existing ? `Attached ${pdf ? 'PDF' : 'EPUB'} to "${b.title}"` : `Added "${b.title}"`);
      setTimeout(t.close, 1800);
    } catch (err) {
      console.error(err);
      t.update(`Couldn't read ${file.name} — is it a valid EPUB or PDF?`);
      setTimeout(t.close, 3500);
    }
  }
  saveLayouts();
  renderAll();
  if (lastId) goTo(S.books.get(lastId).shelf);
}

async function attachFile(b) {
  const [file] = await pickFiles(BOOK_ACCEPT);
  if (!file) return false;
  const t = toast('Reading book…', { ms: 60000 });
  try {
    const buf = await file.arrayBuffer();
    const pdf = meta.isPdf(file);
    const info = await meta.parseBookFile(file, buf);
    await db.put('files', { id: b.id, blob: new Blob([buf], { type: pdf ? 'application/pdf' : 'application/epub+zip' }) });
    b.format = pdf ? 'pdf' : 'epub';
    b.sourceName = file.name; b.sourceSize = file.size;
    if (!S.covers.has(b.id) && info.coverBlob) {
      await db.put('covers', { id: b.id, blob: info.coverBlob });
      S.covers.set(b.id, URL.createObjectURL(info.coverBlob));
    }
    b.hasFile = true;
    b.pages = b.pages || info.pages;
    await saveBook(b);
    t.update('Book file attached'); setTimeout(t.close, 1500);
    renderAll();
    return true;
  } catch (e) {
    t.update('That file could not be read as an EPUB or PDF'); setTimeout(t.close, 3000);
    return false;
  }
}

function openAdd() {
  openSheet(`<div class="add-sheet"><h3>Add books</h3>
    <button class="add-opt" data-add="find">${icon('library')}<span><strong>Find books on this device</strong><small>${window.showDirectoryPicker ? 'Scan a folder (like Downloads) for EPUB and PDF files' : 'Pick several EPUB and PDF files at once'}</small></span></button>
    <button class="add-opt" data-add="reading">${icon('open')}<span><strong>Import EPUB or PDF to start reading</strong><small>Goes on your Reading shelf</small></span></button>
    <button class="add-opt" data-add="tbr">${icon('file')}<span><strong>Import EPUB or PDF for later</strong><small>Goes on your TBR shelf</small></span></button>
    <button class="add-opt" data-add="read">${icon('check')}<span><strong>Import a book I've finished</strong><small>Goes on your Read shelf</small></span></button>
    <button class="add-opt" data-add="search">${icon('globe')}<span><strong>Search books online</strong><small>Add to Read or TBR without a file — cover, author & pages from Google Books / Open Library</small></span></button>
  </div>`, {
    onMount: (sheet, close) => sheet.addEventListener('click', e => {
      const o = e.target.closest('[data-add]');
      if (!o) return;
      close();
      if (o.dataset.add === 'search') openSearch();
      else if (o.dataset.add === 'find') findOnDevice();
      else pickAndImport(o.dataset.add);
    }),
  });
}

// ---------- online search ----------

function openSearch() {
  openSheet(`<div class="search-sheet">
    <h3>Find a book</h3>
    <form class="search-form"><span>${icon('search')}</span><input type="search" placeholder="Title, author or ISBN" enterkeyhint="search" autocomplete="off"></form>
    <p class="muted small">Books added from search can go on Read or TBR. To read one in the app, attach its EPUB later.</p>
    <div class="results"></div></div>`, {
    wide: true, className: 'tall',
    onMount: (sheet) => {
      const input = $('input', sheet), results = $('.results', sheet);
      let found = [], timer = 0, seq = 0;
      setTimeout(() => input.focus(), 280);
      const run = async () => {
        const q = input.value.trim();
        if (q.length < 2) { results.innerHTML = ''; return; }
        const my = ++seq;
        results.innerHTML = `<div class="loading">Searching…</div>`;
        try {
          found = await meta.searchBooks(q);
          if (my !== seq) return;
          results.innerHTML = found.length ? found.map((r, i) => `<div class="result">
            <div class="r-cover">${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy">` : `<div class="gen-cover small" style="background:${meta.hashColor(r.title)}"><span class="gc-title">${esc(r.shortTitle)}</span></div>`}</div>
            <div class="r-info"><strong>${esc(r.title)}</strong><span>${esc(r.author)}</span>
              <small>${[r.pages ? r.pages + ' pages' : '', r.published.slice(0, 4)].filter(Boolean).join(' · ')}</small>
              <div class="r-btns"><button class="btn small ghost" data-r="${i}" data-to="read">${icon('check')} Read</button>
              <button class="btn small ghost" data-r="${i}" data-to="tbr">${icon('plus')} TBR</button></div></div></div>`).join('')
            : `<div class="loading">No books found.</div>`;
        } catch (err) {
          if (my === seq) results.innerHTML = `<div class="loading">${navigator.onLine ? 'Search failed, try again.' : 'You are offline. Search needs internet.'}</div>`;
        }
      };
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 380); });
      $('form', sheet).addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); run(); input.blur(); });
      results.addEventListener('click', async e => {
        const btn = e.target.closest('[data-r]');
        if (!btn) return;
        btn.disabled = true;
        await addFromSearch(found[+btn.dataset.r], btn.dataset.to);
        btn.innerHTML = `${icon('check')} Added`;
      });
    },
  });
}

async function addFromSearch(r, shelf) {
  const id = uid('b_');
  const b = {
    id, title: r.shortTitle, author: r.author, pages: r.pages, description: r.description,
    addedAt: Date.now(), rating: 0, readCount: shelf === 'read' ? 1 : 0, progress: shelf === 'read' ? 1 : 0,
    hasFile: false, source: 'google', googleId: r.googleId, coverUrl: r.cover || '',
    finishedAt: shelf === 'read' ? Date.now() : null,
  };
  let blob = null;
  for (const url of [r.coverLarge, r.cover].filter(Boolean)) {
    blob = await meta.fetchBlob(url);
    if (blob && blob.size > 1500) break;
  }
  if (blob) {
    await db.put('covers', { id, blob });
    S.covers.set(id, URL.createObjectURL(blob));
    b.spineColor = await meta.dominantColor(blob).catch(() => null);
  } else if (r.cover) {
    S.covers.set(id, r.cover);
    b.spineColor = await meta.dominantColor(r.cover).catch(() => null);
  }
  b.spineColor = b.spineColor || meta.hashColor(b.title);
  setShelf(b, shelf);
  await saveBook(b); saveLayouts();
  renderAll();
  toast(`"${b.title}" added to ${SHELF_LABEL[shelf]}`);
}

// ---------- customize ----------

function openCustomize() {
  const p = S.prefs;
  const sw = (group, map, cur, cssFn) => Object.entries(map).map(([k, v]) =>
    `<button class="swatch ${cur === k ? 'on' : ''}" data-${group}="${k}" title="${v.name}"><i style="background:${cssFn(v)}"></i><span>${v.name}</span></button>`).join('');
  openSheet(`<div class="customize">
    <h3>Make it yours</h3>
    <span class="label">Shelf wood</span>
    <div class="swatches">${sw('wood', WOODS, p.wood, v => `linear-gradient(180deg, ${v.hi}, ${v.mid} 55%, ${v.lo})`)}</div>
    <span class="label">Back wall</span>
    <div class="swatches">${sw('wall', WALLS, p.wall, v => v.glass ? 'linear-gradient(135deg,rgba(255,255,255,.5),rgba(120,140,170,.35))' : v.wood ? `repeating-linear-gradient(90deg, rgba(0,0,0,.35) 0 1px, transparent 1px 15px), linear-gradient(90deg, rgba(255,255,255,.08), rgba(0,0,0,.15)), ${v.bg}` : v.bg)}</div>
    <span class="label">Backdrop</span>
    <div class="swatches">${sw('backdrop', BACKDROPS, p.backdrop, v => v.css || 'repeating-linear-gradient(45deg,#888 0 4px,#aaa 4px 8px)')}</div>
    <span class="label">Room light <small class="muted">— dim it and let the candles glow</small></span>
    <input type="range" min="0.3" max="1" step="0.01" value="${p.roomLight}" data-range="roomLight">
    <span class="label">Book size</span>
    <input type="range" min="0.75" max="1.35" step="0.05" value="${p.bookSize}" data-range="bookSize">
    <span class="label">Ambience</span>
    <div class="chips">${Object.entries(SOUND_NAMES).map(([k, n]) => `<button class="chip ${p.sound === k ? 'on' : ''}" data-sound="${k}">${n}</button>`).join('')}</div>
    <div class="vol-row">${icon('sound')}<input type="range" min="0" max="1" step="0.01" value="${p.volume}" data-range="volume"></div>
    <label class="toggle"><input type="checkbox" data-toggle="dust" ${p.dust ? 'checked' : ''}><span>Floating dust in the candlelight</span></label>
    <label class="toggle"><input type="checkbox" data-toggle="titles" ${p.titles ? 'checked' : ''}><span>Show shelf titles</span></label>
    <span class="label">Books facing</span>
    <div class="chips">${SHELVES.map(s => `<button class="chip" data-face="${s.key}">${s.label}: ${p.view[s.key] === 'cover' ? 'Covers' : 'Spines'}</button>`).join('')}</div>
  </div>`, {
    onMount: (sheet) => {
      sheet.addEventListener('click', async e => {
        const t = e.target.closest('button');
        if (!t) return;
        for (const g of ['wood', 'wall', 'backdrop']) {
          if (t.dataset[g]) {
            if (g === 'backdrop' && t.dataset[g] === 'custom') {
              const [f] = await pickFiles('image/*');
              if (!f) return;
              await db.setSetting('backdropImage', f);
              if (S.backdropUrl) URL.revokeObjectURL(S.backdropUrl);
              S.backdropUrl = URL.createObjectURL(f);
            }
            p[g] = t.dataset[g];
            $$(`[data-${g}]`, sheet).forEach(b => b.classList.toggle('on', b === t));
            applyTheme(); savePrefs();
          }
        }
        if (t.dataset.sound) {
          p.sound = t.dataset.sound;
          $$('[data-sound]', sheet).forEach(b => b.classList.toggle('on', b === t));
          setSound(p.sound, p.volume); savePrefs();
        }
        if (t.dataset.face) {
          const k = t.dataset.face;
          p.view[k] = p.view[k] === 'cover' ? 'spine' : 'cover';
          t.textContent = `${SHELF_LABEL[k]}: ${p.view[k] === 'cover' ? 'Covers' : 'Spines'}`;
          savePrefs(); renderShelf(k); setCurrent(S.current);
        }
      });
      sheet.addEventListener('input', e => {
        const r = e.target.dataset.range;
        if (!r) return;
        p[r] = parseFloat(e.target.value);
        if (r === 'roomLight') applyTheme();
        if (r === 'volume') setVolume(p.volume);
      });
      sheet.addEventListener('change', e => {
        const r = e.target.dataset.range, tg = e.target.dataset.toggle;
        if (r === 'bookSize') renderAll();
        if (tg) { p[tg] = e.target.checked; applyTheme(); if (tg === 'dust') renderAll(); }
        savePrefs();
      });
    },
  });
}

// ---------- menu, library, backup ----------

function openMenu() {
  const off = booksOn('none').length;
  openSheet(`<div class="menu-sheet">
    <button data-m="library">${icon('library')}<span>Library<small>${off} book${off === 1 ? '' : 's'} off the shelves</small></span></button>
    <button data-m="find">${icon('search')}<span>Find books on this device<small>${window.showDirectoryPicker ? 'Scan a folder for EPUB and PDF files' : 'Pick several EPUB and PDF files at once'}</small></span></button>
    <button data-m="widget">${icon('covers')}<span>Shelf widget<small>A small view of 3–4 rows of one shelf</small></span></button>
    <button data-m="name">${icon('edit')}<span>Your name<small>${S.profile && S.profile.name ? esc(S.profile.name) : 'Not set'}</small></span></button>
    <button data-m="export">${icon('download')}<span>Back up library<small>Books, EPUBs, notes & layout in one .zip</small></span></button>
    <button data-m="import">${icon('upload')}<span>Restore from backup</span></button>
    ${S.installEvent ? `<button data-m="install">${icon('install')}<span>Install Fable as an app</span></button>` : ''}
    <button data-m="cloud">${icon('globe')}<span>Cloud sync<small>${cloudLine()}</small></span></button>
    <button data-m="about">${icon('flame')}<span>About Fable<small>${currentUser() ? 'Synced to your account' : 'Everything stays on this device'}</small></span></button>
  </div>`, {
    onMount: (sheet, close) => sheet.addEventListener('click', async e => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      close();
      if (m === 'library') openLibrary();
      if (m === 'find') findOnDevice();
      if (m === 'widget') openWidgetSetup();
      if (m === 'name') openWelcome(true);
      if (m === 'cloud') openCloud();
      if (m === 'export') exportBackup();
      if (m === 'import') importBackup();
      if (m === 'install') { S.installEvent.prompt(); S.installEvent = null; }
      if (m === 'about') openSheet(`<div class="confirm"><h3>Fable</h3><p>A cozy bookshelf and EPUB reader. Your books, highlights and notes are stored only in this browser on this device. Use Back up library to keep a copy or move to another device.</p><div class="btn-row"><button class="btn primary" data-close>Lovely</button></div></div>`);
    }),
  });
}

function openLibrary() {
  const list = [...S.books.values()].sort((a, b) => a.title.localeCompare(b.title));
  const row = b => `<div class="lib-row" data-id="${b.id}">
    <div class="lib-cover" style="background:${b.spineColor || '#555'}">${S.covers.get(b.id) ? `<img src="${esc(S.covers.get(b.id))}" alt="">` : ''}</div>
    <div class="lib-info"><strong>${esc(b.title)}</strong><span>${esc(b.author)} · ${SHELF_LABEL[b.shelf]}</span></div>
    ${b.shelf === 'none' ? `<button class="btn small ghost" data-put="${b.id}">Put on shelf</button>` : ''}
  </div>`;
  openSheet(`<div class="library"><h3>Library</h3>
    ${list.length ? '' : '<p class="muted">No books yet.</p>'}
    ${booksOn('none').length ? `<span class="label">Off the shelves</span>${booksOn('none').map(row).join('')}` : ''}
    ${list.filter(b => b.shelf !== 'none').length ? `<span class="label">On your shelves</span>${list.filter(b => b.shelf !== 'none').map(row).join('')}` : ''}
  </div>`, {
    wide: true, className: 'tall',
    onMount: (sheet, close) => sheet.addEventListener('click', async e => {
      const put = e.target.closest('[data-put]');
      if (put) {
        const b = S.books.get(put.dataset.put);
        close();
        openSheet(`<div class="confirm"><h3>Put "${esc(b.title)}" on…</h3><div class="chips">${['read', 'reading', 'tbr'].map(s => `<button class="chip" data-to="${s}">${SHELF_LABEL[s]}</button>`).join('')}</div></div>`, {
          onMount: (s2, c2) => s2.addEventListener('click', async ev => { const to = ev.target.closest('[data-to]'); if (to) { c2(); await moveBook(b.id, to.dataset.to); } }),
        });
        return;
      }
      const r = e.target.closest('.lib-row');
      if (r) { close(); openBookSheet(r.dataset.id); }
    }),
  });
}

async function exportBackup() {
  const t = toast('Packing your library…', { ms: 120000 });
  try {
    const zip = new JSZip();
    const [books, anns, files, covers, settings] = await Promise.all(['books', 'annotations', 'files', 'covers', 'settings'].map(s => db.all(s)));
    zip.file('library.json', JSON.stringify({ app: 'nook', version: 1, exportedAt: new Date().toISOString(), books, annotations: anns, settings: settings.filter(s => !(s.value instanceof Blob)) }, null, 1));
    files.forEach(f => zip.file(`files/${f.id}.${f.blob.type === 'application/pdf' ? 'pdf' : 'epub'}`, f.blob));
    covers.forEach(c => zip.file(`covers/${c.id}`, c.blob));
    settings.filter(s => s.value instanceof Blob).forEach(s => zip.file(`settings/${s.key}`, s.value));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fable-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    t.update('Backup saved'); setTimeout(t.close, 2000);
  } catch (e) { console.error(e); t.update('Backup failed'); setTimeout(t.close, 3000); }
}

async function importBackup() {
  const [f] = await pickFiles('.zip,application/zip');
  if (!f) return;
  const ok = await confirmSheet({ title: 'Restore backup?', text: 'Books from the backup will be added to this device. Books with the same ID will be replaced, and your shelf layout and settings will come from the backup.', ok: 'Restore' });
  if (!ok) return;
  const t = toast('Restoring…', { ms: 120000 });
  try {
    const zip = await JSZip.loadAsync(f);
    const lib = JSON.parse(await zip.file('library.json').async('string'));
    for (const b of lib.books) await db.put('books', b);
    for (const a of lib.annotations || []) await db.put('annotations', a);
    for (const s of lib.settings || []) await db.put('settings', s);
    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const [dir, name] = path.split('/');
      if (dir === 'files') await db.put('files', { id: name.replace(/\.(epub|pdf)$/, ''), blob: new Blob([await entry.async('arraybuffer')], { type: /\.pdf$/.test(name) ? 'application/pdf' : 'application/epub+zip' }) });
      if (dir === 'covers') await db.put('covers', { id: name, blob: await entry.async('blob') });
      if (dir === 'settings') await db.setSetting(name, await entry.async('blob'));
    }
    t.update('Restored — reloading'); setTimeout(() => location.reload(), 900);
  } catch (e) { console.error(e); t.update('That backup could not be read'); setTimeout(t.close, 3000); }
}

// ---------- greeting & name ----------

function greetingWord() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Cozy late-night reading';
}

function renderGreeting() {
  const el = $('#greeting');
  if (!el) return;
  const name = S.profile && S.profile.name;
  const word = greetingWord();
  el.innerHTML = name
    ? `<span class="g-name">Hi ${esc(name)},</span> <span class="g-time">${word.charAt(0).toLowerCase() + word.slice(1)}</span>`
    : `<span class="g-time">${word}</span>`;
}

function openWelcome(editing = false) {
  const name = (S.profile && S.profile.name) || '';
  openSheet(`<div class="confirm welcome">
    ${editing ? '<h3>Your name</h3>' : `<span class="welcome-mark">${icon('flame')}</span><h3>Welcome to Fable</h3><p>Your cozy shelf for every book you've read, are reading, and want to read.</p>`}
    <label class="muted small">What should we call you?</label>
    <input type="text" value="${esc(name)}" placeholder="Your name" autocomplete="given-name" maxlength="40">
    <div class="btn-row">${editing ? '<button class="btn ghost" data-close>Cancel</button>' : ''}<button class="btn primary" data-save>${editing ? 'Save' : "Let's begin"}</button></div></div>`, {
    onMount: (sheet, close) => {
      const input = $('input', sheet);
      setTimeout(() => input.focus(), 300);
      const save = async () => {
        S.profile = { ...(S.profile || {}), name: input.value.trim() };
        await db.setSetting('profile', S.profile);
        renderGreeting();
        close();
        if (!editing) {
          toast(`${greetingWord()}${S.profile.name ? ', ' + S.profile.name : ''}! Let's fill your shelves.`, { ms: 4000 });
          setTimeout(() => offerFind(), 900);
        }
      };
      $('[data-save]', sheet).onclick = save;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    },
  });
}

function offerFind() {
  openSheet(`<div class="confirm"><h3>Already have books?</h3>
    <p>${window.showDirectoryPicker ? 'Fable can look through a folder on this device (like Downloads or Books) and show every EPUB and PDF it finds, so you can add them in one go.' : 'Pick all the EPUB and PDF files you want from your phone in one go and they all go onto your shelves.'}</p>
    <div class="btn-row"><button class="btn ghost" data-close>Later</button><button class="btn primary" data-go>${icon('search')} Find my books</button></div></div>`, {
    onMount: (sheet, close) => { $('[data-go]', sheet).onclick = () => { close(); findOnDevice(); }; },
  });
}

// ---------- finding books already on the device ----------
// Browsers can't read storage on their own, so the user picks a folder once.
// Where supported (desktop Chrome/Edge) the folder is remembered and re-checked on every launch.

const fileKey = f => `${f.name}|${f.size}`;
const knownFiles = () => new Set([...S.books.values()].filter(b => b.sourceName).map(b => `${b.sourceName}|${b.sourceSize}`));

async function findOnDevice() {
  let files = [];
  if (window.showDirectoryPicker) {
    let dir;
    try { dir = await window.showDirectoryPicker({ id: 'fable-books', mode: 'read', startIn: 'downloads' }); }
    catch (e) { return; }
    await db.setSetting('sync:libraryFolder', dir, { silent: true });
    const t = toast('Looking for books…', { ms: 60000 });
    files = await scanDir(dir);
    t.close();
  } else {
    // Phones can't hand a website a whole folder reliably, so pick the books themselves (select many at once).
    files = await pickFiles(BOOK_ACCEPT, true);
    if (!files.length) return;
  }
  showFound(files);
}

async function scanDir(dir, depth = 0, out = []) {
  for await (const entry of dir.values()) {
    if (out.length > 2000) break;
    if (entry.kind === 'file' && /\.(epub|pdf)$/i.test(entry.name)) out.push(await entry.getFile());
    else if (entry.kind === 'directory' && depth < 4 && !entry.name.startsWith('.')) await scanDir(entry, depth + 1, out);
  }
  return out;
}

async function rescanFolder() {
  const dir = await db.getSetting('sync:libraryFolder');
  if (!dir || !dir.queryPermission) return;
  try {
    if (await dir.queryPermission({ mode: 'read' }) !== 'granted') return;
    const known = knownFiles();
    const fresh = (await scanDir(dir)).filter(f => !known.has(fileKey(f)));
    if (fresh.length) toast(`${fresh.length} new book${fresh.length > 1 ? 's' : ''} found in your folder`, { action: 'Show', onAction: () => showFound(fresh), ms: 8000 });
  } catch (e) { /* folder moved or permission revoked */ }
}

function showFound(files) {
  const known = knownFiles();
  const fresh = files.filter(f => !known.has(fileKey(f)));
  if (!files.length) { toast('No EPUB or PDF files found there'); return; }
  if (!fresh.length) { toast('All books there are already on your shelves'); return; }
  fresh.sort((a, b) => a.name.localeCompare(b.name));
  openSheet(`<div class="found"><h3>Found ${fresh.length} book${fresh.length > 1 ? 's' : ''}</h3>
    <div class="found-tools"><label class="toggle small"><input type="checkbox" data-all checked><span>Select all</span></label>
      <span class="muted small">Add to</span><div class="chips">${['tbr', 'reading', 'read'].map((s, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-to="${s}">${SHELF_LABEL[s]}</button>`).join('')}</div></div>
    <div class="found-list">${fresh.map((f, i) => `<label class="found-row"><input type="checkbox" data-i="${i}" checked>
      <span class="found-badge ${meta.isPdf(f) ? 'pdf' : ''}">${meta.isPdf(f) ? 'PDF' : 'EPUB'}</span>
      <span class="found-name">${esc(f.name.replace(/\.(epub|pdf)$/i, ''))}</span><small>${(f.size / 1048576).toFixed(1)} MB</small></label>`).join('')}</div>
    <div class="btn-row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-add-found>Add selected</button></div></div>`, {
    wide: true, className: 'tall',
    onMount: (sheet, close) => {
      let to = 'tbr';
      sheet.addEventListener('click', e => {
        const c = e.target.closest('[data-to]');
        if (c) { to = c.dataset.to; $$('[data-to]', sheet).forEach(x => x.classList.toggle('on', x === c)); }
      });
      $('[data-all]', sheet).onchange = e => $$('[data-i]', sheet).forEach(x => { x.checked = e.target.checked; });
      $('[data-add-found]', sheet).onclick = () => {
        const chosen = $$('[data-i]', sheet).filter(x => x.checked).map(x => fresh[+x.dataset.i]);
        close();
        if (chosen.length) importFiles(chosen, to);
      };
    },
  });
}

// ---------- shelf widget ----------
// A web app can't place a live widget on the phone's home screen, so this is a compact
// page showing just a few rows of one shelf that can be pinned as its own shortcut.

function openWidgetSetup() {
  let shelf = 'read', rows = 4;
  const url = () => `${location.origin}${location.pathname}?widget=${shelf}&rows=${rows}`;
  openSheet(`<div class="confirm widget-setup"><h3>Shelf widget</h3>
    <p>A compact view of one shelf — just the rows you choose, no buttons. Open it and add it to your home screen to keep your shelf one tap away.</p>
    <span class="label">Shelf</span><div class="chips">${SHELVES.map(s => `<button class="chip ${s.key === shelf ? 'on' : ''}" data-ws="${s.key}">${s.label}</button>`).join('')}</div>
    <span class="label">Rows</span><div class="chips">${[3, 4].map(n => `<button class="chip ${n === rows ? 'on' : ''}" data-wr="${n}">${n} rows</button>`).join('')}</div>
    <p class="muted small">Phones only allow real live home-screen widgets for apps from the Play Store or App Store. This view updates every time you open it.</p>
    <div class="btn-row"><button class="btn ghost" data-close>Close</button><button class="btn primary" data-open-widget>${icon('open')} Open widget view</button></div></div>`, {
    onMount: (sheet, close) => sheet.addEventListener('click', e => {
      const s = e.target.closest('[data-ws]'), r = e.target.closest('[data-wr]');
      if (s) { shelf = s.dataset.ws; $$('[data-ws]', sheet).forEach(x => x.classList.toggle('on', x === s)); }
      if (r) { rows = +r.dataset.wr; $$('[data-wr]', sheet).forEach(x => x.classList.toggle('on', x === r)); }
      if (e.target.closest('[data-open-widget]')) { close(); location.href = url(); }
    }),
  });
}

// ---------- cloud sync ----------

function cloudLine() {
  if (!cloudConfigured()) return 'Not set up yet';
  const u = currentUser();
  if (!u) return 'Sign in to sync across devices';
  const st = syncStatus();
  if (st.state === 'error') return 'Sync problem — tap for details';
  if (st.state === 'syncing') return 'Syncing…';
  return `${u.email}${st.at ? ' · synced ' + new Date(st.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`;
}

function openCloud() {
  if (!cloudConfigured()) {
    openSheet(`<div class="confirm"><h3>Cloud sync</h3><p>Cloud sync isn't connected for this copy of Fable yet. Your books are saved on this device; use Back up library to keep a copy.</p><div class="btn-row"><button class="btn primary" data-close>OK</button></div></div>`);
    return;
  }
  const u = currentUser();
  if (!u) {
    openSheet(`<div class="confirm cloud"><h3>Sync across devices</h3>
      <p>Sign in with your email. We'll send you a link — open it on this device and your shelves, books, highlights and notes will sync to your account.</p>
      <input type="email" placeholder="you@example.com" autocomplete="email" inputmode="email">
      <div class="btn-row"><button class="btn ghost" data-close>Not now</button><button class="btn primary" data-send>Email me a sign-in link</button></div></div>`, {
      onMount: (sheet, close) => {
        const input = $('input', sheet);
        setTimeout(() => input.focus(), 250);
        $('[data-send]', sheet).onclick = async e => {
          const email = input.value.trim();
          if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Enter a valid email'); return; }
          e.target.disabled = true;
          try { await signIn(email); close(); toast(`Sign-in link sent to ${email}`, { ms: 6000 }); }
          catch (err) { e.target.disabled = false; toast(err.message || 'Could not send the link'); }
        };
      },
    });
    return;
  }
  const st = syncStatus();
  openSheet(`<div class="confirm cloud"><h3>Cloud sync</h3>
    <p>Signed in as <strong>${esc(u.email)}</strong>.<br>${st.state === 'error' ? `Last sync failed: ${esc(st.error)}` : st.at ? `Last synced at ${new Date(st.at).toLocaleTimeString()}.` : 'Syncing in the background.'}</p>
    <p class="muted small">Shelves, layout, decor, ratings, highlights, notes, covers and EPUB files sync automatically. EPUBs download to a new device when you open them.</p>
    <div class="btn-row"><button class="btn ghost" data-out>Sign out</button><button class="btn primary" data-now>${icon('reread')} Sync now</button></div></div>`, {
    onMount: (sheet, close) => {
      $('[data-now]', sheet).onclick = async e => {
        e.target.disabled = true;
        await syncNow();
        const s2 = syncStatus();
        toast(s2.state === 'error' ? `Sync failed: ${s2.error}` : 'All synced');
        close();
      };
      $('[data-out]', sheet).onclick = async () => { await signOut(); close(); toast('Signed out — your books stay on this device'); };
    },
  });
}

// ---------- go ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
