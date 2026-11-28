import { prisma } from "./db";
import { getSettings } from "./settings";
import { applyBrand } from "./brands";
import { addDays, round2 } from "./money";
import { formatCurrency, toMxn } from "./currency";
import { formatMoney } from "./money";

/*
 * Cobranza: clientes con facturas abiertas (pendientes o con pago parcial), su saldo, atraso, último seguimiento
 * y promesa de pago, más el mensaje de recordatorio listo para WhatsApp o correo.
 * Los saldos se suman en MXN (las facturas en yuanes se convierten con su tipo de cambio guardado).
 */

export { CONTACT_KINDS, CONTACT_LABEL, isContactKind, type ContactKind } from "./collection-kinds";

const DAY = 86_400_000;
const OPEN = ["PENDIENTE", "PARCIAL"];

export type CollectionFilter = "todos" | "vencidos" | "por-vencer" | "promesas";

/** Clientes con saldo, del más atrasado al menos. `today` = fecha de hoy de la empresa (yyyy-mm-dd). */
export async function collectionBoard(today: string) {
  const asOf = new Date(`${today}T12:00:00Z`); // los vencimientos se guardan a mediodía UTC
  const soon = addDays(asOf, 7);
  const clients = await prisma.client.findMany({
    where: { invoices: { some: { status: { in: OPEN } } } },
    include: {
      brand: true,
      invoices: { where: { status: { in: OPEN } }, orderBy: { dueDate: "asc" } },
      collectionNotes: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });

  const rows = clients.map((c) => {
    const invoices = c.invoices.map((inv) => {
      const balance = round2(inv.total - inv.paidTotal);
      const days = Math.floor((asOf.getTime() - inv.dueDate.getTime()) / DAY);
      return { id: inv.id, folio: inv.folio, currency: inv.currency, exchangeRate: inv.exchangeRate, dueDate: inv.dueDate, issueDate: inv.issueDate, total: inv.total, balance, balanceMxn: toMxn(balance, inv), daysOverdue: Math.max(0, days), overdue: days > 0 };
    });
    const balance = round2(invoices.reduce((a, i) => a + i.balanceMxn, 0));
    const overdue = round2(invoices.filter((i) => i.overdue).reduce((a, i) => a + i.balanceMxn, 0));
    const dueSoon = round2(invoices.filter((i) => !i.overdue && i.dueDate <= soon).reduce((a, i) => a + i.balanceMxn, 0));
    const maxDays = invoices.reduce((a, i) => Math.max(a, i.daysOverdue), 0);
    // Promesa vigente: la más reciente con fecha (si ya pasó y sigue habiendo saldo vencido, está incumplida)
    const promise = c.collectionNotes.find((n) => n.promiseDate);
    const promiseState = !promise ? null : promise.promiseDate < today ? "broken" : promise.promiseDate === today ? "today" : "upcoming";
    return {
      id: c.id,
      name: c.name,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone.replace(/\D/g, ""),
      brand: c.brand,
      invoices,
      balance,
      overdue,
      dueSoon,
      maxDays,
      notes: c.collectionNotes,
      promise: promise ? { date: promise.promiseDate, amount: promise.promiseAmount, state: promiseState as "broken" | "today" | "upcoming" } : null,
    };
  });
  rows.sort((a, b) => b.maxDays - a.maxDays || b.overdue - a.overdue || b.balance - a.balance);

  const sum = (f: (r: (typeof rows)[number]) => number) => round2(rows.reduce((a, r) => a + f(r), 0));
  return {
    rows,
    totals: {
      balance: sum((r) => r.balance),
      overdue: sum((r) => r.overdue),
      dueSoon: sum((r) => r.dueSoon),
      clients: rows.length,
      overdueClients: rows.filter((r) => r.overdue > 0).length,
      promisesToday: rows.filter((r) => r.promise?.state === "today").length,
      promisesBroken: rows.filter((r) => r.promise?.state === "broken" && r.overdue > 0).length,
    },
  };
}

export type CollectionRow = Awaited<ReturnType<typeof collectionBoard>>["rows"][number];

export function filterRows(rows: CollectionRow[], f: CollectionFilter) {
  if (f === "vencidos") return rows.filter((r) => r.overdue > 0);
  if (f === "por-vencer") return rows.filter((r) => r.dueSoon > 0);
  if (f === "promesas") return rows.filter((r) => r.promise && (r.promise.state !== "broken" || r.overdue > 0));
  return rows;
}

const dmy = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/**
 * Recordatorio de pago para el cliente, en español (el cliente lo recibe tal cual; se puede editar antes de enviar).
 * Incluye saldo, facturas vencidas y por vencer, y los datos bancarios de la marca que le factura.
 */
export async function reminderMessage(r: CollectionRow) {
  // Solo se usan nombre, correo y datos bancarios: el logo no hace falta
  const s = applyBrand({ ...(await getSettings()), logoData: null }, r.brand);
  const who = r.contactName || r.name;
  const lines = r.invoices.map(
    (i) => `• ${i.folio}: ${formatCurrency(i.balance, i.currency)}${i.currency === "CNY" ? " CNY" : ""} · ${i.overdue ? `vencida desde el ${dmy(i.dueDate)} (${i.daysOverdue} días)` : `vence el ${dmy(i.dueDate)}`}`,
  );
  const bank = [s.bankName && `Banco: ${s.bankName}`, s.clabe && `CLABE: ${s.clabe}`, s.bankAccount && `Cuenta: ${s.bankAccount}`, s.legalName && `Beneficiario: ${s.legalName}`].filter(Boolean);
  const intro = r.overdue > 0 ? `te escribimos de ${s.tradeName} para recordarte que hay un saldo vencido en la cuenta de ${r.name}.` : `te escribimos de ${s.tradeName} para recordarte los próximos vencimientos de ${r.name}.`;
  const text = [
    `Hola ${who}, ${intro}`,
    "",
    `Saldo pendiente${r.invoices.some((i) => i.currency !== "MXN") ? " (equivalente en pesos)" : ""}: ${formatMoney(r.balance)} MXN${r.overdue > 0 ? ` (vencido: ${formatMoney(r.overdue)} MXN)` : ""}`,
    ...lines,
    "",
    ...(bank.length ? ["Datos para transferencia:", ...bank, `Referencia: ${r.invoices.map((i) => i.folio).join(", ")}`, ""] : []),
    r.overdue > 0 ? "¿Nos ayudas a confirmar la fecha de pago? Si ya lo realizaste, por favor compártenos el comprobante." : "Si ya lo programaste, por favor compártenos el comprobante cuando lo realices.",
    "",
    `Gracias, ${s.tradeName}`,
  ].join("\n");
  const subject = `${r.overdue > 0 ? "Saldo vencido" : "Próximos vencimientos"} · ${r.name} · ${s.tradeName}`;
  return { text, subject, fromEmail: s.email };
}

/** Enlace de WhatsApp con el mensaje (teléfono de 10 dígitos de México → 52 + número). */
export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${phone.length === 10 ? `52${phone}` : phone}?text=${encodeURIComponent(text)}`;
/** Enlace de correo (mailto) con asunto y cuerpo. */
export const mailtoUrl = (to: string, subject: string, body: string) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
