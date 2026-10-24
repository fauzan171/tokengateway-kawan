-- P2: manifest plugin deklaratif sebagai data (aditif; tidak ada tabel lain
-- yang berubah). enabled selalu 0 saat install; hash kanonik + reviewer.
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "manifestJson" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "installedBy" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Plugin_pluginId_version_key" ON "Plugin"("pluginId", "version");
CREATE INDEX "Plugin_pluginId_enabled_idx" ON "Plugin"("pluginId", "enabled");
