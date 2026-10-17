# Instruksi implementasi untuk Claude Code melalui Hermes

Ini brief yang diserahkan Hermes kepada Claude Code. Hermes mengambil repo,
menjalankan/memantau sesi Claude dan memverifikasi hasil. Claude Code menjadi
coordinator implementasi dan memakai sub-agent untuk pekerjaan yang dibatasi.
Pemilik produk sudah meminta seluruh scope inti dikerjakan dan hasilnya dipush.

## Goal dan sumber kebenaran

Baca `tasks/ACTIVE-SCOPE.md`, `tasks/agent-v1/README.md`, seluruh SDD-AG-1..9,
`tasks/agent-v1/STATUS.md`, lalu audit fondasi yang ditautkan. Periksa kode aktual
dan git log/status. Scope selesai: seluruh 23 WO pada AG-P0..AG-P4 dan R-AG-01..13
beserta AC-AG-01..27 lulus. AG-P5+ eksplisit backlog dan bukan janji parity penuh.
Jangan mengimplementasikan arsip full-parity atau mengulang bootstrap yang sudah ada.

Gunakan `/goal` native dengan kondisi di `CLAUDE-GOAL.txt`; pertahankan goal selama
implementasi. Jika goal berhenti karena auth/credit/context/provider/policy, laporkan
penyebab yang nyata dan kebutuhan pemulihan kepada Hermes. Hermes meneruskan sesi
berdasarkan STATUS dan laporan; tidak menafsirkan goal “cleared” sebagai done.

## Langkah kerja

1. Catat baseline SHA dan environment. Jalankan checker dokumen dan gate baseline
   dengan env test/DB terisolasi. Build/test error ditriase code vs environment;
   suite E2E lama yang basi ditutup oleh WO-AG-P0-05, bukan disembunyikan.
2. Buat branch `feat/agent-v1-core` dari main terbaru, atau lanjutkan branch milik
   pekerjaan ini setelah memeriksa commit/status. Pertahankan perubahan manusia.
   Jangan reset/clean/force-push atau mengubah branch yang mempunyai pekerjaan lain.
3. Pilih WO ready paling awal. Bekukan schema/API/event shared sebelum implementasi
   paralel. Untuk tiap WO, nyatakan hasil, dependency, file ownership dan acceptance.
4. Delegasikan ke sub-agent nyata menggunakan kemampuan Agent/subagent Claude Code.
   Gunakan `kawan-backend`, `kawan-frontend` dan `kawan-reviewer` dari repo bila dimuat;
   jika konfigurasi versi lain, sampaikan brief setara melalui subagent tool yang ada.
   Minimum review independen untuk setiap perubahan kontrak/state/keamanan.
5. Jalankan maksimum3 sub-agent aktif bila resource cukup. Worker penulis memakai
   worktree/branch terpisah dari integration SHA yang ditentukan. Cek base commit
   secara nyata: default worktree suatu versi dapat berasal dari default branch,
   bukan HEAD parent. Dependency terbaru harus tersedia sebelum worker mengedit.
6. Shared schema, migration, package/lock, config CI dan shared DTO hanya mempunyai
   satu pemilik. Jangan membagi frontend+backend dengan kontrak berbeda atau dua
   worker mengedit file yang sama. Jika tugas belum bisa diparalel, worker bekerja
   berurutan dan reviewer tetap independen; jangan memalsukan paralelisme.
7. Worker mengembalikan commit SHA, file berubah, acceptance/perintah/exit code,
   serta limitasi. Coordinator membaca diff dan bukti, mengintegrasikan commit,
   memperbaiki konflik/regresi lalu menjalankan gate fase secara terpusat.
8. Perbarui STATUS dan `reports/AG-Pn.md` dengan WO→requirement→AC→bukti→commit.
   Commit kecil dengan daftar path eksplisit. Setelah gate fase lulus, push branch
   kerja ke origin secara normal; worker tidak push atau merge main sendiri.
9. Lanjutkan fase berikutnya tanpa meminta persetujuan ulang hanya untuk pekerjaan
   yang sudah dicakup. Pada blocker eksternal, selesaikan semua WO independen,
   catat kebutuhan spesifik, dan pertahankan status blocker yang jujur.
10. Setelah seluruh core gate lulus, integrasikan ke main sesuai policy repo. Bila
    branch protection mewajibkan PR, buka PR dan laporkan URL/status; jangan bypass.
    Bila main tidak diproteksi, fetch, integrasi perubahan remote dengan menjaga
    hasil, jalankan gate pada hasil integrasi dan push main normal. Buktikan remote
    SHA, CI aktual, clean worktree dan ringkasan rilis. Jangan menyebut rilis live
    jika hanya source GitHub yang dipush.

## Guard implementasi

- BYOK gateway tetap jalur model; koneksi/model run dipin. Tidak mengganti produk
  dengan embed Manus API atau memakai key fiktif.
- Perbaiki source jalur hidup; fixture/test tidak boleh menjadi implementasi produk.
  Kontrol code/browser hanya aktif setelah runtime configured dan gate yang relevan lulus.
- Kode user/model hanya di sandbox provider; tidak di host/worktree/CI atau trusted
  worker melalui shell/eval/subprocess. Dummy site dan canary test harus terisolasi.
- Efek ambigu tidak diulang otomatis. Approval sekali pakai bound ke target/args;
  stale worker tidak menulis setelah lease habis. Owner check pada seluruh child resource.
- Migrasi additive, init tetap, DB pengguna tidak dihapus. Backup/restore diuji pada
  salinan. Commit tidak memasukkan .env, DB, generated output atau trace berisi rahasia.
- Scope enterprise/multi-agent **produk** tetap ditunda; sub-agent **pengembangan**
  wajib sesuai instruksi ini. Kedua hal tersebut berbeda.
- Jangan membeli layanan, membuat akun cloud berbayar, publish/deploy produksi,
  mengirim pesan eksternal atau menghapus data produksi tanpa scope terpisah.
- Jika credential/provider live tidak tersedia, selesaikan kode dan fixture yang
  independen, laporkan blocked_external pada gate live. Jangan melemahkan threat
  model atau menandai AG-P3/AG-P4 done hanya karena mock lulus.

## Bukti minimum penutup

Goal achieved hanya bila semua WO inti done dan seluruh AC wajib lulus dengan
laporan commit terkini, typecheck/lint/unit+integration/build/checkers/E2E,
migrasi fresh+populated SQLite/PostgreSQL, runtime live/browser/code, security,
backup/restore dan benchmark. Canary/provider live dipisahkan dari fixture.
Sertakan SHA push/PR, hasil CI aktual dan backlog AG-P5+. Jika syarat belum terpenuhi,
sebut belum selesai dan sampaikan hambatan; dokumentasi yang rapi bukan bukti aplikasi selesai.
