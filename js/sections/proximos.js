// Próximos partidos: solo pendientes (ESTATUS ≠ JUGADO) con ambos equipos, agrupados por día, con
// navegación anterior/siguiente que salta los días sin partidos (portado de main.js:
// encontrarDiasRelevantes + renderProximosPartidos). Como en el sitio antiguo, no se filtra por ciclo.
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { matchCard } from '../ui/matchCard.js';
import { dayKey, matchDays, pickInitialDay, windowStart, dayWindow, stepDay, canStep, formatDay, formatDayRange } from './dates.js';
import { sectionTitle, emptyState, chrono, bindCommon, rememberFocus } from './common.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */

export const id = 'proximosPartidos';
const WINDOW = 2; // días con partidos visibles a la vez (el sitio antiguo mostraba «hoy y el siguiente»)

const named = (l) => String(l?.equipo ?? '').trim() !== '';
/** Partidos pendientes con ambos equipos definidos. */
export const pendientes = (model) =>
  (model?.partidos ?? []).filter((p) => p && p.estatus !== 'JUGADO' && named(p.local) && named(p.visitante));

/** @param {AppModel} model */
export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/**
 * @param {AppModel} model
 * @param {Date} [today] inyectable para tests/demo
 * @returns {{dia: number|null, hoy: number|null}}
 */
export function initialState(model, today = new Date()) {
  return { dia: pickInitialDay(matchDays(pendientes(model)), today), hoy: dayKey(today) };
}

const TITLE = [['section_next_matches_title', 'Próximos partidos'], ['section_next_matches_kicker', 'Agenda']];

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const list = pendientes(model).sort(chrono);
  if (!list.length) {
    return html`${title}${emptyState(t, ['msg_no_matches', 'No hay partidos programados'], ['msg_no_matches_description', 'Los partidos se mostrarán automáticamente cuando estén programados.'])}`;
  }
  const locale = t('date_locale', 'es-ES');
  const days = matchDays(list);
  const start = windowStart(days, state?.dia);
  const visible = dayWindow(days, start, WINDOW);
  const sinFecha = list.filter((p) => dayKey(p.fecha) === null);
  // «Próximo partido»: el primero pendiente desde hoy (si el estado sabe qué día es hoy).
  const hoy = typeof state?.hoy === 'number' ? state.hoy : null;
  const next = hoy === null ? null : list.find((p) => (dayKey(p.fecha) ?? -1) >= hoy);
  let i = 0;
  const card = (p) => {
    const isNext = next && p.key === next.key;
    return matchCard(p, undefined, t, {
      idPrefix: id, index: i++, locale, alert: !!isNext, showDate: false, // la fecha ya está en el título del día
      tag: isNext ? t('next_match_tag', 'Próximo partido') : '',
    });
  };

  const nav = days.length
    ? html`<div class="daynav reveal" data-focus-group>
        <button type="button" class="daynav__btn" data-day-step="-1" aria-label="${t('day_prev', 'Día anterior')}"${canStep(days, start, -1, WINDOW) ? '' : html` disabled`}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <p class="daynav__label" aria-live="polite"><span class="daynav__caption">${t('days_label', 'Días de partido')}</span><span class="daynav__range">${formatDayRange(visible, locale)}</span></p>
        <button type="button" class="daynav__btn" data-day-step="1" aria-label="${t('day_next', 'Día siguiente')}"${canStep(days, start, 1, WINDOW) ? '' : html` disabled`}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`
    : '';

  const dayBlock = (k) => {
    const del = list.filter((p) => dayKey(p.fecha) === k);
    return html`<div class="day">
      <h3 class="day__title reveal"><span class="day__dot" aria-hidden="true"></span>${formatDay(k, locale, 'long')}</h3>
      <div class="match-grid">${del.map(card)}</div>
    </div>`;
  };

  return html`${title}${nav}
    <div class="days">${visible.map(dayBlock)}${sinFecha.length ? html`<div class="day">
      <h3 class="day__title reveal"><span class="day__dot" aria-hidden="true"></span>${t('date_to_confirm', 'Fecha por confirmar')}</h3>
      <div class="match-grid">${sinFecha.map(card)}</div></div>` : ''}</div>`;
}

/** @param {Element} root @param {{model: AppModel, state: any, setState: (patch: object) => void, t: Function}} ctx */
export function bind(root, ctx) {
  if (!root) return;
  const days = matchDays(pendientes(ctx.model));
  root.querySelectorAll('button[data-day-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.dataset.dayStep);
      rememberFocus(id, `button[data-day-step="${dir}"]`);
      ctx.setState({ dia: stepDay(days, windowStart(days, ctx.state?.dia), dir) });
    });
  });
  bindCommon(root, ctx, id);
}
