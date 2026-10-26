// Metadata helpers: EPUB parsing, cover colour extraction, Google Books lookups.

const CHARS_PER_PAGE = 1600;

export async function parseEpub(arrayBuffer, onProgress = () => {}) {
  const book = ePub(arrayBuffer);
  await book.ready;
  const md = book.packaging.metadata || {};
  onProgress('Reading cover');

  let coverBlob = null;
  try {
    const url = await book.coverUrl();
    if (url) coverBlob = await (await fetch(url)).blob();
  } catch (e) { /* no cover */ }
  if (!coverBlob) coverBlob = await findFirstImage(book);

  onProgress('Counting pages');
  let pages = 0;
  try {
    await book.loaded.pageList;
    if (book.pageList && book.pageList.pages && book.pageList.pages.length > 10) {
      pages = book.pageList.lastPage || book.pageList.pages.length;
    }
  } catch (e) { /* ignore */ }
  if (!pages) pages = await estimatePages(book);

  const result = {
    title: cleanText(md.title) || 'Untitled',
    author: cleanText(md.creator) || 'Unknown author',
    description: stripHtml(md.description || ''),
    publisher: cleanText(md.publisher),
    language: md.language || '',
    pages,
    coverBlob,
  };
  book.destroy();
  return result;
}

async function findFirstImage(book) {
  try {
    const resources = book.resources && book.resources.replacementUrls ? book.resources : null;
    const assets = (book.resources && book.resources.assets) || [];
    const img = assets.find(a => /image\//.test(a.type));
    if (img && resources) {
      const idx = book.resources.assets.indexOf(img);
      const url = book.resources.replacementUrls[idx];
      if (url) return await (await fetch(url)).blob();
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function estimatePages(book) {
  let chars = 0;
  const items = [];
  book.spine.each(s => items.push(s));
  for (const section of items) {
    try {
      const doc = await section.load(book.load.bind(book));
      const body = doc.body || doc.querySelector('body');
      chars += (body ? body.textContent : doc.textContent || '').replace(/\s+/g, ' ').length;
      section.unload();
    } catch (e) { /* skip broken section */ }
  }
  return Math.max(1, Math.round(chars / CHARS_PER_PAGE));
}

function cleanText(s) { return (s || '').toString().replace(/\s+/g, ' ').trim(); }
function stripHtml(s) {
  const d = document.createElement('div');
  d.innerHTML = s;
  return cleanText(d.textContent);
}

// Picks the most prominent, reasonably saturated colour of an image for the book spine.
export async function dominantColor(blobOrUrl) {
  const img = await loadImage(blobOrUrl);
  const size = 48;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  let data;
  try { data = ctx.getImageData(0, 0, size, size).data; } catch (e) { return null; }

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const light = (max + min) / 510;
    // Favour colourful mid tones, but keep near-black/white as fallback candidates.
    const weight = 1 + sat * 2.5 - Math.abs(light - 0.45) * 0.8;
    const bk = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, w: 0 };
    bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.w += Math.max(0.15, weight);
    buckets.set(key, bk);
  }
  let best = null;
  for (const bk of buckets.values()) if (!best || bk.w > best.w) best = bk;
  if (!best) return null;
  return rgbToHex(best.r / best.n, best.g / best.n, best.b / best.n);
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}

export function textColorFor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1d1a16' : '#f6efe2';
}

export function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = v => Math.max(0, Math.min(255, v + amt * 255));
  return rgbToHex(f(r), f(g), f(b));
}

export function hashColor(str) {
  const palette = ['#7b2d26', '#2f4858', '#33658a', '#5b4b8a', '#3d5a40', '#8a5a44', '#a23b72', '#1f3b4d', '#6b4226', '#264653', '#9c6644', '#4a4e69'];
  return palette[hash(str) % palette.length];
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- Google Books ----

// Google Books first; Open Library when Google is rate-limited, down or finds nothing.
export async function searchBooks(query) {
  try {
    const g = await searchGoogleBooks(query);
    if (g.length) return g;
  } catch (e) { /* fall through */ }
  return searchOpenLibrary(query);
}

export async function searchOpenLibrary(query) {
  const fields = 'key,title,subtitle,author_name,number_of_pages_median,cover_i,first_publish_year,first_sentence';
  const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=24&fields=${fields}`);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
  const json = await res.json();
  return (json.docs || []).map(d => ({
    googleId: null, olKey: d.key,
    title: d.title + (d.subtitle ? ': ' + d.subtitle : ''),
    shortTitle: d.title || 'Untitled',
    author: (d.author_name || []).slice(0, 3).join(', ') || 'Unknown author',
    pages: d.number_of_pages_median || 0,
    description: Array.isArray(d.first_sentence) ? d.first_sentence[0] : '',
    published: String(d.first_publish_year || ''),
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
    coverLarge: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '',
  }));
}

export async function searchGoogleBooks(query) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=24&printType=books`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
  const json = await res.json();
  return (json.items || []).map(item => {
    const v = item.volumeInfo || {};
    const links = v.imageLinks || {};
    let cover = links.thumbnail || links.smallThumbnail || '';
    cover = cover.replace('http://', 'https://').replace('&edge=curl', '');
    return {
      googleId: item.id,
      title: v.title + (v.subtitle ? ': ' + v.subtitle : ''),
      shortTitle: v.title || 'Untitled',
      author: (v.authors || []).join(', ') || 'Unknown author',
      pages: v.pageCount || 0,
      description: v.description || '',
      published: v.publishedDate || '',
      cover,
      coverLarge: cover ? cover.replace('zoom=1', 'zoom=0') : '',
    };
  });
}

export async function lookupPageCount(title, author) {
  try {
    const q = `intitle:${title}` + (author && author !== 'Unknown author' ? ` inauthor:${author.split(',')[0]}` : '');
    const results = await searchGoogleBooks(q).catch(() => searchOpenLibrary(`${title} ${author && author !== 'Unknown author' ? author.split(',')[0] : ''}`));
    const hit = results.find(r => r.pages > 0);
    return hit ? hit.pages : 0;
  } catch (e) { return 0; }
}

export async function fetchBlob(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith('image/') ? blob : null;
  } catch (e) { return null; }
}

// ---- PDF ----

export const isPdf = file => /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';
export const isBookFile = file => /\.(epub|pdf)$/i.test(file.name || '') || ['application/pdf', 'application/epub+zip'].includes(file.type);

export function pdfLib() {
  const lib = window.pdfjsLib;
  if (lib && !lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  return lib;
}

export async function parsePdf(arrayBuffer, fileName = '') {
  const pdf = await pdfLib().getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  let info = {};
  try { info = (await pdf.getMetadata()).info || {}; } catch (e) { /* no metadata */ }
  const fromName = fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
  let title = cleanText(info.Title).replace(/^Microsoft Word - /i, '').replace(/\.(docx?|pdf)$/i, '');
  if (!title || /^untitled$/i.test(title) || /[\/]/.test(title)) title = fromName || 'Untitled';

  // The first page becomes the cover.
  let coverBlob = null;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 600 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    coverBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  } catch (e) { /* cover stays empty */ }

  const result = {
    title, author: cleanText(info.Author) || 'Unknown author',
    description: cleanText(info.Subject), pages: pdf.numPages, coverBlob,
  };
  pdf.destroy();
  return result;
}

export function parseBookFile(file, buf, onProgress) {
  return isPdf(file) ? parsePdf(buf, file.name) : parseEpub(buf, onProgress);
}
