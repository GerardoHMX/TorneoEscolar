# V Torneo Fútbol Sala Al-Ándalus — Colegio San Francisco de Asís

Sitio web del torneo escolar de fútbol sala: calendario, resultados, clasificación, goleadores, sancionados, noticias y galería. Los datos se editan en un libro de Google Sheets y la web se actualiza automáticamente.

Incluye un **marcador en vivo** para la TV del colegio, que se controla desde el móvil durante el partido.

**Sitio publicado:** https://gerardohmx.github.io/TorneoEscolar/

**Autor:** Alumno de 1º Bachillerato Gerardo Huizar Castro
**Licencia:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

---

## Características

- Calendario de jornadas y próximos partidos.
- Resultados en tiempo real desde Google Sheets.
- Tabla de clasificación (general y por grupos).
- Bracket de eliminatorias.
- Ranking de goleadores y listado de sancionados.
- Plantillas/roster de cada equipo.
- Noticias y galería de fotos (desde Google Drive).
- Podio de los mejores equipos.
- Soporte de internacionalización (i18n).
- Animaciones y micro-interacciones (confetti, countUp, reveal, slider).
- Diseño responsive y accesible (skip-link, semántica HTML5).
- Pantalla de carga animada.
- Analíticas con Google Tag Manager.
- **Marcador en vivo** para la TV (`marcador.html`) con página de captura desde el móvil (`captura.html`), Firebase gratuito y copia automática al libro. Ver [Marcador en vivo](#marcador-en-vivo).
- Enlace al marcador en vivo desde las tarjetas de los partidos del día.

## Tecnología

- **HTML5 y CSS3**, con sistema de diseño propio (`css/tokens.css`).
- **JavaScript** con módulos ES (sin bundler, sin frameworks).
- **Tailwind CSS 3** compilado a `dist/output.css`. No se usa Bootstrap.
- **Datos:** hojas de Google Sheets publicadas como CSV.
- **Directo del marcador:** Firebase (plan Spark, gratuito) — Firestore para el estado del partido y Authentication con Google para quien anota. El SDK se carga desde `www.gstatic.com`, sin bundler.
- **Copia al libro:** Google Apps Script (`apps-script/Code.gs`), ejecutado cada 5 minutos dentro del propio libro.
- **Imágenes:** servidas desde Google Drive.
- **Fuentes:** autoalojadas en formato woff2 (LaLiga Headline, Roboto, Pattaya).
- **Hosting:** GitHub Pages.

## Estructura del proyecto

```
TorneoEscolar-main/
├── index.html              # Página principal (SPA)
├── marcador.html           # Marcador en vivo para la TV
├── captura.html            # Captura del marcador desde el móvil
├── MARCADOR.md             # Guía del marcador en vivo (uso y puesta en marcha)
├── firestore.rules         # Reglas de seguridad de Firestore (se pegan en la consola de Firebase)
├── apps-script/
│   └── Code.gs             # Copia del directo al libro (se pega en Extensiones › Apps Script)
├── package.json            # Dependencias (Tailwind, PostCSS, Autoprefixer)
├── tailwind.config.cjs     # Configuración de Tailwind
├── src/
│   └── input.css           # Archivo fuente de Tailwind
├── dist/
│   └── output.css          # CSS compilado (incluido en el repo)
├── css/
│   ├── tokens.css          # Variables de diseño (colores, espaciado, tipografía)
│   ├── base.css            # Estilos base
│   ├── ui.css              # Componentes de interfaz
│   ├── sections.css        # Estilos por sección
│   ├── home.css            # Estilos de la página principal
│   ├── standings.css       # Tabla de clasificación
│   ├── roster.css          # Plantillas de equipos
│   ├── theme-sport.css     # Tema deportivo
│   ├── loader.css          # Pantalla de carga
│   ├── feedback.css        # Mensajes de retroalimentación
│   ├── motion.css          # Animaciones y transiciones
│   ├── marcador.css        # Pantalla de la TV (independiente, sin Tailwind)
│   └── captura.css         # Página de captura (independiente, sin Tailwind)
├── js/
│   ├── main.js             # Punto de entrada
│   ├── translations.js     # Traducciones (i18n)
│   ├── core/
│   │   ├── boot.js         # Inicialización de la app
│   │   ├── store.js        # Caché de las hojas (localStorage)
│   │   ├── dom.js          # Utilidades del DOM
│   │   ├── drive.js        # Integración con Google Drive
│   │   ├── csv.js          # Parseo de CSV desde Sheets
│   │   ├── i18n.js         # Motor de internacionalización
│   │   └── visibility.js   # Control de visibilidad
│   ├── data/
│   │   ├── sheets.js       # Conexión con Google Sheets
│   │   ├── appModel.js     # Modelo de datos de la app
│   │   ├── buildModel.js   # Construcción del modelo
│   │   ├── models.js       # Definición de modelos
│   │   ├── goals.js        # Datos de goles
│   │   └── teamDisplay.js  # Presentación de equipos
│   ├── live/               # Marcador en vivo
│   │   ├── tv.js           # Pantalla de la TV (marcador.html)
│   │   ├── capture.js      # Página de captura (captura.html)
│   │   ├── rules.js        # Ajustes del reloj, desempate y tanda de penaltis (CONFIGURACION)
│   │   ├── clock.js        # Reloj, tiempo añadido y marcador
│   │   ├── state.js        # Acciones de la captura (iniciar, gol, descanso, prórroga, penaltis, final)
│   │   ├── context.js      # Clasificación en directo, cuadro, camino a la final, goleadores y calendario
│   │   ├── firebase.js     # Conexión con Firestore y Authentication
│   │   └── firebase-config.js  # Configuración web del proyecto de Firebase
│   ├── sections/           # Módulos de cada sección
│   │   ├── hero.js         # Cabecera principal
│   │   ├── proximos.js     # Próximos partidos
│   │   ├── resultados.js   # Resultados
│   │   ├── jornadas.js     # Jornadas
│   │   ├── dates.js        # Fechas
│   │   ├── clasificacion.js        # Clasificación general
│   │   ├── clasificacionGrupal.js  # Clasificación por grupos
│   │   ├── standings.js    # Tabla de posiciones
│   │   ├── bracket.js      # Bracket de eliminatorias
│   │   ├── goleadores.js   # Ranking de goleadores
│   │   ├── sancionados.js  # Listado de sancionados
│   │   ├── equipos.js      # Equipos
│   │   ├── roster.js       # Plantillas
│   │   ├── podio.js        # Podio
│   │   ├── noticias.js     # Noticias
│   │   ├── feed.js         # Feed de actividad
│   │   ├── galeria.js      # Galería de fotos
│   │   ├── bases.js        # Bases del torneo
│   │   └── common.js       # Utilidades compartidas
│   └── ui/                 # Componentes de interfaz
│       ├── nav.js          # Navegación
│       ├── loader.js       # Pantalla de carga
│       ├── tabs.js         # Pestañas
│       ├── modal.js        # Modales
│       ├── accordion.js    # Acordeones
│       ├── slider.js       # Carrusel/slider
│       ├── matchCard.js    # Tarjeta de partido (los de hoy enlazan el marcador en vivo)
│       ├── confetti.js     # Efecto confetti
│       ├── countUp.js      # Animación de números
│       ├── reveal.js       # Animaciones de entrada
│       ├── swap.js         # Transiciones de contenido
│       ├── progress.js     # Barras de progreso
│       ├── share.js        # Compartir en redes
│       ├── media.js        # Gestión de medios
│       ├── focus.js        # Gestión del foco
│       ├── feedback.js     # Mensajes al usuario
│       ├── footer.js       # Pie de página
│       ├── refresh.js      # Recarga de datos
│       ├── clip.js         # Vídeos propios de la galería
│       └── analytics.js    # Analíticas
├── fonts/                  # Fuentes woff2 autoalojadas
└── img/                    # Imágenes locales (logos, iconos)
```

## Requisitos previos

- [Node.js](https://nodejs.org/) 20 o superior.
- npm (incluido con Node.js).

## Instalación

```bash
git clone https://github.com/gerardohmx/TorneoEscolar.git
cd TorneoEscolar
npm install
```

## Comandos

```bash
npm run build-css    # Compila src/input.css → dist/output.css (minificado)
npm run watch-css    # Igual, pero vigilando cambios en tiempo real
```

Para vista previa local:

```bash
python3 -m http.server 8080
# Abrir http://localhost:8080 (sitio), /marcador.html (TV) y /captura.html (móvil)
```

El inicio de sesión de la captura funciona en `localhost` sin configurar nada más: Firebase lo autoriza por defecto.

> **Importante:** `dist/output.css` está incluido en el repositorio. Hay que ejecutar `npm run build-css` y subir el archivo **antes de publicar**, o la web no reflejará los cambios de estilo.

## Datos en Google Sheets

Los datos del torneo (partidos, equipos, goleadores, etc.) se gestionan en un libro de Google Sheets. Las hojas se publican como CSV y la web las consume directamente desde `js/data/sheets.js`. Para modificar los datos del torneo, solo hay que editar la hoja de cálculo — la web se actualiza sin necesidad de tocar código.

### Claves y columnas del marcador en vivo (opcionales)

- **CONFIGURACION:** `MARCADOR_PARTES` (2), `MARCADOR_MIN_PARTE` (12), `MARCADOR_DESCANSO` (1), `MARCADOR_MIN_PRORROGA` (3), `MARCADOR_PENALTIS` (5) y `DESEMPATE_<RONDA>` (`INICIAL`, `CUARTOS`, `SEMIFINAL`, `TERCERPUESTO`, `FINAL`). Entre paréntesis, el valor que se usa si la clave no existe. La TV respeta también `EQUIPOS_CON_LOGO` y `EQUIPOS_CON_NOMBRE`.
- **CLASIFICACION:** columna `DESEMPATE` para fijar el desempate de un partido concreto (`NINGUNO`, `PENALTIS`, `PRORROGA` o `PRORROGA_Y_PENALTIS`).
- El Apps Script escribe en **GOLES** (los goles de cada partido capturado) y en **CLASIFICACION** (`LSCORE`, `VSCORE`, `ESTATUS` y, en eliminatorias, `LPENALES` y `VPENALES`). Nunca sobrescribe celdas con fórmula.

## Marcador en vivo

| Página | Para quién | Qué hace |
|---|---|---|
| `marcador.html` | La TV | Muestra el partido en juego; entre partidos, el siguiente con cuenta atrás. |
| `marcador.html?partido=N` | La TV o el público | Previa, directo o final de ese partido. Es el enlace de las tarjetas de los partidos del día en la portada. |
| `captura.html` | Quien anota (con cuenta de Google autorizada) | Elige un partido **sin jugar** y lo controla: reloj, goles (con tiempo exacto y gol en propia), tiempo añadido, descanso, prórroga, penaltis y final. |

- **Reloj:** por defecto, el de las bases (2 tiempos de 12′, descanso de 1′, reloj corrido). En grande se ve el tiempo transcurrido y en pequeño lo que queda. El tiempo añadido tiene su propio estilo ámbar con «+».
- **Desempate:** se elige por partido (prórroga, penaltis o ambos); la tanda de penaltis es configurable y acaba en muerte súbita.
- **Contexto en la TV:** clasificación del grupo en directo (fase de grupos), cuadro de eliminatorias (cuartos y semifinales) o camino a la final, más goleadores, próximos partidos y resultados.
- **Animaciones:** al iniciar el partido y al marcar un gol.
- **Sin Firebase configurado**, la TV funciona solo con el libro: previa y, cuando el partido tiene `ESTATUS = JUGADO`, el resultado final.

Puesta en marcha (Firebase, reglas, anotadores, Apps Script), límites del plan gratuito y detalles técnicos: **[MARCADOR.md](MARCADOR.md)**.

## Despliegue

El sitio se publica en **GitHub Pages** desde la rama principal. Cada push con cambios en `dist/output.css` actualiza el sitio automáticamente.

- `css/marcador.css` y `css/captura.css` no pasan por Tailwind: se publican tal cual.
- Al cambiar el JS o el CSS del marcador, sube el número `?v=` de `marcador.html` y `captura.html` para que los navegadores (y la TV) no usen la copia antigua.
- Para que «Entrar con Google» funcione en el sitio publicado, `gerardohmx.github.io` debe estar en **Firebase › Authentication › Configuración › Dominios autorizados**.
