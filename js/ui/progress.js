// Barra de progreso de lectura: una línea fina bajo la cabecera que avanza con el scroll (<div class="scroll-progress">).
// Solo escribe la variable CSS --progress (0..1); el aspecto vive en css/motion.css.

export function initScrollProgress(el = document.querySelector('.scroll-progress')) {
  if (!el) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    el.style.setProperty('--progress', p.toFixed(4));
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}
