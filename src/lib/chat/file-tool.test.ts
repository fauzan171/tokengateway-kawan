import { describe, expect, it } from "vitest";
import { assembleToolCalls, parseGenerateFileArgs, GENERATE_FILE_TOOL_NAME } from "./file-tool";
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
