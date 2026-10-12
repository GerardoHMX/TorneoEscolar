// Visibilidad automática de secciones (spec §5) y modelo de menú.
// Solo Inicio, Banner y Bases se controlan manualmente desde OTROS; el resto depende de los datos.

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

/** Orden del spec §4. mobilePrimary: los 4 accesos de la barra inferior móvil (+ «Más» lo pinta nav). */
export const SECTIONS = [
  { id: 'inicio', labelKey: 'nav.inicio', menu: true, mobilePrimary: true },
  { id: 'carouselSection', labelKey: 'nav.banner', menu: false, mobilePrimary: false },
  { id: 'accordionSection', labelKey: 'nav.bases', menu: true, mobilePrimary: false },
  { id: 'podioSection', labelKey: 'nav.podio', menu: true, mobilePrimary: false },
  { id: 'proximosPartidos', labelKey: 'nav.proximos', menu: true, mobilePrimary: true },
  { id: 'equipos', labelKey: 'nav.equipos', menu: true, mobilePrimary: false },
  { id: 'jornadas', labelKey: 'nav.jornadas', menu: true, mobilePrimary: false },
  { id: 'clasificacion', labelKey: 'nav.clasificacion', menu: true, mobilePrimary: true },
  { id: 'clasificacionGrupal', labelKey: 'nav.clasificacionGrupal', menu: true, mobilePrimary: false },
  { id: 'bracket', labelKey: 'nav.bracket', menu: true, mobilePrimary: false },
  { id: 'goleadoresSection', labelKey: 'nav.goleadores', menu: true, mobilePrimary: true },
  { id: 'sancionadosSection', labelKey: 'nav.sancionados', menu: true, mobilePrimary: false },
  { id: 'resultadosSection', labelKey: 'nav.resultados', menu: true, mobilePrimary: false },
  { id: 'noticiasSection', labelKey: 'nav.noticias', menu: true, mobilePrimary: false },
  { id: 'galeriaSection', labelKey: 'nav.galeria', menu: true, mobilePrimary: false },
];

const arr = (v) => (Array.isArray(v) ? v : []);
const txt = (v) => String(v ?? '').trim();
const upper = (v) => txt(v).toUpperCase();
const named = (lado) => txt(lado?.equipo) !== '';
const hasBoth = (p) => named(p?.local) && named(p?.visitante);
const jugado = (p) => p?.estatus === 'JUGADO';
const ELIM = ['CUARTOS', 'SEMIFINAL', 'TERCERPUESTO', 'FINAL'];

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
    carouselSection: manual(otros, 'carouselSection', false),
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

/** @param {Record<string, boolean>} vis @returns {{id:string, labelKey:string}[]} */
export function menuItems(vis) {
  return SECTIONS.filter((s) => s.menu && vis?.[s.id]).map(({ id, labelKey }) => ({ id, labelKey }));
}

/**
 * Cambios del conjunto visible entre dos estados (orden de SECTIONS).
 * @param {Record<string, boolean> | null | undefined} prev @param {Record<string, boolean> | null | undefined} next
 * @returns {{added: string[], removed: string[], kept: string[], changed: boolean}}
 */
export function diffSections(prev, next) {
  const added = []; const removed = []; const kept = [];
  for (const { id } of SECTIONS) {
    const a = !!prev?.[id]; const b = !!next?.[id];
    if (b && !a) added.push(id);
    else if (a && !b) removed.push(id);
    else if (a && b) kept.push(id);
  }
  return { added, removed, kept, changed: added.length + removed.length > 0 };
}
