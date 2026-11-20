-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "department" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "jobPositionId" INTEGER;

-- CreateTable
CREATE TABLE "JobPosition" (
    "id" SERIAL NOT NULL,
    "area" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Catálogo inicial: Almacén › Picking / Packing / Almacenamiento
INSERT INTO "JobPosition" ("area", "department", "name", "sortOrder") VALUES
  ('Almacén', 'Picking', 'Ayudante general picking', 10),
  ('Almacén', 'Picking', 'Auxiliar picking', 20),
  ('Almacén', 'Packing', 'Ayudante general packing', 30),
  ('Almacén', 'Packing', 'Sistema packing', 40),
  ('Almacén', 'Packing', 'Auxiliar packing', 50),
  ('Almacén', 'Almacenamiento', 'Auxiliar almacenamiento', 60);

-- Empleados cuyo puesto ya coincide con el catálogo quedan vinculados
UPDATE "Employee" e
SET "jobPositionId" = p."id", "position" = p."name", "area" = p."area", "department" = p."department"
FROM "JobPosition" p
WHERE lower(trim(e."position")) = lower(p."name");
