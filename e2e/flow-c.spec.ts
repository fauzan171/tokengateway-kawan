import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * Alur C (PRD 313–320): unggah PDF → worker mengekstrak → tanya → jawaban
 * memuat chip sitasi `[1]` → klik chip menampilkan potongan.
 *
 * Worker dijalankan `global-setup.ts`; tanpa itu status dokumen tidak pernah
 * berubah dan uji ini gagal (bukan lulus palsu).
 */

/** PDF minimal satu halaman; pola sama dengan fixture `run-extract.test.ts`. */
function pdfWithText(text: string): Buffer {
  const stream = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  const body = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    `4 0 obj<</Length ${stream.length}>>stream`,
    stream,
    "endstream",
    "endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R/Size 6>>",
    "%%EOF",
  ].join("\n");
  return Buffer.from(body, "latin1");
}

async function login(page: Page): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("region", { name: "Dokumen" })).toBeVisible();
}

test("C: PDF diproses worker, jawaban menyitasi potongan", async ({ page }) => {
  await login(page);
  const panel = page.getByRole("region", { name: "Dokumen" });

  await panel.getByLabel("Lampirkan dokumen").setInputFiles({
    name: "penjualan.pdf",
    mimeType: "application/pdf",
    buffer: pdfWithText("Penjualan naik pada kuartal ini."),
  });

  const item = panel.getByRole("listitem").filter({ hasText: "penjualan.pdf" });
  await expect(item).toBeVisible();
  await expect(item).toContainText("Siap", { timeout: 30_000 });

  await page.getByPlaceholder(/Tulis pesan/).fill("Bagaimana penjualan SITASI");
  await page.getByRole("button", { name: "Kirim pesan" }).click();

  const chip = page.getByRole("button", { name: /Lihat potongan penjualan\.pdf/ });
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await expect(chip).toHaveText("[1]");

  await chip.click();
  await expect(page.getByText("Penjualan naik pada kuartal ini.")).toBeVisible();
});
