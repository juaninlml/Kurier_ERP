/**
 * Tarifario estándar de Kurier Fulfillment (V5). Precios sin IVA, MXN.
 * Fuente: Tarifario_Kurier_FulfillmentV5.pdf
 */

export type TarifaSection = { name: string; note: string };
export type Tarifa = {
  code: string;
  section: string;
  name: string;
  unitPrice: number;
  unit: string;
  description: string;
  priceText?: string;
  atCost?: boolean;
};

export const SECTIONS: TarifaSection[] = [
  { name: "Setup y Software", note: "" },
  {
    name: "Recibo de mercancía",
    note: "Toda mercancía debe llegar con cita programada y Packing List enviado con al menos 24 horas de anticipación. Sin cita, la recepción se agenda según disponibilidad del andén.",
  },
  {
    name: "Almacenamiento",
    note: "El almacenamiento se prorratea por quincena: mercancía que ingresa después del día 15 paga medio mes. La tarifa de término largo aplica a inventario sin movimiento por más de 90 días.",
  },
  {
    name: "Fulfillment (pick & pack)",
    note: "Peso volumétrico: se calcula como (largo × ancho × alto en cm) ÷ 5,000. Siempre se cobra el mayor entre peso real y peso volumétrico, criterio estándar de las paqueterías nacionales. Orden Ligera: 1 SKU o pieza de hasta 499 g, empacada en bolsa de envío con plástico burbuja. Vigencia mínima de 3 meses; no acumulable con otras condiciones preferenciales.",
  },
  {
    name: "Envíos nacionales",
    note: "La comisión por generación de guía es el único cargo de Kurier por este concepto. Las guías de envío se facturan al costo, sin margen; varían según la paquetería, el peso, el volumen y el destino.",
  },
  {
    name: "Última milla CDMX",
    note: "Una parada es una entrega en un solo domicilio; la tarifa es la misma sin importar cuántas cajas se entreguen. Servicio exclusivo dentro de la Ciudad de México, de lunes a viernes. Órdenes recibidas antes de las 16:00 hrs se entregan el siguiente día hábil, en ventana de 9:00 a 14:00 hrs. Tarifas preferenciales según el promedio de entregas diarias del mes.",
  },
  { name: "Logística inversa", note: "" },
  { name: "Servicios de valor agregado", note: "" },
];

export const TARIFAS: Tarifa[] = [
  // Setup y Software
  {
    code: "SET-01",
    section: "Setup y Software",
    name: "Setup inicial",
    unitPrice: 0,
    unit: "—",
    priceText: "Sin costo",
    description: "Configuración de la cuenta en nuestro WMS, integración con su tienda (Shopify, Mercado Libre, Amazon, WooCommerce), carga inicial del catálogo de SKUs, mapeo de ubicaciones y capacitación.",
  },
  {
    code: "SIS-01",
    section: "Setup y Software",
    name: "Costo de sistema",
    unitPrice: 500,
    unit: "Mes",
    description: "WMS con usuarios ilimitados, integraciones con sus canales de venta y con su ERP, y acceso a su panel para consultar stock, pedidos y movimientos en tiempo real.",
  },

  // Recibo de mercancía
  { code: "REC-01", section: "Recibo de mercancía", name: "Recepción por caja", unitPrice: 0, unit: "Caja", priceText: "Sin costo", description: "Conteo externo, validación de daños y ubicación en estantería. Ideal para envíos que llegan por paquetería." },
  { code: "REC-02", section: "Recibo de mercancía", name: "Recepción por tarima", unitPrice: 0, unit: "Tarima", priceText: "Sin costo", description: "Tarima organizada, emplayada, flejada y con Packing List correcto. Incluye descarga y ubicación con patín hidráulico." },
  {
    code: "REC-03",
    section: "Recibo de mercancía",
    name: "Recepción masiva",
    unitPrice: 350,
    unit: "Hora",
    description: "Cuando la carga llega a granel, sin paletizar, sin Packing List o con más del 30% de piezas por clasificar. Se cobra por hora-hombre, mínimo 1 hora.",
  },
  { code: "REC-04", section: "Recibo de mercancía", name: "Etiquetado de producto", unitPrice: 3, unit: "Pieza", description: "Si el producto llega sin código de barras, imprimimos y colocamos la etiqueta con el SKU interno." },

  // Almacenamiento
  { code: "ALM-01", section: "Almacenamiento", name: "Almacenamiento bin", unitPrice: 65, unit: "Bin / mes", description: "Para productos pequeños de alta rotación, en el área preferencial de picking. Medidas máximas del bin: 50 × 30 × 30 cm." },
  { code: "ALM-02", section: "Almacenamiento", name: "Almacenamiento tarima", unitPrice: 692, unit: "Tarima / mes", description: "Mercancía de reserva de SKUs de alta rotación. Medidas máximas 1.00 × 1.20 m y 1.50 m de altura." },
  {
    code: "ALM-03",
    section: "Almacenamiento",
    name: "Almacenamiento m³ alta rotación",
    unitPrice: 480,
    unit: "m³ / mes",
    description: "Productos medianos a grandes que no caben en bins dentro del área de picking, con alta rotación de salida-entrada.",
  },
  {
    code: "ALM-04",
    section: "Almacenamiento",
    name: "Almacenamiento término largo",
    unitPrice: 5668,
    unit: "m³ / pallet / mes",
    description: "Mercancía que solo se resguarda sin movimiento. Se entrega totalmente flejada y emplayada.",
  },

  // Fulfillment
  {
    code: "FUL-01",
    section: "Fulfillment (pick & pack)",
    name: "Orden Ligera (sujeta a volumen)",
    unitPrice: 25,
    unit: "Orden",
    description: "Órdenes de 1 SKU o pieza de hasta 499 g, con bolsa de envío y plástico burbuja. Requiere volumen mínimo comprometido de 1,500 órdenes al mes; si no se alcanza, se factura a la tarifa estándar por peso.",
  },
  { code: "FUL-02", section: "Fulfillment (pick & pack)", name: "Orden estándar sin empaque", unitPrice: 45, unit: "Orden", description: "Órdenes de hasta 4 SKUs iguales o mixtos (4 piezas), hasta 1 kg real o volumétrico. Incluye únicamente bolsa de envío." },
  { code: "FUL-03", section: "Fulfillment (pick & pack)", name: "Orden Estándar +", unitPrice: 65, unit: "Orden", description: "De 1.01 kg a 2 kg real o volumétrico. Incluye materiales de empaque estándar." },
  { code: "FUL-04", section: "Fulfillment (pick & pack)", name: "Orden Estándar ++", unitPrice: 85, unit: "Orden", description: "De 2.01 kg a 3 kg real o volumétrico. Incluye materiales de empaque estándar." },
  { code: "FUL-05", section: "Fulfillment (pick & pack)", name: "Orden Estándar +++", unitPrice: 110, unit: "Orden", description: "De 3.01 kg a 5 kg real o volumétrico. Incluye materiales de empaque estándar." },
  {
    code: "FUL-06",
    section: "Fulfillment (pick & pack)",
    name: "Excedente mayor a 5 kg",
    unitPrice: 15,
    unit: "Kg",
    priceText: "$110.00 + $15.00 / kg",
    description: "Tarifa base de Orden Estándar +++ más $15.00 por cada kilogramo adicional o fracción arriba de 5 kg.",
  },
  { code: "FUL-07", section: "Fulfillment (pick & pack)", name: "Pick SKU extra", unitPrice: 4, unit: "Pieza", description: "Por cada SKU o pieza adicional más allá de las 4 incluidas (ej. una orden de 5 piezas genera 1 cargo extra)." },

  // Envíos nacionales
  {
    code: "GUI-01",
    section: "Envíos nacionales",
    name: "Comisión por generación de guía",
    unitPrice: 5,
    unit: "Guía",
    description: "Solo en guías generadas por Kurier en nuestra integración, no en guías del cliente. No es el precio de la guía: el flete se factura aparte.",
  },
  {
    code: "GUI-02",
    section: "Envíos nacionales",
    name: "Guía de envío (flete, al costo, sin margen)",
    unitPrice: 0,
    unit: "Guía",
    atCost: true,
    priceText: "Al costo",
    description: "Costo real de paquetería del periodo (Estafeta, DHL, FedEx…), facturado sin margen.",
  },

  // Última milla CDMX
  { code: "UM-01", section: "Última milla CDMX", name: "Picking de caja cerrada", unitPrice: 12, unit: "Caja", description: "Surtido de la caja tal como la entrega el cliente, sin empaque adicional ni generación de guía." },
  { code: "UM-02", section: "Última milla CDMX", name: "Entrega Zona 1", unitPrice: 130, unit: "Parada", description: "Benito Juárez, Cuauhtémoc, Iztacalco, Venustiano Carranza, Coyoacán y Miguel Hidalgo. Sin límite de cajas por parada. De 10 a 19 entregas diarias: $110.00; 20 o más: $90.00." },
  { code: "UM-03", section: "Última milla CDMX", name: "Entrega Zona 2", unitPrice: 160, unit: "Parada", description: "Resto de las alcaldías de la Ciudad de México. Sin límite de cajas por parada. De 10 a 19 entregas diarias: $130.00; 20 o más: $110.00." },
  { code: "UM-04", section: "Última milla CDMX", name: "Entrega Zona 1 — 10 a 19 entregas diarias", unitPrice: 110, unit: "Parada", description: "Tarifa preferencial por volumen, aplica a todas las entregas del mes." },
  { code: "UM-05", section: "Última milla CDMX", name: "Entrega Zona 1 — 20 o más entregas diarias", unitPrice: 90, unit: "Parada", description: "Tarifa preferencial por volumen, aplica a todas las entregas del mes." },
  { code: "UM-06", section: "Última milla CDMX", name: "Entrega Zona 2 — 10 a 19 entregas diarias", unitPrice: 130, unit: "Parada", description: "Tarifa preferencial por volumen, aplica a todas las entregas del mes." },
  { code: "UM-07", section: "Última milla CDMX", name: "Entrega Zona 2 — 20 o más entregas diarias", unitPrice: 110, unit: "Parada", description: "Tarifa preferencial por volumen, aplica a todas las entregas del mes." },
  { code: "UM-08", section: "Última milla CDMX", name: "Reintento por entrega fallida", unitPrice: 0, unit: "Parada", priceText: "50% de la parada", description: "Aplica cuando el punto de entrega está cerrado o no hay quien reciba." },
  { code: "UM-09", section: "Última milla CDMX", name: "Tiempo de espera", unitPrice: 50, unit: "Fracción de 15 min", description: "Cuando la espera en el punto de entrega supera los primeros 15 minutos." },

  // Logística inversa
  {
    code: "DEV-01",
    section: "Logística inversa",
    name: "Procesamiento de devolución",
    unitPrice: 45,
    unit: "Orden",
    description: "Recepción del paquete, inspección visual, reporte con fotografía y reingreso al inventario si cumple las condiciones, en 48 horas hábiles.",
  },
  { code: "DEV-02", section: "Logística inversa", name: "Reacondicionamiento", unitPrice: 20, unit: "Producto", description: "Limpieza, cambio de bolsa, nueva etiqueta o planchado ligero para volver a ponerse a la venta. El material lo suministra el cliente." },
  { code: "DEV-03", section: "Logística inversa", name: "Desecho", unitPrice: 0, unit: "—", priceText: "A cotizar", description: "Destrucción o gestión de residuos de productos no aptos, según cantidad y tipo (referencia: desde $1,200 por m³)." },

  // Valor agregado
  { code: "VAL-01", section: "Servicios de valor agregado", name: "Caja personalizada", unitPrice: 0, unit: "Pieza", priceText: "A cotizar", description: "Diseño y producción de caja personalizada para su marca, para producto individual o kits." },
  { code: "VAL-02", section: "Servicios de valor agregado", name: "Armado de kits", unitPrice: 25, unit: "Kit", description: "Armado de kits de SKUs iguales o mixtos. El material lo suministra el cliente o lo suministramos bajo cotización." },
  { code: "VAL-03", section: "Servicios de valor agregado", name: "Insertos de marketing", unitPrice: 3, unit: "Orden", description: "Inclusión de flyer, sticker o tarjeta de agradecimiento dentro del paquete." },
  { code: "VAL-04", section: "Servicios de valor agregado", name: "Armado de caja personalizada", unitPrice: 5, unit: "Caja", description: "Armado de cajas más complejas o que integran distintos elementos." },
  {
    code: "VAL-05",
    section: "Servicios de valor agregado",
    name: "Manejo de canales de venta",
    unitPrice: 0,
    unit: "Canal de venta",
    priceText: "A cotizar",
    description: "Gestión de sus canales en marketplaces (Mercado Libre, Amazon, Liverpool, Walmart). Cuota base mensual más comisión de 4% a 5% sobre ventas totales.",
  },
  { code: "VAL-06", section: "Servicios de valor agregado", name: "Inventario cíclico extraordinario", unitPrice: 1500, unit: "Evento", description: "Conteo físico total fuera de calendario, a solicitud del cliente. Incluimos sin costo un conteo cíclico por trimestre." },
];

export const QUOTE_TERMS = [
  "Vigencia de esta cotización: 30 días naturales a partir de su emisión.",
  "Documentación para formalizar: únicamente se firman un Acuerdo de Confidencialidad (NDA) y un Contrato de Prestación de Servicios. No es un contrato de plazo forzoso; opera mes a mes por defecto.",
  "Volumen mínimo: no exigimos volumen mínimo mensual de pedidos.",
  "Horario de corte: los pedidos recibidos antes de las 13:00 hrs se surten el mismo día hábil.",
  "Horarios: almacén de lunes a viernes de 7:00 a 14:30 hrs y sábados de 7:00 a 13:00 hrs. Administrativo de lunes a viernes de 9:00 a 17:00 hrs.",
  "Seguro de mercancía: la mercancía en nuestras instalaciones está cubierta por una póliza de responsabilidad civil. El seguro ampliado se cotiza según el valor del inventario.",
  "Depósito en garantía: equivalente a un mes de almacenamiento estimado, reembolsable al término del contrato si no hay saldos pendientes.",
  "Facturación y pago: almacenaje por adelantado y servicios variables por consumo real. Semanal al inicio, con pago a 8 días naturales contra factura; después quincenal o mensual.",
  "Contratos con compromiso: los clientes que firmen a 12 meses o más obtienen protección de precio durante toda la vigencia.",
  "Paqueterías e IVA: el flete se factura al costo, sin indirectos de Kurier. Todos los precios son sin IVA; al total facturado se agrega el 16%.",
].join("\n");

export const INVOICE_DISCLAIMER =
  "Este documento es un **formato interno de facturación / estado de cuenta** de Kurier Fulfillment y no sustituye el CFDI fiscal, que se timbra a través de nuestro proveedor autorizado (PAC) conforme al SAT una vez confirmados los datos fiscales del cliente. La guía de envío se factura al costo, sin ningún indirecto agregado por Kurier Fulfillment. Todos los precios de este formato se expresan sin IVA; al total facturado se agrega el 16% correspondiente.";
