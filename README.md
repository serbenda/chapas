# La Vuelta de Chapas

Juego de chapas de los 80: la vuelta ciclista por turnos, para jugar en el móvil o la tablet. Hecho para jugar con mis hijas.

Funciona en el navegador del móvil, la tablet o el ordenador, y se puede instalar como app y jugar sin internet.

## Publicarlo en GitHub Pages

1. Crea un repositorio **público** en GitHub, por ejemplo `vuelta-chapas`.
2. Sube todos los archivos de esta carpeta a la raíz del repo (con el botón *Add file → Upload files* o con `git push`).
3. En el repo ve a **Settings → Pages**.
4. En *Build and deployment* elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Pulsa *Save*.
5. Espera uno o dos minutos. El juego queda en `https://TU-USUARIO.github.io/vuelta-chapas/`.

## Instalarlo en el móvil

- **Android (Chrome):** abre el enlace, menú ⋮ → *Añadir a pantalla de inicio* o *Instalar aplicación*.
- **iPhone/iPad (Safari):** abre el enlace, botón Compartir → *Añadir a pantalla de inicio*.

Se abre a pantalla completa con su icono de chapa. Después de abrirlo una vez con conexión, ya funciona sin internet.

## Cuando cambies el juego

Edita `index.html` y sube en `sw.js` la versión (`chapas-v1` → `chapas-v2`) para que los móviles recojan la versión nueva.
