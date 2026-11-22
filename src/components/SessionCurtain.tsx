"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KidoMark } from "./KidoLogo";
import { useT } from "./I18nProvider";
import { ARRIVE_COOKIE, DOOR_TOTAL_MS, clearDoor, doorTime, readDoor, visibleMark, type Door } from "@/lib/session-ui";

/**
 * Cortina azul marino para entrar y salir del ERP: una sola "puerta" que cruza de página.
 *
 * Línea de tiempo (ms desde que empezó, ver globals.css "Entrar y salir"):
 *   0–480     la cortina sube desde abajo; el símbolo viaja del logo de origen al centro.
 *   340–560   aparecen el arco naranja y el texto (el símbolo ya casi está en el centro). Si el servidor tarda, la cortina espera aquí cubriendo.
 *   600       (llegada) el reloj de la página nueva se topa aquí; 620 se van arco y texto.
 *   "arrive-in"  (en el ERP)   800–1400 la cortina se levanta y el símbolo aterriza sobre el de la barra.
 *   "arrive-out" (en el login) 640–1160 el símbolo va a su lugar en el logo; 1080–1420 la cortina se
 *                              desvanece y debajo ya está el logo, en el mismo sitio.
 * Cada fase toma `--t` = tiempo transcurrido, así la cortina de la página siguiente continúa la anterior.
 */
type Phase = "cover" | "arrive-in" | "arrive-out";

// Pintado desde el servidor (recarga completa al entrar): la cortina ya cubre, en el punto de espera.
const REST: React.CSSProperties = { ["--t" as string]: "600ms" };

export function SessionCurtain({ phase, label, door, portal }: { phase: Phase; label: string; door: Door | null; portal?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vars, setVars] = useState<React.CSSProperties | null>(null);
  const [mounted, setMounted] = useState(!portal);

  useEffect(() => {
    if (portal) setMounted(true);
  }, [portal]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = el.querySelector(".door-mark")!.getBoundingClientRect();
    const cx = m.left + m.width / 2;
    const cy = m.top + m.height / 2;
    // Sin marca se asume que la cortina ya cubre la pantalla (doorTime → 600).
    const v: Record<string, string> = { "--t": `${doorTime(door, phase !== "cover")}ms` };
    if (door?.src) {
      v["--fx"] = `${door.src.x - cx}px`;
      v["--fy"] = `${door.src.y - cy}px`;
      v["--fs"] = String(door.src.w / m.width);
    }
    if (phase !== "cover") {
      const r = visibleMark();
      if (r) {
        v["--tx"] = `${r.left + r.width / 2 - cx}px`;
        v["--ty"] = `${r.top + r.height / 2 - cy}px`;
        v["--ts"] = String(r.width / m.width);
      }
    }
    setVars(v as React.CSSProperties);
  }, [mounted, door, phase]);

  if (!mounted) return null;
  const body = (
    <div
      ref={ref}
      data-phase={phase}
      data-from={door?.src ? "mark" : "none"}
      style={vars ?? REST}
      className="session-curtain fixed inset-0 z-[80] text-white"
      role="status"
      aria-live="polite"
    >
      {/* La puerta (se recorta al subir/levantarse); el símbolo va encima y nunca se corta */}
      <div className="door-panel absolute inset-0 bg-sidebar" aria-hidden />
      <div className="relative flex h-full flex-col items-center justify-center gap-5">
        <div className="relative grid size-28 place-items-center">
          <svg viewBox="0 0 100 100" className="door-ring absolute inset-0" aria-hidden>
            <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
            <g className="door-ring-spin">
              <circle cx="50" cy="50" r="47" fill="none" stroke="var(--sidebar-primary)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="60 240" pathLength={300} />
            </g>
          </svg>
          {/* Dos capas: una trae el símbolo desde su origen y otra lo lleva a su destino */}
          <span className="door-travel-in block">
            <span className="door-travel-out block">
              <KidoMark className="door-mark size-20" />
            </span>
          </span>
        </div>
        <p className="door-label text-sm font-medium tracking-wide text-white/80">{label}</p>
      </div>
    </div>
  );
  return portal ? createPortal(body, document.body) : body;
}

/** Ajusta el reloj compartido de la puerta en <html> (lo usan el ERP y el login para su entrada). */
function useDoorClock(kind: "in" | "out", door: Door | null, active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const h = document.documentElement;
    h.dataset.door = kind;
    h.style.setProperty("--door-t", `${doorTime(door, true)}ms`);
    return () => {
      delete h.dataset.door;
      h.style.removeProperty("--door-t");
    };
  }, [kind, door, active]);
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * En el ERP, recién iniciada la sesión: continúa la cortina del login y se levanta.
 * `initial` viene del servidor (recarga completa con la cookie); al llegar sin recargar se revisa la
 * cookie antes del primer pintado para que el ERP nunca se asome sin cortina.
 */
export function ArrivalCurtain({ initial }: { initial: boolean }) {
  const t = useT();
  const [show, setShow] = useState(initial);
  const [door, setDoor] = useState<Door | null>(null);
  // Hasta hidratar la cortina solo cubre (pintada por el servidor); ya con el destino medido, se levanta.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (!show && document.cookie.split("; ").includes(`${ARRIVE_COOKIE}=1`)) setShow(true);
    if (show) {
      setDoor(readDoor("in"));
      setReady(true);
    }
  }, [show]);
  useDoorClock("in", door, show && ready);
  useEffect(() => {
    if (!show || !ready) return;
    document.cookie = `${ARRIVE_COOKIE}=; Max-Age=0; path=/`;
    clearDoor();
    const id = setTimeout(() => setShow(false), Math.max(0, (reduced() ? 900 : DOOR_TOTAL_MS) - doorTime(door, true)));
    return () => clearTimeout(id);
  }, [show, ready, door]);
  if (!show) return null;
  return <SessionCurtain phase={ready ? "arrive-in" : "cover"} label={t("Entrando al ERP…")} door={door} />;
}

/** En el login, al venir de cerrar sesión: continúa la cortina y la deja caer sobre el logo. */
export function DepartureCurtain() {
  const t = useT();
  const [door, setDoor] = useState<Door | null>(null);
  useLayoutEffect(() => setDoor(readDoor("out")), []);
  useDoorClock("out", door, !!door);
  useEffect(() => {
    if (!door) return;
    clearDoor();
    const id = setTimeout(() => setDoor(null), Math.max(0, (reduced() ? 900 : DOOR_TOTAL_MS) - doorTime(door, true)));
    return () => clearTimeout(id);
  }, [door]);
  if (!door) return null;
  return <SessionCurtain phase="arrive-out" label={t("Cerrando sesión…")} door={door} />;
}
