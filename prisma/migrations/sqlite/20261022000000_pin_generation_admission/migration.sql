-- FIX-05: pin koneksi dan model saat admission supaya generasi tidak bergeser
-- ke koneksi aktif lain bila pengguna mengganti/menghapus koneksi di tengah jalan.
-- Additive: kolom nullable, baris lama tetap valid (NULL = belum dipin, jatuh ke
-- koneksi aktif seperti sebelumnya).

ALTER TABLE "Generation" ADD COLUMN "connectionId" TEXT;
ALTER TABLE "Generation" ADD COLUMN "modelId" TEXT;
