// Contadores animados (spec §4: goles, partidos, equipos). El marcado lleva SIEMPRE la cifra final
// (`<span data-count="12">12</span>`): sin JS, sin IntersectionObserver o con prefers-reduced-motion se
// queda tal cual. Con movimiento, al entrar en pantalla cuenta de 0 a la cifra con salida suave.

/** Valor entero mostrado en el progreso p ∈ [0, 1] (ease-out cúbico), acotado a [0, to]. */
export function countValue(to, p) {
  const n = Number.isFinite(to) ? Math.max(0, Math.round(to)) : 0;
  const x = Math.min(1, Math.max(0, Number(p) || 0));
  return Math.round(n * (1 - (1 - x) ** 3));
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Anima un elemento [data-count] de 0 a su objetivo tras `delay` ms. */
export function countUp(el, { duration = 1100, delay = 0 } = {}) {
  const to = Number(el?.dataset?.count);
  if (!el || !Number.isFinite(to) || reduced() || typeof requestAnimationFrame !== 'function') return;
  el.textContent = '0';
  setTimeout(() => {
    let start = 0;
    const step = (now) => {
      if (!start) start = now;
      const p = (now - start) / duration;
      el.textContent = String(countValue(to, p));
      if (p < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, delay);
}

const observers = new WeakMap(); // root -> IntersectionObserver del render anterior (se desconecta al re-render)

/**
 * Observa los [data-count] de `root` y los anima una vez al entrar en pantalla. Cada elemento puede
 * fijar su retraso con data-count-delay (ms), p. ej. para esperar a que suba su escalón del podio.
 */
export function bindCountUps(root) {
  if (!root) return;
  observers.get(root)?.disconnect();
  observers.delete(root);
  const els = root.querySelectorAll?.('[data-count]');
  if (!els?.length || typeof IntersectionObserver !== 'function' || reduced()) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      countUp(e.target, { delay: Number(e.target.dataset.countDelay) || 0 });
    }
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
  observers.set(root, io);
}
