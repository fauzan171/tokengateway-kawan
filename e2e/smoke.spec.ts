import { expect, test } from "@playwright/test";
import { login } from "./seed";

/**
 * Beranda: shell aplikasi (sidebar, header) dan tema tersimpan.
 *
 * Sejak NT-P4 beranda membuka bagian **chat**, bukan halaman "Ide besar" lagi;
 * penanda halaman yang stabil adalah navigasi samping + empty state composer.
 * Snapshot gambar dihapus: tata letak chat berubah setiap ada WP UI baru.
 */

test("beranda, navigasi, dan tema tersimpan", async ({ page }) => {
  await login(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Kawan — Chat AI by tokengateway.ai.id");
  // Di layar sempit sidebar jadi drawer, jadi navigasi dijangkau lewat tombol
  // "Buka menu" — keduanya sah, yang penting navigasi terjangkau.
  // Navigasi samping utama = "Riwayat percakapan" (nav.account "Akun" ada di footer).
  const menu = page.getByRole("button", { name: "Buka menu" });
  const nav = page.getByRole("navigation", { name: "Riwayat percakapan" });
  if (await menu.isVisible()) await menu.click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mau dibantu agen yang mana?" })).toBeVisible();

  // Navigasi ke Preferensi langsung dari beranda (dulu lewat /pengaturan,
  // tapi setelah redesign tautan akun dipindah ke halaman pengaturan — uji
  // tema harus tetap membuktikan persistensi tanpa bergantung struktur nav).
  await page.goto("/preferensi");
  await page.getByLabel("Tema tampilan").selectOption("dark");
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByLabel("Tema tampilan").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
});

for (const width of [360, 1440]) {
  test(`layout ${width}px`, async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Mau dibantu agen yang mana?" })).toBeVisible();
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
