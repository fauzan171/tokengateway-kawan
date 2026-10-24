/**
 * Tool aplikasi (FIX-19).
 *
 * Tool ini memanggil SERVICE yang sudah ada (`chats.ts`, `folders.ts`), bukan
 * request HTTP ke localhost: request internal akan membawa cookie dan bisa
 * dieksploitasi lewat jalur yang tidak melewati pemeriksaan owner.
 *
 * Aturan yang ditegakkan di sini:
 *   - `userId` SELALU dari konteks sesi, tidak pernah dari argumen model;
 *   - model hanya menerima id publik yang diizinkan (id chat miliknya);
 *   - daftar read-only dibatasi jumlah dan field;
 *   - aksi destruktif (hapus, bagikan publik) TIDAK dijalankan di sini —
 *     hasilnya `needsApproval` (FIX-20), bukan efek diam-diam;
 *   - input kadaluarsa (revisi berubah) ditolak, bukan menimpa state terbaru.
 */

import type { Db } from "@/lib/db";
import { updateChat } from "@/lib/chat/chats";
import { listFolders } from "@/lib/chat/folders";

/** Batas daftar yang dikembalikan ke model. */
export const APP_TOOL_LIMITS = {
  maxListedChats: 20,
  maxTitleChars: 200,
  maxQueryChars: 100,
} as const;

export type AppToolName =
  | "app.list_chats"
  | "app.rename_chat"
  | "app.pin_chat"
  | "app.archive_chat"
  | "app.move_chat"
  | "app.list_folders"
  | "app.delete_chat"
  | "app.share_chat";

/** Aksi yang mengubah state secara destruktif/publik: butuh approval. */
const APPROVAL_REQUIRED: ReadonlySet<AppToolName> = new Set<AppToolName>([
  "app.delete_chat",
  "app.share_chat",
]);

export function requiresApproval(name: AppToolName): boolean {
  return APPROVAL_REQUIRED.has(name);
}

/** Bentuk schema tool untuk gateway. Daftar tertutup; tidak ada tool dinamis. */
export const APP_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "app.list_chats",
      description: "Menampilkan daftar chat milik pengguna (judul, id, folder, pin, arsip).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: APP_TOOL_LIMITS.maxListedChats },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "app.rename_chat",
      description: "Mengubah judul satu chat milik pengguna.",
      parameters: {
        type: "object",
        properties: {
          chatId: { type: "string" },
          title: { type: "string" },
          expectedRevision: { type: "integer", minimum: 0 },
        },
        required: ["chatId", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "app.pin_chat",
      description: "Menyematkan atau melepas sematan satu chat.",
      parameters: {
        type: "object",
        properties: { chatId: { type: "string" }, pinned: { type: "boolean" } },
        required: ["chatId", "pinned"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "app.archive_chat",
      description: "Mengarsipkan atau membatalkan arsip satu chat.",
      parameters: {
        type: "object",
        properties: { chatId: { type: "string" }, archived: { type: "boolean" } },
        required: ["chatId", "archived"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "app.move_chat",
      description: "Memindahkan chat ke folder milik pengguna, atau ke luar folder (null).",
      parameters: {
        type: "object",
        properties: { chatId: { type: "string" }, folderId: { type: ["string", "null"] } },
        required: ["chatId", "folderId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "app.list_folders",
      description: "Menampilkan folder milik pengguna.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "app.delete_chat",
      description: "MENGHAPUS satu chat secara permanen. Memerlukan persetujuan pengguna.",
      parameters: {
        type: "object",
        properties: { chatId: { type: "string" } },
        required: ["chatId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "app.share_chat",
      description: "Membuat tautan berbagi publik untuk satu chat. Memerlukan persetujuan pengguna.",
      parameters: {
        type: "object",
        properties: { chatId: { type: "string" } },
        required: ["chatId"],
        additionalProperties: false,
      },
    },
  },
];

export const APP_TOOL_NAMES: readonly string[] = APP_TOOLS.map((tool) => tool.function.name);

export function isAppTool(name: string): name is AppToolName {
  return APP_TOOL_NAMES.includes(name);
}

/** Hasil tool: bentuk seragam, dengan `status` yang membedakan sebab. */
export type AppToolResult = {
  schemaVersion: 1;
  status: "ok" | "not_found" | "needs_approval" | "invalid" | "conflict";
  data?: unknown;
  message?: string;
  /** Ringkasan yang aman ditampilkan ke pengguna. */
  summary?: string;
};

function invalid(message: string): AppToolResult {
  return { schemaVersion: 1, status: "invalid", message };
}

/** Id chat hanya boleh berupa string non-kosong; bentuk lain ditolak. */
function readChatId(args: Record<string, unknown>): string | null {
  const value = args["chatId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export type AppToolContext = {
  db: Db;
  userId: string;
  /** Id chat aktif; boleh dipakai model untuk "chat ini". */
  currentChatId: string | null;
};

/**
 * Jalankan satu tool aplikasi.
 *
 * Tool destruktif mengembalikan `needs_approval` TANPA melakukan apa pun.
 * Pemanggil (FIX-20) yang membuat TaskInteraction dan menunggu keputusan.
 */
export async function runAppTool(
  name: AppToolName,
  args: unknown,
  context: AppToolContext,
): Promise<AppToolResult> {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return invalid("Argumen tool harus objek.");
  }
  const record = args as Record<string, unknown>;

  if (requiresApproval(name)) {
    const chatId = readChatId(record) ?? context.currentChatId;
    if (!chatId) return invalid("chatId wajib diisi.");
    return {
      schemaVersion: 1,
      status: "needs_approval",
      data: { chatId, action: name },
      message:
        name === "app.delete_chat"
          ? "Penghapusan chat memerlukan persetujuan pengguna."
          : "Berbagi publik memerlukan persetujuan pengguna.",
      summary: name === "app.delete_chat" ? "Hapus chat (menunggu persetujuan)" : "Buat tautan publik (menunggu persetujuan)",
    };
  }

  if (name === "app.list_chats") {
    const rawLimit = record["limit"];
    const limit =
      typeof rawLimit === "number" && Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), APP_TOOL_LIMITS.maxListedChats)
        : APP_TOOL_LIMITS.maxListedChats;
    // Query selalu memuat userId: model tidak dapat meminta chat orang lain.
    // SQLite menyimpan flag sebagai Int, PostgreSQL sebagai Boolean: nilai
    // literal dihindari supaya satu query sah di kedua provider.
    const rows = await context.db.chat.findMany({
      where: { userId: context.userId, archived: 0 },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        folderId: true,
        pinned: true,
        archived: true,
        updatedAt: true,
      },
    });
    return {
      schemaVersion: 1,
      status: "ok",
      data: {
        // Flag disimpan Int 0/1 (portabel SQLite+PostgreSQL); dikembalikan ke
        // model sebagai boolean supaya tidak ada dua bahasa untuk satu nilai.
        chats: rows.map((row) => ({
          id: row.id,
          title: row.title,
          folderId: row.folderId,
          pinned: row.pinned === 1,
          archived: row.archived === 1,
          updatedAt: row.updatedAt.toISOString(),
        })),
        limit,
      },
      summary: `${rows.length} chat terbaru`,
    };
  }

  if (name === "app.list_folders") {
    const folders = await listFolders(context.db, context.userId);
    return {
      schemaVersion: 1,
      status: "ok",
      data: { folders: folders.slice(0, APP_TOOL_LIMITS.maxListedChats) },
      summary: `${folders.length} folder`,
    };
  }

  const chatId = readChatId(record) ?? context.currentChatId;
  if (!chatId) return invalid("chatId wajib diisi.");

  if (name === "app.rename_chat") {
    const title = record["title"];
    if (typeof title !== "string" || title.trim() === "") return invalid("Judul tidak boleh kosong.");
    if (title.length > APP_TOOL_LIMITS.maxTitleChars) {
      return invalid(`Judul maksimum ${APP_TOOL_LIMITS.maxTitleChars} karakter.`);
    }
    // Revisi opsional: bila dikirim dan sudah berubah, tolak (stale form).
    const expectedRevision = record["expectedRevision"];
    if (typeof expectedRevision === "number") {
      const current = await context.db.chat.findFirst({
        where: { id: chatId, userId: context.userId },
        select: { titleRevision: true },
      });
      if (!current) return { schemaVersion: 1, status: "not_found", message: "Chat tidak ditemukan." };
      if (current.titleRevision !== expectedRevision) {
        return {
          schemaVersion: 1,
          status: "conflict",
          message: "Judul sudah berubah sejak dibaca. Muat ulang sebelum mengubah.",
        };
      }
    }
    try {
      const chat = await updateChat(context.db, context.userId, chatId, { title });
      return {
        schemaVersion: 1,
        status: "ok",
        data: { id: chat.id, title: chat.title },
        summary: `Judul diubah menjadi "${chat.title}"`,
      };
    } catch {
      return { schemaVersion: 1, status: "not_found", message: "Chat tidak ditemukan." };
    }
  }

  if (name === "app.pin_chat" || name === "app.archive_chat") {
    const field = name === "app.pin_chat" ? "pinned" : "archived";
    const value = record[field];
    if (typeof value !== "boolean") return invalid(`${field} harus boolean.`);
    try {
      const chat = await updateChat(context.db, context.userId, chatId, { [field]: value });
      return {
        schemaVersion: 1,
        status: "ok",
        data: { id: chat.id, pinned: chat.pinned, archived: chat.archived },
        summary:
          name === "app.pin_chat"
            ? value ? "Chat disematkan" : "Sematan dilepas"
            : value ? "Chat diarsipkan" : "Arsip dibatalkan",
      };
    } catch {
      return { schemaVersion: 1, status: "not_found", message: "Chat tidak ditemukan." };
    }
  }

  if (name === "app.move_chat") {
    const folderId = record["folderId"];
    if (folderId !== null && typeof folderId !== "string") {
      return invalid("folderId harus id folder atau null.");
    }
    try {
      const chat = await updateChat(context.db, context.userId, chatId, { folderId });
      return {
        schemaVersion: 1,
        status: "ok",
        data: { id: chat.id, folderId: chat.folderId },
        summary: chat.folderId ? "Chat dipindahkan ke folder" : "Chat dikeluarkan dari folder",
      };
    } catch {
      return { schemaVersion: 1, status: "not_found", message: "Chat atau folder tidak ditemukan." };
    }
  }

  return invalid("Tool tidak dikenal.");
}

/** Instruksi tool untuk prompt: hanya yang benar-benar tersedia. */
export function appToolPromptLine(): string {
  return [
    "Tool aplikasi yang tersedia: app.list_chats, app.rename_chat, app.pin_chat, app.archive_chat, app.move_chat, app.list_folders.",
    "app.delete_chat dan app.share_chat hanya mengajukan persetujuan; jangan mengaku sudah menghapus atau membagikan.",
  ].join(" ");
}
