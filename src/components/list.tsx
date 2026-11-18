import Link from "next/link";
import { FileDown, Search } from "lucide-react";
import { STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Barra de búsqueda + filtros de estatus en forma de pestañas. Usa parámetros GET (q, status). */
export function FilterBar({
  basePath,
  q,
  status,
  statuses,
  placeholder = "Buscar…",
  counts,
}: {
  basePath: string;
  q: string;
  status?: string;
  statuses?: readonly string[];
  placeholder?: string;
  counts?: Record<string, number>;
}) {
  const href = (s?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
      {statuses && (
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="Filtrar por estatus">
          {[undefined, ...statuses].map((s) => {
            const active = (status ?? "") === (s ?? "");
            const n = s ? counts?.[s] : undefined;
            return (
              <Link
                key={s ?? "all"}
                href={href(s)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors",
                  active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s ? STATUS_LABELS[s] ?? s : "Todos"}
                {n ? <span className="rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{n}</span> : null}
              </Link>
            );
          })}
        </nav>
      )}
      <form action={basePath} className="relative w-full md:w-72">
        {status && <input type="hidden" name="status" value={status} />}
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="input pl-9" />
      </form>
    </div>
  );
}

/** Botón de ícono para abrir el PDF de un documento. */
export function PdfLink({ href, label = "Ver PDF" }: { href: string; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          aria-label={label}
          className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <FileDown className="size-4" />
        </a>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
