/**
 * Uji retrieval + isolasi lintas pengguna (WP-NT-P6-06, REQ-NT-56, REQ-NT-58).
 *
 * `embedChunks` diganti tiruan supaya mode vektor teruji tanpa jaringan.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string) => url,
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

vi.mock("./embed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./embed")>();
  return { ...actual, embedChunks: vi.fn() };
});

const { embedChunks, encodeVector } = await import("./embed");
const { retrieveChunks } = await import("./retrieve");

const embedMock = vi.mocked(embedChunks);
const CONFIG = { baseUrl: "https://embed.test/v1", apiKey: "k", model: "m" };

let temp: TempDb;
let db: Db;
let userA: string;
let userB: string;
let docA: string;
let docB: string;

beforeEach(async () => {
  embedMock.mockReset();
  temp = await createTempDb();
  db = temp.db;
  userA = randomUUID();
  userB = randomUUID();
  await db.user.createMany({
    data: [
      { id: userA, email: `${userA}@contoh.test` },
      { id: userB, email: `${userB}@contoh.test` },
    ],
  });
  docA = await seedDoc(userA, "milik-a.pdf", [
    { ordinal: 0, text: "Anggaran rumah tangga tahun ini naik." },
    { ordinal: 1, text: "Catatan rapat tanpa kata kunci." },
  ]);
  docB = await seedDoc(userB, "milik-b.pdf", [
    { ordinal: 0, text: "Anggaran rumah tangga tahun ini naik." },
  ]);
});

afterAll(async () => {
  await temp.cleanup();
});

async function seedDoc(
  userId: string,
  filename: string,
  chunks: { ordinal: number; text: string; embedding?: string }[],
): Promise<string> {
  const id = `doc_${randomUUID()}`;
  await db.document.create({
    data: { id, userId, filename, mime: "text/plain", sizeBytes: 1, storageKey: `k/${id}` },
  });
  await db.documentChunk.createMany({
    data: chunks.map((chunk) => ({ id: `chk_${randomUUID()}`, documentId: id, page: 1, ...chunk })),
  });
  return id;
}

describe("retrieveChunks — kata kunci", () => {
  it("chunk relevan pengguna sendiri terambil dengan skor > 0", async () => {
    const results = await retrieveChunks(db, { userId: userA, query: "anggaran rumah" });
    expect(results).toHaveLength(1);
    expect(results[0]?.documentId).toBe(docA);
    expect(results[0]?.filename).toBe("milik-a.pdf");
    expect(results[0]?.score).toBe(1);
  });

  it("TIDAK membocorkan chunk pengguna lain walau query sangat cocok", async () => {
    const results = await retrieveChunks(db, { userId: userA, query: "anggaran rumah tangga" });
    expect(results.map((r) => r.documentId)).not.toContain(docB);
    expect(results.every((r) => r.documentId === docA)).toBe(true);
  });

  it("documentIds milik pengguna lain diabaikan", async () => {
    const results = await retrieveChunks(db, {
      userId: userA,
      query: "anggaran rumah",
      documentIds: [docB],
    });
    expect(results).toEqual([]);
  });

  it("documentIds sendiri tetap bekerja", async () => {
    const results = await retrieveChunks(db, {
      userId: userA,
      query: "anggaran rumah",
      documentIds: [docA],
    });
    expect(results.map((r) => r.documentId)).toEqual([docA]);
  });

  it("limit diklamp ke 8 dan menghormati nilai kecil", async () => {
    const texts = Array.from({ length: 12 }, (_, i) => ({ ordinal: i, text: `kata ${i}` }));
    await seedDoc(userA, "banyak.pdf", texts);

    expect((await retrieveChunks(db, { userId: userA, query: "kata", limit: 50 })).length).toBe(8);
    expect((await retrieveChunks(db, { userId: userA, query: "kata", limit: 1 })).length).toBe(1);
  });

  it("query kosong mengembalikan [] tanpa menyentuh database", async () => {
    const spy = vi.spyOn(db.documentChunk, "findMany");
    expect(await retrieveChunks(db, { userId: userA, query: "   " })).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("retrieveChunks — vektor", () => {
  it("chunk dengan embedding paling mirip menang; tanpa embedding dilewati", async () => {
    const docV = await seedDoc(userA, "vektor.pdf", [
      { ordinal: 0, text: "dekat", embedding: encodeVector([1, 0, 0]) },
      { ordinal: 1, text: "jauh", embedding: encodeVector([0, 1, 0]) },
      { ordinal: 2, text: "tanpa embedding" },
    ]);
    embedMock.mockResolvedValue([{ ordinal: 0, embedding: encodeVector([1, 0, 0]) }]);

    const results = await retrieveChunks(db, {
      userId: userA,
      query: "apa saja",
      embedding: CONFIG,
    });

    expect(results.map((r) => r.documentId)).toEqual([docV]);
    expect(results[0]?.text).toBe("dekat");
    expect(results[0]?.score).toBeCloseTo(1);
    // "jauh" berskor 0 (ortogonal) dan "tanpa embedding" tidak pernah diambil.
    expect(results).toHaveLength(1);
    expect(embedMock).toHaveBeenCalledTimes(1);
  });

  it("vektor tetap terisolasi per pengguna", async () => {
    await seedDoc(userB, "vektor-b.pdf", [
      { ordinal: 0, text: "punya b", embedding: encodeVector([1, 0, 0]) },
    ]);
    embedMock.mockResolvedValue([{ ordinal: 0, embedding: encodeVector([1, 0, 0]) }]);

    const results = await retrieveChunks(db, { userId: userA, query: "apa saja", embedding: CONFIG });
    expect(results.map((r) => r.documentId)).not.toContain(docB);
    expect(results.every((r) => r.documentId === docA)).toBe(true);
  });
});
