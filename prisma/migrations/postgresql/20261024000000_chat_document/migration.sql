-- FIX-06: manifest dokumen per chat. Retrieval hanya kandidat dokumen yang
-- dilampirkan ke chat itu, bukan semua dokumen pengguna. documentId RESTRICT:
-- hapus dokumen wajib lewat jalur yang membersihkan manifest lebih dulu.
CREATE TABLE "ChatDocument" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "addedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "ChatDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatDocument_chatId_idx" ON "ChatDocument"("chatId");

CREATE UNIQUE INDEX "ChatDocument_chatId_documentId_key" ON "ChatDocument"("chatId", "documentId");

ALTER TABLE "ChatDocument" ADD CONSTRAINT "ChatDocument_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatDocument" ADD CONSTRAINT "ChatDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChatDocument" ADD CONSTRAINT "ChatDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
