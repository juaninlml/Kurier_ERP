import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { CompanySettings } from "@prisma/client";
import { BrandedPage, DocTitle, PdfDoc, SectionTab, Table, Note, base, palette, GRAY, type Col } from "./brand";
import { formatMoney, formatNumber } from "@/lib/money";
import { dayShort, rangeLabel, type clientOrdersSummary } from "@/lib/orders";
import { docText } from "@/lib/i18n/doc-text";
import { localeOf, translator, type Lang } from "@/lib/i18n";

type Summary = NonNullable<Awaited<ReturnType<typeof clientOrdersSummary>>>;

/** Resumen de órdenes de un cliente en un periodo: totales, promedio y desglose por día y oleada. */
export function OrdersSummaryPdf({ s, data, lang = "es" }: { s: CompanySettings; data: Summary; lang?: Lang }) {
  const t = translator(lang);
  const loc = localeOf(lang);
  const x = (text: string) => docText(text, lang);
  const c = palette(s);
  const period = rangeLabel(data.from, data.to, loc);
  const days = data.days.length;
  // Semanas de lunes a sábado; con varias semanas, el promedio es el de los promedios semanales.
  const avg = data.weekly.dailyAvg;
  const counted = data.weekly.weeks.filter((w) => w.workdays > 0);
  const one = (n: number) => formatNumber(Math.round(n * 10) / 10);
  const amount = data.total * data.rate.rate;
  const peak = data.days.reduce<(typeof data.days)[number] | null>((a, d) => (!a || d.total > a.total ? d : a), null);

  // Columnas: fecha + una por oleada + total. El ancho se reparte entre las oleadas.
  const waveW = Math.max(7, Math.floor((100 - 18 - 11) / Math.max(1, data.waves.length)));
  const cols: Col[] = [
    { title: t("Día"), width: "18%" },
    ...data.waves.map((w) => ({ title: x(w.name), width: `${waveW}%`, align: "right" as const })),
    { title: t("Total"), width: "11%", align: "right" },
  ];

  const kpis = [
    { l: t("Paquetes del periodo"), v: formatNumber(data.total), color: c.blue },
    { l: t("Promedio diario (lun–sáb)"), v: one(avg), color: c.blue },
    counted.length > 1
      ? { l: t("Promedio semanal"), v: one(data.weekly.weeklyAvg), color: c.blue }
      : { l: t("Días con órdenes"), v: String(days), color: c.blue },
    ...(data.rate.rate ? [{ l: t("Importe estimado ({rate} c/u)", { rate: formatMoney(data.rate.rate) }), v: formatMoney(amount), color: c.orange }] : []),
  ];

  return (
    <PdfDoc title={`${t("Resumen de órdenes")} ${data.client.name}`}>
      <BrandedPage s={s} lang={lang} footerLabel={`${t("Resumen de órdenes")} · ${data.client.name}`}>
        <DocTitle s={s} title={t("Resumen de órdenes")} subtitle={`${data.client.name} · ${period}`} extra={t("Paquetes procesados por oleada de surtido")} />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {kpis.map((k) => (
            <View key={k.l} style={[base.box, { flex: 1, backgroundColor: c.peach }]}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{k.l.toUpperCase()}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: k.color, marginTop: 2 }}>{k.v}</Text>
            </View>
          ))}
        </View>

        <SectionTab s={s}>{t("Por oleada")}</SectionTab>
        <View style={{ borderWidth: 0.5, borderColor: "#e8e1da", padding: 10 }}>
          {data.byWave.map((w) => {
            const share = data.total ? w.total / data.total : 0;
            return (
              <View key={w.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                <Text style={{ width: "32%", fontSize: 8.8 }}>{x(w.name)}</Text>
                <View style={{ width: "48%", height: 6, backgroundColor: "#eef0f3", borderRadius: 3 }}>
                  <View style={{ width: `${share * 100}%`, height: 6, backgroundColor: c.blue, borderRadius: 3 }} />
                </View>
                <Text style={{ width: "12%", fontSize: 8.8, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{formatNumber(w.total)}</Text>
                <Text style={{ width: "8%", fontSize: 8, textAlign: "right", color: GRAY }}>{Math.round(share * 100)}%</Text>
              </View>
            );
          })}
        </View>

        {counted.length > 1 && (
          <>
            <SectionTab s={s}>{t("Por semana")}</SectionTab>
            <Table
              s={s}
              cols={[
                { title: t("Semana"), width: "46%" },
                { title: t("Días lun–sáb"), width: "18%", align: "right" },
                { title: t("Paquetes"), width: "18%", align: "right" },
                { title: t("Promedio diario"), width: "18%", align: "right" },
              ]}
              styles={["label", "normal", "strong", "strong"]}
              rows={[
                ...counted.map((w) => [rangeLabel(w.from, w.to, loc), String(w.workdays), formatNumber(w.total), one(w.dailyAvg)]),
                [t("Promedio de {n} semanas", { n: counted.length }), "", t("{n} / semana", { n: one(data.weekly.weeklyAvg) }), t("{n} / día", { n: one(avg) })],
              ]}
            />
            <Note>{t("Semanas de lunes a sábado; la primera y la última pueden quedar cortadas por el cambio de mes. El promedio del periodo es el promedio de los promedios semanales.")}</Note>
          </>
        )}

        <SectionTab s={s}>{t("Detalle por día")}</SectionTab>
        <Table
          s={s}
          cols={cols}
          styles={["label", ...data.waves.map(() => "normal" as const), "strong"]}
          rows={[
            ...data.days.map((d) => [dayShort(d.date, loc), ...data.waves.map((w) => (d.byWave[w.id] ? formatNumber(d.byWave[w.id]) : "—")), formatNumber(d.total)]),
            [t("Total"), ...data.byWave.map((w) => formatNumber(w.total)), formatNumber(data.total)],
          ]}
        />
        {days === 0 ? (
          <Note>{t("Sin órdenes capturadas en este periodo.")}</Note>
        ) : (
          <Note>{`${t("Día con más paquetes: {day} ({n}). El promedio diario cuenta los días de lunes a sábado.", { day: dayShort(peak!.date, loc), n: formatNumber(peak!.total) })}${data.rate.rate ? ` ${t("Importe estimado sin IVA, con la tarifa por paquete del servicio logístico.")}` : ""}`}</Note>
        )}
        {data.byMaterial.length > 0 && (
          <>
            <SectionTab s={s}>{t("Insumos de empaque")}</SectionTab>
            <Table
              s={s}
              cols={[
                { title: t("Material"), width: "24%" },
                { title: t("Medidas (cm)"), width: "34%" },
                { title: t("Piezas"), width: "10%", align: "right" },
                { title: t("Precio"), width: "16%", align: "right" },
                { title: t("Importe"), width: "16%", align: "right" },
              ]}
              styles={["label", "normal", "strong", "normal", "strong"]}
              rows={[
                // Solo el precio de venta: el costo interno nunca sale en documentos del cliente.
                ...data.byMaterial.map((m) => [
                  x(m.name),
                  m.noSupply ? t("Sin empaque de Kurier") : m.size.replace(/\*/g, "×") || "—",
                  formatNumber(m.total),
                  m.unitPrice ? formatMoney(m.unitPrice) : m.noSupply ? "—" : t("Incluido"),
                  m.unitPrice ? formatMoney(m.total * m.unitPrice) : "—",
                ]),
                [
                  t("Total"),
                  "",
                  formatNumber(data.byMaterial.reduce((a, x) => a + x.total, 0)),
                  "",
                  formatMoney(data.byMaterial.reduce((a, x) => a + x.total * x.unitPrice, 0)),
                ],
              ]}
            />
          </>
        )}
      </BrandedPage>
    </PdfDoc>
  );
}
