// Configuración web del proyecto de Firebase (plan Spark, gratuito). Se copia de
// Consola de Firebase › Configuración del proyecto › Tus apps › Configuración del SDK (objeto firebaseConfig).
// Estos valores son públicos por diseño: no son contraseñas. Lo que protege los datos son las reglas de
// Firestore (firestore.rules), que solo dejan escribir a las cuentas de la lista de anotadores.
//
// Mientras projectId esté vacío, el marcador funciona solo con Google Sheets (previa y resultado final,
// sin directo) y la página de captura muestra cómo activarlo. Guía completa: MARCADOR.md
// No se usa Analytics de Firebase (el sitio ya mide con Google Tag Manager).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAdfBqnNwo7OYH_r1ZCSu3O3H6oEXv5NWo',
  authDomain: 'marcadortorneo.firebaseapp.com',
  projectId: 'marcadortorneo',
  appId: '1:948474417019:web:b66fc75f78ff3f2deb37de',
};
