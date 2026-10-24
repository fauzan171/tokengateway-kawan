# Audit batasan A–J terhadap kode aktual

Baseline dan cakupan: [indeks](README.md). Audit menggunakan pembacaan kode,
penelusuran pemanggil, pemeriksaan schema, serta pemeriksaan otomatis yang dicatat
di bawah. Tidak ada klaim pengujian provider live atau seluruh UI melalui browser.

## 1. Klasifikasi

| Status | Makna |
|---|---|
| Ada | Implementasi ditemukan; bukan jaminan seluruh alur produksi sudah lulus |
| Parsial | Backend/util tersedia, tetapi sambungan, kualitas, atau lifecycle belum lengkap |
| Kondisional | Bergantung gateway/model, konfigurasi, izin browser, atau layanan eksternal |
| Belum | Tidak ditemukan implementasi yang memenuhi klaim |
| Risiko | Dapat dikurangi dan diukur; tidak dapat dijamin hilang sepenuhnya |
| Batas | Tidak tepat dijanjikan sebagai kemampuan umum; perlu batas produk yang eksplisit |

ID A01–J05 memetakan seluruh pokok daftar pengguna. Pernyataan yang menggabungkan
beberapa format/aksi tetap dirinci pada solusi dan penerimaan. FIX adalah rujukan
ke [rencana teknis](02-rencana-implementasi.md).

## 2. Inventaris sumber bukti

| Kode | Sumber yang diperiksa | Arti bukti |
|---|---|---|
| S1 | `src/components/chat-view.tsx`, `src/app/page.tsx` | State chat lokal, model bawaan, fetch SSE, composer, switch branch, gate login |
| S2 | `src/components/chat-sidebar.tsx`, `src/lib/chat/chats.ts`, `folders.ts`, `title.ts` | Sidebar CRUD, folder, pencarian, pin/arsip; helper judul otomatis |
| S3 | `src/lib/chat/messages.ts`, `start-generation.ts`, `generate.ts`, `stream-parse.ts`, `sse.ts` | Admission transaksi, idempotensi, payload provider, SSE persisten |
| S4 | `src/lib/jobs/queue.ts`, `worker.ts`, `kinds.ts`, `src/worker.ts`, `src/lib/chat/recovery.ts` | Lease, heartbeat, handler nyata, recovery dan shutdown |
| S5 | `src/lib/documents/{upload,extract,run-extract,retrieve,context,citations,storage,remove}.ts` | PDF/text ingest, chunk, retrieval, sumber, filesystem dan delete |
| S6 | `src/lib/chat/transfer.ts`, `document-export.ts`, `share.ts`, route `chats/[chatId]/transfer` | Ekspor/impor, PDF/DOCX/XLSX minimal, snapshot share |
| S7 | `src/lib/providers/gateway.ts`, `src/lib/connections/`, route `capabilities` | Model discovery dan capabilities dari gateway/env |
| S8 | `src/lib/search/{web,prompt}.ts` | SearXNG: judul, URL, snippet; bukan pembaca halaman penuh |
| S9 | `src/lib/media/{config,images,audio}.ts`, `src/components/media-controls.tsx` | Endpoint media dan UI kondisional |
| S10 | `src/lib/settings/settings.ts`, `src/lib/i18n/`, `src/components/settings-form.tsx` | Preferensi aplikasi; bukan ingatan personal untuk model |
| S11 | `src/lib/auth/`, `src/lib/secrets/`, `src/lib/net/policy.ts`, `src/lib/api/{route,http,logger}.ts` | Auth, enkripsi key, SSRF, HTTP, log dan batas saat ini |
| S12 | `src/lib/admin/users.ts`, `src/lib/legal/privacy.ts`, `docs/privacy.md`, `scripts/{backup,restore}.sh` | Delete akun admin, kebijakan data dan backup |
| S13 | `prisma/schema.prisma`, migrasi dua provider, helper tes dan CI | Entitas yang benar-benar tersedia dan reproduksibilitas |
| S14 | `src/components/markdown.tsx`, tes komponen, `src/security/`, `e2e/` | Rendering dan cakupan pengujian yang sudah ada |

Path singkat pada tabel di atas relatif terhadap modul pertama pada sel yang sama.
Keberadaan package pada `package.json` tidak dipakai sebagai bukti fitur berjalan.

## 3. Matriks A — antarmuka dan fitur aplikasi

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| A01 | Tidak bisa membuat/mengganti judul otomatis sidebar | Parsial: `maybeSetAutoTitle` ada, tidak ditemukan pemanggil produksi; judul baru dari UI diterjemahkan sehingga sentinel `Chat baru` rapuh | S1,S2 | FIX-04 |
| A02 | Tidak bisa rename/pin/arsip/hapus lewat percakapan | Aksi UI/API ada; tool percakapan belum ada | S2,S3 | FIX-09,FIX-19 |
| A03 | Tidak bisa folder/kategorisasi | Folder satu tingkat ada; kategorisasi oleh asisten belum | S2 | FIX-19 |
| A04 | Tidak bisa share link | Snapshot share ada lewat UI/API; tool asisten belum. Membuat link publik perlu persetujuan | S2,S6 | FIX-19,FIX-20 |
| A05 | Tidak bisa ekspor chat | Keliru secara umum: JSON/MD/PDF/DOCX/XLSX tersedia; asisten belum membuat artefak sendiri | S6 | FIX-11,FIX-12 |
| A06 | Tidak bisa mengubah setting | Tema/bahasa/font/Enter tersedia; belum tool yang mengubah berdasarkan permintaan | S10 | FIX-04,FIX-19 |
| A07 | Tidak melihat layar/sidebar/device | Model tidak mendapat snapshot aplikasi terotorisasi; screen capture belum ada | S1,S3 | FIX-04,FIX-17 |
| A08 | Tidak ada notifikasi/badge/pop-up | Ada status/error dan dialog UI; notifikasi hasil tugas persisten/push belum | S1,S2 | FIX-08,FIX-21 |
| A09 | Jawaban hanya Markdown, tanpa tombol/form/widget | Komponen interaktif aplikasi ada; structured result/action card model belum | S1,S14 | FIX-08,FIX-11,FIX-19 |
| A10 | Tidak bisa melanjutkan saat ditinggal | Job chat berjalan di worker terpisah; autonomous task/follow-up belum | S3,S4 | FIX-08,FIX-09 |
| A11 | Tidak mendeteksi lama tidak membalas | Tidak ada aturan idle/timer persisten. Tidak boleh menyamakan diam dengan persetujuan | S4 | FIX-21 |

## 4. Matriks B — file dan format

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| B01 | Tidak bisa membuat PDF/DOCX/XLSX/PPTX/CSV/ZIP/gambar/audio/video/SVG/JSON | PDF/DOCX/XLSX ekspor chat ada, ZIP util ada; JSON/MD tersedia terpisah. PPTX/artefak umum belum. Media kondisional | S6,S9 | FIX-11,FIX-12,FIX-16 |
| B02 | Tidak ada attachment | Upload dokumen dan lampiran gambar ada; unduhan file buatan asisten belum | S1,S5 | FIX-11,FIX-14 |
| B03 | Tidak bisa mengedit file | Belum ada versi file, diff/preview, atau editor dokumen | S5,S6 | FIX-12 |
| B04 | Tidak bisa grafik/chart | Tabel dan Mermaid tersedia, chart numerik/data-driven belum | S14 | FIX-15 |
| B05 | Tidak bisa diagram nyata | Keliru bila Mermaid didukung: sudah dirender SVG; unduh SVG/PNG belum menjadi alur lengkap | S14 | FIX-15 |
| B06 | Tidak bisa konversi PDF→Word/JPG→PNG | Ekspor chat berbeda dari konversi file umum; fidelity dokumen kompleks belum | S5,S6 | FIX-12,FIX-14 |
| B07 | Tidak bisa ZIP kompres/ekstrak | Writer ZIP STORE internal ada; ekstraksi unggahan aman belum | S6 | FIX-12 |
| B08 | Tidak bisa OCR | PDF tanpa text layer ditolak `NO_TEXT_LAYER`; belum OCR fallback | S5 | FIX-14 |
| B09 | Semua file harus copy-paste | Keliru untuk PDF teks/TXT/MD; DOCX/XLSX/PPTX belum di-ingest | S5 | FIX-14 |
| B10 | Tidak bisa QR/barcode/tanda tangan digital | Belum. Gambar tanda tangan berbeda dari tanda tangan kriptografis terverifikasi | S6,S13 | FIX-15,FIX-20 |
| B11 | Tidak bisa template placeholder | Prompt template/variabel ada; template DOCX/PPTX atau form output belum | `src/lib/prompts/`,S6 | FIX-12,FIX-19 |

## 5. Matriks C — aksi dan eksekusi

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| C01 | Tidak bisa buka URL | Web search hanya snippet; URL reader belum | S8 | FIX-10 |
| C02 | Tidak bisa internet live | Kondisional: SearXNG ada bila dikonfigurasi; browsing/penelusuran mandiri belum | S8 | FIX-04,FIX-10,FIX-17 |
| C03 | Tidak bisa Python/JS/shell/SQL | Tidak ada code executor untuk model; query DB aplikasi bukan tool SQL pengguna | S3,S4 | FIX-09,FIX-17 |
| C04 | Tidak ada kalkulator presisi | Belum tool deterministik khusus | S3 | FIX-15 |
| C05 | Tidak bisa DB/API/Sheets/Notion/Drive/WhatsApp/email | Gateway/model dan SearXNG tersedia, konektor akun umum belum | S7,S8 | FIX-20 |
| C06 | Tidak bisa kirim email/SMS/chat/notifikasi | Email reset pun belum mempunyai sender nyata; media bukan messaging | S11,S4 | FIX-07,FIX-20,FIX-21 |
| C07 | Tidak bisa booking/beli/bayar/form/klik | Belum browser/actions/approval; pembayaran tidak menjadi billing Kawan | S13 | FIX-17,FIX-20 |
| C08 | Tidak bisa alarm/timer/pengingat | Belum schedule persisten dan delivery | S4,S13 | FIX-21 |
| C09 | Tidak bisa tugas berkala | Worker queue ada, scheduler belum | S4 | FIX-21 |
| C10 | Tidak bisa kamera/mikrofon/file/clipboard/printer | Browser sudah memakai file input/clipboard; perangkat lain perlu API/izin, bukan akses otomatis | S1,S14 | FIX-16,FIX-17 |
| C11 | Tidak bisa menghubungkan dua chat | Tidak ada pemilihan riwayat sebagai konteks; impor JSON bukan memori lintas chat | S3,S6 | FIX-13 |
| C12 | Tidak bisa meminta AI lain | Belum sub-agent produk; bukan prasyarat single-orchestrator | S3,S13 | FIX-22 |

## 6. Matriks D — memori dan konteks

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| D01 | Sesi tutup, ingatan hilang | Riwayat DB persisten; memori lintas chat belum. Membuka halaman tidak otomatis melanjutkan stream aktif | S1,S3,S13 | FIX-03,FIX-13 |
| D02 | Tidak menyimpan preferensi jawaban | Preferensi aplikasi ada; gaya jawaban personal belum | S10 | FIX-13,FIX-18 |
| D03 | Tidak belajar permanen dari koreksi | Tidak ada retraining. Koreksi dapat direncanakan sebagai memori eksplisit, bukan perubahan bobot | S3,S13 | FIX-13 |
| D04 | Konteks panjang terpotong | Benar: history budget 120.000 karakter, dokumen 2.000.000 karakter, konteks RAG 24.000 karakter. Bukan token budget per model | S3,S5 | FIX-05,FIX-06 |
| D05 | Tidak bisa lupa selektif dengan pasti | Belum memory delete/dependency invalidation; edit branching mempertahankan versi lama | S3,S13 | FIX-13,FIX-23 |
| D06 | Tidak tahu apa yang sudah dihapus | Tidak ada riwayat penghapusan tersaring untuk model. Data dihapus memang tidak boleh dibaca kembali | S5,S12 | FIX-23 |
| D07 | Tidak bisa akses riwayat lain | Tidak ada tool pencarian chat terpilih untuk model | S2,S3 | FIX-13 |

## 7. Matriks E — persepsi dan input

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| E01 | Tidak bisa lihat gambar | Kondisional: image parts dikirim sebagai `image_url`; tombol muncul bila gateway mengumumkan vision | S1,S3,S7 | FIX-04,FIX-14 |
| E02 | Tidak bisa audio/video | STT/TTS punya jalur kondisional; video/frame/timeline belum | S9 | FIX-16 |
| E03 | Tidak bisa PDF/Word/Excel | PDF teks ada; Word/Excel belum | S5 | FIX-14 |
| E04 | Tidak bisa grafik/tabel dari gambar | Vision mungkin menafsirkan, tetapi ekstraksi angka terstruktur dan validasi belum | S3,S7 | FIX-14,FIX-15 |
| E05 | Tidak mengenali wajah/suara/tulisan tangan | Vision/STT bukan bukti identitas; OCR handwriting dan diarization perlu evaluasi. Identifikasi biometrik bukan default | S7,S9 | FIX-14,FIX-16,FIX-20 |
| E06 | Tidak bisa metadata tanggal/author/EXIF | Metadata dasar upload ada; parser metadata Office/PDF/EXIF belum ada sebagai hasil pengguna | S5 | FIX-14 |
| E07 | Tidak tahu device/OS/browser/lokasi | Browser dapat memberi informasi terbatas; geolokasi perlu izin. Tidak ada tool konteks perangkat untuk model | S1,S3 | FIX-04,FIX-17 |

## 8. Matriks F — verifikasi dan keandalan

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| F01 | Tidak bisa memastikan sitasi nyata | Citation chunk dan source URL ada; belum verifikasi bibliografi/dukungan setiap klaim | S5,S8 | FIX-10,FIX-18 |
| F02 | Tidak bisa cek link hidup/isinya cocok | Belum bounded URL reader/checker | S8 | FIX-10 |
| F03 | Tidak andal memeriksa jawaban sendiri | Risiko: mengulang model bukan pemeriksaan independen | S3 | FIX-15,FIX-18 |
| F04 | Jawaban tidak deterministik | Risiko inheren; seed/temperature bila didukung tidak menjamin determinisme penuh | S3,S7 | FIX-18 |
| F05 | Persentase keyakinan tidak terkalibrasi | Belum eval kalibrasi; jangan menyajikan angka buatan model sebagai probabilitas | S3 | FIX-18 |
| F06 | Halusinasi detail langka | Risiko; butuh retrieval, sumber, abstention dan evaluasi | S3,S5,S8 | FIX-10,FIX-18 |
| F07 | Mengalah saat didesak | Risiko sycophancy; belum suite pasangan pertanyaan netral/menekan | S14 | FIX-18 |
| F08 | Mengarang sumber saat diminta spesifik | Risiko; sumber terstruktur belum menjadi batas hasil model | S5,S8 | FIX-10,FIX-18 |
| F09 | Hitungan/angka/desimal/statistik/jumlah kata tidak presisi | Belum deterministik tool. Definisi kata dan pembulatan juga perlu eksplisit | S3 | FIX-15 |
| F10 | Tidak membedakan tidak ada vs tidak tahu | Risiko klaim cakupan pencarian; belum provenance dan search scope yang jelas | S8 | FIX-10,FIX-18 |
| F11 | Tidak bisa menjadi saksi/dasar keputusan formal | Batas: software tidak menjamin kebenaran profesional atau status saksi | — | FIX-18,FIX-23 |

## 9. Matriks G — pengetahuan

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| G01 | Cutoff tidak diketahui pasti | Discovery model tidak menyimpan cutoff/context window yang terverifikasi | S7 | FIX-04 |
| G02 | Tanggal hari ini tidak andal | Server punya clock; prompt saat ini belum memasukkan konteks tanggal/zona sesi secara eksplisit | S3 | FIX-04 |
| G03 | Peristiwa baru di luar jangkauan | Web kondisional mengurangi batas; freshness dan cakupan belum terlihat | S8 | FIX-10 |
| G04 | Pengetahuan lokal spesifik lemah | Risiko; sumber lokal/unggahan/konektor perlu dibaca dengan waktu dan lokasi yang jelas | S5,S8 | FIX-10,FIX-18,FIX-20 |
| G05 | Bahasa daerah berkualitas rendah | Risiko; i18n UI id/en bukan bukti kualitas model bahasa daerah | S7,S10 | FIX-18 |
| G06 | Topik niche bisa yakin tapi salah | Risiko; verifikasi dan fallback model perlu eval | S3 | FIX-18 |
| G07 | Paywall tidak bisa diakses | Batas akses; gunakan akses resmi/konektor berizin atau unggahan, tanpa bypass | S8 | FIX-10,FIX-20 |
| G08 | Data internal organisasi tidak bisa diakses | Belum konektor; unggahan milik pengguna sudah dapat diambil | S5 | FIX-06,FIX-20 |

## 10. Matriks H — perilaku dan gaya

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| H01 | Jawaban terlalu panjang | Default system prompt ada; belum preferensi verbosity dan eval tugas | S3,S10 | FIX-13,FIX-18 |
| H02 | Basa-basi berlebih | Risiko prompt/model; bisa dikurangi dengan profil dan fixture | S3 | FIX-18 |
| H03 | Terlalu setuju | Risiko; belum eval sycophancy | S14 | FIX-18 |
| H04 | Penolakan berlebihan | Risiko; klasifikasi izin/kapabilitas perlu dibedakan dari larangan | S3,S7 | FIX-04,FIX-18 |
| H05 | Gaya/format tidak selalu konsisten | Risiko untuk prosa; output terstruktur dapat divalidasi server | S3 | FIX-09,FIX-18 |
| H06 | Tidak dijamin netral | Risiko; ukur bias spesifik, tampilkan sumber dan keberatan relevan | S14 | FIX-18 |
| H07 | Persona ketat mudah melenceng | Risiko; preferensi tidak boleh mengalahkan keamanan dan fakta alat | S3 | FIX-13,FIX-18 |

## 11. Matriks I — privasi dan keamanan

| ID | Klaim pengguna | Hasil audit dan batas sebenarnya | Bukti | Perbaikan |
|---|---|---|---|---|
| I01 | Tidak bisa menjaga rahasia; data masuk platform | Terlalu mutlak: API key AES-GCM, password Argon2id. Isi chat/berkas tidak terbukti dienkripsi aplikasi saat tersimpan | S11,S12 | FIX-07,FIX-23 |
| I02 | Jangan memasukkan NIK/password/kartu/data medis/orang lain | Pedoman kehati-hatian, bukan bukti semua input dilarang. Perlu minimisasi, preview pengiriman dan kontrol | S12 | FIX-23 |
| I03 | Tidak bisa verifikasi identitas | Login membuktikan akses akun; bukan identitas legal, email sender/verifikasi pun belum lengkap | S11 | FIX-07,FIX-20 |
| I04 | Tidak bisa janji data tidak disimpan | Benar: aplikasi menyimpan; provider punya kebijakan sendiri. Tidak boleh menjanjikan zero retention tanpa bukti | S12 | FIX-23 |
| I05 | Tidak bisa menghapus data yang dikirim | Hapus lokal ada; penghapusan per pesan/semua derivatif, backup dan provider belum tercakup sebagai satu kontrak | S5,S12 | FIX-13,FIX-23 |
| I06 | Tidak ada jaminan hukum/medis/finansial | Batas; hasil berisiko tinggi perlu rujukan, batas klaim dan review manusia | — | FIX-18,FIX-23 |

## 12. Matriks J — keluhan utama (duplikasi terhubung)

| ID | Keluhan | Rujukan lengkap | Hasil yang dituju |
|---|---|---|---|
| J01 | Internet/harga/berita terbaru | C01–02,G02–04,F01–02 | Search + read + waktu pengambilan + sumber; tanpa klaim realtime palsu |
| J02 | File harus copy-paste | B01–03,B06,B11 | Artefak hasil tugas dengan preview, versi, unduhan |
| J03 | Sitasi harus dicek manual | F01–03,F08 | Pemeriksaan keberadaan dan dukungan kutipan; status gagal/unknown tetap terlihat |
| J04 | Tiap sesi mulai dari nol | D01–07 | History persisten + memori opt-in + pemilihan chat sumber |
| J05 | Judul sidebar berantakan | A01 | Judul otomatis sekali, tidak menimpa manual, sidebar langsung diperbarui |

## 13. Temuan teknis yang harus mendahului fitur baru

Temuan berikut adalah pembacaan kode kecuali dinyatakan tereproduksi. Prioritas
P0/P1 menyatakan urutan pengerjaan, bukan hasil penilaian exploit produksi.

| ID | Prioritas | Temuan dan dampak | Solusi / FIX |
|---|---|---|---|
| T01 | P0 | **Tereproduksi:** `User.connections` didefinisikan dua kali pada schema baris 34/37; `prisma validate` gagal P1012. Typecheck memakai generated client existing sehingga tetap lolos | FIX-01: hapus deklarasi duplikat, validasi/generate fresh; bukan migrasi penghapusan relasi |
| T02 | P0 | Checker membandingkan setiap migrasi ke init; helper tes hanya menerapkan init. Tidak siap additive migration | FIX-01: urutan pasangan migrasi, checksum init, fresh+upgrade populated |
| T03 | P0 | `runGeneration` tidak menerima claim/token lease; mutasi pesan/event/domain tidak difencing. Heartbeat/complete tidak memeriksa expiry | FIX-02: otorisasi lease dalam transaksi domain, expiry ketat, stale worker test |
| T04 | P0 | `fetchJson` membaca `response.text()` penuh; upload route membaca file sebelum size guard domain. DNS diperiksa lalu fetch resolve ulang; ada celah rebinding | FIX-07: batas di ingress dan reader, DNS pin pada koneksi, timeout+cancel |
| T05 | P1 | UI selalu `afterSeq=0`, tidak reconnect/dedup atau resume generasi aktif setelah reload | FIX-03: snapshot+cursor per generasi, tidak POST ulang saat reconnect |
| T06 | P1 | Chat baru hanya mengganti chatId; state pesan/cabang tidak direset pada jalur null. Stream lama tidak mempunyai AbortController yang terkait navigasi | FIX-03: reset state dan abaikan response dari epoch/chat lama |
| T07 | P1 | `isStreaming` baru aktif setelah POST berhasil; UI tidak mengirim `Idempotency-Key`. Digest backend tidak memuat chatId/operasi | FIX-03: guard pending sebelum await, retry key stabil; bind digest ke target+operasi |
| T08 | P1 | Koneksi aktif dan model dibaca saat job dikerjakan, bukan snapshot admission; perubahan koneksi/model bisa mengubah tujuan generasi antrean | FIX-05: pin ID/model/revisi konfigurasi tanpa menyimpan secret di payload |
| T09 | P1 | RAG mengambil semua dokumen user, query hanya pesan terakhir, skor positif sekecil apa pun diterima; fallback gagal diam-diam | FIX-06: manifest dokumen per chat/run, retrieval bounded, note degradasi/provenance |
| T10 | P1 | Upload membuat Document lalu enqueue di luar transaksi; enqueue gagal menghapus file tetapi row bisa tetap ada. Delete file mendahului delete row; kegagalan DB meninggalkan referensi rusak | FIX-06: staging+transaksi enqueue dan lifecycle delete/reconciler |
| T11 | P1 | PDF writer membuat satu halaman, tidak wrap/paginate, mengganti non-Latin-1 dengan `?`. DOCX/XLSX minimal; tes header ZIP bukan bukti fidelity | FIX-12: renderer berformat, Unicode/page layout, reader independen |
| T12 | P1 | Capabilities media ditentukan env, bukan keberhasilan provider. Model baru hardcoded; metadata tool/context/cutoff belum terverifikasi | FIX-04: capability states dan probe yang dibatasi |
| T13 | P1 | `streamGateway` tidak membersihkan seluruh timer pada semua jalur non-2xx/retry/sukses; idle timer tidak dibersihkan pada finally reader | FIX-02: satu try/finally untuk timer/reader/abort listener; uji resource leak |
| T14 | P1 | Status worker disimpulkan dari heartbeat job lama, bukan liveness worker idle; enum job lebih banyak dari handler yang terdaftar | FIX-24: heartbeat proses/readiness dan validasi registry handler |
| T15 | P1 | Reset email hanya penanda konfigurasi; tanpa email link ditulis ke logger yang dapat meredaksi token; origin memakai forwarded host/proto | FIX-07: sender nyata atau jalur operator aman, origin kanonik tervalidasi |
| T16 | P1 | Sumber web berupa snippet; daftar source tidak membuktikan isi URL atau entailment. Tidak ada verifier bibliografi | FIX-10,FIX-18 |
| T17 | P1 | Delete chat/account tidak mengoordinasikan job aktif terlebih dahulu; generation/chat FK tidak menghapus seluruh Job yang hanya berisi payload JSON. Risiko race/residu | FIX-02,FIX-23: tombstone, stop/fencing, cleanup dan provenance |
| T18 | P2 | Export all dan import single-chat mempunyai format berbeda; round-trip seluruh akun belum terpenuhi. Ekspor berbasis teks kehilangan attachment/parts | FIX-23: archive manifest versioned, format dispatch, ekspor derivatif lengkap |
| T19 | P2 | Status dokumen utama tertinggal dari kode; FR file menyebut format/kemampuan renderer lebih luas daripada endpoint nyata | FIX-04,FIX-24: capability inventory dan docs berbasis bukti |

## 14. Bukti pemeriksaan pada baseline

Pemeriksaan berikut dijalankan dalam sesi pendalaman repo pada 21 Oktober 2026,
sebelum penulisan paket dokumentasi ini. Hasil bukan sertifikasi provider live.

| Perintah | Hasil yang diamati |
|---|---|
| `npm test` | 77 file, 775 test lulus; durasi 167,58 detik |
| `npm run typecheck` | Lulus dengan generated client yang tersedia |
| `npm run lint` | Lulus |
| `node scripts/check-migrations.mjs` | Lulus untuk dua salinan init saat ini |
| `python3 tasks/agent-v1/check_docs.py` | Lulus: 13 requirement, 23 WO, 27 acceptance |
| `python3 tasks/nontechnical-v1/tools/check_docs.py` | Lulus, nol pelanggaran |
| `./node_modules/.bin/prisma validate --schema prisma/schema.prisma` | Gagal P1012: field `connections` duplikat pada User |
| Build fresh, migrate populated PostgreSQL, E2E browser, provider live | Belum dijalankan dalam audit ini |

Tidak ada pengukuran keberhasilan tugas dunia nyata, kualitas bahasa daerah,
kalibrasi keyakinan, fidelity dokumen kompleks, atau kapasitas produksi. Angka
tes hijau tidak boleh dipindahkan menjadi klaim semua area A–J selesai.
