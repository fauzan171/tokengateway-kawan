-- FIX-05: pin revisi konfigurasi koneksi saat admission.
-- `Connection.revision` naik setiap kali baris koneksi berubah; `Generation`
-- menyimpan revisi yang dipakai sehingga worker bisa menolak jalan bila
-- konfigurasi sudah bergeser (kredensial diganti, base URL diubah).
ALTER TABLE "Connection" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Generation" ADD COLUMN "connectionRevision" INTEGER;
