import { describe, expect, it } from "vitest";
import { groupChats, type GroupableChat } from "./grouping";

function chat(overrides: Partial<GroupableChat> & { id: string }): GroupableChat {
  return {
    title: overrides.id,
    folderId: null,
    pinned: false,
    archived: false,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const now = new Date(2026, 9, 18, 12, 0, 0);

describe("groupChats", () => {
  it("menaruh chat hari ini di kelompok Hari ini", () => {
    const groups = groupChats([chat({ id: "a", updatedAt: new Date(2026, 9, 18, 1, 0).toISOString() })], now);
    expect(groups.map((g) => g.label)).toEqual(["Hari ini"]);
  });

  it("memisahkan kemarin, 7 hari, dan lebih lama", () => {
    const groups = groupChats(
      [
        chat({ id: "kemarin", updatedAt: new Date(2026, 9, 17, 23, 0).toISOString() }),
        chat({ id: "tiga-hari", updatedAt: new Date(2026, 9, 15, 9, 0).toISOString() }),
        chat({ id: "lama", updatedAt: new Date(2026, 8, 1, 9, 0).toISOString() }),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.chats.map((c) => c.id)])).toEqual([
      ["Kemarin", ["kemarin"]],
      ["7 hari terakhir", ["tiga-hari"]],
      ["Lebih lama", ["lama"]],
    ]);
  });

  it("menyematkan chat pinned paling atas dan mengeluarkannya dari kelompok tanggal", () => {
    const groups = groupChats(
      [
        chat({ id: "biasa", updatedAt: new Date(2026, 9, 18, 8, 0).toISOString() }),
        chat({ id: "pin", pinned: true, updatedAt: new Date(2026, 8, 1).toISOString() }),
      ],
      now,
    );
    expect(groups[0]!.label).toBe("Disematkan");
    expect(groups[0]!.chats.map((c) => c.id)).toEqual(["pin"]);
    expect(groups.flatMap((g) => g.chats.map((c) => c.id))).toEqual(["pin", "biasa"]);
  });

  it("membuang kelompok kosong", () => {
    expect(groupChats([], now)).toEqual([]);
  });

  it("menghitung batas hari memakai zona waktu lokal, bukan UTC", () => {
    // 00:30 lokal tetap "Hari ini" walau di UTC sudah tanggal sebelumnya.
    const groups = groupChats([chat({ id: "subuh", updatedAt: new Date(2026, 9, 18, 0, 30).toISOString() })], now);
    expect(groups[0]!.label).toBe("Hari ini");
  });
});
