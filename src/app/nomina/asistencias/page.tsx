import Link from "next/link";
import { headers } from "next/headers";
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, Hourglass, MonitorSmartphone, Plus, Timer, Trash2, UserCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManageUsers } from "@/lib/current-user";
import { authorizeOvertime, createKioskDevice, deactivateKioskDevice, deleteOvertime, saveAttendanceSettings } from "@/app/actions/attendance";
import { addDaysStr, autoCloseShifts, daySummary, localParts, mondayOf, toMin } from "@/lib/attendance";
import { PageHeader, Panel, Empty, Field, Stat } from "@/components/kit";
import { Legend, TodayBoard, WeekGrid, type DayCell, type EmployeeWeek } from "@/components/AttendanceBoard";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/ui/badge";
import { qrSvg } from "@/lib/totp";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";
import { requestLocale } from "@/lib/request-lang";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Asistencias") };
}

const DAY = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const t = await getT();
  const me = await getCurrentUser();
  const admin = canManageUsers(me.role);
  await autoCloseShifts();
  const s = await prisma.companySettings.findUniqueOrThrow({ where: { id: 1 } });
  const tz = s.timezone || "America/Mexico_City";
  const now = new Date();
  const { date: today, minutes: nowMin } = localParts(now, tz);
  const { semana } = await searchParams;
  const monday = mondayOf(semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today);
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
  const sunday = days[6];

  const [employees, punches, auths, devices, h] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.punch.findMany({ where: { deleted: false, workDate: { gte: monday, lte: sunday } }, orderBy: { at: "asc" } }),
    prisma.overtimeAuth.findMany({ where: { workDate: { gte: monday, lte: sunday } }, include: { employee: { select: { name: true } } }, orderBy: { workDate: "asc" } }),
    admin ? prisma.kioskDevice.findMany({ orderBy: { createdAt: "desc" } }) : [],
    headers(),
  ]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const qrs = new Map(
    await Promise.all(
      devices
        .filter((d) => d.active && d.activationToken)
        .map(async (d) => [d.id, await qrSvg(`${origin}/kiosco/activar/${d.activationToken}`)] as const),
    ),
  );
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(requestLocale(), { day: "numeric", month: "short", timeZone: "UTC" });
  const localMin = (d?: { at: Date }) => (d ? Math.round(localParts(d.at, tz).minutes) : null);

  const rows: EmployeeWeek[] = employees.map((e) => {
    const schedStart = toMin(e.scheduleStart);
    const schedEnd = toMin(e.scheduleEnd);
    const dayHours = Math.max(0, schedEnd - schedStart - Math.max(0, toMin(e.mealEnd) - toMin(e.mealStart))) / 60;
    let hours = 0,
      scheduledHours = 0,
      lates = 0,
      absences = 0,
      otMin = 0;
    const cells: DayCell[] = days.map((d) => {
      const auth = auths.find((a) => a.employeeId === e.id && a.workDate === d);
      const sum = daySummary(
        punches.filter((p) => p.employeeId === e.id && p.workDate === d),
        e,
        { dateStr: d, todayStr: today, nowMin, tz, toleranceMin: s.lateToleranceMin, otUntil: auth?.until, startDate: e.startDate },
      );
      hours += sum.workedHours;
      if (sum.status !== "DESCANSO") scheduledHours += dayHours;
      if (sum.late) lates++;
      if (sum.status === "FALTA") absences++;
      otMin += sum.overtimeMin;
      return {
        date: d,
        status: sum.status,
        schedStart,
        schedEnd,
        inMin: localMin(sum.entrada),
        outMin: localMin(sum.salida),
        mealFrom: localMin(sum.comida),
        mealTo: localMin(sum.regreso),
        otUntil: auth ? toMin(auth.until) : null,
        workedHours: sum.workedHours,
        lateMin: sum.lateMin,
        late: sum.late,
        earlyMin: sum.earlyMin,
        overtimeMin: sum.overtimeMin,
        autoExit: sum.autoExit,
        atMeal: !!sum.comida && !sum.regreso && !sum.salida,
      };
    });
    return {
      id: e.id,
      name: e.name,
      detail: [e.position, e.area].filter(Boolean).join(" · "),
      schedule: `${e.scheduleStart}–${e.scheduleEnd}`,
      noKiosk: !e.kioskSecret,
      cells,
      hours: Math.round(hours * 100) / 100,
      scheduledHours,
      lates,
      absences,
      otMin,
    };
  });

  // Resumen de la semana (solo días que ya debían trabajarse)
  const allCells = rows.flatMap((r) => r.cells);
  const due = allCells.filter((c) => c.status === "OK" || c.status === "EN_CURSO" || c.status === "FALTA");
  const attended = due.filter((c) => c.status !== "FALTA");
  const onTime = attended.filter((c) => !c.late);
  const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const workedTotal = rows.reduce((a, r) => a + r.hours, 0);
  const dueHours = rows.reduce((a, r, i) => {
    const e = employees[i]!;
    const dayHours = Math.max(0, toMin(e.scheduleEnd) - toMin(e.scheduleStart) - Math.max(0, toMin(e.mealEnd) - toMin(e.mealStart))) / 60;
    return a + r.cells.filter((c) => c.status === "OK" || c.status === "EN_CURSO" || c.status === "FALTA").length * dayHours;
  }, 0);
  const absencesTotal = rows.reduce((a, r) => a + r.absences, 0);
  const latesTotal = rows.reduce((a, r) => a + r.lates, 0);
  const otTotal = rows.reduce((a, r) => a + r.otMin, 0) / 60;
  const todayIdx = days.indexOf(today);
  const dayLabels = days.map((d, i) => `${t(DAY[i]!)} ${fmtDay(d).split(" ")[0]}`);

  return (
    <div>
      <PageHeader
        title="Asistencias"
        subtitle="Checadas del kiosco: entrada, comida y salida. Sin horas extra autorizadas, la salida se registra sola 5 min después del horario."
        back={{ href: "/nomina", label: t("Nómina") }}
        actions={
          <a href="/kiosco" target="_blank" className="btn-secondary">
            <MonitorSmartphone className="size-4" /> <Tr>Abrir kiosco</Tr>
          </a>
        }
      />

      {employees.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat label="Asistencia" value={rate(attended.length, due.length)} icon={UserCheck} hint={absencesTotal ? t("{v0} falta(s) en la semana", { v0: absencesTotal }) : "Sin faltas en la semana"} />
          <Stat label="Puntualidad" value={rate(onTime.length, attended.length)} icon={CalendarCheck} hint={latesTotal ? `${latesTotal} retardo(s)` : "Sin retardos"} />
          <Stat
            label="Horas trabajadas"
            value={`${workedTotal.toFixed(1)} h`}
            icon={Clock}
            hint={dueHours ? t("de {v0} h programadas a la fecha ({v1})", { v0: dueHours.toFixed(0), v1: rate(workedTotal, dueHours) }) : "Aún no hay días por trabajar"}
          />
          <Stat label="Horas extra" value={`${otTotal.toFixed(1)} h`} icon={Hourglass} hint={t("{v0} autorización(es) esta semana", { v0: auths.length })} />
        </div>
      )}

      {todayIdx >= 0 && employees.length > 0 && (
        <Panel
          className="mb-6"
          title="Hoy en el almacén"
          description={t("{v0} · se actualiza al recargar la página", { v0: fmtDay(today) })}
          action={
            <Link href="/nomina/asistencias" className="btn-secondary h-8 text-xs">
              <Tr>Actualizar</Tr>
            </Link>
          }
          bodyClassName="p-5"
        >
          <TodayBoard rows={rows.map((r) => ({ id: r.id, name: r.name, cell: r.cells[todayIdx]! }))} nowMin={Math.round(nowMin)} />
        </Panel>
      )}

      <Panel
        className="mb-6"
        title={t("Semana del {v0} al {v1}", { v0: fmtDay(monday), v1: fmtDay(sunday) })}
        description="Cada barra es un día sobre el mismo eje de horas. Pasa el cursor para ver las checadas; da clic para corregirlas."
        action={
          <div className="flex gap-1">
            <Link href={`/nomina/asistencias?semana=${addDaysStr(monday, -7)}`} className="btn-secondary h-8 px-2" aria-label={t("Semana anterior")}>
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/nomina/asistencias" className="btn-secondary h-8 text-xs">
              <Tr>Hoy</Tr>
            </Link>
            <Link href={`/nomina/asistencias?semana=${addDaysStr(monday, 7)}`} className="btn-secondary h-8 px-2" aria-label={t("Semana siguiente")}>
              <ChevronRight className="size-4" />
            </Link>
          </div>
        }
      >
        {employees.length === 0 ? (
          <Empty icon={Clock}><Tr>No hay empleados activos.</Tr></Empty>
        ) : (
          <>
            <div className="border-b px-5 py-3">
              <Legend />
            </div>
            <WeekGrid rows={rows} days={days} dayLabels={dayLabels} today={today} nowMin={Math.round(nowMin)} />
          </>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Horas extra autorizadas" description="Sin autorización, después de la hora de salida no se pueden registrar horas extra.">
          {admin && (
            <Form action={authorizeOvertime} resetOnSuccess className="grid gap-3 border-b p-5 sm:grid-cols-2">
              <Field label="Empleado">
                <select name="employeeId" required className="input" defaultValue="">
                  <option value="" disabled>
                    {t("Elegir…")}
                  </option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {t("(sale")} {e.scheduleEnd})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Día">
                <input name="workDate" type="date" required defaultValue={today} className="input" />
              </Field>
              <Field label="Puede quedarse hasta">
                <input name="until" type="time" required className="input" />
              </Field>
              <Field label="Motivo">
                <input name="note" className="input" placeholder={t("Ej. cierre de pedidos")} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton className="btn-primary">
                  <Timer className="size-4" /> <Tr>Autorizar</Tr>
                </SubmitButton>
              </div>
            </Form>
          )}
          {auths.length === 0 ? (
            <Empty icon={Timer}><Tr>Sin horas extra autorizadas esta semana.</Tr></Empty>
          ) : (
            <ul className="divide-y">
              {auths.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{a.employee.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDay(a.workDate)} <Tr>· hasta</Tr> {a.until}
                      {a.note && ` · ${a.note}`}
                    </div>
                  </div>
                  {admin && (
                    <Form action={deleteOvertime.bind(null, a.id)}>
                      <ConfirmButton message={t("¿Quitar esta autorización de horas extra?")} className="btn-danger h-8 px-2">
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
          <div className="space-y-6">
            <Panel title="Kioscos (tablets)" description="Escanea el QR con la tablet, o abre /kiosco en ella y autorízala con tu código. Queda como kiosco aunque nadie inicie sesión.">
              <Form action={createKioskDevice} resetOnSuccess className="flex flex-wrap items-end gap-2 border-b p-5">
                <Field label="Nombre de la tablet" className="min-w-48 flex-1">
                  <input name="name" required className="input" placeholder={t("Tablet entrada almacén")} />
                </Field>
                <SubmitButton className="btn-primary">
                  <Plus className="size-4" /> <Tr>Generar QR</Tr>
                </SubmitButton>
              </Form>
              {devices.length === 0 ? (
                <Empty icon={MonitorSmartphone}><Tr>Aún no hay tablets autorizadas.</Tr></Empty>
              ) : (
                <ul className="divide-y">
                  {devices.map((d) => (
                    <li key={d.id} className="space-y-2 px-5 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {d.activationToken ? t("Pendiente de escanear el QR en la tablet") : d.lastSeenAt ? t("Activa · última conexión {v0}", { v0: d.lastSeenAt.toLocaleString("es-MX", { timeZone: tz, dateStyle: "short", timeStyle: "short" }) }) : t("Autorizada")}
                          </div>
                        </div>
                        {d.active ? (
                          <Form action={deactivateKioskDevice.bind(null, d.id)}>
                            <ConfirmButton message={t("¿Desactivar {v0}? Dejará de funcionar como kiosco.", { v0: d.name })} className="btn-danger h-8 text-xs">
                              <Tr>Desactivar</Tr>
                            </ConfirmButton>
                          </Form>
                        ) : (
                          <Badge variant="secondary"><Tr>Desactivada</Tr></Badge>
                        )}
                      </div>
                      {d.active && d.activationToken && qrs.get(d.id) && (
                        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
                          <div className="size-32 shrink-0 rounded-md bg-white p-1.5 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qrs.get(d.id)! }} />
                          <p className="text-xs text-muted-foreground">
                            <Tr>Escanea este QR con la</Tr> <span className="font-medium text-foreground"><Tr>cámara de la tablet</Tr></span> <Tr>y toca «Autorizar». También puedes abrir</Tr> <span className="font-mono">/kiosco</span> <Tr>en la tablet y autorizarla con tu código del autenticador.</Tr>
                          </p>
                        </div>
                      )}
                      {d.active && d.activationToken && (
                        <div className="flex items-center gap-2">
                          <input readOnly value={`${origin}/kiosco/activar/${d.activationToken}`} className="input h-8 min-w-0 flex-1 font-mono text-xs" aria-label={t("Link de autorización")} />
                          <CopyButton value={`${origin}/kiosco/activar/${d.activationToken}`} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Reglas de asistencia">
              <Form action={saveAttendanceSettings} className="grid gap-3 p-5 sm:grid-cols-3">
                <Field label="Tolerancia de retardo (min)">
                  <input name="lateToleranceMin" type="number" min="0" defaultValue={s.lateToleranceMin} className="input text-right" />
                </Field>
                <Field label="Salida automática (min después)">
                  <input name="autoCloseMin" type="number" min="0" defaultValue={s.autoCloseMin} className="input text-right" />
                </Field>
                <Field label="Pago de horas extra (× hora)">
                  <input name="overtimeRate" type="number" min="1" step="0.5" defaultValue={s.overtimeRate} className="input text-right" />
                </Field>
                <div className="sm:col-span-3">
                  <SubmitButton className="btn-secondary"><Tr>Guardar reglas</Tr></SubmitButton>
                </div>
              </Form>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

