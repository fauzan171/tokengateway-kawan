import { describe, expect, it, vi } from "vitest";
import { ApiError, REQUEST_ID_HEADER, STATUS, errorEnvelope, requestId, toErrorResponse } from "./errors";
import { fetchJson } from "./http";
import { REDACTED, createLogger, redact } from "./logger";

/** Allowlist eksplisit: tes ini menguji penerjemahan galat, bukan resolusi DNS. */
const OUTBOUND = { allowInsecureHttp: false, allowlist: ["api.example.test"] };

const CANARY = "sk-canary-9f3a2b";

describe("redact", () => {
  it("mengganti nilai kunci sensitif apa pun kedalamannya", () => {
    const out = redact({
      apiKey: CANARY,
      nested: { authorization: `Bearer ${CANARY}`, Access_Token: CANARY },
      list: [{ password: CANARY }],
    });
    expect(JSON.stringify(out)).not.toContain(CANARY);
    expect(out).toEqual({
      apiKey: REDACTED,
      nested: { authorization: REDACTED, Access_Token: REDACTED },
      list: [{ password: REDACTED }],
    });
  });

  it("membiarkan field yang tidak sensitif utuh", () => {
    expect(redact({ model: "gpt-4o-mini", count: 3, ok: false })).toEqual({
      model: "gpt-4o-mini",
      count: 3,
      ok: false,
    });
  });

  it("menghentikan objek siklik alih-alih menggantung", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic["self"] = cyclic;
    expect(JSON.stringify(redact(cyclic))).not.toContain(CANARY);
  });
});

describe("createLogger", () => {
  it("menulis JSON satu baris dengan field SDD-8.5 dan tanpa rahasia", () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line));

    log.info(
      { requestId: "req_1", userId: "usr_1", route: "/api/kawan/v1/models", latencyMs: 12, result: "ok" },
      { apiKey: CANARY, secret: CANARY },
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(CANARY);
    expect(lines[0]).not.toContain("\n");

    const record = JSON.parse(lines[0] as string);
    expect(record).toMatchObject({
      level: "info",
      requestId: "req_1",
      userId: "usr_1",
      route: "/api/kawan/v1/models",
      latencyMs: 12,
      result: "ok",
      apiKey: REDACTED,
      secret: REDACTED,
    });
    expect(typeof record.time).toBe("string");
  });
});

describe("requestId", () => {
  it("mengembalikan id baru berbentuk req_", () => {
    expect(requestId()).toMatch(/^req_[0-9a-f]{32}$/);
  });

  it("memakai header masuk yang sah dan menolak yang tidak sah", () => {
    const ok = new Request("https://kawan.test/", { headers: { [REQUEST_ID_HEADER]: "req_abc-123" } });
    expect(requestId(ok)).toBe("req_abc-123");

    for (const forged of ["bukan-prefix", "req_", "req_a b", "req_a;b", "req_" + "a".repeat(65)]) {
      const bad = new Request("https://kawan.test/", { headers: { [REQUEST_ID_HEADER]: forged } });
      expect(requestId(bad)).toMatch(/^req_[0-9a-f]{32}$/);
    }
  });
});

describe("errorEnvelope", () => {
  it("memakai bentuk SDD-3.1 dan menyertakan details hanya bila ada", () => {
    const withDetails = errorEnvelope(
      new ApiError({
        status: STATUS.BAD_GATEWAY,
        code: "CONNECTION_TEST_FAILED",
        message: "Key ditolak oleh gateway. Periksa kembali.",
        details: { upstreamStatus: 401 },
      }),
      "req_abc123",
    );
    expect(withDetails).toEqual({
      error: {
        code: "CONNECTION_TEST_FAILED",
        message: "Key ditolak oleh gateway. Periksa kembali.",
        requestId: "req_abc123",
        retryable: false,
        details: { upstreamStatus: 401 },
      },
    });

    const withoutDetails = errorEnvelope(
      new ApiError({ status: STATUS.NOT_FOUND, code: "NOT_FOUND", message: "Tidak ditemukan." }),
      "req_x",
    );
    expect(withoutDetails.error).not.toHaveProperty("details");
    expect(withoutDetails.error.retryable).toBe(false);
  });

  it("default retryable false; hanya galat transport yang menyalakannya", () => {
    expect(new ApiError({ status: STATUS.BAD_GATEWAY, code: "X", message: "m" }).retryable).toBe(false);
    expect(new ApiError({ status: STATUS.UNAUTHORIZED, code: "X", message: "m" }).retryable).toBe(false);
    expect(new ApiError({ status: STATUS.BAD_GATEWAY, code: "X", message: "m", retryable: true }).retryable).toBe(
      true,
    );
  });
});

describe("toErrorResponse", () => {
  it("meneruskan ApiError apa adanya dan menempelkan X-Request-Id", async () => {
    const response = toErrorResponse(
      new ApiError({ status: STATUS.FORBIDDEN, code: "FORBIDDEN", message: "Izin ditolak." }),
      "req_1",
    );
    expect(response.status).toBe(403);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req_1");
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN", requestId: "req_1" } });
  });

  it("menyembunyikan galat tak dikenal sebagai 500 generik", async () => {
    const response = toErrorResponse(new Error(`bocor ${CANARY}`), "req_2");
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain(CANARY);
    expect(JSON.parse(body)).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });
});

describe("fetchJson", () => {
  it("menolak alamat metadata dan rentang privat sebelum keluar jaringan", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:8080/v1/models",
      "http://localhost:3000/v1",
      "http://10.1.2.3/v1",
      "http://192.168.1.5/v1",
      "http://172.16.0.1/v1",
      "file:///etc/passwd",
    ]) {
      await expect(fetchJson(url)).rejects.toMatchObject({ status: STATUS.UNPROCESSABLE, code: "BAD_URL" });
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("menerjemahkan timeout menjadi 504 dan balasan rusak menjadi 502", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    spy.mockRejectedValueOnce(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    await expect(fetchJson("https://api.example.test/v1/models", { outbound: OUTBOUND })).rejects.toMatchObject({
      status: STATUS.GATEWAY_TIMEOUT,
      code: "UPSTREAM_TIMEOUT",
    });

    spy.mockResolvedValueOnce(new Response("<html>bukan json</html>", { status: 200 }));
    await expect(fetchJson("https://api.example.test/v1/models", { outbound: OUTBOUND })).rejects.toMatchObject({
      status: STATUS.BAD_GATEWAY,
      code: "UPSTREAM_BAD_RESPONSE",
      details: { upstreamStatus: 200 },
    });
    spy.mockRestore();
  });

  it("mengembalikan status dan data apa adanya saat balasan sah", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    spy.mockResolvedValueOnce(Response.json({ data: [{ id: "gpt-4o-mini" }] }, { status: 200 }));
    await expect(fetchJson("https://api.example.test/v1/models", { outbound: OUTBOUND })).resolves.toEqual({
      status: 200,
      data: { data: [{ id: "gpt-4o-mini" }] },
    });
    spy.mockRestore();
  });
});
