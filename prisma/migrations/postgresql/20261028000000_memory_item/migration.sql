-- FIX-13: memori eksplisit (butir + rantai koreksi) dan dependensi turunan.
CREATE TABLE "MemoryItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'global',
  "chatId" TEXT,
  "category" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "consent" TEXT NOT NULL DEFAULT 'explicit',
  "version" INTEGER NOT NULL DEFAULT 1,
  "parentId" TEXT,
  "sourceKind" TEXT,
  "sourceRef" TEXT,
  "sourceRevision" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MemoryItem_userId_status_idx" ON "MemoryItem"("userId", "status");
CREATE INDEX "MemoryItem_userId_chatId_idx" ON "MemoryItem"("userId", "chatId");
CREATE INDEX "MemoryItem_parentId_idx" ON "MemoryItem"("parentId");

CREATE TABLE "MemoryDependency" (
  "id" TEXT NOT NULL,
  "memoryId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'summary',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryDependency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemoryDependency_memoryId_targetId_key" ON "MemoryDependency"("memoryId", "targetId");
CREATE INDEX "MemoryDependency_targetId_idx" ON "MemoryDependency"("targetId");

ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MemoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoryDependency" ADD CONSTRAINT "MemoryDependency_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "MemoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryDependency" ADD CONSTRAINT "MemoryDependency_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "MemoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
