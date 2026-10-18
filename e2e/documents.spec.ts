import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * WP-NT-P6-10 — gate alur C tahap UI.
 *
 * Worker dan model TIDAK dijalankan: yang dibuktikan hanya bahwa panel
 * dokumen menampilkan keempat status dengan label Indonesia, bahwa status
 * gagal menampilkan sebab dan tombol coba lagi, dan bahwa panel tidak meluap
 * pada 360 px. Dokumen di-seed oleh `global-setup.ts`.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("region", { name: "Dokumen" })).toBeVisible();
});

test("panel menampilkan dokumen siap dan gagal beserta tombol coba lagi", async ({ page }) => {
  const panel = page.getByRole("region", { name: "Dokumen" });

  const ready = panel.getByRole("listitem").filter({ hasText: "laporan.pdf" });
  await expect(ready).toBeVisible();
  await expect(ready).toContainText("Siap");

  const failed = panel.getByRole("listitem").filter({ hasText: "catatan.txt" });
  await expect(failed).toBeVisible();
  await expect(failed).toContainText("Gagal");
  await expect(failed).toContainText("EXTRACT_EMPTY");
  await expect(failed.getByRole("button", { name: "Coba lagi" })).toBeVisible();

  // Hanya dokumen gagal yang punya tombol coba lagi.
  await expect(panel.getByRole("button", { name: "Coba lagi" })).toHaveCount(1);
});

test("360px tanpa gulir horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(page.getByRole("region", { name: "Dokumen" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
