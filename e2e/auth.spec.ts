import { expect, test } from "@playwright/test";

/**
 * WP-NT-P1-03 — halaman `/masuk` dan `/daftar` (REQ-NT-11, SDD-7.2/7.3/7.4/7.6).
 *
 * Cakupan: halaman tampil, validasi klien memakai validator bersama,
 * aksesibilitas (label eksplisit, `aria-describedby`, pengumuman galat),
 * branding, dan tidak ada luapan horizontal pada 320px.
 *
 * Alur login/daftar sungguhan (yang menulis ke basis data) sengaja tidak
 * dijalankan di sini agar uji tidak mengubah data.
 */

const BRAND_URL = "https://tokengateway.ai.id";

test("/masuk menampilkan formulir, branding, dan galat validasi", async ({ page }) => {
  await page.goto("/masuk");

  await expect(page).toHaveTitle("Kawan — Chat AI by tokengateway.ai.id");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Masuk ke Kawan");

  const email = page.getByLabel("Email");
  const password = page.getByLabel("Kata sandi");
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  // Label eksplisit terhubung ke input.
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toHaveAttribute("autocomplete", "current-password");

  // Kirim kosong: galat dari validator bersama tampil dan diumumkan.
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Email wajib diisi.")).toBeVisible();
  await expect(page.getByText("Kata sandi wajib diisi.")).toBeVisible();

  // Fokus dipindah ke bidang pertama yang bermasalah.
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");

  // Galat dihubungkan lewat aria-describedby ke pesan ber-role alert.
  const describedBy = await email.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`#${describedBy}`)).toHaveAttribute("role", "alert");

  // Tautan silang dan branding.
  await expect(page.getByRole("link", { name: "Daftar sekarang" })).toHaveAttribute("href", "/daftar");
  const brand = page.getByRole("link", { name: "by tokengateway.ai.id" });
  await expect(brand).toHaveAttribute("href", BRAND_URL);
  await expect(brand).toHaveAttribute("target", "_blank");
  await expect(brand).toHaveAttribute("rel", "noopener noreferrer");
});

test("/masuk menampilkan pemberitahuan aktivasi setelah pendaftaran", async ({ page }) => {
  await page.goto("/masuk?daftar=berhasil");
  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Pendaftaran berhasil");
  await expect(notice).toContainText("diaktifkan admin");
});

test("/daftar memvalidasi konfirmasi kata sandi dan menautkan ke /masuk", async ({ page }) => {
  await page.goto("/daftar");

  await expect(page).toHaveTitle("Kawan — Chat AI by tokengateway.ai.id");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buat akun Kawan");
  await expect(page.getByLabel("Nama (opsional)")).toBeVisible();
  await expect(page.getByLabel("Ulangi kata sandi")).toBeVisible();

  // Petunjuk dihubungkan lewat aria-describedby.
  const password = page.getByLabel("Kata sandi", { exact: true });
  const hintId = await password.getAttribute("aria-describedby");
  expect(hintId).toBeTruthy();
  await expect(page.locator(`#${hintId}`)).toContainText("Panjang minimal");

  await page.getByLabel("Email").fill("budi@example.com");
  await password.fill("kata-sandi-panjang");
  await page.getByLabel("Ulangi kata sandi").fill("beda");
  await page.getByRole("button", { name: "Daftar" }).click();

  // Aturan kecocokan berasal dari `validateRegister` (satu sumber kebenaran).
  await expect(page.getByText("Kata sandi tidak cocok.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk di sini" })).toHaveAttribute("href", "/masuk");
});

for (const path of ["/masuk", "/daftar"]) {
  test(`${path} tidak meluap pada 320px dan target sentuh >=44px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(path);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const heights = await page
      .locator("form input, form button")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  });
}
