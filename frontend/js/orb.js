// Voice orb: a 3D sphere of glowing star particles, drawn on a <canvas>, no libraries.
// It reacts to live audio levels (the learner's mic or the tutor's voice) and has four states:
//   idle      slow rotation, gentle breathing
//   listening the learner is talking: the sphere ripples with the mic's frequency bands
//   thinking  waiting for the backend: particles swirl and pulse
//   speaking  the tutor is talking: same ripple, driven by the tutor's audio, cyan
//
// Usage: const orb = createOrb(canvas, readLevels); orb.setState("listening");
// readLevels() returns null or { level: 0..1, bands: number[] (0..1) }.

const PALETTE = {
  idle:      [79, 227, 161],
  listening: [120, 255, 178],
  thinking:  [64, 214, 200],
  speaking:  [89, 200, 255],
};
const BANDS = 24;
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function makeSprite(rgb) {
  const s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gr, b] = rgb;
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, `rgba(${r},${gr},${b},0.95)`);
  grad.addColorStop(0.45, `rgba(${r},${gr},${b},0.25)`);
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return s;
}

export function createOrb(canvas, readLevels = () => null, { particles, hud = true } = {}) {
  const ctx = canvas.getContext("2d");
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const N = particles ?? (small ? 650 : 1100);

  // Points evenly spread on a sphere (Fibonacci lattice), plus a loose halo of "dust" stars.
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * golden;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, ph: Math.random() * 6.28,
               tw: 0.6 + Math.random() * 2.2, s: 0.5 + Math.random() * 1.1,
               band: Math.min(BANDS - 1, Math.floor(Math.abs(y) * BANDS)), dust: false });
  }
  for (let i = 0; i < Math.round(N * 0.12); i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * 6.28, rr = 1.25 + Math.random() * 0.6;
    const r = Math.sqrt(1 - u * u);
    pts.push({ x: Math.cos(th) * r * rr, y: u * rr * 0.6, z: Math.sin(th) * r * rr, ph: Math.random() * 6.28,
               tw: 0.4 + Math.random(), s: 0.4 + Math.random() * 0.8, band: 0, dust: true });
  }

  const sprites = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, makeSprite(v)]));
  let state = "idle";
  let color = [...PALETTE.idle];
  let level = 0;
  let rot = 0;
  let last = performance.now();
  let t = 0;
  let w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  new ResizeObserver(resize).observe(canvas);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!canvas.offsetParent) return;                      // hidden: skip the work
    if (!w) resize();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt * (REDUCED ? 0.4 : 1);

    // Audio drives the sphere only while someone is speaking.
    const audio = state === "listening" || state === "speaking" ? readLevels() : null;
    let target = audio ? Math.min(1, audio.level) : 0;
    if (state === "thinking") target = 0.22 + 0.12 * Math.sin(t * 5);
    level += (target - level) * (target > level ? 0.35 : 0.08);
    const bands = audio?.bands;

    const goal = PALETTE[state];
    for (let i = 0; i < 3; i++) color[i] += (goal[i] - color[i]) * 0.08;
    const rgb = `${color[0] | 0},${color[1] | 0},${color[2] | 0}`;

    const spin = 0.12 + level * 0.9 + (state === "thinking" ? 0.9 : 0);
    rot += dt * spin * (REDUCED ? 0.3 : 1);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * (hud ? 0.27 : 0.33);

    // Core glow
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    glow.addColorStop(0, `rgba(${rgb},${0.16 + level * 0.3})`);
    glow.addColorStop(0.5, `rgba(${rgb},${0.05 + level * 0.1})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    if (hud) drawHud(cx, cy, R, rgb);

    // Particles
    const cosY = Math.cos(rot), sinY = Math.sin(rot);
    const tilt = 0.35 + Math.sin(t * 0.3) * 0.08;
    const cosX = Math.cos(tilt), sinX = Math.sin(tilt);
    const breath = 0.025 * Math.sin(t * 1.3);
    const sprite = sprites[state];
    const F = 3.2;

    for (const p of pts) {
      let d = 1 + breath;
      if (!p.dust) {
        const n = (Math.sin(p.x * 3 + t * 1.7) + Math.sin(p.y * 4 - t * 1.3) + Math.sin(p.z * 5 + t * 2.1)) / 3;
        d += level * 0.12 * n;
        if (bands) d += bands[p.band] * 0.16 * (0.55 + 0.45 * Math.sin(p.ph + t * 3));
        if (state === "thinking") d *= 0.9 + 0.08 * Math.sin(t * 4 + p.y * 7);
      } else {
        d *= 1 + level * 0.25;
      }
      // rotate around Y, then tilt around X
      let x = p.x * d, y = p.y * d, z = p.z * d;
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const persp = F / (F - z2);
      const sx = cx + x1 * R * persp;
      const sy = cy + y2 * R * persp;
      const depth = (z2 + 1.3) / 2.6;                         // 0 = back, 1 = front
      const twinkle = 0.55 + 0.45 * Math.sin(t * p.tw * 2 + p.ph);
      const alpha = Math.max(0.04, Math.min(1, (0.15 + depth * 0.85) * twinkle * (p.dust ? 0.6 : 1)));
      const size = p.s * persp * (2.2 + level * 1.4) * (p.dust ? 0.8 : 1);
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, sx - size * 2, sy - size * 2, size * 4, size * 4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // Thin rotating rings and ticks around the sphere, HUD style.
  function drawHud(cx, cy, R, rgb) {
    ctx.lineCap = "round";
    const ring = (radius, start, len, width, alpha) => {
      ctx.strokeStyle = `rgba(${rgb},${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + len);
      ctx.stroke();
    };
    const pulse = 1 + level * 0.08;
    const r1 = R * 1.42 * pulse, r2 = R * 1.58 * pulse, r3 = R * 1.75;
    for (let i = 0; i < 3; i++) ring(r1, t * 0.5 + i * 2.094, 1.2, 1.5, 0.35 + level * 0.4);
    for (let i = 0; i < 2; i++) ring(r2, -t * 0.32 + i * 3.1416, 0.5, 2.5, 0.25 + level * 0.3);
    ring(r2, -t * 0.32 + 1.2, 0.12, 2.5, 0.6);
    // tick ring
    const ticks = 72;
    ctx.strokeStyle = `rgba(${rgb},${0.16 + level * 0.25})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2 + t * 0.08;
      const long = i % 6 === 0 ? 7 : 3;
      ctx.moveTo(cx + Math.cos(a) * r3, cy + Math.sin(a) * r3);
      ctx.lineTo(cx + Math.cos(a) * (r3 + long), cy + Math.sin(a) * (r3 + long));
    }
    ctx.stroke();
  }

  requestAnimationFrame(frame);
  return {
    setState(s) { if (PALETTE[s]) state = s; },
    get state() { return state; },
  };
}
