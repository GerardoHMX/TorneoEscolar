// Piezas compartidas por Goleadores y Sancionados (listas de jugadores): filtro ciclo + curso dependiente
// (porta initCursoSelectors / actualizarCurso* de js/main.js: el curso se elige entre los presentes en los
// datos del ciclo y vuelve a «Todos» al cambiar de ciclo), logo del equipo y bloque por ciclo.
import { html } from '../core/dom.js';
import { CICLOS, normCiclo, cicloChips, filterSelect } from './common.js';
import { logoLookup } from './standings.js';
import { cycleName } from './clasificacion.js';

const txt = (v) => String(v ?? '').trim();
const ORDEN_CICLO = { ESO: 0, BCH: 1 };
const byCurso = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Ciclos a pintar para un filtro: TODOS -> ESO y BCH. */
export const ciclosDe = (ciclo) => (normCiclo(ciclo) === 'TODOS' ? CICLOS.slice(1) : [normCiclo(ciclo)]);

/**
 * Cursos presentes en `list` para el ciclo (TODOS = todos), sin vacíos ni repetidos; ESO antes que BCH
 * y, dentro de cada ciclo, en orden natural («1º ESO A» < «2º ESO A»).
 * @param {{ciclo: string, curso: string}[]|undefined} list
 */
export function cursosDe(list, ciclo) {
  const c = normCiclo(ciclo);
  const seen = new Map();
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || (c !== 'TODOS' && x.ciclo !== c)) continue;
    const curso = txt(x.curso);
    if (curso && !seen.has(curso)) seen.set(curso, x.ciclo);
  }
  return [...seen].sort(([a, ca], [b, cb]) => (ORDEN_CICLO[ca] ?? 9) - (ORDEN_CICLO[cb] ?? 9) || byCurso.compare(a, b)).map(([k]) => k);
}

/** Transición pura del filtro: al cambiar de ciclo el curso vuelve a TODOS (los cursos dependen del ciclo). */
export function filterPatch(name, value) {
  return name === 'ciclo' ? { ciclo: value, curso: 'TODOS' } : { [name]: value };
}

/**
 * Filtro efectivo: ciclo normalizado y curso solo si existe en ese ciclo (si no, TODOS).
 * @returns {{ciclo: string, curso: string, cursos: string[], rows: any[]}} rows = filas que pasan el filtro
 */
export function applyFilters(list, state) {
  const ciclo = normCiclo(state?.ciclo);
  const cursos = cursosDe(list, ciclo);
  const curso = cursos.includes(state?.curso) ? state.curso : 'TODOS';
  const rows = (Array.isArray(list) ? list : []).filter((x) => x
    && (ciclo === 'TODOS' || x.ciclo === ciclo) && (curso === 'TODOS' || txt(x.curso) === curso));
  return { ciclo, curso, cursos, rows };
}

/** Filtros: chips de ciclo + selector de curso (agrupado por ciclo con TODOS). */
export function rosterFilters(list, { ciclo, curso, cursos }, t) {
  const all = { value: 'TODOS', label: t('filter_all_courses', 'Todos los cursos') };
  const groups = [{ options: [all] }];
  if (ciclo === 'TODOS') {
    for (const c of CICLOS.slice(1)) {
      const own = cursosDe(list, c);
      if (own.length) groups.push({ label: c, options: own.map((v) => ({ value: v, label: v })) });
    }
  } else {
    groups.push({ options: cursos.map((v) => ({ value: v, label: v })) });
  }
  // El selector va fuera de la tira de chips: en móvil la tira fija (sticky) cabe en una línea y el curso
  // queda debajo; en PC (.filters-line en fila) se ven juntos.
  return html`<div class="filters-line"><div class="filters">${cicloChips(ciclo, t)}</div>${
    cursos.length > 1 ? filterSelect('curso', groups, curso, t('filter_course_label', 'Curso')) : ''}</div>`;
}

/** Logo de un equipo: por ID en EQUIPOS y, si no, por nombre (Goleador/Sancion no traen logo). */
export function teamLogo(equipos) {
  const list = Array.isArray(equipos) ? equipos : [];
  const byId = new Map(list.filter(Boolean).map((e) => [e.id, e.logo ?? '']));
  const byName = logoLookup(list);
  return (equipoId, nombre) => (equipoId && byId.has(equipoId) ? byId.get(equipoId) : byName(nombre));
}

/** <section class="cycle-block"> con título (badge + nombre del ciclo). */
export function cycleBlock(sectionId, c, t, body, extraClass = '') {
  return html`<section class="cycle-block${extraClass}" aria-labelledby="${sectionId}-${c}">
    <h3 class="cycle-block__title reveal" id="${sectionId}-${c}" tabindex="-1"><span class="cycle-block__badge">${c}</span>${cycleName(c, t)}</h3>
    ${body}
  </section>`;
}
