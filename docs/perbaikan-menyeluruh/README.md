# Audit dan rencana perbaikan Kawan A–J

Tanggal: 21 Oktober 2026. Baseline kode: `126502da8f650c81ee26ae3e7a406d13ac8972f8`.
Status paket: **audit kode dan rencana implementasi; belum menjadi bukti fitur selesai**.

Permintaan pemilik: periksa seluruh batasan A–J, jelaskan kekurangan sebenarnya,
susun cara memperbaiki, pilihan teknologi, urutan kerja, dan bukti penerimaannya.
Perubahan dalam paket ini hanya dokumentasi. Tidak memasang dependensi, mengubah
database, menghubungi provider, atau melakukan deployment.

## Urutan baca

1. [Audit A–J dan temuan kode](01-audit.md): status setiap klaim, bukti, dan dampak.
2. [Desain dan rencana implementasi](02-rencana-implementasi.md): keputusan teknologi,
   aliran data, kontrak, work package, dependency, serta rollback.
3. [Penerimaan dan verifikasi](03-verifikasi.md): skenario nyata, metrik, gate rilis,
   dan format laporan hasil.
4. [Prompt utama Hermes](04-prompt-hermes.md): instruksi siap ditempel untuk
   menjalankan/memantau Claude Code sepanjang semua fase, termasuk resume dan fix–test.
5. [Brief Claude Code](05-brief-claude-code.md): prompt implementasi yang dikirim
   Hermes ke Claude, pembagian sub-agent, ownership, gate dan kondisi selesai.

## Handoff eksekusi

Hermes mengelola terminal, proses, sesi, checkpoint dan pemeriksaan bukti. Claude
Code mengoordinasikan kode serta sub-agent backend/frontend/reviewer nyata.
Pemilik telah meminta pola delegasi ini; dokumen tidak menjalankan implementasi
secara otomatis. Prompt baru mencakup semua 24 FIX dan seluruh fase, melampaui
scope prompt handoff lama yang hanya mencakup core agent-v1.

Mulai dengan menempel blok di `04-prompt-hermes.md` ke Hermes. Hermes mengirim
seluruh `05-brief-claude-code.md` ke Claude dari checkout yang mempunyai paket ini.
Jangan mengandalkan clone GitHub sebelum dokumen lokal yang mungkin belum commit
disalin dan diverifikasi. Commit/push/deploy tetap memerlukan instruksi terpisah.

## Kesimpulan utama

Kawan sudah mempunyai fondasi chat, bukan asisten yang dapat mengerjakan seluruh
aksi. Sebagian batasan berasal dari fitur yang belum ada; sebagian dari UI/backend
yang belum tersambung; sebagian dari model/gateway atau izin pengguna. Risiko
halusinasi, bias, nondeterminisme, dan kesalahan keputusan tidak dapat dihapus
dengan janji di system prompt.

Target produk: pengguna dapat memberikan bahan, meminta pekerjaan, melihat bukti
dan progres, mengunduh hasil, serta mengendalikan ingatan dan datanya. Semua
kemampuan harus mengikuti konfigurasi nyata dan hasil pemeriksaan, bukan pengakuan
model tentang dirinya sendiri.

## Hubungan dengan scope yang sudah ada

- [Scope aktif](../../tasks/ACTIVE-SCOPE.md) tetap fondasi arsitektur dan batas keamanan.
- [SDD agen](../../tasks/agent-v1/README.md) tetap kontrak utama task/run/event,
  tool loop, approval, sandbox, dan browser. Jangan membuat engine kedua.
- Paket ini memperluas roadmap sesuai permintaan terbaru: memori, format file,
  verifikasi sumber, media, konektor, penjadwalan, dan kualitas perilaku ikut
  direncanakan. Area yang sebelumnya deferred sekarang mempunyai jalur kerja;
  tidak otomatis menjadi prasyarat rilis pertama.
- ID `FIX-*` adalah unit kerja audit ini, bukan pengganti ID requirement/WO agen.
  Tautan pemetaannya ada pada rencana. Jangan menjalankan prompt arsip Open WebUI.
- Paket ini tidak mengklaim parity Manus atau menyetujui pembelian layanan,
  pengiriman data privat, dan tindakan akun eksternal. Implementasi lokal dan
  pengujian fixture dapat dilaksanakan terpisah dari konfigurasi operator/live gate.

## Tahap hasil pengguna

| Tahap | Hasil yang harus benar-benar dapat dipakai |
|---|---|
| R0 — fondasi | Checkout baru valid, chat tidak tertukar, reconnect aman, worker dan penghapusan konsisten |
| R1 — kemampuan dasar | Model tepat, tanggal/kemampuan jujur, sidebar otomatis, konteks dan dokumen terpilih |
| R2 — bekerja dan menyerahkan hasil | Task/tool loop, baca web, kalkulasi, sumber terverifikasi, artefak unduhan |
| R3 — ingatan dan input lengkap | Memori terkontrol, OCR/Office, audio/video, grafik dan konversi |
| R4 — tindakan dan otomasi | Sandbox/browser aman, konektor, approval, jadwal dan notifikasi |
| R5 — pengerasan berkelanjutan | Eval kualitas, privasi menyeluruh, operasi, biaya dan pemulihan terukur |

Keamanan dasar, aksesibilitas, isolasi pemilik, dan batas sumber daya merupakan
gate setiap tahap. R5 bukan alasan menunda keamanan ke akhir.

## Cara menilai selesai

Setiap FIX harus mempunyai perubahan kode nyata, test perilaku, bukti UI/HTTP bila
relevan, dan hasil gate. Status: `planned`, `in_progress`, `blocked_external`,
`verified_fixture`, `verified_live`, `released`. Semua FIX di paket ini masih
`planned`. Dependency tersedia di kode tidak berarti dependency sudah aman untuk
fitur baru; API dan lisensi versi yang akan dipakai harus diverifikasi saat implementasi.

Batas model yang tidak dapat dihilangkan ditangani dengan verifikasi, fallback,
dan informasi yang jujur. Menandainya "fixed 100%" tidak memenuhi penerimaan.
