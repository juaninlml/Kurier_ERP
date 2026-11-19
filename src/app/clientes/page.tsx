import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/kit";
import { FilterBar } from "@/components/list";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /[A-Za-zÁÉÍÓÚÑ0-9]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getT();
  const { q = "" } = await searchParams;
  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { rfc: { contains: q, mode: "insensitive" as const } },
            { legalName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { invoices: { where: { status: { in: ["PENDIENTE", "PARCIAL"] } }, select: { total: true, paidTotal: true } } },
  });

  return (
    <div>
      <PageHeader
        title={t("Clientes")}
        subtitle={t("{n} cliente(s) registrados", { n: clients.length })}
        actions={
          <Link href="/clientes/nuevo" className="btn-primary">
            <Plus className="size-4" /> {t("Nuevo cliente")}
          </Link>
        }
      />
      <div className="card overflow-hidden">
        <FilterBar basePath="/clientes" q={q} placeholder="Buscar por nombre o RFC" />
        {clients.length === 0 ? (
          <Empty
            icon={Users}
            action={
              !q ? (
                <Link href="/clientes/nuevo" className="btn-primary">
                  <Plus className="size-4" /> {t("Dar de alta un cliente")}
                </Link>
              ) : undefined
            }
          >
            {q ? t("Ningún cliente coincide con la búsqueda.") : t("Aún no hay clientes.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Cliente")}</th>
                  <th>{t("RFC")}</th>
                  <th>{t("Contacto")}</th>
                  <th className="text-right">{t("Saldo por cobrar")}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const balance = c.invoices.reduce((a, i) => a + i.total - i.paidTotal, 0);
                  return (
                    <tr key={c.id} className={c.active ? "" : "opacity-60"}>
                      <td>
                        <Link href={`/clientes/${c.id}`} className="group flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(c.name) || "?"}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium group-hover:text-primary group-hover:underline">{c.name}</span>
                            {c.legalName && <span className="block truncate text-xs text-muted-foreground">{c.legalName}</span>}
                          </span>
                          {!c.active && <Badge variant="secondary">{t("Inactivo")}</Badge>}
                        </Link>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">{c.rfc || "—"}</td>
                      <td>
                        <div>{c.contactName || <span className="text-muted-foreground">—</span>}</div>
                        {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                      </td>
                      <td className="text-right font-medium tabular-nums">{balance > 0 ? formatMoney(balance) : <span className="text-muted-foreground">—</span>}</td>
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
