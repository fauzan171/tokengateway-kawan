-- FIX-04: sumber dan revisi judul supaya judul otomatis tidak menimpa rename manual.
-- FIX-24: denyut proses worker, terpisah dari heartbeat job.
-- Additive: kolom/tabel baru dengan default, baris lama tetap valid.

ALTER TABLE "Chat" ADD COLUMN "titleSource" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Chat" ADD COLUMN "titleRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorkerHeartbeat" (
    "workerId" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "startedAt" TEXT NOT NULL,
    "lastSeenAt" TEXT NOT NULL
);

CREATE INDEX "WorkerHeartbeat_lastSeenAt_idx" ON "WorkerHeartbeat"("lastSeenAt");
