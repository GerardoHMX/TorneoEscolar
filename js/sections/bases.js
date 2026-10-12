// Banner (carrusel de tarjetas, #carouselSection) y Bases del Torneo (acordeón, #accordionSection).
// Portado de js/carousel.js, js/carousel-init.js y js/accordion-init.js: el texto de las bases era fijo
// en el código (no viene de ninguna hoja); aquí vive como DATOS (no HTML) y se pinta con `html`.
// Visibilidad: interruptor manual de OTROS (SECCION carouselSection / accordionSection, VISIBLE SI/NO),
// como en visibility.js; sin fila, ocultas.
// Carrusel: deslizamiento táctil nativo (scroll-snap), botones, indicadores y teclado (←/→/Inicio/Fin);
// SIN reproducción automática (el sitio antiguo avanzaba solo cada 4 s).
import { html } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { sectionVisibility } from '../core/visibility.js';
import { createAccordion, accordionItem } from '../ui/accordion.js';
import { sectionTitle } from './common.js';
import { bindMediaFallback } from '../ui/media.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

// Imágenes por defecto del sitio antiguo (logo del torneo y cartel); CONFIGURACION puede sustituirlas.
const LOGO_DEFAULT = 'https://drive.google.com/file/d/1NefYP3OCHQ7kie9qQgmy1yUOEnZXvvCA/view?usp=sharing';
const CARTEL_DEFAULT = 'https://drive.google.com/file/d/1wUqSjzfL4POj_t5pC0_RDkLlsgbyDqXT/view?usp=sharing';

/**
 * Texto con énfasis: los tramos entre *asteriscos* van en <strong>; todo se escapa.
 * @returns {import('../core/dom.js').SafeHtml}
 */
export function rich(s) {
  return html`${String(s ?? '').split('*').map((part, i) => (i % 2 ? html`<strong>${part}</strong>` : part))}`;
}

/**
 * Bases (ES; el sitio antiguo tampoco las traducía). Bloques: p (párrafo), list (viñetas),
 * h (subtítulo), facts ([etiqueta, valor]), prizes ([icono, texto]).
 */
export const BASES = [
  { key: 'descripcion', title: 'Descripción del torneo', icon: '🏫', blocks: [
    { p: 'Torneo organizado por el Departamento de Educación Física del *Colegio San Francisco de Asís*, dirigido a estudiantes de ESO y Bachillerato.' },
    { p: 'Más que una competición, el torneo fomenta la *inclusión, el respeto y la práctica deportiva saludable* en un ambiente escolar lleno de compañerismo y alegría.' },
  ] },
  { key: 'participantes', title: 'Participantes', icon: '👟', blocks: [
    { p: 'Abierto a todo el alumnado de *ESO y Bachillerato*. Equipos mixtos sin distinción de género.' },
    { h: 'Equipos' },
    { list: ['Hasta *seis jugadores* por equipo.', 'Hasta *dos capitanes* por equipo.'] },
    { h: 'Inscripción' },
    { p: 'Entregar la hoja de inscripción al profesorado de Educación Física. La fecha límite de inscripción es el *11 de noviembre de 2025*.' },
  ] },
  { key: 'calendario', title: 'Calendario', icon: '📅', blocks: [
    { facts: [['Inicio', '25 de noviembre de 2025'], ['Final', '19 de febrero de 2026'], ['Entrega de trofeos', '20 de febrero (Día de Andalucía)']] },
    { p: 'Partidos en los *recreos* (noviembre–febrero).' },
    { p: 'En caso de lluvia, las finales podrán posponerse a la primera semana posterior a Semana Blanca.', note: true },
  ] },
  { key: 'sistema', title: 'Sistema de competición', icon: '🏆', blocks: [
    { p: 'Fase de grupos *(A, B, C y D)* a partido único.' },
    { p: 'Pasan los dos primeros de cada grupo a *cuartos*; después *semifinales*, *3.º-4.º puesto* y *final*.' },
    { facts: [['Victoria', '3 puntos'], ['Empate', '1 punto'], ['Derrota', '0 puntos']] },
    { p: 'Partidos arbitrados por el profesorado.' },
  ] },
  { key: 'normas', title: 'Normas de juego', icon: '⚽', blocks: [
    { list: [
      'Dos tiempos de *12′* (descanso de 1′).',
      'Saques de banda y córner *con las manos*.',
      'Sin *cesión al portero* y sin *fuera de juego*.',
      'Faltas directas con *5 pasos*; a la 6.ª, *doble penalti*.',
      'Equipación: *camiseta blanca* y otra de *color*. Sin la equipación adecuada no se juega.',
    ] },
  ] },
  { key: 'fairplay', title: 'Fair Play y disciplina', icon: '🤝', blocks: [
    { p: 'Se valora el respeto al árbitro, al rival y a las normas; hay que evitar simulaciones y pérdidas de tiempo.' },
    { p: 'Las conductas antideportivas pueden suponer *0 puntos de Fair Play*, *partido perdido por 0-2* o la *exclusión*.' },
    { p: 'Acumular 2 amarillas o 1 roja supone *un partido* de sanción. Dos rojas suponen la *expulsión del torneo*.' },
    { p: 'Las sanciones disciplinarias del centro pueden inhabilitar para participar.' },
  ] },
  { key: 'premios', title: 'Premios y reconocimientos', icon: '🥇', blocks: [
    { prizes: [['🥇', 'Campeón'], ['🥈', 'Subcampeón'], ['🥉', 'Tercer puesto'], ['⚽', 'Máximo goleador'], ['🏅', 'Fair Play']] },
  ] },
];

function block(b) {
  if (b.h) return html`<h4 class="rules__h">${b.h}</h4>`;
  if (b.list) return html`<ul class="rules__list">${b.list.map((li) => html`<li>${rich(li)}</li>`)}</ul>`;
  if (b.facts) return html`<dl class="rules__facts">${b.facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
  if (b.prizes) return html`<ul class="rules__prizes">${b.prizes.map(([icon, label]) => html`<li><span aria-hidden="true">${icon}</span>${label}</li>`)}</ul>`;
  return html`<p class="${b.note ? 'rules__p rules__note' : 'rules__p'}">${rich(b.p)}</p>`;
}
const body = (item) => html`${item.blocks.map(block)}`;

/** Logo y cartel: CONFIGURACION (TORNEO_LOGO_URL, TORNEO_CARTEL_URL) o los del sitio antiguo; siempre por driveImg. */
export function images(config = {}) {
  const pick = (k, def) => driveImg(String(config?.[k] ?? '').trim() || def, 1000);
  return { logo: pick('TORNEO_LOGO_URL', LOGO_DEFAULT), cartel: pick('TORNEO_CARTEL_URL', CARTEL_DEFAULT) };
}

const nombreDe = (config) => String(config?.TORNEO_NOMBRE ?? '').trim() || 'Al-Ándalus';
const anioDe = (config) => String(config?.TORNEO_ANIO ?? '').trim();

// ======================================================================== Banner (carrusel)

const CHEVRON = {
  '-1': html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  1: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function bannerSlides(config, t) {
  const { logo, cartel } = images(config);
  const nombre = nombreDe(config);
  const anio = anioDe(config);
  const media = (src, alt, cls) => (src ? html`<span class="slide__media ${cls}" data-media><img src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : '');
  return [
    { kind: 'brand', title: t('footer_tournament_title', 'Torneo escolar de Fútbol Sala'), body: html`${media(logo, nombre, 'slide__media--logo')}<p class="slide__brand wordmark">${nombre}</p>${anio ? html`<p class="slide__season num">${anio}</p>` : ''}` },
    { kind: 'poster', title: t('banner_poster', 'Cartel del torneo'), body: media(cartel, t('banner_poster', 'Cartel del torneo'), 'slide__media--poster') },
    ...BASES.map((b) => ({ kind: b.key, title: b.title, icon: b.icon, body: body(b), lang: 'es' })),
  ];
}

export const banner = {
  id: 'carouselSection',
  /** @param {AppModel} model */
  hasData(model) { return !!sectionVisibility(model).carouselSection; },
  initialState() { return {}; },
  /** @param {AppModel} model */
  render(model, state = {}, t) {
    const slides = bannerSlides(model?.config ?? {}, t);
    const n = slides.length;
    return html`${sectionTitle(t, ['banner_title', 'El torneo'], ['banner_kicker', 'Bienvenidos'])}
    <div class="carousel reveal" role="region" aria-roledescription="${t('carousel_roledescription', 'carrusel')}" aria-label="${t('banner_label', 'Presentación del torneo')}" data-carousel>
      <div class="carousel__viewport" tabindex="0" data-carousel-track>
        ${slides.map((s, i) => html`<div class="carousel__slide slide slide--${s.kind}" role="group" aria-roledescription="${t('carousel_slide', 'diapositiva')}" aria-label="${i + 1} / ${n}: ${s.title}" data-slide="${i}"${s.lang ? html` lang="${s.lang}"` : ''}>
          <h3 class="slide__title">${s.icon ? html`<span class="slide__icon" aria-hidden="true">${s.icon}</span>` : ''}${s.title}</h3>
          <div class="slide__body">${s.body}</div>
        </div>`)}
      </div>
      <div class="carousel__controls">
        <button type="button" class="carousel__btn" data-carousel-step="-1" aria-label="${t('carousel_prev', 'Anterior')}" disabled>${CHEVRON['-1']}</button>
        <div class="carousel__dots" role="group" aria-label="${t('carousel_dots', 'Elegir tarjeta')}">
          ${slides.map((s, i) => html`<button type="button" class="carousel__dot" data-carousel-dot="${i}" aria-label="${i + 1}: ${s.title}"${i === 0 ? html` aria-current="true"` : ''}></button>`)}
        </div>
        <button type="button" class="carousel__btn" data-carousel-step="1" aria-label="${t('carousel_next', 'Siguiente')}">${CHEVRON[1]}</button>
      </div>
    </div>`;
  },
  /** @param {Element} root */
  bind(root) {
    if (!root) return;
    root.querySelectorAll('[data-carousel]').forEach(initCarousel);
    bindMediaFallback(root);
  },
};

/** Índice de la primera tarjeta visible según el desplazamiento del carril. */
export function slideAt(scrollLeft, slideLefts) {
  let best = 0;
  slideLefts.forEach((x, i) => { if (Math.abs(x - scrollLeft) < Math.abs(slideLefts[best] - scrollLeft)) best = i; });
  return best;
}

/**
 * Posiciones de desplazamiento realmente alcanzables: cada tarjeta se alinea a su `left`, pero el carril no
 * pasa de `maxScroll`; las tarjetas cuyo `left` supera el tope comparten esa última parada (en PC, con varias
 * tarjetas a la vista, las últimas nunca quedan «primeras»). Devuelve una parada por indicador visible.
 */
export function scrollStops(slideLefts, maxScroll) {
  const max = Math.max(0, Number(maxScroll) || 0);
  const stops = [];
  for (const x of slideLefts) {
    if (x >= max - 1) { stops.push(max); break; } // 1 px de tolerancia (subpíxeles)
    stops.push(x);
  }
  return stops;
}

function initCarousel(el) {
  const track = el.querySelector('[data-carousel-track]');
  const slides = [...el.querySelectorAll('[data-slide]')];
  const dots = [...el.querySelectorAll('[data-carousel-dot]')];
  const prev = el.querySelector('[data-carousel-step="-1"]');
  const next = el.querySelector('[data-carousel-step="1"]');
  if (!track || !slides.length) return;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Una parada por posición alcanzable; los indicadores sobrantes (tarjetas que nunca quedan primeras) se ocultan.
  const stops = () => scrollStops(slides.map((s) => s.offsetLeft - slides[0].offsetLeft), track.scrollWidth - track.clientWidth);
  const current = () => slideAt(track.scrollLeft, stops());
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  const go = (i) => {
    const s = stops();
    const to = Math.min(Math.max(i, 0), s.length - 1);
    track.scrollTo({ left: s[to] ?? 0, behavior: reduced ? 'auto' : 'smooth' });
  };
  const sync = () => {
    const n = stops().length || 1;
    const i = current();
    dots.forEach((d, j) => {
      d.hidden = j >= n;
      if (j === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
    // Un botón que se deshabilita con el foco dentro lo perdería: el foco pasa al otro botón.
    const set = (btn, off, other) => {
      if (!btn) return;
      if (off && document.activeElement === btn) other?.focus({ preventScroll: true });
      btn.disabled = off;
    };
    set(prev, i <= 0, next);
    set(next, atEnd(), prev);
  };
  track.addEventListener('scroll', sync, { passive: true }); // barato: 9-10 offsetLeft
  // Al cambiar el ancho (giro del móvil, ventana) cambia el número de paradas.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => { if (track.isConnected) sync(); else ro.disconnect(); });
    ro.observe(track);
  }
  prev?.addEventListener('click', () => go(current() - 1));
  next?.addEventListener('click', () => go(current() + 1));
  dots.forEach((d) => d.addEventListener('click', () => go(Number(d.dataset.carouselDot))));
  el.addEventListener('keydown', (ev) => {
    const map = { ArrowLeft: current() - 1, ArrowRight: current() + 1, Home: 0, End: slides.length - 1 };
    if (!(ev.key in map)) return;
    ev.preventDefault();
    go(map[ev.key]);
  });
  sync();
}

// ======================================================================== Bases (acordeón)

export const bases = {
  id: 'accordionSection',
  /** @param {AppModel} model */
  hasData(model) { return !!sectionVisibility(model).accordionSection; },
  initialState() { return {}; },
  /** @param {AppModel} model */
  render(model, state = {}, t) {
    const config = model?.config ?? {};
    const { cartel } = images(config);
    return html`${sectionTitle(t, ['section_bases_title', 'Bases del Torneo'], ['section_bases_kicker', 'Reglamento'])}
    <div class="rules reveal">
      <div class="accordion" data-single data-accordion lang="es">
        ${BASES.map((b, i) => accordionItem(b.title, html`<div class="rules__body">${body(b)}</div>`, { open: i === 0, level: 3 }))}
      </div>
      ${cartel ? html`<figure class="rules__poster reveal" data-media><img src="${cartel}" width="1000" height="1000" alt="${t('banner_poster', 'Cartel del torneo')} ${nombreDe(config)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><figcaption>${t('banner_poster', 'Cartel del torneo')}${anioDe(config) ? html` · <span class="num">${anioDe(config)}</span>` : ''}</figcaption></figure>` : ''}
    </div>`;
  },
  /** @param {Element} root */
  bind(root) {
    if (!root) return;
    root.querySelectorAll('[data-accordion]').forEach(createAccordion);
    bindMediaFallback(root);
  },
};
