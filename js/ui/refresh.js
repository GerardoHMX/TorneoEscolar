// «Actualizar datos» (spec §6, botón de refrescar): control discreto que main.js coloca en el pie.
// Fuerza una carga sin caché (onRefresh) y anuncia el resultado en una región viva educada.
// Nunca roba el foco: el botón no se deshabilita (un botón `disabled` pierde el foco), solo se marca
// aria-busy/aria-disabled e ignora los clics mientras trabaja.
import { html, setHTML } from '../core/dom.js';
import { refreshStatusKey } from '../core/boot.js';

const ICON = html`<svg class="data-refresh__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const MIN_BUSY_MS = 700; // que el estado «Actualizando…» se llegue a ver aunque la red sea instantánea
const CLEAR_MS = 8000; // el mensaje de resultado se retira solo (sin anunciarlo)

/**
 * @param {{t: (k: string, f?: string) => string, onRefresh: () => Promise<string[] | undefined>}} opts
 *   onRefresh devuelve las hojas que fallaron (loadAllWithStatus().failed).
 * @returns {{el: HTMLElement, button: HTMLButtonElement, relabel: () => void}}
 */
export function createRefreshControl({ t, onRefresh }) {
  const el = document.createElement('div');
  el.className = 'data-refresh';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'data-refresh__btn';
  const status = document.createElement('p');
  status.className = 'data-refresh__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  el.append(button, status);

  let busy = false;
  let result = ''; // '' | 'refresh_done' | 'refresh_failed'
  let clearTimer = 0;

  const message = () => {
    if (result === 'refresh_done') return t('refresh_done', 'Datos actualizados');
    if (result === 'refresh_failed') return t('refresh_failed', 'No se han podido actualizar todos los datos. Inténtalo más tarde.');
    return '';
  };

  function relabel() {
    setHTML(button, html`${ICON}<span>${busy ? t('refresh_busy', 'Actualizando…') : t('refresh_data', 'Actualizar datos')}</span>`);
    if (busy) {
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-disabled');
    }
    status.textContent = message();
  }

  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    result = '';
    clearTimeout(clearTimer);
    relabel();
    const started = Date.now();
    let failed;
    try {
      failed = await onRefresh();
    } catch (err) {
      console.error('[refresh] la actualización falló:', err);
      failed = undefined;
    }
    const wait = MIN_BUSY_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    busy = false;
    result = refreshStatusKey(failed);
    relabel();
    clearTimer = setTimeout(() => { result = ''; status.textContent = ''; }, CLEAR_MS);
  });

  relabel();
  return { el, button, relabel };
}
