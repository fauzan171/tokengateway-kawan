import { expect, test, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * Alur D (PRD 321–327): bagikan tautan → buka anonim → snapshot beku →
 * pemilik mengubah chat → isi tautan tetap → cabut tautan → 404.
 *
 * Tombol cabut belum ada di UI (chat-sidebar hanya membuat tautan), jadi
 * pencabutan memakai endpoint yang sama dengan yang akan dipanggil UI nanti.
 */

async function login(page: Page): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByPlaceholder(/Tulis pesan/)).toBeVisible();
}

test("D: tautan beku, tidak berubah saat chat diedit, 404 setelah dicabut", async ({ page, browser }) => {
  await login(page);

  await page.getByPlaceholder(/Tulis pesan/).fill("Pesan untuk dibagikan");
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByRole("log")).toContainText("Balasan palsu", { timeout: 20_000 });

  const chatId = (await (await page.request.get("/api/kawan/v1/chats")).json()) as {
    chats: { id: string; title: string }[];
  };
  const target = chatId.chats[0];
  expect(target?.id).toBeTruthy();
  const id = target.id;

  // Bagikan lewat menu UI (bukti tombol & status bekerja), lalu pakai tautan
  // chat yang benar dari API — urutan sidebar tidak mengikuti urutan API.
  await page.getByRole("button", { name: /^Aksi untuk / }).first().click();
  await page.getByRole("button", { name: "Bagikan tautan" }).click();
  const status = page.getByRole("status").filter({ hasText: /Tautan/ });
  await expect(status).toBeVisible();
  expect(await status.textContent()).toMatch(/\/s\/[A-Za-z0-9_-]+/);

  const created = (await (await page.request.post(`/api/kawan/v1/chats/${id}/shares`)).json()) as {
    share: { token: string };
  };
  const token = created.share.token;
  expect(token).toBeTruthy();

  // Anonim: konten terlihat.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`/s/${token}`);
  const sharedMessage = anonPage
    .getByRole("listitem")
    .getByText("Pesan untuk dibagikan", { exact: true });
  await expect(sharedMessage).toHaveCount(1);
  await expect(sharedMessage).toBeVisible();
  const before = await anonPage.getByRole("main").textContent();

  // Pemilik menambah pesan; snapshot tidak boleh ikut berubah.
  await page.getByPlaceholder(/Tulis pesan/).fill("Pesan setelah dibagikan");
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByRole("log")).toContainText("Pesan setelah dibagikan");

  await anonPage.reload();
  await expect(anonPage.getByText("Pesan setelah dibagikan")).toHaveCount(0);
  expect(await anonPage.getByRole("main").textContent()).toBe(before);

  // Cabut semua tautan → 404 untuk pengunjung anonim.
  const revoked = await page.request.delete(`/api/kawan/v1/chats/${id}/shares`);
  expect(revoked.ok()).toBe(true);

  await anonPage.reload();
  await expect(anonPage.getByRole("heading", { level: 1 })).toContainText(/tidak ditemukan|404/i);
  await anon.close();

  // Bersih-bersih: chat uji dihapus supaya uji lain tidak melihatnya.
  expect((await page.request.delete(`/api/kawan/v1/chats/${id}`)).ok()).toBe(true);
});
