// Confeti dorado sobre un <canvas> (porta js/confetti.js). Sin efectos al importar: no toca el DOM ni
// arranca nada hasta que se llama a startConfetti. No-op sin DOM/canvas o con prefers-reduced-motion.
// Se detiene solo tras `duration` ms (las piezas dejan de reaparecer y el canvas queda limpio).

const COLORS = ['#eac871', '#e0b444', '#d19b22', '#b07f14', '#faefd2', '#af101a'];
const noop = () => {};

/**
 * @param {HTMLCanvasElement|null} canvas
 * @param {{count?: number, duration?: number}} [o]
 * @returns {() => void} stop
 */
export function startConfetti(canvas, { count = 36, duration = 4200 } = {}) {
  if (typeof window === 'undefined' || !canvas || typeof canvas.getContext !== 'function') return noop;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return noop;
  const ctx = canvas.getContext('2d');
  if (!ctx) return noop;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  const size = () => {
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();

  const rnd = (a, b) => a + Math.random() * (b - a);
  const parts = Array.from({ length: count }, () => ({
    x: rnd(0, W), y: rnd(-H, 0), r: rnd(6, 14), d: rnd(0, 2 * Math.PI),
    color: COLORS[Math.floor(Math.random() * COLORS.length)], tilt: 0, tiltA: 0, tiltInc: rnd(0.05, 0.12),
  }));

  const t0 = performance.now();
  let raf = 0;
  let stopped = false;
  const frame = (now) => {
    if (stopped) return;
    const recycling = now - t0 < duration;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    parts.forEach((p, i) => {
      p.tiltA += p.tiltInc;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2.2;
      p.x += Math.sin(p.d) * 0.6;
      p.tilt = Math.sin(p.tiltA - i / 3) * 12;
      if (p.y > H + 20 && recycling) { p.x = rnd(0, W); p.y = -20; }
      if (p.y <= H + 20) {
        alive++;
        ctx.beginPath();
        ctx.lineWidth = p.r / 2;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 3, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 5);
        ctx.stroke();
      }
    });
    if (alive) raf = requestAnimationFrame(frame);
    else stop();
  };
  window.addEventListener('resize', size);
  raf = requestAnimationFrame(frame);

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    ctx.clearRect(0, 0, W, H);
  }
  return stop;
}
