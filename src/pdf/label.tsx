import React from "react";
import { Document, Page, View, Text, Svg, Path, Rect, Circle } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { CompanySettings, Shipment } from "@prisma/client";

/*
 * Guía de última milla en formato 4 × 6 pulgadas (288 × 432 pt) para impresora térmica.
 * Una página por bulto. Con `sheet` se imprime en hoja carta horizontal con líneas de corte.
 */

// ───────── Código de barras Code 128 (juego B) ─────────
const C128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

/** Módulos (anchos de barra/espacio) de un texto en Code 128-B, con inicio, verificador y fin. */
function code128(text: string) {
  const values = [...text].map((ch) => {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 94) throw new Error(`Carácter no válido para el código de barras: ${ch}`);
    return v;
  });
  const check = (104 + values.reduce((a, v, i) => a + v * (i + 1), 0)) % 103;
  return [104, ...values, check, 106].map((v) => C128[v]).join("");
}

function Barcode({ value, width, height }: { value: string; width: number; height: number }) {
  const pattern = code128(value);
  const modules = [...pattern].reduce((a, d) => a + Number(d), 0);
  const unit = width / modules;
  let x = 0;
  let d = "";
  [...pattern].forEach((w, i) => {
    const n = Number(w) * unit;
    if (i % 2 === 0) d += `M${x.toFixed(3)} 0h${n.toFixed(3)}v${height}h-${n.toFixed(3)}z`;
    x += n;
  });
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={d} fill="#000" />
    </Svg>
  );
}

function QR({ value, size }: { value: string; size: number }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.data[r * n + c]) d += `M${c} ${r}h1v1h-1z`;
  return (
    <Svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`}>
      <Rect x={-1} y={-1} width={n + 2} height={n + 2} fill="#fff" />
      <Path d={d} fill="#000" />
    </Svg>
  );
}

/**
 * Símbolo de Kurier Kido (núcleo, órbita que pasa por delante y por detrás, y satélite) en negro,
 * para impresión térmica: mismo trazo que el logo de la app (src/components/KidoLogo.tsx).
 */
function KidoMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-32 -32 64 64">
      <Path d="M -25.3 6.6 A 26 9.5 -22 0 1 25.3 -6.6" fill="none" stroke="#000" strokeWidth={3.6} strokeLinecap="round" />
      <Circle cx={0} cy={0} r={10.5} fill="#000" stroke="#fff" strokeWidth={2.5} />
      <Path d="M 25.3 -6.6 A 26 9.5 -22 0 1 -25.3 6.6" fill="none" stroke="#000" strokeWidth={3.6} strokeLinecap="round" />
      <Circle cx={21.5} cy={5.6} r={4.8} fill="#000" stroke="#fff" strokeWidth={1.6} />
      <Circle cx={-18} cy={-24} r={2.6} fill="#000" />
    </Svg>
  );
}

// ───────── Guía ─────────

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortDate = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}-${MONTHS[Number(p.month) - 1]}-${p.year}`;
};
const phone = (p: string) => (p.length === 10 ? `${p.slice(0, 2)} ${p.slice(2, 6)} ${p.slice(6)}` : p);
const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INK = "#000";
const line = { borderBottomWidth: 1, borderBottomColor: INK } as const;
const small = { fontSize: 6, letterSpacing: 0.2 } as const;

function Label({ sh, n, of, trackUrl }: { s: CompanySettings; sh: Shipment; n: number; of: number; trackUrl?: string }) {
  const borough = (sh.borough || sh.destCity || "").toUpperCase();
  const street = [sh.destStreet, sh.destNumber].filter(Boolean).join(" ");
  const colony = [sh.destColony && `Col. ${sh.destColony}`, sh.borough && `Alc. ${sh.borough}`].filter(Boolean).join(", ");
  const city = `${sh.destCity || "Ciudad de México"}, CP ${sh.destZip}`;
  const originLines = [
    [sh.originStreet, sh.originNumber].filter(Boolean).join(" ") + (sh.originColony ? `, Col. ${sh.originColony}` : ""),
    [sh.originCity, sh.originState].filter(Boolean).join(", ") + ` ${sh.originZip}`,
    sh.originPhone ? `Tel. ${phone(sh.originPhone)}` : sh.originEmail,
  ].filter((x) => x && x.trim());
  const code = sh.tracking.replace(/-/g, "");

  return (
    <View style={{ width: 288, height: 432, padding: 7, fontFamily: "Helvetica", color: INK }}>
      <View style={{ flex: 1, borderWidth: 1.5, borderColor: INK }}>
        {/* Encabezado */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: INK }}>
          <KidoMark size={30} />
          <View style={{ flex: 1, marginLeft: 5 }}>
            <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: -0.6, lineHeight: 1 }}>kurier kido</Text>
            <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, marginTop: 1 }}>GUÍA DE ÚLTIMA MILLA · CDMX</Text>
          </View>
          <View style={{ backgroundColor: INK, paddingHorizontal: 7, paddingVertical: 3, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Helvetica-Bold" }}>ZONA {sh.zone}</Text>
            <Text style={{ color: "#fff", fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 }}>{sh.serviceLevel === "DIA_SIGUIENTE" ? "DÍA SIGUIENTE" : "MISMO DÍA"}</Text>
          </View>
        </View>

        {/* Alcaldía y CP */}
        <View style={{ paddingHorizontal: 6, paddingTop: 3, paddingBottom: 2, ...line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Text style={{ fontSize: borough.length > 15 ? 14 : borough.length > 11 ? 17 : 20, fontFamily: "Helvetica-Bold", flex: 1 }}>{borough}</Text>
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", marginLeft: 6 }}>{sh.destZip}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 1 }}>
            <Text style={{ fontSize: 6.5 }}>
              RUTA {sh.route || "—"} · PARADA {sh.stop || "—"}
            </Text>
            <Text style={{ fontSize: 6.5 }}>
              Fecha {shortDate(sh.createdAt)} · Bulto {n} / {of}
            </Text>
          </View>
        </View>

        {/* Destinatario */}
        <View style={{ paddingHorizontal: 6, paddingVertical: 4, ...line }}>
          <Text style={small}>DESTINATARIO</Text>
          <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 1 }}>{sh.destName}</Text>
          {sh.destCompany ? <Text style={{ fontSize: 8 }}>{sh.destCompany}</Text> : null}
          <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{street}</Text>
          {colony ? <Text style={{ fontSize: 8.5, marginTop: 1 }}>{colony}</Text> : null}
          <Text style={{ fontSize: 8.5, marginTop: 1 }}>{city}</Text>
          <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 2 }}>Tel. {phone(sh.destPhone)}</Text>
          <Text style={{ fontSize: 7.5, marginTop: 1 }}>Ref: {sh.destRef || "—"}</Text>
        </View>

        {/* QR y número de guía */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 5, ...line }}>
          <QR value={trackUrl || sh.tracking} size={74} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={small}>GUÍA</Text>
            <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold" }}>{sh.tracking}</Text>
            <Text style={{ ...small, marginTop: 3 }}>REFERENCIA KURIER</Text>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>{sh.reference}</Text>
            {sh.cod > 0 ? (
              <View style={{ backgroundColor: INK, paddingHorizontal: 4, paddingVertical: 2, marginTop: 3, alignSelf: "flex-start" }}>
                <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold" }}>COBRAR AL ENTREGAR {money(sh.cod)}</Text>
              </View>
            ) : (
              <>
                <Text style={{ ...small, marginTop: 3 }}>SERVICIO</Text>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>Entrega a domicilio · {sh.serviceLevel === "DIA_SIGUIENTE" ? "día siguiente" : "mismo día"}</Text>
              </>
            )}
            <Text style={{ fontSize: 6, marginTop: 2 }}>Escanea para rastrear · al entregar: foto y firma</Text>
          </View>
        </View>

        {/* Código de barras */}
        <View style={{ alignItems: "center", paddingVertical: 5, ...line }}>
          <Barcode value={code} width={200} height={40} />
          <Text style={{ fontSize: 7, marginTop: 2, letterSpacing: 1 }}>{code}</Text>
        </View>

        {/* Remitente y firma */}
        <View style={{ flexDirection: "row", flex: 1 }}>
          <View style={{ flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: INK }}>
            <Text style={small}>REMITENTE</Text>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginTop: 1 }}>{sh.originCompany || sh.originName}</Text>
            {sh.originCompany && sh.originName !== sh.originCompany ? <Text style={{ fontSize: 6.5 }}>{sh.originName}</Text> : null}
            {originLines.map((l) => (
              <Text key={l} style={{ fontSize: 6.5 }}>
                {l}
              </Text>
            ))}
            <Text style={{ fontSize: 6, marginTop: 3 }}>
              {sh.packageType === "SOBRE" ? "Sobre" : "Caja"}
              {sh.weightKg ? ` · ${sh.weightKg} kg` : ""}
              {sh.content ? ` · ${sh.content}` : ""}
            </Text>
          </View>
          <View style={{ flex: 1, padding: 5 }}>
            <Text style={small}>RECIBE (NOMBRE Y FIRMA)</Text>
            <View style={{ borderBottomWidth: 0.8, borderBottomColor: INK, marginTop: 26 }} />
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <Text style={{ fontSize: 6.5, marginRight: 4 }}>Intento:</Text>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 6 }}>
                  <View style={{ width: 7, height: 7, borderWidth: 0.8, borderColor: INK, marginRight: 2 }} />
                  <Text style={{ fontSize: 6.5 }}>{i}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ShipmentLabelPdf({ s, sh, sheet, trackUrl }: { s: CompanySettings; sh: Shipment; sheet?: boolean; trackUrl?: string }) {
  const pages = Array.from({ length: Math.max(1, sh.packages) }, (_, i) => i + 1);
  const dash = { borderStyle: "dashed", borderColor: "#888", position: "absolute" } as const;
  return (
    <Document title={`Guía ${sh.tracking}`} author="Kurier ERP" creator="Kurier ERP" producer="Kurier ERP">
      {pages.map((n) =>
        sheet ? (
          // Hoja carta horizontal (792 × 612): la guía al centro con líneas de corte
          <Page key={n} size="LETTER" orientation="landscape" style={{ position: "relative" }}>
            <View style={{ position: "absolute", left: 252, top: 90 }}>
              <Label s={s} sh={sh} n={n} of={pages.length} trackUrl={trackUrl} />
            </View>
            <View style={{ ...dash, left: 0, right: 0, top: 90, borderTopWidth: 0.6 }} />
            <View style={{ ...dash, left: 0, right: 0, top: 522, borderTopWidth: 0.6 }} />
            <View style={{ ...dash, top: 0, bottom: 0, left: 252, borderLeftWidth: 0.6 }} />
            <View style={{ ...dash, top: 0, bottom: 0, left: 540, borderLeftWidth: 0.6 }} />
            <Text style={{ position: "absolute", bottom: 26, left: 0, right: 0, textAlign: "center", fontSize: 7, color: "#555", fontFamily: "Helvetica" }}>
              Hoja carta horizontal · imprimir al 100% (sin ajustar a página) y recortar por las líneas punteadas
            </Text>
          </Page>
        ) : (
          <Page key={n} size={[288, 432]}>
            <Label s={s} sh={sh} n={n} of={pages.length} trackUrl={trackUrl} />
          </Page>
        ),
      )}
    </Document>
  );
}
