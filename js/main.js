// Orquestador del sitio (spec §4-§6, contratos R12/R14).
// Arranque: loader -> loadAll -> buildModel -> visibilidad -> una <section id class="section reveal"> por
// sección visible (orden de SECTIONS) -> nav, pie y CONFIGURACION -> loader.done() -> refresco periódico.
// Cada sección guarda su estado; setState re-renderiza TODO su contenido y vuelve a llamar a bind.
// Resiliencia: si no llegan datos se muestra Inicio + aviso; una sección que falla se registra y se omite.
import { html, safeUrl, setHTML } from './core/dom.js';
import { createI18n, pickLang, storedLang } from './core/i18n.js';
import { failureMemo, navigationType, safeDecodeHash, shouldBypassCache } from './core/boot.js';
import { SECTIONS, diffSections, menuItems, noticeKind, sectionVisibility } from './core/visibility.js';
import { translations } from './translations.js';
import { loadAllWithStatus, loadOutcome, onUpdate } from './data/sheets.js';
import { buildModel, mergeRaw } from './data/buildModel.js';
import { initLoader } from './ui/loader.js';
import { initScrollProgress } from './ui/progress.js';
import { observeReveal } from './ui/reveal.js';
import { renderNav } from './ui/nav.js';
import { renderFooter } from './ui/footer.js';
import { initFeedback, isFeedbackEnabled } from './ui/feedback.js';
import { createRefreshControl } from './ui/refresh.js';
import { bindShare, buildSharePayload } from './ui/share.js';
import { initAnalytics, shouldLoadAnalytics } from './ui/analytics.js';
import { focusables, setUiTranslator, stableSelector } from './ui/focus.js';
import { emptyState } from './sections/common.js';
import * as hero from './sections/hero.js';
import { banner, bases } from './sections/bases.js';
import * as podio from './sections/podio.js';
import * as proximos from './sections/proximos.js';
import * as equipos from './sections/equipos.js';
import * as jornadas from './sections/jornadas.js';
import * as clasificacion from './sections/clasificacion.js';
import * as clasificacionGrupal from './sections/clasificacionGrupal.js';
import * as bracket from './sections/bracket.js';
import * as goleadores from './sections/goleadores.js';
import * as sancionados from './sections/sancionados.js';
import * as resultados from './sections/resultados.js';
import * as noticias from './sections/noticias.js';
import * as galeria from './sections/galeria.js';

const MODULES = new Map([
  hero, banner, bases, podio, proximos, equipos, jornadas, clasificacion, clasificacionGrupal, bracket,
  goleadores, sancionados, resultados, noticias, galeria,
].map((m) => [m.id, m]));

const nav = typeof navigator !== 'undefined' ? navigator.language : '';
const i18n = createI18n(translations, pickLang(storedLang(), nav));
const { t } = i18n;
setUiTranslator(t);

const app = document.getElementById('app');
const footer = document.getElementById('site-footer');

/** @type {Map<string, {el: HTMLElement, wrap: HTMLElement, state: object, html: string}>} */
const mounted = new Map();
let raw = null;
let model = buildModel({});
let notice = null;
let navKey = null;
/** 'failed' (alguna hoja no cargó) o 'empty' (todo cargó pero no hay nada publicado): elige el aviso. */
let outcome = 'failed';
/** Versión de los datos (sube cuando cambian): una sección que lanzó no se reintenta hasta otra versión o idioma. */
let dataVersion = 0;
let rawSig = '';
const failures = failureMemo();
const failKey = () => `${dataVersion}|${i18n.lang}`;
/** Botón «Actualizar datos» del pie (spec §6); se crea una vez y se recoloca tras repintar el pie. */
let refreshCtl = null;

// ------------------------------------------------------------------ secciones

function ctxFor(id, entry) {
  return { model, state: entry.state, setState: (patch) => setState(id, patch), t };
}

/** Pinta `out` (o el render actual) en la sección y la cablea. false si falla (la sección se retira). */
function paint(id, entry, out) {
  const mod = MODULES.get(id);
  try {
    const content = out ?? mod.render(model, entry.state, t);
    setHTML(entry.el, content);
    entry.html = content.toString();
    mod.bind(entry.el, ctxFor(id, entry));
    return true;
  } catch (err) {
    console.error(`[main] la sección «${id}» falló y se omite:`, err);
    failures.mark(id, failKey());
    unmount(id);
    return false;
  }
}

function setState(id, patch) {
  const entry = mounted.get(id);
  if (!entry) return;
  entry.state = { ...entry.state, ...(patch && typeof patch === 'object' ? patch : {}) };
  // Siempre se re-renderiza (aunque el parche no cambie nada): bind devuelve el foco pendiente.
  if (paint(id, entry)) observeReveal(entry.el);
  else refreshChrome();
}

function mount(id) {
  const mod = MODULES.get(id);
  const el = document.createElement('section');
  el.id = id;
  el.className = 'section reveal';
  // El hero va a sangre (css/home.css: #inicio.section); el resto, dentro de una banda a todo el ancho.
  let wrap = el;
  if (id !== 'inicio') {
    wrap = document.createElement('div');
    wrap.className = 'band';
    wrap.append(el);
  }
  const entry = { el, wrap, state: {}, html: '' };
  try {
    entry.state = mod.initialState(model) ?? {};
  } catch (err) {
    console.error(`[main] initialState de «${id}» falló:`, err);
  }
  app.insertBefore(wrap, nextAnchor(id));
  mounted.set(id, entry);
  paint(id, entry);
}

function unmount(id) {
  const entry = mounted.get(id);
  if (!entry) return;
  entry.wrap.remove();
  mounted.delete(id);
}

/** Nodo ante el que insertar `id`: la siguiente sección montada en orden de página, o el aviso. */
function nextAnchor(id) {
  const i = SECTIONS.findIndex((s) => s.id === id);
  for (const s of SECTIONS.slice(i + 1)) if (mounted.has(s.id)) return mounted.get(s.id).wrap;
  return notice && notice.isConnected ? notice : null;
}

/**
 * Lleva el DOM al modelo actual: crea las secciones que aparecen (entran con .reveal), retira las que ya no
 * tienen datos y re-renderiza, conservando su estado, las que siguen y cuyo HTML cambió. `force` re-renderiza
 * todas (cambio de idioma).
 */
function sync({ force = false } = {}) {
  let vis;
  try {
    vis = sectionVisibility(model);
  } catch (err) {
    console.error('[main] sectionVisibility falló:', err);
    vis = { inicio: true };
  }
  const key = failKey();
  const want = Object.fromEntries(SECTIONS.map(({ id }) => [id, !!vis[id] && MODULES.has(id) && !failures.blocked(id, key)]));
  const have = Object.fromEntries([...mounted.keys()].map((id) => [id, true]));
  const { added, removed, kept } = diffSections(have, want);
  removed.forEach(unmount);
  for (const id of kept) {
    const entry = mounted.get(id);
    if (!entry) continue;
    if (force) { paint(id, entry); continue; }
    let out;
    try {
      out = MODULES.get(id).render(model, entry.state, t);
    } catch (err) {
      console.error(`[main] la sección «${id}» falló y se omite:`, err);
      failures.mark(id, key);
      unmount(id);
      continue;
    }
    if (out.toString() === entry.html) continue;
    const focus = captureFocus(entry.el);
    if (paint(id, entry, out)) restoreCapturedFocus(entry.el, focus);
  }
  added.forEach(mount);
  refreshChrome({ force });
}

/**
 * Un refresco de datos re-renderiza la sección entera: si el foco estaba dentro, se recuerda el control
 * (selector estable o, si no lo tiene, su posición entre los enfocables) para devolvérselo tras el repintado.
 */
function captureFocus(el) {
  const a = document.activeElement;
  if (!a || a === el || !el.contains(a)) return null;
  return { sel: stableSelector(a), index: focusables(el).indexOf(a) };
}

function restoreCapturedFocus(el, cap) {
  if (!cap) return;
  let target = null;
  try { target = cap.sel ? el.querySelector(cap.sel) : null; } catch { target = null; }
  if (!target || target.disabled) target = cap.index >= 0 ? focusables(el)[cap.index] ?? null : null;
  if (!target) {
    // Sin equivalente (p. ej. el control desapareció): el foco queda en la sección, no en <body>.
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    target = el;
  }
  target.focus({ preventScroll: true });
}

/** Aviso sin datos, bandas alternas, menú y revelado tras cualquier cambio del conjunto montado. */
function refreshChrome({ force = false } = {}) {
  updateNotice(force);
  let n = 0;
  for (const { id } of SECTIONS) {
    const entry = mounted.get(id);
    if (!entry || id === 'inicio') continue;
    entry.wrap.classList.toggle('band--ivory', n % 2 === 0);
    n += 1;
  }
  const visible = Object.fromEntries([...mounted.keys()].map((id) => [id, true]));
  const key = `${i18n.lang}|${SECTIONS.filter((s) => visible[s.id]).map((s) => s.id).join(',')}`;
  if (force || key !== navKey) {
    navKey = key;
    try {
      renderNav(menuItems(visible), t);
    } catch (err) {
      console.error('[main] renderNav falló:', err);
    }
  }
  observeReveal(document.body); // incluye el pie (fuera de #app), que se revela en diagonal
}

/**
 * Si no hay ninguna sección con datos: Inicio + aviso amable. Fallo de carga -> «no hemos podido cargar»
 * con Reintentar; carga correcta pero libro aún vacío (inicio de temporada) -> «aún no hay datos publicados».
 */
function updateNotice(force) {
  const kind = noticeKind(mounted.keys(), outcome);
  if (!kind) {
    notice?.remove();
    notice = null;
    return;
  }
  if (notice && !force && notice.dataset.kind === kind) return;
  notice?.remove();
  notice = document.createElement('section');
  notice.id = 'appNotice';
  notice.className = 'section app-notice reveal';
  notice.dataset.kind = kind;
  notice.setAttribute('role', 'status');
  if (kind === 'empty') {
    setHTML(notice, emptyState(t, ['app_no_data_yet', 'El torneo aún no tiene datos publicados'], ['app_no_data_yet_description', 'En cuanto el comité publique equipos y partidos aparecerán aquí. ¡Vuelve pronto!']));
  } else {
    setHTML(notice, html`${emptyState(t, ['app_no_data', 'No hemos podido cargar los datos del torneo'], ['app_no_data_description', 'Puede ser un problema de conexión. Vuelve a intentarlo en unos minutos.'])}
    <p class="app-notice__actions"><button type="button" class="btn-gold" data-retry>${t('app_retry', 'Reintentar')}</button></p>`);
    notice.querySelector('[data-retry]')?.addEventListener('click', () => location.reload());
  }
  app.append(notice);
}

// ------------------------------------------------------------------ CONFIGURACION

const q = (sel) => document.querySelector(sel);
const qa = (sel) => document.querySelectorAll(sel);
const setAttr = (el, name, value) => { if (el && el.getAttribute(name) !== value) el.setAttribute(name, value); };

function applyConfig(config) {
  const v = (k) => String(config?.[k] ?? '').trim();
  const nombre = v('TORNEO_NOMBRE') || 'Al-Ándalus';
  document.title = `Torneo Escolar - ${nombre}`;
  qa('[data-config="torneo-nombre"]').forEach((el) => { el.textContent = nombre; });
  if (v('TORNEO_ANIO')) qa('[data-config="torneo-anio"]').forEach((el) => { el.textContent = v('TORNEO_ANIO'); });
  if (v('TORNEO_DESCRIPCION')) setAttr(q('meta[name="description"]'), 'content', v('TORNEO_DESCRIPCION'));

  // Logo del colegio en la cabecera: archivo local (img/logo-colegio.svg), siempre visible; la hoja solo
  // aporta el enlace (COLEGIO_URL, solo https) y el nombre accesible (COLEGIO_NOMBRE).
  const web = safeUrl(v('COLEGIO_URL'));
  const link = q('[data-config="colegio-link"]');
  const img = q('[data-config="colegio-logo"]');
  if (img && v('COLEGIO_NOMBRE')) setAttr(img, 'alt', v('COLEGIO_NOMBRE'));
  if (link) {
    if (web) setAttr(link, 'href', web); else link.removeAttribute('href');
  }

  // Favicons del sitio del colegio (como el sitio anterior); sin COLEGIO_URL, el logo local.
  const base = web.replace(/\/+$/, '');
  [['colegio-favicon-32', '32x32'], ['colegio-favicon-192', '192x192'], ['colegio-favicon-apple', '180x180']].forEach(([key, size]) => {
    setAttr(q(`[data-config="${key}"]`), 'href', base ? `${base}/wp-content/uploads/2023/03/cropped-favicon-${size}.png` : 'img/logo-192.png');
  });

  const insta = safeUrl(v('REDES_INSTAGRAM_URL'));
  qa('[data-config="instagram-link"]').forEach((a) => {
    if (insta) setAttr(a, 'href', insta);
    a.hidden = !insta;
  });

  if (shouldLoadAnalytics(location.hostname)) initAnalytics(v('GA_TRACKING_ID'));
  // FEEDBACK_ACTIVO = NO pausa la valoración (vacío o sin la fila = activa, como siempre).
  initFeedback(v('FEEDBACK_SCRIPT_URL'), t, { enabled: isFeedbackEnabled(v('FEEDBACK_ACTIVO')) });
}

/** «Compartir este sitio»: siempre la URL canónica; título de la pestaña (lleva TORNEO_NOMBRE). */
function sharePayload() {
  return buildSharePayload({
    canonical: q('link[rel="canonical"]')?.getAttribute('href'),
    title: document.title,
    text: t('share_text', 'Sigue el torneo escolar de fútbol sala: partidos, resultados y clasificación.'),
    locationLike: location,
  });
}

function paintFooter() {
  if (!footer) return;
  // Repintar el pie saca el botón del DOM: si tenía el foco, se le devuelve.
  const hadFocus = !!refreshCtl && refreshCtl.el.contains(document.activeElement);
  try {
    setHTML(footer, renderFooter(model.config, t));
    bindShare(footer, { t, getPayload: sharePayload });
  } catch (err) {
    console.error('[main] el pie falló:', err);
  }
  if (!refreshCtl) return;
  refreshCtl.relabel();
  (footer.querySelector('.footer__brand') ?? footer).append(refreshCtl.el);
  if (hadFocus) refreshCtl.button.focus({ preventScroll: true });
}

/**
 * «Actualizar datos»: carga sin caché y sigue el mismo camino que el refresco periódico (mergeRaw + rebuild).
 * Devuelve las hojas que fallaron (el botón elige el mensaje).
 */
async function refreshNow() {
  const res = await loadAllWithStatus({ ttlMs: 0 });
  outcome = loadOutcome(res.failed);
  try { rebuild(res.raw); } catch (err) { console.error('[main] refresco fallido:', err); return ['rebuild']; }
  if (notice && notice.dataset.kind !== outcome) updateNotice(false);
  return res.failed;
}

// ------------------------------------------------------------------ idioma

function bindLanguage() {
  qa('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.lang === i18n.lang) return;
      i18n.setLang(btn.dataset.lang);
      i18n.apply(document);
      sync({ force: true });
      paintFooter();
    });
  });
}

// ------------------------------------------------------------------ arranque y refresco

function rebuild(nextRaw) {
  raw = mergeRaw(raw, nextRaw);
  const sig = JSON.stringify(raw);
  if (sig !== rawSig) { rawSig = sig; dataVersion += 1; }
  model = buildModel(raw);
  const prevFooter = footer?.dataset.config;
  const cfgSig = JSON.stringify(model.config);
  try { applyConfig(model.config); } catch (err) { console.error('[main] CONFIGURACION:', err); }
  sync();
  if (prevFooter !== cfgSig) {
    paintFooter();
    if (footer) footer.dataset.config = cfgSig;
  }
}

/** Con un #ancla en la URL, las secciones aún no existían al cargar: se salta a ella al terminar el loader. */
function jumpToHash() {
  const id = safeDecodeHash(location.hash); // «#%E0» no debe tumbar el arranque
  if (!id || !mounted.has(id)) return;
  mounted.get(id).el.scrollIntoView({ block: 'start' });
}

async function boot() {
  // Salvaguarda: si algo impide llegar a loader.done(), el hero no se queda a medio revelar.
  setTimeout(() => document.documentElement.classList.add('app-ready'), 7000);
  initScrollProgress();
  i18n.apply(document);
  bindLanguage();
  // Un loader que falla nunca debe impedir la carga de datos.
  let loader;
  try {
    loader = initLoader();
  } catch (err) {
    console.error('[main] el loader falló:', err);
  }
  if (!loader || typeof loader.done !== 'function') loader = { done: () => Promise.resolve() };
  try {
    refreshCtl = createRefreshControl({ t, onRefresh: refreshNow });
  } catch (err) {
    console.error('[main] el botón de actualizar falló:', err);
  }
  let first = null;
  try {
    // F5 / recargar: sin caché, para que quien acaba de editar la hoja vea el cambio al momento.
    const res = await loadAllWithStatus(shouldBypassCache(navigationType()) ? { ttlMs: 0 } : {});
    first = res.raw;
    outcome = loadOutcome(res.failed);
  } catch (err) {
    console.error('[main] no se pudieron cargar los datos:', err);
  }
  app.replaceChildren(); // fuera el esqueleto provisional
  rebuild(first ?? {});
  app.setAttribute('aria-busy', 'false');
  await loader.done();
  document.documentElement.classList.add('app-ready'); // el hero se revela en diagonal cuando el loader ya salió
  jumpToHash();
  // `initial`: un cambio durante el primer intervalo también se notifica (Task 5).
  onUpdate((next) => {
    try { rebuild(next); } catch (err) { console.error('[main] refresco fallido:', err); }
  }, {
    initial: first ?? {},
    // El estado de cada refresco decide el aviso sin datos (un fallo transitorio que se recupera, o al revés).
    loader: () => loadAllWithStatus({ ttlMs: 0 }).then((res) => {
      outcome = loadOutcome(res.failed);
      // Sin cambio de datos no hay rebuild: el aviso se actualiza aquí si solo cambió el resultado.
      if (notice && notice.dataset.kind !== outcome) updateNotice(false);
      return res.raw;
    }),
  });
}

boot().catch((err) => {
  // Último recurso: nunca una página en blanco.
  console.error('[main] arranque fallido:', err);
  try {
    app.replaceChildren();
    app.setAttribute('aria-busy', 'false');
    model = buildModel({});
    mounted.clear();
    sync(); // el loader sale solo a los maxMs aunque nadie llame a done()
  } catch (e) {
    console.error('[main] ni siquiera el modo sin datos pudo mostrarse:', e);
  }
});
