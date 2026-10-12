// Jornadas: todo el calendario por ciclo y fase (portado de tablaResultadosFaseDeGrupos /
// CuartosDeFinal / Semifinal / TercerFinalPuesto). La FINAL y el TERCER PUESTO son inter-ciclo (R11):
// solo aparecen con el filtro TODOS, en su propio bloque «Final y tercer puesto».
// Extra móvil: chips de fase para no recorrer 30+ tarjetas (solo se muestran las fases con partidos).
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { matchCard } from '../ui/matchCard.js';
import { sectionTitle, emptyState, cicloChips, chipRow, normCiclo, byCiclo, chrono, bindCommon } from './common.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

export const id = 'jornadas';
const FASES = ['INICIAL', 'CUARTOS', 'SEMIFINAL', 'FINAL']; // FINAL agrupa TERCERPUESTO + FINAL
const faseDe = (p) => (p.interciclo ? 'FINAL' : p.ronda);
const named = (lado) => String(lado?.equipo ?? '').trim() !== '';
// Antes del sorteo la plantilla trae NPartido y fechas sin equipos: esas filas no se pintan («Por definir vs
// Por definir»). Un cruce con un solo lado conocido (eliminatoria a medias) sí se muestra.
const conEquipo = (p) => named(p.local) || named(p.visitante);

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

export function initialState() {
  return { ciclo: 'TODOS', fase: 'TODAS' };
}

const TITLE = [['section_journeys_title', 'Jornadas'], ['section_journeys_kicker', 'Calendario completo']];
const FASE_LABEL = {
  INICIAL: ['table_group_phase', 'Fase de grupos'],
  CUARTOS: ['phase_quarters', 'Cuartos de final'],
  SEMIFINAL: ['phase_semifinal', 'Semifinal'],
  FINAL: ['final_block_title', 'Final y tercer puesto'],
};

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const all = (model?.partidos ?? []).filter((p) => p && conEquipo(p));
  if (!all.length) return html`${title}${emptyState(t, ['msg_no_matches', 'No hay partidos programados'], ['msg_no_matches_description', 'Los partidos se mostrarán automáticamente cuando estén programados.'])}`;

  const ciclo = normCiclo(state?.ciclo);
  const scoped = byCiclo(all, ciclo).sort(chrono);
  const fasesDisp = FASES.filter((f) => scoped.some((p) => faseDe(p) === f));
  const fase = fasesDisp.includes(state?.fase) ? state.fase : 'TODAS';
  const list = scoped.filter((p) => fase === 'TODAS' || faseDe(p) === fase);
  const goals = model?.goalsByMatch instanceof Map ? model.goalsByMatch : new Map();
  const locale = t('date_locale', 'es-ES');

  const cards = (ps) => html`<div class="match-grid">${ps.map((p, k) => matchCard(p, goals.get(p.key), t, { idPrefix: id, index: k, locale }))}</div>`;

  const faseBlock = (ps, f) => {
    const del = ps.filter((p) => faseDe(p) === f);
    if (!del.length) return '';
    if (f === 'INICIAL') {
      const grupos = [...new Set(del.map((p) => p.grupo))].sort((a, b) => a.localeCompare(b, 'es'));
      return html`<div class="phase">
        <h4 class="phase__title reveal">${t(...FASE_LABEL.INICIAL)}</h4>
        ${grupos.map((g) => html`<div class="phase__group"><h5 class="phase__group-title reveal">${t('group', 'Grupo')} ${g}</h5>${cards(del.filter((p) => p.grupo === g))}</div>`)}
      </div>`;
    }
    return html`<div class="phase"><h4 class="phase__title reveal">${t(...FASE_LABEL[f])}</h4>${cards(del)}</div>`;
  };

  const cicloBlock = (c) => {
    const ps = list.filter((p) => !p.interciclo && p.ciclo === c);
    if (!ps.length) return '';
    return html`<section class="cycle-block" aria-labelledby="${id}-${c}">
      <h3 class="cycle-block__title reveal" id="${id}-${c}"><span class="cycle-block__badge">${c}</span>${t(`cycle_${c.toLowerCase()}_name`, c === 'ESO' ? 'Secundaria' : 'Bachillerato')}</h3>
      ${['INICIAL', 'CUARTOS', 'SEMIFINAL'].map((f) => faseBlock(ps, f))}
    </section>`;
  };

  const finales = list.filter((p) => p.interciclo);
  const finalBlock = finales.length
    ? html`<section class="cycle-block cycle-block--final" aria-labelledby="${id}-final">
        <h3 class="cycle-block__title reveal" id="${id}-final"><span class="cycle-block__badge cycle-block__badge--gold">ESO · BCH</span>${t(...FASE_LABEL.FINAL)}</h3>
        ${cards(finales)}
      </section>`
    : '';

  const faseChips = fasesDisp.length > 1
    ? chipRow('fase', [{ value: 'TODAS', label: t('filter_all_phases', 'Todas las fases') },
      ...fasesDisp.map((f) => ({ value: f, label: f === 'FINAL' ? t('phase_final', 'Final') : t(...FASE_LABEL[f]) }))],
    fase, t('filter_phase_label', 'Filtrar por fase'))
    : '';

  const cycles = (ciclo === 'TODOS' ? ['ESO', 'BCH'] : [ciclo]).map(cicloBlock);
  const body = list.length ? html`${cycles}${finalBlock}` : emptyState(t, ['msg_no_matches', 'No hay partidos programados']);
  return html`${title}<div class="filters">${cicloChips(ciclo, t)}${faseChips}</div><div class="cycles">${body}</div>`;
}

export function bind(root, ctx) {
  // Las fases disponibles dependen del ciclo: al cambiar de ciclo, vuelta a «Todas las fases».
  bindCommon(root, ctx, id, (name) => (name === 'ciclo' ? { fase: 'TODAS' } : {}));
}
