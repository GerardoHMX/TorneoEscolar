// Sancionados: acumulado de amonestaciones por jugador (SANCIONES). Porta tablaSancionados (js/ui.js):
// solo se publican las filas con CURSO y NOMBRE (lo pide la hoja), en el orden de la hoja; columnas
// equipo, curso, jugador, rojas, amarillas y la columna de suspensión (JUSTIFICACION tal cual, vacía -> 0).
// Filtros ciclo + curso como Goleadores. Móvil: tarjeta por jugador; PC: tabla con encabezado fijo.
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { crest } from '../ui/matchCard.js';
import { sectionTitle, emptyState, bindCommon } from './common.js';
import { applyFilters, rosterFilters, teamLogo, ciclosDe, cycleBlock, cursosDe as cursosRoster, filterPatch } from './roster.js';
import { cycleName } from './clasificacion.js';

/** @typedef {import('../data/models.js').Sancion} Sancion */

export { filterPatch };
export const id = 'sancionadosSection';

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** @returns {{ciclo: 'TODOS'|'ESO'|'BCH', curso: string}} */
export function initialState() {
  return { ciclo: 'TODOS', curso: 'TODOS' };
}

const txt = (v) => String(v ?? '').trim();
const n0 = (v) => (Number.isFinite(v) ? v : 0);

/** Filas publicables: con curso y jugador (mismo criterio que visibility.js). @param {Sancion[]|undefined} list */
export function publicables(list) {
  return (Array.isArray(list) ? list : []).filter((s) => s && txt(s.curso) && txt(s.jugador));
}

/** Cursos con sanciones publicables del ciclo. */
export const cursosDe = (list, ciclo) => cursosRoster(publicables(list), ciclo);

const TITLE = [['section_sanctioned_title', 'Sancionados'], ['section_sanctioned_kicker', 'Juego limpio']];
// La hoja trae 0 o vacío cuando no hay suspensión; cualquier otro valor se marca.
const flagged = (v) => !['', '0', 'NO'].includes(txt(v).toUpperCase());

function table(rows, c, { t, logoOf }) {
  const h = {
    player: t('table_player', 'Jugador'), team: t('table_team_name', 'Equipo'), course: t('table_course', 'Curso'),
    red: t('table_red_cards', 'Rojas'), yellow: t('table_yellow_cards', 'Amarillas'), susp: t('table_suspended', 'Suspendidos'),
  };
  return html`<table role="table" class="roster roster--sanctions">
    <caption class="sr-only">${t('section_sanctioned_title', 'Sancionados')} · ${cycleName(c, t)}</caption>
    <thead role="rowgroup"><tr role="row">
      <th role="columnheader" scope="col" class="ro-player">${h.player}</th>
      <th role="columnheader" scope="col" class="ro-team">${h.team}</th>
      <th role="columnheader" scope="col" class="ro-course">${h.course}</th>
      <th role="columnheader" scope="col" class="ro-stat"><span class="card-ico card-ico--red" aria-hidden="true"></span>${h.red}</th>
      <th role="columnheader" scope="col" class="ro-stat"><span class="card-ico card-ico--yellow" aria-hidden="true"></span>${h.yellow}</th>
      <th role="columnheader" scope="col" class="ro-stat">${h.susp}</th>
    </tr></thead>
    <tbody role="rowgroup">${rows.map((s, i) => {
      const rojas = n0(s.trojas);
      const amarillas = n0(s.tamarillas);
      const just = txt(s.justificacion) || '0';
      return html`<tr role="row" class="roster__row reveal${rojas > 0 ? ' has-red' : ''}" style="--i:${Math.min(i, 8)}">
        <th role="rowheader" scope="row" class="ro-player"><span class="ro-player__name">${s.jugador}</span><span class="ro-player__meta">${s.curso}</span></th>
        <td role="cell" class="ro-team"><span class="ro-team__inner">${crest(s.equipo, logoOf(s.equipoId, s.equipo), { size: 'sm' })}<span class="ro-team__name">${s.equipo || '-'}</span></span></td>
        <td role="cell" class="ro-course">${s.curso}</td>
        <td role="cell" class="ro-stat${rojas > 0 ? ' is-on' : ''}" data-stat="rojas" data-label="${h.red}"><span class="card-ico card-ico--red" aria-hidden="true"></span><span class="num">${rojas}</span></td>
        <td role="cell" class="ro-stat${amarillas > 0 ? ' is-on' : ''}" data-stat="amarillas" data-label="${h.yellow}"><span class="card-ico card-ico--yellow" aria-hidden="true"></span><span class="num">${amarillas}</span></td>
        <td role="cell" class="ro-stat ro-stat--susp${flagged(just) ? ' is-on' : ''}" data-stat="just" data-label="${h.susp}"><span class="num">${just}</span></td>
      </tr>`;
    })}</tbody>
  </table>`;
}

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  if (!hasData(model ?? {})) {
    return html`${title}${emptyState(t, ['msg_no_sanctions', 'Sin sanciones'], ['table_no_sanctions_play_clean', 'Todo en orden, ningún jugador ha sido sancionado hasta el momento.'])}`;
  }
  const list = publicables(model.sanciones);
  const f = applyFilters(list, state);
  const logoOf = teamLogo(model.equipos);
  const blocks = ciclosDe(f.ciclo).map((c) => {
    const rows = f.rows.filter((s) => s.ciclo === c);
    return rows.length ? cycleBlock(id, c, t, html`<div class="roster-wrap">${table(rows, c, { t, logoOf })}</div>`) : '';
  }).filter(Boolean);

  return html`${title}${rosterFilters(list, f, t)}
    <div class="cycles">${blocks.length ? blocks : emptyState(t, ['table_no_sanctions_play_clean', 'Todo en orden, ningún jugador ha sido sancionado hasta el momento.'])}</div>`;
}

export function bind(root, ctx) {
  bindCommon(root, ctx, id, filterPatch);
}
