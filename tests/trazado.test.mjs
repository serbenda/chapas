// Tests de los circuitos dibujados a mano: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarTrazado, posicionesSalida, ETAPAS, TW, R } from "../web/js/circuito.js";

// trazo "a mano": puntos cada pocas unidades con algo de temblor
function dedo(puntosClave, temblor = 3) {
  let s = 11;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * temblor;
  const out = [];
  for (let i = 1; i < puntosClave.length; i++) {
    const [ax, ay] = puntosClave[i - 1], [bx, by] = puntosClave[i];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n + r(), ay + (by - ay) * k / n + r()]);
  }
  out.push(puntosClave[puntosClave.length - 1]);
  return out;
}

test("una S grande dibujada a mano es un circuito válido", () => {
  const v = validarTrazado(dedo([[80, 500], [500, 520], [880, 480], [900, 330], [500, 320], [120, 300], [100, 150], [500, 110], [900, 120]]));
  assert.ok(v.ok, v.motivo);
  assert.ok(v.pista.L > 1300);
  // las chapas caben en la salida
  for (const s of posicionesSalida(v.pista, 4)) assert.ok(v.pista.cercano(s.x, s.y, s.idx, 20).dist < TW / 2 - R);
});

test("los circuitos de la Vuelta también pasarían la validación", () => {
  for (const e of ETAPAS) assert.ok(validarTrazado(e.ctrl).ok, e.id);
});

test("un trazo corto no vale", () => {
  const v = validarTrazado(dedo([[100, 300], [500, 300]]));
  assert.equal(v.ok, false); assert.equal(v.motivo, "corto");
});

test("un ocho, que se cruza, no vale y dice dónde", () => {
  const v = validarTrazado(dedo([[150, 150], [850, 470], [850, 150], [150, 470], [150, 160]]));
  assert.equal(v.ok, false); assert.equal(v.motivo, "cruce");
  assert.ok(Array.isArray(v.donde));
});

test("una horquilla demasiado cerrada no vale", () => {
  const v = validarTrazado(dedo([[100, 300], [800, 300], [810, 330], [100, 345]]));
  assert.equal(v.ok, false);
  assert.ok(["cruce", "curva"].includes(v.motivo));
});

test("lo que se sale del dibujo se recoloca dentro del campo", () => {
  const v = validarTrazado(dedo([[-200, 560], [500, 590], [1200, 520], [900, 300], [100, 280], [100, 100], [900, 100]]));
  assert.ok(v.ok, v.motivo);
  for (const [x, y] of v.etapa.ctrl) assert.ok(x >= 60 && x <= 940 && y >= 60 && y <= 560);
});
