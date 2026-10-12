// Lógica pura de la cabecera (logo del colegio desde CONFIGURACION).

/**
 * El logo se muestra solo con una URL válida que no haya fallado ya: si su carga dio error, un refresco de
 * datos posterior con la misma URL no debe volver a mostrar el enlace con la imagen rota.
 * @param {string} logoUrl URL ya pasada por driveImg/safeUrl ('' si no es válida)
 * @param {string | undefined} failedUrl última URL cuya carga falló
 */
export function shouldShowLogo(logoUrl, failedUrl) {
  return !!logoUrl && logoUrl !== failedUrl;
}
