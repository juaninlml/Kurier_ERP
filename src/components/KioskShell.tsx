"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Tr } from "@/components/Tr";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isInstalled = () =>
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Modo kiosco: registra la app instalable, mantiene la pantalla encendida y evita que se salga
 * del kiosco con gestos (atrás, zoom, menú de mantener presionado, jalar para recargar).
 * El bloqueo total de la tablet (no poder cambiar de app) se hace en el sistema:
 * Android "Fijar app" / iPad "Acceso guiado".
 */
export function KioskShell({ children }: { children: React.ReactNode }) {
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("kiosk-mode");

    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/kiosco-sw.js", { scope: "/kiosco" }).catch(() => {});

    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!isInstalled()) setInstall(e as InstallPrompt);
    };
    const onInstalled = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Sin menú contextual ni zoom con gestos (iPad)
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("gesturestart", block);
    const noPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchmove", noPinch, { passive: false });

    // El botón/gesto "atrás" no saca del kiosco
    history.pushState({ kiosk: true }, "", location.href);
    const onBack = () => history.pushState({ kiosk: true }, "", location.href);
    window.addEventListener("popstate", onBack);

    // Pantalla siempre encendida mientras el kiosco está visible
    type Lock = { release: () => Promise<void> };
    let lock: Lock | null = null;
    const wake = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
        if (wl && document.visibilityState === "visible") lock = await wl.request("screen");
      } catch {}
    };
    const onVisible = () => void (document.visibilityState === "visible" && wake());
    void wake();
    document.addEventListener("visibilitychange", onVisible);

    // Abierto en el navegador (sin instalar): pantalla completa al primer toque
    const goFull = () => {
      if (isInstalled() || document.fullscreenElement) return;
      const el = root as HTMLElement & { webkitRequestFullscreen?: () => void };
      try {
        if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        else el.webkitRequestFullscreen?.();
      } catch {}
    };
    document.addEventListener("pointerdown", goFull);

    return () => {
      root.classList.remove("kiosk-mode");
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("touchmove", noPinch);
      window.removeEventListener("popstate", onBack);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", goFull);
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <>
      {children}
      {install && (
        <button
          type="button"
          onClick={async () => {
            await install.prompt();
            await install.userChoice.catch(() => null);
            setInstall(null);
          }}
          className="fixed right-4 bottom-4 z-[60] inline-flex items-center gap-2 rounded-full bg-sidebar-primary px-4 py-2.5 text-sm font-semibold text-sidebar-primary-foreground shadow-lg"
        >
          <Download className="size-4" /> <Tr>Instalar app del kiosco</Tr>
        </button>
      )}
    </>
  );
}
