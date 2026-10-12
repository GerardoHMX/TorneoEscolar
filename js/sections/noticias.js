// Noticias: solo filas con PUBLICAR = SI, un día cada vez con navegación anterior/siguiente que salta
// los días sin noticias (portado de main.js: encontrarDiasRelevantesNoticias + filtrarNoticiasPorFecha y
// de ui.js: renderNoticias + mostrarDetalleNoticia). El detalle se abre en el modal común (openModal).
import { html } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { sectionVisibility } from '../core/visibility.js';
import { openModal } from '../ui/modal.js';
import { pickLatestDay, itemsForDay } from './dates.js';
import { sectionTitle, emptyState, restoreFocus } from './common.js';
import { feedGroup, feedDay, feedStep, dayNav, bindDayNav, feedDateLabel } from './feed.js';
import { bindMediaFallback } from '../ui/media.js';

/** @typedef {import('../data/appModel.js').AppModel} AppModel @typedef {import('../data/models.js').Noticia} Noticia */

export const id = 'noticiasSection';
const IMGS = ['imagen', 'imagen2', 'imagen3', 'imagen4', 'imagen5'];

/** @param {AppModel} model */
export function hasData(model) {
  return !!sectionVisibility(model)[id];
}

/** @param {AppModel} model @param {Date} [today] inyectable para tests/demo @returns {{dia: number|null}} */
export function initialState(model, today = new Date()) {
  return { dia: pickLatestDay(feedGroup(model?.noticias).days, today) };
}

/** Lo que se ve: día actual y noticias (las del día; si solo hay una, + hasta 2 anteriores). */
export function newsView(model, state) {
  const group = feedGroup(model?.noticias);
  const day = feedDay(group, state?.dia);
  const entries = itemsForDay(group, day);
  return { group, day, entries, items: entries.map((e) => e.item) };
}

/** Día al que lleva «anterior» (−1) / «siguiente» (+1). */
export const stepNews = (model, dia, dir) => feedStep(feedGroup(model?.noticias), dia, dir);

/** URLs https de IMAGEN..IMAGEN5 (las vacías o inseguras se descartan). */
export const newsImages = (n, width) => IMGS.map((k) => driveImg(n?.[k], width)).filter(Boolean);

/** Texto plano en una línea, cortado por palabra. */
export function excerpt(text, max = 160) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
}

/**
 * Texto de la hoja -> texto plano: el sitio antiguo inyectaba CONTENIDO como HTML y algunas noticias traen
 * etiquetas sueltas (p. ej. «</li>»). Aquí se QUITAN (nunca se interpretan): <br>, </p>, </li>… pasan a salto
 * de línea y el resto desaparece; después todo se escapa al pintar.
 */
export function plainText(text) {
  return String(text ?? '')
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d|li|p)\b[^<>]*>/gi, '\n')
    .replace(/<\/?[a-z][^<>]*>/gi, '')
    .replace(/[ \t]+\n/g, '\n');
}

/** Bloques del texto: párrafos y, si varias líneas seguidas empiezan por «-» o «•», una lista. */
export function contentBlocks(text) {
  const lines = plainText(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    const m = l.match(/^[-•·*]\s*(.+)$/);
    if (m) {
      const last = out[out.length - 1];
      if (last?.list) last.list.push(m[1]); else out.push({ list: [m[1]] });
    } else out.push({ p: l });
  }
  return out;
}

/**
 * Cuerpo del modal de una noticia: título, fecha y créditos, hasta 5 imágenes y el texto en párrafos.
 * @param {Noticia} n @returns {import('../core/dom.js').SafeHtml}
 */
export function newsDetail(n, t) {
  const locale = t('date_locale', 'es-ES');
  const imgs = newsImages(n);
  const title = n?.titulo || t('noticia', 'Noticia');
  const fecha = feedDateLabel(n?.fecha, locale);
  return html`<h2 class="news-detail__title">${title}</h2>
    <p class="news-detail__meta">${fecha ? html`<span class="tag">${fecha}</span>` : ''}${n?.creditos ? html`<span class="news-detail__credits">${n.creditos}</span>` : ''}</p>
    ${imgs.length ? html`<div class="news-detail__gallery" data-n="${Math.min(imgs.length, 5)}">${imgs.map((src, i) => html`<figure class="news-detail__fig" data-media><img src="${src}" alt="${i === 0 ? title : ''}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer"></figure>`)}</div>` : ''}
    <div class="news-detail__text">${contentBlocks(n?.contenido).map((b) => (b.list
      ? html`<ul class="news-detail__list">${b.list.map((li) => html`<li>${li}</li>`)}</ul>`
      : html`<p class="news-detail__p">${b.p}</p>`))}</div>`;
}

const TITLE = [['section_news_title', 'Noticias'], ['section_news_kicker', 'Actualidad']];

function card(entry, i, t, locale) {
  const n = entry.item;
  const src = newsImages(n, 800)[0] ?? '';
  const fecha = feedDateLabel(n.fecha, locale);
  const resumen = excerpt(plainText(n.contenido));
  return html`<article class="news-card reveal" style="--i:${i}">
    <div class="news-card__media${src ? '' : ' is-broken'}" data-media>${src ? html`<img src="${src}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<span class="news-card__ph" aria-hidden="true">⚽</span></div>
    <div class="news-card__body">
      <p class="news-card__meta">${fecha ? html`<time>${fecha}</time>` : ''}${n.creditos ? html`<span class="news-card__credit">${n.creditos}</span>` : ''}</p>
      <h3 class="news-card__title"><button type="button" class="news-card__link" data-news="${i}">${n.titulo || t('noticia', 'Noticia')}</button></h3>
      ${resumen ? html`<p class="news-card__excerpt">${resumen}</p>` : ''}
      <span class="news-card__more" aria-hidden="true">${t('msg_read_more', 'Continuar leyendo →')}</span>
    </div>
  </article>`;
}

/** @param {AppModel} model */
export function render(model, state = {}, t) {
  const title = sectionTitle(t, ...TITLE);
  const { group, day, entries } = newsView(model, state);
  if (!entries.length) {
    return html`${title}${emptyState(t, ['msg_no_news', 'No hay noticias disponibles'], ['msg_no_news_description', 'Las noticias estarán disponibles pronto con las últimas noticias del torneo.'])}`;
  }
  const locale = t('date_locale', 'es-ES');
  return html`${title}${dayNav(group, day, t, t('news_day_label', 'Noticias del día'))}
    <div class="news-grid${entries.length === 1 ? ' news-grid--single' : ''}">${entries.map((e, i) => card(e, i, t, locale))}</div>`;
}

/** @param {Element} root @param {{model: AppModel, state: any, setState: (patch: object) => void, t: Function}} ctx */
export function bind(root, ctx) {
  if (!root) return;
  const { group, items } = newsView(ctx.model, ctx.state);
  bindDayNav(root, ctx, id, group);
  root.querySelectorAll('button[data-news]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = items[Number(btn.dataset.news)];
      if (!n) return;
      openModal(newsDetail(n, ctx.t), { size: 'lg' });
      bindMediaFallback(document.getElementById('modal-root'));
    });
  });
  bindMediaFallback(root);
  restoreFocus(root, id);
}
