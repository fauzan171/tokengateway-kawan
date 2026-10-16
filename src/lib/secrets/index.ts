/**
 * Titik masuk publik modul secrets (SDD-5.2, REQ-NT-07).
 *
 * Pemanggil di luar `lib/secrets` hanya boleh lewat berkas ini, sehingga
 * bentuk envelope dan aturan AAD tetap satu sumber. `apiKeyEncrypted` TIDAK
 * PERNAH keluar dari modul ini ke respons API, log, ekspor, atau snapshot
 * (SDD-5.2).
 *
 * Rotasi kunci didokumentasikan di `README.md` (SDD-5.2 mewajibkannya
 * terdokumentasi walau dijalankan nanti).
 */

export {
  CONNECTION_API_KEY_PURPOSE,
  ENVELOPE_VERSION,
  EnvelopeError,
  decryptSecret,
  encryptSecret,
} from "./envelope";
export type {
  DecryptSecretInput,
  EncryptSecretInput,
  EnvelopeAad,
  EnvelopeErrorCode,
} from "./envelope";

export { FULLY_MASKED, maskSecret } from "./mask";
