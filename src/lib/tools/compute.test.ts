/**
 * Uji FIX-15: aritmetika desimal, statistik, hitung teks, grafik, QR.
 *
 * Fixture JSONL di `fixtures/compute.jsonl` menyimpan input + hasil yang
 * diharapkan, supaya angka tidak "dibuktikan" oleh kode yang sama yang
 * menghitungnya.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CalcError, calculate, countText, describe as describeStats } from "./compute";
import { ChartError, renderChart } from "./chart";
import { QrError, makeBarcode, makeQr } from "./qr";

type Fixture = { op: string; operands: string[]; precision?: number; rounding?: string; expected: string };

const fixtures: Fixture[] = readFileSync(new URL("./fixtures/compute.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line) as Fixture);

describe("calculate", () => {
  it.each(fixtures)("$op $operands → $expected", (fixture) => {
    const result = calculate({
      op: fixture.op as never,
      operands: fixture.operands,
      ...(fixture.precision !== undefined ? { precision: fixture.precision } : {}),
      ...(fixture.rounding !== undefined ? { rounding: fixture.rounding as never } : {}),
    });
    expect(result.value).toBe(fixture.expected);
  });

  it("0.1 + 0.2 tepat 0.3 (bukan 0.30000000000000004)", () => {
    expect(calculate({ op: "add", operands: ["0.1", "0.2"] }).value).toBe("0.3");
    expect(0.1 + 0.2).not.toBe(0.3); // alasan tool ini ada
  });

  it("pembagian dengan nol dan modulo nol ditolak", () => {
    expect(() => calculate({ op: "div", operands: ["1", "0"] })).toThrow(CalcError);
    expect(() => calculate({ op: "mod", operands: ["1", "0"] })).toThrow(CalcError);
    try {
      calculate({ op: "div", operands: ["1", "0"] });
    } catch (err) {
      expect((err as CalcError).code).toBe("DIVISION_BY_ZERO");
    }
  });

  it("negatif: ekspresi dan operand non-desimal ditolak (tidak ada eval)", () => {
    for (const bad of ["1+1", "process.exit()", "0x10", "1_000", "", "  ", "abc", "1e99999"]) {
      expect(() => calculate({ op: "add", operands: [bad, "1"] })).toThrow(CalcError);
    }
  });

  it("negatif: operand non-string dan arity salah ditolak", () => {
    expect(() => calculate({ op: "add", operands: [1 as never, "2"] })).toThrow(CalcError);
    expect(() => calculate({ op: "add", operands: ["1"] })).toThrow(CalcError);
    expect(() => calculate({ op: "add", operands: ["1", "2", "3"] })).toThrow(CalcError);
    expect(() => calculate({ op: "nope" as never, operands: ["1"] })).toThrow(CalcError);
  });

  it("pembulatan konsisten dan dilaporkan di `rule`", () => {
    expect(calculate({ op: "round", operands: ["2.5"], precision: 0, rounding: "half-even" }).value).toBe("2");
    expect(calculate({ op: "round", operands: ["3.5"], precision: 0, rounding: "half-even" }).value).toBe("4");
    expect(calculate({ op: "round", operands: ["2.5"], precision: 0, rounding: "half-up" }).value).toBe("3");
    expect(calculate({ op: "round", operands: ["-2.5"], precision: 0, rounding: "floor" }).value).toBe("-3");
    const result = calculate({ op: "round", operands: ["1.2345"], precision: 2 });
    expect(result.rule).toBe("round(2, half-up)");
    expect(result.rounded).toBe(true);
  });

  it("negatif: round tanpa precision dan mode asing ditolak", () => {
    expect(() => calculate({ op: "round", operands: ["1.5"] })).toThrow(CalcError);
    expect(() => calculate({ op: "round", operands: ["1.5"], precision: 99 })).toThrow(CalcError);
    expect(() =>
      calculate({ op: "round", operands: ["1.5"], precision: 1, rounding: "nearest" as never }),
    ).toThrow(CalcError);
  });

  it("sqrt negatif dan pangkat pecahan ditolak", () => {
    expect(() => calculate({ op: "sqrt", operands: ["-4"] })).toThrow(CalcError);
    expect(() => calculate({ op: "pow", operands: ["2", "0.5"] })).toThrow(CalcError);
    expect(calculate({ op: "pow", operands: ["2", "10"] }).value).toBe("1024");
  });
});

describe("describe (statistik)", () => {
  it("melaporkan n, data hilang, satuan, dan metode", () => {
    const result = describeStats({ values: [2, 4, 4, 4, 5, 5, 7, 9], unit: "kg" });
    expect(result.n).toBe(8);
    expect(result.missing).toBe(0);
    expect(result.unit).toBe("kg");
    expect(result.mean).toBe(5);
    expect(result.stdDev).toBeCloseTo(2.138, 3);
    expect(result.method).toMatch(/n-1/);
  });

  it("null dan NaN dihitung sebagai data hilang, bukan dibuang diam-diam", () => {
    const result = describeStats({ values: [1, null, 3, Number.NaN] });
    expect(result.n).toBe(2);
    expect(result.missing).toBe(2);
    expect(result.mean).toBe(2);
  });

  it("populasi memakai pembagi n; median genap = rata-rata dua tengah", () => {
    const result = describeStats({ values: [1, 2, 3, 4], kind: "population" });
    expect(result.stdDev).toBeCloseTo(1.118, 3);
    expect(result.median).toBe(2.5);
    expect(result.method).toMatch(/pembagi n/);
  });

  it("negatif: sampel n=1 → stdDev null, bukan 0 yang menyesatkan", () => {
    expect(describeStats({ values: [5] }).stdDev).toBeNull();
    expect(describeStats({ values: [] }).mean).toBeNull();
    expect(() => describeStats({ values: [1], kind: "median" as never })).toThrow(CalcError);
  });
});

describe("countText", () => {
  it("membedakan kata, unit UTF-16, code point, grapheme, dan byte", () => {
    const result = countText("Halo dunia 👨‍👩‍👧");
    // Emoji bukan word-like: 2 kata, bukan 3.
    expect(result.words).toBe(2);
    expect(result.characters).toBe(19);
    expect(result.codePoints).toBe(16);
    expect(result.graphemes).toBe(12);
    expect(result.bytes).toBe(29);
    expect(result.method).toMatch(/Intl\.Segmenter/);
  });

  it("negatif: bukan string ditolak", () => {
    expect(() => countText(42 as never)).toThrow(CalcError);
  });
});

describe("renderChart", () => {
  const points = [
    { label: "Jan", value: 10 },
    { label: "Feb", value: 30 },
  ];

  it("SVG memuat data, tanpa script, dan membawa tabel alternatif", () => {
    const { svg, table } = renderChart({ kind: "bar", points, title: "Penjualan", unit: "Rp" });
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<script");
    expect(svg).not.toMatch(/on\w+=/);
    expect(svg).toContain('role="img"');
    expect(table).toContain("<caption>Penjualan");
    expect(table).toContain("<td>Feb</td><td>30</td>");
    expect(table).toContain("<th scope=\"col\">");
  });

  it("label di-escape sehingga tidak bisa menyuntik markup", () => {
    const { svg, table } = renderChart({
      kind: "line",
      points: [{ label: "<img src=x onerror=alert(1)>", value: 1 }],
      title: "<b>x</b>",
    });
    expect(svg).not.toContain("<img");
    expect(svg).toContain("&lt;img");
    expect(table).not.toContain("<img");
  });

  it("negatif: data kosong, NaN, dan jenis asing ditolak", () => {
    expect(() => renderChart({ kind: "bar", points: [], title: "x" })).toThrow(ChartError);
    expect(() =>
      renderChart({ kind: "bar", points: [{ label: "a", value: Number.NaN }], title: "x" }),
    ).toThrow(ChartError);
    expect(() => renderChart({ kind: "pie" as never, points, title: "x" })).toThrow(ChartError);
  });
});

describe("makeQr", () => {
  it("QR dibuat lalu decode ulang cocok dengan payload", () => {
    const payload = "https://kawanku.tokengateway.ai.id/dokumen/42";
    const result = makeQr(payload);
    expect(result.decoded).toBe(payload);
    expect(result.preview).toBe(payload);
    expect(result.svg).toContain("<svg");
    expect(result.svg).not.toContain("<script");
    expect(result.modules).toBeGreaterThan(20);
  });

  it("payload unicode dan panjang sedang tetap terbaca kembali", () => {
    const payload = "Halo, ini pratinjau QR dengan émoji 🎯 dan teks panjang ".repeat(4);
    expect(makeQr(payload).decoded).toBe(payload);
  });

  it("negatif: payload kosong dan terlalu panjang ditolak", () => {
    expect(() => makeQr("")).toThrow(QrError);
    expect(() => makeQr("   ")).toThrow(QrError);
    expect(() => makeQr("a".repeat(2_000))).toThrow(QrError);
  });

  it("barcode 1D dijawab UNSUPPORTED_SYMBOLOGY, bukan gambar tanpa verifikasi", () => {
    try {
      makeBarcode();
      throw new Error("seharusnya melempar");
    } catch (err) {
      expect((err as QrError).code).toBe("UNSUPPORTED_SYMBOLOGY");
    }
  });
});
