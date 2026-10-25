// Tests del fútbol de chapas: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPO, RB, crearPartido, colocarSaque, balonDe, pasoFutbol, simularFutbol, elegirTiroFutbol, porteriaRival } from "../web/js/futbol.js";
import { velocidadTiro } from "../web/js/fisica.js";

const dentro = c => c.x > CAMPO.x0 - CAMPO.fondo - 1 && c.x < CAMPO.x1 + CAMPO.fondo + 1 && c.y > CAMPO.y0 - 1 && c.y < CAMPO.y1 + 1;

test("la formación inicial no se solapa y está dentro del campo", () => {
  const cs = crearPartido();
  assert.equal(cs.length, 9);
  for (let i = 0; i < cs.length; i++) {
    assert.ok(dentro(cs[i]));
    for (let j = i + 1; j < cs.length; j++) assert.ok(Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y) > cs[i].r + cs[j].r);
  }
});

test("el balón rebota en el bordillo y nunca sale del campo", () => {
  const cs = crearPartido();
  const b = balonDe(cs);
  b.vx = 3; b.vy = -20;
  const sim = simularFutbol(cs);
  for (const c of sim.cuerpos) assert.ok(dentro(c), "algo se ha salido");
  assert.ok(sim.eventos.some(e => e.tipo === "pared"));
});

test("un balón que entra en la portería derecha es gol del equipo 0", () => {
  const cs = crearPartido();
  const b = balonDe(cs);
  b.x = CAMPO.x1 - 40; b.y = 310; b.vx = 8; b.vy = 0;
  const sim = simularFutbol(cs);
  const gol = sim.eventos.find(e => e.tipo === "gol");
  assert.ok(gol); assert.equal(gol.equipo, 0);
});

test("un balón al poste rebota y no es gol", () => {
  const cs = crearPartido();
  const b = balonDe(cs);
  b.x = CAMPO.x1 - 60; b.y = CAMPO.gy0 - 6; b.vx = 8; b.vy = 0;
  const sim = simularFutbol(cs);
  assert.ok(!sim.eventos.some(e => e.tipo === "gol"));
  assert.ok(sim.eventos.some(e => e.tipo === "palo" || e.tipo === "pared"));
});

test("al golpear el balón, este sale más rápido que la chapa (pesa menos)", () => {
  const cs = crearPartido();
  const b = balonDe(cs), c = cs[3];   // delantero del equipo 0
  c.x = b.x - 40; c.y = b.y; c.vx = 6; c.vy = 0;
  const ev = [];
  for (let i = 0; i < 20 && !ev.some(e => e.tipo === "toque"); i++) pasoFutbol(cs, ev);
  assert.ok(ev.some(e => e.tipo === "toque"));
  assert.ok(b.vx > c.vx && b.vx > 0);
  // se conserva la cantidad de movimiento (salvo rozamiento)
  const p = c.vx * c.m + b.vx * b.m;
  assert.ok(p > 0 && p <= 6 * 1.0001);
});

test("colocar el saque devuelve todo a su sitio y parado", () => {
  const cs = crearPartido();
  cs.forEach(c => { c.x += 13; c.vx = 2; });
  colocarSaque(cs);
  const nuevo = crearPartido();
  cs.forEach((c, i) => { assert.equal(c.x, nuevo[i].x); assert.equal(c.vx, 0); });
});

for (const equipo of [0, 1]) {
  test(`la máquina difícil (equipo ${equipo}) suele acercar el balón a la portería rival`, () => {
    let buenos = 0;
    for (let semilla0 = 1; semilla0 <= 5; semilla0++) {
      let semilla = semilla0;
      const rng = () => (semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296;
      const cs = crearPartido();
      const t = elegirTiroFutbol(cs, equipo, "dificil", rng);
      assert.equal(cs[t.indice].equipo, equipo);
      const v = velocidadTiro(t.p);
      cs[t.indice].vx = t.dx * v; cs[t.indice].vy = t.dy * v;
      const antes = { ...balonDe(cs) };
      const sim = simularFutbol(cs);
      const [gx, gy] = porteriaRival(equipo), b = balonDe(sim.cuerpos);
      const gol = sim.eventos.find(e => e.tipo === "gol");
      if (gol ? gol.equipo === equipo : Math.hypot(b.x - gx, b.y - gy) < Math.hypot(antes.x - gx, antes.y - gy)) buenos++;
    }
    assert.ok(buenos >= 4, `solo ${buenos} de 5 tiros buenos`);
  });
}

test("la máquina tarda poco en pensar", () => {
  const cs = crearPartido();
  const t0 = performance.now();
  elegirTiroFutbol(cs, 0, "dificil");
  assert.ok(performance.now() - t0 < 1500);
});
