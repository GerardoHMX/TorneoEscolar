// Filas crudas de las hojas (loadAll) -> AppModel. Puro: sin DOM, testeable en Node.
// Nunca lanza: una hoja ausente, vacía o con basura deja su parte del modelo vacía (spec §6).
import {
  parseEquipos, parsePartidos, parseTabla, parsePodio, parseGoles, parseLideres, parseSanciones,
  parseNoticias, parseGaleria, parseOtros, parseConfig,
} from './models.js';
import { goalsByMatch, scorersWithFallback, unknownMatchGoals } from './goals.js';
import { emptyModel } from './appModel.js';

/** @typedef {import('./appModel.js').AppModel} AppModel */
/** @typedef {Record<string, string[][]>} RawData */

export const SHEETS = ['EQUIPOS', 'CLASIFICACION', 'GOLES', 'LIDERES', 'SANCIONES', 'NOTICIAS', 'GALERIA', 'OTROS', 'CONFIGURACION'];

/** Solo filas que son arrays; cada celda a string (null/undefined -> ''). */
function rowsOf(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(Array.isArray).map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))));
}

function safe(label, fn, fallback) {
  try {
    const out = fn();
    return out ?? fallback;
  } catch (err) {
    console.warn(`[buildModel] ${label}:`, err);
    return fallback;
  }
}

/**
 * Avisos en consola del spec §8.1/§8.5, agregados (uno por clase, no uno por fila): filas de EQUIPOS
 * ignoradas (ID inexistente, duplicado, incompleto…) y goles con un NPartido que no existe.
 */
function warnData(equipos, goles, partidos) {
  try {
    const w = Array.isArray(equipos?.warnings) ? equipos.warnings : [];
    if (w.length) console.warn(`[buildModel] EQUIPOS: ${w.length} fila(s) ignorada(s):`, w);
    const lost = unknownMatchGoals(goles, partidos);
    if (lost) console.warn(`[buildModel] GOLES: ${lost} gol(es) con un NPartido que no existe en CLASIFICACION; no se asignan a ningún partido.`);
  } catch { /* un aviso nunca debe romper el modelo */ }
}

/**
 * @param {Partial<RawData> | null | undefined} raw
 * @returns {AppModel}
 */
export function buildModel(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const base = emptyModel();
  const rows = (n) => rowsOf(r[n]);
  const equipos = safe('EQUIPOS', () => parseEquipos(rows('EQUIPOS')), base.equipos);
  const clas = rows('CLASIFICACION');
  const partidos = safe('partidos', () => parsePartidos(clas, equipos), base.partidos);
  const goles = safe('GOLES', () => parseGoles(rows('GOLES'), equipos), base.goles);
  const lideres = safe('LIDERES', () => parseLideres(rows('LIDERES'), equipos), base.lideres);
  warnData(equipos, goles, partidos);
  return {
    equipos,
    partidos,
    tabla: safe('tabla', () => parseTabla(clas), base.tabla),
    podio: safe('podio', () => parsePodio(clas), base.podio),
    goles,
    goalsByMatch: safe('goalsByMatch', () => goalsByMatch(goles, partidos), base.goalsByMatch),
    scorers: safe('scorers', () => scorersWithFallback(goles, lideres, equipos), base.scorers),
    lideres,
    sanciones: safe('SANCIONES', () => parseSanciones(rows('SANCIONES'), equipos), base.sanciones),
    noticias: safe('NOTICIAS', () => parseNoticias(rows('NOTICIAS')), base.noticias),
    galeria: safe('GALERIA', () => parseGaleria(rows('GALERIA')), base.galeria),
    otros: safe('OTROS', () => parseOtros(rows('OTROS')), base.otros),
    config: safe('CONFIGURACION', () => parseConfig(rows('CONFIGURACION')), base.config),
  };
}

/**
 * Datos de un refresco sobre los anteriores: una hoja que tenía filas y llega vacía (fallo transitorio de
 * red o de caché) conserva las filas anteriores; las demás se aceptan tal cual.
 * @param {Partial<RawData> | null} prev @param {Partial<RawData>} next @returns {Partial<RawData>}
 */
export function mergeRaw(prev, next) {
  const out = { ...(next ?? {}) };
  if (!prev) return out;
  for (const k of Object.keys(out)) {
    const n = out[k];
    const p = prev[k];
    if ((!Array.isArray(n) || n.length === 0) && Array.isArray(p) && p.length > 0) out[k] = p;
  }
  return out;
}
