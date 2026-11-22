"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Transición del contenido al cambiar de sección. La llave es la ruta: solo se anima cuando cambia de
 * página. Guardar, refrescar datos, filtrar o cambiar de pestaña (mismos datos, otra búsqueda)
 * actualizan en su lugar, sin desvanecer ni mover las tablas.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-swap" exit="page-swap" update="none" default="none">
      {children}
    </ViewTransition>
  );
}
