/**
 * Teardown global Playwright (WP-NT-P10-05): matikan worker dan gateway palsu
 * supaya proses tidak tertinggal setelah uji.
 */

import { stopFakeGateway } from "./fake-gateway";
import { workerProcess } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  const worker = workerProcess();
  if (worker && worker.exitCode === null && worker.pid) {
    // Bunuh seluruh grup (npm + tsx anaknya); SIGTERM ke npm saja meninggalkan
    // worker yatim yang memegang handle DB.
    const killGroup = (sig: NodeJS.Signals) => {
      try {
        process.kill(-worker.pid!, sig);
      } catch {
        worker.kill(sig);
      }
    };
    killGroup("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        killGroup("SIGKILL");
        resolve();
      }, 10_000);
      worker.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  await stopFakeGateway();
}
