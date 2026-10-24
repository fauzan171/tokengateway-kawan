-- K2: run menyimpan agent beku yang menjalankannya (aditif, nullable-safe).
-- Baris lama otomatis menjadi agent "default" versi 1 lewat DEFAULT kolom.
ALTER TABLE "TaskRun" ADD COLUMN "agentId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "TaskRun" ADD COLUMN "agentVersion" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "TaskRun_agentId_idx" ON "TaskRun"("agentId");
