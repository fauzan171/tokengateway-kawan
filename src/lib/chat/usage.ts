/**
 * Pencatatan pemakaian token dari respons gateway (REQ-NT-71, SDD-2.2).
 *
 * Gateway tidak selalu melaporkan usage. Kolom `reported` membedakan
 * "nol token" dari "tidak dilaporkan": baris tanpa laporan lengkap ditulis
 * dengan `reported = 0` supaya UI menampilkan "tidak tersedia" alih-alih
 * angka nol yang menyesatkan. Kolom yang tidak dilaporkan bernilai NULL,
 * bukan 0 — nol berarti gateway benar-benar melaporkan nol token.
 *
 * Normalisasi per kolom: tiap token dinilai sendiri. Nilai yang sah
 * (bilangan bulat >= 0) disimpan apa adanya; nilai hilang/negatif/bukan
 * angka menjadi NULL. `reported = 1` hanya bila KETIGA kolom terisi, sebab
 * ringkasan hanya boleh menjumlah baris yang lengkap.
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

/** Bentuk usage dari gateway; nilai mentah, belum tepercaya. */
export type TokenUsage = {
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
};

export type RecordUsageInput = {
  userId: string;
  /** Chat asal generasi; `null` untuk pemakaian di luar chat. */
  chatId?: string | null;
  model: string;
  usage?: TokenUsage | null;
};

/** Bentuk yang boleh keluar dari modul ini. */
export type UsageRecordDto = {
  id: string;
  chatId: string | null;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reported: boolean;
  createdAt: string;
};

export type UsageSummary = {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  reportedCount: number;
  unreportedCount: number;
};

const USAGE_FIELDS = {
  id: true,
  chatId: true,
  model: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  reported: true,
  createdAt: true,
} as const;

type UsageRow = {
  id: string;
  chatId: string | null;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reported: number;
  createdAt: Date;
};

function toDto(row: UsageRow): UsageRecordDto {
  return {
    id: row.id,
    chatId: row.chatId,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    reported: row.reported === 1,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Bilangan bulat >= 0, selain itu `null` (tidak dilaporkan). */
function token(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Menulis satu baris `UsageRecord`. Tidak pernah melempar untuk usage cacat. */
export async function recordUsage(db: Db, input: RecordUsageInput): Promise<UsageRecordDto> {
  const promptTokens = token(input.usage?.promptTokens);
  const completionTokens = token(input.usage?.completionTokens);
  const totalTokens = token(input.usage?.totalTokens);
  const reported =
    promptTokens !== null && completionTokens !== null && totalTokens !== null ? 1 : 0;

  const row = await db.usageRecord.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      chatId: input.chatId ?? null,
      model: input.model,
      promptTokens,
      completionTokens,
      totalTokens,
      reported,
    },
    select: USAGE_FIELDS,
  });
  return toDto(row);
}

/**
 * Ringkasan pemakaian sejak `since` (inklusif). Hanya baris `reported = 1`
 * yang dijumlah; baris tanpa laporan hanya dihitung di `unreportedCount`.
 * Tabel kosong menghasilkan nol, bukan galat.
 */
export async function summarizeUsage(
  db: Db,
  { userId, since }: { userId: string; since: Date },
): Promise<UsageSummary> {
  const reportedWhere = { userId, reported: 1, createdAt: { gte: since } };
  const [summed, unreportedCount] = await Promise.all([
    db.usageRecord.aggregate({
      where: reportedWhere,
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      _count: true,
    }),
    db.usageRecord.count({ where: { userId, reported: 0, createdAt: { gte: since } } }),
  ]);

  return {
    totalTokens: summed._sum.totalTokens ?? 0,
    promptTokens: summed._sum.promptTokens ?? 0,
    completionTokens: summed._sum.completionTokens ?? 0,
    reportedCount: summed._count,
    unreportedCount,
  };
}

/**
 * Catatan pemakaian satu chat, urut waktu menaik. Chat milik pengguna lain
 * mengembalikan `[]` — sama seperti chat yang tidak ada, supaya keberadaan
 * chat orang lain tidak bocor.
 */
export async function usageForChat(
  db: Db,
  chatId: string,
  userId: string,
): Promise<UsageRecordDto[]> {
  const chat = await db.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true },
  });
  if (!chat) return [];

  const rows = await db.usageRecord.findMany({
    where: { chatId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: USAGE_FIELDS,
  });
  return rows.map(toDto);
}

export type UsageDayRow = {
  day: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  unreported: number;
};

export type UsageModelRow = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  unreported: number;
};

type UsageBucket = { promptTokens: number; completionTokens: number; totalTokens: number; unreported: number };

function emptyBucket(): UsageBucket {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, unreported: 0 };
}

/** Baris tanpa laporan hanya dihitung sebagai `unreported`, tidak ke token. */
function addToBucket(bucket: UsageBucket, row: UsageRow): void {
  if (row.reported !== 1) {
    bucket.unreported += 1;
    return;
  }
  bucket.promptTokens += row.promptTokens ?? 0;
  bucket.completionTokens += row.completionTokens ?? 0;
  bucket.totalTokens += row.totalTokens ?? 0;
}

/**
 * `reported: false` hanya bila ADA baris dan SEMUANYA tanpa laporan — UI
 * memakai itu untuk menulis "tidak tersedia" alih-alih nol. Tabel kosong
 * tetap `reported: true` supaya pesannya "belum ada pemakaian", bukan klaim
 * bahwa gateway bisu.
 *
 * shortcut: agregasi di JS, pindah ke groupBy SQL bila baris per pengguna > 100k.
 */
async function usageRowsInRange(
  db: Db,
  { userId, from, to }: { userId: string; from: Date; to: Date },
): Promise<UsageRow[]> {
  return db.usageRecord.findMany({
    where: { userId, createdAt: { gte: from, lte: to } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: USAGE_FIELDS,
  });
}

/** Baris mentah satu rentang, urut waktu menaik (dipakai ekspor CSV). */
export async function usageRowsForExport(
  db: Db,
  input: { userId: string; from: Date; to: Date },
): Promise<UsageRecordDto[]> {
  return (await usageRowsInRange(db, input)).map(toDto);
}

/** `YYYY-MM-DD` (UTC) — satu hari satu baris, urut tanggal menaik. */
export async function usageByDay(
  db: Db,
  input: { userId: string; from: Date; to: Date },
): Promise<{ reported: boolean; rows: UsageDayRow[] }> {
  const rows = await usageRowsInRange(db, input);
  const buckets = new Map<string, UsageBucket>();

  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(day) ?? emptyBucket();
    addToBucket(bucket, row);
    buckets.set(day, bucket);
  }

  const reported = rows.length === 0 || rows.some((row) => row.reported === 1);
  const result = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, bucket]) => ({ day, ...bucket }));
  return { reported, rows: result };
}

/** Satu baris per nama model, urut total token menurun. */
export async function usageByModel(
  db: Db,
  input: { userId: string; from: Date; to: Date },
): Promise<{ reported: boolean; rows: UsageModelRow[] }> {
  const rows = await usageRowsInRange(db, input);
  const buckets = new Map<string, UsageBucket>();

  for (const row of rows) {
    const bucket = buckets.get(row.model) ?? emptyBucket();
    addToBucket(bucket, row);
    buckets.set(row.model, bucket);
  }

  const reported = rows.length === 0 || rows.some((row) => row.reported === 1);
  const result = [...buckets.entries()]
    .map(([model, bucket]) => ({ model, ...bucket }))
    .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
  return { reported, rows: result };
}

const CSV_HEADER = [
  "created_at",
  "model",
  "prompt_tokens",
  "completion_tokens",
  "total_tokens",
  "reported",
] as const;

/** Sel kosong untuk `null` — nol berarti gateway benar-benar melaporkan nol. */
function cell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * CSV baris mentah (REQ-NT-73). BOM di awal supaya Excel membaca UTF-8;
 * akhir baris `\r\n` sesuai RFC 4180.
 */
export function usageCsv(rows: readonly UsageRecordDto[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        cell(row.createdAt),
        cell(row.model),
        cell(row.promptTokens),
        cell(row.completionTokens),
        cell(row.totalTokens),
        cell(row.reported ? "true" : "false"),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

/**
 * Rentang dari query `from`/`to` (ISO). Bawaan 30 hari terakhir sampai
 * sekarang; rentang terbalik atau lebih dari 366 hari ditolak 400.
 */
export function parseUsageRange(params: URLSearchParams): { from: Date; to: Date } {
  const to = params.get("to") ? new Date(params.get("to") as string) : new Date();
  const from = params.get("from")
    ? new Date(params.get("from") as string)
    : new Date(to.getTime() - DEFAULT_DAYS * DAY_MS);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_RANGE", message: "from/to harus tanggal ISO." });
  }
  if (from > to) {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_RANGE", message: "from harus sebelum to." });
  }
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_RANGE",
      message: `Rentang maksimal ${MAX_DAYS} hari.`,
    });
  }
  return { from, to };
}
