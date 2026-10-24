/**
 * FIX-21: jadwal (timezone/DST/misfire), occurrence unik, notifikasi aman.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  SCHEDULE_LIMITS,
  claimOccurrence,
  formatInZone,
  nextOccurrence,
  notificationPreview,
  sweepDueSchedules,
  timezoneOffsetMs,
  validateScheduleInput,
  zonedTimeToUtc,
} from "./schedules";

let temp: TempDb;
let db: Db;
let userId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

describe("zonedTimeToUtc", () => {
  it("Jakarta (UTC+7) tengah malam lokal = 17:00 UTC hari sebelumnya", () => {
    const instant = zonedTimeToUtc("2026-11-01T00:00", "Asia/Jakarta");
    expect(instant.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  it("round-trip: instant diformat balik menghasilkan waktu lokal yang sama", () => {
    for (const local of ["2026-03-08T09:00", "2026-11-01T09:00", "2026-06-15T23:30"]) {
      const instant = zonedTimeToUtc(local, "America/New_York");
      expect(formatInZone(instant, "America/New_York")).toBe(local);
    }
  });

  it("jam yang tidak ada saat DST spring-forward digeser, bukan menghasilkan instant salah", () => {
    // 2026-03-08 02:30 tidak ada di New York (maju ke 03:00).
    const instant = zonedTimeToUtc("2026-03-08T02:30", "America/New_York");
    expect(formatInZone(instant, "America/New_York")).not.toBe("2026-03-08T02:30");
    expect(Number.isFinite(instant.getTime())).toBe(true);
  });

  it("format tidak sah ditolak", () => {
    expect(() => zonedTimeToUtc("2026-11-01", "Asia/Jakarta")).toThrow();
    expect(() => zonedTimeToUtc("besok pagi", "Asia/Jakarta")).toThrow();
  });
});

describe("timezoneOffsetMs", () => {
  it("positif untuk timur UTC, negatif untuk barat", () => {
    const instant = new Date("2026-06-15T00:00:00Z");
    expect(timezoneOffsetMs(instant, "Asia/Jakarta")).toBe(7 * 60 * 60_000);
    expect(timezoneOffsetMs(instant, "America/New_York")).toBe(-4 * 60 * 60_000);
    expect(timezoneOffsetMs(instant, "UTC")).toBe(0);
  });
});

describe("nextOccurrence", () => {
  it("sekali jalan → null", () => {
    expect(
      nextOccurrence(
        { localTime: "2026-11-01T09:00", timezone: "Asia/Jakarta", recurrence: null },
        new Date(),
      ),
    ).toBeNull();
  });

  it("harian melewati waktu yang sudah lewat", () => {
    const from = zonedTimeToUtc("2026-11-01T10:00", "Asia/Jakarta");
    const next = nextOccurrence(
      { localTime: "2026-11-01T09:00", timezone: "Asia/Jakarta", recurrence: "daily" },
      from,
    );
    expect(next).not.toBeNull();
    expect(formatInZone(next!, "Asia/Jakarta")).toBe("2026-11-02T09:00");
  });

  it("mingguan maju 7 hari dan tetap di jam lokal yang sama", () => {
    const from = zonedTimeToUtc("2026-11-01T09:00", "Asia/Jakarta");
    const next = nextOccurrence(
      { localTime: "2026-11-01T09:00", timezone: "Asia/Jakarta", recurrence: "weekly" },
      from,
    );
    expect(formatInZone(next!, "Asia/Jakarta")).toBe("2026-11-08T09:00");
  });

  it("melewati pergantian DST tanpa menggeser jam lokal", () => {
    // New York: 2026-03-08 02:00 → 03:00.
    const from = zonedTimeToUtc("2026-03-07T09:00", "America/New_York");
    const next = nextOccurrence(
      { localTime: "2026-03-07T09:00", timezone: "America/New_York", recurrence: "daily" },
      from,
    );
    expect(formatInZone(next!, "America/New_York")).toBe("2026-03-08T09:00");
  });
});

describe("validateScheduleInput", () => {
  const valid = {
    userId: "u",
    title: "Ringkasan harian",
    prompt: "Ringkas berita hari ini",
    localTime: "2026-11-01T09:00",
    timezone: "Asia/Jakarta",
    recurrence: "daily" as const,
  };

  it("input sah lolos", () => {
    expect(() => validateScheduleInput(valid)).not.toThrow();
  });

  it("judul/prompt kosong, waktu salah format, zona asing ditolak", () => {
    expect(() => validateScheduleInput({ ...valid, title: "  " })).toThrow(/Judul/);
    expect(() => validateScheduleInput({ ...valid, prompt: "" })).toThrow(/Prompt/);
    expect(() => validateScheduleInput({ ...valid, localTime: "besok" })).toThrow(/format/);
    expect(() => validateScheduleInput({ ...valid, timezone: "Mars/Olympus" })).toThrow(/Zona/);
  });
});

async function seedSchedule(overrides: Record<string, unknown> = {}): Promise<string> {
  const id = `sch_${randomUUID()}`;
  await db.schedule.create({
    data: {
      id,
      userId,
      title: "Ringkasan",
      prompt: "Ringkas",
      localTime: "2026-11-01T09:00",
      timezone: "Asia/Jakarta",
      recurrence: "daily",
      misfirePolicy: "skip",
      effect: "read",
      enabled: 1,
      nextRunAt: new Date("2026-11-01T02:00:00Z"),
      ...overrides,
    },
  });
  return id;
}

describe("claimOccurrence", () => {
  it("occurrence kedua untuk waktu yang sama → null (bukan ganda)", async () => {
    const scheduleId = await seedSchedule();
    const scheduledFor = new Date("2026-11-01T02:00:00Z");
    const first = await claimOccurrence(db, { scheduleId, scheduledFor });
    expect(first).not.toBeNull();
    const second = await claimOccurrence(db, { scheduleId, scheduledFor });
    expect(second).toBeNull();
    expect(await db.scheduleOccurrence.count({ where: { scheduleId } })).toBe(1);
  });
});

describe("sweepDueSchedules", () => {
  it("jadwal jatuh tempo membuat satu occurrence dan memajukan nextRunAt", async () => {
    const scheduleId = await seedSchedule();
    const now = new Date("2026-11-01T02:05:00Z");
    const result = await sweepDueSchedules(db, { now });
    expect(result.created).toBe(1);
    const row = await db.schedule.findUnique({ where: { id: scheduleId } });
    expect(row?.lastRunAt?.toISOString()).toBe("2026-11-01T02:00:00.000Z");
    expect(row?.nextRunAt?.toISOString()).toBe("2026-11-02T02:00:00.000Z");
  });

  it("dua sweep beruntun tidak menggandakan occurrence", async () => {
    await seedSchedule();
    const now = new Date("2026-11-01T02:05:00Z");
    await sweepDueSchedules(db, { now });
    await sweepDueSchedules(db, { now });
    expect(await db.scheduleOccurrence.count()).toBe(1);
  });

  it("misfire di luar toleransi dilewati (skip) dan tidak membuat occurrence", async () => {
    const scheduleId = await seedSchedule();
    const now = new Date("2026-11-01T06:00:00Z"); // 4 jam terlambat
    const result = await sweepDueSchedules(db, { now });
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(await db.scheduleOccurrence.count()).toBe(0);
    const row = await db.schedule.findUnique({ where: { id: scheduleId } });
    expect(row?.nextRunAt?.getTime()).toBeGreaterThan(now.getTime());
  });

  it("misfire dengan policy run tetap dijalankan", async () => {
    await seedSchedule({ misfirePolicy: "run" });
    const result = await sweepDueSchedules(db, { now: new Date("2026-11-01T06:00:00Z") });
    expect(result.created).toBe(1);
  });

  it("jadwal nonaktif diabaikan", async () => {
    await seedSchedule({ enabled: 0 });
    const result = await sweepDueSchedules(db, { now: new Date("2026-11-01T02:05:00Z") });
    expect(result.considered).toBe(0);
  });

  it("jadwal belum jatuh tempo tidak disentuh", async () => {
    await seedSchedule({ nextRunAt: new Date("2027-01-01T00:00:00Z") });
    const result = await sweepDueSchedules(db, { now: new Date("2026-11-01T02:05:00Z") });
    expect(result.considered).toBe(0);
  });

  it("toleransi misfire masuk akal", () => {
    expect(SCHEDULE_LIMITS.misfireGraceMs).toBe(15 * 60_000);
    expect(SCHEDULE_LIMITS.maxPerUser).toBeGreaterThan(0);
  });
});

describe("notificationPreview", () => {
  it("isi sensitif diganti ringkasan umum", () => {
    const preview = notificationPreview({
      title: "Hasil lab",
      body: "Kadar gula 200 mg/dL",
      sensitive: true,
    });
    expect(preview.body).not.toContain("200");
    expect(preview.title).toBe("Tugas selesai");
  });

  it("isi tidak sensitif diteruskan apa adanya", () => {
    const preview = notificationPreview({ title: "Selesai", body: "Laporan siap", sensitive: false });
    expect(preview).toEqual({ title: "Selesai", body: "Laporan siap" });
  });
});
