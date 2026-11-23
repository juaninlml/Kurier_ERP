"use client";

import { useEffect } from "react";
import { useT } from "./I18nProvider";

/**
 * Aviso de "sin permiso" que deja el proxy (/?sinpermiso=1). Se muestra una vez y quita el parámetro
 * de la dirección, para que al recargar o volver al Inicio no se repita.
 */
export function NoAccessNotice() {
  const t = useT();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("sinpermiso")) return;
    url.searchParams.delete("sinpermiso");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return (
    <div role="status" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {t("Tu rol no tiene acceso a esa sección. Si lo necesitas, pídeselo a un administrador.")}
    </div>
  );
}
