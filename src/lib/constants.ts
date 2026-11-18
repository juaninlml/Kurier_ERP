export const QUOTE_STATUSES = ["BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA", "FACTURADA"] as const;
export const INVOICE_STATUSES = ["PENDIENTE", "PARCIAL", "PAGADA", "CANCELADA"] as const;

export const STATUS_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  FACTURADA: "Facturada",
  PENDIENTE: "Pendiente",
  PARCIAL: "Pago parcial",
  PAGADA: "Pagada",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
};

export const STATUS_TONES: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  ENVIADA: "bg-blue-100 text-blue-700",
  ACEPTADA: "bg-emerald-100 text-emerald-700",
  RECHAZADA: "bg-rose-100 text-rose-700",
  FACTURADA: "bg-violet-100 text-violet-700",
  PENDIENTE: "bg-amber-100 text-amber-800",
  PARCIAL: "bg-sky-100 text-sky-700",
  PAGADA: "bg-emerald-100 text-emerald-700",
  CANCELADA: "bg-slate-200 text-slate-600",
  VENCIDA: "bg-rose-100 text-rose-700",
};

export const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Tarjeta", "Cheque", "Depósito", "Otro"] as const;

export const INCOME_CATEGORIES = [
  "Cobro de facturas",
  "Servicios de fulfillment",
  "Almacenaje",
  "Envíos",
  "Otros ingresos",
] as const;

export const EXPENSE_CATEGORIES = [
  "Nómina",
  "Renta de almacén",
  "Paquetería y fletes",
  "Material de empaque",
  "Servicios (luz, agua, internet)",
  "Software y sistemas",
  "Mantenimiento",
  "Combustible y transporte",
  "Impuestos",
  "Comisiones bancarias",
  "Publicidad",
  "Otros gastos",
] as const;

export const UNITS = ["Servicio", "Pieza", "Pedido", "Tarima", "m³", "Caja", "Mes", "Hora", "Kg", "Envío"] as const;
