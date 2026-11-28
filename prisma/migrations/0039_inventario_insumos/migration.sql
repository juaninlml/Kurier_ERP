-- Inventario de insumos de empaque: mínimo por material y movimientos (entradas y conteos físicos).
-- AlterTable
ALTER TABLE "PackMaterial" ADD COLUMN IF NOT EXISTS "minStock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockMove" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMove_materialId_date_idx" ON "StockMove"("materialId", "date");

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PackMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
