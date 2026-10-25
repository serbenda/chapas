// Tests de la física y de la máquina: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { ETAPAS, construirPista, posicionesSalida, TW, R, WW, WH, PASO } from "../js/circuito.js";
import { pasoFisica, simular, velocidadTiro, LIM_VALLA, VMAX } from "../js/fisica.js";
import { elegirTiro } from "../js/ia.js";

const pistas = ETAPAS.map(construirPista);
const fijo = () => 0.5;

function chapa(pista, arco, lat = 0) {
  const [x, y] = pista.enArco(arco, lat);
  const k = pista.cercano(x, y, Math.round(arco / PASO), 30);
  return { x, y, vx: 0, vy: 0, idx: k.idx, arco: k.arco, fuera: false };
}
function tangente(pista, c) {
  return [pista.NY[c.idx], -pista.NX[c.idx]];
}

for (const p of pistas) {
  test(`circuito ${p.etapa.id}: los tramos no se tocan y caben en el mundo`, () => {
    let min = Infinity;
    for (let i = 0; i < p.N; i += 2) for (let j = i + 60; j < p.N; j += 2) {
      min = Math.min(min, Math.hypot(p.PX[i] - p.PX[j], p.PY[i] - p.PY[j]));
    }
    assert.ok(min > TW + 20, `tramos demasiado cerca: ${min.toFixed(0)}`);
    for (let i = 0; i < p.N; i++) {
      assert.ok(p.PX[i] >= 40 && p.PX[i] <= WW - 30 && p.PY[i] >= 40 && p.PY[i] <= WH - 40, "fuera del mundo");
    }
    assert.ok(p.L > 2000, "etapa demasiado corta");
  });

  test(`circuito ${p.etapa.id}: las chapas salen dentro de la carretera y sin solaparse`, () => {
    const s = posicionesSalida(p, 4);
    for (const a of s) assert.ok(p.cercano(a.x, a.y, a.idx, 20).dist < TW / 2 - R);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      assert.ok(Math.hypot(s[i].x - s[j].x, s[i].y - s[j].y) >= 2 * R);
    }
  });
}

test("una chapa lanzada recta acaba parándose por el rozamiento", () => {
  const p = pistas[0];
  const c = chapa(p, 120);
  const [tx, ty] = tangente(p, c);
  c.vx = tx * 3; c.vy = ty * 3;
  const sim = simular([c], p, { rng: fijo });
  assert.equal(sim.chapas[0].vx, 0);
  assert.ok(sim.chapas[0].arco > 120 + 50, "debería haber avanzado");
  assert.ok(sim.fotogramas < 1200);
});

test("el tiro máximo no recorre más de medio circuito", () => {
  // en recta ideal: v0 / (1 - FRIC)
  assert.ok(VMAX / (1 - 0.972) < pistas[0].L / 2);
  assert.ok(velocidadTiro(0) > 0 && velocidadTiro(1) === VMAX);
});

test("si se sale de la carretera, se marca fuera y se para", () => {
  const p = pistas[0];
  const c = chapa(p, 300);
  c.vx = p.NX[c.idx] * 8; c.vy = p.NY[c.idx] * 8;   // de lado, hacia el borde
  const sim = simular([c], p, { rng: fijo });
  assert.ok(sim.chapas[0].fuera);
  assert.ok(sim.eventos.some(e => e.tipo === "fuera"));
});

test("en modo fácil rebota en la valla y nunca sale", () => {
  const p = pistas[0];
  const c = chapa(p, 300);
  c.vx = p.NX[c.idx] * 8; c.vy = p.NY[c.idx] * 8;
  const sim = simular([c], p, { facil: true, rng: fijo });
  assert.ok(!sim.chapas[0].fuera);
  assert.ok(sim.eventos.some(e => e.tipo === "valla"));
  const f = sim.chapas[0];
  assert.ok(p.cercano(f.x, f.y, f.idx, 20).dist <= LIM_VALLA + 0.01);
});

test("un choque conserva la cantidad de movimiento", () => {
  const p = pistas[0];
  const a = chapa(p, 150, 0), b = chapa(p, 150 + 2 * R + 6, 0);
  const [tx, ty] = tangente(p, a);
  a.vx = tx * 5; a.vy = ty * 5;
  const antes = [a.vx + b.vx, a.vy + b.vy];
  const ev = [];
  for (let i = 0; i < 3 && !ev.some(e => e.tipo === "choque"); i++) pasoFisica([a, b], p, { rng: fijo }, ev);
  assert.ok(ev.some(e => e.tipo === "choque"), "debería chocar");
  // el rozamiento es igual para las dos, así que comparamos proporciones
  const despues = [a.vx + b.vx, a.vy + b.vy];
  const ratio = Math.hypot(...despues) / Math.hypot(...antes);
  assert.ok(ratio > 0.85 && ratio <= 1.0001, `ratio ${ratio}`);
  assert.ok(Math.hypot(b.vx, b.vy) > Math.hypot(a.vx, a.vy), "la golpeada sale más rápida");
});

test("en la subida se avanza menos que en llano con el mismo tiro", () => {
  const llana = pistas[0], mont = pistas[1];
  const z = mont.zonas.find(z => z.tipo === "subida");
  const enSubida = chapa(mont, z.a0 + 20), enLlano = chapa(llana, 120);
  for (const [p, c] of [[mont, enSubida], [llana, enLlano]]) {
    const [tx, ty] = tangente(p, c);
    c.vx = tx * 4; c.vy = ty * 4;
  }
  const a = simular([enSubida], mont, { facil: true, rng: fijo }).chapas[0].arco - enSubida.arco;
  const b = simular([enLlano], llana, { facil: true, rng: fijo }).chapas[0].arco - enLlano.arco;
  assert.ok(a < b * 0.8, `subida ${a.toFixed(0)} vs llano ${b.toFixed(0)}`);
});

test("cruzar la meta lanza el evento meta", () => {
  const p = pistas[0];
  const c = chapa(p, p.arcoMeta - 40);
  const [tx, ty] = tangente(p, c);
  c.vx = tx * 4; c.vy = ty * 4;
  const sim = simular([c], p, { rng: fijo });
  assert.ok(sim.eventos.some(e => e.tipo === "meta"));
});

for (const p of pistas) {
  test(`la máquina difícil avanza sin salirse en ${p.etapa.id}`, () => {
    let semilla = 7;
    const rng = () => (semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296;
    const salida = posicionesSalida(p, 1)[0];
    const c = { ...salida, vx: 0, vy: 0, fuera: false };
    const tiro = elegirTiro([c], 0, p, { facil: false }, "dificil", rng);
    const v = velocidadTiro(tiro.p);
    const sim = simular([{ ...c, vx: tiro.dx * v, vy: tiro.dy * v }], p, { rng: fijo });
    assert.ok(!sim.chapas[0].fuera, "no debería salirse");
    assert.ok(sim.chapas[0].arco - c.arco > 120, "debería avanzar bastante");
  });
}
