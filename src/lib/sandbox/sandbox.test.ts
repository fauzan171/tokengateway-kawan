/**
 * FIX-17: kontrak sandbox, klasifikasi aksi browser, approval digest, akses perangkat.
 *
 * Tidak ada provider live di mesin ini; yang diuji adalah kontrak yang harus
 * dipenuhi adapter dan batas yang tidak boleh dilonggarkan.
 */

import { describe, expect, it } from "vitest";

const {
  SANDBOX_LIMITS,
  SandboxUnavailable,
  approvalDigest,
  assertSafeOutputPath,
  classifyBrowserAction,
  truncateOutput,
} = await import("./contract");
const { readSandboxConfig, createSandboxRuntime } = await import("./e2b");
const {
  DEVICE_PLANS,
  SCREEN_SHARE_LIMITS,
  coarsenLocation,
  isDeviceSupported,
  minimalUserAgent,
} = await import("./device");

describe("limit sandbox", () => {
  it("angka desain SDD-AG-5 dipertahankan", () => {
    expect(SANDBOX_LIMITS.cpu).toBe(1);
    expect(SANDBOX_LIMITS.memoryMiB).toBe(1024);
    expect(SANDBOX_LIMITS.runTimeoutMs).toBe(15 * 60_000);
    expect(SANDBOX_LIMITS.commandTimeoutMs).toBe(60_000);
  });
});

describe("truncateOutput", () => {
  it("memotong pada batas karakter, bukan tengah UTF-8", () => {
    const text = "aaaa" + "é".repeat(10);
    // 5 byte memotong 'é' (2 byte) di tengah: hasilnya harus tetap teks sah.
    const result = truncateOutput(text, 5);
    expect(result.truncated).toBe(true);
    expect(result.text).toBe("aaaa");
    expect(result.text).not.toContain("\ufffd");
  });

  it("teks pendek tidak berubah", () => {
    expect(truncateOutput("halo", 100)).toEqual({ text: "halo", truncated: false });
  });
});

describe("assertSafeOutputPath", () => {
  it("menerima path di output/", () => {
    expect(assertSafeOutputPath("output/hasil.csv")).toBe("output/hasil.csv");
    expect(assertSafeOutputPath("./output/a.png")).toBe("output/a.png");
  });

  it("menolak traversal, absolut, dan luar output/", () => {
    for (const bad of ["../etc/passwd", "output/../../etc", "/etc/passwd", "input/a.txt", "output/a\0b"]) {
      expect(() => assertSafeOutputPath(bad)).toThrow(SandboxUnavailable);
    }
  });
});

describe("classifyBrowserAction", () => {
  it("GET biasa tanpa body/gesture tulis → read", () => {
    expect(classifyBrowserAction({ method: "GET", url: "https://contoh.test/artikel" })).toBe("read");
    expect(classifyBrowserAction({ method: "HEAD", url: "https://contoh.test/a" })).toBe("read");
  });

  it("GET berpola perubahan tetap write", () => {
    for (const url of [
      "https://contoh.test/hapus?delete=1",
      "https://contoh.test/publish/post",
      "https://contoh.test/checkout",
      "https://contoh.test/logout",
    ]) {
      expect(classifyBrowserAction({ method: "GET", url })).toBe("write");
    }
  });

  it("method selain GET/HEAD, body, atau gesture tulis → write", () => {
    expect(classifyBrowserAction({ method: "POST", url: "https://a.test/x" })).toBe("write");
    expect(classifyBrowserAction({ method: "GET", url: "https://a.test/x", body: "{}" })).toBe("write");
    expect(
      classifyBrowserAction({ method: "GET", url: "https://a.test/x", gesture: "click" }),
    ).toBe("write");
  });

  it("URL relatif/tak lengkap tidak menjatuhkan klasifikasi", () => {
    expect(classifyBrowserAction({ method: "GET", url: "/artikel" })).toBe("read");
    expect(classifyBrowserAction({ method: "GET", url: "/delete/1" })).toBe("write");
  });
});

describe("approvalDigest", () => {
  const base = {
    runId: "run_1",
    stepId: "step_1",
    method: "POST",
    url: "https://contoh.test/kirim?b=2&a=1",
    body: '{"x":1}',
    policyRevision: 3,
  };

  it("deterministik dan tidak terpengaruh urutan query", () => {
    expect(approvalDigest(base)).toBe(approvalDigest(base));
    expect(approvalDigest({ ...base, url: "https://contoh.test/kirim?a=1&b=2" })).toBe(
      approvalDigest(base),
    );
  });

  it("perubahan body/target/revisi kebijakan membatalkan approval", () => {
    const original = approvalDigest(base);
    expect(approvalDigest({ ...base, body: '{"x":2}' })).not.toBe(original);
    expect(approvalDigest({ ...base, url: "https://contoh.test/kirim?a=1&b=3" })).not.toBe(original);
    expect(approvalDigest({ ...base, method: "GET" })).not.toBe(original);
    expect(approvalDigest({ ...base, policyRevision: 4 })).not.toBe(original);
    expect(approvalDigest({ ...base, stepId: "step_2" })).not.toBe(original);
  });
});

describe("konfigurasi sandbox", () => {
  it("tanpa E2B_API_KEY → null, bukan konfigurasi setengah jadi", () => {
    expect(readSandboxConfig({})).toBeNull();
    expect(readSandboxConfig({ E2B_API_KEY: "k" })).toBeNull();
    expect(readSandboxConfig({ E2B_API_KEY: "k", E2B_TEMPLATE_CODE: "t" })).toBeNull();
  });

  it("lengkap → objek konfigurasi", () => {
    expect(
      readSandboxConfig({
        E2B_API_KEY: "k",
        E2B_TEMPLATE_CODE: "code-v1",
        E2B_TEMPLATE_BROWSER: "browser-v1",
      }),
    ).toEqual({ apiKey: "k", templateCode: "code-v1", templateBrowser: "browser-v1" });
  });

  it("createSandboxRuntime tanpa konfigurasi → SandboxUnavailable, bukan adapter", () => {
    expect(() => createSandboxRuntime(null)).toThrow(SandboxUnavailable);
    try {
      createSandboxRuntime(null);
    } catch (err) {
      expect((err as InstanceType<typeof SandboxUnavailable>).reason).toBe("SANDBOX_NOT_CONFIGURED");
    }
  });
});

describe("akses perangkat", () => {
  it("setiap izin punya alasan dan fallback yang jelas", () => {
    for (const plan of Object.values(DEVICE_PLANS)) {
      expect(plan.reason.length).toBeGreaterThan(10);
      expect(plan.fallback.length).toBeGreaterThan(5);
    }
  });

  it("dukungan API dibedakan dari izin", () => {
    const noMedia = { hasMediaDevices: false, hasNotifications: false, hasGeolocation: false };
    expect(isDeviceSupported("microphone", noMedia)).toBe(false);
    expect(isDeviceSupported("notifications", noMedia)).toBe(false);
    expect(isDeviceSupported("geolocation", noMedia)).toBe(false);
    // Clipboard dianggap ada; kegagalan runtime jatuh ke fallback manual.
    expect(isDeviceSupported("clipboard-write", noMedia)).toBe(true);
  });

  it("geolokasi hanya kota/negara, koordinat tidak diteruskan", () => {
    const coarse = coarsenLocation({
      latitude: -6.2088,
      longitude: 106.8456,
      city: "Jakarta",
      country: "Indonesia",
    });
    expect(coarse).toEqual({ city: "Jakarta", country: "Indonesia" });
    expect(JSON.stringify(coarse)).not.toContain("-6.2");
  });

  it("User-Agent minimum tanpa versi/OS", () => {
    expect(
      minimalUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.1 Safari/537"),
    ).toBe("Chrome");
    expect(minimalUserAgent("Mozilla/5.0 (X11; Linux) Firefox/121.0")).toBe("Firefox");
    expect(minimalUserAgent("sesuatu")).toBe("browser lain");
  });

  it("batas berbagi layar masuk akal dan bukan perekam video", () => {
    expect(SCREEN_SHARE_LIMITS.maxFps).toBeLessThanOrEqual(10);
    expect(SCREEN_SHARE_LIMITS.maxDurationSeconds).toBeLessThanOrEqual(600);
    expect(SCREEN_SHARE_LIMITS.maxWidth).toBeLessThanOrEqual(1920);
  });
});
