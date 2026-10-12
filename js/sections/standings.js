// Piezas compartidas por Clasificación y Clasificación grupal: orden puro de la tabla, escudo por nombre
// de equipo y la tabla de posiciones (una sola marca: tabla real en PC, tarjetas por equipo en móvil vía CSS).
import { html } from '../core/dom.js';
import { crest } from '../ui/matchCard.js';

/** @typedef {import('../data/models.js').FilaTabla} FilaTabla */
/** @typedef {import('../data/models.js').Equipo} Equipo */

const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const n0 = (v) => (Number.isFinite(v) ? v : 0);
const byName = new Intl.Collator('es', { sensitivity: 'base' });

/** total desc., luego dg desc., luego gf desc., luego nombre (alfabético, sin distinguir acentos/mayúsculas). */
export function compareStandings(a, b) {
  return n0(b.total) - n0(a.total)
    || n0(b.dg) - n0(a.dg)
    || n0(b.gf) - n0(a.gf)
    || byName.compare(String(a.equipo ?? ''), String(b.equipo ?? ''));
}

/** Copia ordenada (no muta la entrada). @param {FilaTabla[]|undefined} rows @returns {FilaTabla[]} */
export function sortStandings(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => r && String(r.equipo ?? '').trim()).slice().sort(compareStandings);
}

/** Logo del equipo por nombre (FilaTabla no trae logo): mapa nombre normalizado -> logo de EQUIPOS. */
export function logoLookup(equipos) {
  const map = new Map();
  for (const e of Array.isArray(equipos) ? equipos : []) {
    if (!e) continue;
    for (const k of [fold(e.equipo), fold(e.curso)]) if (k && !map.has(k)) map.set(k, e.logo ?? '');
  }
  return (name) => map.get(fold(name)) ?? '';
}

const signed = (v) => (n0(v) > 0 ? `+${n0(v)}` : String(n0(v)));
const MEDALS = ['gold', 'silver', 'bronze'];

/** Columnas de estadística: [clave de fila, clave de traducción, abreviatura, descripción, clase extra]. */
const COLS = [
  ['pj', 'table_played', 'PJ', 'Partidos jugados', ''],
  ['g', 'table_won', 'PG', 'Partidos ganados', ''],
  ['e', 'table_drawn', 'PE', 'Partidos empatados', ''],
  ['p', 'table_lost', 'PP', 'Partidos perdidos', ''],
  ['gf', 'table_goals_for', 'GF', 'Goles a favor', ''],
  ['gc', 'table_goals_against', 'GC', 'Goles en contra', ''],
  ['dg', 'table_goals_diff', 'DG', 'Diferencia de goles', ''],
  ['puntos', 'table_points', 'PTS', 'Puntos', ' st--wide'],
  ['fairplay', 'table_fair_play', 'FPY', 'Juego limpio', ' st--wide'],
];

/**
 * Tabla de posiciones de un bloque (un ciclo o un grupo). `rows` ya ordenadas.
 * @param {FilaTabla[]} rows @param {(k: string, f?: string) => string} t
 * @param {{caption: unknown, logoOf: (name: string) => string}} o
 */
export function standingsTable(rows, t, { caption, logoOf }) {
  const abbr = COLS.map(([, key, fb]) => t(key, fb));
  const desc = COLS.map(([, key, , d]) => t(`${key}_description`, d));
  const totalLbl = t('table_total', 'Total');
  const ptsShort = t('table_points_short', 'pts');
  return html`<table role="table" class="standings">
    <caption class="sr-only">${caption}</caption>
    <thead role="rowgroup"><tr role="row">
      <th role="columnheader" scope="col" class="st-pos"><abbr title="${t('table_position_description', 'Posición')}">${t('table_position', 'Pos')}</abbr></th>
      <th role="columnheader" scope="col" class="st-team">${t('table_team', 'Equipo')}</th>
      ${COLS.map(([, , , , cls], i) => html`<th role="columnheader" scope="col" class="st${cls}"><abbr title="${desc[i]}">${abbr[i]}</abbr></th>`)}
      <th role="columnheader" scope="col" class="st-total">${totalLbl}</th>
    </tr></thead>
    <tbody role="rowgroup">${rows.map((r, i) => {
      const pos = i + 1;
      const medal = MEDALS[i] ?? '';
      const vals = { ...r, pj: n0(r.g) + n0(r.e) + n0(r.p), dg: signed(r.dg) };
      return html`<tr role="row" class="standings__row reveal${medal ? ` is-${medal}` : ''}" style="--i:${Math.min(i, 8)}">
        <td role="cell" class="st-pos"><span class="pos${medal ? ` pos--${medal}` : ''}">${pos}</span></td>
        <th role="rowheader" scope="row" class="st-team"><span class="st-team__inner">${crest(r.equipo, logoOf(r.equipo), { size: 'sm' })}<span class="st-team__text"><span class="st-team__name">${r.equipo}</span><span class="st-team__meta">${n0(r.puntos)} ${ptsShort} · ${abbr[8]} ${n0(r.fairplay)}</span></span></span></th>
        ${COLS.map(([k, , , , cls], j) => html`<td role="cell" class="st${cls}${k === 'dg' ? ' st--dg' : ''}" data-label="${abbr[j]}"><span class="num">${vals[k] ?? 0}</span></td>`)}
        <td role="cell" class="st-total" data-label="${totalLbl}"><span class="num">${n0(r.total)}</span></td>
      </tr>`;
    })}</tbody>
  </table>`;
}

/** Leyenda de abreviaturas (portada de tablaClasificacionGrupal). */
export function standingsLegend(t) {
  const items = [['table_position', 'Pos', 'Posición'], ...COLS.map(([, key, fb, d]) => [key, fb, d])];
  return html`<dl class="standings-legend">
    ${items.map(([key, fb, d]) => html`<div><dt>${t(key, fb)}</dt><dd>${t(`${key}_description`, d)}</dd></div>`)}
    <div><dt>${t('table_total', 'Total')}</dt><dd>${t('table_total_description', 'PTS + GF + DG + FPY')}</dd></div>
  </dl>`;
}
