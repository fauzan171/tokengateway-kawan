"use client";

/**
 * Daftar + detail task (FIX-08).
 *
 * Satu komponen, satu alur: pilih task → ikuti SSE run-nya lewat `afterSeq`
 * yang dimiliki klien → kirim input/cancel. Tidak ada polling penuh dan tidak
 * ada state optimistik: teks yang tampil hanya yang benar-benar sudah durable di
 * server, jadi reload di tengah run tidak kehilangan potongan.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";

type TaskRow = { id: string; title: string; status: string; activeRunId: string | null; updatedAt: string };
type RunRow = { id: string; status: string; segment: number; errorCode: string | null };
type MessageRow = { id: string; role: string; text: string };
type Snapshot = { task: TaskRow; run: RunRow | null; messages: MessageRow[] };

/** Status yang berarti worker sudah tidak menulis lagi untuk run ini. */
const TERMINAL = new Set(["completed", "failed", "cancelled", "indeterminate"]);

export function TaskView({ taskId }: { taskId?: string }) {
  const t = useT();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [active, setActive] = useState<string | null>(taskId ?? null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const seqRef = useRef(0);

  const loadList = useCallback(async () => {
    try {
      const response = await fetch("/api/kawan/v1/tasks");
      if (!response.ok) throw new Error("gagal");
      const payload = (await response.json()) as { tasks: TaskRow[] };
      setTasks(payload.tasks);
    } catch {
      setError(t("tasks.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadSnapshot = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/kawan/v1/tasks/${id}`);
      if (!response.ok) throw new Error("gagal");
      const payload = (await response.json()) as Snapshot;
      setSnapshot(payload);
      seqRef.current = 0;
      setLive("");
    } catch {
      setError(t("tasks.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    if (active) void loadSnapshot(active);
  }, [active, loadSnapshot]);

  // SSE hanya selama run belum terminal; stream menutup sendiri di terminal.
  useEffect(() => {
    const run = snapshot?.run;
    if (!active || !run || TERMINAL.has(run.status)) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          `/api/kawan/v1/tasks/${active}/runs/${run.id}/events?afterSeq=${seqRef.current}`,
          { signal: controller.signal },
        );
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const idLine = frame.split("\n").find((line) => line.startsWith("id: "));
            const eventLine = frame.split("\n").find((line) => line.startsWith("event: "));
            const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
            if (idLine) seqRef.current = Number.parseInt(idLine.slice(4), 10) || seqRef.current;
            if (!eventLine || !dataLine) continue;
            const kind = eventLine.slice(7);
            let data: Record<string, unknown> = {};
            try {
              data = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
            } catch {
              data = {};
            }
            if (kind === "message.delta" && typeof data["text"] === "string") {
              setLive((current) => current + (data["text"] as string));
            }
            if (kind.startsWith("run.") && kind !== "run.queued" && kind !== "run.started") {
              // Penutup: ambil kebenaran final dari server, bukan tafsir klien.
              void loadSnapshot(active);
              void loadList();
            }
          }
        }
      } catch {
        // Koneksi putus: snapshot tetap benar, pengguna bisa menyambung ulang.
      }
    })();
    return () => controller.abort();
  }, [active, snapshot?.run, loadSnapshot, loadList]);

  const send = useCallback(async () => {
    if (!active || draft.trim() === "") return;
    setError(null);
    try {
      const run = snapshot?.run;
      const resumable = run && TERMINAL.has(run.status);
      const response = await fetch(
        resumable ? `/api/kawan/v1/tasks/${active}/messages` : "/api/kawan/v1/tasks",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: draft, ...(resumable ? {} : { title: draft.slice(0, 80) }) }),
        },
      );
      if (!response.ok) throw new Error("gagal");
      setDraft("");
      if (resumable) await loadSnapshot(active);
      else {
        const payload = (await response.json()) as { task: { id: string } };
        setActive(payload.task.id);
        await loadList();
      }
    } catch {
      setError(t("tasks.sendFailed"));
    }
  }, [active, draft, snapshot?.run, loadSnapshot, loadList, t]);

  const cancel = useCallback(async () => {
    const run = snapshot?.run;
    if (!active || !run) return;
    try {
      const response = await fetch(`/api/kawan/v1/tasks/${active}/runs/${run.id}/cancel`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("gagal");
      await loadSnapshot(active);
    } catch {
      setError(t("tasks.sendFailed"));
    }
  }, [active, snapshot?.run, loadSnapshot, t]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <section aria-label={t("tasks.list")} className="lg:w-72 lg:shrink-0">
        <ul className="flex flex-col gap-1">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => setActive(task.id)}
                aria-current={task.id === active ? "true" : undefined}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  task.id === active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                <span className="block truncate">{task.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(`tasks.status.${task.status}` as never)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {tasks.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">{t("tasks.empty")}</p>
        ) : null}
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-3">
          {snapshot?.messages.map((row) => (
            <article
              key={row.id}
              className={`rounded-lg border p-3 text-sm ${
                row.role === "user" ? "bg-muted" : "bg-background"
              }`}
            >
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {row.role === "user" ? t("tasks.roleUser") : t("tasks.roleAssistant")}
              </h2>
              <p className="whitespace-pre-wrap">{row.text}</p>
            </article>
          ))}
          {live !== "" ? (
            <article className="rounded-lg border border-dashed p-3 text-sm">
              <p className="whitespace-pre-wrap">{live}</p>
            </article>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="task-input" className="text-sm font-medium">
            {t("tasks.inputLabel")}
          </label>
          <textarea
            id="task-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void send()}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {t("tasks.send")}
            </button>
            {snapshot?.run && !TERMINAL.has(snapshot.run.status) ? (
              <button
                type="button"
                onClick={() => void cancel()}
                className="rounded-md border px-3 py-2 text-sm"
              >
                {t("tasks.cancel")}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}