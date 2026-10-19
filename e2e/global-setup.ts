/**
 * Setup global Playwright (WP-NT-P10-05).
 *
 * Urutan: gateway palsu → seed database → worker. Worker wajib hidup karena
 * generasi chat dan ekstraksi dokumen berjalan sebagai job di proses terpisah
 * (`src/worker.ts`); tanpa itu alur B/C tidak akan pernah selesai.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { E2E_AUTH_SECRET, E2E_ENCRYPTION_SECRET, FAKE_GATEWAY_PORT, startFakeGateway } from "./fake-gateway";
import { DB_FILE, seed } from "./seed";

export const STORAGE_DIR = join(process.cwd(), "e2e", ".tmp", "storage");

/** PID worker untuk dimatikan `global-teardown.ts`. */
let worker: ChildProcess | null = null;

/** Env yang sama untuk worker dan (lewat playwright.config.ts) server Next. */
export function e2eEnv(): Record<string, string> {
  return {
    DATABASE_URL: `file:${DB_FILE}`,
    ENCRYPTION_SECRET: E2E_ENCRYPTION_SECRET,
    AUTH_SECRET: E2E_AUTH_SECRET,
    STORAGE_LOCAL_DIR: STORAGE_DIR,
    // Gateway palsu memakai http loopback: kebijakan keluar harus dibuka
    // presisi, bukan dilemahkan global.
    ALLOW_INSECURE_HTTP: "true",
    OUTBOUND_ALLOWLIST: `127.0.0.1:${FAKE_GATEWAY_PORT},127.0.0.1:1`,
  };
}

function startWorker(): Promise<void> {
  const child = spawn("npm", ["run", "worker"], {
    cwd: process.cwd(),
    env: { ...process.env, ...e2eEnv() },
    stdio: ["ignore", "pipe", "pipe"],
    // `npm` adalah induk; SIGTERM ke npm saja meninggalkan `tsx src/worker.ts`
    // yatim yang tetap memegang handle DB lalu memicu `disk I/O error` di run
    // berikutnya. Detach supaya teardown bisa membunuh seluruh grup proses.
    detached: true,
  });
  worker = child;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Worker tidak siap dalam 30 detik.")), 30_000);
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.includes("started")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Worker berhenti sebelum siap (kode ${code}).`));
    });
  });
}

export function workerProcess(): ChildProcess | null {
  return worker;
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(STORAGE_DIR, { recursive: true });
  await startFakeGateway();
  seed();
  await startWorker();
}
