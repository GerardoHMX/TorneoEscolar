# V Torneo Fútbol Sala Al-Ándalus — Colegio San Francisco de Asís

Sitio web del torneo escolar de fútbol sala: calendario, resultados, clasificación, goleadores, sancionados, noticias y galería. Los datos se editan en un libro de Google Sheets y la web se actualiza automáticamente.

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

## Tecnología

- **HTML5 y CSS3**, con sistema de diseño propio (`css/tokens.css`).
- **JavaScript** con módulos ES (sin bundler, sin frameworks).
- **Tailwind CSS 3** compilado a `dist/output.css`. No se usa Bootstrap.
- **Datos:** hojas de Google Sheets publicadas como CSV.
- **Imágenes:** servidas desde Google Drive.
- **Fuentes:** autoalojadas en formato woff2 (LaLiga Headline, Roboto, Pattaya).
- **Hosting:** GitHub Pages.

## Estructura del proyecto

```
TorneoEscolar-main/
├── index.html              # Página principal (SPA)
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
│   └── motion.css          # Animaciones y transiciones
├── js/
│   ├── main.js             # Punto de entrada
│   ├── translations.js     # Traducciones (i18n)
│   ├── core/
│   │   ├── boot.js         # Inicialización de la app
│   │   ├── store.js        # Estado global
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
│       ├── matchCard.js    # Tarjeta de partido
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
# Abrir http://localhost:8080
```

> **Importante:** `dist/output.css` está incluido en el repositorio. Hay que ejecutar `npm run build-css` y subir el archivo **antes de publicar**, o la web no reflejará los cambios de estilo.

## Datos en Google Sheets

Los datos del torneo (partidos, equipos, goleadores, etc.) se gestionan en un libro de Google Sheets. Las hojas se publican como CSV y la web las consume directamente desde `js/data/sheets.js`. Para modificar los datos del torneo, solo hay que editar la hoja de cálculo — la web se actualiza sin necesidad de tocar código.

## Despliegue

El sitio se publica en **GitHub Pages** desde la rama principal. Cada push con cambios en `dist/output.css` actualiza el sitio automáticamente.
