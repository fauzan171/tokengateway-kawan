# Modul `lib/secrets` — enkripsi kredensial

Modul ini adalah satu-satunya tempat yang boleh memegang plaintext kunci API
gateway dan envelope terenkripsinya. Kontraknya: SDD-5.2, requirement REQ-NT-07.

## Bentuk envelope

```text
v1:<keyId>:<nonce-b64url>:<ciphertext-b64url>:<tag-b64url>
```

- AES-256-GCM, nonce acak **12 byte per enkripsi**, tag **16 byte**.
- Kunci berasal dari `ENCRYPTION_SECRET` (32 byte ter-decode). Panjang salah →
  aplikasi gagal start (`loadConfig`, SDD-1.5).
- AAD memuat `version`, `rowId`, `userId`, dan `purpose` dalam encoding kanonik
  (JSON dengan kunci terurut, dibangun di dalam modul — bukan mengikuti urutan
  kunci objek pemanggil). Akibatnya ciphertext **tidak dapat dipindahkan antar
  baris**: memakai ciphertext baris A dengan AAD baris B ditolak.
- Envelope rusak, versi tak dikenal, atau AAD tidak cocok → `EnvelopeError`,
  tanpa plaintext sebagian.

`apiKeyEncrypted` **tidak pernah** masuk ke respons API, event SSE, log,
ekspor, atau snapshot berbagi.

## Mask

`maskSecret(plaintext)` mengembalikan bentuk seperti `sk-...abc1` (awalan
skema terlihat + 4 karakter terakhir). Untuk kunci pendek yang akan
membocorkan sebagian besar isinya, dikembalikan `••••` tanpa karakter asli.

Mask **hanya** dibuat dari kunci asli saat kunci tersedia, dan disimpan di
`Connection.apiKeyMask` saat key ditulis. Operasi daftar **tidak** boleh
mendekripsi hanya untuk membuat mask.

## Prosedur rotasi kunci (SDD-5.2)

Rotasi dijalankan nanti, tetapi prosedurnya wajib terdokumentasi. Urutannya:

1. **Tambah keyId baru.** Hasilkan `ENCRYPTION_SECRET` baru
   (`openssl rand -base64 32`), tetapkan `ENCRYPTION_KEY_ID` baru (mis. `v2`).
2. **Deploy pembaca yang menerima lama + baru.** Selama masa transisi, proses
   harus dapat membaca envelope ber-`keyId` lama maupun baru. Karena envelope
   menyimpan `keyId`-nya sendiri, dekripsi memilih kunci berdasarkan field itu.
3. **Re-enkripsi bertahap dengan checkpoint.** Jalankan job yang membaca baris
   demi baris, mendekripsi dengan kunci lama, dan menulis ulang dengan kunci
   baru. Simpan posisi terakhir (checkpoint) agar job bisa dilanjutkan setelah
   berhenti di tengah.
4. **Verifikasi sampel.** Ambil sampel baris acak, dekripsi dengan kunci baru,
   pastikan berhasil dan `keyId` pada envelope sudah berpindah.
5. **Backup.** Sebelum menonaktifkan kunci lama, pastikan backup database dan
   **kunci enkripsi** tersedia. Tanpa `ENCRYPTION_SECRET`, ciphertext tidak
   dapat dipulihkan (SDD-6, catatan backup operator).
6. **Pensiunkan kunci lama setelah periode retensi.** Setelah seluruh baris
   terverifikasi memakai kunci baru dan periode retensi lewat, hapus kunci lama
   dari konfigurasi.

### Dua operasi terpisah

Rotasi `AUTH_SECRET` dan rotasi `ENCRYPTION_SECRET` adalah **dua operasi
terpisah**:

- `AUTH_SECRET` menandatangani cookie sesi. Menggantinya hanya membuat sesi
  lama tidak valid — tidak ada data yang perlu di-enkripsi ulang.
- `ENCRYPTION_SECRET` melindungi kredensial tersimpan. Menggantinya menuntut
  re-enkripsi data; tanpa langkah itu, kredensial lama tak terbaca.

Jangan pernah menjalankan keduanya sebagai satu langkah tunggal.
