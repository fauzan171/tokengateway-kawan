/**
 * Penulis event SSE untuk satu generasi (WP-NT-P3-05, REQ-NT-22, SDD-4.4).
 *
 * Kontrak (SDD-4.4): `meta` lebih dulu (seq 0), lalu event `GenerationEvent`
 * dari buffer basis data sampai status generasi terminal, lalu `done`/`error`.
 * `seq` monoton; TIDAK ada tulisan setelah `done`/`error`.
 *
 * Buffer event sudah ada (`publishEvent` di `generate.ts` menulis
 * `GenerationEvent(seq, kind, payloadJson)`), jadi modul ini hanya MEMBACA —
 * tidak ada pub/sub baru. Karena `generate.ts` tidak pernah menulis `meta`,
 * event itu disintesis di sini dengan `seq` 0.
 *
 * Resume (WP-NT-P3-06, SDD-4.5): klien yang menyambung ulang mengirim
 * `afterSeq=lastSeq`. Bila `afterSeq > 0`, `meta` tidak dikirim ulang dan
 * pemutaran dimulai dari `seq > afterSeq`, sehingga tidak ada potongan yang
 * hilang atau ganda.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { DEFAULT_MODEL } from "./generate";

/** Status generasi yang berarti stream sudah selesai (SDD-4.2). */
const TERMINAL_STATUSES = new Set(["complete", "stopped", "error", "indeterminate"]);

/** Jeda antar putaran polling. Cukup pendek agar terasa realtime, cukup longgar
 *  agar tidak menghajar basis data (SDD-4.4 mengizinkan polling basis data). */
const POLL_MS = 150;

/** Satu event SSE: `event: <kind>` + `data: <json>` + baris kosong. */
export function sseEvent(kind: string, data: unknown): string {
  return `event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePayload(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : {};
  } catch {
    // Baris rusak tidak boleh menjatuhkan stream; kirim objek kosong.
    return {};
  }
}

/**
 * Menyusun `data` event dari payload tersimpan. `seq` selalu di depan, dan
 * event `usage` selalu membawa `reported: true` — event itu hanya ada bila
 * gateway memang melaporkan usage (`generate.ts`), jadi klaimnya jujur.
 */
function eventData(
  kind: string,
  seq: number,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (kind === "usage") {
    return { seq, ...payload, reported: typeof payload["reported"] === "boolean" ? payload["reported"] : true };
  }
  return { seq, ...payload };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

function notFound(code: string): ApiError {
  return new ApiError({ status: STATUS.NOT_FOUND, code, message: "Tidak ditemukan." });
}

export type StreamTarget = {
  model: string;
  assistantMessageId: string;
};

/**
 * Memuat generasi + chat dan menegakkan kepemilikan (SDD-3.1).
 *
 * Chat milik pengguna lain, chat tidak ada, dan `generationId` yang bukan milik
 * chat itu semuanya → 404 yang sama bentuknya, supaya keberadaan sumber daya
 * orang lain tidak bocor. Dipakai dua kali: sekali oleh route (agar 404 dikirim
 * sebagai JSON sebelum header SSE ditulis) dan sekali oleh `createSseStream`.
 */
export async function loadStreamTarget(
  db: Db,
  input: { userId: string; chatId: string; generationId: string },
): Promise<StreamTarget> {
  const chat = await db.chat.findFirst({
    where: { id: input.chatId, userId: input.userId },
    select: { modelRef: true },
  });
  if (!chat) throw notFound("CHAT_NOT_FOUND");

  const generation = await db.generation.findFirst({
    where: { id: input.generationId, chatId: input.chatId },
    select: { assistantMessageId: true },
  });
  if (!generation) throw notFound("GENERATION_NOT_FOUND");

  return {
    model: chat.modelRef ?? DEFAULT_MODEL,
    assistantMessageId: generation.assistantMessageId,
  };
}

export type SseStreamOptions = {
  db: Db;
  userId: string;
  chatId: string;
  generationId: string;
  /**
   * `seq` terakhir yang sudah dimiliki klien (SDD-4.5). `0`/hilang → putar dari
   * awal termasuk `meta`; `N > 0` → langsung dari `seq > N` tanpa `meta`.
   * `N` yang melebihi seq terakhir aman: tidak melempar, hanya mengirim penutup.
   */
  afterSeq?: number;
  signal: AbortSignal;
};

/**
 * Membangun `ReadableStream` SSE untuk satu generasi.
 *
 * Alur: `meta` (seq 0) → putar `GenerationEvent` yang belum dikirim → bila
 * status generasi terminal dan belum ada event penutup, sintesis `done`/`error`
 * → tutup. Klien memutus koneksi → `signal` (atau `cancel`) membatalkan loop.
 */
export function createSseStream(options: SseStreamOptions): ReadableStream<Uint8Array> {
  const { db, userId, chatId, generationId, signal } = options;
  // `afterSeq` tak wajar (NaN, negatif, pecahan) diperlakukan sebagai 0 supaya
  // klien yang mengirim sampah tetap mendapat stream lengkap, bukan galat.
  const raw = options.afterSeq;
  const afterSeq = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  const encoder = new TextEncoder();
  const stopped = new AbortController();
  const stop = AbortSignal.any([signal, stopped.signal]);
  let open = true;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (kind: string, data: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(kind, data)));
        } catch {
          // Klien sudah memutus koneksi: berhenti menulis, jangan melempar.
          open = false;
        }
      };
      const close = () => {
        if (!open) return;
        open = false;
        try {
          controller.close();
        } catch {
          // Sudah ditutup/dibatalkan; tidak ada yang perlu dilakukan.
        }
      };

      if (stop.aborted) return close();

      const target = await loadStreamTarget(db, { userId, chatId, generationId });

      // `meta` hanya untuk sambungan baru (SDD-4.5 aturan 2): resume dengan
      // `afterSeq > 0` melanjutkan dari yang belum dimiliki klien, tanpa `meta`.
      if (afterSeq === 0) {
        send("meta", {
          generationId,
          assistantMessageId: target.assistantMessageId,
          model: target.model,
          seq: 0,
        });
      }

      let lastSeq = afterSeq;

      for (;;) {
        const events = await db.generationEvent.findMany({
          where: { generationId, seq: { gt: lastSeq } },
          orderBy: { seq: "asc" },
          select: { seq: true, kind: true, payloadJson: true },
        });

        let terminal = false;
        for (const event of events) {
          lastSeq = event.seq;
          send(event.kind, eventData(event.kind, event.seq, parsePayload(event.payloadJson)));
          if (event.kind === "done" || event.kind === "error") {
            terminal = true;
            break;
          }
        }
        // Event penutup sudah terkirim: tidak menulis apa pun lagi (SDD-4.4).
        if (terminal) return close();

        if (stop.aborted) return close();

        const generation = await db.generation.findFirst({
          where: { id: generationId },
          select: { status: true, errorCode: true, finishReason: true },
        });
        if (!generation) return close();

        if (TERMINAL_STATUSES.has(generation.status)) {
          // Terminal tanpa event penutup di buffer (mis. `stopped`/`indeterminate`):
          // sintesis penutup supaya klien tidak menggantung menunggu.
          if (generation.status === "error") {
            send("error", {
              seq: lastSeq + 1,
              code: generation.errorCode ?? "UPSTREAM_ERROR",
              message: "Generasi gagal.",
              retryable: false,
            });
          } else {
            send("done", {
              seq: lastSeq + 1,
              status: generation.status,
              finishReason: generation.finishReason ?? null,
            });
          }
          return close();
        }

        await sleep(POLL_MS, stop);
      }
    },

    cancel() {
      open = false;
      stopped.abort();
    },
  });
}
