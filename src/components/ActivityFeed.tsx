"use client";

import Link from "next/link";
import { Banknote, FileText, HandCoins, ReceiptText, UserPlus, ArrowLeftRight, type LucideIcon } from "lucide-react";
import type { ActivityItem, ActivityKind } from "@/lib/insights";
import { useLang, useT } from "./I18nProvider";
import { localeOf } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KIND: Record<ActivityKind, { icon: LucideIcon; label: string; tone: string }> = {
  factura: { icon: ReceiptText, label: "Factura emitida", tone: "bg-blue-50 text-blue-700" },
  cotizacion: { icon: FileText, label: "Cotización creada", tone: "bg-violet-50 text-violet-700" },
  pago: { icon: Banknote, label: "Pago recibido", tone: "bg-emerald-50 text-emerald-700" },
  movimiento: { icon: ArrowLeftRight, label: "Movimiento registrado", tone: "bg-slate-100 text-slate-700" },
  nomina: { icon: HandCoins, label: "Nómina", tone: "bg-amber-50 text-amber-800" },
  cliente: { icon: UserPlus, label: "Cliente nuevo", tone: "bg-teal-50 text-teal-700" },
};

function relative(at: Date, now: number, locale: string) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const s = Math.round((at.getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(0, "minute");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), "day");
  return at.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** Línea de tiempo con los últimos registros del sistema. */
export function ActivityFeed({ items, now }: { items: ActivityItem[]; now: number }) {
  const t = useT();
  const locale = localeOf(useLang());
  const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <ol className="relative">
      {items.map((it, i) => {
        const k = KIND[it.kind];
        const Icon = k.icon;
        let label = t(k.label);
        let title = it.title;
        let detail = it.detail;
        if (it.kind === "nomina") {
          const [a, b] = it.detail.split("|");
          label = it.title === "PAGADA" ? t("Nómina pagada") : it.title === "APROBADA" ? t("Nómina aprobada") : t("Nómina en borrador");
          title = `${day(a!)} – ${day(b!)}`;
          detail = "";
        }
        if (it.kind === "movimiento") label = it.sign === 1 ? t("Ingreso registrado") : t("Egreso registrado");
        return (
          <li key={it.id} className="relative">
            {i < items.length - 1 && <span aria-hidden className="absolute top-10 bottom-0 left-[1.65rem] w-px bg-border" />}
            <Link
              href={it.href}
              className="group flex items-start gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <span className={cn("relative z-[1] mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-card", k.tone)}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm">
                    <span className="text-muted-foreground">{label}</span> <span className="font-medium group-hover:text-primary">{title}</span>
                  </span>
                  {it.amount !== undefined && it.amount > 0 && (
                    <span className={cn("shrink-0 text-sm font-medium tabular-nums", it.sign === 1 && "text-emerald-700", it.sign === -1 && "text-rose-700")}>
                      {it.sign === 1 ? "+" : it.sign === -1 ? "−" : ""}
                      {money.format(it.amount)}
                    </span>
                  )}
                </span>
                <span className="flex justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">{detail}</span>
                  <time dateTime={it.at.toISOString()} className="shrink-0" title={it.at.toLocaleString(locale)} suppressHydrationWarning>
                    {relative(it.at, now, locale)}
                  </time>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
