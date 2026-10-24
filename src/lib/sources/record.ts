/**
 * Catatan sumber (FIX-10): URL kanonik, waktu ambil, hash isi, locator, dan
 * status verifikasi — bukan snapshot internet tak terbatas.
 *
 * Empat hal dibedakan tegas (jangan disatukan jadi satu badge "benar"):
 *   1. `reachable`  — URL merespons
 *   2. `metadata`   — DOI/judul/penulis cocok dengan Crossref
 *   3. `quote`      — kutipan benar-benar ada di isi halaman
 *   4. `support`    — klaim didukung kutipan (tidak dapat diputuskan di sini)
 */

import { createHash } from "node:crypto";

export type ReachState = "reachable" | "dead" | "blocked" | "unchecked";
export type MetadataState = "verified" | "mismatch" | "unreachable" | "unknown";

export type SourceRecord = {
  /** URL final setelah redirect, tanpa fragment & parameter pelacak. */
  url: string;
  title: string;
  /** ISO-8601 waktu pengambilan; wajib untuk berita/harga. */
  fetchedAt: string;
  /** sha256 isi yang benar-benar dibaca; null bila tidak dibaca. */
  contentHash: string | null;
  /** Rentang byte/paragraf/halaman tempat kutipan berada. */
  locator: SourceLocator | null;
  reach: ReachState;
  metadata: MetadataState;
  /** Alasan penolakan/ketidakpastian, kode stabil untuk UI. */
  reason?: string;
  doi?: string;
  publishedAt?: string;
};

export type SourceLocator = {
  /** 1-based; hanya untuk PDF/dokumen berpaginasi. */
  page?: number;
  /** 1-based, dihitung pada teks hasil ekstraksi. */
  paragraph?: number;
  /** Rentang karakter pada teks hasil ekstraksi. */
  start?: number;
  end?: number;
};

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "ref_src",
];

/**
 * URL kanonik untuk perbandingan & penyimpanan: fragment dibuang, parameter
 * pelacak dihapus, host lower-case, path kosong jadi "/". Query lain dipertahankan
 * karena sering menentukan isi (mis. `?id=`).
 */
export function canonicalUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("URL tidak sah.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Hanya http/https.");
  }
  url.hash = "";
  for (const key of TRACKING_PARAMS) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname === "") url.pathname = "/";
  // Urutan parameter stabil supaya dua URL setara menghasilkan hash sama.
  url.searchParams.sort();
  return url.toString();
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Locator paragraf untuk kutipan teks: cari `quote` di `text`. */
export function locateQuote(text: string, quote: string): SourceLocator | null {
  const needle = quote.trim();
  if (needle === "") return null;
  const start = text.indexOf(needle);
  if (start < 0) return null;
  const paragraph = text.slice(0, start).split(/\n{2,}/).length;
  return { paragraph, start, end: start + needle.length };
}

/**
 * Status gabungan yang aman ditampilkan: hanya `reachable` + `metadata:verified`
 * yang boleh disebut "terverifikasi". Selain itu tetap sumber yang belum pasti.
 */
export function sourceVerdict(record: Pick<SourceRecord, "reach" | "metadata">):
  | "verified"
  | "unverified"
  | "dead" {
  if (record.reach === "dead") return "dead";
  if (record.reach === "reachable" && record.metadata === "verified") return "verified";
  return "unverified";
}
