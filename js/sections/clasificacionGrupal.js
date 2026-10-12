// Clasificación grupal: una tabla por grupo (A-D…) dentro de cada ciclo, mismo orden que Clasificación.
// Porta tablaClasificacionGrupal (js/ui.js), incluida la leyenda de abreviaturas. Filtro TODOS/ESO/BCH.
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { sectionTitle, emptyState, cicloChips, normCiclo, bindCommon } from './common.js';
import { sortStandings, logoLookup, standingsTable, standingsLegend } from './standings.js';
import { cycleName } from './clasificacion.js';

export const id = 'clasificacionGrupal';

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** @returns {{ciclo: 'TODOS'|'ESO'|'BCH'}} */
export function initialState() {
  return { ciclo: 'TODOS' };
}

const TITLE = [['section_group_classification_title', 'Clasificación por grupos'], ['section_group_classification_kicker', 'Grupo a grupo']];

/** { ciclo -> [[grupo, filas ordenadas], …] } con los grupos en orden alfabético. */
export function groupStandings(tabla, ciclo) {
  const groups = new Map();
  for (const r of tabla) {
    if (r?.ciclo !== ciclo) continue;
    const g = String(r.grupo ?? '').trim().toUpperCase();
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  return [...groups.keys()].sort().map((g) => [g, sortStandings(groups.get(g))]);
}

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const tabla = Array.isArray(model?.tabla) ? model.tabla : [];
  if (!hasData(model) || !tabla.length) {
    return html`${title}${emptyState(t, ['msg_no_standings', 'La clasificación aún no está disponible'], ['msg_no_standings_description', 'Aparecerá en cuanto se juegue el primer partido.'])}`;
  }
  const ciclo = normCiclo(state?.ciclo);
  const logoOf = logoLookup(model.equipos);
  const grupoLbl = t('group', 'Grupo');
  const blocks = (ciclo === 'TODOS' ? ['ESO', 'BCH'] : [ciclo]).map((c) => {
    const groups = groupStandings(tabla, c).filter(([, rows]) => rows.length);
    if (!groups.length) return '';
    return html`<section class="cycle-block" aria-labelledby="${id}-${c}">
      <h3 class="cycle-block__title reveal" id="${id}-${c}"><span class="cycle-block__badge">${c}</span>${cycleName(c, t)}</h3>
      <div class="group-tables">${groups.map(([g, rows]) => html`<div class="group-table" data-group="${c}-${g}">
        <h4 class="group-table__title reveal"><span class="group-table__letter" aria-hidden="true">${g}</span>${grupoLbl} ${g}</h4>
        ${standingsTable(rows, t, { caption: html`${c} · ${grupoLbl} ${g}`, logoOf })}
      </div>`)}</div>
    </section>`;
  }).filter(Boolean);

  return html`${title}<div class="filters">${cicloChips(ciclo, t)}</div>
    <div class="cycles">${blocks.length ? blocks : emptyState(t, ['msg_no_standings', 'La clasificación aún no está disponible'])}</div>
    ${blocks.length ? standingsLegend(t) : ''}`;
}

export function bind(root, ctx) {
  bindCommon(root, ctx, id);
}
