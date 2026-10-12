// Fechas puras para la navegación por días (Próximos partidos). Sin DOM ni `new Date()` implícito:
// «hoy» siempre llega por parámetro para que los tests sean deterministas.
//
// Regla heredada (main.js: encontrarDiasRelevantes): solo se navega por días CON partidos; los días
// vacíos se saltan. El antiguo «saltar fines de semana» era un atajo para eso mismo, así que aquí un
// sábado con partidos sí se muestra (no se pierde ningún partido).

/** Medianoche local (ms) de una fecha, o null si no es una fecha válida. */
export function dayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Días (ms de medianoche local) con al menos un partido fechado, únicos y ordenados. */
export function matchDays(partidos) {
  const set = new Set();
  for (const p of partidos ?? []) {
    const k = dayKey(p?.fecha);
    if (k !== null) set.add(k);
  }
  return [...set].sort((a, b) => a - b);
}

/** Primer día con partidos en/tras `today`; si ya pasaron todos, el último; sin días, null. */
export function pickInitialDay(days, today) {
  if (!days?.length) return null;
  const k = dayKey(today);
  const next = k === null ? undefined : days.find((d) => d >= k);
  return next ?? days[days.length - 1];
}

/** Ajusta un inicio de ventana arbitrario a un día con partidos (el mismo o el siguiente; si no, el último). */
export function windowStart(days, start) {
  if (!days?.length) return null;
  if (typeof start !== 'number' || !Number.isFinite(start)) return days[0];
  return days.find((d) => d >= start) ?? days[days.length - 1];
}

/** Ventana visible: hasta `size` días con partidos a partir de `start`. */
export function dayWindow(days, start, size = 2) {
  const s = windowStart(days, start);
  if (s === null) return [];
  const i = days.indexOf(s);
  return days.slice(i, i + size);
}

/** Inicio de ventana tras moverse un día con partidos hacia `dir` (±1), sin salirse de la lista. */
export function stepDay(days, start, dir) {
  const s = windowStart(days, start);
  if (s === null) return null;
  const i = Math.min(Math.max(days.indexOf(s) + Math.sign(dir), 0), days.length - 1);
  return days[i];
}

/**
 * ¿Hay algo nuevo que ver en esa dirección? Atrás: existe un día anterior. Adelante: existe un día
 * que la ventana actual aún no muestra.
 */
export function canStep(days, start, dir, size = 2) {
  const s = windowStart(days, start);
  if (s === null) return false;
  const i = days.indexOf(s);
  return dir < 0 ? i > 0 : i + size < days.length;
}

// ---- Noticias y Galería: elementos con FECHA de texto «DD/MM/AAAA» (portado de main.js:
// encontrarDiasRelevantesNoticias/Galeria + filtrarNoticiasPorFecha/filtrarGaleriaPorFecha).
// Se navega un día CON elementos cada vez; los días vacíos se saltan.

/** «DD/MM/AAAA» o «DD/MM/AA» (20AA) -> Date a medianoche local; fechas imposibles o basura -> null. */
export function parseDMY(s) {
  const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const [d, mo] = [Number(m[1]), Number(m[2])];
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/**
 * Agrupa elementos por día. `undated` = los que no tienen fecha legible (no se pierden: ver itemsForDay).
 * @template T @param {T[]} items @param {(x: T) => string} fechaOf
 * @returns {{days: number[], byDay: Map<number, T[]>, undated: T[]}}
 */
export function groupByDay(items, fechaOf) {
  const byDay = new Map();
  const undated = [];
  for (const it of items ?? []) {
    const key = dayKey(parseDMY(fechaOf(it)));
    if (key === null) { undated.push(it); continue; }
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(it);
  }
  return { days: [...byDay.keys()].sort((a, b) => a - b), byDay, undated };
}

/**
 * Día inicial: hoy si tiene elementos; si no, el más reciente ya pasado; si todo es futuro, el primero.
 * (El sitio antiguo buscaba primero el día futuro más lejano en 60 días; para noticias lo natural es lo último publicado.)
 */
export function pickLatestDay(days, today) {
  if (!days?.length) return null;
  const k = dayKey(today);
  if (k === null) return days[days.length - 1];
  const past = days.filter((d) => d <= k);
  return past.length ? past[past.length - 1] : days[0];
}

/**
 * Elementos que se ven en `day` (como filtrar*PorFecha): los de ese día y, si solo hay uno, hasta `fill`
 * de días anteriores (el más cercano primero) marcados `extra`. Los sin fecha se añaden al ver el último
 * día; sin ningún día con fecha, se devuelven todos ellos.
 * @template T @param {{days: number[], byDay: Map<number, T[]>, undated: T[]}} group
 * @returns {{item: T, day: number|null, extra: boolean}[]}
 */
export function itemsForDay(group, day, fill = 2) {
  const { days = [], byDay = new Map(), undated = [] } = group ?? {};
  const loose = undated.map((item) => ({ item, day: null, extra: false }));
  if (!days.length) return loose;
  const d = windowStart(days, day);
  const out = (byDay.get(d) ?? []).map((item) => ({ item, day: d, extra: false }));
  if (out.length === 1) {
    for (let i = days.indexOf(d) - 1, left = fill; i >= 0 && left > 0; i -= 1) {
      for (const item of byDay.get(days[i]).slice(0, left)) { out.push({ item, day: days[i], extra: true }); left -= 1; }
    }
  }
  return d === days[days.length - 1] ? [...out, ...loose] : out;
}

const FORMATS = {
  full: { day: 'numeric', month: 'long', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  short: { weekday: 'short', day: 'numeric', month: 'short' },
  card: { weekday: 'short', day: 'numeric', month: 'short' },
};

function fmt(key, locale, style) {
  try {
    return new Intl.DateTimeFormat(locale || 'es-ES', FORMATS[style] ?? FORMATS.long).format(new Date(key));
  } catch {
    return new Intl.DateTimeFormat('es-ES', FORMATS[style] ?? FORMATS.long).format(new Date(key));
  }
}

/** «lunes, 9 de febrero» (long) / «lun, 9 feb» (short). Vacío si no hay día. */
export function formatDay(key, locale, style = 'long') {
  if (typeof key !== 'number' || !Number.isFinite(key)) return '';
  return fmt(key, locale, style);
}

/** Etiqueta de la ventana: «lun, 9 feb – mié, 11 feb», o un solo día. */
export function formatDayRange(keys, locale) {
  if (!keys?.length) return '';
  const first = formatDay(keys[0], locale, 'short');
  if (keys.length === 1) return first;
  return `${first} – ${formatDay(keys[keys.length - 1], locale, 'short')}`;
}
