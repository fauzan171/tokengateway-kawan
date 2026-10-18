#!/usr/bin/env bash
# Restore Kawan dari arsip `scripts/backup.sh` (WP-NT-P10-03, SDD-8.6).
#
# Pakai: ./scripts/restore.sh <arsip.tar.gz> [--force]
#
# Urutan: ekstrak → periksa kunci → target harus bersih → pulihkan → verifikasi
# hitungan → verifikasi dekripsi. Dua pengaman yang tidak boleh dilewati:
#   1. Sidik jari ENCRYPTION_SECRET harus sama dengan saat backup. Kunci lain
#      menghasilkan restore yang tampak berhasil tetapi ciphertext koneksi
#      selamanya tidak terbaca.
#   2. Database tujuan yang sudah ada tidak ditimpa tanpa `--force`.
set -euo pipefail

cd "$(dirname "$0")/.."

arsip="${1:-}"
paksa=0
for arg in "${@:2}"; do
  case "$arg" in
    --force) paksa=1 ;;
    *) echo "restore: argumen tidak dikenal: $arg" >&2; exit 2 ;;
  esac
done
if [ -z "$arsip" ] || [ ! -f "$arsip" ]; then
  echo "Pakai: ./scripts/restore.sh <arsip.tar.gz> [--force]" >&2
  exit 2
fi
arsip="$(cd "$(dirname "$arsip")" && pwd)/$(basename "$arsip")"

_awal="$(for v in DATABASE_URL ENCRYPTION_SECRET STORAGE_LOCAL_DIR ENCRYPTION_KEY_ID; do declare -p "$v" 2>/dev/null || true; done)"
if [ -f ./.env ]; then
  set -a
  . ./.env
  set +a
fi
if [ -n "$_awal" ]; then eval "$_awal"; fi

: "${DATABASE_URL:?DATABASE_URL wajib diisi untuk restore.}"
: "${ENCRYPTION_SECRET:?ENCRYPTION_SECRET wajib diisi untuk restore.}"

kerja="$(mktemp -d)"
trap 'rm -rf "$kerja"' EXIT

# --- 1. Ekstrak -------------------------------------------------------------
# Arsip dari `backup.sh` membungkus satu direktori `kawan-<stamp>/`. Entri yang
# keluar dari direktori tujuan ditolak; arsip bisa datang dari mesin lain.
tar -xzf "$arsip" -C "$kerja"
isi="$(find "$kerja" -mindepth 1 -maxdepth 1 -type d | head -n1)"
if [ -z "$isi" ] || [ ! -f "$isi/manifest.json" ]; then
  echo "restore: arsip tidak memuat manifest.json" >&2
  exit 1
fi
echo "restore: arsip diekstrak"

# --- 2. Kunci enkripsi ------------------------------------------------------
sidikSekarang="$(printf '%s' "$ENCRYPTION_SECRET" | sha256sum | cut -d' ' -f1)"
sidikArsip="$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).encryptionKeyFingerprint)' "$isi/manifest.json")"
if [ "$sidikSekarang" != "$sidikArsip" ]; then
  echo "restore: ENCRYPTION_SECRET berbeda dari saat backup; ciphertext koneksi tidak akan dapat didekripsi." >&2
  exit 1
fi
echo "restore: kunci enkripsi cocok"

# --- 3. Target harus bersih -------------------------------------------------
if [ "${DATABASE_URL#file:}" != "$DATABASE_URL" ]; then
  provider=sqlite
  target="${DATABASE_URL#file:}"
  [ "${target#/}" = "$target" ] && target="$PWD/$target"
  if [ -e "$target" ] && [ "$paksa" -ne 1 ]; then
    echo "restore: database tujuan sudah ada: $target (pakai --force untuk menimpa)" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$target")"
  cp -- "$isi/db.sqlite" "$target"
else
  provider=postgresql
  if ! command -v pg_restore >/dev/null 2>&1; then
    echo "restore: pg_restore tidak ditemukan" >&2
    exit 1
  fi
  pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" "$isi/db.dump"
fi
echo "restore: database dipulihkan ($provider)"

# --- 4. Berkas dokumen ------------------------------------------------------
dokumen="${STORAGE_LOCAL_DIR:-.data/documents}"
mkdir -p "$dokumen"
cp -a "$isi/documents/." "$dokumen/"
echo "restore: berkas dokumen dipulihkan"

# --- 5. Verifikasi hitungan -------------------------------------------------
# Query memakai DATABASE_URL dari env yang sudah dimuat di atas.
hitung="$(npx tsx -e '
import("./src/lib/db.ts")
  .then(async (m) => {
    const db = await m.getDb(process.env.DATABASE_URL);
    const hasil = {};
    for (const kunci of ["user", "chat", "chatMessage", "document", "documentChunk", "connection"]) {
      hasil[kunci] = await db[kunci].count();
    }
    console.log(JSON.stringify(hasil));
    await m.closeDb();
  })
  .catch((e) => { console.error(e?.message ?? e); process.exit(1); });')"

node -e '
const fs = require("node:fs");
const [manifestPath, hitungJson] = process.argv.slice(1);
const harap = JSON.parse(fs.readFileSync(manifestPath, "utf8")).counts;
const dapat = JSON.parse(hitungJson);
const beda = Object.keys(harap).filter((k) => harap[k] !== dapat[k]);
if (beda.length > 0) {
  console.error("restore: hitungan tidak cocok: " + beda.map((k) => `${k} ${harap[k]} -> ${dapat[k] ?? "?"}`).join(", "));
  process.exit(1);
}
' "$isi/manifest.json" "$hitung"
echo "restore: hitungan baris cocok"

# --- 6. Verifikasi dekripsi -------------------------------------------------
# Satu baris Connection harus bisa didekripsi dengan kunci saat ini. Tanpa
# langkah ini, restore yang hitungannya cocok masih bisa menyimpan ciphertext
# yang tak berguna.
npx tsx -e '
Promise.all([import("./src/lib/db.ts"), import("./src/lib/secrets/envelope.ts")])
  .then(async ([m, s]) => {
    const db = await m.getDb(process.env.DATABASE_URL);
    const baris = await db.connection.findFirst({ orderBy: { createdAt: "asc" } });
    if (!baris) {
      console.log("restore: tidak ada koneksi untuk diuji, dekripsi dilewati");
      await m.closeDb();
      return;
    }
    s.decryptSecret({
      envelope: baris.apiKeyEncrypted,
      key: Buffer.from(process.env.ENCRYPTION_SECRET.trim(), "base64"),
      aad: { rowId: baris.id, userId: baris.userId, purpose: s.CONNECTION_API_KEY_PURPOSE },
    });
    console.log("restore: dekripsi koneksi terverifikasi");
    await m.closeDb();
  })
  .catch((e) => { console.error("restore: dekripsi gagal: " + (e?.message ?? e)); process.exit(1); });'
