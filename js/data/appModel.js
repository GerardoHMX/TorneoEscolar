// Modelo único de la aplicación: lo devuelve buildModel (Task 14) y lo consumen secciones y visibilidad.
import { parsePodio } from './models.js';

/**
 * @typedef {import('./models.js').Equipo} Equipo
 * @typedef {import('./models.js').Partido} Partido
 * @typedef {import('./models.js').FilaTabla} FilaTabla
 * @typedef {import('./models.js').Gol} Gol
 * @typedef {import('./models.js').Goleador} Goleador
 * @typedef {import('./models.js').Sancion} Sancion
 * @typedef {import('./models.js').Noticia} Noticia
 * @typedef {import('./models.js').GaleriaItem} GaleriaItem
 * @typedef {import('./models.js').Otro} Otro
 * @typedef {import('./goals.js').MatchGoals} MatchGoals
 * @typedef {ReturnType<typeof parsePodio>} Podio
 * @typedef {{
 *   equipos: Equipo[], partidos: Partido[], tabla: FilaTabla[], podio: Podio, goles: Gol[],
 *   goalsByMatch: Map<string, MatchGoals>, scorers: Goleador[], lideres: Goleador[],
 *   sanciones: Sancion[], noticias: Noticia[], galeria: GaleriaItem[], otros: Otro[],
 *   config: Record<string, string>
 * }} AppModel
 */

/** @returns {AppModel} */
export function emptyModel() {
  return {
    equipos: [], partidos: [], tabla: [], podio: parsePodio([]), goles: [],
    goalsByMatch: new Map(), scorers: [], lideres: [], sanciones: [], noticias: [],
    galeria: [], otros: [], config: {},
  };
}

/** @param {Partial<AppModel>} [overrides] @returns {AppModel} */
export function makeModel(overrides = {}) {
  return { ...emptyModel(), ...overrides };
}
