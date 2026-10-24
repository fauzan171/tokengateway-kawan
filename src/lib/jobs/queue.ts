/**
 * Antrean job berbasis tabel (SDD-8.2).
 *
 * Klaim memakai UPDATE bersyarat: `where` mencakup `state='queued'`, jadi
 * bila dua worker mengklaim job yang sama, satu `updateMany` mendapat
 * `count: 1` dan yang lain `count: 0`. Tidak ada transaksi eksplisit dan
 * tidak ada Redis; pemilihan pemenang diserahkan ke atomicity satu statement
 * database, yang berlaku sama di SQLite maupun PostgreSQL.
 *
 * Lease dijaga heartbeat dan boleh kedaluwarsa supaya worker yang mati tidak
 * menyandera job. Job yang lease-nya habis dikembalikan ke `queued` hanya
 * bila kind-nya idempoten; selain itu `indeterminate` (SDD-8.1).
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import { isKnownKind, isIdempotentKind, type JobKind } from "./kinds";

/** Lease default. Heartbeat memperpanjangnya sebelum habis. */
export const LEASE_MS = 60_000;
export const HEARTBEAT_MS = 20_000;

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export type Claim = {
  id: string;
  kind: string;
  payloadJson: string;
  attempts: number;
  maxAttempts: number;
  leaseToken: string;
};

/** Backoff eksponensial dengan jitter (SDD-8.2). Jitter mencegah job yang
 *  gagal bersamaan mencoba lagi bersamaan pula. */
export function backoffMs(attempts: number, random = Math.random): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  return Math.round(exponential * (0.5 + random() * 0.5));
}

export type EnqueueInput = {
  id?: string;
  kind: JobKind | string;
  payload: unknown;
  maxAttempts?: number;
  /** Job baru ditahan sampai waktu ini (mis. hasil backoff). */
  availableAt?: Date;
};

export async function enqueue(db: Db, input: EnqueueInput): Promise<string> {
  // Kind di luar kontrak `JOB_KINDS` adalah salah ketik pemanggil: tolak di
  // sini, jangan biarkan mengendap `queued` tanpa pernah diklaim (FIX-24/T14).
  // Kind yang dikenal tetapi belum ber-handler ditolak saat worker start.
  if (!isKnownKind(input.kind)) {
    throw new Error(`Kind job "${input.kind}" tidak dikenal.`);
  }
  const id = input.id ?? randomUUID();
  await db.job.create({
    data: {
      id,
      kind: input.kind,
      payloadJson: JSON.stringify(input.payload ?? {}),
      state: "queued",
      maxAttempts: input.maxAttempts ?? 3,
      availableAt: input.availableAt ?? new Date(),
    },
  });
  return id;
}

export type ClaimOptions = {
  workerId: string;
  /** Job yang tersedia setelah waktu ini boleh diklaim. */
  now?: Date;
  leaseMs?: number;
  /** Job id tertentu; tanpa ini, job tersedia paling lama diambil. */
  id?: string;
};

/**
 * Mengklaim satu job. `null` bila tidak ada job tersedia atau job sudah
 * diklaim pihak lain.
 */
export async function claim(db: Db, options: ClaimOptions): Promise<Claim | null> {
  const now = options.now ?? new Date();

  // Kandidat dipilih lalu diklaim dengan syarat yang sama persis. Bila kalah
  // balapan, kandidat berikutnya dicoba; batasnya menjaga worker yang selalu
  // kalah tidak berputar tanpa henti.
  for (let round = 0; round < 3; round += 1) {
    // `orderBy` menuaikan job terlama supaya antrean tidak kelaparan.
    const candidate = await db.job.findFirst({
      where: {
        ...(options.id ? { id: options.id } : {}),
        state: "queued",
        availableAt: { lte: now },
        attempts: { lt: db.job.fields.maxAttempts },
      },
      orderBy: { availableAt: "asc" },
      select: { id: true },
    });
    if (!candidate) return null;

    const leaseToken = randomUUID();
    const claimed = await db.job.updateMany({
      where: { id: candidate.id, state: "queued" },
      data: {
        state: "leased",
        leaseOwner: options.workerId,
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + (options.leaseMs ?? LEASE_MS)),
        heartbeatAt: now,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) continue;

    const job = await db.job.findUniqueOrThrow({ where: { id: candidate.id } });
    return {
      id: job.id,
      kind: job.kind,
      payloadJson: job.payloadJson,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      leaseToken,
    };
  }

  return null;
}

/** Menandai job mulai dikerjakan. Tidak wajib; `leased` sudah cukup untuk
 *  menyatakan kepemilikan. Lease yang sudah kedaluwarsa tidak dihidupkan. */
export async function markRunning(db: Db, claim: Claim, now = new Date()): Promise<boolean> {
  const { count } = await db.job.updateMany({
    where: {
      id: claim.id,
      leaseToken: claim.leaseToken,
      state: "leased",
      leaseExpiresAt: { gt: now },
    },
    data: { state: "running" },
  });
  return count === 1;
}

/**
 * Memperpanjang lease. `false` berarti lease sudah hilang (kedaluwarsa atau
 * diambil alih), dan worker harus berhenti.
 *
 * `leaseExpiresAt: { gt: now }` adalah bagian penting: heartbeat yang datang
 * terlambat tidak boleh menghidupkan kembali lease mati, karena job itu sudah
 * boleh diklaim worker lain (FIX-02).
 */
export async function heartbeat(
  db: Db,
  claim: Claim,
  leaseMs = LEASE_MS,
  now = new Date(),
): Promise<boolean> {
  const { count } = await db.job.updateMany({
    where: {
      id: claim.id,
      leaseToken: claim.leaseToken,
      state: { in: ["leased", "running"] },
      leaseExpiresAt: { gt: now },
    },
    data: { heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs) },
  });
  return count === 1;
}

/** Lease yang sudah kedaluwarsa tidak boleh menutup job sebagai sukses. */
export async function complete(db: Db, claim: Claim, now = new Date()): Promise<boolean> {
  const { count } = await db.job.updateMany({
    where: {
      id: claim.id,
      leaseToken: claim.leaseToken,
      state: { in: ["leased", "running"] },
      leaseExpiresAt: { gt: now },
    },
    data: { state: "succeeded", finishedAt: now, leaseOwner: null, leaseToken: null, leaseExpiresAt: null },
  });
  return count === 1;
}

export type FailOptions = {
  now?: Date;
  /** Dipaksa `indeterminate` bila efek percobaan sebelumnya tidak diketahui. */
  indeterminate?: boolean;
  random?: () => number;
};

/**
 * Menandai percobaan gagal. Selama masih ada sisa percobaan, job kembali
 * `queued` dengan backoff; kalau habis, `failed`. Job non-idempoten yang
 * efeknya tidak diketahui masuk `indeterminate` tanpa percobaan ulang.
 */
export async function fail(
  db: Db,
  claim: Claim,
  error: unknown,
  options: FailOptions = {},
): Promise<string> {
  const now = options.now ?? new Date();
  const message = error instanceof Error ? error.message : String(error);

  const indeterminate = options.indeterminate === true || !isIdempotentKind(claim.kind);
  const exhausted = claim.attempts >= claim.maxAttempts;

  const state = indeterminate ? "indeterminate" : exhausted ? "failed" : "queued";
  const availableAt =
    state === "queued"
      ? new Date(now.getTime() + backoffMs(claim.attempts, options.random))
      : undefined;

  await db.job.updateMany({
    where: { id: claim.id, leaseToken: claim.leaseToken },
    data: {
      state,
      lastError: message.slice(0, 2000),
      ...(availableAt ? { availableAt } : {}),
      ...(state === "queued" ? {} : { finishedAt: now }),
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  return state;
}

/**
 * Mengembalikan job yang lease-nya kedaluwarsa. Job idempoten kembali
 * `queued`; yang tidak idempoten jadi `indeterminate` supaya tidak
 * dijalankan ulang tanpa pemeriksaan (SDD-8.1).
 */
export async function releaseExpired(db: Db, now = new Date()): Promise<{ requeued: number; indeterminate: number }> {
  const expired = await db.job.findMany({
    where: {
      state: { in: ["leased", "running"] },
      leaseExpiresAt: { lt: now },
    },
    select: { id: true, kind: true },
  });
  if (expired.length === 0) return { requeued: 0, indeterminate: 0 };

  let requeued = 0;
  let indeterminate = 0;

  for (const job of expired) {
    const idempotent = isIdempotentKind(job.kind);
    const { count } = await db.job.updateMany({
      where: { id: job.id, state: { in: ["leased", "running"] }, leaseExpiresAt: { lt: now } },
      data: {
        state: idempotent ? "queued" : "indeterminate",
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: `lease kedaluwarsa pada ${now.toISOString()}`,
      },
    });
    if (count === 0) continue;
    if (idempotent) requeued += 1;
    else indeterminate += 1;
  }

  return { requeued, indeterminate };
}
