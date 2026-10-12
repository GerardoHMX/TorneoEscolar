// Galería: solo filas con PUBLICAR = SI, un día cada vez con navegación anterior/siguiente (portado de
// main.js: encontrarDiasRelevantesGaleria + filtrarGaleriaPorFecha y de ui.js: renderGalería +
// mostrarDetalleGalería). TIPO IMAGEN (o vacío) -> miniatura que abre un visor (openModal) con
// anterior/siguiente; TIPO VIDEO -> solo vídeos de https://drive.google.com, incrustados con /preview;
// cualquier otro vídeo (YouTube, otros dominios) se omite.
import { html } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { sectionVisibility } from '../core/visibility.js';
import { openModal } from '../ui/modal.js';
import { pickLatestDay, itemsForDay } from './dates.js';
import { sectionTitle, emptyState, restoreFocus } from './common.js';
import { feedGroup, feedDay, feedStep, dayNav, bindDayNav, feedDateLabel } from './feed.js';
import { bindMediaFallback } from '../ui/media.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel @typedef {import('../data/models.js').GaleriaItem} GaleriaItem */

export const id = 'galeriaSection';

/** @param {AppModel} model */
export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** @param {AppModel} model @param {Date} [today] @returns {{dia: number|null}} */
export function initialState(model, today = new Date()) {
  return { dia: pickLatestDay(feedGroup(model?.galeria).days, today) };
}

/**
 * URL de inserción de un vídeo de Google Drive: solo https y host EXACTO drive.google.com, con id de
 * archivo (/file/d/ID o ?id=ID). Cualquier otra cosa -> ''.
 */
export function driveVideoEmbed(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  let u;
  try { u = new URL(url.trim()); } catch { return ''; }
  if (u.protocol !== 'https:' || u.hostname !== 'drive.google.com') return '';
  const fid = u.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? u.searchParams.get('id') ?? '';
  return /^[a-zA-Z0-9_-]+$/.test(fid) ? `https://drive.google.com/file/d/${fid}/preview` : '';
}

const tipo = (g) => String(g?.tipo ?? '').trim().toUpperCase();

/**
 * Elemento listo para pintar, o null si no se puede mostrar de forma segura.
 * @returns {{kind: 'image', src: string, full: string, g: GaleriaItem} | {kind: 'video', src: string, g: GaleriaItem} | null}
 */
export function media(g) {
  const k = tipo(g);
  if (k === 'VIDEO') {
    const src = driveVideoEmbed(g.url);
    return src ? { kind: 'video', src, g } : null;
  }
  if (k !== '' && k !== 'IMAGEN') return null;
  const full = driveImg(g.url);
  return full ? { kind: 'image', src: driveImg(g.url, 900), full, g } : null;
}

/** Lo que se ve: día actual y elementos mostrables. */
export function galeriaView(model, state) {
  const group = feedGroup(model?.galeria);
  const day = feedDay(group, state?.dia);
  const shown = itemsForDay(group, day).map((e) => media(e.item)).filter(Boolean);
  return { group, day, shown, images: shown.filter((m) => m.kind === 'image') };
}

export const stepGaleria = (model, dia, dir) => feedStep(feedGroup(model?.galeria), dia, dir);

function caption(g, locale, cls) {
  const fecha = feedDateLabel(g.fecha, locale);
  if (!g.titulo && !fecha && !g.descripcion) return '';
  return html`<figcaption class="${cls}">
    ${g.titulo ? html`<span class="${cls}-title">${g.titulo}</span>` : ''}
    ${fecha ? html`<time class="${cls}-date">${fecha}</time>` : ''}
    ${g.descripcion ? html`<span class="${cls}-desc">${g.descripcion}</span>` : ''}
  </figcaption>`;
}

/**
 * Cuerpo del visor de una imagen. `pos` = {index, total} activa anterior/siguiente.
 * @param {GaleriaItem} g @returns {import('../core/dom.js').SafeHtml}
 */
export function lightbox(g, t, pos = { index: 0, total: 1 }) {
  const full = driveImg(g?.url);
  const locale = t('date_locale', 'es-ES');
  const title = g?.titulo || t('gallery_image', 'Imagen de la galería');
  const fecha = feedDateLabel(g?.fecha, locale);
  const multi = pos.total > 1;
  const nav = (dir, key, fb, d) => html`<button type="button" class="lightbox__nav lightbox__nav--${dir < 0 ? 'prev' : 'next'}" data-lb-step="${dir}" aria-label="${t(key, fb)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  return html`<h2 class="lightbox__title">${title}</h2>
    <div class="lightbox__stage" data-media>${full ? html`<img src="${full}" alt="${g?.titulo ?? ''}" decoding="async" referrerpolicy="no-referrer">` : ''}
      ${multi ? html`${nav(-1, 'gallery_prev', 'Imagen anterior', 'M15 6l-6 6 6 6')}${nav(1, 'gallery_next', 'Imagen siguiente', 'M9 6l6 6-6 6')}` : ''}
    </div>
    <p class="lightbox__meta">${fecha ? html`<span class="tag">${fecha}</span>` : ''}${multi ? html`<span class="lightbox__count" aria-live="polite">${pos.index + 1} / ${pos.total}</span>` : ''}</p>
    ${g?.descripcion ? html`<p class="lightbox__desc">${g.descripcion}</p>` : ''}`;
}

const TITLE = [['section_gallery_title', 'Galería'], ['section_gallery_kicker', 'En imágenes']];

function tile(m, i, imgIndex, t, locale) {
  const g = m.g;
  if (m.kind === 'video') {
    const title = g.titulo || t('gallery_video', 'Vídeo del torneo');
    return html`<figure class="gal-tile gal-tile--video reveal" style="--i:${i}">
      <div class="gal-tile__frame"><iframe src="${m.src}" title="${title}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
      ${caption(g, locale, 'gal-tile__cap')}
    </figure>`;
  }
  const label = `${t('gallery_open', 'Ampliar')}: ${g.titulo || t('gallery_image', 'Imagen de la galería')}`;
  return html`<figure class="gal-tile reveal" style="--i:${i}">
    <button type="button" class="gal-tile__btn" data-gal="${imgIndex}" aria-label="${label}">
      <span class="gal-tile__media" data-media><img src="${m.src}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="gal-tile__zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10ZM9.75 7.5v2.25H7.5v1.5h2.25v2.25h1.5v-2.25h2.25v-1.5h-2.25V7.5h-1.5Z" fill="currentColor"/></svg></span></span>
    </button>
    ${caption(g, locale, 'gal-tile__cap')}
  </figure>`;
}

/** @param {AppModel} model */
export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const { group, day, shown } = galeriaView(model, state);
  if (!shown.length) {
    return html`${title}${emptyState(t, ['msg_no_gallery', 'No hay imágenes en la galería'], ['msg_no_gallery_description', 'La galería estará disponible pronto con imágenes y videos del torneo.'])}`;
  }
  const locale = t('date_locale', 'es-ES');
  let img = 0;
  return html`${title}${dayNav(group, day, t, t('gallery_day_label', 'Galería del día'))}
    <div class="gal-grid${shown.length === 1 ? ' gal-grid--single' : ''}">${shown.map((m, i) => tile(m, i, m.kind === 'image' ? img++ : -1, t, locale))}</div>`;
}

/** Abre el visor en la imagen `i` de `images`; ←/→ y los botones recorren las demás. */
function openLightbox(images, i, t) {
  const total = images.length;
  const at = ((i % total) + total) % total;
  openModal(lightbox(images[at].g, t, { index: at, total }), { size: 'lg' });
  const root = document.getElementById('modal-root');
  const wrap = root?.querySelector('.modal');
  if (!wrap) return;
  bindMediaFallback(root);
  wrap.querySelector('.modal__dialog')?.classList.add('modal__dialog--lightbox');
  const go = (dir) => {
    openLightbox(images, at + dir, t);
    document.querySelector(`#modal-root [data-lb-step="${dir}"]`)?.focus({ preventScroll: true });
  };
  wrap.querySelectorAll('[data-lb-step]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.lbStep))));
  if (total > 1) {
    wrap.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); go(ev.key === 'ArrowLeft' ? -1 : 1); }
    });
  }
}

/** @param {Element} root @param {{model: AppModel, state: any, setState: (patch: object) => void, t: Function}} ctx */
export function bind(root, ctx) {
  if (!root) return;
  const { group, images } = galeriaView(ctx.model, ctx.state);
  bindDayNav(root, ctx, id, group);
  root.querySelectorAll('button[data-gal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.gal);
      if (images[i]) openLightbox(images, i, ctx.t);
    });
  });
  bindMediaFallback(root);
  restoreFocus(root, id);
}
