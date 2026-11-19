-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
ADD COLUMN     "weeklySalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "workDays" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "bonusNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "deductionNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "hoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
ADD COLUMN     "weeklySalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "workDays" INTEGER NOT NULL DEFAULT 6;


-- Salario semanal a partir del diario existente (jornada de 6 días)
UPDATE "Employee" SET "weeklySalary" = ROUND(("dailySalary" * 6)::numeric, 2) WHERE "weeklySalary" = 0;
UPDATE "PayrollLine" SET "weeklySalary" = ROUND(("dailySalary" * 6)::numeric, 2) WHERE "weeklySalary" = 0;
