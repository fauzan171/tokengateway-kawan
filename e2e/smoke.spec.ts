import { expect, test } from "@playwright/test";

/**
 * Beranda: shell aplikasi (sidebar, header) dan tema tersimpan.
 *
 * Sejak NT-P4 beranda membuka bagian **chat**, bukan halaman "Ide besar" lagi;
 * penanda halaman yang stabil adalah navigasi samping + empty state composer.
 * Snapshot gambar dihapus: tata letak chat berubah setiap ada WP UI baru.
 */

test("beranda, navigasi, dan tema tersimpan", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Kawan — Chat AI by tokengateway.ai.id");
  // Di layar sempit sidebar jadi drawer, jadi navigasi dijangkau lewat tombol
  // "Buka menu" — keduanya sah, yang penting navigasi terjangkau.
  const menu = page.getByRole("button", { name: "Buka menu" });
  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  if (await menu.isVisible()) await menu.click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Mulai percakapan/ })).toBeVisible();

  await page.getByRole("button", { name: "Pengaturan", exact: true }).click();
  await page.getByLabel("Tema tampilan").selectOption("dark");
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  // Muat ulang menutup drawer, jadi buka lagi sebelum menavigasi.
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Pengaturan", exact: true }).click();
  await page.getByLabel("Tema tampilan").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
});

for (const width of [360, 1440]) {
  test(`layout ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: /Mulai percakapan/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 360) {
      const trigger = page.getByRole("button", { name: "Buka menu" });
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  });
}
