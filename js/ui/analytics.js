// Google Analytics (gtag) cargado dinámicamente y solo con un ID válido de GA4.
// Sin scripts en línea (la CSP solo permite 'self' y googletagmanager.com).

const GA_ID = /^G-[A-Z0-9]+$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Sin analítica en local (desarrollo, pruebas) ni sin host: no ensucia las estadísticas reales. */
export function shouldLoadAnalytics(hostname) {
  const h = String(hostname ?? '').trim().toLowerCase();
  return h !== '' && !LOCAL_HOSTS.has(h);
}
const loaded = new Set();

/** @param {string} gaId ID de medición (G-XXXXXXX); cualquier otro valor se ignora sin error. */
export function initAnalytics(gaId) {
  if (typeof document === 'undefined' || typeof gaId !== 'string' || !GA_ID.test(gaId)) return;
  if (loaded.has(gaId)) return;
  const w = globalThis.window ?? globalThis;
  try {
    w.dataLayer = w.dataLayer || [];
    // gtag exige objetos `arguments` en dataLayer, no arrays.
    w.gtag = w.gtag || function gtag() { w.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(s);
    loaded.add(gaId);
    w.gtag('js', new Date());
    w.gtag('config', gaId);
  } catch { /* la analítica nunca debe romper la página */ }
}
