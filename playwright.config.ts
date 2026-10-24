import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./e2e/global-setup";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  // Tiga bentuk perangkat: desktop, ponsel sentuh, tablet. Spec yang sama
  // dijalankan ulang dengan viewport, UA, dan `hasTouch` berbeda — jadi
  // kebocoran tata letak sentuh ketahuan tanpa menulis spec kedua.
  // Semua di Chromium: WebKit butuh libgtk-4/libvulkan yang tidak ada di host
  // ini, dan yang diuji di sini tata letak + target sentuh, bukan mesin render.
  //
  // `flow-*` dikecualikan dari mobile/tablet: spec itu mengubah state global
  // (hapus pengguna, cabut tautan) di satu DB bersama, jadi menjalankannya
  // paralel lintas project saling menimpa — bukan menguji tata letak.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /flow-.*\.spec\.ts/,
    },
    {
      name: "tablet",
      use: { ...devices["iPad Mini"], browserName: "chromium" },
      testIgnore: /flow-.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run build && npm start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // Server lama memegang handle DB yang sudah dihapus seed → sesi E2E mati
    // dan tes dialihkan ke /masuk. Selalu pakai server baru.
    reuseExistingServer: false,
    timeout: 180_000,
    // DB uji terpisah + gateway palsu (loopback http diizinkan presisi).
    env: e2eEnv(),
  },
});
