import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * WO-9 — loop riset end-to-end (acceptance WO-10 poin 1).
 *
 * Yang dibuktikan di sini BUKAN unit: agent `research` benar-benar dipilih di UI,
 * worker menjalankan `runResearchRun` di proses terpisah, chain pencarian
 * memakai provider `direct` untuk membaca halaman bukti dari gateway palsu
 * lewat allowlist egress, lalu UI menampilkan sumber (B2d) dan metering (D6).
 *
 * Oracles:
 *  - jawaban asisten berisi kalimat sintesis, bukan teks framing;
 *  - blok `task-sources` muncul dengan tautan ke halaman bukti;
 *  - blok `task-metering` muncul setelah run terminal;
 *  - timeline aktivitas memuat minimal satu langkah `succeeded`.
 *
 * Catatan: provider tavily/jina tidak pernah siap di sini (tanpa key), jadi
 * chain jatuh ke `direct` — jalur failover nyata tanpa jaringan keluar.
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

/** Pilih agent riset di pemilih agent, lalu kirim satu tujuan. */
async function submitResearch(page: Page, goal: string): Promise<void> {
  await page.getByLabel("Agent").selectOption("research");
  await page.getByLabel("Tujuan atau lanjutan").fill(goal);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
}

test("WO-9: agent riset menyelesaikan run, menampilkan sumber dan metering", async ({ page }) => {
  await submitResearch(page, "WO-9 riset margin kuartal ini");

  // Label agent aktif membuktikan agentId benar-benar beku di run.
  await expect(page.getByTestId("task-agent-label")).toContainText("Riset Kawan");

  // Run terminal: metering hanya dirender setelah run selesai.
  await expect(page.getByTestId("task-metering")).toBeVisible({ timeout: 60_000 });

  // Sumber: provider `direct` membaca halaman bukti dari gateway palsu.
  const sources = page.getByTestId("task-sources");
  await expect(sources).toBeVisible();
  await expect(sources.getByRole("link")).toHaveCount(1);

  // Teks jawaban berasal dari fase sintesis, bukan JSON framing.
  const answer = page.getByRole("article").filter({ hasText: "Balasan palsu" }).first();
  await expect(answer).toBeVisible();
  await expect(answer).not.toContainText("queries");
});

test("WO-9: aktivitas per langkah memuat fase yang selesai, bukan gagal", async ({ page }) => {
  await submitResearch(page, "WO-9 aktivitas langkah riset");

  // Timeline tampil sejak langkah pertama, sedangkan label sintesis baru
  // ditambahkan di akhir run. Tunggu terminal dulu (metering hanya dirender
  // setelah itu), kalau tidak assertion balapan dengan worker.
  await expect(page.getByTestId("task-metering")).toBeVisible({ timeout: 60_000 });

  const activity = page.getByTestId("task-activity");
  await expect(activity).toBeVisible();
  // Timeline sengaja hanya menampilkan 3 langkah terakhir (thinking-indicator.tsx);
  // fase awal (framing) sudah tergeser. Label datang dari server, bukan model.
  await expect(activity).toContainText("Menyusun jawaban akhir");
  await expect(activity).not.toContainText("gagal");
});