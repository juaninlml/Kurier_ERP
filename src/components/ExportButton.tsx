import { FileSpreadsheet } from "lucide-react";
import { Tr } from "./Tr";

/**
 * Descarga a Excel (CSV) de /api/export/[kind]. Se pasa el filtro de fechas de la página para que
 * el archivo traiga lo mismo que se ve. Funciona como liga simple (sin JavaScript).
 */
export function ExportButton({ kind, params, label = "Exportar a Excel", className = "btn-secondary" }: { kind: string; params?: Record<string, string | number | undefined>; label?: string; className?: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") qs.set(k, String(v));
  const q = qs.toString();
  return (
    <a href={`/api/export/${kind}${q ? `?${q}` : ""}`} className={className} download>
      <FileSpreadsheet className="size-4" /> <Tr>{label}</Tr>
    </a>
  );
}
