import { safeUrl } from './dom.js';

// Portado de convertGoogleDriveUrl (js/ui.js). El resultado pasa por safeUrl.
// `width`: ancho pedido a la miniatura de Drive (por defecto 2000 px, como el sitio antiguo).
export function driveImg(url, width = 2000) {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('drive.google.com')) return safeUrl(url);
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const w = Number.isInteger(width) && width > 0 ? width : 2000;
  if (m) return safeUrl(`https://drive.google.com/thumbnail?id=${m[1]}&sz=w${w}`);
  return safeUrl(url);
}
