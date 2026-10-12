// Resultados: partidos JUGADOS por ciclo, del más reciente al más antiguo, con el detalle de goles.
// (El antiguo tablaResultados pintaba en realidad la tabla de posiciones, que ahora vive en
// Clasificación —Task 10—; aquí se cumple el spec §5/§8.6: «hay partidos JUGADO» + tarjetas con goles.)
// FINAL y TERCER PUESTO son inter-ciclo (R11): solo con TODOS, en un bloque propio al principio.
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { matchCard } from '../ui/matchCard.js';
import { sectionTitle, emptyState, cicloChips, normCiclo, byCiclo, chrono, bindCommon, rememberFocus } from './common.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

export const id = 'resultadosSection';
export const LIMITE = 6; // tarjetas por bloque antes de «Ver todos»

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** @returns {{ciclo: 'TODOS'|'ESO'|'BCH', abiertos: string[]}} abiertos: bloques desplegados con «Ver todos» */
export function initialState() {
  return { ciclo: 'TODOS', abiertos: [] };
}

const TITLE = [['section_results_title', 'Resultados'], ['section_results_kicker', 'Marcadores']];

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const jugados = (model?.partidos ?? []).filter((p) => p?.estatus === 'JUGADO');
  if (!jugados.length) return html`${title}${emptyState(t, ['msg_no_results', 'Todavía no hay resultados'], ['msg_no_results_description', 'Los marcadores aparecerán aquí en cuanto termine el primer partido.'])}`;

  const ciclo = normCiclo(state?.ciclo);
  const abiertos = Array.isArray(state?.abiertos) ? state.abiertos : [];
  const scoped = byCiclo(jugados, ciclo).sort((a, b) => chrono(b, a)); // recientes primero
  const goals = model?.goalsByMatch instanceof Map ? model.goalsByMatch : new Map();
  const locale = t('date_locale', 'es-ES');

  const block = (key, badge, name, ps, extraClass = '') => {
    if (!ps.length) return '';
    const open = abiertos.includes(key) || ps.length <= LIMITE + 1;
    const shown = open ? ps : ps.slice(0, LIMITE);
    return html`<section class="cycle-block${extraClass}" aria-labelledby="${id}-${key}">
      <h3 class="cycle-block__title reveal" id="${id}-${key}" tabindex="-1"><span class="cycle-block__badge${key === 'final' ? ' cycle-block__badge--gold' : ''}">${badge}</span>${name}</h3>
      <div class="match-grid">${shown.map((p, k) => matchCard(p, goals.get(p.key), t, { idPrefix: id, index: k, locale }))}</div>
      ${open ? '' : html`<div class="more-row"><button type="button" class="btn-ghost more-btn" data-expand="${key}">${t('results_show_all', 'Ver todos')} (${ps.length})</button></div>`}
    </section>`;
  };

  const finales = scoped.filter((p) => p.interciclo);
  const body = html`${ciclo === 'TODOS' ? html`<span class="diag-sentinel reveal" aria-hidden="true"></span>${block('final', 'ESO · BCH', t('final_block_title', 'Final y tercer puesto'), finales, ' cycle-block--final')}` : ''}${
    (ciclo === 'TODOS' ? ['ESO', 'BCH'] : [ciclo]).map((c) => block(c, c, t(`cycle_${c.toLowerCase()}_name`, c === 'ESO' ? 'Secundaria' : 'Bachillerato'), scoped.filter((p) => !p.interciclo && p.ciclo === c)))}`;

  return html`${title}<div class="filters">${cicloChips(ciclo, t)}</div>
    <div class="cycles">${scoped.length ? body : emptyState(t, ['msg_no_results', 'Todavía no hay resultados'])}</div>`;
}

export function bind(root, ctx) {
  if (!root) return;
  root.querySelectorAll('button[data-expand]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.expand;
      const prev = Array.isArray(ctx.state?.abiertos) ? ctx.state.abiertos : [];
      // el botón desaparece tras el re-render: el foco pasa al título del bloque (tabindex=-1)
      rememberFocus(id, `#${CSS.escape(`${id}-${key}`)}`);
      ctx.setState({ abiertos: [...new Set([...prev, key])] });
    });
  });
  bindCommon(root, ctx, id);
}
