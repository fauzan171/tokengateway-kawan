/**
 * Kontrol data: peta dependensi, ekspor lengkap, penghapusan, dan retensi (FIX-23).
 *
 * ## Yang dijaga modul ini
 *
 * 1. **Satu peta dependensi.** Menghapus akun bukan hanya `User`: ada chat,
 *    pesan, artefak (byte di storage), memori, konektor, jadwal, notifikasi, dan
 *    job. Kalau satu tabel terlewat, data pengguna tertinggal.
 * 2. **Tombstone dulu, hapus berkas kemudian.** Endpoint privat 404 segera
 *    setelah tombstone; pembersihan byte/pihak ketiga adalah langkah terpisah
 *    yang idempoten dan boleh diulang.
 * 3. **Ekspor tidak membawa kredensial.** Token, session, kunci API, dan path
 *    internal tidak pernah ikut — termasuk kalau kolom itu ada di tabel.
 * 4. **Tidak menjanjikan yang tidak bisa ditepati.** Backup immutable tidak
 *    dapat dihapus per baris; yang dijanjikan adalah ledger penghapusan minimum
 *    yang diterapkan kembali saat restore, dan jendela residu disebut apa adanya.
 */

import { createHash } from "node:crypto";
import type { Db } from "@/lib/db";

/** Versi format ekspor; naikkan bila bentuk berubah. */
export const EXPORT_VERSION = "kawan.data.v2";

/** Tabel yang memuat data pengguna dan cara menjangkaunya. */
export const USER_DATA_MAP = [
  { model: "chatMessage", via: "chat.userId" },
  { model: "chat", via: "userId" },
  { model: "folder", via: "userId" },
  { model: "document", via: "userId" },
  { model: "artifact", via: "userId" },
  { model: "memoryItem", via: "userId" },
  { model: "prompt", via: "userId" },
  { model: "usageRecord", via: "userId" },
  { model: "task", via: "userId" },
  { model: "connectorCredential", via: "userId" },
  { model: "schedule", via: "userId" },
  { model: "notification", via: "userId" },
  { model: "userSetting", via: "userId" },
] as const;

/**
 * Kolom yang TIDAK boleh masuk ekspor, walau tabelnya diekspor.
 * Alasan: membocorkan kredensial/sesi ke berkas yang bisa dibagikan pengguna.
 */
export const REDACTED_COLUMNS = [
  "tokenEncrypted",
  "refreshEncrypted",
  "apiKeyEncrypted",
  "passwordHash",
  "keyHash",
  "storageKey",
  "sessionToken",
  "secret",
] as const;

/**
 * Kolom yang boleh diekspor per model; allowlist, bukan blacklist.
 *
 * Dipakai `projectAllowlist()` di bawah: `exportUserData` tidak memakai
 * `SELECT *`, supaya kolom yang ditambahkan nanti oleh skema tidak otomatis
 * ikut — termasuk kalau kolom baru itu membawa rahasia.
 */
const EXPORT_SELECT: Record<string, readonly string[]> = {
  chat: ["id", "title", "createdAt", "updatedAt", "folderId", "pinned", "archived"],
  message: ["id", "chatId", "parentId", "role", "contentJson", "status", "seq", "createdAt"],
  folder: ["id", "name", "createdAt"],
  artifact: ["id", "format", "displayName", "mime", "sizeBytes", "sha256", "status", "createdAt", "expiresAt", "version", "parentArtifactId"],
  memoryItem: ["id", "scope", "chatId", "category", "text", "status", "consent", "version", "createdAt", "updatedAt", "expiresAt"],
  prompt: ["id", "title", "body", "createdAt", "updatedAt"],
  task: ["id", "title", "status", "createdAt", "updatedAt"],
  schedule: ["id", "title", "prompt", "localTime", "timezone", "recurrence", "enabled", "nextRunAt", "createdAt"],
  notification: ["id", "kind", "title", "body", "sensitive", "readAt", "createdAt"],
  userSetting: ["theme", "locale", "fontScale", "sendOnEnter", "updatedAt"],
};

export type ExportManifest = {
  version: string;
  exportedAt: string;
  /** Jumlah baris per model; memudahkan pemeriksaan kelengkapan. */
  counts: Record<string, number>;
  /** Berkas yang byte-nya TIDAK ikut, beserta alasannya. */
  omitted: { kind: string; reason: string; count: number }[];
  /** SHA-256 isi (tanpa field ini) untuk memeriksa integritas. */
  sha256: string;
};

export type DataExport = {
  manifest: ExportManifest;
  data: Record<string, unknown[]>;
};

/**
 * Proyeksikan satu baris ke allowlist modelnya lalu buang kolom terlarang.
 * Allowlist jalan lebih dulu: kolom yang tidak terdaftar tidak lolos, jadi
 * kolom baru dari perubahan skema tidak otomatis ikut ekspor.
 */
export function projectAllowlist(row: Record<string, unknown>, model: string): Record<string, unknown> {
  const allowed = EXPORT_SELECT[model];
  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (allowed && !allowed.includes(key as never)) continue;
    projected[key] = value;
  }
  return redactRow(projected);
}

/** Buang kolom terlarang dari satu baris; tidak pernah mengembalikan apa adanya. */
export function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if ((REDACTED_COLUMNS as readonly string[]).includes(key)) continue;
    result[key] = value;
  }
  return result;
}

/**
 * Ekspor lengkap milik satu pengguna. Hanya data pengguna itu; setiap query
 * memuat `userId` sehingga tidak ada jalur lintas pemilik.
 */
export async function exportUserData(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<DataExport> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  const chats = await db.chat.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  data["chats"] = chats.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "chat"));
  counts["chats"] = chats.length;

  const messages = await db.chatMessage.findMany({
    where: { chat: { userId } },
    orderBy: [{ chatId: "asc" }, { seq: "asc" }],
  });
  data["messages"] = messages.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "message"));
  counts["messages"] = messages.length;

  const folders = await db.folder.findMany({ where: { userId } });
  data["folders"] = folders.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "folder"));
  counts["folders"] = folders.length;

  const artifacts = await db.artifact.findMany({ where: { userId } });
  data["artifacts"] = artifacts.map((row) => {
    const redacted = projectAllowlist(row as unknown as Record<string, unknown>, "artifact");
    // Byte berkas tidak ditanam di JSON; hanya metadata + hash.
    return { ...redacted, bytesIncluded: false };
  });
  counts["artifacts"] = artifacts.length;

  const memories = await db.memoryItem.findMany({ where: { userId } });
  data["memories"] = memories.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "memoryItem"));
  counts["memories"] = memories.length;

  const prompts = await db.prompt.findMany({ where: { userId } });
  data["prompts"] = prompts.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "prompt"));
  counts["prompts"] = prompts.length;

  const tasks = await db.task.findMany({ where: { userId, deletedAt: null } });
  data["tasks"] = tasks.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "task"));
  counts["tasks"] = tasks.length;

  const schedules = await db.schedule.findMany({ where: { userId } });
  data["schedules"] = schedules.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "schedule"));
  counts["schedules"] = schedules.length;

  const notifications = await db.notification.findMany({ where: { userId } });
  data["notifications"] = notifications.map((row) => projectAllowlist(row as unknown as Record<string, unknown>, "notification"));
  counts["notifications"] = notifications.length;

  const settings = await db.userSetting.findUnique({ where: { userId } });
  data["settings"] = settings ? [projectAllowlist(settings as unknown as Record<string, unknown>, "userSetting")] : [];
  counts["settings"] = data["settings"].length;

  const body = JSON.stringify({ data, counts });
  const sha256 = createHash("sha256").update(body).digest("hex");

  return {
    manifest: {
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      counts,
      omitted: [
        {
          kind: "artifact-bytes",
          reason: "Byte berkas tidak ditanam di JSON; unduh lewat endpoint artefak selama masih ada.",
          count: artifacts.length,
        },
        {
          kind: "credentials",
          reason: "Kredensial, sesi, dan kunci API tidak pernah diekspor.",
          count: 0,
        },
        {
          kind: "connector-tokens",
          reason: "Token konektor tidak diekspor; hubungkan ulang bila perlu.",
          count: 0,
        },
      ],
      sha256,
    },
    data,
  };
}

/** Hasil validasi arsip impor. */
export type ImportValidation =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; reason: string };

/**
 * Validasi arsip sebelum impor: versi dikenal, bentuk benar, tidak ada kredensial.
 * Menolak arsip yang membawa kolom terlarang — itu tanda arsip dimodifikasi.
 */
export function validateImportArchive(raw: unknown): ImportValidation {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "Arsip harus objek." };
  const archive = raw as { manifest?: { version?: unknown }; data?: unknown };
  if (archive.manifest?.version !== EXPORT_VERSION) {
    return { ok: false, reason: `Versi arsip tidak dikenal (harus ${EXPORT_VERSION}).` };
  }
  if (typeof archive.data !== "object" || archive.data === null || Array.isArray(archive.data)) {
    return { ok: false, reason: "Bagian data harus objek berisi daftar per jenis." };
  }
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(archive.data as Record<string, unknown>)) {
    if (!Array.isArray(value)) return { ok: false, reason: `data.${key} harus array.` };
    for (const row of value) {
      if (typeof row !== "object" || row === null) {
        return { ok: false, reason: `data.${key} memuat baris yang bukan objek.` };
      }
      for (const column of Object.keys(row as Record<string, unknown>)) {
        if ((REDACTED_COLUMNS as readonly string[]).includes(column)) {
          return { ok: false, reason: `Arsip memuat kolom terlarang: ${column}.` };
        }
      }
    }
    counts[key] = value.length;
  }
  return { ok: true, counts };
}

/** Langkah pembersihan setelah tombstone; idempoten, boleh diulang. */
export type CleanupStep =
  | { kind: "artifacts"; count: number }
  | { kind: "documents"; count: number }
  | { kind: "connectors"; count: number }
  | { kind: "schedules"; count: number };

/**
 * Tandai data pengguna untuk dihapus (tahap 1). Mengembalikan langkah
 * pembersihan yang harus dijalankan; TIDAK menghapus byte di sini, supaya
 * kegagalan storage tidak membuat baris DB menunjuk berkas yang sudah hilang.
 */
export async function tombstoneUserData(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<{ steps: CleanupStep[] }> {
  const [artifacts, documents, connectors, schedules] = await Promise.all([
    db.artifact.count({ where: { userId, deletedAt: null } }),
    db.document.count({ where: { userId } }),
    db.connectorCredential.count({ where: { userId, revokedAt: null } }),
    db.schedule.count({ where: { userId, enabled: 1 } }),
  ]);

  await db.$transaction(async (tx) => {
    // Artefak: tombstone + tandai kedaluwarsa supaya endpoint privat langsung 404.
    await tx.artifact.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now, expiresAt: now },
    });
    // Chat: hilang dari daftar, pesan tetap ada sampai pembersihan byte.
    await tx.chat.updateMany({ where: { userId }, data: { archived: 1, pinned: 0 } });
    // Konektor: cabut, sehingga token tidak bisa dipakai lagi.
    await tx.connectorCredential.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    // Jadwal: matikan; occurrence tidak dihapus agar jejak audit tetap ada
    // sampai pembersihan terjadwal.
    await tx.schedule.updateMany({ where: { userId, enabled: 1 }, data: { enabled: 0, nextRunAt: null } });
  });

  return {
    steps: [
      { kind: "artifacts", count: artifacts },
      { kind: "documents", count: documents },
      { kind: "connectors", count: connectors },
      { kind: "schedules", count: schedules },
    ],
  };
}

/**
 * Ledger penghapusan minimum. Hanya id opaque + waktu + status; TIDAK menyimpan
 * isi yang dihapus, karena menyimpannya berarti data itu belum benar-benar hilang.
 */
export type DeletionLedgerEntry = {
  id: string;
  userId: string;
  kind: string;
  targetId: string;
  deletedAt: string;
  status: "tombstoned" | "cleaned";
};

export function ledgerEntry(input: {
  userId: string;
  kind: string;
  targetId: string;
  deletedAt: Date;
  status: "tombstoned" | "cleaned";
}): DeletionLedgerEntry {
  return {
    id: `del_${createHash("sha256").update(`${input.userId}:${input.kind}:${input.targetId}`).digest("hex").slice(0, 24)}`,
    userId: input.userId,
    kind: input.kind,
    targetId: input.targetId,
    deletedAt: input.deletedAt.toISOString(),
    status: input.status,
  };
}

/**
 * Batas retensi per jenis data. Dipakai sweeper pembersihan; angka ini
 * kebijakan, bukan tebakan teknis.
 */
export const RETENTION = {
  /** Artefak belum diunduh sama sekali. */
  artifactDays: 7,
  /** Job selesai/gagal; replay tidak butuh yang lebih lama. */
  jobDays: 30,
  /** Idempotency key; cukup lebih lama dari retry klien. */
  idempotencyDays: 7,
  /** Event run; replay snapshot tidak boleh rusak. */
  taskEventDays: 90,
  /** Occurrence jadwal yang sudah lewat. */
  occurrenceDays: 30,
} as const;

/** Kalimat kebijakan yang boleh ditampilkan; tidak menjanjikan yang tidak ada. */
export const PRIVACY_STATEMENT = [
  "Chat dan berkas tersimpan di server Kawan sampai kamu menghapusnya.",
  "Isi percakapan dikirim ke gateway model yang kamu pilih untuk menghasilkan jawaban.",
  "Pencarian web, dokumen, dan OCR memakai penyedia yang dikonfigurasi operator.",
  "Server mendekripsi isi untuk memanggil model: ini bukan enkripsi ujung-ke-ujung.",
  "Backup operator dapat menyimpan salinan lebih lama; penghapusan per baris tidak menjangkau backup immutable.",
  "Kredensial, sesi, dan token konektor tidak pernah diekspor.",
].join("\n");