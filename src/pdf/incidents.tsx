import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { CompanySettings, Employee, Incident } from "@prisma/client";
import { BrandedPage, DataTable, DocTitle, NoticeBox, Note, PdfDoc, SectionTab, GRAY, INK } from "./brand";
import { formatDateEs, formatMoney, formatNumber } from "@/lib/money";
import { LATES_PER_REST, incidentFolio, longDate, monthName, rangeLabel } from "@/lib/incidents";

/** Datos de vacaciones al momento de la solicitud (para el formato de vacaciones). */
export type VacationInfo = {
  seniority: string;
  periodFrom: Date;
  periodTo: Date;
  entitled: number;
  takenBefore: number;
  balance: number;
  premium: number;
  returnDate: string;
};

const TITLE: Record<string, string> = {
  VACACIONES: "Solicitud de vacaciones",
  PERMISO: "Permiso de ausencia",
  FALTA: "Constancia de falta injustificada",
  DESCANSO_RETARDOS: "Aviso de descanso por retardos",
};

function Signatures({ names }: { names: [string, string][] }) {
  return (
    <View wrap={false} style={{ flexDirection: "row", gap: 24, marginTop: 34 }}>
      {names.map(([name, role]) => (
        <View key={role} style={{ flex: 1, alignItems: "center" }}>
          <View style={{ borderTopWidth: 0.8, borderTopColor: INK, width: "100%", marginBottom: 3 }} />
          <Text style={{ fontSize: 8.5 }}>{name || " "}</Text>
          <Text style={{ fontSize: 7.5, color: GRAY }}>{role}</Text>
        </View>
      ))}
    </View>
  );
}

/** Formato de una incidencia: solicitud de vacaciones, permiso de ausencia, constancia de falta o aviso de descanso por retardos. */
export function IncidentPdf({ s, i, e, seniority, vacation }: { s: CompanySettings; i: Incident; e: Employee; seniority: string; vacation?: VacationInfo }) {
  const title = TITLE[i.type] ?? "Incidencia";
  const folio = incidentFolio(i);
  const dates = rangeLabel(i.startDate, i.endDate);
  const days = `${formatNumber(i.days)} día${i.days === 1 ? "" : "s"} laborable${i.days === 1 ? "" : "s"}`;
  const status =
    i.status === "AUTORIZADA"
      ? `**Estatus: AUTORIZADA** el ${i.decidedAt ? formatDateEs(i.decidedAt) : "—"}${i.decidedBy ? ` por ${i.decidedBy}` : ""}.`
      : i.status === "RECHAZADA"
        ? `**Estatus: ${i.type === "DESCANSO_RETARDOS" ? "CANCELADO (perdonado)" : "NO AUTORIZADA"}** el ${i.decidedAt ? formatDateEs(i.decidedAt) : "—"}${i.decidedBy ? ` por ${i.decidedBy}` : ""}.`
        : "**Estatus: PENDIENTE DE AUTORIZACIÓN.**";

  const worker: [string, string][] = [
    ["Nombre", e.name],
    ["Puesto", e.position || "—"],
    ["Área / departamento", [e.area, e.department].filter(Boolean).join(" › ") || "—"],
    ["Fecha de ingreso", `${formatDateEs(e.startDate)} (antigüedad: ${seniority})`],
    ...(e.nss ? ([["NSS", e.nss]] as [string, string][]) : []),
  ];

  let detail: [string, string][] = [];
  let note = "";
  if (i.type === "VACACIONES" && vacation) {
    detail = [
      ["Días que corresponden", `${vacation.entitled} días del periodo ${formatDateEs(vacation.periodFrom)} al ${formatDateEs(vacation.periodTo)} (art. 76 LFT)`],
      ["Días disfrutados antes", `${formatNumber(vacation.takenBefore)} días`],
      ["Días solicitados", i.startDate === i.endDate ? `${days}: ${longDate(i.startDate)}` : `${days}: del ${longDate(i.startDate)} al ${longDate(i.endDate)}`],
      ["Regresa a laborar", vacation.returnDate ? longDate(vacation.returnDate) : "—"],
      ["Saldo después de esta solicitud", `${formatNumber(vacation.balance)} días`],
      ["Prima vacacional (25%)", `${formatMoney(vacation.premium)} (art. 80 LFT)`],
      ...(i.reason ? ([["Observaciones", i.reason]] as [string, string][]) : []),
    ];
    note =
      "Las vacaciones se pagan con salario íntegro en la nómina de la semana en que se disfrutan, junto con la prima vacacional. El trabajador debe disfrutar al menos 12 días continuos al año (art. 78 LFT).";
  } else if (i.type === "PERMISO") {
    detail = [
      ["Tipo", i.withPay ? "Permiso CON goce de sueldo (falta justificada)" : "Permiso SIN goce de sueldo (falta justificada)"],
      ["Fechas", i.startDate === i.endDate ? longDate(i.startDate) : `Del ${longDate(i.startDate)} al ${longDate(i.endDate)}`],
      ["Días", days],
      ["Motivo", i.reason || "—"],
      ["Efecto en nómina", i.withPay ? "Se paga normalmente." : "No se pagan los días del permiso. No cuenta como falta injustificada ni afecta el aguinaldo."],
    ];
  } else if (i.type === "FALTA") {
    detail = [
      ["Fechas", i.startDate === i.endDate ? longDate(i.startDate) : `Del ${longDate(i.startDate)} al ${longDate(i.endDate)}`],
      ["Días", days],
      ["Motivo / origen", i.reason || (i.source === "KIOSCO" ? "Sin checada de entrada en el kiosco" : "—")],
      ["Efecto en nómina", "Se descuenta a salario diario y no cuenta como día trabajado para el aguinaldo."],
    ];
    note = "Si la falta tiene justificación (incapacidad, permiso, etc.), el trabajador debe presentarla para cambiarla a falta justificada.";
  } else if (i.type === "DESCANSO_RETARDOS") {
    const lates = i.lateDates.split(",").filter(Boolean);
    detail = [
      ["Mes del acumulado", monthName(i.monthKey)],
      [`Retardos (${lates.length})`, lates.map((d) => longDate(d)).join("; ") || "—"],
      ["Día de descanso", longDate(i.startDate)],
      ["Efecto en nómina", "Día sin goce de sueldo, registrado como falta injustificada (no cuenta como día trabajado para el aguinaldo)."],
    ];
    note = `Conforme al reglamento interior de trabajo, cada ${LATES_PER_REST} retardos acumulados en un mes calendario equivalen a un día de descanso sin goce de sueldo, que se toma la semana siguiente a la nómina en que se completan. El conteo se reinicia cada mes.`;
  }

  const signatures: [string, string][] =
    i.type === "VACACIONES" || i.type === "PERMISO"
      ? [
          [e.name, "Firma del trabajador (solicita)"],
          ["", "Jefe inmediato (Vo. Bo.)"],
          [i.decidedBy, "Autoriza"],
        ]
      : [
          [e.name, "Firma del trabajador (enterado)"],
          ["", "Recursos humanos"],
        ];

  return (
    <PdfDoc title={`${title} ${folio} · ${e.name}`}>
      <BrandedPage s={s} footerLabel={`${title} · ${e.name}`} watermark={i.status === "RECHAZADA" ? (i.type === "DESCANSO_RETARDOS" ? "CANCELADO" : "NO AUTORIZADA") : undefined}>
        <DocTitle s={s} title={title} subtitle={`${e.name} · ${dates}`} extra={`Folio ${folio} · Elaborado el ${formatDateEs(i.createdAt)}`} />
        <SectionTab s={s}>Datos del trabajador</SectionTab>
        <DataTable s={s} rows={worker} />
        <SectionTab s={s}>{i.type === "VACACIONES" ? "Vacaciones solicitadas" : i.type === "DESCANSO_RETARDOS" ? "Retardos y día de descanso" : "Detalle"}</SectionTab>
        <DataTable s={s} rows={detail} />
        <NoticeBox s={s} text={status} />
        <Note>{note}</Note>
        <Signatures names={signatures} />
      </BrandedPage>
    </PdfDoc>
  );
}
