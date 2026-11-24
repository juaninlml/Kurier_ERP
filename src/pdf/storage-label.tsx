import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import type { StorageUnit } from "@prisma/client";
import { Barcode, KidoMark, QR } from "./label";

/*
 * Etiqueta del almacenamiento del transporte (4 × 6 pulgadas, impresora térmica). El repartidor la
 * escanea primero en /reparto y luego los paquetes que van dentro. QR y código de barras traen el código.
 */
export function StorageLabelPdf({ units }: { units: StorageUnit[] }) {
  return (
    <Document title="Etiquetas de almacenamiento" author="Kurier ERP" creator="Kurier ERP" producer="Kurier ERP">
      {units.map((u) => (
        <Page key={u.id} size={[288, 432]}>
          <View style={{ width: 288, height: 432, padding: 7, fontFamily: "Helvetica", color: "#000" }}>
            <View style={{ flex: 1, borderWidth: 1.5, borderColor: "#000", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: "#000" }}>
                <KidoMark size={30} />
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: -0.6, lineHeight: 1 }}>kurier kido</Text>
                  <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, marginTop: 1 }}>ALMACENAMIENTO DE REPARTO</Text>
                </View>
              </View>
              <Text style={{ marginTop: 18, marginHorizontal: 12, fontSize: u.name.length > 18 ? 20 : 26, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 1.1 }}>{u.name}</Text>
              <View style={{ marginTop: 14 }}>
                <QR value={u.code} size={150} />
              </View>
              <Text style={{ marginTop: 8, fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>{u.code}</Text>
              <View style={{ marginTop: 12 }}>
                <Barcode value={u.code.replace(/-/g, "")} width={240} height={48} />
              </View>
              <Text style={{ position: "absolute", bottom: 10, left: 10, right: 10, fontSize: 7, textAlign: "center" }}>
                1. Escanea esta etiqueta · 2. Escanea los paquetes que van aquí · 3. Cierra la carga
              </Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}
