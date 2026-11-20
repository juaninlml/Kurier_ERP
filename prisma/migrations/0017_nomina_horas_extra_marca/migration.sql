-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "brandId" INTEGER;

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

