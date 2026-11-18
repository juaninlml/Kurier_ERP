import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  FACTURADO: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  DESCARTADO: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-600/20",
};
const LABEL: Record<string, string> = { PENDIENTE: "Por facturar", FACTURADO: "Facturado", DESCARTADO: "Descartado" };

/** Estatus de un estado de cobro importado del WMS. */
export function ImportBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent", TONES[status])}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {LABEL[status] ?? status}
    </Badge>
  );
}
