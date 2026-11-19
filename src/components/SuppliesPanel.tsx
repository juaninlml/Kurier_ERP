import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "./kit";
import { BarList } from "./charts";
import { formatMoney, formatNumber } from "@/lib/money";
import { marginPct, suppliesByMaterial } from "@/lib/supplies";
import { cn } from "@/lib/utils";

/**
 * Reportes → insumos de empaque del periodo: lo que costó lo consumido, lo que se vende al
 * cliente y el margen. Es información de gestión: la compra de bolsas se registra como egreso
 * en Contabilidad y la venta entra con las facturas (aquí no se duplica ningún movimiento).
 */
export async function SuppliesPanel({ from, to }: { from: string; to: string }) {
  const s = await suppliesByMaterial(from, to);
  if (!s.list.length) return null;
  const pct = marginPct(s.sale, s.cost);
  const kpis = [
    { l: "Costo consumido", v: formatMoney(s.cost), h: `${formatNumber(s.pieces)} piezas` },
    { l: "Venta al cliente", v: formatMoney(s.sale), h: s.sale ? "Sin IVA, a precio de lista" : "Sin precios de venta capturados" },
    { l: "Margen", v: formatMoney(s.margin), h: pct === null ? "—" : `${pct}% sobre la venta`, neg: s.margin < 0 },
  ];
  return (
    <Panel
      className="mb-6"
      title="Insumos de empaque"
      description="Costo de las bolsas y cajas usadas en el periodo contra lo que se cobra por ellas."
      action={
        <Link href="/ordenes/insumos" className="group/link inline-flex items-center gap-1 text-xs font-medium text-primary">
          Ver insumos
          <ArrowRight aria-hidden className="size-3.5 transition-[translate] duration-(--dur-state) ease-(--ease-out) group-hover/link:translate-x-0.5 motion-reduce:translate-x-0" />
        </Link>
      }
      bodyClassName="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
    >
      <dl className="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-5">
        {kpis.map((k) => (
          <div key={k.l}>
            <dt className="text-xs text-muted-foreground">{k.l}</dt>
            <dd className={cn("mt-0.5 text-xl font-semibold tracking-tight tabular-nums", k.neg && "text-rose-700")}>{k.v}</dd>
            <dd className="text-xs text-muted-foreground">{k.h}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">Costo por material</p>
        <BarList
          color="var(--chart-2)"
          total={s.cost || undefined}
          emptyText="Captura el costo de cada material en Insumos → Materiales."
          rows={s.list
            .filter((m) => m.cost > 0)
            .sort((a, b) => b.cost - a.cost)
            .map((m) => ({ key: String(m.id), label: m.name, value: m.cost, hint: `${formatNumber(m.qty)} pzas` }))}
        />
      </div>
    </Panel>
  );
}
