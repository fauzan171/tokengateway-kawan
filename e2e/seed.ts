/**
 * Seed database E2E (WP-NT-P6-10, diperluas WP-NT-P10-05).
 *
 * Ditulis lewat better-sqlite3 langsung (bukan Prisma) supaya uji tidak butuh
 * proses CLI. Semua pengguna memakai gateway palsu `e2e/fake-gateway.ts`;
 * kunci API-nya dienkripsi dengan helper produksi (bukan plaintext di kolom
 * terenkripsi), memakai `ENCRYPTION_SECRET` tetap milik proses uji.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { hashSync } from "@node-rs/argon2";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret } from "../src/lib/secrets";
import { E2E_ENCRYPTION_SECRET, FAKE_GATEWAY_BASE } from "./fake-gateway";

const DIR = join(process.cwd(), "e2e", ".tmp");
export const DB_FILE = join(DIR, "e2e.db");
export const TOKEN_FILE = join(DIR, "token.txt");
const MIGRATION = "prisma/migrations/sqlite/00000000000000_init/migration.sql";

export const TOKEN = "e2e-token-render";
/** Kredensial `user-e2e`; dipakai spec yang butuh sesi. */
export const E2E_EMAIL = "e2e@example.com";
export const E2E_PASSWORD = "kata-sandi-e2e-panjang";
export const E2E_USER_ID = "user-e2e";

/** Pengguna kedua: alur D (tautan anonim) dan E (hapus pengguna). */
export const E2E_B_EMAIL = "e2e-b@example.com";
export const E2E_B_USER_ID = "user-e2e-b";
/** Admin: alur E. */
export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_USER_ID = "user-e2e-admin";
/** Akun yang sengaja belum diaktifkan: alur A memakai jalur ini. */
export const PENDING_EMAIL = "pending@example.com";
export const PENDING_USER_ID = "user-e2e-pending";

const API_KEY = "kunci-palsu";
const KEY_ID = "v1";
const KEY = Buffer.from(E2E_ENCRYPTION_SECRET, "base64");

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

/** Ciphertext kunci API palsu; AAD harus sama dengan yang dipakai `models`. */
function encryptedKey(connectionId: string, userId: string): string {
  return encryptSecret({
    plaintext: API_KEY,
    key: KEY,
    keyId: KEY_ID,
    aad: { rowId: connectionId, userId, purpose: CONNECTION_API_KEY_PURPOSE },
  });
}

export function seed(): void {
  mkdirSync(DIR, { recursive: true });
  // WAL/SHM lama membuat `disk I/O error` saat DB baru dibuat di atas sisa run.
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB_FILE}${suffix}`, { force: true });

  const db = new Database(DB_FILE);
  db.exec(readFileSync(MIGRATION, "utf8"));

  const user = db.prepare(
    `INSERT INTO "User" (id, email, name, role, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  user.run(E2E_USER_ID, E2E_EMAIL, "E2E", "user", "active", now);
  user.run(E2E_B_USER_ID, E2E_B_EMAIL, "E2E B", "user", "active", now);
  user.run(ADMIN_USER_ID, ADMIN_EMAIL, "Admin E2E", "admin", "active", now);
  user.run(PENDING_USER_ID, PENDING_EMAIL, "Pending", "user", "pending", now);

  const credential = db.prepare(
    `INSERT INTO "Credential" (userId, passwordHash, updatedAt) VALUES (?, ?, ?)`,
  );
  for (const id of [E2E_USER_ID, E2E_B_USER_ID, ADMIN_USER_ID, PENDING_USER_ID]) {
    credential.run(id, hashSync(E2E_PASSWORD), now);
  }

  const connection = db.prepare(
    `INSERT INTO "Connection" (id, userId, name, baseUrl, apiKeyEncrypted, apiKeyMask, keyId, isActive, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?)`,
  );
  connection.run(
    "conn-e2e",
    E2E_USER_ID,
    "Gateway E2E",
    FAKE_GATEWAY_BASE,
    encryptedKey("conn-e2e", E2E_USER_ID),
    "••••",
    KEY_ID,
    now,
  );
  connection.run(
    "conn-e2e-b",
    E2E_B_USER_ID,
    "Gateway E2E B",
    FAKE_GATEWAY_BASE,
    encryptedKey("conn-e2e-b", E2E_B_USER_ID),
    "••••",
    KEY_ID,
    now,
  );

  db.prepare(
    `INSERT INTO "Chat" (id, userId, title, modelRef, pinned, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
  ).run("chat-e2e", E2E_USER_ID, "Chat E2E", "palsu-kecil", now, now);

  db.prepare(
    `INSERT INTO "Document" (id, userId, filename, mime, sizeBytes, storageKey, status, errorCode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("doc-e2e-ready", E2E_USER_ID, "laporan.pdf", "application/pdf", 2048, "e2e/laporan.pdf", "ready", null, now);
  db.prepare(
    `INSERT INTO "DocumentChunk" (id, documentId, ordinal, text, page, section, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("chunk-e2e", "doc-e2e-ready", 0, "Kesimpulan laporan: penjualan naik.", 3, "Kesimpulan", now);
  db.prepare(
    `INSERT INTO "Document" (id, userId, filename, mime, sizeBytes, storageKey, status, errorCode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("doc-e2e-failed", E2E_USER_ID, "catatan.txt", "text/plain", 512, "e2e/catatan.txt", "failed", "EXTRACT_EMPTY", now);

  db.prepare(
    `INSERT INTO "ShareLink" (id, chatId, token, snapshotJson, createdAt) VALUES (?, ?, ?, ?, ?)`,
  ).run("share-e2e", "chat-e2e", TOKEN, JSON.stringify(snapshot), now);

  // Alur E: chat + tautan milik pengguna kedua, untuk dibuktikan ikut terhapus.
  db.prepare(
    `INSERT INTO "Chat" (id, userId, title, modelRef, pinned, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
  ).run("chat-e2e-b", E2E_B_USER_ID, "Chat B", "palsu-kecil", now, now);
  db.prepare(
    `INSERT INTO "ShareLink" (id, chatId, token, snapshotJson, createdAt) VALUES (?, ?, ?, ?, ?)`,
  ).run("share-e2e-b", "chat-e2e-b", "e2e-token-b", JSON.stringify({ ...snapshot, title: "Chat B" }), now);
  db.close();

  writeFileSync(TOKEN_FILE, TOKEN);
}
