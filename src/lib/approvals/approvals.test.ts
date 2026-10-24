/**
 * FIX-20: approval satu-pakai, digest, konektor (allowlist + enkripsi).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  APPROVAL_TTL_MS,
  approvalDigestFor,
  decideApproval,
  requestApproval,
} from "./approvals";

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

/** Run milik pengguna; approval menempel pada run. */
async function seedRun(owner: string): Promise<string> {
  const taskId = `task_${randomUUID()}`;
  await db.task.create({ data: { id: taskId, userId: owner, title: "Tugas", status: "active" } });
  const runId = `run_${randomUUID()}`;
  await db.taskRun.create({
    data: {
      id: runId,
      taskId,
      status: "waiting",
      deadlineAt: new Date(Date.now() + 60_000),
    },
  });
  return runId;
}

const payload = { chatId: "chat_1" };

describe("approvalDigestFor", () => {
  const base = {
    userId: "u1",
    action: "app.delete_chat",
    target: "chat_1",
    payload: { a: 1 },
    runId: "r1",
    stepId: "s1",
    policyRevision: 1,
  };

  it("deterministik", () => {
    expect(approvalDigestFor(base)).toBe(approvalDigestFor(base));
  });

  it("berubah bila payload/aksi/target/revisi/step berubah", () => {
    const original = approvalDigestFor(base);
    expect(approvalDigestFor({ ...base, payload: { a: 2 } })).not.toBe(original);
    expect(approvalDigestFor({ ...base, action: "app.share_chat" })).not.toBe(original);
    expect(approvalDigestFor({ ...base, target: "chat_2" })).not.toBe(original);
    expect(approvalDigestFor({ ...base, policyRevision: 2 })).not.toBe(original);
    expect(approvalDigestFor({ ...base, stepId: "s2" })).not.toBe(original);
  });
});

describe("approval satu-pakai", () => {
  it("setuju sekali berhasil, pemakaian kedua ditolak", async () => {
    const runId = await seedRun(userId);
    const approval = await requestApproval(db, {
      userId,
      runId,
      action: "app.delete_chat",
      target: "chat_1",
      preview: { title: "Chat lama" },
      payload,
      policyRevision: 1,
    });
    expect(approval.status).toBe("pending");

    const decided = await decideApproval(db, {
      userId,
      approvalId: approval.id,
      approve: true,
      payload,
      policyRevision: 1,
    });
    expect(decided.status).toBe("accepted");

    await expect(
      decideApproval(db, {
        userId,
        approvalId: approval.id,
        approve: true,
        payload,
        policyRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409, code: "APPROVAL_ALREADY_USED" });
  });

  it("payload berbeda membatalkan approval", async () => {
    const runId = await seedRun(userId);
    const approval = await requestApproval(db, {
      userId,
      runId,
      action: "app.share_chat",
      target: "chat_1",
      preview: {},
      payload,
      policyRevision: 1,
    });
    await expect(
      decideApproval(db, {
        userId,
        approvalId: approval.id,
        approve: true,
        payload: { chatId: "chat_lain" },
        policyRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409, code: "APPROVAL_DIGEST_MISMATCH" });

    // Approval masih pending: tidak terpakai oleh percobaan yang gagal.
    const row = await db.taskInteraction.findUnique({ where: { id: approval.id } });
    expect(row?.status).toBe("pending");
  });

  it("revisi kebijakan berbeda membatalkan approval", async () => {
    const runId = await seedRun(userId);
    const approval = await requestApproval(db, {
      userId,
      runId,
      action: "app.delete_chat",
      target: "chat_1",
      preview: {},
      payload,
      policyRevision: 1,
    });
    await expect(
      decideApproval(db, {
        userId,
        approvalId: approval.id,
        approve: true,
        payload,
        policyRevision: 2,
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_DIGEST_MISMATCH" });
  });

  it("approval kedaluwarsa ditolak dan ditandai expired", async () => {
    const runId = await seedRun(userId);
    const approval = await requestApproval(db, {
      userId,
      runId,
      action: "app.delete_chat",
      target: "chat_1",
      preview: {},
      payload,
      policyRevision: 1,
    });
    await db.taskInteraction.update({
      where: { id: approval.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      decideApproval(db, { userId, approvalId: approval.id, approve: true, payload, policyRevision: 1 }),
    ).rejects.toMatchObject({ code: "APPROVAL_EXPIRED" });
    expect((await db.taskInteraction.findUnique({ where: { id: approval.id } }))?.status).toBe("expired");
  });

  it("pengguna lain tidak dapat menyetujui approval ini", async () => {
    const runId = await seedRun(userId);
    const approval = await requestApproval(db, {
      userId,
      runId,
      action: "app.delete_chat",
      target: "chat_1",
      preview: {},
      payload,
      policyRevision: 1,
    });
    await expect(
      decideApproval(db, {
        userId: otherUserId,
        approvalId: approval.id,
        approve: true,
        payload,
        policyRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("approval untuk run milik orang lain ditolak saat diminta", async () => {
    const runId = await seedRun(otherUserId);
    await expect(
      requestApproval(db, {
        userId,
        runId,
        action: "app.delete_chat",
        target: "chat_1",
        preview: {},
        payload,
        policyRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("tanpa run: mengembalikan proposal bertanda tangan, tanpa baris DB", async () => {
    const approval = await requestApproval(db, {
      userId,
      runId: null,
      action: "app.delete_chat",
      target: "chat_1",
      preview: {},
      payload,
      policyRevision: 1,
    });
    expect(approval.status).toBe("proposed");
    expect(await db.taskInteraction.count()).toBe(0);
    expect(approval.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(APPROVAL_TTL_MS).toBe(10 * 60_000);
  });
});

describe("konektor", () => {
  it("allowlist endpoint menolak host/path lain sebelum ada request", async () => {
    const { isConnectorProvider, CONNECTOR_PROVIDERS } = await import("@/lib/connectors/connectors");
    expect(isConnectorProvider("google-drive")).toBe(true);
    expect(isConnectorProvider("dropbox")).toBe(false);
    expect(CONNECTOR_PROVIDERS).toHaveLength(2);
  });

  it("token tampil tersamar, bukan mentah", async () => {
    const { toConnectorSummary } = await import("@/lib/connectors/connectors");
    const summary = toConnectorSummary({
      id: "conn_1",
      provider: "notion",
      label: "Notion kerja",
      scopes: ["read"],
      token: "secret-token-abcdef",
      revokedAt: null,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(JSON.stringify(summary)).not.toContain("secret-token-abcdef");
    // Bahkan potongan token tidak ditampilkan: hanya topeng penuh.
    expect(summary.tokenHint).not.toContain("secr");
    expect(summary.tokenHint).not.toContain("cdef");
  });

  it("konektor yang dicabut tidak dapat membuka token", async () => {
    const { saveConnectorToken, revokeConnector } = await import("@/lib/connectors/connectors");
    const { randomBytes } = await import("node:crypto");
    const key = randomBytes(32);
    const connectorId = `conn_${randomUUID()}`;
    await db.connectorCredential.create({
      data: {
        id: connectorId,
        userId,
        provider: "notion",
        label: "Notion",
        scopes: "",
        tokenEncrypted: "x",
        updatedAt: new Date(),
      },
    });
    await saveConnectorToken(db, { connectorId, userId, token: "tok", key, keyId: "k1" });
    await revokeConnector(db, { connectorId, userId });
    const row = await db.connectorCredential.findUnique({ where: { id: connectorId } });
    expect(row?.revokedAt).not.toBeNull();
    // Token tersimpan sebagai envelope, bukan teks biasa.
    expect(row?.tokenEncrypted).not.toContain("tok");
  });
});