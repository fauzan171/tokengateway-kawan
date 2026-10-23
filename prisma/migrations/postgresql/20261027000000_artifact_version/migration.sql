-- FIX-12: nomor versi pada rantai lineage artefak.
ALTER TABLE "Artifact" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
