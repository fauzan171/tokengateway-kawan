/**
 * D4 — onboarding fokus: snapshot ke configJson run (SDD-BACKEND §D4).
 *
 * Yang dibuktikan: admission & follow-up menyimpan `focus` ke configJson run
 * dari setting user DI DALAM transaksi; nilai onboarding tak valid ditolak
 * 400 INVALID_SETTING; run lama / belum dijawab → focus null; perubahan
 * setting setelah submit tidak mengubah snapshot run yang sudah ada.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import { ApiError } from "@/lib/api/errors";
import { writeSettings } from "@/lib/settings/settings";
import { createTask, followUp } from "./tasks";

let temp: TempDb;

beforeAll(async () => {
  temp = await createTempDb();
  await temp.db.user.create({ data: { id: "uA", email: "a@d4.test" } });
});

afterAll(async () => {
  await temp.cleanup();
});

async function admission(input = "Riset pasar gurita Jakarta") {
  return createTask(temp.db, { userId: "uA", input, idempotencyKey: null });
}

async function focusOf(runId: string) {
  const run = await temp.db.taskRun.findUniqueOrThrow({
    where: { id: runId },
    select: { configJson: true },
  });
  const parsed = JSON.parse(run.configJson ?? "null") as { schemaVersion: number; focus: unknown };
  return parsed;
}

describe("D4 — fokus onboarding ke configJson run", () => {
  it("menyimpan fokus preset ke configJson run saat submit", async () => {
    await temp.db.userSetting.upsert({
      where: { userId: "uA" },
      create: { userId: "uA", onboarding: "riset" },
      update: { onboarding: "riset" },
    });

    const { runId } = await admission();
    expect(await focusOf(runId)).toEqual({ schemaVersion: 1, focus: "riset" });
  });

  it("menyimpan fokus custom (≤200 char) apa adanya", async () => {
    const { runId } = await writeSettings(temp.db, "uA", { onboarding: "custom:Analis dampak iklim Jakarta" })
      .then(() => admission());

    expect(await focusOf(runId)).toEqual({
      schemaVersion: 1,
      focus: "custom:Analis dampak iklim Jakarta",
    });
  });

  it("user belum menjawab → configJson.focus null dan run tetap valid", async () => {
    await temp.db.userSetting.upsert({
      where: { userId: "uA" },
      create: { userId: "uA", onboarding: "" },
      update: { onboarding: "" },
    });

    const { runId } = await admission();
    const config = await focusOf(runId);
    expect(config.focus).toBeNull();
    expect(config.schemaVersion).toBe(1);
  });

  it("perubahan setting setelah submit tidak mengubah configJson run lama", async () => {
    await temp.db.userSetting.upsert({
      where: { userId: "uA" },
      create: { userId: "uA", onboarding: "tulis" },
      update: { onboarding: "tulis" },
    });

    const { runId } = await admission("Riset awal sebelum ganti fokus");
    expect((await focusOf(runId)).focus).toBe("tulis");

    await writeSettings(temp.db, "uA", { onboarding: "data" });

    expect((await focusOf(runId)).focus).toBe("tulis");
  });

  it("follow-up membawa fokus saat itu, bukan nilai run lama", async () => {
    await temp.db.userSetting.upsert({
      where: { userId: "uA" },
      create: { userId: "uA", onboarding: "campur" },
      update: { onboarding: "campur" },
    });

    const first = await admission("Riset awal untuk follow-up");
    // Run pertama dibuat terminal agar follow-up diizinkan.
    await temp.db.taskRun.update({
      where: { id: first.runId },
      data: { status: "completed" },
    });

    await writeSettings(temp.db, "uA", { onboarding: "data" });
    const next = await followUp(temp.db, {
      userId: "uA",
      taskId: first.taskId,
      input: "Lanjutkan dengan fokus baru",
      idempotencyKey: null,
    });

    expect((await focusOf(first.runId)).focus).toBe("campur");
    expect((await focusOf(next.id)).focus).toBe("data");
  });
});

describe("D4 — validasi onboarding", () => {
  it("nilai tak valid ditolak 400 INVALID_SETTING dengan pesan jelas", async () => {
    await expect(writeSettings(temp.db, "uA", { onboarding: "ngawur" })).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(writeSettings(temp.db, "uA", { onboarding: "ngawur" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_SETTING",
      message: expect.stringContaining("onboarding"),
    });
  });

  it("custom kosong / kepanjangan ditolak", async () => {
    await expect(writeSettings(temp.db, "uA", { onboarding: "custom:" })).rejects.toMatchObject({
      code: "INVALID_SETTING",
    });
    await expect(
      writeSettings(temp.db, "uA", { onboarding: `custom:${"x".repeat(201)}` }),
    ).rejects.toMatchObject({ code: "INVALID_SETTING" });
  });

  it("karakter kontrol dibuang dari teks custom", async () => {
    const saved = await writeSettings(temp.db, "uA", { onboarding: "custom:a\u0007b\u001fc" });
    expect(saved.onboarding).toBe("custom:abc");
  });

  it("round-trip: nilai valid tersimpan dan terbaca kembali", async () => {
    await writeSettings(temp.db, "uA", { onboarding: "data" });
    const row = await temp.db.userSetting.findUniqueOrThrow({ where: { userId: "uA" } });
    expect(row.onboarding).toBe("data");
  });

  it("idempotensi acak: userId berbeda tidak saling bocor fokus", async () => {
    const other = randomUUID();
    await temp.db.user.create({ data: { id: other, email: `${other}@d4.test` } });
    await writeSettings(temp.db, other, { onboarding: "tulis" });

    const row = await temp.db.userSetting.findUniqueOrThrow({ where: { userId: other } });
    expect(row.onboarding).toBe("tulis");
  });
});