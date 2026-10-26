// Reading mode: epub.js rendition with themes, fonts, flip/scroll, highlights, notes and favourite pages.
import { db, uid } from './db.js';
import { icon, esc, $, $$, openSheet, toast, promptSheet, stars, closeAllSheets, sheetOpen, closeSheet, stepper, stepValue, placeBelow } from './ui.js';

const PAGE_THEMES = {
  paper: { name: 'Paper', bg: '#fbf7ef', fg: '#2b2520', link: '#8a4b2a' },
  white: { name: 'White', bg: '#ffffff', fg: '#1b1b1b', link: '#2a5db0' },
  sepia: { name: 'Sepia', bg: '#f1e3c6', fg: '#4a3824', link: '#8a4b2a' },
  sage:  { name: 'Sage',  bg: '#e2e9d8', fg: '#2c3627', link: '#3f6b34' },
  dusk:  { name: 'Dusk',  bg: '#383b42', fg: '#e4e1da', link: '#f0b27a', dark: true },
  night: { name: 'Night', bg: '#18191c', fg: '#c9c4ba', link: '#e6a96b', dark: true },
  black: { name: 'Black', bg: '#000000', fg: '#a9a59d', link: '#c99a62', dark: true },
  custom:{ name: 'Custom' },
};
const FONTS = {
  publisher: { name: 'Original', css: '' },
  serif:     { name: 'Georgia', css: "Georgia, 'Iowan Old Style', serif" },
  literata:  { name: 'Literata', css: "'Literata', Georgia, serif", gf: 'Literata:ital,wght@0,400;0,600;1,400' },
  garamond:  { name: 'Garamond', css: "'EB Garamond', Garamond, serif", gf: 'EB+Garamond:ital,wght@0,400;0,600;1,400' },
  sans:      { name: 'Sans', css: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif", gf: 'Inter:wght@400;600' },
  easy:      { name: 'Easy read', css: "'Atkinson Hyperlegible', Verdana, sans-serif", gf: 'Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400' },
};
const HL_COLORS = { yellow: '#ffd84d', green: '#86df8a', blue: '#78c3ff', pink: '#ff8db5', purple: '#c4a0ff' };
const DEFAULTS = { theme: 'paper', bg: '#fbf7ef', fg: '#2b2520', font: 'publisher', size: 100, lineHeight: 1.6, brightness: 1, warmth: 0, flow: 'paginated', spread: 'auto', justify: true, margin: 1 };

let R = null; // active reader session

export const readerOpen = () => !!R;

export async function openReader(opts) {
  if (R) await closeReader();
  const prefs = { ...DEFAULTS, ...(opts.prefs || {}) };
  const el = document.createElement('div');
  el.className = 'reader chrome';
  el.innerHTML = `
    <header class="r-top">
      <button class="icon-btn" data-r="close" title="Back to shelf">${icon('back')}</button>
      <div class="r-title"><strong>${esc(opts.book.title)}</strong><span class="r-chapter"></span></div>
      <button class="icon-btn" data-r="toc" title="Contents">${icon('toc')}</button>
      <button class="icon-btn" data-r="notes" title="Highlights, notes & favourites">${icon('note')}</button>
      <button class="icon-btn mark-btn" data-r="bookmark" title="Bookmark this page">${icon('bookmark')}</button>
      <button class="icon-btn fav-btn" data-r="fav" title="Favourite this page">${icon('heart')}</button>
      <button class="icon-btn" data-r="settings" title="Reading settings">${icon('type')}</button>
    </header>
    <div class="r-stage"><div class="r-view"></div>
      <button class="r-edge left" data-r="prev" aria-label="Previous page"></button>
      <button class="r-edge right" data-r="next" aria-label="Next page"></button>
      <div class="r-loading"><div class="spinner"></div><span>Opening book…</span></div>
    </div>
    <footer class="r-bottom">
      <button class="icon-btn" data-r="zoomOut" title="Zoom out">${icon('zoomOut')}</button>
      <button class="icon-btn" data-r="prev" title="Previous">${icon('left')}</button>
      <div class="r-progress"><input type="range" min="0" max="1000" value="0" disabled><span class="r-page">—</span></div>
      <button class="icon-btn" data-r="next" title="Next">${icon('right')}</button>
      <button class="icon-btn" data-r="zoomIn" title="Zoom in">${icon('zoomIn')}</button>
    </footer>
    <div class="r-sel">
      <span class="sel-label">${icon('highlight')} Highlight</span>
      ${Object.entries(HL_COLORS).map(([k, c]) => `<button class="hl-dot" data-hl="${k}" style="background:${c}" aria-label="Highlight ${k}"></button>`).join('')}
      <span class="sep"></span>
      <button class="icon-btn" data-r="addnote" title="Add note">${icon('note')}</button>
      <button class="icon-btn" data-r="copy" title="Copy">${icon('copy')}</button>
      <button class="icon-btn" data-r="selx" title="Close">${icon('x')}</button>
    </div>
    <div class="r-dim"></div><div class="r-warm"></div>
    <div class="r-finish"></div>`;
  document.body.appendChild(el);
  document.body.classList.add('reading');

  R = { ...opts, rec: opts.book, bookRecord() { return this.rec; }, prefs, el, view: $('.r-view', el), book: null, rendition: null, anns: [], loc: null, navigated: false, finished: false, sel: null, saveT: 0, chromeT: 0 };
  history.pushState({ reader: true }, '');
  window.addEventListener('popstate', onPop);
  window.addEventListener('keydown', onKey);
  el.addEventListener('click', onReaderClick);
  $('.r-progress input', el).addEventListener('change', onSeek);
  $('.r-progress input', el).addEventListener('input', onSeekPreview);
  applyChrome();

  try {
    R.book = ePub(await opts.blob.arrayBuffer());
    await R.book.ready;
    R.anns = await db.byIndex('annotations', 'bookId', opts.book.id);
    await createRendition(opts.book.lastCfi || undefined);
    loadLocations();
  } catch (e) {
    console.error(e);
    toast('This book could not be opened');
    closeReader();
  }
}

async function createRendition(target) {
  if (R.rendition) R.rendition.destroy();
  R.view.innerHTML = '';
  const flow = R.prefs.flow;
  R.el.classList.toggle('scrolled', flow !== 'paginated');
  R.el.classList.toggle('chapter', flow === 'chapter');
  const rendition = R.book.renderTo(R.view, flow === 'scrolled'
    ? { width: '100%', height: '100%', flow: 'scrolled', manager: 'continuous' }
    : flow === 'chapter'
      // One whole chapter scrolls top to bottom; swipe or arrows move between chapters.
      ? { width: '100%', height: '100%', flow: 'scrolled-doc' }
      : { width: '100%', height: '100%', flow: 'paginated', spread: R.prefs.spread === 'single' ? 'none' : 'auto', minSpreadWidth: 900 });
  R.rendition = rendition;
  rendition.hooks.content.register(contents => styleContents(contents));
  rendition.on('relocated', onRelocated);
  rendition.on('rendered', section => { R.sectionIndex = section.index; });
  rendition.on('selected', onSelected);
  rendition.on('click', onContentClick);
  rendition.on('keyup', onKey);
  rendition.on('touchstart', onTouchStart);
  rendition.on('touchmove', onTouchMove);
  rendition.on('touchend', onTouchEnd);
  rendition.on('markClicked', (cfiRange) => { const a = R.anns.find(x => x.cfi === cfiRange); if (a) openAnnotation(a); });
  await rendition.display(target);
  $('.r-loading', R.el).classList.add('done');
  R.anns.filter(a => a.type === 'highlight').forEach(drawHighlight);
  hideChromeSoon();
}

// ---------- styles inside the book ----------

function pageColors() {
  const p = R.prefs;
  if (p.theme === 'custom') return { bg: p.bg, fg: p.fg, link: p.fg, dark: luminance(p.bg) < 0.45 };
  return PAGE_THEMES[p.theme] || PAGE_THEMES.paper;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
}

function styleContents(contents) {
  const doc = contents.document;
  if (!doc || !doc.head) return;
  const p = R.prefs, c = pageColors(), f = FONTS[p.font] || FONTS.publisher;
  let style = doc.getElementById('nook-style');
  if (!style) { style = doc.createElement('style'); style.id = 'nook-style'; doc.head.appendChild(style); }
  if (f.gf && !doc.getElementById('nook-font-' + p.font)) {
    const link = doc.createElement('link');
    link.id = 'nook-font-' + p.font; link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${f.gf}&display=swap`;
    doc.head.appendChild(link);
  }
  const text = 'p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6, em, strong, i, b, td, th, dd, dt, small, cite, figcaption, section, article, aside, sup, sub, font';
  style.textContent = `
    html, body { background: ${c.bg} !important; }
    body { color: ${c.fg} !important; font-size: ${p.size}% !important; ${p.justify ? 'text-align: justify; hyphens: auto; -webkit-hyphens: auto;' : ''} }
    ${text} { color: inherit !important; background-color: transparent !important; }
    a, a * { color: ${c.link} !important; }
    p, li, blockquote, dd { line-height: ${p.lineHeight} !important; }
    ${f.css ? `${text}, body, a { font-family: ${f.css} !important; }` : ''}
    ${c.dark ? 'img, svg image { filter: brightness(.85) contrast(1.05); }' : ''}
    ::selection { background: rgba(255, 196, 0, .38); }
    img { max-width: 100% !important; height: auto; }`;
}

function restyle() {
  if (!R || !R.rendition) return;
  R.rendition.getContents().forEach(styleContents);
  applyChrome();
  const cfi = R.loc && R.loc.start.cfi;
  // Let reflow settle, then return to the same spot.
  clearTimeout(R.restyleT);
  R.restyleT = setTimeout(() => { if (cfi && R.prefs.flow === 'paginated') R.rendition.display(cfi); }, 160);
  R.savePrefs(R.prefs);
}

function applyChrome() {
  const p = R.prefs, c = pageColors();
  R.el.style.setProperty('--page-bg', c.bg);
  R.el.style.setProperty('--page-fg', c.fg);
  R.el.classList.toggle('dark', !!c.dark);
  R.el.style.setProperty('--margin', (p.margin * 6) + '%');
  $('.r-dim', R.el).style.opacity = (1 - p.brightness).toFixed(2);
  $('.r-warm', R.el).style.opacity = (p.warmth * 0.32).toFixed(2);
}

// ---------- navigation ----------

function next() { R.navigated = true; if (R.prefs.flow === 'chapter') return chapterStep(1); turn('next'); R.rendition.next(); }
function prev() { R.navigated = true; if (R.prefs.flow === 'chapter') return chapterStep(-1); turn('prev'); R.rendition.prev(); }

function chapterStep(d) {
  const current = R.sectionIndex ?? (R.loc && R.loc.start.index);
  if (current == null) return;
  const section = R.book.spine.get(current + d);
  if (!section) {
    if (d > 0 && !R.finished) finish();
    return;
  }
  turn(d > 0 ? 'next' : 'prev');
  R.rendition.display(section.href);
}

function turn(dir) {
  if (R.prefs.flow === 'scrolled') return;
  const v = R.view;
  v.classList.remove('turn-next', 'turn-prev');
  void v.offsetWidth;
  v.classList.add('turn-' + dir);
}

function onRelocated(loc) {
  R.loc = loc;
  const rec = R.bookRecord();
  const cfi = loc.start.cfi;
  const total = R.book.locations.length();
  const pct = loc.atEnd ? 1 : total ? R.book.locations.percentageFromCfi(cfi) : (loc.start.percentage || 0);
  const pages = rec.pages || total || 0;
  const page = pages ? Math.max(1, Math.min(pages, Math.round(pct * pages) || 1)) : 0;

  const input = $('.r-progress input', R.el);
  if (!input.matches(':active')) input.value = Math.round(pct * 1000);
  $('.r-page', R.el).textContent = pages ? `p. ${page} of ${pages} · ${Math.round(pct * 100)}%` : `${Math.round(pct * 100)}%`;
  $('.r-chapter', R.el).textContent = chapterTitle(loc.start.href);
  updateMarks();

  rec.lastCfi = cfi;
  rec.progress = Math.max(0, Math.min(0.999, pct));
  rec.lastPageLabel = pages ? `p. ${page} of ${pages}` : '';
  clearTimeout(R.saveT);
  R.saveT = setTimeout(() => R.saveBook(rec), 600);

  if ((loc.atEnd || pct >= 0.998) && R.navigated && !R.finished) finish();
}

function chapterTitle(href) {
  if (!R.book.navigation) return '';
  const clean = h => (h || '').split('#')[0].split('/').pop();
  let found = '';
  const walk = items => items.forEach(i => { if (clean(i.href) === clean(href)) found = found || i.label.trim(); if (i.subitems) walk(i.subitems); });
  walk(R.book.navigation.toc || []);
  return found;
}

async function loadLocations() {
  const rec = R.bookRecord();
  const input = $('.r-progress input', R.el);
  const sess = R;
  if (rec.locations) {
    try { R.book.locations.load(rec.locations); } catch (e) { rec.locations = null; }
  }
  if (!R.book.locations.length()) {
    $('.r-page', R.el).textContent = 'Measuring book…';
    await R.book.locations.generate(1200);
    if (R !== sess) return;
    rec.locations = R.book.locations.save();
    R.saveBook(rec);
  }
  input.disabled = false;
  if (R.loc) onRelocated(R.loc);
}

function onSeekPreview(e) {
  const rec = R.bookRecord(), pct = e.target.value / 1000, pages = rec.pages;
  $('.r-page', R.el).textContent = pages ? `p. ${Math.max(1, Math.round(pct * pages))} of ${pages}` : `${Math.round(pct * 100)}%`;
}

function onSeek(e) {
  R.navigated = true;
  const cfi = R.book.locations.cfiFromPercentage(e.target.value / 1000);
  if (cfi) R.rendition.display(cfi);
}

// ---------- input ----------

function onKey(e) {
  if (!R || sheetOpen()) return;
  if (e.target && e.target.closest && e.target.closest('input,textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && R.prefs.flow === 'paginated')) next();
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
  else if (e.key === '+' || e.key === '=') zoom(10);
  else if (e.key === '-') zoom(-10);
  else if (e.key === 'Escape') { if (R.el.classList.contains('selecting')) clearSelection(); else history.back(); }
}

let touch = null;
function onTouchStart(e) {
  if (e.touches && e.touches.length === 2) {
    const [a, b] = e.touches;
    touch = { pinch: Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY), size: R.prefs.size };
    return;
  }
  const t = e.changedTouches[0];
  touch = { x: t.screenX, y: t.screenY, t: Date.now() };
}
function onTouchMove(e) {
  if (!touch || !touch.pinch || e.touches.length !== 2) return;
  const [a, b] = e.touches;
  const ratio = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY) / touch.pinch;
  touch.target = Math.round(Math.max(60, Math.min(240, touch.size * ratio)) / 5) * 5;
  $('.r-page', R.el).textContent = `Text size ${touch.target}%`;
}
function onTouchEnd(e) {
  if (!touch) return;
  if (touch.pinch) {
    if (touch.target && touch.target !== R.prefs.size) { R.prefs.size = touch.target; restyle(); }
    touch = null; return;
  }
  const t = e.changedTouches[0];
  const dx = t.screenX - touch.x, dy = t.screenY - touch.y;
  const quick = Date.now() - touch.t < 600;
  touch = null;
  if (R.prefs.flow === 'scrolled' || !quick) return;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
    const sel = R.rendition.getContents()[0]?.window.getSelection();
    if (sel && sel.toString()) return;
    dx < 0 ? next() : prev();
    R.swiped = Date.now();
  }
}

function onContentClick(e) {
  if (R.swiped && Date.now() - R.swiped < 400) return;
  const win = e.view || (e.target && e.target.ownerDocument && e.target.ownerDocument.defaultView);
  if (win && win.getSelection && win.getSelection().toString()) return;
  if (e.target.closest && e.target.closest('a')) return;
  if (R.el.classList.contains('selecting')) { clearSelection(); return; }
  R.el.classList.toggle('chrome');
  if (R.el.classList.contains('chrome')) hideChromeSoon(4000);
}

function hideChromeSoon(ms = 2500) {
  clearTimeout(R.chromeT);
  R.chromeT = setTimeout(() => { if (R && !sheetOpen()) R.el.classList.remove('chrome'); }, ms);
}

function onPop() {
  if (sheetOpen()) { closeSheet(); history.pushState({ reader: true }, ''); return; }
  closeReader();
}

async function onReaderClick(e) {
  const hl = e.target.closest('[data-hl]');
  if (hl) return addHighlight(hl.dataset.hl);
  const b = e.target.closest('[data-r]');
  if (!b) return;
  clearTimeout(R.chromeT);
  const a = b.dataset.r;
  if (a === 'close') history.back();
  if (a === 'next') next();
  if (a === 'prev') prev();
  if (a === 'zoomIn') zoom(10);
  if (a === 'zoomOut') zoom(-10);
  if (a === 'toc') openToc();
  if (a === 'notes') openNotes();
  if (a === 'fav') toggleMark('fav');
  if (a === 'bookmark') toggleMark('bookmark');
  if (a === 'settings') openSettings();
  if (a === 'addnote') addNote();
  if (a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(R.sel?.text || ''); toast('Copied'); clearSelection(); }
  if (a === 'selx') clearSelection();
}

function zoom(delta) {
  R.prefs.size = Math.max(60, Math.min(240, R.prefs.size + delta));
  $('.r-page', R.el).textContent = `Text size ${R.prefs.size}%`;
  restyle();
}

// ---------- highlights & notes ----------

function onSelected(cfiRange, contents) {
  const text = contents.window.getSelection().toString().trim();
  if (!text) return;
  R.sel = { cfi: cfiRange, text, contents };
  R.el.classList.add('selecting');
  R.el.classList.remove('chrome');
  try {
    const sel = contents.window.getSelection();
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const f = contents.window.frameElement.getBoundingClientRect();
    placeBelow($('.r-sel', R.el), { left: f.left + r.left, right: f.left + r.right, top: f.top + r.top, bottom: f.top + r.bottom, width: r.width });
  } catch (e) { /* keep last position */ }
}

function clearSelection() {
  if (R.sel) { try { R.sel.contents.window.getSelection().removeAllRanges(); } catch (e) { /* view gone */ } }
  R.sel = null;
  R.el.classList.remove('selecting');
}

function drawHighlight(a) {
  const dark = !!pageColors().dark;
  try { R.rendition.annotations.remove(a.cfi, 'highlight'); } catch (e) { /* not drawn yet */ }
  R.rendition.annotations.add('highlight', a.cfi, { id: a.id }, () => openAnnotation(a), a.note ? 'hl has-note' : 'hl',
    { fill: HL_COLORS[a.color] || HL_COLORS.yellow, 'fill-opacity': dark ? '0.32' : '0.42', 'mix-blend-mode': dark ? 'screen' : 'multiply' });
}

async function addHighlight(color, note = '') {
  if (!R.sel) return;
  const a = { id: uid('a_'), bookId: R.bookRecord().id, type: 'highlight', cfi: R.sel.cfi, text: R.sel.text, note, color, chapter: $('.r-chapter', R.el).textContent, createdAt: Date.now() };
  R.anns.push(a);
  await db.put('annotations', a);
  drawHighlight(a);
  clearSelection();
  return a;
}

async function addNote() {
  if (!R.sel) return;
  const keep = R.sel;
  const note = await promptSheet({ title: 'Add a note', placeholder: 'Your thoughts…', multiline: true });
  if (note === null) return;
  R.sel = keep;
  await addHighlight('yellow', note.trim());
  toast('Note saved');
}

function openAnnotation(a) {
  openSheet(`<div class="ann-sheet">
    <blockquote style="--hl:${HL_COLORS[a.color] || HL_COLORS.yellow}">${esc(a.text)}</blockquote>
    ${a.note ? `<p class="ann-note">${esc(a.note)}</p>` : ''}
    <div class="hl-row">${Object.entries(HL_COLORS).map(([k, c]) => `<button class="hl-dot ${a.color === k ? 'on' : ''}" data-c="${k}" style="background:${c}"></button>`).join('')}</div>
    <div class="btn-row"><button class="btn ghost" data-a="note">${icon('note')} ${a.note ? 'Edit note' : 'Add note'}</button>
    <button class="btn ghost danger" data-a="del">${icon('trash')} Remove</button></div></div>`, {
    onMount: (sheet, close) => sheet.addEventListener('click', async e => {
      const c = e.target.closest('[data-c]');
      if (c) { a.color = c.dataset.c; await db.put('annotations', a); drawHighlight(a); close(); return; }
      const act = e.target.closest('[data-a]')?.dataset.a;
      if (act === 'note') {
        close();
        const note = await promptSheet({ title: 'Note', value: a.note || '', multiline: true });
        if (note !== null) { a.note = note.trim(); await db.put('annotations', a); drawHighlight(a); }
      }
      if (act === 'del') {
        R.rendition.annotations.remove(a.cfi, 'highlight');
        R.anns = R.anns.filter(x => x.id !== a.id);
        await db.del('annotations', a.id);
        close();
      }
    }),
  });
}

// ---------- bookmarks & favourite pages ----------

function markHere(type) {
  if (!R.loc) return null;
  const { start, end } = R.loc;
  const cmp = new ePub.CFI();
  return R.anns.find(a => a.type === type && (a.cfi === start.cfi ||
    (cmp.compare(a.cfi, start.cfi) >= 0 && cmp.compare(a.cfi, end.cfi) <= 0)));
}

function updateMarks() {
  $('.fav-btn', R.el).classList.toggle('on', !!markHere('fav'));
  $('.mark-btn', R.el).classList.toggle('on', !!markHere('bookmark'));
}

async function toggleMark(type) {
  const label = type === 'fav' ? 'favourite pages' : 'bookmarks';
  const existing = markHere(type);
  if (existing) {
    R.anns = R.anns.filter(a => a !== existing);
    await db.del('annotations', existing.id);
    toast(`Removed from ${label}`);
  } else {
    let text = '';
    try { text = R.rendition.getContents()[0].document.body.textContent.replace(/\s+/g, ' ').trim().slice(0, 140); } catch (e) { /* ignore */ }
    const a = { id: uid('a_'), bookId: R.bookRecord().id, type, cfi: R.loc.start.cfi, text, chapter: $('.r-chapter', R.el).textContent, page: R.bookRecord().lastPageLabel, createdAt: Date.now() };
    R.anns.push(a);
    await db.put('annotations', a);
    toast(type === 'fav' ? 'Page added to favourites ♥' : 'Bookmark added');
  }
  updateMarks();
}

// ---------- panels ----------

function openToc() {
  const toc = (R.book.navigation && R.book.navigation.toc) || [];
  const current = R.loc ? R.loc.start.href.split('#')[0].split('/').pop() : '';
  const list = (items, depth = 0) => items.map(i => `<button class="toc-item ${i.href.split('#')[0].split('/').pop() === current ? 'on' : ''}" style="padding-left:${16 + depth * 16}px" data-href="${esc(i.href)}">${esc(i.label.trim())}</button>${i.subitems && i.subitems.length ? list(i.subitems, depth + 1) : ''}`).join('');
  openSheet(`<div class="toc"><h3>Contents</h3>${toc.length ? list(toc) : '<p class="muted">This book has no table of contents.</p>'}</div>`, {
    className: 'tall',
    onMount: (sheet, close) => {
      setTimeout(() => $('.toc-item.on', sheet)?.scrollIntoView({ block: 'center' }), 300);
      sheet.addEventListener('click', e => {
        const t = e.target.closest('[data-href]');
        if (t) { R.navigated = true; R.rendition.display(t.dataset.href); close(); }
      });
    },
  });
}

function openNotes() {
  const hls = R.anns.filter(a => a.type === 'highlight').sort((a, b) => new ePub.CFI().compare(a.cfi, b.cfi));
  const favs = R.anns.filter(a => a.type === 'fav').sort((a, b) => new ePub.CFI().compare(a.cfi, b.cfi));
  const marks = R.anns.filter(a => a.type === 'bookmark').sort((a, b) => new ePub.CFI().compare(a.cfi, b.cfi));
  const markHtml = marks.length ? marks.map(a => `<div class="ann" data-go="${esc(a.cfi)}">
      <strong class="fav-title mark">${icon('bookmark')} ${esc(a.page || a.chapter || 'Bookmark')}</strong>
      <p class="muted small">${esc(a.chapter || '')}${a.text ? ' — “' + esc(a.text) + '…”' : ''}</p>
      <button class="icon-btn ann-del" data-del="${a.id}" aria-label="Delete">${icon('trash')}</button></div>`).join('')
    : '<p class="muted">Tap the bookmark at the top while reading to bookmark a page.</p>';
  const hlHtml = hls.length ? hls.map(a => `<div class="ann" data-go="${esc(a.cfi)}">
      <blockquote style="--hl:${HL_COLORS[a.color] || HL_COLORS.yellow}">${esc(a.text)}</blockquote>
      ${a.note ? `<p class="ann-note">${esc(a.note)}</p>` : ''}<span class="muted small">${esc(a.chapter || '')}</span>
      <button class="icon-btn ann-del" data-del="${a.id}" aria-label="Delete">${icon('trash')}</button></div>`).join('')
    : '<p class="muted">Select text while reading to highlight it or add a note.</p>';
  const favHtml = favs.length ? favs.map(a => `<div class="ann" data-go="${esc(a.cfi)}">
      <strong class="fav-title">${icon('heart')} ${esc(a.page || a.chapter || 'Favourite page')}</strong>
      <p class="muted small">${esc(a.chapter || '')}${a.text ? ' — “' + esc(a.text) + '…”' : ''}</p>
      <button class="icon-btn ann-del" data-del="${a.id}" aria-label="Delete">${icon('trash')}</button></div>`).join('')
    : '<p class="muted">Tap the heart at the top while reading to save a favourite page.</p>';
  openSheet(`<div class="notes"><div class="seg"><button class="on" data-tab="h">Highlights (${hls.length})</button><button data-tab="b">Bookmarks (${marks.length})</button><button data-tab="f">Favourites (${favs.length})</button></div>
    <div class="pane" data-pane="h">${hlHtml}</div><div class="pane" data-pane="b" hidden>${markHtml}</div><div class="pane" data-pane="f" hidden>${favHtml}</div></div>`, {
    className: 'tall',
    onMount: (sheet, close) => sheet.addEventListener('click', async e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        $$('[data-tab]', sheet).forEach(t => t.classList.toggle('on', t === tab));
        $$('[data-pane]', sheet).forEach(p => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        const a = R.anns.find(x => x.id === del.dataset.del);
        if (a.type === 'highlight') R.rendition.annotations.remove(a.cfi, 'highlight');
        R.anns = R.anns.filter(x => x !== a);
        await db.del('annotations', a.id);
        del.closest('.ann').remove();
        updateMarks();
        return;
      }
      const go = e.target.closest('[data-go]');
      if (go) { R.navigated = true; R.rendition.display(go.dataset.go); close(); }
    }),
  });
}

const STEPS = {
  size:       { label: 'Text size',    step: 10,  min: 60,  max: 240, fmt: v => `${v}%` },
  lineHeight: { label: 'Line spacing', step: 0.1, min: 1.1, max: 2.4, fmt: v => v.toFixed(1) },
  margin:     { label: 'Margin',       step: 0.5, min: 0,   max: 3,   fmt: v => `${Math.round(v * 6)}%` },
  brightness: { label: 'Brightness',   step: 0.1, min: 0.3, max: 1,   fmt: v => `${Math.round(v * 100)}%` },
  warmth:     { label: 'Warmth',       step: 0.1, min: 0,   max: 1,   fmt: v => v ? `${Math.round(v * 100)}%` : 'Off' },
};

function openSettings() {
  const p = R.prefs;
  const views = [['paginated', 'paged', 'Paged'], ['scrolled', 'scrolled', 'Scrolled'], ['chapter', 'chapterView', 'Chapter']];
  openSheet(`<div class="r-settings">
    <div class="view-modes">${views.map(([k, ic, n]) => `<button class="vm ${p.flow === k ? 'on' : ''}" data-flow="${k}">${icon(ic)}<span>${n}</span></button>`).join('')}</div>
    <p class="vm-hint muted small">${p.flow === 'chapter' ? 'Scroll through a chapter, swipe sideways for the next one.' : ''}</p>
    <div class="set-block">
      <span class="set-title">Theme</span>
      <div class="theme-dots">${Object.entries(PAGE_THEMES).map(([k, t]) => k === 'custom'
        ? `<button class="tdot custom ${p.theme === k ? 'on' : ''}" data-theme="custom" title="Custom">•••</button>`
        : `<button class="tdot ${p.theme === k ? 'on' : ''}" data-theme="${k}" title="${t.name}" style="background:${t.bg};color:${t.fg}">${icon('check')}</button>`).join('')}</div>
      <div class="custom-colors" ${p.theme === 'custom' ? '' : 'hidden'}>
        <label>Page <input type="color" data-color="bg" value="${p.bg}"></label>
        <label>Text <input type="color" data-color="fg" value="${p.fg}"></label></div>
    </div>
    <div class="set-block steps">
      ${['size', 'lineHeight', 'margin'].map(k => stepper(k, STEPS[k].label, STEPS[k].fmt(p[k]))).join('')}
      <div class="step-row"><div class="step-text"><span>Text align</span><small data-out="align">${p.justify ? 'Justify' : 'Left'}</small></div>
        <button class="step-btn ${p.justify ? '' : 'on'}" data-align="left" aria-label="Align left">${icon('alignLeft')}</button>
        <button class="step-btn ${p.justify ? 'on' : ''}" data-align="justify" aria-label="Justify">${icon('alignJustify')}</button></div>
      <label class="font-row"><span>Font</span><select data-font>${Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${p.font === k ? 'selected' : ''}>${f.name === 'Original' ? 'Original font' : f.name}</option>`).join('')}</select></label>
    </div>
    <div class="set-block steps">
      ${['brightness', 'warmth'].map(k => stepper(k, STEPS[k].label, STEPS[k].fmt(p[k]))).join('')}
    </div>
    <label class="toggle small-toggle"><input type="checkbox" data-toggle="spread" ${p.spread !== 'single' ? 'checked' : ''}><span>Two pages side by side on wide screens</span></label>
  </div>`, {
    className: 'reader-settings',
    onMount: (sheet) => {
      sheet.addEventListener('click', async e => {
        const t = e.target.closest('button');
        if (!t) return;
        const key = t.dataset.inc || t.dataset.dec;
        if (key) {
          const cfg = STEPS[key];
          p[key] = stepValue(cfg, p[key], t.dataset.inc ? 1 : -1);
          $(`[data-out="${key}"]`, sheet).textContent = cfg.fmt(p[key]);
          if (key === 'brightness' || key === 'warmth') { applyChrome(); R.savePrefs(p); }
          else if (key === 'margin') { applyChrome(); setTimeout(() => { R.rendition.resize(); restyle(); }, 320); }
          else restyle();
          return;
        }
        if (t.dataset.align) {
          p.justify = t.dataset.align === 'justify';
          $$('[data-align]', sheet).forEach(b => b.classList.toggle('on', b === t));
          $('[data-out="align"]', sheet).textContent = p.justify ? 'Justify' : 'Left';
          restyle();
        }
        if (t.dataset.theme) {
          p.theme = t.dataset.theme;
          $$('[data-theme]', sheet).forEach(b => b.classList.toggle('on', b === t));
          $('.custom-colors', sheet).hidden = p.theme !== 'custom';
          restyle(); R.anns.filter(a => a.type === 'highlight').forEach(drawHighlight);
        }
        if (t.dataset.flow && t.dataset.flow !== p.flow) {
          p.flow = t.dataset.flow;
          $$('[data-flow]', sheet).forEach(b => b.classList.toggle('on', b === t));
          $('.vm-hint', sheet).textContent = p.flow === 'chapter' ? 'Scroll through a chapter, swipe sideways for the next one.' : '';
          R.savePrefs(p);
          await createRendition(R.loc && R.loc.start.cfi);
        }
      });
      sheet.addEventListener('change', async e => {
        if (e.target.matches('[data-font]')) { p.font = e.target.value; restyle(); }
        if (e.target.dataset.color) { p[e.target.dataset.color] = e.target.value; restyle(); }
        if (e.target.dataset.toggle === 'spread') {
          p.spread = e.target.checked ? 'auto' : 'single';
          R.savePrefs(p);
          if (p.flow === 'paginated') await createRendition(R.loc && R.loc.start.cfi);
        }
      });
    },
  });
}

// ---------- finishing ----------

async function finish() {
  R.finished = true;
  clearTimeout(R.saveT);
  const rec = R.bookRecord();
  await R.onFinished(rec);
  const box = $('.r-finish', R.el);
  box.innerHTML = `<div class="finish-card">
    <div class="confetti">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
    <span class="finish-kicker">The end</span>
    <h3>You finished <em>${esc(rec.title)}</em></h3>
    <p class="muted">It's on your Read shelf now. How was it?</p>
    ${stars(rec.rating || 0, 'big')}
    <div class="btn-row"><button class="btn ghost" data-f="stay">Keep reading</button><button class="btn primary" data-f="shelf">Back to my shelf</button></div></div>`;
  box.classList.add('show');
  box.onclick = e => {
    const s = e.target.closest('[data-star]');
    if (s) { R.rate(rec, +s.dataset.star); $$('.star', box).forEach((x, i) => x.classList.toggle('on', i < +s.dataset.star)); return; }
    const f = e.target.closest('[data-f]')?.dataset.f;
    if (f === 'stay') box.classList.remove('show');
    if (f === 'shelf') history.back();
  };
}

// ---------- close ----------

export async function closeReader() {
  if (!R) return;
  const sess = R;
  R = null;
  closeAllSheets();
  clearTimeout(sess.saveT);
  const rec = sess.bookRecord();
  if (sess.loc && !sess.finished) await sess.saveBook(rec);
  window.removeEventListener('popstate', onPop);
  window.removeEventListener('keydown', onKey);
  try { sess.book && sess.book.destroy(); } catch (e) { /* ignore */ }
  sess.el.classList.add('leaving');
  document.body.classList.remove('reading');
  setTimeout(() => sess.el.remove(), 260);
  sess.onClose && sess.onClose();
}
