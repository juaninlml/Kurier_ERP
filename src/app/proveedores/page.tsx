import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/kit";
import { FilterBar } from "@/components/list";
import { Badge } from "@/components/ui/badge";
import { formatMoney, round2 } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { ExportButton } from "@/components/ExportButton";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Proveedores") };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /[A-Za-zÁÉÍÓÚÑ0-9]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getT();
  const { q = "" } = await searchParams;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [suppliers, paid, owed] = await Promise.all([
    prisma.supplier.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { rfc: { contains: q, mode: "insensitive" as const } },
              { legalName: { contains: q, mode: "insensitive" as const } },
              { category: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : undefined,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.transaction.groupBy({
      by: ["supplierId"],
      where: { type: "EGRESO", supplierId: { not: null }, date: { gte: yearStart } },
      _sum: { amount: true },
    }),
    prisma.supplierBill.groupBy({
      by: ["supplierId"],
      where: { status: { in: ["PENDIENTE", "PARCIAL"] } },
      _sum: { total: true, paidTotal: true },
    }),
  ]);
  const owedBy = new Map(owed.map((o) => [o.supplierId, round2((o._sum.total ?? 0) - (o._sum.paidTotal ?? 0))]));
  const paidBy = new Map(paid.map((p) => [p.supplierId, round2(p._sum.amount ?? 0)]));

  return (
    <div>
      <PageHeader
        title={t("Proveedores")}
        subtitle={t("{n} proveedor(es) registrados", { n: suppliers.length })}
        actions={
          <>
            <ExportButton kind="proveedores" />
            <Link href="/proveedores/nuevo" className="btn-primary">
              <Plus className="size-4" /> {t("Nuevo proveedor")}
            </Link>
          </>
        }
      />
      <div className="card overflow-hidden">
        <FilterBar basePath="/proveedores" q={q} placeholder={t("Buscar por nombre, RFC o giro")} />
        {suppliers.length === 0 ? (
          <Empty
            icon={Truck}
            action={
              !q ? (
                <Link href="/proveedores/nuevo" className="btn-primary">
                  <Plus className="size-4" /> {t("Dar de alta un proveedor")}
                </Link>
              ) : undefined
            }
          >
            {q ? t("Ningún proveedor coincide con la búsqueda.") : t("Aún no hay proveedores. Dalos de alta para ligar a cada uno sus egresos en Contabilidad.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Proveedor")}</th>
                  <th>{t("Giro")}</th>
                  <th>{t("RFC")}</th>
                  <th>{t("Contacto")}</th>
                  <th>{t("Crédito")}</th>
                  <th className="text-right">{t("Pagado este año")}</th>
                  <th className="text-right">{t("Por pagar")}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => {
                  const total = paidBy.get(s.id) ?? 0;
                  return (
                    <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                      <td>
                        <Link href={`/proveedores/${s.id}`} className="group flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-kurier/10 text-xs font-semibold text-kurier-600">
                            {initials(s.name) || "?"}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium group-hover:text-primary group-hover:underline">{s.name}</span>
                            {s.legalName && <span className="block truncate text-xs text-muted-foreground">{s.legalName}</span>}
                          </span>
                          {!s.active && <Badge variant="secondary">{t("Inactivo")}</Badge>}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{s.category ? t(s.category) : "—"}</td>
                      <td className="font-mono text-xs text-muted-foreground">{s.rfc || "—"}</td>
                      <td>
                        <div>{s.contactName || <span className="text-muted-foreground">—</span>}</div>
                        {(s.email || s.phone) && <div className="text-xs text-muted-foreground">{s.email || s.phone}</div>}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">{s.creditDays ? t("{n} días", { n: s.creditDays }) : t("Contado")}</td>
                      <td className="text-right tabular-nums">{total > 0 ? formatMoney(total) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="text-right font-medium tabular-nums">
                        {(owedBy.get(s.id) ?? 0) > 0 ? formatMoney(owedBy.get(s.id)!) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
