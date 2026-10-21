// Menjaga agar migrasi tetap portabel untuk SQLite dan PostgreSQL.
//
// Yang diperiksa:
//   1. Migrasi init dibekukan: checksum-nya harus sama dengan yang tercatat di
//      prisma/migrations/checksums.json. Init yang sudah pernah diterapkan tidak
//      boleh diedit diam-diam; perubahan skema harus lewat migrasi baru.
//   2. Urutan nama migrasi sama di kedua provider.
//   3. Setiap migration.sql tidak kosong dan tidak memakai konstruksi SQL yang
//      hanya dikenal salah satu provider. Migrasi tambahan boleh berbeda isinya
//      dari init (provider-specific dibuktikan lewat test perilaku, bukan teks).
//
// Dua skrip identik untuk init menghasilkan skema awal yang identik; itu lebih
// mudah dibuktikan daripada membandingkan schema hasil di dua server.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Bisa diarahkan ke salinan sementara oleh test (uji penolakan tamper).
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? "prisma/migrations";
const REFERENCE = join(MIGRATIONS_DIR, "_schema.sql");
const MANIFEST = join(MIGRATIONS_DIR, "checksums.json");
const PROVIDERS = ["sqlite", "postgresql"];
const INIT = "00000000000000_init";

// Konstruksi yang bikin DDL hanya jalan di satu provider.
const FORBIDDEN = [
  /\bPRAGMA\b/i,
  /\bAUTOINCREMENT\b/i,
  /\bWITHOUT\s+ROWID\b/i,
  /\bSERIAL\b/i,
  /\bBIGSERIAL\b/i,
  /\bGENERATED\s+(ALWAYS|BY)\b/i,
  /\bUUID\b/i,
  /\bJSONB?\b/i,
  /\bTIMESTAMPTZ\b/i,
  /\bBOOLEAN\b/i,
  /\bBYTEA\b/i,
  /\bINTERVAL\b/i,
  /\bCONCURRENTLY\b/i,
  /\bIF\s+NOT\s+EXISTS\b/i,
];

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

const failures = [];

const reference = readFileSync(REFERENCE, "utf8");

for (const pattern of FORBIDDEN) {
  if (pattern.test(reference)) {
    failures.push(`${REFERENCE} memakai konstruksi terlarang: ${pattern}`);
  }
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch (error) {
  failures.push(`${MANIFEST} tidak ada atau bukan JSON: ${error.message}`);
  manifest = {};
}

const referenceHash = sha256(REFERENCE);
if (manifest[INIT] !== referenceHash) {
  failures.push(
    `${REFERENCE} berubah (sha256 ${referenceHash}); init yang sudah diterapkan tidak boleh diedit, buat migrasi baru`,
  );
}

/** Nama direktori migrasi, urut seperti urutan penerapan. */
function migrationNames(provider) {
  const dir = join(MIGRATIONS_DIR, provider);
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}

const lists = {};

for (const provider of PROVIDERS) {
  const providerDir = join(MIGRATIONS_DIR, provider);

  let lock;
  try {
    lock = readFileSync(join(providerDir, "migration_lock.toml"), "utf8");
  } catch {
    failures.push(`${providerDir}/migration_lock.toml tidak ada`);
    continue;
  }
  if (!lock.includes(`provider = "${provider}"`)) {
    failures.push(`${providerDir}/migration_lock.toml tidak menyatakan provider "${provider}"`);
  }

  let names;
  try {
    names = migrationNames(provider);
  } catch {
    failures.push(`${providerDir} tidak ada`);
    continue;
  }
  lists[provider] = names;

  if (names.length === 0) {
    failures.push(`${providerDir} tidak punya migrasi`);
    continue;
  }
  if (names[0] !== INIT) {
    failures.push(`${providerDir}: migrasi pertama harus ${INIT}, bukan ${names[0]}`);
  }

  for (const name of names) {
    const file = join(providerDir, name, "migration.sql");
    let sql;
    try {
      sql = readFileSync(file, "utf8");
    } catch {
      failures.push(`${file} tidak ada`);
      continue;
    }
    if (sql.trim() === "") {
      failures.push(`${file} kosong`);
      continue;
    }
    // Init harus identik dengan referensi; migrasi tambahan boleh berbeda.
    if (name === INIT) {
      if (sql !== reference) failures.push(`${file} berbeda dari ${REFERENCE}`);
      if (sha256(file) !== manifest[INIT]) {
        failures.push(`${file} tidak cocok dengan checksum init di ${MANIFEST}`);
      }
    }
    for (const pattern of FORBIDDEN) {
      if (pattern.test(sql)) failures.push(`${file} memakai konstruksi terlarang: ${pattern}`);
    }
  }
}

// Nama migrasi harus sama di kedua provider.
if (lists.sqlite && lists.postgresql && lists.sqlite.join(",") !== lists.postgresql.join(",")) {
  failures.push(
    `daftar migrasi tidak sama: sqlite=[${lists.sqlite.join(",")}] postgresql=[${lists.postgresql.join(",")}]`,
  );
}

// Manifest harus mencakup init saja; entri tambahan untuk migrasi yang tidak
// ada berarti checksum basi yang menyesatkan.
for (const name of Object.keys(manifest)) {
  if (name !== INIT) failures.push(`${MANIFEST} memuat entri tak dikenal: ${name}`);
}

if (failures.length > 0) {
  console.error("check-migrations: GAGAL");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`check-migrations: OK (${PROVIDERS.length} provider, init dibekukan, urutan sama)`);
