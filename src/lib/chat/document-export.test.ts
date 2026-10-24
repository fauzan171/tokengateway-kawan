import { describe, expect, it } from "vitest";
import {
  exportChatDocxBytes,
  exportChatPdfBytes,
  exportChatXlsxBytes,
  zipBytes,
} from "./document-export";

const chat = {
  title: "Rencana liburan",
  messages: [
    { role: "user", text: "Rekomendasi pantai di Bali?" },
    { role: "assistant", text: "Pantai Pandawa dan Nusa Dua." },
  ],
};

function ascii(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("exportChatPdfBytes", () => {
  it("diawali magic bytes %PDF", () => {
    expect(ascii(exportChatPdfBytes(chat)).startsWith("%PDF-")).toBe(true);
  });

  it("memuat judul dan kedua peran", () => {
    const pdf = ascii(exportChatPdfBytes(chat));
    expect(pdf).toContain("Rencana liburan");
    expect(pdf).toContain("Kamu");
    expect(pdf).toContain("Kawan");
  });
});

describe("exportChatDocxBytes", () => {
  it("diawali magic bytes ZIP PK\\x03\\x04", () => {
    const bytes = exportChatDocxBytes(chat);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it("memuat document.xml dengan judul dan teks", () => {
    const bytes = exportChatDocxBytes(chat);
    expect(bytes.includes(Buffer.from("word/document.xml"))).toBe(true);
    expect(ascii(bytes)).toContain("Rencana liburan");
    expect(ascii(bytes)).toContain("Rekomendasi pantai di Bali?");
  });
});

describe("exportChatXlsxBytes", () => {
  it("diawali magic bytes ZIP PK\\x03\\x04", () => {
    const bytes = exportChatXlsxBytes(chat);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it("memuat worksheet dengan kolom Peran dan Teks", () => {
    const bytes = exportChatXlsxBytes(chat);
    expect(bytes.includes(Buffer.from("xl/worksheets/sheet1.xml"))).toBe(true);
    expect(ascii(bytes)).toContain("Peran");
    expect(ascii(bytes)).toContain("Teks");
    expect(ascii(bytes)).toContain("Kamu");
  });
});

describe("zipBytes", () => {
  it("menghasilkan struktur ZIP yang bisa dibaca (signature local + central + EOCD)", () => {
    const bytes = zipBytes([{ name: "a.txt", data: "halo" }]);
    const buf = Buffer.from(bytes);
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(buf.includes(Buffer.from("a.txt"))).toBe(true);
    // Signature end of central directory: PK\x05\x06.
    expect(buf.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });

  // Test magic bytes saja tidak cukup: offset central directory pernah salah 2 byte
  // sehingga ZIP tetap diawali PK\x03\x04 tapi ditolak semua pembaca nyata.
  it("entri tercatat di central directory dengan offset yang benar", () => {
    const buf = Buffer.from(zipBytes([{ name: "a.txt", data: "halo" }]));
    const central = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(central).toBeGreaterThan(0);
    // Offset local header ada di byte 42 central header (setelah atribut eksternal).
    const localOffset = buf.readUInt32LE(central + 42);
    expect(localOffset).toBe(0);
    expect(buf.subarray(localOffset, localOffset + 4)).toEqual(
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    );
    // Nama di central header harus nama entri, bukan sisa byte lain.
    const nameLen = buf.readUInt16LE(central + 28);
    expect(buf.subarray(central + 46, central + 46 + nameLen).toString()).toBe("a.txt");
  });
});
