/**
 * Uji job `document.extract` (WP-NT-P6-03, REQ-NT-54).
 *
 * PDF fixture dibuat langsung di test sebagai berkas PDF minimal satu halaman,
 * supaya tidak ada biner asing di repo dan isi yang dicari terkontrol.
 */

import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { runExtract } from "./run-extract";
import { saveDocument } from "./storage";

/** PDF minimal satu halaman berisi satu baris teks. */
function pdfWithText(text: string): Buffer {
  const stream = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  const body = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    `4 0 obj<</Length ${stream.length}>>stream`,
    stream,
    "endstream",
    "endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R/Size 6>>",
    "%%EOF",
  ].join("\n");
  return Buffer.from(body, "latin1");
}

let temp: TempDb;
let db: Db;
let userId: string;
const storageDir = mkdtempSync(join(tmpdir(), "kawan-extract-"));
const originalStorage = process.env["STORAGE_LOCAL_DIR"];

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  process.env["STORAGE_LOCAL_DIR"] = storageDir;
});

afterAll(async () => {
  await temp.cleanup();
  if (originalStorage === undefined) delete process.env["STORAGE_LOCAL_DIR"];
  else process.env["STORAGE_LOCAL_DIR"] = originalStorage;
  rmSync(storageDir, { recursive: true, force: true });
});

async function seedDocument(mime: string, data: Buffer): Promise<string> {
  const storageKey = await saveDocument(data);
  const id = `doc_${randomUUID()}`;
  await db.document.create({
    data: { id, userId, filename: "uji", mime, sizeBytes: data.length, storageKey },
  });
  return id;
}

describe("runExtract", () => {
  it("teks biasa: queued -> ready, isi tersimpan, errorCode null", async () => {
    const id = await seedDocument("text/plain", Buffer.from("Baris satu.\n\n\nBaris dua."));

    await runExtract(db, id);

    const row = await db.document.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("ready");
    expect(row.errorCode).toBeNull();

    const chunks = await db.documentChunk.findMany({ where: { documentId: id }, orderBy: { ordinal: "asc" } });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.page).toBe(1);
    expect(chunks[0]?.text).toBe("Baris satu.\n\nBaris dua.");
  });

  it("PDF dengan lapisan teks: ready dan teksnya terbaca", async () => {
    const id = await seedDocument("application/pdf", pdfWithText("Halo Kawan"));

    await runExtract(db, id);

    const row = await db.document.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("ready");
    const chunks = await db.documentChunk.findMany({ where: { documentId: id } });
    expect(chunks.map((c) => c.text).join(" ")).toContain("Halo Kawan");
  });

  it("PDF rusak: failed dengan errorCode, tidak melempar", async () => {
    // FIX-14: magic bytes menentukan format, jadi fixture harus benar-benar
    // berawalan `%PDF-` — bukan teks yang diklaim PDF.
    const id = await seedDocument("application/pdf", Buffer.from("%PDF-1.7\nrusak tanpa xref"));

    await expect(runExtract(db, id)).resolves.toBeUndefined();

    const row = await db.document.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("failed");
    expect(row.errorCode).toBe("EXTRACT_FAILED");
  });

  it("teks kosong: failed NO_TEXT_LAYER", async () => {
    const id = await seedDocument("text/plain", Buffer.from("   \n\n  "));

    await runExtract(db, id);

    const row = await db.document.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("failed");
    expect(row.errorCode).toBe("NO_TEXT_LAYER");
  });

  it("documentId yang tidak ada: melempar supaya job gagal", async () => {
    await expect(runExtract(db, "doc_tidak_ada")).rejects.toThrow(/tidak ditemukan/);
  });

  it("teks panjang: beberapa chunk dengan ordinal dan page yang benar", async () => {
    const text = Array.from({ length: 400 }, (_, i) => `kata${String(i).padStart(4, "0")}`).join(" ");
    const id = await seedDocument("text/plain", Buffer.from(text));

    await runExtract(db, id);

    const chunks = await db.documentChunk.findMany({
      where: { documentId: id },
      orderBy: { ordinal: "asc" },
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
    for (const chunk of chunks) expect(chunk.page).toBe(1);
    expect(chunks.map((c) => c.text).join(" ")).toContain("kata0399");
  });

  it("dijalankan ulang tidak menggandakan chunk", async () => {
    const id = await seedDocument("text/plain", Buffer.from("sekali saja"));
    await runExtract(db, id);
    await runExtract(db, id);

    expect(await db.documentChunk.count({ where: { documentId: id } })).toBe(1);
  });
});
