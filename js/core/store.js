// Caché de texto sobre sessionStorage con TTL. Testeable en Node (todo inyectable).
export const DEFAULT_TTL_MS = 60000;
const memory = new Map();

const memStorage = {
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
};

function defaultStorage() {
  try {
    const s = globalThis.sessionStorage;
    if (s) return s;
  } catch { /* acceso denegado */ }
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
