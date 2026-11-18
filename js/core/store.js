// Caché de texto sobre localStorage (con respaldo a sessionStorage / memoria) con TTL. Testeable en Node (todo inyectable).
// Dentro del TTL se sirve sin red; pasado el TTL, peekText() permite pintar al instante con la última copia
// (hasta MAX_STALE_MS) mientras se revalida en segundo plano (stale-while-revalidate).
export const DEFAULT_TTL_MS = 60000;
export const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const memory = new Map();

const memStorage = {
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
};

function defaultStorage() {
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const s = globalThis[name];
      if (s) return s;
    } catch { /* acceso denegado */ }
  }
  return memStorage;
}

function readEntry(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (raw == null) return null;
    const e = JSON.parse(raw);
    if (e && typeof e.t === 'number' && typeof e.text === 'string') return e;
  } catch { /* storage roto o JSON corrupto: miss */ }
  return null;
}

function writeEntry(storage, key, entry) {
  try { storage.setItem(key, JSON.stringify(entry)); } catch { /* lleno o bloqueado: ignorar */ }
}

export async function cachedText(url, opts = {}) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const fetchImpl = opts.fetchImpl ?? ((...a) => globalThis.fetch(...a));
  const now = opts.now ?? Date.now;
  const storage = opts.storage ?? defaultStorage();
  const key = `sheet:${url}`;
  const cached = readEntry(storage, key);
  if (cached && ttlMs > 0 && now() - cached.t < ttlMs) return cached.text;
  try {
    const res = await fetchImpl(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${url}`);
    const text = await res.text();
    writeEntry(storage, key, { t: now(), text });
    return text;
  } catch (err) {
    if (cached) return cached.text;
    throw err;
  }
}

/** Última copia guardada (aunque haya caducado su TTL) si no supera `maxStaleMs`; null si no hay. Sin red. */
export function peekText(url, opts = {}) {
  const maxStaleMs = opts.maxStaleMs ?? MAX_STALE_MS;
  const now = opts.now ?? Date.now;
  const e = readEntry(opts.storage ?? defaultStorage(), `sheet:${url}`);
  return e && now() - e.t <= maxStaleMs ? e.text : null;
}
