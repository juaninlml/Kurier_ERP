-- Índices para reportes/exportación (fecha de emisión), órdenes semanales, nómina, envíos por estatus y checadas por fecha (kiosco).
-- IF NOT EXISTS: segura aunque alguno ya exista.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_ordersWeek_idx" ON "Invoice"("ordersWeek");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollLine_runId_idx" ON "PayrollLine"("runId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Punch_workDate_idx" ON "Punch"("workDate");
