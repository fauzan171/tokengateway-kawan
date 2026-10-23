/**
 * Uji job `agent.run` (FIX-08, SDD-AG-3).
 *
 * Memakai fixture provider loopback lewat `fetch` nyata, jadi jalur stream,
 * dekripsi kunci, fence lease, dan penulisan event durable diuji sungguhan.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import {
  UNICODE_TEXT,
  modelFor,
  startProviderFixture,
  type ProviderFixture,
} from "../../../tests/fixtures/provider-server";
import { createTask, cancelRun, followUp } from "./tasks";
import { runTaskRun } from "./run";
import { createTaskEventStream } from "./events";
import * as registry from "@/lib/agents/registry";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret } from "@/lib/secrets";
import type { GenerateConfig } from "@/lib/chat/generate";
import type { Db } from "@/lib/db";

const ENCRYPTION_KEY = Buffer.alloc(32, 7);

let fixture: ProviderFixture;
let temp: TempDb;
let db: Db;
let userId: string;

beforeAll(async () => {
  fixture = await startProviderFixture();
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });

  const connectionId = randomUUID();
  await db.connection.create({
    data: {
      id: connectionId,
      userId,
      name: "gateway uji",
      baseUrl: fixture.baseUrl,
      apiKeyEncrypted: encryptSecret({
        plaintext: "kunci-uji",
        key: ENCRYPTION_KEY,
        keyId: "v1",
        aad: { rowId: connectionId, userId, purpose: CONNECTION_API_KEY_PURPOSE },
      }),
      apiKeyMask: "kunci-****",
      keyId: "v1",
      isActive: 1,
      status: "active",
    },
  });
});

function config(): GenerateConfig {
  const port = new URL(fixture.baseUrl).port;
  return {
    encryptionKey: ENCRYPTION_KEY,
    allowInsecureHttp: true,
    outboundAllowlist: [`127.0.0.1:${port}`],
  };
}

async function admission(input = "Kerjakan sesuatu", model = "") {
  const result = await createTask(db, {
    userId,
    input,
    modelId: model,
    idempotencyKey: null,
  });
  return result;
}

describe("runTaskRun", () => {
  it("stream sukses: teks durable, event lengkap, run completed", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("completed");
    expect(run.finishedAt).not.toBeNull();
    expect(run.stepCount).toBe(1);

    const assistant = await db.taskMessage.findUniqueOrThrow({
      where: { id: run.assistantMessageId! },
    });
    expect(assistant.text).toBe(UNICODE_TEXT);

    const kinds = (
      await db.taskEvent.findMany({ where: { runId }, orderBy: { seq: "asc" } })
    ).map((row) => row.kind);
    expect(kinds[0]).toBe("run.queued");
    expect(kinds).toContain("run.started");
    expect(kinds).toContain("message.delta");
    expect(kinds).toContain("usage.updated");
    expect(kinds[kinds.length - 1]).toBe("run.completed");
  });

  it("seq event unik dan menaik tanpa celah", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await runTaskRun(db, config(), runId, new AbortController().signal);
    const rows = await db.taskEvent.findMany({ where: { runId }, orderBy: { seq: "asc" } });
    expect(rows.map((row) => row.seq)).toEqual(rows.map((_, index) => index + 1));
  });

  it("tidak ada event setelah run.completed (terminal menutup stream)", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await runTaskRun(db, config(), runId, new AbortController().signal);
    const rows = await db.taskEvent.findMany({ where: { runId }, orderBy: { seq: "asc" } });
    const last = rows[rows.length - 1]!;
    expect(last.kind).toBe("run.completed");
    expect(rows.filter((row) => row.kind.startsWith("run.") && row.seq > last.seq)).toHaveLength(0);
  });

  it("run terminal dilewati tanpa efek baru", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await db.taskRun.update({ where: { id: runId }, data: { status: "completed" } });
    const before = await db.taskEvent.count({ where: { runId } });
    await runTaskRun(db, config(), runId, new AbortController().signal);
    expect(await db.taskEvent.count({ where: { runId } })).toBe(before);
  });

  it("deadline lewat → run.failed RUN_TIMEOUT tanpa memanggil gateway", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await db.taskRun.update({ where: { id: runId }, data: { deadlineAt: new Date(Date.now() - 1000) } });
    const requestsBefore = fixture.requests.length;
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("failed");
    expect(run.errorCode).toBe("RUN_TIMEOUT");
    expect(fixture.requests.length).toBe(requestsBefore);
  });

  it("cancel sebelum dispatch → run.cancelled tanpa panggilan provider", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await cancelRun(db, { userId, taskId: (await db.taskRun.findUniqueOrThrow({ where: { id: runId } })).taskId, runId });
    const requestsBefore = fixture.requests.length;
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("cancelled");
    expect(fixture.requests.length).toBe(requestsBefore);
  });

  it("koneksi tanpa kunci valid → run.failed CONNECTION_MISSING tanpa menyentuh jaringan", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await db.connection.updateMany({ where: { userId }, data: { isActive: 0 } });
    await db.taskRun.update({ where: { id: runId }, data: { connectionId: null } });
    await runTaskRun(db, config(), runId, new AbortController().signal);
    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("failed");
    expect(run.errorCode).toBe("CONNECTION_MISSING");
  });

  it("lease hilang di tengah stream → LeaseLost dan status tidak ditutup", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    const fence = {
      held: async () => false,
      heldFresh: async () => false,
    };
    await expect(
      runTaskRun(db, config(), runId, new AbortController().signal, fence),
    ).rejects.toThrow();
    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).not.toBe("completed");
  });

  it("follow-up setelah terminal memakai riwayat run sebelumnya", async () => {
    const first = await admission("Pertanyaan satu", modelFor("unicode-split"));
    await runTaskRun(db, config(), first.runId, new AbortController().signal);

    const run = await followUp(db, {
      userId,
      taskId: first.taskId,
      input: "Pertanyaan dua",
      modelId: modelFor("unicode-split"),
      idempotencyKey: null,
    });
    await runTaskRun(db, config(), run.id, new AbortController().signal);

    // Riwayat dikirim ulang: satu request memuat teks run pertama.
    const body = JSON.stringify(fixture.requests[fixture.requests.length - 1]!.body);
    expect(body).toContain("Pertanyaan satu");
    expect(body).toContain("Pertanyaan dua");
    expect((await db.taskRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("completed");
  });
});

describe("createTaskEventStream", () => {
  async function collect(runId: string, taskId: string, afterSeq?: number): Promise<string> {
    const stream = createTaskEventStream({
      db,
      userId,
      taskId,
      runId,
      ...(afterSeq === undefined ? {} : { afterSeq }),
      signal: new AbortController().signal,
    });
    const reader = stream.getReader();
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += new TextDecoder().decode(value);
    }
    return out;
  }

  it("memutar event dari awal termasuk meta, lalu berhenti di terminal", async () => {
    const { runId, taskId } = await admission("Halo", modelFor("unicode-split"));
    await runTaskRun(db, config(), runId, new AbortController().signal);
    const out = await collect(runId, taskId);
    expect(out).toContain("event: meta");
    expect(out).toContain("event: run.completed");
    expect(out).toContain("id: ");
  });

  it("afterSeq melewati event yang sudah dimiliki klien", async () => {
    const { runId, taskId } = await admission("Halo", modelFor("unicode-split"));
    await runTaskRun(db, config(), runId, new AbortController().signal);
    const total = (await db.taskEvent.findMany({ where: { runId } })).length;
    const out = await collect(runId, taskId, total);
    expect(out).not.toContain("event: run.queued");
    expect(out).not.toContain("event: message.delta");
  });

  it("run milik pengguna lain → stream mengirim error, bukan data", async () => {
    const { runId, taskId } = await admission("Halo", modelFor("unicode-split"));
    await db.user.create({ data: { id: "uLain", email: "lain@t.id" } });
    const stream = createTaskEventStream({
      db,
      userId: "uLain",
      taskId,
      runId,
      signal: new AbortController().signal,
    });
    const reader = stream.getReader();
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += new TextDecoder().decode(value);
    }
    expect(out).toContain("RESOURCE_NOT_FOUND");
    expect(out).not.toContain("message.delta");
  });
});
describe("agent pada run (K4)", () => {
  it("run.started memuat agentId/agentVersion dan model bawaan agent dipakai", async () => {
    const { runId } = await admission("Halo", "");
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const started = await db.taskEvent.findFirstOrThrow({ where: { runId, kind: "run.started" } });
    const data = JSON.parse(started.payloadJson).data as Record<string, unknown>;
    expect(data["agentId"]).toBe("default");
    expect(data["agentVersion"]).toBe(1);
    // modelId run kosong -> model bawaan agent, bukan konstanta global yang lain.
    expect(data["modelId"]).toBe(registry.getAgent("default")!.defaultModelId);

    // Prompt agent ikut terkirim, dan identitas agen lama TIDAK dibuang (R8).
    const body = JSON.stringify(fixture.requests[fixture.requests.length - 1]!.body);
    expect(body).toContain("Kebijakan server".slice(0, 8));
    expect(body).toContain("agen otonom Kawan");
  });

  it("agentId yang sudah tidak ada di registry -> run.failed AGENT_UNKNOWN", async () => {
    const { runId } = await admission("Halo", modelFor("unicode-split"));
    await db.taskRun.update({ where: { id: runId }, data: { agentId: "sudah-dihapus" } });
    const requestsBefore = fixture.requests.length;
    await runTaskRun(db, config(), runId, new AbortController().signal);
    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("failed");
    expect(run.errorCode).toBe("AGENT_UNKNOWN");
    expect(fixture.requests.length).toBe(requestsBefore);
  });
});
