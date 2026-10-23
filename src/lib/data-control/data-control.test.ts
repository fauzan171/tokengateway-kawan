/**
 * FIX-23: ekspor tanpa kredensial, validasi arsip, tombstone + langkah bersih.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { createChat } from "@/lib/chat/chats";
import { createArtifact } from "@/lib/artifacts/create";
import {
  EXPORT_VERSION,
  REDACTED_COLUMNS,
  RETENTION,
  USER_DATA_MAP,
  exportUserData,
  ledgerEntry,
  redactRow,
  tombstoneUserData,
  validateImportArchive,
} from "./data-control";

let temp: TempDb;
let db: Db;
let userId: string;
let otherUserId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  otherUserId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

describe("redactRow", () => {
  it("membuang kolom terlarang", () => {
    const row = {
      id: "a",
      tokenEncrypted: "RAHASIA",
      apiKeyEncrypted: "RAHASIA2",
      passwordHash: "hash",
      storageKey: "path",
      title: "aman",
    };
    const redacted = redactRow(row);
    expect(redacted).toEqual({ id: "a", title: "aman" });
    for (const column of REDACTED_COLUMNS) expect(redacted[column]).toBeUndefined();
  });
});

describe("exportUserData", () => {
  it("memuat chat dan pesan milik pengguna, tanpa data pengguna lain", async () => {
    const chat = await createChat(db, { userId, title: "Punya saya" });
    await createChat(db, { userId: otherUserId, title: "Punya orang lain" });
    await db.chatMessage.create({
      data: {
        id: `msg_${randomUUID()}`,
        chatId: chat.id,
        role: "user",
        contentJson: JSON.stringify({ parts: [{ kind: "text", text: "halo" }] }),
        status: "complete",
        seq: 1,
      },
    });

    const exported = await exportUserData(db, userId);
    expect((exported.data["chats"] as { title: string }[]).map((row) => row.title)).toEqual(["Punya saya"]);
    expect(exported.data["messages"]).toHaveLength(1);
    expect(JSON.stringify(exported.data)).not.toContain("Punya orang lain");
  });

  it("artefak diekspor sebagai metadata tanpa byte", async () => {
    await createArtifact(db, {
      userId,
      displayName: "catatan",
      input: { format: "md", content: "# halo" },
    });
    const exported = await exportUserData(db, userId);
    const artifacts = exported.data["artifacts"] as { bytesIncluded: boolean; sha256: string }[];
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.bytesIncluded).toBe(false);
    expect(artifacts[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("manifest menyebut versi, jumlah, berkas yang tidak ikut, dan hash", async () => {
    await createChat(db, { userId });
    const exported = await exportUserData(db, userId);
    expect(exported.manifest.version).toBe(EXPORT_VERSION);
    expect(exported.manifest.counts["chats"]).toBe(1);
    expect(exported.manifest.omitted.map((entry) => entry.kind)).toContain("credentials");
    expect(exported.manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("token konektor tidak pernah muncul di ekspor", async () => {
    await db.connectorCredential.create({
      data: {
        id: `conn_${randomUUID()}`,
        userId,
        provider: "notion",
        label: "Notion",
        scopes: "read",
        tokenEncrypted: "ENVELOPE-RAHASIA",
        updatedAt: new Date(),
      },
    });
    const exported = await exportUserData(db, userId);
    expect(JSON.stringify(exported)).not.toContain("ENVELOPE-RAHASIA");
  });
});

describe("validateImportArchive", () => {
  const good = {
    manifest: { version: EXPORT_VERSION },
    data: { chats: [{ id: "c1", title: "T" }] },
  };

  it("arsip sah lolos dengan jumlah", () => {
    const result = validateImportArchive(good);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.counts).toEqual({ chats: 1 });
  });

  it("versi asing ditolak", () => {
    const result = validateImportArchive({ ...good, manifest: { version: "kawan.data.v1" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Versi");
  });

  it("data bukan objek, atau berisi non-array, ditolak", () => {
    expect(validateImportArchive({ manifest: { version: EXPORT_VERSION }, data: [] }).ok).toBe(false);
    expect(
      validateImportArchive({ manifest: { version: EXPORT_VERSION }, data: { chats: "bukan array" } }).ok,
    ).toBe(false);
  });

  it("arsip yang membawa kolom terlarang ditolak", () => {
    const result = validateImportArchive({
      manifest: { version: EXPORT_VERSION },
      data: { chats: [{ id: "c1", tokenEncrypted: "RAHASIA" }] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("terlarang");
  });
});

describe("tombstoneUserData", () => {
  it("menombstone artefak, mencabut konektor, mematikan jadwal, dan melaporkan langkah", async () => {
    const artifact = await createArtifact(db, {
      userId,
      displayName: "berkas",
      input: { format: "txt", content: "isi" },
    });
    await db.connectorCredential.create({
      data: {
        id: `conn_${randomUUID()}`,
        userId,
        provider: "notion",
        label: "Notion",
        scopes: "",
        tokenEncrypted: "x",
        updatedAt: new Date(),
      },
    });
    await db.schedule.create({
      data: {
        id: `sch_${randomUUID()}`,
        userId,
        title: "J",
        prompt: "p",
        localTime: "2026-11-01T09:00",
        timezone: "Asia/Jakarta",
        enabled: 1,
        nextRunAt: new Date(),
      },
    });

    const result = await tombstoneUserData(db, userId);
    expect(result.steps.map((step) => step.kind)).toEqual(["artifacts", "documents", "connectors", "schedules"]);
    expect(result.steps.find((step) => step.kind === "artifacts")?.count).toBe(1);

    const row = await db.artifact.findUnique({ where: { id: artifact.id } });
    expect(row?.deletedAt).not.toBeNull();
    // Endpoint privat memakai filter deletedAt null/expiresAt: langsung 404.
    expect(row?.expiresAt?.getTime()).toBeLessThanOrEqual(Date.now());

    const connector = await db.connectorCredential.findFirst({ where: { userId } });
    expect(connector?.revokedAt).not.toBeNull();
    const schedule = await db.schedule.findFirst({ where: { userId } });
    expect(schedule?.enabled).toBe(0);
  });

  it("idempoten: tombstone dua kali tidak mengubah hasil dan laporan kedua kosong", async () => {
    await createArtifact(db, { userId, displayName: "a", input: { format: "txt", content: "x" } });
    await tombstoneUserData(db, userId);
    const second = await tombstoneUserData(db, userId);
    expect(second.steps.find((step) => step.kind === "artifacts")?.count).toBe(0);
  });

  it("data pengguna lain tidak tersentuh", async () => {
    const otherArtifact = await createArtifact(db, {
      userId: otherUserId,
      displayName: "milik orang lain",
      input: { format: "txt", content: "x" },
    });
    await tombstoneUserData(db, userId);
    const row = await db.artifact.findUnique({ where: { id: otherArtifact.id } });
    expect(row?.deletedAt).toBeNull();
  });
});

describe("ledgerEntry", () => {
  it("hanya id opaque + waktu + status, tanpa isi", () => {
    const entry = ledgerEntry({
      userId: "u1",
      kind: "chat",
      targetId: "chat_1",
      deletedAt: new Date("2026-01-01T00:00:00Z"),
      status: "tombstoned",
    });
    expect(Object.keys(entry).sort()).toEqual(["deletedAt", "id", "kind", "status", "targetId", "userId"]);
    expect(entry.id).toMatch(/^del_[0-9a-f]{24}$/);
    expect(JSON.stringify(entry)).not.toContain("isi");
  });

  it("id stabil untuk target yang sama", () => {
    const base = { userId: "u1", kind: "chat", targetId: "chat_1", deletedAt: new Date(), status: "cleaned" as const };
    expect(ledgerEntry(base).id).toBe(ledgerEntry(base).id);
  });
});

describe("peta dependensi dan retensi", () => {
  it("peta memuat tabel data pengguna utama", () => {
    const models = USER_DATA_MAP.map((entry) => entry.model);
    for (const model of ["chat", "artifact", "memoryItem", "connectorCredential", "schedule", "notification"]) {
      expect(models).toContain(model);
    }
  });

  it("retensi masuk akal dan tidak negatif", () => {
    for (const days of Object.values(RETENTION)) expect(days).toBeGreaterThan(0);
    expect(RETENTION.taskEventDays).toBeGreaterThan(RETENTION.artifactDays);
  });
});
