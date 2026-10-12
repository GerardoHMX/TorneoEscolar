// Pie de página (#site-footer), portado del <footer> de index.html antiguo (466da58, l.483-533): logo y
// datos del colegio desde CONFIGURACION, nombre y temporada del torneo, Instagram y el crédito
// «Realizado por Gerardo Huizar Castro» con la licencia CC BY-NC-SA 4.0. Junto a Instagram, el icono
// «Compartir este sitio» ([data-share]; lo cablea js/ui/share.js tras cada repintado del pie).
// Seguridad: todo pasa por `html` (escape); imágenes por driveImg, enlaces por safeUrl (solo https);
// tel: solo con dígitos; mailto: solo con un email de forma válida; enlaces externos con noopener noreferrer.
import { html, safeUrl } from '../core/dom.js';
import { driveImg } from '../core/drive.js';
import { bindMediaFallback } from './media.js';

const txt = (v) => String(v ?? '').trim();
const EXT = 'noopener noreferrer';

/** Teléfono -> «tel:» con solo dígitos (y + inicial); '' si quedan menos de 3 dígitos (p. ej. «llamar»). */
export function telHref(phone) {
  const s = txt(phone);
  const digits = s.replace(/\D/g, '');
  if (digits.length < 3) return '';
  return `tel:${s.startsWith('+') ? '+' : ''}${digits}`;
}

/** Email -> «mailto:» solo si tiene forma de dirección (sin espacios, comillas, <>, ni ?/= que inyectarían bcc/subject). */
export function mailHref(email) {
  const s = txt(email);
  return /^[^\s@<>"'()&;:,?=\\]+@[^\s@<>"'()&;:,?=\\]+\.[A-Za-z]{2,}$/.test(s) ? `mailto:${s}` : '';
}

const ICON = {
  phone: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z" fill="currentColor"/></svg>`,
  mail: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 2.2V17h16V7.2l-8 5.3-8-5.3ZM5.6 7 12 11.2 18.4 7H5.6Z" fill="currentColor"/></svg>`,
  pin: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7Zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5Z" fill="currentColor"/></svg>`,
  web: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm6.9 6a8 8 0 0 0-3.4-3.3c.6 1 1.1 2.1 1.4 3.3h2Zm-4.1 0C14.3 6.2 13.3 4.6 12 4c-1.3.6-2.3 2.2-2.8 4h5.6ZM4.9 14h2.4a17 17 0 0 1 0-4H4.9a8 8 0 0 0 0 4Zm.2 2a8 8 0 0 0 3.4 3.3c-.6-1-1.1-2.1-1.4-3.3h-2Zm4.1 0c.5 1.8 1.5 3.4 2.8 4 1.3-.6 2.3-2.2 2.8-4H9.2Zm5.9-2h-6.2a15 15 0 0 1 0-4h6.2a15 15 0 0 1 0 4Zm1.6 0h2.4a8 8 0 0 0 0-4h-2.4a17 17 0 0 1 0 4Zm-1.2 5.3a8 8 0 0 0 3.4-3.3h-2c-.3 1.2-.8 2.3-1.4 3.3ZM5.1 8h2c.3-1.2.8-2.3 1.4-3.3A8 8 0 0 0 5.1 8Z" fill="currentColor"/></svg>`,
  share: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2.6"></circle><circle cx="6" cy="12" r="2.6"></circle><circle cx="18" cy="19" r="2.6"></circle><path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4"></path></svg>`,
  insta: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4.2"></circle><circle cx="17.4" cy="6.6" r="0.6" fill="currentColor"></circle></svg>`,
};

const CC = ['cc', 'by', 'nc', 'sa'];

/**
 * @param {Record<string, string>} [config] CONFIGURACION (parseConfig)
 * @param {(key: string, fallback?: string) => string} t
 * @param {{assetBase?: string}} [opts] prefijo de rutas locales (img/profile.jpg) si la página no está en la raíz
 * @returns {import('../core/dom.js').SafeHtml}
 */
export function renderFooter(config, t, opts = {}) {
  const c = config ?? {};
  const base = typeof opts.assetBase === 'string' && !/[:"'<>]/.test(opts.assetBase) ? opts.assetBase : '';
  const nombre = txt(c.COLEGIO_NOMBRE);
  const logo = driveImg(txt(c.COLEGIO_LOGO_URL), 400);
  const web = safeUrl(txt(c.COLEGIO_URL));
  const maps = safeUrl(txt(c.COLEGIO_MAPS_URL));
  const insta = safeUrl(txt(c.REDES_INSTAGRAM_URL));
  const phones = [c.COLEGIO_TELEFONO1, c.COLEGIO_TELEFONO2].map(txt).filter(Boolean);
  const email = txt(c.COLEGIO_EMAIL);
  const lugar = [c.COLEGIO_LOCALIDAD, c.COLEGIO_PROVINCIA].map(txt).filter(Boolean).join(', ');
  const direccion = txt(c.COLEGIO_DIRECCION);
  const torneo = txt(c.TORNEO_NOMBRE) || 'Al-Ándalus';
  const anio = txt(c.TORNEO_ANIO);
  const share = t('share_site', 'Compartir este sitio'); // botón solo icono: este es su nombre accesible

  const phone = (p) => {
    const href = telHref(p);
    return href ? html`<a href="${href}">${p}</a>` : html`<span>${p}</span>`;
  };
  const mail = mailHref(email);
  const address = direccion || lugar
    ? html`<span class="footer__addr">${direccion ? html`<span>${direccion}</span>` : ''}${lugar ? html`<span>${lugar}</span>` : ''}</span>`
    : '';

  const contact = [
    phones.length ? html`<li class="footer__row">${ICON.phone}<span class="footer__phones">${phones.map((p, i) => html`${i ? html`<span aria-hidden="true"> · </span>` : ''}${phone(p)}`)}</span></li>` : '',
    email ? html`<li class="footer__row">${ICON.mail}${mail ? html`<a href="${mail}">${email}</a>` : html`<span>${email}</span>`}</li>` : '',
    address ? html`<li class="footer__row">${ICON.pin}${maps ? html`<a href="${maps}" target="_blank" rel="${EXT}">${address}<span class="sr-only"> (${t('footer_open_maps', 'abrir en Maps')})</span></a>` : address}</li>` : '',
    web ? html`<li class="footer__row">${ICON.web}<a href="${web}" target="_blank" rel="${EXT}">${web.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></li>` : '',
  ];

  return html`<div class="footer section">
    <div class="footer__grid">
      <div class="footer__school">
        ${logo ? html`<span class="footer__logo" data-media><img src="${logo}" alt="${nombre || t('footer_school_logo', 'Logo del colegio')}" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : ''}
        <div class="footer__school-text">
          ${nombre ? html`<p class="footer__name">${nombre}</p>` : ''}
          <ul class="footer__contact">${contact}</ul>
        </div>
      </div>
      <div class="footer__brand">
        <p class="footer__kicker">${t('footer_tournament_title', 'Torneo escolar de Fútbol Sala')}</p>
        <p class="footer__torneo">${torneo}</p>
        ${anio ? html`<p class="footer__season num">${anio}</p>` : ''}
        <div class="footer__links">
          ${insta ? html`<a class="footer__social" href="${insta}" target="_blank" rel="${EXT}">${ICON.insta}<span>Instagram</span></a>` : ''}
          <button type="button" class="footer__share" data-share aria-label="${share}" title="${share}">${ICON.share}</button>
        </div>
        <p class="footer__share-status" role="status" aria-live="polite" data-share-status></p>
      </div>
    </div>
    <div class="footer__credit" xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/">
      <a class="footer__avatar" rel="noopener noreferrer" href="https://github.com/GerardoHMX" target="_blank" tabindex="-1" aria-hidden="true"><img src="${base}img/profile.jpg" alt="" width="40" height="40" loading="lazy"></a>
      <p class="footer__made">
        <a property="dct:title" rel="cc:attributionURL noopener noreferrer" href="https://github.com/GerardoHMX/TorneoEscolar" target="_blank">${t('footer_made_by', 'Realizado por')}</a>
        <a rel="cc:attributionURL dct:creator noopener noreferrer" property="cc:attributionName" href="https://github.com/GerardoHMX" target="_blank">Gerardo Huizar Castro</a>
        <a class="footer__license" href="https://creativecommons.org/licenses/by-nc-sa/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer">${t('footer_license', 'bajo licencia')} <span class="footer__cc-name">CC BY-NC-SA 4.0</span><span class="footer__cc" aria-hidden="true">${CC.map((k) => html`<img src="https://mirrors.creativecommons.org/presskit/icons/${k}.svg?ref=chooser-v1" alt="" width="18" height="18" loading="lazy">`)}</span></a>
      </p>
    </div>
  </div>`;
}

/** Opcional: oculta el logo del colegio si no carga (el pie no tiene más interacción). */
export function bindFooter(root) {
  bindMediaFallback(root);
}
