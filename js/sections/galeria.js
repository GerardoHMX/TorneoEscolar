// Galería: solo filas con PUBLICAR = SI; vista «Todas» (por defecto, de la más reciente a la más antigua) o
// «Por día», un día cada vez con navegación anterior/siguiente, como Noticias (portado de
// main.js: encontrarDiasRelevantesGaleria + filtrarGaleriaPorFecha y de ui.js: renderGalería +
// mostrarDetalleGalería). TIPO IMAGEN (o vacío) -> miniatura que abre un visor (openModal) con
// anterior/siguiente; TIPO VIDEO -> vídeo del propio sitio (URL «media/nombre.mp4»: sin reproductor, arranca al tocarlo,
// uno a la vez, con PORTADA al principio y al final; js/ui/clip.js) o vídeo de https://drive.google.com
// (con DRIVE_API_KEY en CONFIGURACION: igual que uno propio; sin clave: incrustado con /preview, PORTADA
// solo al principio);
// cualquier otro vídeo (YouTube, otros dominios) se omite.
import { html, raw } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { sectionVisibility } from '../core/visibility.js';
import { openModal } from '../ui/modal.js';
import { pickLatestDay, itemsForDay } from './dates.js';
import { sectionTitle, emptyState, restoreFocus, rememberFocus } from './common.js';
import { feedGroup, feedDay, feedStep, dayNav, bindDayNav, feedDateLabel } from './feed.js';
import { bindMediaFallback } from '../ui/media.js';
import { bindClips, bindDriveCovers, fitDriveFrames, localImage, localVideo, posterFor } from '../ui/clip.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel @typedef {import('../data/models.js').GaleriaItem} GaleriaItem */

export const id = 'galeriaSection';

/** @param {AppModel} model */
export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** Vista por defecto: toda la galería publicada. «dia» = un día cada vez con navegación (como Noticias). */
export const VISTAS = ['todas', 'dia'];

/** @param {AppModel} model @param {Date} [today] @returns {{vista: string, dia: number|null}} */
export function initialState(model, today = new Date()) {
  return { vista: 'todas', dia: pickLatestDay(feedGroup(model?.galeria).days, today) };
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

/**
 * Archivo de vídeo de Drive servido por la API oficial (Drive API v3, alt=media) para reproducirlo con el
 * <video> del sitio, sin el reproductor de Drive. Necesita una clave de API (CONFIGURACION: DRIVE_API_KEY) y
 * que el archivo sea público. Sin clave válida -> ''. (Los enlaces directos de Drive sin clave responden 403
 * a cualquier petición hecha desde otra web.)
 */
export function driveVideoApi(url, key) {
  const fid = driveVideoEmbed(url).match(/\/file\/d\/([a-zA-Z0-9_-]+)\/preview$/)?.[1];
  const k = String(key ?? '').trim();
  return fid && /^[A-Za-z0-9_-]{20,80}$/.test(k) ? `https://www.googleapis.com/drive/v3/files/${fid}?alt=media&key=${k}` : '';
}

const tipo = (g) => String(g?.tipo ?? '').trim().toUpperCase();

/**
 * Elemento listo para pintar, o null si no se puede mostrar de forma segura.
 * @returns {{kind: 'image', src: string, full: string, g: GaleriaItem} | {kind: 'video', src: string, thumb: string, poster: string, g: GaleriaItem} | {kind: 'clip', src: string, poster: string, fallback?: string, thumb?: string, g: GaleriaItem} | null}
 */
export function media(g, driveKey = '') {
  const k = tipo(g);
  if (k === 'VIDEO') {
    // PORTADA (opcional): imagen de Drive o del sitio (media/…) que cubre el vídeo al principio y al final.
    const portada = localImage(g.portada) || driveImg(g.portada, 1200);
    const local = localVideo(g.url);
    if (local) return { kind: 'clip', src: local, poster: portada || posterFor(local), g };
    // Drive solo se puede incrustar con su propio reproductor (Google rechaza con 403 servir el archivo a un
    // <video> de otro sitio): la PORTADA lo tapa hasta el primer clic, pero no puede volver al terminar.
    const src = driveVideoEmbed(g.url);
    if (!src) return null;
    const thumb = driveImg(g.url, 400);
    // Con DRIVE_API_KEY: mismo trato que un vídeo propio (arranca al tocarlo, sin reproductor, portada al principio y
    // al final). Si la API falla (clave, cuota, archivo privado), js/ui/clip.js vuelve al iframe (fallback).
    const api = driveVideoApi(g.url, driveKey);
    if (api) return { kind: 'clip', src: api, poster: portada || driveImg(g.url, 1200), fallback: src, thumb, g };
    return { kind: 'video', src, thumb, poster: portada, g };
  }
  if (k !== '' && k !== 'IMAGEN') return null;
  const full = driveImg(g.url);
  return full ? { kind: 'image', src: driveImg(g.url, 900), full, g } : null;
}

/** Lo que se ve: día actual, si es la vista «Todas» y los elementos mostrables. */
export function galeriaView(model, state) {
  const group = feedGroup(model?.galeria);
  const day = feedDay(group, state?.dia);
  const all = state?.vista !== 'dia';
  const items = all
    ? [...group.days].reverse().flatMap((d) => group.byDay.get(d)).concat(group.undated)
    : itemsForDay(group, day).map((e) => e.item);
  const shown = items.map((g) => media(g, model?.config?.DRIVE_API_KEY)).filter(Boolean);
  return { group, day, all, shown, images: shown.filter((m) => m.kind === 'image') };
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

function viewToggle(all, t) {
  const b = (v, key, fb) => html`<button type="button" class="chip" data-gal-view="${v}" aria-pressed="${(v === 'todas') === all}">${t(key, fb)}</button>`;
  return html`<div class="chip-row news-views reveal" role="group" aria-label="${t('gallery_view_label', 'Vista de la galería')}" data-focus-group>
    ${b('todas', 'gallery_view_all', 'Todas')}${b('dia', 'gallery_view_day', 'Por día')}
  </div>`;
}

// Iconos de los vídeos propios: el CSS muestra el que toca según data-state / aria-pressed.
const svg = (cls, d) => html`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_TOGGLE = html`${svg('gal-clip__i gal-clip__i--play', 'M8 5.5v13l11-6.5z')}${svg('gal-clip__i gal-clip__i--pause', 'M8.5 5.5v13M15.5 5.5v13')}${svg('gal-clip__i gal-clip__i--replay', 'M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v3.5H8')}`;
const ICON_SOUND = html`${svg('gal-clip__i gal-clip__i--muted', 'M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM16 9.5l5 5M21 9.5l-5 5')}${svg('gal-clip__i gal-clip__i--sound', 'M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11')}`;

function tile(m, i, imgIndex, t, locale) {
  const g = m.g;
  if (m.kind === 'clip') {
    const title = g.titulo || t('gallery_video', 'Vídeo del torneo');
    return html`<figure class="gal-tile gal-tile--video reveal" style="--i:${i}">
      <div class="gal-tile__frame gal-clip" data-clip data-state="idle"${m.fallback ? html` data-clip-fallback="${m.fallback}" data-drive-thumb="${m.thumb}"` : ''}>
        <video src="${m.src}" poster="${m.poster}" muted playsinline preload="metadata" aria-label="${title}"></video>
        <img class="gal-cover" src="${m.poster}" alt="" decoding="async" referrerpolicy="no-referrer">
        <div class="gal-clip__tools">
          <button type="button" class="gal-clip__btn" data-clip-sound aria-pressed="false">${ICON_SOUND}</button>
          <button type="button" class="gal-clip__btn" data-clip-toggle>${ICON_TOGGLE}</button>
        </div>
      </div>
      ${caption(g, locale, 'gal-tile__cap')}
    </figure>`;
  }
  if (m.kind === 'video') {
    const title = g.titulo || t('gallery_video', 'Vídeo del torneo');
    return html`<figure class="gal-tile gal-tile--video reveal" style="--i:${i}">
      <div class="gal-tile__frame${m.poster ? ' gal-drive' : ''}" data-drive-thumb="${m.thumb}"${m.poster ? raw(' data-drive-cover') : ''}>${m.poster ? html`<img class="gal-cover" src="${m.poster}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="gal-drive__play" aria-hidden="true"></span>` : ''}<iframe src="${m.src}" title="${title}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
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
  const { group, day, all, shown } = galeriaView(model, state);
  if (!shown.length) {
    return html`${title}${emptyState(t, ['msg_no_gallery', 'No hay imágenes en la galería'], ['msg_no_gallery_description', 'La galería estará disponible pronto con imágenes y videos del torneo.'])}`;
  }
  const locale = t('date_locale', 'es-ES');
  let img = 0;
  return html`${title}${group.days.length ? viewToggle(all, t) : ''}${all ? '' : dayNav(group, day, t, t('gallery_day_label', 'Galería del día'))}
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
  root.querySelectorAll('button[data-gal-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vista = btn.dataset.galView;
      rememberFocus(id, `button[data-gal-view="${vista}"]`);
      ctx.setState({ vista });
    });
  });
  root.querySelectorAll('button[data-gal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.gal);
      if (images[i]) openLightbox(images, i, ctx.t);
    });
  });
  bindMediaFallback(root);
  bindClips(root, ctx.t);
  fitDriveFrames(root);
  bindDriveCovers();
  // Portada de Drive que no carga: se retira y queda el reproductor tal cual.
  root.querySelectorAll('[data-drive-cover] .gal-cover').forEach((img) => img.addEventListener('error', () => img.closest('[data-drive-cover]')?.classList.add('is-started')));
  restoreFocus(root, id);
}
