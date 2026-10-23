/**
 * ZIP aman (FIX-12): satu penulis (memakai `zipBytes` yang sudah ada) dan satu
 * pembaca berbatas. Yang ditulis di sini hanyalah validasi — bagian yang tidak
 * boleh dipercaya dari arsip pihak ketiga.
 */

import { inflateRawSync } from "node:zlib";
import { zipBytes } from "@/lib/chat/document-export";
import { ArtifactError } from "./render";

export const ZIP_LIMITS = {
  maxEntries: 256,
  maxUncompressedBytes: 50 * 1024 * 1024,
  /** Rasio ekspansi per entri; deflate normal < 20. */
  maxRatio: 100,
  maxNameLength: 200,
  maxDepth: 8,
} as const;

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** Nama entri relatif: tanpa `..`, tanpa absolut/drive, tanpa backslash/kontrol. */
export function assertSafeEntryName(name: string): string {
  if (typeof name !== "string" || !name || name.length > ZIP_LIMITS.maxNameLength) {
    throw new ArtifactError("ZIP_UNSAFE_PATH");
  }
  if (/[\u0000-\u001f\\]/.test(name)) throw new ArtifactError("ZIP_UNSAFE_PATH");
  if (name.startsWith("/") || /^[a-zA-Z]:/.test(name) || name.endsWith("/")) {
    throw new ArtifactError("ZIP_UNSAFE_PATH");
  }
  const parts = name.split("/");
  if (parts.length > ZIP_LIMITS.maxDepth) throw new ArtifactError("ZIP_TOO_DEEP");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new ArtifactError("ZIP_UNSAFE_PATH");
  }
  return name;
}

export type ZipInputEntry = { name: string; content: string };

/** Paket ZIP: nama divalidasi, duplikat ditolak, jumlah entri dibatasi. */
export function writeZip(entries: readonly ZipInputEntry[]): Buffer {
  if (entries.length > ZIP_LIMITS.maxEntries) throw new ArtifactError("ZIP_TOO_MANY_ENTRIES");
  const seen = new Set<string>();
  const safe = entries.map((entry) => {
    const name = assertSafeEntryName(entry.name);
    if (seen.has(name)) throw new ArtifactError("ZIP_DUPLICATE_ENTRY");
    seen.add(name);
    return { name, data: entry.content };
  });
  return zipBytes(safe);
}

export type ZipLimits = {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  maxRatio?: number;
};

/**
 * Baca ZIP ke memori. Menolak traversal/absolut/duplikat/symlink/terenkripsi,
 * membatasi jumlah entri, total uncompressed, dan rasio ekspansi. Arsip
 * bersarang tidak diekstrak otomatis — isinya dikembalikan sebagai byte.
 */
export function readZip(buffer: Buffer, limits: ZipLimits = {}): Map<string, Buffer> {
  const maxEntries = limits.maxEntries ?? ZIP_LIMITS.maxEntries;
  const maxTotal = limits.maxUncompressedBytes ?? ZIP_LIMITS.maxUncompressedBytes;
  const maxRatio = limits.maxRatio ?? ZIP_LIMITS.maxRatio;

  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66_000); i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ArtifactError("ZIP_CORRUPT");

  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (count > maxEntries) throw new ArtifactError("ZIP_TOO_MANY_ENTRIES");
  if (count === 0xffff || centralOffset === 0xffffffff) throw new ArtifactError("ZIP_UNSUPPORTED");

  const out = new Map<string, Buffer>();
  let total = 0;
  let cursor = centralOffset;

  for (let i = 0; i < count; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_SIG) {
      throw new ArtifactError("ZIP_CORRUPT");
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttrs = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = assertSafeEntryName(
      buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength),
    );

    if (out.has(name)) throw new ArtifactError("ZIP_DUPLICATE_ENTRY");
    if ((flags & 0x1) !== 0) throw new ArtifactError("ZIP_ENCRYPTED");
    if (((externalAttrs >>> 16) & S_IFMT) === S_IFLNK) throw new ArtifactError("ZIP_SYMLINK");
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new ArtifactError("ZIP_UNSUPPORTED");
    }
    if (uncompressedSize > maxTotal || total + uncompressedSize > maxTotal) {
      throw new ArtifactError("ZIP_TOO_LARGE");
    }
    // Ambang 1 MiB: berkas teks kecil wajar punya rasio besar, bukan bom.
    if (uncompressedSize > 1024 * 1024 && compressedSize > 0 && uncompressedSize / compressedSize > maxRatio) {
      throw new ArtifactError("ZIP_BOMB_RATIO");
    }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_SIG) {
      throw new ArtifactError("ZIP_CORRUPT");
    }

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const end = start + compressedSize;
    if (end > buffer.length) throw new ArtifactError("ZIP_CORRUPT");

    const raw = buffer.subarray(start, end);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        // maxOutputLength menahan bom sebelum alokasi besar terjadi.
        data = inflateRawSync(raw, { maxOutputLength: maxTotal - total });
      } catch {
        throw new ArtifactError("ZIP_BOMB_RATIO");
      }
    } else throw new ArtifactError("ZIP_UNSUPPORTED_METHOD");

    if (data.length !== uncompressedSize) throw new ArtifactError("ZIP_CORRUPT");
    out.set(name, data);
    total += data.length;
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return out;
}
