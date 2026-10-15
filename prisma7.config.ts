import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";
if (existsSync(".env")) { process.loadEnvFile(".env"); }
const url = process.env["DATABASE_URL"] ?? "";
const isSqlite = url.startsWith("file:");
// `datasource.provider` bersifat statis, dan Prisma CLI memvalidasi DATABASE_URL
// terhadap provider di file schema. Jadi provider harus dipilih lewat file schema,
// bukan hanya lewat direktori migrasi.
const migrationsPath = isSqlite ? "prisma/migrations/sqlite" : "prisma/migrations/postgresql";
const schemaPath = isSqlite ? "prisma/schema.sqlite.prisma" : "prisma/schema.prisma";

export default defineConfig({
  schema: schemaPath,
  migrations: { path: migrationsPath },
  datasource: { url },
});
