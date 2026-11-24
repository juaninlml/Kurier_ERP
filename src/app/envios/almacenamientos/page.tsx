import { Boxes, Plus, Printer, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { adminFinishLoad, createStorage, renameStorage, toggleStorage } from "@/app/actions/storage";
import { PageHeader, Panel, Empty, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Badge } from "@/components/ui/badge";
import { ACTIVE_LOAD, LOAD_STATUS } from "@/lib/route-load";
import { getSettings } from "@/lib/settings";
import { requestLocale } from "@/lib/request-lang";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Almacenamientos de reparto") };
}

export default async function StoragePage() {
  const t = await getT();
  const [units, loads, settings] = await Promise.all([
    prisma.storageUnit.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.routeLoad.findMany({
      where: { status: { in: ACTIVE_LOAD } },
      include: { storage: { select: { name: true, code: true } }, shipments: { select: { status: true, attempts: true } } },
      orderBy: { startedAt: "asc" },
    }),
    getSettings(),
  ]);
  const busy = new Set(loads.map((l) => l.storageId));
  const time = new Intl.DateTimeFormat(requestLocale(), { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", timeZone: settings.timezone || "America/Mexico_City" });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Almacenamientos de reparto"
        subtitle={t("Jaulas, cajas o compartimentos del transporte. El repartidor escanea su etiqueta, luego los paquetes que van dentro y cierra la carga.")}
        back={{ href: "/envios", label: t("Envíos") }}
        actions={
          units.some((u) => u.active) ? (
            <a href="/api/pdf/almacenamiento" target="_blank" className="btn-secondary">
              <Printer className="size-4" /> {t("Imprimir todas las etiquetas")}
            </a>
          ) : undefined
        }
      />

      <Panel className="mb-6" title={t("Rutas en curso")} description={t("Cargas abiertas o en reparto. Si un repartidor no pudo terminar la suya, termínala aquí: lo no entregado regresa al almacén.")}>
        {loads.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">{t("No hay rutas en curso.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Repartidor")}</th>
                  <th>{t("Almacenamiento")}</th>
                  <th>{t("Estatus")}</th>
                  <th>{t("Desde")}</th>
                  <th className="text-right">{t("Paquetes")}</th>
                  <th className="text-right">{t("Entregados")}</th>
                  <th className="text-right">{t("Pendientes")}</th>
                  <th>
                    <span className="sr-only">{t("Acciones")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l) => {
                  const delivered = l.shipments.filter((s) => s.status === "ENTREGADA").length;
                  const pending = l.shipments.filter((s) => s.status === "EN_RUTA").length;
                  return (
                    <tr key={l.id}>
                      <td className="font-medium">{l.driverName}</td>
                      <td>
                        {l.storage.name}
                        <div className="font-mono text-xs text-muted-foreground">{l.storage.code}</div>
                      </td>
                      <td>
                        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", l.status === "CARGANDO" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800")}>
                          {t(LOAD_STATUS[l.status] ?? l.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground tabular-nums">{time.format(l.startedAt)}</td>
                      <td className="text-right tabular-nums">{l.shipments.length}</td>
                      <td className="text-right text-emerald-700 tabular-nums">{delivered}</td>
                      <td className="text-right font-medium tabular-nums">{pending}</td>
                      <td className="text-right">
                        <Form action={adminFinishLoad.bind(null, l.id)}>
                          <ConfirmButton
                            message={t("¿Terminar la ruta de {v0}? Los {n} paquete(s) sin entregar regresan al almacén y su app se desbloquea.", { v0: l.driverName, n: pending })}
                            className="btn-secondary h-8 text-xs"
                          >
                            {t("Terminar ruta")}
                          </ConfirmButton>
                        </Form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title={t("Almacenamientos")}>
          {units.length === 0 ? (
            <Empty icon={Boxes}>{t("Aún no hay almacenamientos. Da de alta cada jaula o caja del transporte e imprime su etiqueta.")}</Empty>
          ) : (
            <ul className="divide-y">
              {units.map((u) => (
                <li key={u.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", !u.active && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <Form action={renameStorage.bind(null, u.id)} className="flex items-center gap-2">
                      <input name="name" defaultValue={u.name} maxLength={60} aria-label={t("Nombre")} className="input h-8 max-w-64 font-medium" />
                      <SubmitButton className="btn h-8 px-2 text-xs text-muted-foreground hover:bg-muted" pendingText="…">
                        {t("Guardar")}
                      </SubmitButton>
                    </Form>
                    <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      {u.code}
                      {busy.has(u.id) && (
                        <Badge variant="secondary" className="font-sans">
                          <Truck className="size-3" /> {t("En ruta")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <a href={`/api/pdf/almacenamiento?id=${u.id}`} target="_blank" className="btn-secondary h-8 text-xs">
                    <Printer className="size-3.5" /> {t("Etiqueta")}
                  </a>
                  <Form action={toggleStorage.bind(null, u.id)}>
                    <SubmitButton className="btn h-8 px-2.5 text-xs text-muted-foreground hover:bg-muted" pendingText="…">
                      {u.active ? t("Desactivar") : t("Activar")}
                    </SubmitButton>
                  </Form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("Nuevo almacenamiento")} description={t("El código se genera solo y va en la etiqueta.")}>
          <Form action={createStorage} resetOnSuccess className="space-y-3 p-5">
            <Field label="Nombre">
              <input name="name" required maxLength={60} className="input" placeholder={t("Ej. Jaula 1 · NP300")} />
            </Field>
            <SubmitButton className="btn-primary w-full">
              <Plus className="size-4" /> {t("Dar de alta")}
            </SubmitButton>
          </Form>
        </Panel>
      </div>
    </div>
  );
}
