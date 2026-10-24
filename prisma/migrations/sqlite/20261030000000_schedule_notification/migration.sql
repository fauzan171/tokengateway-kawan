-- FIX-21: jadwal, occurrence unik, dan notifikasi dalam aplikasi.
CREATE TABLE "Schedule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "localTime" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "recurrence" TEXT,
  "misfirePolicy" TEXT NOT NULL DEFAULT 'skip',
  "effect" TEXT NOT NULL DEFAULT 'read',
  "enabled" INTEGER NOT NULL DEFAULT 1,
  "nextRunAt" DATETIME,
  "lastRunAt" DATETIME,
  "policyRevision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Schedule_enabled_nextRunAt_idx" ON "Schedule"("enabled", "nextRunAt");
CREATE INDEX "Schedule_userId_createdAt_idx" ON "Schedule"("userId", "createdAt");

CREATE TABLE "ScheduleOccurrence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scheduleId" TEXT NOT NULL,
  "scheduledFor" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "jobId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleOccurrence_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ScheduleOccurrence_scheduleId_scheduledFor_key" ON "ScheduleOccurrence"("scheduleId", "scheduledFor");
CREATE INDEX "ScheduleOccurrence_status_createdAt_idx" ON "ScheduleOccurrence"("status", "createdAt");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sensitive" INTEGER NOT NULL DEFAULT 0,
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");