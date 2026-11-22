// Inicio (hero «Cromo»): rótulo, nombre y temporada del torneo (CONFIGURACION: TORNEO_NOMBRE, TORNEO_ANIO),
// lema, botones y contadores animados de equipos, partidos jugados y goles. El escudo del torneo va en un cromo
// de álbum (marco dorado, dos dorsos detrás) sobre un campo rojo a rayas de camiseta (css/home.css: .cromo).
// Entrada animada UNA sola vez por visita: el primer render lleva .cromo--intro y la animación arranca cuando el
// loader sale (<html class="app-ready">); los re-render posteriores (refresco de datos, idioma) ya no la llevan.
// Se renderiza con <h1> (es la cabecera de la página), no con el <h2 class="section-title"> del resto.
// El <section id="inicio"> que crea el orquestador queda a sangre (css/home.css: #inicio.section).
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
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

/** Temporada abreviada para el fondo del hero: «2026-2027» -> «26-27»; si no son dos años, el texto tal cual. */
export function seasonShort(anio) {
  const s = txt(anio);
  const m = s.match(/(\d{4})\D+(\d{4})/);
  return m ? `${m[1].slice(2)}-${m[2].slice(2)}` : s;
}

/** Siglas del colegio para la esquina del cromo: «Colegio San Francisco de Asís» -> «CSFA». */
export function schoolInitials(nombre) {
  const words = txt(nombre).split(/\s+/).filter((w) => w && !/^(de|del|la|las|los|el|y)$/i.test(w));
  return words.map((w) => w[0].toLocaleUpperCase('es')).join('').slice(0, 5);
}

let introPlayed = false; // la entrada animada solo se ve una vez por visita

/** @param {AppModel} model */
export function render(model, state = {}, t) {
  const config = model?.config ?? {};
  const nombre = txt(config.TORNEO_NOMBRE) || 'Al-Ándalus';
  const anio = txt(config.TORNEO_ANIO);
  const colegio = txt(config.COLEGIO_NOMBRE);
  const siglas = schoolInitials(colegio) || 'CSFA';
  const temporada = seasonShort(anio).replace('-', '/');
  const vis = sectionVisibility(model ?? {});
  const ctas = CTAS.filter(([sid]) => vis[sid]).slice(0, 2);
  const s = heroStats(model); // todo 0 (sin datos o fallo de carga): sin tira de contadores, nunca «0 · 0 · 0»
  const stats = [
    ['hero_stat_teams', 'Equipos', s.equipos],
    ['hero_stat_played', 'Partidos jugados', s.jugados],
    ['hero_stat_goals', 'Goles', s.goles],
  ];
  const torneo = t('footer_tournament_title', 'Torneo escolar de Fútbol Sala');
  return html`<div class="cromo${introPlayed ? '' : ' cromo--intro'}">
    <span class="cromo__gold" aria-hidden="true"></span>
    <span class="cromo__field" aria-hidden="true"></span>
    <div class="cromo__inner">
      <div class="cromo__pack">
        <span class="cromo__back cromo__back--a" aria-hidden="true"></span>
        <span class="cromo__back cromo__back--b" aria-hidden="true"></span>
        <div class="cromo__card">
          <div class="cromo__card-top" aria-hidden="true"><span>${siglas}</span>${temporada ? html`<span>${temporada}</span>` : ''}</div>
          <img class="cromo__logo" src="img/logo-torneo.webp" alt="${torneo} ${nombre}" width="1000" height="1144" decoding="async" fetchpriority="high">
          <div class="cromo__card-foot" aria-hidden="true"><b class="wordmark">${nombre}</b><small>${t('hero_card_sport', 'Fútbol Sala')}</small></div>
        </div>
      </div>
      <div class="cromo__copy">
        <p class="cromo__kicker" style="--i:0">${torneo}</p>
        <h1 class="cromo__title wordmark" style="--i:1">${nombre}</h1>
        <p class="cromo__tagline" style="--i:2">${t('hero_tagline', 'Más que una competición: inclusión, respeto y deporte en cada recreo.')}${colegio ? html` <span class="cromo__school">${colegio}</span>` : ''}</p>
        ${anio ? html`<p class="cromo__season" style="--i:3"><span>${t('hero_season', 'Temporada')}</span> <span class="num">${anio}</span></p>` : ''}
        ${ctas.length ? html`<div class="cromo__ctas" style="--i:4">${ctas.map(([sid, key, fb], i) => html`<a class="${i === 0 ? 'btn-gold' : 'btn-ghost'}" href="#${sid}">${t(key, fb)}</a>`)}</div>` : ''}
      </div>
      ${s.equipos + s.jugados + s.goles > 0 ? html`<dl class="cromo__stats">${stats.map(([key, fb, n], i) => html`<div class="cromo__stat" style="--i:${i}">
        <dt>${t(key, fb)}</dt>
        <dd><span class="num" data-count-delay="${200 + i * 150}" data-count="${n}">${n}</span></dd>
      </div>`)}</dl>` : ''}
    </div>
  </div>`;
}

/** @param {Element} root */
export function bind(root) {
  if (!root) return;
  bindCountUps(root);
  // La entrada arranca con .app-ready (loader fuera); pasado su tiempo, los siguientes render ya no la repiten.
  if (introPlayed || !root.querySelector('.cromo--intro')) return;
  const html_ = document.documentElement;
  const done = () => setTimeout(() => { introPlayed = true; }, 2500);
  if (html_.classList.contains('app-ready')) { done(); return; }
  const mo = new MutationObserver(() => {
    if (!html_.classList.contains('app-ready')) return;
    mo.disconnect();
    done();
  });
  mo.observe(html_, { attributes: true, attributeFilter: ['class'] });
}
