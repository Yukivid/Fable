# Nook — cozy bookshelf & EPUB reader

A virtual bookshelf (Read · Reading · TBR) with realistic candles, flowers and plants, plus a full EPUB reader.
It is one codebase that works as a **website** and as an **installable app** (PWA) on Android, iPhone, Windows and Mac.
Everything is stored on the device (IndexedDB); nothing is uploaded anywhere.

## Run it

```
C:\Python313\python.exe -m http.server 5173 --directory "D:\Personal Project\bookshelf"
```

Open http://localhost:5173. (It must be served over http(s), not opened as a file.)

## Install as an app

- **Phone:** host the folder anywhere with HTTPS (GitHub Pages, Netlify, Cloudflare Pages — all free), open it in Chrome / Safari, then "Add to Home screen" / "Install app".
- **Desktop Chrome/Edge:** click the install icon in the address bar, or ⋮ menu → Install Nook. The installed app can open `.epub` files directly.
- Works offline after the first visit (except online book search).

## Features

- Three shelf pages — Read, Reading, TBR — swipe or tap the tabs. Shelves grow downward as you add books.
- Covers-facing or spines-facing per shelf. Spine colour is picked from the cover; spine thickness follows page count.
- Arrange mode (move icon, or long-press any item): drag books and decor anywhere; add/remove decor.
- Decor: pillar, taper and jar candles (tap to light / blow out), white & blush roses, lavender, succulent, trailing pothos, steaming mug.
- Customize: wood, wall colour (incl. glass), backdrop or your own photo, room light (dim it and the candles light the shelf), book size, floating dust, ambient sound (rain, fireplace, café — generated, no files).
- Import EPUBs (button, or drag files onto the page): cover, title, author, description and page count are read from the file.
- Search online (Google Books, falls back to Open Library) to add books to Read or TBR without a file. Reading shelf only holds books with an EPUB; attach one any time.
- Reader: continue where you left off, page colour themes + custom colours, fonts, text size / zoom (buttons, +/−, pinch), line spacing, margins, brightness, warmth, flip left/right or scroll up/down, two-page spread, highlights in 5 colours, notes, favourite pages, contents, progress slider.
- Finishing a book moves it to Read automatically and asks for a rating. Read books can be read again or moved to TBR; Reading books can move to Read or TBR.
- Remove from shelf (kept in Library) or delete permanently from the device.
- Back up / restore the whole library (books, EPUBs, notes, layout) as one .zip.

## Files

- `index.html`, `css/styles.css` — page and styling
- `js/app.js` — shelves, arranging, importing, search, customize, backup
- `js/reader.js` — reading mode
- `js/decor.js` — SVG candles, flowers, plants
- `js/meta.js` — EPUB metadata, cover colours, book search
- `js/ambience.js` — ambient sound and dust
- `js/db.js` — IndexedDB storage
- `sw.js`, `manifest.webmanifest`, `icons/` — offline + install support
- `vendor/` — epub.js 0.3.93 and JSZip 3.10.1
