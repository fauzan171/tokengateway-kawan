-- ============================================================================
-- Sumber kebenaran DDL untuk migrasi awal Kawan.
--
-- File ini adalah SATU-SATUNYA tempat DDL ditulis. Kedua migration.sql provider
-- (sqlite dan postgresql) harus identik byte-per-byte dengan isi file ini,
-- sehingga kedua skema tidak mungkin berbeda. scripts/check-migrations.mjs
-- menegakkannya.
--
-- Aturan portabilitas:
--   * Hanya SQL inti: CREATE TABLE / CREATE UNIQUE INDEX / CREATE INDEX.
--   * Tanpa perintah khusus provider, auto-increment, tabel tanpa rowid,
--     generated column, atau tipe yang hanya ada di satu provider.
--   * Waktu disimpan sebagai TEXT ISO-8601 UTC agar sama persis di kedua
--     provider. Prisma mengonversinya ke DateTime di level klien.
--   * Nilai createdAt TIDAK diberi default di level SQL: tidak ada ekspresi
--     waktu yang portabel antara kedua provider. Prisma yang mengisi nilainya
--     dari `@default(now())`.
--   * DDL sengaja tanpa klausa kondisional: jalur yang diuji adalah database
--     baru.
-- ============================================================================

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_status_idx" ON "User"("status");

CREATE TABLE "Credential" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "userAgentHash" TEXT,
    "revokedAt" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TEXT NOT NULL,
    "leaseOwner" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TEXT,
    "heartbeatAt" TEXT,
    "lastError" TEXT,
    "createdAt" TEXT NOT NULL,
    "finishedAt" TEXT
);

CREATE INDEX "Job_state_availableAt_idx" ON "Job"("state", "availableAt");
CREATE INDEX "Job_leaseExpiresAt_idx" ON "Job"("leaseExpiresAt");

CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "usedAt" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");
