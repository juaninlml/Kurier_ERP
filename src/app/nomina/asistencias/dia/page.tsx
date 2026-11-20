import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { canManageUsers, getCurrentUser } from "@/lib/current-user";
import { addManualPunch, deletePunch } from "@/app/actions/attendance";
import { daySummary, localParts, mondayOf, PUNCH_LABEL, PUNCH_TYPES } from "@/lib/attendance";
import { PageHeader, Panel, Empty, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Badge } from "@/components/ui/badge";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";
import { requestLocale } from "@/lib/request-lang";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Asistencia del día") };
}

const SOURCE: Record<string, string> = { KIOSCO: "Kiosco", AUTO: "Automática", MANUAL: "Manual" };

export default async function AttendanceDayPage({ searchParams }: { searchParams: Promise<{ empleado?: string; fecha?: string }> }) {
  const t = await getT();
  const me = await getCurrentUser();
  const admin = canManageUsers(me.role);
  const { empleado, fecha } = await searchParams;
  const employeeId = Number(empleado);
  if (!employeeId || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const [e, s] = await Promise.all([prisma.employee.findUnique({ where: { id: employeeId } }), prisma.companySettings.findUniqueOrThrow({ where: { id: 1 } })]);
  if (!e) notFound();
  const tz = s.timezone || "America/Mexico_City";
  const [punches, ot] = await Promise.all([
    prisma.punch.findMany({ where: { employeeId, workDate: fecha }, orderBy: { at: "asc" }, include: { device: { select: { name: true } } } }),
    prisma.overtimeAuth.findUnique({ where: { employeeId_workDate: { employeeId, workDate: fecha } } }),
  ]);
  const { date: today, minutes: nowMin } = localParts(new Date(), tz);
  const valid = punches.filter((p) => !p.deleted);
  const sum = daySummary(valid, e, { dateStr: fecha, todayStr: today, nowMin, tz, toleranceMin: s.lateToleranceMin, otUntil: ot?.until, startDate: e.startDate });
  const time = (d: Date) => d.toLocaleTimeString(requestLocale(), { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const longDate = new Date(`${fecha}T12:00:00Z`).toLocaleDateString(requestLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={e.name} subtitle={<span className="capitalize">{longDate}</span>} back={{ href: `/nomina/asistencias?semana=${mondayOf(fecha)}`, label: t("Asistencias") }} />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {(
          [
            [t("Horario"), `${e.scheduleStart}–${e.scheduleEnd}`],
            [t("Horas trabajadas"), `${sum.workedHours.toFixed(2)} h`],
            [t("Comida"), sum.mealMin ? `${sum.mealMin} min` : "—"],
            [t("Horas extra"), ot ? t("{v0} h (hasta {v1})", { v0: (sum.overtimeMin / 60).toFixed(2), v1: ot.until }) : t("Sin autorización")],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="card px-4 py-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {sum.late && <Badge className="bg-rose-50 text-rose-700"><Tr>Retardo de</Tr> {sum.lateMin} <Tr>min</Tr></Badge>}
        {sum.status === "FALTA" && <Badge className="bg-rose-50 text-rose-700"><Tr>Falta</Tr></Badge>}
        {sum.autoExit && <Badge variant="secondary"><Tr>Salida automática</Tr></Badge>}
        {sum.earlyMin > 0 && <Badge className="bg-amber-50 text-amber-800"><Tr>Salió</Tr> {sum.earlyMin} <Tr>min antes</Tr></Badge>}
      </div>

      <Panel title="Checadas" className="mb-6">
        {punches.length === 0 ? (
          <Empty><Tr>Sin checadas este día.</Tr></Empty>
        ) : (
          <ul className="divide-y">
            {punches.map((p) => (
              <li key={p.id} className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${p.deleted ? "opacity-50" : ""}`}>
                <div>
                  <div className={`font-medium ${p.deleted ? "line-through" : ""}`}>
                    {time(p.at)} · <Tr>{PUNCH_LABEL[p.type] ?? p.type}</Tr>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Tr>{SOURCE[p.source] ?? p.source}</Tr>
                    {p.device ? ` · ${p.device.name}` : ""}
                    {p.note && ` · ${p.note}`}
                  </div>
                </div>
                {admin && !p.deleted && (
                  <Form action={deletePunch.bind(null, p.id)}>
                    <ConfirmButton message={t("¿Anular esta checada? Queda en el historial como anulada.")} className="btn-danger h-8 px-2">
                      <Trash2 className="size-3.5" />
                    </ConfirmButton>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {admin && (
        <Panel title="Agregar checada manual" description="Para olvidos o fallas del kiosco. Queda registrado quién la hizo y el motivo.">
          <Form action={addManualPunch} resetOnSuccess className="grid gap-3 p-5 sm:grid-cols-4">
            <input type="hidden" name="employeeId" value={e.id} />
            <input type="hidden" name="workDate" value={fecha} />
            <Field label="Tipo">
              <select name="type" className="input">
                {PUNCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    <Tr>{PUNCH_LABEL[t] ?? t}</Tr>
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hora">
              <input name="time" type="time" required className="input" />
            </Field>
            <Field label="Motivo *" className="sm:col-span-2">
              <input name="note" required className="input" placeholder={t("Ej. olvidó checar la salida")} />
            </Field>
            <div className="sm:col-span-4">
              <SubmitButton className="btn-primary"><Tr>Agregar</Tr></SubmitButton>
            </div>
          </Form>
        </Panel>
      )}
    </div>
  );
}
