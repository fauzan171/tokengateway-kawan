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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
