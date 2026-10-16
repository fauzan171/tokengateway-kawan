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

CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyMask" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "isActive" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastTestAt" TEXT,
    "lastTestStatus" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Connection_userId_idx" ON "Connection"("userId");
CREATE INDEX "Connection_userId_isActive_idx" ON "Connection"("userId", "isActive");

CREATE TABLE "ModelCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "modelListJson" TEXT NOT NULL,
    "fetchedAt" TEXT NOT NULL,
    CONSTRAINT "ModelCache_connectionId_fkey" FOREIGN KEY ("connectionId")
        REFERENCES "Connection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ModelCache_connectionId_key" ON "ModelCache"("connectionId");

CREATE TABLE "Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "modelRef" TEXT,
    "currentMessageId" TEXT,
    "pinned" INTEGER NOT NULL DEFAULT 0,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Chat_userId_updatedAt_idx" ON "Chat"("userId", "updatedAt");

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "parentId" TEXT,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "usageJson" TEXT,
    "seq" INTEGER NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId")
        REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ChatMessage_chatId_seq_idx" ON "ChatMessage"("chatId", "seq");
CREATE INDEX "ChatMessage_chatId_parentId_idx" ON "ChatMessage"("chatId", "parentId");

CREATE TABLE "ChatMessagePart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    CONSTRAINT "ChatMessagePart_messageId_fkey" FOREIGN KEY ("messageId")
        REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ChatMessagePart_messageId_ordinal_idx" ON "ChatMessagePart"("messageId", "ordinal");

CREATE TABLE "Generation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "userMessageId" TEXT NOT NULL,
    "assistantMessageId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "cancelRequestedAt" TEXT,
    "errorCode" TEXT,
    "finishReason" TEXT,
    "startedAt" TEXT,
    "finishedAt" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "Generation_assistantMessageId_fkey" FOREIGN KEY ("assistantMessageId")
        REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Generation_chatId_createdAt_idx" ON "Generation"("chatId", "createdAt");
CREATE INDEX "Generation_status_idx" ON "Generation"("status");

CREATE TABLE "GenerationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "GenerationEvent_generationId_fkey" FOREIGN KEY ("generationId")
        REFERENCES "Generation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GenerationEvent_generationId_seq_key" ON "GenerationEvent"("generationId", "seq");

CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chatId" TEXT,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "reported" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL
);

CREATE INDEX "UsageRecord_userId_createdAt_idx" ON "UsageRecord"("userId", "createdAt");

CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

CREATE UNIQUE INDEX "IdempotencyKey_userId_key_key" ON "IdempotencyKey"("userId", "key");
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");
