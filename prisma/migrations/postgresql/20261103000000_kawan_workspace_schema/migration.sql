-- B1: schema kawan-workspace (aditif). Field baru pada TaskRun semuanya
-- nullable atau ber-DEFAULT sehingga baris lama tetap valid.
ALTER TABLE "TaskRun" ADD COLUMN "researchCycle" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TaskRun" ADD COLUMN "configJson" TEXT;
ALTER TABLE "TaskRun" ADD COLUMN "budgetJson" TEXT;
ALTER TABLE "TaskRun" ADD COLUMN "usageJson" TEXT;
ALTER TABLE "TaskRun" ADD COLUMN "stopReason" TEXT;

-- D2: provenance artefak. Kolom polos tanpa FK agar relasi Artifact existing
-- tidak tersentuh; null untuk artefak chat/upload.
ALTER TABLE "Artifact" ADD COLUMN "taskId" TEXT;
CREATE INDEX "Artifact_taskId_idx" ON "Artifact"("taskId");

-- D4: jawaban onboarding user; kosong = belum dijawab.
ALTER TABLE "UserSetting" ADD COLUMN "onboarding" TEXT NOT NULL DEFAULT '';

-- D1: langkah eksekusi run (model call / tool call / fase).
CREATE TABLE "TaskStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "phase" TEXT,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "toolName" TEXT,
    "toolCallId" TEXT,
    "argsDigest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resultDigest" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskStep_runId_fkey" FOREIGN KEY ("runId")
        REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaskStep_runId_ordinal_key" ON "TaskStep"("runId", "ordinal");
CREATE INDEX "TaskStep_runId_status_idx" ON "TaskStep"("runId", "status");

-- D1/D3/D6: sumber web yang dibaca run (provenance + metering).
CREATE TABLE "TaskSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "kind" TEXT NOT NULL,
    "provider" TEXT,
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "title" TEXT,
    "snippet" TEXT,
    "textChars" INTEGER,
    "textHash" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskSource_runId_fkey" FOREIGN KEY ("runId")
        REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaskSource_runId_kind_idx" ON "TaskSource"("runId", "kind");

-- D3: hitung pencarian per user per provider per hari.
CREATE TABLE "SearchUsageDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "SearchUsageDaily_userId_provider_day_key" ON "SearchUsageDaily"("userId", "provider", "day");
CREATE INDEX "SearchUsageDaily_day_idx" ON "SearchUsageDaily"("day");