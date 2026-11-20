-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "leaveDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "absenceNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notice" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Incident" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "days" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "withPay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'AUTORIZADA',
    "reason" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "monthKey" TEXT NOT NULL DEFAULT '',
    "lateDates" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_employeeId_startDate_idx" ON "Incident"("employeeId", "startDate");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
