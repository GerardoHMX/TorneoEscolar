/**
 * Marcador en vivo -> libro del torneo.
 *
 * Copia a las hojas GOLES y CLASIFICACION lo que se captura en directo (Firestore), para que el sitio web
 * muestre goleadores, resultados y clasificación como siempre.
 *
 * Instalación (una sola vez):
 *   1. En el libro: Extensiones › Apps Script. Borra lo que haya en Código.gs y pega este archivo.
 *   2. FIREBASE_PROJECT_ID y FIREBASE_API_KEY ya están puestos (los mismos de js/live/firebase-config.js). Guarda.
 *   3. Vuelve al libro y recárgalo: aparece el menú «Marcador».
 *   4. Marcador › Activar sincronización automática (pide permisos la primera vez).
 *
 * Qué hace:
 *   - Cada 5 minutos lee meta/indice (1 lectura) y solo procesa los partidos que cambiaron.
 *   - GOLES: sustituye las filas de ese NPartido por los goles del directo (solo columnas CICLO, NPartido, ID,
 *     JUGADOR, MINUTO y TIPO; las columnas grises con fórmulas no se tocan).
 *   - CLASIFICACION: al terminar el partido escribe LSCORE, VSCORE, ESTATUS = JUGADO y, en eliminatorias,
 *     LPENALES y VPENALES (la fórmula GANA decide quién pasa). Nunca sobrescribe una celda con fórmula.
 *   - Si un partido se reabre en el móvil, deshace el resultado que había escrito.
 *   - Si un partido se REINICIA en el móvil (botón «Reiniciar partido»), borra los goles y el resultado que
 *     este script había escrito, y el partido vuelve a quedar sin jugar.
 *   - Respeta la hoja: si un partido ya tiene ESTATUS = JUGADO y NO lo escribió este script (resultado puesto
 *     a mano), no toca ni sus goles ni su resultado.
 */
const FIREBASE_PROJECT_ID = 'marcadortorneo';
const FIREBASE_API_KEY = 'AIzaSyAdfBqnNwo7OYH_r1ZCSu3O3H6oEXv5NWo';

const HOJA_GOLES = 'GOLES';
const HOJA_CLASIFICACION = 'CLASIFICACION';
const FILA_CABECERA = 3; // fila con los nombres de columna en ambas hojas

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Marcador')
    .addItem('Sincronizar ahora', 'sincronizarAhora')
    .addSeparator()
    .addItem('Activar sincronización automática (cada 5 min)', 'activarAutomatica')
    .addItem('Desactivar sincronización automática', 'desactivarAutomatica')
    .addToUi();
}

function sincronizarAhora() {
  const msg = sincronizar_(true);
  SpreadsheetApp.getActive().toast(msg, 'Marcador', 8);
}

function sincronizarAutomatico() {
  sincronizar_(false);
}

function activarAutomatica() {
  desactivarAutomatica();
  ScriptApp.newTrigger('sincronizarAutomatico').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getActive().toast('El libro copiará el directo cada 5 minutos.', 'Marcador', 8);
}

function desactivarAutomatica() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sincronizarAutomatico')
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

// ---------------------------------------------------------------------------------------------------------

function sincronizar_(todo) {
  if (FIREBASE_PROJECT_ID.indexOf('PEGA_AQUI') === 0) return 'Falta poner FIREBASE_PROJECT_ID en el script.';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'Ya hay una sincronización en curso.';
  try {
    const props = PropertiesService.getScriptProperties();
    const indice = leerDoc_('meta/indice');
    if (!indice || !indice.cambios) return 'Todavía no hay partidos en el directo.';
    const hechos = []; const reiniciados = []; const manuales = [];
    Object.keys(indice.cambios).forEach((n) => {
      const marca = String(indice.cambios[n]);
      if (!todo && props.getProperty('sync_' + n) === marca) return;
      const doc = leerDoc_('marcador/' + n);
      if (!doc) { // reiniciado desde el móvil: deshacer lo que escribió este script
        if (reiniciar_(Number(n), props)) reiniciados.push(n);
        props.setProperty('sync_' + n, marca);
        return;
      }
      if (estatusHoja_(Number(n)) === 'JUGADO' && !props.getProperty('res_' + n)) { // resultado puesto a mano
        manuales.push(n);
        props.setProperty('sync_' + n, marca);
        return;
      }
      copiarGoles_(Number(n), doc);
      props.setProperty('goles_' + n, '1');
      copiarResultado_(Number(n), doc, props);
      props.setProperty('sync_' + n, marca);
      hechos.push(n);
    });
    const partes = [];
    if (hechos.length) partes.push('Copiados al libro: ' + hechos.join(', '));
    if (reiniciados.length) partes.push('Reiniciados: ' + reiniciados.join(', '));
    if (manuales.length) partes.push('Sin tocar (ya JUGADO a mano en la hoja): ' + manuales.join(', '));
    return partes.length ? partes.join(' · ') : 'No hay cambios nuevos.';
  } finally {
    lock.releaseLock();
  }
}

/** ESTATUS del partido en CLASIFICACION ('JUGADO' o ''), o '' si no se encuentra. */
function estatusHoja_(n) {
  const r = filaPartido_(n);
  return r ? String(r.datos[r.c.ESTATUS] || '').toUpperCase().trim() : '';
}

/** Partido reiniciado: borra sus goles y su resultado SOLO si los escribió este script. */
function reiniciar_(n, props) {
  let algo = false;
  if (props.getProperty('goles_' + n)) {
    copiarGoles_(n, { goles: [], equipos: {} }); // deja vacías sus filas en GOLES
    props.deleteProperty('goles_' + n);
    algo = true;
  }
  if (props.getProperty('res_' + n)) {
    copiarResultado_(n, { estado: 'REINICIADO' }, props); // estado distinto de FINAL: deshace el resultado
    algo = true;
  }
  return algo;
}

/**
 * Fila de un partido en CLASIFICACION con las columnas de SU bloque (cada bloque repite su cabecera y las
 * eliminatorias tienen columnas propias: GANA, LPENALES, VPENALES). null si no existe.
 * @returns {{sh, fila: number, datos: any[], c: Object<string, number>}|null}
 */
function filaPartido_(n) {
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_CLASIFICACION);
  if (!sh) throw new Error('No existe la hoja ' + HOJA_CLASIFICACION);
  const c0 = cabecera_(sh);
  exigir_(c0, ['RONDA', 'NPARTIDO'], HOJA_CLASIFICACION);
  const primera = FILA_CABECERA + 1;
  const ultima = sh.getLastRow();
  if (ultima < primera) return null;
  const datos = sh.getRange(primera, 1, ultima - primera + 1, sh.getLastColumn()).getValues();
  const i = datos.findIndex((f) => String(f[c0.NPARTIDO]).replace(/\.0+$/, '').trim() === String(n));
  if (i < 0) return null;
  let c = c0;
  for (let r = i - 1; r >= 0; r--) {
    if (String(datos[r][c0.RONDA]).toUpperCase().trim() === 'RONDA') {
      c = {};
      datos[r].forEach((v, j) => {
        const k = String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[\s_]/g, '');
        if (k && !(k in c)) c[k] = j;
      });
      break;
    }
  }
  return { sh, fila: primera + i, datos: datos[i], c };
}

/** Documento de Firestore (API REST, lectura pública) como objeto JS; null si no existe. */
function leerDoc_(ruta) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID +
    '/databases/(default)/documents/' + ruta + '?key=' + encodeURIComponent(FIREBASE_API_KEY);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) throw new Error('Firestore ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  const json = JSON.parse(res.getContentText());
  return campos_(json.fields || {});
}

function campos_(fields) {
  const out = {};
  Object.keys(fields).forEach((k) => { out[k] = valor_(fields[k]); });
  return out;
}

function valor_(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return campos_(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor_);
  return null;
}

/** Columnas por nombre (fila de cabecera): {NPARTIDO: 3, ...} con índices desde 0. Primera aparición. */
function cabecera_(sh) {
  const fila = sh.getRange(FILA_CABECERA, 1, 1, sh.getLastColumn()).getValues()[0];
  const out = {};
  fila.forEach((v, i) => {
    const k = String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s_]/g, '');
    if (k && !(k in out)) out[k] = i;
  });
  return out;
}

function exigir_(cab, nombres, hoja) {
  nombres.forEach((n) => { if (!(n in cab)) throw new Error('Falta la columna ' + n + ' en la hoja ' + hoja); });
}

/** Escribe un valor si la celda no tiene fórmula. */
function poner_(sh, fila, col0, valor) {
  const r = sh.getRange(fila, col0 + 1);
  if (r.getFormula()) return;
  r.setValue(valor);
}

function minutoNum_(m) {
  const r = /^(\d+)(?:\+(\d+))?/.exec(String(m || ''));
  return r ? Number(r[1]) + (r[2] ? Number(r[2]) / 100 : 0) : 999;
}

function copiarGoles_(n, doc) {
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_GOLES);
  if (!sh) throw new Error('No existe la hoja ' + HOJA_GOLES);
  const c = cabecera_(sh);
  exigir_(c, ['CICLO', 'NPARTIDO', 'ID', 'JUGADOR', 'MINUTO', 'TIPO'], HOJA_GOLES);
  const primera = FILA_CABECERA + 1;
  const ultima = sh.getLastRow();
  const ancho = Math.max(c.CICLO, c.NPARTIDO, c.ID, c.JUGADOR, c.MINUTO, c.TIPO) + 1;
  const datos = ultima >= primera ? sh.getRange(primera, 1, ultima - primera + 1, ancho).getValues() : [];
  const cols = [c.CICLO, c.NPARTIDO, c.ID, c.JUGADOR, c.MINUTO, c.TIPO];
  const libres = [];
  datos.forEach((fila, i) => {
    const np = String(fila[c.NPARTIDO]).trim();
    const vacia = !np && !String(fila[c.ID]).trim() && !String(fila[c.JUGADOR]).trim();
    if (np === String(n)) {
      cols.forEach((col) => poner_(sh, primera + i, col, ''));
      libres.push(primera + i);
    } else if (vacia) {
      libres.push(primera + i);
    }
  });
  libres.sort((a, b) => a - b);
  const equipos = doc.equipos || {};
  const goles = (doc.goles || []).slice().sort((a, b) => minutoNum_(a.minuto) - minutoNum_(b.minuto));
  let siguiente = Math.max(ultima, FILA_CABECERA) + 1;
  goles.forEach((g) => {
    const lado = g.lado === 'visitante' ? 'visitante' : 'local';
    const eq = equipos[lado] || {};
    const fila = libres.length ? libres.shift() : siguiente++;
    poner_(sh, fila, c.CICLO, eq.ciclo || doc.ciclo || '');
    poner_(sh, fila, c.NPARTIDO, n);
    poner_(sh, fila, c.ID, eq.id || '');
    poner_(sh, fila, c.JUGADOR, g.jugador || '');
    sh.getRange(fila, c.MINUTO + 1).setNumberFormat('@');
    poner_(sh, fila, c.MINUTO, String(g.minuto || ''));
    poner_(sh, fila, c.TIPO, g.tipo === 'PENAL' || g.tipo === 'PROPIA' ? g.tipo : '');
  });
}

function copiarResultado_(n, doc, props) {
  const r = filaPartido_(n);
  if (!r) return;
  const { sh, fila, c } = r;
  exigir_(c, ['LSCORE', 'VSCORE', 'ESTATUS'], HOJA_CLASIFICACION);
  const clave = 'res_' + n;
  const penales = 'LPENALES' in c && 'VPENALES' in c;

  if (doc.estado !== 'FINAL') {
    if (props.getProperty(clave)) { // se reabrió o se reinició: deshacer lo escrito
      poner_(sh, fila, c.LSCORE, ''); poner_(sh, fila, c.VSCORE, ''); poner_(sh, fila, c.ESTATUS, '');
      if (penales) { poner_(sh, fila, c.LPENALES, 0); poner_(sh, fila, c.VPENALES, 0); }
      props.deleteProperty(clave);
    }
    return;
  }
  const goles = doc.goles || [];
  const tanda = doc.tanda || [];
  poner_(sh, fila, c.LSCORE, goles.filter((g) => g.lado === 'local').length);
  poner_(sh, fila, c.VSCORE, goles.filter((g) => g.lado === 'visitante').length);
  if (penales) {
    // GANA (fórmula de la hoja) suma goles + penaltis para decidir quién pasa.
    poner_(sh, fila, c.LPENALES, tanda.filter((t) => t.lado === 'local' && t.gol).length);
    poner_(sh, fila, c.VPENALES, tanda.filter((t) => t.lado === 'visitante' && t.gol).length);
  }
  poner_(sh, fila, c.ESTATUS, 'JUGADO');
  props.setProperty(clave, '1');
}
