/**
 * Uji envelope AES-256-GCM (SDD-5.2, REQ-NT-07).
 *
 * Semua uji murni fungsi: tidak menyentuh database dan tidak mencatat apa pun.
 * Bukti inti ada di sini: ciphertext terikat ke barisnya lewat AAD, sehingga
 * tidak dapat dipindahkan antar baris.
 */

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CONNECTION_API_KEY_PURPOSE,
  ENVELOPE_VERSION,
  EnvelopeError,
  decryptSecret,
  encryptSecret,
  type EnvelopeAad,
} from "./envelope";

const KEY = randomBytes(32);
const KEY_ID = "v1";

const AAD: EnvelopeAad = {
  rowId: "conn_1",
  userId: "user_1",
  purpose: CONNECTION_API_KEY_PURPOSE,
};

/** Kunci API berformat nyata, cukup panjang agar tidak termask penuh. */
const PLAINTEXT = "sk-CONTOH-BUKAN-KUNCI-abcdefghijklmnop";

describe("encryptSecret / decryptSecret", () => {
  it("round-trip mengembalikan teks asli", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });

    expect(decryptSecret({ envelope, key: KEY, aad: AAD })).toBe(PLAINTEXT);
  });

  it("mendukung plaintext unicode dan string kosong", () => {
    for (const text of ["", "kunci-ünïcödé-日本語", "  spasi di tepi  "]) {
      const envelope = encryptSecret({ plaintext: text, key: KEY, keyId: KEY_ID, aad: AAD });
      expect(decryptSecret({ envelope, key: KEY, aad: AAD })).toBe(text);
    }
  });

  it("menghasilkan envelope berformat v1:<keyId>:<nonce>:<ciphertext>:<tag>", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const parts = envelope.split(":");

    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe(ENVELOPE_VERSION);
    expect(parts[1]).toBe(KEY_ID);
    // Nonce 12 byte dan tag 16 byte, dalam base64url.
    expect(Buffer.from(parts[2] as string, "base64url").length).toBe(12);
    expect(Buffer.from(parts[4] as string, "base64url").length).toBe(16);
  });

  it("dua enkripsi teks yang sama menghasilkan ciphertext berbeda (nonce acak)", () => {
    const pertama = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const kedua = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });

    expect(pertama).not.toBe(kedua);
    // Nonce (bagian ketiga) harus berbeda.
    expect(pertama.split(":")[2]).not.toBe(kedua.split(":")[2]);
  });
});

describe("AAD mengikat ciphertext ke barisnya", () => {
  it("AAD salah → dekripsi ditolak", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });

    const aadLain: EnvelopeAad = { ...AAD, userId: "user_2" };
    expect(() => decryptSecret({ envelope, key: KEY, aad: aadLain })).toThrow(EnvelopeError);
  });

  it("ciphertext dipindah ke baris lain → ditolak (bukti inti)", () => {
    const barisA: EnvelopeAad = { rowId: "conn_A", userId: "user_1", purpose: CONNECTION_API_KEY_PURPOSE };
    const barisB: EnvelopeAad = { rowId: "conn_B", userId: "user_1", purpose: CONNECTION_API_KEY_PURPOSE };

    const envelopeA = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: barisA });

    // Ciphertext yang sah untuk baris A tidak boleh terpakai di baris B.
    expect(() => decryptSecret({ envelope: envelopeA, key: KEY, aad: barisB })).toThrow(
      EnvelopeError,
    );
    // Tetap dapat didekripsi pada baris asalnya.
    expect(decryptSecret({ envelope: envelopeA, key: KEY, aad: barisA })).toBe(PLAINTEXT);
  });

  it("urutan kunci objek AAD tidak mempengaruhi hasil (encoding kanonik)", () => {
    const terurut: EnvelopeAad = {
      rowId: "conn_1",
      userId: "user_1",
      purpose: CONNECTION_API_KEY_PURPOSE,
    };
    // Objek dengan kunci ditulis dalam urutan berbeda.
    const terbalik = {
      purpose: CONNECTION_API_KEY_PURPOSE,
      userId: "user_1",
      rowId: "conn_1",
    } as EnvelopeAad;

    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: terurut });
    expect(decryptSecret({ envelope, key: KEY, aad: terbalik })).toBe(PLAINTEXT);
  });

  it("tujuan berbeda (bukan connection.apiKey) → ditolak", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const aadTujuanLain: EnvelopeAad = { ...AAD, purpose: "chat.attachment" };

    expect(() => decryptSecret({ envelope, key: KEY, aad: aadTujuanLain })).toThrow(EnvelopeError);
  });

  it("AAD tidak lengkap → ditolak saat enkripsi", () => {
    expect(() =>
      encryptSecret({
        plaintext: PLAINTEXT,
        key: KEY,
        keyId: KEY_ID,
        aad: { rowId: "conn_1", userId: "", purpose: CONNECTION_API_KEY_PURPOSE },
      }),
    ).toThrow(EnvelopeError);
  });
});

describe("penolakan envelope rusak", () => {
  it("envelope dengan jumlah bagian salah → ditolak", () => {
    for (const rusak of ["", "v1", "v1:abc", "v1:a:b:c", "v1:a:b:c:d:e"]) {
      expect(() => decryptSecret({ envelope: rusak, key: KEY, aad: AAD })).toThrow(EnvelopeError);
    }
  });

  it("versi tak dikenal → ditolak dengan kode UNKNOWN_VERSION", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const parts = envelope.split(":");
    const versiLain = ["v2", ...parts.slice(1)].join(":");

    try {
      decryptSecret({ envelope: versiLain, key: KEY, aad: AAD });
      throw new Error("seharusnya ditolak");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvelopeError);
      expect((err as EnvelopeError).code).toBe("UNKNOWN_VERSION");
    }
  });

  it("ciphertext dirusak → ditolak, tidak mengembalikan teks sebagian", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const parts = envelope.split(":");
    // Balik isi ciphertext.
    const ciphertextRusak = Buffer.from(parts[3] as string, "base64url").reverse();
    const dirusak = [
      parts[0],
      parts[1],
      parts[2],
      ciphertextRusak.toString("base64url"),
      parts[4],
    ].join(":");

    expect(() => decryptSecret({ envelope: dirusak, key: KEY, aad: AAD })).toThrow(EnvelopeError);
  });

  it("tag dirusak → ditolak", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const parts = envelope.split(":");
    const tagRusak = Buffer.from(parts[4] as string, "base64url");
    tagRusak[0] = (tagRusak[0] as number) ^ 0xff;
    const dirusak = [parts[0], parts[1], parts[2], parts[3], tagRusak.toString("base64url")].join(":");

    expect(() => decryptSecret({ envelope: dirusak, key: KEY, aad: AAD })).toThrow(EnvelopeError);
  });

  it("bagian nonce/tag bukan base64url → ditolak", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const parts = envelope.split(":");
    const dirusak = [parts[0], parts[1], "bukan!!base64", parts[3], parts[4]].join(":");

    expect(() => decryptSecret({ envelope: dirusak, key: KEY, aad: AAD })).toThrow(EnvelopeError);
  });

  it("kunci salah (32 byte tetapi berbeda) → ditolak", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });
    const kunciLain = randomBytes(32);

    expect(() => decryptSecret({ envelope, key: kunciLain, aad: AAD })).toThrow(EnvelopeError);
  });
});

describe("validasi panjang kunci", () => {
  it("kunci bukan 32 byte → ditolak saat enkripsi, tanpa hash/potong diam-diam", () => {
    for (const panjang of [0, 16, 31, 33, 64]) {
      expect(() =>
        encryptSecret({ plaintext: PLAINTEXT, key: randomBytes(panjang), keyId: KEY_ID, aad: AAD }),
      ).toThrow(EnvelopeError);
    }
  });

  it("kunci bukan 32 byte → ditolak saat dekripsi", () => {
    const envelope = encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId: KEY_ID, aad: AAD });

    expect(() => decryptSecret({ envelope, key: randomBytes(16), aad: AAD })).toThrow(EnvelopeError);
  });

  it("keyId kosong atau memuat pemisah → ditolak", () => {
    for (const keyId of ["", "   ", "a:b"]) {
      expect(() =>
        encryptSecret({ plaintext: PLAINTEXT, key: KEY, keyId, aad: AAD }),
      ).toThrow(EnvelopeError);
    }
  });
});

describe("canary REQ-NT-07", () => {
  it("teks rahasia tidak muncul di envelope keluaran", () => {
    // Penanda unik yang tidak akan muncul kebetulan.
    const canary = "CANARY-NT-07-9f4b1c7e-JANGAN-BOCOR";
    const envelope = encryptSecret({ plaintext: canary, key: KEY, keyId: KEY_ID, aad: AAD });

    expect(envelope).not.toContain(canary);
    expect(envelope).not.toContain("CANARY");
    // Bahkan tidak ada potongan penanda yang berarti.
    expect(envelope).not.toContain("BOCOR");
    // Tetap dapat dipulihkan.
    expect(decryptSecret({ envelope, key: KEY, aad: AAD })).toBe(canary);
  });
});
