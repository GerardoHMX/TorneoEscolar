// Balón dorado flotante (mismas siluetas que el loader). Antes vivía en el hero; ahora acompaña a la
// cabecera de «Próximos partidos» (css/sections.css: .gold-ball). Decorativo: aria-hidden.
import { html } from '../core/dom.js';
import { BALL, BALL_PANELS } from './loader.js';

function svg() {
  const { x, y, r } = BALL;
  const box = `${x - r - 1} ${y - r - 1} ${2 * r + 2} ${2 * r + 2}`;
  return html`<svg class="gold-ball__svg" viewBox="${box}" focusable="false">
    <defs>
      <radialGradient id="goldBallBody" cx=".36" cy=".3" r=".85">
        <stop offset="0" stop-color="#8a6210"></stop>
        <stop offset=".55" stop-color="#634610"></stop>
        <stop offset="1" stop-color="#3f2d0c"></stop>
      </radialGradient>
      <linearGradient id="goldBallGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#faefd2"></stop>
        <stop offset=".45" stop-color="#eac871"></stop>
        <stop offset="1" stop-color="#b07f14"></stop>
      </linearGradient>
    </defs>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#goldBallBody)"></circle>
    <g fill="url(#goldBallGold)">${BALL_PANELS.map(([d]) => html`<path d="${d}"></path>`)}</g>
    <circle cx="${x}" cy="${y}" r="${r - 1}" fill="none" stroke="#f3dea3" stroke-opacity=".35" stroke-width="2"></circle>
  </svg>`;
}

/** @param {string} [extraClass] */
export function goldBall(extraClass = '') {
  return html`<div class="gold-ball ${extraClass}" aria-hidden="true">
    <div class="gold-ball__float">${svg()}</div>
    <span class="gold-ball__shadow"></span>
  </div>`;
}
