/**
 * Pembatalan generasi (WP-NT-P3-07, REQ-NT-23, SDD-4.6).
 *
 * `requestStop` mencatat permintaan berhenti dengan mengisi
 * `Generation.cancelRequestedAt`; ia TIDAK menghentikan apa pun sendiri.
 * Worker yang sedang membaca stream memeriksa `stopIfRequested` pada setiap
 * potongan, lalu menutup koneksi dan menyimpan partial (lihat `generate.ts`).
 *
 * SDD-4.6: stop tidak menjanjikan pembatalan efek samping di sisi gateway
 * (mis. tool eksternal yang sudah berjalan). Yang dijamin hanya: tidak ada
 * token lagi yang ditulis setelah pembatalan.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

/** Status generasi yang masih bisa dibatalkan (SDD-4.2). */
const RUNNING_STATUSES = ["queued", "preparing", "streaming"] as const;

/**
 * Dilempar di dalam loop stream saat `cancelRequestedAt` terisi, supaya
 * `generate.ts` membedakan pembatalan pengguna dari galat gateway.
 */
export class StopRequested extends Error {
  constructor() {
    super("Generasi dihentikan oleh pengguna.");
    this.name = "StopRequested";
  }
}

export type RequestStopInput = {
  chatId: string;
  userId: string;
  generationId: string;
};

export type StopResult = {
  generationId: string;
  status: string;
};

/** Chat/generasi tidak ada ATAU milik pengguna lain → 404 yang sama (SDD-3.1). */
function notFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "GENERATION_NOT_FOUND",
    message: "Generasi tidak ditemukan.",
  });
}

/**
 * Catat permintaan berhenti.
 *
 * Idempoten: `cancelRequestedAt` hanya diisi bila masih `null` (klausa `where`),
 * jadi stop dua kali tidak mengubah nilai dan tidak melempar. Generasi yang
 * sudah terminal (`complete`/`stopped`/`error`/`indeterminate`) dibiarkan apa
 * adanya dan statusnya dikembalikan apa adanya.
 */
export async function requestStop(db: Db, input: RequestStopInput): Promise<StopResult> {
  const chat = await db.chat.findFirst({
    where: { id: input.chatId, userId: input.userId },
    select: { id: true },
  });
  if (!chat) throw notFound();

  const generation = await db.generation.findFirst({
    where: { id: input.generationId, chatId: input.chatId },
    select: { id: true, status: true },
  });
  if (!generation) throw notFound();

  await db.generation.updateMany({
    where: {
      id: generation.id,
      cancelRequestedAt: null,
      status: { in: [...RUNNING_STATUSES] },
    },
    data: { cancelRequestedAt: new Date() },
  });

  return { generationId: generation.id, status: generation.status };
}

/** `true` bila pembatalan diminta. Dipakai worker pada setiap potongan stream. */
export async function stopIfRequested(db: Db, generationId: string): Promise<boolean> {
  const row = await db.generation.findUnique({
    where: { id: generationId },
    select: { cancelRequestedAt: true },
  });
  return row?.cancelRequestedAt != null;
}
