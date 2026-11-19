import { after } from "next/server";
import { prisma } from "./db";
import { driveConfigured, uploadPdf } from "./drive";
import { quoteParty } from "./quote-party";
import { addDaysStr } from "./attendance";
import { renderInvoice, renderOrdersSummary, renderPayrollReceipts, renderQuote } from "@/pdf/render";

/*
 * Archivo en Google Drive: cada documento que genera el ERP se guarda como PDF en
 *   Clientes / <cliente> / Facturas / <año>
 *   Clientes / <cliente> / Cotizaciones / <año>       (Prospectos / <nombre> / … si aún no es cliente)
 *   Clientes / <cliente> / Resúmenes de órdenes / <año>
 *   Nómina / <año> / Semana del <fecha>
 * Se sube después de responder (no hace esperar al usuario) y, si falla, queda pendiente
 * para "Subir pendientes" en Configuración.
 */

export type ArchiveKind = "factura" | "cotizacion" | "nomina" | "ordenes";
export const KIND_LABEL: Record<ArchiveKind, string> = { factura: "Facturas", cotizacion: "Cotizaciones", nomina: "Nómina", ordenes: "Resúmenes de órdenes" };

const year = (d: Date) => String(d.getUTCFullYear());
type Plan = { kind: ArchiveKind; path: string[]; render: () => Promise<{ filename: string; buffer: Buffer } | null> };

async function planFor(ref: string): Promise<Plan | null> {
  const [kind, a, b] = ref.split(":");
  const id = Number(a);
  switch (kind) {
    case "factura": {
      const inv = await prisma.invoice.findUnique({ where: { id }, select: { issueDate: true, client: { select: { name: true } } } });
      if (!inv) return null;
      return { kind, path: ["Clientes", inv.client.name, "Facturas", year(inv.issueDate)], render: () => renderInvoice(id) };
    }
    case "cotizacion": {
      const qt = await prisma.quote.findUnique({ where: { id }, include: { client: true } });
      if (!qt) return null;
      const p = quoteParty(qt);
      return { kind, path: [p.isProspect ? "Prospectos" : "Clientes", p.name, "Cotizaciones", year(qt.issueDate)], render: () => renderQuote(id) };
    }
    case "nomina": {
      const run = await prisma.payrollRun.findUnique({ where: { id }, select: { periodStart: true } });
      if (!run) return null;
      const start = run.periodStart.toISOString().slice(0, 10);
      return { kind, path: ["Nómina", year(run.periodStart), `Semana del ${start}`], render: () => renderPayrollReceipts(id) };
    }
    case "ordenes": {
      const client = await prisma.client.findUnique({ where: { id }, select: { name: true } });
      if (!client || !b) return null;
      return { kind, path: ["Clientes", client.name, "Resúmenes de órdenes", b.slice(0, 4)], render: () => renderOrdersSummary(id, b, addDaysStr(b, 6)) };
    }
  }
  return null;
}

/** Genera el PDF y lo sube (o reemplaza) en Drive. Nunca lanza: el error queda registrado. */
export async function archiveNow(ref: string): Promise<boolean> {
  if (!driveConfigured()) return false;
  const current = await prisma.driveFile.findUnique({ where: { refKey: ref } });
  try {
    const plan = await planFor(ref);
    if (!plan) return false;
    const pdf = await plan.render();
    if (!pdf) return false;
    const up = await uploadPdf({ path: plan.path, name: pdf.filename, pdf: pdf.buffer, fileId: current?.fileId || undefined });
    const data = { kind: plan.kind, fileId: up.id, folderId: up.folderId, link: up.link, name: pdf.filename, error: "", syncedAt: new Date() };
    await prisma.driveFile.upsert({ where: { refKey: ref }, create: { refKey: ref, ...data }, update: data });
    return true;
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error(`[drive] ${ref}:`, e);
    await prisma.driveFile
      .upsert({ where: { refKey: ref }, create: { refKey: ref, kind: ref.split(":")[0]!, error }, update: { error } })
      .catch(() => undefined);
    return false;
  }
}

/** Programa la subida para después de responder (en Vercel la función sigue viva hasta terminar). */
export function queueArchive(...refs: string[]) {
  if (!driveConfigured() || !refs.length) return;
  after(async () => {
    for (const r of refs) await archiveNow(r);
  });
}

/** Documentos sin copia en Drive, con error, o modificados después de su última subida. */
export async function pendingRefs() {
  const [files, invoices, quotes, runs, weeks] = await Promise.all([
    prisma.driveFile.findMany({ select: { refKey: true, fileId: true, error: true, syncedAt: true } }),
    prisma.invoice.findMany({ select: { id: true, updatedAt: true } }),
    prisma.quote.findMany({ select: { id: true, updatedAt: true } }),
    prisma.payrollRun.findMany({ where: { status: "PAGADA" }, select: { id: true, updatedAt: true } }),
    prisma.invoice.findMany({ where: { ordersWeek: { not: "" }, status: { not: "CANCELADA" } }, select: { clientId: true, ordersWeek: true, updatedAt: true } }),
  ]);
  const byRef = new Map(files.map((f) => [f.refKey, f]));
  const stale = (ref: string, updatedAt: Date) => {
    const f = byRef.get(ref);
    return !f || !f.fileId || !!f.error || !f.syncedAt || f.syncedAt < updatedAt;
  };
  const all = [
    ...invoices.map((x) => [`factura:${x.id}`, x.updatedAt] as const),
    ...quotes.map((x) => [`cotizacion:${x.id}`, x.updatedAt] as const),
    ...runs.map((x) => [`nomina:${x.id}`, x.updatedAt] as const),
    ...weeks.map((x) => [`ordenes:${x.clientId}:${x.ordersWeek}`, x.updatedAt] as const),
  ];
  return { total: all.length, pending: all.filter(([r, u]) => stale(r, u)).map(([r]) => r) };
}

/** Sube un lote de pendientes (para no pasar el tiempo máximo de la función). */
export async function syncPending(limit = 15) {
  const { pending } = await pendingRefs();
  let done = 0,
    failed = 0;
  for (const ref of pending.slice(0, limit)) (await archiveNow(ref)) ? done++ : failed++;
  return { done, failed, remaining: Math.max(0, pending.length - done) };
}

/** "factura:12" → "Factura #12" (para mostrar errores). */
export function refLabel(ref: string) {
  const [k, a, b] = ref.split(":");
  const name = { factura: "Factura", cotizacion: "Cotización", nomina: "Nómina", ordenes: "Resumen de órdenes" }[k as ArchiveKind] ?? k;
  return b ? `${name} · cliente #${a} · semana ${b}` : `${name} #${a}`;
}

/** Enlace de Drive de un documento (para el botón "Ver en Drive"). */
export async function driveLink(ref: string) {
  if (!driveConfigured()) return null;
  const f = await prisma.driveFile.findUnique({ where: { refKey: ref }, select: { link: true, error: true, syncedAt: true } });
  return f?.link ? f : null;
}
