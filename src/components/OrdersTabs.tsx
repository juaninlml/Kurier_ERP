import Link from "next/link";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

/** Pestañas de la sección: órdenes por oleada e insumos de empaque (comparten fecha). */
export async function OrdersTabs({ active, date }: { active: "ordenes" | "insumos"; date: string }) {
  const t = await getT();
  const tabs = [
    { id: "ordenes", label: t("Órdenes por oleada"), href: `/ordenes?fecha=${date}` },
    { id: "insumos", label: t("Insumos de empaque"), href: `/ordenes/insumos?fecha=${date}` },
  ] as const;
  return (
    <nav aria-label={t("Secciones de órdenes diarias")} className="mb-6 flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors duration-(--dur-feedback)",
            active === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Interruptor de vista dentro de una sección (Por día / Por cliente). */
export function ViewSwitch({ items, active }: { items: { id: string; label: string; href: string }[]; active: string }) {
  return (
    <div role="group" className="inline-flex rounded-lg border bg-muted/50 p-0.5">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.href}
          aria-current={active === i.id ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-[background-color,color,box-shadow] duration-(--dur-state) ease-(--ease-out)",
            active === i.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
