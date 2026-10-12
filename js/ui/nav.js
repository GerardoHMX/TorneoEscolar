// Navegación del sitio (spec §4):
//  - PC (≥1024px): enlaces en línea en #desktopNav (primarias; desde 1400px dos más) + desplegable «Más».
//  - Móvil: #bottomNav con hasta 4 primarias + «Más», que abre #moreSheet (hoja deslizable, foco atrapado).
//  - Sección activa resaltada con IntersectionObserver → aria-current="page" en todos los enlaces a ella.
//  - Al elegir un enlace: cierra hoja/desplegable, desplaza (suave salvo movimiento reducido) y enfoca la sección.
// El desfase de la cabecera fija lo resuelve `scroll-padding-top` de <html> (css/base.css), que respetan
// scrollIntoView y los saltos por ancla; las secciones no necesitan scroll-margin-top propio.
// renderNav es idempotente: se puede volver a llamar al cambiar visibilidad o idioma.

import { SECTIONS } from '../core/visibility.js';
import { html, setHTML } from '../core/dom.js';
import { inertOutside, lockScroll, prefersReducedMotion, trapTab, ut } from './focus.js';

const PRIMARY_IDS = SECTIONS.filter((s) => s.mobilePrimary).map((s) => s.id);
const WIDE_EXTRA = 2; // enlaces en línea adicionales a partir de 1400px

/**
 * Reparte los elementos del menú entre la barra (primarias) y «Más».
 * Primarias = las `mobilePrimary` visibles; si faltan (p. ej. sin próximos partidos) se rellenan con
 * las siguientes visibles hasta `n`. Ambas listas conservan el orden de página.
 * @param {{id:string, labelKey:string}[]} items @param {number} [n]
 * @returns {{primary: {id:string,labelKey:string}[], rest: {id:string,labelKey:string}[]}}
 */
export function splitNavItems(items, n = 4) {
  const list = Array.isArray(items) ? items.filter((x) => x && x.id) : [];
  const chosen = new Set(list.filter((x) => PRIMARY_IDS.includes(x.id)).slice(0, n).map((x) => x.id));
  for (const x of list) {
    if (chosen.size >= n) break;
    chosen.add(x.id);
  }
  return {
    primary: list.filter((x) => chosen.has(x.id)),
    rest: list.filter((x) => !chosen.has(x.id)),
  };
}

/**
 * Sección activa: la última (en orden de página) que está dentro de la franja de lectura, es decir,
 * la que acaba de entrar bajo la cabecera aunque la anterior aún asome unos píxeles;
 * si ninguna lo está, se mantiene la anterior.
 * @param {string[]} order @param {Set<string>} inView @param {string|null} prev
 */
export function pickActiveSection(order, inView, prev) {
  for (let i = order.length - 1; i >= 0; i -= 1) if (inView.has(order[i])) return order[i];
  return prev ?? null;
}

// ---- Iconos (24×24, trazo) ----
const P = {
  inicio: 'M3 10.5L12 3l9 7.5M5.5 9v11h13V9M10 20v-6h4v6',
  accordionSection: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  podioSection: 'M3 21V14h6v7M9 21V9h6v12M15 21v-5h6v5M3 21h18',
  proximosPartidos: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5M12 13v3l2 1.5',
  equipos: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  jornadas: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5M8 14h2M14 14h2M8 17.5h2',
  clasificacion: 'M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10',
  clasificacionGrupal: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  bracket: 'M3 5h5v5H3M3 14h5v5H3M8 7.5h3v9H8M11 12h4M15 9.5h6v5h-6z',
  goleadoresSection: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4zM12 3v4.5M20.6 9.3l-4.8 1M17.6 19l-3.3-4.3M6.4 19l3.3-4.3M3.4 9.3l4.8 1',
  sancionadosSection: 'M8 3h8.5a1.5 1.5 0 011.5 1.5v15a1.5 1.5 0 01-1.5 1.5H8a1.5 1.5 0 01-1.5-1.5v-15A1.5 1.5 0 018 3z',
  resultadosSection: 'M3 6h18v12H3zM12 6v12M7 10.5v3M16 10.5h1.5v3H16z',
  noticiasSection: 'M5 4h12v16H6a1 1 0 01-1-1zM17 8h2v11a1 1 0 01-2 0M8 8h6M8 12h6M8 16h4',
  galeriaSection: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};
const icon = (id) => html`<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[id] ?? P.more}"></path></svg>`;
const CHEVRON = html`<svg class="nav-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>`;
const CLOSE = html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;

/** Etiqueta corta para la barra inferior: `<labelKey>.short` si existe, si no la normal. */
function shortLabel(t, key) {
  const s = t(`${key}.short`);
  return s && s !== `${key}.short` ? s : t(key);
}

const pageIndex = (id) => SECTIONS.findIndex((s) => s.id === id);
const byPage = (a, b) => pageIndex(a.id) - pageIndex(b.id);

/** En PC entre 1024 y 1279px el texto corto (si existe) cabe junto a logos e idioma; desde 1280px, el completo. */
function deskLabel(t, key) {
  const full = t(key);
  const short = shortLabel(t, key);
  if (short === full) return full;
  return html`<span class="nav-link__short" aria-hidden="true">${short}</span><span class="nav-link__full">${full}</span>`;
}

let teardown = null;

/**
 * @param {{id: string, labelKey: string}[]} items de menuItems(vis)
 * @param {(k: string) => string} t
 */
export function renderNav(items, t) {
  teardown?.();
  const desk = document.getElementById('desktopNav');
  const bottom = document.getElementById('bottomNav');
  const sheet = document.getElementById('moreSheet');
  // Los oyentes se quitan en el teardown de dos formas: AbortSignal y, además, removeEventListener explícito
  // (Chrome < 90 / Safari < 15 ignoran `signal` y se acumularían en cada renderNav).
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const offs = [];
  const on = (target, type, fn) => {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, fn, ac ? { signal: ac.signal } : undefined);
    offs.push(() => target.removeEventListener(type, fn));
  };
  const { primary, rest } = splitNavItems(items);
  const all = [...primary, ...rest];
  const restIds = new Set(rest.map((x) => x.id));
  const label = (it) => t(it.labelKey);
  const moreLabel = ut('nav_more', 'Más');
  const sheetTitle = ut('nav_more_title', 'Más secciones');

  // ---- PC ----
  if (desk) {
    const wide = rest.slice(0, WIDE_EXTRA);
    const onlyNarrow = rest.length <= WIDE_EXTRA; // a ≥1280px «Más» quedaría vacío
    const wideIds = new Set(wide.map((x) => x.id));
    const inline = all.filter((x) => !restIds.has(x.id) || wideIds.has(x.id)).sort(byPage);
    setHTML(desk, html`<ul class="dnav" role="list">
  ${inline.map((it) => html`<li${wideIds.has(it.id) ? html` class="dnav__wide"` : ''}><a class="nav-link" href="#${it.id}" data-nav="${it.id}">${deskLabel(t, it.labelKey)}</a></li>`)}
  ${rest.length ? html`<li class="dnav__more${onlyNarrow ? ' dnav__more--narrow' : ''}">
    <button type="button" class="nav-link nav-link--more" aria-expanded="false" aria-controls="dnavPanel" data-more>${moreLabel}${CHEVRON}</button>
    <div class="dnav__panel is-closed" id="dnavPanel">
      <ul role="list">${rest.map((it, i) => html`<li${i < WIDE_EXTRA ? html` class="dnav__narrow"` : ''}><a class="dnav__item" href="#${it.id}" data-nav="${it.id}">${icon(it.id)}<span>${label(it)}</span></a></li>`)}</ul>
    </div>
  </li>` : ''}
</ul>`);
  }

  // ---- Móvil: barra inferior + hoja ----
  if (bottom) {
    setHTML(bottom, html`<ul class="bnav" role="list">
  ${primary.map((it) => html`<li><a class="bnav__item" href="#${it.id}" data-nav="${it.id}">${icon(it.id)}<span class="bnav__label">${shortLabel(t, it.labelKey)}</span></a></li>`)}
  ${rest.length ? html`<li><button type="button" class="bnav__item" aria-expanded="false" aria-controls="moreSheet" aria-haspopup="dialog" data-sheet-open>${icon('more')}<span class="bnav__label">${moreLabel}</span></button></li>` : ''}
</ul>`);
  }
  if (sheet) {
    sheet.setAttribute('aria-labelledby', 'moreSheetTitle');
    sheet.removeAttribute('aria-label');
    setHTML(sheet, html`<div class="sheet__grip" aria-hidden="true"></div>
<div class="sheet__head">
  <h2 class="sheet__title" id="moreSheetTitle">${sheetTitle}</h2>
  <button type="button" class="sheet__close" data-sheet-close aria-label="${ut('modal_close', 'Cerrar')}">${CLOSE}</button>
</div>
<ul class="sheet__grid" role="list">
  ${rest.map((it) => html`<li><a class="sheet__item" href="#${it.id}" data-nav="${it.id}">${icon(it.id)}<span>${label(it)}</span></a></li>`)}
</ul>`);
  }

  // ---- Hoja «Más» (móvil) ----
  let scrim = document.querySelector('.sheet-scrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.className = 'sheet-scrim rm-fade';
    scrim.setAttribute('aria-hidden', 'true');
    document.body.append(scrim);
  }
  let sheetState = null; // {restoreInert, unlock, opener}
  const openSheet = (opener) => {
    if (!sheet || sheetState) return;
    sheet.classList.remove('is-closed');
    sheet.inert = false;
    scrim.classList.add('is-open');
    opener?.setAttribute('aria-expanded', 'true');
    sheetState = { restoreInert: inertOutside(sheet, scrim), unlock: lockScroll(), opener };
    (sheet.querySelector('.sheet__item') ?? sheet.querySelector('[data-sheet-close]'))?.focus({ preventScroll: true });
  };
  const closeSheet = (restoreFocus = true) => {
    if (!sheetState) return;
    const { restoreInert, unlock, opener } = sheetState;
    sheetState = null;
    sheet.classList.add('is-closed');
    sheet.inert = true;
    scrim.classList.remove('is-open');
    restoreInert();
    unlock();
    opener?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) opener?.focus({ preventScroll: true });
  };

  // ---- Desplegable «Más» (PC): patrón disclosure ----
  const panel = desk?.querySelector('.dnav__panel');
  const moreBtn = desk?.querySelector('[data-more]');
  const setPanel = (open, focusBtn = false) => {
    if (!panel) return;
    panel.classList.toggle('is-closed', !open);
    moreBtn.setAttribute('aria-expanded', String(open));
    if (!open && focusBtn) moreBtn.focus();
  };

  // ---- Ir a una sección ----
  const go = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    // Durante el desplazamiento suave el observer vería pasar las secciones intermedias: se congela
    // el resaltado hasta que termina (scrollend, o 1 s si el navegador no lo emite).
    holdSpy();
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    setActive(id);
  };

  const onNavClick = (ev) => {
    const a = ev.target.closest('a[data-nav]');
    if (a) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0) return;
      ev.preventDefault();
      closeSheet(false);
      setPanel(false);
      go(a.dataset.nav);
      return;
    }
    if (ev.target.closest('[data-sheet-open]')) openSheet(ev.target.closest('[data-sheet-open]'));
    else if (ev.target.closest('[data-sheet-close]')) closeSheet();
    else if (ev.target.closest('[data-more]')) setPanel(moreBtn.getAttribute('aria-expanded') !== 'true');
  };
  [desk, bottom, sheet].forEach((el) => on(el, 'click', onNavClick));
  on(scrim, 'click', () => closeSheet());

  on(document, 'keydown', (ev) => {
    // Con un modal abierto (p. ej. el de valoración sobre la hoja), el teclado es suyo: la hoja está inerte
    // y atrapar Tab aquí bloquearía la navegación dentro del diálogo.
    if (document.querySelector('#modal-root [role="dialog"]')) return;
    if (sheetState) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(); } else trapTab(sheet, ev);
    } else if (ev.key === 'Escape' && panel && !panel.classList.contains('is-closed')) {
      setPanel(false, true);
    }
  });
  on(document, 'click', (ev) => {
    if (panel && !ev.target.closest('.dnav__more')) setPanel(false);
  });
  on(desk, 'focusout', (ev) => {
    if (panel && ev.relatedTarget && !ev.relatedTarget.closest('.dnav__more')) setPanel(false);
  });
  // Al pasar a PC con la hoja abierta (rotar la tableta), se cierra para no dejar la página inerte.
  const mq = typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)') : null;
  on(mq, 'change', (e) => { if (e.matches) closeSheet(false); else setPanel(false); });

  // ---- Sección activa ----
  const links = [desk, bottom, sheet].flatMap((el) => (el ? [...el.querySelectorAll('a[data-nav]')] : []));
  let active = null;
  function setActive(id) {
    if (id === active) return;
    active = id;
    links.forEach((a) => {
      if (a.dataset.nav === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const inMore = restIds.has(id);
    bottom?.querySelector('[data-sheet-open]')?.classList.toggle('is-active', inMore);
    moreBtn?.classList.toggle('is-active', inMore);
  }

  const order = [...all].sort(byPage).map((x) => x.id);
  let io = null;
  const inView = new Set();
  let held = false;
  let holdTimer = 0;
  const release = () => {
    if (!held) return;
    held = false;
    clearTimeout(holdTimer);
    if (io) setActive(pickActiveSection(order, inView, active));
  };
  function holdSpy() {
    held = true;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(release, 1000);
  }
  on(window, 'scrollend', () => setTimeout(release, 50));
  if (typeof IntersectionObserver === 'function') {
    const header = document.getElementById('site-header');
    const top = Math.round(header?.getBoundingClientRect().height || 64) + 8;
    // Franja de lectura: desde bajo la cabecera hasta el 40 % superior de la ventana.
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? inView.add(e.target.id) : inView.delete(e.target.id)));
      if (!held) setActive(pickActiveSection(order, inView, active));
    }, { rootMargin: `-${top}px 0px -60% 0px`, threshold: 0 });
    order.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
  const initial = location.hash.slice(1);
  setActive(order.includes(initial) ? initial : order[0] ?? null);

  teardown = () => {
    ac?.abort();
    offs.splice(0).forEach((off) => off());
    clearTimeout(holdTimer);
    io?.disconnect();
    closeSheet(false);
    teardown = null;
  };
}
