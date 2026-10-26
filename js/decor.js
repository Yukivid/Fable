// Hand-built SVG decor: candles with live flames, flowers in glass, plants and a steaming mug.
// Sizes are in "shelf units" (1u = 1px when book covers are 72px wide).

let n = 0;
const nid = p => `${p}${++n}`;

export const DECOR_TYPES = {
  pillar:   { name: 'Pillar candle', w: 46, h: 70,  candle: true },
  taper:    { name: 'Taper candle',  w: 30, h: 118, candle: true },
  jar:      { name: 'Jar candle',    w: 50, h: 62,  candle: true },
  roses:    { name: 'White roses',   w: 78, h: 122 },
  pinkroses:{ name: 'Blush roses',   w: 78, h: 122 },
  lavender: { name: 'Lavender',      w: 54, h: 120 },
  succulent:{ name: 'Succulent',     w: 56, h: 58 },
  pothos:   { name: 'Trailing pothos', w: 70, h: 74 },
  mug:      { name: 'Coffee mug',    w: 52, h: 60 },
};

export function decorSvg(type, opts = {}) {
  const f = BUILDERS[type];
  return f ? f(opts) : '';
}

// ---------- candles ----------

function flame() {
  const g = nid('fl'), c = nid('fc');
  return `<div class="flame-wrap"><div class="halo"></div>
  <svg class="flame" viewBox="0 0 20 44" aria-hidden="true">
    <defs>
      <radialGradient id="${g}" cx="50%" cy="72%" r="62%">
        <stop offset="0" stop-color="#fffef6"/>
        <stop offset=".28" stop-color="#fff3b8"/>
        <stop offset=".55" stop-color="#ffc85a"/>
        <stop offset=".8" stop-color="#ff8a24" stop-opacity=".85"/>
        <stop offset="1" stop-color="#ff5a10" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${c}" cx="50%" cy="70%" r="55%">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset=".6" stop-color="#fff8dc" stop-opacity=".9"/>
        <stop offset="1" stop-color="#fff3c0" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <path d="M10 1C12.6 10 18.4 18 17 29 16.2 36 13.4 40.5 10 40.5S3.8 36 3 29C1.6 18 7.4 10 10 1Z" fill="url(#${g})"/>
    <path d="M10 14C11.4 20 14 25 13 31 12.5 35 11.4 37.5 10 37.5S7.5 35 7 31C6 25 8.6 20 10 14Z" fill="url(#${c})"/>
    <ellipse cx="10" cy="37" rx="2.6" ry="3.6" fill="#5d8dff" opacity=".45"/>
  </svg></div>`;
}

function wick(x, y) {
  return `<path d="M${x} ${y} q.6 -3 -.4 -6" stroke="#2a1d14" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
}

function pillar() {
  const w = nid('w'), p = nid('p'), gl = nid('g');
  return `${flame()}<svg class="body" viewBox="0 0 46 70" aria-hidden="true">
  <defs>
    <linearGradient id="${w}" x1="0" x2="1">
      <stop offset="0" stop-color="#b9a585"/><stop offset=".18" stop-color="#e6d8be"/>
      <stop offset=".42" stop-color="#fbf3e3"/><stop offset=".62" stop-color="#f1e5cd"/>
      <stop offset=".88" stop-color="#cdb999"/><stop offset="1" stop-color="#a69172"/>
    </linearGradient>
    <radialGradient id="${p}" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#fff6de"/><stop offset="1" stop-color="#dccaa8"/>
    </radialGradient>
    <radialGradient id="${gl}" cx="50%" cy="0%" r="75%">
      <stop offset="0" stop-color="#ffb24a" stop-opacity=".75"/><stop offset=".55" stop-color="#ffcf7a" stop-opacity=".25"/>
      <stop offset="1" stop-color="#ffd38a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M5 18 Q5 14.5 9 14 L37 14 Q41 14.5 41 18 L41 66 Q41 69 37 69 L9 69 Q5 69 5 66 Z" fill="url(#${w})"/>
  <path class="wax-glow" d="M5 18 Q5 14.5 9 14 L37 14 Q41 14.5 41 18 L41 44 L5 44 Z" fill="url(#${gl})"/>
  <path d="M5 17.5 Q5.5 12 10 12.5 Q16 13.6 23 13.3 Q30 13 36 12.4 Q40.6 12 41 17.5 Q34 21 23 21 Q12 21 5 17.5Z" fill="#efe2c8"/>
  <ellipse cx="23" cy="16.6" rx="14" ry="3.4" fill="url(#${p})"/>
  <path d="M8.5 19 q-1.2 6 -.3 11 q.5 2.3 1.6 0 q.8 -5 .3 -10.5Z" fill="#f4ead6" opacity=".95"/>
  <path d="M33.5 19.5 q1.4 4 .6 7.5 q-.6 1.8 -1.5 0 q-.4 -3.6 .2 -7Z" fill="#f4ead6" opacity=".9"/>
  <path d="M19 20.5 q-.8 3 0 5 q.8 1 1.4 0 q.3 -2.5 -.1 -4.6Z" fill="#fbf4e6" opacity=".8"/>
  <path d="M7 24 L7 64" stroke="#fff" stroke-opacity=".25" stroke-width="1.2"/>
  ${wick(23, 17)}
  <ellipse cx="23" cy="69" rx="18" ry="1.6" fill="#000" opacity=".25"/>
</svg>`;
}

function taper() {
  const w = nid('w'), b = nid('b'), gl = nid('g');
  return `${flame()}<svg class="body" viewBox="0 0 30 118" aria-hidden="true">
  <defs>
    <linearGradient id="${w}" x1="0" x2="1">
      <stop offset="0" stop-color="#5e1a1d"/><stop offset=".3" stop-color="#9a2d31"/>
      <stop offset=".5" stop-color="#b9443f"/><stop offset=".75" stop-color="#8a2629"/><stop offset="1" stop-color="#4c1215"/>
    </linearGradient>
    <linearGradient id="${b}" x1="0" x2="1">
      <stop offset="0" stop-color="#6b4a12"/><stop offset=".25" stop-color="#c79a3a"/>
      <stop offset=".45" stop-color="#fbe4a0"/><stop offset=".6" stop-color="#d7ab4a"/><stop offset="1" stop-color="#5c3d0c"/>
    </linearGradient>
    <radialGradient id="${gl}" cx="50%" cy="0%" r="100%">
      <stop offset="0" stop-color="#ff9a52" stop-opacity=".8"/><stop offset="1" stop-color="#ff9a52" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M11 14 Q11 11.5 15 11.5 Q19 11.5 19 14 L19.6 82 L10.4 82 Z" fill="url(#${w})"/>
  <path class="wax-glow" d="M11 14 Q11 11.5 15 11.5 Q19 11.5 19 14 L19.2 34 L10.8 34 Z" fill="url(#${gl})"/>
  <path d="M11.2 15 q-1 5 -.2 9 q.6 1.6 1.2 0 q.2 -4.5 -.1 -8.6Z" fill="#a8363a"/>
  <path d="M12.4 16 L12.6 80" stroke="#fff" stroke-opacity=".18" stroke-width=".9"/>
  ${wick(15, 12)}
  <path d="M7 82 Q15 78 23 82 L22 86 Q15 88 8 86 Z" fill="url(#${b})"/>
  <path d="M12.5 86 Q11.5 92 13 97 L17 97 Q18.5 92 17.5 86 Z" fill="url(#${b})"/>
  <ellipse cx="15" cy="98" rx="4.5" ry="2" fill="url(#${b})"/>
  <path d="M12 99 Q10 104 6 108 L24 108 Q20 104 18 99 Z" fill="url(#${b})"/>
  <path d="M2.5 110 Q2.5 107 7 107 L23 107 Q27.5 107 27.5 110 L27 113 Q15 116 3 113 Z" fill="url(#${b})"/>
  <path d="M8 108.6 Q15 107.6 22 108.6" stroke="#fff6cf" stroke-opacity=".7" stroke-width=".8" fill="none"/>
  <ellipse cx="15" cy="115.5" rx="13" ry="1.6" fill="#000" opacity=".3"/>
</svg>`;
}

function jar() {
  const gl = nid('gl'), wx = nid('wx'), lg = nid('lg');
  return `${flame()}<svg class="body" viewBox="0 0 50 62" aria-hidden="true">
  <defs>
    <linearGradient id="${gl}" x1="0" x2="1">
      <stop offset="0" stop-color="#5a2a08" stop-opacity=".95"/><stop offset=".2" stop-color="#a65a14" stop-opacity=".85"/>
      <stop offset=".45" stop-color="#d98b2b" stop-opacity=".7"/><stop offset=".7" stop-color="#9c5210" stop-opacity=".85"/>
      <stop offset="1" stop-color="#4a2205" stop-opacity=".95"/>
    </linearGradient>
    <radialGradient id="${wx}" cx="50%" cy="35%" r="60%">
      <stop offset="0" stop-color="#fff3d0"/><stop offset="1" stop-color="#e7c88f"/>
    </radialGradient>
    <radialGradient id="${lg}" cx="50%" cy="20%" r="80%">
      <stop offset="0" stop-color="#ffcc66" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a2e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M7 14 Q7 11 11 11 L39 11 Q43 11 43 14 L44 56 Q44 60 40 60 L10 60 Q6 60 6 56 Z" fill="url(#${gl})"/>
  <path class="wax-glow" d="M8 22 L42 22 L42.6 48 L7.4 48 Z" fill="url(#${lg})"/>
  <ellipse cx="25" cy="23" rx="16.5" ry="3.2" fill="url(#${wx})"/>
  <path d="M8.2 23 L41.8 23 L43.4 55 Q43.4 58.5 40 58.5 L10 58.5 Q6.6 58.5 6.6 55 Z" fill="#f0d9a8" opacity=".35"/>
  <ellipse cx="25" cy="11.5" rx="18" ry="2.4" fill="none" stroke="#f5c27a" stroke-opacity=".7" stroke-width="1.1"/>
  <path d="M10.5 15 L10 55" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
  <path d="M14 16 L13.8 30" stroke="#fff" stroke-opacity=".25" stroke-width="1" stroke-linecap="round"/>
  <rect x="13" y="32" width="24" height="14" rx="2" fill="#f4ead8" opacity=".9"/>
  <text x="25" y="41.2" font-family="Georgia, serif" font-size="5" text-anchor="middle" fill="#6b4a2a" font-style="italic">amber</text>
  ${wick(25, 22.5)}
  <ellipse cx="25" cy="60.5" rx="19" ry="1.5" fill="#000" opacity=".3"/>
</svg>`;
}

// ---------- flowers ----------

function rose(cx, cy, r, base, dark, rot = 0) {
  const g = nid('rg');
  let s = `<defs><radialGradient id="${g}" cx="50%" cy="100%" r="110%">
    <stop offset="0" stop-color="${dark}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="#ffffff" stop-opacity=".95"/>
  </radialGradient></defs><g transform="translate(${cx} ${cy}) rotate(${rot}) scale(1 .82)">`;
  const layers = [
    { k: 6, rad: r * .55, w: r * .62, h: r * .62, off: 0 },
    { k: 5, rad: r * .38, w: r * .52, h: r * .55, off: 30 },
    { k: 4, rad: r * .22, w: r * .42, h: r * .44, off: 12 },
    { k: 3, rad: r * .1, w: r * .3, h: r * .32, off: 50 },
  ];
  for (const L of layers) {
    for (let i = 0; i < L.k; i++) {
      const a = (360 / L.k) * i + L.off;
      const w = L.w, h = L.h;
      s += `<path transform="rotate(${a}) translate(0 ${-L.rad})" d="M${-w} ${h * .25} Q${-w * 1.05} ${-h * .9} 0 ${-h} Q${w * 1.05} ${-h * .9} ${w} ${h * .25} Q0 ${h * .55} ${-w} ${h * .25}Z" fill="url(#${g})" stroke="${dark}" stroke-opacity=".35" stroke-width=".35"/>`;
    }
  }
  s += `<path d="M0 0 m-${r * .14} 0 a${r * .14} ${r * .14} 0 1 1 ${r * .2} ${r * .06} a${r * .08} ${r * .08} 0 1 1 -${r * .1} -${r * .1}" fill="none" stroke="${dark}" stroke-opacity=".55" stroke-width=".55"/>`;
  return s + '</g>';
}

function leaf(x, y, len, rot, g) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M0 0 C${len * .25} ${-len * .38} ${len * .75} ${-len * .4} ${len} 0 C${len * .75} ${len * .34} ${len * .25} ${len * .3} 0 0Z" fill="url(#${g})"/>
    <path d="M0 0 Q${len * .5} ${-len * .04} ${len * .96} 0" stroke="#d9f0c6" stroke-opacity=".45" stroke-width=".5" fill="none"/></g>`;
}

function leafGrad(id) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5f8f4e"/><stop offset=".5" stop-color="#3c6b34"/><stop offset="1" stop-color="#244a22"/></linearGradient>`;
}

function glassVase(id, tint = '#bfe3d6') {
  // returns [defs, back, front] for a bulb vase
  const glass = nid('gv'), water = nid('wt'), clip = nid('cl');
  const shape = 'M26 66 Q24 74 18 80 Q8 90 9 102 Q10 116 26 117 L52 117 Q68 116 69 102 Q70 90 60 80 Q54 74 52 66 Z';
  const defs = `<linearGradient id="${glass}" x1="0" x2="1">
      <stop offset="0" stop-color="${tint}" stop-opacity=".55"/><stop offset=".15" stop-color="${tint}" stop-opacity=".18"/>
      <stop offset=".5" stop-color="#ffffff" stop-opacity=".06"/><stop offset=".85" stop-color="${tint}" stop-opacity=".2"/>
      <stop offset="1" stop-color="${tint}" stop-opacity=".6"/></linearGradient>
    <linearGradient id="${water}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8f0ec" stop-opacity=".35"/><stop offset="1" stop-color="#7fb8a8" stop-opacity=".45"/></linearGradient>
    <clipPath id="${clip}"><path d="${shape}"/></clipPath>`;
  const back = `<g clip-path="url(#${clip})"><rect x="0" y="88" width="78" height="40" fill="url(#${water})"/>
      <ellipse cx="39" cy="88" rx="30" ry="1.6" fill="#ffffff" opacity=".35"/></g>`;
  const front = `<path d="${shape}" fill="url(#${glass})" stroke="#ffffff" stroke-opacity=".45" stroke-width=".8"/>
    <ellipse cx="39" cy="66" rx="13" ry="2" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".9"/>
    <path d="M17 88 Q12 98 15 108" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M60 86 Q64 94 63 100" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M18 116 Q39 119 60 116" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" fill="none"/>
    <ellipse cx="39" cy="118.4" rx="27" ry="1.8" fill="#000" opacity=".28"/>`;
  return [defs, back, front];
}

function roses({ pink = false } = {}) {
  const lg = nid('lg');
  const [defs, back, front] = glassVase(lg + 'v', pink ? '#cfe6d2' : '#a8d8b0');
  const base = pink ? '#f2b8c0' : '#f7f3ea', dark = pink ? '#b5546a' : '#b9ad92';
  const stems = `<g stroke="#4c7a3e" stroke-width="1.5" fill="none" stroke-linecap="round">
      <path d="M38 112 Q36 80 24 34"/><path d="M40 112 Q42 70 54 32"/><path d="M39 112 Q39 70 39 20"/><path d="M38 112 Q30 80 16 56"/></g>`;
  const leaves = leaf(30, 54, 16, 200, lg) + leaf(46, 50, 15, -25, lg) + leaf(24, 70, 14, 215, lg) + leaf(52, 64, 13, -35, lg) + leaf(39, 44, 11, -80, lg);
  return `<svg class="body" viewBox="0 0 78 122" aria-hidden="true"><defs>${leafGrad(lg)}${defs}</defs>
    ${stems}${leaves}${back}
    ${rose(16, 52, 11, base, dark, 20)}${rose(24, 30, 13, base, dark, -15)}${rose(55, 28, 13, base, dark, 30)}${rose(39, 16, 13.5, base, dark, 0)}
    ${front}</svg>`;
}

function lavender() {
  const pot = nid('pt'), bud = nid('bd');
  let stems = '', buds = '';
  const tops = [[10, 6], [18, 2], [26, 0], [34, 3], [42, 8], [14, 14], [38, 12], [27, 10], [46, 18], [6, 18]];
  tops.forEach(([x, y], i) => {
    const cx = 27 + (x - 27) * .35;
    stems += `<path d="M${cx} 78 Q${(cx + x) / 2} ${y + 40} ${x} ${y + 4}" stroke="#7a8f5a" stroke-width="1" fill="none"/>`;
    for (let j = 0; j < 9; j++) {
      const t = j / 9, bx = x + (cx - x) * t * .25 + (j % 2 ? 1.3 : -1.3), by = y + 4 + j * 2.6;
      buds += `<ellipse cx="${bx}" cy="${by}" rx="${1.9 - t * .4}" ry="${2.5 - t * .5}" fill="url(#${bud})" transform="rotate(${j % 2 ? 25 : -25} ${bx} ${by})"/>`;
    }
    if (i < 6) stems += `<path d="M${cx} 70 q${i % 2 ? 6 : -6} -10 ${i % 2 ? 9 : -9} -12" stroke="#8aa06a" stroke-width=".8" fill="none"/>`;
  });
  return `<svg class="body" viewBox="0 0 54 120" aria-hidden="true"><defs>
    <linearGradient id="${pot}" x1="0" x2="1"><stop offset="0" stop-color="#9a9a94"/><stop offset=".35" stop-color="#e9e6dd"/><stop offset=".6" stop-color="#f7f4ec"/><stop offset="1" stop-color="#8d8b84"/></linearGradient>
    <radialGradient id="${bud}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#c9b2ef"/><stop offset=".6" stop-color="#8b6cc9"/><stop offset="1" stop-color="#5a3f94"/></radialGradient></defs>
    ${stems}${buds}
    <path d="M10 78 L44 78 L41 114 Q41 117 37 117 L17 117 Q13 117 13 114 Z" fill="url(#${pot})"/>
    <path d="M8 76 Q8 74 10 74 L44 74 Q46 74 46 76 L46 80 Q27 82 8 80 Z" fill="url(#${pot})"/>
    <path d="M16 84 L18 110" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="27" cy="118" rx="16" ry="1.6" fill="#000" opacity=".3"/></svg>`;
}

function terracotta(id) {
  return `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#7a3a1e"/><stop offset=".3" stop-color="#c06a3e"/><stop offset=".5" stop-color="#d98457"/><stop offset=".75" stop-color="#b05c33"/><stop offset="1" stop-color="#6b301a"/></linearGradient>`;
}

function succulent() {
  const pot = nid('pt'), lf = nid('sl');
  let leaves = '';
  const rings = [{ k: 9, r: 15, w: 6, h: 13, o: 0 }, { k: 7, r: 9, w: 5, h: 10, o: 20 }, { k: 5, r: 4, w: 4, h: 7, o: 8 }];
  rings.forEach(R => {
    for (let i = 0; i < R.k; i++) {
      const a = (360 / R.k) * i + R.o;
      leaves += `<path transform="translate(28 26) scale(1 .55) rotate(${a}) translate(0 ${-R.r})" d="M0 ${R.h * .3} Q${-R.w} 0 ${-R.w * .4} ${-R.h * .7} L0 ${-R.h} L${R.w * .4} ${-R.h * .7} Q${R.w} 0 0 ${R.h * .3}Z" fill="url(#${lf})" stroke="#d88a9a" stroke-opacity=".5" stroke-width=".5"/>`;
    }
  });
  return `<svg class="body" viewBox="0 0 56 58" aria-hidden="true"><defs>${terracotta(pot)}
    <radialGradient id="${lf}" cx="50%" cy="90%" r="100%"><stop offset="0" stop-color="#4e7d6a"/><stop offset=".6" stop-color="#8fb9a4"/><stop offset="1" stop-color="#d9c2c8"/></radialGradient></defs>
    <path d="M12 30 L44 30 L40 54 Q40 56 37 56 L19 56 Q16 56 16 54 Z" fill="url(#${pot})"/>
    <path d="M9 27 L47 27 L46.4 33 L9.6 33 Z" fill="url(#${pot})"/>
    <ellipse cx="28" cy="27.4" rx="18.5" ry="2.2" fill="#3b2418"/>
    ${leaves}
    <path d="M14 34 L17.5 52" stroke="#fff" stroke-opacity=".2" stroke-width="1.5"/>
    <ellipse cx="28" cy="56.6" rx="14" ry="1.4" fill="#000" opacity=".3"/></svg>`;
}

function pothos() {
  const pot = nid('pt'), lg = nid('lg');
  const heart = (x, y, s, r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
      <path d="M0 0 C-5 -3 -7 -9 -3.5 -10.5 C-1.5 -11.3 0 -9.6 0 -8.6 C0 -9.6 1.5 -11.3 3.5 -10.5 C7 -9 5 -3 0 0Z" fill="url(#${lg})"/>
      <path d="M0 -.5 L0 -8.5" stroke="#e8f5c8" stroke-opacity=".5" stroke-width=".35"/>
      <path d="M-2 -6 Q-1 -7 0 -7.5 M2 -6 Q1 -7 0 -7.5" stroke="#f6f0b0" stroke-opacity=".35" stroke-width=".5" fill="none"/></g>`;
  let vines = '', leaves = '';
  const paths = [
    { d: 'M20 30 Q6 44 8 70 Q9 88 4 104', pts: [[12, 42, 200], [8, 58, 160], [8, 74, 210], [6, 92, 150], [4, 104, 180]] },
    { d: 'M48 30 Q64 44 62 64 Q61 80 66 92', pts: [[57, 40, 150], [62, 54, 200], [62, 70, 160], [65, 88, 190]] },
    { d: 'M34 28 Q30 40 28 52', pts: [[31, 42, 170], [28, 52, 200]] },
  ];
  paths.forEach(p => {
    vines += `<path d="${p.d}" stroke="#3f6b2f" stroke-width="1" fill="none"/>`;
    p.pts.forEach(([x, y, r], i) => { leaves += heart(x, y, .95 + (i % 2) * .15, r + (i % 2 ? 25 : -25)); });
  });
  const top = [[22, 22, -40], [30, 16, -10], [40, 15, 15], [48, 22, 45], [35, 22, 0], [26, 26, -70], [44, 26, 70]]
    .map(([x, y, r]) => heart(x, y, 1.15, r + 180)).join('');
  return `<svg class="body hangs" viewBox="0 0 70 110" aria-hidden="true"><defs>${terracotta(pot)}
    <linearGradient id="${lg}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8dc26a"/><stop offset=".5" stop-color="#4f8a37"/><stop offset="1" stop-color="#2e5a22"/></linearGradient></defs>
    <path d="M17 32 L53 32 L50 70 Q50 73 46 73 L24 73 Q20 73 20 70 Z" fill="url(#${pot})"/>
    <path d="M14 28 L56 28 L55.4 35 L14.6 35 Z" fill="url(#${pot})"/>
    <ellipse cx="35" cy="28.6" rx="20.5" ry="2.3" fill="#3b2418"/>
    ${top}${vines}${leaves}
    <ellipse cx="35" cy="73.4" rx="16" ry="1.4" fill="#000" opacity=".3"/></svg>`;
}

function mug() {
  const m = nid('mg'), c = nid('cf');
  return `<svg class="body" viewBox="0 0 52 60" aria-hidden="true"><defs>
    <linearGradient id="${m}" x1="0" x2="1"><stop offset="0" stop-color="#8a8f86"/><stop offset=".3" stop-color="#d9dccf"/><stop offset=".55" stop-color="#eef0e6"/><stop offset="1" stop-color="#7d8279"/></linearGradient>
    <radialGradient id="${c}" cx="40%" cy="40%" r="70%"><stop offset="0" stop-color="#a0663a"/><stop offset=".5" stop-color="#5e341a"/><stop offset="1" stop-color="#2a160a"/></radialGradient></defs>
    <g class="steam" fill="none" stroke="#fff" stroke-linecap="round">
      <path d="M17 18 q-4 -6 0 -10 q4 -4 0 -9"/><path d="M24 17 q-4 -6 0 -11 q4 -4 0 -6"/><path d="M31 18 q-4 -5 0 -9 q4 -5 0 -8"/></g>
    <path d="M38 28 Q50 28 49 38 Q48 47 37 46" stroke="url(#${m})" stroke-width="4.5" fill="none"/>
    <path d="M7 24 L41 24 L39 54 Q39 58 35 58 L13 58 Q9 58 9 54 Z" fill="url(#${m})"/>
    <ellipse cx="24" cy="24" rx="17" ry="3.2" fill="#c9ccc0"/>
    <ellipse cx="24" cy="24.6" rx="15" ry="2.4" fill="url(#${c})"/>
    <ellipse cx="20" cy="24.2" rx="4" ry=".7" fill="#f3d7b0" opacity=".45"/>
    <path d="M12 28 L13.4 52" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
    <path d="M17 38 q7 -5 14 0 q-7 6 -14 0Z" fill="#b88a6a" opacity=".55"/>
    <ellipse cx="24" cy="58.5" rx="16" ry="1.4" fill="#000" opacity=".3"/></svg>`;
}

const BUILDERS = {
  pillar, taper, jar, lavender, succulent, pothos, mug,
  roses: () => roses(),
  pinkroses: () => roses({ pink: true }),
};
