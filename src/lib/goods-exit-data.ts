import { prisma } from "./db";

/** Clientes activos para el selector y los SKUs que ya salieron por cliente (con sus piezas por caja más recientes). */
export async function exitFormData(includeClientId?: number) {
  const [clients, items] = await Promise.all([
    prisma.client.findMany({
      where: includeClientId ? { OR: [{ active: true }, { id: includeClientId }] } : { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.goodsExitItem.findMany({
      select: { sku: true, piecesPerBox: true, exit: { select: { clientId: true } } },
      orderBy: { id: "desc" },
      take: 3000,
    }),
  ]);
  const skuHints: Record<number, { sku: string; piecesPerBox: number }[]> = {};
  const seen = new Set<string>();
  for (const it of items) {
    const k = `${it.exit.clientId}|${it.sku}`;
    if (seen.has(k)) continue;
    seen.add(k);
    (skuHints[it.exit.clientId] ??= []).push({ sku: it.sku, piecesPerBox: it.piecesPerBox });
  }
  for (const list of Object.values(skuHints)) list.sort((a, b) => a.sku.localeCompare(b.sku));
  return { clients, skuHints };
}
