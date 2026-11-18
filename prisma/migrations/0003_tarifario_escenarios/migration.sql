-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "tariffClosing" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tariffIntro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tariffTerms" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "baseVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "perOrder" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "perOrderFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "scenarios" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "scales" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "scales" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TariffTable" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "afterSection" TEXT NOT NULL DEFAULT '',
    "columns" TEXT NOT NULL DEFAULT 'Concepto|Detalle',
    "rows" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "inQuotes" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TariffTable_pkey" PRIMARY KEY ("id")
);

