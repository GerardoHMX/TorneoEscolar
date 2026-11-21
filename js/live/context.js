// Datos de la pantalla del marcador a partir del modelo del sitio (hojas de Google Sheets) y del documento en
// vivo (Firestore). Puro: sin DOM ni red; «hoy» y «ahora» llegan por parámetro.
import { dayKey } from '../sections/dates.js';
import { sortStandings } from '../sections/standings.js';
import { normalizeName } from '../data/goals.js';
import { scoreOf } from './clock.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel */
/** @typedef {import('../data/models.js').Partido} Partido */

const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const named = (l) => String(l?.equipo ?? '').trim() !== '';
const ELIM = ['CUARTOS', 'SEMIFINAL'];
export const CICLO_NOMBRE = { ESO: 'ESO', BCH: 'Bachillerato' };
const RONDA_NOMBRE = { CUARTOS: 'Cuartos de final', SEMIFINAL: 'Semifinal', TERCERPUESTO: 'Tercer puesto', FINAL: 'Final' };

export const findMatch = (model, n) => (model?.partidos ?? []).find((p) => String(p.n) === String(n)) ?? null;
const conNombre = (model) => fold(model?.config?.EQUIPOS_CON_NOMBRE) === 'si';

/** Rótulos de la columna central: fase (pequeño) y grupo o ronda (grande). */
export function phaseLabels(p) {
  if (!p) return { phase: '', round: '' };
  const ciclo = CICLO_NOMBRE[p.ciclo] ?? p.ciclo;
  if (p.ronda === 'INICIAL') return { phase: `Fase de grupos${ciclo ? ` · ${ciclo}` : ''}`, round: p.grupo ? `Grupo ${p.grupo}` : 'Fase de grupos' };
  if (p.interciclo) return { phase: 'ESO vs Bachillerato', round: RONDA_NOMBRE[p.ronda] ?? p.ronda };
  return { phase: `Eliminatoria${ciclo ? ` · ${ciclo}` : ''}`, round: RONDA_NOMBRE[p.ronda] ?? p.ronda };
}

/**
 * Equipo para pantalla: nombre grande y curso debajo (solo si EQUIPOS_CON_NOMBRE = SI); el logo ya viene
 * vacío si EQUIPOS_CON_LOGO = NO (applyTeamDisplay), y entonces se pinta el monograma.
 */
export function teamView(model, lado) {
  const nombre = named(lado) ? String(lado.equipo).trim() : 'Por definir';
  const eq = (model?.equipos ?? []).find((e) => e.id && e.id === lado?.id);
  const curso = conNombre(model) && eq?.curso && fold(eq.curso) !== fold(nombre) ? eq.curso : '';
  return { id: lado?.id ?? '', nombre, curso, logo: lado?.logo ?? '' };
}

const minStr = (m) => (m ? (m.extra ? `${m.base}+${m.extra}` : String(m.base)) : '');

/**
 * Goles y marcador a mostrar: los del documento en vivo si existe; si no, los del libro (partido JUGADO).
 * @returns {{goles: {id:string, lado:'local'|'visitante', jugador:string, tipo:string, minuto:string}[],
 *   score: {local:number, visitante:number}|null}}
 */
export function matchGoals(model, p, doc) {
  if (doc) return { goles: (doc.goles ?? []).slice(), score: scoreOf(doc) };
  if (!p || p.estatus !== 'JUGADO') return { goles: [], score: null };
  const g = model?.goalsByMatch?.get?.(p.key);
  const map = (lado) => (gol, i) => ({ id: `${lado}${i}`, lado, jugador: gol.jugador, tipo: gol.tipo, minuto: minStr(gol.minuto) });
  const goles = g ? [...(g.local ?? []).map(map('local')), ...(g.visitante ?? []).map(map('visitante'))] : [];
  return {
    goles,
    score: { local: Number.isFinite(p.local?.score) ? p.local.score : 0, visitante: Number.isFinite(p.visitante?.score) ? p.visitante.score : 0 },
  };
}

/** ¿El resultado en vivo todavía no está en la hoja? (si ya está JUGADO, no se suma dos veces). */
const pendingInSheet = (p, score) => !!score && p?.estatus !== 'JUGADO';

/**
 * Clasificación del grupo con el resultado en vivo aplicado.
 * @returns {{equipo:string, pj:number, dg:number, pts:number, playing:boolean, move:''|'up'|'down'}[]}
 */
export function liveStandings(model, p, score) {
  const rows = (model?.tabla ?? []).filter((r) => r.ciclo === p.ciclo && r.grupo === p.grupo).map((r) => ({ ...r }));
  const before = sortStandings(rows).map((r) => fold(r.equipo));
  const L = fold(p.local?.equipo); const V = fold(p.visitante?.equipo);
  if (pendingInSheet(p, score)) {
    for (const r of rows) {
      const f = fold(r.equipo);
      if (f !== L && f !== V) continue;
      const mine = f === L ? score.local : score.visitante;
      const other = f === L ? score.visitante : score.local;
      const pts = mine > other ? 3 : mine === other ? 1 : 0;
      if (mine > other) r.g += 1; else if (mine === other) r.e += 1; else r.p += 1;
      r.gf += mine; r.gc += other; r.dg += mine - other; r.puntos += pts; r.total += pts;
    }
  }
  return sortStandings(rows).map((r, i) => {
    const f = fold(r.equipo);
    const was = before.indexOf(f);
    return {
      equipo: r.equipo, pj: r.g + r.e + r.p, dg: r.dg, pts: r.puntos,
      playing: f === L || f === V, move: was < 0 || was === i ? '' : (was > i ? 'up' : 'down'),
    };
  });
}

const scoreTxt = (p) => (p?.estatus === 'JUGADO' && Number.isFinite(p.local?.score) ? `${p.local.score}–${p.visitante?.score ?? 0}` : '');

/**
 * Cuadro de eliminatorias del ciclo del partido (cuartos y semifinales) más la final.
 * @returns {{title:string, matches:{local:string, visitante:string, score:string, when:string, live:boolean, lead:''|'local'|'visitante'}[]}[]}
 */
export function bracketOf(model, p, score, today) {
  const ciclo = p.interciclo ? '' : p.ciclo;
  const all = (model?.partidos ?? []).filter((x) => x && !x.interciclo && x.ciclo === ciclo && ELIM.includes(x.ronda));
  const col = (ronda, title) => ({
    title,
    matches: all.filter((x) => x.ronda === ronda).sort((a, b) => a.n - b.n).map((x) => cell(x)),
  });
  const cell = (x) => {
    const live = x.key === p.key;
    const sc = live && score ? `${score.local}–${score.visitante}` : scoreTxt(x);
    const lead = live && score ? (score.local > score.visitante ? 'local' : score.visitante > score.local ? 'visitante' : '') : '';
    return {
      local: named(x.local) ? x.local.equipo : 'Por definir', visitante: named(x.visitante) ? x.visitante.equipo : 'Por definir',
      score: sc, when: sc ? '' : dayLabel(x.fecha, today, x.hora), live, lead,
    };
  };
  const fin = (model?.partidos ?? []).find((x) => x?.ronda === 'FINAL');
  const cols = [col('CUARTOS', 'Cuartos'), col('SEMIFINAL', 'Semifinales')];
  if (fin) cols.push({ title: 'Final', matches: [cell(fin)] });
  return cols.filter((c) => c.matches.length);
}

/**
 * Camino de un equipo hasta este partido: puesto en su grupo y resultados de eliminatoria ya jugados.
 * @returns {{ronda:string, texto:string}[]}
 */
export function roadOf(model, lado, p) {
  const name = fold(lado?.equipo);
  if (!name) return [];
  const out = [];
  const fila = (model?.tabla ?? []).find((r) => fold(r.equipo) === name);
  if (fila) {
    const grupo = sortStandings((model.tabla ?? []).filter((r) => r.ciclo === fila.ciclo && r.grupo === fila.grupo));
    const pos = grupo.findIndex((r) => fold(r.equipo) === name) + 1;
    out.push({ ronda: 'Grupos', texto: `${pos}.º del grupo ${fila.grupo} · ${fila.puntos} pts` });
  }
  const jugados = (model?.partidos ?? [])
    .filter((x) => x && x.key !== p?.key && x.estatus === 'JUGADO' && x.ronda !== 'INICIAL' && (fold(x.local?.equipo) === name || fold(x.visitante?.equipo) === name))
    .sort((a, b) => a.n - b.n);
  for (const x of jugados) {
    const local = fold(x.local?.equipo) === name;
    const mine = local ? x.local?.score : x.visitante?.score;
    const other = local ? x.visitante?.score : x.local?.score;
    const rival = local ? x.visitante?.equipo : x.local?.equipo;
    const pen = mine === other && x.pasa ? ` (pasa ${fold(x.pasa) === name ? 'por penaltis' : 'el rival'})` : '';
    out.push({ ronda: x.ronda === 'CUARTOS' ? 'Cuartos' : x.ronda === 'SEMIFINAL' ? 'Semis' : (RONDA_NOMBRE[x.ronda] ?? x.ronda), texto: `${mine ?? '–'}–${other ?? '–'} vs ${rival}${pen}` });
  }
  return out;
}

/**
 * Goleadores del torneo sumando los goles en vivo que aún no están en la hoja GOLES.
 * @param {{ciclo?: string, equipos?: string[]}} [filtro] ciclo (ESO/BCH) o ids de equipo
 * @returns {{jugador:string, equipo:string, equipoId:string, goles:number, live:boolean}[]}
 */
export function scorersLive(model, p, doc, filtro = {}) {
  const map = new Map();
  for (const s of model?.scorers ?? []) {
    map.set(`${s.equipoId}|${normalizeName(s.jugador)}`, { jugador: s.jugador, equipo: s.equipo, equipoId: s.equipoId, ciclo: s.ciclo, goles: s.goles, live: false });
  }
  const yaEnHoja = (model?.goles ?? []).some((g) => String(g.n) === String(p?.n));
  if (doc && !yaEnHoja) {
    for (const g of doc.goles ?? []) {
      if (g.tipo === 'PROPIA' || !String(g.jugador ?? '').trim()) continue;
      const lado = p?.[g.lado === 'visitante' ? 'visitante' : 'local'];
      const k = `${lado?.id ?? ''}|${normalizeName(g.jugador)}`;
      const cur = map.get(k) ?? { jugador: g.jugador, equipo: lado?.equipo ?? '', equipoId: lado?.id ?? '', ciclo: doc.equipos?.[g.lado]?.ciclo ?? p?.ciclo ?? '', goles: 0, live: false };
      cur.goles += 1;
      map.set(k, cur);
    }
  }
  const ids = [p?.local?.id, p?.visitante?.id].filter(Boolean);
  return [...map.values()]
    .map((s) => ({ ...s, live: ids.includes(s.equipoId) }))
    .filter((s) => (!filtro.ciclo || s.ciclo === filtro.ciclo) && (!filtro.equipos || filtro.equipos.includes(s.equipoId)))
    .sort((a, b) => b.goles - a.goles || a.jugador.localeCompare(b.jugador, 'es'));
}

/** Fecha y hora de inicio (Date) o null. */
export function matchStart(p) {
  if (dayKey(p?.fecha) === null) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(p.hora ?? ''));
  const d = new Date(p.fecha.getFullYear(), p.fecha.getMonth(), p.fecha.getDate(), m ? Number(m[1]) : 0, m ? Number(m[2]) : 0);
  return d;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
/** 'Hoy 10:15', 'Mañana', 'jue 4 dic', 'Ayer'. */
export function dayLabel(fecha, today, hora = '') {
  const k = dayKey(fecha); const t = dayKey(today);
  if (k === null) return 'Por confirmar';
  const diff = t === null ? NaN : Math.round((k - t) / 86400000);
  const base = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : diff === -1 ? 'Ayer' : `${DIAS[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
  return diff === 0 && hora ? `${base} ${hora}` : base;
}

const chrono = (a, b) => (matchStart(a)?.getTime() ?? Infinity) - (matchStart(b)?.getTime() ?? Infinity) || a.n - b.n;

/** Partidos sin jugar con los dos equipos definidos, en orden cronológico. */
export function pendingMatches(model) {
  return (model?.partidos ?? []).filter((p) => p && p.estatus !== 'JUGADO' && named(p.local) && named(p.visitante)).sort(chrono);
}

/** Próximos partidos desde hoy (sin `excludeKey`). */
export function upcoming(model, today, excludeKey, count = 4) {
  const t = dayKey(today) ?? 0;
  return pendingMatches(model).filter((p) => p.key !== excludeKey && (dayKey(p.fecha) ?? Infinity) >= t).slice(0, count);
}

/** Últimos resultados (más recientes primero). */
export function recent(model, count = 4, excludeKey = '') {
  return (model?.partidos ?? [])
    .filter((p) => p && p.estatus === 'JUGADO' && p.key !== excludeKey)
    .sort((a, b) => -chrono(a, b))
    .slice(0, count);
}

/** Primer partido pendiente de hoy o posterior (para la pantalla «entre partidos»). */
export function nextMatch(model, today) {
  return upcoming(model, today, '', 1)[0] ?? null;
}

/** Partidos de hoy (jugados o no), en orden. */
export function todaysMatches(model, today) {
  const t = dayKey(today);
  return (model?.partidos ?? []).filter((p) => p && t !== null && dayKey(p.fecha) === t).sort(chrono);
}

/** Nombre corto de ronda para tablas. */
export const rondaCorta = (p) => (p.ronda === 'INICIAL' ? `Grupo ${p.grupo}` : (RONDA_NOMBRE[p.ronda] ?? p.ronda));
