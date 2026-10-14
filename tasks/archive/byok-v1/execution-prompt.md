# Instruksi untuk pelaksana Kawan

Salin prompt di bawah ke developer/agent pelaksana. Tambahkan ID fase/task yang akan dikerjakan pada bagian penugasan. Mandor menggunakan acceptance pada `tasks/todo.md` untuk review.

---

Kamu pelaksana full-stack untuk membangun **Kawan — Chat AI by tokengateway.ai.id**, bukan mandor perencana. Kerjakan hanya fase/task yang ditugaskan, sampai acceptance dan gate-nya benar-benar lulus.

Workspace: `/Users/mekari/tokengateway/tokengateway-chat`.
Referensi lokal: `/Users/mekari/tokengateway/open-webui`.
Upstream referensi: `https://github.com/open-webui/open-webui.git`.

**Penugasan awal:** F0, mulai F0-01; jangan mengerjakan seluruh backlog sekaligus.
Untuk penugasan berikutnya, ganti baris ini dengan fase/task yang ditentukan pemilik/mandor.

## Dokumen yang wajib dibaca

1. `PROMPT.md`: brief produk asli.
2. `tasks/plan.md`: keputusan arsitektur, data/API, semantik perilaku, batas scope, matriks penerimaan.
3. `tasks/todo.md`: task, dependencies, acceptance, verification, gates, format laporan.
4. `tasks/parity-audit.md`: perbedaan schema/fitur terhadap Open WebUI; gap di luar backlog belum otomatis ditugaskan.
5. `AGENTS.md` bila kemudian tersedia; periksa perubahan workspace dan pekerjaan orang lain sebelum edit.

Instruksi terbaru pemilik selalu diutamakan. Jika dokumen atau kontrak bertentangan, catat kontradiksi konkret dan selesaikan dengan konteks pemilik sebelum mengubah fondasi bersama. Jangan mengarang endpoint/credential/URL repo.

## Aturan produk

- Gunakan Next.js 15 App Router + TypeScript strict + Tailwind CSS 4 + shadcn/ui + AI SDK v5 + Prisma + Auth.js Credentials.
- SQLite dev dan Postgres production adalah dua target migrasi nyata. Provider bukan ditentukan hanya dari DATABASE_URL.
- Mode default: key gateway user encrypted AES-256-GCM server-side; semua inference memakai gateway connection user, bukan key global/default gateway SDK.
- Server tidak pernah mengembalikan plaintext maupun ciphertext key ke browser. Browser default hanya menerima mask dan metadata.
- Direct optional: key localStorage milik perangkat; models/test/inference browser ke gateway; tanpa server fallback dan tanpa key dikirim ke Kawan.
- Chat history harus message tree. Edit user/regenerate menghasilkan node baru, bukan array yang ditimpa.
- Semua resource privat owner-scoped dari session. Jangan percaya userId request.
- Branding Kawan dan `by tokengateway.ai.id` wajib di seluruh titik pada plan, termasuk CTA/onboarding/About/metadata.
- Open WebUI menjadi referensi perilaku/UX, bukan sumber file yang disalin. Tulis kode/aset Kawan dari nol. Jangan meng-clone repo itu ke workspace aplikasi sebagai implementasi.
- Fitur enterprise/out-of-scope tidak dikerjakan. MCP adalah fitur terakhir.
- Target parity adalah brief personal BYOK yang dipilih. Schema/API Kawan bukan drop-in Open WebUI; jangan mengklaim seluruh produk sama 100%.

## Cara kerja per task

1. Baca task dan dependencies; jangan maju jika gate dependency gagal.
2. Baca komponen/models referensi yang relevan sebelum mengimplementasikan fitur.
3. Periksa existing files dan working changes; jangan menimpa hasil pelaksana lain.
4. Implementasikan satu alur lengkap: data/API/UI yang diperlukan, state error/loading/empty, dan validasi backend.
5. Tambahkan test yang relevan untuk risiko perilaku, keamanan, persistence atau concurrency; jangan menambah test yang hanya meniru kode.
6. Jalankan focused verification yang ditetapkan task. Sesudah 2–3 task jalankan checkpoint.
7. Pada akhir fase, `npm run build` harus sukses, plus checks/E2E gate. Build tidak cukup untuk mengklaim fitur jalan.
8. Catat bukti sesuai template todo, centang task yang selesai, dan laporkan ke mandor.
9. Berhenti di batas fase yang ditugaskan dengan hasil reviewable; jangan deploy/publish atau mengubah DNS tanpa penugasan.

Jangan meninggalkan TODO kosong, mock permanen, tombol inert, data demo yang menyamar sebagai data user, key contoh asli, feature flag palsu, atau error yang hanya diabaikan. Jangan mengurangi fitur wajib agar build lulus. Jika blocked, sebut task, bukti kegagalan, dan informasi spesifik yang diperlukan; lanjutkan pekerjaan independen yang masih sah.

## Keputusan teknis yang tidak boleh terlewat

- URL Base API dipakai persis: append `/models` dan `/chat/completions`, tidak append `/v1` dua kali.
- Safe outbound guard mencakup private/metadata IP, IPv6, redirects, DNS rebinding dan alamat transport sebenarnya sebelum secret dikirim.
- Perubahan host/URL connection meminta key baru; jangan menguji key tersimpan pada host lain.
- Single active connection dan single running generation/chat ditangani DB concurrency, bukan state React/Map global.
- Inferensi tidak di-retry otomatis setelah outcome ambigu; idempotency mencegah duplicate node/request.
- Stop meng-abort upstream dan mempertahankan partial output; EOF/timeout tidak boleh dipaksa completed.
- Usage absent = unknown/null, bukan zero. MCP usage semua langkah dihitung tepat sekali. Direct usage berlabel browser-reported.
- Share snapshot cabang aktif read-only; key/system prompt/owner metadata/file bytes/raw tool output tidak dibagikan. Revoke harus benar-benar memutus akses.
- Gambar sampai sebagai multimodal input; PDF/teks menjadi konteks nyata, bukan sekadar chip di composer. Jangan menambah RAG/OCR.
- MCP tools harus discovery dan execute nyata, menghasilkan tool result yang dipakai model; replay history mempertahankan pasangan tool call/result.
- Self-host harus bisa clean-start, migrations dan backup/secret restore benar; production tidak bergantung SQLite atau disk ephemeral.

## Laporan yang harus dikirim

```text
Fase/task yang dikerjakan:
Hasil perilaku yang sekarang bisa dipakai:
Acceptance yang lulus/gagal:
File utama berubah:
Checks (command, exit code, ringkasan):
Bukti E2E/network/DB/screenshot yang disanitasi:
Keterbatasan atau konfigurasi release yang belum tersedia:
Perubahan kontrak/scope yang diusulkan:
Commit ID jika tersedia:
Task berikutnya:
```

Jangan laporkan “100% selesai” tanpa mencocokkan acceptance. Jika fase belum lulus, nyatakan belum lulus beserta sebab yang dapat diverifikasi.

---

## Catatan untuk mandor/pemilik

- Mulai dengan F0, lalu minta laporan gate sebelum menugaskan F1.
- Jangan memberi F3/F4/MCP bersamaan sebelum kontrak generation/tree stabil.
- Bila memakai banyak pelaksana, satu integrator memegang schema/migrations/auth/generation. UI/docs/fixtures dapat diparalelkan setelah contracts tetap.
- Penambahan scope atau perubahan mode server/Direct harus tercatat pada plan sebelum dikerjakan.
- Semua file planning saat ini belum berarti kode aplikasi sudah ada atau build sudah dijalankan.
