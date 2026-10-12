// Tarjeta de partido (Próximos partidos, Jornadas, Resultados) con detalle de goles desplegable (spec §8.6).
// Todo el texto y las URLs pasan por la plantilla `html` (escape) y por driveImg/safeUrl.
import { html } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { formatDay, dayKey } from '../sections/dates.js';

/**
 * @typedef {import('../data/models.js').Partido} Partido
 * @typedef {import('../data/goals.js').MatchGoals} MatchGoals
 * @typedef {(key: string, fallback?: string) => string} T
 */

/** {base:45, extra:2} -> "45+2'"; null -> "". */
export function formatMinute(m) {
  if (!m) return '';
  return m.extra ? `${m.base}+${m.extra}'` : `${m.base}'`;
}

/** Iniciales para el escudo de reserva: «Rayo de Málaga» -> «RM». */
export function initials(name) {
  const words = String(name ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 || /\p{N}/u.test(w));
  const pick = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2);
  return pick.toUpperCase() || '?';
}

/**
 * Escudo: logo (Drive/https) sobre un monograma de reserva. Si la URL no es segura no hay <img>;
 * si la imagen falla, bindCrests la oculta y queda el monograma.
 * @param {string} name @param {string} logo @param {{size?: 'sm'|'md'|'lg'}} [o]
 */
export function crest(name, logo, { size = 'md' } = {}) {
  // Miniatura de Drive a 240px (≥ 2× el escudo más grande, 100px; driveImg pide w2000: excesivo para un escudo).
  const src = driveImg(logo).replace(/^(https:\/\/drive\.google\.com\/thumbnail\?[^#]*[?&]sz=)w\d+/, '$1w240');
  return html`<span class="crest crest--${size}"><span class="crest__mono" aria-hidden="true">${initials(name)}</span>${
    src ? html`<img class="crest__img" src="${src}" alt="" loading="lazy" decoding="async" width="96" height="96">` : ''
  }</span>`;
}

/** Etiqueta de fase: «Grupo A», «Cuartos de final», «Semifinal», «Tercer puesto», «Final». */
export function phaseLabel(p, t) {
  switch (p?.ronda) {
    case 'CUARTOS': return t('phase_quarters', 'Cuartos de final');
    case 'SEMIFINAL': return t('phase_semifinal', 'Semifinal');
    case 'TERCERPUESTO': return t('phase_third', 'Tercer puesto');
    case 'FINAL': return t('phase_final', 'Final');
    default: return p?.grupo ? `${t('group', 'Grupo')} ${p.grupo}` : t('table_group_phase', 'Fase de grupos');
  }
}

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const named = (lado) => String(lado?.equipo ?? '').trim() !== '';
const order = (gol) => (gol.minuto ? gol.minuto.base + gol.minuto.extra : Infinity);

function team(lado, side, outcome, t) {
  const name = named(lado) ? lado.equipo : t('to_define', 'Por definir');
  return html`<div class="match__team match__team--${side}${outcome ? ` is-${outcome}` : ''}">
    ${crest(name, lado?.logo)}
    <span class="match__name">${name}</span>
  </div>`;
}

const ELIM = ['CUARTOS', 'SEMIFINAL', 'TERCERPUESTO', 'FINAL'];
const fold = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Eliminatoria terminada en empate: el que avanza lo dice `pasa` (PASAN/GANA de la hoja).
 * Devuelve 'local' | 'visit' | '' (sin `pasa` o sin coincidencia: no se inventa ganador).
 */
function advancingSide(p) {
  const pasa = fold(p?.pasa);
  if (!pasa) return '';
  if (fold(p.local?.equipo) === pasa) return 'local';
  if (fold(p.visitante?.equipo) === pasa) return 'visit';
  return '';
}

function outcomeOf(lado, other, played) {
  if (!played) return '';
  if (lado?.res === 'G') return 'win';
  if (lado?.res === 'P') return 'loss';
  if (lado?.res === 'E') return 'draw';
  if (typeof lado?.score === 'number' && typeof other?.score === 'number') {
    return lado.score > other.score ? 'win' : lado.score < other.score ? 'loss' : 'draw';
  }
  return '';
}

/**
 * Resultado de cada lado ('win'|'loss'|'draw'|'') y nombre de quien pasa. En eliminatoria igualada en el
 * marcador decide `pasa` (si coincide con un equipo); con marcador distinto manda el marcador.
 * Compartido por la tarjeta de partido y el bracket (Task 10).
 * @param {Partido} p @returns {{local: string, visit: string, pasaName: string}}
 */
export function matchOutcome(p) {
  const played = p?.estatus === 'JUGADO';
  let local = outcomeOf(p?.local, p?.visitante, played);
  let visit = outcomeOf(p?.visitante, p?.local, played);
  const elimDraw = played && ELIM.includes(p.ronda) && typeof p.local?.score === 'number' && p.local.score === p.visitante?.score;
  const pasaName = elimDraw ? String(p.pasa ?? '').trim() : '';
  if (pasaName) {
    const side = advancingSide(p);
    if (side) { local = side === 'local' ? 'win' : 'loss'; visit = side === 'visit' ? 'win' : 'loss'; }
  }
  return { local, visit, pasaName };
}

/** Goles de ambos equipos en una sola cronología; los que no tienen minuto, al final (orden estable). */
function timeline(p, g) {
  const all = [
    ...(g.local ?? []).map((gol) => ({ gol, side: 'local', lado: p.local })),
    ...(g.visitante ?? []).map((gol) => ({ gol, side: 'visit', lado: p.visitante })),
  ];
  return all
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => order(a.gol) - order(b.gol) || a.i - b.i);
}

function goalItem({ gol, side, lado }, t) {
  const minute = formatMinute(gol.minuto);
  const kind = gol.tipo === 'PENAL' ? t('goal_penalty_short', '(P)') : gol.tipo === 'PROPIA' ? t('goal_own_short', '(p.p.)') : '';
  const name = String(gol.jugador ?? '').trim() || t('goal_unknown_player', 'Sin autor');
  return html`<li class="goal goal--${side}"><span class="goal__body">${
    minute ? html`<span class="goal__min num">${minute}</span> ` : ''
  }<span class="goal__ball" aria-hidden="true">⚽</span> <span class="goal__name">${name}</span>${
    kind ? html` <span class="goal__kind">${kind}</span>` : ''
  }<span class="goal__team"> · ${lado?.equipo ?? ''}</span></span></li>`;
}

/**
 * @param {Partido} p
 * @param {MatchGoals|undefined} g
 * @param {T} t
 * @param {{idPrefix?: string, index?: number, tag?: unknown, alert?: boolean, locale?: string, showDate?: boolean}} [opts]
 *   idPrefix: evita ids repetidos si el mismo partido aparece en dos secciones; index: escalonado (--i);
 *   tag: etiqueta extra (p. ej. «Próximo partido»); alert: variante .card--alert.
 */
export function matchCard(p, g, t, opts = {}) {
  const { idPrefix = 'm', index = 0, tag = '', alert = false, locale = t('date_locale', 'es-ES'), showDate = true } = opts;
  const played = p.estatus === 'JUGADO';
  const fecha = dayKey(p.fecha) !== null ? p.fecha : null;
  const cicloTxt = p.interciclo || !p.ciclo ? '' : `${p.ciclo} · `;
  const total = g?.total ?? 0;
  const panelId = `${idPrefix}-goles-${p.key}`;
  const hora = String(p.hora ?? '').trim();
  const scoreTxt = (v) => (typeof v === 'number' ? v : '–');
  const sum = (p.local?.score ?? 0) + (p.visitante?.score ?? 0);
  // Eliminatoria igualada en el marcador: mostrar quién pasa (si la hoja lo dice); el marcador manda si no hay empate.
  const { local: outLocal, visit: outVisit, pasaName } = matchOutcome(p);
  const [advA, advB = ''] = t('match_advances', 'Pasa: {team}').split('{team}');

  const center = played
    ? html`<p class="match__score num" aria-label="${scoreTxt(p.local?.score)} – ${scoreTxt(p.visitante?.score)}"><span>${scoreTxt(p.local?.score)}</span><span class="match__sep" aria-hidden="true">–</span><span>${scoreTxt(p.visitante?.score)}</span></p>`
    : html`<p class="match__vs"><span class="match__hour num">${hora || t('hour_to_confirm_short', '--:--')}</span><span class="match__vs-label">vs</span></p>`;

  const goalsBlock = total > 0
    ? html`<button type="button" class="goals-toggle" aria-expanded="false" aria-controls="${panelId}">
        <span class="goals-toggle__ball" aria-hidden="true">⚽</span> ${t('goals_button', 'Goles')} (${total})
        <svg class="goals-toggle__chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="goals-panel" id="${panelId}" inert>
        <div class="goals-panel__inner">
          <div class="goals-head" aria-hidden="true"><span>${p.local?.equipo ?? ''}</span><span>${p.visitante?.equipo ?? ''}</span></div>
          <ol class="goals" aria-label="${t('goals_timeline', 'Cronología de goles')}">${timeline(p, g).map((x) => goalItem(x, t))}</ol>
          ${g.parcial ? html`<p class="partial">${t('goals_partial', 'Detalle parcial')} · ${total}/${sum} ${t('goals_partial_registered', 'goles registrados')}</p>` : ''}
        </div>
      </div>`
    : '';

  return html`<article class="match card reveal${alert ? ' card--alert match--next' : ''}${played ? ' is-played' : ' is-pending'}" data-match="${p.key}" style="--i:${Math.min(Math.max(index, 0), 8)}">
    <header class="match__meta">
      <span class="match__tags"><span class="tag">${cicloTxt}${phaseLabel(p, t)}</span>${tag ? html`<span class="tag tag--red">${tag}</span>` : ''}</span>
      ${showDate && fecha ? html`<span class="match__when"><time datetime="${isoDay(fecha)}">${formatDay(fecha.getTime(), locale, 'card')}</time>${played && hora ? html` · ${hora}` : ''}</span>` : ''}
    </header>
    <div class="match__board">
      ${team(p.local, 'local', outLocal, t)}
      ${center}
      ${team(p.visitante, 'visit', outVisit, t)}
    </div>
    ${pasaName ? html`<p class="match__advances"><span class="match__advances-icon" aria-hidden="true">➜</span><span>${advA}${pasaName}${advB}</span></p>` : ''}
    ${goalsBlock}
  </article>`;
}

const toggled = new WeakSet();

/**
 * Despliegue animado del detalle de goles (CSS: grid-template-rows 0fr→1fr; reduced-motion lo hace
 * instantáneo vía base.css). Actualiza aria-expanded e `inert` del panel. Idempotente por botón.
 * @param {Element} root
 */
export function bindGoalToggles(root) {
  if (!root) return;
  root.querySelectorAll('button.goals-toggle[aria-controls]').forEach((btn) => {
    if (toggled.has(btn)) return;
    toggled.add(btn);
    btn.addEventListener('click', () => {
      const panel = btn.nextElementSibling?.classList.contains('goals-panel')
        ? btn.nextElementSibling
        : root.querySelector(`#${CSS.escape(btn.getAttribute('aria-controls'))}`);
      if (!panel) return;
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.toggleAttribute('inert', !open);
      btn.closest('.match')?.classList.toggle('is-open', open);
    });
  });
}

const crestRoots = new WeakSet();

/** Logos rotos: oculta la <img> y deja ver el monograma. Un único listener (captura) por raíz. */
export function bindCrests(root) {
  if (!root) return;
  // Sin comprobación previa de img.complete: con loading="lazy" una imagen aún no pedida no es «rota».
  // setHTML + bind van en la misma tarea, así que ningún evento `error` llega antes del listener.
  const broken = (img) => img.closest('.crest')?.classList.add('is-broken');
  if (crestRoots.has(root)) return;
  crestRoots.add(root);
  root.addEventListener('error', (ev) => {
    const el = ev.target;
    if (el instanceof Element && el.matches('img.crest__img')) broken(el);
  }, true);
}
