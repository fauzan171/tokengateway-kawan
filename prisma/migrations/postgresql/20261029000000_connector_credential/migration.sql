-- FIX-20: kredensial konektor pihak ketiga (token terenkripsi per baris).
CREATE TABLE "ConnectorCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "scopes" TEXT NOT NULL DEFAULT '',
  "tokenEncrypted" TEXT NOT NULL,
  "refreshEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectorCredential_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConnectorCredential_userId_provider_idx" ON "ConnectorCredential"("userId", "provider");
CREATE INDEX "ConnectorCredential_userId_revokedAt_idx" ON "ConnectorCredential"("userId", "revokedAt");

ALTER TABLE "ConnectorCredential" ADD CONSTRAINT "ConnectorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
