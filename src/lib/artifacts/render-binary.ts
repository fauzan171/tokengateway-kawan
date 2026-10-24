/** Renderer biner (FIX-12): PDF/DOCX/XLSX/PPTX dari DocSchema, murni di memori. */

import PDFDocument from "pdfkit";
import {
  Document,
  HeadingLevel,
  ImageRun,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";
import type { DocBlock, DocSchema } from "./document";
import { TEMA } from "./theme";

/**
 * Resolver gambar D3: `image.artifactId` -> byte + mime milik user yang sudah
 * tervalidasi (ready, owner). `null` = gambar dilewati, bukan menggagalkan
 * render — satu gambar hilang tidak boleh membuang seluruh dokumen.
 */
export type ImageResolver = (artifactId: string) => Promise<{ bytes: Buffer; mime: string } | null>;

// Catatan pdf-nonlatin (D2): font inti Helvetica/Courier PDFKit tidak punya
// glif di luar Latin-1; WinAnsi encoding melempar error bila dibiarkan, jadi
// karakter >U+00FF diganti "?". Bila butuh CJK/emoji/aksara asli, sematkan TTF
// Unicode (opsi B, DITUNDA) — bukan perbaikan satu baris.
const latin1 = (text: string) => text.replace(/[^\x00-\xFF]/g, "?");

/** PDF: heading tebal + besar per level, bullets/daftar bernomor, table " | ", code Courier, D3: pageBreak/divider/image. */
export async function renderPdfBytes(doc: DocSchema, resolveImage: ImageResolver | null = null): Promise<Buffer> {
  // Ukuran halaman dan margin dari TEMA (D2): dulu PDFKit memakai default Letter
  // 612x792, berbeda dari jalur transkrip percakapan.
  const pdf = new PDFDocument({
    bufferPages: true,
    size: [TEMA.page.width, TEMA.page.height],
    margin: TEMA.margin,
  });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    pdf.on("end", resolve);
    pdf.on("error", reject);
  });

  pdf.fontSize(TEMA.font.title).font("Helvetica-Bold").text(latin1(doc.title));
  for (const block of doc.blocks) {
    switch (block.type) {
      case "heading": {
        const level = block.level ?? 1;
        const size = TEMA.font.heading[level];
        pdf.font("Helvetica-Bold").fontSize(size).text(latin1(block.text));
        break;
      }
      case "bullets":
        pdf.font("Helvetica").fontSize(TEMA.font.body);
        block.items.forEach((item, index) => {
          // D3: ordered -> "1. ", bukan "• ".
          const marker = block.ordered ? `${index + 1}. ` : "• ";
          pdf.text(`${marker}${latin1(item)}`);
        });
        break;
      case "table":
        pdf.font("Helvetica").fontSize(TEMA.font.body);
        pdf.text(latin1(block.headers.join(" | ")));
        for (const row of block.rows) pdf.text(latin1(row.join(" | ")));
        break;
      case "code":
        pdf.font(TEMA.font.mono).fontSize(TEMA.font.code).text(latin1(block.text));
        break;
      // D3: pindah halaman; divider = garis horizontal penuh.
      case "pageBreak":
        pdf.addPage();
        break;
      case "divider":
        pdf
          .moveTo(TEMA.margin, pdf.y + TEMA.font.body)
          .lineTo(TEMA.page.width - TEMA.margin, pdf.y + TEMA.font.body)
          .lineWidth(1)
          .stroke();
        pdf.y += TEMA.font.body * 2;
        break;
      case "image":
        await renderPdfImage(pdf, block, resolveImage);
        break;
      default:
        pdf.font("Helvetica").fontSize(TEMA.font.body).text(latin1(block.text));
    }
  }
  pdf.end();
  await done;
  return Buffer.concat(chunks);
}

/**
 * Gambar PDF (D3): lebar relatif widthPct terhadap kolom teks, tinggi
 * mengikuti rasio asli byte. Resolver null / artefak hilang / byte yang tidak
 * bisa digambar PDFKit -> teks pengganti [alt], bukan galat: satu gambar
 * hilang tidak boleh membuang seluruh dokumen.
 */
async function renderPdfImage(
  pdf: PDFDocument,
  block: Extract<DocBlock, { type: "image" }>,
  resolveImage: ImageResolver | null,
): Promise<void> {
  const columnWidth = TEMA.page.width - TEMA.margin * 2;
  const stored = resolveImage ? await resolveImage(block.artifactId) : null;
  if (!stored) {
    pdf.font("Helvetica").fontSize(TEMA.font.body).text(latin1(`[${block.alt}]`));
    return;
  }
  const width = (columnWidth * (block.widthPct ?? 100)) / 100;
  const height = imageHeightFromBytes(stored.bytes, width);
  try {
    pdf.image(stored.bytes, TEMA.margin, pdf.y, { width, height });
    // pdfkit tidak memajukan pdf.y setelah image; majukan manual.
    pdf.y += height;
  } catch {
    // Byte rusak / format tak didukung PDFKit -> pengganti teks, bukan galat.
    pdf.font("Helvetica").fontSize(TEMA.font.body).text(latin1(`[${block.alt}]`));
  }
  if (block.caption) {
    pdf.font("Helvetica").fontSize(TEMA.font.body).text(latin1(block.caption));
  }
}

/** Ukuran piksel PNG/JPEG dari byte; null bila header tak terbaca. */
function imageSize(bytes: Buffer): { width: number; height: number } | null {
  // PNG: 8 byte tanda + IHDR di offset 16.
  if (bytes.length > 24 && bytes.subarray(0, 8).equals(PNG_SIG)) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: cari marker SOF0/SOF2 (0xFFC0/0xFFC2).
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return null;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);

/** Lebar kolom teks A4 (595 pt - 2 margin 72 pt); dipakai semua renderer D3. */
const CONTENT_WIDTH_PT = TEMA.page.width - TEMA.margin * 2;
/** 1 piksel = 1/96 inci = 0,75 pt (konversi pt -> px untuk docx/xlsx). */
const PT_PER_PX = 72 / 96;

/** Tinggi render dari byte asli: fallback persegi bila ukuran tak terbaca. */
function imageHeightFromBytes(bytes: Buffer, width: number): number {
  const size = imageSize(bytes);
  if (!size || !size.width || !size.height) return width;
  return (width * size.height) / size.width;
}

/** Jenis gambar untuk ImageRun docx / extension exceljs dari magic bytes. */
function imageTypeOf(bytes: Buffer): "png" | "jpg" {
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(JPEG_SIG)) return "jpg";
  return "png";
}

/** Konversi tipe ImageRun docx -> extension yang diterima exceljs. */
const excelExtension = (type: "png" | "jpg"): "png" | "jpeg" => (type === "jpg" ? "jpeg" : "png");

/** DOCX: heading via HeadingLevel, bullets/daftar bernomor, tabel asli, code monospace, D3: pageBreak/divider/image. */
export async function renderDocxBytes(doc: DocSchema, resolveImage: ImageResolver | null = null): Promise<Buffer> {
  const HEADING = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;
  const children = [];
  children.push(new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE }));
  for (const block of doc.blocks) {
    switch (block.type) {
      case "heading":
        children.push(new Paragraph({ text: block.text, heading: HEADING[block.level ?? 1] }));
        break;
      case "bullets":
        // D3: ordered -> nomor eksplisit di teks (bullet native tidak bernomor).
        block.items.forEach((item, index) => {
          const text = block.ordered ? `${index + 1}. ${item}` : item;
          children.push(new Paragraph({ text, bullet: { level: 0 } }));
        });
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
        children.push(new Paragraph({ children: [new TextRun({ text: block.text, font: TEMA.font.mono, color: "111827" })] }));
        break;
      // D3: PageBreak jadi anak Paragraph; divider = thematicBreak (garis
      // horizontal) tanpa pBdr manual.
      case "pageBreak":
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case "divider":
        children.push(new Paragraph({ thematicBreak: true }));
        break;
      case "image": {
        const stored = resolveImage ? await resolveImage(block.artifactId) : null;
        if (!stored) {
          children.push(new Paragraph({ text: `[${block.alt}]` }));
        } else {
          // Lebar konten A4 (595 pt) dikurangi margin 1 inci x2 = 451 pt;
          // transformation docx dalam piksel (96 px = 1 inci = 72 pt).
          const maxPx = Math.round((CONTENT_WIDTH_PT * (block.widthPct ?? 100)) / 100 / PT_PER_PX);
          const size = imageSize(stored.bytes);
          // Ukuran tak terbaca -> persegi: fallback yang jujur, bukan galat.
          const w = maxPx;
          const h = size && size.width > 0 ? Math.round((w * size.height) / size.width) : w;
          try {
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: imageTypeOf(stored.bytes),
                    data: stored.bytes,
                    transformation: { width: w, height: h },
                    altText: { title: block.alt, description: block.alt, name: "gambar" },
                  }),
                ],
              }),
            );
          } catch {
            // Tipe byte tak dikenal docx -> teks pengganti, bukan galat.
            children.push(new Paragraph({ text: `[${block.alt}]` }));
          }
        }
        if (block.caption) children.push(new Paragraph({ text: block.caption }));
        break;
      }
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

/** XLSX: worksheet bernama `title` (disanitasi, maks 31), table jadi grid, D3: ordered + pageBreak/divider jadi catatan + image jadi rujukan. */
export async function renderXlsxBytes(doc: DocSchema, resolveImage: ImageResolver | null = null): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(safeSheetName(doc.title));
  for (const block of doc.blocks) {
    switch (block.type) {
      case "table": {
        const header = sheet.addRow(block.headers);
        header.font = { bold: true, color: { argb: "FF" + TEMA.color.text.slice(1).toUpperCase() } };
        for (const row of block.rows) sheet.addRow(row);
        break;
      }
      case "image": {
        // D3: gambar di-anchor di sel pada baris berjalan; catatan alt tetap
        // ditulis supaya blok terlihat sebagai data, bukan hanya objek melayang.
        const row = sheet.rowCount + 1;
        sheet.addRow([`[${block.alt}]`, block.caption ?? ""]);
        const stored = resolveImage ? await resolveImage(block.artifactId) : null;
        if (stored && imageSize(stored.bytes)) {
          const wPx = Math.round((CONTENT_WIDTH_PT * (block.widthPct ?? 100)) / 100 / PT_PER_PX);
          const size = imageSize(stored.bytes) as { width: number; height: number };
          const hPx = Math.round((wPx * size.height) / size.width);
          try {
            const imageId = workbook.addImage({
              buffer: stored.bytes as unknown as ExcelJS.Buffer,
              extension: excelExtension(imageTypeOf(stored.bytes)),
            });
            sheet.addImage(imageId, {
              tl: { col: 0, row: Math.max(0, row - 1) },
              ext: { width: wPx, height: hPx },
            });
          } catch {
            // ExcelJS menolak byte -> catatan baris sudah ada; lanjut tanpa galat.
          }
        }
        break;
      }
      default: {
        // ponytail: semua blok non-tabel diratakan jadi satu sel teks di kolom A;
        // naikkan ke multi-baris berformat bila dibutuhkan.
        // D3: pageBreak/divider diabaikan di grid TAPI dicatat sebagai baris —
        // diam berarti pengguna XLSX tidak tahu bloknya ada (riset §3).
        if (block.type === "pageBreak" || block.type === "divider") {
          sheet.addRow([block.type === "pageBreak" ? "[pemisah halaman]" : "[garis pemisah]"]);
          break;
        }
        const text =
          block.type === "bullets"
            ? block.items
                .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `• ${item}`))
                .join("\n")
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

/**
 * PPTX (D6): tata letak berbasis tinggi terhitung, bukan rumus tetap.
 *
 * Slide LAYOUT_16x9 = 10 x 5,625 inci. Kursor konten mulai di y = 1,3 (di bawah
 * judul). Setiap blok menghitung tinggi konsumsinya; saat kursor melewati
 * SLIDE_CONTENT_BOTTOM, slide baru dibuat — tidak ada lagi blok yang "meluber"
 * ke bawah tepi (temuan riset T4). Tabel mendapat slide sendiri (satu tabel
 * per slide) dan dipotong ke 8 kolom — lebih ketat dari batas kanonik 12
 * karena lebar slide hanya 10 inci.
 */
const SLIDE_CONTENT_TOP_IN = 1.3;
const SLIDE_CONTENT_BOTTOM_IN = 5.4;
const PPTX_TEXT_H_IN = 0.6;
const PPTX_TABLE_MAX_COLS = 8;

export async function renderPptxBytes(doc: DocSchema, resolveImage: ImageResolver | null = null): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.title = doc.title;
  let slide = pptx.addSlide();
  slide.addText(doc.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.8,
    fontSize: TEMA.ptx.title,
    bold: true,
    color: TEMA.color.text.slice(1).toUpperCase(),
  });
  let cursor = SLIDE_CONTENT_TOP_IN;
  const newSlide = (): void => {
    slide = pptx.addSlide();
    cursor = SLIDE_CONTENT_TOP_IN;
  };
  for (const block of doc.blocks) {
    if (block.type === "pageBreak") {
      // D3: slide baru — pemisah paling alami di deck. D6: tidak dianggap
      // konsumsi tinggi.
      newSlide();
      continue;
    }
    if (block.type === "table") {
      // D6: satu tabel per slide (semua tabel lama diletakkan di y sama dan
      // saling menimpa). Potong kolom ke batas PPTX 8 — lebih ketat dari
      // batas kanonik 12 karena slide hanya 10 inci.
      newSlide();
      const headers = block.headers.slice(0, PPTX_TABLE_MAX_COLS);
      const rows = block.rows.map((row) => row.slice(0, PPTX_TABLE_MAX_COLS));
      slide.addTable(
        [headers, ...rows].map((row) =>
          row.map((cell, index) => ({
            text: cell,
            options: {
              fontSize: TEMA.ptx.body,
              fill: index % 2 === 0 ? undefined : { color: TEMA.color.tableAlt.slice(1).toUpperCase() },
            },
          })),
        ),
        { x: 0.5, y: SLIDE_CONTENT_TOP_IN, w: 9 },
      );
      cursor = SLIDE_CONTENT_BOTTOM_IN;
      continue;
    }
    if (block.type === "divider") {
      // D3: garis horizontal penuh; D6: tinggi satu baris teks.
      if (cursor + PPTX_TEXT_H_IN > SLIDE_CONTENT_BOTTOM_IN) newSlide();
      slide.addShape(pptx.ShapeType.line, { x: 0.5, y: cursor, w: 9, h: 0 });
      cursor += PPTX_TEXT_H_IN;
      continue;
    }
    if (block.type === "image") {
      // D3: gambar via data URL; lebar relatif dari lebar konten 9 inci.
      // D6: tinggi rasio ikut dihitung — gambar tinggi memicu slide baru.
      const stored = resolveImage ? await resolveImage(block.artifactId) : null;
      const w = (9 * (block.widthPct ?? 100)) / 100;
      const size = stored ? imageSize(stored.bytes) : null;
      const h = stored
        ? size && size.width > 0
          ? (w * size.height) / size.width
          : w
        : PPTX_TEXT_H_IN;
      const captionH = block.caption ? 0.4 : 0;
      if (cursor + h + captionH > SLIDE_CONTENT_BOTTOM_IN) newSlide();
      if (stored) {
        slide.addImage({
          data: `data:${stored.mime};base64,${stored.bytes.toString("base64")}`,
          x: 0.5,
          y: cursor,
          w,
          h,
        });
      } else {
        slide.addText(`[${block.alt}]`, {
          x: 0.5,
          y: cursor,
          w: 9,
          h: PPTX_TEXT_H_IN,
          fontSize: TEMA.ptx.body,
          color: TEMA.color.text.slice(1).toUpperCase(),
        });
      }
      if (block.caption) {
        slide.addText(block.caption, {
          x: 0.5,
          y: cursor + h + 0.05,
          w: 9,
          h: 0.4,
          fontSize: TEMA.ptx.body,
          color: TEMA.color.text.slice(1).toUpperCase(),
        });
      }
      cursor += h + captionH;
      continue;
    }
    const text =
      block.type === "bullets"
        ? block.items
            .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `• ${item}`))
            .join("\n")
        : block.type === "heading"
          ? block.text
          : block.text;
    if (cursor + PPTX_TEXT_H_IN > SLIDE_CONTENT_BOTTOM_IN) newSlide();
    slide.addText(text, {
      x: 0.5,
      y: cursor,
      w: 9,
      h: PPTX_TEXT_H_IN,
      fontSize: TEMA.ptx.body,
      color: TEMA.color.text.slice(1).toUpperCase(),
    });
    cursor += PPTX_TEXT_H_IN;
  }
  return pptx.write({ outputType: "nodebuffer" }) as unknown as Promise<Buffer>;
}
