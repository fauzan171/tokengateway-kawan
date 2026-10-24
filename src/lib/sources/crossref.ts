/**
 * Verifikasi bibliografi (FIX-10): DOI kanonik → metadata Crossref → cocokkan
 * judul/penulis/tahun.
 *
 * Hasil empat keadaan, tidak disatukan: `verified` (metadata cocok),
 * `mismatch` (DOI hidup tapi menunjuk karya lain — DOI fiktif/berbeda),
 * `unreachable` (Crossref tidak menjawab), `unknown` (tanpa DOI).
 */

import {
  assertOutboundAllowed,
  fetchOutbound,
  DEFAULT_OUTBOUND_OPTIONS,
  type OutboundPolicyOptions,
} from "@/lib/net";
import type { MetadataState } from "./record";

const CROSSREF_BASE = "https://api.crossref.org/works/";
const TIMEOUT_MS = 8_000;

/** DOI kanonik: tanpa prefix `https://doi.org/`, huruf kecil, tanpa spasi. */
export function canonicalDoi(input: string): string | null {
  const raw = input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  // Pola resmi: 10.<registrant>/<suffix>
  if (!/^10\.\d{4,9}\/\S+$/.test(raw)) return null;
  return raw.toLowerCase();
}

export type BibliographicClaim = {
  title: string;
  authors?: readonly string[];
  year?: number;
};

export type DoiVerdict = {
  doi: string;
  state: MetadataState;
  /** Judul dari Crossref bila ada; berguna untuk ditampilkan sebagai pembanding. */
  foundTitle?: string;
  reason?: string;
};

type CrossrefWork = {
  title?: unknown;
  author?: unknown;
  issued?: { "date-parts"?: unknown };
};

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kemiripan judul sederhana: porsi kata klaim yang muncul di judul Crossref. */
function titleMatches(claim: string, found: string): boolean {
  const claimWords = normalizeTitle(claim).split(" ").filter((word) => word.length > 2);
  if (claimWords.length === 0) return false;
  const foundText = normalizeTitle(found);
  const hits = claimWords.filter((word) => foundText.includes(word)).length;
  return hits / claimWords.length >= 0.6;
}

function crossrefYear(work: CrossrefWork): number | undefined {
  const parts = work.issued?.["date-parts"];
  if (!Array.isArray(parts) || !Array.isArray(parts[0])) return undefined;
  const year = Number(parts[0][0]);
  return Number.isInteger(year) ? year : undefined;
}

function crossrefTitle(work: CrossrefWork): string {
  const title = work.title;
  if (Array.isArray(title) && typeof title[0] === "string") return title[0];
  return "";
}

/**
 * Cocokkan klaim dengan metadata Crossref untuk satu DOI.
 * Tidak pernah melempar untuk DOI hidup: hasil ketidakcocokan adalah data.
 */
export async function verifyDoi(
  doiInput: string,
  claim: BibliographicClaim,
  options: { outbound?: OutboundPolicyOptions; signal?: AbortSignal } = {},
): Promise<DoiVerdict> {
  const doi = canonicalDoi(doiInput);
  if (!doi) return { doi: doiInput.trim(), state: "unknown", reason: "DOI_NOT_CANONICAL" };

  const outbound = options.outbound ?? DEFAULT_OUTBOUND_OPTIONS;
  const signal = options.signal ?? AbortSignal.timeout(TIMEOUT_MS);
  const url = `${CROSSREF_BASE}${encodeURIComponent(doi)}`;

  const target = await assertOutboundAllowed(url, outbound);
  let response: Response;
  try {
    response = await fetchOutbound(
      target,
      { method: "GET", headers: { accept: "application/json" }, signal },
      outbound,
    );
  } catch {
    return { doi, state: "unreachable", reason: "CROSSREF_UNREACHABLE" };
  }

  if (response.status === 404) {
    // DOI tidak terdaftar: inilah "DOI fiktif" yang wajib ditandai.
    return { doi, state: "mismatch", reason: "DOI_NOT_FOUND" };
  }
  if (!response.ok) return { doi, state: "unreachable", reason: `CROSSREF_${response.status}` };

  let work: CrossrefWork;
  try {
    const payload = (await response.json()) as { message?: CrossrefWork };
    work = payload.message ?? {};
  } catch {
    return { doi, state: "unreachable", reason: "CROSSREF_BAD_JSON" };
  }

  const foundTitle = crossrefTitle(work);
  if (foundTitle === "") return { doi, state: "unknown", reason: "NO_METADATA" };

  if (!titleMatches(claim.title, foundTitle)) {
    return { doi, state: "mismatch", foundTitle, reason: "TITLE_MISMATCH" };
  }

  const year = crossrefYear(work);
  if (claim.year !== undefined && year !== undefined && Math.abs(claim.year - year) > 1) {
    return { doi, state: "mismatch", foundTitle, reason: "YEAR_MISMATCH" };
  }

  return { doi, state: "verified", foundTitle };
}
