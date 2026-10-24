-- FIX-11 bagian 1: metadata artefak. Byte ada di storage adapter existing;
-- chatId sengaja tanpa FK ke Chat supaya chat terhapus tidak memblokir.
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT,
    "messageId" TEXT,
    "format" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "parentArtifactId" TEXT,
    "provenance" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL,
    "expiresAt" TIMESTAMP,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "Artifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("id")
);
