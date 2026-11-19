// Vídeos alojados en el propio sitio (carpeta media/) dentro de la galería: sin controles nativos, para que
// no parezcan un reproductor. Arrancan solos, con sonido si el navegador lo permite, y UNA sola vez al entrar en pantalla; al terminar
// se cubren con la portada (columna PORTADA de la hoja o, por convenio, el .jpg del mismo nombre). Un botón
// (oculto salvo al pasar el ratón, tocar el vídeo o llegar con el teclado) discreto pausa / reanuda / repite y otro activa el sonido.
// Con prefers-reduced-motion no arrancan solos: se ve la portada y el botón de reproducir.
// El marco [data-clip] toma la proporción real del vídeo (sin franjas). Estilos en css/home.css.
import { prefersReducedMotion } from './focus.js';

/**
 * Ruta local de un vídeo del sitio: «media/nombre.mp4» (o .webm), sola o al final de una URL completa.
 * Siempre se devuelve la ruta relativa (mismo origen); cualquier otra cosa -> ''.
 * @param {string} url @returns {string}
 */
export function localVideo(url) {
  if (typeof url !== 'string') return '';
  const m = url.trim().match(/(?:^|\/)media\/([a-zA-Z0-9_-][a-zA-Z0-9._-]*\.(?:mp4|webm))$/i);
  return m && !m[1].includes('..') ? `media/${m[1]}` : '';
}

/** Imagen del propio sitio: «media/nombre.jpg» (png, webp, avif), sola o al final de una URL; si no -> ''. */
export function localImage(url) {
  if (typeof url !== 'string') return '';
  const m = url.trim().match(/(?:^|\/)media\/([a-zA-Z0-9_-][a-zA-Z0-9._-]*\.(?:jpe?g|png|webp|avif))$/i);
  return m && !m[1].includes('..') ? `media/${m[1]}` : '';
}

/** Portada por convenio: mismo nombre con .jpg (media/trailer.mp4 -> media/trailer.jpg). */
export const posterFor = (src) => src.replace(/\.[^.]+$/, '.jpg');

/** Vídeos que ya se reprodujeron solos: un repintado de la sección (idioma, datos) no los relanza. */
const autoPlayed = new Set();
const bound = new WeakSet();

/** @param {Element} root @param {(key: string, fallback: string) => string} t */
export function bindClips(root, t) {
  if (!root) return;
  root.querySelectorAll('[data-clip]').forEach((frame) => {
    if (bound.has(frame)) return;
    const video = frame.querySelector('video');
    const toggle = frame.querySelector('[data-clip-toggle]');
    const sound = frame.querySelector('[data-clip-sound]');
    if (!video || !toggle) return;
    bound.add(frame);
    const key = video.getAttribute('src');

    const setState = (state) => {
      if (!frame.hasAttribute('data-clip')) return; // ya sustituido por el reproductor de Drive
      frame.dataset.state = state;
      // idle = sin empezar · playing · paused · ended; la portada cubre el vídeo en idle y ended (css/home.css)
      const label = state === 'playing' ? t('gallery_video_pause', 'Pausar vídeo')
        : state === 'ended' ? t('gallery_video_replay', 'Ver de nuevo')
          : t('gallery_video_play', 'Reproducir vídeo');
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    };
    const setSound = () => {
      if (!sound) return;
      const on = !video.muted;
      sound.setAttribute('aria-pressed', String(on));
      const label = on ? t('gallery_video_sound_off', 'Silenciar') : t('gallery_video_sound_on', 'Activar sonido');
      sound.setAttribute('aria-label', label);
      sound.title = label;
    };
    const fit = () => {
      if (video.videoWidth && video.videoHeight) frame.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    };
    // Sonido: activado por defecto. Los navegadores no dejan que un vídeo arranque solo CON sonido si la
    // persona aún no ha tocado nada en la página: en ese caso arranca en silencio y el sonido entra con su
    // primer clic, toque o tecla. Si alguien lo silencia con el botón (userMuted), se respeta.
    let userMuted = false;
    const failed = () => setState(video.ended ? 'ended' : video.currentTime > 0 ? 'paused' : 'idle');
    const unmuteOnGesture = () => {
      const on = (ev) => {
        if (ev.target instanceof Element && ev.target.closest('.gal-clip__tools') && frame.contains(ev.target)) return;
        document.removeEventListener('pointerdown', on, true);
        document.removeEventListener('keydown', on, true);
        if (!frame.isConnected || userMuted || video.paused || video.ended) return;
        video.muted = false;
        setSound();
      };
      document.addEventListener('pointerdown', on, true);
      document.addEventListener('keydown', on, true);
    };
    const play = () => {
      video.muted = userMuted;
      setSound();
      const p = video.play();
      if (!p || typeof p.catch !== 'function') return;
      p.catch(() => {
        if (video.muted) { failed(); return; }
        video.muted = true; // bloqueado con sonido: en silencio hasta la primera interacción
        setSound();
        const q = video.play();
        if (q && typeof q.catch === 'function') q.catch(failed);
        unmuteOnGesture();
      });
    };
    const onToggle = () => {
      if (video.paused || video.ended) play(); else video.pause();
    };

    video.addEventListener('loadedmetadata', fit);
    video.addEventListener('playing', () => setState('playing'));
    video.addEventListener('pause', () => { if (!video.ended) setState('paused'); });
    // Portada que no carga (no existe el .jpg, Drive privado): se retira y queda el fotograma del vídeo.
    frame.querySelector('.gal-cover')?.addEventListener('error', (ev) => ev.target.remove());
    // Vídeo de Drive que la API no sirve (clave, cuota, archivo privado): reproductor de Drive.
    video.addEventListener('error', () => driveFallback(frame, video));
    video.addEventListener('ended', () => setState('ended'));
    // Los botones están ocultos (css/home.css): un toque los enseña unos segundos. En pantallas táctiles el
    // primer toque sobre un vídeo en marcha solo los enseña; con ellos a la vista, tocar pausa o reanuda.
    let hideTimer = 0;
    const activate = () => {
      frame.classList.add('is-active');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => frame.classList.remove('is-active'), 2500);
    };
    const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
    video.addEventListener('click', () => {
      const wasActive = frame.classList.contains('is-active');
      activate();
      if (!canHover && !wasActive && frame.dataset.state === 'playing') return;
      onToggle();
    });
    toggle.addEventListener('click', () => { activate(); onToggle(); });
    sound?.addEventListener('click', () => { activate(); video.muted = !video.muted; userMuted = video.muted; setSound(); });

    fit();
    // Ya se vio una vez: tras un repintado queda la portada (el fotograma final) con «Ver de nuevo».
    setState(autoPlayed.has(key) ? 'ended' : 'idle');
    setSound();

    if (autoPlayed.has(key) || prefersReducedMotion() || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      autoPlayed.add(key);
      play();
    }, { threshold: 0.6 });
    io.observe(frame);
  });
}

/** Sustituye el vídeo propio por el iframe de Drive (data-clip-fallback), conservando la portada. */
function driveFallback(frame, video) {
  const src = frame.getAttribute('data-clip-fallback');
  if (!src || !frame.isConnected || !frame.hasAttribute('data-clip')) return;
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = video.getAttribute('aria-label') ?? '';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
  iframe.setAttribute('allow', 'autoplay; fullscreen');
  iframe.setAttribute('allowfullscreen', '');
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  const cover = frame.querySelector('.gal-cover');
  frame.querySelector('.gal-clip__tools')?.remove();
  video.remove();
  frame.removeAttribute('data-clip');
  frame.removeAttribute('data-state');
  frame.classList.remove('gal-clip', 'is-active');
  if (cover) {
    frame.classList.add('gal-drive');
    frame.setAttribute('data-drive-cover', '');
    const play = document.createElement('span');
    play.className = 'gal-drive__play';
    play.setAttribute('aria-hidden', 'true');
    frame.append(play);
    bindDriveCovers();
  }
  frame.append(iframe);
}

let driveCoversBound = false;
/**
 * Vídeos de Drive con PORTADA: la imagen cubre el reproductor sin interceptar el clic (pointer-events: none),
 * así que un solo clic llega al botón de Drive. El clic dentro de un iframe ajeno no se puede escuchar: se
 * detecta porque la ventana pierde el foco y el elemento activo pasa a ser ese iframe; entonces se retira
 * la portada. Drive no avisa de cuándo termina el vídeo: la portada no vuelve al final.
 */
export function bindDriveCovers() {
  if (driveCoversBound || typeof window === 'undefined') return;
  driveCoversBound = true;
  window.addEventListener('blur', () => {
    const a = document.activeElement;
    if (a instanceof HTMLIFrameElement) a.closest('[data-drive-cover]')?.classList.add('is-started');
  });
}

/**
 * Vídeos de Drive (iframe): el marco toma la proporción de la miniatura del archivo para que el reproductor
 * de Drive no añada franjas negras. Si la miniatura no carga, se queda la proporción por defecto.
 * @param {Element} root
 */
export function fitDriveFrames(root) {
  if (!root || typeof Image !== 'function') return;
  root.querySelectorAll('[data-drive-thumb]').forEach((frame) => {
    const src = frame.getAttribute('data-drive-thumb');
    frame.removeAttribute('data-drive-thumb');
    if (!src) return;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth > 1 && img.naturalHeight > 1) frame.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    };
    img.src = src;
  });
}
