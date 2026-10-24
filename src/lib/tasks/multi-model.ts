/**
 * Bantuan model kedua (FIX-22).
 *
 * Spesifikasi menuntut "manfaat terukur" sebelum arsitektur besar. Karena itu
 * modul ini hanya membangun **review mode terbatas**, bukan swarm:
 *
 *   - child run punya `parentRunId`, batas langkah/token/waktu yang DITURUNKAN
 *     dari parent (tidak pernah lebih besar);
 *   - child tidak mendapat capability lebih luas: daftar tool-nya subset
 *     parent, dan providernya tidak boleh diganti diam-diam;
 *   - kedalaman maksimum 1 (parent → child), jumlah child dibatasi;
 *   - pembatalan parent membatalkan seluruh child;
 *   - agregasi menyebut sumber dan perbedaan pendapat, dan **tidak** menyatakan
 *     "dua model setuju berarti benar".
 *
 * Yang tidak dibangun: fan-out tanpa batas, diskusi antar-agent, dan pemilihan
 * provider otomatis berdasarkan biaya/privasi.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

/** Batas struktur; angka desain, bukan hasil benchmark. */
export const MULTI_MODEL_LIMITS = {
  maxDepth: 1,
  maxChildren: 2,
  /** Child selalu mendapat ≤ rasio budget parent. */
  childBudgetRatio: 0.5,
  childDeadlineRatio: 0.5,
} as const;

export type ModelRef = {
  /** Id model di gateway; TIDAK boleh diganti diam-diam saat error. */
  model: string;
  /** Koneksi yang dipakai; beda koneksi = beda biaya/privasi, butuh izin. */
  connectionId: string;
};

export type ReviewRequest = {
  parentRunId: string;
  parent: ModelRef;
  /** Model peninjau yang DIPILIH PENGGUNA, bukan dipilih sistem. */
  reviewer: ModelRef;
  parentBudget: { maxSteps: number; maxTokens: number; deadlineAt: Date };
  /** Tool yang boleh dipakai parent; child hanya boleh subset. */
  parentTools: readonly string[];
  requestedTools?: readonly string[];
};

export type ReviewPlan = {
  children: {
    model: string;
    connectionId: string;
    depth: number;
    maxSteps: number;
    maxTokens: number;
    deadlineAt: Date;
    tools: string[];
  }[];
  /** Catatan yang harus terlihat pengguna sebelum menjalankan. */
  notes: string[];
};

function badRequest(code: string, message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code, message });
}

/**
 * Rencanakan review satu model kedua. Semua batas diturunkan dari parent; tidak
 * ada jalur di mana child mendapat lebih banyak daripada parent.
 */
export function planReview(input: ReviewRequest): ReviewPlan {
  if (input.reviewer.model === input.parent.model && input.reviewer.connectionId === input.parent.connectionId) {
    throw badRequest("REVIEWER_SAME_AS_PARENT", "Model peninjau harus berbeda dari model utama.");
  }
  if (input.reviewer.connectionId !== input.parent.connectionId) {
    // Beda koneksi berarti beda biaya/privasi: itu keputusan pengguna, jadi
    // dicatat sebagai peringatan yang harus terlihat, bukan dilarang.
    return buildPlan(input, [
      "Model peninjau memakai koneksi berbeda: biaya dan kebijakan privasi berbeda dari model utama.",
    ]);
  }
  return buildPlan(input, []);
}

function buildPlan(input: ReviewRequest, notes: string[]): ReviewPlan {
  const allowed = new Set(input.parentTools);
  const requested = input.requestedTools ?? input.parentTools;
  const tools = requested.filter((tool) => allowed.has(tool));
  const dropped = requested.filter((tool) => !allowed.has(tool));

  if (dropped.length > 0) {
    notes.push(`Tool yang diminta tidak tersedia pada parent dan tidak diberikan ke peninjau: ${dropped.join(", ")}.`);
  }

  const maxSteps = Math.floor(input.parentBudget.maxSteps * MULTI_MODEL_LIMITS.childBudgetRatio);
  const maxTokens = Math.floor(input.parentBudget.maxTokens * MULTI_MODEL_LIMITS.childBudgetRatio);
  const deadlineMs = Math.max(
    0,
    input.parentBudget.deadlineAt.getTime() - Date.now(),
  );
  const deadlineAt = new Date(Date.now() + Math.floor(deadlineMs * MULTI_MODEL_LIMITS.childDeadlineRatio));

  return {
    children: Array.from({ length: MULTI_MODEL_LIMITS.maxChildren }, () => ({
      model: input.reviewer.model,
      connectionId: input.reviewer.connectionId,
      depth: MULTI_MODEL_LIMITS.maxDepth,
      maxSteps,
      maxTokens,
      deadlineAt,
      tools,
    })),
    notes,
  };
}

export type ReviewFinding = {
  source: string;
  text: string;
};

export type ReviewAgreement = {
  /** Sumber yang menyatakan isu yang sama. */
  agreed: { issue: string; sources: string[] }[];
  /** Isu yang hanya muncul di satu sumber; BUKAN berarti salah. */
  disputed: { issue: string; sources: string[] }[];
  /** Kalimat penutup yang jujur tentang arti kesepakatan. */
  disclaimer: string;
};

const DISCLAIMER =
  "Kesepakatan dua model bukan bukti kebenaran: keduanya bisa salah dengan cara yang sama. Perbedaan pendapat ditampilkan, bukan dirata-ratakan.";

/**
 * Gabungkan temuan beberapa sumber. Pengelompokan memakai kunci ternormalisasi
 * sederhana; dua temuan dengan kunci sama dianggap isu yang sama.
 */
export function aggregateFindings(findings: readonly ReviewFinding[]): ReviewAgreement {
  const groups = new Map<string, { issue: string; sources: Set<string> }>();
  for (const finding of findings) {
    const key = finding.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 6)
      .join(" ");
    if (!key) continue;
    const bucket = groups.get(key) ?? { issue: finding.text.trim(), sources: new Set<string>() };
    bucket.sources.add(finding.source);
    groups.set(key, bucket);
  }

  const agreed: ReviewAgreement["agreed"] = [];
  const disputed: ReviewAgreement["disputed"] = [];
  for (const bucket of groups.values()) {
    const entry = { issue: bucket.issue, sources: [...bucket.sources].sort() };
    if (entry.sources.length > 1) agreed.push(entry);
    else disputed.push(entry);
  }
  return { agreed, disputed, disclaimer: DISCLAIMER };
}

/**
 * Batas langkah/token untuk satu child, ditegakkan saat eksekusi. Dipisahkan
 * sebagai fungsi murni supaya dapat diuji tanpa database.
 */
export function childWithinBudget(input: {
  parentBudget: { maxSteps: number; maxTokens: number };
  childUsage: { steps: number; tokens: number };
}): { ok: true } | { ok: false; reason: "STEPS" | "TOKENS" } {
  if (input.childUsage.steps > Math.floor(input.parentBudget.maxSteps * MULTI_MODEL_LIMITS.childBudgetRatio)) {
    return { ok: false, reason: "STEPS" };
  }
  if (input.childUsage.tokens > Math.floor(input.parentBudget.maxTokens * MULTI_MODEL_LIMITS.childBudgetRatio)) {
    return { ok: false, reason: "TOKENS" };
  }
  return { ok: true };
}

/**
 * Child yang masih berjalan saat parent dibatalkan harus ikut berhenti. Query
 * ini memberi daftar child untuk satu parent.
 */
export async function listActiveChildren(db: Db, parentRunId: string): Promise<string[]> {
  const rows = await db.taskRun.findMany({
    where: { parentRunId, status: { in: ["queued", "running", "waiting_input", "waiting_approval"] } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
