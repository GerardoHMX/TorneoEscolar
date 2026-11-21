// Acceso a Firebase (Firestore y, en la captura, Auth). El SDK se carga bajo demanda desde gstatic
// (módulos ES oficiales, sin bundler) y solo si hay configuración en firebase-config.js.
//
// Colecciones:
//   marcador/{NPartido}  estado en vivo de cada partido (ver js/live/state.js). Lectura pública.
//   meta/actual          {n}: partido que muestra la tele cuando no se le indica ninguno.
//   meta/indice          {cambios: {NPartido: fecha}}: lo lee el Apps Script para copiar al libro solo lo que cambió.
//   config/anotadores    {emails: [...]}: cuentas que pueden escribir (lo usan las reglas).
import { FIREBASE_CONFIG } from './firebase-config.js';

export const SDK_VERSION = '10.14.1';
const SDK = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

export const firebaseEnabled = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.apiKey);

let appP = null;
let dbP = null;

function app() {
  if (!appP) {
    appP = import(`${SDK}/firebase-app.js`).then((m) => m.initializeApp(FIREBASE_CONFIG));
  }
  return appP;
}

/**
 * Firestore + funciones del SDK. `offline: true` (captura) guarda las escrituras en el dispositivo y las
 * envía al recuperar la conexión, aunque se recargue la página.
 * @returns {Promise<{db: any, fs: any}>}
 */
export function firestore({ offline = false } = {}) {
  if (!dbP) {
    dbP = Promise.all([app(), import(`${SDK}/firebase-firestore.js`)]).then(([a, fs]) => {
      let db;
      try {
        db = offline
          ? fs.initializeFirestore(a, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) })
          : fs.initializeFirestore(a, {});
      } catch {
        db = fs.getFirestore(a); // caché persistente no disponible (navegación privada): solo memoria
      }
      return { db, fs };
    });
  }
  return dbP;
}

/** Auth con Google (solo la página de captura). @returns {Promise<{auth: any, au: any}>} */
export async function firebaseAuth() {
  const [a, au] = await Promise.all([app(), import(`${SDK}/firebase-auth.js`)]);
  const auth = au.getAuth(a);
  try { await au.setPersistence(auth, au.browserLocalPersistence); } catch { /* sesión solo en memoria */ }
  return { auth, au };
}

/** Suscripción al documento de un partido. cb(doc|null, meta). Devuelve la función para cancelar. */
export async function watchMatch(n, cb, onError) {
  const { db, fs } = await firestore();
  return fs.onSnapshot(
    fs.doc(db, 'marcador', String(n)),
    { includeMetadataChanges: true },
    (snap) => cb(snap.exists() ? snap.data({ serverTimestamps: 'estimate' }) : null, snap.metadata),
    (err) => onError?.(err),
  );
}

/** Suscripción a meta/actual (qué partido está en la tele). cb(n|null). */
export async function watchCurrent(cb, onError) {
  const { db, fs } = await firestore();
  return fs.onSnapshot(
    fs.doc(db, 'meta', 'actual'),
    (snap) => cb(snap.exists() ? (Number(snap.data()?.n) || null) : null),
    (err) => onError?.(err),
  );
}
