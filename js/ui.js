// Small UI helpers: icons, sheets, toasts, confirm dialogs, escaping.

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  covers: '<rect x="3.5" y="5" width="7" height="14" rx="1.2"/><rect x="13.5" y="5" width="7" height="14" rx="1.2"/>',
  spines: '<path d="M5 5v15M9 5v15M13 7v13M17 5.5l3.2 14"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  dots: '<circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  toc: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  bookmark: '<path d="M6 3.5h12v17l-6-4-6 4z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.2C19.5 15.4 12 20 12 20z"/>',
  type: '<path d="M3.5 18 8 6l4.5 12M5 14h6M15 18v-5.5a3 3 0 0 1 6 0V18M15 15h6"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M9 12h6M9 16h4"/>',
  highlight: '<path d="m9 11-5 5v4h4l5-5"/><path d="m14 6 4 4-6 6-4-4z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  reread: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  open: '<path d="M2.5 5H9a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2.5zM21.5 5H15a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7.5z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  library: '<path d="M4 4v16M8 4v16M12 4l4.5 16M19 4v16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 8v7M9 12l3 3 3-3"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  paged: '<rect x="3" y="5" width="4" height="14" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="17" y="5" width="4" height="14" rx="1"/>',
  scrolled: '<path d="M5 4h14M5 9h14M5 14h14M5 19h14"/>',
  chapterView: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  alignLeft: '<path d="M4 6h16M4 10h11M4 14h16M4 18h11"/>',
  alignJustify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4.2 4-6.5 4.5-11 3 2 4.6 4.3 4.6 6.5 1-.6 1.6-1.8 1.8-3 1.4 1.4 2.1 3.6 2.1 5.5 0 4.3-2.7 8-6.5 8z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---- bottom sheets (stackable) ----
const stack = [];

export function openSheet(html, { onMount, onClose, wide = false, className = '' } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = `sheet ${wide ? 'wide' : ''} ${className}`;
  sheet.setAttribute('role', 'dialog');
  sheet.innerHTML = `<div class="grabber"></div>${html}`;
  scrim.appendChild(sheet);
  document.body.appendChild(scrim);
  requestAnimationFrame(() => scrim.classList.add('show'));
  const entry = { scrim, sheet, onClose };
  stack.push(entry);
  scrim.addEventListener('pointerdown', e => { if (e.target === scrim) closeSheet(entry); });
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(entry); });
  addDragToClose(sheet, () => closeSheet(entry));
  if (onMount) onMount(sheet, () => closeSheet(entry));
  return { sheet, close: () => closeSheet(entry) };
}

export function closeSheet(entry = stack[stack.length - 1]) {
  if (!entry) return;
  const i = stack.indexOf(entry);
  if (i >= 0) stack.splice(i, 1);
  entry.scrim.classList.remove('show');
  setTimeout(() => entry.scrim.remove(), 280);
  if (entry.onClose) entry.onClose();
}

window.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) { e.stopImmediatePropagation(); closeSheet(); } }, true);

export function closeAllSheets() { while (stack.length) closeSheet(); }
export function sheetOpen() { return stack.length > 0; }

function addDragToClose(sheet, close) {
  const grab = sheet.querySelector('.grabber');
  let y0 = null, dy = 0;
  grab.addEventListener('pointerdown', e => { y0 = e.clientY; dy = 0; grab.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
  grab.addEventListener('pointermove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  grab.addEventListener('pointerup', () => {
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 90) close();
    y0 = null;
  });
}

export function toast(msg, { action, onAction, ms = 2800 } = {}) {
  let host = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  const kill = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); };
  if (action) t.querySelector('button').onclick = () => { kill(); onAction && onAction(); };
  setTimeout(kill, ms);
  return { update: m => { t.querySelector('span').textContent = m; }, close: kill };
}

export function confirmSheet({ title, text, ok = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    let done = false;
    openSheet(`<div class="confirm">
      <h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="btn-row"><button class="btn ghost" data-close>Cancel</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div></div>`, {
      onMount: (s, close) => { s.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); close(); }; },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

export function promptSheet({ title, value = '', placeholder = '', ok = 'Save', multiline = false }) {
  return new Promise(resolve => {
    let done = false;
    const field = multiline
      ? `<textarea rows="5" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input type="text" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
    openSheet(`<div class="confirm"><h3>${esc(title)}</h3>${field}
      <div class="btn-row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-ok>${esc(ok)}</button></div></div>`, {
      onMount: (s, close) => {
        const f = s.querySelector('input,textarea');
        setTimeout(() => f.focus(), 250);
        s.querySelector('[data-ok]').onclick = () => { done = true; resolve(f.value); close(); };
      },
      onClose: () => { if (!done) resolve(null); },
    });
  });
}

export function stars(rating, cls = '') {
  let s = `<div class="stars ${cls}" data-rating="${rating}">`;
  for (let i = 1; i <= 5; i++) s += `<button class="star ${i <= rating ? 'on' : ''}" data-star="${i}" aria-label="${i} star">${icon('star')}</button>`;
  return s + '</div>';
}

// A -/+ row: values only change on a deliberate tap, never from brushing a slider.
export function stepper(key, label, value) {
  return `<div class="step-row"><div class="step-text"><span>${esc(label)}</span><small data-out="${key}">${esc(value)}</small></div>
    <button class="step-btn" data-dec="${key}" aria-label="Less ${esc(label)}">−</button><button class="step-btn" data-inc="${key}" aria-label="More ${esc(label)}">+</button></div>`;
}

export function stepValue(cfg, current, dir) {
  const v = Math.round((current + dir * cfg.step) * 1000) / 1000;
  return Math.max(cfg.min, Math.min(cfg.max, v));
}

// Puts a floating menu just below a rect on screen (above it when there's no room),
// with a little arrow pointing at the selection.
export function placeBelow(el, rect) {
  const gap = matchMedia('(pointer: coarse)').matches ? 30 : 12; // clear the phone's selection handles
  const bw = el.offsetWidth, bh = el.offsetHeight, vw = innerWidth, vh = innerHeight;
  let top = rect.bottom + gap, above = false;
  if (top + bh > vh - 10) { top = Math.max(10, rect.top - bh - 12); above = true; }
  const cx = rect.left + rect.width / 2;
  const left = Math.max(8, Math.min(vw - bw - 8, cx - bw / 2));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.setProperty('--ax', `${Math.max(16, Math.min(bw - 16, cx - left))}px`);
  el.classList.toggle('above', above);
}
