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
  BORRADOR: "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20",
  ENVIADA: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  ACEPTADA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  RECHAZADA: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
  FACTURADA: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20",
  PENDIENTE: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  PARCIAL: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20",
  PAGADA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  CANCELADA: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-600/20",
  VENCIDA: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
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
