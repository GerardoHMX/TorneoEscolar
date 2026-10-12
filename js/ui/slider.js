// Indicador deslizante de los filtros (chips): una pastilla que se desplaza hasta el chip elegido en vez de saltar.
// Los filtros se re-renderizan enteros en cada cambio de estado (setHTML), así que la geometría anterior se recuerda en
// memoria (por sección y filtro) y el indicador nuevo arranca desde ella. Mejora progresiva: sin JS el chip activo
// lleva su propio fondo (css/motion.css solo lo quita cuando existe `.has-slider`).

const last = new Map();

/**
 * @param {Element} row `.chip-row` con los chips (el activo lleva aria-pressed="true")
 * @param {string} key identifica el filtro entre re-renderizados (p. ej. `sección:filtro`)
 */
export function attachSlider(row, key) {
  if (!row || row.querySelector(':scope > .chip-slider')) return;
  const active = row.querySelector('.chip[aria-pressed="true"]');
  if (!active) return;

  const geo = () => {
    const r = row.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    return { x: a.left - r.left + row.scrollLeft, y: a.top - r.top + row.scrollTop, w: a.width, h: a.height };
  };
  const to = geo();
  if (!(to.w > 0)) return; // fila oculta o sin layout

  const from = last.get(key) ?? to;
  last.set(key, to);

  const el = document.createElement('span');
  el.className = 'chip-slider';
  el.setAttribute('aria-hidden', 'true');
  const put = (g) => {
    el.style.width = `${g.w}px`;
    el.style.height = `${g.h}px`;
    el.style.transform = `translate(${g.x}px, ${g.y}px)`;
  };
  el.style.transition = 'none';
  put(from);
  row.classList.add('has-slider');
  row.prepend(el);
  void el.offsetWidth; // fuerza el cálculo de estilo: la transición parte de `from`
  el.style.transition = '';
  put(to);

  // Si cambia el tamaño de la fila (giro del móvil, redimensionado), recoloca sin animar.
  if (typeof ResizeObserver === 'function') {
    let first = true;
    new ResizeObserver(() => {
      if (first) { first = false; return; } // la primera notificación es la de alta
      const g = geo();
      el.style.transition = 'none';
      put(g);
      last.set(key, g);
      requestAnimationFrame(() => { el.style.transition = ''; });
    }).observe(row);
  }
}
