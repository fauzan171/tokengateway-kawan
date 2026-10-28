import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * WO-9 — reconnect SSE di tengah run (acceptance WO-10 poin 5).
 *
 * Membuktikan reconnect tidak menggandakan teks maupun aktivitas. Caranya:
 * jalankan agent riset, lalu paksa koneksi stream putus ketika run masih
 * berjalan dengan meng-abort request `.../events`. Server tetap menulis event
 * (worker tidak ikut mati); pengguna menekan "Sambung ulang", halaman memuat
 * ulang snapshot lalu menyambung stream dengan cursor terakhir. Kalau dedup
 * `(runId, seq)` salah, potongan teks/aktivitas muncul dua kali.
 *
 * Beda dari `research.spec.ts` (yang reload SETELAH terminal): di sini putusnya
 * terjadi saat run aktif, jadi jalan replay + cursor benar-benar dipakai.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).not.toHaveURL(/\/(masuk|onboarding)/);
  await page.goto("/tugas");
  await expect(page.getByRole("heading", { level: 1, name: "Tugas" })).toBeVisible();
});

/** Jumlah kemunculan teks (bukan jumlah elemen: dedup harus sampai ke isi). */
async function occurrences(page: Page, text: string): Promise<number> {
  const body = await page.locator("main").innerText();
  return body.split(text).length - 1;
}

test("WO-9: putus SSE di tengah run tidak menggandakan teks atau aktivitas", async ({ page }) => {
  // Run riset butuh beberapa panggilan model + baca halaman; batas bawaan 30 dtk
  // terlalu ketat untuk satu run penuh.
  test.setTimeout(180_000);
  // Putuskan stream pertama: hanya request events yang di-abort, sekali.
  let aborted = 0;
  await page.route("**/runs/*/events*", async (route) => {
    if (aborted === 0) {
      aborted += 1;
      await route.abort("failed");
      return;
    }
    return route.fallback();
  });

  await page.getByLabel("Agent").selectOption("research");
  await page.getByLabel("Tujuan atau lanjutan").fill("WO-9 putus sambung");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();

  // Stream pertama diputus → banner "sambung ulang" muncul (UI tidak
  // menyambung sendiri; pengguna menekan tombol, itu perilaku yang dijanjikan).
  await expect.poll(() => aborted, { timeout: 30_000 }).toBe(1);
  const banner = page.getByTestId("sse-stalled-banner");
  await expect(banner).toBeVisible({ timeout: 30_000 });

  // Sambung ulang: snapshot dimuat ulang lalu stream menyambung dari cursor
  // terakhir; dedup `(runId, seq)` sisi klien yang mencegah penggandaan.
  await banner.getByRole("button", { name: /Sambung ulang/i }).click();

  // Run tetap lanjut di server. Tunggu terminal lewat metering.
  await expect(page.getByTestId("task-metering")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("article").filter({ hasText: "Balasan palsu" }).first()).toBeVisible();

  // Inti acceptance: satu jawaban, satu label sintesis. Hitungan jumlah
  // listitem sengaja tidak dipakai — `PhaseTimeline` sudah memotong ke 3 item
  // secara struktural (`slice(-3)`), jadi `<= 3` tidak bisa gagal.
  expect(await occurrences(page, "Balasan palsu")).toBe(1);
  expect(await occurrences(page, "Menyusun jawaban akhir")).toBe(1);
});