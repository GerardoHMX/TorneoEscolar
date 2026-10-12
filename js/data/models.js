// Modelos de datos: convierten las filas crudas (parseCSV) de cada hoja en objetos tipados.
// Todas las funciones reciben `rows` = array de arrays (salida de parseCSV) y toleran hojas
// vacías o sin cabecera (devuelven [] / {}).
import { tableFromRows } from '../core/csv.js';
import { parseMinuto } from './goals.js';

/**
 * @typedef {{id:string, grupo:string, ciclo:'ESO'|'BCH', curso:string, equipo:string, logo:string}} Equipo
 * Partido: key = String(n); ciclo tal cual del CSV; interciclo=true en FINAL/TERCERPUESTO.
 * Gol: n es la clave de unión con Partido (String(n)); ciclo es solo informativo.
 * @typedef {{id:string, equipo:string, logo:string, score:number|null, res:'G'|'E'|'P'|''}} Lado
 * @typedef {{key:string, ciclo:string, ronda:'INICIAL'|'CUARTOS'|'SEMIFINAL'|'TERCERPUESTO'|'FINAL',
 *   grupo:string, n:number, fecha:Date|null, hora:string, local:Lado, visitante:Lado,
 *   estatus:'JUGADO'|'', interciclo:boolean, pasa:string}} Partido
 * pasa: equipo que avanza según la hoja (columna PASAN; GANA en las tablas de eliminatoria); '' si vacía.
 * @typedef {{ciclo:string, grupo:string, equipo:string, puntos:number, g:number, e:number, p:number,
 *   gf:number, gc:number, dg:number, fairplay:number, total:number}} FilaTabla
 * @typedef {{ciclo:string, n:number, equipoId:string, jugador:string,
 *   minuto:{base:number, extra:number}|null, tipo:'GOL'|'PENAL'|'PROPIA'}} Gol
 * @typedef {{ciclo:string, curso:string, equipoId:string, equipo:string, jugador:string, goles:number}} Goleador
 * @typedef {{ciclo:string, curso:string, equipoId:string, equipo:string, jugador:string,
 *   trojas:number, tamarillas:number, justificacion:string}} Sancion
 * @typedef {{fecha:string, creditos:string, publicar:string, titulo:string, contenido:string,
 *   imagen:string, imagen2:string, imagen3:string, imagen4:string, imagen5:string}} Noticia
 * @typedef {{fecha:string, tipo:string, publicar:string, url:string, titulo:string, descripcion:string}} GaleriaItem
 * @typedef {{ciclo:string, posicion:number|null, avatarposiciones:string, seccion:string,
 *   nombre:string, menu:string, visible:string}} Otro
 * @typedef {{equipo:string, logo:string}} Puesto
 */

const RONDAS = ['INICIAL', 'CUARTOS', 'SEMIFINAL', 'TERCERPUESTO', 'FINAL'];
const CICLOS = ['ESO', 'BCH'];

// minúsculas, sin acentos, espacios colapsados
const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// clave de columna: sin espacios/guiones bajos ("GOLES A FAVOR" == "GOLESAFAVOR")
const colKey = (k) => fold(k).replace(/[\s_]/g, '');
const num = (v) => { const n = Number(String(v ?? '').trim()); return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null; };
const int0 = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };

/** Valor de la primera columna existente entre `names` (insensible a mayúsculas/espacios). */
function get(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const k = keys.find((x) => colKey(x) === colKey(name));
    if (k !== undefined) return String(row[k] ?? '').trim();
  }
  return '';
}
const has = (row, name) => Object.keys(row).some((k) => colKey(k) === colKey(name));
const stripQuotes = (s) => s.replace(/^"+/, '').replace(/"+$/, '').trim();

/** ID canónico: sin acentos, mayúsculas y solo [A-Z0-9]. '3º ESO B' -> '3ESOB'. */
export function normalizeId(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------------------------------------------------------------- EQUIPOS

/**
 * Versión con diagnóstico. Sin columna ID: id = normalizeId(curso). Con columna ID: debe ser
 * [A-Za-z0-9]{2,4} (se pasa a mayúsculas); inválido -> fila rechazada; duplicado -> se conserva
 * el primero. Ambos casos añaden un texto a `warnings`.
 * @returns {{equipos: Equipo[], warnings: string[]}}
 */
export function parseEquiposDetailed(rows) {
  const table = tableFromRows(rows, ['GRUPO', 'CURSO', 'EQUIPO']);
  const equipos = [];
  const warnings = [];
  const seen = new Set();
  for (const r of table) {
    const grupo = get(r, 'GRUPO').toUpperCase();
    const ciclo = get(r, 'CICLO').toUpperCase();
    const curso = get(r, 'CURSO');
    const nombre = get(r, 'EQUIPO');
    const label = nombre || curso || '(sin nombre)';
    if (!grupo || !nombre) { warnings.push(`Fila de equipo incompleta ignorada: ${label}`); continue; }
    if (!CICLOS.includes(ciclo)) { warnings.push(`Ciclo inválido "${ciclo}" en ${label}: fila rechazada`); continue; }
    let id;
    if (has(r, 'ID')) {
      const raw = get(r, 'ID');
      if (!/^[A-Za-z0-9]{2,4}$/.test(raw)) { warnings.push(`ID inválido "${raw}" en ${label}: fila rechazada`); continue; }
      id = raw.toUpperCase();
    } else {
      id = normalizeId(curso);
      if (!id) { warnings.push(`Sin curso ni ID en ${label}: fila rechazada`); continue; }
    }
    if (seen.has(id)) { warnings.push(`ID duplicado ${id} en ${label}: se conserva el primero`); continue; }
    seen.add(id);
    equipos.push({ id, grupo, ciclo, curso, equipo: nombre, logo: get(r, 'LOGO') });
  }
  return { equipos, warnings };
}

/**
 * @param {string[][]} rows
 * @returns {Equipo[] & {warnings: string[]}} el array lleva una propiedad NO enumerable `warnings`
 *   (no afecta a deepEqual ni a iteraciones). Para destructurar usa parseEquiposDetailed.
 */
export function parseEquipos(rows) {
  const { equipos, warnings } = parseEquiposDetailed(rows);
  Object.defineProperty(equipos, 'warnings', { value: warnings, enumerable: false });
  return equipos;
}

/** Equipo de una fila: prueba ID, luego EQUIPO (nombre), luego CURSO; comparación normalizada. */
export function resolveEquipo(row, equipos) {
  const id = normalizeId(get(row, 'ID'));
  if (id) {
    const e = equipos.find((x) => x.id === id);
    if (e) return e;
  }
  for (const [col, field] of [['EQUIPO', 'equipo'], ['CURSO', 'curso']]) {
    const v = fold(get(row, col));
    if (!v) continue;
    const e = equipos.find((x) => fold(x[field]) === v);
    if (e) return e;
  }
  return null;
}

// ---------------------------------------------------------------- CLASIFICACION

const REQ_CLASIF = ['GRUPO', 'NPartido'];

function lado(r, e, nombreCol, logoCol, scoreCol, resCol, equipos) {
  const nombre = get(r, nombreCol);
  const eq = nombre ? resolveEquipo({ EQUIPO: nombre }, equipos) : null;
  const res = get(r, resCol).toUpperCase();
  return {
    id: eq ? eq.id : '',
    equipo: nombre,
    logo: get(r, logoCol) || (eq ? eq.logo : ''),
    score: num(get(r, scoreCol)),
    res: ['G', 'E', 'P'].includes(res) ? res : '',
  };
}

/**
 * Partidos de CLASIFICACION. Decisión: la FINAL (GRUPO 1RPUESTO) y el TERCERPUESTO (3RPUESTO) SÍ
 * entran en Partido[] (ronda 'FINAL' / 'TERCERPUESTO'). Se filtra por ronda válida + NPartido entero.
 * key = String(n) (NPartido es único en todo el torneo). `ciclo` se conserva como viene del CSV; FINAL y
 * TERCERPUESTO son inter-ciclo (ESO vs BCH): ciclo '' e `interciclo: true` (las secciones deben mostrarlos
 * con ciclo TODOS; decisión de Task 9).
 * `hora` normaliza '10.15' -> '10:15'. `fecha` = Date local (ANIO/MES/DIA) o null.
 * @returns {Partido[]}
 */
export function parsePartidos(rows, equipos) {
  const out = [];
  for (const r of tableFromRows(rows, REQ_CLASIF)) {
    const ronda = get(r, 'RONDA').toUpperCase();
    const nTxt = get(r, 'NPartido');
    if (!RONDAS.includes(ronda) || !/^\d+$/.test(nTxt)) continue;
    const n = Number(nTxt);
    const local = lado(r, null, 'LOCAL', 'LLOGO', 'LSCORE', 'LS', equipos);
    const visitante = lado(r, null, 'VISITANTE', 'VLOGO', 'VSCORE', 'VS', equipos);
    const ciclo = get(r, 'CICLO').toUpperCase();
    const y = int0(get(r, 'ANIO')); const m = int0(get(r, 'MES')); const d = int0(get(r, 'DIA'));
    const fecha = y && m && d ? new Date(y, m - 1, d) : null;
    out.push({
      key: String(n), ciclo, ronda, grupo: get(r, 'GRUPO'), n, fecha,
      hora: get(r, 'HORA').replace(/^(\d{1,2})\.(\d{2})$/, '$1:$2'),
      local, visitante,
      estatus: get(r, 'ESTATUS').toUpperCase() === 'JUGADO' ? 'JUGADO' : '',
      interciclo: ronda === 'FINAL' || ronda === 'TERCERPUESTO',
      pasa: get(r, 'PASAN', 'GANA'),
    });
  }
  return out;
}

/**
 * Tabla de posiciones (columnas U:AD de las filas de fase de grupos). Solo filas RONDA=INICIAL con
 * equipo y PUNTOS numérico: las filas de eliminatorias reutilizan esas columnas para otros datos.
 * @returns {FilaTabla[]}
 */
export function parseTabla(rows) {
  const out = [];
  for (const r of tableFromRows(rows, REQ_CLASIF)) {
    if (get(r, 'RONDA').toUpperCase() !== 'INICIAL') continue;
    const equipo = get(r, 'EQUIPOS');
    if (!equipo || num(get(r, 'PUNTOS')) === null) continue;
    out.push({
      ciclo: get(r, 'CICLO').toUpperCase(), grupo: get(r, 'GRUPO'), equipo,
      puntos: int0(get(r, 'PUNTOS')), g: int0(get(r, 'GANADOS')), e: int0(get(r, 'EMPATADOS')),
      p: int0(get(r, 'PERDIDOS')), gf: int0(get(r, 'GOLESAFAVOR')), gc: int0(get(r, 'GOLESENCONTRA')),
      dg: int0(get(r, 'DIFERENCIADEGOLES')), fairplay: int0(get(r, 'FAIRPLAY')), total: int0(get(r, 'TOTAL')),
    });
  }
  return out;
}

/**
 * Podio. En las filas 1RPUESTO/3RPUESTO las columnas se reutilizan: GANA=PASAN(S), GLOGO(T),
 * PIERDE=EQUIPOS(U), PLOGO=EMPATADOS(X). Cada puesto es {equipo, logo} o null si no hay ganador.
 * @returns {{primero: Puesto|null, segundo: Puesto|null, tercero: Puesto|null}}
 */
export function parsePodio(rows) {
  const t = tableFromRows(rows, REQ_CLASIF);
  const puesto = (nombre, logo) => (nombre ? { equipo: nombre, logo } : null);
  const fin = t.find((r) => get(r, 'GRUPO').toUpperCase() === '1RPUESTO');
  const ter = t.find((r) => get(r, 'GRUPO').toUpperCase() === '3RPUESTO');
  return {
    primero: fin ? puesto(get(fin, 'GANA', 'PASAN'), get(fin, 'GLOGO')) : null,
    segundo: fin && get(fin, 'GANA', 'PASAN') ? puesto(get(fin, 'PIERDE', 'EQUIPOS'), get(fin, 'PLOGO', 'EMPATADOS')) : null,
    tercero: ter ? puesto(get(ter, 'GANA', 'PASAN'), get(ter, 'GLOGO')) : null,
  };
}

// ---------------------------------------------------------------- GOLES

function parseTipo(v) {
  const t = fold(v).toUpperCase();
  if (t === 'PENAL' || t === 'PENALTI') return 'PENAL';
  if (t === 'PROPIA' || t === 'AUTOGOL' || t === 'EN PROPIA') return 'PROPIA';
  return 'GOL';
}

/**
 * Goles por partido. Equipo por resolveEquipo (ID, EQUIPO, CURSO); fila sin equipo resoluble o con
 * NPartido no numérico se omite. TIPO vacío/desconocido -> 'GOL'. CICLO vacío -> el del equipo.
 * @returns {Gol[]}
 */
export function parseGoles(rows, equipos) {
  const out = [];
  for (const r of tableFromRows(rows, ['NPartido', 'JUGADOR'])) {
    const nTxt = get(r, 'NPartido');
    if (!/^\d+$/.test(nTxt)) continue;
    const eq = resolveEquipo(r, equipos);
    if (!eq) continue;
    out.push({
      ciclo: get(r, 'CICLO').toUpperCase() || eq.ciclo, n: Number(nTxt), equipoId: eq.id,
      jugador: get(r, 'JUGADOR'), minuto: parseMinuto(get(r, 'MINUTO')), tipo: parseTipo(get(r, 'TIPO')),
    });
  }
  return out;
}

// ---------------------------------------------------------------- LIDERES / SANCIONES

function jugadorDe(r) { return get(r, 'NOMBRE') || get(r, 'JUGADOR'); }

function equipoRef(r, equipos) {
  const eq = resolveEquipo(r, equipos);
  return { equipoId: eq ? eq.id : '', equipo: eq ? eq.equipo : get(r, 'EQUIPO') };
}

/** @returns {Goleador[]} jugador = NOMBRE si no está vacío, si no JUGADOR; filas sin ciclo o jugador se omiten. */
export function parseLideres(rows, equipos) {
  const out = [];
  for (const r of tableFromRows(rows, ['CICLO', 'JUGADOR', 'GOLES'])) {
    const jugador = jugadorDe(r);
    const ciclo = get(r, 'CICLO').toUpperCase();
    if (!ciclo || !jugador) continue;
    out.push({ ciclo, curso: get(r, 'CURSO'), ...equipoRef(r, equipos), jugador, goles: int0(get(r, 'GOLES')) });
  }
  return out;
}

/** @returns {Sancion[]} mismo criterio de jugador/filas que parseLideres. */
export function parseSanciones(rows, equipos) {
  const out = [];
  for (const r of tableFromRows(rows, ['CICLO', 'JUGADOR', 'TROJAS'])) {
    const jugador = jugadorDe(r);
    const ciclo = get(r, 'CICLO').toUpperCase();
    if (!ciclo || !jugador) continue;
    out.push({
      ciclo, curso: get(r, 'CURSO'), ...equipoRef(r, equipos), jugador,
      trojas: int0(get(r, 'TROJAS')), tamarillas: int0(get(r, 'TAMARILLAS')), justificacion: get(r, 'JUSTIFICACION'),
    });
  }
  return out;
}

// ---------------------------------------------------------------- NOTICIAS / GALERIA / OTROS / CONFIG

/** @returns {Noticia[]} sin filtrar por PUBLICAR (lo hace la UI). TITULO/CONTENIDO sin comillas literales envolventes. */
export function parseNoticias(rows) {
  return tableFromRows(rows, ['FECHA', 'PUBLICAR', 'TITULO']).map((r) => ({
    fecha: get(r, 'FECHA'), creditos: get(r, 'CREDITOS'), publicar: get(r, 'PUBLICAR').toUpperCase(),
    titulo: stripQuotes(get(r, 'TITULO')), contenido: stripQuotes(get(r, 'CONTENIDO')),
    imagen: get(r, 'IMAGEN'), imagen2: get(r, 'IMAGEN2'), imagen3: get(r, 'IMAGEN3'),
    imagen4: get(r, 'IMAGEN4'), imagen5: get(r, 'IMAGEN5'),
  }));
}

/** @returns {GaleriaItem[]} sin filtrar por PUBLICAR. */
export function parseGaleria(rows) {
  return tableFromRows(rows, ['FECHA', 'TIPO', 'PUBLICAR', 'URL']).map((r) => ({
    fecha: get(r, 'FECHA'), tipo: get(r, 'TIPO').toUpperCase(), publicar: get(r, 'PUBLICAR').toUpperCase(),
    url: get(r, 'URL'), titulo: get(r, 'TITULO'), descripcion: get(r, 'DESCRIPCION'),
  }));
}

/**
 * OTROS contiene dos tablas lado a lado en las mismas filas (avatares de líderes por CICLO/POSICION y
 * menú por SECCION); cada objeto lleva todos los campos y los de la otra tabla pueden venir vacíos.
 * @returns {Otro[]}
 */
export function parseOtros(rows) {
  return tableFromRows(rows, ['SECCION', 'CICLO', 'POSICION']).map((r) => ({
    ciclo: get(r, 'CICLO').toUpperCase(), posicion: num(get(r, 'POSICION')),
    avatarposiciones: get(r, 'AVATARPOSICIONES'), seccion: get(r, 'SECCION'), nombre: get(r, 'NOMBRE'),
    menu: get(r, 'MENU').toUpperCase(), visible: get(r, 'VISIBLE').toUpperCase(),
  }));
}

/** Pares CAMPO -> VALOR. Clave = CAMPO en MAYÚSCULAS; 'Sin Datos' o vacío -> ''. */
export function parseConfig(rows) {
  const out = {};
  for (const r of tableFromRows(rows, ['CAMPO', 'VALOR'])) {
    const campo = get(r, 'CAMPO').toUpperCase();
    if (!campo) continue;
    const valor = get(r, 'VALOR');
    out[campo] = valor === 'Sin Datos' ? '' : valor;
  }
  return out;
}
