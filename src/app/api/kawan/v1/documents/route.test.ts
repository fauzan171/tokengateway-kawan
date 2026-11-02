import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";

const state = vi.hoisted(() => ({
  userId: "",
  config: null as unknown as Config,
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => (state.userId ? { user: { id: state.userId } } : null),
}));

vi.mock("@/lib/config/env", () => ({
  loadConfig: () => state.config,
}));

vi.mock("@/lib/api/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  redact: (v: unknown) => v,
  REDACTED: "[REDACTED]",
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

const { GET, POST } = await import("./route");

let temp: TempDb;
let db: Db;
const storageDir = mkdtempSync(join(tmpdir(), "kawan-route-doc-"));
process.env.STORAGE_LOCAL_DIR = storageDir;

afterAll(() => {
  rmSync(storageDir, { recursive: true, force: true });
});

function makeConfig(): Config {
  return {
    databaseUrl: `file:${temp.file}`,
    encryptionKey: Buffer.alloc(32, 7),
    encryptionKeyId: "v1",
    authSecret: "rahasia-sesi-uji",
    loginRateLimitMax: 5,
    loginRateLimitWindowSeconds: 900,
    passwordResetTtlSeconds: 3600,
    emailConfigured: false,
    modelCacheTtlSeconds: 600,
    outboundAllowlist: [],
    allowInsecureHttp: false,
    maxUploadBytes: 10 * 1024 * 1024,
  } as Config;
}

function multipartRequest(file?: { name: string; type: string; data: string }): Request {
  const form = new FormData();
  if (file) {
    form.set("file", new File([file.data], file.name, { type: file.type }));
  }
  return new Request("http://localhost/api/kawan/v1/documents", {
    method: "POST",
    body: form,
  });
}

describe("GET & POST /api/kawan/v1/documents (U-01/U-02/U-04)", () => {
  beforeEach(async () => {
    temp = await createTempDb();
    db = temp.db;
    state.config = makeConfig();
    state.userId = "user_doc_1";
    await db.user.create({
      data: { id: state.userId, email: "doc@contoh.test", name: "Doc Tester" },
    });
  });

  it("POST valid pdf: 201 + dokumen + terdaftar di GET", async () => {
    const res = await POST(
      multipartRequest({ name: "laporan.pdf", type: "application/pdf", data: "%PDF-1.4\n%" }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { document: { id: string; filename: string; status: string } };
    expect(body.document.filename).toBe("laporan.pdf");
    expect(body.document.status).toBe("queued");

    const list = await GET(new Request("http://localhost/api/kawan/v1/documents"));
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { documents: Array<{ id: string }> };
    expect(listed.documents.some((d) => d.id === body.document.id)).toBe(true);
  });

  it("POST tanpa field file: 400 INVALID_UPLOAD", async () => {
    const res = await POST(multipartRequest());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_UPLOAD");
  });

  it("POST mime tidak diizinkan: 415 UNSUPPORTED_MEDIA_TYPE", async () => {
    const res = await POST(
      multipartRequest({ name: "virus.exe", type: "application/x-msdownload", data: "MZ" }),
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});
