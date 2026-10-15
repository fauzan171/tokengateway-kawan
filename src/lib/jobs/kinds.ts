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
  "chat.generate",
  "document.extract",
  "document.embed",
  "usage.aggregate",
  "storage.cleanup",
]);

export function isIdempotentKind(kind: string): boolean {
  return IDEMPOTENT.has(kind);
}
