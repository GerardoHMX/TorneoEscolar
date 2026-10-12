// Goleadores: ranking por ciclo desde model.scorers (scorersWithFallback: GOLES si hay, si no LIDERES).
// Porta tablaLideresGoleadores (js/ui.js): filtros ciclo + curso, los 3 primeros de cada ciclo en un podio
// animado (subida de escalones y contador de goles; avatares de OTROS por CICLO + POSICION con iniciales
// de reserva) y el resto del ranking debajo (tarjetas en móvil, tabla en PC). Empates: misma posición.
import { html } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { sectionVisibility } from '../core/visibility.js';
import { crest, initials } from '../ui/matchCard.js';
import { bindCountUps } from '../ui/countUp.js';
import { sectionTitle, emptyState, bindCommon, rememberFocus } from './common.js';
import { applyFilters, rosterFilters, teamLogo, ciclosDe, cycleBlock, cursosDe, filterPatch } from './roster.js';
import { cycleName } from './clasificacion.js';

/** @typedef {import('../data/models.js').Goleador} Goleador */
/** @typedef {Goleador & {pos: number}} Ranked */

export { cursosDe, filterPatch };
export const id = 'goleadoresSection';
export const LIMITE = 10; // filas bajo el podio antes de «Ver todos»

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** @returns {{ciclo: 'TODOS'|'ESO'|'BCH', curso: string}} (+ abiertos: string[] tras «Ver todos») */
export function initialState() {
  return { ciclo: 'TODOS', curso: 'TODOS' };
}

const n0 = (v) => (Number.isFinite(v) ? v : 0);
const byName = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * Ranking de competición: goles desc., luego nombre; mismos goles -> misma posición («1, 1, 3»).
 * Copia nueva (no muta la entrada); ignora entradas nulas.
 * @param {Goleador[]|undefined} list @returns {Ranked[]}
 */
export function rankWithTies(list) {
  const sorted = (Array.isArray(list) ? list : []).filter(Boolean)
    .map((x, i) => ({ x, i }))
    .sort((a, b) => n0(b.x.goles) - n0(a.x.goles) || byName.compare(String(a.x.jugador ?? ''), String(b.x.jugador ?? '')) || a.i - b.i)
    .map(({ x }) => x);
  let pos = 0;
  return sorted.map((x, i) => {
    if (i === 0 || n0(sorted[i - 1].goles) !== n0(x.goles)) pos = i + 1;
    return { ...x, pos };
  });
}

const TITLE = [['section_top_scorers_title', 'Goleadores'], ['section_top_scorers_kicker', 'La bota de oro']];
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const PLACE = {
  1: ['primer_puesto', 'Primer puesto'],
  2: ['segundo_puesto', 'Segundo puesto'],
  3: ['tercer_puesto', 'Tercer puesto'],
};
// retraso (ms) de cada escalón según su medalla: el contador arranca cuando el escalón ya ha subido
const DELAY = { gold: 360, silver: 180, bronze: 0 };

const golesLabel = (n, t) => (n === 1 ? t('goal_singular', 'gol') : t('goles_description', 'Goles').toLowerCase());

/** Avatar de OTROS (foto) sobre las iniciales del jugador; con marcado de .crest para que bindCrests oculte la foto rota. */
function avatar(name, url) {
  const src = driveImg(url).replace(/^(https:\/\/drive\.google\.com\/thumbnail\?[^#]*[?&]sz=)w\d+/, '$1w320');
  return html`<span class="crest crest--avatar"><span class="crest__mono" aria-hidden="true">${initials(name)}</span>${
    src ? html`<img class="crest__img" src="${src}" alt="" loading="lazy" decoding="async" width="160" height="160">` : ''
  }</span>`;
}

function podium(top, c, { t, logoOf, avatarOf }) {
  const places = top.map((g, i) => {
    const medal = MEDAL[g.pos] ?? 'bronze';
    const goles = n0(g.goles);
    const [k, fb] = PLACE[g.pos] ?? PLACE[3];
    return html`<li class="podium__place podium__place--${i + 1} is-${medal}" data-pos="${g.pos}">
      <div class="podium__team">
        <span class="scorer-avatar">${avatar(g.jugador, avatarOf(i + 1))}<span class="pos pos--${medal} scorer-avatar__pos" aria-hidden="true">${g.pos}</span></span>
        <span class="podium__label">${t(k, fb)}</span>
        <span class="podium__name">${g.jugador}</span>
        <span class="scorer-team">${crest(g.equipo, logoOf(g.equipoId, g.equipo), { size: 'sm' })}<span class="scorer-team__text"><span class="scorer-team__name">${g.equipo}</span>${g.curso ? html`<span class="scorer-team__course">${g.curso}</span>` : ''}</span></span>
        <span class="sr-only">${goles} ${golesLabel(goles, t)}</span>
      </div>
      <div class="podium__step" aria-hidden="true">
        <span class="podium__num num" data-count="${goles}" data-count-delay="${DELAY[medal] + 650}">${goles}</span>
        <span class="podium__unit">${golesLabel(goles, t)}</span>
      </div>
    </li>`;
  });
  return html`<div class="podium scorer-podium podium--n${top.length} reveal">
    <ol class="podium__places" aria-label="${t('scorers_podium_label', 'Podio de goleadores')} · ${cycleName(c, t)}">${places}</ol>
  </div>`;
}

function rankingTable(rows, c, { t, logoOf }) {
  const head = {
    pos: t('table_position', 'Pos'), player: t('table_player', 'Jugador'), team: t('table_team_name', 'Equipo'),
    course: t('table_course', 'Curso'), goals: t('table_goals', 'Goles'),
  };
  return html`<table role="table" class="roster roster--scorers">
    <caption class="sr-only">${t('section_top_scorers_title', 'Goleadores')} · ${cycleName(c, t)}</caption>
    <thead role="rowgroup"><tr role="row">
      <th role="columnheader" scope="col" class="ro-pos"><abbr title="${t('table_position_description', 'Posición')}">${head.pos}</abbr></th>
      <th role="columnheader" scope="col" class="ro-player">${head.player}</th>
      <th role="columnheader" scope="col" class="ro-team">${head.team}</th>
      <th role="columnheader" scope="col" class="ro-course">${head.course}</th>
      <th role="columnheader" scope="col" class="ro-num">${head.goals}</th>
    </tr></thead>
    <tbody role="rowgroup">${rows.map((g, i) => html`<tr role="row" class="roster__row reveal" data-pos="${g.pos}" style="--i:${Math.min(i, 8)}">
      <td role="cell" class="ro-pos"><span class="pos">${g.pos}</span></td>
      <th role="rowheader" scope="row" class="ro-player"><span class="ro-player__name">${g.jugador}</span>${g.curso ? html`<span class="ro-player__meta">${g.curso}</span>` : ''}</th>
      <td role="cell" class="ro-team"><span class="ro-team__inner">${crest(g.equipo, logoOf(g.equipoId, g.equipo), { size: 'sm' })}<span class="ro-team__name">${g.equipo}</span></span></td>
      <td role="cell" class="ro-course">${g.curso}</td>
      <td role="cell" class="ro-num" data-stat="goles"><span class="num">${n0(g.goles)}</span><span class="ro-num__unit">${golesLabel(n0(g.goles), t)}</span></td>
    </tr>`)}</tbody>
  </table>`;
}

export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  if (!hasData(model ?? {})) {
    return html`${title}${emptyState(t, ['msg_no_scorers', 'Aún no hay goleadores'], ['table_no_scorers_yet', 'Aún no hay partidos jugados, pronto conoceremos a los primeros líderes de goleo.'])}`;
  }
  const scorers = model.scorers;
  const f = applyFilters(scorers, state);
  const abiertos = Array.isArray(state?.abiertos) ? state.abiertos : [];
  const logoOf = teamLogo(model.equipos);
  const otros = Array.isArray(model.otros) ? model.otros : [];

  const blocks = ciclosDe(f.ciclo).map((c) => {
    const ranked = rankWithTies(f.rows.filter((g) => g.ciclo === c));
    if (!ranked.length) return '';
    // Avatar de OTROS por CICLO + POSICION del hueco del podio (1.º, 2.º, 3.º), como el legado.
    const avatarOf = (n) => otros.find((o) => o?.ciclo === c && o.posicion === n)?.avatarposiciones ?? '';
    const rest = ranked.slice(3);
    const open = abiertos.includes(c) || rest.length <= LIMITE + 2;
    const shown = open ? rest : rest.slice(0, LIMITE);
    return cycleBlock(id, c, t, html`${podium(ranked.slice(0, 3), c, { t, logoOf, avatarOf })}
      ${rest.length ? html`<div class="roster-wrap">${rankingTable(shown, c, { t, logoOf })}
        ${open ? '' : html`<div class="more-row"><button type="button" class="btn-ghost more-btn" data-expand="${c}">${t('results_show_all', 'Ver todos')} (${ranked.length})</button></div>`}</div>` : ''}`, ' scorers-block');
  }).filter(Boolean);

  return html`${title}${rosterFilters(scorers, f, t)}
    <div class="cycles">${blocks.length ? blocks : emptyState(t, ['table_no_scorers', 'No hay goleadores registrados para este curso.'])}</div>`;
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
  bindCommon(root, ctx, id, filterPatch);
  bindCountUps(root);
}
