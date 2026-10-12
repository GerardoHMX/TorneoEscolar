// Parser CSV único (reemplaza csvToRows/csvToObjects de data.js).

/** Parsea texto CSV a filas de celdas recortadas; descarta filas totalmente vacías. */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field.trim());
    field = '';
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
  };
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      endRow();
    } else field += ch;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const isErr = (v) => v === '#REF!' || v === '#N/A';

/**
 * Fila de título: la primera celda tiene contenido y cada otra celda con
 * contenido va precedida de >=3 celdas vacías (desde la anterior con contenido),
 * o bien solo hay una celda con contenido. Nunca se descarta una fila con valores
 * en al menos la mitad de las columnas de la cabecera.
 */
function isTitleRow(row, headerLen) {
  const filled = [];
  row.forEach((c, i) => { if (c !== '') filled.push(i); });
  if (filled.length === 0) return false;
  if (filled.length * 2 >= headerLen) return false;
  if (filled.length === 1) return true;
  if (filled[0] !== 0) return false;
  for (let k = 1; k < filled.length; k++) {
    if (filled[k] - filled[k - 1] - 1 < 3) return false;
  }
  return true;
}

/** Usa como cabecera la primera fila que contiene todas las columnas `required`. */
export function tableFromRows(rows, required) {
  const req = required.map(norm);
  const hIdx = rows.findIndex((r) => {
    const names = r.map(norm);
    return req.every((q) => names.includes(q));
  });
  if (hIdx < 0) return [];
  const header = rows[hIdx];
  const keys = header.map(norm);
  const reqCols = req.map((q) => keys.indexOf(q));
  const out = [];
  for (const row of rows.slice(hIdx + 1)) {
    const filled = row.filter((c) => c !== '');
    if (filled.length === 0) continue;
    if (filled.every(isErr)) continue;
    if (reqCols.every((c) => norm(row[c]) === keys[c])) continue; // cabecera repetida
    if (isTitleRow(row, header.length)) continue;
    const obj = {};
    header.forEach((h, i) => {
      if (h !== '' && !(h in obj)) obj[h] = row[i] ?? '';
    });
    out.push(obj);
  }
  return out;
}
