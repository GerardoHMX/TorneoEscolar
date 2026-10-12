// Primitivas de escape HTML. Único lugar donde se permite innerHTML.

export class SafeHtml {
  constructor(s) { this.s = String(s); }
  toString() { return this.s; }
}

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => MAP[c]);
}

export function safeUrl(url) {
  if (typeof url !== 'string') return '';
  try {
    const t = url.trim();
    return new URL(t).protocol === 'https:' ? t : '';
  } catch {
    return '';
  }
}

export function raw(s) { return new SafeHtml(s ?? ''); }

function part(v) {
  if (v instanceof SafeHtml) return v.toString();
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new SafeHtml(out);
}

export function setHTML(el, s) {
  if (!(s instanceof SafeHtml)) throw new TypeError('setHTML requiere SafeHtml');
  el.innerHTML = s.toString();
}
