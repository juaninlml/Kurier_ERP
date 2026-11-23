import React from "react";
import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { CompanySettings } from "@prisma/client";
import { loadLogo, tint, Rich } from "./brand";

/**
 * Formato limpio para facturas y cotizaciones: banda de color tenue con el logo, título grande del documento,
 * datos en renglón, tabla con filas alternas grises y totales en recuadro a la derecha.
 * Pensado para que un documento con pocos servicios quepa en una sola hoja.
 */

export const C = {
  ink: "#1f2937",
  muted: "#6b7280",
  faint: "#9ca3af",
  zebra: "#f3f4f6",
  rule: "#d1d5db",
  hair: "#e5e7eb",
};

const PAD_X = 36;
const PAD_TOP = 28;

export function cleanColors(s: CompanySettings) {
  return { accent: s.accentColor, band: tint(s.accentColor, 0.92), primary: s.primaryColor };
}

export function CleanPage({
  s,
  title,
  children,
  watermark,
  lang = "es",
}: {
  s: CompanySettings;
  /** "Factura FAC-001" */
  title: string;
  children: React.ReactNode;
  watermark?: string;
  lang?: "es" | "en";
}) {
  const c = cleanColors(s);
  const logo = loadLogo(s);
  const address = [s.address, [s.zip && `C.P. ${s.zip}`, s.city, s.state].filter(Boolean).join(", ")].filter(Boolean);
  const contact = [s.email, s.phone && `Tel. ${s.phone}`, s.website].filter(Boolean).join("  ·  ");

  return (
    <Page size="LETTER" style={{ paddingTop: PAD_TOP, paddingBottom: 52, paddingHorizontal: PAD_X, fontSize: 9, fontFamily: "Helvetica", color: C.ink }}>
      {/* Ojo: no poner lineHeight en el estilo de Page; react-pdf deja de dibujar el pie fijo. */}
      {/* Encabezado (solo primera hoja) */}
      <View style={{ marginTop: -PAD_TOP, marginHorizontal: -PAD_X, marginBottom: 10 }}>
        <View style={{ backgroundColor: c.band, paddingTop: 18, paddingHorizontal: PAD_X, paddingBottom: 28, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ maxWidth: 260 }}>
            {logo ? (
              <View style={{ backgroundColor: "#fff", padding: 6, alignSelf: "flex-start", borderRadius: 2 }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={logo} style={{ height: 44, maxWidth: 120, objectFit: "contain" }} />
              </View>
            ) : (
              <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: c.primary }}>{s.tradeName}</Text>
            )}
            {s.tagline ? <Text style={{ marginTop: 6, fontSize: 9, fontFamily: "Helvetica-Bold", color: c.accent }}>{s.tagline}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end", maxWidth: 260 }}>
            <Text style={{ fontSize: 10 }}>{s.legalName || s.tradeName}</Text>
            {s.rfc ? <Text style={{ fontSize: 8.5, color: C.muted }}>RFC {s.rfc}</Text> : null}
            {address.map((l) => (
              <Text key={l} style={{ fontSize: 8.5, color: C.muted, textAlign: "right" }}>
                {l}
              </Text>
            ))}
          </View>
        </View>
        {/* Pestaña blanca con el título que "muerde" la banda */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: -24 }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 16, paddingLeft: 20, paddingRight: PAD_X, paddingTop: 4 }}>
            <Text style={{ fontSize: 20, color: c.accent }}>{title}</Text>
          </View>
        </View>
      </View>

      {watermark && (
        <View fixed style={{ position: "absolute", top: 360, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ fontSize: 90, color: watermark === "PAGADA" || watermark === "PAID" ? "#16a34a" : "#ef4444", opacity: 0.1, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" }}>
            {watermark}
          </Text>
        </View>
      )}

      {children}

      {/* Pie */}
      <View fixed style={{ position: "absolute", bottom: 20, left: PAD_X, right: PAD_X }}>
        <View style={{ borderTopWidth: 0.75, borderTopColor: C.ink, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 8, color: C.ink }}>{contact || s.tradeName}</Text>
          <Text style={{ fontSize: 8, color: C.muted }} render={({ pageNumber, totalPages }) => `${lang === "en" ? "Page" : "Página"} ${pageNumber} / ${totalPages}`} />
        </View>
      </View>
    </Page>
  );
}

/** Bloque del cliente: nombre y renglones secundarios en gris. */
export function PartyBlock({ name, lines }: { name: string; lines: string[] }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold" }}>{name}</Text>
      {lines.filter(Boolean).map((l) => (
        <Text key={l} style={{ color: C.muted }}>
          {l}
        </Text>
      ))}
    </View>
  );
}

/** Datos en renglón (Fecha, Vence, Periodo…): 4 por fila, etiqueta gris clara arriba. */
export function InfoGrid({ items }: { items: { label: string; value: string }[] }) {
  const shown = items.filter((i) => i.value);
  if (!shown.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
      {shown.map((i) => (
        <View key={i.label} style={{ width: "25%", paddingRight: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 8, color: C.faint }}>{i.label}</Text>
          <Text style={{ marginTop: 1 }}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Título discreto de sección (en lugar de las pestañas de color). */
export function SectionLabel({ s, children, first }: { s: CompanySettings; children: string; first?: boolean }) {
  return (
    <Text minPresenceAhead={50} style={{ marginTop: first ? 0 : 12, marginBottom: 3, fontSize: 8, fontFamily: "Helvetica-Bold", color: s.accentColor, letterSpacing: 0.8, textTransform: "uppercase" }}>
      {children}
    </Text>
  );
}

export type CleanCol = { title: string; width: string; align?: "left" | "right" | "center" };
/** Celda: texto, o texto principal con una línea secundaria (detalle) debajo. */
export type CleanCell = string | { main: string; sub?: string; bold?: boolean; color?: string };

/** Tabla del formato limpio: encabezado sin fondo con línea gris, filas alternas gris claro. */
export function CleanTable({ cols, rows, groups }: { cols: CleanCol[]; rows: CleanCell[][]; /** índice de fila → título de grupo que se pinta antes */ groups?: Record<number, string> }) {
  const cell = { paddingVertical: 4.5, paddingHorizontal: 6 } as const;
  const head = (
    <View style={{ flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: C.faint }}>
      {cols.map((col) => (
        <Text key={col.title} style={[cell, { width: col.width, textAlign: col.align ?? "left", paddingBottom: 6 }]}>
          {col.title}
        </Text>
      ))}
    </View>
  );
  let zebra = 0;
  return (
    <View>
      {rows.map((r, i) => {
        const group = groups?.[i];
        if (group) zebra = 0;
        const bg = zebra++ % 2 === 0 ? C.zebra : "#fff";
        const row = (
          <View key={i} wrap={false} style={{ flexDirection: "row", backgroundColor: bg, borderBottomWidth: 0.5, borderBottomColor: C.hair }}>
            {r.map((v, j) => {
              const o = typeof v === "string" ? { main: v } : v;
              const st: Style = { textAlign: cols[j].align ?? "left" };
              return (
                <View key={j} style={[cell, { width: cols[j].width }]}>
                  <Text style={[st, o.bold ? { fontFamily: "Helvetica-Bold" } : {}, o.color ? { color: o.color } : {}]}>{o.main}</Text>
                  {o.sub ? <Text style={[st, { color: C.muted, fontSize: 8, marginTop: 1 }]}>{o.sub}</Text> : null}
                </View>
              );
            })}
          </View>
        );
        const groupRow = group ? (
          <View key={`g${i}`} style={{ paddingTop: i === 0 ? 4 : 6, paddingBottom: 2, paddingHorizontal: 6 }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.muted, letterSpacing: 0.6, textTransform: "uppercase" }}>{group}</Text>
          </View>
        ) : null;
        // El encabezado (y el título de grupo) viajan pegados a su primera fila.
        if (i === 0)
          return (
            <View key="head" wrap={false}>
              {head}
              {groupRow}
              {row}
            </View>
          );
        if (groupRow)
          return (
            <View key={`gw${i}`} wrap={false}>
              {groupRow}
              {row}
            </View>
          );
        return row;
      })}
    </View>
  );
}

/** Recuadro de totales a la derecha: renglones grises y total en color de acento. */
export function TotalsBox({
  s,
  rows,
  total,
  words,
  width = 230,
}: {
  s: CompanySettings;
  rows: { label: string; value: string }[];
  total: { label: string; value: string };
  words?: string;
  width?: number;
}) {
  const line = (l: string, v: string, i: number, strong?: boolean) => (
    <View key={l} style={{ flexDirection: "row", backgroundColor: i % 2 === 0 ? C.zebra : "#fff", borderBottomWidth: 0.5, borderBottomColor: C.hair }}>
      <Text style={{ flex: 1, paddingVertical: 5, paddingHorizontal: 6, fontFamily: strong ? "Helvetica-Bold" : "Helvetica", color: strong ? s.accentColor : C.ink }}>{l}</Text>
      <Text style={{ width: "44%", paddingVertical: 5, paddingHorizontal: 6, textAlign: "right", fontFamily: strong ? "Helvetica-Bold" : "Helvetica", color: strong ? s.accentColor : C.ink, fontSize: strong ? 10.5 : 9 }}>{v}</Text>
    </View>
  );
  return (
    <View wrap={false} style={{ width }}>
      {rows.map((r, i) => line(r.label, r.value, i))}
      {line(total.label, total.value, rows.length, true)}
      {words ? <Text style={{ marginTop: 4, fontSize: 7.5, color: C.muted, textAlign: "right", lineHeight: 1.35 }}>{words}</Text> : null}
    </View>
  );
}

/** Texto pequeño gris (notas, avisos). Admite **negritas**. */
export function SmallNote({ text, style }: { text: string; style?: Style }) {
  if (!text?.trim()) return null;
  return <Rich text={text} style={{ fontSize: 8, color: C.muted, lineHeight: 1.4, marginTop: 4, ...(style ?? {}) }} />;
}

/** Condiciones compactas, una por línea; "Título: texto" pone el título en negritas. */
export function CompactTerms({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•■*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <View>
      {lines.map((l, i) => {
        const m = l.match(/^([^:]{2,60}):\s*(.*)$/);
        return (
          <View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: 1.5 }}>
            <Text style={{ width: 9, fontSize: 8, color: C.faint }}>•</Text>
            <Text style={{ flex: 1, fontSize: 8, lineHeight: 1.35, color: C.ink }}>
              {m ? (
                <>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{m[1]}:</Text> {m[2]}
                </>
              ) : (
                l
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
