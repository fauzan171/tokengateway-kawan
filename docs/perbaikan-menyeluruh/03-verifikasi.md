# Penerimaan, pengujian dan bukti selesai

Dasar: [audit](01-audit.md), [24 FIX](02-rencana-implementasi.md).
Seluruh skenario di bawah adalah **target pengujian**, bukan hasil yang sudah lulus.
Bukti baseline 775 test ada pada audit; jangan menyalinnya sebagai bukti fitur baru.

## 1. Aturan bukti

- Reproduksi bug sebelum memperbaiki bila memungkinkan. Tambahkan test pada batas
  perilaku, bukan test yang hanya menyalin implementasi.
- Hasil harus memuat command, waktu, exit code, SHA atau digest diff bila belum
  commit, environment fixture/live, dan artefak log yang telah disaring.
- Setelah kode diperbaiki, ulangi test yang gagal dan regresi terkait. Gate penuh
  diulang pada integrasi fase atau bila perubahan memengaruhi kontrak bersama.
- Test gagal tidak dihapus, ditandai skip, dilonggarkan assertion-nya, atau diubah
  expected output-nya hanya untuk mendapatkan hijau. Perubahan kontrak yang sah
  harus dijelaskan beserta acceptance baru.
- Fixture provider menguji protokol dan kegagalan; bukan bukti model nyata
  mendukung tools/vision/media atau sandbox benar-benar terisolasi.
- Build, migrasi, backup/restore, destructive security tests dan browser dijalankan
  pada worktree/DB/storage/runtime terisolasi. Jangan menggunakan data produksi.
- Jangan memasukkan .env, token, cookie, file privat, trace mentah, prompt pengguna
  atau sandbox viewer URL ke laporan/commit. Logging raw stream Claude juga privat.

## 2. Gate umum per fase

Perintah ini dijalankan dari checkout pengujian yang telah mempunyai env test
nonproduksi; `prisma7.config.ts` dapat memuat `.env` lokal, jadi checkout isolasi
tidak boleh menyalin `.env` pengguna. Siapkan kedua generated client sebelum tsc.

```bash
node --version
npm --version
npm ci
npm run db:generate
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
./node_modules/.bin/prisma validate --schema prisma/schema.sqlite.prisma
node scripts/check-migrations.mjs
python3 tasks/agent-v1/check_docs.py
python3 tasks/nontechnical-v1/tools/check_docs.py
npm run check:licenses
npm run typecheck
npm run lint
npm test
npm run build
```

FIX-01 harus memperbaiki schema sebelum perintah validate/generate dapat lulus.
Gunakan env fixture berisi AUTH_SECRET/ENCRYPTION_SECRET palsu yang valid jika
startup/build memerlukan; jangan mencetak secret aktual. Tidak perlu menambahkan
library test; Vitest/Playwright sudah tersedia. `npm ci` bukan perintah yang
diulang tiap test unit; lakukan saat checkout/dependency berubah.

Setelah gate kode: migrasi fresh dan populated pada SQLite/PostgreSQL, `npm run
test:e2e` dengan DB/storage fixture, lalu smoke live khusus capability yang akan
diaktifkan. Tes desktop/mobile/tablet existing tetap dijalankan; tambahkan viewport
360/1440 sesuai SDD dan pengujian keyboard. Integrasi E2E pada `.next`/DB yang sama
harus serial, bukan dua penulis build bersamaan.

## 3. Skenario wajib per FIX

| ID | Skenario positif | Skenario negatif/race dan bukti |
|---|---|---|
| V01 / FIX-01 | Checkout tanpa generated client; validate/generate/build; fresh+upgrade populated dua provider | Init checksum berubah ditolak; migrasi kedua benar-benar diterapkan helper; semua row/file fixture tetap ada |
| V02 / FIX-02 | Job stream selesai, usage dan terminal event konsisten; stop menyimpan partial | Dua worker, lease expired sebelum heartbeat, late delta, DB gagal saat finalize, stop sebelum dispatch, delete/account disable saat stream; stale writer nol |
| V03 / FIX-03 | Kirim, reload saat streaming, reconnect dari snapshot/cursor, switch cabang/Chat baru/continue berulang | Double click dan retry hanya satu job; same key beda chat/operasi 409; stream lama tidak menulis UI chat lain; draft admission gagal tetap ada |
| V04 / FIX-04 | Model picker sesuai gateway, tanggal/timezone benar, judul otomatis sekali, preferensi sinkron | Rename bersamaan auto-title tetap menang; bahasa en tidak merusak sentinel; model/tools/media unsupported tidak diklaim aktif; cutoff unknown tidak dikarang |
| V05 / FIX-05 | Payload mencakup prompt/memory/RAG/history yang benar dan reserve output; pin model/koneksi | Edit/delete connection saat queued tidak mengubah tujuan diam-diam; oversized input ditangani eksplisit; gambar/tool schema masuk budget; summary branch lama invalid |
| V06 / FIX-06 | Hanya dokumen terpilih dipakai, follow-up menemukan konteks relevan, citation locator cocok | User lain 404; dokumen unready/deleted tidak dipakai; enqueue/DB/storage crash di setiap boundary; `.tmp` orphan dibersihkan tanpa menghapus upload aktif |
| V07 / FIX-07 | Public HTTPS normal, gateway privat hanya exact allowlist, reset satu kali, rotasi key lama+baru | DNS rebinding koneksi nyata, mapped IPv6, redirect internal/lintas origin, chunked oversize, decompression bomb, forged forwarded host/origin, token log, heartbeat rejection |
| V08 / FIX-08 | Task tujuan→run→progres→hasil, tutup tab/reopen, input/wait/resume, follow-up run baru | Dua admission simultan, terminal tidak hidup kembali, cursor pruned snapshot, interaction stale/expired/replay, child resource cross-user |
| V09 / FIX-09 | Model tool call fragmented/Unicode, beberapa langkah nyata, hasil call ID cocok | Unknown tool, JSON parsial/berlebih, argumen terlalu besar, prompt injection, stop/budget/time cap; crash dispatched tidak replay efek unknown |
| V10 / FIX-10 | Search→read→kutipan→bibliografi dengan DOI/metadata benar dan timestamp | DOI fiktif, judul mismatch, link 404/429/paywall/login, halaman bertentangan, injection, klaim tanpa kutipan; bedakan unreachable dari nonexistent |
| V11 / FIX-11 | "Buatkan laporan.csv" menghasilkan kartu, preview dan file yang parser independen buka | MIME/path injection, CSV formula, oversize/quota, owner mismatch, failed staging, retention expired; HTML tidak punya akses cookie origin aplikasi |
| V12 / FIX-12 | PDF multi-halaman Unicode, DOCX heading/list/table, XLSX typed cells, PPTX slides, edit versi dan ganti format | Reader independen, layout overflow/long table/emoji/font missing, formula/external relation, ZIP slip/bomb/duplicate/symlink/nested archive; loss of fidelity terlihat |
| V13 / FIX-13 | "Ingat jawaban singkat" bertahan lintas sesi; user meninjau memori yang dipakai | Mode sementara tidak read/write memory; forget invalidasi summary/vector/cache; konflik koreksi/version; data sensitif tidak autosave; user lain tidak dapat search |
| V14 / FIX-14 | PDF teks/scan, DOCX, XLSX, PPTX, handwriting best-effort, tabel gambar dan metadata | Scan buruk diberi uncertainty; macro/encrypted/file spoof ditolak; parser tidak fetch external reference; EXIF GPS bukan bukti identitas/lokasi |
| V15 / FIX-15 | Desimal, statistik dengan oracle, kata/grapheme sesuai definisi, chart sesuai dataset, QR decode | Division zero/exponent/digit bomb, NaN/Infinity, unit mismatch, missing values, SVG injection, QR payload mismatch; tidak ada eval kode model di host |
| V16 / FIX-16 | Rekam/upload→transkrip editable→chat; TTS cancel; video frame/timestamp; image/video artifact | Permission denied, codec unsupported, provider down, durasi/pixel/quota berlebih; speaker A/B tidak diubah menjadi identitas; URL.createObjectURL dibersihkan |
| V17 / FIX-17 | Code/browser live di runtime terisolasi, browser handover, screenshot, kill, input/output artifact | Host/DB/key canary, metadata/private egress, cross-run filesystem/cookie, CPU/RAM/time bombs, stale viewer token, approval submit, seluruh proses mati saat cancel |
| V18 / FIX-18 | Dataset gaya/sumber/unanswerable/lokal/niche/bahasa daerah, bandingkan config/model | Tekanan agar setuju, sumber palsu, refusal wajar/tidak wajar, format rusak; probabilitas palsu tidak ditampilkan; model judge bukan oracle tunggal |
| V19 / FIX-19 | Rename/pin/folder/settings/share/export dari chat mengubah resource tepat; undo/form accessible | Model memilih ID user lain, stale form revision, share/delete tanpa approval, double submit, raw HTML/JS payload; sukses UI hanya setelah commit |
| V20 / FIX-20 | OAuth scopes/revoke/refresh, read/write connector sesuai izin; approval sekali pakai | state/PKCE/redirect mismatch, token leak, grant revoked, argsDigest berubah, timeout send/pay unknown, repeated callback; legal signature lewat verifier resmi |
| V21 / FIX-21 | Timer/recurrence sesuai timezone, occurrence satu, inbox/push/email sesuai konfigurasi | Restart/dua scheduler/DST/misfire, schedule diedit/dihapus, idle tanpa consent, notification denied, expired approval; outbox dedup dan sensitive preview off |
| V22 / FIX-22 | Review model kedua memberi manfaat terukur dengan source/budget sama | Child melebihi scope/deadline/quota, fan-out tanpa batas, parent cancel, provider fallback tanpa izin; jangan klaim dua model setuju berarti benar |
| V23 / FIX-23 | Export/import archive lengkap; delete data aktif/derivatif/share; restore menerapkan deletion ledger | Delete saat dispatch/stream/convert, backup lama, sumber memory dicabut, connector revocation, offline cleanup gagal; local deletion tidak mengklaim provider deletion |
| V24 / FIX-24 | Readiness/heartbeat worker idle, cleanup schedule nyata, backup/restore dua DB, capability rollout | Worker mati tanpa job terlihat, unknown handler ditolak, stale build/version, storage penuh, runner unavailable; rollback tidak replay eksternal effect |

## 4. Evaluasi kualitas yang terukur

Bangun dataset fixture terkontrol dahulu, bukan pertanyaan privat pengguna.
Minimal awal 20 contoh per kategori penting dan 3 run per konfigurasi untuk melihat
variasi; ukuran ini baseline engineering, bukan bukti generalisasi statistik.
Dataset mencakup Indonesia formal/santai dan bahasa daerah yang memang dipilih
produk; jangan mengklaim mencakup semua bahasa daerah dari beberapa contoh.

| Metrik | Target penerimaan awal | Cara dan batas |
|---|---|---|
| Kebocoran owner/secret, aksi tanpa approval, stale write | 0 dalam suite wajib | Canary dan adversarial integration/live runtime; bukan janji risiko dunia nyata nol |
| Replay lokal dan efek eksternal duplikat fixture | 0 | Hitung request provider/dispatch effect di fixture crash tests |
| Oracle hitungan/serialisasi/QR | 100% fixture valid; invalid ditolak | Decimal expected output, parser/decoder independen |
| File dapat dibuka | 100% corpus format yang dinyatakan didukung | Reader independen; valid container tidak berarti layout bagus |
| Fidelity dokumen | Semua fixture golden wajib tanpa clipping/data hilang | Rendering reader nyata, ekstrak teks dan spot check visual |
| Sumber fiktif/metadata mismatch pada corpus | 100% diberi status bukan verified | Verifikasi existence, metadata, quote, entailment dipisahkan |
| Citation support pada corpus berjawaban | Usulan ≥95%, nol sumber karangan yang diklaim verified | Review manusia/oracle evidence; ukuran corpus dan CI dilaporkan |
| Jawaban unanswerable | Usulan ≥90% tidak mengarang jawaban faktual | Abstention relevan, bukan selalu menolak semua pertanyaan |
| Gaya singkat/format diminta | Usulan ≥90% corpus | Rubrik eksplisit; schema JSON wajib 100% valid atau error jujur |
| Sycophancy/over-refusal | Tidak memburuk dari baseline; target angka setelah baseline | Pasangan pertanyaan netral/menekan, benign/risky; jangan memilih contoh yang hanya menguntungkan |
| Cancel/reconnect/latensi | Ukur p50/p95, tetapkan SLO setelah benchmark | Stop lokal tidak sama dengan stop billing provider; laporkan environment |
| Biaya dan usage | Reported/estimated/unknown selalu terpisah | Catat request/step/token/time/bytes, jangan mengarang saldo/harga |

Threshold kualitas di atas adalah target desain awal, bukan hasil baseline.
Jangan melonggarkannya diam-diam ketika gagal; perbaiki tool/prompt/model atau
nyatakan batas dukungan pada rilis. Untuk klaim probabilitas terkalibrasi perlu
dataset held-out/domain tertentu, scoring/calibration seperti Brier/reliability
curve dan ukuran sampel memadai. Sebelum itu tidak menampilkan confidence persen.

## 5. Fixture dan live gate

Fixture HTTP harus menyimulasikan stream normal/terputus, tool arguments fragmented,
429/5xx ambigu, delayed response, usage missing, stale cursor, MIME palsu dan source
mismatch. Gunakan dummy SMTP/OAuth/payment/browser site, bukan mengirim email,
membeli, atau menyentuh akun nyata untuk tes otomatis.

Live gate membutuhkan konfigurasi operator yang sah: gateway+model yang mendukung
fitur, sandbox/template, OCR binary/font, SMTP, OAuth dan provider media yang relevan.
Catat provider/model/template version, waktu, data dummy, batas biaya/efek yang
diizinkan. Missing credential adalah `blocked_external`, bukan `verified_live`.
Selesaikan implementasi dan fixture independen sambil blocker tetap tercatat.

Browser/code tidak boleh enabled sebelum live isolation gate; konektor write
tidak enabled sebelum approval/revoke/ambiguity gate. Fitur yang optional dan belum
dikonfigurasi tidak menghalangi rilis subset lain, tetapi paket **semua A–J belum
boleh dinyatakan selesai** bila acceptance wajib yang disepakati masih terbuka.

## 6. Format laporan per FIX dan fase

Laporan dibuat pelaksana di `docs/perbaikan-menyeluruh/reports/` ketika implementasi
dimulai. Jangan membuat contoh hasil lulus seolah-olah laporan aktual.

```text
FIX/phase:
Status: planned | in_progress | blocked_external | verified_fixture | verified_live | released
Base SHA / integration SHA atau diff digest:
Owner dan reviewer:
Audit IDs / requirement / WO / acceptance terkait:
Perubahan perilaku dan file:
Schema/API/event contract changes:
Dependency/library/version/license changes:
Reproduksi sebelum fix:
Perintah sesudah fix + exit code + timestamp + fixture/live:
Jumlah test pass/fail/skip dan alasan skip:
Bukti UI/HTTP/security/migration/restore:
Temuan reviewer, tindakan dan hasil retest:
Risiko tersisa dan capability yang tetap disabled:
Blocker eksternal + kebutuhan minimum + pekerjaan independen tersisa:
Rollback/backfill/cleanup:
```

Semua bukti menunjuk integrasi terkini. Hasil test pada branch sub-agent sebelum
merge bukan pengganti test coordinator sesudah integrasi. Hermes memeriksa laporan,
diff, output dan actual process state; kata "selesai" dari Claude bukan satu-satunya
bukti. Protokol lengkap ada pada [prompt Hermes](04-prompt-hermes.md).
