// Generated ambient soundscapes (no audio files needed) and floating dust motes.

let ctx = null, master = null, nodes = [], timers = [];

function noiseBuffer(type) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.6; }
    }
  }
  return buf;
}

function loop(buf, filterType, freq, gain) {
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start();
  nodes.push(src);
  return g;
}

function burst(dur, freq, gain, q = 1) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.random() * 1.6 - 0.8; src.connect(f).connect(g).connect(p).connect(master); }
  else src.connect(f).connect(g).connect(master);
  src.start();
}

function schedule(fn, min, max) {
  const tick = () => { fn(); timers.push(setTimeout(tick, min + Math.random() * (max - min))); };
  timers.push(setTimeout(tick, min));
}

const SCAPES = {
  rain() {
    loop(noiseBuffer('pink'), 'lowpass', 2600, 0.55);
    loop(noiseBuffer('pink'), 'highpass', 5000, 0.08);
    schedule(() => burst(0.03, 2500 + Math.random() * 3000, 0.25, 2), 40, 180);
    schedule(() => burst(0.09, 600 + Math.random() * 400, 0.3, 4), 600, 2400); // heavier drips on the sill
  },
  fireplace() {
    loop(noiseBuffer('brown'), 'lowpass', 500, 0.9);
    loop(noiseBuffer('pink'), 'bandpass', 900, 0.05);
    schedule(() => burst(0.012 + Math.random() * 0.02, 1500 + Math.random() * 3500, 0.5 + Math.random() * 0.5, 1.5), 60, 700);
    schedule(() => { for (let i = 0; i < 4; i++) setTimeout(() => burst(0.01, 3000 + Math.random() * 2000, 0.4, 2), i * (20 + Math.random() * 40)); }, 1500, 5000);
  },
  cafe() {
    loop(noiseBuffer('brown'), 'bandpass', 350, 0.7);
    loop(noiseBuffer('pink'), 'bandpass', 1200, 0.12);
    schedule(() => burst(0.05, 4000 + Math.random() * 2500, 0.12, 12), 1200, 5000); // cups and spoons
  },
};

export const SOUND_NAMES = { off: 'Off', rain: 'Rain on window', fireplace: 'Fireplace', cafe: 'Quiet café' };

export function setSound(name, volume = 0.4) {
  stopSound();
  if (!name || name === 'off' || !SCAPES[name]) return;
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
  SCAPES[name]();
}

export function setVolume(v) { if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2); }

export function stopSound() {
  timers.forEach(clearTimeout); timers = [];
  nodes.forEach(n => { try { n.stop(); } catch (e) { /* already stopped */ } }); nodes = [];
  if (master) { master.disconnect(); master = null; }
}

// ---- dust motes drifting through candle light ----

export function dust(canvas) {
  const c = canvas.getContext('2d');
  let parts = [], raf = 0, w = 0, h = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = canvas.width = r.width * devicePixelRatio;
    h = canvas.height = r.height * devicePixelRatio;
    const count = Math.min(70, Math.round(r.width * r.height / 9000));
    parts = Array.from({ length: count }, () => spawn(true));
  };
  const spawn = anywhere => ({
    x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
    r: (0.4 + Math.random() * 1.3) * devicePixelRatio,
    vx: (Math.random() - 0.5) * 0.15, vy: -(0.05 + Math.random() * 0.18),
    a: 0.15 + Math.random() * 0.45, p: Math.random() * Math.PI * 2,
  });
  const frame = () => {
    c.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.p += 0.01; p.x += p.vx + Math.sin(p.p) * 0.12; p.y += p.vy;
      if (p.y < -10 || p.x < -10 || p.x > w + 10) Object.assign(p, spawn(false));
      c.beginPath();
      c.fillStyle = `rgba(255, 228, 180, ${p.a * (0.6 + 0.4 * Math.sin(p.p * 2))})`;
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  resize();
  frame();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
