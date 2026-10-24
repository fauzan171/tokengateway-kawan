/**
 * Pembuat dokumen ekspor percakapan (PDF, DOCX, XLSX) tanpa dependensi baru.
 *
 * Alasan pilihan implementasi:
 * - PDF dibuat sebagai PDF 1.4 minimal (objek + xref) langsung di server, bukan
 *   lewat `window.print()`. Dengan begitu ketiga format punya kontrak HTTP yang
 *   sama: `GET ?format=pdf|docx|xlsx` dan diunduh sebagai lampiran.
 * - DOCX dan XLSX sama-sama OOXML: arsip ZIP berisi XML. ZIP ditulis oleh
 *   `zipBytes` di bawah (~50 baris, STORE tanpa kompresi) memakai `node:zlib`
 *   hanya untuk CRC32; tidak ada `child_process` maupun `node:zlib` deflate.
 *
 * Semua fungsi murni dan deterministik: diberi transkrip yang sama, keluarannya
 * sama. Ini memudahkan uji magic bytes tanpa perlu database.
 */

import { crc32 } from "node:zlib";
import { TEMA } from "@/lib/artifacts/theme";

export type ChatTranscriptMessage = {
  role: string;
  text: string;
};

export type ChatTranscript = {
  title: string;
  messages: ChatTranscriptMessage[];
};

/** Label peran untuk dokumen; konsisten dengan ekspor Markdown. */
function roleLabel(role: string): string {
  if (role === "user") return "Kamu";
  if (role === "assistant") return "Kawan";
  return "Sistem";
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// PDF minimal
// ---------------------------------------------------------------------------

/** Karakter di luar Latin-1 diganti `?` karena font inti memakai WinAnsi. */
function latin1(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    out += code <= 0xff ? char : "?";
  }
  return out;
}

function pdfString(text: string): string {
  return latin1(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function exportChatPdfBytes(chat: ChatTranscript): Buffer {
  const lines = [chat.title, ""];
  for (const message of chat.messages) {
    lines.push(`${roleLabel(message.role)}: ${message.text}`, "");
  }

  const draw = lines.map((line) => `(${pdfString(line)}) Tj T*`).join("\n");
  // MediaBox dan geometri teks dari TEMA bersama (D2) supaya kedua jalur PDF
  // memakai halaman yang sama.
  const baseline = TEMA.page.height - TEMA.pdf.firstBaselineOffset;
  const content = `BT\n/F1 ${TEMA.font.chat} Tf\n${TEMA.pdf.marginX} ${baseline} Td\n${TEMA.lineGap} TL\n${draw}\nET`;

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${TEMA.page.width} ${TEMA.page.height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  const chunks: Buffer[] = [];
  let offset = 0;
  const push = (chunk: Buffer): number => {
    const start = offset;
    chunks.push(chunk);
    offset += chunk.length;
    return start;
  };

  push(Buffer.from("%PDF-1.4\n", "latin1"));
  const objectOffsets = objects.map((body, index) => {
    const off = push(Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, "latin1"));
    return off;
  });

  const xrefOffset = offset;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...objectOffsets.map((off) => `${String(off).padStart(10, "0")} 00000 n `),
  ].join("\n");
  push(Buffer.from(`${xref}\n`, "latin1"));
  push(
    Buffer.from(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      "latin1",
    ),
  );

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// DOCX (OOXML)
// ---------------------------------------------------------------------------

export function exportChatDocxBytes(chat: ChatTranscript): Buffer {
  const paragraphs = [
    { heading: true, text: chat.title },
    ...chat.messages.map((message) => ({
      heading: false,
      text: `${roleLabel(message.role)}: ${message.text}`,
    })),
  ];

  const body = paragraphs
    .map((paragraph) => {
      const text = xml(paragraph.text);
      return paragraph.heading
        ? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`
        : `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
    })
    .join("");

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}</w:body></w:document>`;

  return zipBytes([
    {
      name: "[Content_Types].xml",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>",
    },
    { name: "word/document.xml", data: documentXml },
  ]);
}

// ---------------------------------------------------------------------------
// XLSX (OOXML)
// ---------------------------------------------------------------------------

export function exportChatXlsxBytes(chat: ChatTranscript): Buffer {
  const rows: { a: string; b: string }[] = [
    { a: "Judul", b: chat.title },
    { a: "Peran", b: "Teks" },
    ...chat.messages.map((message) => ({ a: roleLabel(message.role), b: message.text })),
  ];

  const cells = (index: number, a: string, b: string): string =>
    `<row r="${index}">` +
    `<c r="A${index}" t="inlineStr"><is><t xml:space="preserve">${xml(a)}</t></is></c>` +
    `<c r="B${index}" t="inlineStr"><is><t xml:space="preserve">${xml(b)}</t></is></c>` +
    "</row>";

  const sheetXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rows.map((row, index) => cells(index + 1, row.a, row.b)).join("")}</sheetData>` +
    "</worksheet>";

  return zipBytes([
    {
      name: "[Content_Types].xml",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    },
    {
      name: "xl/workbook.xml",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Percakapan" sheetId="1" r:id="rId1"/></sheets>' +
        "</workbook>",
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        "</Relationships>",
    },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
  ]);
}

// ---------------------------------------------------------------------------
// ZIP minimal (STORE, tanpa kompresi) untuk wadah OOXML.
// ---------------------------------------------------------------------------

type ZipEntry = { name: string; data: string };

function crc32Of(data: Buffer): number {
  return crc32(data) >>> 0;
}

export function zipBytes(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data, "utf8");
    const crc = crc32Of(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature local file header
    local.writeUInt16LE(20, 4); // versi yang dibutuhkan
    local.writeUInt16LE(0x0800, 6); // flag: nama UTF-8
    local.writeUInt16LE(0, 8); // metode: STORE
    local.writeUInt16LE(0, 10); // waktu modifikasi
    local.writeUInt16LE(0x21, 12); // tanggal modifikasi (1 Jan 1980)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature central directory
    centralHeader.writeUInt16LE(20, 4); // versi pembuat
    centralHeader.writeUInt16LE(20, 6); // versi yang dibutuhkan
    centralHeader.writeUInt16LE(0x0800, 8); // flag UTF-8
    centralHeader.writeUInt16LE(0, 10); // metode STORE
    centralHeader.writeUInt16LE(0, 12); // waktu
    centralHeader.writeUInt16LE(0x21, 14); // tanggal
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30); // panjang extra field
    centralHeader.writeUInt16LE(0, 32); // panjang komentar
    centralHeader.writeUInt16LE(0, 34); // nomor disk awal
    centralHeader.writeUInt16LE(0, 36); // atribut internal
    centralHeader.writeUInt32LE(0, 38); // atribut eksternal
    centralHeader.writeUInt32LE(offset, 42); // offset local header
    central.push(centralHeader, name);

    offset += local.length + name.length + data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // signature end of central directory
  end.writeUInt16LE(0, 4); // nomor disk
  end.writeUInt16LE(0, 6); // disk awal central directory
  end.writeUInt16LE(entries.length, 8); // jumlah entri (disk ini)
  end.writeUInt16LE(entries.length, 10); // jumlah entri (total)
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16); // offset awal central directory
  end.writeUInt16LE(0, 20); // panjang komentar

  return Buffer.concat([...chunks, ...central, end]);
}
