"use client";

/*
 * Sonidos de la app de reparto, generados con Web Audio (sin archivos): funcionan sin conexión
 * y suenan igual en cualquier celular o PDA.
 *   ok        escaneo aceptado (un pitido agudo, como un lector)
 *   repeat    guía ya escaneada (dos pitidos medios)
 *   error     no se pudo (zumbido grave)
 *   delivered entrega confirmada (tres notas que suben)
 *   attempt   intento sin entregar (dos notas que bajan)
 * El navegador solo deja sonar después de un toque o tecla: `unlockAudio` se llama en el primero.
 */
export type Feedback = "ok" | "repeat" | "error" | "delivered" | "attempt";

let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "square", gain = 0.12) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  // Ataque y caída cortos para que no "truene"
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.setValueAtTime(gain, c.currentTime + start + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

export function playSound(kind: Feedback) {
  unlockAudio();
  if (!ctx) return;
  try {
    if (kind === "ok") tone(1760, 0, 0.12);
    else if (kind === "repeat") {
      tone(880, 0, 0.09);
      tone(880, 0.16, 0.09);
    } else if (kind === "error") tone(196, 0, 0.38, "sawtooth", 0.16);
    else if (kind === "delivered") {
      tone(1047, 0, 0.1, "triangle", 0.2);
      tone(1319, 0.11, 0.1, "triangle", 0.2);
      tone(1568, 0.22, 0.22, "triangle", 0.2);
    } else {
      tone(660, 0, 0.14, "triangle", 0.18);
      tone(440, 0.16, 0.22, "triangle", 0.18);
    }
  } catch {}
  navigator.vibrate?.(kind === "error" ? [70, 60, 70, 60, 70] : kind === "repeat" ? [60, 80, 60] : kind === "delivered" ? [40, 40, 160] : 90);
}
