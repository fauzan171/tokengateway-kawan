// Menjaga agar migrasi tetap portabel untuk SQLite dan PostgreSQL.
//
// Dua hal yang diperiksa:
//   1. Setiap migration.sql identik dengan prisma/migrations/_schema.sql.
//      Karena DDL-nya identik, skema hasil di kedua provider tidak bisa
//      berbeda satu sama lain.
//   2. Tidak ada konstruksi SQL yang hanya dikenal salah satu provider.
//
// Ini pengganti uji "bandingkan schema hasil" yang mahal: dua skrip identik
// menghasilkan skema identik, dan itu lebih mudah dibuktikan.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "prisma/migrations";
const REFERENCE = join(MIGRATIONS_DIR, "_schema.sql");
const PROVIDERS = ["sqlite", "postgresql"];

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

const failures = [];

const reference = readFileSync(REFERENCE, "utf8");

for (const pattern of FORBIDDEN) {
  if (pattern.test(reference)) {
    failures.push(`${REFERENCE} memakai konstruksi terlarang: ${pattern}`);
  }
}

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

  let migrationDirs;
  try {
    migrationDirs = readdirSync(providerDir).filter((name) =>
      statSync(join(providerDir, name)).isDirectory(),
    );
  } catch {
    failures.push(`${providerDir} tidak ada`);
    continue;
  }

  if (migrationDirs.length === 0) {
    failures.push(`${providerDir} tidak punya migrasi`);
    continue;
  }

  for (const name of migrationDirs) {
    const file = join(providerDir, name, "migration.sql");
    let sql;
    try {
      sql = readFileSync(file, "utf8");
    } catch {
      failures.push(`${file} tidak ada`);
      continue;
    }
    if (sql !== reference) {
      failures.push(`${file} berbeda dari ${REFERENCE}`);
    }
  }
}

// Nama migrasi harus sama di kedua provider.
const namesOf = (provider) =>
  readdirSync(join(MIGRATIONS_DIR, provider))
    .filter((name) => statSync(join(MIGRATIONS_DIR, provider, name)).isDirectory())
    .sort()
    .join(",");

const sqliteNames = namesOf("sqlite");
const postgresNames = namesOf("postgresql");
if (sqliteNames !== postgresNames) {
  failures.push(
    `daftar migrasi tidak sama: sqlite=[${sqliteNames}] postgresql=[${postgresNames}]`,
  );
}

if (failures.length > 0) {
  console.error("check-migrations: GAGAL");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`check-migrations: OK (${PROVIDERS.length} provider, migrasi identik)`);
