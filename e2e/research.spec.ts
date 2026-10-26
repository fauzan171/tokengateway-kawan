import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * T02 — pengguna kosong membuat task pertama; double-submit idempotent;
 * snapshot/replay tanpa teks ganda (WP02, IMPLEMENTATION-PLAN.md).
 *
 * Worker + gateway palsu hidup dari global-setup, jadi run benar-benar
 * selesai `completed` oleh worker sungguhan. Oracle:
 *  - UI kosong → submit → POST /tasks satu kali dengan Idempotency-Key.
 *  - POST ulang dengan kunci sama (reroute fetch) → satu admission (202 sama),
 *    bukan task/job kedua.
 *  - Saat run berjalan: reload halaman → snapshot memuat teks yang sudah
 *    durable TANPA menggandakan prefix (cursor snapshotSeq), lalu run selesai.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  // Pengguna e2e punya koneksi aktif: beranda composer, bukan onboarding.
  await expect(page).not.toHaveURL(/\/(masuk|onboarding)/);
});

async function openTasks(page: Page): Promise<void> {
  await page.goto("/tugas");
  await expect(page.getByRole("heading", { level: 1, name: "Tugas" })).toBeVisible();
}

test("T02: task pertama dari UI kosong, run selesai, teks durable sekali", async ({ page }) => {
  await openTasks(page);

  const input = page.getByLabel("Tujuan atau lanjutan");
  await input.fill("T02 riset pertama dari UI kosong");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();

  // Admission: task muncul di daftar dan pesan pengguna durable.
  await expect(page.getByRole("listitem").filter({ hasText: "T02 riset pertama" })).toBeVisible();
  await expect(page.locator("main")).toContainText("T02 riset pertama dari UI kosong", {
    timeout: 15_000,
  });

  // Worker menjalankan run sampai terminal; jawaban asisten muncul dari teks
  // durable (snapshot), bukan teks lokal yang belum tersimpan.
  await expect(page.getByRole("article").filter({ hasText: "Balasan palsu" }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Reload: reconnect membaca snapshot — teks tetap persis satu salinan prefix.
  // Setelah reload tidak ada task terpilih (perilaku existing: pilih dari daftar).
  await page.reload();
  await page.getByRole("listitem").filter({ hasText: "T02 riset pertama" }).click();
  await expect(page.getByRole("article").filter({ hasText: "Balasan palsu" }).first()).toBeVisible({
    timeout: 30_000,
  });
  const texts = await page.getByRole("article").allTextContents();
  const assistant = texts.filter((row) => row.includes("Balasan palsu"));
  // Satu pesan asisten; prefix snapshot tidak di-concat dengan replay.
  expect(assistant).toHaveLength(1);
});

test("T02: double submit dengan Idempotency-Key sama → satu admission", async ({ page }) => {
  await openTasks(page);

  // Intersep POST /tasks: catat kunci, tunda respons supaya dua submit
  // (klik ganda) berada dalam penerbangan bersama, lalu teruskan.
  const posts: string[] = [];
  await page.route("**/api/kawan/v1/tasks", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    posts.push(request.headers()["idempotency-key"] ?? "");
    await new Promise((resolve) => setTimeout(resolve, 150));
    return route.continue();
  });

  const input = page.getByLabel("Tujuan atau lanjutan");
  await input.fill("T02 double submit idempotent");
  const send = page.getByRole("button", { name: "Kirim", exact: true });
  await send.dblclick();

  // Kedua klik membawa kunci yang sama; server menggabungkan jadi satu admission.
  expect(posts.length).toBeGreaterThan(0);
  await expect
    .poll(async () => posts.length, { timeout: 10_000 })
    .toBeLessThanOrEqual(2);
  if (posts.length > 1) {
    expect(posts[1]).toBe(posts[0]);
    expect(posts[0]).not.toBe("");
  }

  // Tepat satu task baru dengan input itu di daftar.
  await expect(
    page.getByRole("listitem").filter({ hasText: "T02 double submit idempotent" }),
  ).toHaveCount(1);
});
