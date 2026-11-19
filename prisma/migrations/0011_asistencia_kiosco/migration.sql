-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "autoCloseMin" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "lateToleranceMin" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "overtimeRate" DOUBLE PRECISION NOT NULL DEFAULT 2,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "kioskLastStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kioskPendingSecret" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kioskSecret" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mealEnd" TEXT NOT NULL DEFAULT '15:00',
ADD COLUMN     "mealStart" TEXT NOT NULL DEFAULT '14:00',
ADD COLUMN     "scheduleEnd" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN     "scheduleStart" TEXT NOT NULL DEFAULT '09:00';

-- CreateTable
CREATE TABLE "KioskDevice" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "activationToken" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Punch" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "workDate" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'KIOSCO',
    "deviceId" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Punch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeAuth" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "workDate" TEXT NOT NULL,
    "until" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "approvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KioskDevice_tokenHash_key" ON "KioskDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "Punch_employeeId_workDate_idx" ON "Punch"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeAuth_employeeId_workDate_key" ON "OvertimeAuth"("employeeId", "workDate");

-- AddForeignKey
ALTER TABLE "Punch" ADD CONSTRAINT "Punch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Punch" ADD CONSTRAINT "Punch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "KioskDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeAuth" ADD CONSTRAINT "OvertimeAuth_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

