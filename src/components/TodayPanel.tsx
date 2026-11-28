import Link from "next/link";
import { ArrowRight, BellRing, Boxes, CalendarRange, CircleCheck, Clock, HandCoins, PackageCheck, PackageOpen, Receipt, Warehouse, type LucideIcon } from "lucide-react";
import type { PendingItem, PendingKind } from "@/lib/today-pending";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

const ICON: Record<PendingKind, LucideIcon> = {
  capture: PackageOpen,
  supplies: Boxes,
  weekly: CalendarRange,
  overdue: BellRing,
  promise: HandCoins,
  payables: Receipt,
  stock: Warehouse,
  shipments: PackageCheck,
  attendance: Clock,
};

/* El tono vive en el ícono y la franja de color; el texto siempre en tinta (DESIGN.md: Meaning Holds). */
const TONE = {
  alert: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-300",
  warn: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  info: "bg-primary/8 text-primary ring-primary/15",
} as const;

/** "Pendientes de hoy" (Inicio): una fila por pendiente con su acción directa. */
export async function TodayPanel({ items, dateLabel }: { items: PendingItem[]; dateLabel: string }) {
  const t = await getT();
  return (
    <section aria-labelledby="pendientes-hoy" className="card mb-6 overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3.5">
        <h2 id="pendientes-hoy" className="text-[0.95rem] font-semibold">
          {t("Pendientes de hoy")}
          {items.length > 0 && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{items.length}</span>}
        </h2>
        <span className="text-xs text-muted-foreground first-letter:uppercase">{dateLabel}</span>
      </header>
      {items.length === 0 ? (
        <p className="flex items-center gap-2.5 px-5 py-4 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-emerald-600" aria-hidden />
          {t("Todo al día: no hay nada pendiente en tus secciones.")}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((it, i) => {
            const Icon = ICON[it.kind];
            return (
              <li key={it.kind} className="viz-fade-in" style={{ "--viz-delay": `${Math.min(i * 30, 160)}ms` } as React.CSSProperties}>
                <Link
                  href={it.href}
                  className="group/row flex items-center gap-3.5 px-5 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset", TONE[it.tone])}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{it.title}</span>
                    {it.detail && <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                    {it.cta}
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 transition-[translate] duration-(--dur-state) ease-(--ease-out) group-hover/row:translate-x-0.5 motion-reduce:translate-x-0"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
