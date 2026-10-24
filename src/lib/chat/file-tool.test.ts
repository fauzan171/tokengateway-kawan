import { describe, expect, it } from "vitest";
import {
  assembleToolCalls,
  parseGenerateFileArgs,
  parseGenerateDocumentArgs,
  CHAT_TOOLS,
  GENERATE_FILE_TOOL_NAME,
  GENERATE_DOCUMENT_TOOL_NAME,
} from "./file-tool";
import { ArtifactError } from "@/lib/artifacts/render";

describe("assembleToolCalls", () => {
  it("menyatukan tiga potongan index 0 jadi satu call", () => {
    const fragments = new Map<number, { id?: string; name?: string; arguments: string }>([
      [0, { id: "c1", name: "generate_file", arguments: '{"format":"md",' }],
    ]);
    const first = fragments.get(0)!;
    const merged = {
      id: first.id,
      name: first.name,
      arguments: first.arguments + '"displayName":"a",' + '"content":"# x"}',
    };
    fragments.set(0, merged);

    const calls = assembleToolCalls(fragments);
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe("c1");
    expect(calls[0].name).toBe("generate_file");
    expect(calls[0].arguments).toEqual({ format: "md", displayName: "a", content: "# x" });
  });

  it("JSON rusak → arguments null, tidak lempar", () => {
    const fragments = new Map<number, { id?: string; name?: string; arguments: string }>([
      [0, { name: "generate_file", arguments: '{"format": md' }],
    ]);
    expect(assembleToolCalls(fragments)[0].arguments).toBeNull();
  });
});

describe("parseGenerateFileArgs", () => {
  it("format pdf ditolak", () => {
    expect(() => parseGenerateFileArgs({ format: "pdf", displayName: "a" })).toThrowError(ArtifactError);
    try {
      parseGenerateFileArgs({ format: "pdf", displayName: "a" });
    } catch (err) {
      expect((err as ArtifactError).code).toBe("INVALID_TOOL_ARGS");
    }
  });

  it("csv tanpa rows ditolak, dengan rows lolos", () => {
    expect(() => parseGenerateFileArgs({ format: "csv", displayName: "a" })).toThrowError(/rows/);
    const ok = parseGenerateFileArgs({ format: "csv", displayName: "a", rows: [["h"], [1]] });
    expect(ok.format).toBe("csv");
    expect((ok as { rows?: unknown[][] }).rows).toEqual([["h"], [1]]);
  });

  it("json tanpa content ditolak", () => {
    expect(() => parseGenerateFileArgs({ format: "json", displayName: "a" })).toThrowError(/content/);
  });

  it("nama tool tersedia", () => {
    expect(GENERATE_FILE_TOOL_NAME).toBe("generate_file");
  });
});

describe("parseGenerateDocumentArgs", () => {
  it("pdf + doc sah → lolos dengan blocks utuh", () => {
    const doc = {
      title: "Laporan",
      blocks: [
        { type: "heading", text: "Bab 1", level: 2 },
        { type: "paragraph", text: "Isi." },
        { type: "bullets", items: ["a"] },
        { type: "table", headers: ["x"], rows: [["1"]] },
        { type: "code", text: "ls", language: "bash" },
      ],
    };
    const args = parseGenerateDocumentArgs({ format: "pdf", displayName: "l.pdf", doc });
    expect(args.format).toBe("pdf");
    expect(args.doc.title).toBe("Laporan");
    expect(args.doc.blocks).toHaveLength(5);
    expect(args.doc.blocks[0]).toEqual({ type: "heading", text: "Bab 1", level: 2 });
  });

  it("format pptx → INVALID_TOOL_ARGS (internal)", () => {
    expect(() =>
      parseGenerateDocumentArgs({ format: "pptx", displayName: "l", doc: { title: "t", blocks: [] } }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TOOL_ARGS" }));
  });

  it("D4: jalur template menang atas doc; data masuk lewat buildDocFromTemplate", () => {
    const args = parseGenerateDocumentArgs({
      format: "docx",
      displayName: "surat.docx",
      template: "surat",
      data: { kop: "PT K", tujuan: "Yth. X", isi: ["isi"], penutup: "t", penandaTangan: "a" },
      doc: { title: "diabaikan", blocks: [{ type: "paragraph", text: "x" }] },
    });
    expect(args.doc.title).toBe("PT K");
    expect(args.doc.blocks.some((b) => b.type === "divider")).toBe(true);
  });

  it("D4: template tak dikenal → INVALID_TOOL_ARGS yang menyebut pilihan sah", () => {
    expect(() =>
      parseGenerateDocumentArgs({ format: "pdf", displayName: "l", template: "faktur", data: {} }),
    ).toThrowError(/laporan, surat, rekap/);
  });

  it("doc title kosong → INVALID_TOOL_ARGS", () => {
    expect(() =>
      parseGenerateDocumentArgs({ format: "pdf", displayName: "l", doc: { title: "", blocks: [] } }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TOOL_ARGS" }));
  });

  it("dokumen yang dipotong melaporkan truncated=true (R5)", () => {
    // 500 blok × 20.000 char melewati anggaran total 200.000 char.
    const blocks = Array.from({ length: 500 }, () => ({ type: "paragraph", text: "x".repeat(20_000) }));
    const args = parseGenerateDocumentArgs({
      format: "pdf",
      displayName: "panjang.pdf",
      doc: { title: "Panjang", blocks },
    });
    expect(args.truncated).toBe(true);
    expect(args.doc.blocks.length).toBeLessThan(500);
  });

  it("600 blok dari model tetap menghasilkan dokumen (dipotong, bukan gagal)", async () => {
    // Regresi live: model mengirim 600 paragraf, parse melempar, pengguna hanya
    // melihat "berkas gagal dibuat" dan kehilangan seluruh dokumen.
    const blocks = Array.from({ length: 600 }, (_, i) => ({
      type: "paragraph",
      text: `Kalimat pengisi nomor ${i + 1}.`,
    }));
    const args = parseGenerateDocumentArgs({
      format: "pdf",
      displayName: "Uji Batas.pdf",
      doc: { title: "Uji Batas", blocks },
    });
    expect(args.truncated).toBe(true);
    expect(args.doc.blocks).toHaveLength(500);

    const { createArtifact } = await import("@/lib/artifacts/create");
    const { createTempDb } = await import("../../../tests/helpers/auth-db");
    const temp = await createTempDb();
    const userId = crypto.randomUUID();
    await temp.db.user.create({ data: { id: userId, email: `${userId}@t.test` } });
    try {
      const artifact = await createArtifact(temp.db, {
        userId,
        displayName: args.displayName,
        input: { format: "pdf", doc: args.doc },
      });
      expect(artifact.status).toBe("ready");
      expect(artifact.sizeBytes).toBeGreaterThan(1_000);
    } finally {
      await temp.cleanup();
    }
  });

  it("blok tak dikenal dihitung di unknownBlocks, bukan dibuang diam-diam", () => {
    const args = parseGenerateDocumentArgs({
      format: "pdf",
      displayName: "x.pdf",
      doc: {
        title: "X",
        blocks: [
          { type: "paragraph", text: "sah" },
          { type: "mermaid", text: "graph TD" },
          { type: "chart" },
        ],
      },
    });
    expect(args.unknownBlocks).toBe(2);
    expect(args.doc.blocks).toHaveLength(1);
    expect(args.truncated).toBe(false);
  });

  it("CHAT_TOOLS: dua tool dengan nama unik", () => {
    expect(CHAT_TOOLS).toHaveLength(2);
    const names = CHAT_TOOLS.map((t) => t.function.name);
    expect(new Set(names).size).toBe(2);
    expect(names).toEqual([GENERATE_FILE_TOOL_NAME, GENERATE_DOCUMENT_TOOL_NAME]);
  });
});
