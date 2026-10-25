// Genera las imágenes del README jugando partidas de verdad con Playwright.
// Uso: node scripts/capturas.mjs   (necesita conexión para las fuentes de Google)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, rmSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = resolve(import.meta.dirname, "..");
const docs = resolve(raiz, "docs");
mkdirSync(docs, { recursive: true });

// servidor local: los módulos JS no cargan desde file://
const tipos = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".css": "text/css" };
const servidor = createServer((req, res) => {
  const ruta = join(raiz, decodeURIComponent(new URL(req.url, "http://x").pathname));
  const archivo = existsSync(ruta) && statSync(ruta).isDirectory() ? join(ruta, "index.html") : ruta;
  if (!archivo.startsWith(raiz) || !existsSync(archivo)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": tipos[extname(archivo)] || "application/octet-stream" });
  res.end(readFileSync(archivo));
});
await new Promise(r => servidor.listen(0, r));
const juego = `http://localhost:${servidor.address().port}/`;
const banner = pathToFileURL(resolve(raiz, "scripts/banner.html")).href;

const espera = ms => new Promise(r => setTimeout(r, ms));
const navegador = await chromium.launch();

async function abrir(ancho, alto) {
  const p = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2 });
  await p.goto(juego);
  await p.evaluate(() => document.fonts.ready);
  await espera(600);
  return p;
}
const estado = p => p.evaluate(() => window.__vuelta.estado());
async function esperarFase(p, f, turno, max = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    const e = await estado(p);
    if (e.fase === f && (turno === undefined || e.turno === turno)) return e;
    await espera(200);
  }
  throw new Error("No se llegó a la fase " + f);
}
// prepara una carrera: n corredores, tipos de cada uno, una etapa o la Vuelta
async function preparar(p, { n, maquinas = [], modo = "etapa", etapa = 0, nombres = [] }) {
  await p.click("#b-jug-" + n);
  await espera(150);
  for (let i = 0; i < n; i++) {
    // dejar cada ficha como persona o máquina media
    for (let k = 0; k < 4; k++) {
      const t = await p.textContent("#tipo-" + i);
      const quiero = maquinas.includes(i) ? "MÁQUINA MEDIA" : "PERSONA";
      if (t.trim() === quiero) break;
      await p.click("#tipo-" + i);
    }
    if (nombres[i] !== undefined) await p.fill("#nombre-" + i, nombres[i]);
  }
  await p.click(modo === "vuelta" ? "#b-vuelta" : "#b-una");
  if (modo === "etapa") await p.click("#etapa-" + etapa);
}
// lleva al jugador 0 justo antes de la meta y tira recto
async function llegarAMeta(p) {
  // unas tiradas normales para que el marcador sea creíble
  for (let ronda = 0; ronda < 2; ronda++) {
    for (const t of [0, 1]) {
      await esperarFase(p, "apuntar", t);
      await espera(900);
      await p.evaluate(() => window.__vuelta.tirarRecto(0.5));
    }
  }
  await esperarFase(p, "apuntar", 0, 40000);
  await espera(900);
  await p.evaluate(() => { window.__vuelta.colocar(0, window.__vuelta.arcoMeta() - 40); window.__vuelta.tirarRecto(0.35); });
  await esperarFase(p, "fin");
  await espera(2200);
}

// ---------- Banner ----------
{
  const p = await navegador.newPage({ viewport: { width: 1280, height: 400 }, deviceScaleFactor: 2 });
  await p.goto(banner);
  await p.evaluate(() => document.fonts.ready);
  await espera(400);
  await p.screenshot({ path: resolve(docs, "banner.png") });
  await p.close();
}

// ---------- Las cuatro etapas en tablet ----------
for (const [i, id] of ["llana", "montana", "adoquines", "final"].entries()) {
  const p = await abrir(1180, 820);
  await preparar(p, { n: 3, maquinas: [2], etapa: i, nombres: ["Lucía", "Martina", ""] });
  await p.click("#b-correr");
  await esperarFase(p, "apuntar", 0);
  await espera(900);
  await p.evaluate(() => window.__vuelta.tirarRecto(0.55));
  await esperarFase(p, "apuntar", 1);
  await espera(900);
  await p.evaluate(() => window.__vuelta.tirarRecto(0.45));
  await esperarFase(p, "maquina", 2);
  await espera(1700);   // la máquina apuntando
  await p.screenshot({ path: resolve(docs, `etapa-${id}.png`) });
  await p.close();
}

// ---------- Clasificación de la Vuelta y podio ----------
{
  const p = await abrir(1180, 820);
  await preparar(p, { n: 3, maquinas: [2], modo: "vuelta", nombres: ["Lucía", "Martina", ""] });
  await p.click("#b-correr");
  await llegarAMeta(p);
  await p.screenshot({ path: resolve(docs, "clasificacion.png") });
  await p.close();
}
{
  const p = await abrir(1180, 820);
  await preparar(p, { n: 3, maquinas: [2], etapa: 0, nombres: ["Lucía", "Martina", ""] });
  await p.click("#b-correr");
  await llegarAMeta(p);
  await p.screenshot({ path: resolve(docs, "podio.png") });
  await p.close();
}

// ---------- Dibuja tu circuito ----------
// pasa puntos del mundo (1000 × 620) a la pantalla, igual que el juego
async function deMundoAPantalla(p) {
  const box = await p.$eval("#lienzo", e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const vertical = box.h > box.w * 1.1, mw = vertical ? 620 : 1000, mh = vertical ? 1000 : 620;
  const esc = Math.min(box.w / mw, box.h / mh) * 0.97, ox = (box.w - mw * esc) / 2, oy = (box.h - mh * esc) / 2;
  return ([x, y]) => vertical ? [box.x + ox + y * esc, box.y + oy + x * esc] : [box.x + ox + x * esc, box.y + oy + y * esc];
}
async function trazar(p, pts, { soltar = true, hasta = 1 } = {}) {
  const aS = await deMundoAPantalla(p);
  const [sx, sy] = aS(pts[0]);
  await p.mouse.move(sx, sy);
  await p.mouse.down();
  const tramos = Math.max(1, Math.round((pts.length - 1) * hasta));
  for (let i = 1; i <= tramos; i++) {
    const [a, b] = pts[i - 1], [c, d] = pts[i];
    const n = Math.ceil(Math.hypot(c - a, d - b) / 10);
    for (let k = 1; k <= n; k++) { const [x, y] = aS([a + (c - a) * k / n, b + (d - b) * k / n]); await p.mouse.move(x, y); }
  }
  if (soltar) await p.mouse.up();
}
{
  const circuito = [[90, 520], [450, 540], [800, 520], [900, 420], [880, 300], [560, 300], [300, 320], [120, 260], [110, 130], [350, 90], [650, 110], [900, 90]];
  const p = await abrir(1180, 820);
  await preparar(p, { n: 2, maquinas: [1], etapa: 0, nombres: ["Lucía", ""] });
  await p.click("#b-dibujar");
  await espera(300);
  await trazar(p, circuito, { soltar: false, hasta: 0.6 });
  await espera(200);
  await p.screenshot({ path: resolve(docs, "dibujar-trazo.png") });
  await p.mouse.up();
  await p.click("#b-ed-borrar");
  await trazar(p, circuito);
  await espera(500);
  await p.screenshot({ path: resolve(docs, "dibujar-listo.png") });
  await p.close();
}

// ---------- Fútbol de chapas ----------
async function prepararFutbol(p, nombres) {
  await p.click("#b-juego-futbol");
  await espera(200);
  await p.click("#b-jug-maquina");
  await espera(150);
  for (let i = 0; i < 2; i++) await p.fill("#nombre-" + i, nombres[i]);
  await p.click("#b-goles-3");
}
{
  const p = await abrir(1180, 820);
  await prepararFutbol(p, ["Lucía", ""]);
  await p.click("#b-correr");
  for (let r = 0; r < 2; r++) {
    await esperarFase(p, "apuntar", 0, 40000);
    await espera(900);
    await p.evaluate(() => window.__vuelta.tirarAlBalon(0.6));
  }
  await esperarFase(p, "maquina", 1, 40000);
  await espera(1700);
  await p.screenshot({ path: resolve(docs, "futbol-partido.png") });
  await esperarFase(p, "apuntar", 0, 40000);
  await espera(900);
  // jugada de gol: el delantero, justo detrás del balón y frente a la portería
  await p.evaluate(() => { window.__vuelta.balonA(860, 272); window.__vuelta.chapaA(3, 815, 272); window.__vuelta.tirarAlBalon(0.6); });
  await esperarFase(p, "gol", undefined, 8000);
  await espera(700);
  await p.screenshot({ path: resolve(docs, "futbol-gol.png") });
  await p.close();
}
{
  const p = await abrir(390, 844);
  await prepararFutbol(p, ["Lucía", ""]);
  await p.click("#b-correr");
  await esperarFase(p, "apuntar", 0, 40000);
  await espera(900);
  await p.evaluate(() => window.__vuelta.tirarAlBalon(0.6));
  await esperarFase(p, "maquina", 1, 40000);
  await espera(1700);
  await p.screenshot({ path: resolve(docs, "movil-futbol.png") });
  await p.close();
}

// ---------- Móvil: menú, corredores y GIF de una partida ----------
{
  const p = await abrir(390, 844);
  await p.screenshot({ path: resolve(docs, "movil-menu.png") });
  await preparar(p, { n: 3, maquinas: [2], etapa: 0, nombres: ["Lucía", "Martina", ""] });
  await p.screenshot({ path: resolve(docs, "movil-corredores.png") });
  await p.click("#b-volver");
  await preparar(p, { n: 2, maquinas: [1], etapa: 0, nombres: ["Lucía", ""] });
  await p.click("#b-correr");
  await esperarFase(p, "apuntar", 0);
  await espera(900);

  const fotos = resolve(docs, ".fotogramas");
  rmSync(fotos, { recursive: true, force: true });
  mkdirSync(fotos);
  let n = 0;
  const foto = () => p.screenshot({ path: resolve(fotos, String(n++).padStart(4, "0") + ".png"), scale: "css" });

  // la manita del tutorial, luego el gesto de verdad
  for (let i = 0; i < 14; i++) { await foto(); await espera(90); }
  const c = await p.$eval("#lienzo", e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(c.x, c.y - i * 8); await foto(); }
  await p.mouse.up();
  for (let i = 0; i < 70; i++) { await foto(); await espera(70); }   // tirada + turno de la máquina
  await p.screenshot({ path: resolve(docs, "movil-partida.png") });

  const gif = resolve(docs, "partida.gif");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "12", "-i", resolve(fotos, "%04d.png"),
    "-vf", "scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
    gif]);
  rmSync(fotos, { recursive: true, force: true });
  await p.close();
}

await navegador.close();
servidor.close();
console.log("Capturas listas en", docs);
