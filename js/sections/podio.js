// Podio: campeón, subcampeón y tercer puesto (parsePodio). Porta renderPodio (js/ui.js) sin la imagen
// podium.png: tres escalones CSS que suben al entrar en pantalla (.reveal -> .is-visible) con brillo
// dorado en el primero, y una ráfaga de confeti (js/ui/confetti.js; no-op con movimiento reducido).
import { html } from '../core/dom.js';
import { sectionVisibility } from '../core/visibility.js';
import { crest } from '../ui/matchCard.js';
import { startConfetti } from '../ui/confetti.js';
import { sectionTitle, emptyState, bindCommon } from './common.js';

export const id = 'podioSection';

export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** El podio no tiene filtros. */
export function initialState() {
  return {};
}

const TITLE = [['section_podium_title', 'Podio'], ['section_podium_kicker', 'Los campeones']];
const PLACES = [
  // orden de lectura 1.º, 2.º, 3.º; en pantalla el CSS los coloca 2.º-1.º-3.º (order)
  [1, 'primero', 'podium_first', 'Campeón'],
  [2, 'segundo', 'podium_second', 'Subcampeón'],
  [3, 'tercero', 'podium_third', 'Tercer puesto'],
];

export function render(model, _state, t) {
  const title = sectionTitle(t, ...TITLE);
  if (!hasData(model)) {
    return html`${title}${emptyState(t, ['msg_no_podium', 'El podio se decide en la final'], ['msg_no_podium_description', 'Aquí aparecerán los tres mejores equipos cuando termine el torneo.'])}`;
  }
  const podio = model.podio;
  const places = PLACES.map(([n, key, tKey, fb]) => {
    const puesto = podio[key];
    const has = !!String(puesto?.equipo ?? '').trim();
    const name = has ? puesto.equipo : t('to_define', 'Por definir');
    return html`<li class="podium__place podium__place--${n}">
      <div class="podium__team">
        ${n === 1 ? html`<span class="podium__crown" aria-hidden="true">🏆</span>` : ''}
        ${crest(name, has ? puesto.logo : '', { size: n === 1 ? 'lg' : 'md' })}
        <span class="podium__label">${t(tKey, fb)}</span>
        <span class="podium__name">${name}</span>
      </div>
      <div class="podium__step" aria-hidden="true"><span class="podium__num num">${n}</span></div>
    </li>`;
  });
  return html`${title}<div class="podium reveal">
    <canvas class="podium__confetti" aria-hidden="true"></canvas>
    <ol class="podium__places" aria-label="${t('section_podium_title', 'Podio')}">${places}</ol>
  </div>`;
}

let celebrated = false; // una sola ráfaga por carga de página (bind se repite en cada re-render)

export function bind(root, ctx) {
  bindCommon(root, ctx, id);
  const canvas = root?.querySelector?.('.podium__confetti');
  if (!canvas || celebrated || typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting) || celebrated) return;
    celebrated = true;
    io.disconnect();
    // tras la subida de los escalones
    setTimeout(() => { if (canvas.isConnected) startConfetti(canvas); }, 900);
  }, { threshold: 0.35 });
  io.observe(canvas.parentElement ?? canvas);
}
