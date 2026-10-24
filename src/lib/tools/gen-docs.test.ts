/**
 * Generator sekali-jalan (P8): menulis docs/tools/<id>.md dari TOOL_CATALOG.
 * Tes kesesuaian (catalog.test.ts) memverifikasi hasilnya. Jalankan ulang
 * manual bila katalog berubah: npx vitest run src/lib/tools/gen-docs.test.ts.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_CATALOG } from "./catalog";

describe("generator docs/tools", () => {
  it("menulis ulang docs/tools/<id>.md dari katalog", () => {
    mkdirSync(join(process.cwd(), "docs", "tools"), { recursive: true });
    for (const doc of TOOL_CATALOG) {
      const argRows = doc.argumen
        .map(
          (a) =>
            `| ${a.nama} | ${a.tipe} | ${a.wajib === true ? "ya" : a.wajib === "bersyarat" ? "bersyarat" : "tidak"} | ${a.batas ?? "-"} | ${a.keterangan} |`,
        )
        .join("\n");
      const failRows = doc.kegagalan.map((k) => `| ${k.kode} | ${k.arti} | ${k.tindakanModel} |`).join("\n");
      const batasRows = Object.entries(doc.batas)
        .filter(([, v]) => v)
        .map(([k, v]) => `| ${k} | ${v} |`)
        .join("\n");
      const md = [
        `# Tool: ${doc.id} (v${doc.version})`,
        "",
        doc.ringkas,
        "",
        `- Efek: **${doc.efek}**${doc.approval ? " (butuh approval)" : ""}`,
        `- Hasil: ${doc.hasil}`,
        "",
        "## Kapan dipakai",
        "",
        ...doc.kapanDipakai.map((k) => `- ${k}`),
        "",
        "## Kapan JANGAN dipakai",
        "",
        ...doc.kapanJangan.map((k) => `- ${k}`),
        "",
        "## Argumen",
        "",
        "| Nama | Tipe | Wajib | Batas | Keterangan |",
        "|---|---|---|---|---|",
        argRows,
        "",
        "## Batas",
        "",
        "| Aspek | Nilai |",
        "|---|---|",
        batasRows,
        "",
        "## Contoh",
        "",
        "Valid:",
        "",
        "```json",
        doc.contoh.valid,
        "```",
        "",
        "Tidak valid:",
        "",
        "```json",
        doc.contoh.tidakValid,
        "```",
        "",
        "## Kegagalan",
        "",
        "| Kode | Arti | Tindakan model |",
        "|---|---|---|",
        failRows,
        "",
        "---",
        "",
        "Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga",
        "pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.",
        "",
      ].join("\n");
      writeFileSync(join(process.cwd(), "docs", "tools", doc.id + ".md"), md);
    }
    expect(TOOL_CATALOG.length).toBeGreaterThan(0);
  });
});
