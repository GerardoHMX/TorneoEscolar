# Marcador en vivo

Pantalla para la TV (`marcador.html`), página de captura para el móvil (`captura.html`) y copia automática al libro de Google Sheets.

```
Móvil (captura.html) ──► Firebase Firestore ──► TV (marcador.html)
                               │
                               └──► Apps Script del libro (cada 5 min) ──► hojas GOLES y CLASIFICACION ──► sitio web
```

- **Firestore** guarda el estado del partido en juego. Lo escribe el móvil y lo leen la tele y el Apps Script. Es el plan **Spark de Firebase**, que es gratuito y no pide tarjeta: no puede cobrar nada. Si algún día se superara el límite gratuito, el directo se pararía hasta el día siguiente y el sitio seguiría funcionando con el libro.
- **El reloj** no se envía segundo a segundo. Se guarda la hora de inicio de cada parte y cada pantalla calcula el tiempo por su cuenta.
- **Sin Firebase configurado**, la tele funciona solo con el libro: muestra la previa y, cuando el partido tiene `ESTATUS = JUGADO`, el resultado final.

## Cómo se usa

| Quién | Qué abre | Qué hace |
|---|---|---|
| La tele | `…/marcador.html` | Muestra el partido en juego. Entre partidos muestra el siguiente, con cuenta atrás. |
| La tele, un partido concreto | `…/marcador.html?partido=14` | Muestra la previa si el partido no ha empezado, el directo mientras se juega y el final cuando termina. |
| Público | La portada del sitio | Las tarjetas de los partidos de hoy llevan la etiqueta «Marcador en vivo». Al hacer clic en el marcador de la tarjeta se abre `marcador.html?partido=N`. |
| Quien anota | `…/captura.html` | Entra con su cuenta de Google, elige el partido y lo controla. |

En la tele, un clic o la tecla Enter la pone a pantalla completa. Si el televisor recorta los bordes, añade `&margen=5` a la dirección (o `?margen=5` si no hay otros parámetros).

**La lista de la captura solo muestra partidos sin jugar.** No aparecen los que tienen `ESTATUS = JUGADO` en el libro ni los que ya se terminaron en el directo, así que un partido jugado no se puede volver a capturar. Si al terminar hubo un error, «Reabrir el partido» funciona mientras sigas en esa pantalla.

## Puesta en marcha (una sola vez, unos 15 minutos)

### 1. Crear el proyecto de Firebase (gratis)
1. Entra en <https://console.firebase.google.com> con la cuenta que administrará el marcador y pulsa **Crear un proyecto**. Puedes desactivar Google Analytics. El plan queda en **Spark (sin costo)**.
2. **Compilación › Firestore Database › Crear base de datos**: elige el modo de **producción** y la ubicación `europe-southwest1 (Madrid)`.
3. En **Firestore › Reglas**, pega el contenido de `firestore.rules` y pulsa **Publicar**.
4. Ve a **Compilación › Authentication › Comenzar**. En **Sign-in method**, activa **Google**.
5. En **Authentication › Configuración › Dominios autorizados**, añade `gerardohmx.github.io`.
6. En **Firestore › Datos**, pulsa **Iniciar colección** con el ID `config` y crea un documento con el ID `anotadores`. Añade un campo `emails` de tipo **array** con los correos de Google que podrán anotar, uno por elemento.
7. Ve a **Configuración del proyecto (⚙) › General › Tus apps** y pulsa el icono **Web `</>`**. Registra la app con el nombre `marcador`, sin Hosting. Copia `apiKey`, `authDomain`, `projectId` y `appId` en `js/live/firebase-config.js`.

### 2. Preparar el libro
1. **CLASIFICACION** (opcional): para fijar el desempate de un partido concreto, añade una columna con la cabecera `DESEMPATE` en la fila 3, en una columna libre a la derecha. Admite los valores `NINGUNO`, `PENALTIS`, `PRORROGA` o `PRORROGA_Y_PENALTIS`. Si se deja vacía, se usa el valor por defecto de la ronda.
2. **CONFIGURACION** (opcional). Solo hay que añadir las claves que quieras cambiar:

| CAMPO | VALOR por defecto | Qué es |
|---|---|---|
| `MARCADOR_PARTES` | 2 | Número de tiempos |
| `MARCADOR_MIN_PARTE` | 12 | Minutos de cada tiempo |
| `MARCADOR_DESCANSO` | 1 | Minutos de descanso |
| `MARCADOR_MIN_PRORROGA` | 3 | Minutos de cada parte de la prórroga (son 2 partes) |
| `MARCADOR_PENALTIS` | 5 | Lanzamientos por equipo antes de la muerte súbita |
| `DESEMPATE_INICIAL` | NINGUNO | Fase de grupos: el empate vale |
| `DESEMPATE_CUARTOS` | PENALTIS | |
| `DESEMPATE_SEMIFINAL` | PENALTIS | |
| `DESEMPATE_TERCERPUESTO` | PENALTIS | |
| `DESEMPATE_FINAL` | PRORROGA_Y_PENALTIS | |

La tele también respeta `EQUIPOS_CON_LOGO` y `EQUIPOS_CON_NOMBRE`, igual que el resto del sitio.

### 3. Copia automática al libro (Apps Script)
1. En el libro: **Extensiones › Apps Script**. Sustituye el contenido de `Código.gs` por `apps-script/Code.gs`.
2. Rellena `FIREBASE_PROJECT_ID` y `FIREBASE_API_KEY` con los mismos valores que pusiste en `firebase-config.js` y guarda.
3. Recarga el libro. Aparece el menú **Marcador**. Pulsa **Marcador › Activar sincronización automática** y acepta los permisos.

A partir de ese momento, cada 5 minutos el script copia los goles a **GOLES** y, cuando el partido termina, escribe `LSCORE`, `VSCORE`, `ESTATUS = JUGADO` y, en eliminatorias, `LPENALES` y `VPENALES` en **CLASIFICACION**. La fórmula `GANA` decide quién pasa. Nunca sobrescribe celdas con fórmula. Si tienes prisa, usa **Marcador › Sincronizar ahora**.

### 4. Publicar
Sube los cambios a GitHub. Después de cambiar `src/input.css` o los CSS de `css/` que usa el sitio, ejecuta `npm run build-css`. `marcador.css` y `captura.css` no pasan por Tailwind.

## Límites del plan gratuito (Firestore)

| Recurso | Límite diario | Uso por partido |
|---|---|---|
| Lecturas | 50.000 | Unas 30 por cada persona que mira (la tele cuenta como una) |
| Escrituras | 20.000 | Unas 40 |
| Apps Script | — | 288 lecturas al día (una cada 5 minutos) |

## Archivos

| Archivo | Para qué |
|---|---|
| `marcador.html`, `css/marcador.css`, `js/live/tv.js` | Pantalla de la tele |
| `captura.html`, `css/captura.css`, `js/live/capture.js` | Página de captura |
| `js/live/rules.js` | Ajustes del reloj, desempate y tanda de penaltis |
| `js/live/clock.js` | Cálculo del reloj, tiempo añadido y marcador |
| `js/live/state.js` | Lo que hace cada botón de la captura |
| `js/live/context.js` | Clasificación en directo, cuadro, camino a la final, goleadores y calendario |
| `js/live/firebase.js`, `js/live/firebase-config.js` | Conexión con Firebase |
| `firestore.rules` | Quién puede leer y escribir |
| `apps-script/Code.gs` | Copia del directo al libro |
