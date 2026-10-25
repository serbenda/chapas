// Circuitos de la Vuelta: geometría de cada etapa y su terreno.
// Módulo puro (sin DOM), para poder probarlo con node:test.

export const WW = 1000, WH = 620;   // tamaño del mundo
export const TW = 88;               // ancho de la carretera
export const R = 17;                // radio de la chapa
export const PASO = 6;              // separación entre puntos del eje de la carretera

// Las zonas, cimas y charcos se dan como fracción del recorrido (0 = salida, 1 = final).
export const ETAPAS = [
  {
    id: "llana", nombre: "Llana", icono: "llana",
    ctrl: [[60, 560], [230, 566], [400, 548], [520, 488], [570, 385], [520, 300], [390, 292], [250, 312], [140, 262], [110, 160],
      [190, 78], [340, 62], [480, 108], [590, 190], [700, 160], [790, 82], [905, 98], [945, 205], [880, 300], [800, 380],
      [790, 482], [860, 556], [960, 560]],
    zonas: [],
    cimas: [],
    charcos: [],
    adorno: { x: 330, y: 180, texto: "PUERTO 1ª" }
  },
  {
    id: "montana", nombre: "Montaña", icono: "montana",
    ctrl: [[60, 80], [250, 72], [420, 100], [480, 210], [410, 310], [240, 320], [130, 410], [170, 530], [340, 566], [520, 540],
      [630, 440], [650, 300], [630, 170], [700, 76], [850, 80], [935, 180], [905, 320], [815, 420], [855, 530], [960, 550]],
    zonas: [
      { tipo: "subida", desde: 0.18, hasta: 0.42 },
      { tipo: "bajada", desde: 0.42, hasta: 0.56 },
      { tipo: "subida", desde: 0.68, hasta: 0.88 },
      { tipo: "bajada", desde: 0.88, hasta: 0.95 }
    ],
    cimas: [{ en: 0.42, cat: "1ª" }, { en: 0.88, cat: "ESP" }],
    charcos: [],
    adorno: null
  },
  {
    id: "adoquines", nombre: "Adoquines", icono: "adoquines",
    ctrl: [[60, 550], [260, 556], [390, 500], [410, 390], [290, 330], [160, 300], [110, 190], [190, 90], [360, 68], [520, 110],
      [610, 230], [620, 380], [700, 500], [820, 520], [900, 430], [860, 310], [760, 250], [740, 140], [830, 70], [940, 110], [960, 250]],
    zonas: [
      { tipo: "adoquines", desde: 0.2, hasta: 0.36 },
      { tipo: "adoquines", desde: 0.62, hasta: 0.78 }
    ],
    cimas: [],
    charcos: [{ en: 0.47, lat: 14, r: 24 }, { en: 0.55, lat: -15, r: 22 }, { en: 0.86, lat: 10, r: 24 }],
    adorno: null
  },
  {
    id: "final", nombre: "Gran final", icono: "final",
    ctrl: [[60, 330], [150, 150], [340, 70], [590, 70], [800, 110], [935, 250], [890, 420], [710, 535], [470, 550], [280, 510],
      [250, 380], [380, 290], [580, 290], [720, 350]],
    zonas: [
      { tipo: "subida", desde: 0.12, hasta: 0.3 },
      { tipo: "bajada", desde: 0.3, hasta: 0.42 },
      { tipo: "adoquines", desde: 0.55, hasta: 0.67 }
    ],
    cimas: [{ en: 0.3, cat: "2ª" }],
    charcos: [{ en: 0.75, lat: -12, r: 24 }],
    adorno: null
  }
];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

// Construye una pista lista para jugar a partir de una etapa.
export function construirPista(etapa) {
  const C = etapa.ctrl, n = C.length, raw = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = C[Math.max(i - 1, 0)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(i + 2, n - 1)];
    for (let k = 0; k < 30; k++) raw.push(catmull(p0, p1, p2, p3, k / 30));
  }
  raw.push(C[n - 1]);
  const acc = [0];
  for (let i = 1; i < raw.length; i++) acc.push(acc[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const total = acc[acc.length - 1];
  const PX = [], PY = [];
  let j = 0;
  for (let s = 0; s <= total; s += PASO) {
    while (acc[j + 1] < s) j++;
    const t = (s - acc[j]) / (acc[j + 1] - acc[j] || 1);
    PX.push(raw[j][0] + (raw[j + 1][0] - raw[j][0]) * t);
    PY.push(raw[j][1] + (raw[j + 1][1] - raw[j][1]) * t);
  }
  const N = PX.length, L = (N - 1) * PASO;
  const NX = [], NY = [];
  for (let i = 0; i < N; i++) {
    const a = Math.max(i - 1, 0), b = Math.min(i + 1, N - 1);
    const dx = PX[b] - PX[a], dy = PY[b] - PY[a], d = Math.hypot(dx, dy) || 1;
    NX.push(-dy / d); NY.push(dx / d);
  }

  const pista = { etapa, PX, PY, NX, NY, N, L, arcoSalida: 80, arcoMeta: L - 50 };

  // posición en la carretera: s = distancia recorrida, lat = desplazamiento lateral
  pista.enArco = function (s, lat) {
    const f = Math.max(0, Math.min(N - 1.001, s / PASO)), i = Math.floor(f), t = f - i;
    const x = PX[i] + (PX[i + 1] - PX[i]) * t, y = PY[i] + (PY[i + 1] - PY[i]) * t;
    return [x + NX[i] * (lat || 0), y + NY[i] * (lat || 0), NX[i], NY[i]];
  };
  // punto más cercano del eje, buscando solo cerca del índice actual (así no hay atajos)
  pista.cercano = function (x, y, idx, ventana) {
    let mejor = 1e9, bi = idx, bt = 0;
    const a = Math.max(0, idx - ventana), b = Math.min(N - 2, idx + ventana);
    for (let k = a; k <= b; k++) {
      const ex = PX[k + 1] - PX[k], ey = PY[k + 1] - PY[k];
      let t = ((x - PX[k]) * ex + (y - PY[k]) * ey) / (ex * ex + ey * ey);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = PX[k] + ex * t - x, qy = PY[k] + ey * t - y, d = qx * qx + qy * qy;
      if (d < mejor) { mejor = d; bi = k; bt = t; }
    }
    return { idx: bi, arco: (bi + bt) * PASO, dist: Math.sqrt(mejor) };
  };

  pista.zonas = etapa.zonas.map(z => ({ tipo: z.tipo, a0: z.desde * L, a1: z.hasta * L }));
  pista.cimas = etapa.cimas.map(c => ({ arco: c.en * L, cat: c.cat }));
  pista.charcos = etapa.charcos.map((c, i) => {
    const [x, y] = pista.enArco(c.en * L, c.lat);
    return { x, y, r: c.r, giro: i % 2 ? -1 : 1 };
  });
  pista.terreno = function (arco) {
    for (const z of pista.zonas) if (arco >= z.a0 && arco < z.a1) return z.tipo;
    return null;
  };
  pista.charcoEn = function (x, y) {
    for (const c of pista.charcos) if ((x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return c;
    return null;
  };
  return pista;
}

// Puestos de salida: dos filas de dos, detrás de la línea
export function posicionesSalida(pista, n) {
  const sitios = [[54, -20], [54, 20], [19, -20], [19, 20]];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pista.enArco(sitios[i][0], sitios[i][1]);
    const k = pista.cercano(x, y, Math.round(sitios[i][0] / PASO), 20);
    out.push({ x, y, idx: k.idx, arco: k.arco });
  }
  return out;
}

// ---------- Circuitos dibujados a mano ----------
export const LIMITES = { x0: 60, x1: 940, y0: 60, y1: 560 };
export const LONGITUD_MINIMA = 1300;

function remuestrear(puntos, paso) {
  const out = [puntos[0]];
  let resto = 0;
  for (let i = 1; i < puntos.length; i++) {
    let [ax, ay] = puntos[i - 1];
    const [bx, by] = puntos[i];
    let d = Math.hypot(bx - ax, by - ay);
    while (resto + d >= paso) {
      const t = (paso - resto) / d;
      ax += (bx - ax) * t; ay += (by - ay) * t;
      out.push([ax, ay]);
      d = Math.hypot(bx - ax, by - ay);
      resto = 0;
    }
    resto += d;
  }
  const ult = puntos[puntos.length - 1], prev = out[out.length - 1];
  if (Math.hypot(ult[0] - prev[0], ult[1] - prev[1]) > paso * 0.4) out.push(ult);
  return out;
}

/**
 * Comprueba si un trazado hecho con el dedo se puede jugar.
 * @param puntos [[x, y], ...] en coordenadas del mundo
 * @returns {{ok:true, etapa, pista} | {ok:false, motivo:"corto"|"cruce"|"curva", donde?:[x,y]}}
 */
export function validarTrazado(puntos) {
  const { x0, x1, y0, y1 } = LIMITES;
  const limpio = puntos.map(([x, y]) => [Math.max(x0, Math.min(x1, x)), Math.max(y0, Math.min(y1, y))]);
  let largo = 0;
  for (let i = 1; i < limpio.length; i++) largo += Math.hypot(limpio[i][0] - limpio[i - 1][0], limpio[i][1] - limpio[i - 1][1]);
  if (limpio.length < 2 || largo < LONGITUD_MINIMA) return { ok: false, motivo: "corto" };
  // menos puntos y suavizado: el pulso de un niño tiembla y las esquinas salen en pico.
  // Se suaviza más mientras quede alguna curva demasiado cerrada.
  let ctrl = remuestrear(limpio, 50);
  const suavizar = c => c.map((p, i) => i === 0 || i === c.length - 1 ? p
    : [(c[i - 1][0] + 2 * p[0] + c[i + 1][0]) / 4, (c[i - 1][1] + 2 * p[1] + c[i + 1][1]) / 4]);
  let resultado = null;
  for (let pasada = 0; pasada < 10; pasada++) {
    ctrl = suavizar(ctrl);
    if (pasada < 1) continue;
    resultado = comprobar(ctrl.map(([x, y]) => [Math.round(x), Math.round(y)]));
    if (resultado.ok || resultado.motivo !== "curva") break;
  }
  return resultado;
}

function comprobar(ctrl) {
  const etapa = { id: "propio", nombre: "Tu circuito", icono: "propio", ctrl, zonas: [], cimas: [], charcos: [], adorno: null };
  const pista = construirPista(etapa);
  const { PX, PY, N } = pista;
  if (pista.L < LONGITUD_MINIMA * 0.85) return { ok: false, motivo: "corto" };
  for (let i = 0; i < N; i += 2) for (let j = i + 60; j < N; j += 2) {
    if (Math.hypot(PX[i] - PX[j], PY[i] - PY[j]) < TW + 16) return { ok: false, motivo: "cruce", donde: [(PX[i] + PX[j]) / 2, (PY[i] + PY[j]) / 2] };
  }
  for (let i = 3; i < N - 3; i += 2) {
    const a = [PX[i - 3], PY[i - 3]], b = [PX[i], PY[i]], c = [PX[i + 3], PY[i + 3]];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    if (area > 1e-6 && ab * bc * ca / (4 * area) < TW / 2 + 4) return { ok: false, motivo: "curva", donde: b };
  }
  return { ok: true, etapa, pista };
}
