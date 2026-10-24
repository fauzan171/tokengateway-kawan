import { describe, it, expect, beforeEach } from "vitest";
import { createTempDb, TempDb } from "../../../tests/helpers/auth-db";

let mod: typeof import("./retrieve");
let db: TempDb;
const d = () => db.db;
const userId = "u1";

beforeEach(async () => {
  mod = await import("./retrieve");
  db = await createTempDb();
  await d().user.create({ data: { id: userId, email: "u1@t.id" } });
});

describe("FIX-06: retrieval bounded", () => {
  it("chatId mengunci kandidat ke manifest ChatDocument", async () => {
    const chatA = await d().chat.create({ data: { id: "chatA", userId, title: "A" } });
    const chatB = await d().chat.create({ data: { id: "chatB", userId, title: "B" } });
    for (const [docId, chatId] of [["docA", chatA.id], ["docB", chatB.id]] as const) {
      await d().document.create({ data: { id: docId, userId, filename: docId, mime: "text/plain", sizeBytes: 1, storageKey: docId } });
      await d().chatDocument.create({ data: { id: `m_${docId}`, chatId, documentId: docId, ownerId: userId } });
      await d().documentChunk.create({ data: { id: `c_${docId}`, documentId: docId, page: null, ordinal: 0, text: "gurita jakarta kantor pusat", embedding: null } });
    }
    const hits = await mod.retrieveChunks(db.db, { userId, chatId: chatA.id, query: "gurita jakarta", limit: 4 });
    expect(hits.every((h) => h.documentId === "docA")).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("skor di bawah RAG_MIN_SCORE ditolak", async () => {
    await d().chat.create({ data: { id: "chatZ", userId, title: "Z" } });
    await d().document.create({ data: { id: "docZ", userId, filename: "z", mime: "text/plain", sizeBytes: 1, storageKey: "z" } });
    await d().chatDocument.create({ data: { id: "mZ", chatId: "chatZ", documentId: "docZ", ownerId: userId } });
    await d().documentChunk.create({ data: { id: "cZ", documentId: "docZ", page: null, ordinal: 0, text: "memasak rendang padang", embedding: null } });
    const hits = await mod.retrieveChunks(db.db, { userId, chatId: "chatZ", query: "gurita jakarta kantor", limit: 4 });
    expect(hits).toHaveLength(0);
  });
});
