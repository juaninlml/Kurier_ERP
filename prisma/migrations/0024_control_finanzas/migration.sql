-- Control y finanzas: bitácora, conciliación bancaria y presupuesto.

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "userName" TEXT NOT NULL DEFAULT '',
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fnName" TEXT NOT NULL DEFAULT '',
    "entityId" INTEGER,
    "summary" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankImport" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankLine" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionId" INTEGER,
    "ignored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BankLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_module_at_idx" ON "AuditLog"("module", "at");

-- CreateIndex
CREATE INDEX "AuditLog_userId_at_idx" ON "AuditLog"("userId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "BankLine_transactionId_key" ON "BankLine"("transactionId");

-- CreateIndex
CREATE INDEX "BankLine_importId_idx" ON "BankLine"("importId");

-- CreateIndex
CREATE INDEX "BankLine_date_idx" ON "BankLine"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_year_month_type_category_key" ON "Budget"("year", "month", "type", "category");

-- AddForeignKey
ALTER TABLE "BankLine" ADD CONSTRAINT "BankLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankLine" ADD CONSTRAINT "BankLine_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
