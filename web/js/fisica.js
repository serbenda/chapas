// Física de las chapas. Módulo puro: mueve chapas sobre una pista y devuelve eventos.

import { R, TW } from "./circuito.js";

export const VMAX = 12.5;     // velocidad de un tiro a tope (unidades por fotograma)
export const FRIC = 0.972;    // rozamiento normal por fotograma
export const SUB = 4;         // subpasos por fotograma, para que no se atraviesen
export const PARADA = 0.06;   // por debajo de esta velocidad la chapa se para

// rozamiento según el terreno (cuanto más bajo, más frena)
export const ROZAMIENTO = { subida: 0.952, bajada: 0.985, adoquines: 0.962 };
export const ROZ_CHARCO = 0.99;

export function velocidadTiro(p) { return VMAX * (0.12 + 0.88 * p); }

// Distancia de la valla al eje en modo fácil
export const LIM_VALLA = TW / 2 - R * 0.55;

/**
 * Avanza un fotograma.
 * @param chapas  [{x, y, vx, vy, idx, arco, fuera}]
 * @param pista   resultado de construirPista()
 * @param opc     { facil: boolean, rng: () => number }
 * @param ev      array donde se añaden eventos { tipo: "fuera"|"choque"|"valla"|"meta", c, b?, fuerza? }
 * @returns true si alguna chapa sigue moviéndose
 */
export function pasoFisica(chapas, pista, opc, ev) {
  const rng = opc.rng || Math.random;
  for (let s = 0; s < SUB; s++) {
    for (const c of chapas) {
      if (c.fuera || (c.vx === 0 && c.vy === 0)) continue;
      c.x += c.vx / SUB; c.y += c.vy / SUB;
      const k = pista.cercano(c.x, c.y, c.idx, 14);
      c.idx = k.idx; c.arco = k.arco;
      if (k.arco >= pista.arcoMeta && !c.meta) { c.meta = true; ev.push({ tipo: "meta", c }); }
      if (c.meta) continue;
      if (opc.facil && k.dist > LIM_VALLA) {
        const [qx, qy] = pista.enArco(k.arco, 0);
        let nx = c.x - qx, ny = c.y - qy;
        const d = Math.hypot(nx, ny) || 1;
        nx /= d; ny /= d;
        c.x = qx + nx * LIM_VALLA; c.y = qy + ny * LIM_VALLA;
        const vn = c.vx * nx + c.vy * ny;
        if (vn > 0) {
          c.vx -= 1.7 * vn * nx; c.vy -= 1.7 * vn * ny;
          ev.push({ tipo: "valla", c, fuerza: vn });
        }
      } else if (k.dist > TW / 2) {
        c.fuera = true; c.vx = c.vy = 0;
        ev.push({ tipo: "fuera", c });
      }
    }
    // choques elásticos entre chapas de igual masa
    for (let i = 0; i < chapas.length; i++) for (let j = i + 1; j < chapas.length; j++) {
      const a = chapas[i], b = chapas[j];
      if (a.fuera || b.fuera) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 2 * R) {
        const nx = dx / d, ny = dy / d, solape = 2 * R - d;
        a.x -= nx * solape / 2; a.y -= ny * solape / 2;
        b.x += nx * solape / 2; b.y += ny * solape / 2;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) {
          const imp = rel * 0.92;
          a.vx -= imp * nx; a.vy -= imp * ny;
          b.vx += imp * nx; b.vy += imp * ny;
          ev.push({ tipo: "choque", c: a, b, fuerza: rel });
        }
      }
    }
  }
  let moviendo = false;
  for (const c of chapas) {
    if (c.fuera) continue;
    const vel = Math.hypot(c.vx, c.vy);
    if (vel === 0) continue;
    let f = FRIC;
    const terreno = pista.terreno(c.arco);
    if (terreno) f = ROZAMIENTO[terreno];
    const charco = pista.charcoEn(c.x, c.y);
    if (charco) {
      // aquaplaning: frena poco pero la chapa se va girando
      f = ROZ_CHARCO;
      rotar(c, 0.035 * charco.giro);
    } else if (terreno === "adoquines" && vel > 0.8) {
      rotar(c, (rng() - 0.5) * 0.12);   // los adoquines la hacen bailar
    }
    c.vx *= f; c.vy *= f;
    if (Math.hypot(c.vx, c.vy) < PARADA) { c.vx = c.vy = 0; } else moviendo = true;
  }
  return moviendo;
}

function rotar(c, ang) {
  const co = Math.cos(ang), si = Math.sin(ang);
  const vx = c.vx * co - c.vy * si, vy = c.vx * si + c.vy * co;
  c.vx = vx; c.vy = vy;
}

export function clonarChapas(chapas) {
  return chapas.map(c => ({ x: c.x, y: c.y, vx: c.vx, vy: c.vy, idx: c.idx, arco: c.arco, fuera: c.fuera, meta: c.meta }));
}

// Simula un tiro completo sin tocar el estado real (para la máquina y para los tests)
export function simular(chapas, pista, opc, maxFotogramas = 1200) {
  const copia = clonarChapas(chapas);
  const eventos = [];
  let f = 0;
  while (f++ < maxFotogramas) {
    const ev = [];
    const sigue = pasoFisica(copia, pista, opc, ev);
    eventos.push(...ev);
    if (ev.some(e => e.tipo === "meta") || !sigue) break;
  }
  return { chapas: copia, eventos, fotogramas: f };
}
