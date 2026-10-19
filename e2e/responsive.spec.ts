import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, E2E_EMAIL, E2E_PASSWORD } from "./seed";

/**
 * Tata letak lintas perangkat (WO-09 lanjutan, permintaan owner: desktop +
 * mobile dijamin).
 *
 * Dua hal yang mudah bocor dan tidak tertangkap spec lain:
 * 1. Gulir horizontal — satu elemen lebar memaksa seluruh halaman bergeser.
 * 2. Target sentuh terlalu kecil — lolos di tetikus, gagal di jempol.
 *
 * Ambang sentuh 24 px (WCAG 2.5.8 AA), bukan 44 px: 44 px adalah AAA dan akan
 * membanjiri kegagalan pada kontrol sekunder yang memang kecil.
 */

const TOUCH_MIN = 24;

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  // Tujuan setelah masuk berbeda per peran (admin → /admin, pengguna → /), jadi
  // penanda yang sah cuma "sudah keluar dari /masuk".
  await page.waitForURL((url) => !url.pathname.startsWith("/masuk"), { timeout: 15_000 });
}

/** Halaman yang bisa dibuka tanpa sesi. */
const PUBLIK = ["/masuk", "/daftar", "/lupa-sandi", "/privasi"];

/** Halaman yang butuh sesi pengguna biasa. */
const PRIBADI = ["/", "/pengaturan", "/pemakaian", "/preferensi"];

async function tanpaGulirHorizontal(page: Page, path: string): Promise<void> {
  const lebih = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(lebih, `halaman ${path} meluap ${lebih}px`).toBeLessThanOrEqual(1);
}

for (const path of PUBLIK) {
  test(`publik ${path} tanpa gulir horizontal`, async ({ page }) => {
    await page.goto(path);
    await tanpaGulirHorizontal(page, path);
  });
}

for (const path of PRIBADI) {
  test(`pribadi ${path} tanpa gulir horizontal`, async ({ page }) => {
    await login(page, E2E_EMAIL);
    await page.goto(path);
    await tanpaGulirHorizontal(page, path);
  });
}

test("panel admin tanpa gulir horizontal", async ({ page }) => {
  await login(page, ADMIN_EMAIL);
  await page.goto("/admin");
  await tanpaGulirHorizontal(page, "/admin");
});

test("target sentuh memenuhi 24 px", async ({ page }) => {
  await login(page, E2E_EMAIL);
  for (const path of PRIBADI) {
    await page.goto(path);
    const kecil = await page.evaluate((min) => {
      const hasil: string[] = [];
      const elemen = document.querySelectorAll<HTMLElement>(
        "button, a[href], input:not([type=hidden]), select, textarea, [role=button]",
      );
      for (const el of elemen) {
        if (el.closest("[inert], [hidden], [aria-hidden=true]")) continue;
        const kotak = el.getBoundingClientRect();
        if (kotak.width === 0 || kotak.height === 0) continue; // tidak tampak
        const gaya = getComputedStyle(el);
        if (gaya.visibility === "hidden" || gaya.display === "none") continue;
        // Elemen `sr-only` (skip link, input file tersembunyi) sengaja 1x1.
        if (gaya.clipPath === "inset(50%)" || gaya.clip === "rect(0px, 0px, 0px, 0px)") continue;
        if (kotak.height < min || kotak.width < min) {
          const label = (el.textContent ?? "").trim().slice(0, 24) || el.tagName;
          hasil.push(`${label} ${Math.round(kotak.width)}x${Math.round(kotak.height)}`);
        }
      }
      return hasil;
    }, TOUCH_MIN);
    expect(kecil, `terlalu kecil di ${path}`).toEqual([]);
  }
});

test("composer chat bisa dipakai di layar sempit", async ({ page }) => {
  await login(page, E2E_EMAIL);
  await page.goto("/");
  const kotak = page.getByRole("textbox").first();
  await expect(kotak).toBeVisible();
  await kotak.fill("halo dari layar sempit");
  await expect(kotak).toHaveValue("halo dari layar sempit");
  await tanpaGulirHorizontal(page, "/ (composer terisi)");
});
