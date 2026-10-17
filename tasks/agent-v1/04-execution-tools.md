# SDD-AG-4: Eksekusi, tools, lease dan pemulihan

Status: kontrak target orchestrator. Fondasi Job/worker existing dipakai kembali;
logic agent bukan penambahan ke generator chat tunggal tanpa pemisahan service.

## State dan transisi

| Dari | Ke | Pemicu / invariant |
|---|---|---|
| queued | running | Job segment diklaim; model/config/limits/ownership valid; event started commit |
| running | waiting_input | Pertanyaan spesifik diperlukan; interaction input dibuat; runtime dipause/dihentikan |
| running | waiting_approval | Tool berefek menunggu persetujuan; tidak ada aksi sebelum izin consumed |
| running | waiting_input | Handover browser diminta; interaction kind handover; observasi agen dihentikan |
| waiting_input / waiting_approval | queued | Answer sah satu kali, segment bertambah, job baru; bukan reuse lease lama |
| running | completed | Jawaban final + artefak ready + event terminal commit; tidak ada pending tools |
| nonterminal | cancelled | Cancel/reject/expiry; semua eksekutor berhenti terkonfirmasi |
| running / queued | failed | Kegagalan definitif tanpa hasil ambigu; safe code/partial disimpan |
| running / queued / waiting | indeterminate | Request/efek mungkin terjadi atau runtime tidak dapat dipastikan berhenti |

Terminal: completed, failed, cancelled, indeterminate. Tidak ada transisi keluar.
User menekan Coba lagi → run baru dengan input sebelumnya yang dapat ditinjau;
UI mengingatkan kemungkinan efek/biaya ganda untuk run indeterminate. Pertanyaan
lanjutan setelah terminal membuat pesan user + run baru di task yang sama.
Unprompted follow-up saat aktif ditolak409; UI menawarkan stop lalu kirim sebagai
run baru. Input yang diminta agen diisi melalui interaction yang masih pending.

## Loop satu segment

1. Claim Job dan verifikasi payload runId+segment cocok currentJobId. Jika cancel,
   policy berubah atau account disabled, jangan hubungi provider.
2. Ambil snapshot pesan user/final assistant sebelumnya, tools, lampiran siap,
   model/koneksi tetap, limit dan step confirmed. Batasi context; pilih kutipan
   sumber dan ringkasan tersimpan, jangan memotong pasangan tool_call/tool_result.
3. Simpan model TaskStep prepared lalu dispatched dalam transaksi berotorisasi
   lease sebelum request. POST gateway dengan tools JSON Schema dan timeout khusus.
4. Decode stream UTF-8 bertahap, batasi frame/body, coalesce message delta ≤5/detik.
   Tool call argumen terbelah disusun berdasar index dan ID; eksekusi baru dilakukan
   setelah call lengkap. Nama/argumen/schema/call ID diverifikasi, bukan dieksekusi
   sambil streaming JSON yang belum selesai.
5. Simpan model result confirmed dan usage. Jika jawaban final tanpa alat dan
   deliverable valid, terminal completed. Jika perlu input, buat interaction/wait.
6. Untuk setiap tool call, cek registry, permission snapshot, owner/resource IDs,
   limit, target dan effect. Simpan step prepared+digest. Read/local yang diizinkan
   dapat dispatch; write perlu interaction approval. Panggilan awal serial agar
   urutan/biaya dapat dipastikan; parallel call dari model dieksekusi serial.
7. Dispatch setelah intent persisten; hasil tervalidasi disimpan confirmed,
   artefak diregistrasi dan source refs dipertahankan. Tambahkan tool result yang
   dipasangkan call ID ke konteks, lalu ulang langkah2.
8. Jika limit tercapai, simpan jawaban parsial dan terminal failed LIMIT_REACHED.
   Jangan menambahkan loop “ringkasan terakhir” yang melanggar batas. Jika hasil
   eksternal ambigu, terminal indeterminate mengalahkan klasifikasi failed.

Jika tool call invalid: catat hasil terstruktur TOOL_ARGUMENT_INVALID sebagai
result ke model, maksimum2 upaya koreksi per call; tetap menghitung step/token.
Nama alat asing ditolak, tidak diubah jadi shell. Model yang mengabaikan tools
atau gateway yang tidak mendukung menghasilkan capability error yang dapat ditindaklanjuti.

## Registry dan kontrak executor

```typescript
type ToolEffect = 'read'|'local'|'write';
type ToolResult = { status:'ok'|'error'|'indeterminate'; text:string;
  sourceRefs?:{id:string;url?:string;artifactId?:string;locator?:string}[];
  artifactIds?:string[]; errorCode?:string; truncated?:boolean };
type ToolContext = { userId:string; taskId:string; runId:string; stepId:string;
  signal:AbortSignal; deadlineAt:Date; approvedDigest:string|null };
// Registry memasangkan nama/schema/effect, validator dan executor di server.
// Lease context tidak diberikan ke model atau response publik.
```

| Tool | Argumen tervalidasi | Effect / batas |
|---|---|---|
| web.search | `{query:string,maxResults?:number}` query1..500,max1..10 | read; search provider operator saja, sumber judul/URL/kutipan |
| web.read | `{url:string}` | read; egress SSRF, HTML→teks aman, limit2MiB/20.000 karakter |
| file.read | `{artifactId:string,locator?:string}` | read; owner+task binding; locator halaman/range bukan path host |
| artifact.write | `{name:string,mime:string,text:string}` | local; keluaran teks/Markdown/CSV/JSON; validasi size/type lalu atomic finalize |
| browser.navigate | `{url:string}` | read dengan kebijakan jaringan; GET belum otomatis aman pada semua situs, blok pola efek dan minta review bila ragu |
| browser.observe | `{}` | read; snapshot aman tanpa password/cookie/hidden secret |
| browser.act | `{action:'click'\|'fill'\|'scroll',target:string,value?:string}` | write secara default untuk click/fill; scroll read; target dari snapshot terbaru, bukan selector arbitrary akses host |
| code.run | `{language:'python'\|'javascript',code:string,inputArtifactIds?:string[]}` | local dalam sandbox tanpa jaringan; tidak memasang package arbitrary saat run |

Tools browser/code hanya diregistrasi ketika capability server dan gate runtime
lulus. `artifact.write` menyimpan file lokal milik user, bukan publish eksternal.
Kode sandbox tidak diberi network/credential untuk mengubahnya menjadi tool write
tersembunyi. Paket Python/JS bawaan dipin pada template; perubahan template melalui
build operator, bukan perintah model di trusted worker.

## Batas efektif default

| Limit | Default desain | Penegakan |
|---|---|---|
| Run wall-clock | 15 menit | deadlineAt persisten, mencakup waktu tunggu/handovers |
| Langkah model+tool | 40 | Reservasi stepCount sebelum dispatch, maksimum1 call model atau1 tool per step |
| Token provider terlapor | 50.000/run | Akumulasi input+output; cap max_tokens output per request sesuai sisa |
| Output model/request | 4.096 token | Parameter provider bila didukung; batasi byte stream dan abort lokal juga |
| Usage tidak dilaporkan | Input estimate+max output reserve sebelum call | Akumulasi konservatif terpisah dari usage nyata; unknown tidak ditulis nol |
| Run aktif | 1/user,4/global | Admission dan dispatch atomic; job pending tidak berarti slot running |
| Tool read timeout | 20 detik | AbortSignal timeout+cancel+deadline; provider discovery tetap terpisah |
| Model stream timeout | 120 detik total,30 detik idle | Timeout terpisah, bukan batas discovery15 detik |
| Code command | 60 detik | Timeout provider + watchdog; kill seluruh proses runtime bila tidak terkonfirmasi |
| Browser action | 30 detik | Navigation/action timeout + watchdog |
| Interaction | maksimum5 menit atau sisa deadline, mana lebih kecil | Expiry persisten; runtime tidak terus disewa tanpa batas |
| Tool result | 20.000 karakter, attachment melalui Artifact | Truncated flag; tidak memenuhi context tak terbatas |
| File | 25MiB/file;100MiB input/run;10output/run | Byte dihitung server saat ingest/finalize |

Konfigurasi operator boleh menurunkan batas atau menaikkan dalam hard ceiling
teruji (wall≤60menit,step≤200,input≤250MiB). Klien hanya dapat meminta batas lebih
rendah. Token estimasi berfungsi sebagai guard operasional, bukan hitungan tagihan.
Unknown usage atau model tanpa output cap tidak menghilangkan step/byte/time limit.

## Lease, pause dan recovery

Gunakan lease DB existing dengan heartbeat; batas efektif lease awal60detik,
heartbeat10detik, toleransi tidak lebih panjang dari deadline. Fencing berlaku
pada setiap write run/step/event/artifact dan sebelum setiap dispatch.
Helper shared queue heartbeat/start/complete/fail juga harus memeriksa expiry
dan token/state sebelum write. Heartbeat setelah expiresAt gagal walau sweep belum
berjalan; token kedaluwarsa tidak dapat dihidupkan lagi. Reconciler memakai CAS
yang sama dan tidak menutup run segment baru.
Work yang telah kehilangan lease dibatalkan dan tidak boleh memublikasikan hasil.

Tidak menjalankan retry otomatis `agent.run` sesudah dispatched yang belum confirmed.
Reconciler memeriksa run nonterminal dan Job/runtime: definitif belum dispatch
boleh membuat segment baru melalui CAS; ada dispatched/unknown → indeterminate,
simpan partial, tulis terminal event, cabut interaction dan hentikan runtime.
Untuk menghindari klasifikasi palsu, prepared/dispatched harus dicatat sebelum
network effect; tidak ada output bukan bukti request belum sampai provider.

Saat waiting, selesaikan job segment tanpa menandai run completed. Runtime hanya
boleh dipause jika provider mendukung penghentian command/observasi; jika tidak,
hentikan runtime dan buat sesi baru saat jawaban diterima. Step confirmed dibaca
kembali untuk context, bukan dipanggil ulang. Reconciler membedakan waiting dengan
job succeeded dari job mati pada run running.

Cancel segera menyimpan intent+event. Worker mengabort model/tools dan meminta
runtime stop; hasil parsial disimpan. Jika kill tidak terkonfirmasi≤5detik,
mark indeterminate dan enqueue cleanup sampai stop confirmed. Jangan menandai
cancelled sementara kode/browser masih aktif. Cancel ketika queued/waiting aman
diselesaikan transaksi bila tidak ada efek hidup. Approval yang pending menjadi cancelled.

Shutdown worker berhenti claim, abort handler, tandai claim kooperatif maupun yang
melewati grace sebagai indeterminate dengan CAS, lalu rekonsiliasi domain. Timer
force-exit dimulai saat shutdown, tidak saat startup. Akun/koneksi dinonaktifkan
mengikuti jalur cancel yang sama. Tidak ada event baru setelah terminal.


## Pipeline file dan sumber

Input diterima streaming ke staging dengan byte counter+hash dan nama storage acak;
validasi extension/MIME/magic bytes, file size, task/owner dan total manifest. PDF,
UTF-8 plain text/Markdown dan gambar PNG/JPEG/WebP adalah allowlist awal. Gambar
hanya masuk model vision yang capability-nya teruji; batas decoded pixel20MP dan
metadata dibersihkan. Tidak ada archive/Office/password-PDF/OCR wajib di inti;
file tanpa teks yang dapat diekstrak mendapat penjelasan, bukan jawaban palsu.

Ekstraksi PDF berjalan pada parser-worker terbatas dengan timeout30detik,100halaman,
5MiB extracted text dan quota memory512MiB; parser berisiko/native diarahkan ke
runtime terisolasi, bukan request web. Worker tidak mengeksekusi macro/JS/tautan.
Status staging→processing→ready/failed; hasil text+metadata halaman disimpan private
sebagai sidecar dengan checksum asal, cleanup pada gagal. Retry hanya operasi
lokal idempoten dengan output replace atomic; file input immutable.

Keyword retrieval awal memotong teks per halaman/bagian sekitar1000karakter dengan
overlap150, maksimum5000chunk/file, urutan stabil. Normalisasi Unicode, pencarian
kata kunci dan ranking deterministik (term match dengan tie-break halaman/urutan)
memilih maksimum8kutipan dengan total≤16000karakter; filter owner+manifest dilakukan
sebelum ranking. Source ID mengikat artefak/hash/halaman/offset. Tanpa kutipan relevan,
model diberitahu sumber tidak cukup. Sitasi yang dirender harus menunjuk source map
nyata, tidak mempercayai marker buatan model semata. Embedding bukan dependency inti.

Adapter web.search awal memakai SearXNG milik operator: GET `/search` dengan query
`q` dan `format=json`; format JSON harus diaktifkan operator. Adapter memvalidasi
array results, memetakan title/url/content menjadi source records, menghapus duplikat,
membatasi10hasil dan tidak mengirim query ke instance publik hardcoded. Reverse
proxy/auth header operator dikonfigurasi server. URL hasil tetap melewati egress
ketika dibaca, bukan dipercaya karena berasal search engine. Format403, JSONinvalid,
empty dan timeout menjadi safe tool error. Sumber API:
[SearXNG Search API](https://docs.searxng.org/dev/search_api.html).

Finalisasi artefak: tulis temp→validate→rename/move atomic→mark ready+event di DB;
crash di antaranya ditutup reconciler. Jangan menandai ready sebelum file utuh tersedia.
Unduhan selalu melalui owner check; HTML tidak di-inline pada origin Kawan.
