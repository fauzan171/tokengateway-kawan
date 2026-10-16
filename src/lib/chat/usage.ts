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
