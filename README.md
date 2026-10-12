# V Torneo Fútbol Sala Al-Ándalus — Colegio San Francisco de Asís

Sitio web del torneo escolar de fútbol sala: calendario, resultados, clasificación, goleadores, sancionados, noticias y galería. Los datos se editan en un libro de Google Sheets y la web se actualiza sola.

**Sitio publicado:** https://gerardohmx.github.io/TorneoAl-Andalus/

**Autor:** Alumno de 1º Bachillerato Gerardo Huizar Castro
**Licencia:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

## Tecnología

- HTML5 y CSS3, con sistema de diseño propio (`css/tokens.css`).
- JavaScript con módulos ES (sin bundler, sin frameworks).
- Tailwind CSS compilado a `dist/output.css`. **No se usa Bootstrap.**
- Datos: hojas de Google Sheets publicadas como CSV.

## Comandos

Requiere Node.js 20.

```bash
npm install                  # instala Tailwind y dependencias de desarrollo
npm run build-css            # compila src/input.css -> dist/output.css
npm run watch-css            # igual, pero vigilando cambios
python3 -m http.server 8080  # vista previa local en http://localhost:8080
```

`dist/output.css` está guardado en el repositorio: hay que ejecutar `npm run build-css` y subirlo **antes de publicar**, o la web no verá los cambios de estilo.
