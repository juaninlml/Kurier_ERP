"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KidoMark } from "./KidoLogo";
import { useT } from "./I18nProvider";
import { ARRIVE_COOKIE } from "@/lib/session-ui";

/**
 * Cortina azul marino con el símbolo Kurier Kido para entrar y salir del ERP.
 * - "closing": sube desde abajo y cubre la pantalla (login correcto o cerrar sesión).
 * - "opening": ya cubre la pantalla y se retira hacia arriba revelando el ERP.
 * El login también es azul marino, así que entrar y salir se sienten como una misma puerta.
 */
export function SessionCurtain({ phase, label }: { phase: "closing" | "opening"; label: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const body = (
    <div data-phase={phase} className="session-curtain fixed inset-0 z-[80] grid place-items-center bg-sidebar text-white" role="status" aria-live="polite">
      <div className="session-curtain-mark flex flex-col items-center gap-5">
        <div className="relative grid size-28 place-items-center">
          <svg viewBox="0 0 100 100" className="session-curtain-orbit absolute inset-0" aria-hidden>
            <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
            <circle cx="50" cy="50" r="47" fill="none" stroke="var(--sidebar-primary)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="60 240" pathLength={300} />
          </svg>
          <KidoMark className="size-20" />
        </div>
        <p className="text-sm font-medium tracking-wide text-white/80">{label}</p>
      </div>
    </div>
  );
  // "opening" se pinta desde el servidor (cubre desde el primer cuadro); "closing" se monta en el cliente.
  if (phase === "opening") return body;
  return mounted ? createPortal(body, document.body) : null;
}

/**
 * En el ERP, recién iniciada la sesión: la cortina se retira y se borra la marca de llegada.
 * `initial` viene del servidor (recarga completa). Si se llegó sin recargar (el login redirige dentro de
 * la app), se revisa la cookie antes del primer pintado para que el ERP nunca se asome sin cortina.
 */
export function ArrivalCurtain({ initial }: { initial: boolean }) {
  const t = useT();
  const [show, setShow] = useState(initial);
  useLayoutEffect(() => {
    if (!show && document.cookie.split("; ").includes(`${ARRIVE_COOKIE}=1`)) setShow(true);
  }, [show]);
  useEffect(() => {
    if (!show) return;
    document.cookie = `${ARRIVE_COOKIE}=; Max-Age=0; path=/`;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => setShow(false), reduce ? 260 : 1250);
    return () => clearTimeout(id);
  }, [show]);
  if (!show) return null;
  return <SessionCurtain phase="opening" label={t("Bienvenido")} />;
}
