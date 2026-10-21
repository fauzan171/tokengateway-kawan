# SDD-AG-5: Sandbox, browser, approval dan keamanan

Status: desain target. Memiliki API sandbox tidak membuktikan isolasi deployment.
Gate adversarial pada SDD-AG-9 wajib sebelum fitur code/browser diaktifkan.

## Keputusan runtime dan sumber

Default implementasi adapter adalah E2B managed sandbox, satu runtime per run dan
jenis code/browser bila kebijakan jaringan berbeda. UI inti dapat bekerja tanpa
runtime, tetapi acceptance AG-06/07 tetap belum selesai sampai provider live diuji.
Tidak menggunakan Manus API untuk mengganti orchestrator BYOK.

Dokumentasi E2B menjelaskan sandbox untuk eksekusi alat dan SDK membutuhkan API key;
internet sandbox aktif secara default dan dapat dibatasi. Kawan **memilih** kode
network-off dan browser lewat proxy terkontrol. Ini kebijakan Kawan, bukan klaim
bahwa default vendor sudah memenuhi seluruh threat model.
Sumber: [E2B overview](https://docs.e2b.dev/),
[network policy](https://docs.e2b.dev/network/internet-access),
[lifecycle](https://docs.e2b.dev/sandbox).

Alternatif self-host gVisor/runsc memisahkan application kernel, tetapi resource
limits dan network policy tetap perlu ditegakkan operator di luar sandbox.
Sumber: [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/).
Alternatif ini tidak diwajibkan pada rilis awal; tidak menambah jalur runtime
kedua sebelum adapter pertama lulus. Versi SDK/template dipin di lockfile dan image
manifest saat implementasi; verifikasi API resmi versi yang dipasang.

## Kontrak adapter internal

```typescript
interface SandboxRuntime {
  create(input:{runId:string;kind:'code'|'browser';templateVersion:string;
    expiresAt:Date;networkPolicy:'none'|'browser-proxy';memoryMiB:number;cpu:number},
    signal:AbortSignal):Promise<{sessionId:string}>;
  execute(input:{sessionId:string;stepId:string;language:'python'|'javascript';
    code:string;timeoutMs:number},signal:AbortSignal):Promise<{
      exitCode:number|null;stdout:string;stderr:string;outputFiles:string[]}>;
  putInput(sessionId:string,artifactId:string,bytes:Uint8Array):Promise<void>;
  collectOutput(sessionId:string,relativePath:string):Promise<Uint8Array>;
  stop(sessionId:string):Promise<{confirmed:boolean}>;
  inspect(sessionId:string):Promise<{state:'running'|'paused'|'stopped'|'unknown'}>;
}
```

Browser executor memakai operasi navigate/observe/act melalui channel terotorisasi,
bukan mengekspos endpoint CDP ke internet. Runtime metadata tidak dikembalikan
langsung ke browser pengguna. Adapter tidak menerima executable/path/host mount
arbitrer dari model. Invocation ambiguity mengikuti kontrak step di SDD-AG-4;
ID operasi provider dipakai query status bila tersedia, bukan dianggap idempotency otomatis.

## Isolasi kode

Default profil awal1vCPU,1GiB RAM,workdir sementara maksimum256MiB,command60detik,
run15menit,stdout/stderr masing-masing256KiB. Angka ini limit desain, harus dipetakan
ke fitur provider/template. Jika provider tidak dapat menegakkan limit atau penolakan
jaringan yang diwajibkan, capability code=false dan gate live gagal.

Template immutable berisi interpreter dan paket allowlist yang dipin. Jalankan
user tanpa privilege. Input di `/workspace/input/<opaque-id>` read-only; output
hanya `/workspace/output/`, tidak mengikuti symlink, path traversal, device file,
fifo atau socket. Registry output hasil sandbox tetap tidak tepercaya: validasi
realpath/type/MIME/ukuran/jumlah/hash sebelum menyalin ke store terpercaya.

Tidak ada AUTH_SECRET, ENCRYPTION_SECRET, key gateway/E2B, database URL, socket Docker,
mount home/host, cloud credentials atau metadata endpoint pada environment sandbox.
Control plane E2B key berada di worker terpercaya; bukan environment guest.
Code network-off mencakup IPv4/IPv6 dan akses internal; dependency disediakan saat
build template. Run userA tidak dapat melihat filesystem, memory atau provider handle userB.

## Browser dan network proxy

Satu browser context per run; tidak berbagi cookies/storage/cache lintas pengguna.
Browser memakai template terpisah dari code dan hanya mengakses egress proxy
terpercaya. Semua navigasi, redirect dan subresource melewati policy yang sama:
DNS dipin ke alamat tervalidasi, private/loopback/link-local/multicast/metadata
ditolak pada IPv4/IPv6 termasuk mapped address; port hanya80/443; protocol http/https
sesuai policy. Proxy membatasi ukuran, waktu, metode dan tujuan. Host gateway
privat dalam allowlist model tidak otomatis diizinkan untuk browser/model-supplied URL.

Blok jalur bypass: direct socket, QUIC/HTTP3, WebRTC, WebSocket ke tujuan tak diizinkan,
service worker, DNS kustom dan akses proxy admin. Konfigurasikan lewat firewall/runtime,
bukan argumen browser saja. Proxy tidak membolehkan CONNECT ke IP privat dan
memvalidasi tujuan setelah setiap DNS/redirect; periksa DNS rebinding pada koneksi nyata.

Jangan menganggap HTTP GET selalu tidak berefek. Form submit, upload data, login,
klik yang dapat mengirim/publish/membeli/menghapus dan perubahan akun adalah write.
Aksi yang tidak dapat diklasifikasi aman memerlukan approval. Default read-only
menolak endpoint perubahan; model/tool tidak dapat memperluas daftar izin sendiri.

Persetujuan gesture klik/fill tidak mengizinkan request bebas yang dipancarkan
JavaScript halaman. Browser controller/proxy wajib intercept setiap request yang
berpotensi berefek (termasuk fetch/beacon/background, redirect yang mengubah target,
form, WebSocket dan GET dengan pola perubahan). Default deny. Review mengikat
method, URL kanonik, body digest, target origin dan ringkasan data konkret, bersama
run/step/policy revision. Satu approval mengizinkan satu dispatch request yang cocok;
request tambahan memerlukan approval baru atau tetap diblokir.

Local gesture boleh dipersiapkan di runtime dengan outbound effect tertahan untuk
menghasilkan preview request; ini belum memberi izin mengirim data. Executor memakai
hasil internal `awaitInteraction` untuk berhenti segment tanpa memberikan tool result
sukses ke model. Context/request yang ditahan dipause sampai decision+expiry; setelah
resume, adapter memeriksa request digest yang sama sebelum melepaskan request sekali.
Jika request tidak dapat dipertahankan/diverifikasi atau situs mengharuskan broad
network exemption, blok aksi efeknya dan jelaskan keterbatasan. Jangan mengulang
klik/form yang hasilnya ambigu untuk membuat preview baru. Navigasi read juga tidak
mengizinkan script page-load melakukan write yang belum disetujui.

Pada handover manusia, actor adalah pengguna yang terautentikasi dan memilih scope
origin/action viewer secara eksplisit; agen/observasi tetap pause. Izin actor user
tersebut tidak diwariskan menjadi izin agent setelah return. Tidak ada request
tersembunyi agen yang menumpang sesi handover.

Screenshot/DOM hanya diambil di halaman non-sensitif. Masuk akun menggunakan
interaction handover: agen pause, stream screenshot/DOM dan input logging dihentikan,
viewer khusus pengguna mengambil alih. Setelah pengguna return, state sensitif
(password field, OTP, cookies, auth headers, storage token) tetap tidak disertakan
ke model/observability. Jika viewer/provider tidak dapat memenuhi ini, login handover
live dinyatakan belum tersedia; jangan melabel screenshot penuh sebagai aman.

Context/session habis saat run terminal, akun/koneksi dicabut, atau deadline lewat.
Sesi yang gagal stop menjadi indeterminate dan dibersihkan watchdog dengan alert.
Tidak mengaktifkan public remote debugging port atau screenshot URL permanen.

## Approval server

Approval bukan “boleh lakukan apa saja”. TaskInteraction memuat tool, step, target,
ringkasan data yang akan dikirim, digest canonical, policyRevision dan expiry.
User melihat data/tujuan nyata sebelum approve. Server memverifikasi ulang ownership,
argsDigest, latest target snapshot serta request method/URL/body digest untuk browser,
policy, run nonterminal, expiry dan pending status.

Consume approval dan persiapan resume segment commit atomik; executor selanjutnya
hanya menggunakan args yang disetujui dari step persisten. Tidak ada interval untuk
model mengganti argumen setelah approval. Reject/cancel/expiry menutup interaction;
request replay tidak memanggil tool kedua kali. Approval dari run lain atau setelah
redirect yang mengubah tujuan tidak berlaku; buat review baru.

Input web/dokumen/tool diperlakukan sebagai data bersumber. Pernyataan “abaikan
instruksi”, “unggah key” atau “sudah disetujui pengguna” dalam sumber tidak mengubah
policy. Secret broker hanya menyuntikkan rahasia ke adapter terpercaya dengan scope
tertentu; v1 tanpa konektor tidak memberikan general credential tool ke model.

## Ancaman dan pembuktian

| Ancaman | Kendali wajib | Bukti minimum |
|---|---|---|
| SSRF / DNS rebinding / redirect | Pin DNS ke koneksi; proxy semua subresource; blok network bypass | Server target forbidden tidak pernah menerima request, bukan sekadar fungsi validator melempar |
| Escaping kode / cross-run file | Runtime terisolasi, tanpa host mount, user nonprivileged | Canary host/DB/env dan file run lain tidak dapat diakses |
| XSS/HTML output | Markdown raw HTML off/sanitized; output HTML terisolasi | Script/event handler/javascript URL tidak jalan di origin Kawan |
| Prompt injection | Policy server + tool allowlist + approval bound | Dokumen adversarial tidak menyebabkan dispatch berizin tambahan atau eksfiltrasi |
| Izin basi/replay | CAS + digest + expiry + policyRevision | Dua approval bersamaan menghasilkan satu dispatch; argumen berubah ditolak |
| Resource exhaustion | Limit time/memory/CPU/PID/bytes + cleanup | Infinite loop/fork/output besar berhenti; runtime tidak tertinggal |
| Log/ekspor bocor | DTO allowlist, redaksi terpusat, log metadata | Canary secret/prompt/password tidak muncul pada public response/log/export |
| Proxy header poisoning | Origin kanonik, trusted proxy config | Host/forwarded host buatan tidak mengubah reset link/origin/CSRF decision |

Reset password inti harus punya delivery yang nyata dan tidak menulis bearer token
ke log umum. Mode tanpa email menggunakan workflow operator terautentikasi atau
reset CLI lokal terkontrol, dengan token sekali tampil kepada operator yang berwenang;
UI tidak menjanjikan email terkirim. Jangan menambahkan endpoint publik untuk membaca token.
Pencabutan akun memutus admission, sesi, SSE, approval dan runtime terkait.
