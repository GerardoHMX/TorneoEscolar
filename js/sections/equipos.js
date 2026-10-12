// Equipos participantes por grupo, con filtros de ciclo y de grupo (portado de tablaEquipos +
// actualizarGruposDisponibles: los chips de grupo solo ofrecen los grupos del ciclo elegido y un grupo
// que deja de existir vuelve a «Todos»).
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { crest } from '../ui/matchCard.js';
import { sectionTitle, emptyState, cicloChips, chipRow, normCiclo, bindCommon } from './common.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

export const id = 'equipos';
const ORDEN_CICLO = { ESO: 0, BCH: 1 };

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

export function initialState() {
  return { ciclo: 'TODOS', grupo: 'TODOS' };
}

/** Grupos (ordenados) disponibles para un ciclo. */
export function gruposDe(equipos, ciclo) {
  const c = normCiclo(ciclo);
  return [...new Set((equipos ?? []).filter((e) => c === 'TODOS' || e.ciclo === c).map((e) => e.grupo))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
}

const TITLE = [['section_teams_title', 'Equipos participantes'], ['section_teams_kicker', 'Los protagonistas']];

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const all = model?.equipos ?? [];
  if (!all.length) return html`${title}${emptyState(t, ['msg_no_teams', 'Aún no hay equipos inscritos'], ['msg_no_teams_description', 'Los equipos aparecerán aquí después del sorteo.'])}`;

  const ciclo = normCiclo(state?.ciclo);
  const grupos = gruposDe(all, ciclo);
  const grupo = grupos.includes(state?.grupo) ? state.grupo : 'TODOS';
  const list = all.filter((e) => (ciclo === 'TODOS' || e.ciclo === ciclo) && (grupo === 'TODOS' || e.grupo === grupo));

  // Agrupa por ciclo + grupo en el orden ESO→BCH, A→Z; equipos en el orden de la hoja.
  const bloques = new Map();
  for (const e of list) {
    const k = `${e.ciclo}|${e.grupo}`;
    if (!bloques.has(k)) bloques.set(k, { ciclo: e.ciclo, grupo: e.grupo, equipos: [] });
    bloques.get(k).equipos.push(e);
  }
  const ordered = [...bloques.values()].sort((a, b) =>
    (ORDEN_CICLO[a.ciclo] ?? 9) - (ORDEN_CICLO[b.ciclo] ?? 9) || a.grupo.localeCompare(b.grupo, 'es'));

  const grupoChips = chipRow('grupo', [
    { value: 'TODOS', label: t('filter_all_groups', 'Todos los grupos') },
    ...grupos.map((g) => ({ value: g, label: `${t('group', 'Grupo')} ${g}` })),
  ], grupo, t('filter_group_label', 'Filtrar por grupo'));

  let i = 0;
  const card = (b) => html`<article class="group-card card reveal" style="--i:${Math.min(i++, 8)}">
    <header class="group-card__head">
      <span class="group-card__letter num" aria-hidden="true">${b.grupo}</span>
      <div>
        <h3 class="group-card__title">${t('group', 'Grupo')} ${b.grupo}</h3>
        <p class="group-card__sub">${b.ciclo} · ${b.equipos.length} ${t('teams_count', 'equipos')}</p>
      </div>
    </header>
    <ul class="team-list">${b.equipos.map((e) => html`<li class="team">
      ${crest(e.equipo, e.logo, { size: 'sm' })}
      <span class="team__text"><span class="team__name">${e.equipo}</span>${e.curso ? html`<span class="team__course">${e.curso}</span>` : ''}</span>
    </li>`)}</ul>
  </article>`;

  return html`${title}
    <div class="filters">${cicloChips(ciclo, t)}${grupos.length > 1 ? grupoChips : ''}</div>
    ${ordered.length ? html`<div class="group-grid">${ordered.map(card)}</div>` : emptyState(t, ['msg_no_data', 'No hay datos disponibles'])}`;
}

export function bind(root, ctx) {
  // Al cambiar de ciclo el grupo vuelve a «Todos» (los grupos dependen del ciclo).
  bindCommon(root, ctx, id, (name) => (name === 'ciclo' ? { grupo: 'TODOS' } : {}));
}
