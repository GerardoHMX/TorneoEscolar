// Piezas compartidas por los módulos de sección (contrato R14): título, chips de filtro, estado vacío,
// filtro por ciclo y restauración del foco tras el re-render completo que hace el orquestador.
import { html } from '../core/dom.js';
import { createTabs } from '../ui/tabs.js';
import { bindCrests, bindGoalToggles } from '../ui/matchCard.js';

/** @typedef {import('../data/models.js').Partido} Partido */

export const CICLOS = ['TODOS', 'ESO', 'BCH'];
export const normCiclo = (c) => (CICLOS.includes(c) ? c : 'TODOS');

/** Partidos de un ciclo. ESO/BCH excluyen los inter-ciclo (FINAL, TERCERPUESTO): solo salen en TODOS (R11). */
export function byCiclo(partidos, ciclo) {
  const c = normCiclo(ciclo);
  return (partidos ?? []).filter((p) => p && (c === 'TODOS' || (!p.interciclo && p.ciclo === c)));
}

/** Orden cronológico: fecha, hora y número de partido (los sin fecha, al final). */
export function chrono(a, b) {
  const fa = a.fecha?.getTime?.() ?? Infinity;
  const fb = b.fecha?.getTime?.() ?? Infinity;
  if (fa !== fb) return fa < fb ? -1 : 1;
  const h = String(a.hora ?? '').padStart(5, '0').localeCompare(String(b.hora ?? '').padStart(5, '0'));
  return h || a.n - b.n;
}

/** <h2 class="section-title"> con antetítulo caligráfico. */
export function sectionTitle(t, [titleKey, titleFb], [kickerKey, kickerFb]) {
  return html`<h2 class="section-title"><span class="section-title__kicker">${t(kickerKey, kickerFb)}</span>${t(titleKey, titleFb)}</h2>`;
}

/**
 * Fila de chips de selección única; bindFilters la cablea con createTabs -> setState({[name]: value}).
 * @param {string} name clave del estado @param {{value: string, label: string}[]} options
 */
export function chipRow(name, options, current, label) {
  return html`<div class="chip-row" data-filter="${name}" aria-label="${label}">${options.map((o) => html`<button type="button" class="chip" data-value="${o.value}" aria-pressed="${String(o.value === current)}">${o.label}</button>`)}</div>`;
}

export function cicloChips(current, t) {
  return chipRow('ciclo', [
    { value: 'TODOS', label: t('filter_all', 'Todos') },
    { value: 'ESO', label: t('filter_eso', 'ESO') },
    { value: 'BCH', label: t('filter_bch', 'BCH') },
  ], normCiclo(current), t('filter_ciclo_label', 'Filtrar por ciclo'));
}

/**
 * Selector nativo de un filtro con muchas opciones (p. ej. cursos): en móvil abre el selector del sistema
 * en vez de una tira larga de chips. bindFilters lo cablea -> setState({[name]: value}).
 * @param {string} name clave del estado
 * @param {{label?: string, options: {value: string, label: string}[]}[]} groups un grupo sin label va sin <optgroup>
 */
export function filterSelect(name, groups, current, label) {
  const opt = (o) => html`<option value="${o.value}"${o.value === current ? html` selected` : ''}>${o.label}</option>`;
  return html`<label class="filter-select"><span class="filter-select__label">${label}</span><select class="filter-select__input${current && current !== 'TODOS' ? ' is-active' : ''}" data-filter-select="${name}">${
    groups.map((g) => (g.label ? html`<optgroup label="${g.label}">${g.options.map(opt)}</optgroup>` : g.options.map(opt)))
  }</select></label>`;
}

export function emptyState(t, [titleKey, titleFb], [descKey, descFb] = []) {
  return html`<div class="empty-state reveal">
    <span class="empty-state__icon" aria-hidden="true">⚽</span>
    <p class="empty-state__title">${t(titleKey, titleFb)}</p>
    ${descKey ? html`<p class="empty-state__text">${t(descKey, descFb)}</p>` : ''}
  </div>`;
}

// ---- foco: el orquestador re-renderiza la sección entera en cada setState; recordamos qué control
// tenía el foco (por selector estable) y bind lo devuelve al nuevo nodo equivalente.
const pendingFocus = new Map();

/** Guarda el control a reenfocar tras el próximo render de la sección `id`. */
export function rememberFocus(id, selector) { pendingFocus.set(id, selector); }

export function restoreFocus(root, id) {
  const sel = pendingFocus.get(id);
  if (!sel) return;
  pendingFocus.delete(id);
  let el = root.querySelector(sel);
  if (el?.disabled) el = el.closest('[data-focus-group]')?.querySelector('button:not([disabled])') ?? null;
  el?.focus({ preventScroll: true });
}

const escAttr = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));

/**
 * Cablea todas las filas [data-filter] (chips) y los select[data-filter-select] de la sección. Al cambiar, recuerda el chip pulsado para
 * devolverle el foco tras el re-render y llama a setState({[filtro]: valor, ...extra(filtro, valor)}).
 */
export function bindFilters(root, ctx, id, extra = () => ({})) {
  root.querySelectorAll('[data-filter]').forEach((row) => {
    const name = row.dataset.filter;
    createTabs(row, (value) => {
      rememberFocus(id, `[data-filter="${escAttr(name)}"] [data-value="${escAttr(value)}"]`);
      ctx.setState({ [name]: value, ...extra(name, value) });
    });
  });
  root.querySelectorAll('select[data-filter-select]').forEach((sel) => {
    const name = sel.dataset.filterSelect;
    sel.addEventListener('change', () => {
      rememberFocus(id, `select[data-filter-select="${escAttr(name)}"]`);
      ctx.setState({ [name]: sel.value, ...extra(name, sel.value) });
    });
  });
}

/** bind común: filtros, toggles de goles, escudos rotos y foco pendiente. */
export function bindCommon(root, ctx, id, extra) {
  if (!root) return;
  bindFilters(root, ctx, id, extra);
  bindGoalToggles(root);
  bindCrests(root);
  restoreFocus(root, id);
}
