import React from "react";
import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { CompanySettings, Employee, PayrollLine, PayrollRun } from "@prisma/client";
import { PdfDoc, palette, loadLogo, GRAY, INK } from "./brand";
import { payrollLine } from "@/lib/payroll";
import { amountInWords, amountInWordsEn, formatDate, formatMoney, formatNumber } from "@/lib/money";
import { localeOf, translator, type Lang } from "@/lib/i18n";

type Line = PayrollLine & { employee: Employee };

const cell = { fontSize: 8.5 } as const;

function Pair({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
      <Text style={{ ...cell, color: GRAY }}>{k}</Text>
      <Text style={{ ...cell, fontFamily: bold ? "Helvetica-Bold" : "Helvetica", color: INK }}>{v}</Text>
    </View>
  );
}

/** Un recibo (media hoja). */
function Receipt({ s, run, l, lang }: { s: CompanySettings; run: PayrollRun; l: Line; lang: Lang }) {
  const tr = translator(lang);
  const date = (d: Date) => formatDate(d, localeOf(lang));
  const c = palette(s);
  const logo = loadLogo(s);
  const weekly = l.weeklySalary || l.dailySalary * l.workDays;
  const t = payrollLine({ ...l, weeklySalary: weekly });
  const company = s.legalName || s.tradeName;
  const e = l.employee;
  // Detalle de incidencias: las faltas van bajo su deducción; permisos y vacaciones, bajo la de permisos o el sueldo
  const parts = l.absenceNote.split(" · ").filter(Boolean);
  const unjustNote = parts.find((p) => p.startsWith("Faltas injustificadas:"))?.replace("Faltas injustificadas: ", "");
  const otherNote = parts.find((p) => p.startsWith("Permiso sin goce:"))?.replace("Permiso sin goce: ", "");
  const vacDates = parts.find((p) => p.startsWith("Vacaciones:"))?.replace("Vacaciones: ", "");
  const sueldoNote = [
    l.vacationDays ? tr("Incluye {n} día(s) de vacaciones", { n: formatNumber(l.vacationDays) }) + (vacDates ? ` (${vacDates})` : "") : "",
    ...parts.filter((p) => p.startsWith("Permiso con goce:")).map((p) => p.replace("Permiso con goce:", `${tr("Permiso con goce")}:`)),
  ]
    .filter(Boolean)
    .join(" · ");

  const earnings: [string, number, string?][] = [
    [tr(l.days === 1 ? "Sueldo ({n} día × {daily})" : "Sueldo ({n} días × {daily})", { n: formatNumber(l.days), daily: formatMoney(t.daily) }), t.base, sueldoNote || undefined],
    ...(t.vacationPremium ? ([[tr("Prima vacacional (25%)"), t.vacationPremium]] as [string, number][]) : []),
    ...(l.bonus ? ([[tr("Bono semanal"), l.bonus, l.bonusNote]] as [string, number, string][]) : []),
    ...(l.overtime ? ([[l.overtimeHours ? tr("Horas extra ({n} h)", { n: formatNumber(l.overtimeHours) }) : tr("Horas extra"), l.overtime]] as [string, number][]) : []),
    ...(l.aguinaldo ? ([[tr("Aguinaldo"), l.aguinaldo]] as [string, number][]) : []),
    ...(l.otherIncome ? ([[tr("Otras percepciones"), l.otherIncome]] as [string, number][]) : []),
  ];
  const deductions: [string, number, string?][] = [
    ...(t.absenceDeduction
      ? ([[tr("Faltas injustificadas ({n} × {daily})", { n: formatNumber(l.absences), daily: formatMoney(t.daily) }), t.absenceDeduction, unjustNote]] as [string, number, string?][])
      : []),
    ...(t.leaveDeduction
      ? ([[tr("Permisos sin goce ({n} × {daily})", { n: formatNumber(l.leaveDays), daily: formatMoney(t.daily) }), t.leaveDeduction, otherNote]] as [string, number, string?][])
      : []),
    ...(l.deductions ? ([[tr("Préstamo / otros descuentos"), l.deductions, l.deductionNote]] as [string, number, string][]) : []),
  ];

  const list = (rows: [string, number, string?][]) =>
    rows.length ? (
      rows.map(([k, v, note], i) => (
        <View key={i} style={{ paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#eef0f3" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...cell, flex: 1, paddingRight: 6 }}>{k}</Text>
            <Text style={cell}>{formatMoney(v)}</Text>
          </View>
          {note ? <Text style={{ fontSize: 7.5, color: GRAY, marginTop: 1 }}>{note}</Text> : null}
        </View>
      ))
    ) : (
      <Text style={{ ...cell, color: GRAY, paddingVertical: 2.5 }}>{tr("Sin deducciones")}</Text>
    );

  return (
    <View wrap={false} style={{ height: 356, paddingVertical: 14 }}>
      {/* Encabezado */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1.2, borderBottomColor: c.orange, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logo && <Image src={logo} style={{ height: 22, maxWidth: 40, objectFit: "contain", marginRight: 6 }} />}
          <View>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: c.blue }}>{company.toUpperCase()}</Text>
            {s.rfc ? <Text style={{ fontSize: 7, color: GRAY }}>{tr("RFC")} {s.rfc}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: c.orange }}>{tr("RECIBO DE NÓMINA")}</Text>
          <Text style={{ fontSize: 7.5, color: GRAY }}>
            {tr("Folio")} NOM-{run.id}-{l.id}
          </Text>
        </View>
      </View>

      {/* Empleado y periodo */}
      <View style={{ flexDirection: "row", marginTop: 6, gap: 14 }}>
        <View style={{ flex: 1.3 }}>
          <Pair k={tr("Empleado")} v={e.name} bold />
          <Pair k={tr("Puesto")} v={e.position || "—"} />
          <Pair k={tr("Área / depto.")} v={[e.area, e.department].filter(Boolean).join(" › ") || "—"} />
          <Pair k={tr("Fecha de ingreso")} v={date(e.startDate)} />
          {e.curp || e.rfc ? <Pair k={e.curp ? "CURP" : "RFC"} v={e.curp || e.rfc} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Pair k={tr("Periodo")} v={tr("{from} al {to}", { from: date(run.periodStart), to: date(run.periodEnd) })} bold />
          <Pair k={tr("Fecha de pago")} v={date(run.payDate)} />
          <Pair k={tr("Jornada")} v={tr("{d} días · {h} h", { d: l.workDays, h: formatNumber(l.hoursPerDay) })} />
          <Pair k={tr("Días pagados")} v={tr("{n} de {total}", { n: formatNumber(Math.max(0, l.days - l.absences - l.leaveDays)), total: l.workDays })} />
        </View>
      </View>

      {/* Desglose del salario */}
      <View style={{ flexDirection: "row", marginTop: 6, backgroundColor: c.peach, borderRadius: 3, paddingVertical: 5 }}>
        {(
          [
            [tr("Salario semanal"), formatMoney(weekly)],
            [tr("Salario diario (÷ {n})", { n: l.workDays }), formatMoney(t.daily)],
            [tr("Salario por hora (÷ {n} h)", { n: formatNumber(l.hoursPerDay) }), formatMoney(t.hourly)],
          ] as const
        ).map(([k, v]) => (
          <View key={k} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 7, color: GRAY }}>{k}</Text>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: c.blue }}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Percepciones y deducciones */}
      <View style={{ flexDirection: "row", marginTop: 7, gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: c.blue, marginBottom: 2 }}>{tr("PERCEPCIONES")}</Text>
          {list(earnings)}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 3 }}>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>{tr("Total percepciones")}</Text>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>{formatMoney(t.gross)}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: c.blue, marginBottom: 2 }}>{tr("DEDUCCIONES")}</Text>
          {list(deductions)}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 3 }}>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>{tr("Total deducciones")}</Text>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>{formatMoney(t.totalDeductions)}</Text>
          </View>
        </View>
      </View>

      {/* Neto */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 7, borderTopWidth: 1, borderTopColor: c.orange, paddingTop: 4 }}>
        <View>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: c.orange }}>{tr("NETO A RECIBIR")}</Text>
          <Text style={{ fontSize: 6.8, color: GRAY }}>{lang === "en" ? amountInWordsEn(t.net) : amountInWords(t.net)}</Text>
        </View>
        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: c.orange }}>{formatMoney(t.net)}</Text>
      </View>
      {l.notice ? (
        <View style={{ marginTop: 4, backgroundColor: c.peach, borderLeftWidth: 2, borderLeftColor: c.orange, paddingVertical: 3, paddingHorizontal: 5 }}>
          <Text style={{ fontSize: 7.3, lineHeight: 1.3 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: c.orange }}>{tr("AVISO")}: </Text>
            {l.notice}
          </Text>
        </View>
      ) : null}
      {l.notes ? (
        <Text style={{ fontSize: 7.5, color: GRAY, marginTop: 3 }}>
          {tr("Comentarios")}: {l.notes}
        </Text>
      ) : null}

      {/* Firma */}
      <View style={{ flexDirection: "row", marginTop: "auto", alignItems: "flex-end", gap: 20 }}>
        <Text style={{ flex: 1.4, fontSize: 6.8, color: GRAY, lineHeight: 1.35 }}>
          {tr(
            "Recibí de {company} la cantidad neta indicada por concepto de mi salario y prestaciones del periodo señalado, sin que se me adeude cantidad alguna por otro concepto a la fecha.",
            { company },
          )}
        </Text>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ borderTopWidth: 0.8, borderTopColor: INK, width: "100%", marginBottom: 2 }} />
          <Text style={{ fontSize: 7.5 }}>{e.name}</Text>
          <Text style={{ fontSize: 6.8, color: GRAY }}>{tr("Nombre y firma del trabajador")}</Text>
        </View>
      </View>
    </View>
  );
}

/** Recibos de nómina: dos por hoja tamaño carta, con línea de corte. */
export function PayrollReceiptsPdf({ s, run, lines, lang = "es" }: { s: CompanySettings; run: PayrollRun; lines: Line[]; lang?: Lang }) {
  const tr = translator(lang);
  const date = (d: Date) => formatDate(d, localeOf(lang));
  const pages: Line[][] = [];
  for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  return (
    <PdfDoc title={`${tr("Recibos de nómina")} ${tr("{from} al {to}", { from: date(run.periodStart), to: date(run.periodEnd) })}`}>
      {pages.map((pair, i) => (
        <Page key={i} size="LETTER" style={{ paddingHorizontal: 40, paddingVertical: 26, fontFamily: "Helvetica", color: INK }}>
          <Receipt s={s} run={run} l={pair[0]} lang={lang} />
          {pair[1] && (
            <>
              <View style={{ borderTopWidth: 0.8, borderTopColor: "#cbd5e1", borderStyle: "dashed", marginVertical: 6 }} />
              <Receipt s={s} run={run} l={pair[1]} lang={lang} />
            </>
          )}
        </Page>
      ))}
    </PdfDoc>
  );
}
