// Diálogo modal en #modal-root: foco atrapado, Esc y clic en el fondo cierran, el foco vuelve
// al elemento que lo abrió y el resto de la página queda inerte mientras está abierto.

import { html, setHTML } from '../core/dom.js';
import { afterMotion, inertOutside, lockScroll, trapTab, ut } from './focus.js';

let current = null; // función close del modal abierto

const CLOSE_ICON = html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path></svg>`;

/**
 * @param {import('../core/dom.js').SafeHtml} content cuerpo del modal (ya seguro)
 * @param {{labelKey?: string, label?: string, size?: 'md'|'lg', onClose?: () => void}} [opts]
 *   Nombre accesible: el primer h2/h3 del contenido (aria-labelledby); si no hay, `label` o la
 *   traducción de `labelKey` (vía setUiTranslator). `size: 'lg'` para galería/vídeo.
 * @returns {() => void} close (idempotente)
 */
export function openModal(content, opts = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return () => {};
  if (current) current(true);

  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const closeLabel = ut('modal_close', 'Cerrar');
  setHTML(root, html`<div class="modal rm-fade" data-state="opening">
  <div class="modal__backdrop" data-modal-close></div>
  <div class="modal__dialog${opts.size === 'lg' ? ' modal__dialog--lg' : ''}" role="dialog" aria-modal="true">
    <button type="button" class="modal__close" data-modal-close aria-label="${closeLabel}">${CLOSE_ICON}</button>
    <div class="modal__body">${content}</div>
  </div>
</div>`);
  const wrap = root.firstElementChild;
  const dialog = wrap.querySelector('[role="dialog"]');
  const heading = dialog.querySelector('.modal__body h2, .modal__body h3');
  if (heading) {
    if (!heading.id) heading.id = `modal-title-${Date.now().toString(36)}`;
    dialog.setAttribute('aria-labelledby', heading.id);
  } else {
    dialog.setAttribute('aria-label', opts.label ?? ut(opts.labelKey, ''));
  }

  // Si la hoja «Más» estaba abierta, #modal-root quedó inerte con el resto de la página: el modal se abre
  // encima y debe poder recibir el foco (la hoja pasa a inerte mientras tanto; su cierre ya restaura todo).
  root.inert = false;
  const restoreInert = inertOutside(root);
  const unlock = lockScroll();
  let downOnBackdrop = false;

  const onKey = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
    trapTab(dialog, ev);
  };
  const onDown = (ev) => { downOnBackdrop = ev.target.classList.contains('modal__backdrop'); };
  const onClick = (ev) => {
    const target = ev.target.closest('[data-modal-close]');
    if (!target) return;
    // El fondo solo cierra si el gesto empezó en él (arrastrar una selección desde el diálogo no cierra).
    if (target.classList.contains('modal__backdrop') && !downOnBackdrop) return;
    close();
  };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('pointerdown', onDown);
  wrap.addEventListener('click', onClick);

  requestAnimationFrame(() => requestAnimationFrame(() => { wrap.dataset.state = 'open'; }));
  dialog.querySelector('.modal__close').focus({ preventScroll: true });

  let closed = false;
  function close(immediate = false) {
    if (closed) return;
    closed = true;
    if (current === close) current = null;
    document.removeEventListener('keydown', onKey);
    restoreInert();
    unlock();
    const finish = () => {
      wrap.remove();
      if (opener?.isConnected && !current) opener.focus({ preventScroll: true });
      opts.onClose?.();
    };
    if (immediate) { finish(); return; }
    wrap.dataset.state = 'closing';
    afterMotion(wrap, 350, 'opacity').then(finish);
  }
  current = close;
  return () => close();
}
