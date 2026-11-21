// Pantalla del marcador para la TV (marcador.html).
//
// Qué partido se muestra:
//   marcador.html?partido=14  -> ese partido: previa si aún no empezó, en vivo, o final.
//   marcador.html             -> el que esté en juego (Firestore meta/actual); si no hay ninguno, o terminó
//                                hace más de 15 min, la pantalla «entre partidos» con el siguiente.
//   ?margen=5                 -> deja un 5 % de margen para televisores que recortan los bordes.
// Datos: hojas de Google Sheets (equipos, clasificación, goleadores, calendario; cada 60 s) y, si Firebase
// está configurado, el documento en vivo del partido (al instante). Sin Firebase: solo previa y final.
import { html, setHTML } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { initials } from '../ui/matchCard.js';
import { loadAll, onUpdate } from '../data/sheets.js';
import { buildModel } from '../data/buildModel.js';
import { liveSettings, penaltyState } from './rules.js';
import { calibrate, clockView, goalPosition, goalTime, mmss, serverNow } from './clock.js';
import * as C from './context.js';
import { firebaseEnabled, watchCurrent, watchMatch } from './firebase.js';

const FINAL_HOLD_MS = 15 * 60 * 1000;
const ROTATE_MS = 10000;
const LOGO = 'img/logo-torneo.webp';
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const params = new URLSearchParams(location.search);
const fixedN = /^\d+$/.test(params.get('partido') ?? '') ? Number(params.get('partido')) : null;
const margen = Number(params.get('margen'));
if (Number.isFinite(margen) && margen > 0 && margen <= 15) document.documentElement.style.setProperty('--safe', String(margen));

const stage = document.getElementById('stage');
setHTML(stage, html`<div class="board" id="board"></div><div class="fx goal" id="fxGoal"></div><div class="fx kick" id="fxKick"></div>`);
const board = document.getElementById('board');
const fxGoal = document.getElementById('fxGoal');
const fxKick = document.getElementById('fxKick');
const statusEl = document.getElementById('status');

let model = buildModel({});
let loaded = false;
let currentN = fixedN;
let doc = null;
let docN = null;
let firstSnap = true;
let unsubMatch = null;
let rot = 0;
let view = { kind: 'idle', p: null };
let busy = false;
const queue = [];

// ------------------------------------------------------------------ piezas

function crest(team) {
  const src = driveImg(team.logo).replace(/^(https:\/\/drive\.google\.com\/thumbnail\?[^#]*[?&]sz=)w\d+/, '$1w480');
  return html`<span class="tc"><span class="tc__mono" aria-hidden="true">${initials(team.nombre)}</span>${src ? html`<img src="${src}" alt="" decoding="async">` : ''}</span>`;
}
stage.addEventListener('error', (ev) => {
  const el = ev.target;
  if (el instanceof HTMLImageElement) el.closest('.tc')?.classList.add('is-broken');
}, true);

const tbl = (title, head, rows, em = '') => (rows.length
  ? html`<h3>${title}${em ? html` <em>${em}</em>` : ''}</h3><table><thead><tr>${head.map(([h, c]) => html`<th class="${c ?? ''}">${h}</th>`)}</tr></thead><tbody>${rows}</tbody></table>`
  : null);

const settings = () => ({ ...liveSettings(model.config), ...(doc?.ajustes ?? {}) });
const isLive = () => !!doc && doc.estado !== 'FINAL';

function winnerText(p, g) {
  if (doc) {
    const name = doc.ganador ? C.teamView(model, p[doc.ganador]).nombre : '';
    const pens = (doc.tanda ?? []).length > 0;
    return name ? `Gana ${name}${pens ? ' en penaltis' : ''}` : 'Empate';
  }
  const sc = g.score;
  if (!sc) return 'Final';
  if (sc.local !== sc.visitante) return `Gana ${C.teamView(model, sc.local > sc.visitante ? p.local : p.visitante).nombre}`;
  return p.pasa && !/^empate$/i.test(String(p.pasa).trim()) ? `Pasa ${p.pasa}` : 'Empate';
}

// ------------------------------------------------------------------ contexto (franja inferior)

function kindOf(p) {
  if (p.ronda === 'INICIAL') return 'grupo';
  return p.interciclo ? 'final' : 'elim';
}

function leftPanel(p, score) {
  const kind = kindOf(p);
  if (kind === 'grupo') {
    const rows = C.liveStandings(model, p, isLive() || doc ? score : null);
    const { round } = C.phaseLabels(p);
    return tbl(`Clasificación ${round}`, [['', 'l'], ['Equipo', 'l'], ['PJ'], ['DG'], ['PTS']], rows.map((r, i) => html`<tr class="${r.playing ? 'on' : ''}">
      <td class="k">${i + 1}</td><td class="l">${r.equipo}${r.move ? html`<span class="mv">${r.move === 'up' ? '▲' : '▼'}</span>` : ''}</td>
      <td>${r.pj}</td><td>${r.dg > 0 ? '+' : ''}${r.dg}</td><td>${r.pts}</td></tr>`), isLive() ? 'En directo' : '')
      ?? html`<h3>Clasificación</h3><p class="empty">La clasificación aparecerá con los primeros resultados.</p>`;
  }
  if (kind === 'elim') {
    const cols = C.bracketOf(model, p, score, new Date());
    if (!cols.length) return html`<h3>Cuadro</h3><p class="empty">Cuadro por definir.</p>`;
    const ciclo = C.CICLO_NOMBRE[p.ciclo] ?? p.ciclo;
    return html`<h3>Cuadro ${ciclo}${isLive() ? html` <em>En directo</em>` : ''}</h3><div class="bk">${cols.map((c) => html`<div class="bk__col"><span class="bk__h">${c.title}</span>${c.matches.map((m) => html`<div class="bm${m.live ? ' live' : ''}">
        <span class="${m.lead === 'local' ? 'lead' : ''}">${m.local}</span><b>${m.score || m.when}</b><span class="${m.lead === 'visitante' ? 'lead' : ''}">${m.visitante}</span></div>`)}</div>`)}</div>`;
  }
  const L = C.roadOf(model, p.local, p); const V = C.roadOf(model, p.visitante, p);
  const rondas = [...new Set([...L, ...V].map((x) => x.ronda))];
  const txt = (arr, r) => arr.find((x) => x.ronda === r)?.texto ?? '—';
  return tbl('Camino a la final', [['', 'l'], [C.teamView(model, p.local).nombre, 'l'], [C.teamView(model, p.visitante).nombre, 'l']],
    rondas.map((r) => html`<tr><td class="w">${r}</td><td class="l">${txt(L, r)}</td><td class="l">${txt(V, r)}</td></tr>`))
    ?? html`<h3>Camino a la final</h3><p class="empty">Sin datos de rondas anteriores.</p>`;
}

function scorerRows(list) {
  return list.slice(0, 4).map((s, i) => html`<tr class="${s.live ? 'on' : ''}"><td class="k">${i + 1}</td><td class="l">${s.jugador}</td><td>${s.equipo}</td><td>${s.goles}</td></tr>`);
}

function rightPanels(p) {
  const today = new Date();
  const kind = kindOf(p);
  const matchRow = (x, last) => html`<tr><td class="w">${C.dayLabel(x.fecha, today)}</td><td class="l">${x.local?.equipo} vs ${x.visitante?.equipo}</td><td>${C.rondaCorta(x)}</td><td>${last(x)}</td></tr>`;
  const prox = tbl('Próximos partidos', [['', 'l'], ['Partido', 'l'], ['Ronda'], ['Hora']], C.upcoming(model, today, p.key).map((x) => matchRow(x, (y) => y.hora || '--:--')));
  const res = tbl('Últimos resultados', [['', 'l'], ['Partido', 'l'], ['Ronda'], ['Res.']], C.recent(model, 4, p.key).map((x) => matchRow(x, (y) => `${y.local?.score ?? '–'}–${y.visitante?.score ?? '–'}`)));
  const out = [];
  if (kind === 'grupo') {
    out.push(tbl(`Máximos goleadores · ${C.CICLO_NOMBRE[p.ciclo] ?? p.ciclo}`, [['', 'l'], ['Jugador', 'l'], ['Equipo'], ['Goles']], scorerRows(C.scorersLive(model, p, doc, { ciclo: p.ciclo }))));
    out.push(prox, res);
  } else if (kind === 'elim') {
    const roads = ['local', 'visitante'].flatMap((s) => C.roadOf(model, p[s], p).map((r) => ({ ...r, team: C.teamView(model, p[s]).nombre })));
    out.push(tbl('Así llegaron', [['Equipo', 'l'], ['Ronda', 'l'], ['Resultado', 'l']], roads.map((r) => html`<tr><td class="l">${r.team}</td><td class="w">${r.ronda}</td><td class="l">${r.texto}</td></tr>`)));
    out.push(tbl('Goleadores de los dos equipos', [['', 'l'], ['Jugador', 'l'], ['Equipo'], ['Goles']], scorerRows(C.scorersLive(model, p, doc, { equipos: [p.local?.id, p.visitante?.id].filter(Boolean) }))));
    out.push(prox);
  } else {
    const top = C.scorersLive(model, p, doc);
    out.push(tbl('Máximo goleador del torneo', [['', 'l'], ['Jugador', 'l'], ['Equipo'], ['Goles']], scorerRows(top), isLive() ? 'En directo' : ''));
    const prev = (model.partidos ?? []).filter((x) => x && x.key !== p.key && (x.ronda === 'SEMIFINAL' || x.ronda === 'TERCERPUESTO')).sort((a, b) => a.n - b.n);
    out.push(tbl('Semifinales y tercer puesto', [['', 'l'], ['Partido', 'l'], ['Ronda'], ['Res.']], prev.map((x) => matchRow(x, (y) => (y.estatus === 'JUGADO' ? `${y.local?.score ?? '–'}–${y.visitante?.score ?? '–'}` : (y.hora || '--:--'))))));
    const podio = model.podio ?? {};
    let campeon = podio.primero?.equipo ?? ''; let sub = podio.segundo?.equipo ?? '';
    if (p.ronda === 'FINAL' && doc?.estado === 'FINAL' && doc.ganador) {
      campeon = C.teamView(model, p[doc.ganador]).nombre;
      sub = C.teamView(model, p[doc.ganador === 'local' ? 'visitante' : 'local']).nombre;
    }
    const decide = 'Se decide ahora';
    out.push(tbl('Premios del torneo', [['', 'l'], ['Premio', 'l'], ['Equipo / jugador']], [
      html`<tr><td class="k">1.º</td><td class="l">Campeón</td><td>${campeon || decide}</td></tr>`,
      html`<tr><td class="k">2.º</td><td class="l">Subcampeón</td><td>${sub || decide}</td></tr>`,
      html`<tr><td class="k">3.º</td><td class="l">Tercer puesto</td><td>${podio.tercero?.equipo || 'Por decidir'}</td></tr>`,
      html`<tr><td class="k">⚽</td><td class="l">Máximo goleador</td><td>${top[0] ? `${top[0].jugador} (${top[0].goles})` : '—'}</td></tr>`,
    ]));
  }
  return out.filter(Boolean);
}

// ------------------------------------------------------------------ pantallas

function trackHtml(totalMin) {
  const s = settings();
  const divs = [];
  for (let i = 1; i < s.partes; i++) divs.push([i * s.minParte, `${i * s.minParte}′ · descanso`]);
  const regular = s.partes * s.minParte;
  const et = totalMin > regular;
  const pct = (m) => (m / totalMin) * 100;
  return html`${et ? html`<div class="track__et" style="left:${pct(regular)}%"></div>` : ''}<div class="track__fill" data-fill></div><span class="track__added" data-added hidden></span>
    ${divs.map(([m]) => html`<div class="track__div" style="left:${pct(m)}%"></div>`)}${et ? html`<div class="track__div" style="left:${pct(regular)}%"></div>` : ''}
    <span class="track__tick" style="left:0%">0′</span>${divs.map(([m, l]) => html`<span class="track__tick" style="left:${pct(m)}%">${l}</span>`)}
    <span class="track__tick" style="left:${pct(regular)}%">${regular}′</span>${et ? html`<span class="track__tick" style="left:100%">${totalMin}′</span>` : ''}`;
}

/**
 * Marcas de gol en la línea de tiempo (local arriba, visitante abajo). Para que los nombres no se encimen,
 * cada etiqueta va al nivel más cercano a la pista donde no choca con otra del mismo lado (hasta 3 niveles);
 * las que quedan lejos se unen a su punto con una línea. Medidas en cqw dentro de .tl (12,5cqw de alto,
 * pista centrada en 6,25cqw).
 */
const TL = { left: 13, width: 83, step: 1.4, lblH: 1.3, dotL: 4.45, dotV: 6.9, dot: 1.3 };
function marksHtml(goles, totalMin) {
  const items = goles.map((g) => {
    const pos = goalPosition(g);
    if (pos === null) return null;
    const f = Math.min(totalMin, Math.max(0, pos)) / totalMin;
    const first = String(g.jugador ?? '').trim().split(/\s+/)[0];
    const who = g.tipo === 'PROPIA' ? `${first ? `${first} ` : ''}(p.p.)` : (first || 'Gol');
    const text = `${goalTime(g)} ${who}`;
    const plus = /\+/.test(String(g.tiempo || g.minuto || ''));
    const x = TL.left + TL.width * f;
    const half = (text.length * 0.6 * 1.1) / 2 + 0.5; // media anchura estimada (cqw)
    return { side: g.lado === 'visitante' ? 'v' : 'l', f, text, x, half, lvl: 0, plus };
  }).filter(Boolean);
  for (const side of ['l', 'v']) {
    const right = [-Infinity, -Infinity, -Infinity];
    items.filter((m) => m.side === side).sort((a, b) => a.x - b.x).forEach((m) => {
      let lvl = right.findIndex((r) => m.x - m.half >= r);
      if (lvl < 0) lvl = right.indexOf(Math.min(...right));
      m.lvl = lvl;
      right[lvl] = m.x + m.half;
    });
  }
  const left = (m) => `calc(${TL.left}cqw + (100% - 17cqw) * ${m.f.toFixed(4)})`;
  const geo = (m) => {
    if (m.side === 'l') {
      const top = TL.dotL - 0.2 - TL.lblH - m.lvl * TL.step;
      return { dot: TL.dotL, lbl: top, stemTop: top + TL.lblH, stemH: TL.dotL - (top + TL.lblH) };
    }
    const dotBottom = TL.dotV + TL.dot;
    const top = dotBottom + 0.2 + m.lvl * TL.step;
    return { dot: TL.dotV, lbl: top, stemTop: dotBottom, stemH: top - dotBottom };
  };
  return html`${items.map((m) => { const g = geo(m); return html`<i class="dot dot--${m.side}${m.plus ? ' dot--plus' : ''}" style="left:${left(m)};top:${g.dot}cqw"></i>${m.lvl ? html`<b class="stem" style="left:${left(m)};top:${g.stemTop.toFixed(2)}cqw;height:${g.stemH.toFixed(2)}cqw"></b>` : ''}`; })}
    ${items.map((m) => html`<span class="lbl${m.plus ? ' lbl--plus' : ''}" style="left:${Math.min(99.5 - m.half, Math.max(m.half + 0.5, m.x)).toFixed(2)}cqw;top:${geo(m).lbl.toFixed(2)}cqw">${m.text}</span>`)}`;
}

function sideHtml(team, cls, score, pens) {
  return html`<div class="side side--${cls}">
    <div class="team">${crest(team)}<div class="team__name${team.curso ? '' : ' team__name--solo'}">${team.nombre}</div>${team.curso ? html`<div class="team__curso">${team.curso}</div>` : ''}</div>
    <div class="scorecol"><span class="num" data-score="${cls}">${score}</span><div class="pens">${pens ?? ''}</div></div>
  </div>`;
}

function pensHtml(arr, n) {
  const len = Math.max(n, arr.length);
  return Array.from({ length: len }, (_, i) => (arr[i] === undefined ? html`<i></i>` : arr[i] ? html`<i class="g">✓</i>` : html`<i class="x">✕</i>`));
}

function renderMatch(p) {
  const L = C.teamView(model, p.local); const V = C.teamView(model, p.visitante);
  const { phase, round } = C.phaseLabels(p);
  const g = C.matchGoals(model, p, doc);
  const score = g.score ?? { local: 0, visitante: 0 };
  const s = settings();
  const totalMin = doc ? clockView(doc, serverNow()).totalMin : s.partes * s.minParte;
  let pl = null; let pv = null;
  if (doc && (doc.estado === 'PENALTIS' || (doc.tanda ?? []).length)) {
    const ps = penaltyState(doc.tanda, s.penaltis);
    pl = pensHtml(ps.local, s.penaltis); pv = pensHtml(ps.visitante, s.penaltis);
  }
  const panels = rightPanels(p);
  rot %= Math.max(1, panels.length);
  setHTML(board, html`<div class="main">
      ${sideHtml(L, 'l', score.local, pl)}
      <div class="mid"><div class="mid__phase">${phase}</div><div class="mid__round">${round}</div><div class="clock" data-clock></div><div class="clock-left" data-left></div><div class="period" data-period></div></div>
      ${sideHtml(V, 'v', score.visitante, pv)}
    </div>
    <div class="tl"><div class="tl__lab">Línea de<br>tiempo</div><div class="track">${trackHtml(totalMin)}</div><div class="marks">${marksHtml(g.goles, totalMin)}</div></div>
    <div class="ctx">
      <div class="panel">${leftPanel(p, g.score)}</div>
      <div class="panel">${panels.length > 1 ? html`<div class="dots">${panels.map((_, i) => html`<i class="${i === rot ? 'on' : ''}"></i>`)}</div>` : ''}<div class="rot" data-rot>${panels[rot] ?? ''}</div></div>
    </div>`);
  view.winner = winnerText(p, g);
  view.panels = panels;
  tick();
}

function renderPre(p) {
  const nombre = model.config?.TORNEO_NOMBRE || 'Al-Ándalus';
  const today = new Date();
  if (!p && !loaded) {
    setHTML(board, html`<div class="idle"><div class="idle__nx">
        <div class="brand"><img src="${LOGO}" alt=""><div><div class="brand__wm">${nombre}</div></div></div>
        <div class="idle__lbl">Cargando datos del torneo…</div></div><div></div></div>`);
    return;
  }
  if (!p) {
    const res = C.recent(model, 4);
    setHTML(board, html`<div class="idle"><div class="idle__nx">
        <div class="brand"><img src="${LOGO}" alt=""><div><div class="brand__wm">${nombre}</div><small>${model.config?.TORNEO_ANIO ?? ''}</small></div></div>
        <div class="idle__lbl">Entre partidos</div>
        <div class="vsrow__name">No hay más partidos programados</div></div>
      <div class="idle__side">${res.length ? html`<div class="box"><h3>Últimos resultados</h3><table><tbody>${res.map((x) => html`<tr><td class="w">${C.dayLabel(x.fecha, today)}</td><td class="l">${x.local?.equipo} vs ${x.visitante?.equipo}</td><td>${x.local?.score ?? '–'}–${x.visitante?.score ?? '–'}</td></tr>`)}</tbody></table></div>` : ''}</div></div>`);
    return;
  }
  const L = C.teamView(model, p.local); const V = C.teamView(model, p.visitante);
  const { phase, round } = C.phaseLabels(p);
  const label = view.kind === 'previa' ? `${round} · Partido ${p.n}` : `Próximo partido · ${round}`;
  const boxes = [];
  if (p.ronda === 'INICIAL') {
    const rows = C.liveStandings(model, p, null);
    if (rows.length) boxes.push(html`<div class="box"><h3>Clasificación ${round}</h3><table><tbody>${rows.slice(0, 5).map((r, i) => html`<tr class="${r.playing ? 'on' : ''}"><td class="w">${i + 1}.º</td><td class="l">${r.equipo}</td><td>${r.pts} pts</td></tr>`)}</tbody></table></div>`);
  } else {
    const roads = ['local', 'visitante'].flatMap((s) => C.roadOf(model, p[s], p).slice(-2).map((r) => ({ ...r, team: C.teamView(model, p[s]).nombre })));
    if (roads.length) boxes.push(html`<div class="box"><h3>Así llegaron</h3><table><tbody>${roads.map((r) => html`<tr><td class="w">${r.ronda}</td><td class="l">${r.team}: ${r.texto}</td></tr>`)}</tbody></table></div>`);
  }
  const res = C.recent(model, 3, p.key);
  if (res.length) boxes.push(html`<div class="box"><h3>Últimos resultados</h3><table><tbody>${res.map((x) => html`<tr><td class="w">${C.dayLabel(x.fecha, today)}</td><td class="l">${x.local?.equipo} vs ${x.visitante?.equipo}</td><td>${x.local?.score ?? '–'}–${x.visitante?.score ?? '–'}</td></tr>`)}</tbody></table></div>`);
  setHTML(board, html`<div class="idle"><div class="idle__nx">
      <div class="brand"><img src="${LOGO}" alt=""><div><div class="brand__wm">${nombre}</div><small>${phase}</small></div></div>
      <div class="idle__lbl">${label}</div>
      <div class="vsrow"><div>${crest(L)}<div class="vsrow__name">${L.nombre}</div>${L.curso ? html`<small>${L.curso}</small>` : ''}</div>
        <span class="vsrow__vs">VS</span>
        <div>${crest(V)}<div class="vsrow__name">${V.nombre}</div>${V.curso ? html`<small>${V.curso}</small>` : ''}</div></div>
      <div class="when" data-when></div></div>
    <div class="idle__side">${boxes}</div></div>`);
  tick();
}

function computeView() {
  const today = new Date();
  const p = currentN != null ? C.findMatch(model, currentN) : null;
  if (p) {
    if (doc) {
      const stale = fixedN == null && doc.estado === 'FINAL' && Number.isFinite(doc.finEn) && serverNow() - doc.finEn > FINAL_HOLD_MS;
      if (!stale) return { kind: 'match', p };
    } else if (p.estatus === 'JUGADO') return { kind: 'match', p };
    else if (fixedN != null) return { kind: 'previa', p };
  }
  return { kind: 'idle', p: C.nextMatch(model, today) };
}

function render() {
  view = computeView();
  stage.dataset.kind = view.kind;
  if (view.kind === 'match') renderMatch(view.p);
  else renderPre(view.p);
}

// ------------------------------------------------------------------ reloj (4 veces por segundo)

function setText(sel, txt) {
  const el = board.querySelector(sel);
  if (el && el.textContent !== txt) el.textContent = txt;
}

function tick() {
  if (view.kind === 'match') {
    if (doc) {
      const v = clockView(doc, serverNow());
      const final = doc.estado === 'FINAL';
      board.classList.toggle('is-added', v.added);
      board.classList.toggle('is-et', doc.estado === 'PRORROGA');
      board.classList.toggle('is-pens', doc.estado === 'PENALTIS');
      board.classList.toggle('is-final', final);
      board.classList.toggle('is-break', doc.estado === 'DESCANSO');
      board.classList.toggle('is-paused', v.paused);
      setText('[data-clock]', v.display);
      setText('[data-left]', final ? '' : v.left);
      setText('[data-period]', final ? view.winner : v.period);
      const chip = board.querySelector('[data-added]');
      if (chip) {
        chip.hidden = !v.added;
        if (v.added) { chip.textContent = v.display; chip.style.left = `${(v.addedAt / v.totalMin) * 100}%`; }
      }
      const fill = board.querySelector('[data-fill]');
      if (fill) fill.style.width = `${Math.min(100, (v.elapsedMin / v.totalMin) * 100)}%`;
    } else {
      board.className = 'board is-final';
      setText('[data-clock]', 'FINAL');
      setText('[data-period]', view.winner ?? 'Final');
      const fill = board.querySelector('[data-fill]');
      if (fill) fill.style.width = '100%';
    }
    return;
  }
  board.className = 'board';
  const el = board.querySelector('[data-when]');
  if (!el || !view.p) return;
  const start = C.matchStart(view.p);
  const today = new Date();
  let out;
  if (start && C.dayLabel(view.p.fecha, today) === 'Hoy') {
    const diff = (start.getTime() - serverNow()) / 1000;
    out = diff > 3600 ? html`Hoy a las <b>${view.p.hora}</b>`
      : diff > 0 ? html`Empieza en <b>${mmss(diff)}</b> · ${view.p.hora}`
        : html`<b>A punto de empezar</b>`;
  } else {
    out = html`<b>${C.dayLabel(view.p.fecha, today)}</b>${view.p.hora ? ` · ${view.p.hora}` : ''}`;
  }
  const s = out.toString();
  if (el.dataset.v !== s) { el.dataset.v = s; setHTML(el, out); }
}

// ------------------------------------------------------------------ animaciones

function runQueue() {
  if (busy || !queue.length) return;
  busy = true;
  const job = queue.shift();
  job(() => { busy = false; runQueue(); });
}

function playGoal(p, gol) {
  queue.push((done) => {
    const lado = gol.lado === 'visitante' ? 'visitante' : 'local';
    const team = C.teamView(model, p[lado]);
    const who = String(gol.jugador ?? '').trim() || (gol.tipo === 'PROPIA' ? 'Gol en propia puerta' : '¡Gol!');
    const tipo = gol.tipo === 'PENAL' ? ' · de penalti' : gol.tipo === 'PROPIA' ? ' · en propia' : '';
    // En propia, el escudo y el nombre son los del equipo que suma (`lado`).
    setHTML(fxGoal, html`<div class="stripe s1"></div><div class="stripe s2"></div><div class="stripe s3"></div><canvas></canvas>
      <div class="goal__txt"><div class="goal__big">¡GOL!</div><div class="goal__who">${crest(team)}<div>${who}<small>${team.nombre} · ${goalTime(gol)}${tipo}</small></div></div></div>`);
    fxGoal.classList.remove('out'); fxGoal.classList.add('on');
    if (!reduce()) confetti(fxGoal.querySelector('canvas'));
    const r = reduce();
    setTimeout(() => fxGoal.classList.add('out'), r ? 2000 : 3600);
    setTimeout(() => {
      fxGoal.classList.remove('on', 'out'); fxGoal.textContent = '';
      const n = board.querySelector(`[data-score="${lado === 'local' ? 'l' : 'v'}"]`);
      if (n) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
      done();
    }, r ? 2200 : 4050);
  });
  runQueue();
}

function playKickoff(p, short) {
  queue.push((done) => {
    const L = C.teamView(model, p.local); const V = C.teamView(model, p.visitante);
    const { phase, round } = C.phaseLabels(p);
    const t = (x, cls) => html`<div class="k2__t ${cls}">${crest(x)}<div class="n">${x.nombre}</div>${x.curso ? html`<small>${x.curso}</small>` : ''}</div>`;
    setHTML(fxKick, html`<div class="k1"><img src="${LOGO}" alt=""><div class="k1__wm">${model.config?.TORNEO_NOMBRE || 'Al-Ándalus'}</div><div class="k1__sub">${phase} · ${round}</div></div>
      <div class="k2">${t(L, 'k2__l')}<div class="k2__vs">VS</div>${t(V, 'k2__r')}</div><div class="k3"></div><div class="k4"><span>${short ? '¡Segunda parte!' : '¡A jugar!'}</span></div>`);
    fxKick.classList.add('on');
    const [k1, k2, k3, k4] = fxKick.children;
    const r = reduce();
    const steps = short ? (r ? [null, 0, null, 0, 1500] : [null, 50, null, 1800, 3000])
      : (r ? [0, 900, 1800, 2400, 3200] : [50, 1500, 3300, 6000, 7000]);
    const at = (ms, fn) => { if (ms !== null) setTimeout(fn, ms); };
    at(steps[0], () => k1.classList.add('show'));
    at(steps[1], () => { k1.classList.remove('show'); k2.classList.add('show'); });
    at(steps[2], () => {
      k2.classList.remove('show'); k3.classList.add('show');
      if (r) { k3.textContent = '3 · 2 · 1'; return; }
      [3, 2, 1].forEach((n, i) => setTimeout(() => { setHTML(k3, html`<span>${n}</span>`); }, i * 900));
    });
    at(steps[3], () => { k2.classList.remove('show'); k3.classList.remove('show'); k4.classList.add('show'); });
    setTimeout(() => { fxKick.classList.remove('on'); fxKick.textContent = ''; done(); }, steps[4]);
  });
  runQueue();
}

function confetti(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return;
  const W = (canvas.width = canvas.offsetWidth); const H = (canvas.height = canvas.offsetHeight);
  const cols = ['#ffd166', '#fbb93a', '#f5a31a', '#ffffff', '#c1272d'];
  const ps = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 2.4, vy: 2 + Math.random() * 3.5, r: Math.random() * Math.PI, s: 6 + Math.random() * 9, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) {
    if (!canvas.isConnected || t - t0 > 3800) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    requestAnimationFrame(frame);
  })(t0);
}

// ------------------------------------------------------------------ datos en vivo

function onDoc(n, d, meta) {
  if (n !== docN) return;
  const prev = doc;
  const first = firstSnap;
  firstSnap = false;
  doc = d;
  render();
  const p = C.findMatch(model, n);
  if (!first && p && d && !meta?.hasPendingWrites) {
    const was = prev?.estado ?? 'PREVIA';
    if (d.estado === 'EN_JUEGO' && d.parte === 1 && was === 'PREVIA') playKickoff(p, false);
    else if (d.estado === 'EN_JUEGO' && was === 'DESCANSO') playKickoff(p, true);
    const old = new Set((prev?.goles ?? []).map((g) => g.id));
    for (const g of d.goles ?? []) if (!old.has(g.id)) playGoal(p, g);
  }
  status(meta?.fromCache && !navigator.onLine ? 'Sin conexión · reconectando…' : '');
}

function follow(n) {
  if (n === docN) return;
  unsubMatch?.();
  unsubMatch = null;
  doc = null; docN = n; currentN = n ?? fixedN; firstSnap = true;
  render();
  if (n == null) return;
  watchMatch(n, (d, meta) => onDoc(n, d, meta), () => status('No se pudo conectar con el directo'))
    .then((u) => { if (docN === n) unsubMatch = u; else u(); })
    .catch(() => status('No se pudo cargar el directo'));
}

function status(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
}

// ------------------------------------------------------------------ TV: pantalla completa, reposo, cursor

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch { /* no disponible */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

function goFullscreen() {
  keepAwake();
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  document.getElementById('hint').hidden = true;
}
document.addEventListener('click', goFullscreen);
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'f') goFullscreen(); });
setTimeout(() => { document.getElementById('hint').hidden = true; }, 8000);

let cursorT = 0;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('hide-cursor');
  clearTimeout(cursorT);
  cursorT = setTimeout(() => document.body.classList.add('hide-cursor'), 3000);
});

// ------------------------------------------------------------------ arranque

async function boot() {
  calibrate();
  keepAwake();
  render();
  let raw = null;
  try { raw = await loadAll(); model = buildModel(raw); } catch { status('No se pudieron cargar los datos del torneo'); }
  loaded = true;
  render();
  onUpdate((r) => { model = buildModel(r); loaded = true; status(''); render(); }, { intervalMs: 60000, initial: raw ?? undefined });

  if (firebaseEnabled()) {
    if (fixedN != null) follow(fixedN);
    else watchCurrent((n) => follow(n), () => status('No se pudo conectar con el directo')).catch(() => status('No se pudo cargar el directo'));
  } else if (fixedN != null) {
    currentN = fixedN;
    render();
  }

  setInterval(tick, 250);
  setInterval(() => {
    if (view.kind !== 'match') return;
    const box = board.querySelector('[data-rot]');
    if (!box) return;
    const panels = view.panels ?? [];
    if (panels.length < 2) return;
    box.classList.add('is-out');
    setTimeout(() => {
      rot = (rot + 1) % panels.length;
      setHTML(box, panels[rot]);
      board.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === rot));
      box.classList.remove('is-out');
    }, 320);
  }, ROTATE_MS);
  // La pantalla «entre partidos» vuelve sola cuando un final lleva un rato.
  setInterval(() => { if (view.kind !== computeView().kind) render(); }, 30000);
}

boot();
