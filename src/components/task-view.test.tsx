/**
 * @vitest-environment jsdom
 *
 * K7 — pemilih agent di task-view. Yang diuji: select hanya muncul bila
 * katalog agent terpasang, pilihan terkirim di POST /tasks (task baru saja),
 * dan label agent aktif tampil dari run.agentId beku. Server tetap
 * memvalidasi id — UI hanya membaca /agents.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TaskView, appendActivity } from "./task-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

const TASKS = { tasks: [] };
const AGENTS = {
  agents: [
    { id: "peneliti", label: "Peneliti", description: "d", defaultModelId: null, audience: "user" },
    { id: "admin-op", label: "Admin", description: "d", defaultModelId: null, audience: "admin" },
  ],
};

/** Katalog agent: pilih episode jangan-jangan / agents. */
function stub(withAgents: boolean): void {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/kawan/v1/agents") {
      return json(withAgents ? AGENTS : { agents: [] });
    }
    if (url === "/api/kawan/v1/tasks") {
      if (init?.method === "POST") {
        return json({ task: { id: "task_1", title: "t", status: "active", activeRunId: null, updatedAt: "2026-01-01" } }, 202);
      }
      return json(TASKS);
    }
    if (url === "/api/kawan/v1/tasks/task_1") {
      return json({
        task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
        run: { id: "run_1", status: "completed", segment: 1, errorCode: null, agentId: "peneliti" },
        messages: [],
      });
    }
    return json({}, 404);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

async function render(taskId?: string): Promise<void> {
  await act(async () => {
    root = createRoot(container);
    root.render(<TaskView taskId={taskId} />);
  });
  // Flush efek fetch awal.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("K7 pemilih agent", () => {
  it("tanpa katalog agent: select tidak dirender (tanpa rasa aman palsu)", async () => {
    stub(false);
    await render();
    expect(container.querySelector("select")).toBeNull();
  });

  it("dengan katalog: select dirender dengan opsi agent; pilihan mengubah nilai", async () => {
    stub(true);
    await render();
    const select = container.querySelector<HTMLSelectElement>("select");
    expect(select).not.toBeNull();
    // Opsi: default + dua agent dari /agents (penyaringan audience di server).
    expect([...select!.options].map((o) => o.value)).toEqual(["", "peneliti", "admin-op"]);
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    await act(async () => {
      selectSetter?.call(select, "peneliti");
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("peneliti");
  });

  it("label agent aktif tampil dari run.agentId (agent tidak dikenal tetap tampil id)", async () => {
    stub(true);
    await render("task_1");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const label = container.querySelector('[data-testid="task-agent-label"]');
    expect(label?.textContent).toContain("Agent aktif");
    expect(label?.textContent).toContain("Peneliti");
  });
});

describe("D4: kartu onboarding di task-view", () => {
  /** /settings GET mengembalikan `onboarding`; PATCH dicatat. */
  function stubSettings(onboarding: string, patchOk = true): { patches: string[] } {
    const patches: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/kawan/v1/agents") return json({ agents: [] });
      if (url === "/api/kawan/v1/tasks") return json(TASKS);
      if (url === "/api/kawan/v1/settings") {
        if (init?.method === "PATCH") {
          if (!patchOk) return json({}, 400);
          patches.push(String(init.body));
          return json({ settings: { onboarding } });
        }
        return json({ settings: { theme: "system", locale: "id", fontScale: 100, sendOnEnter: true, onboarding } });
      }
      return json({}, 404);
    });
    return { patches };
  }

  it("GET /settings kosong → kartu tampil di atas form", async () => {
    stubSettings("");
    await render();
    expect(container.querySelector('[data-testid="onboarding-options"]')).not.toBeNull();
  });

  it("GET /settings sudah terisi → kartu tidak tampil", async () => {
    stubSettings("riset");
    await render();
    expect(container.querySelector('[data-testid="onboarding-options"]')).toBeNull();
  });

  it("pilih fokus lalu Simpan → PATCH /settings { onboarding } dan kartu hilang", async () => {
    const { patches } = stubSettings("");
    await render();
    const label = [...container.querySelectorAll<HTMLLabelElement>("label")].find((item) =>
      item.textContent?.includes("Riset dan rangkuman"),
    )!;
    const radio = label.querySelector("input")!;
    await act(async () => {
      radio.click();
    });
    const save = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === "Simpan",
    )!;
    await act(async () => {
      save.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0]!)).toEqual({ onboarding: "riset" });
    expect(container.querySelector('[data-testid="onboarding-options"]')).toBeNull();
  });

  it("PATCH gagal → error inline role=alert, kartu tetap tampil", async () => {
    stubSettings("", false);
    await render();
    const label = [...container.querySelectorAll<HTMLLabelElement>("label")].find((item) =>
      item.textContent?.includes("Riset dan rangkuman"),
    )!;
    await act(async () => {
      label.querySelector("input")!.click();
    });
    const save = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === "Simpan",
    )!;
    await act(async () => {
      save.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Gagal menyimpan");
    expect(container.querySelector('[data-testid="onboarding-options"]')).not.toBeNull();
  });
});

describe("T02: task pertama + idempotensi + replay dedup", () => {
  /** Kiriman POST /tasks dengan delay supaya klik kedua jatuh saat penerbangan. */
  function stubCreate(delayMs = 20): { posts: { url: string; key: string | null }[] } {
    const posts: { url: string; key: string | null }[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/kawan/v1/agents") return json({ agents: [] });
      if (url === "/api/kawan/v1/tasks") {
        if (init?.method === "POST") {
          const headers = (init?.headers ?? {}) as Record<string, string>;
          posts.push({ url, key: headers["Idempotency-Key"] ?? null });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return json(
            { task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" } },
            202,
          );
        }
        return json(TASKS);
      }
      if (url === "/api/kawan/v1/tasks/task_1") {
        return json({
          task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
          run: { id: "run_1", status: "running", segment: 1, errorCode: null, agentId: null },
          messages: [],
          snapshotSeq: 0,
        });
      }
      if (url.includes("/events")) return json({}, 500);
      return json({}, 404);
    });
    return { posts };
  }

  function typeDraft(text: string): void {
    const textarea = container.querySelector("textarea")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setValue.call(textarea, text);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function clickSend(): Promise<void> {
    const buttons = [...container.querySelectorAll("button")];
    const send = buttons.find((button) => button.textContent === "Kirim")!;
    await act(async () => {
      send.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }

  it("daftar kosong: submit memanggil POST /tasks (task pertama bisa dibuat lewat UI)", async () => {
    const { posts } = stubCreate(0);
    await render();
    typeDraft("Riset pertama saya");
    await clickSend();
    expect(posts).toHaveLength(1);
    expect(posts[0]!.url).toBe("/api/kawan/v1/tasks");
  });

  it("double submit → satu POST dengan satu Idempotency-Key yang sama", async () => {
    const { posts } = stubCreate(20);
    await render();
    typeDraft("Riset pertama saya");
    // Dua klik cepat: kedua masuk sebelum respons pertama pulang.
    const buttons = [...container.querySelectorAll("button")];
    const send = buttons.find((button) => button.textContent === "Kirim")!;
    await act(async () => {
      send.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      send.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]!.key).toBeTruthy();
  });

  it("replay seq ≤ snapshotSeq tidak ditambahkan lagi (tanpa concat replay)", async () => {
    // Snapshot memuat teks "Halo" (delta seq 1..3 sudah tercakup, snapshotSeq=3),
    // lalu SSE menyetel ulang delta seq 1..3 → live tetap kosong; delta seq 4
    // baru di-append.
    let sendCount = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/kawan/v1/agents") return json({ agents: [] });
      if (url === "/api/kawan/v1/tasks") {
        if (init?.method === "POST") return json({}, 404);
        return json(TASKS);
      }
      if (url === "/api/kawan/v1/tasks/task_1") {
        return json({
          task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
          run: { id: "run_1", status: "running", segment: 1, errorCode: null, agentId: null },
          messages: [],
          snapshotSeq: 3,
        });
      }
      if (url.includes("/events")) {
        if (sendCount > 0) return json({}, 500);
        sendCount += 1;
        return new Response(
          "id: 1\nevent: message.delta\ndata: {\"text\":\"Ha\"}\n\n" +
            "id: 2\nevent: message.delta\ndata: {\"text\":\"lo\"}\n\n" +
            "id: 3\nevent: message.delta\ndata: {\"text\":\"!\"}\n\n" +
            "id: 4\nevent: message.delta\ndata: {\"text\":\" baru\"}\n\n",
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }
      return json({}, 404);
    });
    await render("task_1");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    const live = container.querySelector('[data-testid="task-live-block"]');
    // Delta seq 1..3 = replay snapshot → tidak muncul; hanya seq 4 (teks " baru").
    expect(live?.textContent).toBe(" baru");
  });

  it("replay dengan seq sama dua kali (duplicate) tidak menggandakan teks", async () => {
    let sendCount = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/kawan/v1/agents") return json({ agents: [] });
      if (url === "/api/kawan/v1/tasks") {
        if (init?.method === "POST") return json({}, 404);
        return json(TASKS);
      }
      if (url === "/api/kawan/v1/tasks/task_1") {
        return json({
          task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
          run: { id: "run_1", status: "running", segment: 1, errorCode: null, agentId: null },
          messages: [],
          snapshotSeq: 0,
        });
      }
      if (url.includes("/events")) {
        if (sendCount > 0) return json({}, 500);
        sendCount += 1;
        return new Response(
          "id: 1\nevent: message.delta\ndata: {\"text\":\"A\"}\n\n" +
            "id: 1\nevent: message.delta\ndata: {\"text\":\"A\"}\n\n" +
            "id: 2\nevent: message.delta\ndata: {\"text\":\"B\"}\n\n",
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }
      return json({}, 404);
    });
    await render("task_1");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    const live = container.querySelector('[data-testid="task-live-block"]');
    expect(live?.textContent).toBe("AB");
  });
});

describe("UX-1: banner sambung ulang saat SSE putus", () => {
  it("fetch events ditolak → banner stalled + tombol sambung ulang tampil", async () => {
    stub(true);
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/kawan/v1/agents") return json(AGENTS);
      if (url === "/api/kawan/v1/tasks") return json(TASKS);
      if (url === "/api/kawan/v1/tasks/task_1")
        return json({
          task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
          run: { id: "run_1", status: "running", segment: 1, errorCode: null, agentId: "peneliti" },
          messages: [],
        });
      if (url.includes("/events")) return json({}, 500);
      return json({}, 404);
    });
    await render("task_1");
    await act(async () => {});
    expect(container.querySelector('[data-testid="sse-stalled-banner"]')).not.toBeNull();
  });
});

describe("D5: aktivitas per langkah dari step.started/step.completed", () => {
  /** Frame SSE dengan id (seq) dan nama event. */
  function step(id: number, event: string, data: unknown): string {
    return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  /** Snapshot + satu batch SSE; run.id/status menyesuaikan kasus uji. */
  function stubActivity(
    events: string,
    opts: {
      snapshotSeq?: number;
      runStatus?: string;
      snapshotRunId?: string;
      sources?: { title: string; url: string }[];
      metering?: unknown;
    } = {},
  ): void {
    let sendCount = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/kawan/v1/agents") return json({ agents: [] });
      if (url === "/api/kawan/v1/tasks") return json(TASKS);
      if (url === "/api/kawan/v1/tasks/task_1") {
        return json({
          task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
          run: {
            id: opts.snapshotRunId ?? "run_1",
            status: opts.runStatus ?? "running",
            segment: 1,
            errorCode: null,
            agentId: null,
            ...(opts.sources ? { sources: opts.sources } : {}),
            ...(opts.metering !== undefined ? { metering: opts.metering } : {}),
          },
          messages: [],
          snapshotSeq: opts.snapshotSeq ?? 0,
        });
      }
      if (url.includes("/events")) {
        if (sendCount > 0) return json({}, 500);
        sendCount += 1;
        return new Response(events, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return json({}, 404);
    });
  }

  /** Flush efek + microtask SSE. */
  async function flushSse(ms = 60): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  }

  it("step.started menampilkan label server di timeline", async () => {
    stubActivity(step(1, "step.started", { schemaVersion: 1, stepId: "s1", ordinal: 1, kind: "phase", phase: "discovery", label: "mencari…" }));
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[data-testid="task-activity"]')?.textContent).toContain("mencari…");
  });

  it("replay seq sama muncul sekali (dedup)", async () => {
    const frame = step(5, "step.started", { schemaVersion: 1, stepId: "s5", ordinal: 5, kind: "tool", toolName: "read", label: "membaca 2/3" });
    stubActivity(frame + frame);
    await render("task_1");
    await flushSse();
    const text = container.querySelector('[data-testid="task-activity"]')?.textContent ?? "";
    expect(text.match(/membaca 2\/3/g)).toHaveLength(1);
  });

  it("step.completed status failed menandai langkah gagal", async () => {
    stubActivity(
      step(1, "step.started", { schemaVersion: 1, stepId: "s1", ordinal: 1, kind: "model", label: "menyusun" }) +
        step(2, "step.completed", { schemaVersion: 1, stepId: "s1", status: "failed", label: "menyusun" }),
    );
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[data-testid="task-activity"]')?.textContent).toContain("Langkah gagal");
  });

  it("kind tak dikenal diabaikan, tidak crash", async () => {
    stubActivity(step(1, "step.hohoho", { schemaVersion: 1, stepId: "s1", label: "x" }));
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[data-testid="task-activity"]')).toBeNull();
  });

  it("snapshot seq menutupi event replay → timeline dari event tak ditambah", async () => {
    stubActivity(step(2, "step.started", { schemaVersion: 1, stepId: "s2", ordinal: 2, kind: "phase", phase: "discovery", label: "mencari…" }), {
      snapshotSeq: 5,
    });
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[data-testid="task-activity"]')).toBeNull();
  });

  it("B2d: sumber jawaban dirender sebagai tautan aman; tanpa sumber tidak ada blok", async () => {
    stubActivity(step(1, "step.started", { schemaVersion: 1, stepId: "s1", ordinal: 1, kind: "phase", phase: "synthesis", label: "menyusun" }), {
      runStatus: "completed",
      sources: [{ title: "Halaman A", url: "https://a.test/a" }],
    });
    await render("task_1");
    await flushSse();
    const link = container.querySelector('[data-testid="task-sources"] a');
    expect(link?.getAttribute("href")).toBe("https://a.test/a");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.textContent).toBe("Halaman A");
  });

  it("B2d: run tanpa sumber tidak merender blok sumber", async () => {
    stubActivity("", { runStatus: "completed" });
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[data-testid="task-sources"]')).toBeNull();
  });

  it("F5: run terminal tanpa metering (pra-D6) tidak merender blok", async () => {
    stubActivity("", { runStatus: "completed", metering: null });
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[data-testid="task-metering"]')).toBeNull();
  });

  it("F5: run.completed via SSE memuat snapshot baru dan memunculkan metering", async () => {
    let snapshots = 0;
    const terminalMetering = {
      usage: { reported: true, promptTokens: 1200, completionTokens: 340, totalTokens: 1540 },
      consumed: { promptTokens: 1200, completionTokens: 340, searches: 2, reads: 5, toolCalls: 7 },
      sourcesRead: 5,
    };
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/kawan/v1/agents") return json({ agents: [] });
      if (url === "/api/kawan/v1/tasks") return json(TASKS);
      if (url === "/api/kawan/v1/tasks/task_1") {
        snapshots += 1;
        const done = snapshots > 1;
        return json({
          task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
          run: {
            id: "run_1",
            status: done ? "completed" : "running",
            segment: 1,
            errorCode: null,
            agentId: null,
            ...(done ? { metering: terminalMetering } : {}),
          },
          messages: [],
          snapshotSeq: done ? 2 : 0,
        });
      }
      if (url.includes("/events")) {
        return new Response(step(2, "run.completed", { status: "completed" }), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return json({}, 404);
    });
    await render("task_1");
    // `render` sudah mem-flush efek, dan SSE di stub ini tiba seketika; yang
    // diuji adalah hasil setelah `run.completed` memicu snapshot kedua.
    await flushSse(120);
    expect(container.querySelector('[data-testid="task-metering"]')?.textContent).toContain("1.200");
    // Efek dibersihkan setelah run terminal (controller.abort) bukan koneksi
    // putus: banner "sambung ulang" tidak boleh menyala palsu di samping metering.
    expect(container.querySelector('[data-testid="sse-stalled-banner"]')).toBeNull();
  });

  it("F5: metering tampil setelah run terminal", async () => {
    stubActivity("", {
      runStatus: "completed",
      metering: {
        usage: { reported: true, promptTokens: 1200, completionTokens: 340, totalTokens: 1540 },
        consumed: { promptTokens: 1200, completionTokens: 340, searches: 2, reads: 5, toolCalls: 7 },
        sourcesRead: 5,
      },
    });
    await render("task_1");
    await flushSse();
    const text = container.querySelector('[data-testid="task-metering"]')?.textContent ?? "";
    expect(text).toContain("1.200");
    expect(text).toContain("5 sumber dibaca");
  });

  it("F5: run berjalan tidak menampilkan metering", async () => {
    stubActivity("", {
      runStatus: "running",
      metering: {
        usage: { reported: true, promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        consumed: { promptTokens: 10, completionTokens: 5, searches: 0, reads: 0, toolCalls: 0 },
        sourcesRead: 0,
      },
    });
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[data-testid="task-metering"]')).toBeNull();
  });

  it("run terminal: ThinkingDots hilang, tidak ada stream", async () => {
    stubActivity(
      step(1, "step.started", { schemaVersion: 1, stepId: "s1", ordinal: 1, kind: "phase", phase: "discovery", label: "mencari…" }),
      { runStatus: "completed" },
    );
    await render("task_1");
    await flushSse();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-activity"]')).toBeNull();
  });
});

describe("jawaban agen dirender sebagai Markdown", () => {
  it("tabel dan mermaid dari assistant tampil, pesan pengguna tetap teks apa adanya", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/kawan/v1/agents") return json({ agents: [] });
      if (url === "/api/kawan/v1/tasks") return json(TASKS);
      if (url === "/api/kawan/v1/tasks/task_1") {
        return json({
          task: { id: "task_1", title: "t", status: "active", activeRunId: "run_1", updatedAt: "2026-01-01" },
          run: { id: "run_1", status: "completed", segment: 1, errorCode: null, agentId: null },
          messages: [
            { id: "m1", role: "user", text: "| a | b |", createdAt: "2026-01-01T00:00:00.000Z" },
            {
              id: "m2",
              role: "assistant",
              text: "| a | b |\n|---|---|\n| 1 | 2 |",
              createdAt: "2026-01-01T00:00:01.000Z",
            },
          ],
          snapshotSeq: 0,
        });
      }
      if (url.includes("/events")) return json({}, 500);
      return json({}, 404);
    });
    await render("task_1");

    const articles = container.querySelectorAll("article");
    // Pesan pengguna: pipa tetap teks, tidak jadi <table>.
    expect(articles[0]?.querySelector("table")).toBeNull();
    expect(articles[0]?.textContent).toContain("| a | b |");
    // Jawaban agen: tabel GFM benar-benar dirender, dengan wrapper scroll.
    const table = articles[1]?.querySelector("table");
    expect(table).not.toBeNull();
    expect(articles[1]?.querySelector(".overflow-x-auto")).not.toBeNull();
  });
});

describe("D5: appendActivity murni", () => {
  const t = ((key: string) => key) as never;
  it("step.started menambah; step.completed failed menandai; kind asing tetap", () => {
    const started = [
      { schemaVersion: 1, stepId: "a", kind: "phase", phase: "discovery", label: "mencari…" },
      { schemaVersion: 1, stepId: "b", kind: "phase", phase: "synthesis", label: "menyusun" },
    ];
    let out = appendActivity([], "step.started", started[0] as never, t);
    out = appendActivity(out, "step.started", started[1] as never, t);
    expect(out.map((x) => x.label)).toEqual(["mencari…", "menyusun"]);
    out = appendActivity(out, "step.completed", { stepId: "a", status: "failed" } as never, t);
    expect(out[0]!.failed).toBe(true);
    expect(out[1]!.failed).toBeUndefined();
    // kind asing / stepId kosong → apa adanya.
    expect(appendActivity(out, "nope", { stepId: "a" } as never, t)).toBe(out);
    expect(appendActivity(out, "step.started", { label: "x" } as never, t)).toBe(out);
  });
});
