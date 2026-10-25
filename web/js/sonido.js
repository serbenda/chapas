// Sonido: efectos y música de 8 bits sintetizados con Web Audio (no hay archivos de audio).

let actx = null, sonidoOn = true;

export function activarAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch (e) { actx = null; }
}
export function haySonido() { return sonidoOn; }
export function alternarSonido() { sonidoOn = !sonidoOn; return sonidoOn; }

export function tono(f, dur, tipo, vol, f2, retraso) {
  if (!sonidoOn || !actx) return;
  const t0 = actx.currentTime + (retraso || 0);
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = tipo || "square";
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(vol || 0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// "clac" metálico: ruido filtrado muy corto + dos resonancias de chapa
let bufRuido = null;
function clac(vol, agudo) {
  if (!sonidoOn || !actx) return;
  const t0 = actx.currentTime;
  if (!bufRuido) {
    bufRuido = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.08), actx.sampleRate);
    const d = bufRuido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  }
  const n = actx.createBufferSource(); n.buffer = bufRuido;
  const bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = agudo; bp.Q.value = 3;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
  n.connect(bp); bp.connect(g); g.connect(actx.destination); n.start(t0);
  [agudo * 0.62, agudo * 1.37].forEach((f, i) => tono(f, 0.09 + i * 0.03, "sine", vol * 0.35, f * 0.97));
}
function vibrar(patron) { try { if (navigator.vibrate) navigator.vibrate(patron); } catch (e) {} }

export const sfx = {
  tiro() { clac(0.5, 4200); tono(260, 0.1, "sine", 0.1, 120); vibrar(15); },
  choque() { clac(0.4, 3000); vibrar(30); },
  valla() { clac(0.3, 1600); tono(180, 0.12, "triangle", 0.1, 110); vibrar(20); },
  fuera() { tono(420, 0.35, "sawtooth", 0.06, 130); vibrar([60, 40, 60]); },
  turno() { tono(660, 0.08, "sine", 0.08); },
  tecla() { tono(1500, 0.015, "square", 0.02); },
  cima() { [784, 988, 1175].forEach((f, i) => tono(f, 0.12, "square", 0.06, null, i * 0.09)); vibrar([30, 30, 30]); },
  meta() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tono(f, 0.18, "square", 0.07, null, i * 0.12)); vibrar([80, 60, 80, 60, 200]); }
};

// ---------- Música: corcheas a 150 ppm; 0 = silencio ----------
const NOTA = n => n ? 440 * Math.pow(2, (n - 69) / 12) : 0;
const MELODIA = [76, 79, 84, 79, 81, 79, 76, 72, 74, 76, 77, 74, 79, 0, 79, 0,
  76, 79, 84, 79, 81, 79, 76, 72, 74, 77, 76, 74, 72, 0, 72, 0,
  81, 0, 81, 79, 77, 0, 77, 76, 74, 76, 77, 79, 76, 0, 72, 0,
  81, 0, 81, 79, 77, 79, 81, 83, 84, 0, 79, 0, 84, 0, 0, 0];
const BAJO = [48, 55, 45, 52, 41, 48, 43, 50, 48, 55, 45, 52, 43, 50, 48, 55,
  41, 48, 43, 50, 48, 52, 45, 52, 41, 48, 43, 50, 48, 43, 48, 0];
const musica = { activa: false, paso: 0, siguiente: 0, timer: null };
const CORCHEA = 60 / 150 / 2;

function programarMusica() {
  if (!actx || !musica.activa) return;
  while (musica.siguiente < actx.currentTime + 0.15) {
    const i = musica.paso % MELODIA.length, t = musica.siguiente - actx.currentTime;
    if (sonidoOn) {
      const m = NOTA(MELODIA[i]);
      if (m) tono(m, CORCHEA * 0.9, "square", 0.028, null, t);
      if (i % 2 === 0) { const b = NOTA(BAJO[(i / 2) % BAJO.length]); if (b) tono(b, CORCHEA * 1.8, "triangle", 0.07, null, t); }
      if (i % 4 === 2) tono(5200, 0.025, "square", 0.012, 3000, t);
    }
    musica.paso++; musica.siguiente += CORCHEA;
  }
}
export function arrancarMusica() {
  if (!actx || musica.activa) return;
  musica.activa = true; musica.siguiente = actx.currentTime + 0.1;
  musica.timer = setInterval(programarMusica, 40);
}
