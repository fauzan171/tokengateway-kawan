-- FIX-08 / WO-AG-P1-01: task persisten (SDD-AG-2).
-- Additive: Task + run/segment, pesan linear, event durable, interaction.
-- Kepemilikan lewat Task.userId; child row selalu diperiksa lewat task induk.
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activeRunId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_userId_status_updatedAt_id_idx" ON "Task"("userId", "status", "updatedAt", "id");

CREATE TABLE "TaskRun" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "segment" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "connectionId" TEXT,
    "modelId" TEXT NOT NULL DEFAULT '',
    "inputMessageId" TEXT,
    "assistantMessageId" TEXT,
    "currentJobId" TEXT,
    "lastEventSeq" INTEGER NOT NULL DEFAULT 0,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "waitingExpiresAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskRun_taskId_createdAt_id_idx" ON "TaskRun"("taskId", "createdAt", "id");

CREATE INDEX "TaskRun_status_deadlineAt_idx" ON "TaskRun"("status", "deadlineAt");

CREATE UNIQUE INDEX "TaskRun_inputMessageId_key" ON "TaskRun"("inputMessageId");

CREATE UNIQUE INDEX "TaskRun_assistantMessageId_key" ON "TaskRun"("assistantMessageId");

CREATE UNIQUE INDEX "TaskRun_currentJobId_key" ON "TaskRun"("currentJobId");

CREATE TABLE "TaskMessage" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "runId" TEXT,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "requestKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskMessage_taskId_createdAt_id_idx" ON "TaskMessage"("taskId", "createdAt", "id");

CREATE UNIQUE INDEX "TaskMessage_runId_role_key" ON "TaskMessage"("runId", "role");

CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskEvent_runId_createdAt_idx" ON "TaskEvent"("runId", "createdAt");

CREATE UNIQUE INDEX "TaskEvent_runId_seq_key" ON "TaskEvent"("runId", "seq");

CREATE TABLE "TaskInteraction" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "promptJson" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "answerJson" TEXT,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskInteraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskInteraction_runId_status_idx" ON "TaskInteraction"("runId", "status");

CREATE INDEX "TaskInteraction_expiresAt_status_idx" ON "TaskInteraction"("expiresAt", "status");

ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TaskRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskInteraction" ADD CONSTRAINT "TaskInteraction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE;