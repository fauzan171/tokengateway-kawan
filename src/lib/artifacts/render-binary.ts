/** Renderer biner (FIX-12): PDF/DOCX/XLSX/PPTX dari DocSchema, murni di memori. */

import PDFDocument from "pdfkit";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";
import type { DocSchema } from "./document";

// Karakter di luar Latin-1 diganti "?" — font inti Helvetica/Courier PDFKit tidak
// punya glifnya; WinAnsi encoding melempar error bila dibiarkan.
const latin1 = (text: string) => text.replace(/[^\x00-\xFF]/g, "?");

/** PDF: heading tebal + besar per level, bullets "• ", table dipisah " | ", code Courier. */
export async function renderPdfBytes(doc: DocSchema): Promise<Buffer> {
  const pdf = new PDFDocument({ bufferPages: true });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    pdf.on("end", resolve);
    pdf.on("error", reject);
  });

  pdf.fontSize(16).font("Helvetica-Bold").text(latin1(doc.title));
  for (const block of doc.blocks) {
    switch (block.type) {
      case "heading": {
        const level = block.level ?? 1;
        const size = level === 1 ? 16 : level === 2 ? 14 : 12;
        pdf.font("Helvetica-Bold").fontSize(size).text(latin1(block.text));
        break;
      }
      case "bullets":
        pdf.font("Helvetica").fontSize(11);
        for (const item of block.items) pdf.text(`• ${latin1(item)}`);
        break;
      case "table":
        pdf.font("Helvetica").fontSize(11);
        pdf.text(latin1(block.headers.join(" | ")));
        for (const row of block.rows) pdf.text(latin1(row.join(" | ")));
        break;
      case "code":
        pdf.font("Courier").fontSize(10).text(latin1(block.text));
        break;
      default:
        pdf.font("Helvetica").fontSize(11).text(latin1(block.text));
    }
  }
  pdf.end();
  await done;
  return Buffer.concat(chunks);
}

/** DOCX: heading via HeadingLevel, bullets, tabel asli, code monospace. */
export async function renderDocxBytes(doc: DocSchema): Promise<Buffer> {
  const HEADING = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;
  const children = [];
  children.push(new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }));
  for (const block of doc.blocks) {
    switch (block.type) {
      case "heading":
        children.push(new Paragraph({ text: block.text, heading: HEADING[block.level ?? 1] }));
        break;
      case "bullets":
        for (const item of block.items) children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
        break;
      case "table":
        children.push(
          new Table({
            rows: [block.headers, ...block.rows].map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (cell) => new TableCell({ children: [new Paragraph(cell)] }),
                  ),
                }),
            ),
          }) as never,
        );
        break;
      case "code":
        children.push(new Paragraph({ children: [new TextRun({ text: block.text, font: "Courier New" })] }));
        break;
      default:
        children.push(new Paragraph({ text: block.text }));
    }
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] })) as unknown as Promise<Buffer>;
}

/**
 * Nama sheet yang sah untuk Excel. Excel menolak `* ? : \\ / [ ]` dan batas 31
 * karakter; judul wajar seperti "Laporan/2026: Q1" dulu menggagalkan seluruh
 * render. Karakter terlarang diganti "-", nama kosong jatuh ke "Sheet1".
 */
export function safeSheetName(title: string): string {
  const cleaned = title
    .replace(/[*?:\\/[\]]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 31);
  return cleaned || "Sheet1";
}

/** XLSX: worksheet bernama `title` (disanitasi, maks 31), table jadi grid. */
export async function renderXlsxBytes(doc: DocSchema): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(safeSheetName(doc.title));
  for (const block of doc.blocks) {
    switch (block.type) {
      case "table": {
        const header = sheet.addRow(block.headers);
        header.font = { bold: true };
        for (const row of block.rows) sheet.addRow(row);
        break;
      }
      default: {
        // ponytail: semua blok non-tabel diratakan jadi satu sel teks di kolom A;
        // naikkan ke multi-baris berformat bila dibutuhkan.
        const text =
          block.type === "bullets"
            ? block.items.map((item) => `• ${item}`).join("\n")
            : block.type === "code"
              ? block.text
              : block.text;
        sheet.addRow([text]);
      }
    }
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

/** PPTX: judul di slide pertama, maksimal 12 blok per slide, table jadi addTable. */
export async function renderPptxBytes(doc: DocSchema): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.title = doc.title;
  let slide = pptx.addSlide();
  slide.addText(doc.title, { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 24, bold: true });
  let used = 0;
  for (const block of doc.blocks) {
    if (used >= 12) {
      slide = pptx.addSlide();
      used = 0;
    }
    if (block.type === "table") {
      slide.addTable(
        [block.headers, ...block.rows].map((row) => row.map((cell) => ({ text: cell }))),
        { x: 0.5, y: 1.3, w: 9 },
      );
      used++;
    } else {
      const text =
        block.type === "bullets"
          ? block.items.map((item) => `• ${item}`).join("\n")
          : block.type === "heading"
            ? block.text
            : block.text;
      slide.addText(text, { x: 0.5, y: 1.3 + used * 0.6, w: 9, h: 0.6, fontSize: 12 });
      used++;
    }
  }
  return pptx.write({ outputType: "nodebuffer" }) as unknown as Promise<Buffer>;
}
