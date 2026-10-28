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
import { useT, type Translate } from "@/lib/i18n/context";
import { PhaseTimeline, ThinkingDots, type PhaseView } from "@/components/thinking-indicator";
import { OnboardingFocusCard } from "@/components/onboarding-focus-card";
import { Markdown } from "@/components/markdown";
import { SourceList } from "@/components/source-list";
import { RunMeteringSummary, type RunMetering } from "@/components/run-metering-summary";

type TaskRow = { id: string; title: string; status: string; activeRunId: string | null; updatedAt: string };
// K7: agentId beku di run untuk label agent aktif.
type RunRow = {
  id: string;
  status: string;
  segment: number;
  errorCode: string | null;
  agentId?: string;
  // B2d: sumber yang dibaca run ini (hanya ada di snapshot, bukan daftar run).
  sources?: { title: string; url: string }[];
  // D6: pemakaian run; hanya ada di snapshot, dan `null` untuk run pra-D6.
  metering?: RunMetering | null;
};
type MessageRow = { id: string; role: string; text: string };
// T02: snapshotSeq = cursor event konsisten server; seluruh delta <= nilai itu
// sudah tercermin pada messages/run snapshot ini. Boleh absen pada payload lama
// → 0 (replay penuh, perilaku seperti sebelum cursor ada).
type Snapshot = {
  task: TaskRow;
  run: RunRow | null;
  messages: MessageRow[];
  snapshotSeq?: number;
};
/** Metadata agent publik (K5 /agents) — UI hanya membaca, server tetap memvalidasi. */
type AgentRow = { id: string; label: string; description: string; defaultModelId: string | null; audience: string };

/** Status yang berarti worker sudah tidak menulis lagi untuk run ini. */
const TERMINAL = new Set(["completed", "failed", "cancelled", "indeterminate"]);

/**
 * Satu langkah timeline aktivitas (D5). `phase` = stepId dari server supaya
 * item stabil saat di-update; `synthesis`/`failed` hanya penanda render.
 */
export type ActivityStep = PhaseView & { synthesis?: boolean; failed?: boolean };

/** Fase → kunci i18n fallback. Dipakai HANYA bila server tidak mengirim label. */
const PHASE_LABEL_KEY: Record<string, string> = {
  framing: "tasks.activity.thinking",
  discovery: "tasks.activity.searching",
  extraction: "tasks.activity.reading",
  validation: "tasks.activity.tool",
  synthesis: "tasks.activity.synthesize",
};

function fallbackLabel(data: Record<string, unknown>, t: Translate): string {
  if (data["kind"] === "tool") return t("tasks.activity.tool");
  const key = typeof data["phase"] === "string" ? PHASE_LABEL_KEY[data["phase"]] : undefined;
  return t((key ?? "tasks.activity.thinking") as never);
}

/**
 * Terapkan satu event step ke timeline aktivitas. Murni: hanya membaca `prev`,
 * mengembalikan array baru. Kind tak dikenal → `prev` apa adanya.
 * `step.started` menambah langkah; `step.completed` menandai langkah itu
 * selesai (label server) atau gagal (failed/cancelled/indeterminate).
 */
export function appendActivity(
  prev: ActivityStep[],
  kind: string,
  data: Record<string, unknown>,
  t: Translate,
): ActivityStep[] {
  const stepId = typeof data["stepId"] === "string" ? data["stepId"] : "";
  if (stepId === "") return prev;
  const label = typeof data["label"] === "string" && data["label"] !== "" ? data["label"] : null;
  if (kind === "step.started") {
    return [
      ...prev,
      {
        phase: stepId,
        label: label ?? fallbackLabel(data, t),
        ...(data["phase"] === "synthesis" ? { synthesis: true } : {}),
      },
    ];
  }
  if (kind !== "step.completed") return prev;
  const status = data["status"];
  const failed = status === "failed" || status === "cancelled" || status === "indeterminate";
  const index = prev.findIndex((item) => item.phase === stepId);
  const base: ActivityStep =
    index >= 0 ? prev[index]! : { phase: stepId, label: label ?? fallbackLabel(data, t) };
  const settled: ActivityStep = failed
    ? { ...base, label: `${base.label} — ${t("tasks.activity.failed")}`, failed: true }
    : { ...base, label: label ?? base.label };
  if (index < 0) return [...prev, settled];
  const next = prev.slice();
  next[index] = settled;
  return next;
}

export function TaskView({ taskId }: { taskId?: string }) {
  const t = useT();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [agentId, setAgentId] = useState("");
  const [active, setActive] = useState<string | null>(taskId ?? null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // D4: fokus onboarding. Kosong = belum dijawab → kartu tampil di atas form.
  // `onboardingLoaded` mencegah kartu berkedip sebelum GET /settings pulang.
  const [onboarding, setOnboarding] = useState("");
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  // UX-1: stream SSE terputus — tampilkan sambung ulang, jangan diam.
  const [stalled, setStalled] = useState(false);
  const [live, setLive] = useState("");
  // D5: aktivitas per langkah dari step.started/step.completed. Timeline
  // terakhir dibiarkan tampil setelah run terminal sampai snapshot baru.
  const [activity, setActivity] = useState<ActivityStep[]>([]);
  // Run pemilik `activity`: snapshot run berbeda mengosongkan timeline.
  const prevRunIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  // Kunci idempotensi submit aktif. Bertahan sampai respons diterima supaya
  // klik ganda/jaringan ulang membawa KUNCI YANG SAMA (server mengembalikan
  // admission yang sama, bukan membuat job kedua), lalu null → kirim berikutnya
  // mendapat kunci baru.
  const submitKeyRef = useRef<string | null>(null);
  // Guard klik ganda di klien: satu kiriman dalam penerbangan; ulang setelah
  // galat memakai kunci yang sama (bukan admission kedua).
  const sendingRef = useRef(false);
  // Cursor snapshot: seq terakhir yang SUDAH tercermin pada teks yang tampil.
  // T02: replay hanya di-append bila seq lebih besar; dedup seq ≤ cursor.
  const snapshotSeqRef = useRef(0);
  // Dedup delta per (runId, seq): satu pesan, satu buffer teks.
  const seenSeqRef = useRef(new Set<string>());

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

  // K7: katalog agent sekali saja — gagal memuat tidak menghalangi task biasa;
  // pemilih hanya kosong dan pilihan jatuh ke default di server.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/kawan/v1/agents");
        if (!response.ok) return;
        const payload = (await response.json()) as { agents: AgentRow[] };
        if (!cancelled && Array.isArray(payload.agents)) setAgents(payload.agents);
      } catch {
        // Daftar agent gagal dimuat: pemilih kosong, server tetap memvalidasi.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // D4: fokus onboarding sekali saat mount. Kosong = belum dijawab → kartu tampil
  // di atas form. Gagal memuat: dianggap belum dijawab (kartu tampil), dan
  // menyimpan hanya lewat aksi eksplisit pengguna.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/kawan/v1/settings");
        if (!response.ok) throw new Error("gagal");
        const payload = (await response.json()) as { settings: { onboarding?: string } };
        if (!cancelled) setOnboarding(payload.settings.onboarding ?? "");
      } catch {
        // Abaikan: kartu tetap tampil karena onboarding tetap "".
      } finally {
        if (!cancelled) setOnboardingLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSnapshot = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/kawan/v1/tasks/${id}`);
      if (!response.ok) throw new Error("gagal");
      const payload = (await response.json()) as Snapshot;
      setSnapshot(payload);
      setStalled(false);
      // T02: cursor konsisten dari server. Snapshot SUDAH memuat semua delta
      // <= snapshotSeq, jadi stream berikutnya hanya meng-append seq yang
      // lebih besar — teks snapshot tidak di-replay ulang, tidak di-concat.
      // Payload lama tanpa snapshotSeq → 0 (replay penuh, aman).
      snapshotSeqRef.current = payload.snapshotSeq ?? 0;
      seqRef.current = payload.snapshotSeq ?? 0;
      setLive("");
      // D5: aktivitas milik SATU run. Snapshot run lain → kosongkan supaya
      // langkah run lama tidak menumpuk; muat ulang run yang sama (mis. penutup
      // run.completed) → biarkan timeline terakhir tampil.
      if (payload.run?.id !== prevRunIdRef.current) setActivity([]);
      prevRunIdRef.current = payload.run?.id ?? null;
      seenSeqRef.current = new Set();
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
        if (!response.ok || !response.body) {
          setStalled(true);
          return;
        }
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
            const seq = idLine ? Number.parseInt(idLine.slice(4), 10) || 0 : 0;
            if (idLine && seq > 0) seqRef.current = seq;
            if (!eventLine || !dataLine) continue;
            const kind = eventLine.slice(7);
            let data: Record<string, unknown> = {};
            try {
              data = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
            } catch {
              data = {};
            }
            if (kind === "message.delta" && typeof data["text"] === "string") {
              // T02 dedup: (runId, seq) hanya sekali; seq <= snapshotSeq sudah
              // ada di snapshot. Out-of-order/gap → cursor maju, teks tidak
              // digandakan; run.event lain tetap diproses.
              const dedupKey = `${run.id}:${seq}`;
              const alreadySeen = seq <= snapshotSeqRef.current || seenSeqRef.current.has(dedupKey);
              if (!alreadySeen) {
                seenSeqRef.current.add(dedupKey);
                setLive((current) => current + (data["text"] as string));
              }
            }
            if (kind === "step.started" || kind === "step.completed") {
              // D5 dedup sama seperti delta: (runId, seq) sekali; seq ≤
              // snapshotSeq sudah tercakup snapshot. Kind tak dikenal tetap
              // memajukan cursor di luar sini.
              const dedupKey = `${run.id}:${seq}`;
              if (seq > snapshotSeqRef.current && !seenSeqRef.current.has(dedupKey)) {
                seenSeqRef.current.add(dedupKey);
                setActivity((prev) => appendActivity(prev, kind, data, t));
              }
            }
            if (kind.startsWith("run.") && kind !== "run.queued" && kind !== "run.started") {
              // Penutup: ambil kebenaran final dari server, bukan tafsir klien.
              void loadSnapshot(active);
              void loadList();
            }
          }
        }
      } catch {
        // Efek dibersihkan (run terminal → tidak ada stream lagi) juga melempar
        // AbortError. Itu bukan koneksi putus: tanpa penjaga ini banner
        // "sambung ulang" menyala palsu dan tak pernah dibersihkan karena efek
        // berikutnya langsung `return` untuk run terminal.
        if (!controller.signal.aborted) setStalled(true);
      }
    })();
    return () => controller.abort();
  }, [active, snapshot?.run, loadSnapshot, loadList, t]);

  const send = useCallback(async () => {
    if (draft.trim() === "" || sendingRef.current) return;
    // T02: task pertama pun bisa dikirim tanpa task aktif (daftar kosong):
    // POST /tasks membuat task + run; UI tidak lagi menahan submit.
    const target = active;
    if (!target && !draft.trim()) return;
    sendingRef.current = true;
    setError(null);
    try {
      const run = snapshot?.run;
      const resumable = !!(target && run && TERMINAL.has(run.status));
      // Kunci idempotensi submit ini. Tetap sama untuk percobaan ulang kiriman
      // yang sama; dibuang setelah respons diterima (kirim berikutnya = kunci
      // baru). Double-submit akibat klik ganda tergabung jadi satu admission
      // di server lewat header Idempotency-Key (D04).
      if (!submitKeyRef.current) {
        submitKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const response = await fetch(
        resumable ? `/api/kawan/v1/tasks/${target}/messages` : "/api/kawan/v1/tasks",
        {
          method: "POST",
          headers: { "content-type": "application/json", "Idempotency-Key": submitKeyRef.current },
          // K7: agent hanya ikut saat membuat task baru; run lanjutan memakai
          // agent beku task itu (server yang menolak id tidak sah).
          body: JSON.stringify({
            input: draft,
            ...(resumable
              ? {}
              : {
                  title: draft.slice(0, 80),
                  ...(agentId ? { agentId } : {}),
                }),
          }),
        },
      );
      if (!response.ok) throw new Error("gagal");
      // Kiriman diterima: kunci ini sudah terpakai, kirim berikutnya butuh baru.
      submitKeyRef.current = null;
      sendingRef.current = false;
      setDraft("");
      if (resumable) await loadSnapshot(target!);
      else {
        const payload = (await response.json()) as { task: { id: string } };
        setActive(payload.task.id);
        await loadList();
      }
    } catch {
      setError(t("tasks.sendFailed"));
      // Kunci TIDAK dibuang: percobaan ulang kiriman ini memakai kunci yang
      // sama agar server tidak membuat admission kedua. Guard dikalahkan agar
      // pengguna bisa mencoba lagi.
      sendingRef.current = false;
    }
  }, [active, draft, agentId, snapshot?.run, loadSnapshot, loadList, t]);

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

  // D4: simpan fokus onboarding. Sukses → onboarding terisi → kartu hilang.
  // Gagal → error inline; nilai tetap di draft kartu (state lokalnya) untuk dicoba lagi.
  const saveOnboarding = useCallback(
    async (value: string) => {
      setOnboardingError(null);
      try {
        const response = await fetch("/api/kawan/v1/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboarding: value }),
        });
        if (!response.ok) throw new Error("gagal");
        setOnboarding(value);
      } catch {
        setOnboardingError(t("onboarding.saveFailed"));
      }
    },
    [t],
  );

  // Run aktif: stream belum terminal. Nama sejalur dengan gate SSE di atas.
  const runActive = !!snapshot?.run && !TERMINAL.has(snapshot.run.status);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <section aria-label={t("tasks.list")} className="lg:w-72 lg:shrink-0">
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-visible">
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

                {stalled ? (
          <div            role="status"            className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-2 text-xs text-muted-foreground"            data-testid="sse-stalled-banner"          >
            <span>{t("tasks.stalled")}</span>
            <button
              type="button"              className="min-h-8 rounded-md border px-3 font-medium hover:bg-muted"              onClick={() => active && void loadSnapshot(active)}
            >
              {t("tasks.reconnect")}
            </button>
          </div>
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
              {/* Jawaban agen memuat tabel/mermaid, jadi lewat <Markdown />;
                  pesan pengguna tetap teks apa adanya. */}
              {row.role === "assistant" ? (
                <Markdown text={row.text} />
              ) : (
                <p className="whitespace-pre-wrap">{row.text}</p>
              )}
            </article>
          ))}
          {/* B2d: sumber jawaban run aktif. Ditempel setelah daftar pesan
              (bukan per balasan) karena jawaban assistant milik run ini selalu
              yang terakhir dan riwayat task bisa memuat beberapa run. */}
          {snapshot?.run?.sources?.length ? (
            <div data-testid="task-sources">
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("tasks.sources")}
              </h2>
              <SourceList sources={snapshot.run.sources} />
            </div>
          ) : null}
          {/* D6: metering hanya setelah run terminal — selama run berjalan
              angkanya masih bergerak, dan komponen ini menjanjikan ringkasan,
              bukan progress. `null` (run pra-D6) tidak merender apa pun. */}
          {snapshot?.run && !runActive && snapshot.run.metering ? (
            <div data-testid="task-metering">
              <RunMeteringSummary metering={snapshot.run.metering} />
            </div>
          ) : null}
          {/* D5: aktivitas per langkah. Label final dari server; timeline
              dibiarkan tampil setelah run terminal (tak ada stream lagi). */}
          {activity.length > 0 ? (
            <div data-testid="task-activity" aria-label={t("tasks.activity")}>
              <PhaseTimeline phases={activity} active={runActive} />
            </div>
          ) : null}
          {/* Titik berpikir hanya sampai langkah synthesis tiba: setelah itu
              timeline sendiri yang jadi bukti proses. */}
          {runActive && !activity.some((item) => item.synthesis) ? (
            <ThinkingDots
              label={activity.length > 0 ? activity[activity.length - 1]!.label : t("tasks.activity.thinking")}
            />
          ) : null}
          {live !== "" ? (
            <article className="rounded-lg border border-dashed p-3 text-sm" data-testid="task-live-block">
              <p className="whitespace-pre-wrap">{live}</p>
            </article>
          ) : null}
        </div>

        {snapshot?.run?.agentId ? (
          <p className="text-xs text-muted-foreground" data-testid="task-agent-label">
            {t("tasks.agentActive")}
            {agents.find((agent) => agent.id === snapshot.run?.agentId)?.label ?? snapshot.run.agentId}
          </p>
        ) : null}
        {agents.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("tasks.agentPicker")}
            <select
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm font-normal"
              aria-label={t("tasks.agentPicker")}
            >
              <option value="">{t("tasks.agentDefault")}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {/* D4: kartu fokus untuk pengguna baru, di atas form input task pertama.
            Tampil hanya bila GET /settings sudah pulang dan jawabannya masih kosong;
            kartu tidak memblokir submit. */}
        {onboardingLoaded && onboarding === "" ? (
          <div className="flex flex-col gap-2">
            <OnboardingFocusCard value={onboarding} onChange={(value) => void saveOnboarding(value)} compact />
            {onboardingError ? (
              <p role="alert" className="text-sm text-destructive">
                {onboardingError}
              </p>
            ) : null}
          </div>
        ) : null}

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