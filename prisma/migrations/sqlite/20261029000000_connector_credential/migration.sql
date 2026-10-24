-- FIX-20: kredensial konektor pihak ketiga (token terenkripsi per baris).
CREATE TABLE "ConnectorCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "scopes" TEXT NOT NULL DEFAULT '',
  "tokenEncrypted" TEXT NOT NULL,
  "refreshEncrypted" TEXT,
  "expiresAt" DATETIME,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ConnectorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ConnectorCredential_userId_provider_idx" ON "ConnectorCredential"("userId", "provider");
CREATE INDEX "ConnectorCredential_userId_revokedAt_idx" ON "ConnectorCredential"("userId", "revokedAt");
