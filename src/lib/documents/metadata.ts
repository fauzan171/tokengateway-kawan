/**
 * Metadata berkas (FIX-14).
 *
 * Empat tanggal/hal yang sering dicampur dan tidak boleh dianggap setara:
 *   - `clientFilename`  — nama dari klien, bisa menyesatkan, hanya label;
 *   - `uploadedAt`      — waktu server menerima berkas (fakta server);
 *   - `embeddedCreated` — tanggal di dalam berkas, bisa dikarang;
 *   - `exif`            — metadata kamera, TIDAK membuktikan lokasi/identitas.
 *
 * EXIF/GPS dibuang pada keluaran publik: koordinat di dalam foto bukan bukti
 * tempat, dan menyebarkannya membocorkan lokasi tanpa diminta.
 */

import { SaxesParser } from "saxes";
import { readZip } from "@/lib/artifacts/zip";

export type FileMetadata = {
  clientFilename: string;
  uploadedAt: string;
  /** Tanggal pembuatan yang tertanam di berkas; null bila tidak ada. */
  embeddedCreated: string | null;
  /** Penulis yang tertanam; null bila tidak ada. Tidak diverifikasi. */
  embeddedAuthor: string | null;
  /** Selalu false: EXIF/GPS sengaja tidak dipertahankan. */
  locationRetained: false;
  /** Field yang ada di berkas tapi sengaja dibuang. */
  strippedFields: string[];
  /** Hal yang tidak bisa diketahui dari berkas. */
  unknown: string[];
};

export type MetadataInput = {
  clientFilename: string;
  uploadedAt: Date;
  data: Buffer;
  format: "pdf" | "docx" | "xlsx" | "pptx" | "jpeg" | "png" | "text" | "zip" | "unknown";
};

const CORE_PROPS = "docProps/core.xml";

export function readMetadata(input: MetadataInput): FileMetadata {
  const base = {
    clientFilename: input.clientFilename,
    uploadedAt: input.uploadedAt.toISOString(),
    locationRetained: false as const,
  };

  if (input.format === "docx" || input.format === "xlsx" || input.format === "pptx") {
    return { ...base, ...ooxmlMeta(input.data) };
  }
  if (input.format === "pdf") {
    return { ...base, ...pdfMeta(input.data) };
  }
  if (input.format === "jpeg" || input.format === "png") {
    // shortcut: EXIF tidak diurai sama sekali, hanya dideteksi keberadaannya.
    // Tambahkan pembaca EXIF bila ada kebutuhan menampilkan tanggal kamera.
    const hasExif = input.format === "jpeg" && input.data.includes(Buffer.from("Exif\0\0"));
    return {
      ...base,
      embeddedCreated: null,
      embeddedAuthor: null,
      strippedFields: hasExif ? ["exif", "gps"] : [],
      unknown: [
        "tanggal pengambilan foto tidak dibaca",
        "lokasi tidak disimpulkan dari metadata",
      ],
    };
  }

  return {
    ...base,
    embeddedCreated: null,
    embeddedAuthor: null,
    strippedFields: [],
    unknown: ["berkas teks tidak membawa metadata tertanam"],
  };
}

function ooxmlMeta(data: Buffer): Omit<FileMetadata, "clientFilename" | "uploadedAt" | "locationRetained"> {
  let entries: Map<string, Buffer>;
  try {
    entries = readZip(data);
  } catch {
    return {
      embeddedCreated: null,
      embeddedAuthor: null,
      strippedFields: [],
      unknown: ["arsip tidak bisa dibaca; metadata tertanam tidak diketahui"],
    };
  }

  const core = entries.get(CORE_PROPS);
  if (!core) {
    return {
      embeddedCreated: null,
      embeddedAuthor: null,
      strippedFields: [],
      unknown: ["docProps/core.xml tidak ada"],
    };
  }

  const fields = new Map<string, string>();
  const parser = new SaxesParser({ xmlns: false });
  let current: string | null = null;
  parser.on("opentag", (node) => {
    current = node.name;
  });
  parser.on("text", (text) => {
    if (current) fields.set(current, (fields.get(current) ?? "") + text);
  });
  parser.on("closetag", () => {
    current = null;
  });
  try {
    parser.write(core.toString("utf8")).close();
  } catch {
    return {
      embeddedCreated: null,
      embeddedAuthor: null,
      strippedFields: [],
      unknown: ["docProps/core.xml rusak"],
    };
  }

  const created = fields.get("dcterms:created") ?? fields.get("created") ?? null;
  const author = fields.get("dc:creator") ?? fields.get("creator") ?? null;
  const parsed = created ? new Date(created) : null;
  const validCreated = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;

  return {
    embeddedCreated: validCreated,
    embeddedAuthor: author && author.trim() !== "" ? author.trim() : null,
    strippedFields: [],
    unknown: validCreated
      ? ["tanggal tertanam tidak diverifikasi; bisa dikarang"]
      : ["tanggal tertanam tidak ada atau tidak valid"],
  };
}

/** PDF: hanya `CreationDate`/`Author` dari Info dictionary. Tidak memakai parser penuh. */
function pdfMeta(data: Buffer): Omit<FileMetadata, "clientFilename" | "uploadedAt" | "locationRetained"> {
  const head = data.subarray(0, Math.min(data.length, 200_000)).toString("latin1");
  const created = /\/CreationDate\s*\(([^)]{4,40})\)/.exec(head)?.[1] ?? null;
  const author = /\/Author\s*\(([^)]{1,200})\)/.exec(head)?.[1] ?? null;

  // Format PDF: D:YYYYMMDDHHmmSS...
  let parsed: string | null = null;
  const match = created ? /D:(\d{4})(\d{2})(\d{2})/.exec(created) : null;
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (!Number.isNaN(date.getTime())) parsed = date.toISOString();
  }

  return {
    embeddedCreated: parsed,
    embeddedAuthor: author && author.trim() !== "" ? author.trim() : null,
    strippedFields: [],
    unknown: ["XMP dan metadata lain tidak dibaca"],
  };
}
