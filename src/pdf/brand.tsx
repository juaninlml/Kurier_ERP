import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { CompanySettings } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Sin guiones de separación automática (evita "FI-NANCIERO", folios cortados, etc.)
Font.registerHyphenationCallback((word) => [word]);

/** Mezcla un color hex con blanco (t = 0 → color, 1 → blanco). */
export function tint(hex: string, t: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function loadLogo(s: CompanySettings) {
  if (s.logoData && s.logoMime) {
    return { data: Buffer.from(s.logoData), format: s.logoMime === "image/png" ? "png" : "jpg" } as const;
  }
  for (const rel of [s.logoPath, "/branding/logo.png", "/branding/logo.jpg"]) {
    const p = path.join(process.cwd(), "public", rel);
    if (existsSync(p)) return { data: readFileSync(p), format: p.toLowerCase().endsWith(".png") ? "png" : "jpg" } as const;
  }
  return null;
}

export const GRAY = "#64748b";
export const INK = "#1e293b";

export const base = StyleSheet.create({
  page: { paddingTop: 96, paddingBottom: 60, paddingHorizontal: 46, fontSize: 9, fontFamily: "Helvetica", color: INK },
  muted: { color: GRAY },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" },
  box: { borderRadius: 4, padding: 10 },
});

/** Colores derivados de la configuración. */
export function palette(s: CompanySettings) {
  return { blue: s.primaryColor, orange: s.accentColor, peach: tint(s.accentColor, 0.9), line: tint(s.primaryColor, 0.85) };
}

export function BrandedPage({
  s,
  footerLabel,
  watermark,
  children,
}: {
  s: CompanySettings;
  footerLabel: string;
  watermark?: string;
  children: React.ReactNode;
}) {
  const c = palette(s);
  const logo = loadLogo(s);
  const cityLine = [s.city, s.state].filter(Boolean).join(", ");

  return (
    <Page size="LETTER" style={base.page}>
      {/* Encabezado (se repite en cada página) */}
      <View fixed style={{ position: "absolute", top: 30, left: 46, right: 46 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 9 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {logo && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={{ height: 34, maxWidth: 60, objectFit: "contain", marginRight: 9 }} />
            )}
            <View>
              <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: c.blue, letterSpacing: 0.3 }}>{s.tradeName.toUpperCase()}</Text>
              {s.tagline ? <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: c.orange, letterSpacing: 0.6, marginTop: 1 }}>{s.tagline}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {[cityLine, s.email, s.website].filter(Boolean).map((l) => (
              <Text key={l} style={{ fontSize: 8.5, color: GRAY }}>
                {l}
              </Text>
            ))}
          </View>
        </View>
        <View style={{ height: 1.2, backgroundColor: c.orange }} />
      </View>

      {watermark && (
        <View fixed style={{ position: "absolute", top: 360, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ fontSize: 90, color: watermark === "PAGADA" ? "#16a34a" : "#ef4444", opacity: 0.1, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" }}>
            {watermark}
          </Text>
        </View>
      )}

      {children}

      {/* Pie */}
      <View fixed style={{ position: "absolute", bottom: 22, left: 46, right: 46 }}>
        <View style={{ borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 7.5, color: GRAY }}>{`${s.tradeName} · ${footerLabel}`}</Text>
          <Text style={{ fontSize: 7.5, color: GRAY }} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </View>
    </Page>
  );
}

/** Título centrado con subtítulo en itálica. */
export function DocTitle({ s, title, subtitle, extra }: { s: CompanySettings; title: string; subtitle?: string; extra?: string }) {
  return (
    <View style={{ alignItems: "center", marginBottom: 12 }}>
      <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: s.primaryColor }}>{title}</Text>
      {subtitle ? <Text style={[base.italic, { fontSize: 9.5, color: GRAY, marginTop: 4, textAlign: "center" }]}>{subtitle}</Text> : null}
      {extra ? <Text style={{ fontSize: 8, color: GRAY, marginTop: 2 }}>{extra}</Text> : null}
    </View>
  );
}

/** Pestaña naranja de sección. `full` = barra a todo lo ancho. */
export function SectionTab({ s, children, full, bare }: { s: CompanySettings; children: string; full?: boolean; /** dentro de un bloque que ya no se parte */ bare?: boolean }) {
  return (
    <View
      wrap={bare ? undefined : false}
      minPresenceAhead={bare ? undefined : 90}
      style={{
        alignSelf: full ? "stretch" : "flex-start",
        backgroundColor: s.accentColor,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderBottomLeftRadius: full ? 4 : 0,
        borderBottomRightRadius: full ? 4 : 0,
        paddingVertical: 5,
        paddingHorizontal: 11,
        marginTop: 12,
        marginBottom: full ? 6 : 0,
        marginHorizontal: full ? 8 : 0,
      }}
    >
      <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{children}</Text>
    </View>
  );
}

export type Col = { title: string; width: string; align?: "left" | "right" | "center" };
export type CellStyle = "label" | "rate" | "strong" | "normal";

/** Tabla con encabezado azul y filas alternas color durazno. */
export function Table({
  s,
  cols,
  rows,
  styles = [],
  head,
}: {
  s: CompanySettings;
  cols: Col[];
  rows: (string | React.ReactNode)[][];
  /** Estilo por columna. */
  styles?: CellStyle[];
  /** Título (pestaña) que viaja pegado al encabezado y la primera fila. */
  head?: React.ReactNode;
}) {
  const c = palette(s);
  const cell = { paddingVertical: 6.5, paddingHorizontal: 7 } as const;
  const styleFor = (k: CellStyle | undefined) =>
    k === "label"
      ? { fontFamily: "Helvetica-Bold", color: c.blue }
      : k === "rate"
        ? { fontFamily: "Helvetica-Bold", color: c.orange }
        : k === "strong"
          ? { fontFamily: "Helvetica-Bold" }
          : {};
  return (
    <View>
      {rows.map((r, i) => {
        const row = (
          <View key={i} wrap={false} style={{ flexDirection: "row", backgroundColor: i % 2 === 0 ? c.peach : "#fff", borderBottomWidth: 0.5, borderBottomColor: "#e8e1da" }}>
            {r.map((v, j) => (
              <View key={j} style={[cell, { width: cols[j].width }]}>
                {typeof v === "string" ? <Text style={[{ textAlign: cols[j].align ?? "left", fontSize: 9, lineHeight: 1.3 }, styleFor(styles[j])]}>{v}</Text> : v}
              </View>
            ))}
          </View>
        );
        if (i > 0) return row;
        // El encabezado viaja con la primera fila para no quedar huérfano al final de una página.
        return (
          <View key="head" wrap={false}>
            {head}
            <View style={{ flexDirection: "row", backgroundColor: c.blue }}>
              {cols.map((col) => (
                <Text key={col.title} style={[cell, { width: col.width, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 8.5, textAlign: col.align ?? "left" }]}>
                  {col.title}
                </Text>
              ))}
            </View>
            {row}
          </View>
        );
      })}
    </View>
  );
}

/** Tabla Concepto | Detalle. */
export function DataTable({ s, rows }: { s: CompanySettings; rows: [string, string][] }) {
  return (
    <Table
      s={s}
      cols={[
        { title: "Concepto", width: "28%" },
        { title: "Detalle", width: "72%" },
      ]}
      rows={rows}
      styles={["label", "normal"]}
    />
  );
}

export function Note({ children }: { children: string }) {
  if (!children?.trim()) return null;
  return <Text style={[base.italic, { fontSize: 8, color: GRAY, marginTop: 5, lineHeight: 1.4 }]}>{children}</Text>;
}

/** Texto con **negritas** simples. */
export function Rich({ text, style }: { text: string; style?: Style }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <Text key={i} style={base.bold}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

/** Recuadro de aviso (fondo durazno, borde azul). */
export function NoticeBox({ s, text }: { s: CompanySettings; text: string }) {
  if (!text?.trim()) return null;
  return (
    <View wrap={false} style={{ marginTop: 16, backgroundColor: palette(s).peach, borderWidth: 1, borderColor: s.primaryColor, borderRadius: 2, padding: 10 }}>
      <Rich text={text} style={{ fontSize: 8.5, lineHeight: 1.45 }} />
    </View>
  );
}

/** Lista de condiciones: una por línea; "Título: texto" pone el título en negritas. */
export function Conditions({ s, text }: { s: CompanySettings; text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•■*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: 6, paddingHorizontal: 10 }}>
      {lines.map((l, i) => {
        const m = l.match(/^([^:]{2,60}):\s*(.*)$/);
        return (
          <View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: 2.5 }}>
            <View style={{ width: 6, height: 6, backgroundColor: s.accentColor, marginTop: 2.5, marginRight: 5 }} />
            <Text style={{ flex: 1, fontSize: 8.8, lineHeight: 1.35 }}>
              {m ? (
                <>
                  <Text style={{ fontFamily: "Helvetica-Bold", color: s.primaryColor }}>{m[1]}:</Text> {m[2]}
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

export function PdfDoc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Document title={title} author="Kurier ERP" creator="Kurier ERP" producer="Kurier ERP">
      {children}
    </Document>
  );
}

/** Recuadro informativo con barra lateral (notas del tarifario). tone: "blue" (fondo azul claro) o "peach". */
export function Callout({ s, text, tone = "blue" }: { s: CompanySettings; text: string; tone?: "blue" | "peach" }) {
  if (!text?.trim()) return null;
  const c = palette(s);
  return (
    <View
      wrap={false}
      style={{
        marginTop: 8,
        backgroundColor: tone === "blue" ? tint(c.blue, 0.92) : c.peach,
        borderLeftWidth: 3,
        borderLeftColor: tone === "blue" ? c.blue : c.orange,
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <Rich text={text} style={{ fontSize: 8.5, lineHeight: 1.45 }} />
    </View>
  );
}

/**
 * Tabla informativa definida como texto: columnas "Título:ancho|…" y una fila por línea con celdas separadas por |.
 * La primera columna va en negritas azules; las celdas con "$" se resaltan como tarifa.
 */
export function InfoTable({ s, title, columns, rows, note, full }: { s: CompanySettings; title: string; columns: string; rows: string; note?: string; full?: boolean }) {
  const defs = columns
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const m = c.match(/^(.*?):\s*(\d{1,3})\s*%?$/);
      return { title: m ? m[1].trim() : c, width: m ? Number(m[2]) : 0 };
    });
  if (!defs.length) return null;
  const fixed = defs.reduce((a, d) => a + d.width, 0);
  const free = defs.filter((d) => !d.width).length;
  const rest = free ? Math.max(0, 100 - fixed) / free : 0;
  const cols: Col[] = defs.map((d) => ({ title: d.title, width: `${d.width || rest}%` }));
  const data = rows
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .map((l) => {
      const cells = l.split("|").map((x) => x.trim());
      return cols.map((_, i) => cells[i] ?? "");
    });
  if (!data.length) return null;
  const isRate = data.every((r) => r.slice(1).every((v) => !v || v.includes("$")));
  return (
    <View>
      <Table
        s={s}
        head={
          <SectionTab s={s} full={full} bare>
            {title}
          </SectionTab>
        }
        cols={cols}
        rows={data}
        styles={["label", ...cols.slice(1).map((): CellStyle => (isRate ? "rate" : "normal"))]}
      />
      {note ? <Callout s={s} text={note} /> : null}
    </View>
  );
}
