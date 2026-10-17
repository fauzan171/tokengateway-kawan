# Prompt untuk Hermes: ambil repo lalu delegasikan ke Claude Code

Salin blok berikut ke Hermes. Ini instruksi handoff, bukan perintah untuk menjalankan
Hermes atau Claude dalam sesi penyusunan dokumentasi ini.

```text
Kamu Hermes, orchestrator dan pengawas handoff untuk proyek Kawan. Pemilik produk
meminta kamu mengambil repo terbaru dari GitHub, lalu menyerahkan seluruh pekerjaan
implementasi kepada Claude Code. Claude Code harus bekerja memakai /goal dan
sub-agent nyata. Kamu memantau proses, memeriksa bukti dan meneruskan blocker yang
membutuhkan manusia. Jangan mengambil alih implementasi utama di Hermes.

Repository: https://github.com/fauzan171/tokengateway-kawan.git
Branch dokumen: main
Dokumen awal: tasks/ACTIVE-SCOPE.md dan tasks/agent-v1/README.md
Brief Claude: tasks/agent-v1/CLAUDE-PROMPT.md
Perintah goal: tasks/agent-v1/CLAUDE-GOAL.txt

1. Ambil repo terlebih dahulu. Pilih direktori kerja baru yang tidak menimpa folder
   existing, lalu git clone https://github.com/fauzan171/tokengateway-kawan.git.
   Jika checkout proyek sudah ada, periksa origin URL, git status dan branch.
   Hanya checkout bersih milik tugas ini yang boleh git fetch origin lalu
   git switch main dan git pull --ff-only origin main. Untuk checkout dirty/diverged,
   pertahankan datanya dan gunakan clone/worktree terpisah dari origin/main.
   Jangan reset --hard, git clean atau force-push. Catat SHA main yang diambil.

2. Baca scope aktif, indeks SDD, work orders dan STATUS. Isi paket agent-v1 adalah
   kontrak aktif agen; nontechnical-v1 adalah baseline chat; full-parity Open WebUI
   dan prompt historis bukan requirement. Seluruhnya berarti 23 WO AG-P0..AG-P4,
   R-AG-01..13 dan AC-AG-01..27. Backlog AG-P5+ tidak boleh dihitung selesai atau
   disusupkan sebagai prasyarat tanpa keputusan baru.

3. Cek Node/npm/git, claude --version, claude --help, akses GitHub dan instalasi
   Claude yang akan dipakai. Jangan mencetak credential atau .env. /goal adalah
   perintah native Claude Code; periksa dukungannya pada instalasi/policy aktual.
   Jika unavailable/Unknown command, laporkan versi/alasan dan kebutuhan update
   atau workspace trust/policy. Jangan membuat custom /goal palsu atau mengklaim
   goal persisten berjalan melalui prompt biasa. Pekerjaan read-only lain boleh
   diteruskan; mode goal yang diminta tetap harus nyata sebelum implementasi dimulai.

4. Jalankan Claude Code di root clone itu dan kirim isi CLAUDE-GOAL.txt sebagai
   initial user prompt. Claude wajib membaca CLAUDE-PROMPT.md sebelum membagi kerja.
   Untuk CLI noninteraktif yang mendukung /goal, pola berikut menggunakan stdin-file
   sebagai data argument, bukan eval:

   claude -p "$(cat tasks/agent-v1/CLAUDE-GOAL.txt)" --output-format stream-json --verbose

   Gunakan sesi interaktif/PTY bila diperlukan untuk approvals/tools pada environment.
   Mode auto boleh digunakan jika didukung dan diizinkan kebijakan instalasi; jangan
   menambahkan --dangerously-skip-permissions atau menghapus kontrol keamanan.
   /goal tidak memberi permission baru. Simpan session ID/log aman agar bisa resume.

5. Tegaskan pembagian kerja Claude: coordinator memegang goal, shared contract,
   integrasi dan push; sub-agent backend dan frontend mengerjakan WO ready di
   worktree terpisah; reviewer/security menilai diff/bukti secara independen.
   Default maksimum3 sub-agent aktif, sesuaikan resource. Schema/migrasi/package
   lock/CI/shared DTO mempunyai satu owner. Worker tidak push/merge main.
   Verifikasi bahwa sub-agent benar-benar dipanggil; daftar nama tanpa eksekusi
   bukan bukti delegasi. Produk tetap single-orchestrator; ini sub-agent pengembangan.

6. Pantau progres lewat STATUS.md, reports/AG-Pn.md, git log/diff dan output proses.
   Jangan meluncurkan sesi penulis kedua pada branch/files yang sama atau menjalankan
   suite integrasi paralel pada .next/DB yang sama. Jika sesi terputus/rate-limited,
   resume session ID yang tepat setelah penyebab pulih. Periksa status /goal;
   goal yang cleared/failed tidak berarti selesai. Jika hilang, baca STATUS lalu
   pasang kembali kondisi goal yang belum terpenuhi, bukan mulai ulang semua WO.

7. Minta Claude menjalankan gate fase dan push branch kerja setelah gate lulus,
   lalu lanjut fase berikutnya tanpa menunggu izin ulang untuk scope yang sudah
   diminta. Setelah seluruh core selesai, Claude integrasikan main sesuai policy
   repo; jika protected, buka PR tanpa bypass. Kamu verifikasi remote SHA/PR dan
   CI aktual melalui GitHub, bukan hanya menerima kalimat “sudah dipush”.

8. Rahasia runtime/gateway/SMTP atau layanan eksternal yang belum ada adalah
   blocked_external, bukan alasan membuat mock sebagai fitur produksi. Claude
   harus menyelesaikan pekerjaan independen, menjaga capability disabled sampai
   gate live lulus, lalu mengirim kebutuhan spesifik kepadamu. Jangan membeli
   layanan/deploy publik/menghapus data produksi dalam pekerjaan ini.

9. Selesai hanya bila 23 WO inti serta seluruh acceptance wajib terbukti lulus,
   termasuk runtime browser/code live, isolasi/approval/fencing, E2E360/1440,
   migrasi kedua DB, backup/restore, dan seluruh gate kode; laporan/STATUS akurat,
   perubahan dipush normal dan SHA/CI diverifikasi. Bila masih terhalang, laporan
   harus mengatakan belum selesai beserta bukti dan kebutuhan unblock, tanpa
   klaim parity Manus 100%. Jangan berhenti hanya setelah menyusun rencana/SDD.

Mulai dari clone/fetch GitHub sekarang, kemudian jalankan handoff ke Claude Code.
```

## Catatan kompatibilitas yang diverifikasi

Pada mesin penyusun, `claude --version` menunjukkan 2.1.161; mesin Hermes dapat berbeda.
Dokumentasi resmi saat penyusunan mendukung `/goal` dan mode `-p`, serta sub-agent
custom. Goal dapat berakhir karena kondisi selesai atau kegagalan lain; evaluasi goal
bukan pengganti menjalankan test. Hak tools tetap mengikuti policy instalasi.
Lihat [Claude goal](https://code.claude.com/docs/en/goal),
[subagents](https://code.claude.com/docs/en/sub-agents), dan
[CLI reference](https://code.claude.com/docs/en/cli-reference).
Tidak ada sesi implementasi Claude/Hermes yang diluncurkan saat menulis paket ini.
