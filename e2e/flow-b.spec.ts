import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * Alur B (PRD 302–312): A → B → C, edit A menjadi A′ (cabang), regenerasi,
 * lalu berpindah cabang. Bukti terakhir: gateway palsu hanya menerima
 * leluhur cabang aktif — pesan dari cabang lain tidak boleh ikut terkirim.
 */

const GATEWAY = "http://127.0.0.1:3199";

type Recorded = { method: string; path: string; body: unknown };

async function login(page: Page): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByPlaceholder(/Tulis pesan/)).toBeVisible();
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByPlaceholder(/Tulis pesan/).fill(text);
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByRole("log")).toContainText(text);
  await idle(page);
}

/** Streaming selesai: tombol kirim kembali (berganti "Hentikan balasan" saat aktif). */
async function idle(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Kirim pesan" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Hentikan balasan" })).toHaveCount(0);
}

/** Pesan user pada permintaan terakhir yang memuat penanda uji ini. */
async function lastGatewayMessages(page: Page): Promise<string[]> {
  const recorded = (await (await page.request.get(`${GATEWAY}/_requests`)).json()) as Recorded[];
  const mine = [...recorded]
    .reverse()
    .filter((item) => item.path.endsWith("/chat/completions"))
    .find((item) => JSON.stringify(item.body).includes("Pesan A"));
  const body = mine?.body as { messages?: { role?: string; content?: unknown }[] } | undefined;
  return (body?.messages ?? [])
    .filter((message) => message.role === "user")
    .map((message) => (typeof message.content === "string" ? message.content : ""));
}

test("B: edit membuat cabang, regenerasi menambah sibling, konteks hanya cabang aktif", async ({ page }) => {
  await login(page);

  await send(page, "Pesan A");
  await send(page, "Pesan B");
  await send(page, "Pesan C");

  // Edit pesan A → A′; generasi baru menggantung pada cabang baru.
  const firstUser = page.getByRole("log").getByText("Pesan A", { exact: true });
  await firstUser.hover();
  await page.getByRole("button", { name: "Edit pesan" }).first().click();
  await page.getByRole("log").locator("textarea").fill("Pesan A aksen");
  await page.getByRole("button", { name: "Simpan & Cabang" }).click();

  await expect(page.getByRole("log")).toContainText("Pesan A aksen", { timeout: 20_000 });
  // Tunggu generasi cabang selesai: klik regenerasi saat masih streaming = 409.
  await idle(page);
  await expect(page.getByRole("button", { name: "Cabang berikutnya" }).first()).toBeVisible();

  // Regenerasi jawaban terakhir → sibling kedua.
  const assistant = page.getByRole("log").getByRole("button", { name: "Regenerasi balasan" }).last();
  await assistant.click({ force: true });
  await idle(page);
  await expect
    .poll(async () => page.getByRole("button", { name: "Cabang sebelumnya" }).count(), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);

  // Cabang aktif = A′ terakhir. Gateway hanya boleh melihat rantai ini.
  const branch = await lastGatewayMessages(page);
  expect(branch).toContain("Pesan A aksen");
  expect(branch).not.toContain("Pesan A");
  expect(branch).not.toContain("Pesan B");
  expect(branch).not.toContain("Pesan C");

  // Berpindah ke cabang pertama (A asli) mengembalikan rantai lama.
  await page.getByRole("button", { name: "Cabang sebelumnya" }).first().click();
  await expect(page.getByRole("log")).toContainText("Pesan A");
  await expect(page.getByRole("log")).not.toContainText("Pesan A aksen");
});
