-- Agen pemilik percakapan (aditif): null = agen bawaan, jadi chat lama
-- tetap valid tanpa diubah.
ALTER TABLE "Chat" ADD COLUMN "agentId" TEXT;
