// «Cambio de filtro con respuesta»: tras elegir un filtro (ESO/BCH, fase, curso…) la sección se vuelve a pintar entera;
// este módulo marca ese re-render concreto para que css/motion.css anime la entrada de las tarjetas (fundido +
// deslizamiento corto, escalonados). Los re-renders por refresco de datos, idioma o carga inicial no pasan por aquí.

let pending = null;

/** Se llama justo antes de setState al cambiar un filtro. */
export function markSwap(sectionId) { pending = sectionId; }

/** bind() la llama tras cada pintado: si ese re-render viene de un filtro, anima el contenido durante un momento. */
export function runSwap(root, sectionId) {
  if (!root || pending !== sectionId) return;
  pending = null;
  root.classList.add('is-swapping');
  setTimeout(() => root.classList.remove('is-swapping'), 900);
}
