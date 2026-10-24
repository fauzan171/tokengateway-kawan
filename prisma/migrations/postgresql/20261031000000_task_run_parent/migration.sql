-- FIX-22: run peninjau model kedua menempel ke run induk (aditif, nullable).
ALTER TABLE "TaskRun" ADD COLUMN "parentRunId" TEXT;
ALTER TABLE "TaskRun" ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "TaskRun_parentRunId_status_idx" ON "TaskRun"("parentRunId", "status");
