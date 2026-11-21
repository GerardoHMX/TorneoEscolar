// Reglas del marcador en vivo leídas de CONFIGURACION. Puro: sin DOM ni red.
//
// Claves (todas opcionales; si faltan o no son válidas se usan las bases del torneo):
//   MARCADOR_PARTES        2    número de tiempos
//   MARCADOR_MIN_PARTE     12   minutos de cada tiempo
//   MARCADOR_DESCANSO      1    minutos de descanso entre tiempos
//   MARCADOR_MIN_PRORROGA  3    minutos de cada una de las 2 partes de la prórroga
//   MARCADOR_PENALTIS      5    lanzamientos por equipo antes de la muerte súbita
//   DESEMPATE_<RONDA>           NINGUNO | PENALTIS | PRORROGA | PRORROGA_Y_PENALTIS
// Cada partido puede fijar su propio desempate en la columna DESEMPATE de CLASIFICACION.

export const DESEMPATES = ['NINGUNO', 'PENALTIS', 'PRORROGA', 'PRORROGA_Y_PENALTIS'];

const DEFAULT_DESEMPATE = {
  INICIAL: 'NINGUNO', CUARTOS: 'PENALTIS', SEMIFINAL: 'PENALTIS', TERCERPUESTO: 'PENALTIS', FINAL: 'PRORROGA_Y_PENALTIS',
};

export const DEFAULT_SETTINGS = Object.freeze({ partes: 2, minParte: 12, descanso: 1, minProrroga: 3, penaltis: 5 });

const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

function intIn(v, min, max, def) {
  const s = String(v ?? '').trim();
  if (!/^\d+$/.test(s)) return def;
  const n = Number(s);
  return n >= min && n <= max ? n : def;
}

/** Ajustes del reloj y de la tanda de penaltis. @param {Record<string,string>} [config] */
export function liveSettings(config = {}) {
  const c = config ?? {};
  return {
    partes: intIn(c.MARCADOR_PARTES, 1, 4, DEFAULT_SETTINGS.partes),
    minParte: intIn(c.MARCADOR_MIN_PARTE, 1, 60, DEFAULT_SETTINGS.minParte),
    descanso: intIn(c.MARCADOR_DESCANSO, 0, 30, DEFAULT_SETTINGS.descanso),
    minProrroga: intIn(c.MARCADOR_MIN_PRORROGA, 1, 30, DEFAULT_SETTINGS.minProrroga),
    penaltis: intIn(c.MARCADOR_PENALTIS, 1, 10, DEFAULT_SETTINGS.penaltis),
  };
}

/** 'prorroga y penaltis' -> 'PRORROGA_Y_PENALTIS'; valor desconocido -> ''. */
export function normDesempate(v) {
  const s = fold(v).replace(/[\s-]+/g, '_').replace(/^PENALES$/, 'PENALTIS');
  return DESEMPATES.includes(s) ? s : '';
}

/**
 * Desempate de un partido: columna DESEMPATE del partido, si no DESEMPATE_<RONDA> de CONFIGURACION, si no el
 * valor por defecto de la ronda (penaltis en eliminatorias, prórroga y penaltis en la final).
 * @param {{ronda?: string, desempate?: string}} partido @param {Record<string,string>} [config]
 */
export function tiebreakFor(partido, config = {}) {
  const ronda = fold(partido?.ronda);
  return normDesempate(partido?.desempate)
    || normDesempate(config?.[`DESEMPATE_${ronda}`])
    || DEFAULT_DESEMPATE[ronda]
    || 'NINGUNO';
}

export const allowsExtraTime = (d) => String(d).startsWith('PRORROGA');
export const allowsPenalties = (d) => String(d).endsWith('PENALTIS');

/** Etiqueta legible del desempate. */
export function tiebreakLabel(d) {
  return { NINGUNO: 'Sin desempate (el empate vale)', PENALTIS: 'Penaltis', PRORROGA: 'Prórroga', PRORROGA_Y_PENALTIS: 'Prórroga y penaltis' }[d] ?? d;
}

/**
 * Estado de una tanda de penaltis. `tanda` = lanzamientos en orden [{lado:'local'|'visitante', gol:boolean}].
 * Serie de `n` por equipo y después muerte súbita (lanzamientos por parejas).
 * @returns {{local: boolean[], visitante: boolean[], goles: {local: number, visitante: number},
 *   decided: boolean, winner: 'local'|'visitante'|'', next: 'local'|'visitante'}}
 */
export function penaltyState(tanda, n = DEFAULT_SETTINGS.penaltis) {
  const local = []; const visitante = [];
  for (const t of Array.isArray(tanda) ? tanda : []) (t?.lado === 'visitante' ? visitante : local).push(!!t?.gol);
  const g = { local: local.filter(Boolean).length, visitante: visitante.filter(Boolean).length };
  let decided = false;
  if (local.length <= n && visitante.length <= n) {
    // Serie normal: decidido si uno ya no puede alcanzar al otro.
    const leftL = n - local.length; const leftV = n - visitante.length;
    decided = g.local > g.visitante + leftV || g.visitante > g.local + leftL;
  }
  if (!decided && local.length >= n && visitante.length >= n && local.length === visitante.length) {
    decided = g.local !== g.visitante;
  }
  const winner = decided ? (g.local > g.visitante ? 'local' : 'visitante') : '';
  const next = local.length > visitante.length ? 'visitante' : 'local';
  return { local, visitante, goles: g, decided, winner, next };
}
