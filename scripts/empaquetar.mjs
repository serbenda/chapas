// Junta index.html y los módulos de js/ en un único HTML autocontenido.
// Uso: node scripts/empaquetar.mjs salida.html
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");
const orden = ["circuito", "fisica", "ia", "sonido", "juego"];   // dependencias primero
const codigo = orden.map(m => {
  const fuente = readFileSync(resolve(raiz, "js", m + ".js"), "utf8")
    .replace(/^import [^;]+;\n/gm, "")
    .replace(/^export (const|function|let) /gm, "$1 ");
  return "// ===== js/" + m + ".js =====\n" + fuente;
}).join("\n");
let html = readFileSync(resolve(raiz, "index.html"), "utf8");
html = html.replace('<script type="module" src="js/juego.js"></script>', () => "<script>\n(() => {\n\"use strict\";\n" + codigo + "\n})();\n</script>");
const salida = process.argv[2] || resolve(raiz, "dist", "vuelta-chapas.html");
writeFileSync(salida, html);
console.log("Empaquetado en", salida);
