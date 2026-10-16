/**
 * Envelope enkripsi kredensial (SDD-5.2, REQ-NT-07).
 *
 * Format (verbatim SDD-5.2):
 *
 *   v1:<keyId>:<nonce-b64url>:<ciphertext-b64url>:<tag-b64url>
 *
 * Aturan yang ditegakkan modul ini:
 *   - AES-256-GCM; nonce acak 12 byte per enkripsi (tidak pernah dipakai ulang);
 *     tag 16 byte.
 *   - AAD memuat versi, id baris, userId, dan tujuan dalam encoding kanonik,
 *     sehingga ciphertext TIDAK dapat dipindahkan antar baris. Pemanggil
 *     menyerahkan AAD sebagai objek; pengurutan dibakukan di sini, bukan
 *     bergantung pada urutan kunci objek pemanggil.
 *   - Envelope rusak, versi tak dikenal, atau AAD tidak cocok → ditolak dengan
 *     galat jelas. Tidak pernah ada plaintext sebagian yang dikembalikan.
 *   - `key` harus tepat 32 byte; panjang salah → lempar. Tidak ada hash atau
 *     potong diam-diam.
 *
 * Modul ini tidak mencatat apa pun: ciphertext dan plaintext tidak boleh
 * menyentuh log (SDD-5.2).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Versi format yang didukung modul ini. Hanya `v1` yang dikenal. */
export const ENVELOPE_VERSION = "v1";

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** Pemisah bagian envelope. */
const SEPARATOR = ":";

/** Jumlah bagian envelope `v1` yang sah. */
const ENVELOPE_PARTS = 5;

/**
 * Tujuan AAD untuk kunci API koneksi (SDD-5.2 menyebut `connection.apiKey`).
 * Dipakai pemanggil agar nilai ini tidak salah ketik dan konsisten dengan
 * `lib/connections`.
 */
export const CONNECTION_API_KEY_PURPOSE = "connection.apiKey";

/**
 * Data terautentikasi yang mengikat ciphertext ke satu baris dan satu tujuan.
 *
 * Nilai ini masuk ke AAD; mengubah salah satunya membuat dekripsi gagal. Itu
 * bukti inti SDD-5.2: ciphertext dari baris A tidak bisa dipakai di baris B.
 */
export type EnvelopeAad = {
  /** `Connection.id` baris pemilik ciphertext. */
  rowId: string;
  /** `Connection.userId` pemilik baris. */
  userId: string;
  /** Tujuan pemakaian, mis. {@link CONNECTION_API_KEY_PURPOSE}. */
  purpose: string;
};

export type EnvelopeErrorCode =
  | "INVALID_KEY"
  | "INVALID_KEY_ID"
  | "INVALID_AAD"
  | "MALFORMED_ENVELOPE"
  | "UNKNOWN_VERSION"
  | "DECRYPT_FAILED";

/** Galat modul secrets dengan kode yang bisa diperiksa pemanggil. */
export class EnvelopeError extends Error {
  readonly code: EnvelopeErrorCode;

  constructor(code: EnvelopeErrorCode, message: string) {
    super(message);
    this.name = "EnvelopeError";
    this.code = code;
  }
}

export type EncryptSecretInput = {
  plaintext: string;
  key: Buffer;
  keyId: string;
  aad: EnvelopeAad;
};

export type DecryptSecretInput = {
  envelope: string;
  key: Buffer;
  aad: EnvelopeAad;
};

function assertKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    const length = Buffer.isBuffer(key) ? String(key.length) : "bukan Buffer";
    throw new EnvelopeError(
      "INVALID_KEY",
      `Kunci harus Buffer tepat ${KEY_BYTES} byte, dapat ${length}.`,
    );
  }
}

function assertKeyId(keyId: string): void {
  if (typeof keyId !== "string" || keyId.trim() === "") {
    throw new EnvelopeError("INVALID_KEY_ID", "keyId wajib diisi.");
  }
  if (keyId.includes(SEPARATOR)) {
    throw new EnvelopeError(
      "INVALID_KEY_ID",
      `keyId tidak boleh memuat "${SEPARATOR}" karena menjadi pemisah envelope.`,
    );
  }
}

function assertAad(aad: EnvelopeAad): void {
  const fields: Array<[string, unknown]> = [
    ["rowId", aad?.rowId],
    ["userId", aad?.userId],
    ["purpose", aad?.purpose],
  ];
  for (const [name, value] of fields) {
    if (typeof value !== "string" || value === "") {
      throw new EnvelopeError("INVALID_AAD", `AAD.${name} wajib string tidak kosong.`);
    }
  }
}

/**
 * Encoding kanonik AAD.
 *
 * Dibangun sebagai objek berbentuk tetap dengan kunci yang sudah terurut
 * (purpose, rowId, userId, version), lalu `JSON.stringify`. Karena bentuknya
 * ditentukan di sini — bukan oleh pemanggil — urutan kunci objek pemanggil
 * tidak berpengaruh, dan nilai yang memuat pemisah tidak dapat memalsukan
 * batas antar-field (`JSON.stringify` meng-escape-nya).
 */
function canonicalAad(version: string, aad: EnvelopeAad): Buffer {
  const canonical = JSON.stringify({
    purpose: aad.purpose,
    rowId: aad.rowId,
    userId: aad.userId,
    version,
  });
  return Buffer.from(canonical, "utf8");
}

/** Decode base64url ketat. `Buffer.from` membuang karakter asing diam-diam,
 *  jadi hasil decode di-encode ulang dan dibandingkan sebelum dipercaya. */
function decodeBase64Url(value: string, field: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new EnvelopeError(
      "MALFORMED_ENVELOPE",
      `Bagian ${field} bukan base64url yang valid.`,
    );
  }
  const buf = Buffer.from(value, "base64url");
  if (buf.toString("base64url") !== value) {
    throw new EnvelopeError("MALFORMED_ENVELOPE", `Bagian ${field} rusak.`);
  }
  return buf;
}

/**
 * Enkripsi `plaintext` menjadi envelope `v1`.
 *
 * Nonce dibuat acak 12 byte untuk setiap panggilan, sehingga dua enkripsi teks
 * yang sama menghasilkan ciphertext berbeda.
 */
export function encryptSecret({ plaintext, key, keyId, aad }: EncryptSecretInput): string {
  assertKey(key);
  assertKeyId(keyId);
  assertAad(aad);

  if (typeof plaintext !== "string") {
    throw new EnvelopeError("MALFORMED_ENVELOPE", "plaintext harus string.");
  }

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(canonicalAad(ENVELOPE_VERSION, aad));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    keyId,
    nonce.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(SEPARATOR);
}

/**
 * Dekripsi envelope menjadi plaintext.
 *
 * Melempar {@link EnvelopeError} bila envelope rusak, versinya tak dikenal,
 * atau AAD tidak cocok. Plaintext tidak pernah dikembalikan sebagian: hasil
 * hanya disusun setelah verifikasi tag GCM (`final()`) berhasil.
 */
export function decryptSecret({ envelope, key, aad }: DecryptSecretInput): string {
  assertKey(key);
  assertAad(aad);

  if (typeof envelope !== "string") {
    throw new EnvelopeError("MALFORMED_ENVELOPE", "envelope harus string.");
  }

  const parts = envelope.split(SEPARATOR);
  if (parts.length !== ENVELOPE_PARTS) {
    throw new EnvelopeError(
      "MALFORMED_ENVELOPE",
      `Envelope harus ${ENVELOPE_PARTS} bagian dipisah "${SEPARATOR}", dapat ${parts.length}.`,
    );
  }

  const [version, keyId, nonceB64, ciphertextB64, tagB64] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (version !== ENVELOPE_VERSION) {
    throw new EnvelopeError("UNKNOWN_VERSION", `Versi envelope tidak dikenal: "${version}".`);
  }
  if (keyId === "") {
    throw new EnvelopeError("MALFORMED_ENVELOPE", "keyId pada envelope kosong.");
  }

  const nonce = decodeBase64Url(nonceB64, "nonce");
  if (nonce.length !== NONCE_BYTES) {
    throw new EnvelopeError(
      "MALFORMED_ENVELOPE",
      `Nonce harus ${NONCE_BYTES} byte, dapat ${nonce.length}.`,
    );
  }

  const tag = decodeBase64Url(tagB64, "tag");
  if (tag.length !== TAG_BYTES) {
    throw new EnvelopeError(
      "MALFORMED_ENVELOPE",
      `Tag harus ${TAG_BYTES} byte, dapat ${tag.length}.`,
    );
  }

  const ciphertext = decodeBase64Url(ciphertextB64, "ciphertext");

  const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_BYTES });
  decipher.setAAD(canonicalAad(version, aad));
  decipher.setAuthTag(tag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM menolak AAD/ciphertext/tag yang tidak cocok. Pesan generik: tidak
    // ada detail internal yang bocor, dan tidak ada plaintext sebagian.
    throw new EnvelopeError(
      "DECRYPT_FAILED",
      "Envelope tidak dapat didekripsi: AAD tidak cocok atau ciphertext/tag rusak.",
    );
  }

  return plaintext.toString("utf8");
}
