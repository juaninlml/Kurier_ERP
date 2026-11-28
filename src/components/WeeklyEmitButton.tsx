"use client";

import { useState, useTransition } from "react";
import { CircleAlert, Send } from "lucide-react";
import { useT } from "./I18nProvider";
import { emitWeeklyInvoices } from "@/app/actions/invoices";
import { cn } from "@/lib/utils";

/** Emite las facturas semanales de los clientes indicados (pide confirmación). */
export function WeeklyEmitButton({ week, clientIds, total, label, confirmText, small }: { week: string; clientIds: number[]; total: string; label: string; confirmText: string; small?: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!clientIds.length) return null;
  return (
    <div className={cn("flex flex-col items-end gap-1", small && "inline-flex")}>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`${confirmText}\n${t("Total con IVA")}: ${total}`)) return;
          setError(null);
          start(async () => {
            const r = await emitWeeklyInvoices(week, clientIds);
            if (r && "error" in r) setError(r.error);
          });
        }}
        className={small ? "btn-secondary h-8 px-2.5 text-xs" : "btn-primary"}
      >
        <Send className={small ? "size-3.5" : "size-4"} /> {pending ? t("Emitiendo…") : label}
      </button>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
          <CircleAlert className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
