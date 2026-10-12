// «Compartir este sitio» (icono del pie): hoja nativa del sistema (móvil) o, si no existe, copia el enlace
// al portapapeles y lo anuncia en una región viva educada. Se comparte siempre la URL canónica del sitio
// (<link rel="canonical">), nunca la dirección con #ancla o ?parámetros. No necesita cambios de CSP:
// navigator.share y el portapapeles no hacen peticiones de red.
import { safeUrl } from '../core/dom.js';

const DEFAULT_TITLE = 'Torneo Al-Ándalus';
const CLEAR_MS = 6000; // el mensaje se retira solo (sin anunciarlo)
const txt = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * @param {{canonical?: string, title?: string, text?: string,
 *   locationLike?: {origin?: string, pathname?: string}}} input
 * @returns {{title: string, text: string, url: string}} url '' si no hay ninguna válida
 */
export function buildSharePayload({ canonical, title, text, locationLike } = {}) {
  let url = safeUrl(canonical);
  if (!url) {
    const origin = txt(locationLike?.origin);
    const path = txt(locationLike?.pathname) || '/';
    url = /^https?:\/\/[^\s/]+$/i.test(origin) && path.startsWith('/') ? `${origin}${path}` : '';
  }
  return { title: txt(title) || DEFAULT_TITLE, text: txt(text), url };
}

/**
 * Método disponible: 'native' (navigator.share), 'clipboard' (navigator.clipboard.writeText),
 * 'legacy' (textarea + document.execCommand('copy')) o 'none'. Con `payload`, si canShare dice que no
 * (o lanza), se descarta la hoja nativa.
 */
export function pickShareMethod(navigatorLike, documentLike, payload) {
  const nav = navigatorLike ?? {};
  if (typeof nav.share === 'function') {
    let ok = true;
    if (payload && typeof nav.canShare === 'function') {
      try { ok = nav.canShare(payload) !== false; } catch { ok = false; }
    }
    if (ok) return 'native';
  }
  if (typeof nav.clipboard?.writeText === 'function') return 'clipboard';
  if (typeof documentLike?.execCommand === 'function') return 'legacy';
  return 'none';
}

/** Copiado antiguo (navegadores sin API de portapapeles o con permiso denegado). */
function legacyCopy(doc, text) {
  if (typeof doc?.execCommand !== 'function' || typeof doc.createElement !== 'function' || !doc.body) return false;
  let area = null;
  const prev = doc.activeElement;
  try {
    area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '-9999px';
    area.style.opacity = '0';
    doc.body.appendChild(area);
    area.select();
    area.setSelectionRange?.(0, text.length);
    return doc.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    try { area?.remove?.(); } catch { /* nada */ }
    try { prev?.focus?.({ preventScroll: true }); } catch { /* nada */ }
  }
}

/**
 * Comparte o copia. Nunca lanza.
 * @returns {Promise<'shared'|'cancelled'|'copied'|'failed'>} 'cancelled' = la persona cerró la hoja nativa.
 */
export async function shareSite(payload, { nav, doc } = {}) {
  const url = txt(payload?.url);
  if (!url) return 'failed';
  let method = pickShareMethod(nav, doc, payload);
  if (method === 'native') {
    try {
      await nav.share({ title: payload.title, text: payload.text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      method = pickShareMethod({ clipboard: nav.clipboard }, doc); // p. ej. NotAllowedError: se copia el enlace
    }
  }
  if (method === 'clipboard') {
    try {
      await nav.clipboard.writeText(url);
      return 'copied';
    } catch {
      method = typeof doc?.execCommand === 'function' ? 'legacy' : 'none';
    }
  }
  if (method === 'legacy') return legacyCopy(doc, url) ? 'copied' : 'failed';
  return 'failed';
}

/** Clave del mensaje a anunciar; null = no decir nada (hoja nativa compartida o cancelada). */
export function shareStatusKey(result) {
  if (result === 'copied') return 'share_copied';
  if (result === 'failed') return 'share_failed';
  return null;
}

/**
 * Cablea el botón [data-share] dentro de `root` (el pie se repinta al cambiar de idioma o de CONFIGURACION:
 * llamar tras cada repintado; un botón ya cableado no se vuelve a cablear).
 * @param {Element} root
 * @param {{t: (k: string, f?: string) => string, getPayload: () => {title: string, text: string, url: string}}} opts
 */
export function bindShare(root, { t, getPayload }) {
  const button = root?.querySelector('[data-share]');
  if (!button || button.dataset.shareBound === '1') return;
  button.dataset.shareBound = '1';
  const status = root.querySelector('[data-share-status]');
  let busy = false;
  let timer = 0;
  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    if (status) status.textContent = '';
    let result = 'failed';
    try {
      result = await shareSite(getPayload(), { nav: globalThis.navigator, doc: globalThis.document });
    } catch { result = 'failed'; }
    busy = false;
    const key = shareStatusKey(result);
    if (!key || !status?.isConnected) return;
    status.textContent = key === 'share_copied'
      ? t('share_copied', 'Enlace copiado')
      : t('share_failed', 'No se pudo compartir; copia el enlace desde la barra de direcciones');
    timer = setTimeout(() => { status.textContent = ''; }, CLEAR_MS);
  });
}
