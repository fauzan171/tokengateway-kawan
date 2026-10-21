import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "./helpers/auth-db";

let child: ChildProcess | undefined;
let temp: TempDb | undefined;
afterEach(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
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
  await vi.waitFor(() => expect(output).toContain('"result":"started"'), { timeout: 10_000 });
  await Promise.race([delay(31_000), exited]);
  expect(output).toContain('"result":"started"');
  expect(child.exitCode).toBeNull();
  child.kill("SIGTERM");
  const [code, signal] = await exited;
  expect({ code, signal }).toEqual({ code: 0, signal: null });
}, 40_000);
