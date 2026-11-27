-- Tipo de cambio CNY → MXN de referencia (MXN por 1 CNY); se actualiza cada sábado a las 7:00 a. m.
ALTER TABLE "CompanySettings" ADD COLUMN "cnyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "cnyRateDate" TEXT NOT NULL DEFAULT '',
ADD COLUMN "cnyRateAt" TIMESTAMP(3);
