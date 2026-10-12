// Inicio (hero): nombre y temporada del torneo (CONFIGURACION: TORNEO_NOMBRE, TORNEO_ANIO), el balón
// flotante (mismas siluetas que el loader) y contadores animados de equipos, partidos jugados y goles.
// Se renderiza con <h1> (es la cabecera de la página), no con el <h2 class="section-title"> del resto.
// El <section id="inicio"> que crea el orquestador queda a sangre (css/home.css: #inicio.section).
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { BALL, BALL_PANELS } from '../ui/loader.js';
import { bindCountUps } from '../ui/countUp.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

export const id = 'inicio';

const arr = (v) => (Array.isArray(v) ? v : []);
const txt = (v) => String(v ?? '').trim();
const score = (lado) => (Number.isFinite(lado?.score) ? Math.max(0, lado.score) : 0);

/**
 * Cifras del hero.
 * - equipos: filas de EQUIPOS.
 * - jugados: partidos con ESTATUS = JUGADO.
 * - goles: TODOS los goles de la hoja GOLES (GOL, PENAL y también PROPIA: un gol en propia puerta sube al
 *   marcador) cuyo NPartido corresponde a un partido JUGADO (docs/HOJA_GOLES.md: los de un partido que no
 *   existe o aún no se ha jugado no cuentan). Si GOLES está vacía (nadie ha capturado
 *   aún el detalle), suma de los dos marcadores de los partidos JUGADO, para que la cifra sea correcta
 *   desde el primer resultado.
 * @param {Partial<AppModel>} [model] @returns {{equipos: number, jugados: number, goles: number}}
 */
export function heroStats(model) {
  const partidos = arr(model?.partidos).filter(Boolean);
  const jugadosList = partidos.filter((p) => p.estatus === 'JUGADO');
  const goles = arr(model?.goles).filter(Boolean);
  let total;
  if (goles.length) {
    const keys = new Set(jugadosList.map((p) => String(p.key ?? p.n)));
    total = goles.filter((g) => keys.has(String(g.n))).length;
  } else {
    total = jugadosList.reduce((s, p) => s + score(p.local) + score(p.visitante), 0);
  }
  return { equipos: arr(model?.equipos).filter(Boolean).length, jugados: jugadosList.length, goles: total };
}

/** @param {AppModel} model */
export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

export function initialState() {
  return {};
}

// Llamadas a la acción: las dos primeras secciones visibles de esta lista.
const CTAS = [
  ['proximosPartidos', 'hero_cta_matches', 'Ver partidos'],
  ['clasificacion', 'section_classification_title', 'Clasificación'],
  ['resultadosSection', 'hero_cta_results', 'Resultados'],
  ['jornadas', 'section_journeys_title', 'Jornadas'],
  ['equipos', 'hero_cta_teams', 'Equipos'],
  ['accordionSection', 'section_bases_title', 'Bases del Torneo'],
];

function ball() {
  const { x, y, r } = BALL;
  const box = `${x - r - 1} ${y - r - 1} ${2 * r + 2} ${2 * r + 2}`;
  return html`<svg class="hero__ball-svg" viewBox="${box}" focusable="false">
    <defs>
      <radialGradient id="heroBallBody" cx=".36" cy=".3" r=".85">
        <stop offset="0" stop-color="#8a6210"></stop>
        <stop offset=".55" stop-color="#634610"></stop>
        <stop offset="1" stop-color="#3f2d0c"></stop>
      </radialGradient>
      <linearGradient id="heroBallGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#faefd2"></stop>
        <stop offset=".45" stop-color="#eac871"></stop>
        <stop offset="1" stop-color="#b07f14"></stop>
      </linearGradient>
    </defs>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#heroBallBody)"></circle>
    <g fill="url(#heroBallGold)">${BALL_PANELS.map(([d]) => html`<path d="${d}"></path>`)}</g>
    <circle cx="${x}" cy="${y}" r="${r - 1}" fill="none" stroke="#f3dea3" stroke-opacity=".35" stroke-width="2"></circle>
  </svg>`;
}

/** @param {AppModel} model */
export function render(model, state = {}, t) {
  const config = model?.config ?? {};
  const nombre = txt(config.TORNEO_NOMBRE) || 'Al-Ándalus';
  const anio = txt(config.TORNEO_ANIO);
  const colegio = txt(config.COLEGIO_NOMBRE);
  const vis = sectionVisibility(model ?? {});
  const ctas = CTAS.filter(([sid]) => vis[sid]).slice(0, 2);
  const s = heroStats(model); // todo 0 (sin datos o fallo de carga): sin tira de contadores, nunca «0 · 0 · 0»
  const stats = [
    ['hero_stat_teams', 'Equipos', s.equipos],
    ['hero_stat_played', 'Partidos jugados', s.jugados],
    ['hero_stat_goals', 'Goles', s.goles],
  ];
  return html`<div class="hero band band--gold">
    <div class="hero__inner">
      <div class="hero__copy">
        <p class="hero__kicker reveal" style="--i:0">${t('footer_tournament_title', 'Torneo escolar de Fútbol Sala')}</p>
        <h1 class="hero__title reveal" style="--i:1">${nombre}</h1>
        ${anio ? html`<p class="hero__season reveal" style="--i:2"><span>${t('hero_season', 'Temporada')}</span> <span class="num">${anio}</span></p>` : ''}
        <p class="hero__tagline reveal" style="--i:3">${t('hero_tagline', 'Más que una competición: inclusión, respeto y deporte en cada recreo.')}${colegio ? html` <span class="hero__school">${colegio}</span>` : ''}</p>
        ${ctas.length ? html`<div class="hero__ctas reveal" style="--i:4">${ctas.map(([sid, key, fb], i) => html`<a class="${i === 0 ? 'btn-gold' : 'btn-ghost'}" href="#${sid}">${t(key, fb)}</a>`)}</div>` : ''}
      </div>
      <div class="hero__ball" aria-hidden="true">
        <div class="hero__ball-float">${ball()}</div>
        <span class="hero__ball-shadow"></span>
      </div>
      ${s.equipos + s.jugados + s.goles > 0 ? html`<dl class="hero__stats reveal" style="--i:5">${stats.map(([key, fb, n], i) => html`<div class="hero__stat">
        <dt class="hero__stat-label">${t(key, fb)}</dt>
        <dd class="hero__stat-value"><span class="num" data-count-delay="${200 + i * 150}" data-count="${n}">${n}</span></dd>
      </div>`)}</dl>` : ''}
    </div>
  </div>`;
}

/** @param {Element} root */
export function bind(root) {
  if (!root) return;
  bindCountUps(root);
}
