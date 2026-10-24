/**
 * CRUD koneksi gateway milik pengguna (REQ-NT-17, REQ-NT-09, REQ-NT-10,
 * SDD-2.2, SDD-3.2).
 *
 * Modul ini pemilik tabel `Connection` dan `ModelCache` (SDD-2.2). Ia
 * memegang tiga janji yang tidak boleh dilanggar pemanggil:
 *
 * 1. **Kunci tidak pernah keluar.** Setiap fungsi mengembalikan bentuk publik
 *    (`PublicConnection`) yang tidak punya kolom `apiKeyEncrypted` maupun
 *    `apiKey`. Jaminannya struktural: `select` tidak pernah meminta kolom
 *    ciphertext, jadi nilai itu tidak pernah masuk ke memori pemanggil
 *    (REQ-NT-07, SDD-5.2).
 * 2. **Mask disimpan, bukan dihitung ulang.** `apiKeyMask` dibuat dari kunci
 *    asli tepat saat kunci ditulis, sehingga operasi daftar tidak perlu
 *    mendekripsi apa pun (SDD-5.2).
 * 3. **Hanya satu koneksi aktif.** Aktivasi menonaktifkan koneksi aktif lain
 *    dalam satu transaksi; menambah koneksi baru tidak pernah memindahkan
 *    koneksi aktif (REQ-NT-10).
 *
 * Enkripsi memakai envelope `src/lib/secrets` dengan AAD yang mengikat
 * ciphertext ke baris (`rowId`), pemilik (`userId`), dan tujuan
 * (`connection.apiKey`), sehingga ciphertext satu baris tidak bisa dipakai di
 * baris lain (SDD-5.2).
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret, maskSecret } from "@/lib/secrets";
import { normalizeBaseUrl } from "./url";

/** Bentuk koneksi yang boleh keluar dari modul ini (SDD-3.2). */
export type PublicConnection = {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMask: string;
  /** Boolean di JSON, walau di database disimpan Int 0/1 (kontrak dibekukan). */
  isActive: boolean;
  status: string;
  lastTestStatus: string | null;
};

/**
 * Kolom yang boleh dibaca. `apiKeyEncrypted` sengaja TIDAK ada di sini: satu
 * sumber kebenaran untuk "apa yang boleh keluar", dan tidak ada jalur kode
 * yang bisa lupa menyaringnya.
 */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  baseUrl: true,
  apiKeyMask: true,
  isActive: true,
  status: true,
  lastTestStatus: true,
} as const;

type ConnectionRow = {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMask: string;
  isActive: number;
  status: string;
  lastTestStatus: string | null;
};

export type CreateConnectionInput = {
  userId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  /**
   * `true` = pengguna memilih "Simpan tanpa uji"; koneksi berstatus `draft`
   * dan belum bisa dipakai chat sampai diuji (REQ-NT-04).
   *
   * `false`/kosong berarti pemanggil menyatakan uji koneksi sudah lulus.
   * Modul ini TIDAK melakukan uji jaringan: pengujian dan pengisian
   * `lastTestStatus` adalah pekerjaan WP-NT-P2-06, jadi `lastTestAt` dan
   * `lastTestStatus` tetap `null` sampai WP itu mengisinya.
   */
  skipTest?: boolean;
};

export type UpdateConnectionPatch = {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  isActive?: boolean;
};

/** Batas panjang nama koneksi. Selaras dengan batas nama tampilan pengguna. */
const MAX_NAME_LENGTH = 100;

function toPublic(row: ConnectionRow): PublicConnection {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    apiKeyMask: row.apiKeyMask,
    isActive: row.isActive === 1,
    status: row.status,
    lastTestStatus: row.lastTestStatus,
  };
}

/** 404 untuk koneksi yang tidak ada DAN yang bukan milik pengguna: keberadaan
 *  koneksi orang lain tidak boleh bocor lewat beda status (SDD-3.1). */
function notFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Koneksi tidak ditemukan.",
  });
}

function requireName(raw: string): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name === "") {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "INVALID_NAME",
      message: "Nama koneksi wajib diisi.",
    });
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "INVALID_NAME",
      message: `Nama koneksi maksimal ${MAX_NAME_LENGTH} karakter.`,
    });
  }
  return name;
}

/** Kunci API disimpan sudah dipangkas supaya mask selalu cocok dengan nilai
 *  yang benar-benar terenkripsi. */
function requireApiKey(raw: string): string {
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  if (apiKey === "") {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "INVALID_API_KEY",
      message: "API key wajib diisi.",
    });
  }
  return apiKey;
}

/** Normalisasi baseUrl lewat aturan tunggal `./url` (jangan menulis ulang). */
function normalizeOrThrow(raw: string, config: Config): string {
  const result = normalizeBaseUrl(raw, { allowInsecureHttp: config.allowInsecureHttp });
  if (!result.ok) {
    // `reason` dari modul normalisasi dipakai apa adanya sebagai `code`, sesuai
    // kosakata SDD-3.2 (BAD_URL | BAD_SCHEME | BAD_HOST).
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: result.reason,
      message: result.message,
    });
  }
  return result.url;
}

/** Membungkus kunci asli menjadi envelope AES-256-GCM terikat baris (SDD-5.2). */
function sealApiKey(
  config: Config,
  input: { rowId: string; userId: string; apiKey: string },
): string {
  return encryptSecret({
    plaintext: input.apiKey,
    key: config.encryptionKey,
    keyId: config.encryptionKeyId,
    aad: { rowId: input.rowId, userId: input.userId, purpose: CONNECTION_API_KEY_PURPOSE },
  });
}

/**
 * Membuat koneksi baru.
 *
 * Koneksi PERTAMA milik pengguna otomatis aktif (REQ-NT-10). Koneksi kedua dan
 * seterusnya dibuat TIDAK aktif: memindahkan koneksi aktif selalu butuh aksi
 * eksplisit (`activateConnection` atau PATCH `isActive`).
 */
export async function createConnection(
  db: Db,
  config: Config,
  input: CreateConnectionInput,
): Promise<PublicConnection> {
  const name = requireName(input.name);
  const apiKey = requireApiKey(input.apiKey);
  const baseUrl = normalizeOrThrow(input.baseUrl, config);
  const status = input.skipTest === true ? "draft" : "active";

  const id = randomUUID();
  const apiKeyEncrypted = sealApiKey(config, { rowId: id, userId: input.userId, apiKey });
  const apiKeyMask = maskSecret(apiKey);

  const row = await db.$transaction(async (tx) => {
    const isFirst = (await tx.connection.count({ where: { userId: input.userId } })) === 0;
    return tx.connection.create({
      data: {
        id,
        userId: input.userId,
        name,
        baseUrl,
        apiKeyEncrypted,
        apiKeyMask,
        keyId: config.encryptionKeyId,
        isActive: isFirst ? 1 : 0,
        status,
      },
      select: PUBLIC_FIELDS,
    });
  });

  return toPublic(row);
}

/** Daftar koneksi milik pengguna, terurut dari yang terlama. Hanya mask. */
export async function listConnections(db: Db, userId: string): Promise<PublicConnection[]> {
  const rows = await db.connection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: PUBLIC_FIELDS,
  });
  return rows.map(toPublic);
}

/**
 * Mengubah koneksi milik pengguna.
 *
 * Mengubah `apiKey` atau `baseUrl` mengembalikan status ke `draft` sampai
 * diuji ulang (SDD-3.2) — tujuan atau kredensial yang berubah tidak boleh
 * tetap dianggap sudah teruji. `lastTestStatus` sengaja tidak direset di sini:
 * kolom uji dimiliki WP-NT-P2-06.
 *
 * `config` disuntikkan seperti pada `createConnection` karena operasi ini bisa
 * perlu mengenkripsi kunci baru dan menormalkan baseUrl dengan kebijakan
 * `allowInsecureHttp` yang sama.
 */
export async function updateConnection(
  db: Db,
  config: Config,
  userId: string,
  id: string,
  patch: UpdateConnectionPatch,
): Promise<PublicConnection> {
  // Validasi bentuk dilakukan sebelum transaksi supaya input yang jelas salah
  // tidak sempat membuka transaksi.
  const name = patch.name !== undefined ? requireName(patch.name) : undefined;
  const baseUrl = patch.baseUrl !== undefined ? normalizeOrThrow(patch.baseUrl, config) : undefined;
  const apiKey = patch.apiKey !== undefined ? requireApiKey(patch.apiKey) : undefined;

  const row = await db.$transaction(async (tx) => {
    // Kepemilikan diperiksa di dalam transaksi, dengan `id` + `userId` dalam
    // satu klausa `where`: baris milik pengguna lain tidak pernah tersentuh.
    const existing = await tx.connection.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw notFound();

    const data: {
      name?: string;
      baseUrl?: string;
      apiKeyEncrypted?: string;
      apiKeyMask?: string;
      keyId?: string;
      status?: string;
      isActive?: number;
      revision?: { increment: number };
    } = {};
    if (name !== undefined) data.name = name;
    if (baseUrl !== undefined) data.baseUrl = baseUrl;

    // Mengubah tujuan atau kredensial membatalkan hasil uji: status kembali
    // `draft` sampai diuji ulang (SDD-3.2).
    if (baseUrl !== undefined || apiKey !== undefined) data.status = "draft";

    if (apiKey !== undefined) {
      data.apiKeyEncrypted = sealApiKey(config, { rowId: id, userId, apiKey });
      data.apiKeyMask = maskSecret(apiKey);
    }

    if (patch.isActive === true) {
      // Nonaktifkan yang lain dulu, baru nyalakan baris ini — keduanya dalam
      // transaksi yang sama, sehingga tidak pernah ada dua koneksi aktif.
      await tx.connection.updateMany({
        where: { userId, isActive: 1, id: { not: id } },
        data: { isActive: 0 },
      });
      data.isActive = 1;
    } else if (patch.isActive === false) {
      data.isActive = 0;
    }

    // FIX-05: setiap perubahan konfigurasi menaikkan revisi. Generasi yang
    // dipin ke revisi lama akan menolak jalan, bukan diam-diam memakai
    // kredensial/base URL baru.
    if (baseUrl !== undefined || apiKey !== undefined) {
      data.revision = { increment: 1 };
    }

    return tx.connection.update({ where: { id }, data, select: PUBLIC_FIELDS });
  });

  return toPublic(row);
}

/**
 * Menghapus koneksi milik pengguna.
 *
 * Hanya baris `Connection` yang disentuh; tidak ada tabel chat yang
 * tersentuh, sehingga riwayat chat tetap ada (REQ-NT-09). Baris `ModelCache`
 * ikut terhapus lewat `ON DELETE CASCADE` pada foreign key-nya.
 */
export async function deleteConnection(db: Db, userId: string, id: string): Promise<void> {
  const { count } = await db.connection.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound();
}

/**
 * Menjadikan koneksi aktif. Koneksi aktif lain milik pengguna yang sama
 * dinonaktifkan dalam transaksi yang sama, sehingga tidak pernah ada dua
 * koneksi aktif (REQ-NT-10).
 */
export async function activateConnection(
  db: Db,
  userId: string,
  id: string,
): Promise<PublicConnection> {
  const row = await db.$transaction(async (tx) => {
    const existing = await tx.connection.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw notFound();

    await tx.connection.updateMany({
      where: { userId, isActive: 1, id: { not: id } },
      data: { isActive: 0 },
    });
    return tx.connection.update({
      where: { id },
      data: { isActive: 1 },
      select: PUBLIC_FIELDS,
    });
  });

  return toPublic(row);
}

/** Koneksi aktif pengguna, atau `null` bila tidak ada. */
export async function getActiveConnection(
  db: Db,
  userId: string,
): Promise<PublicConnection | null> {
  const row = await db.connection.findFirst({
    where: { userId, isActive: 1 },
    orderBy: { createdAt: "asc" },
    select: PUBLIC_FIELDS,
  });
  return row ? toPublic(row) : null;
}
