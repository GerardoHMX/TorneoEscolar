// CONFIGURACION: EQUIPOS_CON_LOGO / EQUIPOS_CON_NOMBRE. Puro: sin DOM.
//  - EQUIPOS_CON_LOGO = NO  -> los equipos no eligen logo: se ignora cualquier URL de logo (EQUIPOS!LOGO,
//    logos de CLASIFICACION) y el escudo usa el monograma del curso.
//  - EQUIPOS_CON_NOMBRE = NO -> los equipos no eligen nombre: en todas partes se muestra el CURSO.
// Solo se aceptan SI o NO (sin distinguir mayúsculas ni tildes). Vacío, ausente o cualquier otro valor = NO.

const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** true solo con SI; todo lo demás (vacío, NO, otro valor) = NO. */
export function isTeamChoiceEnabled(value) {
  return fold(value) === 'si';
}

/**
 * Aplica las dos opciones al modelo ya construido (devuelve un modelo nuevo; no muta el recibido).
 * @param {import('./appModel.js').AppModel} model
 */
export function applyTeamDisplay(model) {
  const cfg = model?.config ?? {};
  const cursoLogo = !isTeamChoiceEnabled(cfg.EQUIPOS_CON_LOGO);
  const cursoNombre = !isTeamChoiceEnabled(cfg.EQUIPOS_CON_NOMBRE);
  if (!cursoLogo && !cursoNombre) return model;

  // nombre original (normalizado) -> curso
  const cursoDe = new Map();
  for (const e of model.equipos ?? []) if (e.equipo && e.curso) cursoDe.set(fold(e.equipo), e.curso);
  const nombre = (n) => (cursoNombre ? cursoDe.get(fold(n)) ?? n : n);
  const logo = (l) => (cursoLogo ? '' : l);

  const lado = (l) => (l ? { ...l, equipo: nombre(l.equipo), logo: logo(l.logo) } : l);
  const conEquipo = (x) => ({ ...x, equipo: nombre(x.equipo) });
  const puesto = (p) => (p ? { ...p, equipo: nombre(p.equipo), logo: logo(p.logo) } : p);

  return {
    ...model,
    equipos: (model.equipos ?? []).map((e) => ({ ...e, equipo: cursoNombre && e.curso ? e.curso : e.equipo, logo: logo(e.logo) })),
    partidos: (model.partidos ?? []).map((p) => ({ ...p, local: lado(p.local), visitante: lado(p.visitante), pasa: nombre(p.pasa) })),
    tabla: (model.tabla ?? []).map(conEquipo),
    podio: model.podio ? { primero: puesto(model.podio.primero), segundo: puesto(model.podio.segundo), tercero: puesto(model.podio.tercero) } : model.podio,
    scorers: (model.scorers ?? []).map(conEquipo),
    lideres: (model.lideres ?? []).map(conEquipo),
    sanciones: (model.sanciones ?? []).map(conEquipo),
  };
}
