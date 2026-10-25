// Genera las imágenes del README jugando una partida de verdad con Playwright.
// Uso: node scripts/capturas.mjs   (necesita conexión para las fuentes de Google)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = resolve(import.meta.dirname, "..");
const docs = resolve(raiz, "docs");
const juego = pathToFileURL(resolve(raiz, "index.html")).href;
const banner = pathToFileURL(resolve(raiz, "scripts/banner.html")).href;
mkdirSync(docs, { recursive: true });

const espera = ms => new Promise(r => setTimeout(r, ms));
const navegador = await chromium.launch();

async function abrir(ancho, alto) {
  const p = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2 });
  await p.goto(juego);
  await p.evaluate(() => document.fonts.ready);
  await espera(600);
  return p;
}
async function centroLienzo(p) {
  return p.$eval("#lienzo", e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
}
// tira de la chapa: (dx, dy) es hacia dónde se arrastra el dedo, la chapa sale al revés
async function tirar(p, dx, dy, { soltar = true, pasos = 8 } = {}) {
  const c = await centroLienzo(p);
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  await p.mouse.move(c.x + dx, c.y + dy, { steps: pasos });
  if (soltar) await p.mouse.up();
}
async function esperarQuieto(p) {
  await espera(3200);
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

// ---------- Tablet ----------
{
  const p = await abrir(1180, 820);
  await p.screenshot({ path: resolve(docs, "menu-tablet.png") });
  await p.click("#b-jug-4");
  await espera(500);
  await tirar(p, -260, 30);               // amarillo
  await esperarQuieto(p);
  await tirar(p, -170, -6);               // rojo
  await esperarQuieto(p);
  await tirar(p, -140, 12);               // verde
  await esperarQuieto(p);
  await tirar(p, -230, 10, { soltar: false }); // azul apuntando
  await espera(300);
  await p.screenshot({ path: resolve(docs, "juego-tablet.png") });
  await p.mouse.up();
  await p.close();
}

// ---------- Móvil + GIF ----------
{
  const p = await abrir(390, 844);
  await p.screenshot({ path: resolve(docs, "menu-movil.png") });
  await p.click("#b-jug-2");
  await espera(500);

  const fotos = resolve(docs, ".fotogramas");
  rmSync(fotos, { recursive: true, force: true });
  mkdirSync(fotos);
  let n = 0;
  const foto = () => p.screenshot({ path: resolve(fotos, String(n++).padStart(4, "0") + ".png"), scale: "css" });

  // apuntar poco a poco para que se vea la flecha crecer
  const c = await centroLienzo(p);
  for (let i = 0; i < 4; i++) await foto();
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(c.x + i * 2, c.y - i * 26); await foto(); }
  await p.mouse.up();
  for (let i = 0; i < 34; i++) { await foto(); await espera(70); }
  await espera(800);
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(c.x, c.y - i * 12); await foto(); }
  await p.mouse.up();
  for (let i = 0; i < 40; i++) { await foto(); await espera(70); }
  await p.screenshot({ path: resolve(docs, "juego-movil.png") });

  const gif = resolve(docs, "partida.gif");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "12", "-i", resolve(fotos, "%04d.png"),
    "-vf", "scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
    gif]);
  rmSync(fotos, { recursive: true, force: true });
  await p.close();
}

await navegador.close();
console.log("Capturas listas en", docs, existsSync(resolve(docs, "partida.gif")) ? "(con GIF)" : "");
