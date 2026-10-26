// Reading mode for PDFs (pdf.js): flip pages, scroll, or scroll a chapter at a time,
// with page tones, zoom, brightness, highlights, notes, bookmarks and favourite pages.
import { db, uid } from './db.js';
import { icon, esc, $, $$, openSheet, toast, promptSheet, stars, closeAllSheets, sheetOpen, closeSheet, stepper, stepValue, placeBelow } from './ui.js';
import { pdfLib } from './meta.js';

const TONES = {
  paper: { name: 'Paper', bg: '#f4efe4', filter: 'sepia(.14) brightness(.99)' },
  white: { name: 'White', bg: '#e9e9e9', filter: 'none' },
  sepia: { name: 'Sepia', bg: '#eadcbf', filter: 'sepia(.5) brightness(.96)' },
  dusk:  { name: 'Dusk',  bg: '#2c2f35', filter: 'invert(.84) hue-rotate(180deg) brightness(1.05)', dark: true },
  night: { name: 'Night', bg: '#151619', filter: 'invert(.9) hue-rotate(180deg) brightness(.95)', dark: true },
  black: { name: 'Black', bg: '#000000', filter: 'invert(1) hue-rotate(180deg) brightness(.85)', dark: true },
};
const HL_COLORS = { yellow: '#ffd84d', green: '#86df8a', blue: '#78c3ff', pink: '#ff8db5', purple: '#c4a0ff' };
const DEFAULTS = { tone: 'paper', zoom: 1, brightness: 1, warmth: 0, flow: 'paginated' };

let P = null;
export const pdfReaderOpen = () => !!P;

export async function openPdfReader(opts) {
  if (P) await closePdfReader();
  const prefs = { ...DEFAULTS, ...(opts.prefs || {}) };
  const el = document.createElement('div');
  el.className = 'reader pdf-reader chrome';
  el.innerHTML = `
    <header class="r-top">
      <button class="icon-btn" data-r="close" title="Back to shelf">${icon('back')}</button>
      <div class="r-title"><strong>${esc(opts.book.title)}</strong><span class="r-chapter"></span></div>
      <button class="icon-btn" data-r="toc" title="Contents">${icon('toc')}</button>
      <button class="icon-btn" data-r="notes" title="Highlights, bookmarks & favourites">${icon('note')}</button>
      <button class="icon-btn mark-btn" data-r="bookmark" title="Bookmark this page">${icon('bookmark')}</button>
      <button class="icon-btn fav-btn" data-r="fav" title="Favourite this page">${icon('heart')}</button>
      <button class="icon-btn" data-r="settings" title="Reading settings">${icon('sliders')}</button>
    </header>
    <div class="r-stage pdf-stage"><div class="pdf-view"></div>
      <button class="r-edge left" data-r="prev" aria-label="Previous page"></button>
      <button class="r-edge right" data-r="next" aria-label="Next page"></button>
      <div class="r-loading"><div class="spinner"></div><span>Opening book…</span></div>
    </div>
    <footer class="r-bottom">
      <button class="icon-btn" data-r="zoomOut" title="Zoom out">${icon('zoomOut')}</button>
      <button class="icon-btn" data-r="prev" title="Previous">${icon('left')}</button>
      <div class="r-progress"><input type="range" min="1" max="1" value="1"><span class="r-page">—</span></div>
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

  P = {
    ...opts, rec: opts.book, prefs, el, stage: $('.pdf-stage', el), view: $('.pdf-view', el),
    pdf: null, page: opts.book.lastPage || 1, sizes: [], anns: [], chapters: [], rendered: new Map(),
    navigated: false, finished: false, sel: null, saveT: 0, chromeT: 0, observer: null,
  };
  history.pushState({ reader: true }, '');
  window.addEventListener('popstate', onPop);
  window.addEventListener('keydown', onKey);
  el.addEventListener('click', onClick);
  const range = $('.r-progress input', el);
  range.addEventListener('input', () => label(+range.value));
  range.addEventListener('change', () => { P.navigated = true; goTo(+range.value); });
  P.view.addEventListener('scroll', onScroll, { passive: true });
  P.view.addEventListener('touchstart', onTouchStart, { passive: true });
  P.view.addEventListener('touchmove', onTouchMove, { passive: true });
  P.view.addEventListener('touchend', onTouchEnd);
  P.view.addEventListener('wheel', onWheel, { passive: false });
  P.view.addEventListener('click', onPageClick);
  document.addEventListener('selectionchange', onSelectionChange);
  let rt = 0;
  P.onResize = () => { clearTimeout(rt); rt = setTimeout(() => P && layout(), 150); };
  window.addEventListener('resize', P.onResize);
  applyTone();

  try {
    P.pdf = await pdfLib().getDocument({ data: new Uint8Array(await opts.blob.arrayBuffer()) }).promise;
    const n = P.pdf.numPages;
    range.max = n;
    // Page sizes up front so scroll mode can lay out placeholders without rendering.
    for (let i = 1; i <= n; i++) {
      const pg = await P.pdf.getPage(i);
      const vp = pg.getViewport({ scale: 1 });
      P.sizes[i] = { w: vp.width, h: vp.height };
    }
    P.anns = await db.byIndex('annotations', 'bookId', opts.book.id);
    P.chapters = await loadOutline();
    P.page = Math.max(1, Math.min(n, P.page));
    $('.r-loading', el).classList.add('done');
    layout();
    hideChromeSoon();
  } catch (e) {
    console.error(e);
    toast('This PDF could not be opened');
    closePdfReader();
  }
}

// ---------- outline / chapters ----------

async function loadOutline() {
  const out = [];
  try {
    const walk = async (items, depth) => {
      for (const it of items || []) {
        let dest = it.dest;
        if (typeof dest === 'string') dest = await P.pdf.getDestination(dest);
        let page = null;
        if (Array.isArray(dest) && dest[0]) {
          try { page = typeof dest[0] === 'number' ? dest[0] + 1 : (await P.pdf.getPageIndex(dest[0])) + 1; } catch (e) { /* bad ref */ }
        }
        if (page) out.push({ title: (it.title || '').trim(), page, depth });
        if (depth < 2) await walk(it.items, depth + 1);
      }
    };
    await walk(await P.pdf.getOutline(), 0);
  } catch (e) { /* no outline */ }
  return out;
}

// Chapter ranges for chapter-scroll: top-level outline entries, or blocks of 10 pages.
function chapterRanges() {
  const n = P.pdf.numPages;
  const tops = [...new Set(P.chapters.filter(c => c.depth === 0).map(c => c.page))].sort((a, b) => a - b);
  const starts = tops.length > 1 ? (tops[0] > 1 ? [1, ...tops] : tops) : Array.from({ length: Math.ceil(n / 10) }, (_, i) => i * 10 + 1);
  return starts.map((s, i) => [s, (starts[i + 1] || n + 1) - 1]);
}
const chapterOf = p => chapterRanges().findIndex(([a, b]) => p >= a && p <= b);

function chapterTitle(p) {
  let t = '';
  for (const c of P.chapters) if (c.page <= p && c.depth === 0) t = c.title;
  return t;
}

// ---------- layout & rendering ----------

function stageBox() {
  const r = P.view.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

function layout() {
  if (!P || !P.pdf) return;
  if (P.observer) P.observer.disconnect();
  P.rendered.clear();
  P.view.innerHTML = '';
  const flow = P.prefs.flow;
  P.el.classList.toggle('scrolled', flow !== 'paginated');
  P.el.classList.toggle('zoomed', P.prefs.zoom > 1.01);
  if (flow === 'paginated') {
    P.view.className = 'pdf-view single';
    const el = pageEl(P.page, fitScale(P.page));
    P.view.appendChild(el);
    renderPage(P.page, el);
  } else {
    P.view.className = 'pdf-view list';
    const [from, to] = flow === 'chapter' ? chapterRanges()[Math.max(0, chapterOf(P.page))] : [1, P.pdf.numPages];
    P.range = [from, to];
    for (let i = from; i <= to; i++) P.view.appendChild(pageEl(i, widthScale(i)));
    P.observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) renderPage(+e.target.dataset.page, e.target); });
    }, { root: P.view, rootMargin: '900px 0px' });
    $$('.pdf-page', P.view).forEach(p => P.observer.observe(p));
    const target = $(`.pdf-page[data-page="${P.page}"]`, P.view);
    if (target && P.page !== from) P.view.scrollTop = target.offsetTop - 8;
    else P.view.scrollTop = 0;
  }
  updateUi();
}

function fitScale(n) {
  const { w, h } = stageBox(), s = P.sizes[n];
  return Math.min((w - 16) / s.w, (h - 16) / s.h) * P.prefs.zoom;
}

function widthScale(n) {
  const { w } = stageBox(), s = P.sizes[n];
  return (Math.min(w - 16, 920) / s.w) * P.prefs.zoom;
}

function pageEl(n, scale) {
  const s = P.sizes[n];
  const el = document.createElement('div');
  el.className = 'pdf-page';
  el.dataset.page = n;
  el.dataset.scale = scale;
  el.style.width = `${s.w * scale}px`;
  el.style.height = `${s.h * scale}px`;
  el.innerHTML = '<canvas></canvas><div class="hl-layer"></div><div class="textLayer"></div>';
  return el;
}

async function renderPage(n, el) {
  if (P.rendered.has(n)) return;
  const sess = P;
  P.rendered.set(n, el);
  trimRendered(n);
  const scale = +el.dataset.scale;
  const page = await P.pdf.getPage(n);
  if (P !== sess) return;
  const vp = page.getViewport({ scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const canvas = $('canvas', el);
  canvas.width = Math.floor(vp.width * dpr);
  canvas.height = Math.floor(vp.height * dpr);
  canvas.style.width = `${vp.width}px`;
  canvas.style.height = `${vp.height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  try { await page.render({ canvasContext: ctx, viewport: vp }).promise; } catch (e) { return; }
  const tl = $('.textLayer', el);
  tl.innerHTML = '';
  tl.style.setProperty('--scale-factor', vp.scale);
  try {
    await pdfLib().renderTextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp, textDivs: [] }).promise;
  } catch (e) { /* page without text */ }
  drawHighlights(n);
}

// Keep memory low on phones: only the nearest pages keep their canvases.
function trimRendered(current) {
  if (P.rendered.size <= 14) return;
  const far = [...P.rendered.keys()].sort((a, b) => Math.abs(b - current) - Math.abs(a - current));
  for (const n of far.slice(0, P.rendered.size - 14)) {
    const el = P.rendered.get(n);
    const c = $('canvas', el);
    c.width = c.height = 0;
    $('.textLayer', el).innerHTML = '';
    P.rendered.delete(n);
  }
}

// ---------- navigation ----------

function goTo(n, dir = 0) {
  n = Math.max(1, Math.min(P.pdf.numPages, n));
  const flow = P.prefs.flow;
  if (flow === 'paginated') {
    P.page = n;
    layout();
    if (dir) turn(dir > 0 ? 'next' : 'prev');
  } else if (flow === 'chapter' && (n < P.range[0] || n > P.range[1])) {
    P.page = n;
    layout();
    if (dir) turn(dir > 0 ? 'next' : 'prev');
  } else {
    const t = $(`.pdf-page[data-page="${n}"]`, P.view);
    if (t) P.view.scrollTop = t.offsetTop - 8;
    P.page = n;
    updateUi();
  }
}

function next() {
  P.navigated = true;
  const n = P.pdf.numPages;
  if (P.prefs.flow === 'chapter') {
    const ch = chapterRanges(), i = chapterOf(P.page);
    if (i >= ch.length - 1) { if (!P.finished) finish(); return; }
    return goTo(ch[i + 1][0], 1);
  }
  if (P.prefs.flow === 'scrolled') return P.view.scrollBy({ top: P.view.clientHeight * 0.9, behavior: 'smooth' });
  if (P.page >= n) { if (!P.finished) finish(); return; }
  goTo(P.page + 1, 1);
}

function prev() {
  P.navigated = true;
  if (P.prefs.flow === 'chapter') {
    const ch = chapterRanges(), i = chapterOf(P.page);
    if (i > 0) goTo(ch[i - 1][0], -1);
    return;
  }
  if (P.prefs.flow === 'scrolled') return P.view.scrollBy({ top: -P.view.clientHeight * 0.9, behavior: 'smooth' });
  goTo(P.page - 1, -1);
}

function turn(dir) {
  P.view.classList.remove('turn-next', 'turn-prev');
  void P.view.offsetWidth;
  P.view.classList.add('turn-' + dir);
}

function onScroll() {
  if (P.prefs.flow === 'paginated') return;
  const mid = P.view.scrollTop + P.view.clientHeight * 0.35;
  let cur = P.page;
  for (const p of $$('.pdf-page', P.view)) { if (p.offsetTop <= mid) cur = +p.dataset.page; else break; }
  if (cur !== P.page) { P.page = cur; P.navigated = true; updateUi(); }
  const atBottom = P.view.scrollTop + P.view.clientHeight >= P.view.scrollHeight - 4;
  if (atBottom && P.page === P.pdf.numPages && P.navigated && !P.finished) finish();
}

function label(n) {
  const total = P.pdf.numPages;
  $('.r-page', P.el).textContent = `p. ${n} of ${total} · ${Math.round((n / total) * 100)}%`;
}

function updateUi() {
  const n = P.page, total = P.pdf.numPages;
  const range = $('.r-progress input', P.el);
  if (!range.matches(':active')) range.value = n;
  label(n);
  $('.r-chapter', P.el).textContent = chapterTitle(n);
  $('.fav-btn', P.el).classList.toggle('on', !!markHere('fav'));
  $('.mark-btn', P.el).classList.toggle('on', !!markHere('bookmark'));
  const rec = P.rec;
  rec.lastPage = n;
  rec.progress = Math.min(0.999, total > 1 ? (n - 1) / (total - 1) : 0);
  rec.lastPageLabel = `p. ${n} of ${total}`;
  clearTimeout(P.saveT);
  P.saveT = setTimeout(() => P && P.saveBook(rec), 600);
}

// ---------- input ----------

function onKey(e) {
  if (!P || sheetOpen()) return;
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
  else if (e.key === '+' || e.key === '=') zoom(0.15);
  else if (e.key === '-') zoom(-0.15);
  else if (e.key === 'Escape') { if (P.el.classList.contains('selecting')) clearSelection(); else history.back(); }
}

function onWheel(e) {
  if (!e.ctrlKey) return;
  e.preventDefault();
  zoom(e.deltaY < 0 ? 0.1 : -0.1);
}

let touch = null;
function onTouchStart(e) {
  if (e.touches.length === 2) {
    const [a, b] = e.touches;
    touch = { pinch: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom: P.prefs.zoom };
    return;
  }
  const t = e.touches[0];
  touch = { x: t.clientX, y: t.clientY, t: Date.now() };
}
function onTouchMove(e) {
  if (!touch || !touch.pinch || e.touches.length !== 2) return;
  const [a, b] = e.touches;
  const z = touch.zoom * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / touch.pinch;
  touch.target = Math.max(0.6, Math.min(4, Math.round(z * 20) / 20));
  $('.r-page', P.el).textContent = `Zoom ${Math.round(touch.target * 100)}%`;
}
function onTouchEnd(e) {
  if (!touch) return;
  if (touch.pinch) {
    if (touch.target && touch.target !== P.prefs.zoom) { P.prefs.zoom = touch.target; P.savePrefs(P.prefs); layout(); }
    touch = null; return;
  }
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x, dy = t.clientY - touch.y, quick = Date.now() - touch.t < 600;
  touch = null;
  if (!quick || P.prefs.flow === 'scrolled' || window.getSelection().toString()) return;
  if (P.prefs.flow === 'paginated' && P.prefs.zoom > 1.01) return; // panning a zoomed page
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { dx < 0 ? next() : prev(); P.swiped = Date.now(); }
}

function zoom(d) {
  P.prefs.zoom = Math.max(0.6, Math.min(4, Math.round((P.prefs.zoom + d) * 100) / 100));
  $('.r-page', P.el).textContent = `Zoom ${Math.round(P.prefs.zoom * 100)}%`;
  P.savePrefs(P.prefs);
  layout();
}

function onPageClick(e) {
  if (P.swiped && Date.now() - P.swiped < 400) return;
  if (window.getSelection().toString()) return;
  const pageEl = e.target.closest('.pdf-page');
  if (pageEl) {
    const n = +pageEl.dataset.page, r = pageEl.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const hit = P.anns.find(a => a.type === 'highlight' && a.page === n && a.rects.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh));
    if (hit) { openAnnotation(hit); return; }
  }
  if (P.el.classList.contains('selecting')) { clearSelection(); return; }
  P.el.classList.toggle('chrome');
  if (P.el.classList.contains('chrome')) hideChromeSoon(4000);
}

function hideChromeSoon(ms = 2500) {
  clearTimeout(P.chromeT);
  P.chromeT = setTimeout(() => { if (P && !sheetOpen()) P.el.classList.remove('chrome'); }, ms);
}

function onPop() {
  if (sheetOpen()) { closeSheet(); history.pushState({ reader: true }, ''); return; }
  closePdfReader();
}

function onClick(e) {
  const hl = e.target.closest('[data-hl]');
  if (hl) return addHighlight(hl.dataset.hl);
  const b = e.target.closest('[data-r]');
  if (!b) return;
  clearTimeout(P.chromeT);
  const a = b.dataset.r;
  if (a === 'close') history.back();
  if (a === 'next') next();
  if (a === 'prev') prev();
  if (a === 'zoomIn') zoom(0.15);
  if (a === 'zoomOut') zoom(-0.15);
  if (a === 'toc') openToc();
  if (a === 'notes') openNotes();
  if (a === 'fav') toggleMark('fav');
  if (a === 'bookmark') toggleMark('bookmark');
  if (a === 'settings') openSettings();
  if (a === 'addnote') addNote();
  if (a === 'copy') { navigator.clipboard && navigator.clipboard.writeText(P.sel?.text || ''); toast('Copied'); clearSelection(); }
  if (a === 'selx') clearSelection();
}

// ---------- highlights ----------

let selT = 0;
function onSelectionChange() {
  clearTimeout(selT);
  selT = setTimeout(() => {
    if (!P) return;
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (!text || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const pageEl = (range.startContainer.parentElement || range.startContainer).closest?.('.pdf-page');
    if (!pageEl || !P.view.contains(pageEl)) return;
    const box = pageEl.getBoundingClientRect();
    const rects = [...range.getClientRects()]
      .filter(r => r.width > 1 && r.height > 1)
      .map(r => [(r.left - box.left) / box.width, (r.top - box.top) / box.height, r.width / box.width, r.height / box.height]
        .map(v => Math.round(v * 10000) / 10000));
    if (!rects.length) return;
    P.sel = { page: +pageEl.dataset.page, rects, text };
    P.el.classList.add('selecting');
    P.el.classList.remove('chrome');
    placeBelow($('.r-sel', P.el), range.getBoundingClientRect());
  }, 250);
}

function clearSelection() {
  window.getSelection().removeAllRanges();
  P.sel = null;
  P.el.classList.remove('selecting');
}

function drawHighlights(n) {
  const el = $(`.pdf-page[data-page="${n}"]`, P.view);
  if (!el) return;
  const layer = $('.hl-layer', el);
  layer.innerHTML = P.anns.filter(a => a.type === 'highlight' && a.page === n).map(a =>
    a.rects.map(([x, y, w, h]) => `<i class="${a.note ? 'has-note' : ''}" style="left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%;background:${HL_COLORS[a.color] || HL_COLORS.yellow}"></i>`).join('')).join('');
}

async function addHighlight(color, note = '') {
  if (!P.sel) return;
  const a = { id: uid('a_'), bookId: P.rec.id, type: 'highlight', page: P.sel.page, rects: P.sel.rects, text: P.sel.text, note, color, chapter: chapterTitle(P.sel.page), createdAt: Date.now() };
  P.anns.push(a);
  await db.put('annotations', a);
  drawHighlights(a.page);
  clearSelection();
}

async function addNote() {
  if (!P.sel) return;
  const keep = P.sel;
  const note = await promptSheet({ title: 'Add a note', placeholder: 'Your thoughts…', multiline: true });
  if (note === null) return;
  P.sel = keep;
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
      if (c) { a.color = c.dataset.c; await db.put('annotations', a); drawHighlights(a.page); close(); return; }
      const act = e.target.closest('[data-a]')?.dataset.a;
      if (act === 'note') {
        close();
        const note = await promptSheet({ title: 'Note', value: a.note || '', multiline: true });
        if (note !== null) { a.note = note.trim(); await db.put('annotations', a); drawHighlights(a.page); }
      }
      if (act === 'del') {
        P.anns = P.anns.filter(x => x.id !== a.id);
        await db.del('annotations', a.id);
        drawHighlights(a.page);
        close();
      }
    }),
  });
}

// ---------- bookmarks & favourite pages ----------

const markHere = type => P.anns.find(a => a.type === type && a.page === P.page);

async function toggleMark(type) {
  const existing = markHere(type);
  if (existing) {
    P.anns = P.anns.filter(a => a !== existing);
    await db.del('annotations', existing.id);
    toast(type === 'fav' ? 'Removed from favourite pages' : 'Bookmark removed');
  } else {
    let text = '';
    try { text = (await (await P.pdf.getPage(P.page)).getTextContent()).items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim().slice(0, 140); } catch (e) { /* image page */ }
    const a = { id: uid('a_'), bookId: P.rec.id, type, page: P.page, text, chapter: chapterTitle(P.page), createdAt: Date.now() };
    P.anns.push(a);
    await db.put('annotations', a);
    toast(type === 'fav' ? 'Page added to favourites ♥' : 'Bookmark added');
  }
  updateUi();
}

// ---------- panels ----------

function openToc() {
  const items = P.chapters;
  const cur = chapterTitle(P.page);
  openSheet(`<div class="toc"><h3>Contents</h3>${items.length
    ? items.map(c => `<button class="toc-item ${c.title === cur ? 'on' : ''}" style="padding-left:${16 + c.depth * 16}px" data-page="${c.page}">${esc(c.title)}<small class="muted"> · p. ${c.page}</small></button>`).join('')
    : '<p class="muted">This PDF has no table of contents. Use the slider at the bottom to jump to any page.</p>'}</div>`, {
    className: 'tall',
    onMount: (sheet, close) => {
      setTimeout(() => $('.toc-item.on', sheet)?.scrollIntoView({ block: 'center' }), 300);
      sheet.addEventListener('click', e => {
        const t = e.target.closest('[data-page]');
        if (t) { P.navigated = true; goTo(+t.dataset.page); close(); }
      });
    },
  });
}

function openNotes() {
  const by = type => P.anns.filter(a => a.type === type).sort((a, b) => a.page - b.page || (a.rects && b.rects ? a.rects[0][1] - b.rects[0][1] : 0));
  const hls = by('highlight'), marks = by('bookmark'), favs = by('fav');
  const markRow = (a, ic) => `<div class="ann" data-go="${a.page}">
      <strong class="fav-title ${ic === 'bookmark' ? 'mark' : ''}">${icon(ic)} Page ${a.page}</strong>
      <p class="muted small">${esc(a.chapter || '')}${a.text ? ' — “' + esc(a.text) + '…”' : ''}</p>
      <button class="icon-btn ann-del" data-del="${a.id}" aria-label="Delete">${icon('trash')}</button></div>`;
  const hlHtml = hls.length ? hls.map(a => `<div class="ann" data-go="${a.page}">
      <blockquote style="--hl:${HL_COLORS[a.color] || HL_COLORS.yellow}">${esc(a.text)}</blockquote>
      ${a.note ? `<p class="ann-note">${esc(a.note)}</p>` : ''}<span class="muted small">Page ${a.page}${a.chapter ? ' · ' + esc(a.chapter) : ''}</span>
      <button class="icon-btn ann-del" data-del="${a.id}" aria-label="Delete">${icon('trash')}</button></div>`).join('')
    : '<p class="muted">Select text while reading to highlight it or add a note.</p>';
  openSheet(`<div class="notes"><div class="seg"><button class="on" data-tab="h">Highlights (${hls.length})</button><button data-tab="b">Bookmarks (${marks.length})</button><button data-tab="f">Favourites (${favs.length})</button></div>
    <div class="pane" data-pane="h">${hlHtml}</div>
    <div class="pane" data-pane="b" hidden>${marks.length ? marks.map(a => markRow(a, 'bookmark')).join('') : '<p class="muted">Tap the bookmark at the top while reading to bookmark a page.</p>'}</div>
    <div class="pane" data-pane="f" hidden>${favs.length ? favs.map(a => markRow(a, 'heart')).join('') : '<p class="muted">Tap the heart at the top while reading to save a favourite page.</p>'}</div></div>`, {
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
        const a = P.anns.find(x => x.id === del.dataset.del);
        P.anns = P.anns.filter(x => x !== a);
        await db.del('annotations', a.id);
        if (a.type === 'highlight') drawHighlights(a.page);
        del.closest('.ann').remove();
        updateUi();
        return;
      }
      const go = e.target.closest('[data-go]');
      if (go) { P.navigated = true; goTo(+go.dataset.go); close(); }
    }),
  });
}

function applyTone() {
  const t = TONES[P.prefs.tone] || TONES.paper;
  P.el.style.setProperty('--page-bg', t.bg);
  P.el.style.setProperty('--page-fg', t.dark ? '#e6e1d8' : '#2b2520');
  P.el.style.setProperty('--pdf-filter', t.filter);
  P.el.classList.toggle('dark', !!t.dark);
  $('.r-dim', P.el).style.opacity = (1 - P.prefs.brightness).toFixed(2);
  $('.r-warm', P.el).style.opacity = (P.prefs.warmth * 0.32).toFixed(2);
}

const STEPS = {
  zoom:       { label: 'Zoom',       step: 0.1, min: 0.6, max: 4, fmt: v => `${Math.round(v * 100)}%` },
  brightness: { label: 'Brightness', step: 0.1, min: 0.3, max: 1, fmt: v => `${Math.round(v * 100)}%` },
  warmth:     { label: 'Warmth',     step: 0.1, min: 0,   max: 1, fmt: v => v ? `${Math.round(v * 100)}%` : 'Off' },
};

function openSettings() {
  const p = P.prefs;
  const views = [['paginated', 'paged', 'Paged'], ['scrolled', 'scrolled', 'Scrolled'], ['chapter', 'chapterView', 'Chapter']];
  openSheet(`<div class="r-settings">
    <div class="view-modes">${views.map(([k, ic, n]) => `<button class="vm ${p.flow === k ? 'on' : ''}" data-flow="${k}">${icon(ic)}<span>${n}</span></button>`).join('')}</div>
    <div class="set-block">
      <span class="set-title">Page tone</span>
      <div class="theme-dots">${Object.entries(TONES).map(([k, t]) => `<button class="tdot ${p.tone === k ? 'on' : ''}" data-tone="${k}" title="${t.name}" style="background:${t.dark ? t.bg : k === 'white' ? '#fff' : t.bg};color:${t.dark ? '#ddd' : '#222'}">${icon('check')}</button>`).join('')}</div>
    </div>
    <div class="set-block steps">${Object.keys(STEPS).map(k => stepper(k, STEPS[k].label, STEPS[k].fmt(p[k]))).join('')}</div>
  </div>`, {
    className: 'reader-settings',
    onMount: (sheet) => {
      sheet.addEventListener('click', e => {
        const t = e.target.closest('button');
        if (!t) return;
        const key = t.dataset.inc || t.dataset.dec;
        if (key) {
          const cfg = STEPS[key];
          p[key] = stepValue(cfg, p[key], t.dataset.inc ? 1 : -1);
          $(`[data-out="${key}"]`, sheet).textContent = cfg.fmt(p[key]);
          P.savePrefs(p);
          if (key === 'zoom') layout(); else applyTone();
          return;
        }
        if (t.dataset.tone) { p.tone = t.dataset.tone; $$('[data-tone]', sheet).forEach(b => b.classList.toggle('on', b === t)); applyTone(); P.savePrefs(p); }
        if (t.dataset.flow && t.dataset.flow !== p.flow) {
          p.flow = t.dataset.flow;
          $$('[data-flow]', sheet).forEach(b => b.classList.toggle('on', b === t));
          P.savePrefs(p);
          layout();
        }
      });
    },
  });
}

// ---------- finishing ----------

async function finish() {
  P.finished = true;
  clearTimeout(P.saveT);
  const rec = P.rec;
  await P.onFinished(rec);
  const box = $('.r-finish', P.el);
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
    if (s) { P.rate(rec, +s.dataset.star); $$('.star', box).forEach((x, i) => x.classList.toggle('on', i < +s.dataset.star)); return; }
    const f = e.target.closest('[data-f]')?.dataset.f;
    if (f === 'stay') box.classList.remove('show');
    if (f === 'shelf') history.back();
  };
}

// ---------- close ----------

export async function closePdfReader() {
  if (!P) return;
  const sess = P;
  P = null;
  closeAllSheets();
  clearTimeout(sess.saveT);
  if (!sess.finished) await sess.saveBook(sess.rec);
  window.removeEventListener('popstate', onPop);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', sess.onResize);
  document.removeEventListener('selectionchange', onSelectionChange);
  if (sess.observer) sess.observer.disconnect();
  try { sess.pdf && sess.pdf.destroy(); } catch (e) { /* ignore */ }
  sess.el.classList.add('leaving');
  document.body.classList.remove('reading');
  setTimeout(() => sess.el.remove(), 260);
  sess.onClose && sess.onClose();
}
