/**
 * Uji reducer pohon pesan (WP-NT-P3-02, SDD-2.4).
 *
 * Semua fungsi murni: cukup array in-memory, tanpa DB.
 */

import { describe, expect, it } from "vitest";
import {
  activeLeaf,
  buildAncestryPath,
  nextSeq,
  siblingsOf,
  subtreeOf,
  type TreeNode,
} from "./tree";

const CHAT = "chat_1";

/** Ringkas: [id, parentId, seq]. */
function msg(
  id: string,
  parentId: string | null,
  seq: number,
  chatId = CHAT,
): TreeNode {
  return {
    id,
    chatId,
    parentId,
    role: seq % 2 === 0 ? "assistant" : "user",
    seq,
    status: "complete",
    contentJson: "{}",
  };
}

const ids = (nodes: readonly TreeNode[]) => nodes.map((n) => n.id);

describe("buildAncestryPath", () => {
  it("rantai linear dari root ke leaf", () => {
    const tree = [msg("a", null, 1), msg("b", "a", 2), msg("c", "b", 3)];
    expect(ids(buildAncestryPath(tree, "c"))).toEqual(["a", "b", "c"]);
  });

  it("mengikuti cabang aktif, bukan cabang lain", () => {
    // a → b1 → c1   dan   a → b2 → c2
    const tree = [
      msg("a", null, 1),
      msg("b1", "a", 2),
      msg("c1", "b1", 3),
      msg("b2", "a", 4),
      msg("c2", "b2", 5),
    ];
    expect(ids(buildAncestryPath(tree, "c2"))).toEqual(["a", "b2", "c2"]);
  });

  it("menolak siklus A→B→A tanpa menggantung", () => {
    const tree = [msg("a", "b", 1), msg("b", "a", 2)];
    expect(() => buildAncestryPath(tree, "a")).toThrow(/[Ss]iklus/);
  });

  it("menolak parentId yang menunjuk pesan hilang", () => {
    const tree = [msg("a", null, 1), msg("b", "ghost", 2)];
    expect(() => buildAncestryPath(tree, "b")).toThrow(/ghost/);
  });

  it("leafId tidak ada → []", () => {
    const tree = [msg("a", null, 1)];
    expect(buildAncestryPath(tree, "nope")).toEqual([]);
  });

  it("daftar kosong → []", () => {
    expect(buildAncestryPath([], "a")).toEqual([]);
    expect(buildAncestryPath([], null)).toEqual([]);
  });
});

describe("siblingsOf", () => {
  it("mengembalikan kedua assistant sibling dari satu parent", () => {
    const tree = [
      msg("a", null, 1),
      msg("b1", "a", 2),
      msg("b2", "a", 3),
    ];
    expect(ids(siblingsOf(tree, "b1"))).toEqual(["b1", "b2"]);
    expect(ids(siblingsOf(tree, "b2"))).toEqual(["b1", "b2"]);
  });

  it("urut seq walau masukan tak urut", () => {
    const tree = [msg("b2", "a", 3), msg("a", null, 1), msg("b1", "a", 2)];
    expect(ids(siblingsOf(tree, "b2"))).toEqual(["b1", "b2"]);
  });

  it("messageId tak ada → []", () => {
    expect(siblingsOf([msg("a", null, 1)], "nope")).toEqual([]);
  });
});

describe("activeLeaf", () => {
  it("null saat currentMessageId null", () => {
    expect(activeLeaf([msg("a", null, 1)], null)).toBeNull();
  });

  it("null saat menunjuk pesan hilang", () => {
    expect(activeLeaf([msg("a", null, 1)], "ghost")).toBeNull();
  });

  it("mengembalikan id saat ada", () => {
    expect(activeLeaf([msg("a", null, 1)], "a")).toBe("a");
  });
});

describe("subtreeOf", () => {
  it("mengambil cucu juga", () => {
    const tree = [
      msg("a", null, 1),
      msg("b", "a", 2),
      msg("c", "b", 3),
      msg("d", "a", 4),
    ];
    expect(ids(subtreeOf(tree, "a"))).toEqual(["b", "c", "d"]);
    expect(ids(subtreeOf(tree, "b"))).toEqual(["c"]);
  });

  it("root tak ada → []", () => {
    expect(subtreeOf([msg("a", null, 1)], "nope")).toEqual([]);
  });
});

describe("nextSeq", () => {
  it("chat kosong → 1", () => {
    expect(nextSeq([], CHAT)).toBe(1);
  });

  it("melanjutkan dari seq tertinggi chat itu", () => {
    const tree = [msg("a", null, 1, CHAT), msg("b", "a", 4, CHAT)];
    expect(nextSeq(tree, CHAT)).toBe(5);
  });

  it("mengabaikan chat lain", () => {
    const tree = [msg("a", null, 9, "chat_2")];
    expect(nextSeq(tree, CHAT)).toBe(1);
  });
});
