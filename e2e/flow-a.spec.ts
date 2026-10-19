import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * Alur A (PRD 293–301): daftar → onboarding "Hubungkan Gateway" → uji
 * koneksi → simpan → kirim pesan pertama.
 *
 * Akun baru berstatus `pending` (mode tanpa SMTP), jadi aktivasi admin ikut
 * dijalankan lewat UI admin — persis yang dilakukan operator sungguhan.
 */

const BARU_EMAIL = "baru@example.com";
const GATEWAY = "http://127.0.0.1:3199/v1";

test.setTimeout(90_000);

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function testConnection(page: Page, baseUrl: string, apiKey: string): Promise<void> {
  await page.goto("/onboarding");
  await page.getByLabel("Nama koneksi").fill("Gateway palsu");
  await page.getByLabel("Base URL").fill(baseUrl);
  await page.locator('input[name="apiKey"]').fill(apiKey);
  await page.getByRole("button", { name: "Test koneksi" }).click();
}

test("A: daftar, aktivasi admin, hubungkan gateway, kirim pesan", async ({ page, browser }) => {
  // 1. Daftar lewat UI.
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(BARU_EMAIL);
  await page.getByLabel("Nama (opsional)").fill("Pengguna Baru");
  await page.getByLabel("Kata sandi", { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel("Ulangi kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page).toHaveURL(/\/masuk\?daftar=berhasil/);
  await expect(page.getByRole("status")).toContainText("diaktifkan admin");

  // 2. Admin mengaktifkan akun baru (UI admin + API yang dipakai UI itu).
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await login(adminPage, ADMIN_EMAIL);
  // Admin juga belum punya koneksi → diarahkan ke onboarding; sesi sudah sah.
  await expect(adminPage).toHaveURL(/\/onboarding$/);

  const users = (await (await admin.request.get("/api/kawan/v1/admin/users")).json()) as {
    users: { id: string; email: string }[];
  };
  const baru = users.users.find((item) => item.email === BARU_EMAIL);
  expect(baru).toBeTruthy();
  const patch = await admin.request.patch(`/api/kawan/v1/admin/users/${baru!.id}`, {
    data: { status: "active" },
  });
  expect(patch.ok()).toBe(true);
  await admin.close();

  // 3. Masuk sebagai pengguna baru → onboarding.
  await login(page, BARU_EMAIL);
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Hubungkan Gateway" })).toBeVisible();

  // 4. Uji koneksi ke gateway palsu → 2 model.
  await page.getByLabel("Nama koneksi").fill("Gateway palsu");
  await page.getByLabel("Base URL").fill(GATEWAY);
  await page.locator('input[name="apiKey"]').fill("kunci-palsu");
  await page.getByRole("button", { name: "Test koneksi" }).click();
  await expect(page.getByRole("status")).toContainText("Koneksi berhasil. 2 model tersedia.");
  await expect(page.getByRole("status")).toContainText("palsu-kecil");

  // 5. Simpan → composer aktif → pesan pertama mengalir.
  await page.getByRole("button", { name: "Simpan" }).click();
  const composer = page.getByPlaceholder(/Tulis pesan/);
  await expect(composer).toBeVisible();
  await composer.fill("Halo dari alur A");
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByRole("log")).toContainText("Balasan palsu", { timeout: 20_000 });
});

test("A: tiga keadaan gagal uji koneksi", async ({ page }) => {
  await login(page, "e2e@example.com");
  await expect(page.getByRole("region", { name: "Dokumen" })).toBeVisible();

  // 401 dari gateway.
  await testConnection(page, GATEWAY, "kunci-ditolak");
  await expect(page.getByRole("status")).toContainText("Key ditolak oleh gateway.");

  // Timeout: gateway palsu menggantung pada path /v1-lambat (batas 15 detik).
  await testConnection(page, "http://127.0.0.1:3199/v1-lambat", "kunci-palsu");
  await expect(page.getByRole("status")).toContainText("Gateway tidak merespons.", { timeout: 25_000 });

  // DNS: nama tidak ada. `fetchJson` merangkum galat transport, jadi pesan
  // yang benar-benar tampil "Koneksi terputus." — lihat catatan di e2e/README.
  await testConnection(page, "http://tidak-ada.invalid/v1", "kunci-palsu");
  await expect(page.getByRole("status")).toContainText("Koneksi terputus.");
});
