/**
 * Uji registry tool tertutup (P1, tipe SDD-AG-4).
 *
 * Yang diuji adalah kontrak registry, bukan aritmetika: nama asing, argumen
 * tidak sah, efek/approval, dan determinisme daftar. Perilaku tool sendiri
 * sudah dibuktikan di compute.test.ts.
 */

import { describe, expect, it } from "vitest";
import {
  TOOL_SCHEMA_VERSION,
  ToolInputError,
  chatToolNames,
  chatTools,
  effectOf,
  getTool,
  listTools,
  requiresApproval,
  type ToolContext,
} from "./registry";
import { CHAT_TOOLS } from "@/lib/chat/file-tool";

function context(overrides: Partial<ToolContext> = {}): ToolContext {
  const controller = new AbortController();
  return {
    userId: "user-1",
    signal: controller.signal,
    deadlineAt: new Date(Date.now() + 60_000),
    policyRevision: 1,
    ...overrides,
  };
}

describe("listTools", () => {
  it("deterministik: dua panggilan menghasilkan daftar yang sama persis", () => {
    const first = listTools();
    const second = listTools();
    expect(first.map((tool) => tool.name)).toEqual(second.map((tool) => tool.name));
    expect(first.length).toBe(second.length);
    // Urutan deklarasi, bukan urutan Map/objek.
    expect(first.map((tool) => tool.name)).toEqual([
      "compute.calculate",
      "compute.stats",
      "compute.count",
      "chart.render",
      "qr.make",
      "generate_file",
      "generate_document",
    ]);
  });

  it("setiap entri dibekukan: handler/effect tidak dapat ditimpa saat runtime", () => {
    for (const tool of listTools()) {
      expect(Object.isFrozen(tool)).toBe(true);
    }
    const first = listTools()[0]!;
    expect(() => {
      (first as { effect: string }).effect = "write";
    }).toThrow();
    // Nilai asli tetap; percobaan penimpaan tidak meninggalkan efek.
    expect(listTools()[0]?.effect).not.toBe("write");
  });

  it("batas byte artefak mengikuti batas artefak sesungguhnya, bukan angka lebih kecil", async () => {
    const { TOOL_LIMITS } = await import("./registry");
    const { MAX_ARTIFACT_BYTES } = await import("@/lib/artifacts/format");
    // PDF sah bisa > 65.536 byte; cap yang lebih kecil akan menolak dokumen
    // yang sebenarnya diizinkan.
    expect(TOOL_LIMITS.artifactByteCap).toBe(MAX_ARTIFACT_BYTES);
  });

  it("schema chatTools beku: mutasi tidak merambat ke registry", async () => {
    const { chatTools } = await import("./registry");
    const tools = chatTools();
    expect(tools.length).toBeGreaterThan(0);
    const schema = tools[0]!.function.parameters as { properties?: Record<string, unknown> };
    expect(Object.isFrozen(tools[0]!.function.parameters)).toBe(true);
    expect(() => {
      (schema as { type: string }).type = "string";
    }).toThrow();
    // Panggilan berikutnya tetap menghasilkan schema yang sama.
    expect(chatTools()[0]!.function.parameters).toEqual(tools[0]!.function.parameters);
  });

  it("tidak memuat nama ganda", () => {
    const names = listTools().map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("setiap entri punya nama, schema objek, batas waktu dan byte", () => {
    for (const tool of listTools()) {
      expect(tool.name).toMatch(/^[a-z]+([._][a-z_]+)+$/);
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.parameters.type).toBe("object");
      expect(tool.timeoutMs).toBeGreaterThan(0);
      expect(tool.byteCap).toBeGreaterThan(0);
      expect(["read", "local", "write"]).toContain(tool.effect);
    }
  });

  it("entri non-chat menutup argumennya; entri chat memakai schema file-tool apa adanya", () => {
    for (const tool of listTools()) {
      if (tool.chatExposed === true) {
        // Schema chat bukan milik registry: menyalinnya ke sini akan membuat
        // dua sumber kebenaran untuk satu kontrak model.
        const source = CHAT_TOOLS.find((candidate) => candidate.function.name === tool.name);
        expect(source).toBeDefined();
        expect(tool.parameters).toEqual(source!.function.parameters);
        expect(tool.description).toBe(source!.function.description);
        continue;
      }
      expect(tool.parameters.additionalProperties).toBe(false);
    }
  });

  it("app.* belum terdaftar (FIX-19 menyusul)", () => {
    expect(listTools().some((tool) => tool.name.startsWith("app."))).toBe(false);
    expect(getTool("app.list_chats")).toBeNull();
  });
});

describe("tool chat di registry (P3)", () => {
  it("generate_file dan generate_document terdaftar dengan effect local", () => {
    for (const name of ["generate_file", "generate_document"]) {
      const entry = getTool(name);
      expect(entry).not.toBeNull();
      expect(entry!.effect).toBe("local");
      // Artefak milik pengguna sendiri: bukan state bersama, jadi bukan write.
      expect(effectOf(name)).toBe("local");
      expect(requiresApproval(name)).toBe(false);
    }
  });

  it("payload gateway identik dengan CHAT_TOOLS lama (perilaku tidak berubah)", () => {
    expect(chatTools()).toEqual(CHAT_TOOLS);
    expect(chatToolNames()).toEqual(CHAT_TOOLS.map((tool) => tool.function.name));
  });

  it("hanya tool chat yang diekspos ke gateway", () => {
    const exposed = listTools().filter((tool) => tool.chatExposed === true).map((tool) => tool.name);
    expect(exposed).toEqual(["generate_file", "generate_document"]);
    // compute/chart/qr belum punya jalur eksekusi di loop chat (FIX-09).
    expect(chatToolNames()).not.toContain("compute.calculate");
    expect(chatToolNames()).not.toContain("chart.render");
  });

  it("validator chat membungkus parser lama, bukan menulis ulang", () => {
    const file = getTool("generate_file")!;
    expect(() => file.validate({ format: "pdf", displayName: "x" })).toThrow(ToolInputError);
    try {
      file.validate({ format: "csv", displayName: "x" });
    } catch (err) {
      // Parser lama yang bicara; registry hanya menerjemahkan galatnya.
      expect((err as ToolInputError).code).toBe("VALUE_REJECTED");
      expect((err as ToolInputError).message).toBe("CSV membutuhkan rows.");
    }
    expect(file.validate({ format: "md", displayName: "a.md", content: "# A" })).toEqual({
      format: "md",
      displayName: "a.md",
      content: "# A",
    });

    const doc = getTool("generate_document")!;
    expect(() =>
      doc.validate({
        format: "pdf",
        displayName: "a.pdf",
        doc: { title: "A", blocks: [{ type: "paragraph", text: "isi" }] },
      }),
    ).not.toThrow();
    expect(() => doc.validate({ format: "pptx", displayName: "a", doc: {} })).toThrow(ToolInputError);
  });

  it("handler chat mengembalikan argumen tervalidasi, penulisan artefak tetap di loop chat", async () => {
    const entry = getTool("generate_file")!;
    const result = await entry.handler(context(), { format: "txt", displayName: "a.txt", content: "isi" });
    expect(result.status).toBe("ok");
    expect(result.data).toEqual({ format: "txt", displayName: "a.txt", content: "isi" });

    const bad = await entry.handler(context(), { format: "exe", displayName: "a" });
    expect(bad.status).toBe("invalid");
    expect(bad.message).toBe("Format berkas tidak didukung.");
  });
});

describe("getTool", () => {
  it("nama asing menghasilkan null, bukan lemparan", () => {
    for (const bad of ["", "compute", "compute.nope", "APP.LIST_CHATS", "app.list_chats"]) {
      expect(() => getTool(bad)).not.toThrow();
      expect(getTool(bad)).toBeNull();
    }
  });

  it("nama kosong/asing tidak jadi tool dinamis", () => {
    expect(getTool("")).toBeNull();
    expect(getTool("compute.calculate ")).toBeNull();
  });

  it("nama terdaftar mengembalikan entri yang sama dengan listTools", () => {
    const entry = getTool("compute.calculate");
    expect(entry).not.toBeNull();
    expect(entry).toBe(listTools().find((tool) => tool.name === "compute.calculate"));
  });
});

describe("efek dan approval", () => {
  it("effectOf sesuai deklarasi; nama asing menghasilkan null", () => {
    expect(effectOf("compute.calculate")).toBe("read");
    expect(effectOf("compute.stats")).toBe("read");
    expect(effectOf("compute.count")).toBe("read");
    expect(effectOf("chart.render")).toBe("local");
    expect(effectOf("qr.make")).toBe("local");
    expect(effectOf("compute.nope")).toBeNull();
    expect(effectOf("app.delete_chat")).toBeNull();
  });

  it("requiresApproval hanya benar untuk effect write", () => {
    for (const tool of listTools()) {
      expect(requiresApproval(tool.name)).toBe(tool.effect === "write");
    }
    // Belum ada tool write terdaftar: approval tidak dipalsukan.
    expect(listTools().every((tool) => !requiresApproval(tool.name))).toBe(true);
    expect(requiresApproval("compute.nope")).toBe(false);
    expect(requiresApproval("app.delete_chat")).toBe(false);
  });
});

describe("validate", () => {
  it("argumen tidak sah ditolak dengan ToolInputError berkode, bukan crash", () => {
    const entry = getTool("compute.calculate");
    expect(entry).not.toBeNull();
    const cases: { args: unknown; code: string }[] = [
      { args: null, code: "ARGUMENTS_NOT_OBJECT" },
      { args: [], code: "ARGUMENTS_NOT_OBJECT" },
      { args: "add", code: "ARGUMENTS_NOT_OBJECT" },
      { args: {}, code: "INVALID_ARGUMENT" },
      { args: { op: "add" }, code: "INVALID_ARGUMENT" },
      { args: { op: "add", operands: "1,2" }, code: "INVALID_ARGUMENT" },
      { args: { op: "add", operands: [1, 2] }, code: "INVALID_ARGUMENT" },
      { args: { op: "add", operands: ["1", "2"], hapus: true }, code: "UNKNOWN_ARGUMENT" },
      { args: { op: "div", operands: ["1", "0"] }, code: "VALUE_REJECTED" },
      { args: { op: "nope", operands: ["1", "2"] }, code: "VALUE_REJECTED" },
      { args: { op: "add", operands: ["1+1", "2"] }, code: "VALUE_REJECTED" },
      { args: { op: "round", operands: ["1.5"], precision: 99 }, code: "VALUE_REJECTED" },
    ];
    for (const testCase of cases) {
      let caught: unknown;
      try {
        entry!.validate(testCase.args);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ToolInputError);
      expect((caught as ToolInputError).code).toBe(testCase.code);
      expect((caught as ToolInputError).message.length).toBeGreaterThan(0);
    }
  });

  it("validator lain juga melempar ToolInputError, bukan TypeError", () => {
    for (const name of ["compute.stats", "compute.count", "chart.render", "qr.make"]) {
      const entry = getTool(name);
      expect(entry).not.toBeNull();
      expect(() => entry!.validate(42)).toThrow(ToolInputError);
      expect(() => entry!.validate({})).toThrow(ToolInputError);
    }
  });

  it("argumen sah dikembalikan ternormalisasi", () => {
    expect(getTool("compute.calculate")!.validate({ op: "add", operands: ["0.1", "0.2"] })).toEqual({
      op: "add",
      operands: ["0.1", "0.2"],
    });
    // Locale default diisi validator, bukan ditebak handler.
    expect(getTool("compute.count")!.validate({ text: "halo" })).toEqual({
      text: "halo",
      locale: "id",
    });
  });
});

describe("handler", () => {
  it("hasil sukses membawa schemaVersion dan perilaku tool lama tidak berubah", async () => {
    const entry = getTool("compute.calculate")!;
    const result = await entry.handler(context(), entry.validate({ op: "add", operands: ["0.1", "0.2"] }));
    expect(result.schemaVersion).toBe(TOOL_SCHEMA_VERSION);
    expect(result.status).toBe("ok");
    expect((result.data as { value: string }).value).toBe("0.3");
  });

  it("masukan buruk menjadi hasil terstruktur, bukan pengecualian", async () => {
    const entry = getTool("compute.calculate")!;
    const result = await entry.handler(context(), { op: "div", operands: ["1", "0"] });
    expect(result.status).toBe("invalid");
    expect(result.message).toContain("nol");
    expect(result.schemaVersion).toBe(TOOL_SCHEMA_VERSION);
  });

  it("grafik dan QR tetap memakai batas tool lama", async () => {
    const chart = getTool("chart.render")!;
    const chartResult = await chart.handler(
      context(),
      chart.validate({ kind: "bar", points: [{ label: "A", value: 1 }], title: "Uji" }),
    );
    expect(chartResult.status).toBe("ok");
    expect((chartResult.data as { svg: string }).svg).toContain("<svg");

    const qr = getTool("qr.make")!;
    const qrResult = await qr.handler(context(), qr.validate({ payload: "https://contoh.id" }));
    expect(qrResult.status).toBe("ok");
    expect((qrResult.data as { decoded: string }).decoded).toBe("https://contoh.id");

    // Payload melebihi batas tetap ditolak validator, bukan dipotong.
    expect(() => qr.validate({ payload: "x".repeat(1_201) })).toThrow(ToolInputError);
  });

  it("run yang dibatalkan atau lewat tenggat tidak menjalankan tool", async () => {
    const entry = getTool("compute.calculate")!;
    const controller = new AbortController();
    controller.abort();
    const aborted = await entry.handler(
      context({ signal: controller.signal }),
      { op: "add", operands: ["1", "2"] },
    );
    expect(aborted.status).toBe("denied");
    expect(aborted.data).toBeUndefined();

    const overdue = await entry.handler(
      context({ deadlineAt: new Date(Date.now() - 1_000) }),
      { op: "add", operands: ["1", "2"] },
    );
    expect(overdue.status).toBe("failed");
    expect(overdue.message).toContain("Tenggat");
  });
});
