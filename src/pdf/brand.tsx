import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

// Sin guiones de separación automática (evita "FI-NANCIERO", folios cortados, etc.)
Font.registerHyphenationCallback((word) => [word]);
import type { CompanySettings } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { formatMoney, formatNumber, amountInWords } from "@/lib/money";

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
  const candidates = [s.logoPath, "/branding/logo.png", "/branding/logo.jpg"];
  for (const rel of candidates) {
    const p = path.join(process.cwd(), "public", rel);
    if (existsSync(p)) {
      const format = p.toLowerCase().endsWith(".png") ? "png" : "jpg";
      return { data: readFileSync(p), format } as const;
    }
  }
  return null;
}

export const base = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 60, paddingHorizontal: 0, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  body: { paddingHorizontal: 36 },
  muted: { color: "#64748b" },
  bold: { fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" },
  box: { borderRadius: 4, padding: 10 },
});

type MetaRow = { label: string; value: string };

export function BrandedPage({
  s,
  title,
  folio,
  meta,
  watermark,
  children,
}: {
  s: CompanySettings;
  title: string;
  folio?: string;
  meta: MetaRow[];
  watermark?: string;
  children: React.ReactNode;
}) {
  const logo = loadLogo(s);
  const addressLine = [s.address, [s.city, s.state].filter(Boolean).join(", "), s.zip ? `C.P. ${s.zip}` : ""]
    .filter(Boolean)
    .join(" · ");
  const contactLine = [s.phone, s.email, s.website].filter(Boolean).join(" · ");

  return (
    <Page size="LETTER" style={base.page}>
      {/* Franja superior de marca */}
      <View fixed style={{ height: 6, backgroundColor: s.primaryColor }} />
      <View fixed style={{ height: 3, backgroundColor: s.accentColor, width: "35%" }} />

      {watermark && (
        <View fixed style={{ position: "absolute", top: 330, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ fontSize: 90, color: "#ef4444", opacity: 0.12, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" }}>
            {watermark}
          </Text>
        </View>
      )}

      {/* Encabezado */}
      <View style={[base.body, { flexDirection: "row", justifyContent: "space-between", paddingTop: 24, paddingBottom: 16 }]}>
        <View style={{ width: "55%" }}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logo} style={{ maxHeight: 52, maxWidth: 190, objectFit: "contain", marginBottom: 8 }} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: s.accentColor, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Helvetica-Bold" }}>{s.tradeName.charAt(0)}</Text>
              </View>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: s.primaryColor }}>{s.tradeName}</Text>
            </View>
          )}
          {s.legalName ? <Text style={base.bold}>{s.legalName}</Text> : null}
          {s.rfc ? <Text style={base.muted}>RFC: {s.rfc}</Text> : null}
          {addressLine ? <Text style={base.muted}>{addressLine}</Text> : null}
          {contactLine ? <Text style={base.muted}>{contactLine}</Text> : null}
        </View>
        <View style={{ width: "42%", alignItems: "flex-end" }}>
          <Text style={{ fontSize: title.length > 14 ? 16 : 20, fontFamily: "Helvetica-Bold", color: s.primaryColor, letterSpacing: 1, textAlign: "right" }}>{title}</Text>
          {folio && <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: s.accentColor, marginTop: 2 }}>{folio}</Text>}
          <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: tint(s.primaryColor, 0.8), paddingTop: 6, width: "100%" }}>
            {meta.map((m) => (
              <View key={m.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={base.muted}>{m.label}</Text>
                <Text style={base.bold}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={base.body}>{children}</View>

      {/* Pie */}
      <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36 }}>
        <View style={{ borderTopWidth: 1, borderTopColor: tint(s.primaryColor, 0.8), paddingTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[base.muted, { fontSize: 7 }]}>
            Documento informativo sin validez fiscal. No sustituye a un CFDI.
          </Text>
          <Text style={[base.muted, { fontSize: 7 }]} render={({ pageNumber, totalPages }) => `${s.tradeName} · Página ${pageNumber} de ${totalPages}`} />
        </View>
      </View>
    </Page>
  );
}

export function PartyBox({
  s,
  title,
  name,
  lines,
}: {
  s: CompanySettings;
  title: string;
  name: string;
  lines: (string | null | undefined)[];
}) {
  return (
    <View style={[base.box, { backgroundColor: tint(s.primaryColor, 0.94), borderLeftWidth: 3, borderLeftColor: s.accentColor, marginBottom: 14 }]}>
      <Text style={[base.sectionTitle, { color: s.primaryColor }]}>{title}</Text>
      <Text style={[base.bold, { fontSize: 11, marginBottom: 2 }]}>{name}</Text>
      {lines.filter(Boolean).map((l, i) => (
        <Text key={i} style={base.muted}>
          {l}
        </Text>
      ))}
    </View>
  );
}

type Item = { code: string; description: string; unit: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number; amount: number };

export function ItemsTable({ s, items }: { s: CompanySettings; items: Item[] }) {
  const hasDiscount = items.some((i) => i.discountPct > 0);
  const cols = hasDiscount
    ? { code: "10%", desc: "36%", unit: "10%", qty: "8%", price: "13%", disc: "8%", amount: "15%" }
    : { code: "11%", desc: "42%", unit: "11%", qty: "8%", price: "13%", disc: "0%", amount: "15%" };
  const th = { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 8 } as const;
  const cell = { paddingVertical: 6, paddingHorizontal: 4 } as const;
  return (
    <View style={{ marginBottom: 12 }}>
      <View fixed style={{ flexDirection: "row", backgroundColor: s.primaryColor, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
        <Text style={[th, cell, { width: cols.code }]}>CLAVE</Text>
        <Text style={[th, cell, { width: cols.desc }]}>DESCRIPCIÓN</Text>
        <Text style={[th, cell, { width: cols.unit }]}>UNIDAD</Text>
        <Text style={[th, cell, { width: cols.qty, textAlign: "right" }]}>CANT.</Text>
        <Text style={[th, cell, { width: cols.price, textAlign: "right" }]}>P. UNIT.</Text>
        {hasDiscount && <Text style={[th, cell, { width: cols.disc, textAlign: "right" }]}>DESC.</Text>}
        <Text style={[th, cell, { width: cols.amount, textAlign: "right" }]}>IMPORTE</Text>
      </View>
      {items.map((it, i) => (
        <View
          key={i}
          wrap={false}
          style={{
            flexDirection: "row",
            backgroundColor: i % 2 ? tint(s.primaryColor, 0.95) : "#fff",
            borderBottomWidth: 0.5,
            borderBottomColor: "#e2e8f0",
          }}
        >
          <Text style={[cell, { width: cols.code, color: "#64748b" }]}>{it.code}</Text>
          <Text style={[cell, { width: cols.desc }]}>{it.description}</Text>
          <Text style={[cell, { width: cols.unit }]}>{it.unit}</Text>
          <Text style={[cell, { width: cols.qty, textAlign: "right" }]}>{formatNumber(it.quantity)}</Text>
          <Text style={[cell, { width: cols.price, textAlign: "right" }]}>{formatMoney(it.unitPrice)}</Text>
          {hasDiscount && <Text style={[cell, { width: cols.disc, textAlign: "right" }]}>{it.discountPct ? `${formatNumber(it.discountPct)}%` : "—"}</Text>}
          <Text style={[cell, { width: cols.amount, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{formatMoney(it.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

export function TotalsBlock({
  s,
  subtotal,
  discount,
  tax,
  total,
  extra,
}: {
  s: CompanySettings;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  extra?: { label: string; value: string; strong?: boolean }[];
}) {
  const row = { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 8 } as const;
  return (
    <View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
      <View style={{ width: "55%", paddingRight: 12 }}>
        <Text style={[base.sectionTitle, { color: s.primaryColor }]}>Importe con letra</Text>
        <Text style={{ fontSize: 8.5 }}>{amountInWords(total)}</Text>
      </View>
      <View style={{ width: "40%" }}>
        <View style={row}>
          <Text style={base.muted}>Subtotal</Text>
          <Text>{formatMoney(subtotal)}</Text>
        </View>
        {discount > 0 && (
          <View style={row}>
            <Text style={base.muted}>Descuento</Text>
            <Text>-{formatMoney(discount)}</Text>
          </View>
        )}
        <View style={row}>
          <Text style={base.muted}>IVA</Text>
          <Text>{formatMoney(tax)}</Text>
        </View>
        <View style={[row, { backgroundColor: s.primaryColor, borderRadius: 4, paddingVertical: 6, marginTop: 4 }]}>
          <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>TOTAL MXN</Text>
          <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>{formatMoney(total)}</Text>
        </View>
        {extra?.map((e) => (
          <View key={e.label} style={row}>
            <Text style={e.strong ? [base.bold, { color: s.accentColor }] : base.muted}>{e.label}</Text>
            <Text style={e.strong ? [base.bold, { color: s.accentColor }] : {}}>{e.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TextSection({ s, title, text }: { s: CompanySettings; title: string; text: string }) {
  if (!text?.trim()) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[base.sectionTitle, { color: s.primaryColor }]}>{title}</Text>
      <Text style={{ fontSize: 8.5, lineHeight: 1.4 }}>{text}</Text>
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
