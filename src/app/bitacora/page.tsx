import Link from "next/link";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/kit";
import { ExportButton } from "@/components/ExportButton";
import { getSettings } from "@/lib/settings";
import { requestLocale } from "@/lib/request-lang";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { MODULE_LABEL } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Bitácora") };
}

const PAGE = 100;

const ACTION_TONE: Record<string, string> = {
  Creó: "bg-emerald-50 text-emerald-700",
  Pagó: "bg-emerald-50 text-emerald-700",
  "Registró pago": "bg-emerald-50 text-emerald-700",
  Modificó: "bg-sky-50 text-sky-700",
  Reactivó: "bg-sky-50 text-sky-700",
  Canceló: "bg-amber-50 text-amber-800",
  Eliminó: "bg-rose-50 text-rose-700",
  Exportó: "bg-violet-50 text-violet-700",
};

type SP = { modulo?: string; usuario?: string; desde?: string; hasta?: string; q?: string; antes?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const t = await getT();
  const sp = await searchParams;
  const settings = await getSettings();
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.modulo && MODULE_LABEL[sp.modulo] ? { module: sp.modulo } : {}),
    ...(Number(sp.usuario) ? { userId: Number(sp.usuario) } : {}),
    ...(sp.q ? { summary: { contains: sp.q, mode: "insensitive" } } : {}),
    ...(sp.desde || sp.hasta
      ? {
          at: {
            ...(/^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "") ? { gte: new Date(`${sp.desde}T00:00:00-06:00`) } : {}),
            ...(/^\d{4}-\d{2}-\d{2}$/.test(sp.hasta ?? "") ? { lte: new Date(`${sp.hasta}T23:59:59-06:00`) } : {}),
          },
        }
      : {}),
  };
  const before = Number(sp.antes) || 0;
  const [rows, users] = await Promise.all([
    prisma.auditLog.findMany({ where: { ...where, ...(before ? { id: { lt: before } } : {}) }, orderBy: { id: "desc" }, take: PAGE + 1 }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const fmt = new Intl.DateTimeFormat(requestLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: settings.timezone || "America/Mexico_City",
  });
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const filtered = !!(sp.modulo || sp.usuario || sp.q || sp.desde || sp.hasta);

  return (
    <div>
      <PageHeader
        title={t("Bitácora")}
        subtitle={t("Quién creó, modificó, canceló o eliminó cada registro, y cuándo.")}
        actions={<ExportButton kind="bitacora" params={{ desde: sp.desde, hasta: sp.hasta, modulo: sp.modulo }} />}
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          <span className="label">{t("Sección")}</span>
          <select name="modulo" defaultValue={sp.modulo ?? ""} className="input w-44">
            <option value="">{t("Todas")}</option>
            {Object.entries(MODULE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">{t("Usuario")}</span>
          <select name="usuario" defaultValue={sp.usuario ?? ""} className="input w-48">
            <option value="">{t("Todos")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">{t("Desde")}</span>
          <input type="date" name="desde" defaultValue={sp.desde} className="input" />
        </label>
        <label>
          <span className="label">{t("Hasta")}</span>
          <input type="date" name="hasta" defaultValue={sp.hasta} className="input" />
        </label>
        <label className="min-w-48 flex-1">
          <span className="label">{t("Buscar")}</span>
          <input name="q" defaultValue={sp.q} className="input" placeholder={t("Folio, cliente, monto…")} />
        </label>
        <button className="btn-secondary">{t("Filtrar")}</button>
        {filtered && (
          <Link href="/bitacora" className="btn h-9 text-muted-foreground hover:text-foreground">
            {t("Quitar filtros")}
          </Link>
        )}
      </form>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <Empty icon={History}>{filtered ? t("Nada coincide con el filtro.") : t("Aún no hay cambios registrados. A partir de ahora cada cambio queda anotado aquí.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Cuándo")}</th>
                  <th>{t("Usuario")}</th>
                  <th>{t("Acción")}</th>
                  <th>{t("Sección")}</th>
                  <th>{t("Detalle")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-muted-foreground tabular-nums">{fmt.format(r.at)}</td>
                    <td className="whitespace-nowrap">{r.userName || "—"}</td>
                    <td>
                      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", ACTION_TONE[r.action] ?? "bg-muted text-muted-foreground")}>{t(r.action)}</span>
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">{t(MODULE_LABEL[r.module] ?? r.module)}</td>
                    <td className="max-w-[32rem]">
                      {r.href ? (
                        <Link href={r.href} className="hover:text-primary hover:underline">
                          {r.summary || `${r.fnName}${r.entityId ? ` #${r.entityId}` : ""}`}
                        </Link>
                      ) : (
                        <span>{r.summary || `${r.fnName}${r.entityId ? ` #${r.entityId}` : ""}`}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(before > 0 || more) && (
        <nav className="mt-4 flex items-center justify-between" aria-label={t("Páginas")}>
          {before > 0 ? (
            <Link href={`/bitacora${qs({ antes: undefined })}`} className="btn-secondary">
              <ChevronLeft className="size-4" /> {t("Más recientes")}
            </Link>
          ) : (
            <span />
          )}
          {more && (
            <Link href={`/bitacora${qs({ antes: String(list[list.length - 1].id) })}`} className="btn-secondary">
              {t("Anteriores")} <ChevronRight className="size-4" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
