/**
 * Uji D4: tiga template sebagai data — menghasilkan DocSchema valid yang
 * lolos batas kanonik, bukan mesin tata letak.
 */

import { describe, expect, it } from "vitest";
import { ArtifactError } from "./render";
import { buildDocFromTemplate, DOC_TEMPLATE_IDS, templateLaporan, templateRekap, templateSurat } from "./templates";
import { parseDocSchema } from "./document";
import { renderDocxBytes, renderXlsxBytes } from "./render-binary";

describe("templateLaporan", () => {
  it("menyusun bab + tabel + caption + penutup dalam urutan dokumen wajar", () => {
    const doc = templateLaporan({
      judul: "Laporan Q1",
      subtitle: "Kuartal pertama 2026",
      ringkasan: "Ringkasan singkat.",
      bab: [
        {
          judul: "Pendahuluan",
          paragraf: ["Paragraf satu.", "Paragraf dua."],
          bullets: ["butir a", "butir b"],
          tabel: { headers: ["k", "v"], rows: [["1", "satu"]], caption: "Tabel 1 — contoh" },
        },
      ],
      penutup: "Demikian laporan ini.",
    });
    expect(doc.title).toBe("Laporan Q1");
    const types = doc.blocks.map((b) => b.type);
    expect(types).toEqual([
      "paragraph", // subtitle
      "heading", "paragraph", // ringkasan
      "heading", "paragraph", "paragraph", "bullets", "table", "paragraph", // bab + caption
      "paragraph", // penutup
    ]);
    expect(doc.truncated).toBe(false);
    expect(doc.unknownBlocks).toBe(0);
  });

  it("bab kosong atau judul kosong ditolak INVALID_TOOL_ARGS", () => {
    expect(() => templateLaporan({ judul: "x", bab: [] })).toThrowError(ArtifactError);
    expect(() => templateLaporan({ bab: [{ judul: "a", paragraf: ["x"] }] })).toThrowError(/judul/i);
  });
});

describe("templateSurat", () => {
  it("kop + nomor/tanggal + tujuan + isi + penutup + tanda tangan", () => {
    const doc = templateSurat({
      kop: "PT Contoh",
      nomor: "001/2026",
      tanggal: "24 Oktober 2026",
      tujuan: "Yth. Budi",
      isi: ["Dengan hormat,", "Isi surat."],
      penutup: "Terima kasih.",
      penandaTangan: "Andi",
      jabatan: "Direktur",
    });
    expect(doc.title).toBe("PT Contoh");
    // heading kop, divider, nomor·tanggal, tujuan, 2 isi, penutup, ttd, jabatan
    expect(doc.blocks).toHaveLength(9);
    expect(doc.blocks[1]).toEqual({ type: "divider" });
    expect((doc.blocks[2] as { text: string }).text).toContain("Nomor: 001/2026");
    expect((doc.blocks[2] as { text: string }).text).toContain("24 Oktober 2026");
  });

  it("nomor/tanggal opsional; tujuan wajib", () => {
    const doc = templateSurat({ kop: "K", tujuan: "X", isi: ["i"], penutup: "p", penandaTangan: "t" });
    expect(doc.blocks).toHaveLength(6);
    expect(() => templateSurat({ kop: "K", isi: ["i"], penutup: "p", penandaTangan: "t" })).toThrowError(/tujuan/i);
  });
});

describe("templateRekap", () => {
  it("pembuka + tabel + caption; rows non-string dibuang", () => {
    const doc = templateRekap({
      judul: "Rekap Penjualan",
      pembuka: "Ringkasan bulan ini.",
      headers: ["bulan", "nilai"],
      rows: [["jan", "10"], [null], ["feb", "12"]],
      caption: "Sumber: sistem internal.",
    });
    expect(doc.blocks).toHaveLength(3);
    expect((doc.blocks[1] as { rows: string[][] }).rows).toEqual([["jan", "10"], ["feb", "12"]]);
  });

  it("headers kosong / rows tanpa baris sah ditolak", () => {
    expect(() => templateRekap({ judul: "r", headers: [], rows: [["a"]] })).toThrowError(ArtifactError);
    expect(() => templateRekap({ judul: "r", headers: ["a"], rows: [[1]] })).toThrowError(/rows/);
  });
});

describe("buildDocFromTemplate", () => {
  it("menolak template tak dikenal dengan pesan yang menyebut pilihan sah", () => {
    expect(() => buildDocFromTemplate("kwitansi", {})).toThrowError(/laporan, surat, rekap/);
  });

  it("ID terdaftar sama dengan tiga template riset §4.2", () => {
    expect([...DOC_TEMPLATE_IDS]).toEqual(["laporan", "surat", "rekap"]);
  });

  it("output template lolos parseDocSchema penuh (batas kanonik tunggal)", () => {
    const doc = buildDocFromTemplate("laporan", {
      judul: "L",
      bab: [{ judul: "b", paragraf: ["x".repeat(30_000)] }],
    });
    // Teks > 20.000 char dipotong + truncated — bukti batas ditegakkan.
    expect(doc.truncated).toBe(true);
    expect(parseDocSchema({ title: doc.title, blocks: doc.blocks })).toBeTruthy();
  });

  it("hasil template bisa dirender docx dan xlsx (tanpa galat)", async () => {
    const surat = templateSurat({ kop: "K", tujuan: "X", isi: ["i"], penutup: "p", penandaTangan: "t" });
    const docx = await renderDocxBytes({ title: surat.title, blocks: surat.blocks });
    expect(docx.subarray(0, 2).toString("latin1")).toBe("PK");
    const rekap = templateRekap({ judul: "R", headers: ["a"], rows: [["1"]] });
    const xlsx = await renderXlsxBytes({ title: rekap.title, blocks: rekap.blocks });
    expect(xlsx.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
