-- FIX-21: jadwal, occurrence unik, dan notifikasi dalam aplikasi.
CREATE TABLE "Schedule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "localTime" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "recurrence" TEXT,
  "misfirePolicy" TEXT NOT NULL DEFAULT 'skip',
  "effect" TEXT NOT NULL DEFAULT 'read',
  "enabled" INTEGER NOT NULL DEFAULT 1,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "policyRevision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Schedule_enabled_nextRunAt_idx" ON "Schedule"("enabled", "nextRunAt");
CREATE INDEX "Schedule_userId_createdAt_idx" ON "Schedule"("userId", "createdAt");

CREATE TABLE "ScheduleOccurrence" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "jobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleOccurrence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScheduleOccurrence_scheduleId_scheduledFor_key" ON "ScheduleOccurrence"("scheduleId", "scheduledFor");
CREATE INDEX "ScheduleOccurrence_status_createdAt_idx" ON "ScheduleOccurrence"("status", "createdAt");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sensitive" INTEGER NOT NULL DEFAULT 0,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleOccurrence" ADD CONSTRAINT "ScheduleOccurrence_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;