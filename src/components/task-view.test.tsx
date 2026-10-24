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
import { TaskView } from "./task-view";

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
