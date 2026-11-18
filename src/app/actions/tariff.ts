"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { numv, str } from "./helpers";

function tableData(fd: FormData) {
  const title = str(fd, "title");
  if (!title) throw new Error("La tabla necesita un título.");
  const columns = str(fd, "columns")
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean)
    .join("|");
  if (!columns) throw new Error("Indica al menos una columna (separadas por |).");
  return {
    title,
    afterSection: str(fd, "afterSection"),
    columns,
    rows: str(fd, "rows"),
    note: str(fd, "note"),
    inQuotes: fd.get("inQuotes") === "on",
    sortOrder: Math.round(numv(fd, "sortOrder")),
  };
}

const refresh = () => {
  revalidatePath("/servicios");
  revalidatePath("/servicios/tablas");
};

async function createTariffTableImpl(fd: FormData) {
  await prisma.tariffTable.create({ data: tableData(fd) });
  refresh();
}

async function updateTariffTableImpl(id: number, fd: FormData) {
  await prisma.tariffTable.update({ where: { id }, data: tableData(fd) });
  refresh();
}

async function deleteTariffTableImpl(id: number) {
  await prisma.tariffTable.delete({ where: { id } });
  refresh();
}

async function saveTariffTextsImpl(fd: FormData) {
  await prisma.companySettings.update({
    where: { id: 1 },
    data: { tariffIntro: str(fd, "tariffIntro"), tariffTerms: str(fd, "tariffTerms"), tariffClosing: str(fd, "tariffClosing") },
  });
  refresh();
}

export const createTariffTable = safe(createTariffTableImpl);
export const updateTariffTable = safe(updateTariffTableImpl);
export const deleteTariffTable = safe(deleteTariffTableImpl);
export const saveTariffTexts = safe(saveTariffTextsImpl);
