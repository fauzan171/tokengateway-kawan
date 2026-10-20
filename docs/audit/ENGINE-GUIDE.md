# Guide Engine Kawan — Dari Audit ke Perbaikan

Dokumen pendamping untuk `ENGINE-AUDIT-ASTRA.md`.
Audit menemukan **apa** yang salah. Dokumen ini menjelaskan **mengapa** itu penting dibanding kompetitor, dan **bagaimana** memperbaikinya berurutan.

---

## Bagian 1 — Akar masalah, satu paragraf

`setSystemPrompt()` menyimpan instruksi pengguna ke `ChatMessage` sebagai root terpisah (`parentId: null`). `buildAncestryPath()` berjalan mundur dari pesan assistant mengikuti rantai `parentId`. Pesan system bukan leluhur pesan assistant — jadi ia tidak pernah masuk `ancestry`, tidak pernah masuk `messages`, dan tidak pernah sampai ke model.

Fungsi `getSystemPrompt()` ada, diuji, dan **tidak dipanggil dari mana pun di jalur produksi**. `grep -rn "getSystemPrompt" src/` mengembalikan hanya definisi dan berkas test.

Konsekuensinya: fitur system prompt per chat adalah UI yang tidak tersambung. Pengguna menulis *"kamu analis keuangan, jawab dengan tabel"*, melihatnya tersimpan, dan model tidak pernah membacanya. Ditambah tidak adanya `max_tokens`/`reasoning_effort` di body request (hanya `{model, messages, stream}`), jawaban jatuh ke default provider: pendek, datar, tanpa arahan.

**Ini bukan masalah model. Ini satu fungsi yang lupa dipanggil.**

---

## Bagian 2 — Apa yang dilakukan kompetitor

### open-webui

Struktur datanya *Message History Tree* — pesan disimpan sebagai pohon, bukan daftar linear. Ini memungkinkan percabangan dan edit non-destruktif tanpa menghapus riwayat. Kawan sudah punya ini (`src/lib/chat/tree.ts`), dan implementasinya benar termasuk deteksi siklus.

Yang **tidak** dimiliki Kawan: pipeline backend open-webui punya tahap **context compaction** eksplisit di middleware (`backend/open_webui/utils/middleware.py`), dijalankan sebelum request dikirim. Pemangkasan konteks adalah tahap tersendiri dengan kode sendiri, bukan efek samping dari query database. Kawan mengirim seluruh riwayat apa adanya.

Pipeline yang sama juga menangani plugin filter, loop eksekusi tool multi-iterasi, dan streaming inkremental — semuanya sebagai tahap berurutan yang bisa diuji terpisah.

### LibreChat

Tiga hal yang relevan, semuanya terbaca dari struktur berkas repo:

1. **`api/server/middleware/abortMiddleware.js`** — abort adalah middleware server tersendiri yang memutus upstream. Bukan flag yang diperiksa setelah chunk berikutnya tiba. Ini persis kebalikan dari E-11 di Kawan, di mana stop bisa tertunda sampai 90 detik idle timeout.
2. **`client/src/hooks/SSE/useResumableSSE.ts`** — stream bisa dilanjutkan setelah koneksi putus. Kawan punya mekanisme `seq > afterSeq` di `sse.ts:188` yang secara teori mendukung replay, tapi UI selalu membuka `afterSeq=0` (`chat-view.tsx:301`), jadi resume belum benar-benar tersambung.
3. **`packages/api/src/agents/steering/`** dan `request.resumeMetadata.spec.js` — ada lapisan yang menyimpan metadata progres request, sehingga request yang terputus bisa dilanjutkan dengan konteks yang benar.

### ChatGPT web

Perilaku teramati, bukan dokumentasi resmi — saya tandai demikian karena tidak bisa diverifikasi dari kode:

- Selalu mengirim system prompt bawaan yang mengatur panjang, format, dan pengakuan ketidakpastian.
- Memakai parameter generasi eksplisit, termasuk effort penalaran.
- Menampilkan penanda jelas saat jawaban terpotong karena batas token.
- Menyimpan draft jawaban yang gagal, bukan menghapusnya.

Empat hal ini persis empat celah teratas di audit Kawan (E-07, E-08, E-10, E-05).

### Kesimpulan perbandingan

Arsitektur Kawan sudah setara secara struktur: pohon pesan, SSE, worker terpisah, penyimpanan partial, batas jaringan. Yang hilang adalah **lapisan kebijakan** antara data dan request — perakitan prompt, anggaran konteks, parameter generasi, dan penanganan kegagalan. Kompetitor tidak menang karena model atau framework; mereka menang karena lapisan itu ada dan diuji.

---

## Bagian 3 — Rencana eksekusi

Enam work order. Urutan ini disusun supaya tiap WO bisa diverifikasi sendiri dan penyebab perbaikan bisa dibedakan. Jangan menggabungkan WO-1 dengan WO-3 — kalau kualitas naik, Anda tidak akan tahu mana yang bekerja.

### WO-1 — Sambungkan system prompt dan instruksi dasar
**Menutup:** E-01, E-07. **Usaha:** kecil (15-30 baris).
Ambil `getSystemPrompt(db, chatId)` di `generate.ts`, sisipkan sebagai elemen pertama `messages`, lompati jika `ancestry` sudah memuat role system. Tambahkan prompt bawaan ringkas (format, panjang wajar, akui ketidakpastian) yang selalu dikirim di bawah system prompt pengguna. Hapus pemaksaan `"Jawab dalam bahasa Indonesia."` di `src/lib/search/prompt.ts:48`, ganti dengan instruksi mengikuti bahasa pengguna.

**Ini WO dengan rasio dampak-per-baris tertinggi. Kerjakan lebih dulu, ukur hasilnya sebelum menyentuh yang lain.**

### WO-2 — Grounding dokumen
**Menutup:** E-02, E-05. **Usaha:** sedang (40-80 baris).
Pastikan ingest benar-benar menghasilkan embedding yang dicari retrieval. Saat embedding gagal atau vektor kosong, jatuh ke retrieval kata kunci dan tandai mode degradasi. Jangan biarkan `catch {}` kosong di `generate.ts:624` mengubah jawaban berbasis dokumen menjadi jawaban tanpa rujukan tanpa pemberitahuan.

**Catatan:** E-02 menyentuh data existing. Perlu keputusan owner: re-embed semua dokumen, atau hanya dokumen baru.

### WO-3 — Anggaran konteks
**Menutup:** E-03, E-06. **Usaha:** sedang-besar (60-100 baris). **Paling berisiko.**
Hitung anggaran token per model, sisakan ruang untuk output, pangkas giliran lama secara utuh (jangan memutus pasangan user/assistant), tambahkan deduplikasi chunk dan anggaran konteks dokumen.

Wajib punya test dengan percakapan sintetis panjang sebelum di-merge. Ini satu-satunya WO yang bisa merusak percakapan yang sudah ada.

### WO-4 — Kejujuran status
**Menutup:** E-09, E-10. **Usaha:** kecil (20-40 baris).
EOF tanpa `[DONE]` maupun `finish_reason` → lempar galat stream tidak lengkap, simpan partial sebagai error. Baca `finishReason` di handler `done` UI (`chat-view.tsx:346`), tampilkan penanda saat `length`.

### WO-5 — Ketahanan
**Menutup:** E-11, E-12. **Usaha:** sedang (35-65 baris).
Hubungkan stop ke `AbortController` upstream langsung, bukan polling per chunk. Tambahkan retry terbatas (2×) hanya sebelum ada output, hormati `Retry-After`, backoff eksponensial dengan jitter. Jangan mengulang jawaban parsial diam-diam.

### WO-6 — Presisi retrieval dan usage
**Menutup:** E-04, E-13, E-14. **Usaha:** sedang.
Query retrieval memakai pesan terakhir saja — pertanyaan lanjutan seperti "jelaskan lagi bagian itu" kehilangan rujukan. Gabungkan beberapa pesan terakhir atau lakukan query rewriting. Perbaiki integrasi usage agar baris parsial tidak dikeluarkan dari agregasi.

### Yang ditunda
E-08 (parameter generasi) dan E-15 (tulis DB per delta) ditandai **P3: ukur dulu** oleh audit. Jangan optimasi sebelum ada pengukuran. Kalau WO-1 sampai WO-5 sudah selesai dan kualitas masih kurang, baru ukur.

---

## Bagian 4 — Gerbang verifikasi

Tiap WO harus lulus keempat ini sebelum dianggap selesai:

```sh
npx tsc --noEmit
npx eslint .
npx vitest run
npm run build
```

Ditambah satu bukti perilaku: jalankan satu percakapan nyata lewat UI dan tunjukkan jawaban sebelum vs sesudah. Tanpa itu, "sudah diperbaiki" hanya klaim.

**Eval yang disarankan:** siapkan 5 pertanyaan tetap dengan jawaban acuan, jalankan pada model dan provider yang sama sebelum dan sesudah tiap WO. Tanpa eval, Anda tidak bisa membedakan perbaikan nyata dari variasi model. Audit menandai ini sebagai E-16.

---

## Bagian 5 — Batas kejujuran

- Audit ini **statis** plus 10 reproduksi dengan fetch sintetis. Tidak ada request ke provider berbayar, tidak ada pembacaan DB produksi.
- Selisih kualitas terhadap ChatGPT **belum diukur** dengan model dan prompt setara. Temuan E-16 berlaku: sebagian selisih mungkin berasal dari model, bukan dari kode.
- Apakah `cx/gpt-6-astra[1m]` benar-benar berkonteks 1 juta token **belum diuji**. Nama model menyiratkan demikian.
- Perilaku dan penagihan provider setelah `reader.cancel()` tidak dapat dipastikan dari sisi lokal.
- Model embedding yang aktif di deployment tidak diketahui dari kode — datang dari `EMBEDDING_MODEL` di environment.

---

## Bagian 6 — Yang jangan disentuh

Struktur pohon pesan, parser SSE, idle timeout 90 detik, penyimpanan partial, perlindungan prompt injection dokumen, dan idempotensi pesan sudah benar. Audit memverifikasinya dan mencatat alasan per bagian di `ENGINE-AUDIT-ASTRA.md` bagian "Yang TIDAK perlu diubah". Jangan "merapikan" bagian itu saat mengerjakan WO.
