-- Índices para listas, tablero y reportes (llaves foráneas sin índice y filtros por fecha/estado).
-- IF NOT EXISTS: la migración es segura aunque alguno ya exista.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_clientId_idx" ON "Transaction"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt");

