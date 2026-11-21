// Reloj del marcador en vivo. Puro salvo calibrate(): el resto recibe «ahora» por parámetro.
//
// El reloj no se envía segundo a segundo: el documento del partido guarda la hora (ms) a la que empezó la
// parte en curso (`inicio`) y, si está detenido, desde cuándo (`pausadoEn`). Cada pantalla calcula el tiempo
// por su cuenta, así que todas van sincronizadas aunque la conexión se retrase. Reloj corrido: solo se
// detiene si quien anota lo para por una incidencia.
import { DEFAULT_SETTINGS, penaltyState } from './rules.js';

/** @typedef {'PREVIA'|'EN_JUEGO'|'DESCANSO'|'PRORROGA'|'PENALTIS'|'FINAL'} Estado */

let offsetMs = 0;

/** Hora «real» (ms): la del dispositivo corregida con la cabecera Date del servidor del sitio. */
export const serverNow = () => Date.now() + offsetMs;

/**
 * Ajusta el desfase del reloj del dispositivo con la cabecera Date de una petición HEAD al propio sitio
 * (precisión ~1 s; los televisores y móviles suelen ir bien, pero algunos van minutos desfasados).
 */
export async function calibrate(url = location.href) {
  try {
    const t0 = Date.now();
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const t1 = Date.now();
    const d = Date.parse(res.headers.get('date') ?? '');
    if (!Number.isFinite(d)) return;
    const off = d + 500 - (t0 + t1) / 2; // Date va en segundos enteros: +0,5 s de media
    if (Math.abs(off) > 1500) offsetMs = off;
  } catch { /* sin red: se usa el reloj del dispositivo */ }
}

export const pad2 = (n) => String(n).padStart(2, '0');
/** 462 -> '07:42'; negativo -> '00:00'. */
export function mmss(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

/** Ordinal de tiempo: 1 -> '1.er tiempo', 2 -> '2.º tiempo'. */
export const tiempoLabel = (p) => `${p}.${p === 1 || p === 3 ? 'er' : 'º'} tiempo`;

const settingsOf = (doc) => ({ ...DEFAULT_SETTINGS, ...(doc?.ajustes ?? {}) });

/** Marcador por goles: un gol cuenta para `lado` (en propia puerta, `lado` es el equipo que suma). */
export function scoreOf(doc) {
  const goles = Array.isArray(doc?.goles) ? doc.goles : [];
  return {
    local: goles.filter((g) => g?.lado === 'local').length,
    visitante: goles.filter((g) => g?.lado === 'visitante').length,
  };
}

/**
 * Tiempo exacto -> minuto entero para la hoja: '16:23' -> '16', '00:40' -> '1', '12+0:35' -> '12+1'.
 * También acepta minutos ya enteros ('16', '12+1'). Formato no válido -> ''.
 */
export function minuteFromTiempo(t) {
  const s = String(t ?? '').replace(/[′'’\s]/g, '');
  let m = /^(\d{1,3}):(\d{2})$/.exec(s);
  if (m) return String(Math.max(1, Number(m[1])));
  m = /^(\d{1,3})\+(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return `${m[1]}+${Math.max(1, Number(m[2]))}`;
  m = /^(\d{1,3})(?:\+(\d{1,2}))?$/.exec(s);
  if (m) return m[2] ? `${m[1]}+${m[2]}` : m[1];
  return '';
}

/** Posición en minutos (decimales) de un gol en la línea de tiempo, por su tiempo exacto o su minuto. */
export function goalPosition(g) {
  const s = String(g?.tiempo ?? '');
  let m = /^(\d+):(\d{2})$/.exec(s);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  m = /^(\d+)\+/.exec(s);
  if (m) return Number(m[1]);
  const r = splitMinute(g?.minuto);
  if (!r) return null;
  return r.extra ? r.base : Math.max(0, r.base - 0.5);
}

/** Texto del momento de un gol: el tiempo exacto si lo hay ('16:23'), si no el minuto ('16′'). */
export const goalTime = (g) => (g?.tiempo ? String(g.tiempo) : g?.minuto ? `${g.minuto}′` : '');

/** '12+1' -> {base: 12, extra: 1}. */
export function splitMinute(m) {
  const r = /^(\d+)(?:\+(\d+))?/.exec(String(m ?? ''));
  return r ? { base: Number(r[1]), extra: r[2] ? Number(r[2]) : 0 } : null;
}

/**
 * Vista del reloj en un instante.
 * @param {object|null} doc documento del partido (o null = aún no empezó)
 * @param {number} now ms
 * @returns {{estado: Estado, running: boolean, paused: boolean, remaining: number, added: boolean,
 *   display: string, left: string, period: string, elapsedMin: number, totalMin: number, minute: string, tiempo: string}}
 *   display: en juego, el tiempo transcurrido ('16:23'; en el añadido '+0:35'); en el descanso, la cuenta atrás.
 *   left: lo que queda de la parte ('Quedan 07:37'); en el añadido, '12′ cumplidos'; '' fuera del juego.
 *   addedAt: minuto en que terminó el tiempo reglamentario de la parte si se está en el añadido (12, 24…); si no, null.
 *   tiempo: tiempo de juego exacto ahora ('16:23'; en el añadido '12+0:35'); '' si no se puede marcar.
 *   minute: minuto entero para la hoja GOLES ('16', '12+1'), sacado de `tiempo`.
 */
export function clockView(doc, now) {
  const s = settingsOf(doc);
  const estado = doc?.estado ?? 'PREVIA';
  const regular = s.partes * s.minParte;
  const totalMin = regular + (doc?.prorroga ? 2 * s.minProrroga : 0);
  const base = { estado, running: false, paused: false, remaining: 0, added: false, display: '', left: '', period: '', elapsedMin: 0, totalMin, minute: '', tiempo: '' };

  const elapsedSec = () => {
    if (doc?.esperando || !Number.isFinite(doc?.inicio)) return 0;
    const ref = Number.isFinite(doc?.pausadoEn) ? doc.pausadoEn : now;
    return Math.max(0, (ref - doc.inicio) / 1000);
  };

  if (estado === 'EN_JUEGO' || estado === 'PRORROGA') {
    const extra = estado === 'PRORROGA';
    const p = extra ? (doc.etParte || 1) : (doc.parte || 1);
    const durMin = extra ? s.minProrroga : s.minParte;
    const startMin = extra ? regular + (p - 1) * s.minProrroga : (p - 1) * s.minParte;
    const el = elapsedSec();
    const remaining = durMin * 60 - el;
    const added = remaining < 0;
    const paused = Number.isFinite(doc?.pausadoEn) || !!doc?.esperando;
    const tiempo = added
      ? `${startMin + durMin}+${Math.floor(-remaining / 60)}:${pad2(Math.floor(-remaining) % 60)}`
      : `${pad2(Math.floor(startMin + el / 60))}:${pad2(Math.floor(el) % 60)}`;
    const minute = minuteFromTiempo(tiempo);
    let period = extra ? `Prórroga · ${p}.ª parte` : tiempoLabel(p);
    if (added) period = `Tiempo añadido${doc?.anadido ? ` +${doc.anadido}′` : ''}`;
    if (doc?.esperando) period = extra ? `Prórroga · ${p}.ª parte · por empezar` : `${tiempoLabel(p)} · por empezar`;
    else if (paused) period = 'Reloj detenido';
    return {
      ...base, running: !paused, paused, remaining, added,
      // En grande, el tiempo transcurrido del partido; en pequeño (`left`), lo que queda de la parte.
      display: added ? `+${Math.floor(-remaining / 60)}:${pad2(Math.floor(-remaining) % 60)}` : tiempo,
      left: added ? `${startMin + durMin}′ cumplidos` : `Quedan ${mmss(Math.ceil(remaining))}`,
      addedAt: added ? startMin + durMin : null,
      period, elapsedMin: Math.min(startMin + durMin, startMin + el / 60), minute, tiempo,
    };
  }
  if (estado === 'DESCANSO') {
    const remaining = s.descanso * 60 - elapsedSec();
    return { ...base, running: remaining > 0, remaining, display: mmss(Math.ceil(remaining)), period: 'Descanso', elapsedMin: (doc.parte || 1) * s.minParte };
  }
  if (estado === 'PENALTIS') {
    const ps = penaltyState(doc?.tanda, s.penaltis);
    return { ...base, display: `${ps.goles.local}–${ps.goles.visitante}`, period: 'Penaltis', elapsedMin: totalMin };
  }
  if (estado === 'FINAL') return { ...base, display: 'FINAL', period: 'Final del partido', elapsedMin: totalMin };
  return { ...base, display: '', period: 'Previa' };
}

/** Lado ganador de un documento terminado (goles y, si hubo empate, penaltis). '' = empate. */
export function winnerOf(doc) {
  const sc = scoreOf(doc);
  if (sc.local !== sc.visitante) return sc.local > sc.visitante ? 'local' : 'visitante';
  const ps = penaltyState(doc?.tanda, settingsOf(doc).penaltis);
  return ps.decided ? ps.winner : '';
}
