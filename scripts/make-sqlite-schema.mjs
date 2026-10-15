// Menurunkan prisma/schema.sqlite.prisma dari prisma/schema.prisma.
//
// Satu sumber kebenaran schema. Varian SQLite hanya berbeda pada provider
// datasource dan direktori output klien; sisa file identik. File turunan ini
// gitignored, jadi tidak mungkin menyimpang dari sumbernya.

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "prisma/schema.prisma";
const TARGET = "prisma/schema.sqlite.prisma";

const source = readFileSync(SOURCE, "utf8");

const sqlite = source
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replace('output   = "../src/generated/prisma"', 'output   = "../src/generated/prisma-sqlite"')
  .replace(
    "// Provider yang benar-benar dipakai saat runtime ditentukan DATABASE_URL,\n// bukan oleh baris ini.",
    "// FILE TURUNAN — jangan diedit. Dihasilkan oleh scripts/make-sqlite-schema.mjs\n// dari prisma/schema.prisma. Perubahan langsung di sini akan hilang.",
  );

if (sqlite === source) {
  console.error(`make-sqlite-schema: GAGAL, tidak ada baris yang diganti di ${SOURCE}`);
  process.exit(1);
}
if (sqlite.includes('provider = "postgresql"')) {
  console.error("make-sqlite-schema: GAGAL, provider belum terganti");
  process.exit(1);
}
if (sqlite.includes('"../src/generated/prisma"')) {
  console.error("make-sqlite-schema: GAGAL, output klien belum terganti");
  process.exit(1);
}

writeFileSync(TARGET, sqlite);
console.log(`make-sqlite-schema: OK -> ${TARGET}`);
