// Piezas comunes de Noticias y Galería: filas publicadas (PUBLICAR = SI, la misma regla que
// visibility.js), agrupación por día y la barra «día anterior / siguiente» (mismo marcado .daynav que
// Próximos partidos, pero de un día cada vez).
import { html } from '../core/dom.js';
import { groupByDay, windowStart, stepDay, canStep, formatDay, dayKey, parseDMY } from './dates.js';
import { rememberFocus } from './common.js';

const upper = (v) => String(v ?? '').trim().toUpperCase();

/** Solo filas con PUBLICAR = SI (sin distinguir mayúsculas). */
export const publicados = (list) => (Array.isArray(list) ? list : []).filter((x) => x && upper(x.publicar) === 'SI');

/**
 * Etiqueta del día de una fila (FECHA dd/mm/aaaa) en formato largo y localizado; si no es una fecha
 * válida devuelve el texto original recortado.
 * @param {unknown} fecha @param {string} locale @returns {string}
 */
export function feedDateLabel(fecha, locale) {
  const k = dayKey(parseDMY(fecha));
  return k === null ? String(fecha ?? '').trim() : formatDay(k, locale, 'full');
}

/** Publicados agrupados por FECHA. */
export const feedGroup = (list) => groupByDay(publicados(list), (x) => x.fecha);

/** Día visible: el del estado (ajustado a un día con elementos) o, sin estado, el más reciente. */
export function feedDay(group, dia) {
  const days = group?.days ?? [];
  if (!days.length) return null;
  return typeof dia === 'number' && Number.isFinite(dia) ? windowStart(days, dia) : days[days.length - 1];
}

/** Día al que lleva un paso `dir` (−1 más antiguo, +1 más reciente); null sin días. */
export function feedStep(group, dia, dir) {
  const days = group?.days ?? [];
  return days.length ? stepDay(days, feedDay(group, dia), dir) : null;
}

const ARROW = {
  '-1': html`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  1: html`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/** Barra de navegación por día; vacía si hay menos de dos días (no hay adónde ir). */
export function dayNav(group, day, t, caption) {
  const days = group?.days ?? [];
  if (days.length < 2 || day === null) return '';
  const btn = (dir, key, fb) => html`<button type="button" class="daynav__btn" data-day-step="${dir}" aria-label="${t(key, fb)}"${canStep(days, day, dir, 1) ? '' : html` disabled`}>${ARROW[dir]}</button>`;
  return html`<div class="daynav reveal" data-focus-group>
    ${btn(-1, 'day_prev', 'Día anterior')}
    <p class="daynav__label" aria-live="polite"><span class="daynav__caption">${caption}</span><span class="daynav__range">${formatDay(day, t('date_locale', 'es-ES'), 'full')}</span></p>
    ${btn(1, 'day_next', 'Día siguiente')}
  </div>`;
}

/** Cablea los botones de dayNav: setState({dia}) y devuelve el foco al botón tras el re-render. */
export function bindDayNav(root, ctx, id, group) {
  root.querySelectorAll('button[data-day-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.dataset.dayStep);
      rememberFocus(id, `button[data-day-step="${dir}"]`);
      ctx.setState({ dia: feedStep(group, ctx.state?.dia, dir) });
    });
  });
}
