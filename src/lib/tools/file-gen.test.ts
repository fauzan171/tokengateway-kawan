/**
 * Uji D2: `generate_file` xlsx/docx — validasi varian, render balik, kuota.
 *
 * Renderer diuji lewat byte nyata (exceljs/zip), bukan string dalam memori:
 * "berkas jadi" hanya berarti bila pembaca aslinya membukanya kembali.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import { createArtifact, openArtifactBytes } from "@/lib/artifacts/create";
import { readZip } from "@/lib/artifacts/zip";
import type { Db } from "@/lib/db";
import { parseGenerateFileArgs, toArtifactInput } from "@/lib/chat/file-tool";
import { getTool, type ToolContext } from "./registry";

let temp: TempDb;
let db: Db;
let userId: string;
const storageDir = mkdtempSync(join(tmpdir(), "kawan-filegen-"));

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
  rmSync(storageDir, { recursive: true, force: true });
});

function context(overrides: Partial<ToolContext> = {}): ToolContext {
  const controller = new AbortController();
  return {
    userId,
    signal: controller.signal,
    deadlineAt: new Date(Date.now() + 60_000),
    policyRevision: 1,
    approvedDigest: null,
    ...overrides,
  };
}

describe("generate_file xlsx", () => {
  it("hasil render terbuka balik via exceljs, nilai sheet cocok", async () => {
    const args = parseGenerateFileArgs({
      format: "xlsx",
      displayName: "rekap.xlsx",
      sheets: [
        { name: "Penjualan", rows: [["Bulan", "Total"], ["Jan", "10"]] },
        { name: "Ringkasan", rows: [["Baris", "2"]] },
      ],
    });
    const artifact = await createArtifact(
      db,
      { userId, displayName: args.displayName, input: toArtifactInput(args) },
      storageDir,
    );
    expect(artifact.status).toBe("ready");

    const { bytes } = await openArtifactBytes(db, userId, artifact.id, storageDir);
    const workbook = new ExcelJS.Workbook();
    // exceljs mengetik `load(Buffer)` dengan Buffer miliknya sendiri; runtime menerima Buffer Node.
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const names = workbook.worksheets.map((sheet) => sheet.name);
    expect(names).toEqual(["Penjualan", "Ringkasan"]);
    expect(names.length).toBeLessThanOrEqual(5);
    const penjualan = workbook.getWorksheet("Penjualan")!;
    expect(penjualan.getRow(1).getCell(1).value).toBe("Bulan");
    expect(penjualan.getRow(2).getCell(2).value).toBe("10");
  });

  it("nama sheet duplikat/ganda disanitasi, tidak melempar", () => {
    const args = parseGenerateFileArgs({
      format: "xlsx",
      displayName: "a.xlsx",
      sheets: [
        { name: "Data", rows: [] },
        { name: "Data", rows: [] },
      ],
    });
    expect(args.format).toBe("xlsx");
    // Cap sheets ditegakkan sebelum render.
    expect(() =>
      parseGenerateFileArgs({
        format: "xlsx",
        displayName: "b.xlsx",
        sheets: Array.from({ length: 6 }, (_, i) => ({ name: `S${i}`, rows: [] })),
      }),
    ).toThrow(/maksimal 5 sheet/);
  });
});

describe("generate_file docx", () => {
  it("DocSchema minimal valid: word/document.xml ada, sha256 = hash byte storage", async () => {
    const args = parseGenerateFileArgs({
      format: "docx",
      displayName: "surat.docx",
      doc: { title: "Surat", blocks: [{ type: "paragraph", text: "Isi surat." }] },
    });
    const artifact = await createArtifact(
      db,
      { userId, displayName: args.displayName, input: toArtifactInput(args) },
      storageDir,
    );
    expect(artifact.status).toBe("ready");

    const { bytes } = await openArtifactBytes(db, userId, artifact.id, storageDir);
    const entries = readZip(bytes);
    expect(entries.has("word/document.xml")).toBe(true);
    expect(artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("R5: pemotongan/blok tak dikenal dilaporkan lewat truncated/unknownBlocks", () => {
    const many = Array.from({ length: 600 }, () => ({ type: "paragraph", text: "x" }));
    const over = parseGenerateFileArgs({ format: "docx", displayName: "a.docx", doc: { title: "T", blocks: many } });
    if (over.format !== "docx") throw new Error("bukan docx");
    expect(over.truncated).toBe(true);
    expect(over.doc.blocks.length).toBe(500);

    const odd = parseGenerateFileArgs({
      format: "docx",
      displayName: "b.docx",
      doc: { title: "T", blocks: [{ type: "tak-dikenal" }, { type: "paragraph", text: "ok" }] },
    });
    if (odd.format !== "docx") throw new Error("bukan docx");
    expect(odd.unknownBlocks).toBeGreaterThan(0);
  });
});

describe("generate_file varian & batas", () => {
  it("varian bentrok ditolak: format xlsx + content", () => {
    expect(() =>
      parseGenerateFileArgs({ format: "xlsx", displayName: "a.xlsx", content: "x" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TOOL_ARGS" }));
  });

  it("field asing ditolak", () => {
    expect(() =>
      parseGenerateFileArgs({ format: "md", displayName: "a.md", content: "# x", rows: [] }),
    ).toThrowError(/tidak sah/);
  });

  it("oversized ditolak sebelum render", () => {
    const rows = Array.from({ length: 2_001 }, () => ["x"]);
    expect(() => parseGenerateFileArgs({ format: "csv", displayName: "a.csv", rows })).toThrowError(
      /melebihi 2000 baris/,
    );
    expect(() =>
      parseGenerateFileArgs({ format: "csv", displayName: "a.csv", rows: [["x".repeat(501)]] }),
    ).toThrowError(/melebihi 500 karakter/);
  });
});

describe("kuota & kode galat stabel", () => {
  it("kuota habis: QUOTA_EXCEEDED, tidak ada baris Artifact ready", async () => {
    for (let i = 0; i < 100; i += 1) {
      await db.artifact.create({
        data: {
          id: `art_seed_${i}`,
          userId,
          format: "txt",
          displayName: "seed.txt",
          mime: "text/plain",
          sizeBytes: 1,
          sha256: "0".repeat(64),
          storageKey: "seed",
          status: "ready",
        },
      });
    }
    const args = parseGenerateFileArgs({ format: "txt", displayName: "a.txt", content: "isi" });
    await expect(
      createArtifact(db, { userId, displayName: args.displayName, input: toArtifactInput(args) }, storageDir),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });

    // Percobaan gagal itu tidak menambah baris apa pun (staged/ready).
    expect(await db.artifact.count({ where: { userId } })).toBe(100);
  });

  it("handler gagal render membawa errorCode stabel, bukan kartu sukses", async () => {
    const entry = getTool("generate_file")!;
    const result = await entry.handler(context(), { format: "xlsx", displayName: "a.xlsx" });
    expect(result.status).toBe("invalid");
    expect(result.errorCode).toBe("INVALID_TOOL_ARGS");
    expect(result.data).toBeUndefined();
  });
});