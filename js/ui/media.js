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
