// Traducciones ES/EN. createI18n no toca el DOM al crearse (testeable en Node); `apply(root)` actualiza
// el HTML estático: [data-translate] (texto), [data-translate-aria-label], [data-translate-placeholder],
// <html lang> y los botones [data-lang] (aria-pressed). El idioma se guarda en localStorage (con try/catch).

export const LANGS = ['es', 'en'];
export const STORAGE_KEY = 'lang';
const norm = (l) => (LANGS.includes(l) ? l : 'es');
// Object.hasOwn no existe en Safari < 15.4 / Chrome < 93: la forma clásica funciona en todos.
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** Idioma inicial: el guardado si es válido; si no, inglés solo si el navegador está en inglés; si no, español. */
export function pickLang(stored, navigatorLang) {
  if (LANGS.includes(stored)) return stored;
  return /^en\b/i.test(String(navigatorLang ?? '')) ? 'en' : 'es';
}

function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Lee el idioma guardado; null si no hay o el almacenamiento está bloqueado. */
export function storedLang(storage = defaultStorage()) {
  try { return storage?.getItem(STORAGE_KEY) ?? null; } catch { return null; }
}

/**
 * @param {Record<string, Record<string, string>>} translations {es: {...}, en: {...}}
 * @param {string} lang
 * @param {{storage?: Storage | null}} [opts] storage null = no persistir
 */
export function createI18n(translations, lang, opts = {}) {
  const storage = 'storage' in opts ? opts.storage : defaultStorage();
  const dicts = translations ?? {};
  let cur = norm(lang);
  const has = (l, k) => !!dicts[l] && hasOwn(dicts[l], k) && typeof dicts[l][k] === 'string';

  /**
   * Texto de `key` en el idioma actual. Si falta: `fallback`; sin fallback, el español; si no, la propia clave
   * (nav.js y focus.ut detectan así la ausencia). `params` sustituye {nombre} como texto plano: el escape lo
   * hace siempre html`` al interpolar el resultado.
   * @param {string} key @param {string} [fallback] @param {Record<string, unknown>} [params]
   */
  function t(key, fallback, params) {
    let s;
    if (has(cur, key)) s = dicts[cur][key];
    else if (fallback !== undefined) s = fallback;
    else if (has('es', key)) s = dicts.es[key];
    else s = key;
    if (params && typeof params === 'object') {
      s = s.replace(/\{(\w+)\}/g, (m, name) => (hasOwn(params, name) ? String(params[name] ?? '') : m));
    }
    return s;
  }

  const originals = new WeakMap(); // texto original del HTML, por si una clave faltara

  function apply(root = typeof document !== 'undefined' ? document : null) {
    if (!root?.querySelectorAll) return;
    const doc = root.ownerDocument ?? root;
    if (doc.documentElement) doc.documentElement.lang = cur;
    root.querySelectorAll('[data-translate]').forEach((el) => {
      if (!originals.has(el)) originals.set(el, el.textContent);
      el.textContent = t(el.dataset.translate, originals.get(el));
    });
    for (const [attr, target] of [['translateAriaLabel', 'aria-label'], ['translatePlaceholder', 'placeholder']]) {
      const sel = attr === 'translateAriaLabel' ? '[data-translate-aria-label]' : '[data-translate-placeholder]';
      root.querySelectorAll(sel).forEach((el) => {
        const key = el.dataset[attr];
        const fb = el.getAttribute(`data-i18n-orig-${target}`) ?? el.getAttribute(target) ?? undefined;
        if (fb !== undefined && !el.hasAttribute(`data-i18n-orig-${target}`)) el.setAttribute(`data-i18n-orig-${target}`, fb);
        el.setAttribute(target, t(key, fb));
      });
    }
    root.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === cur)));
  }

  return {
    t,
    get lang() { return cur; },
    setLang(l) {
      cur = norm(l);
      try { storage?.setItem(STORAGE_KEY, cur); } catch { /* bloqueado: solo en memoria */ }
      return cur;
    },
    apply,
  };
}
