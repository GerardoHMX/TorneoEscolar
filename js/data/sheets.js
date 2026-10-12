// Carga de las hojas publicadas de Google Sheets. Cambiar de libro = editar solo estas constantes.
import { parseCSV } from '../core/csv.js';
import { cachedText } from '../core/store.js';

export const SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRD7HCUFU5YZrxfs-8RMQM3omn8Cyt3yrep9vKRzq8v2nN-ilu69I7BZtbDmGqkMvNAPfv3TdykSTFP/pub';
export const GIDS = {
  EQUIPOS: 717093211, CLASIFICACION: 1494377213, GOLES: 364435654, LIDERES: 94006814,
  SANCIONES: 1817139133, NOTICIAS: 1432880770, GALERIA: 897431487, OTROS: 886561238,
  CONFIGURACION: 308146084,
};

export function sheetUrl(name) {
  // Sin Object.hasOwn: no existe en Safari < 15.4 / Chrome < 93.
  if (!Object.prototype.hasOwnProperty.call(GIDS, name)) throw new Error(`Hoja desconocida: ${name}`);
  return `${SHEET_BASE}?gid=${GIDS[name]}&single=true&output=csv`;
}

/**
 * Como loadAll, pero además dice qué hojas fallaron (red, HTTP, parseo): `{raw, failed}`. Permite distinguir
 * «no se pudo cargar» de «cargó, pero aún no hay nada publicado» (inicio de temporada).
 */
export async function loadAllWithStatus(opts = {}) {
  const names = Object.keys(GIDS);
  const results = await Promise.allSettled(
    names.map(n => cachedText(sheetUrl(n), opts).then(parseCSV)),
  );
  const raw = {};
  const failed = [];
  names.forEach((n, i) => {
    const ok = results[i].status === 'fulfilled';
    raw[n] = ok ? results[i].value : [];
    if (!ok) failed.push(n);
  });
  return { raw, failed };
}

/** Carga todas las hojas; una hoja que falla queda como []. */
export async function loadAll(opts = {}) {
  return (await loadAllWithStatus(opts)).raw;
}

/** 'failed' si alguna hoja falló (o no hay estado: la carga lanzó); 'empty' si todo cargó. */
export function loadOutcome(failed) {
  return Array.isArray(failed) && failed.length === 0 ? 'empty' : 'failed';
}

/** Revalida en segundo plano; llama cb solo si los datos cambian. Devuelve la función para cancelar. */
export function onUpdate(cb, opts = {}) {
  const {
    intervalMs = 120000,
    loader = () => loadAll({ ttlMs: 0 }),
    visibility = () => (typeof document !== 'undefined' ? document.visibilityState : 'visible'),
    setIntervalImpl = (f, ms) => setInterval(f, ms),
    clearIntervalImpl = id => clearInterval(id),
  } = opts;
  let last = opts.initial !== undefined ? JSON.stringify(opts.initial) : null;
  let busy = false;
  const id = setIntervalImpl(async () => {
    if (busy || visibility() !== 'visible') return;
    busy = true;
    try {
      const raw = await loader();
      const sig = JSON.stringify(raw);
      const changed = last !== null && sig !== last;
      last = sig;
      if (changed) cb(raw);
    } catch { /* conservar los últimos datos */ } finally { busy = false; }
  }, intervalMs);
  return () => clearIntervalImpl(id);
}
