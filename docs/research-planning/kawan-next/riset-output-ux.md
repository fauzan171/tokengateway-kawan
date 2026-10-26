# Riset keluaran dan pengalaman chat Kawan

Audit 24 Oktober 2026. Lingkup: bukti kode, sumber primer, rekomendasi SDD; **bukan implementasi/deployment**. Pemilik memilih antislop `during` melalui kapten. Skill core, human, layoutmobile dibaca; konfigurasi global tidak diubah. Tidak ditemukan DESIGN.md proyek; laporan tidak menetapkan identitas visual baru.

## Kesimpulan

Fondasi sudah tersedia: Markdown/GFM, Mermaid, kode dengan copy, KaTeX, ekspor `.md`, Office/PDF, artefak, sitasi dokumen, sumber web, fase progres. Jangan membangun ulang. Fokus: keselamatan, fidelity ekspor, preview data besar, sumber yang dapat diperiksa, fallback, progres berdasarkan kejadian nyata.

P0 = keamanan/kebenaran sebelum perluasan; P1 = pengalaman inti; P2 = setelah kebutuhan terbukti. Batas baru di bawah adalah **usulan**, bukan hasil benchmark. Path bukti relatif root repositori.

## 1. Inventaris existing versus integrasi

| Kemampuan | Bukti existing | Gap / keputusan |
|---|---|---|
| Markdown/GFM | [renderer](<src/components/markdown.tsx#L108-L150>): react-markdown, remark-gfm, tabel/daftar/link; tanpa raw HTML | Pertahankan; jangan ganti MDX/HTML interpreter |
| Tabel Markdown | [table/th/td](<src/components/markdown.tsx#L132-L138>): native table, overflow horizontal | Belum preview terbatas/paginasi/download per tabel; props alignment GFM tidak diteruskan custom th/td |
| Mermaid | [MermaidDiagram](<src/components/markdown.tsx#L26-L62>): dynamic import, strict, SVG, source fallback | **Sudah ada**. Belum copy/download khusus, pemisahan loading/error, retry. Efek tidak mereset failed/SVG ketika source berubah; tema hanya dibaca saat efek berjalan |
| Kode/matematika | [CodeBlock/CopyButton](<src/components/markdown.tsx#L64-L105>): highlight, clipboard status; KaTeX/remark-math | Fenced tanpa bahasa masuk cabang inline karena className dipakai sebagai pembeda; Mermaid melewati CopyButton. Perlu fixture browser |
| Ekspor `.md` | [exportChatMarkdown](<src/lib/chat/transfer.ts#L79-L88>), [menu ekspor](<src/components/chat-sidebar.tsx#L357-L384>) | Datar seluruh pesan menurut seq, bukan cabang aktif; sumber/artefak nonteks tidak dibawa export JSON |
| Artefak download | [kartu](<src/components/chat-view.tsx#L937-L954>), [lifecycle](<src/lib/artifacts/create.ts#L86-L155>), [route](<src/app/api/kawan/v1/artifacts/[artifactId]/route.ts#L24-L43>) | Nama/format/ukuran, ready, expiry, versi tersedia. Preview data belum ditemukan pada kartu |
| Office/PDF | [renderer biner](<src/lib/artifacts/render-binary.ts#L1-L96>): PDFKit/docx/ExcelJS/PptxGenJS; [dependencies](<package.json#L20-L52>) | Jangan tambah library setara. Ekspor chat memakai implementasi terpisah |
| PDF percakapan | [exportChatPdfBytes](<src/lib/chat/document-export.ts#L49-L113>): satu halaman, Latin-1 | Bukan fidelity dokumen panjang: tanpa pagination memadai; non-Latin menjadi `?`. Renderer PDFKit juga mengganti non-Latin; tabel berupa teks berseparator |
| PPTX | [input/render](<src/lib/artifacts/render.ts#L19-L58>) menerima pptx | [registry format/MIME](<src/lib/artifacts/format.ts#L3-L26>) tidak memuat pptx. **Parsial**, jangan iklankan end-to-end |
| Format terstruktur | [DocSchema](<src/lib/artifacts/document.ts#L5-L39>): heading, paragraph, bullets, table, code, pageBreak, divider, image | Versioned; limit 500 blok, 12 kolom, 2.000 baris/tabel, 200.000 karakter total. Bukan dataset penuh |
| Sitasi dokumen | [citation panel](<src/components/chat-view.tsx#L1040-L1082>): chunk, halaman, excerpt expandable | Excerpt muncul pada dua ekspresi panel; belum mapping klaim inline seragam |
| Sumber web | [SourceList](<src/components/source-list.tsx#L8-L27>): judul/URL, external-safe rel | Daftar sumber bukan bukti klaim. Komponen sendiri tidak memvalidasi protokol; upstream mungkin sudah menyaring |
| Progres chat | [fase terakhir](<src/components/chat-view.tsx#L1018-L1035>) dari server | Existing, bukan kosong; belum timeline aktivitas ringkas |
| Progres task | [SSE](<src/components/task-view.tsx#L92-L145>): afterSeq, delta, snapshot terminal, status reconnect | Integrasikan aktivitas terstruktur, jangan log palsu dari narasi model |

## 2. Matriks prioritas

| Prioritas | Paket / nilai pengguna | Minimum integrasi | Acceptance utama |
|---|---|---|---|
| P0 | Keselamatan keluaran | Tanpa raw HTML; URL boundary; Mermaid strict; kebijakan ekspor sel tunggal | Corpus XSS/link/directive/CSV tidak mengeksekusi; unduh lintas pengguna ditolak |
| P0 | Ekspor jujur | Reuse renderer terpasang, nyatakan batas Unicode/tabel; selaraskan registry PPTX sebelum dibuka | Pembaca nyata membuka semua halaman/baris; keterbatasan terlihat |
| P1 | Tabel besar tetap responsif | Native table preview 50 baris/12 kolom, total jelas; CSV/XLSX/JSON artefak existing | 10.000 baris tidak menjadi 10.000 DOM rows; unduhan penuh tidak dipotong diam-diam |
| P1 | Mermaid tangguh | Lifecycle reset, source/diagram toggle, copy source, unduh `.mmd`, error eksplisit | Invalid→valid pulih; partial streaming tidak meninggalkan SVG lama; source disalin persis |
| P1 | Copy/ekspor MD | Salin raw jawaban, unduh satu jawaban; cakupan cabang versus riwayat eksplisit | Fence/tabel/Unicode/sumber bertahan; clipboard failure terjelaskan |
| P1 | Sitasi dapat diperiksa | Source ID stabil, locator/kutipan, status checked/unchecked | Nomor tidak menunjuk sumber palsu; export membawa sumber |
| P1 | Progres aktivitas | Latest phase + native details, stop/reconnect, server authoritative | Replay tidak menggandakan aktivitas; cancel bukan completed; tanpa persen palsu |
| P2 | Preview dokumen | Render DocSchema tervalidasi, bukan HTML model/Office viewer eksternal | Label preview bukan fidelity PDF; tidak mengirim file privat ke pihak ketiga |
| P2 | Eksplorasi dataset | Pagination server; sort/filter bila dibutuhkan | Sorting tipe benar; count benar; null dibedakan |
| Tunda | Spreadsheet editor, BI dashboard, canvas, live HTML/JS | Jangan tambah Monaco/AG Grid/React Flow/MDX | Evaluasi lagi hanya dengan kebutuhan pengguna dan benchmark |

## 3. Kontrak teknis yang diusulkan

### Data dan tabel

Pisahkan dataset/artefak penuh dari ringkasan chat. Envelope minimal: `schemaVersion`, `artifactId`, `title`, `columns[{key,label,type}]`, `previewRows`, `rowCount`, `previewRowCount`, `truncated`, `warnings`, `sourceRefs`. Sel scalar tervalidasi: string/number/boolean/null; bukan HTML/objek arbitrer.

Bedakan **preview dipotong** dan **file dipotong**. Row count berasal eksekusi, bukan model. DocSchema cocok untuk tabel presentasi, bukan sumber dataset tunggal: limit existing dapat memangkas file. Dataset penuh memerlukan pipeline data dengan limit byte eksplisit. [Format](<src/lib/artifacts/format.ts#L3-L6>) membatasi 25 MiB dan 10 artefak/run; [create](<src/lib/artifacts/create.ts#L16-L18>) menetapkan 100/hari dan retensi 7 hari. Jangan menjanjikan unduhan permanen.

Preview awal 50 baris/12 kolom adalah usulan. Kolom lain tetap tersedia melalui detail/paginasi/unduh, bukan dibuang. Null berbeda dari kosong; presisi angka dan ID nol-awal dipertahankan. Pagination dahulu; virtualization dependency hanya setelah pengukuran. Untuk data generated gunakan rows kanonik; jangan parse CSV dengan split koma. Ingestion CSV kontrak terpisah.

### Markdown, kode, diagram

Copy/export mengambil raw source, bukan innerText DOM highlight. Deteksi fenced block lewat struktur pre/code, bukan className bahasa. Copy mendukung tanpa bahasa, `<>&`, Mermaid.

Render Mermaid setelah fence lengkap/stream selesai atau debounce terukur, bukan setiap token. Invalidate SVG lama saat source berubah; ID unik; strict terkunci. Native details untuk source. Loading berbeda dari syntax error; kegagalan diagram tidak menggagalkan jawaban. `.mmd` teks cukup P1; SVG/PNG P2 setelah keamanan teruji. Jangan menjalankan callback click model.

### Artefak dan dokumen

Reuse DocSchema/renderer; validate shape/count/byte/ownership sebelum render. Truncated/unknown blocks tetap terlihat; tidak membuat kartu sukses untuk write gagal. PDF/Office bukan sekadar header valid: butuh pemeriksaan konten pada pembaca aktual. PDFKit tidak otomatis memberikan font Unicode/tagged PDF.

[CSV→MD](<src/lib/artifacts/convert.ts#L121-L124>) kini menghasilkan CSV mentah; perbaiki menjadi GFM benar atau ganti label agar jujur. Konversi balik PDF/DOCX/XLSX sengaja ditolak; jangan dijanjikan. PPTX registry gap merupakan pekerjaan implementasi mendatang, tidak diperbaiki dalam riset ini.

### Aktivitas dan sitasi

Reuse run/phase/SSE. Usulan event: `runId`, `seq`, `activityId`, `kind`, `state`, `label`, `startedAt`, `endedAt?`, `counts?`, `errorCode?`, `artifactIds?`, `sourceIds?`. State queued/running/succeeded/failed/cancelled. Seq server untuk urutan/dedup, snapshot authoritative setelah reconnect. Jangan tampilkan chain-of-thought, secret tool args, stdout mentah.

Adopsi bernilai ala harness: aktivitas dapat diperiksa, file nyata, stop/reconnect, provenance. Tidak perlu multi-agent visualizer, terminal, scheduler, marketplace. Satu percakapan tetap mudah dipahami.

Sitasi web memakai ID resolver, bukan URL/jurnal/tahun karangan model. Locator/kutipan/fetchedAt/status verifikasi bila tersedia. Unchecked bukan verified. Citation dokumen owner-scoped; unduhan kembali mengotorisasi saat diklik; jangan membuat link dari path host model.

## 4. Keamanan

- **XSS:** jangan rehype-raw/MDX/eval/HTML model ke DOM. React Markdown aman default tetapi plugin/custom components dapat mengubah jaminan [S1]. Raw HTML baru memerlukan keputusan dan audit sanitizer terpisah, bukan alasan memasang dependency sekarang.
- **Link:** sumber web HTTP/HTTPS saja; internal relative dibuat aplikasi. Tolak javascript/data/vbscript/file/credential URL pada boundary. Noopener bukan validasi protokol. Test whitespace/case/encoding/redirect; SSRF fetch gate server terpisah. Remote Markdown images dapat melacak/network request: kebijakan pemuatan eksplisit.
- **Mermaid:** strict meng-encode HTML dan menonaktifkan click [S2]. Kunci secure configuration, batasi text/edges; jangan config/themeCSS arbitrer. Default dokumentasi maxTextSize 50.000/maxEdges 500; budget produk setelah pengukuran. Strict bukan jaminan bug/DoS nihil; uji malicious labels/directives versi terpasang.
- **HTML/Office/PDF:** pertahankan attachment, nosniff, no-store, CSP sandbox pada route existing. Tidak preview HTML/SVG aktif di origin aplikasi; tidak viewer pihak ketiga untuk file privat tanpa keputusan privasi.
- **CSV:** [renderer](<src/lib/artifacts/render.ts#L62-L92>) sudah prefix apostrof `=,+,-,@,tab,CR`, trimStart, RFC4180 escaping. Bukan jaminan semua consumer/save-reopen. OWASP mencantumkan LF/full-width dan batas mitigasi [S3]. Audit semua jalur termasuk usage/conversion; jangan mengklaim exploit tanpa uji. CSV untuk spreadsheet boleh mengubah representasi; JSON kanonik untuk mesin. XLSX string bukan objek formula model.
- **Budget:** limit input sebelum render, byte output, waktu, diagram/blok, retensi. Byte check sesudah render saja tidak melindungi memori sebelum render.

## 5. Aksesibilitas/mobile — kontrak, belum lulus visual

Native table memakai caption/judul, th/td, scope arah header; struktur kompleks tidak diratakan tanpa alternatif [S4]. Scroll container berlabel dan dapat difokuskan bila perlu; overflow lokal bukan seluruh halaman. Jangan ARIA grid untuk tabel display biasa.

Diagram memiliki ringkasan teks relasi/cabang penting, accTitle/accDescr [S5], source tetap tersedia. Accessible title saja tidak cukup menjelaskan diagram. Zoom P2 memakai tombol keyboard, bukan drag-only.

Target sentuh produk 44×44 px, focus visible, urutan DOM sesuai baca. Preview/copy/download dapat dipakai Tab–Enter/Space; dialog Escape/focus return. Tooltip bukan satu-satunya label. Progress role=status/aria-live polite dibatasi frekuensi; jangan bacakan setiap token. Jangan autoscroll paksa saat pengguna membaca riwayat.

Uji 320/375 px, tablet/desktop, zoom 200%, terang/gelap, reduced motion, teks panjang. Empty/loading/error jelas. Kontras belum diukur; browser/screenshot belum dijalankan. Delivery Gate visual **belum dieksekusi**, bukan pass. Tidak ada asset/desain baru dibuat.

## 6. Acceptance dan rencana coding setelah persetujuan terpisah

1. Safety corpus: script/onerror, malicious links, Mermaid init/click/oversize, formula/delimiter; tanpa eksekusi/network tak diizinkan. HTTP ownership, expiry, attachment/nosniff.
2. Renderer: fenced tanpa bahasa, highlight, Mermaid loading→valid/error→valid, tema berubah, dua diagram paralel, copy. Browser console/screenshot diperiksa.
3. Data: 10.000×20 fixture, null/multiline/comma/quotes/Unicode/ID nol-awal. Preview terbatas, count benar, file penuh atau warning; bandingkan isi terhadap data kanonik.
4. Ekspor: MD fence/tabel/sumber dan scope cabang. PDF ≥5 halaman, long line, table, non-Latin; DOCX/XLSX dibuka dan konten diperiksa, bukan magic bytes. PPTX ditutup sampai registry/tool/HTTP MIME lengkap.
5. Aktivitas: reconnect/replay/duplicate/out-of-order, worker failure/cancel race; terminal tidak dibalik; secret tidak bocor.
6. Accessibility: keyboard-only, screen-reader table/status, kecil/zoom/tema/kontras, clipboard denied, fallback source diagram.

Urutan minimum: safety+fixtures; perbaiki renderer/ekspor existing; data preview+download; sitasi+aktivitas; preview dokumen lanjut. Reuse React, CSS, native table/details/Clipboard/Blob, Base UI existing untuk dialog. Tanpa dependency baru P0/P1 kecuali kebutuhan nyata disetujui.

## 7. Bukti dan keterbatasan

- Git awal branch `merge/main-into-feat-nt-p1`, direktori state tim untracked. Peneliti tidak mengubah source.
- `npx vitest run src/components/markdown.test.tsx`: **exit 0; 1 file; 7/7 tes pass**, 24 Oktober 2026. Cakupan: inert HTML, external rel, math, SSR fallback Mermaid, copy markup, table wrapper. Bukan seluruh UI/suite.
- Tes Mermaid SSR hanya membuktikan fallback saat effect belum berjalan; bukan browser render/security. Tidak menjalankan full suite/build karena riset dokumen; tidak mengklaim aplikasi lulus.
- Web search backend gagal HTTP 404 (`deepseek-v4-flash`). Direct fetch sumber primer berhasil HTTP 200. GitHub HTML terpotong; README raw dibaca. OWASP redirect diikuti langsung ke domain tujuan.
- Skill Kuli dibaca; tool kuli_work tidak tersedia. Memakai task tim existing, tidak membuat work order lain.

## 8. Sumber primer

Diakses 24 Oktober 2026. Dokumentasi vendor bukan bukti fitur Kawan sudah terintegrasi.

- **S1 [react-markdown README resmi](https://raw.githubusercontent.com/remarkjs/react-markdown/main/readme.md):** GFM plugin, custom components, URL transform, HTML/security; dasar reuse renderer.
- **S2 [Mermaid config schema](https://mermaid.js.org/config/schema-docs/config.html):** strict/sandbox, secure, maxTextSize/maxEdges; tampil versi 12.2.0.
- **S3 [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection):** prefix formula, escaping, consumer trade-off, tidak ada sanitizer universal.
- **S4 [W3C WAI Tables](https://www.w3.org/WAI/tutorials/tables/):** header/caption/scope/relasi sel; struktur dapat hilang ketika konversi.
- **S5 [Mermaid Accessibility](https://mermaid.js.org/config/accessibility.html):** accTitle/accDescr, title/desc, ARIA; bukan otomatis WCAG pass.

Kode lokal dalam inventaris menjadi bukti implementasi; rekomendasi UX/kontrak di atas belum diimplementasi.
