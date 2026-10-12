// Utilidades compartidas por las capas superpuestas (hoja «Más», modal, loader):
// ciclo de foco, fondo inerte, bloqueo de scroll, movimiento reducido y textos de la UI.

/**
 * Índice al que debe saltar el foco al pulsar Tab dentro de una capa con foco atrapado.
 * @param {number} current índice del elemento enfocado (-1 si el foco está fuera)
 * @param {number} count número de elementos enfocables
 * @param {boolean} shift Mayús pulsada
 * @returns {number|null} índice destino, o null si el navegador puede seguir solo
 */
export function wrapFocusIndex(current, count, shift) {
  if (!(count > 0)) return null;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift && current === 0) return count - 1;
  if (!shift && current === count - 1) return 0;
  return null;
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'video[controls]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Elementos enfocables visibles dentro de `root`. */
export function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

const cssEsc = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&'));

/**
 * Selector estable para volver a encontrar un control tras re-renderizar su contenedor: su id; si no, su
 * etiqueta con sus atributos data-* y aria-controls (los que las secciones ya usan: data-value, data-day-step,
 * data-expand, aria-controls de los toggles de goles), precedido de su fila [data-filter] si es un chip.
 * null si el elemento no tiene rasgos estables.
 * @param {Element | null} el @param {(v: string) => string} [esc]
 */
export function stableSelector(el, esc = cssEsc) {
  if (!el || !el.tagName) return null;
  if (el.id) return `#${esc(el.id)}`;
  const attrs = [...(el.attributes ?? [])]
    .filter((a) => (a.name.startsWith('data-') && a.name.length > 5) || a.name === 'aria-controls')
    .map((a) => `[${a.name}="${esc(a.value)}"]`)
    .join('');
  if (!attrs) return null;
  const row = el.closest?.('[data-filter]');
  const prefix = row && row !== el ? `[data-filter="${esc(row.getAttribute('data-filter'))}"] ` : '';
  return `${prefix}${el.tagName.toLowerCase()}${attrs}`;
}

/** Mantiene Tab / Mayús+Tab dentro de `root`. Llamar desde un listener de keydown. */
export function trapTab(root, ev) {
  if (ev.key !== 'Tab') return;
  const list = focusables(root);
  if (!list.length) { ev.preventDefault(); return; }
  const to = wrapFocusIndex(list.indexOf(document.activeElement), list.length, ev.shiftKey);
  if (to !== null) { ev.preventDefault(); list[to].focus(); }
}

/**
 * Vuelve inertes los hijos directos de <body> salvo los que contienen `keep`.
 * Devuelve una función que deshace SOLO lo que se cambió (respeta inert previos, p. ej. #moreSheet).
 */
export function inertOutside(...keep) {
  const changed = [];
  for (const el of document.body.children) {
    if (el.tagName === 'SCRIPT' || el.inert) continue;
    if (keep.some((k) => k && (el === k || el.contains(k)))) continue;
    el.inert = true;
    changed.push(el);
  }
  return () => changed.forEach((el) => { el.inert = false; });
}

let locks = 0;
/** Bloqueo de scroll con contador (hoja, modal y loader pueden coincidir). Devuelve el desbloqueo. */
export function lockScroll() {
  locks += 1;
  document.documentElement.classList.add('has-overlay');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (!locks) document.documentElement.classList.remove('has-overlay');
  };
}

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Espera al fin de la transición/animación de `el` (propia, no de hijos) con tope de seguridad.
 * @param {Element} el @param {number} timeoutMs
 * @param {string} [prop] solo cuenta el fin de la transición de esta propiedad (p. ej. 'transform')
 */
export function afterMotion(el, timeoutMs, prop) {
  return new Promise((resolve) => {
    let t;
    const end = (ev) => {
      if (ev && ev.target !== el) return;
      if (ev && prop && ev.type === 'transitionend' && ev.propertyName !== prop) return;
      clearTimeout(t);
      el.removeEventListener('transitionend', end);
      el.removeEventListener('animationend', end);
      resolve();
    };
    el.addEventListener('transitionend', end);
    el.addEventListener('animationend', end);
    t = setTimeout(end, timeoutMs);
  });
}

// ---- Textos de la UI (i18n) ----
// Task 14 registra la función de traducción con setUiTranslator(t) al arrancar y al cambiar de idioma.
let translator = null;
export function setUiTranslator(t) { translator = typeof t === 'function' ? t : null; }
/** Traduce `key`; si no hay traductor o la clave falta (t devuelve la propia clave o vacío), usa `fallback`. */
export function ut(key, fallback) {
  const v = translator && key ? translator(key) : '';
  return v && v !== key ? String(v) : fallback;
}
