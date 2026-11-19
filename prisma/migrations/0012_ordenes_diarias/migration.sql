-- AlterTable
ALTER TABLE "Client" ADD COLUMN "orderRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "ordersWeek" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "OrderWave" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyOrder" (
    "id" SERIAL NOT NULL,
    "workDate" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "waveId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderWave_name_key" ON "OrderWave"("name");

-- CreateIndex
CREATE INDEX "DailyOrder_workDate_idx" ON "DailyOrder"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyOrder_workDate_clientId_waveId_key" ON "DailyOrder"("workDate", "clientId", "waveId");

-- AddForeignKey
ALTER TABLE "DailyOrder" ADD CONSTRAINT "DailyOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOrder" ADD CONSTRAINT "DailyOrder_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "OrderWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Oleadas iniciales (columnas de la hoja de control; se editan desde Órdenes diarias)
INSERT INTO "OrderWave" ("name", "sortOrder") VALUES
  ('Singles Primer Oleada', 1),
  ('Múltiples Primer Oleada', 2),
  ('Segunda Oleada Múltiples', 3),
  ('Tercer Oleada Múltiples', 4),
  ('Extras', 5),
  ('EXCEL', 6);
