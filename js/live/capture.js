// Página de captura del marcador (captura.html), pensada para el móvil de quien anota.
// 1) Entrar con la cuenta de Google (solo pueden escribir las cuentas de config/anotadores).
// 2) Elegir el partido: solo aparecen los que NO están jugados (ni ESTATUS = JUGADO en la hoja ni
//    terminados en el directo). Con el número de partido se cargan equipos, ronda y desempate.
// 3) Controlar el partido. Cada pulsación guarda el documento completo en Firestore (marcador/{n}); si no hay
//    cobertura, Firestore lo guarda en el móvil y lo envía al volver. La copia al libro la hace el Apps Script.
import { html, setHTML } from '../core/dom.js';
import { dayKey } from '../sections/dates.js';
import { loadAll } from '../data/sheets.js';
import { buildModel } from '../data/buildModel.js';
import { normalizeName } from '../data/goals.js';
import { DESEMPATES, liveSettings, penaltyState, tiebreakFor, tiebreakLabel } from './rules.js';
import { calibrate, clockView, goalTime, minuteFromTiempo, scoreOf, serverNow, tiempoLabel } from './clock.js';
import * as S from './state.js';
import * as C from './context.js';
import { firebaseAuth, firebaseEnabled, firestore } from './firebase.js';

const app = document.getElementById('app');
const userBox = document.getElementById('user');
const dlgGoal = document.getElementById('dlgGoal');
const dlgChoice = document.getElementById('dlgChoice');

let model = buildModel({});
let db = null; let fs = null;
let user = null;
let n = null;
let doc = null;
let pendingWrites = false;
let writeError = '';
let unsub = null;
let draftDesempate = '';

const readN = () => { const v = new URLSearchParams(location.search).get('partido'); return /^\d+$/.test(v ?? '') ? Number(v) : null; };
const side = (lado) => (lado === 'visitante' ? 'visitante' : 'local');
const settings = () => liveSettings(model.config);

// ------------------------------------------------------------------ diálogos

/** Diálogo con varias opciones. Devuelve el valor elegido o null si se cancela. */
function choose(title, text, options) {
  return new Promise((resolve) => {
    setHTML(dlgChoice, html`<form method="dialog" class="dlg">
      <h2>${title}</h2>${text ? html`<p>${text}</p>` : ''}
      ${options.map((o) => html`<button class="btn ${o.cls ?? ''}" value="${o.value}">${o.label}</button>`)}
      <button class="btn" value="">Cancelar</button></form>`);
    const done = () => { dlgChoice.removeEventListener('close', done); resolve(dlgChoice.returnValue || null); };
    dlgChoice.returnValue = '';
    dlgChoice.addEventListener('close', done);
    dlgChoice.showModal();
  });
}
const confirmAsk = (title, text, label, cls = 'btn--red') => choose(title, text, [{ value: 'ok', label, cls }]).then((v) => v === 'ok');

function suggestions(teamId) {
  const set = new Map();
  for (const g of model.goles ?? []) if (g.equipoId === teamId && g.jugador) set.set(normalizeName(g.jugador), g.jugador);
  for (const l of model.lideres ?? []) if (l.equipoId === teamId && l.jugador) set.set(normalizeName(l.jugador), l.jugador);
  for (const g of doc?.goles ?? []) if (doc?.equipos?.[g.lado]?.id === teamId && g.jugador) set.set(normalizeName(g.jugador), g.jugador);
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Diálogo de gol. `lado` = equipo del botón pulsado (el del jugador que marca). El tiempo de juego se toma
 * en el instante de la pulsación, no al guardar, aunque se tarde en escribir el nombre.
 */
function openGoal(lado) {
  const p = C.findMatch(model, n);
  const team = C.teamView(model, p?.[lado]);
  const rival = C.teamView(model, p?.[lado === 'local' ? 'visitante' : 'local']);
  const v = clockView(doc, serverNow());
  setHTML(dlgGoal, html`<form method="dialog" class="dlg" id="goalForm">
    <h2>Gol de ${team.nombre}</h2>
    <div class="field"><label class="lab" for="gJugador">Jugador</label>
      <input id="gJugador" name="jugador" list="gPlayers" autocomplete="off" placeholder="Nombre del jugador">
      <datalist id="gPlayers">${suggestions(team.id).map((s) => html`<option value="${s}"></option>`)}</datalist></div>
    <div class="field"><span class="lab">Tipo</span>
      <div class="choices" role="radiogroup" aria-label="Tipo de gol">
        <label><input type="radio" name="tipo" value="GOL" checked><span>Gol</span></label>
        <label><input type="radio" name="tipo" value="PENAL"><span>Penalti</span></label>
        <label><input type="radio" name="tipo" value="PROPIA"><span>En propia</span></label>
      </div>
      <p class="hint">En propia: lo marca un jugador de ${team.nombre} y el gol suma a ${rival.nombre}.</p></div>
    <div class="field"><label class="lab" for="gMin">Tiempo de juego</label>
      <input id="gMin" name="tiempo" inputmode="text" value="${v.tiempo}" placeholder="16:23 o 12+0:35" required>
      <p class="hint">${v.tiempo ? 'Es el momento exacto en que pulsaste el botón. Puedes corregirlo.' : 'Escribe el momento del gol (por ejemplo 16:23).'}</p></div>
    <p class="hint" id="gErr" role="alert"></p>
    <div class="row"><button class="btn" value="" formnovalidate>Cancelar</button><button class="btn btn--red" value="ok">Guardar gol</button></div>
  </form>`);
  dlgGoal.returnValue = '';
  const form = dlgGoal.querySelector('form');
  form.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'ok') return;
    const tiempo = String(form.tiempo.value).replace(/[′'’\s]/g, '');
    if (!minuteFromTiempo(tiempo)) { e.preventDefault(); dlgGoal.querySelector('#gErr').textContent = 'Escribe el tiempo como 16:23 (o 12+0:35 en el añadido).'; return; }
    const tipo = form.querySelector('input[name="tipo"]:checked')?.value ?? 'GOL';
    save(S.addGoal(doc, { equipo: lado, jugador: form.jugador.value, tipo, tiempo }, serverNow()));
  });
  dlgGoal.showModal();
  setTimeout(() => dlgGoal.querySelector('#gJugador')?.focus(), 50);
}

// ------------------------------------------------------------------ guardar

async function save(next, { current = false } = {}) {
  if (!db || n == null) return;
  doc = next;
  renderPanel();
  const b = fs.writeBatch(db);
  b.set(fs.doc(db, 'marcador', String(n)), { ...next, actualizado: fs.serverTimestamp() });
  b.set(fs.doc(db, 'meta', 'indice'), { cambios: { [String(n)]: fs.serverTimestamp() } }, { merge: true });
  if (current) b.set(fs.doc(db, 'meta', 'actual'), { n, actualizado: fs.serverTimestamp() });
  try {
    await b.commit();
    writeError = '';
  } catch (err) {
    writeError = err?.code === 'permission-denied'
      ? `La cuenta ${user?.email ?? ''} no tiene permiso para anotar. Pide que la añadan a la lista de anotadores.`
      : `No se pudo guardar (${err?.code ?? err?.message ?? 'error'}). Vuelve a intentarlo.`;
  }
  renderPanel();
}

// ------------------------------------------------------------------ vistas

function renderUser() {
  setHTML(userBox, user ? html`<span>${user.email}</span><button type="button" data-act="logout">Salir</button>` : html``);
}

function renderMessage(title, body, action = null) {
  setHTML(app, html`<section class="card"><h2>${title}</h2>${body}${action ?? ''}</section>`);
}

async function renderList() {
  n = null; doc = null; unsub?.(); unsub = null;
  setHTML(app, html`<section class="card"><p class="muted">Cargando partidos…</p></section>`);
  const estados = new Map();
  try {
    const snap = await fs.getDocs(fs.collection(db, 'marcador'));
    snap.forEach((d) => estados.set(d.id, d.data()?.estado ?? ''));
  } catch { /* sin red: se listan los de la hoja */ }
  if (n != null) return; // se eligió un partido mientras cargaba
  const today = new Date();
  const tk = dayKey(today);
  const pending = C.pendingMatches(model).filter((p) => estados.get(String(p.n)) !== 'FINAL');
  const live = pending.filter((p) => estados.has(String(p.n)));
  const rest = pending.filter((p) => !estados.has(String(p.n)));
  const hoy = rest.filter((p) => dayKey(p.fecha) === tk);
  const prox = rest.filter((p) => (dayKey(p.fecha) ?? -Infinity) > tk);
  const antes = rest.filter((p) => !hoy.includes(p) && !prox.includes(p));
  const next = hoy[0] ?? prox[0] ?? null;
  const item = (p, tag, cls = '') => {
    const { round } = C.phaseLabels(p);
    return html`<button type="button" class="pick ${cls}" data-pick="${p.n}">
      <span class="pick__n">P${p.n}</span>
      <span><span class="pick__teams">${p.local?.equipo} vs ${p.visitante?.equipo}</span><span class="pick__meta"><br>${round} · ${C.dayLabel(p.fecha, today)}${p.hora ? ` · ${p.hora}` : ''}</span></span>
      ${tag ? html`<span class="pick__tag">${tag}</span>` : html`<span></span>`}</button>`;
  };
  setHTML(app, html`
    ${live.length ? html`<section class="card"><h2>En juego</h2><div class="list">${live.map((p) => item(p, 'En vivo', 'pick--live'))}</div></section>` : ''}
    <section class="card"><h2>Partidos de hoy</h2>${hoy.length ? html`<div class="list">${hoy.map((p) => item(p, p === next ? 'Siguiente' : '', p === next ? 'pick--next' : ''))}</div>` : html`<p class="muted">Hoy no hay partidos pendientes.</p>`}</section>
    ${prox.length ? html`<section class="card"><h2>Próximos días</h2><div class="list">${prox.slice(0, 12).map((p) => item(p, p === next ? 'Siguiente' : '', p === next ? 'pick--next' : ''))}</div></section>` : ''}
    ${antes.length ? html`<section class="card"><details><summary>Pendientes de días anteriores (${antes.length})</summary><p class="muted">Partidos con fecha pasada que aún no tienen resultado en la hoja.</p><div class="list">${antes.map((p) => item(p, ''))}</div></details></section>` : ''}
    <p class="muted">Los partidos ya jugados no aparecen: no se pueden volver a capturar.</p>`);
}

function goalsList(p) {
  const goles = doc?.goles ?? [];
  if (!goles.length) return html`<p class="muted">Aún no hay goles.</p>`;
  const name = (l) => C.teamView(model, p[side(l)]).nombre;
  const detalle = (g) => (g.tipo === 'PROPIA'
    ? `En propia de ${name(g.autor ?? (g.lado === 'local' ? 'visitante' : 'local'))} · suma a ${name(g.lado)}`
    : `${name(g.lado)}${g.tipo === 'PENAL' ? ' · penalti' : ''}`);
  return html`<ul class="goals">${goles.slice().reverse().map((g) => html`<li>
    <span class="min">${goalTime(g)}</span>
    <span class="who">${g.jugador || 'Sin nombre'}<small>${detalle(g)}</small></span>
    <button type="button" data-act="del-goal" data-id="${g.id}" aria-label="Borrar gol de ${g.jugador || 'jugador sin nombre'}">Borrar</button></li>`)}</ul>`;
}

function actionsFor(p, L, V) {
  const e = doc?.estado;
  const goalBtns = html`<div class="row"><button class="btn btn--red btn--big" data-act="goal" data-lado="local">+ Gol<br>${L.nombre}</button><button class="btn btn--red btn--big" data-act="goal" data-lado="visitante">+ Gol<br>${V.nombre}</button></div>`;
  if (!doc) {
    const des = draftDesempate || tiebreakFor(p, model.config);
    return html`<section class="card">
      <div class="field"><label class="lab" for="desSel">Desempate de este partido</label>
        <select id="desSel" data-act="desempate">${DESEMPATES.map((d) => html`<option value="${d}"${d === des ? html` selected` : ''}>${tiebreakLabel(d)}</option>`)}</select></div>
      <p class="muted">${settings().partes} tiempos de ${settings().minParte}′ · descanso de ${settings().descanso}′ · penaltis: ${settings().penaltis} por equipo.</p>
      <button class="btn btn--red btn--big" data-act="start">Iniciar ${tiempoLabel(1)}</button>
      <p class="muted">Al iniciar, la tele del torneo mostrará este partido.</p></section>`;
  }
  if (e === 'EN_JUEGO' || e === 'PRORROGA') {
    const v = clockView(doc, serverNow());
    const label = e === 'PRORROGA' ? `parte ${doc.etParte} de la prórroga` : tiempoLabel(doc.parte);
    return html`<section class="card">${goalBtns}
      ${doc.esperando ? html`<button class="btn btn--amber btn--big" data-act="pause">Empezar ${label}</button>`
        : html`<div class="row3"><button class="btn" data-act="pause">${v.paused ? 'Reanudar reloj' : 'Detener reloj'}</button>
          <button class="btn btn--amber" data-act="added">Añadido +1′${doc.anadido ? ` (${doc.anadido})` : ''}</button>
          <button class="btn btn--ghost" data-act="end">Fin del ${e === 'PRORROGA' ? 'tramo' : 'tiempo'}</button></div>`}
      <p class="muted">Reloj corrido: solo hay que detenerlo por una incidencia (lesión, balón perdido…).</p></section>`;
  }
  if (e === 'DESCANSO') {
    return html`<section class="card"><button class="btn btn--amber btn--big" data-act="next-half">Iniciar ${tiempoLabel((doc.parte || 1) + 1)}</button>
      <p class="muted">La tele muestra la cuenta atrás del descanso.</p></section>`;
  }
  if (e === 'PENALTIS') {
    const ps = penaltyState(doc.tanda, doc.ajustes?.penaltis);
    const col = (lado, team) => html`<div class="pens__side${!ps.decided && ps.next === lado ? ' is-next' : ''}">
      <h3>${team.nombre}${!ps.decided && ps.next === lado ? ' · lanza' : ''}</h3>
      <div class="pens__dots">${ps[lado].map((g) => (g ? html`<i class="g">✓</i>` : html`<i class="x">✕</i>`))}</div>
      <button class="btn btn--ok" data-act="pen" data-lado="${lado}" data-gol="1"${ps.decided ? html` disabled` : ''}>Marca</button>
      <button class="btn btn--ghost" data-act="pen" data-lado="${lado}" data-gol="0"${ps.decided ? html` disabled` : ''}>Falla</button></div>`;
    const win = ps.decided ? C.teamView(model, p[ps.winner]).nombre : '';
    return html`<section class="card"><h2>Tanda de penaltis · ${ps.goles.local}–${ps.goles.visitante}</h2>
      <div class="pens">${col('local', L)}${col('visitante', V)}</div>
      <div class="row"><button class="btn" data-act="pen-undo"${(doc.tanda ?? []).length ? '' : html` disabled`}>Deshacer último</button>
      <button class="btn ${ps.decided ? 'btn--red' : 'btn--ghost'}" data-act="finish">${ps.decided ? `Terminar · gana ${win}` : 'Terminar partido'}</button></div>
      <p class="muted">Serie de ${doc.ajustes?.penaltis ?? 5} por equipo y después muerte súbita.</p></section>`;
  }
  if (e === 'FINAL') {
    const g = doc.ganador ? C.teamView(model, p[doc.ganador]).nombre : '';
    return html`<section class="card"><h2>Partido terminado${g ? ` · gana ${g}` : ' · empate'}</h2>
      <p class="notice notice--ok">El resultado y los goles se copiarán al libro de Google Sheets en unos minutos (o al pulsar Marcador › Sincronizar ahora en el libro).</p>
      <div class="row"><button class="btn" data-act="goal" data-lado="local">+ Gol olvidado ${L.nombre}</button><button class="btn" data-act="goal" data-lado="visitante">+ Gol olvidado ${V.nombre}</button></div>
      <button class="btn btn--ghost" data-act="reopen">Reabrir el partido (error al terminar)</button>
      <button class="btn" data-act="back">Elegir otro partido</button></section>`;
  }
  return '';
}

function renderPanel() {
  if (n == null) return;
  const p = C.findMatch(model, n);
  if (!p) { renderMessage('Partido no encontrado', html`<p>El partido ${n} no está en la hoja CLASIFICACION.</p>`, html`<button class="btn" data-act="back">Volver a la lista</button>`); return; }
  if (!doc && p.estatus === 'JUGADO') {
    renderMessage('Partido ya jugado', html`<p>El partido ${n} ya tiene ESTATUS = JUGADO en la hoja y no se puede volver a capturar.</p>`, html`<button class="btn" data-act="back">Volver a la lista</button>`);
    return;
  }
  const L = C.teamView(model, p.local); const V = C.teamView(model, p.visitante);
  const { phase, round } = C.phaseLabels(p);
  const sc = doc ? scoreOf(doc) : { local: 0, visitante: 0 };
  const des = doc?.desempate ?? (draftDesempate || tiebreakFor(p, model.config));
  setHTML(app, html`
    <div class="head"><button class="link" data-act="back">← Partidos</button><a class="link" href="marcador.html?partido=${n}" target="_blank" rel="noopener">Ver la pantalla de la tele</a></div>
    <div><div class="lab">${phase} · Partido ${n}</div><h2>${round}</h2></div>
    <div class="score" id="score">
      <div><div class="score__n">${sc.local}</div><div class="score__team">${L.nombre}</div></div>
      <div><div class="score__clock" data-clock>${doc ? '' : (p.hora || '--:--')}</div><div class="score__left" data-left></div><div class="score__period" data-period>${doc ? '' : 'Sin empezar'}</div></div>
      <div><div class="score__n">${sc.visitante}</div><div class="score__team">${V.nombre}</div></div>
    </div>
    ${writeError ? html`<p class="notice" role="alert">${writeError}</p>` : ''}
    ${actionsFor(p, L, V)}
    ${doc ? html`<section class="card"><h2>Goles</h2>${goalsList(p)}</section>` : ''}
    ${doc && doc.estado !== 'FINAL' ? html`<section class="card"><details><summary>Ajustes del partido</summary>
      <div class="field"><label class="lab" for="desSel2">Desempate</label>
        <select id="desSel2" data-act="desempate">${DESEMPATES.map((d) => html`<option value="${d}"${d === des ? html` selected` : ''}>${tiebreakLabel(d)}</option>`)}</select></div>
      <button class="btn btn--ghost" data-act="finish">Terminar el partido ahora</button></details></section>` : ''}
    <p class="sync${writeError ? ' is-error' : pendingWrites ? ' is-pending' : ''}" role="status"><i></i>${writeError ? 'Sin guardar' : pendingWrites ? 'Guardando… (se enviará al recuperar la conexión)' : doc ? 'Guardado · la tele ya lo muestra' : 'Listo para empezar'}</p>`);
  tick();
}

function tick() {
  if (!doc || n == null) return;
  const v = clockView(doc, serverNow());
  const el = app.querySelector('[data-clock]');
  const per = app.querySelector('[data-period]');
  const box = app.querySelector('#score');
  if (!el || !per || !box) return;
  el.textContent = v.display;
  const left = app.querySelector('[data-left]');
  if (left) left.textContent = doc.estado === 'FINAL' ? '' : v.left;
  per.textContent = doc.estado === 'FINAL' ? 'Final' : v.period;
  box.classList.toggle('is-added', v.added);
  box.classList.toggle('is-paused', v.paused);
}

// ------------------------------------------------------------------ navegación

function open(newN, push = true) {
  if (push) history.pushState(null, '', newN == null ? location.pathname : `?partido=${newN}`);
  unsub?.(); unsub = null;
  n = newN; doc = null; writeError = ''; draftDesempate = ''; pendingWrites = false;
  if (n == null) { renderList(); return; }
  renderPanel();
  const mine = n;
  unsub = fs.onSnapshot(fs.doc(db, 'marcador', String(n)), { includeMetadataChanges: true }, (snap) => {
    if (mine !== n) return;
    if (snap.exists()) { doc = snap.data({ serverTimestamps: 'estimate' }); delete doc.actualizado; } else doc = null;
    pendingWrites = snap.metadata.hasPendingWrites;
    if (!dlgGoal.open && !dlgChoice.open) renderPanel();
  }, (err) => { writeError = `No se puede leer el partido (${err.code ?? err.message}).`; renderPanel(); });
}
window.addEventListener('popstate', () => { if (user) open(readN(), false); });
// Lo que llegó mientras había un diálogo abierto se pinta al cerrarlo.
dlgGoal.addEventListener('close', () => renderPanel());
dlgChoice.addEventListener('close', () => setTimeout(() => renderPanel(), 0));

// ------------------------------------------------------------------ acciones

async function act(name, el) {
  const now = serverNow();
  const p = C.findMatch(model, n);
  switch (name) {
    case 'logout': { const { auth, au } = await firebaseAuth(); await au.signOut(auth); return; }
    case 'login': return login();
    case 'back': return open(null);
    case 'start': {
      if (!p || p.estatus === 'JUGADO') return;
      const ciclos = Object.fromEntries((model.equipos ?? []).map((e) => [e.id, e.ciclo]));
      const des = draftDesempate || tiebreakFor(p, model.config);
      return save(S.startMatch(p, settings(), des, now, ciclos), { current: true });
    }
    case 'goal': return openGoal(side(el.dataset.lado));
    case 'pause': return save(S.togglePause(doc, now));
    case 'added': return save(S.addAdded(doc, 1));
    case 'end': {
      const what = doc.estado === 'PRORROGA' ? `la parte ${doc.etParte} de la prórroga` : `el ${tiempoLabel(doc.parte)}`;
      if (!(await confirmAsk(`¿Terminar ${what}?`, '', 'Sí, terminar'))) return;
      const r = S.endPeriod(doc, serverNow());
      if (!r.decide) return save(r.doc);
      const o = S.tieOptions(r.doc);
      const opts = [];
      if (o.extra) opts.push({ value: 'et', label: 'Jugar la prórroga', cls: 'btn--red' });
      if (o.pens) opts.push({ value: 'pens', label: 'Ir a penaltis', cls: o.extra ? 'btn--amber' : 'btn--red' });
      opts.push({ value: 'end', label: 'Terminar en empate', cls: 'btn--ghost' });
      const v = await choose('Empate al final del tiempo', `Desempate de este partido: ${tiebreakLabel(r.doc.desempate)}.`, opts);
      if (v === 'et') return save(S.startExtraTime(r.doc, serverNow()));
      if (v === 'pens') return save(S.startPenalties(r.doc));
      if (v === 'end') return save(S.finish(r.doc, serverNow()));
      return undefined;
    }
    case 'next-half': return save(S.startNextHalf(doc, now));
    case 'pen': return save(S.addPenalty(doc, side(el.dataset.lado), el.dataset.gol === '1'));
    case 'pen-undo': return save(S.undoPenalty(doc));
    case 'finish': {
      const sc = scoreOf(doc);
      if (!(await confirmAsk('¿Terminar el partido?', `Resultado: ${sc.local}–${sc.visitante}. Se copiará al libro.`, 'Sí, terminar'))) return;
      return save(S.finish(doc, serverNow()));
    }
    case 'reopen':
      if (!(await confirmAsk('¿Reabrir el partido?', 'Vuelve al momento anterior al final, con el reloj detenido.', 'Reabrir', 'btn--amber'))) return;
      return save(S.reopen(doc));
    case 'del-goal': {
      const g = (doc?.goles ?? []).find((x) => x.id === el.dataset.id);
      if (!g || !(await confirmAsk('¿Borrar este gol?', `${goalTime(g)} · ${g.jugador || 'Sin nombre'}`, 'Borrar gol'))) return;
      return save(S.removeGoal(doc, g.id));
    }
    default: return undefined;
  }
}

app.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick]');
  if (pick) { open(Number(pick.dataset.pick)); return; }
  const b = e.target.closest('button[data-act]');
  if (b && !b.disabled) act(b.dataset.act, b);
});
userBox.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) act(b.dataset.act, b); });
app.addEventListener('change', (e) => {
  const s = e.target.closest('select[data-act="desempate"]');
  if (!s) return;
  if (doc) save(S.setTiebreak(doc, s.value)); else draftDesempate = s.value;
});

// ------------------------------------------------------------------ sesión

async function login() {
  const { auth, au } = await firebaseAuth();
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await au.signInWithPopup(auth, provider);
  } catch (err) {
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') await au.signInWithRedirect(auth, provider);
    else if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
      renderMessage('No se pudo entrar', html`<p>${err?.code === 'auth/unauthorized-domain' ? 'Este dominio no está autorizado en Firebase (Authentication › Settings › Authorized domains).' : (err?.message ?? 'Error desconocido')}</p>`, html`<button class="btn btn--red" data-act="login">Intentarlo de nuevo</button>`);
    }
  }
}

async function allowed() {
  try { await fs.getDoc(fs.doc(db, 'config', 'anotadores')); return true; } catch (err) { return err?.code !== 'permission-denied'; }
}

async function boot() {
  if (!firebaseEnabled()) {
    renderMessage('Falta configurar el directo', html`<p>Para capturar partidos hay que crear el proyecto gratuito de Firebase y copiar su configuración en <code>js/live/firebase-config.js</code>.</p><p class="muted">Los pasos están en MARCADOR.md, en la raíz del proyecto.</p>`);
    return;
  }
  calibrate();
  renderMessage('Cargando…', html`<p class="muted">Leyendo los partidos del libro.</p>`);
  try { model = buildModel(await loadAll({ ttlMs: 0 })); } catch { /* se queda con el modelo vacío */ }
  ({ db, fs } = await firestore({ offline: true }));
  const { auth, au } = await firebaseAuth();
  au.onAuthStateChanged(auth, async (u) => {
    user = u; renderUser();
    if (!u) {
      unsub?.(); unsub = null;
      renderMessage('Captura del marcador', html`<p>Entra con tu cuenta de Google del colegio para anotar los partidos en directo.</p>`, html`<button class="btn btn--red btn--big" data-act="login">Entrar con Google</button>`);
      return;
    }
    if (!(await allowed())) {
      renderMessage('Sin permiso para anotar', html`<p>La cuenta <strong>${u.email}</strong> no está en la lista de anotadores.</p><p class="muted">Quien administra el proyecto de Firebase puede añadirla en Firestore › config › anotadores.</p>`, html`<button class="btn" data-act="logout">Entrar con otra cuenta</button>`);
      return;
    }
    open(readN(), false);
  });
  setInterval(tick, 500);
}

boot();
