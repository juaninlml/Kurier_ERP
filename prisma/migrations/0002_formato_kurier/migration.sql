-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "invoiceDisclaimer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentTerms" TEXT NOT NULL DEFAULT 'Pago contra recepción de factura a 8 días naturales.',
ADD COLUMN     "tagline" TEXT NOT NULL DEFAULT 'MICROHUB CDMX · 3PL',
ALTER COLUMN "primaryColor" SET DEFAULT '#1F4E79',
ALTER COLUMN "accentColor" SET DEFAULT '#ED7D31';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "atCost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "section" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "attention" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "profile" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "atCost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "detail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "priceText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "section" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "period" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "storage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "terms" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "volume" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "atCost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "detail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "priceText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "section" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ServiceSection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSection_name_key" ON "ServiceSection"("name");

