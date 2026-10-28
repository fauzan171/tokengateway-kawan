import { expect, test, type Page } from "@playwright/test";
import { E2E_PASSWORD, ONBOARDING_EMAIL } from "./seed";

/**
 * WO-9 — onboarding end-to-end (acceptance WO-10 poin 6).
 *
 * Memakai pengguna khusus (`ONBOARDING`): seed tidak menulis `UserSetting`
 * untuknya, jadi jawaban onboarding benar-benar kosong dan kartu harus muncul.
 * Pengguna utama sudah punya baris settings dari spec lain, sehingga tidak bisa
 * dipakai untuk membuktikan keadaan "belum dijawab". `E2E_B` juga tidak bisa:
 * `flow-e` menghapusnya, dan kedua spec berjalan paralel di satu DB.
 *
 * Sejak `/tugas` dihapus, satu-satunya tempat kartu fokus hidup adalah
 * `/preferensi`; halaman itu yang dipakai sebagai oracle.
 *
 * Oracles:
 *  - kartu tampil sebelum dijawab, hilang setelah disimpan;
 *  - pilihan bertahan setelah reload (tersimpan di server, bukan state lokal);
 *  - jawaban bisa diubah lagi;
 *  - nilai tersimpan benar-benar sampai ke server (dibaca balik lewat API).
 */

async function login(page: Page): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(ONBOARDING_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).not.toHaveURL(/\/masuk/);
}

test("WO-9: onboarding tersimpan, bertahan setelah reload, dan bisa diubah", async ({ page }) => {
  await login(page);
  await page.goto("/preferensi");

  // Belum dijawab → kartu muncul.
  // `fieldset` mengambil nama aksesibel dari `legend` (judul pertanyaan fokus).
  const card = page.getByRole("group", { name: /fokus pekerjaanmu/i });
  await expect(card).toBeVisible({ timeout: 15_000 });

  // Simpan preset "riset".
  await card.getByRole("radio", { name: /Riset dan rangkuman/i }).check();
  await card.getByRole("button", { name: /simpan/i }).click();

  // Nilai benar-benar ada di server, bukan hanya state lokal.
  await expect
    .poll(async () => {
      const response = await page.evaluate(async () => {
        const r = await fetch("/api/kawan/v1/settings");
        return (await r.json()) as { settings: { onboarding?: string } };
      });
      return response.settings.onboarding;
    })
    .toBe("riset");

  // Reload: nilai tersimpan dimuat balik dari server.
  await page.reload();
  await expect(page.getByRole("radio", { name: /Riset dan rangkuman/i })).toBeChecked({
    timeout: 15_000,
  });

  // Bisa diubah lagi.
  const settingsCard = page.getByRole("group", { name: /fokus pekerjaanmu/i });
  await settingsCard.getByRole("radio", { name: /Analisis data/i }).check();
  await settingsCard.getByRole("button", { name: /simpan/i }).click();
  await expect
    .poll(async () => {
      const response = await page.evaluate(async () => {
        const r = await fetch("/api/kawan/v1/settings");
        return (await r.json()) as { settings: { onboarding?: string } };
      });
      return response.settings.onboarding;
    })
    .toBe("data");
});
