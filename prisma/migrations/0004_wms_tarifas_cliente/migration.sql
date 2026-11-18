-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "wmsName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "wmsConcept" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ClientRate" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "wmsConcept" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'Servicio',
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceText" TEXT NOT NULL DEFAULT '',
    "atCost" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WmsImport" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pdf',
    "clientName" TEXT NOT NULL DEFAULT '',
    "clientId" INTEGER,
    "periodLabel" TEXT NOT NULL DEFAULT '',
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "payload" TEXT NOT NULL DEFAULT '{}',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "invoiceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientRate_clientId_idx" ON "ClientRate"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WmsImport_folio_key" ON "WmsImport"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "WmsImport_invoiceId_key" ON "WmsImport"("invoiceId");

-- AddForeignKey
ALTER TABLE "ClientRate" ADD CONSTRAINT "ClientRate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsImport" ADD CONSTRAINT "WmsImport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsImport" ADD CONSTRAINT "WmsImport_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

