// Helpers puros del arranque y del refresco de datos (js/main.js). Sin DOM: testeables en Node.

/** `location.hash` -> id de sección. Una secuencia %xx inválida (p. ej. «#%E0») no rompe el arranque. */
export function safeDecodeHash(hash) {
  const s = String(hash ?? '').replace(/^#/, '');
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Al recargar la página (F5) se ignora la caché de 60 s: quien acaba de editar la hoja ve el cambio. */
export function shouldBypassCache(navType) {
  return navType === 'reload';
}

/** Tipo de navegación de la carga actual ('navigate', 'reload', …); '' si el navegador no lo expone. */
export function navigationType() {
  try {
    return globalThis.performance?.getEntriesByType?.('navigation')?.[0]?.type ?? '';
  } catch {
    return '';
  }
}

/** Mensaje tras pulsar «Actualizar datos»: hojas que fallaron (loadAllWithStatus) -> clave de traducción. */
export function refreshStatusKey(failed) {
  return Array.isArray(failed) && failed.length === 0 ? 'refresh_done' : 'refresh_failed';
}

/**
 * Secciones que lanzaron al pintarse: no se reintentan en cada refresco mientras la clave (versión de los
 * datos + idioma) sea la misma con la que fallaron.
 */
export function failureMemo() {
  const failed = new Map();
  return {
    mark(id, key) { failed.set(id, key); },
    blocked(id, key) { return failed.has(id) && failed.get(id) === key; },
    clear(id) { failed.delete(id); },
  };
}
