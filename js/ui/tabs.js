// Chips de filtro de selección única (ESO / BCH / TODOS, grupos, días...).
//
// Semántica elegida (una sola, para todo el sitio): patrón WAI-ARIA «toolbar» de botones conmutables.
//  - contenedor role="toolbar" (+ aria-label que pone quien renderiza) y aria-orientation="horizontal";
//  - cada chip es un <button class="chip" data-value="..."> con aria-pressed="true|false";
//  - un único punto de tabulación (tabindex itinerante); ←/→ mueven el foco, Inicio/Fin a los extremos;
//  - Intro/Espacio/clic activan el chip (la selección NO sigue al foco: cada cambio re-renderiza la sección).
// No se usa role="tablist" porque los filtros no gobiernan paneles (tabpanel) sino que filtran
// la misma lista; aria-pressed es lo que css/base.css ya estiliza (.chip[aria-pressed=true]).

/**
 * Índice destino para una tecla de navegación.
 * @param {number} current @param {string} key @param {number} count
 * @param {'horizontal'|'vertical'|'both'} [orientation]
 * @returns {number|null}
 */
export function nextIndex(current, key, count, orientation = 'both') {
  if (!(count > 0)) return null;
  const h = orientation !== 'vertical';
  const v = orientation !== 'horizontal';
  const cur = current < 0 ? -1 : current;
  if ((h && key === 'ArrowRight') || (v && key === 'ArrowDown')) return (cur + 1) % count;
  if ((h && key === 'ArrowLeft') || (v && key === 'ArrowUp')) return cur <= 0 ? count - 1 : cur - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

const bound = new WeakSet();

/**
 * Activa los chips `button[data-value]` de `container`.
 * @param {Element} container
 * @param {(value: string) => void} onChange se llama solo cuando cambia el valor seleccionado
 */
export function createTabs(container, onChange) {
  if (!container || bound.has(container)) return;
  bound.add(container);
  container.setAttribute('role', 'toolbar');
  if (!container.hasAttribute('aria-orientation')) container.setAttribute('aria-orientation', 'horizontal');

  const chips = () => [...container.querySelectorAll('button[data-value]')].filter((b) => !b.disabled);
  const sync = () => {
    const list = chips();
    let sel = list.find((b) => b.getAttribute('aria-pressed') === 'true');
    if (!sel && list[0]) sel = list[0];
    list.forEach((b) => {
      b.setAttribute('aria-pressed', String(b === sel));
      b.tabIndex = b === sel ? 0 : -1;
    });
  };
  sync();

  const select = (btn) => {
    if (btn.getAttribute('aria-pressed') === 'true') return;
    chips().forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
      b.tabIndex = b === btn ? 0 : -1;
    });
    onChange?.(btn.dataset.value ?? '');
  };

  container.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-value]');
    if (btn && container.contains(btn) && !btn.disabled) select(btn);
  });

  container.addEventListener('keydown', (ev) => {
    const list = chips();
    const to = nextIndex(list.indexOf(document.activeElement), ev.key, list.length, 'horizontal');
    if (to === null) return;
    ev.preventDefault();
    list.forEach((b, i) => { b.tabIndex = i === to ? 0 : -1; });
    list[to].focus();
  });

  // Si el foco sale sin elegir, el punto de tabulación vuelve al chip seleccionado.
  container.addEventListener('focusout', (ev) => {
    if (!container.contains(ev.relatedTarget)) sync();
  });
}
