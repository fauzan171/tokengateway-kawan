import { expect, test } from "@playwright/test";

/**
 * WP-NT-P5-01..04, P5-09, P5-10 — render nyata di browser.
 *
 * Memakai halaman publik `/s/[token]` karena menampilkan snapshot yang sama
 * tanpa sesi: markdown, tabel, blok kode, KaTeX, Mermaid, dan HTML mentah.
 * Snapshot di-seed oleh `global-setup.ts` ke database E2E terpisah.
 */

const TOKEN = "e2e-token-render";

test.describe("render snapshot publik", () => {
  test("markdown, kode, matematika, dan mermaid tampil", async ({ page }) => {
    await page.goto(`/s/${TOKEN}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Snapshot render");
    await expect(page.getByRole("heading", { level: 2, name: "Judul" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("pre code").first()).toContainText("const a = 1");
    await expect(page.getByRole("button", { name: "Salin kode" }).first()).toBeVisible();

    // KaTeX benar-benar merender (bukan teks mentah).
    await expect(page.locator(".katex").first()).toBeVisible();
    await expect(page.locator(".katex-display")).toBeVisible();

    // Mermaid menggambar SVG, bukan gagal ke <pre>.
    await expect(page.locator("pre code", { hasText: "graph TD" })).toHaveCount(0);
    await expect(page.locator("svg[id^='mermaid-']")).toBeVisible();
  });

  test("HTML mentah dari model tidak dieksekusi", async ({ page }) => {
    await page.goto(`/s/${TOKEN}`);
    await expect(page.locator("script:has-text('__xss')")).toHaveCount(0);
    await expect(page.locator("img[onerror]")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    // Teksnya tetap terlihat sebagai teks biasa.
    await expect(page.getByText("<script>window.__xss = 1</script>")).toBeVisible();
  });

  test("360px tanpa gulir horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`/s/${TOKEN}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("fokus keyboard terlihat", async ({ page }) => {
    await page.goto(`/s/${TOKEN}`);
    const link = page.getByRole("link", { name: "tautan" });
    await link.focus();
    await expect(link).toBeFocused();
    const outline = await link.evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(outline).not.toBe("0px");
  });
});
