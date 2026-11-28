import React from "react";
import { View, Text } from "./rp";
import type { CompanySettings, Employee, Incident } from "@prisma/client";
import { BrandedPage, DataTable, DocTitle, NoticeBox, Note, PdfDoc, SectionTab, GRAY, INK } from "./brand";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { LATES_PER_REST, incidentFolio, longDate as longDateEs, monthName as monthNameEs, rangeLabel as rangeLabelEs } from "@/lib/incidents";
import { localeOf, translator, type Lang } from "@/lib/i18n";

/** Fechas yyyy-mm-dd del formato en el idioma pedido (en español, las de siempre). */
function dates(lang: Lang) {
  if (lang === "es") return { longDate: longDateEs, monthName: monthNameEs, rangeLabel: rangeLabelEs };
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(localeOf(lang), { ...o, timeZone: "UTC" });
  const short = (d: string) => f(d, { month: "short", day: "numeric" });
  return {
    longDate: (d: string) => f(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    monthName: (key: string) => f(`${key}-01`, { month: "long", year: "numeric" }),
    rangeLabel: (from: string, to: string) => (from === to ? short(from) : `${short(from)} – ${short(to)}`),
  };
}

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
export function IncidentPdf({
  s,
  i,
  e,
  seniority,
  vacation,
  lang = "es",
}: {
  s: CompanySettings;
  i: Incident;
  e: Employee;
  seniority: string;
  vacation?: VacationInfo;
  lang?: Lang;
}) {
  const t = translator(lang);
  const { longDate, monthName, rangeLabel } = dates(lang);
  const formatDateEs = (d: Date) => formatDate(d, localeOf(lang));
  const by = (who: string) => (who ? ` ${t("por {who}", { who })}` : "");
  const title = t(i.source === "HISTORICO" && i.type === "VACACIONES" ? "Constancia de vacaciones" : (TITLE[i.type] ?? "Incidencia"));
  const folio = incidentFolio(i);
  const range = rangeLabel(i.startDate, i.endDate);
  const days = t(i.days === 1 ? "{n} día laborable" : "{n} días laborables", { n: formatNumber(i.days) });
  const fromTo = (a: string, b: string) => t("Del {from} al {to}", { from: longDate(a), to: longDate(b) });
  const historic = i.source === "HISTORICO";
  const decided = i.decidedAt ? formatDateEs(i.decidedAt) : "—";
  const status = historic
    ? `**${t("Registro histórico")}:** ${t(i.type === "VACACIONES" ? "vacaciones ya disfrutadas" : "incidencia de fechas anteriores")}, ${t("capturada el {d}", { d: formatDateEs(i.createdAt) })}${by(i.createdBy)}. ${t("Se pagó fuera del ERP y no entra a la nómina.")}`
    : i.status === "AUTORIZADA"
      ? `**${t("Estatus: AUTORIZADA")}** ${t("el {d}", { d: decided })}${by(i.decidedBy)}.`
      : i.status === "RECHAZADA"
        ? `**${t(i.type === "DESCANSO_RETARDOS" ? "Estatus: CANCELADO (perdonado)" : "Estatus: NO AUTORIZADA")}** ${t("el {d}", { d: decided })}${by(i.decidedBy)}.`
        : `**${t("Estatus: PENDIENTE DE AUTORIZACIÓN.")}**`;

  const worker: [string, string][] = [
    [t("Nombre"), e.name],
    [t("Puesto"), e.position || "—"],
    [t("Área / departamento"), [e.area, e.department].filter(Boolean).join(" › ") || "—"],
    [t("Fecha de ingreso"), `${formatDateEs(e.startDate)} (${t("antigüedad")}: ${seniority})`],
    ...(e.nss ? ([[t("NSS"), e.nss]] as [string, string][]) : []),
  ];

  let detail: [string, string][] = [];
  let note = "";
  if (i.type === "VACACIONES" && vacation) {
    detail = [
      [
        t("Días que corresponden"),
        t("{n} días del periodo {from} al {to} (art. 76 LFT)", { n: vacation.entitled, from: formatDateEs(vacation.periodFrom), to: formatDateEs(vacation.periodTo) }),
      ],
      [t("Días disfrutados antes"), t("{n} días", { n: formatNumber(vacation.takenBefore) })],
      [t(historic ? "Días disfrutados" : "Días solicitados"), i.startDate === i.endDate ? `${days}: ${longDate(i.startDate)}` : `${days}: ${fromTo(i.startDate, i.endDate)}`],
      [t("Regresa a laborar"), vacation.returnDate ? longDate(vacation.returnDate) : "—"],
      [t(historic ? "Saldo después de estos días" : "Saldo después de esta solicitud"), t("{n} días", { n: formatNumber(vacation.balance) })],
      [t("Prima vacacional (25%)"), `${formatMoney(vacation.premium)} (art. 80 LFT)${historic ? `, ${t("pagada fuera del ERP")}` : ""}`],
      ...(i.reason ? ([[t("Observaciones"), i.reason]] as [string, string][]) : []),
    ];
    note = t(
      "Las vacaciones se pagan con salario íntegro en la nómina de la semana en que se disfrutan, junto con la prima vacacional. El trabajador debe disfrutar al menos 12 días continuos al año (art. 78 LFT).",
    );
  } else if (i.type === "PERMISO") {
    detail = [
      [t("Tipo"), t(i.withPay ? "Permiso CON goce de sueldo (falta justificada)" : "Permiso SIN goce de sueldo (falta justificada)")],
      [t("Fechas"), i.startDate === i.endDate ? longDate(i.startDate) : fromTo(i.startDate, i.endDate)],
      [t("Días"), days],
      [t("Motivo"), i.reason || "—"],
      [t("Efecto en nómina"), t(i.withPay ? "Se paga normalmente." : "No se pagan los días del permiso. No cuenta como falta injustificada ni afecta el aguinaldo.")],
    ];
  } else if (i.type === "FALTA") {
    detail = [
      [t("Fechas"), i.startDate === i.endDate ? longDate(i.startDate) : fromTo(i.startDate, i.endDate)],
      [t("Días"), days],
      [t("Motivo / origen"), i.reason || (i.source === "KIOSCO" ? t("Sin checada de entrada en el kiosco") : "—")],
      [t("Efecto en nómina"), t("Se descuenta a salario diario y no cuenta como día trabajado para el aguinaldo.")],
    ];
    note = t("Si la falta tiene justificación (incapacidad, permiso, etc.), el trabajador debe presentarla para cambiarla a falta justificada.");
  } else if (i.type === "DESCANSO_RETARDOS") {
    const lates = i.lateDates.split(",").filter(Boolean);
    detail = [
      [t("Mes del acumulado"), monthName(i.monthKey)],
      [t("Retardos ({n})", { n: lates.length }), lates.map((d) => longDate(d)).join("; ") || "—"],
      [t("Día de descanso"), longDate(i.startDate)],
      [t("Efecto en nómina"), t("Día sin goce de sueldo, registrado como falta injustificada (no cuenta como día trabajado para el aguinaldo).")],
    ];
    note = t(
      "Conforme al reglamento interior de trabajo, cada {n} retardos acumulados en un mes calendario equivalen a un día de descanso sin goce de sueldo, que se toma la semana siguiente a la nómina en que se completan. El conteo se reinicia cada mes.",
      { n: LATES_PER_REST },
    );
  }

  const signatures: [string, string][] =
    i.type === "VACACIONES" || i.type === "PERMISO"
      ? [
          [e.name, t("Firma del trabajador (solicita)")],
          ["", t("Jefe inmediato (Vo. Bo.)")],
          [i.decidedBy, t("Autoriza")],
        ]
      : [
          [e.name, t("Firma del trabajador (enterado)")],
          ["", t("Recursos humanos")],
        ];

  return (
    <PdfDoc lang={lang} title={`${title} ${folio} · ${e.name}`}>
      <BrandedPage
        s={s}
        lang={lang}
        footerLabel={`${title} · ${e.name}`}
        watermark={i.status === "RECHAZADA" ? t(i.type === "DESCANSO_RETARDOS" ? "CANCELADO" : "NO AUTORIZADA") : undefined}
      >
        <DocTitle s={s} title={title} subtitle={`${e.name} · ${range}`} extra={t("Folio {folio} · Elaborado el {d}", { folio, d: formatDateEs(i.createdAt) })} />
        <SectionTab s={s}>{t("Datos del trabajador")}</SectionTab>
        <DataTable s={s} rows={worker} headers={[t("Concepto"), t("Detalle")]} />
        <SectionTab s={s}>{t(i.type === "VACACIONES" ? "Vacaciones solicitadas" : i.type === "DESCANSO_RETARDOS" ? "Retardos y día de descanso" : "Detalle")}</SectionTab>
        <DataTable s={s} rows={detail} headers={[t("Concepto"), t("Detalle")]} />
        <NoticeBox s={s} text={status} />
        <Note>{note}</Note>
        <Signatures names={signatures} />
      </BrandedPage>
    </PdfDoc>
  );
}
