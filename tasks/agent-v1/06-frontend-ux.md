# SDD-AG-6: Frontend dan pengalaman pengguna

Status: kontrak target UI Kawan, bukan salinan aset/piksel Manus. Pengguna utama
nonteknis Indonesia; istilah teknis dijelaskan saat perlu mengambil keputusan.

## Peta layar

| Layar | Isi dan tindakan nyata | State wajib |
|---|---|---|
| Masuk/daftar/akun | Auth existing; logout; nama/sandi; reset terkontrol | Validasi generik, loading, rate limit, sesi dicabut |
| Onboarding/koneksi | Base URL/key, test, model discovery, mask key | URL/key ditolak, timeout, gateway kosong; mode server dijelaskan jujur |
| Beranda | Composer tujuan, pilih Chat atau Tugas, model dari gateway aktif | Belum login, belum punya koneksi, tidak mendukung tools, loading models |
| Chat | Riwayat, pencarian, model, pesan, cabang, edit/regenerate/continue, stop, judul/system prompt | Reload mempertahankan chat/cabang; error provider; empty state |
| Daftar tugas | Terbaru/pencarian/arsip, status, judul, buka/hapus/ekspor | Kosong, loading, pagination, gagal memuat |
| Detail tugas | Input, rencana yang bisa berubah, langkah/timestamps, pesan, sources, artefak | Semua status run dan run historis; resume tab; pending interaction |
| Approval/input | Aksi/tujuan/data, approve/reject atau jawaban, expiry | Pending, expired, already consumed, policy changed; keputusan terlihat |
| Browser | Viewer terotorisasi per run; pause/handover/return | Login rahasia, viewer expired, reconnect, runtime unavailable |
| Hasil/file | Preview aman, nama/type/size, download, sources | Processing, ready, gagal, dihapus, MIME tidak dapat preview |
| Pengaturan | Tema, preferensi kirim/font, akun, koneksi, privasi, usage tanpa billing | Nilai tersimpan; usage unavailable bukan nol |
| Admin minimal | Daftar pengguna/status, aktif/nonaktif/hapus, buka/tutup registrasi, health | Server403 untuk non-admin; admin tidak otomatis dapat membaca isi pengguna |

Riwayat chat, render Markdown aman, lampiran, ekspor/hapus data dan pengaturan
minimum merupakan bagian inti. Folder, template variabel, Mermaid, media dan CSV
usage lanjutan mengikuti defer pada scope, bukan dihapus diam-diam dari baseline.

## State klien dan sinkronisasi

Server otoritas Task/Run/Message/Artifact/Interaction. Klien menyimpan normalized
entities per halaman dan cursor SSE per run. Tidak menyimpan API key, cookie token,
full transcript atau runtime URL permanen di localStorage. Draft teks boleh lokal
per user/task dan dapat dihapus saat logout; jangan menyimpan lampiran rahasia mentah.

Alur load: GET snapshot → render messages/artifacts/status + lastEventSeq → buka SSE
setelah cursor itu. Dedupe berdasarkan (runId,seq); gap yang tidak bisa dipulihkan
→ fetch snapshot ulang. Response/delta late dari run/chat lama tidak menulis layar
baru. Abort controller/EventSource dibersihkan saat unmount/ganti task/logout.

Transport error menampilkan “Menyambungkan kembali”; tidak menyatakan run gagal.
Terminal run dari event/snapshot menutup stream. Poll fallback hanya status/snapshot,
bukan POST ulang. Setelah mutasi409, muat snapshot dan terangkan state terbaru.
Idempotency key dipertahankan selama retry request yang sama; pengguna mengubah isi
berarti request baru. Provider401 tidak mengeluarkan pengguna dari sesi Kawan.

## Perbaikan fondasi yang wajib pertama

- Identitas pesan assistant stabil setelah response server; semua delta memakai
  server ID yang sama, bukan mencari placeholder yang sudah diubah.
- SSE chat existing memiliki bentuk event berbeda dari API task baru; adapter
  terpisah, tidak menebak bahwa response keduanya sama. Resume chat dedup seq nyata.
- Chat baru membuat sesi baru dan membersihkan buffer/stream UI lama; tidak mengubah
  sekadar section. Riwayat dipanggil dari API, tidak hilang saat reload.
- Pemilih model mengambil GET models yang sudah ada; modelRef tersimpan per chat.
  Model hilang menunjukkan peringatan dan meminta pilihan, bukan fallback hardcoded
  yang tidak ada di gateway. Task menyimpan model/koneksi pada run.
- Kontrol edit/regenerate/continue/cabang/judul/system terhubung ke route existing;
  jangan membuat backend baru untuk endpoint yang sudah berfungsi.
- Markdown raw HTML dimatikan atau disanitasi allowlist, link memakai protocol
  aman. Copy code menyalin teks; preview output HTML tidak berbagi origin tepercaya.

## Progres, berhenti dan follow-up

Plan menampilkan daftar judul langkah, bukan reasoning privat atau persen selesai
rekaan. Step pending/running/succeeded/failed dibedakan teks+ikon. Usage hanya
menampilkan token yang dilaporkan, estimate ditandai terpisah. Fitur tanpa
konfigurasi tidak menjadi kontrol aktif kosong; alasan capability dapat ditampilkan.

Stop segera tampil “Menghentikan”; tombol tidak berubah menjadi “Selesai” sebelum
konfirmasi server. Jika indeterminate, tampil hasil parsial dan penjelasan kemungkinan
request/aksi sudah terjadi. Coba lagi membuat run baru setelah pengguna meninjau.
Follow-up disediakan setelah terminal; saat run aktif, pengguna dapat mengisi input
yang diminta atau menghentikan lalu mengirim tujuan baru.

Approval menampilkan tool/tindakan, domain/tujuan, ringkasan data konkret, expiry,
dan tombol Tolak/Setujui. Jangan menyembunyikan detail efek di “Lanjutkan”. Default
keyboard tidak otomatis memilih approve. Sesudah submit, tampil pending sampai
server mengonfirmasi dan larang double-submit; backend tetap CAS.

Handover jelas memperlihatkan agen dijeda dan observasi/log input sensitif berhenti.
Viewer expired meminta URL baru melalui endpoint berotorisasi. Tombol Kembali ke
agen mengonsumsi interaction; model tidak diberi password/OTP sebagai pesan chat.

## Aksesibilitas, mobile dan bahasa

Keyboard Tab/Enter/Escape dapat menjangkau seluruh alur; fokus terlihat dan kembali
ke pemicu dialog. Modal memiliki label, focus trap dan tombol tutup. Status dinamis
aria-live polite tanpa membacakan setiap token. Ikon-only punya accessible name;
composer punya label. Enter kirim, Shift+Enter newline, Enter saat IME tidak kirim.

Uji360px dan1440px, tema light/dark/system, reduced-motion, pesan/code panjang,
sidebar drawer dan keyboard virtual. Tombol utama minimal44×44px; kontras AA;
tidak mengandalkan warna untuk status. Auto-scroll mengikuti hanya bila pengguna
di bawah; pengguna yang membaca pesan lama mendapat indikator pesan baru.

UI default Indonesia, format locale pengguna. Branding `Kawan` dan
`by tokengateway.ai.id` konsisten. Desain memakai shell/token existing, struktur
utama composer → aktivitas → hasil; jangan menambah dashboard/kartu statistik yang
belum punya data. Snapshot visual boleh melengkapi uji perilaku, tidak menggantikannya.
