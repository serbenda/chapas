// La Vuelta de Chapas: pantalla, cámara, dibujo, turnos, etapas y menús.

import { WW, WH, TW, R, PASO, ETAPAS, construirPista, posicionesSalida } from "./circuito.js";
import { pasoFisica, velocidadTiro } from "./fisica.js";
import { elegirTiro, NIVELES } from "./ia.js";
import { activarAudio, alternarSonido, haySonido, sfx, arrancarMusica } from "./sonido.js";

const $ = id => document.getElementById(id);

const CORREDORES = [
  { nombre: "Amarillo", color: "#ffcf3a", dorsal: 1 },
  { nombre: "Rojo", color: "#e5483a", dorsal: 2 },
  { nombre: "Verde", color: "#35b26a", dorsal: 3 },
  { nombre: "Azul", color: "#3f7fe6", dorsal: 4 }
];
const PUNTOS_ETAPA = [10, 6, 3, 1];
const PUNTOS_CIMA = [5, 3, 1];
const TIPOS = ["persona", "facil", "media", "dificil"];

// ---------- Almacenamiento local (solo en este dispositivo) ----------
function leer(clave, def) { try { const v = localStorage.getItem(clave); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
function guardar(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch (e) {} }

// ---------- Pantalla y cámara ----------
const lienzo = $("lienzo");
const ctx = lienzo.getContext("2d");
const fondo = document.createElement("canvas");
const fctx = fondo.getContext("2d");
let cw = 0, ch = 0, dpr = 1, esc = 1, ox = 0, oy = 0, vertical = false;
const MARGEN = 40;
let escFit = 1, escZoom = 1, escFondo = 1, fondoW = 1, fondoH = 1, hayZoom = false, verTodo = false;
const cam = { esc: 1, cx: WW / 2, cy: WH / 2 };

let pista = construirPista(ETAPAS[0]);

function aPantalla(x, y) { return vertical ? [ox + y * esc, oy + x * esc] : [ox + x * esc, oy + y * esc]; }
function vecAMundo(dx, dy) { return vertical ? [dy / esc, dx / esc] : [dx / esc, dy / esc]; }
function transfMundo(c) {
  if (vertical) c.setTransform(0, esc * dpr, esc * dpr, 0, ox * dpr, oy * dpr);
  else c.setTransform(esc * dpr, 0, 0, esc * dpr, ox * dpr, oy * dpr);
}
function transfPantalla(c) { c.setTransform(dpr, 0, 0, dpr, 0, 0); }

function medir() {
  const r = lienzo.getBoundingClientRect();
  cw = Math.max(1, r.width); ch = Math.max(1, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  lienzo.width = Math.round(cw * dpr);
  lienzo.height = Math.round(ch * dpr);
  vertical = ch > cw * 1.1;
  const mw = vertical ? WH : WW, mh = vertical ? WW : WH;
  escFit = Math.min(cw / mw, ch / mh) * 0.97;
  escZoom = Math.max(escFit, 15 / R);           // la chapa mide al menos 30 px de ancho
  hayZoom = escZoom > escFit * 1.15;
  $("b-vista").hidden = !hayZoom;
  // el fondo se pinta una vez, a la resolución del zoom, y luego se recorta
  const maxPx = 4096 / dpr;
  escFondo = Math.min(escZoom, maxPx / (mw + 2 * MARGEN), maxPx / (mh + 2 * MARGEN));
  fondoW = (mw + 2 * MARGEN) * escFondo; fondoH = (mh + 2 * MARGEN) * escFondo;
  fondo.width = Math.round(fondoW * dpr); fondo.height = Math.round(fondoH * dpr);
  esc = escFondo; ox = oy = MARGEN * escFondo;
  pintarFondo();
  moverCamara(true);
}
function objetivoCamara() {
  const sigue = hayZoom && !verTodo && chapas.length && (fase === "apuntar" || fase === "maquina" || fase === "rodando" || fase === "volviendo");
  if (!sigue) return { esc: escFit, cx: WW / 2, cy: WH / 2 };
  const c = chapas[turno];
  const e = escZoom;
  const hsx = cw / 2 / e, hsy = ch / 2 / e;
  const hx = vertical ? hsy : hsx, hy = vertical ? hsx : hsy;
  const lim = (v, h, tam) => h * 2 >= tam + 2 * MARGEN ? tam / 2 : Math.max(h - MARGEN, Math.min(tam + MARGEN - h, v));
  return { esc: e, cx: lim(c.x, hx, WW), cy: lim(c.y, hy, WH) };
}
function moverCamara(salto) {
  const o = objetivoCamara();
  const k = salto ? 1 : 0.09;
  cam.esc += (o.esc - cam.esc) * k;
  cam.cx += (o.cx - cam.cx) * k;
  cam.cy += (o.cy - cam.cy) * k;
  esc = cam.esc;
  ox = cw / 2 - (vertical ? cam.cy : cam.cx) * esc;
  oy = ch / 2 - (vertical ? cam.cx : cam.cy) * esc;
}

// ---------- Fondo: asfalto, tiza y terreno ----------
// números pseudoaleatorios estables para que la tiza no "baile" al redimensionar
function rngSemilla(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

function trazoTiza(c, pts, ancho, alfa, semilla, color) {
  const r = rngSemilla(semilla);
  for (let pasada = 0; pasada < 3; pasada++) {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const jx = (r() - 0.5) * 2.2, jy = (r() - 0.5) * 2.2;
      if (i === 0) c.moveTo(pts[i][0] + jx, pts[i][1] + jy); else c.lineTo(pts[i][0] + jx, pts[i][1] + jy);
    }
    c.strokeStyle = color || "rgba(244,240,228," + alfa + ")";
    c.lineWidth = ancho - pasada;
    c.lineCap = "round"; c.lineJoin = "round";
    c.stroke();
  }
}
function tramo(c, a0, a1) {
  const { PX, PY } = pista;
  const i0 = Math.max(0, Math.floor(a0 / PASO)), i1 = Math.min(pista.N - 1, Math.ceil(a1 / PASO));
  c.beginPath();
  for (let i = i0; i <= i1; i++) i === i0 ? c.moveTo(PX[i], PY[i]) : c.lineTo(PX[i], PY[i]);
}

function pintarFondo() {
  const { PX, PY, NX, NY, N } = pista;
  const c = fctx;
  transfPantalla(c);
  c.fillStyle = "#39404c";
  c.fillRect(0, 0, fondoW, fondoH);
  const r = rngSemilla(7);
  const granos = Math.floor(fondoW * fondoH / 26);
  for (let i = 0; i < granos; i++) {
    c.fillStyle = r() < 0.5 ? "rgba(20,24,32,0.35)" : "rgba(170,178,190,0.18)";
    c.fillRect(r() * fondoW, r() * fondoH, 1.4, 1.4);
  }
  transfMundo(c);
  // carretera frotada con tiza
  tramo(c, 0, pista.L);
  c.lineCap = "butt"; c.lineJoin = "round";
  c.strokeStyle = "rgba(244,240,228,0.07)";
  c.lineWidth = TW;
  c.stroke();
  // terreno
  for (const z of pista.zonas) {
    tramo(c, z.a0, z.a1);
    c.strokeStyle = z.tipo === "subida" ? "rgba(255,138,42,0.12)" : z.tipo === "bajada" ? "rgba(79,214,232,0.10)" : "rgba(244,240,228,0.05)";
    c.lineWidth = TW; c.stroke();
    if (z.tipo === "adoquines") pintarAdoquines(c, z);
    else pintarFlechas(c, z);
  }
  for (const ch of pista.charcos) {
    c.save();
    c.fillStyle = "rgba(79,150,232,0.38)";
    c.beginPath(); c.ellipse(ch.x, ch.y, ch.r, ch.r * 0.8, 0.4, 0, 6.283); c.fill();
    c.strokeStyle = "rgba(200,235,255,0.55)"; c.lineWidth = 2;
    c.beginPath(); c.ellipse(ch.x - ch.r * 0.2, ch.y - ch.r * 0.2, ch.r * 0.45, ch.r * 0.2, 0.4, 3.6, 5.4); c.stroke();
    c.restore();
  }
  // bordes
  const izq = [], der = [];
  for (let i = 0; i < N; i += 2) {
    izq.push([PX[i] + NX[i] * TW / 2, PY[i] + NY[i] * TW / 2]);
    der.push([PX[i] - NX[i] * TW / 2, PY[i] - NY[i] * TW / 2]);
  }
  trazoTiza(c, izq, 4.5, 0.55, 11);
  trazoTiza(c, der, 4.5, 0.55, 23);
  if (modoFacil) {
    // vallas rojas y blancas, como las de las llegadas
    for (const lado of [1, -1]) {
      for (let i = 0; i < N - 4; i += 4) {
        const o = lado * (TW / 2 - 3);
        c.beginPath();
        c.moveTo(PX[i] + NX[i] * o, PY[i] + NY[i] * o);
        c.lineTo(PX[i + 4] + NX[i + 4] * o, PY[i + 4] + NY[i + 4] * o);
        c.strokeStyle = (i / 4) % 2 ? "#f4f0e4" : "#e5483a";
        c.lineWidth = 6; c.lineCap = "butt";
        c.stroke();
      }
    }
  }
  for (let s = 400; s < pista.arcoMeta - 150; s += 400) {
    const [x, y, nx, ny] = pista.enArco(s, 0);
    trazoTiza(c, [[x + nx * (TW / 2 - 8), y + ny * (TW / 2 - 8)], [x + nx * (TW / 2 + 6), y + ny * (TW / 2 + 6)]], 3, 0.6, s);
  }
  for (const cima of pista.cimas) lineaCima(c, cima.arco);
  linea(c, pista.arcoSalida, false);
  linea(c, pista.arcoMeta, true);

  // textos en coordenadas de pantalla (para que no salgan en espejo)
  transfPantalla(c);
  textoCarretera(c, "SALIDA", pista.arcoSalida + 46, 24, "rgba(244,240,228,0.85)");
  textoCarretera(c, "META", pista.arcoMeta - 46, 28, "#ffcf3a");
  const nombres = { subida: "SUBIDA", bajada: "BAJADA", adoquines: "ADOQUINES" };
  for (const z of pista.zonas) textoCarretera(c, nombres[z.tipo], z.a0 + 40, 17, z.tipo === "subida" ? "#ff8a2a" : z.tipo === "bajada" ? "#4fd6e8" : "rgba(244,240,228,0.8)");
  for (const cima of pista.cimas) textoCarretera(c, "CIMA " + cima.cat, cima.arco + 24, 17, "#e5483a");
  if (pista.etapa.adorno) {
    const a = pista.etapa.adorno;
    const [x, y] = aPantalla(a.x, a.y), k = esc;
    const m = (px, py) => [x + px * k, y + py * k];
    trazoTiza(c, [m(-46, 4), m(-16, -40), m(2, -20), m(20, -48), m(50, 4), m(-46, 4)], Math.max(2, 3.5 * k), 0.75, 99);
    trazoTiza(c, [m(12, -36), m(20, -48), m(28, -36)], Math.max(2, 3 * k), 0.9, 98);
    c.font = fuenteTiza(22);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "rgba(244,240,228,0.9)";
    c.fillText(a.texto, x, y + 26 * k);
  }
  let km = 1;
  for (let s = 400; s < pista.arcoMeta - 150; s += 400, km++) {
    if (pista.terreno(s + 22)) continue;
    textoCarretera(c, "km " + km * 20, s + 22, 15, "rgba(244,240,228,0.42)");
  }
}
function pintarFlechas(c, z) {
  // chevrones de tiza: uno para la subida, dobles para la bajada
  const color = z.tipo === "subida" ? "rgba(255,138,42,0.75)" : "rgba(79,214,232,0.7)";
  for (let s = z.a0 + 80; s < z.a1 - 20; s += 46) {
    const [x, y, nx, ny] = pista.enArco(s, 0);
    const tx = ny, ty = -nx;
    const marcas = z.tipo === "bajada" ? [0, 9] : [0];
    for (const off of marcas) {
      const bx = x + tx * off, by = y + ty * off;
      trazoTiza(c, [[bx - tx * 8 + nx * 14, by - ty * 8 + ny * 14], [bx, by], [bx - tx * 8 - nx * 14, by - ty * 8 - ny * 14]], 3, 0.7, Math.round(s), color);
    }
  }
}
function pintarAdoquines(c, z) {
  c.save();
  c.strokeStyle = "rgba(244,240,228,0.2)"; c.lineWidth = 1.2;
  const r = rngSemilla(31);
  for (let s = z.a0; s < z.a1; s += 9) {
    const fila = Math.round(s / 9) % 2;
    for (let lat = -TW / 2 + 6 + fila * 5; lat < TW / 2 - 4; lat += 10) {
      const [x, y] = pista.enArco(s + (r() - 0.5) * 1.5, lat);
      c.beginPath(); c.roundRect ? c.roundRect(x - 3.6, y - 3.6, 7.2, 7.2, 2) : c.rect(x - 3.6, y - 3.6, 7.2, 7.2); c.stroke();
    }
  }
  c.restore();
}
function linea(c, arco, cuadros) {
  const [x, y, nx, ny] = pista.enArco(arco, 0);
  const tx = -ny, ty = nx;
  if (!cuadros) {
    trazoTiza(c, [[x + nx * TW / 2, y + ny * TW / 2], [x - nx * TW / 2, y - ny * TW / 2]], 5, 0.85, 5);
    return;
  }
  const filas = 2, cols = 8, lado = TW / cols;
  for (let f = 0; f < filas; f++) for (let k = 0; k < cols; k++) {
    c.fillStyle = (f + k) % 2 ? "rgba(244,240,228,0.85)" : "rgba(20,22,28,0.85)";
    const lat = -TW / 2 + k * lado, ad = (f - 1) * lado;
    c.beginPath();
    const p = (a, b) => [x + nx * a + tx * b, y + ny * a + ty * b];
    const q = [p(lat, ad), p(lat + lado, ad), p(lat + lado, ad + lado), p(lat, ad + lado)];
    c.moveTo(q[0][0], q[0][1]); for (let m = 1; m < 4; m++) c.lineTo(q[m][0], q[m][1]);
    c.closePath(); c.fill();
  }
}
function lineaCima(c, arco) {
  // línea de puntos rojos y blancos, como el maillot de la montaña
  const [x, y, nx, ny] = pista.enArco(arco, 0);
  for (let k = 0; k < 9; k++) {
    const lat = -TW / 2 + 5 + k * ((TW - 10) / 8);
    c.fillStyle = k % 2 ? "#f4f0e4" : "#e5483a";
    c.beginPath(); c.arc(x + nx * lat, y + ny * lat, 4, 0, 6.283); c.fill();
  }
}
function fuenteTiza(tam) {
  return Math.max(11, tam * esc * 1.25) + "px " + getComputedStyle(document.documentElement).getPropertyValue("--f-tiza");
}
// texto escrito sobre la carretera, siguiendo su dirección y siempre legible
function textoCarretera(c, t, arco, tam, color) {
  const [x, y] = pista.enArco(arco, 0);
  const [ax, ay] = pista.enArco(arco - 10, 0), [bx, by] = pista.enArco(arco + 10, 0);
  const [sx, sy] = aPantalla(x, y), [s1x, s1y] = aPantalla(ax, ay), [s2x, s2y] = aPantalla(bx, by);
  let ang = Math.atan2(s2y - s1y, s2x - s1x);
  if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
  c.save();
  c.translate(sx, sy); c.rotate(ang);
  c.font = fuenteTiza(tam);
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = color;
  c.fillText(t, 0, 0);
  c.restore();
}

// ---------- Locutor de radio ----------
let locutorTimer = null;
function locutor(frase) {
  const caja = $("locutor"), el = $("locutor-texto");
  caja.hidden = false;
  clearInterval(locutorTimer);
  let n = 0;
  el.textContent = "";
  locutorTimer = setInterval(() => {
    n++; el.textContent = frase.slice(0, n);
    if (n % 2) sfx.tecla();
    if (n >= frase.length) clearInterval(locutorTimer);
  }, 38);
}
const al = a => a[Math.floor(Math.random() * a.length)];
function lider() {
  let m = null;
  chapas.forEach(c => { if (!c.fuera && (!m || c.arco > m.arco)) m = c; });
  return m;
}
let tiro = null;
function comentar() {
  if (!tiro) return;
  const c = chapas[turno], avance = c.arco - tiro.arcoIni, l = lider();
  let f;
  if (tiro.fueraPropio) f = al(["¡Se ha ido a la cuneta!", "¡Fuera de la carretera!", "¡Uy, a la cuneta! ¡Vuelta atrás!"]);
  else if (tiro.fueraOtro) f = "¡Ha echado de la carretera a un rival!";
  else if (tiro.charco && Math.random() < 0.7) f = al(["¡Ha pisado un charco!", "¡Cuidado, que resbala!"]);
  else if (tiro.adoquines && Math.random() < 0.6) f = al(["¡Cómo bota en los adoquines!", "¡Traca, traca, adoquines!"]);
  else if (tiro.rebote && Math.random() < 0.6) f = al(["¡Rebote en la valla!", "¡Menos mal que hay vallas!"]);
  else if (l === c && tiro.lider !== c) f = "¡Nuevo líder: " + c.nombre + "!";
  else if (tiro.choque) f = al(["¡Chocazo en el pelotón!", "¡Qué golpe de chapa!"]);
  else if (avance > 300) f = al(["¡Qué demarraje!", "¡Se escapa! ¡Se escapa!", "¡Tirada de campeón!"]);
  else if (avance < 60 && tiro.subida) f = al(["¡Qué dura es la subida!", "¡Se le atraganta el puerto!"]);
  else if (avance < 60) f = al(["¡Pájara! Se ha quedado sin fuerzas", "Tirada corta... ¡ánimo!"]);
  else if (tiro.bajada && avance > 200) f = "¡Baja como un cohete!";
  else f = al(["¡Buena tirada!", "¡Sigue en carrera!", "¡Va a rueda del grupo!", "¡Bien colocado!"]);
  locutor(f);
  tiro = null;
}

// ---------- Récords (uno por etapa) ----------
const claveRecord = id => id === "llana" ? "vuelta-record" : "vuelta-record-" + id;
function leerRecord(id) { const v = parseInt(leer(claveRecord(id), null), 10); return isNaN(v) ? null : v; }
function pintarRecord() { const r = leerRecord("llana"); $("record").textContent = r === null ? "--" : String(r).padStart(2, "0"); }

// ---------- Perfiles: nombre, foto y tipo de cada corredor ----------
let perfiles = leer("vuelta-perfiles", null);
if (!Array.isArray(perfiles)) perfiles = [];
perfiles = [0, 1, 2, 3].map(i => perfiles[i] || {});
function guardarPerfiles() { guardar("vuelta-perfiles", perfiles); }
const imagenes = [];
function imagenDe(i) {
  const url = perfiles[i] && perfiles[i].foto;
  if (!url) return null;
  if (!imagenes[i] || imagenes[i].src !== url) { const im = new Image(); im.src = url; imagenes[i] = im; }
  return imagenes[i];
}
function tipoDe(i) { return TIPOS.includes(perfiles[i].tipo) ? perfiles[i].tipo : "persona"; }
function nombreDe(i) {
  const n = perfiles[i] && perfiles[i].nombre;
  if (n && n.trim()) return n.trim();
  return tipoDe(i) === "persona" ? CORREDORES[i].nombre : "Robo " + CORREDORES[i].nombre;
}
function pintarMiniChapa(el, c) {
  el.style.setProperty("--c", c.color);
  if (c.foto) { el.classList.add("con-foto"); el.style.backgroundImage = "url(" + c.foto + ")"; el.textContent = ""; }
  else { el.classList.remove("con-foto"); el.style.backgroundImage = ""; el.textContent = c.dorsal; }
}
function leerFoto(archivo, alTerminar) {
  const lector = new FileReader();
  lector.onload = () => {
    const im = new Image();
    im.onload = () => {
      const lado = 160, cv = document.createElement("canvas");
      cv.width = cv.height = lado;
      const m = Math.min(im.width, im.height);
      cv.getContext("2d").drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, lado, lado);
      alTerminar(cv.toDataURL("image/jpeg", 0.82));
    };
    im.src = lector.result;
  };
  lector.readAsDataURL(archivo);
}
const textoTipo = t => t === "persona" ? "PERSONA" : "MÁQUINA " + NIVELES[t].nombre;

// ---------- Preparar la carrera ----------
let numJug = 2;
let modoFacil = leer("vuelta-facil", false) === true || leer("vuelta-facil", null) === 1;
let eleccion = leer("vuelta-carrera", { modo: "etapa", etapa: 0 });
if (!eleccion || !["etapa", "vuelta"].includes(eleccion.modo)) eleccion = { modo: "etapa", etapa: 0 };
eleccion.etapa = Math.max(0, Math.min(ETAPAS.length - 1, eleccion.etapa | 0));

function abrirPreparar(n) {
  numJug = n;
  const caja = $("fichas");
  caja.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const base = CORREDORES[i];
    const ficha = document.createElement("div");
    ficha.className = "ficha";
    const chapa = document.createElement("div");
    chapa.className = "mini-chapa";
    const entrada = document.createElement("input");
    entrada.type = "text"; entrada.id = "nombre-" + i; entrada.maxLength = 10;
    entrada.value = (perfiles[i] && perfiles[i].nombre) || "";
    entrada.setAttribute("aria-label", "Nombre del corredor " + base.dorsal);
    entrada.addEventListener("input", () => { perfiles[i].nombre = entrada.value; });
    const archivo = document.createElement("input");
    archivo.type = "file"; archivo.accept = "image/*"; archivo.id = "foto-" + i;
    const acciones = document.createElement("div");
    acciones.className = "acciones";
    const bFoto = document.createElement("button");
    bFoto.className = "boton-mini"; bFoto.type = "button"; bFoto.textContent = "FOTO";
    bFoto.addEventListener("click", () => archivo.click());
    const bQuitar = document.createElement("button");
    bQuitar.className = "boton-mini secundario"; bQuitar.type = "button"; bQuitar.textContent = "QUITAR";
    const bTipo = document.createElement("button");
    bTipo.className = "boton-mini tipo"; bTipo.type = "button"; bTipo.id = "tipo-" + i;
    const refrescar = () => {
      pintarMiniChapa(chapa, { color: base.color, dorsal: base.dorsal, foto: perfiles[i].foto });
      bQuitar.hidden = !perfiles[i].foto;
      const t = tipoDe(i);
      bTipo.textContent = textoTipo(t);
      bTipo.classList.toggle("maquina", t !== "persona");
      entrada.placeholder = nombreDe(i) === (perfiles[i].nombre || "").trim() ? base.nombre : nombreDe(i);
    };
    bTipo.addEventListener("click", () => {
      perfiles[i].tipo = TIPOS[(TIPOS.indexOf(tipoDe(i)) + 1) % TIPOS.length];
      refrescar();
    });
    bQuitar.addEventListener("click", () => { delete perfiles[i].foto; refrescar(); });
    archivo.addEventListener("change", () => {
      const f = archivo.files && archivo.files[0];
      if (f) leerFoto(f, url => { perfiles[i].foto = url; refrescar(); });
      archivo.value = "";
    });
    acciones.append(bFoto, bQuitar, bTipo, archivo);
    ficha.append(chapa, entrada, acciones);
    caja.appendChild(ficha);
    refrescar();
  }
  pintarEleccion();
  $("menu").hidden = true;
  $("preparar").hidden = false;
}

function pintarModo() {
  $("b-normal").classList.toggle("activo", !modoFacil);
  $("b-facil").classList.toggle("activo", modoFacil);
  $("b-normal").setAttribute("aria-pressed", String(!modoFacil));
  $("b-facil").setAttribute("aria-pressed", String(modoFacil));
}
function ponerModo(f) {
  if (f === modoFacil) return;
  modoFacil = f;
  guardar("vuelta-facil", f);
  pintarModo();
  medir();
}
function pintarEleccion() {
  $("b-una").classList.toggle("activo", eleccion.modo === "etapa");
  $("b-vuelta").classList.toggle("activo", eleccion.modo === "vuelta");
  $("b-una").setAttribute("aria-pressed", String(eleccion.modo === "etapa"));
  $("b-vuelta").setAttribute("aria-pressed", String(eleccion.modo === "vuelta"));
  $("etapas").hidden = eleccion.modo !== "etapa";
  $("etapas").querySelectorAll("button").forEach((b, i) => {
    b.classList.toggle("activo", i === eleccion.etapa);
    b.setAttribute("aria-pressed", String(i === eleccion.etapa));
  });
}
function montarEtapas() {
  const caja = $("etapas");
  ETAPAS.forEach((e, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "boton-mini etapa"; b.id = "etapa-" + i;
    b.innerHTML = iconoEtapa(e.icono) + "<span></span>";
    b.querySelector("span").textContent = (i + 1) + ". " + e.nombre.toUpperCase();
    b.addEventListener("click", () => { eleccion.etapa = i; guardar("vuelta-carrera", eleccion); pintarEleccion(); });
    caja.appendChild(b);
  });
}
function iconoEtapa(tipo) {
  const p = {
    llana: '<path d="M2 15h20"/><circle cx="7" cy="12" r="2.5"/><circle cx="17" cy="12" r="2.5"/>',
    montana: '<path d="M2 19l7-12 4 6 3-4 6 10z"/>',
    adoquines: '<rect x="3" y="5" width="7" height="5" rx="1"/><rect x="14" y="5" width="7" height="5" rx="1"/><rect x="8" y="14" width="8" height="5" rx="1"/>',
    final: '<path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/>'
  }[tipo];
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
}

// ---------- Cartel (turno y etapa) ----------
let cartelHasta = 0, cartelTimer = null;
function mostrarCartel({ chapa, arriba, nombre, dur = 1100 }) {
  const el = $("cartel");
  const mini = $("cartel-chapa");
  mini.hidden = !chapa;
  if (chapa) pintarMiniChapa(mini, chapa);
  $("cartel-arriba").textContent = arriba;
  $("cartel-nombre").textContent = nombre;
  el.classList.remove("visible"); void el.offsetWidth; el.classList.add("visible");
  cartelHasta = performance.now() + dur - 400;
  clearTimeout(cartelTimer);
  cartelTimer = setTimeout(() => el.classList.remove("visible"), dur);
}
function cartelTurno(c) {
  mostrarCartel({ chapa: c, arriba: c.tipo === "persona" ? "TURNO DE" : "PIENSA", nombre: c.nombre.toUpperCase() });
}

// ---------- Estado de la carrera ----------
let jugadores = [];      // datos fijos de cada corredor durante toda la Vuelta
let carrera = null;      // { modo, etapas: [índices], actual, puntos, montana, tiros }
let chapas = [], turno = 0, fase = "menu", ganador = null, primerTiro = true;
let apunte = null;       // gesto del dedo
let tiroMaquina = null;  // { dx, dy, p, t0 } mientras la máquina apunta
let flotantes = [], confeti = [], ultimoChoque = 0;
let pasadasCima = [];    // cuántas chapas han coronado cada cima en esta etapa

function iniciarCarrera() {
  guardarPerfiles();
  guardar("vuelta-carrera", eleccion);
  jugadores = [];
  for (let i = 0; i < numJug; i++) {
    jugadores.push({ ...CORREDORES[i], i, nombre: nombreDe(i), foto: perfiles[i].foto || null, img: imagenDe(i), tipo: tipoDe(i) });
  }
  const etapas = eleccion.modo === "vuelta" ? ETAPAS.map((_, i) => i) : [eleccion.etapa];
  carrera = { modo: eleccion.modo, etapas, actual: 0, puntos: jugadores.map(() => 0), montana: jugadores.map(() => 0), tiros: jugadores.map(() => 0) };
  empezarEtapa();
}

function empezarEtapa() {
  const etapa = ETAPAS[carrera.etapas[carrera.actual]];
  pista = construirPista(etapa);
  pasadasCima = pista.cimas.map(() => 0);
  const salida = posicionesSalida(pista, jugadores.length);
  chapas = jugadores.map((j, i) => ({ ...j, ...salida[i], vx: 0, vy: 0, guardado: null, fuera: false, meta: false, vuelta: null, tiros: 0, cimas: new Set() }));
  turno = 0; ganador = null; apunte = null; tiroMaquina = null; flotantes = []; confeti = []; tiro = null;
  ["menu", "preparar", "final", "clasif", "privacidad"].forEach(id => { $(id).hidden = true; });
  $("locutor").hidden = true;
  arrancarMusica();
  fase = "apuntar";
  medir();
  pintarTurno();
  moverCamara(true);
  const n = carrera.actual + 1;
  const titulo = carrera.modo === "vuelta" ? "ETAPA " + n + " DE " + carrera.etapas.length : "ETAPA";
  mostrarCartel({ chapa: null, arriba: titulo, nombre: etapa.nombre.toUpperCase(), dur: 1500 });
  setTimeout(() => { if (fase === "apuntar" && chapas.length) { locutor(frasesSalida(etapa)); empezarTurno(); } }, 1450);
}
function frasesSalida(etapa) {
  return {
    llana: "¡Arranca la etapa llana! ¡Mucha suerte!",
    montana: "¡Etapa de montaña! Ojo con las subidas",
    adoquines: "¡Llegan los adoquines y los charcos!",
    final: "¡Gran final! Todo se decide hoy"
  }[etapa.id];
}

// Maillots: amarillo para el líder de la general, lunares para el rey de la montaña
function portadores() {
  let amarillo = null, lunares = null;
  if (carrera && carrera.modo === "vuelta" && carrera.actual > 0) {
    let m = -1;
    carrera.puntos.forEach((p, i) => { if (p > m) { m = p; amarillo = i; } });
  }
  if (carrera) {
    let m = 0;
    carrera.montana.forEach((p, i) => { if (p > m) { m = p; lunares = i; } });
  }
  return { amarillo, lunares };
}

function pintarTurno() {
  const c = chapas[turno];
  pintarMiniChapa($("turno-chapa"), c);
  $("turno-texto").textContent = (c.tipo === "persona" ? "Te toca: " : "Piensa: ") + c.nombre;
  $("pista-ayuda").hidden = !(primerTiro && c.tipo === "persona");
  pintarCarrera();
}
function pintarCarrera() {
  const cont = $("carrera");
  cont.querySelectorAll(".punto").forEach(p => p.remove());
  chapas.forEach((c, i) => {
    const p = document.createElement("div");
    p.className = "punto" + (i === turno && fase !== "fin" ? " activo" : "");
    p.style.setProperty("--c", c.color);
    if (c.foto) { p.classList.add("con-foto"); p.style.backgroundImage = "url(" + c.foto + ")"; }
    p.style.left = Math.max(0, Math.min(100, (c.arco / pista.arcoMeta) * 100)) + "%";
    cont.appendChild(p);
  });
}

function empezarTurno() {
  const c = chapas[turno];
  cartelTurno(c);
  pintarTurno();
  if (c.tipo !== "persona") {
    fase = "maquina";
    const espera = Math.max(0, cartelHasta - performance.now()) + 250;
    setTimeout(() => {
      if (fase !== "maquina" || chapas[turno] !== c) return;
      const t = elegirTiro(chapas, turno, pista, { facil: modoFacil }, c.tipo);
      tiroMaquina = { ...t, t0: performance.now() };
    }, espera);
  } else fase = "apuntar";
}

// ---------- Entrada ----------
function maxArrastre() { return Math.min(cw, ch) * 0.3 + 40; }
function potencia() {
  if (!apunte) return { p: 0, dx: 0, dy: 0 };
  const dx = apunte.sx - apunte.cx, dy = apunte.sy - apunte.cy;
  const p = Math.min(1, Math.hypot(dx, dy) / maxArrastre());
  const [wx, wy] = vecAMundo(dx, dy);
  const wl = Math.hypot(wx, wy) || 1;
  return { p, dx: wx / wl, dy: wy / wl };
}
function posPuntero(e) { const r = lienzo.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
lienzo.addEventListener("pointerdown", e => {
  activarAudio();
  if (fase !== "apuntar" || performance.now() < cartelHasta || chapas[turno].tipo !== "persona") return;
  const [x, y] = posPuntero(e);
  apunte = { sx: x, sy: y, cx: x, cy: y, id: e.pointerId };
  try { lienzo.setPointerCapture(e.pointerId); } catch (err) {}
});
lienzo.addEventListener("pointermove", e => {
  if (!apunte || e.pointerId !== apunte.id) return;
  const [x, y] = posPuntero(e);
  apunte.cx = x; apunte.cy = y;
});
lienzo.addEventListener("pointerup", e => {
  if (!apunte || e.pointerId !== apunte.id) return;
  const { p, dx, dy } = potencia();
  apunte = null;
  if (p < 0.06 || fase !== "apuntar") return;
  primerTiro = false;
  disparar(dx, dy, p);
});
lienzo.addEventListener("pointercancel", () => { apunte = null; });

function disparar(dx, dy, p) {
  const c = chapas[turno];
  chapas.forEach(o => { o.guardado = { x: o.x, y: o.y, idx: o.idx, arco: o.arco }; o.fuera = false; });
  const v = velocidadTiro(p);
  c.vx = dx * v; c.vy = dy * v;
  c.tiros++;
  carrera.tiros[c.i]++;
  tiro = { arcoIni: c.arco, lider: lider(), choque: false, fueraPropio: false, fueraOtro: false };
  fase = "rodando";
  $("pista-ayuda").hidden = true;
  sfx.tiro();
}

// ---------- Física y reglas ----------
function paso() {
  const ev = [];
  const moviendo = pasoFisica(chapas, pista, { facil: modoFacil }, ev);
  const ahora = performance.now();
  for (const e of ev) {
    if (e.tipo === "meta" && !ganador) ganador = e.c;
    else if (e.tipo === "fuera") {
      flotantes.push({ t: "¡FUERA!", x: e.c.x, y: e.c.y, vida: 1, color: "#e5483a" });
      if (tiro) { if (e.c === chapas[turno]) tiro.fueraPropio = true; else tiro.fueraOtro = true; }
      sfx.fuera();
    } else if (e.tipo === "choque") {
      if (tiro) tiro.choque = true;
      if (ahora - ultimoChoque > 60) { sfx.choque(); ultimoChoque = ahora; }
    } else if (e.tipo === "valla") {
      if (tiro) tiro.rebote = true;
      if (e.fuerza > 0.4 && ahora - ultimoChoque > 80) { sfx.valla(); ultimoChoque = ahora; }
    }
  }
  const c = chapas[turno];
  if (tiro && !c.fuera) {
    const t = pista.terreno(c.arco);
    if (t === "adoquines") tiro.adoquines = true;
    if (t === "subida") tiro.subida = true;
    if (t === "bajada") tiro.bajada = true;
    if (pista.charcoEn(c.x, c.y)) tiro.charco = true;
  }
  if (ganador) { terminarEtapa(); return; }
  if (!moviendo) {
    const fuera = chapas.filter(o => o.fuera);
    if (fuera.length) {
      fase = "volviendo";
      fuera.forEach(o => { o.vuelta = { x0: o.x, y0: o.y, t: 0 }; });
    } else finDeTiro();
  }
}
function finDeTiro() {
  const coronado = revisarCimas();
  if (!coronado) comentar(); else tiro = null;
  siguiente();
}
// Premio de la montaña: se puntúa al terminar la tirada por encima de la cima
function revisarCimas() {
  let alguno = false;
  pista.cimas.forEach((cima, k) => {
    const nuevos = chapas.filter(c => !c.fuera && !c.cimas.has(k) && c.arco >= cima.arco).sort((a, b) => b.arco - a.arco);
    for (const c of nuevos) {
      c.cimas.add(k);
      const pts = PUNTOS_CIMA[pasadasCima[k]] || 0;
      pasadasCima[k]++;
      if (!pts) continue;
      carrera.montana[c.i] += pts;
      flotantes.push({ t: "+" + pts + " ▲", x: c.x, y: c.y, vida: 1.4, color: "#f4f0e4" });
      if (pts === PUNTOS_CIMA[0]) { locutor("¡" + c.nombre + " corona la cima en cabeza!"); sfx.cima(); alguno = true; }
    }
  });
  return alguno;
}
function siguiente() {
  turno = (turno + 1) % chapas.length;
  sfx.turno();
  empezarTurno();
}

function terminarEtapa() {
  fase = "fin";
  tiroMaquina = null;
  for (const c of chapas) { c.vx = c.vy = 0; }
  revisarCimas();
  pintarCarrera();
  sfx.meta();
  locutor("¡¡" + ganador.nombre + " gana la etapa!!");
  for (let i = 0; i < 160; i++) {
    confeti.push({
      x: cw * Math.random(), y: -20 - Math.random() * ch * 0.5,
      vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
      c: ["#ffcf3a", "#e5483a", "#35b26a", "#3f7fe6", "#f4f0e4"][i % 5]
    });
  }
  const orden = [ganador, ...chapas.filter(c => c !== ganador).sort((a, b) => b.arco - a.arco)];
  const puntosEtapa = jugadores.map(() => 0);
  orden.forEach((c, pos) => { puntosEtapa[c.i] = PUNTOS_ETAPA[pos] || 0; carrera.puntos[c.i] += puntosEtapa[c.i]; });
  // récord de la etapa (solo para personas)
  const etapa = pista.etapa;
  let nuevoRecord = false;
  if (ganador.tipo === "persona") {
    const rec = leerRecord(etapa.id);
    if (rec === null || ganador.tiros < rec) { guardar(claveRecord(etapa.id), ganador.tiros); nuevoRecord = true; }
  }
  pintarRecord();
  const ultima = carrera.actual >= carrera.etapas.length - 1;
  setTimeout(() => {
    if (carrera.modo === "vuelta") mostrarClasificacion(orden, puntosEtapa, ultima);
    else mostrarFinal(orden, { titulo: "¡GANA " + ganador.nombre.toUpperCase() + "!", sub: "en " + ganador.tiros + (ganador.tiros === 1 ? " tiro" : " tiros"), record: nuevoRecord });
  }, 1600);
}

function ordenGeneral() {
  return jugadores.map(j => j).sort((a, b) => (carrera.puntos[b.i] - carrera.puntos[a.i]) || (carrera.tiros[a.i] - carrera.tiros[b.i]));
}
function reyMontana() {
  let rey = null, m = 0;
  jugadores.forEach(j => { if (carrera.montana[j.i] > m) { m = carrera.montana[j.i]; rey = j; } });
  return rey;
}

function mostrarClasificacion(ordenEtapa, puntosEtapa, ultima) {
  const etapa = pista.etapa;
  $("clasif-etapa").textContent = "ETAPA " + (carrera.actual + 1) + " · " + etapa.nombre.toUpperCase();
  $("clasif-titulo").textContent = "¡GANA " + ordenEtapa[0].nombre.toUpperCase() + "!";
  const tabla = $("clasif-tabla");
  tabla.innerHTML = "";
  const cab = document.createElement("tr");
  ["", "", "CORREDOR", "ETAPA", "TOTAL", ""].forEach(t => { const th = document.createElement("th"); th.textContent = t; cab.appendChild(th); });
  tabla.appendChild(cab);
  carrera.actual++;   // los maillots ya cuentan la etapa terminada
  const { amarillo, lunares } = portadores();
  carrera.actual--;
  ordenGeneral().forEach((j, pos) => {
    const tr = document.createElement("tr");
    const tdPos = document.createElement("td"); tdPos.textContent = String(pos + 1); tdPos.className = "pos";
    const tdChapa = document.createElement("td");
    const mini = document.createElement("div"); mini.className = "mini-chapa"; pintarMiniChapa(mini, j); tdChapa.appendChild(mini);
    const tdNombre = document.createElement("td"); tdNombre.textContent = j.nombre; tdNombre.className = "nombre";
    const tdEtapa = document.createElement("td"); tdEtapa.textContent = "+" + puntosEtapa[j.i];
    const tdTotal = document.createElement("td"); tdTotal.textContent = String(carrera.puntos[j.i]); tdTotal.className = "total";
    const tdMaillot = document.createElement("td");
    if (j.i === amarillo) tdMaillot.appendChild(maillot("amarillo", "Líder de la general"));
    if (j.i === lunares) tdMaillot.appendChild(maillot("lunares", "Rey de la montaña"));
    tr.append(tdPos, tdChapa, tdNombre, tdEtapa, tdTotal, tdMaillot);
    tabla.appendChild(tr);
  });
  $("b-seguir").textContent = ultima ? "VER PODIO" : "SIGUIENTE ETAPA";
  $("clasif").hidden = false;
}
function maillot(tipo, titulo) {
  const s = document.createElement("span");
  s.className = "maillot " + tipo; s.title = titulo; s.setAttribute("aria-label", titulo);
  return s;
}
function seguirVuelta() {
  $("clasif").hidden = true;
  if (carrera.actual >= carrera.etapas.length - 1) {
    const orden = ordenGeneral();
    const rey = reyMontana();
    mostrarFinal(orden, {
      titulo: "¡" + orden[0].nombre.toUpperCase() + " GANA LA VUELTA!",
      sub: rey ? "Rey de la montaña: " + rey.nombre : "",
      record: false
    });
  } else {
    carrera.actual++;
    empezarEtapa();
  }
}

function mostrarFinal(orden, { titulo, sub, record }) {
  const podio = $("podio");
  podio.innerHTML = "";
  const top = orden.slice(0, 3);
  const clases = ["primero", "segundo", "tercero"];
  const colocacion = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
  colocacion.forEach(i => {
    const c = top[i];
    const puesto = document.createElement("div");
    puesto.className = "puesto " + clases[i];
    const chapa = document.createElement("div");
    chapa.className = "mini-chapa";
    pintarMiniChapa(chapa, c);
    const nombre = document.createElement("div");
    nombre.className = "nombre"; nombre.textContent = c.nombre;
    const cajon = document.createElement("div");
    cajon.className = "cajon"; cajon.textContent = String(i + 1);
    puesto.append(chapa, nombre, cajon);
    podio.appendChild(puesto);
  });
  $("ganador-texto").textContent = titulo;
  $("ganador-tiros").textContent = sub;
  $("ganador-tiros").hidden = !sub;
  $("nuevo-record").hidden = !record;
  $("final").hidden = false;
}

// ---------- Dibujo ----------
function dibujarChapa(c, alfa, resalte, jerseys) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(c.x, c.y);
  ctx.fillStyle = "rgba(10,12,18,0.45)";
  ctx.beginPath(); ctx.arc(2.5, 3.5, R, 0, 6.283); ctx.fill();
  // maillots: aro amarillo y aro de lunares alrededor de la chapa
  let aro = R + 3.5;
  if (jerseys.amarillo === c.i) {
    ctx.strokeStyle = "#ffcf3a"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, aro, 0, 6.283); ctx.stroke();
    aro += 4.5;
  }
  if (jerseys.lunares === c.i) {
    ctx.strokeStyle = "#f4f0e4"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, aro, 0, 6.283); ctx.stroke();
    ctx.fillStyle = "#e5483a";
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; ctx.beginPath(); ctx.arc(Math.cos(a) * aro, Math.sin(a) * aro, 1.6, 0, 6.283); ctx.fill(); }
  }
  // corona de 21 dientes
  ctx.beginPath();
  for (let k = 0; k < 42; k++) {
    const a = k / 42 * 6.283, rr = k % 2 ? R * 0.9 : R;
    k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(rr, 0);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, R);
  g.addColorStop(0, "#f2f4f7"); g.addColorStop(1, "#8d949f");
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = "#5d636d"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = c.color;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.74, 0, 6.283); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.arc(0, 0, R * 0.46, 0, 6.283); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath(); ctx.ellipse(-R * 0.25, -R * 0.3, R * 0.38, R * 0.2, -0.6, 0, 6.283); ctx.fill();
  if (resalte) {
    const t = performance.now() / 300;
    ctx.strokeStyle = c.color; ctx.lineWidth = 2.5;
    ctx.globalAlpha = alfa * (0.5 + 0.4 * Math.sin(t));
    ctx.beginPath(); ctx.arc(0, 0, aro + 5 + 2 * Math.sin(t), 0, 6.283); ctx.stroke();
  }
  ctx.restore();
}
// dorsal o foto, en pantalla para que nunca salgan en espejo
function dorsal(c, alfa) {
  const [sx, sy] = aPantalla(c.x, c.y);
  if (c.img && c.img.complete && c.img.naturalWidth) {
    const r = R * 0.64 * esc;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.clip();
    ctx.drawImage(c.img, sx - r, sy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.ellipse(sx - r * 0.35, sy - r * 0.45, r * 0.5, r * 0.25, -0.6, 0, 6.283); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.globalAlpha = alfa;
  ctx.fillStyle = "#1d1f24";
  ctx.font = "800 " + Math.max(9, R * 0.62 * esc) + "px " + getComputedStyle(document.documentElement).getPropertyValue("--f-ui");
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(c.dorsal, sx, sy + 1);
  ctx.globalAlpha = 1;
}

// la primera vez, una mano enseña el gesto: tirar hacia atrás y soltar
function dibujarManita(c) {
  const i = Math.max(0, Math.min(pista.N - 2, c.idx));
  const tx = pista.NY[i], ty = -pista.NX[i];
  const t = (performance.now() % 1800) / 1800;
  const tira = t < 0.6 ? t / 0.6 : 1;
  const suelta = t >= 0.6 && t < 0.75;
  const d = R + 10 + tira * 70;
  const hx = c.x - tx * d, hy = c.y - ty * d;
  transfMundo(ctx);
  if (t < 0.6) {
    const largo = 30 + tira * 110;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#f4f0e4"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.setLineDash([2, 10]);
    ctx.beginPath(); ctx.moveTo(c.x + tx * (R + 4), c.y + ty * (R + 4)); ctx.lineTo(c.x + tx * largo, c.y + ty * largo); ctx.stroke();
    ctx.restore();
  }
  transfPantalla(ctx);
  const [sx, sy] = aPantalla(hx, hy);
  const tam = Math.max(34, R * 2.6 * esc);
  ctx.save();
  ctx.globalAlpha = suelta ? 0.4 : 0.95;
  if (suelta) {
    ctx.strokeStyle = "#ffcf3a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy, tam * (0.4 + (t - 0.6) * 4), 0, 6.283); ctx.stroke();
  }
  const u = tam / 10;
  const redondo = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
  ctx.translate(sx, sy);
  ctx.fillStyle = "#f4f0e4"; ctx.strokeStyle = "#1d1f24"; ctx.lineWidth = Math.max(2, u * 0.45);
  redondo(-1.3 * u, -1.2 * u, 2.6 * u, 6 * u, 1.3 * u); ctx.fill(); ctx.stroke();
  redondo(1.1 * u, 2.4 * u, 2.2 * u, 3.6 * u, 1.1 * u); ctx.fill(); ctx.stroke();
  redondo(3.0 * u, 3.0 * u, 2.0 * u, 3.2 * u, 1.0 * u); ctx.fill(); ctx.stroke();
  redondo(-3.4 * u, 3.6 * u, 2.4 * u, 2.2 * u, 1.1 * u); ctx.fill(); ctx.stroke();
  redondo(-1.6 * u, 4.4 * u, 6.4 * u, 4.6 * u, 1.8 * u); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function dibujarFlecha(c, p, dx, dy) {
  if (p < 0.02) return;
  const largo = 30 + p * 150;
  const col = p < 0.45 ? "#35b26a" : p < 0.8 ? "#ffcf3a" : "#e5483a";
  ctx.save();
  ctx.lineCap = "round";
  ctx.fillStyle = "rgba(244,240,228,0.5)";
  for (let d = R + 10; d < largo; d += 12) {
    ctx.beginPath(); ctx.arc(c.x + dx * d, c.y + dy * d, 2.2, 0, 6.283); ctx.fill();
  }
  const ex = c.x + dx * (largo + 8), ey = c.y + dy * (largo + 8);
  ctx.strokeStyle = col; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(c.x + dx * (R + 4), c.y + dy * (R + 4)); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(ex + dx * 14, ey + dy * 14);
  ctx.lineTo(ex - dy * 10, ey + dx * 10);
  ctx.lineTo(ex + dy * 10, ey - dx * 10);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function dibujar() {
  moverCamara(false);
  transfPantalla(ctx);
  ctx.fillStyle = "#39404c";
  ctx.fillRect(0, 0, cw, ch);
  const f = esc / escFondo;
  ctx.drawImage(fondo, ox - MARGEN * esc, oy - MARGEN * esc, fondoW * f, fondoH * f);
  if (!chapas.length) return;
  transfMundo(ctx);
  const act = chapas[turno];
  if (fase === "apuntar" && apunte) { const a = potencia(); dibujarFlecha(act, a.p, a.dx, a.dy); }
  if (fase === "maquina" && tiroMaquina) {
    const k = Math.min(1, (performance.now() - tiroMaquina.t0) / 700);
    dibujarFlecha(act, tiroMaquina.p * k, tiroMaquina.dx, tiroMaquina.dy);
  }
  const jerseys = portadores();
  chapas.forEach((c, i) => { if (i !== turno) dibujarChapa(c, c.fuera ? 0.5 : 1, false, jerseys); });
  dibujarChapa(act, act.fuera ? 0.5 : 1, fase === "apuntar" || fase === "maquina", jerseys);
  if (primerTiro && fase === "apuntar" && act.tipo === "persona" && !apunte && performance.now() > cartelHasta) dibujarManita(act);
  transfPantalla(ctx);
  chapas.forEach(c => dorsal(c, c.fuera ? 0.5 : 1));
  ctx.font = "18px " + getComputedStyle(document.documentElement).getPropertyValue("--f-arcade");
  ctx.textAlign = "center";
  flotantes.forEach(fl => {
    const [fx, fy] = aPantalla(fl.x, fl.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, fl.vida));
    ctx.fillStyle = fl.color; ctx.strokeStyle = fl.color === "#f4f0e4" ? "#e5483a" : "#f4f0e4"; ctx.lineWidth = 4;
    const y = fy - 30 - (1 - fl.vida) * 30;
    ctx.strokeText(fl.t, fx, y);
    ctx.fillText(fl.t, fx, y);
  });
  ctx.globalAlpha = 1;
  confeti.forEach(p => {
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x / 4) * 4, Math.round(p.y / 4) * 4, 8, 8);
  });
}

function actualizar() {
  if (fase === "maquina" && tiroMaquina && performance.now() - tiroMaquina.t0 > 900) {
    const t = tiroMaquina;
    tiroMaquina = null;
    disparar(t.dx, t.dy, t.p);
  }
  if (fase === "rodando") paso();
  if (fase === "volviendo") {
    let listos = true;
    chapas.forEach(c => {
      if (!c.vuelta) return;
      c.vuelta.t = Math.min(1, c.vuelta.t + 1 / 30);
      const t = c.vuelta.t, e = t * t * (3 - 2 * t);
      c.x = c.vuelta.x0 + (c.guardado.x - c.vuelta.x0) * e;
      c.y = c.vuelta.y0 + (c.guardado.y - c.vuelta.y0) * e;
      if (t < 1) listos = false;
      else { c.idx = c.guardado.idx; c.arco = c.guardado.arco; c.fuera = false; c.vuelta = null; }
    });
    if (listos) finDeTiro();
  }
  flotantes.forEach(f => f.vida -= 0.016);
  flotantes = flotantes.filter(f => f.vida > 0);
  confeti.forEach(p => { p.x += p.vx; p.y += p.vy; });
  confeti = confeti.filter(p => p.y < ch + 30);
  if (fase === "rodando") pintarCarreraSuave();
}
let ultimaBarra = 0;
function pintarCarreraSuave() {
  const ahora = performance.now();
  if (ahora - ultimaBarra < 250) return;
  ultimaBarra = ahora;
  const puntos = document.querySelectorAll("#carrera .punto");
  chapas.forEach((c, i) => { if (puntos[i]) puntos[i].style.left = Math.max(0, Math.min(100, (c.arco / pista.arcoMeta) * 100)) + "%"; });
}

let previo = performance.now(), acum = 0;
function bucle(t) {
  acum += Math.min(100, t - previo); previo = t;
  while (acum >= 1000 / 60) { actualizar(); acum -= 1000 / 60; }
  dibujar();
  requestAnimationFrame(bucle);
}

// ---------- Menús ----------
const opciones = $("opciones");
[2, 3, 4].forEach(n => {
  const b = document.createElement("button");
  b.className = "boton";
  b.id = "b-jug-" + n;
  const fila = CORREDORES.slice(0, n).map(c => '<i style="--c:' + c.color + '"></i>').join("");
  b.innerHTML = "<span>" + n + '</span><span class="fila">' + fila + "</span>";
  b.setAttribute("aria-label", n + " corredores");
  b.addEventListener("click", () => { activarAudio(); abrirPreparar(n); });
  opciones.appendChild(b);
});
{
  const b = document.createElement("button");
  b.className = "boton";
  b.id = "b-jug-maquina";
  b.innerHTML = '<span>1</span><span class="fila"><i style="--c:#ffcf3a"></i><b class="vs">VS</b><i class="robot" style="--c:#e5483a"></i></span>';
  b.setAttribute("aria-label", "Un jugador contra la máquina");
  b.addEventListener("click", () => {
    activarAudio();
    perfiles[0].tipo = "persona";
    if (tipoDe(1) === "persona") perfiles[1].tipo = "media";
    abrirPreparar(2);
  });
  opciones.appendChild(b);
}
montarEtapas();
$("b-una").addEventListener("click", () => { eleccion.modo = "etapa"; guardar("vuelta-carrera", eleccion); pintarEleccion(); });
$("b-vuelta").addEventListener("click", () => { eleccion.modo = "vuelta"; guardar("vuelta-carrera", eleccion); pintarEleccion(); });
$("b-correr").addEventListener("click", () => { activarAudio(); iniciarCarrera(); });
$("b-normal").addEventListener("click", () => ponerModo(false));
$("b-facil").addEventListener("click", () => ponerModo(true));
pintarModo();
$("b-seguir").addEventListener("click", () => { activarAudio(); seguirVuelta(); });
$("b-clasif-menu").addEventListener("click", () => irAlMenu());

// ---------- Privacidad ----------
let privDesde = null;
function abrirPrivacidad(desde) {
  privDesde = desde;
  $("priv-borrado").hidden = true;
  $(desde).hidden = true;
  $("privacidad").hidden = false;
}
$("b-priv-menu").addEventListener("click", () => abrirPrivacidad("menu"));
$("b-priv-preparar").addEventListener("click", () => { guardarPerfiles(); abrirPrivacidad("preparar"); });
$("b-priv-cerrar").addEventListener("click", () => {
  $("privacidad").hidden = true;
  if (privDesde === "preparar") abrirPreparar(numJug);
  else $(privDesde || "menu").hidden = false;
});
$("b-priv-borrar").addEventListener("click", () => {
  try {
    Object.keys(localStorage).filter(k => k.startsWith("vuelta-")).forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  perfiles = [{}, {}, {}, {}];
  imagenes.length = 0;
  eleccion = { modo: "etapa", etapa: 0 };
  if (modoFacil) { modoFacil = false; pintarModo(); medir(); }
  pintarRecord();
  $("priv-borrado").hidden = false;
});

function irAlMenu() {
  ["final", "clasif", "preparar"].forEach(id => { $(id).hidden = true; });
  $("menu").hidden = false;
  fase = "menu";
  tiroMaquina = null;
}
$("b-volver").addEventListener("click", () => { guardarPerfiles(); irAlMenu(); });
$("b-vista").addEventListener("click", () => {
  verTodo = !verTodo;
  $("vista-fuera").hidden = verTodo;
  $("vista-dentro").hidden = !verTodo;
  $("b-vista").setAttribute("aria-label", verTodo ? "Seguir a la chapa" : "Ver todo el circuito");
});
$("b-otra").addEventListener("click", () => { activarAudio(); iniciarCarrera(); });
$("b-menu").addEventListener("click", irAlMenu);
$("b-reiniciar").addEventListener("click", () => { activarAudio(); if (carrera) iniciarCarrera(); });
$("b-sonido").addEventListener("click", () => {
  activarAudio();
  const on = alternarSonido();
  $("onda").hidden = !on;
  $("mute").hidden = on;
});

// ---------- Arranque ----------
pintarRecord();
new ResizeObserver(medir).observe(lienzo);
medir();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
requestAnimationFrame(bucle);

// ganchos para las pruebas automáticas
window.__vuelta = {
  estado: () => ({ fase, turno, esc, hayZoom, modoFacil, etapa: pista.etapa.id, carrera: carrera && { ...carrera }, haySonido: haySonido() }),
  colocar(i, arco) {
    const c = chapas[i], [x, y] = pista.enArco(arco, 0), k = pista.cercano(x, y, Math.round(arco / PASO), 30);
    c.x = x; c.y = y; c.idx = k.idx; c.arco = k.arco;
  },
  arcoMeta: () => pista.arcoMeta,
  // tiro recto por la carretera, sin depender de la pantalla
  tirarRecto(p) {
    if (fase !== "apuntar") return false;
    const c = chapas[turno], i = Math.max(0, Math.min(pista.N - 2, c.idx));
    primerTiro = false;
    disparar(pista.NY[i], -pista.NX[i], p);
    return true;
  },
  cimas: () => pista.cimas.map(c => c.arco)
};
