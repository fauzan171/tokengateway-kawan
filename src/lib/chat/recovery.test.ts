import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import { claim, fail, releaseExpired } from "@/lib/jobs/queue";
import { createChat } from "./chats";
import { sendMessage } from "./messages";
import { reconcileGenerations } from "./recovery";

let temp: TempDb;
beforeEach(async () => { temp = await createTempDb(); });
afterEach(async () => { await temp.cleanup(); });

for (const reason of ["expired", "failed"] as const) {
  it(`job ${reason}: tutup generasi, simpan partial, satu error dan tidak ada retry`, async () => {
    const db = temp.db;
    const userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `${userId}@test.invalid` } });
    const chat = await createChat(db, { userId });
    const sent = await sendMessage(db, { userId, chatId: chat.id, content: "halo", parentId: null, model: "test", idempotencyKey: null });
    const generation = await db.generation.findUniqueOrThrow({ where: { id: sent.generationId } });
    const held = await claim(db, { workerId: "test-worker", id: generation.jobId!, leaseMs: 0 });
    await db.chatMessagePart.create({ data: { id: randomUUID(), messageId: sent.assistantMessageId, kind: "text", payloadJson: JSON.stringify({ text: "jawaban parsial" }), ordinal: 0 } });
    if (reason === "expired") await releaseExpired(db, new Date(Date.now() + 1000));
    else await fail(db, held!, new Error("transport lost"));
    await reconcileGenerations(db);
    await reconcileGenerations(db);
    expect(await db.generation.findUniqueOrThrow({ where: { id: sent.generationId } })).toMatchObject({ status: "indeterminate", errorCode: "WORKER_INTERRUPTED" });
    const message = await db.chatMessage.findUniqueOrThrow({ where: { id: sent.assistantMessageId } });
    expect(message.status).toBe("error");
    expect(JSON.parse(message.contentJson)).toEqual({ parts: [{ kind: "text", text: "jawaban parsial" }] });
    expect(await db.generationEvent.count({ where: { generationId: sent.generationId, kind: "error" } })).toBe(1);
    expect(await claim(db, { workerId: "next-worker", id: generation.jobId! })).toBeNull();
  });
}

it("tidak menulis error setelah done yang sudah persisten sebelum worker crash", async () => {
  const db = temp.db;
  const userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@test.invalid` } });
  const chat = await createChat(db, { userId });
  const sent = await sendMessage(db, { userId, chatId: chat.id, content: "halo", parentId: null, model: "test", idempotencyKey: null });
  const generation = await db.generation.findUniqueOrThrow({ where: { id: sent.generationId } });
  await db.job.update({ where: { id: generation.jobId! }, data: { state: "indeterminate" } });
  await db.generationEvent.create({ data: { id: randomUUID(), generationId: generation.id, seq: 1, kind: "done", payloadJson: JSON.stringify({ status: "complete" }) } });
  await reconcileGenerations(db);
  expect(await db.generation.findUniqueOrThrow({ where: { id: generation.id } })).toMatchObject({ status: "complete" });
  expect(await db.generationEvent.count({ where: { generationId: generation.id } })).toBe(1);
});
