#!/usr/bin/env bash
# Backup Kawan (WP-NT-P10-03, SDD-8.6): database + berkas dokumen + manifest.
#
# Pakai: ./scripts/backup.sh [direktori-tujuan]   (bawaan: ./backups)
#
# Kunci enkripsi TIDAK ikut ke arsip; yang disimpan hanya sidik jarinya, supaya
# operator bisa memastikan kunci yang dipakai saat restore sama. Menyalin
# ENCRYPTION_SECRET ke dalam arsip sama dengan menyimpan kunci di sebelah
# gemboknya.
set -euo pipefail

cd "$(dirname "$0")/.."

# Env dari pemanggil menang atas .env, supaya skrip ini bisa dipakai untuk
# membackup instance lain tanpa mengedit berkas.
_awal="$(for v in DATABASE_URL ENCRYPTION_SECRET STORAGE_LOCAL_DIR ENCRYPTION_KEY_ID; do declare -p "$v" 2>/dev/null || true; done)"
if [ -f ./.env ]; then
  set -a
  . ./.env
  set +a
fi
if [ -n "$_awal" ]; then eval "$_awal"; fi

: "${DATABASE_URL:?DATABASE_URL wajib diisi untuk backup.}"
: "${ENCRYPTION_SECRET:?ENCRYPTION_SECRET wajib diisi untuk backup.}"

tujuan="${1:-./backups}"
mkdir -p "$tujuan"
tujuan="$(cd "$tujuan" && pwd)"
stamp="$(date -u +%Y%m%d-%H%M%S)"
kerja="$tujuan/kawan-$stamp"
arsip="$tujuan/kawan-$stamp.tar.gz"
mkdir -p "$kerja/documents"
trap 'rm -rf "$kerja"' EXIT

# --- Database ---------------------------------------------------------------
if [ "${DATABASE_URL#file:}" != "$DATABASE_URL" ]; then
  sumber="${DATABASE_URL#file:}"
  [ "${sumber#/}" = "$sumber" ] && sumber="$PWD/$sumber"
  if [ ! -f "$sumber" ]; then
    echo "backup: database SQLite tidak ditemukan: $sumber" >&2
    exit 1
  fi
  # `.backup` menyalin konsisten walau ada penulis aktif; `cp` bisa menghasilkan
  # berkas robek. sqlite3 hampir selalu ada, tetapi bukan keharusan.
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$sumber" ".backup '$kerja/db.sqlite'"
  else
    cp -- "$sumber" "$kerja/db.sqlite"
  fi
  provider=sqlite
else
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "backup: pg_dump tidak ditemukan" >&2
    exit 1
  fi
  pg_dump --format=custom --file="$kerja/db.dump" "$DATABASE_URL"
  provider=postgresql
fi

# --- Berkas dokumen ---------------------------------------------------------
dokumen="${STORAGE_LOCAL_DIR:-.data/documents}"
if [ -d "$dokumen" ]; then
  cp -a "$dokumen/." "$kerja/documents/"
else
  echo "backup: catatan: direktori dokumen tidak ada, dilewati ($dokumen)" >&2
fi
jumlahBerkas="$(find "$kerja/documents" -type f | wc -l | tr -d ' ')"

# --- Manifest ---------------------------------------------------------------
# Versi skema = sha256 DDL, bukan jumlah baris `_prisma_migrations`: proyek ini
# menerapkan DDL identik ke dua provider, bukan lewat `prisma migrate`.
versiSkema="$(sha256sum prisma/migrations/_schema.sql | cut -d' ' -f1)"
sidikKunci="$(printf '%s' "$ENCRYPTION_SECRET" | sha256sum | cut -d' ' -f1)"

hitung="$(npx tsx -e '
import("./src/lib/db.ts")
  .then(async (m) => {
    const db = await m.getDb(process.env.DATABASE_URL);
    const pasangan = [
      ["user", "user"], ["chat", "chat"], ["chatMessage", "chatMessage"],
      ["document", "document"], ["documentChunk", "documentChunk"],
      ["connection", "connection"],
    ];
    const hasil = {};
    for (const [kunci, model] of pasangan) hasil[kunci] = await db[model].count();
    console.log(JSON.stringify(hasil));
    await m.closeDb();
  })
  .catch((e) => { console.error(e?.message ?? e); process.exit(1); });')"

node -e '
const fs = require("node:fs");
const [keluaran, provider, versi, sidik, hitung, berkas] = process.argv.slice(1);
fs.writeFileSync(keluaran, JSON.stringify({
  createdAt: new Date().toISOString(),
  provider,
  schemaVersion: versi,
  encryptionKeyFingerprint: sidik,
  counts: JSON.parse(hitung),
  documentFiles: Number(berkas),
}, null, 2) + "\n");
' "$kerja/manifest.json" "$provider" "$versiSkema" "$sidikKunci" "$hitung" "$jumlahBerkas"

tar -czf "$arsip" -C "$tujuan" "kawan-$stamp"
echo "$arsip"
