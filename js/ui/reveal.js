// Revelado escalonado de secciones y tarjetas (.reveal → .is-visible).
// Contrato con css/base.css: el contenido .reveal solo se oculta bajo <html class="js-reveal">,
// y esa clase la pone ESTE módulo justo al crear el IntersectionObserver (nunca sin él).

const MIN_RATIO = 0.12;   // elementos normales: ~1/8 visible
const MIN_PX = 48;        // o una franja de 48px, lo que llegue antes (elementos altos)

/**
 * ¿Se revela ya este elemento? Cualquier altura acaba revelándose:
 *  - ratio ≥ 0.12 (elementos que caben en pantalla), o
 *  - franja visible ≥ 48px (elementos altos, cuyo ratio sube despacio), o
 *  - el elemento es más alto que la zona observada (su ratio puede no llegar nunca a los umbrales).
 * @param {{isIntersecting: boolean, intersectionRatio: number, intersectionHeight: number,
 *          targetHeight?: number, rootHeight?: number}} e
 */
export function shouldReveal({ isIntersecting, intersectionRatio, intersectionHeight, targetHeight = 0, rootHeight = Infinity }) {
  if (!isIntersecting) return false;
  return intersectionRatio >= MIN_RATIO || intersectionHeight >= MIN_PX || targetHeight >= rootHeight;
}

let io = null;
const observed = new Set();

function show(el) { el.classList.add('is-visible'); }

/** Deja de observar nodos que ya no están en el documento (secciones re-renderizadas). */
function prune() {
  for (const el of observed) {
    if (!el.isConnected) { io?.unobserve(el); observed.delete(el); }
  }
}

/**
 * Observa los `.reveal` de `root` (y `root` si lo es) que aún no son visibles.
 * Se puede llamar de nuevo tras cada render: los nodos ya observados se ignoran.
 * Escalonado: si el nodo no fija `--i` en su style, recibe su orden dentro del lote que entra
 * a la vez en pantalla (tope 8), para que las tarjetas aparezcan en cascada.
 * @param {ParentNode} root
 */
export function observeReveal(root = document) {
  if (!root) return;
  const nodes = [...root.querySelectorAll('.reveal:not(.is-visible)')];
  if (root instanceof Element && root.matches('.reveal:not(.is-visible)')) nodes.unshift(root);

  if (typeof IntersectionObserver !== 'function') {
    nodes.forEach(show);
    return;
  }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      const batch = [];
      for (const e of entries) {
        const el = e.target;
        if (!el.isConnected) { io.unobserve(el); observed.delete(el); continue; }
        const ok = shouldReveal({
          isIntersecting: e.isIntersecting,
          intersectionRatio: e.intersectionRatio,
          intersectionHeight: e.intersectionRect.height,
          targetHeight: e.boundingClientRect.height,
          rootHeight: e.rootBounds?.height ?? window.innerHeight,
        });
        if (ok) batch.push(el);
      }
      batch.forEach((el, n) => {
        io.unobserve(el);
        observed.delete(el);
        if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', String(Math.min(n, 8)));
        show(el);
      });
    // Varios umbrales: 0 (entra), 0.01 (franja de elementos muy altos), 0.12 (elementos normales).
    }, { threshold: [0, 0.01, MIN_RATIO], rootMargin: '0px 0px -6% 0px' });
    document.documentElement.classList.add('js-reveal');
  }
  prune();
  for (const el of nodes) {
    if (observed.has(el)) continue;
    observed.add(el);
    io.observe(el);
  }
}
