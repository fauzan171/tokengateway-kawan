/**
 * Uji FIX-12 butir 2 & 3: konversi antar-format dan hardening ZIP.
 */

import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ArtifactError } from "./render";
import { convertArtifact, markdownToText, textToHtml } from "./convert";
import { assertSafeEntryName, readZip, writeZip, ZIP_LIMITS } from "./zip";

/** ZIP satu entri dengan metode dan atribut yang bisa dipilih (fixture serangan). */
function rawZip(
  name: string,
  raw: Buffer,
  opts: { method?: 0 | 8; externalAttrs?: number } = {},
): Buffer {
  const method = opts.method ?? 8;
  const payload = method === 8 ? deflateRawSync(raw) : raw;
  const nameBytes = Buffer.from(name, "utf8");
  const crc = crc32(raw) >>> 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(opts.externalAttrs ?? 0, 38);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(local.length + nameBytes.length + payload.length, 16);

  return Buffer.concat([local, nameBytes, payload, central, nameBytes, end]);
}

describe("convertArtifact", () => {
  it("markdown → txt membuang penanda sintaks", () => {
    const out = convertArtifact(
      { format: "md", content: "# Judul\n\n**tebal** dan [tautan](http://x.test)" },
      "txt",
    );
    expect(out.format).toBe("txt");
    expect(out.content).toContain("Judul");
    expect(out.content).toContain("tebal");
    expect(out.content).not.toContain("**");
    expect(out.content).not.toContain("http://x.test");
  });

  it("teks → html meng-escape seluruh isi", () => {
    const out = convertArtifact({ format: "txt", content: "<script>alert(1)</script>" }, "html");
    expect(out.content).not.toContain("<script>");
    expect(out.content).toContain("&lt;script&gt;");
  });

  it("csv → markdown mempertahankan quote dan newline", () => {
    const out = convertArtifact({ format: "csv", rows: [["a", 'b"c'], ["d", "e\nf"]] }, "md");
    expect(out.content).toContain('"b""c"');
    expect(out.content).toContain('"e\nf"');
  });

  it("json tetap json dan tidak dapat dikonversi ke teks lain", () => {
    expect(convertArtifact({ format: "json", content: { a: 1 } }, "json").content).toBe(
      '{\n  "a": 1\n}',
    );
    expect(() => convertArtifact({ format: "json", content: { a: 1 } }, "txt")).toThrow(
      ArtifactError,
    );
  });

  it("target biner ditolak eksplisit, bukan mengembalikan byte mentah", () => {
    for (const target of ["pdf", "docx", "xlsx", "zip"] as const) {
      expect(() => convertArtifact({ format: "md", content: "# x" }, target)).toThrow(
        /belum didukung|CONVERSION_UNSUPPORTED/,
      );
    }
  });

  it("markdownToText dan textToHtml menormalkan baris berlebih", () => {
    expect(markdownToText("a\n\n\n\nb")).toBe("a\n\nb");
    expect(textToHtml("a\r\nb")).toContain("a<br>b");
  });
});

describe("zip hardening", () => {
  it("positif: paket lalu baca kembali", () => {
    const bytes = writeZip([
      { name: "docs/a.md", content: "# halo" },
      { name: "b.txt", content: "isi" },
    ]);
    const entries = readZip(bytes);
    expect(entries.get("docs/a.md")?.toString("utf8")).toBe("# halo");
    expect(entries.get("b.txt")?.toString("utf8")).toBe("isi");
  });

  it("negatif: path traversal ditolak saat menulis dan saat membaca", () => {
    expect(() => writeZip([{ name: "../../evil.sh", content: "x" }])).toThrow(/ZIP_UNSAFE_PATH/);
    expect(() => readZip(rawZip("../../evil.sh", Buffer.from("x")))).toThrow(/ZIP_UNSAFE_PATH/);
    expect(() => assertSafeEntryName("/etc/passwd")).toThrow(/ZIP_UNSAFE_PATH/);
    expect(() => assertSafeEntryName("C:\\Windows\\evil")).toThrow(/ZIP_UNSAFE_PATH/);
    expect(() => assertSafeEntryName("a//b")).toThrow(/ZIP_UNSAFE_PATH/);
  });

  it("negatif: uncompressed melampaui batas dibatalkan", () => {
    const big = Buffer.alloc(ZIP_LIMITS.maxUncompressedBytes + 1);
    expect(() => readZip(rawZip("big.bin", big))).toThrow(/ZIP_TOO_LARGE/);
    expect(() =>
      readZip(rawZip("small.txt", Buffer.from("halo")), { maxUncompressedBytes: 2 }),
    ).toThrow(/ZIP_TOO_LARGE/);
  });

  it("negatif: zip bomb dengan rasio ekstrem ditolak", () => {
    // 4 MiB nol → deflate sangat kecil; melewati ambang rasio.
    const bomb = Buffer.alloc(4 * 1024 * 1024);
    expect(() => readZip(rawZip("bomb.bin", bomb))).toThrow(/ZIP_BOMB_RATIO/);
    // Ambang rasio bisa dilonggarkan pemanggil; batas byte tetap berlaku.
    expect(() => readZip(rawZip("bomb.bin", bomb), { maxRatio: 10_000 })).not.toThrow();
  });

  it("negatif: symlink dan jumlah entri berlebih ditolak", () => {
    const symlink = rawZip("link", Buffer.from("/etc/passwd"), {
      method: 0,
      externalAttrs: (0o120777 << 16) >>> 0,
    });
    expect(() => readZip(symlink)).toThrow(/ZIP_SYMLINK/);
    expect(() => readZip(rawZip("a.txt", Buffer.from("x")), { maxEntries: 0 })).toThrow(
      /ZIP_TOO_MANY_ENTRIES/,
    );
  });

  it("negatif: duplikat nama entri ditolak", () => {
    expect(() =>
      writeZip([
        { name: "a.txt", content: "1" },
        { name: "a.txt", content: "2" },
      ]),
    ).toThrow(/ZIP_DUPLICATE_ENTRY/);
  });

  it("negatif: buffer rusak bukan crash", () => {
    expect(() => readZip(Buffer.from("bukan zip"))).toThrow(/ZIP_CORRUPT/);
  });
});

describe("convertArtifact: html sebagai sumber", () => {
  it("html → txt membuang tag dan script", () => {
    const out = convertArtifact(
      { format: "html", content: "<p>Halo <b>dunia</b></p><script>alert(1)</script>" },
      "txt",
    );
    expect(out.content).toBe("Halo dunia");
  });

  it("html → md tidak menyisakan markup html", () => {
    const out = convertArtifact({ format: "html", content: "<h1>Judul</h1><p>isi</p>" }, "md");
    expect(out.content).toBe("Judul\n\nisi");
  });
});
