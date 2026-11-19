-- CreateTable
CREATE TABLE "PackMaterial" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "noSupply" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySupply" (
    "id" SERIAL NOT NULL,
    "workDate" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySupply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackMaterial_name_key" ON "PackMaterial"("name");

-- CreateIndex
CREATE INDEX "DailySupply_workDate_idx" ON "DailySupply"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailySupply_workDate_clientId_materialId_key" ON "DailySupply"("workDate", "clientId", "materialId");

-- AddForeignKey
ALTER TABLE "DailySupply" ADD CONSTRAINT "DailySupply_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySupply" ADD CONSTRAINT "DailySupply_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PackMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Materiales iniciales (los de la hoja de control de insumos; se editan desde Órdenes diarias → Insumos)
INSERT INTO "PackMaterial" ("name", "size", "noSupply", "sortOrder") VALUES
  ('Bolsa A', '17*30', false, 1),
  ('Bolsa B', '28*40', false, 2),
  ('Bolsa C', '38*50', false, 3),
  ('Bolsa D', '42*50', false, 4),
  ('Bolsa E/F', '55*65', false, 5),
  ('Sin insumo (N/A)', '', true, 6),
  ('Caja Ch', '15*15*32 / 20*20*15 / 22*16*19 / 27*16*27', false, 7),
  ('Caja M', '27.5*22*17.5 / 30*20*13.5 / 24*24*35 / 28.5*25.5*33 / 30*25*22', false, 8);
