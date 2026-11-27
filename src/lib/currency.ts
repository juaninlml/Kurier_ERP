import { formatMoney, round2 } from "./money";

/*
 * Moneda de las facturas: pesos mexicanos (MXN) o yuan/renminbi (CNY; yuan y renminbi son la misma moneda).
 * `exchangeRate` siempre es "MXN por 1 unidad de la moneda de la factura": 1 en MXN, p. ej. 2.55 en CNY.
 * Los importes de la factura, sus pagos y su saldo están en su moneda; la contabilidad y los reportes
 * siempre suman en MXN (importe × tipo de cambio guardado en la factura).
 */
export const CURRENCIES = ["MXN", "CNY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (v: unknown): v is Currency => CURRENCIES.includes(v as Currency);
export const currencyOf = (v: unknown): Currency => (isCurrency(v) ? v : "MXN");

export const CURRENCY_NAMES: Record<Currency, string> = {
  MXN: "Pesos mexicanos (MXN)",
  CNY: "Yuan / renminbi (CNY)",
};

const cny = new Intl.NumberFormat("es-MX", { style: "currency", currency: "CNY", currencyDisplay: "narrowSymbol" });

/** $1,234.50 en MXN; ¥1,234.50 en CNY. */
export const formatCurrency = (n: number, currency: string = "MXN") => (currency === "CNY" ? cny.format(n || 0) : formatMoney(n));

/** Con el código al final: "¥1,234.50 CNY" / "$1,234.50 MXN". */
export const formatCurrencyCode = (n: number, currency: string = "MXN") => `${formatCurrency(n, currency)} ${currencyOf(currency)}`;

/** Tipo de cambio válido (MXN por unidad); MXN siempre es 1. */
export const rateOf = (inv: { currency?: string | null; exchangeRate?: number | null }) =>
  inv.currency === "CNY" && inv.exchangeRate && inv.exchangeRate > 0 ? inv.exchangeRate : 1;

/** Importe de una factura convertido a MXN con su tipo de cambio guardado. */
export const toMxn = (amount: number, inv: { currency?: string | null; exchangeRate?: number | null }) => round2(amount * rateOf(inv));

/** "1 CNY = $2.5512 MXN" */
export const exchangeRateLabel = (rate: number) => `1 CNY = $${rate.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} MXN`;
