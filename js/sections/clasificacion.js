// Clasificación: tabla de posiciones por ciclo (ESO / BCH), ordenada por total, DG, GF y nombre.
// Porta tablaClasificacion (js/ui.js). Filtro TODOS/ESO/BCH. Móvil: tarjetas por equipo; PC: tabla con
// encabezado fijo (misma marca, css/sections.css).
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { sectionTitle, emptyState, cicloChips, normCiclo, bindCommon } from './common.js';
import { sortStandings, logoLookup, standingsTable, standingsLegend } from './standings.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

export const id = 'clasificacion';

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** @returns {{ciclo: 'TODOS'|'ESO'|'BCH'}} */
export function initialState() {
  return { ciclo: 'TODOS' };
}

const TITLE = [['section_classification_title', 'Clasificación'], ['section_classification_kicker', 'La tabla']];
export const cycleName = (c, t) => t(`cycle_${c.toLowerCase()}_name`, c === 'ESO' ? 'Secundaria' : 'Bachillerato');

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const tabla = Array.isArray(model?.tabla) ? model.tabla : [];
  if (!hasData(model) || !tabla.length) {
    return html`${title}${emptyState(t, ['msg_no_standings', 'La clasificación aún no está disponible'], ['msg_no_standings_description', 'Aparecerá en cuanto se juegue el primer partido.'])}`;
  }
  const ciclo = normCiclo(state?.ciclo);
  const logoOf = logoLookup(model.equipos);
  const ciclos = (ciclo === 'TODOS' ? ['ESO', 'BCH'] : [ciclo]);
  const blocks = ciclos.map((c) => {
    const rows = sortStandings(tabla.filter((r) => r.ciclo === c));
    if (!rows.length) return '';
    const name = cycleName(c, t);
    return html`<section class="cycle-block" aria-labelledby="${id}-${c}">
      <h3 class="cycle-block__title reveal" id="${id}-${c}"><span class="cycle-block__badge">${c}</span>${name}</h3>
      ${standingsTable(rows, t, { caption: html`${t('section_classification_title', 'Clasificación')} · ${name}`, logoOf })}
    </section>`;
  }).filter(Boolean);

  return html`${title}<div class="filters">${cicloChips(ciclo, t)}</div>
    <div class="cycles">${blocks.length ? blocks : emptyState(t, ['msg_no_standings', 'La clasificación aún no está disponible'])}</div>
    ${blocks.length ? standingsLegend(t) : ''}`;
}

export function bind(root, ctx) {
  bindCommon(root, ctx, id);
}
