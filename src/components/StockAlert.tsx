import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatNumber } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import type { stockAlerts } from "@/lib/inventory";

/** Aviso de insumos de empaque por agotarse o agotados (Inicio y captura de insumos). */
export async function StockAlert({ alerts, className }: { alerts: Awaited<ReturnType<typeof stockAlerts>>; className?: string }) {
  if (!alerts.length) return null;
  const t = await getT();
  return (
    <Alert className={`border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 ${className ?? ""}`}>
      <TriangleAlert />
      <AlertTitle>{t("{n} insumo(s) por agotarse o agotados", { n: alerts.length })}</AlertTitle>
      <AlertDescription className="text-amber-950/80 dark:text-amber-100/80">
        <p>
          {alerts
            .map((a) =>
              a.status === "out"
                ? t("{v0}: agotado", { v0: a.name })
                : `${t("{v0}: quedan {n} pzas.", { v0: a.name, n: formatNumber(a.stock) })}${a.days !== null ? ` (${t("≈ {n} días hábiles", { n: a.days })})` : ""}`,
            )
            .join(" · ")}
        </p>
        <Link href="/ordenes/inventario" className="font-medium underline underline-offset-2">
          {t("Ver inventario")}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
