// Lógica de goles y goleadores. Solo importa tipos (JSDoc) de models.js: models.js importa
// parseMinuto de aquí, así que no debe haber imports en tiempo de ejecución en sentido contrario.

/**
 * @typedef {import('./models.js').Gol} Gol
 * @typedef {import('./models.js').Partido} Partido
 * @typedef {import('./models.js').Equipo} Equipo
 * @typedef {import('./models.js').Goleador} Goleador
 * @typedef {{local: Gol[], visitante: Gol[], total: number, parcial: boolean}} MatchGoals
 */

/** '12', "12'", '45+2' -> {base, extra}; vacío o basura -> null. */
export function parseMinuto(s) {
  const m = /^(\d+)(?:\s*\+\s*(\d+))?\s*['′’]?$/.exec(String(s ?? '').trim());
  return m ? { base: Number(m[1]), extra: m[2] ? Number(m[2]) : 0 } : null;
}

/** minúsculas, sin acentos, espacios colapsados y recortados. */
export function normalizeName(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const orden = (g) => (g.minuto ? g.minuto.base + g.minuto.extra : Infinity);

/**
 * Goles por partido JUGADO. Clave = Partido.key (String(n)); el ciclo del gol no interviene.
 * Solo entran partidos con al menos un gol atribuible a alguno de sus lados.
 * @param {Gol[]} goles @param {Partido[]} partidos
 * @returns {Map<string, MatchGoals>}
 */
export function goalsByMatch(goles, partidos) {
  const byN = new Map();
  for (const g of goles) {
    const k = String(g.n);
    if (!byN.has(k)) byN.set(k, []);
    byN.get(k).push(g);
  }
  const out = new Map();
  for (const p of partidos) {
    if (p.estatus !== 'JUGADO') continue;
    const del = byN.get(p.key);
    if (!del) continue;
    // Array.prototype.sort es estable: empates y goles sin minuto conservan el orden de entrada.
    const sorted = [...del].sort((a, b) => {
      const x = orden(a), y = orden(b);
      return x === y ? 0 : x < y ? -1 : 1;
    });
    const local = sorted.filter((g) => g.equipoId === p.local.id);
    const visitante = sorted.filter((g) => g.equipoId === p.visitante.id);
    const total = local.length + visitante.length;
    if (total === 0) continue;
    out.set(p.key, {
      local, visitante, total,
      parcial: total !== (p.local.score ?? 0) + (p.visitante.score ?? 0),
    });
  }
  return out;
}

/**
 * Goles cuyo NPartido no corresponde a ningún partido de CLASIFICACION (goalsByMatch los descarta en silencio;
 * buildModel lo avisa en consola, spec §8.5). Los de partidos existentes aún no JUGADO no cuentan aquí.
 * @param {Gol[]} goles @param {Partido[]} partidos @returns {number}
 */
export function unknownMatchGoals(goles, partidos) {
  const keys = new Set(partidos.map((p) => String(p.key)));
  return goles.filter((g) => !keys.has(String(g.n))).length;
}

/**
 * Ranking de goleadores: cuenta GOL y PENAL, excluye PROPIA y filas sin jugador.
 * @param {Gol[]} goles @param {Equipo[]} equipos
 * @returns {Goleador[]}
 */
export function computeScorers(goles, equipos) {
  const groups = new Map();
  for (const g of goles) {
    if (g.tipo === 'PROPIA') continue;
    const nombre = normalizeName(g.jugador);
    if (!nombre) continue;
    const key = `${g.equipoId}|${nombre}`;
    const cur = groups.get(key);
    if (cur) { cur.goles += 1; continue; }
    const e = equipos.find((x) => x.id === g.equipoId);
    groups.set(key, {
      ciclo: e ? e.ciclo : g.ciclo, curso: e ? e.curso : '', equipoId: g.equipoId,
      equipo: e ? e.equipo : '', jugador: String(g.jugador).trim(), goles: 1,
    });
  }
  return [...groups.values()].sort((a, b) => b.goles - a.goles || a.jugador.localeCompare(b.jugador, 'es'));
}

/** Ranking calculado desde `goles`; si no hay ninguno, los líderes publicados. */
export function scorersWithFallback(goles, lideres, equipos) {
  return goles.length ? computeScorers(goles, equipos) : lideres;
}
