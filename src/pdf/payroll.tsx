import React from "react";
import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { CompanySettings, Employee, PayrollLine, PayrollRun } from "@prisma/client";
import { PdfDoc, palette, loadLogo, GRAY, INK } from "./brand";
import { payrollLine } from "@/lib/payroll";
import { amountInWords, formatDateEs, formatMoney, formatNumber } from "@/lib/money";

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
function Receipt({ s, run, l }: { s: CompanySettings; run: PayrollRun; l: Line }) {
  const c = palette(s);
  const logo = loadLogo(s);
  const weekly = l.weeklySalary || l.dailySalary * l.workDays;
  const t = payrollLine({ ...l, weeklySalary: weekly });
  const company = s.legalName || s.tradeName;
  const e = l.employee;

  const earnings: [string, number, string?][] = [
    [`Sueldo (${formatNumber(l.days)} día${l.days === 1 ? "" : "s"} × ${formatMoney(t.daily)})`, t.base, l.vacationDays ? `Incluye ${formatNumber(l.vacationDays)} día(s) de vacaciones` : undefined],
    ...(t.vacationPremium ? ([["Prima vacacional (25%)", t.vacationPremium]] as [string, number][]) : []),
    ...(l.bonus ? ([["Bono semanal", l.bonus, l.bonusNote]] as [string, number, string][]) : []),
    ...(l.overtime ? ([[l.overtimeHours ? `Horas extra (${formatNumber(l.overtimeHours)} h)` : "Horas extra", l.overtime]] as [string, number][]) : []),
    ...(l.aguinaldo ? ([["Aguinaldo", l.aguinaldo]] as [string, number][]) : []),
    ...(l.otherIncome ? ([["Otras percepciones", l.otherIncome]] as [string, number][]) : []),
  ];
  const deductions: [string, number, string?][] = [
    ...(t.absenceDeduction ? ([[`Faltas injustificadas (${formatNumber(l.absences)} × ${formatMoney(t.daily)})`, t.absenceDeduction]] as [string, number][]) : []),
    ...(l.deductions ? ([["Préstamo / otros descuentos", l.deductions, l.deductionNote]] as [string, number, string][]) : []),
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
      <Text style={{ ...cell, color: GRAY, paddingVertical: 2.5 }}>Sin deducciones</Text>
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
            {s.rfc ? <Text style={{ fontSize: 7, color: GRAY }}>RFC {s.rfc}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: c.orange }}>RECIBO DE NÓMINA</Text>
          <Text style={{ fontSize: 7.5, color: GRAY }}>
            Folio NOM-{run.id}-{l.id}
          </Text>
        </View>
      </View>

      {/* Empleado y periodo */}
      <View style={{ flexDirection: "row", marginTop: 6, gap: 14 }}>
        <View style={{ flex: 1.3 }}>
          <Pair k="Empleado" v={e.name} bold />
          <Pair k="Puesto" v={e.position || "—"} />
          <Pair k="Área / depto." v={[e.area, e.department].filter(Boolean).join(" › ") || "—"} />
          <Pair k="Fecha de ingreso" v={formatDateEs(e.startDate)} />
          {e.curp || e.rfc ? <Pair k={e.curp ? "CURP" : "RFC"} v={e.curp || e.rfc} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Pair k="Periodo" v={`${formatDateEs(run.periodStart)} al ${formatDateEs(run.periodEnd)}`} bold />
          <Pair k="Fecha de pago" v={formatDateEs(run.payDate)} />
          <Pair k="Jornada" v={`${l.workDays} días · ${formatNumber(l.hoursPerDay)} h`} />
          <Pair k="Días pagados" v={`${formatNumber(Math.max(0, l.days - l.absences))} de ${l.workDays}`} />
        </View>
      </View>

      {/* Desglose del salario */}
      <View style={{ flexDirection: "row", marginTop: 6, backgroundColor: c.peach, borderRadius: 3, paddingVertical: 5 }}>
        {(
          [
            ["Salario semanal", formatMoney(weekly)],
            [`Salario diario (÷ ${l.workDays})`, formatMoney(t.daily)],
            [`Salario por hora (÷ ${formatNumber(l.hoursPerDay)} h)`, formatMoney(t.hourly)],
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
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: c.blue, marginBottom: 2 }}>PERCEPCIONES</Text>
          {list(earnings)}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 3 }}>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>Total percepciones</Text>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>{formatMoney(t.gross)}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: c.blue, marginBottom: 2 }}>DEDUCCIONES</Text>
          {list(deductions)}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 3 }}>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>Total deducciones</Text>
            <Text style={{ ...cell, fontFamily: "Helvetica-Bold" }}>{formatMoney(t.totalDeductions)}</Text>
          </View>
        </View>
      </View>

      {/* Neto */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 7, borderTopWidth: 1, borderTopColor: c.orange, paddingTop: 4 }}>
        <View>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: c.orange }}>NETO A RECIBIR</Text>
          <Text style={{ fontSize: 6.8, color: GRAY }}>{amountInWords(t.net)}</Text>
        </View>
        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: c.orange }}>{formatMoney(t.net)}</Text>
      </View>
      {l.notes ? <Text style={{ fontSize: 7.5, color: GRAY, marginTop: 3 }}>Comentarios: {l.notes}</Text> : null}

      {/* Firma */}
      <View style={{ flexDirection: "row", marginTop: "auto", alignItems: "flex-end", gap: 20 }}>
        <Text style={{ flex: 1.4, fontSize: 6.8, color: GRAY, lineHeight: 1.35 }}>
          Recibí de {company} la cantidad neta indicada por concepto de mi salario y prestaciones del periodo señalado, sin que se me adeude cantidad alguna por
          otro concepto a la fecha.
        </Text>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ borderTopWidth: 0.8, borderTopColor: INK, width: "100%", marginBottom: 2 }} />
          <Text style={{ fontSize: 7.5 }}>{e.name}</Text>
          <Text style={{ fontSize: 6.8, color: GRAY }}>Nombre y firma del trabajador</Text>
        </View>
      </View>
    </View>
  );
}

/** Recibos de nómina: dos por hoja tamaño carta, con línea de corte. */
export function PayrollReceiptsPdf({ s, run, lines }: { s: CompanySettings; run: PayrollRun; lines: Line[] }) {
  const pages: Line[][] = [];
  for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  return (
    <PdfDoc title={`Recibos de nómina ${formatDateEs(run.periodStart)} al ${formatDateEs(run.periodEnd)}`}>
      {pages.map((pair, i) => (
        <Page key={i} size="LETTER" style={{ paddingHorizontal: 40, paddingVertical: 26, fontFamily: "Helvetica", color: INK }}>
          <Receipt s={s} run={run} l={pair[0]} />
          {pair[1] && (
            <>
              <View style={{ borderTopWidth: 0.8, borderTopColor: "#cbd5e1", borderStyle: "dashed", marginVertical: 6 }} />
              <Receipt s={s} run={run} l={pair[1]} />
            </>
          )}
        </Page>
      ))}
    </PdfDoc>
  );
}
