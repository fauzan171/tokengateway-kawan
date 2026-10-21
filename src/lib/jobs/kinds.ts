/**
 * Jenis job dan sifatnya (SDD-8.1).
 *
 * `idempotent: false` berarti menjalankan ulang job bisa menghasilkan efek
 * ganda (panggilan berbayar, kirim surel). Lease yang kedaluwarsa untuk kind
 * seperti ini tidak boleh dikembalikan ke `queued`: hasil percobaan
 * sebelumnya tidak diketahui, jadi statusnya `indeterminate` dan menunggu
 * keputusan operator.
 */

export const JOB_KINDS = [
  "chat.generate",
  "document.extract",
  "document.embed",
  "usage.aggregate",
  "storage.cleanup",
  "email.send",
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

const IDEMPOTENT: ReadonlySet<string> = new Set<JobKind>([
  "document.extract",
  "usage.aggregate",
  "storage.cleanup",
]);

export function isIdempotentKind(kind: string): boolean {
  return IDEMPOTENT.has(kind);
}

/**
 * Kind yang benar-benar punya handler di worker (FIX-24/T14).
 *
 * `JOB_KINDS` adalah daftar kontrak yang dikenal; daftar ini adalah yang
 * benar-benar dijalankan proses worker saat ini. `enqueue` menolak kind di luar
 * sini supaya job tidak pernah mengendap `queued` tanpa penangan.
 */
export const HANDLED_KINDS = [
  "chat.generate",
  "document.extract",
  "storage.cleanup",
] as const;

export type HandledKind = (typeof HANDLED_KINDS)[number];

/** Kind yang dikenal kontrak (boleh diantrekan), terlepas dari handler. */
export function isKnownKind(kind: string): kind is JobKind {
  return (JOB_KINDS as readonly string[]).includes(kind);
}

export function isHandledKind(kind: string): kind is HandledKind {
  return (HANDLED_KINDS as readonly string[]).includes(kind);
}
