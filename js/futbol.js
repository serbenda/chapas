// Fútbol de chapas: campo, física con balón y la máquina. Módulo puro (sin DOM).

import { R } from "./circuito.js";
import { velocidadTiro } from "./fisica.js";

// ---------- Campo (mismo mundo de 1000 × 620) ----------
export const CAMPO = { x0: 60, x1: 940, y0: 60, y1: 560, gy0: 250, gy1: 370, fondo: 40 };
export const RB = 10;                 // radio del balón
export const MASA_CHAPA = 1, MASA_BALON = 0.5;
export const FRIC_CHAPA = 0.972, FRIC_BALON = 0.982;
const SUB = 4, PARADA = 0.06, REBOTE_PARED = 0.7, REBOTE_CUERPOS = 0.85, R_POSTE = 4;

// Paredes del campo: bordillo con hueco en las porterías y la red detrás
const { x0, x1, y0, y1, gy0, gy1, fondo } = CAMPO;
export const PAREDES = [
  [x0, y0, x1, y0], [x0, y1, x1, y1],
  [x0, y0, x0, gy0], [x0, gy1, x0, y1],
  [x0, gy0, x0 - fondo, gy0], [x0 - fondo, gy0, x0 - fondo, gy1], [x0 - fondo, gy1, x0, gy1],
  [x1, y0, x1, gy0], [x1, gy1, x1, y1],
  [x1, gy0, x1 + fondo, gy0], [x1 + fondo, gy0, x1 + fondo, gy1], [x1 + fondo, gy1, x1, gy1]
];
export const POSTES = [[x0, gy0], [x0, gy1], [x1, gy0], [x1, gy1]];

// Equipo 0 juega a la izquierda y ataca la portería derecha; el 1, al revés.
const FORMACION = [[100, 310], [235, 185], [235, 435], [395, 310]];   // portero, defensas, delantero
export function porteriaRival(equipo) { return equipo === 0 ? [x1 + fondo / 2, (gy0 + gy1) / 2] : [x0 - fondo / 2, (gy0 + gy1) / 2]; }
export function porteriaPropia(equipo) { return porteriaRival(1 - equipo); }

export function crearPartido() {
  const cuerpos = [];
  for (const equipo of [0, 1]) {
    FORMACION.forEach(([x, y], n) => {
      cuerpos.push({ tipo: "chapa", equipo, n, x: equipo ? 1000 - x : x, y, vx: 0, vy: 0, r: R, m: MASA_CHAPA });
    });
  }
  cuerpos.push({ tipo: "balon", x: 500, y: 310, vx: 0, vy: 0, r: RB, m: MASA_BALON });
  return cuerpos;
}
export function colocarSaque(cuerpos) {
  const nuevo = crearPartido();
  cuerpos.forEach((c, i) => Object.assign(c, { x: nuevo[i].x, y: nuevo[i].y, vx: 0, vy: 0 }));
}
export const balonDe = cuerpos => cuerpos[cuerpos.length - 1];

function choquePared(c, ax, ay, bx, by, ev) {
  const ex = bx - ax, ey = by - ay;
  let t = ((c.x - ax) * ex + (c.y - ay) * ey) / (ex * ex + ey * ey);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + ex * t, qy = ay + ey * t;
  let nx = c.x - qx, ny = c.y - qy;
  const d = Math.hypot(nx, ny);
  if (d >= c.r || d === 0) return;
  nx /= d; ny /= d;
  c.x = qx + nx * c.r; c.y = qy + ny * c.r;
  const vn = c.vx * nx + c.vy * ny;
  if (vn < 0) {
    c.vx -= (1 + REBOTE_PARED) * vn * nx; c.vy -= (1 + REBOTE_PARED) * vn * ny;
    if (-vn > 0.5) ev.push({ tipo: "pared", c, fuerza: -vn });
  }
}
function chocePoste(c, px, py, ev) {
  let nx = c.x - px, ny = c.y - py;
  const d = Math.hypot(nx, ny), min = c.r + R_POSTE;
  if (d >= min || d === 0) return;
  nx /= d; ny /= d;
  c.x = px + nx * min; c.y = py + ny * min;
  const vn = c.vx * nx + c.vy * ny;
  if (vn < 0) {
    c.vx -= (1 + REBOTE_PARED) * vn * nx; c.vy -= (1 + REBOTE_PARED) * vn * ny;
    if (c.tipo === "balon" && -vn > 0.5) ev.push({ tipo: "palo", c });
  }
}

/**
 * Avanza un fotograma. Eventos: gol {equipo que marca}, palo, toque {c: chapa que toca el balón}, choque, pared.
 * @returns true si algo sigue moviéndose
 */
export function pasoFutbol(cuerpos, ev) {
  const balon = balonDe(cuerpos);
  for (let s = 0; s < SUB; s++) {
    for (const c of cuerpos) {
      if (c.vx === 0 && c.vy === 0) continue;
      c.x += c.vx / SUB; c.y += c.vy / SUB;
      for (const [ax, ay, bx, by] of PAREDES) choquePared(c, ax, ay, bx, by, ev);
      for (const [px, py] of POSTES) chocePoste(c, px, py, ev);
    }
    for (let i = 0; i < cuerpos.length; i++) for (let j = i + 1; j < cuerpos.length; j++) {
      const a = cuerpos[i], b = cuerpos[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d === 0 || d >= min) continue;
      const nx = dx / d, ny = dy / d, solape = min - d, ma = a.m, mb = b.m;
      a.x -= nx * solape * mb / (ma + mb); a.y -= ny * solape * mb / (ma + mb);
      b.x += nx * solape * ma / (ma + mb); b.y += ny * solape * ma / (ma + mb);
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel <= 0) continue;
      const j2 = (1 + REBOTE_CUERPOS) * rel / (1 / ma + 1 / mb);
      a.vx -= j2 / ma * nx; a.vy -= j2 / ma * ny;
      b.vx += j2 / mb * nx; b.vy += j2 / mb * ny;
      if (a.tipo === "balon" || b.tipo === "balon") ev.push({ tipo: "toque", c: a.tipo === "balon" ? b : a, fuerza: rel });
      else ev.push({ tipo: "choque", c: a, b, fuerza: rel });
    }
    // gol: el balón ha cruzado entero la línea entre los postes
    if (balon.y > gy0 && balon.y < gy1) {
      if (balon.x + RB < x0) { ev.push({ tipo: "gol", equipo: 1 }); return false; }
      if (balon.x - RB > x1) { ev.push({ tipo: "gol", equipo: 0 }); return false; }
    }
  }
  let moviendo = false;
  for (const c of cuerpos) {
    if (c.vx === 0 && c.vy === 0) continue;
    const f = c.tipo === "balon" ? FRIC_BALON : FRIC_CHAPA;
    c.vx *= f; c.vy *= f;
    if (Math.hypot(c.vx, c.vy) < PARADA) { c.vx = c.vy = 0; } else moviendo = true;
  }
  return moviendo;
}

export function simularFutbol(cuerpos, maxFotogramas = 1500) {
  const copia = cuerpos.map(c => ({ ...c }));
  const eventos = [];
  let f = 0;
  while (f++ < maxFotogramas) {
    const ev = [];
    const sigue = pasoFutbol(copia, ev);
    eventos.push(...ev);
    if (ev.some(e => e.tipo === "gol") || !sigue) break;
  }
  return { cuerpos: copia, eventos, fotogramas: f };
}

// ---------- La máquina ----------
export const NIVELES_FUTBOL = {
  facil: { angulos: 5, potencias: 3, ruidoAng: 0.22, ruidoPot: 0.3 },
  media: { angulos: 7, potencias: 4, ruidoAng: 0.08, ruidoPot: 0.12 },
  dificil: { angulos: 9, potencias: 5, ruidoAng: 0.02, ruidoPot: 0.04 }
};
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function puntuarFutbol(sim, equipo, antes) {
  const gol = sim.eventos.find(e => e.tipo === "gol");
  if (gol) return gol.equipo === equipo ? 1e6 : -1e6;
  const b = balonDe(sim.cuerpos), [gx, gy] = porteriaRival(equipo), [px, py] = porteriaPropia(equipo);
  const avance = Math.hypot(antes.x - gx, antes.y - gy) - Math.hypot(b.x - gx, b.y - gy);
  const peligro = Math.max(0, 260 - Math.hypot(b.x - px, b.y - py));   // no dejarla cerca de casa
  const toca = sim.eventos.some(e => e.tipo === "toque") ? 0 : -60;
  return avance - peligro * 1.5 + toca;
}
/**
 * Elige qué chapa tirar y cómo.
 * @returns {{indice:number, dx:number, dy:number, p:number}}
 */
export function elegirTiroFutbol(cuerpos, equipo, nivel = "media", rng = Math.random) {
  const N = NIVELES_FUTBOL[nivel] || NIVELES_FUTBOL.media;
  const b = balonDe(cuerpos), [gx, gy] = porteriaRival(equipo);
  // golpear el balón por detrás, en línea con la portería rival
  let ux = gx - b.x, uy = gy - b.y;
  const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const contactoX = b.x - ux * (R + RB) * 0.9, contactoY = b.y - uy * (R + RB) * 0.9;
  const antes = { x: b.x, y: b.y };
  const candidatos = [];
  cuerpos.forEach((c, indice) => {
    if (c.tipo !== "chapa" || c.equipo !== equipo) return;
    const base = Math.atan2(contactoY - c.y, contactoX - c.x);
    for (let a = 0; a < N.angulos; a++) {
      const ang = base + (a / Math.max(1, N.angulos - 1) - 0.5) * 0.5;
      for (let k = 0; k < N.potencias; k++) {
        const p = 0.3 + 0.7 * (k + 1) / N.potencias;
        const v = velocidadTiro(p);
        const prueba = cuerpos.map((o, j) => j === indice ? { ...o, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v } : { ...o, vx: 0, vy: 0 });
        candidatos.push({ indice, ang, p, score: puntuarFutbol(simularFutbol(prueba), equipo, antes) });
      }
    }
  });
  candidatos.sort((x, y) => y.score - x.score);
  // de los mejores, el más seguro: el que sigue saliendo bien aunque el pulso tiemble
  const probar = (c, ang, p) => {
    const v = velocidadTiro(p);
    const prueba = cuerpos.map((o, j) => j === c.indice ? { ...o, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v } : { ...o, vx: 0, vy: 0 });
    return puntuarFutbol(simularFutbol(prueba), equipo, antes);
  };
  let mejor = candidatos[0], mejorSeguro = -Infinity;
  for (const c of candidatos.slice(0, 5)) {
    const temblor = Math.max(0.03, N.ruidoAng);
    const pruebas = [c.score, probar(c, c.ang + temblor, c.p), probar(c, c.ang - temblor, c.p), probar(c, c.ang, Math.min(1, c.p * 1.08)), probar(c, c.ang, c.p * 0.92)];
    pruebas.sort((x, y) => x - y);
    const seguro = (pruebas[0] + pruebas[1] + pruebas[2]) / 3;   // media de los tres peores
    if (seguro > mejorSeguro) { mejorSeguro = seguro; mejor = c; }
  }
  const ang = mejor.ang + gauss(rng) * N.ruidoAng;
  const p = Math.max(0.15, Math.min(1, mejor.p * (1 + gauss(rng) * N.ruidoPot)));
  return { indice: mejor.indice, dx: Math.cos(ang), dy: Math.sin(ang), p };
}
