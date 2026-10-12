// Acordeón accesible (patrón WAI-ARIA Accordion) con despliegue animado por grid-template-rows.
//
// Marcado esperado (accordionItem() lo genera):
//   <div class="accordion" [data-single]>                 ← root; data-single = solo uno abierto
//     <div class="acc-item">
//       <h3 class="acc-heading"><button class="acc-trigger" aria-expanded="false">Título</button></h3>
//       <div class="acc-panel"><div class="acc-panel__inner">…</div></div>
//     </div>
//   </div>
// createAccordion completa ids, aria-controls/aria-labelledby, role="region" e `inert` del panel cerrado.

import { html } from '../core/dom.js';
import { nextIndex } from './tabs.js';

let uid = 0;
const bound = new WeakSet();

const ICON = html`<svg class="acc-trigger__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

/**
 * Marcado de un elemento del acordeón (envolver los elementos en `<div class="accordion">`).
 * @param {string} title texto (se escapa)
 * @param {import('../core/dom.js').SafeHtml} body contenido ya seguro
 * @param {{open?: boolean, level?: 2|3|4}} [opts] nivel del encabezado según la jerarquía de la sección
 */
export function accordionItem(title, body, { open = false, level = 3 } = {}) {
  const h = [2, 3, 4].includes(level) ? `h${level}` : 'h3';
  return html`<div class="acc-item"><${h} class="acc-heading"><button type="button" class="acc-trigger" aria-expanded="${open ? 'true' : 'false'}"><span class="acc-trigger__label">${title}</span>${ICON}</button></${h}><div class="acc-panel"><div class="acc-panel__inner">${body}</div></div></div>`;
}

function setOpen(item, open) {
  const trigger = item.querySelector('.acc-trigger');
  const panel = item.querySelector('.acc-panel');
  if (!trigger || !panel) return;
  trigger.setAttribute('aria-expanded', String(open));
  item.classList.toggle('is-open', open);
  panel.inert = !open; // el contenido plegado no recibe foco ni se anuncia
}

/** @param {Element} root */
export function createAccordion(root) {
  if (!root || bound.has(root)) return;
  bound.add(root);
  root.classList.add('accordion');
  const items = () => [...root.querySelectorAll('.acc-item')].filter((it) => it.closest('.accordion') === root);

  for (const item of items()) {
    const trigger = item.querySelector('.acc-trigger');
    const panel = item.querySelector('.acc-panel');
    if (!trigger || !panel) continue;
    uid += 1;
    if (!trigger.id) trigger.id = `acc-t-${uid}`;
    if (!panel.id) panel.id = `acc-p-${uid}`;
    trigger.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', trigger.id);
    setOpen(item, trigger.getAttribute('aria-expanded') === 'true');
  }

  root.addEventListener('click', (ev) => {
    const trigger = ev.target.closest('.acc-trigger');
    const item = trigger?.closest('.acc-item');
    if (!item || item.closest('.accordion') !== root) return;
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    if (open && root.hasAttribute('data-single')) items().forEach((it) => it !== item && setOpen(it, false));
    setOpen(item, open);
  });

  // ↑/↓/Inicio/Fin entre encabezados (opcional en el patrón APG; útil con listas largas de bases).
  root.addEventListener('keydown', (ev) => {
    if (!ev.target.classList?.contains('acc-trigger')) return;
    const triggers = items().map((it) => it.querySelector('.acc-trigger')).filter(Boolean);
    const to = nextIndex(triggers.indexOf(ev.target), ev.key, triggers.length, 'vertical');
    if (to === null) return;
    ev.preventDefault();
    triggers[to].focus();
  });
}
