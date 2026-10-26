# PRD — riset dan hasil yang dapat diperiksa

Status: usulan produk; belum diimplementasikan. Baseline, sumber dan batas bukti: [README](<README.md>). Kontrak: [SDD](<SDD.md>).

## Tujuan dan persona

1. Peneliti/pekerja pengetahuan: membandingkan informasi terkini dari sumber primer; melihat konflik, tanggal dan kutipan, bukan jawaban percaya diri tanpa bukti.
2. Analis operasional/UMKM: mengunggah CSV/JSON/XLSX/PDF, memeriksa struktur, menghitung total/statistik dengan aturan jelas, mengunduh hasil lengkap.
3. Penulis/pelajar: memperoleh Markdown, tabel dan flowchart yang terbaca pada ponsel; menyalin sumber dan menelusuri sitasi.
4. Operator BYOK: membatasi biaya/resource, menghentikan run, mendiagnosis kegagalan tanpa membuka rahasia pengguna.

Hasil utama: tujuan → rencana singkat → pengumpulan bukti/inspeksi → pemeriksaan gap/numerik → jawaban dan artefak yang bisa diperiksa. Pengguna tidak perlu melihat chain-of-thought privat atau terminal internal.

## Requirement stabil

| ID | Prioritas | Kebutuhan dan ukuran berhasil |
|---|---|---|
| R01 | P0 | Task pertama dapat dibuat; submit berulang satu run; stop/reconnect/restart tidak menggandakan kerja atau teks |
| R02 | P0 | Metode riset lima lapisan, ≤3 siklus total, primary reads, gap/conflict/abstention; bukan sekadar prompt panjang |
| R03 | P0 | Batas query/tool/token/byte/waktu/konkurensi ditegakkan server, tahan restart; konfigurasi agent/model dipin |
| R04 | P0 | Upload byte original menjadi Artifact input immutable, picker→artifactIds→binding task/message; lampiran owner-scoped dipersist; inspect CSV/JSON/XLSX/PDF bounded, locator/hash/completeness; file berbahaya ditolak |
| R05 | P0 | Angka dari tool deterministik; unit/null/precision/rounding eksplisit; total tidak berasal dari sampel |
| R06 | P0 | Klaim material terhubung sumber yang dibaca; kutipan dan locator dapat diperiksa; konflik/kekurangan tidak ditutupi |
| R07 | P0 | Tenant isolation, SSRF, injection, XSS, secrets dan resource limits diuji; unknown tools gagal tertutup |
| R08 | P1 | Task/chat memakai renderer Markdown existing; tabel bounded, Mermaid fallback, copy raw, progres faktual, keyboard/mobile |
| R09 | P1 | Artefak penuh tervalidasi, hash/lineage/retensi jelas; MD/CSV/JSON/XLSX dahulu; ekspor tidak menghilangkan konten diam-diam |
| R10 | P1 gated | Python/JavaScript hanya dalam sandbox yang lolos live gate; unavailable tanpa fallback host; approval efek eksternal spesifik |
| R11 | P0 gate | Dataset fixture/model/live terpisah, migration parity dan rollback diuji sebelum klaim rilis |

## Matriks current / target / adopsi

| Fitur | Current teramati | Target | Keputusan |
|---|---|---|---|
| Task durable | API/run/job/event ada; model single pass; UI task pertama terblokir | Lifecycle benar lalu loop | Adapt pola ledger/fencing DSH/ZCode, reuse DB |
| Riset web | Chat satu query, baca dua sumber; task tanpa tools | Batch 2–4 query bila multi-aspek; gap review sampai tiga siklus | Adapt, bukan transplant |
| Lima lapisan | policy/capability/preference/context/untrusted | framing/discovery/extraction/validation/synthesis sebagai metode di bawah hierarchy trust | Usulan untuk pemilik |
| File/data | Extraction/retrieval ada; spreadsheet jadi teks | Inspect terstruktur + aggregate closed | Adapt existing ExcelJS/Decimal |
| Tool registry | Closed registry ada; chat expose file/document saja | Search/read/inspect/compute/aggregate tervalidasi | Adapt schema input/output |
| Context | Budget/truncation prompt ada | Evidence immutable di luar prompt, truncation dan provenance terlihat | Adapt pruning/source refs |
| Markdown/tabel/Mermaid | Chat tersedia, task plain text | Reuse renderer, fallback/preview/copy, source refs | Adopt existing; bukan editor baru |
| Artefak | Storage/hash/expiry/unduh owner ada | Relasi run/step, dataset terpisah DocSchema | Adapt immutable deliverable |
| PDF/PPTX | PDF fidelity terbatas; PPTX renderer tetapi registry hilang | Label batas; perbaikan fidelity gate per format | Defer promosi format sampai gate |
| Sandbox | Kontrak/adapter ada; isolation live belum dibuktikan | Capability gate, corrected invocation, live canary | Defer exposure; adapt lifecycle |
| Multi-agent/plugin/workflow | Sebagian struktur lain sudah ada | Tidak memperluas produk pada irisan ini | Defer fitur baru; jangan hapus existing |
| CLI/shell bebas | Bukan kebutuhan SaaS | Tidak tersedia | Reject runtime CLI/yolo/path host |

## Lima lapisan metode yang direkomendasikan

1. **Framing:** tujuan, periode, satuan, format hasil, ambiguitas yang perlu ditanya.
2. **Discovery:** query berbeda, sumber primer, dedup, strategi URL/file langsung.
3. **Extraction:** baca sumber/file, rekam kutipan/lokasi/hash/coverage; hitung melalui tool.
4. **Validation:** kecukupan bukti, konflik definisi/tanggal/unit, cek numerik dan sitasi.
5. **Synthesis:** jawaban ringkas, tabel/diagram/artefak bila berguna, batas dan langkah berikutnya.

Lapisan dapat muncul dalam tiap siklus; tidak berarti lima panggilan model, lima agent atau lima pencarian. Siklus pertama dihitung; siklus kedua/ketiga hanya untuk gap nyata. Ringkasan metode yang terlihat pengguna adalah aktivitas dan keputusan singkat, bukan reasoning privat.

## Batas scope

Tidak ada engine baru, framework plugin baru, recursive agents, arbitrary MCP install, workflow script generated, shell host, browser automasi baru, OCR, formula engine spreadsheet, BI dashboard, spreadsheet editor, canvas, MDX/live HTML, billing baru atau janji parity Manus. Existing auth/encryption/lease/SSE/fitur yang sudah ada tidak dihapus.

Read-only tanpa konteks privat tidak memerlukan approval per query. Setelah konteks privat masuk, server menolak outbound model-authored kecuali grant user exact per run/penerima/payload yang belum expired/dicabut; consent egress bukan approval sandbox. Upload privat tidak menjadi consent mengirim isi ke search engine atau viewer pihak ketiga. Efek kirim/publish/beli/hapus/ubah akun tetap gated; irisan read-only tidak mengeksposnya.

## Ukuran produk dan batas keberhasilan

Target evaluasi, bukan hasil: ≥90% successful task answerable; ≥95% correct abstention; ≥95% supported-claim precision dan coverage klaim utama. Seluruh pelanggaran keamanan/cap pada suite wajib nol. Laporkan penyebut, worst run, model/provider/prompt version, latency, token dan cost bila diketahui; tidak menjanjikan nol halusinasi atau biaya eksak tanpa tarif provider.

Acceptance mencakup pengguna baru, file gagal, provider tidak mendukung tools, budget habis, sumber konflik, clipboards denied, mobile dan koneksi putus. Definisi lulus serta traceability: [ACCEPTANCE](<ACCEPTANCE.md>). Prioritas dapat direvisi pemilik; keamanan/data-loss/accessibility bukan tradeoff untuk mempercepat rilis.

Klarifikasi read-only mengakhiri run partial dengan pertanyaan; jawaban eksplisit membuat follow-up run baru, tidak membiarkan waiting_input tanpa endpoint. Jika budget/deadline/provider tidak cukup untuk sintesis, tampilkan hasil durable melalui template tanpa model, bukan klaim sintesis lengkap.

## UX minimum

Satu composer tetap sederhana; pilih riset atau file bila diperlukan. Tampilkan fase aktual, siklus n/3 dan alasan berhenti, bukan persentase palsu. Jawaban membedakan selesai, parsial, konflik dan tidak dapat diverifikasi. Tabel menunjukkan jumlah total dan preview; unduhan menunjukkan format/ukuran/expiry. Diagram punya ringkasan tekstual dan sumber; gagal render tetap memberi jawaban teks. Tidak menambah identitas visual tanpa DESIGN.md/brief pemilik.

## Keputusan pemilik

Rekomendasi: read-only + MD/CSV/JSON/XLSX dahulu; sandbox fase berikutnya; PDF/DOCX fidelity satu format per WP; PPTX tetap tidak dipromosikan. Setujui lima lapisan, budget/retensi, biaya live eval serta scope coding secara eksplisit di [DECISIONS](<DECISIONS.md>).
