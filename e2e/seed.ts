/**
 * Seed database E2E: satu ShareLink beku dengan semua bentuk render P5.
 *
 * Ditulis lewat better-sqlite3 langsung (bukan Prisma) supaya uji tidak butuh
 * proses CLI. Token ditulis ke `e2e/.tmp/token.txt` untuk dibaca spec.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const DIR = join(process.cwd(), "e2e", ".tmp");
export const DB_FILE = join(DIR, "e2e.db");
export const TOKEN_FILE = join(DIR, "token.txt");
const MIGRATION = "prisma/migrations/sqlite/00000000000000_init/migration.sql";

export const TOKEN = "e2e-token-render";

const ASSISTANT_TEXT = [
  "## Judul",
  "",
  "Teks **tebal** dan [tautan](https://example.com).",
  "",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "```js",
  "const a = 1 < 2;",
  "```",
  "",
  "Matematika $x^2$ dan blok:",
  "",
  "$$",
  "a^2 + b^2 = c^2",
  "$$",
  "",
  "```mermaid",
  "graph TD; A-->B;",
  "```",
  "",
  "<script>window.__xss = 1</script>",
  '<img src=x onerror="window.__xss = 2">',
].join("\n");

const now = new Date().toISOString();

const snapshot = {
  title: "Snapshot render",
  createdAt: now,
  messages: [
    { role: "user", text: "Tolong jelaskan.", createdAt: now },
    { role: "assistant", text: ASSISTANT_TEXT, createdAt: now },
  ],
};

export function seed(): void {
  mkdirSync(DIR, { recursive: true });
  rmSync(DB_FILE, { force: true });

  const db = new Database(DB_FILE);
  db.exec(readFileSync(MIGRATION, "utf8"));
  db.prepare(
    `INSERT INTO "User" (id, email, name, role, status, createdAt) VALUES (?, ?, ?, 'user', 'active', ?)`,
  ).run("user-e2e", "e2e@example.com", "E2E", now);
  db.prepare(
    `INSERT INTO "Chat" (id, userId, title, modelRef, pinned, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
  ).run("chat-e2e", "user-e2e", "Chat E2E", "deepseek-v4.1-flash", now, now);
  db.prepare(
    `INSERT INTO "ShareLink" (id, chatId, token, snapshotJson, createdAt) VALUES (?, ?, ?, ?, ?)`,
  ).run("share-e2e", "chat-e2e", TOKEN, JSON.stringify(snapshot), now);
  db.close();

  writeFileSync(TOKEN_FILE, TOKEN);
}
