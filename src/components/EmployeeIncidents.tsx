import { AlarmClock, Ban, Check, CalendarX2, FileCheck2, Palmtree, Trash2, X } from "lucide-react";
import type { Employee } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createIncident, decideIncident, deleteIncident, justifyIncident, moveLateRest } from "@/app/actions/incidents";
import { INCIDENT_LABEL, LATES_PER_REST, incidentFolio, monthLates, rangeLabel, shortDate } from "@/lib/incidents";
import { localParts } from "@/lib/attendance";
import { formatNumber } from "@/lib/money";
import { Panel, Empty } from "./kit";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { ConfirmButton } from "./ConfirmButton";
import { PdfLink } from "./list";
import { IncidentForm } from "./IncidentForm";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const TONE: Record<string, string> = {
  FALTA: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  DESCANSO_RETARDOS: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  PERMISO: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  VACACIONES: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};
const STATUS: Record<string, [string, string]> = {
  PENDIENTE: ["Pendiente", "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"],
  AUTORIZADA: ["Autorizada", "bg-muted text-muted-foreground"],
  RECHAZADA: ["No autorizada", "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"],
};

/** Faltas, permisos, vacaciones y descansos por retardos del empleado, con sus formatos en PDF. */
export async function EmployeeIncidents({ e, unjustifiedYear }: { e: Employee; unjustifiedYear: number }) {
  const t = await getT();
  const cfg = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const today = localParts(new Date(), cfg?.timezone || "America/Mexico_City").date;
  const year = today.slice(0, 4);
  const [list, lates] = await Promise.all([
    prisma.incident.findMany({ where: { employeeId: e.id }, orderBy: [{ startDate: "desc" }, { id: "desc" }], take: 150 }),
    e.kioskSecret ? monthLates(e.id, today.slice(0, 7), today) : Promise.resolve([] as string[]),
  ]);
  const thisYear = list.filter((i) => i.startDate.startsWith(year) && i.status === "AUTORIZADA");
  const sum = (type: string, pred: (i: (typeof list)[number]) => boolean = () => true) => thisYear.filter((i) => i.type === type && pred(i)).reduce((a, i) => a + i.days, 0);
  const pending = list.filter((i) => i.status === "PENDIENTE").length;
  const toward = lates.length % LATES_PER_REST;

  const stats: [string, string, string, string][] = [
    [t("Faltas injustificadas {v0}", { v0: year }), formatNumber(unjustifiedYear), t("En nóminas · restan días del aguinaldo"), "text-rose-700 dark:text-rose-300"],
    [t("Descansos por retardos"), formatNumber(sum("DESCANSO_RETARDOS")), t("Incluidos en las faltas injustificadas"), ""],
    [t("Permisos / faltas justificadas"), formatNumber(sum("PERMISO")), t("{v0} sin goce", { v0: formatNumber(sum("PERMISO", (i) => !i.withPay)) }), ""],
    [t("Vacaciones autorizadas"), formatNumber(sum("VACACIONES")), t("Días en {v0}", { v0: year }), ""],
  ];

  return (
    <Panel
      title="Faltas, permisos y vacaciones"
      description={t("Cada {v0} retardos en el mes = 1 día de descanso sin goce la semana siguiente (cuenta como falta injustificada). Los formatos salen en PDF para firma.", { v0: LATES_PER_REST })}
      action={pending ? <Badge className="border-transparent bg-amber-100 text-amber-900">{t("{v0} por autorizar", { v0: pending })}</Badge> : undefined}
    >
      <div className="grid gap-px border-b bg-border sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([k, v, hint, cls]) => (
          <div key={k} className="bg-card px-5 py-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className={cn("text-xl font-semibold tabular-nums", cls)}>{v}</div>
            <div className="text-[11px] text-muted-foreground">{hint}</div>
          </div>
        ))}
        <div className="bg-card px-5 py-3 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlarmClock className="size-3.5" /> {t("Retardos del mes")}
          </div>
          {e.kioskSecret ? (
            <>
              <div className="flex items-center gap-1.5 py-1.5" role="img" aria-label={t("{v0} de {v1} retardos", { v0: toward, v1: LATES_PER_REST })}>
                {Array.from({ length: LATES_PER_REST }, (_, k) => (
                  <span key={k} className={cn("h-2.5 flex-1 rounded-full", k < toward ? "bg-orange-500" : "bg-muted")} />
                ))}
                <span className="ml-1 text-sm font-semibold tabular-nums">
                  {toward}/{LATES_PER_REST}
                </span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{lates.length ? `${t("{v0} en el mes", { v0: lates.length })}: ${lates.map(shortDate).join(", ")}` : t("Sin retardos este mes")}</div>
            </>
          ) : (
            <div className="pt-1 text-[11px] text-muted-foreground">{t("Se cuentan cuando checa en el kiosco.")}</div>
          )}
        </div>
      </div>

      <IncidentForm action={createIncident.bind(null, e.id)} today={today} />

      {list.length === 0 ? (
        <Empty icon={Palmtree}>{t("Sin faltas, permisos ni vacaciones registrados.")}</Empty>
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Folio")}</th>
                <th>{t("Tipo")}</th>
                <th>{t("Fechas")}</th>
                <th className="text-right">{t("Días")}</th>
                <th>{t("Estatus")}</th>
                <th className="text-right">
                  <span className="sr-only">{t("Acciones")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const [statusLabel, statusCls] = STATUS[i.status] ?? STATUS.AUTORIZADA;
                const rest = i.type === "DESCANSO_RETARDOS";
                return (
                  <tr key={i.id} className={i.status === "RECHAZADA" ? "opacity-60" : ""}>
                    <td className="font-mono text-xs whitespace-nowrap">{incidentFolio(i)}</td>
                    <td>
                      <Badge variant="outline" className={cn("border-transparent whitespace-nowrap", TONE[i.type])}>
                        {t(INCIDENT_LABEL[i.type] ?? i.type)}
                      </Badge>
                      <div className="mt-0.5 max-w-64 text-[11px] text-muted-foreground">
                        {[i.type === "PERMISO" ? (i.withPay ? t("Con goce") : t("Sin goce")) : "", i.reason, i.source === "KIOSCO" && !i.reason ? t("Detectada por el kiosco") : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{rangeLabel(i.startDate, i.endDate)}</td>
                    <td className="text-right tabular-nums">{formatNumber(i.days)}</td>
                    <td>
                      <Badge variant="outline" className={cn("border-transparent", statusCls)}>
                        {rest && i.status === "RECHAZADA" ? t("Perdonado") : t(statusLabel)}
                      </Badge>
                      {i.source === "HISTORICO" && (
                        <Badge variant="outline" className="ml-1 border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" title={t("Capturado al migrar: no entra a la nómina")}>
                          {t("Histórico")}
                        </Badge>
                      )}
                      {i.decidedBy && i.status !== "PENDIENTE" && <div className="mt-0.5 text-[11px] text-muted-foreground">{i.decidedBy}</div>}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {i.status === "PENDIENTE" && (
                          <>
                            <Form action={decideIncident.bind(null, i.id, true)}>
                              <SubmitButton className="btn-primary h-8 px-2.5 text-xs" pendingText="…">
                                <Check className="size-3.5" /> {t("Autorizar")}
                              </SubmitButton>
                            </Form>
                            <Form action={decideIncident.bind(null, i.id, false)}>
                              <SubmitButton className="btn-secondary h-8 px-2.5 text-xs" pendingText="…">
                                <X className="size-3.5" /> {t("Rechazar")}
                              </SubmitButton>
                            </Form>
                          </>
                        )}
                        {i.type === "FALTA" && (
                          <details className="relative">
                            <summary className="btn-secondary h-8 cursor-pointer list-none px-2.5 text-xs [&::-webkit-details-marker]:hidden">
                              <FileCheck2 className="size-3.5" /> {t("Justificar")}
                            </summary>
                            <Form action={justifyIncident.bind(null, i.id)} className="absolute right-0 z-20 mt-1 w-72 space-y-2 rounded-lg border bg-popover p-3 shadow-lg">
                              <input name="reason" required className="input h-8 text-sm" placeholder={t("Motivo (ej. incapacidad IMSS)")} aria-label={t("Motivo")} />
                              <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name="withPay" /> {t("Con goce de sueldo")}
                              </label>
                              <SubmitButton className="btn-primary h-8 w-full text-xs" pendingText={t("Guardando…")}>
                                {t("Pasar a falta justificada")}
                              </SubmitButton>
                            </Form>
                          </details>
                        )}
                        {rest && i.status === "AUTORIZADA" && (
                          <>
                            <details className="relative">
                              <summary className="btn-secondary h-8 cursor-pointer list-none px-2.5 text-xs [&::-webkit-details-marker]:hidden">
                                <CalendarX2 className="size-3.5" /> {t("Cambiar día")}
                              </summary>
                              <Form action={moveLateRest.bind(null, i.id)} className="absolute right-0 z-20 mt-1 flex w-64 gap-2 rounded-lg border bg-popover p-3 shadow-lg">
                                <input type="date" name="date" required defaultValue={i.startDate} className="input h-8" aria-label={t("Día de descanso")} />
                                <SubmitButton className="btn-primary h-8 text-xs" pendingText="…">
                                  {t("Guardar")}
                                </SubmitButton>
                              </Form>
                            </details>
                            <Form action={decideIncident.bind(null, i.id, false)}>
                              <ConfirmButton message={t("¿Perdonar este descanso por retardos? Ya no se descontará ni contará como falta.")} className="btn-secondary h-8 px-2.5 text-xs">
                                <Ban className="size-3.5" /> {t("Perdonar")}
                              </ConfirmButton>
                            </Form>
                          </>
                        )}
                        <PdfLink href={`/api/pdf/incidencia/${i.id}`} label={t("Formato (PDF)")} />
                        {!rest && (
                          <Form action={deleteIncident.bind(null, i.id)}>
                            <ConfirmButton
                              message={t("¿Eliminar {v0}? Si ya entró en una nómina en borrador, usa «Actualizar incidencias» en esa nómina.", { v0: incidentFolio(i) })}
                              className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">{t("Eliminar")}</span>
                            </ConfirmButton>
                          </Form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
