import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, E2E_B_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * Alur E (PRD 328–331): admin membuka panel, menghapus pengguna, dan seluruh
 * data pribadinya ikut hilang — login berikutnya gagal, tautan berbagi 404.
 */

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("E: admin menghapus pengguna, data pribadinya ikut hilang", async ({ page, browser }) => {
  // Bukti awal: tautan milik pengguna kedua masih hidup.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  expect((await anonPage.goto("/s/e2e-token-b"))?.status()).toBe(200);

  // Admin menghapus lewat UI.
  await login(page, ADMIN_EMAIL);
  await page.goto("/admin");
  const row = page.getByRole("row").filter({ hasText: E2E_B_EMAIL });
  await expect(row).toBeVisible();

  const dialog = page.waitForEvent("dialog");
  await row.getByRole("button", { name: "Hapus" }).click();
  const confirm = await dialog;
  expect(confirm.message()).toContain(`Hapus ${E2E_B_EMAIL}`);
  expect(confirm.message()).toContain("seluruh data pribadinya");
  expect(confirm.message()).toContain("tidak dapat dibatalkan");
  await confirm.accept();

  await expect(page.getByRole("row").filter({ hasText: E2E_B_EMAIL })).toHaveCount(0);

  // Pengguna terhapus tidak bisa masuk lagi.
  const victim = await browser.newContext();
  const victimPage = await victim.newPage();
  await login(victimPage, E2E_B_EMAIL);
  await expect(victimPage.getByRole("alert")).toContainText("tidak cocok");
  await victim.close();

  // Tautan berbagi miliknya ikut 404.
  expect((await anonPage.goto("/s/e2e-token-b"))?.status()).toBe(404);
  await anon.close();
});
