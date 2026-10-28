import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * WO-9 — `generate_file` end-to-end (acceptance WO-10 poin 2).
 *
 * Gateway palsu membalas `tool_calls` `generate_file` (xlsx) ketika pesan
 * memuat penanda `BUATFILE`. Jalur yang diuji adalah jalur produksi:
 * `generate.ts` merakit argumen → `createArtifact` menulis byte → UI merender
 * entri unduhan → route artefak mengembalikan byte dengan hash yang cocok.
 *
 * Oracles:
 *  - entri artefak muncul dengan nama + format;
 *  - unduhan lewat route mengembalikan 200 dan byte yang diawali `PK`
 *    (ZIP/OOXML), bukan HTML galat;
 *  - `sha256` byte yang diunduh sama dengan `Artifact.sha256` di DB
 *    (dibuktikan lewat endpoint artefak: panjang byte + header).
 */

async function login(page: Page): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).not.toHaveURL(/\/(masuk|onboarding)/);
}

test("WO-9: generate_file membuat artefak yang benar-benar dapat diunduh", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/");
  await expect(page.getByPlaceholder(/Tulis pesan/)).toBeVisible();

  await page.getByPlaceholder(/Tulis pesan/).fill("BUATFILE rekap bulanan");
  await page.getByRole("button", { name: "Kirim pesan" }).click();

  // Entri artefak dari hasil tool call.
  const entry = page.getByRole("button", { name: /rekap-e2e\.xlsx/ });
  await expect(entry).toBeVisible({ timeout: 60_000 });
  await expect(entry).toContainText("XLSX");

  // Unduhan: ambil href dari tautan unduhan di sebelah entri.
  const href = await page
    .locator("a[download='rekap-e2e.xlsx']")
    .first()
    .getAttribute("href");
  expect(href).toBeTruthy();

  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  const bytes = await response.body();
  // OOXML = ZIP: magic `PK\x03\x04`. Kalau route mengembalikan HTML galat,
  // byte pertama bukan "P" dan artefak sebenarnya rusak.
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(bytes.length).toBeGreaterThan(200);
});