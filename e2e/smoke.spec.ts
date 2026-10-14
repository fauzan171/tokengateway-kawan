import { expect, test } from "@playwright/test";

test("halaman awal memuat dan menyebut Kawan", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kawan");
});
