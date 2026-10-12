// Valoración con estrellas: diálogo accesible tras unos segundos y envío por <form> a un iframe
// oculto (Apps Script no admite CORS). Los límites del cliente solo frenan el spam casual;
// la protección real está en el Apps Script (docs/FEEDBACK_APPS_SCRIPT.md).

import { html, raw, safeUrl, setHTML } from '../core/dom.js';
import { openModal } from './modal.js';

export const COOLDOWN_MS = 5 * 60 * 1000;
export const MAX_COMMENT = 500;
const STORAGE_KEY = 'alandalus_feedback_last';
const DEFAULT_DELAY_MS = 20000;
/** «No volver a mostrar»: el visitante no vuelve a ver el diálogo en 30 días (marca de tiempo en localStorage). */
export const DISMISS_KEY = 'alandalus_feedback_dismissed_until';
export const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
const DISMISS_SLACK_MS = 24 * 60 * 60 * 1000; // margen por cambios de reloj del dispositivo

/**
 * CONFIGURACION!FEEDBACK_ACTIVO. Vacío o ausente = activa (un libro sin la fila se comporta como siempre).
 * Solo un «no» explícito la pausa: NO, FALSE, 0, OFF, PAUSA, PAUSADO/PAUSADA (sin distinguir mayúsculas ni
 * tildes). Cualquier otro valor, también una errata, la deja activa: pausar tiene que ser intencionado.
 */
export function isFeedbackEnabled(value) {
  const v = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  return !['NO', 'FALSE', '0', 'OFF', 'PAUSA', 'PAUSADO', 'PAUSADA'].includes(v);
}

/** Hasta cuándo dura «No volver a mostrar» pulsado ahora. */
export function dismissUntil(now) {
  return now + DISMISS_MS;
}

/**
 * ¿Sigue vigente «No volver a mostrar»? Basura o vacío -> no. Caducado (<= ahora) -> no. Una fecha más lejana
 * que 30 días + 1 de margen (reloj cambiado o valor manipulado) se ignora para no silenciar el diálogo para siempre.
 */
export function isDismissed(now, dismissedUntil) {
  if (dismissedUntil === null || dismissedUntil === undefined || dismissedUntil === '' || typeof dismissedUntil === 'object') return false;
  const until = Number(dismissedUntil);
  if (!Number.isFinite(until) || until <= 0) return false;
  return until > now && until - now <= DISMISS_MS + DISMISS_SLACK_MS;
}

/**
 * Reglas del cliente. Prioridad: honeypot > too_long > cooldown.
 * @returns {{ok: boolean, reason?: 'cooldown'|'honeypot'|'too_long'}}
 */
export function canSubmitFeedback(now, lastSentAt, honeypot, comment) {
  if (String(honeypot ?? '').trim() !== '') return { ok: false, reason: 'honeypot' };
  if (String(comment ?? '').trim().length > MAX_COMMENT) return { ok: false, reason: 'too_long' };
  // Un lastSentAt futuro (reloj del dispositivo cambiado) no bloquea: se trata como sin envío previo.
  if (lastSentAt !== null && lastSentAt !== undefined && lastSentAt <= now && now - lastSentAt < COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown' };
  }
  return { ok: true };
}

/** Solo https://script.google.com, sin credenciales ni puerto (la URL viene de una hoja editable). */
export function isValidScriptUrl(url) {
  const ok = safeUrl(url);
  if (!ok) return false;
  try {
    const u = new URL(ok);
    return u.hostname === 'script.google.com' && u.username === '' && u.password === '' && u.port === '';
  } catch { return false; }
}

let memLast = null;
function readLast() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(v) && v > 0) return Math.max(v, memLast ?? 0);
  } catch { /* almacenamiento no disponible */ }
  return memLast;
}
function writeLast(ts) {
  memLast = ts;
  try { localStorage.setItem(STORAGE_KEY, String(ts)); } catch { /* queda en memoria */ }
}

let memDismissed = null;
function readDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (v !== null) return v;
  } catch { /* almacenamiento no disponible */ }
  return memDismissed;
}
function writeDismissed(ts) {
  memDismissed = ts;
  try { localStorage.setItem(DISMISS_KEY, String(ts)); } catch { /* queda en memoria (solo esta visita) */ }
}

let scheduled = false;
/** Último valor de FEEDBACK_ACTIVO recibido: si el comité pausa mientras se espera, el diálogo no sale. */
let active = true;

/**
 * @param {string} scriptUrl FEEDBACK_SCRIPT_URL
 * @param {(key: string, fallback?: string) => string} t
 * @param {{delayMs?: number, enabled?: boolean}} [opts] `enabled: false` = pausada (FEEDBACK_ACTIVO = NO);
 *   sin `enabled`, activa (como antes). Se puede llamar en cada refresco de datos: solo programa una vez.
 */
export function initFeedback(scriptUrl, t, opts = {}) {
  active = opts.enabled !== false;
  if (!active || !isValidScriptUrl(scriptUrl) || scheduled || typeof document === 'undefined') return;
  if (isDismissed(Date.now(), readDismissed())) return; // el visitante pidió no volver a verlo
  const url = safeUrl(scriptUrl);
  const delay = Number.isFinite(opts.delayMs) ? opts.delayMs : DEFAULT_DELAY_MS;
  const tr = (key, fb) => {
    const v = typeof t === 'function' ? t(key, fb) : '';
    return v && v !== key ? String(v) : fb;
  };
  scheduled = true;

  const attempt = () => {
    if (!active || isDismissed(Date.now(), readDismissed())) return;
    if (!canSubmitFeedback(Date.now(), readLast(), '', '').ok) return; // en cooldown
    // No pisar otro modal abierto: reintenta más tarde.
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot?.childElementCount) { setTimeout(attempt, 10000); return; }
    showDialog(url, tr);
  };
  setTimeout(attempt, delay);
}

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';

function showDialog(url, tr) {
  const names = [
    tr('feedback_star_1', 'Muy mala'), tr('feedback_star_2', 'Mala'), tr('feedback_star_3', 'Normal'),
    tr('feedback_star_4', 'Buena'), tr('feedback_star_5', 'Excelente'),
  ];
  const stars = names.map((name, i) => html`<button type="button" class="fb-star" role="radio" aria-checked="false" tabindex="${i === 0 ? 0 : -1}" data-value="${i + 1}" aria-label="${i + 1} — ${name}">${raw(STAR)}</button>`);

  let rating = 0;
  let done = false;
  const close = openModal(html`<form class="fb" novalidate>
  <h2 class="fb__title">${tr('feedback_title', '¿Cómo fue tu experiencia?')}</h2>
  <div class="fb__rating">
    <span id="fb-rating-label" class="fb__label">${tr('feedback_rating', 'Valoración')}</span>
    <div class="fb__stars" role="radiogroup" aria-labelledby="fb-rating-label" aria-required="true">${stars}</div>
    <p class="fb__hint" aria-live="polite" data-fb-hint>&nbsp;</p>
  </div>
  <div class="fb__field">
    <label class="fb__label" for="fb-comment">${tr('feedback_comment', 'Comentario (opcional)')}</label>
    <textarea id="fb-comment" class="fb__textarea" name="comentario" rows="4" maxlength="${MAX_COMMENT}" placeholder="${tr('feedback_comment_placeholder', 'Escribe aquí…')}" aria-describedby="fb-count"></textarea>
    <p id="fb-count" class="fb__count" data-fb-count>0 / ${MAX_COMMENT}</p>
  </div>
  <div class="fb__trap" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <p class="fb__msg" role="status" data-fb-msg hidden></p>
  <div class="fb__actions">
    <button type="submit" class="btn-gold fb__submit" data-fb-submit>${tr('feedback_submit', 'Enviar')}</button>
    <button type="button" class="fb__dismiss" data-fb-dismiss>${tr('feedback_dismiss', 'No volver a mostrar')}</button>
  </div>
</form>`, { labelKey: 'feedback_title' });

  const form = document.querySelector('#modal-root form.fb');
  if (!form) return;
  const radios = [...form.querySelectorAll('.fb-star')];
  const hint = form.querySelector('[data-fb-hint]');
  const msg = form.querySelector('[data-fb-msg]');
  const area = form.querySelector('textarea');
  const count = form.querySelector('[data-fb-count]');
  const submitBtn = form.querySelector('[data-fb-submit]');

  const say = (text, error) => {
    msg.textContent = text;
    msg.dataset.kind = error ? 'error' : 'ok';
    msg.hidden = false;
  };
  const setRating = (v, focus) => {
    rating = v;
    radios.forEach((r, i) => {
      const val = i + 1;
      r.setAttribute('aria-checked', String(val === v));
      r.classList.toggle('is-on', val <= v);
      r.tabIndex = (v ? val === v : i === 0) ? 0 : -1;
    });
    hint.textContent = v ? names[v - 1] : ' ';
    if (v) msg.hidden = true;
    if (focus) radios[v - 1].focus();
  };
  radios.forEach((r, i) => {
    r.addEventListener('click', () => setRating(i + 1));
    r.addEventListener('keydown', (ev) => {
      const k = ev.key;
      let n = null;
      if (k === 'ArrowRight' || k === 'ArrowUp') n = Math.min(5, i + 2);
      else if (k === 'ArrowLeft' || k === 'ArrowDown') n = Math.max(1, i);
      else if (k === 'Home') n = 1;
      else if (k === 'End') n = 5;
      else if (k === ' ' || k === 'Enter') { ev.preventDefault(); setRating(i + 1); return; }
      if (n !== null) { ev.preventDefault(); setRating(n, true); }
    });
  });
  area.addEventListener('input', () => { count.textContent = `${area.value.length} / ${MAX_COMMENT}`; });
  // «No volver a mostrar»: recuerda la elección 30 días y cierra. La X / «Cerrar» no la recuerdan.
  form.querySelector('[data-fb-dismiss]')?.addEventListener('click', () => {
    writeDismissed(dismissUntil(Date.now()));
    close();
  });

  const thanks = () => {
    done = true;
    // El diálogo se nombra con aria-labelledby -> id del h2 original: el h2 nuevo hereda ese id.
    const titleId = form.closest('[role="dialog"]')?.getAttribute('aria-labelledby') || 'fb-title';
    setHTML(form, html`<div class="fb__done" role="status">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="fb__done-icon"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <h2 class="fb__title" id="${titleId}">${tr('feedback_message_success', '¡Gracias por tu valoración!')}</h2>
  <button type="button" class="btn-ghost" data-fb-done>${tr('feedback_close', 'Cerrar')}</button>
</div>`);
    const b = form.querySelector('[data-fb-done]');
    b.addEventListener('click', () => close());
    b.focus({ preventScroll: true });
    setTimeout(() => close(), 3500);
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (done) return;
    if (rating < 1) { say(tr('feedback_message_rating', 'Elige una valoración.'), true); radios[0].focus(); return; }
    const comment = area.value.trim();
    const now = Date.now();
    const verdict = canSubmitFeedback(now, readLast(), form.elements.website.value, comment);
    if (!verdict.ok) {
      if (verdict.reason === 'honeypot') { thanks(); return; } // el bot cree que funcionó
      if (verdict.reason === 'too_long') { say(tr('feedback_message_too_long', 'El comentario es demasiado largo (máximo 500 caracteres).'), true); return; }
      say(tr('feedback_message_cooldown', 'Ya enviaste una valoración hace poco. Inténtalo de nuevo en unos minutos.'), true);
      return;
    }
    submitBtn.disabled = true;
    try {
      postToScript(url, { fecha_hora: new Date(now).toISOString(), valoracion: String(rating), tipo: 'estrellas', comentario: comment });
    } catch {
      // El envío no salió: el botón vuelve a estar disponible y no cuenta para el cooldown.
      submitBtn.disabled = false;
      say(tr('feedback_message_error_server', 'No se pudo enviar la valoración. Inténtalo de nuevo más tarde.'), true);
      return;
    }
    writeLast(now);
    thanks();
  });
}

const FRAME_NAME = 'feedback-hidden-iframe';

/** Envío por formulario a un iframe oculto (sin CORS). `globalThis.__FEEDBACK_NO_SUBMIT` lo evita (demo manual). */
function postToScript(url, fields) {
  if (globalThis.__FEEDBACK_NO_SUBMIT) { globalThis.__FEEDBACK_LAST = { url, fields }; return; }
  let frame = document.querySelector(`iframe[name="${FRAME_NAME}"]`);
  if (!frame) {
    frame = document.createElement('iframe');
    frame.name = FRAME_NAME;
    frame.title = 'feedback';
    frame.hidden = true;
    frame.tabIndex = -1;
    document.body.appendChild(frame);
  }
  const f = document.createElement('form');
  f.method = 'post';
  f.action = url;
  f.target = FRAME_NAME;
  f.hidden = true;
  for (const [name, value] of Object.entries(fields)) {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = name;
    i.value = value;
    f.appendChild(i);
  }
  document.body.appendChild(f);
  f.submit();
  f.remove();
}
