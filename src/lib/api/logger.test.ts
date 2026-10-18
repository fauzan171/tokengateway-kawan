/**
 * Uji kanari redaksi log (REQ-NT-78, SDD-9.3).
 *
 * Kanari = string yang tidak mungkin muncul kebetulan. Setiap kasus memeriksa
 * bahwa kanari hilang dari hasil, sekaligus bahwa isi log yang sah tetap utuh —
 * redaksi berlebihan sama merusaknya dengan kebocoran.
 */

import { describe, expect, it } from "vitest";
import { REDACTED, createLogger, redact } from "./logger";

const CANARY = "sk-canary-0000000000000000deadbeef";

describe("redact — jalur nilai", () => {
  it("mengganti nilai di bawah kunci jinak", () => {
    expect(redact({ note: CANARY })).toEqual({ note: REDACTED });
  });

  it("menangkap kanari di kedalaman tiga", () => {
    const out = redact({ nested: { deep: [{ text: CANARY }] } });
    expect(JSON.stringify(out)).not.toContain(CANARY);
    expect(out).toEqual({ nested: { deep: [{ text: REDACTED }] } });
  });

  it("menyaring pesan galat", () => {
    const out = redact(new Error(`gagal ${CANARY}`)) as { message: string };
    expect(out.message).not.toContain(CANARY);
    expect(out).toEqual({ name: "Error", message: REDACTED });
  });

  it("menangkap kunci gateway dan header Bearer", () => {
    expect(redact({ a: "tk-gw-0000000000000000abcd" })).toEqual({ a: REDACTED });
    expect(redact({ b: "Bearer abcdefghijklmnopqrst" })).toEqual({ b: REDACTED });
  });

  it("mempertahankan Date sebagai ISO, bukan objek kosong", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");
    expect(redact({ createdAt: date })).toEqual({ createdAt: "2026-01-02T03:04:05.000Z" });
  });

  it("tidak pernah menulis isi biner", () => {
    expect(redact({ blob: new Uint8Array([1, 2, 3]) })).toEqual({ blob: REDACTED });
  });

  it("membiarkan teks pengguna biasa", () => {
    expect(redact({ prompt: "ringkas dokumen ini" })).toEqual({ prompt: "ringkas dokumen ini" });
  });

  it("batas pola panjang: 39 karakter lolos, 40 diredaksi", () => {
    const short = "a".repeat(39);
    const long = "a".repeat(40);
    expect(redact({ v: short })).toEqual({ v: short });
    expect(redact({ v: long })).toEqual({ v: REDACTED });
  });
});

describe("createLogger — baris log bersih", () => {
  it("tidak menulis kanari dari field tambahan", () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line));

    log.info(
      {
        requestId: "req_1",
        userId: "usr_1",
        route: "/api/kawan/v1/models",
        latencyMs: 12,
        result: "ok",
      },
      { extra: CANARY, prompt: "ringkas dokumen ini" },
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(CANARY);

    const record = JSON.parse(lines[0] as string);
    expect(record.extra).toBe(REDACTED);
    expect(record.prompt).toBe("ringkas dokumen ini");
    // `time` harus tetap berupa waktu, bukan REDACTED dari cabang objek kosong.
    expect(typeof record.time).toBe("string");
    expect(record.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
