-- Salidas de mercancía (outbound): cajas entregadas por SKU y piezas por caja
CREATE TABLE "GoodsExit" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL DEFAULT '',
    "clientId" INTEGER NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "carrier" TEXT NOT NULL DEFAULT '',
    "plates" TEXT NOT NULL DEFAULT '',
    "driverName" TEXT NOT NULL DEFAULT '',
    "deliveredBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoodsExit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoodsExitItem" (
    "id" SERIAL NOT NULL,
    "exitId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT NOT NULL,
    "boxes" INTEGER NOT NULL,
    "piecesPerBox" INTEGER NOT NULL,
    CONSTRAINT "GoodsExitItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoodsExit_folio_key" ON "GoodsExit"("folio");
CREATE INDEX "GoodsExit_clientId_idx" ON "GoodsExit"("clientId");
CREATE INDEX "GoodsExit_date_idx" ON "GoodsExit"("date");
CREATE INDEX "GoodsExitItem_exitId_idx" ON "GoodsExitItem"("exitId");
CREATE INDEX "GoodsExitItem_sku_idx" ON "GoodsExitItem"("sku");

ALTER TABLE "GoodsExit" ADD CONSTRAINT "GoodsExit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsExitItem" ADD CONSTRAINT "GoodsExitItem_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "GoodsExit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
