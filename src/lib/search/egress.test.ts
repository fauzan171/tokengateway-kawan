/**
 * Uji egress sanitizer pencarian (WO-B2c). Murni — panggil fungsi nyata.
 */

import { describe, expect, it } from "vitest";
import { sanitizeSearchQuery } from "./egress";

describe("sanitizeSearchQuery", () => {
  it("buang email, sisakan kata lain, redacted > 0", () => {
    const out = sanitizeSearchQuery("hubungi budi@example.com soal harga kopi");
    expect(out.query).not.toContain("budi@example.com");
    expect(out.query).toContain("harga kopi");
    expect(out.redacted).toBeGreaterThan(0);
  });

  it("buang token sk-… dan ghp_…", () => {
    const a = sanitizeSearchQuery("pakai sk-abcdefgh12345678 lalu lanjut");
    expect(a.query).not.toContain("sk-abcdefgh12345678");
    expect(a.redacted).toBe(1);

    const b = sanitizeSearchQuery("token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ya");
    expect(b.query).not.toContain("ghp_");
    expect(b.redacted).toBe(1);
  });

  it("buang nomor telepon Indonesia dan NIK", () => {
    const out = sanitizeSearchQuery("telp 0812-3456-7890 nik 1234567890123456");
    expect(out.query).not.toContain("0812");
    expect(out.query).not.toContain("1234567890123456");
    expect(out.redacted).toBeGreaterThanOrEqual(2);
  });

  it("query normal tidak berubah, redacted === 0", () => {
    const out = sanitizeSearchQuery("harga kopi arabika 2026");
    expect(out.query).toBe("harga kopi arabika 2026");
    expect(out.redacted).toBe(0);
  });

  it("query murni PII → hasil kosong", () => {
    expect(sanitizeSearchQuery("budi@example.com").query).toBe("");
    expect(sanitizeSearchQuery("08123456789").query).toBe("");
  });

  it("URL publik tanpa kredensial tetap utuh", () => {
    const out = sanitizeSearchQuery("lihat https://contoh.id/artikel-harga-kopi");
    expect(out.query).toBe("lihat https://contoh.id/artikel-harga-kopi");
    expect(out.redacted).toBe(0);
  });

  it("kredensial di dalam URL dibuang, host tetap", () => {
    const out = sanitizeSearchQuery("ambil https://user:pass@contoh.id/data");
    expect(out.query).not.toContain("user:pass");
    expect(out.query).toContain("https://contoh.id/data");
    expect(out.redacted).toBeGreaterThan(0);
  });
});