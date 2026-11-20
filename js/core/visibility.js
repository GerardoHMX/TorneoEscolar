// Visibilidad automática de secciones (spec §5), orden por fase del torneo y modelo de menú.
// Solo Inicio y Bases se controlan manualmente desde OTROS (Carteles aparece si CARTELES tiene filas); el resto depende de los datos.

import { driveImg } from './drive.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

/**
 * Registro de secciones (id + etiqueta del menú). El ORDEN de página ya no es fijo: lo decide la fase del
 * torneo (ver PHASE_ORDER / sectionOrder). Este orden solo es el de respaldo para ids que no figuren en una fase.
 */
export const SECTIONS = [
  { id: 'inicio', labelKey: 'nav.inicio', menu: true },
  { id: 'accordionSection', labelKey: 'nav.bases', menu: true },
  { id: 'podioSection', labelKey: 'nav.podio', menu: true },
  { id: 'proximosPartidos', labelKey: 'nav.proximos', menu: true },
  { id: 'equipos', labelKey: 'nav.equipos', menu: true },
  { id: 'jornadas', labelKey: 'nav.jornadas', menu: true },
  { id: 'clasificacion', labelKey: 'nav.clasificacion', menu: true },
  { id: 'clasificacionGrupal', labelKey: 'nav.clasificacionGrupal', menu: true },
  { id: 'bracket', labelKey: 'nav.bracket', menu: true },
  { id: 'goleadoresSection', labelKey: 'nav.goleadores', menu: true },
  { id: 'sancionadosSection', labelKey: 'nav.sancionados', menu: true },
  { id: 'resultadosSection', labelKey: 'nav.resultados', menu: true },
  { id: 'noticiasSection', labelKey: 'nav.noticias', menu: true },
  { id: 'carouselSection', labelKey: 'nav.banner', menu: true },
  { id: 'galeriaSection', labelKey: 'nav.galeria', menu: true },
];

/**
 * Fases del torneo y orden de importancia de las secciones en cada una (lo primero, lo que más interesa).
 * Solo se pintan las visibles (sectionVisibility); el orden también decide el menú y los 4 accesos de la
 * barra móvil (las 4 primeras visibles).
 *  - previa:        sin equipos ni partidos -> qué es el torneo y cómo participar.
 *  - sorteo:        equipos inscritos / calendario con equipos, nada jugado -> quién juega y cuándo empieza.
 *  - grupos:        ya hay partidos jugados -> próximo partido, resultados, tablas.
 *  - eliminatorias: cuadro con equipos -> próximo cruce, cuadro, resultados.
 *  - final:         podio completo -> campeones, goleadores, recuerdos.
 */
export const PHASES = ['previa', 'sorteo', 'grupos', 'eliminatorias', 'final'];

export const PHASE_ORDER = {
  previa: [
    'inicio', 'accordionSection', 'carouselSection', 'noticiasSection', 'galeriaSection',
  ],
  sorteo: [
    'inicio', 'proximosPartidos', 'equipos', 'jornadas', 'accordionSection', 'carouselSection',
    'noticiasSection', 'galeriaSection',
  ],
  grupos: [
    'inicio', 'proximosPartidos', 'resultadosSection', 'clasificacion', 'clasificacionGrupal',
    'goleadoresSection', 'jornadas', 'sancionadosSection', 'noticiasSection', 'carouselSection',
    'galeriaSection', 'equipos', 'accordionSection',
  ],
  eliminatorias: [
    'inicio', 'proximosPartidos', 'bracket', 'resultadosSection', 'goleadoresSection', 'sancionadosSection',
    'clasificacion', 'clasificacionGrupal', 'noticiasSection', 'carouselSection', 'galeriaSection',
    'jornadas', 'equipos', 'accordionSection',
  ],
  final: [
    'inicio', 'podioSection', 'bracket', 'goleadoresSection', 'galeriaSection', 'resultadosSection',
    'clasificacion', 'clasificacionGrupal', 'noticiasSection', 'carouselSection', 'sancionadosSection',
    'jornadas', 'equipos', 'accordionSection', 'proximosPartidos',
  ],
};

const arr = (v) => (Array.isArray(v) ? v : []);
const txt = (v) => String(v ?? '').trim();
const upper = (v) => txt(v).toUpperCase();
const named = (lado) => txt(lado?.equipo) !== '';
const hasBoth = (p) => named(p?.local) && named(p?.visitante);
const jugado = (p) => p?.estatus === 'JUGADO';
const ELIM = ['CUARTOS', 'SEMIFINAL', 'TERCERPUESTO', 'FINAL'];

/**
 * Fase actual del torneo según los datos. CONFIGURACION puede forzarla con FASE_TORNEO
 * (PREVIA | SORTEO | GRUPOS | ELIMINATORIAS | FINAL); vacío o valor desconocido -> automática.
 * @param {Partial<AppModel>} model @returns {'previa'|'sorteo'|'grupos'|'eliminatorias'|'final'}
 */
export function tournamentPhase(model) {
  const m = model ?? {};
  const forced = txt(m.config?.FASE_TORNEO).toLowerCase();
  if (PHASES.includes(forced)) return /** @type {any} */ (forced);
  const partidos = arr(m.partidos).filter(Boolean);
  const podio = m.podio ?? {};
  if (podio.primero && podio.tercero) return 'final';
  if (partidos.some((p) => ELIM.includes(p.ronda) && hasBoth(p))) return 'eliminatorias';
  if (partidos.some(jugado)) return 'grupos';
  if (arr(m.equipos).length > 0 || partidos.some(hasBoth)) return 'sorteo';
  return 'previa';
}

/**
 * Orden de página completo (todas las secciones) para la fase: primero las de la fase, después el resto
 * en el orden de respaldo de SECTIONS (así una sección con datos nunca se pierde).
 * @param {string} phase @returns {string[]}
 */
export function sectionOrder(phase) {
  const first = PHASE_ORDER[phase] ?? [];
  const known = new Set(SECTIONS.map((s) => s.id));
  const head = first.filter((id) => known.has(id));
  return [...head, ...SECTIONS.map((s) => s.id).filter((id) => !head.includes(id))];
}

/** Interruptor manual de OTROS: SI/NO por id de sección; sin fila -> `def`. */
function manual(otros, id, def) {
  const row = arr(otros).find((o) => o && txt(o.seccion) === id && ['SI', 'NO'].includes(upper(o.visible)));
  return row ? upper(row.visible) === 'SI' : def;
}

/**
 * @param {Partial<AppModel>} model
 * @param {import('../data/models.js').Otro[]} [otros]
 * @returns {Record<string, boolean>}
 */
export function sectionVisibility(model, otros = model?.otros) {
  const m = model ?? {};
  const partidos = arr(m.partidos).filter(Boolean);
  const anyPlayed = partidos.some(jugado);
  const podio = m.podio ?? {};
  return {
    inicio: manual(otros, 'inicio', true),
    carouselSection: arr(m.carteles).some((c) => c && txt(c.torneo) && driveImg(txt(c.imagen))), // solo con filas en CARTELES
    accordionSection: manual(otros, 'accordionSection', false),
    podioSection: !!(podio.primero && podio.tercero),
    proximosPartidos: partidos.some((p) => !jugado(p) && hasBoth(p)),
    equipos: arr(m.equipos).length > 0,
    // Antes del sorteo la plantilla ya trae NPartido y fechas (CALENDARIO) sin equipos: eso no es contenido.
    jornadas: partidos.some((p) => hasBoth(p) || jugado(p)),
    clasificacion: anyPlayed,
    clasificacionGrupal: anyPlayed,
    bracket: partidos.some((p) => ELIM.includes(p.ronda) && hasBoth(p)),
    goleadoresSection: arr(m.scorers).length > 0,
    sancionadosSection: arr(m.sanciones).some((s) => s && txt(s.curso) && txt(s.jugador)),
    resultadosSection: anyPlayed,
    noticiasSection: arr(m.noticias).some((n) => n && upper(n.publicar) === 'SI'),
    galeriaSection: arr(m.galeria).some((g) => g && upper(g.publicar) === 'SI'),
  };
}

/** Secciones de contenido fijo (control manual en OTROS): no cuentan como «hay datos». */
export const FIXED_SECTIONS = ['inicio', 'carouselSection', 'accordionSection'];

/**
 * Aviso del orquestador: null si alguna sección visible tiene datos; si no, 'empty' (todo cargó pero el libro
 * aún no tiene nada publicado: «aún no hay datos») o 'failed' (alguna hoja no cargó: «no hemos podido cargar»).
 * @param {Iterable<string> | null | undefined} visibleIds @param {string} outcome resultado de loadOutcome
 * @returns {'empty' | 'failed' | null}
 */
export function noticeKind(visibleIds, outcome) {
  const ids = visibleIds ? [...visibleIds] : [];
  if (ids.some((id) => !FIXED_SECTIONS.includes(id))) return null;
  return outcome === 'empty' ? 'empty' : 'failed';
}

/**
 * Elementos del menú en orden de página (`order`, de sectionOrder; sin él, el de respaldo).
 * @param {Record<string, boolean>} vis @param {string[]} [order] @returns {{id:string, labelKey:string}[]}
 */
export function menuItems(vis, order = SECTIONS.map((s) => s.id)) {
  const byId = new Map(SECTIONS.map((s) => [s.id, s]));
  return order.map((id) => byId.get(id))
    .filter((s) => s && s.menu && vis?.[s.id])
    .map(({ id, labelKey }) => ({ id, labelKey }));
}

/**
 * Cambios del conjunto visible entre dos estados (en el orden `order`; por defecto, el de respaldo).
 * @param {Record<string, boolean> | null | undefined} prev @param {Record<string, boolean> | null | undefined} next
 * @param {string[]} [order]
 * @returns {{added: string[], removed: string[], kept: string[], changed: boolean}}
 */
export function diffSections(prev, next, order = SECTIONS.map((s) => s.id)) {
  const added = []; const removed = []; const kept = [];
  for (const id of order) {
    const a = !!prev?.[id]; const b = !!next?.[id];
    if (b && !a) added.push(id);
    else if (a && !b) removed.push(id);
    else if (a && b) kept.push(id);
  }
  return { added, removed, kept, changed: added.length + removed.length > 0 };
}
