// Transiciones del partido en vivo (lo que hace cada botón de la página de captura). Puro: cada función
// recibe el documento actual y devuelve el documento nuevo completo; nunca muta la entrada.
//
// Documento `marcador/{NPartido}` en Firestore:
//   n, ronda, ciclo, grupo, desempate, ajustes{partes,minParte,descanso,minProrroga,penaltis},
//   equipos{local{id,nombre,ciclo}, visitante{...}},
//   estado: PREVIA | EN_JUEGO | DESCANSO | PRORROGA | PENALTIS | FINAL,
//   parte, etParte, inicio (ms), pausadoEn (ms|null), esperando (bool), anadido (min), prorroga (bool),
//   goles[{id, lado (equipo que suma), autor (equipo del jugador), jugador, tipo: GOL|PENAL|PROPIA,
//          minuto: '16' | '12+1' (para la hoja), tiempo: '16:23' | '12+0:35' (exacto)}],
//   tanda[{lado, gol}], ganador ('local'|'visitante'|''), finEn (ms), anterior (estado antes de FINAL, para reabrir)
import { allowsExtraTime, allowsPenalties, penaltyState } from './rules.js';
import { clockView, minuteFromTiempo, scoreOf, winnerOf } from './clock.js';

const RELOJ = ['estado', 'parte', 'etParte', 'inicio', 'pausadoEn', 'esperando', 'anadido'];
const clone = (d) => JSON.parse(JSON.stringify(d ?? {}));
const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Documento nuevo al pulsar «Iniciar 1.er tiempo».
 * @param {{n:number, ronda:string, ciclo:string, grupo:string, local:{id:string, equipo:string}, visitante:{id:string, equipo:string}}} partido
 * @param {{partes:number,minParte:number,descanso:number,minProrroga:number,penaltis:number}} ajustes
 * @param {string} desempate @param {number} now @param {Record<string,string>} [ciclos] id de equipo -> ciclo
 */
export function startMatch(partido, ajustes, desempate, now, ciclos = {}) {
  const side = (l) => ({ id: l?.id ?? '', nombre: l?.equipo ?? '', ciclo: ciclos[l?.id] ?? partido.ciclo ?? '' });
  return {
    n: partido.n, ronda: partido.ronda, ciclo: partido.ciclo ?? '', grupo: partido.grupo ?? '',
    desempate, ajustes: { ...ajustes },
    equipos: { local: side(partido.local), visitante: side(partido.visitante) },
    estado: 'EN_JUEGO', parte: 1, etParte: 0, inicio: now, pausadoEn: null, esperando: false, anadido: 0, prorroga: false,
    goles: [], tanda: [], ganador: '', anterior: null,
  };
}

/** Detener / reanudar el reloj por una incidencia. Al reanudar, el inicio se corre lo que estuvo parado. */
export function togglePause(doc, now) {
  const d = clone(doc);
  if (d.esperando) { d.esperando = false; d.inicio = now; d.pausadoEn = null; return d; }
  if (Number.isFinite(d.pausadoEn)) { d.inicio += now - d.pausadoEn; d.pausadoEn = null; } else d.pausadoEn = now;
  return d;
}

/** Minutos de añadido que indica el árbitro (solo informativo en pantalla). */
export function addAdded(doc, delta = 1) {
  const d = clone(doc);
  d.anadido = Math.max(0, (d.anadido || 0) + delta);
  return d;
}

/** ¿Qué se puede hacer al terminar el tiempo reglamentario o la prórroga? */
export function tieOptions(doc) {
  const sc = scoreOf(doc);
  if (sc.local !== sc.visitante) return { tie: false, extra: false, pens: false };
  const des = doc?.desempate ?? 'NINGUNO';
  return { tie: true, extra: allowsExtraTime(des) && !doc?.prorroga, pens: allowsPenalties(des) };
}

/**
 * «Fin de la parte». Devuelve {doc, decide}: decide=true cuando termina el último tiempo (o la prórroga) en
 * empate y hay desempate: entonces quien anota elige prórroga, penaltis o terminar.
 */
export function endPeriod(doc, now) {
  const d = clone(doc);
  const partes = d.ajustes?.partes ?? 2;
  if (d.estado === 'EN_JUEGO' && d.parte < partes) {
    Object.assign(d, { estado: 'DESCANSO', inicio: now, pausadoEn: null, esperando: false, anadido: 0 });
    return { doc: d, decide: false };
  }
  if (d.estado === 'PRORROGA' && (d.etParte || 1) < 2) {
    Object.assign(d, { etParte: 2, inicio: now, pausadoEn: null, esperando: true, anadido: 0 });
    return { doc: d, decide: false };
  }
  if (d.estado === 'EN_JUEGO' || d.estado === 'PRORROGA') {
    const o = tieOptions(d);
    if (o.tie && (o.extra || o.pens)) return { doc: d, decide: true };
    return { doc: finish(d, now), decide: false };
  }
  return { doc: d, decide: false };
}

/** «Iniciar siguiente tiempo» desde el descanso. */
export function startNextHalf(doc, now) {
  const d = clone(doc);
  if (d.estado !== 'DESCANSO') return d;
  Object.assign(d, { estado: 'EN_JUEGO', parte: (d.parte || 1) + 1, inicio: now, pausadoEn: null, esperando: false, anadido: 0 });
  return d;
}

export function startExtraTime(doc, now) {
  const d = clone(doc);
  Object.assign(d, { estado: 'PRORROGA', etParte: 1, prorroga: true, inicio: now, pausadoEn: null, esperando: false, anadido: 0 });
  return d;
}

export function startPenalties(doc) {
  const d = clone(doc);
  Object.assign(d, { estado: 'PENALTIS', tanda: [], pausadoEn: null, esperando: false });
  return d;
}

export function addPenalty(doc, lado, gol) {
  const d = clone(doc);
  if (penaltyState(d.tanda, d.ajustes?.penaltis).decided) return d;
  d.tanda = [...(d.tanda ?? []), { lado, gol: !!gol }];
  return d;
}

export function undoPenalty(doc) {
  const d = clone(doc);
  d.tanda = (d.tanda ?? []).slice(0, -1);
  return d;
}

/** Terminar el partido. Guarda el estado del reloj en `anterior` por si hay que reabrirlo. */
export function finish(doc, now) {
  const d = clone(doc);
  if (d.estado === 'FINAL') return d;
  d.anterior = Object.fromEntries(RELOJ.map((k) => [k, d[k] ?? null]));
  if (Number.isFinite(now) && !Number.isFinite(d.anterior.pausadoEn) && !d.anterior.esperando) d.anterior.pausadoEn = now;
  d.estado = 'FINAL';
  d.ganador = winnerOf(d);
  d.finEn = Number.isFinite(now) ? now : null;
  return d;
}

/** Deshacer «Final» (error al anotar): vuelve al estado anterior con el reloj detenido. */
export function reopen(doc) {
  const d = clone(doc);
  if (d.estado !== 'FINAL' || !d.anterior) return d;
  Object.assign(d, d.anterior);
  d.anterior = null;
  d.ganador = '';
  d.finEn = null;
  return d;
}

const otro = (l) => (l === 'visitante' ? 'local' : 'visitante');

/**
 * Añade un gol. `equipo` = lado del jugador que lo marca (el botón que se pulsó). En propia puerta el gol
 * suma al rival: `lado` (quién suma, como la columna ID de la hoja GOLES) es el contrario y `autor` guarda el
 * equipo del jugador. `tiempo` = tiempo de juego exacto ('16:23' o '12+0:35'); vacío = el del reloj ahora.
 * Se acepta también un minuto entero ('16', '12+1') si se corrige a mano.
 */
export function addGoal(doc, { equipo, lado, jugador, tipo = 'GOL', tiempo = '', minuto = '' }, now) {
  const d = clone(doc);
  const autor = equipo ?? lado ?? 'local';
  const suma = tipo === 'PROPIA' ? otro(autor) : autor;
  const v = clockView(d, now);
  const t = String(tiempo || minuto || '').replace(/[′'’\s]/g, '') || v.tiempo;
  const exacto = /:/.test(t) ? t : '';
  d.goles = [...(d.goles ?? []), { id: newId(), lado: suma, autor, jugador: String(jugador ?? '').trim(), tipo, minuto: minuteFromTiempo(t) || v.minute, tiempo: exacto }];
  if (d.estado === 'FINAL') d.ganador = winnerOf(d);
  return d;
}

export function removeGoal(doc, id) {
  const d = clone(doc);
  d.goles = (d.goles ?? []).filter((g) => g.id !== id);
  if (d.estado === 'FINAL') d.ganador = winnerOf(d);
  return d;
}

export function setTiebreak(doc, desempate) {
  const d = clone(doc);
  d.desempate = desempate;
  return d;
}
