// Junta index.html y los módulos de js/ en un único HTML autocontenido.
// Cada módulo va en su propio ámbito, así que pueden repetir nombres internos.
// Uso: node scripts/empaquetar.mjs salida.html
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");
const orden = ["textos", "circuito", "fisica", "ia", "futbol", "sonido", "juego"];   // dependencias primero

const codigo = orden.map(m => {
  let fuente = readFileSync(resolve(raiz, "web", "js", m + ".js"), "utf8");
  const exportados = [...fuente.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map(x => x[1]);
  // export const A = 1, B = 2;  → también B
  for (const linea of fuente.matchAll(/^export const ([^;]+);/gm)) {
    for (const parte of linea[1].split(",")) {
      const nombre = parte.split("=")[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nombre) && !exportados.includes(nombre)) exportados.push(nombre);
    }
  }
  fuente = fuente
    .replace(/^import \{([^}]+)\} from "\.\/([\w-]+)\.js";$/gm, (_, nombres, mod) => `const {${nombres}} = __m["${mod}"];`)
    .replace(/^export (const|function|let) /gm, "$1 ");
  return `// ===== js/${m}.js =====\n__m["${m}"] = (() => {\n${fuente}\nreturn { ${exportados.join(", ")} };\n})();`;
}).join("\n");

let html = readFileSync(resolve(raiz, "web", "index.html"), "utf8");
html = html.replace('<script type="module" src="js/juego.js"></script>',
  () => "<script>\n(() => {\n\"use strict\";\nconst __m = {};\n" + codigo + "\n})();\n</script>");
const salida = process.argv[2] || resolve(raiz, "dist", "vuelta-chapas.html");
writeFileSync(salida, html);
console.log("Empaquetado en", salida);
