import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("worker shutdown deadline", () => {
  let finish: () => void;
  let handlers: Map<string, (signal: NodeJS.Signals) => void>;
  let stop: ReturnType<typeof vi.fn>;
  let closeDb: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    handlers = new Map();
    stop = vi.fn();
    closeDb = vi.fn(async () => {});
    const running = new Promise<void>((resolve) => { finish = resolve; });
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(async () => ({})), closeDb }));
    vi.doMock("@/lib/jobs/worker", () => ({ createWorker: vi.fn(() => ({ run: () => running, stop })) }));
    vi.doMock("@/lib/chat/generate", () => ({ runGeneration: vi.fn() }));
    vi.doMock("@/lib/config/env", () => ({ loadConfig: () => ({ databaseUrl: "file:./test.db" }) }));
    // `worker.ts` memanggil reconcileGenerations saat startup dan shutdown;
    // tanpa mock, db palsu `{}` melempar dan main() keluar lewat process.exit.
    vi.doMock("@/lib/chat/recovery", () => ({ reconcileGenerations: vi.fn(async () => {}) }));
    vi.doMock("@/lib/api/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    vi.spyOn(process, "on").mockImplementation(((event: string, listener: (signal: NodeJS.Signals) => void) => {
      handlers.set(event, listener);
      return process;
    }) as typeof process.on);
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("forced exit"); });
  });

  afterEach(async () => {
    finish();
    await Promise.resolve();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stays alive beyond the old startup deadline", async () => {
    await import("./worker");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(process.exit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("arms the deadline only on the first shutdown signal", async () => {
    await import("./worker");
    expect(vi.getTimerCount()).toBe(0);
    handlers.get("SIGTERM")!("SIGTERM");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("forces exit on a second shutdown signal", async () => {
    await import("./worker");
    handlers.get("SIGINT")!("SIGINT");
    expect(() => handlers.get("SIGINT")!("SIGINT")).toThrow("forced exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("forces exit when graceful shutdown exceeds 30 seconds", async () => {
    await import("./worker");
    handlers.get("SIGTERM")!("SIGTERM");
    await expect(vi.advanceTimersByTimeAsync(30_000)).rejects.toThrow("forced exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("clears the deadline after graceful completion", async () => {
    await import("./worker");
    handlers.get("SIGTERM")!("SIGTERM");
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(closeDb).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(process.exit).not.toHaveBeenCalled();
  });
});
