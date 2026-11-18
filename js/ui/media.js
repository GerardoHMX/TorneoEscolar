// Imágenes de contenido (Drive, enlaces de la hoja) que pueden fallar al cargar.
const mediaRoots = new WeakSet();
/**
 * Imagen que no carga (Drive privado, URL caducada): su contenedor [data-media] pasa a .is-broken y
 * muestra el fondo de reserva en vez del icono roto. Un solo listener (captura) por raíz.
 */
export function bindMediaFallback(root) {
  if (!root || mediaRoots.has(root)) return;
  mediaRoots.add(root);
  root.addEventListener('error', (ev) => {
    const el = ev.target;
    if (el instanceof Element && el.matches('[data-media] img')) el.closest('[data-media]').classList.add('is-broken');
  }, true);
}

const fitRoots = new WeakSet();
const TOLERANCE = 0.18; // diferencia relativa de proporción hasta la que se permite recortar (cover)

/** Marca el marco [data-media]: «cover» si la imagen casi encaja, «contain» (entera sobre relleno difuminado) si no. */
function fitFrame(img) {
  const frame = img.closest('[data-media]');
  if (!frame || !img.naturalWidth || !img.naturalHeight) return;
  const box = frame.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const diff = Math.abs((img.naturalWidth / img.naturalHeight) / (box.width / box.height) - 1);
  frame.dataset.fit = diff <= TOLERANCE ? 'cover' : 'contain';
}

/**
 * Imágenes con proporciones dispares (cuadradas, verticales, panorámicas): ninguna se deforma ni pierde
 * la cara por un recorte brusco. Solo la imagen principal del marco (img.media-main) decide el ajuste.
 */
export function bindMediaFit(root) {
  if (!root) return;
  root.querySelectorAll('[data-media] img.media-main').forEach((img) => {
    if (img.complete) fitFrame(img);
  });
  if (fitRoots.has(root)) return;
  fitRoots.add(root);
  root.addEventListener('load', (ev) => {
    if (ev.target instanceof HTMLImageElement && ev.target.matches('[data-media] img.media-main')) fitFrame(ev.target);
  }, true);
}
