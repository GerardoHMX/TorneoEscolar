// Bracket: cuadro de eliminatorias (cuartos -> semifinal -> final y tercer puesto). Porta renderBracket
// (js/ui.js). ESO a la izquierda, BCH a la derecha (espejo) y en el centro la FINAL y el TERCER PUESTO,
// que son inter-ciclo (R11). El orden del DOM es el de lectura en móvil (rondas apiladas en vertical);
// en PC las columnas se recolocan con grid-column y se unen con conectores CSS.
// Quién avanza: marcador; si la eliminatoria acaba igualada decide `Partido.pasa` (matchOutcome).
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { crest, phaseLabel, matchOutcome } from '../ui/matchCard.js';
import { formatDay, dayKey } from './dates.js';
import { sectionTitle, emptyState, bindCommon } from './common.js';

/** @typedef {import('../data/models.js').Partido} Partido */

export const id = 'bracket';

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** El cuadro no tiene filtros: se ve entero. */
export function initialState() {
  return {};
}

const TITLE = [['section_bracket_title', 'Cuadro final'], ['section_bracket_kicker', 'Camino al título']];
const ROUNDS = ['CUARTOS', 'SEMIFINAL'];
const named = (lado) => String(lado?.equipo ?? '').trim() !== '';

function teamRow(lado, outcome, advances, t) {
  const has = named(lado);
  const name = has ? lado.equipo : t('to_define', 'Por definir');
  const score = typeof lado?.score === 'number' ? lado.score : '';
  return html`<li class="bt__team${outcome ? ` is-${outcome}` : ''}${has ? '' : ' is-tbd'}">
    ${crest(name, has ? lado.logo : '', { size: 'sm' })}
    <span class="bt__name">${name}</span>
    ${advances ? html`<span class="bt__pasa">${t('bracket_advances', 'Pasa')}</span>` : ''}
    <span class="bt__score num">${score}</span>
  </li>`;
}

/** Tarjeta compacta de una eliminatoria. */
function tile(p, t, locale, i, extra = '') {
  const { local, visit, pasaName } = matchOutcome(p);
  const played = p.estatus === 'JUGADO';
  const fecha = dayKey(p.fecha) !== null ? p.fecha : null;
  const hora = String(p.hora ?? '').trim();
  // «Pasa» solo cuando lo decide la hoja (empate en el marcador) y coincide con un equipo
  const pasaL = !!pasaName && local === 'win';
  const pasaV = !!pasaName && visit === 'win';
  const when = fecha ? html`<time datetime="${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}">${formatDay(fecha.getTime(), locale, 'card')}</time>${!played && hora ? html` · ${hora}` : ''}` : '';
  const label = html`${phaseLabel(p, t)}${p.ciclo && !p.interciclo ? html` · ${p.ciclo}` : ''}`;
  return html`<article class="bt reveal${played ? ' is-played' : ' is-pending'}${extra}" data-match="${p.key}" style="--i:${Math.min(i, 8)}" aria-label="${label}">
    <header class="bt__meta"><span class="bt__phase">${label}</span>${when ? html`<span class="bt__when">${when}</span>` : ''}</header>
    <ol class="bt__teams">${teamRow(p.local, local, pasaL, t)}${teamRow(p.visitante, visit, pasaV, t)}</ol>
  </article>`;
}

/** Agrupa en parejas: cada pareja alimenta un partido de la ronda siguiente (conector en PC). */
const pairs = (xs) => xs.reduce((acc, x, i) => (i % 2 ? acc[acc.length - 1].push(x) : acc.push([x]), acc), []);

export function render(model, _state, t) {
  const title = sectionTitle(t, ...TITLE);
  if (!hasData(model)) {
    return html`${title}${emptyState(t, ['msg_no_bracket', 'El cuadro final aún no está definido'], ['msg_no_bracket_description', 'Aparecerá cuando se conozcan los cruces de cuartos de final.'])}`;
  }
  const locale = t('date_locale', 'es-ES');
  const elim = (model.partidos ?? []).filter((p) => p && (ROUNDS.includes(p.ronda) || p.interciclo || p.ronda === 'FINAL' || p.ronda === 'TERCERPUESTO'));
  const byN = (a, b) => a.n - b.n;
  const sideOf = (p) => (p.ciclo === 'BCH' ? 'r' : 'l');
  const rounds = ROUNDS.filter((r) => elim.some((p) => p.ronda === r && !p.interciclo));
  const depth = rounds.length; // columnas por lado
  const cols = depth * 2 + 1;
  const sideCiclo = (s) => {
    const c = elim.find((p) => !p.interciclo && sideOf(p) === s)?.ciclo;
    return c || (s === 'r' ? 'BCH' : 'ESO');
  };

  const final = elim.filter((p) => p.ronda === 'FINAL').sort(byN);
  const tercero = elim.filter((p) => p.ronda === 'TERCERPUESTO').sort(byN);
  const hasFinal = final.length > 0;
  let k = 0;
  const columns = [];
  rounds.forEach((r, ri) => {
    for (const s of ['l', 'r']) {
      const ps = elim.filter((p) => p.ronda === r && !p.interciclo && sideOf(p) === s).sort(byN);
      if (!ps.length) continue;
      const col = s === 'l' ? ri + 1 : cols - ri; // PC: izquierda de fuera hacia dentro; derecha en espejo
      const last = ri === depth - 1;
      columns.push(html`<div class="bracket__col bracket__col--${s}${ri ? ' is-feed' : ''}${last && hasFinal ? ' is-last' : ''}" style="--col:${col}">
        <h3 class="bracket__head"><span class="bracket__round">${phaseLabel({ ronda: r }, t)}</span><span class="cycle-block__badge">${sideCiclo(s)}</span></h3>
        <ol class="bracket__stack">${pairs(ps).map((pair) => html`<li class="bracket__pair${pair.length > 1 ? ' is-pair' : ''}">${pair.map((p) => tile(p, t, locale, k++))}</li>`)}</ol>
      </div>`);
    }
  });

  if (final.length || tercero.length) {
    columns.push(html`<div class="bracket__col bracket__col--c${depth ? '' : ' is-solo'}" style="--col:${depth + 1}">
      <h3 class="bracket__head bracket__head--final"><span class="bracket__trophy" aria-hidden="true">🏆</span><span class="bracket__round">${t('phase_final', 'Final')}</span><span class="cycle-block__badge cycle-block__badge--gold">ESO · BCH</span></h3>
      <div class="bracket__finals">
        <div class="bracket__final">${final.map((p) => tile(p, t, locale, k++, ' bt--final'))}</div>
        ${tercero.length ? html`<div class="bracket__third">${tercero.map((p) => tile(p, t, locale, k++, ' bt--third'))}</div>` : ''}
      </div>
    </div>`);
  }

  return html`${title}<div class="bracket" style="--cols:${cols}" data-depth="${depth}">${columns}</div>`;
}

export function bind(root, ctx) {
  bindCommon(root, ctx, id);
}
