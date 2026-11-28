import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { CompanySettings } from "@prisma/client";
import { BrandedPage, PdfDoc, GRAY, INK, tint } from "./brand";
import { formatDate, formatNumber } from "@/lib/money";
import { localeOf, translator, type Lang, type T } from "@/lib/i18n";
import { exitPieces, exitTotals, type ExitLine } from "@/lib/goods-exit";

/** Datos de la hoja de salida; sin `folio` se imprime el formato en blanco para llenar a mano. */
export type ExitSheet = {
  folio?: string;
  date?: string;
  time?: string;
  client?: string;
  reference?: string;
  carrier?: string;
  plates?: string;
  driverName?: string;
  deliveredBy?: string;
  notes?: string;
  items: ExitLine[];
};

const LINE = "#cbd5e1";
const LABEL_BG = "#eef2f7";
const BLANK_ROWS = 10;

function HeaderGrid({ pairs }: { pairs: [string, string][] }) {
  const rows: [string, string][][] = [];
  for (let i = 0; i < pairs.length; i += 2) rows.push(pairs.slice(i, i + 2));
  return (
    <View style={{ borderWidth: 0.8, borderColor: LINE, borderRadius: 3, marginBottom: 14 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", borderTopWidth: i ? 0.8 : 0, borderTopColor: LINE, minHeight: 26 }}>
          {r.map(([label, value], j) => (
            <React.Fragment key={label}>
              <View style={{ width: "18%", backgroundColor: LABEL_BG, padding: 6, justifyContent: "center", borderLeftWidth: j ? 0.8 : 0, borderLeftColor: LINE }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5 }}>{label}</Text>
              </View>
              <View style={{ width: "32%", padding: 6, justifyContent: "center", borderLeftWidth: 0.8, borderLeftColor: LINE }}>
                <Text style={{ fontSize: 9 }}>{value || " "}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      ))}
    </View>
  );
}

const COLS = [
  { title: "NO.", width: "8%", align: "center" as const },
  { title: "SKU / ARTÍCULO", width: "41%", align: "left" as const },
  { title: "CAJAS ENTREGADAS", width: "17%", align: "center" as const },
  { title: "PZAS. POR CAJA", width: "17%", align: "center" as const },
  { title: "TOTAL PZAS.", width: "17%", align: "center" as const },
];

function Cell({ i, children, bold, h = 22 }: { i: number; children: string; bold?: boolean; h?: number }) {
  const col = COLS[i];
  return (
    <View style={{ width: col.width, minHeight: h, paddingHorizontal: 6, paddingVertical: 5, justifyContent: "center", borderLeftWidth: i ? 0.8 : 0, borderLeftColor: LINE }}>
      <Text style={{ fontSize: 9, textAlign: col.align, fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>{children}</Text>
    </View>
  );
}

function ItemsTable({ items, blank, accent, t }: { items: ExitLine[]; blank: boolean; accent: string; t: T }) {
  const rows: (ExitLine | null)[] = blank ? Array.from({ length: BLANK_ROWS }, () => null) : items;
  const tot = exitTotals(items);
  return (
    <View style={{ borderWidth: 0.8, borderColor: LINE }}>
      <View style={{ flexDirection: "row", backgroundColor: INK }}>
        {COLS.map((c, i) => (
          <View key={c.title} style={{ width: c.width, paddingHorizontal: 6, paddingVertical: 8, justifyContent: "center", borderLeftWidth: i ? 0.8 : 0, borderLeftColor: "#334155" }}>
            <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 8.5, textAlign: "center" }}>{t(c.title)}</Text>
          </View>
        ))}
      </View>
      {rows.map((r, n) => (
        <View key={n} wrap={false} style={{ flexDirection: "row", borderTopWidth: 0.8, borderTopColor: LINE }}>
          <Cell i={0}>{String(n + 1)}</Cell>
          <Cell i={1}>{r ? r.sku : ""}</Cell>
          <Cell i={2}>{r ? formatNumber(r.boxes) : ""}</Cell>
          <Cell i={3}>{r ? formatNumber(r.piecesPerBox) : ""}</Cell>
          <Cell i={4} bold>{r ? formatNumber(exitPieces(r)) : ""}</Cell>
        </View>
      ))}
      <View wrap={false} style={{ flexDirection: "row", borderTopWidth: 1.2, borderTopColor: accent, backgroundColor: tint(accent, 0.9) }}>
        <View style={{ width: "49%", paddingHorizontal: 8, paddingVertical: 7, justifyContent: "center" }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right" }}>{t("TOTALES")}</Text>
        </View>
        <Cell i={2} bold>{blank ? "" : formatNumber(tot.boxes)}</Cell>
        <Cell i={3}>{""}</Cell>
        <Cell i={4} bold>{blank ? "" : formatNumber(tot.pieces)}</Cell>
      </View>
    </View>
  );
}

function SignatureCard({ title, name, date, role, accent, t }: { title: string; name: string; date: string; role: string; accent: string; t: T }) {
  const line = (label: string, value: string) => (
    <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, marginRight: 6 }}>{label}</Text>
      <View style={{ flex: 1, borderBottomWidth: 0.6, borderBottomColor: "#94a3b8", paddingBottom: 2 }}>
        <Text style={{ fontSize: 9 }}>{value || " "}</Text>
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, borderWidth: 0.8, borderColor: "#e2e8f0", borderRadius: 5, backgroundColor: "#f8fafc", padding: 10 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", paddingBottom: 4, borderBottomWidth: 1.2, borderBottomColor: accent }}>{title}</Text>
      {line(`${t("Nombre")}:`, name)}
      {line(`${t("Fecha")}:`, date)}
      <View style={{ marginTop: 22, marginHorizontal: 18, borderTopWidth: 0.8, borderTopColor: INK, paddingTop: 3 }}>
        <Text style={{ fontSize: 8, color: GRAY, textAlign: "center" }}>{role}</Text>
      </View>
    </View>
  );
}

/** Hoja de salida de mercancía (outbound): datos del embarque, SKU · cajas · piezas por caja y firmas. */
export function GoodsExitPdf({ s, x, lang = "es" }: { s: CompanySettings; x: ExitSheet; lang?: Lang }) {
  const t = translator(lang);
  const blank = !x.folio;
  const date = x.date ? formatDate(`${x.date}T12:00:00Z`, localeOf(lang)) : "";
  const accent = s.accentColor;
  const title = t("Hoja de salida de mercancía");
  return (
    <PdfDoc title={blank ? title : `${title} ${x.folio}`}>
      <BrandedPage s={s} lang={lang} footerLabel={blank ? t("Control operativo de salidas") : `${t("Salida de mercancía")} ${x.folio} · ${x.client ?? ""}`}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 17, fontFamily: "Helvetica-Bold", color: INK }}>{title.toUpperCase()}</Text>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: accent, marginTop: 2 }}>OUTBOUND</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8, color: GRAY }}>{t("Folio")}</Text>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: blank ? GRAY : INK }}>{x.folio ?? "____________"}</Text>
          </View>
        </View>

        <HeaderGrid
          pairs={[
            [`${t("Fecha")}:`, date],
            [`${t("Hora de salida")}:`, x.time ?? ""],
            [`${t("Cliente")}:`, x.client ?? ""],
            [`${t("Orden / Referencia")}:`, x.reference ?? ""],
            [`${t("Transportista")}:`, x.carrier ?? ""],
            [`${t("Placas / Unidad")}:`, x.plates ?? ""],
          ]}
        />

        <ItemsTable items={x.items} blank={blank} accent={accent} t={t} />

        {x.notes ? (
          <View wrap={false} style={{ marginTop: 10, borderWidth: 0.8, borderColor: LINE, borderRadius: 3, padding: 8 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5, marginBottom: 3 }}>{t("Observaciones")}</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.35 }}>{x.notes}</Text>
          </View>
        ) : blank ? (
          <View wrap={false} style={{ marginTop: 10, borderWidth: 0.8, borderColor: LINE, borderRadius: 3, padding: 8, minHeight: 40 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5 }}>{t("Observaciones")}</Text>
          </View>
        ) : null}

        <View wrap={false} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <SignatureCard t={t} title={t("ENTREGADO POR (ALMACÉN)")} name={x.deliveredBy ?? ""} date={date} role={t("Firma de quien entrega")} accent={accent} />
            <SignatureCard t={t} title={t("RECIBIDO POR (TRANSPORTISTA)")} name={x.driverName ?? ""} date={date} role={t("Firma del conductor")} accent={accent} />
          </View>
          <Text style={{ fontSize: 7.5, color: GRAY, textAlign: "center", marginTop: 8, lineHeight: 1.3 }}>
            {`${s.tradeName} | ${t("Control operativo de salidas")} | ${t("Las firmas avalan la cantidad de cajas y piezas entregadas, así como el estado visual de la mercancía al momento de la salida.")}`}
          </Text>
        </View>
      </BrandedPage>
    </PdfDoc>
  );
}
