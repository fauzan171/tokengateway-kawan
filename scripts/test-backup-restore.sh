#!/usr/bin/env bash
# Uji nyata backup/restore (WP-NT-P10-03, SDD-8.6).
#
# Membangun instance SQLite sementara + satu berkas dokumen + satu baris
# User/Chat/Connection/Document, lalu membuktikan bahwa:
#   - backup menghasilkan arsip yang berisi manifest, DB, dan berkas;
#   - restore ke instance bersih berhasil dan hitungan barisnya cocok;
#   - restore dengan ENCRYPTION_SECRET berbeda DITOLAK;
#   - restore ke DB yang sudah ada tanpa --force DITOLAK.
#
# Dua kasus terakhir adalah pengamannya: tanpa keduanya, skrip bisa "lulus"
# sambil merusak data. Stdout hanya satu baris ringkasan.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

kerja="$(mktemp -d)"
bersihkan() { rm -rf "$kerja"; }
trap bersihkan EXIT

lulus=0
cek() { lulus=$((lulus + 1)); }

gagal() {
  echo "GAGAL: $1" >&2
  exit 1
}

harus_gagal() { # <label> <perintah...>
  local label="$1"; shift
  if "$@" >"$kerja/keluaran" 2>&1; then
    cat "$kerja/keluaran" >&2
    gagal "$label seharusnya ditolak, tetapi berhasil"
  fi
  cek
}

sumber="$kerja/sumber.db"
target="$kerja/target.db"
dokumen="$kerja/documents"

sqlite3 "$sumber" < prisma/migrations/_schema.sql || gagal "DDL tidak bisa diterapkan"

export DATABASE_URL="file:$sumber"
export STORAGE_LOCAL_DIR="$dokumen"
export ENCRYPTION_SECRET="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))')"

mkdir -p "$dokumen"
printf 'isi dokumen contoh\n' >"$dokumen/contoh.txt"

# Data contoh lewat modul proyek sendiri, supaya ciphertext yang dibuat benar
# (AAD terikat ke baris) dan bisa diuji dekripsinya saat restore.
cat >"$kerja/seed.mts" <<EOF
const [dbm, sec] = await Promise.all([
  import("$root/src/lib/db.ts"),
  import("$root/src/lib/secrets/envelope.ts"),
]);
const db = await dbm.getDb(process.env.DATABASE_URL!);
const key = Buffer.from(process.env.ENCRYPTION_SECRET!.trim(), "base64");
const now = new Date();
const userId = "user_uji";
const connId = "conn_uji";
await db.user.create({ data: { id: userId, email: "uji@example.test", name: "Uji", status: "active", createdAt: now } });
await db.chat.create({ data: { id: "chat_uji", userId, title: "Chat uji", createdAt: now, updatedAt: now } });
await db.connection.create({
  data: {
    id: connId, userId, name: "Gateway uji", baseUrl: "https://gateway.example.test",
    apiKeyEncrypted: sec.encryptSecret({
      plaintext: "sk-uji-bukan-kunci-abcdefghijklmnop",
      key,
      keyId: "v1",
      aad: { rowId: connId, userId, purpose: sec.CONNECTION_API_KEY_PURPOSE },
    }),
    apiKeyMask: "sk-...mnop", keyId: "v1", createdAt: now,
  },
});
await db.document.create({
  data: { id: "doc_uji", userId, filename: "contoh.txt", mime: "text/plain", sizeBytes: 18, storageKey: "contoh.txt", status: "ready", createdAt: now },
});
await db.documentChunk.create({
  data: { id: "chunk_uji", documentId: "doc_uji", ordinal: 0, text: "isi dokumen contoh", createdAt: now },
});
await dbm.closeDb();
EOF
npx tsx "$kerja/seed.mts" >/dev/null || gagal "data contoh tidak bisa dibuat"

# --- 1. Backup --------------------------------------------------------------
arsip="$(./scripts/backup.sh "$kerja/arsip")" || gagal "backup.sh keluar non-zero"
[ -f "$arsip" ] || gagal "backup.sh tidak menghasilkan arsip"
cek

# `grep -q` keluar lebih dulu dan mematikan tar lewat SIGPIPE; dengan pipefail
# itu terlihat seperti kegagalan. Daftar isi ditulis ke berkas dulu.
tar -tzf "$arsip" >"$kerja/daftar.txt" || gagal "arsip tidak bisa dibaca"
grep -qE '^[^/]+/manifest\.json$' "$kerja/daftar.txt" || gagal "arsip tanpa manifest.json"
grep -qE '^[^/]+/db\.sqlite$' "$kerja/daftar.txt" || gagal "arsip tanpa db.sqlite"
grep -qE '^[^/]+/documents/contoh\.txt$' "$kerja/daftar.txt" || gagal "arsip tanpa berkas dokumen"
cek

# Manifest tidak boleh memuat kunci enkripsi, hanya sidik jarinya.
isi="$(tar -xzOf "$arsip" --wildcards '*/manifest.json')"
printf '%s' "$isi" | grep -q '"encryptionKeyFingerprint"' || gagal "manifest tanpa sidik jari kunci"
printf '%s' "$isi" | grep -qF "$ENCRYPTION_SECRET" && gagal "manifest memuat ENCRYPTION_SECRET"
cek

# --- 2. Restore ke instance bersih -----------------------------------------
[ ! -e "$target" ] || gagal "target uji sudah ada sebelum restore"
DATABASE_URL="file:$target" STORAGE_LOCAL_DIR="$kerja/documents-pulih" ./scripts/restore.sh "$arsip" >"$kerja/restore.log" \
  || { cat "$kerja/restore.log" >&2; gagal "restore ke instance bersih gagal"; }
# Dekripsi sampel koneksi harus benar-benar dijalankan, bukan dilewati karena
# tabelnya kosong.
grep -q "dekripsi koneksi terverifikasi" "$kerja/restore.log" || gagal "verifikasi dekripsi tidak berjalan"
cek

for tabel in User Chat ChatMessage Document DocumentChunk Connection; do
  asal="$(sqlite3 "$sumber" "SELECT count(*) FROM \"$tabel\"")"
  pulih="$(sqlite3 "$target" "SELECT count(*) FROM \"$tabel\"")"
  [ "$asal" = "$pulih" ] || gagal "hitungan $tabel berbeda: asal $asal, pulih $pulih"
done
cek

[ -f "$kerja/documents-pulih/contoh.txt" ] || gagal "berkas dokumen tidak ikut dipulihkan"
cek

# --- 3. Pengaman: kunci berbeda --------------------------------------------
harus_gagal "restore dengan ENCRYPTION_SECRET berbeda" \
  env ENCRYPTION_SECRET="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))')" \
  ./scripts/restore.sh "$arsip"

# --- 4. Pengaman: target sudah ada tanpa --force ---------------------------
harus_gagal "restore ke database yang sudah ada tanpa --force" \
  ./scripts/restore.sh "$arsip"

echo "OK $lulus pemeriksaan"
