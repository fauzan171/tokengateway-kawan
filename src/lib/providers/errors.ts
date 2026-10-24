/**
 * Pemetaan galat gateway ke bahasa Indonesia (SDD-5.4, kosakata SDD-3.2).
 *
 * Dua janji modul ini:
 *
 * 1. **Galat provider bukan galat akun.** 401 dari gateway TIDAK menjadi 401
 *    ke klien Kawan, melainkan 502 dengan `code: "UNAUTHORIZED"`.
 *    Meneruskannya sebagai 401 akan membuat UI mengira sesi pengguna habis
 *    lalu mengeluarkannya — persis yang dilarang SDD-5.4 ("401 gateway bukan
 *    401 akun").
 * 2. **Pesan siap tampil.** Setiap keadaan punya satu kalimat bahasa Indonesia
 *    yang dapat ditampilkan apa adanya (verbatim SDD-5.4).
 *
 * Kosakata `reason` dibekukan SDD-3.2 dan dipakai bersama endpoint uji koneksi
 * (WP-NT-P2-06): `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | TIMEOUT | DNS | TLS |
 * EMPTY_MODELS | BAD_URL | UPSTREAM_ERROR`.
 *
 * Batas jujur: `DNS` dan `TLS` ada di kosakata, tetapi `fetchJson` yang
 * dibekukan merangkum SEMUA kegagalan transport menjadi `UPSTREAM_UNAVAILABLE`
 * tanpa membawa sebab aslinya (kode DNS/TLS dari `fetch` hilang saat
 * dibungkus `ApiError`). Jadi keduanya belum dapat dibedakan dari sini;
 * pemisahan butuh perubahan di `src/lib/api/http.ts`, di luar paket ini.
 * 429 juga tidak punya `reason` sendiri di SDD-3.2, sehingga memakai
 * `UPSTREAM_ERROR` dengan pesan khusus 429.
 */

import { ApiError, STATUS, type ErrorStatus } from "@/lib/api/errors";

export type ProviderReason =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "DNS"
  | "TLS"
  | "EMPTY_MODELS"
  | "BAD_URL"
  | "UPSTREAM_ERROR";

/**
 * Pesan bawaan per `reason`.
 *
 * Sebagian keadaan berbagi satu `reason` tetapi butuh kalimat berbeda (429,
 * koneksi putus, balasan tak terbaca); pemanggil di modul ini menggantinya
 * dengan konstanta khusus di bawah. Tabel ini tetap lengkap supaya kosakata
 * SDD-3.2 punya satu sumber pesan, termasuk `DNS`/`TLS` yang belum terjangkau.
 */
export const PROVIDER_MESSAGES: Record<ProviderReason, string> = {
  UNAUTHORIZED: "Key ditolak oleh gateway.",
  FORBIDDEN: "Gateway menolak permintaan ini.",
  NOT_FOUND: "Gateway tidak menemukan endpoint yang dituju.",
  TIMEOUT: "Gateway tidak merespons.",
  DNS: "Alamat gateway tidak ditemukan.",
  TLS: "Koneksi aman ke gateway gagal.",
  EMPTY_MODELS: "Gateway tidak mengumumkan model apa pun.",
  BAD_URL: "Alamat gateway tidak sah.",
  UPSTREAM_ERROR: "Gateway sedang bermasalah.",
};

/** Pesan 429 (verbatim SDD-5.4). `reason`-nya `UPSTREAM_ERROR`. */
export const RATE_LIMITED_MESSAGE = "Terlalu banyak permintaan. Coba lagi sebentar.";

/**
 * Pesan 400/422: yang ditolak adalah PERMINTAAN kita, bukan gateway-nya rusak
 * (AUD-02). `reason` tetap `UPSTREAM_ERROR` supaya kosakata SDD-3.2 utuh.
 */
export const INVALID_REQUEST_MESSAGE = "Permintaan ke gateway tidak sah.";

/**
 * Kode diagnostik untuk 400/422, ditulis ke `Generation.errorCode`.
 *
 * Terpisah dari `reason` supaya operator bisa membedakan payload invalid dari
 * gangguan gateway tanpa mengubah kosakata `reason` yang dibekukan SDD-3.2.
 */
export const INVALID_REQUEST_CODE = "INVALID_UPSTREAM_REQUEST";

/** Pesan koneksi putus di tengah (verbatim SDD-5.4). */
export const DISCONNECTED_MESSAGE = "Koneksi terputus.";

/** Pesan balasan yang tidak dapat diurai (bukan JSON). */
export const UNREADABLE_BODY_MESSAGE = "Balasan gateway tidak dapat dibaca.";

/** Pesan balasan JSON dengan bentuk yang tidak dikenali. */
export const UNRECOGNIZED_BODY_MESSAGE = "Bentuk balasan gateway tidak dikenali.";

/** Hasil pemetaan: alasan mesin, pesan siap tampil, dan boleh diulang atau tidak. */
export type ProviderFailure = {
  reason: ProviderReason;
  message: string;
  /** Petunjuk untuk UI (SDD-3.1). Transport/upstream sementara boleh diulang. */
  retryable: boolean;
};

/**
 * Pemetaan status HTTP dari gateway (SDD-5.4).
 *
 * 5xx dan 429 sama-sama `UPSTREAM_ERROR` karena SDD-3.2 tidak menyediakan
 * `reason` khusus keduanya; pesannya yang membedakan. Status 2xx tidak pernah
 * sampai ke sini — pemanggil memeriksanya lebih dulu.
 */
export function fromUpstreamStatus(status: number): ProviderFailure {
  if (status === STATUS.UNAUTHORIZED) {
    return { reason: "UNAUTHORIZED", message: PROVIDER_MESSAGES.UNAUTHORIZED, retryable: false };
  }
  if (status === STATUS.FORBIDDEN) {
    return { reason: "FORBIDDEN", message: PROVIDER_MESSAGES.FORBIDDEN, retryable: false };
  }
  if (status === STATUS.NOT_FOUND) {
    return { reason: "NOT_FOUND", message: PROVIDER_MESSAGES.NOT_FOUND, retryable: false };
  }
  if (status === STATUS.TOO_MANY_REQUESTS) {
    return { reason: "UPSTREAM_ERROR", message: RATE_LIMITED_MESSAGE, retryable: true };
  }
  if (status >= 500) {
    return { reason: "UPSTREAM_ERROR", message: PROVIDER_MESSAGES.UPSTREAM_ERROR, retryable: true };
  }
  // 400/422 dari gateway: permintaan kita yang tidak sah (payload kosong,
  // bentuk ditolak). Pesannya tidak boleh menyebut gateway rusak.
  if (status === STATUS.BAD_REQUEST || status === STATUS.UNPROCESSABLE) {
    return { reason: "UPSTREAM_ERROR", message: INVALID_REQUEST_MESSAGE, retryable: false };
  }
  // 4xx lain: permintaan kita ditolak, bukan masalah sesi pengguna. Tetap
  // UPSTREAM_ERROR supaya tidak pernah menjadi 401/403 ke klien.
  return { reason: "UPSTREAM_ERROR", message: PROVIDER_MESSAGES.UPSTREAM_ERROR, retryable: false };
}

/**
 * Pemetaan `ApiError` dari `fetchJson` (SDD-3.1 → SDD-3.2).
 *
 * `BAD_URL` dari modul kebijakan keluar memakai pesannya sendiri: pesan itu
 * sudah aman untuk pengguna dan lebih spesifik (mis. "Alamat http:// tanpa TLS
 * tidak diizinkan.").
 */
export function fromApiError(err: ApiError): ProviderFailure {
  switch (err.code) {
    case "UPSTREAM_TIMEOUT":
      return { reason: "TIMEOUT", message: PROVIDER_MESSAGES.TIMEOUT, retryable: true };
    case "UPSTREAM_BAD_RESPONSE":
      return { reason: "UPSTREAM_ERROR", message: UNREADABLE_BODY_MESSAGE, retryable: false };
    case "UPSTREAM_UNAVAILABLE":
      return { reason: "UPSTREAM_ERROR", message: DISCONNECTED_MESSAGE, retryable: true };
    case "BAD_URL":
      return { reason: "BAD_URL", message: err.message, retryable: false };
    default:
      return {
        reason: "UPSTREAM_ERROR",
        message: PROVIDER_MESSAGES.UPSTREAM_ERROR,
        retryable: false,
      };
  }
}

/**
 * Status HTTP ke klien Kawan untuk sebuah kegagalan provider.
 *
 * `UNAUTHORIZED` dan `FORBIDDEN` dari gateway sengaja menjadi 502: keduanya
 * bicara tentang kredensial GATEWAY, bukan sesi Kawan (SDD-5.4).
 */
const FAILURE_STATUS: Record<ProviderReason, ErrorStatus> = {
  UNAUTHORIZED: STATUS.BAD_GATEWAY,
  FORBIDDEN: STATUS.BAD_GATEWAY,
  NOT_FOUND: STATUS.BAD_GATEWAY,
  TIMEOUT: STATUS.GATEWAY_TIMEOUT,
  DNS: STATUS.SERVICE_UNAVAILABLE,
  TLS: STATUS.SERVICE_UNAVAILABLE,
  EMPTY_MODELS: STATUS.BAD_GATEWAY,
  BAD_URL: STATUS.UNPROCESSABLE,
  UPSTREAM_ERROR: STATUS.BAD_GATEWAY,
};

/** Mengubah kegagalan provider menjadi `ApiError` siap dilempar route handler. */
export function toApiError(failure: ProviderFailure): ApiError {
  return new ApiError({
    status: FAILURE_STATUS[failure.reason],
    code: failure.reason,
    message: failure.message,
    retryable: failure.retryable,
  });
}
