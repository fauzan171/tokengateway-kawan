/**
 * Jadwal, occurrence, dan notifikasi (FIX-21).
 *
 * Tiga hal yang membuat penjadwalan salah, dan bagaimana dihindari di sini:
 *
 * 1. **Dua scheduler menghasilkan dua run.** Occurrence punya kunci unik
 *    `(scheduleId, scheduledFor)`; pembuatan memakai `create` di dalam try yang
 *    menangkap pelanggaran unik, jadi yang kalah balapan mendapat `null` —
 *    bukan membuat job kedua.
 * 2. **Restart/DST menggeser jadwal.** Waktu dihitung dari `nextRunAt` yang
 *    tersimpan (UTC) + zona IANA, bukan dari `setInterval`. Jam lokal yang
 *    tidak ada (DST spring-forward) digeser ke waktu berikutnya yang sah.
 * 3. **Misfire menumpuk.** Kebijakan bawaan `skip`: occurrence yang terlewat
 *    lebih dari jendela toleransi dilewati dan `nextRunAt` dilompatkan, bukan
 *    dijalankan beruntun.
 *
 * Yang tidak dijanjikan: alarm tepat detik. Sweeper berjalan berkala; perangkat
 * yang mati tidak "membangunkan" apa pun.
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";

/** Batas jadwal per pengguna; mencegah satu akun membanjiri antrean. */
export const SCHEDULE_LIMITS = {
  maxPerUser: 50,
  /** Toleransi keterlambatan sebelum occurrence dianggap misfire. */
  misfireGraceMs: 15 * 60_000,
  /** Jendela maksimum untuk recurrence harian/mingguan. */
  maxHorizonMs: 366 * 24 * 60 * 60_000,
} as const;

export type MisfirePolicy = "skip" | "run";

export type ScheduleInput = {
  userId: string;
  title: string;
  /** Prompt yang dijalankan saat jadwal berbunyi. */
  prompt: string;
  /** Waktu lokal ISO tanpa zona, mis. "2026-11-01T09:00". */
  localTime: string;
  /** Zona IANA, mis. "Asia/Jakarta". */
  timezone: string;
  /** null = sekali jalan; "daily"/"weekly" = berulang. */
  recurrence: "daily" | "weekly" | null;
  misfirePolicy?: MisfirePolicy;
  /** Target aksi; `read` boleh otomatis, selain itu butuh approval per occurrence. */
  effect?: "read" | "write";
};

/**
 * Hitung instant UTC untuk waktu lokal di zona tertentu.
 *
 * `Intl` dipakai sebagai sumber aturan zona (termasuk DST), bukan tabel offset
 * tulisan tangan. Jam lokal yang tidak ada (spring-forward) digeser maju satu
 * jam sampai valid; yang ambigu (fall-back) memilih kemunculan pertama.
 */
export function zonedTimeToUtc(localTime: string, timezone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localTime);
  if (!match) throw new Error("Waktu lokal harus berformat YYYY-MM-DDTHH:mm.");
  const [, year, month, day, hour, minute, second = "00"] = match;
  const parts = [year, month, day, hour, minute, second].map((value) => Number(value));

  // Tebak dari UTC lalu koreksi dengan offset sebenarnya pada instant itu.
  let candidate = Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, parts[3]!, parts[4]!, parts[5]!);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = timezoneOffsetMs(new Date(candidate), timezone);
    const adjusted = Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, parts[3]!, parts[4]!, parts[5]!) - offset;
    if (adjusted === candidate) break;
    candidate = adjusted;
  }
  // Verifikasi: instant yang dihasilkan harus benar-benar menunjukkan jam lokal
  // yang diminta. Kalau tidak (jam tidak ada karena DST), maju satu jam.
  for (let guard = 0; guard < 4; guard += 1) {
    const local = formatInZone(new Date(candidate), timezone);
    if (local === `${localTime.slice(0, 10)}T${localTime.slice(11, 16)}`) return new Date(candidate);
    candidate += 60 * 60_000;
  }
  return new Date(candidate);
}

/** Offset zona (menit) pada instant tertentu; positif untuk timur UTC. */
export function timezoneOffsetMs(instant: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"]) % 24,
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  return asUtc - instant.getTime();
}

/** Format instant ke "YYYY-MM-DDTHH:mm" di zona tertentu. */
export function formatInZone(instant: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const hour = String(Number(parts["hour"]) % 24).padStart(2, "0");
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}T${hour}:${parts["minute"]}`;
}

/** Jadwal berikutnya setelah `from`; `null` bila sekali jalan. */
export function nextOccurrence(
  input: { localTime: string; timezone: string; recurrence: "daily" | "weekly" | null },
  from: Date,
): Date | null {
  if (!input.recurrence) return null;
  const days = input.recurrence === "daily" ? 1 : 7;
  const timeOfDay = input.localTime.slice(11, 16);

  // Aritmetika dilakukan pada TANGGAL LOKAL, bukan dengan menambah 24 jam ke
  // instant UTC: menambah 24 jam UTC menggeser jam lokal satu jam setiap
  // pergantian DST (bug yang ditemukan tes). Tanggal lokal ditambah, lalu
  // instant dihitung ulang lewat `zonedTimeToUtc` yang sudah menangani DST.
  const [year, month, day] = input.localTime.slice(0, 10).split("-").map(Number);
  let cursor = new Date(Date.UTC(year!, month! - 1, day!));
  let next = zonedTimeToUtc(`${cursor.toISOString().slice(0, 10)}T${timeOfDay}`, input.timezone);
  let guard = 0;
  while (next.getTime() <= from.getTime() && guard < 800) {
    cursor = new Date(cursor.getTime() + days * 24 * 60 * 60_000);
    next = zonedTimeToUtc(`${cursor.toISOString().slice(0, 10)}T${timeOfDay}`, input.timezone);
    guard += 1;
  }
  return next;
}

export type ScheduleRow = {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  localTime: string;
  timezone: string;
  recurrence: string | null;
  misfirePolicy: string;
  effect: string;
  enabled: number;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  policyRevision: number;
  createdAt: Date;
};

/** Validasi input jadwal; pesan galat menyebut apa yang salah. */
export function validateScheduleInput(input: ScheduleInput): void {
  if (!input.title.trim()) throw new Error("Judul jadwal tidak boleh kosong.");
  if (!input.prompt.trim()) throw new Error("Prompt jadwal tidak boleh kosong.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input.localTime)) {
    throw new Error("Waktu lokal harus berformat YYYY-MM-DDTHH:mm.");
  }
  // Zona divalidasi oleh Intl: sumber aturan yang sama dengan runtime.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
  } catch {
    throw new Error("Zona waktu tidak dikenal.");
  }
}

/**
 * Buat occurrence untuk sebuah jadwal. Unik per `(scheduleId, scheduledFor)`:
 * pemanggil kedua mendapat `null` alih-alih occurrence ganda.
 */
export async function claimOccurrence(
  db: Db,
  input: { scheduleId: string; scheduledFor: Date; now?: Date },
): Promise<{ occurrenceId: string } | null> {
  const now = input.now ?? new Date();
  const id = `occ_${randomUUID()}`;
  try {
    await db.scheduleOccurrence.create({
      data: {
        id,
        scheduleId: input.scheduleId,
        scheduledFor: input.scheduledFor,
        status: "pending",
        createdAt: now,
      },
    });
    return { occurrenceId: id };
  } catch {
    // Pelanggaran unik = occurrence sudah dibuat scheduler lain. Bukan galat.
    return null;
  }
}

/**
 * Sweep jadwal yang sudah jatuh tempo. `skip` melewati occurrence yang lewat
 * jendela toleransi (dan memajukan `nextRunAt`), `run` menjalankannya sekali.
 */
export async function sweepDueSchedules(
  db: Db,
  options: { now?: Date; limit?: number } = {},
): Promise<{ created: number; skipped: number; considered: number }> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 50;
  // Flag disimpan Int 0/1 supaya portabel SQLite+PostgreSQL.
  const due = await db.schedule.findMany({
    where: { enabled: 1, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let created = 0;
  let skipped = 0;
  for (const schedule of due) {
    const scheduledFor = schedule.nextRunAt;
    if (!scheduledFor) continue;
    const late = now.getTime() - scheduledFor.getTime();

    if (schedule.misfirePolicy === "skip" && late > SCHEDULE_LIMITS.misfireGraceMs) {
      skipped += 1;
      await db.schedule.updateMany({
        where: { id: schedule.id, nextRunAt: scheduledFor },
        data: {
          nextRunAt: nextOccurrence(
            {
              localTime: schedule.localTime,
              timezone: schedule.timezone,
              recurrence: schedule.recurrence as "daily" | "weekly" | null,
            },
            now,
          ),
          lastRunAt: schedule.lastRunAt,
        },
      });
      continue;
    }

    const occurrence = await claimOccurrence(db, { scheduleId: schedule.id, scheduledFor, now });
    if (!occurrence) continue;
    created += 1;
    await db.schedule.updateMany({
      where: { id: schedule.id, nextRunAt: scheduledFor },
      data: {
        lastRunAt: scheduledFor,
        nextRunAt: nextOccurrence(
          {
            localTime: schedule.localTime,
            timezone: schedule.timezone,
            recurrence: schedule.recurrence as "daily" | "weekly" | null,
          },
          now,
        ),
      },
    });
  }
  return { created, skipped, considered: due.length };
}

export type NotificationRow = {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  /** Teks sensitif tidak ditampilkan di lockscreen/notifikasi sistem. */
  sensitive: boolean;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Teks notifikasi yang aman. Bila `sensitive`, isi diganti ringkasan umum —
 * isi asli tetap di aplikasi setelah pengguna membuka.
 */
export function notificationPreview(input: {
  title: string;
  body: string;
  sensitive: boolean;
}): { title: string; body: string } {
  if (!input.sensitive) return { title: input.title, body: input.body };
  return {
    title: "Tugas selesai",
    body: "Buka Kawan untuk melihat hasilnya.",
  };
}
