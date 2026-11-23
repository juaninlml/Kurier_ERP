/** Cookie (no sensible, 1 min) que deja el login para que el ERP llegue con la cortina de entrada puesta. */
export const ARRIVE_COOKIE = "kurier_arrive";

/**
 * La cortina de entrar/salir es UN solo recorrido aunque cruce de página: la primera cortina guarda
 * cuándo empezó y dónde estaba el símbolo; la de la página siguiente continúa desde ese mismo instante
 * (retrasos negativos en CSS), sin reiniciar ni saltar.
 */
export type Door = { kind: "in" | "out"; t0: number; src: { x: number; y: number; w: number } | null };

const DOOR_KEY = "kurier:door";
/** Para entonces la cortina ya cubre la pantalla y el símbolo está centrado: ahí se cambia de página. */
export const DOOR_COVERED_MS = 540;
/** Duración total del recorrido. */
export const DOOR_TOTAL_MS = 1420;
/** Al llegar a la página siguiente el reloj se topa aquí: si el servidor tardó, la cortina esperó cubriendo
 *  y la salida (levantarse o desvanecerse) se ve completa en lugar de saltarse. */
const DOOR_HOLD_MS = 600;
/** Más allá de esto una marca vieja ya no se continúa (p. ej. otra pestaña o una recarga tardía). */
const DOOR_STALE_MS = 10_000;

/** Tiempo transcurrido de la puerta para una fase (`cover` corre libre; las llegadas se topan). */
export function doorTime(door: Door | null, arriving: boolean) {
  if (!door) return 600;
  const elapsed = Math.max(0, Date.now() - door.t0);
  return arriving ? Math.min(elapsed, DOOR_HOLD_MS) : elapsed;
}

/** El símbolo Kurier Kido visible en pantalla (logo del login o de la barra), fuera de la cortina. */
function visibleMarkEl(): SVGElement | null {
  for (const el of document.querySelectorAll<SVGElement>("[data-kido-mark]")) {
    if (el.closest(".session-curtain")) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}
export function visibleMark(): DOMRect | null {
  return visibleMarkEl()?.getBoundingClientRect() ?? null;
}

export function stampDoor(kind: Door["kind"]): Door {
  const el = visibleMarkEl();
  const r = el?.getBoundingClientRect();
  // El símbolo de la cortina despega exactamente desde aquí: el original se oculta para que no haya dos.
  if (el) el.style.visibility = "hidden";
  const door: Door = { kind, t0: Date.now(), src: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null };
  try {
    sessionStorage.setItem(DOOR_KEY, JSON.stringify(door));
  } catch {}
  return door;
}

export function readDoor(kind: Door["kind"]): Door | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DOOR_KEY) ?? "null") as Door | null;
    if (d?.kind === kind && Date.now() - d.t0 < DOOR_STALE_MS) return d;
  } catch {}
  return null;
}

export function clearDoor() {
  try {
    sessionStorage.removeItem(DOOR_KEY);
  } catch {}
}
