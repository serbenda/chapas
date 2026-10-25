// "La máquina": elige su tiro probando muchos con la física real y quedándose con el mejor.
// Cuanto más fácil el nivel, menos tiros prueba y más se equivoca al ejecutarlo.

import { simular, velocidadTiro } from "./fisica.js";

export const NIVELES = {
  facil: { nombre: "FÁCIL", angulos: 9, potencias: 3, ruidoAng: 0.3, ruidoPot: 0.3 },
  media: { nombre: "MEDIA", angulos: 13, potencias: 4, ruidoAng: 0.12, ruidoPot: 0.12 },
  dificil: { nombre: "DIFÍCIL", angulos: 19, potencias: 6, ruidoAng: 0.025, ruidoPot: 0.03 }
};

function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Puntúa el resultado de un tiro simulado
function puntuar(sim, turno, arcoIni, pista) {
  const c = sim.chapas[turno];
  if (sim.eventos.some(e => e.tipo === "meta" && e.c === c)) return 1e6;
  if (c.fuera) return -1000;
  const [qx, qy] = pista.enArco(c.arco, 0);
  const alBorde = Math.hypot(c.x - qx, c.y - qy);  // mejor acabar centrada
  return (c.arco - arcoIni) - alBorde * 1.5;
}

/**
 * @returns {{dx:number, dy:number, p:number}} dirección (unitaria, en el mundo) y potencia 0..1
 */
export function elegirTiro(chapas, turno, pista, opc, nivel = "media", rng = Math.random) {
  const N = NIVELES[nivel] || NIVELES.media;
  const c = chapas[turno];
  // dos referencias: la dirección de la carretera y un punto más adelante
  const i = Math.max(0, Math.min(pista.N - 2, c.idx));
  const base1 = Math.atan2(-pista.NX[i], pista.NY[i]);
  const [ax, ay] = pista.enArco(c.arco + 160, 0);
  const base2 = Math.atan2(ay - c.y, ax - c.x);
  const opcSim = { facil: opc.facil, rng: () => 0.5 };

  const probar = (ang, p) => {
    const v = velocidadTiro(p);
    const prueba = chapas.map((o, j) => j === turno ? { ...o, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v } : { ...o, vx: 0, vy: 0 });
    return puntuar(simular(prueba, pista, opcSim), turno, c.arco, pista);
  };
  const candidatos = [];
  for (const base of [base1, base2]) {
    for (let a = 0; a < N.angulos; a++) {
      const ang = base + (a / (N.angulos - 1) - 0.5) * 1.2;
      for (let k = 0; k < N.potencias; k++) {
        const p = 0.2 + 0.72 * (k + 1) / N.potencias;   // hasta 0.92: deja margen al pulso
        candidatos.push({ ang, p, score: probar(ang, p) });
      }
    }
  }
  // de los mejores, se queda con el más seguro: el que sigue bien aunque el pulso tiemble un poco
  candidatos.sort((x, y) => y.score - x.score);
  let mejor = candidatos[0];
  let mejorSeguro = -Infinity;
  for (const cand of candidatos.slice(0, 6)) {
    if (cand.score >= 1e6) { mejor = cand; break; }
    const seguro = Math.min(cand.score, probar(cand.ang + 0.07, cand.p), probar(cand.ang - 0.07, cand.p), probar(cand.ang, Math.min(1, cand.p * 1.1)), probar(cand.ang, cand.p * 0.9));
    if (seguro > mejorSeguro) { mejorSeguro = seguro; mejor = cand; }
  }
  const ang = mejor.ang + gauss(rng) * N.ruidoAng;
  const p = Math.max(0.1, Math.min(1, mejor.p * (1 + gauss(rng) * N.ruidoPot)));
  return { dx: Math.cos(ang), dy: Math.sin(ang), p };
}
