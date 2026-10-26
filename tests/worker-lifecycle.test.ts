import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTempDb, type TempDb } from "./helpers/auth-db";
import { startProviderFixture, modelFor, type ProviderFixture } from "./fixtures/provider-server";
import { createTask } from "@/lib/tasks/tasks";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret } from "@/lib/secrets";
import type { Db } from "@/lib/db";

let child: ChildProcess | undefined;
let temp: TempDb | undefined;
let provider: ProviderFixture | undefined;
afterEach(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
  await provider?.close();
  provider = undefined;
  await temp?.cleanup();
});

it("worker idle tetap hidup setelah 30 detik dan dapat shutdown dengan SIGTERM", async () => {
  temp = await createTempDb();
  child = spawn(process.execPath, ["--import", "tsx", "src/worker.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: `file:${temp.file}`,
      AUTH_SECRET: "worker-lifecycle-test",
      ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString("base64"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  let output = "";
  child.stdout?.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr?.resume();
  // Startup tsx bisa lambat saat suite berjalan paralel (109 berkas); 10 detik
  // terlalu ketat dan menghasilkan kegagalan jadwal, bukan kegagalan worker.
  await vi.waitFor(() => expect(output).toContain('"result":"started"'), { timeout: 60_000 });
  await Promise.race([delay(31_000), exited]);
  expect(output).toContain('"result":"started"');
  expect(child.exitCode).toBeNull();
  child.kill("SIGTERM");
  const [code, signal] = await exited;
  expect({ code, signal }).toEqual({ code: 0, signal: null });
  // Uji ini memang menunggu 30 detik diam + startup tsx. Batas 40 detik terlalu
  // ketat saat suite berjalan paralel (105 berkas): kegagalannya soal jadwal
  // mesin, bukan perilaku worker. Longgarkan tanpa mengubah assertion.
}, 120_000);

it("SIGTERM saat run stream menggantung → run indeterminate dan worker keluar 0", async () => {
  temp = await createTempDb();
  provider = await startProviderFixture();
  const db: Db = temp.db;
  const userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  const connectionId = randomUUID();
  await db.connection.create({
    data: {
      id: connectionId,
      userId,
      name: "gateway uji",
      baseUrl: provider.baseUrl,
      apiKeyEncrypted: encryptSecret({
        plaintext: "kunci-uji",
        key: Buffer.alloc(32, 7),
        keyId: "v1",
        aad: { rowId: connectionId, userId, purpose: CONNECTION_API_KEY_PURPOSE },
      }),
      apiKeyMask: "kunci-****",
      keyId: "v1",
      isActive: 1,
      status: "active",
    },
  });
  const { runId } = await createTask(db, {
    userId,
    input: "Halo",
    modelId: modelFor("timeout"),
    idempotencyKey: null,
  });

  const port = new URL(provider.baseUrl).port;
  child = spawn(process.execPath, ["--import", "tsx", "src/worker.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: `file:${temp.file}`,
      AUTH_SECRET: "worker-lifecycle-test",
      ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString("base64"),
      ALLOW_INSECURE_HTTP: "true",
      OUTBOUND_ALLOWLIST: `127.0.0.1:${port}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  child.stdout?.resume();
  child.stderr?.resume();

  // Tunggu run benar-benar streaming (delta pertama durable) sebelum shutdown.
  await vi.waitFor(
    async () => {
      expect(await db.taskEvent.findFirst({ where: { runId, kind: "message.delta" } })).not.toBeNull();
    },
    { timeout: 60_000 },
  );

  const t0 = Date.now();
  child.kill("SIGTERM");
  const [code, signal] = (await Promise.race([
    exited,
    delay(30_000).then(() => [null, null] as const),
  ])) as [number | null, string | null];

  // Shutdown sopan: keluar normal tanpa menunggu force-exit 30 detik.
  expect({ code, signal }).toEqual({ code: 0, signal: null });
  expect(Date.now() - t0).toBeLessThan(15_000);

  // T01/D03: stop ambigu → run indeterminate (bukan menggantung di "running").
  const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
  expect(run.status).toBe("indeterminate");
  expect(run.errorCode).toBe("RUN_ABORTED");
  const job = await db.job.findFirst({ where: { id: run.currentJobId ?? "" } });
  expect(job?.state).toBe("indeterminate");
  const rows = await db.taskEvent.findMany({ where: { runId }, orderBy: { seq: "desc" }, take: 1 });
  expect(rows[0]!.kind).toBe("run.indeterminate");
}, 180_000);
