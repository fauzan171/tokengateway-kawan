# FIX-17 — Sandbox, browser, screen sharing, akses perangkat

Status: **verified_fixture** (gate live `blocked_external`)

## Masalah

Tidak ada satu pun jalur eksekusi kode atau browser di Kawan, dan tidak ada
kontrak yang mencegah jalur seperti itu dibangun dengan asumsi yang salah:
"env terisi berarti sandbox siap", "GET tidak berefek", atau "stop() dipanggil
berarti prosesnya mati". Ketiganya adalah cara isolasi gagal tanpa terlihat.

Selain itu belum ada aturan untuk akses perangkat (mikrofon, kamera, layar,
lokasi, clipboard): apa yang boleh diminta, kapan, dan apa yang terjadi bila
ditolak.

## Solusi

### `src/lib/sandbox/contract.ts` — kontrak, batas, klasifikasi

`SandboxRuntime` (create/execute/putInput/collectOutput/stop/inspect) sesuai
SDD-AG-5. Limit adalah konstanta: 1 vCPU, 1 GiB, workdir 256 MiB, 60 detik per
perintah, 15 menit per run, stdout/stderr 256 KiB, 10 output/25 MiB.

Tiga fungsi murni yang menegakkan aturan sulit:

| Fungsi | Aturan |
|---|---|
| `truncateOutput` | memotong di batas karakter UTF-8, tidak menghasilkan `\ufffd` |
| `assertSafeOutputPath` | hanya `output/`, menolak `..`, absolut, NUL, `input/` |
| `classifyBrowserAction` | konservatif: apa pun yang tidak jelas read = write |
| `approvalDigest` | mengikat run/step/method/URL kanonik/body/revisi kebijakan |

`classifyBrowserAction` memperlakukan sebagai **write**: method selain
GET/HEAD, body tidak kosong, gesture `click`/`fill`/`submit`/`upload`/…, dan
GET yang path **atau query**-nya memuat pola perubahan (`delete`, `publish`,
`checkout`, `logout`, `send`, `submit`, …). URL relatif tidak menjatuhkan
klasifikasi — diperiksa sebagai string.

`approvalDigest` menormalkan URL (query diurutkan, fragment dibuang) sehingga
approval tetap sah untuk request yang sama dan **batal** begitu method, target,
body, step, run, atau revisi kebijakan berubah.

### `src/lib/sandbox/e2b.ts` — adapter E2B

`readSandboxConfig()` mengembalikan `null` bila `E2B_API_KEY` **atau** salah
satu template belum diisi — konfigurasi setengah jadi bukan konfigurasi.
`createSandboxRuntime()` melempar `SandboxUnavailable` bila tidak lengkap; tidak
ada fallback diam-diam ke eksekusi di proses web.

Semua panggilan lewat `fetchOutbound` (kebijakan egress FIX-07). Guest tidak
menerima env apa pun (`envs: {}`) — tidak ada kunci gateway/DB/AUTH di sandbox.
Nama berkas input memakai id opaque yang dibersihkan, bukan nama dari pengguna.

`stop()` mengembalikan `confirmed: false` bila provider tidak menjawab atau
status setelah penghapusan bukan `stopped`. Kegagalan menghubungi provider saat
stop **tidak pernah** dilaporkan sebagai berhasil.

### `src/lib/sandbox/device.ts` — akses perangkat

`DEVICE_PLANS` mewajibkan setiap izin punya `reason` dan `fallback`. Penolakan
izin karena itu bukan jalan buntu: mikrofon → unggah audio, kamera → unggah
gambar, layar → unggah tangkapan layar, lokasi → tulis manual, clipboard →
salin manual, notifikasi → badge dalam aplikasi.

`isDeviceSupported()` memisahkan **tidak didukung** dari **ditolak** — fallback
keduanya berbeda. `coarsenLocation()` membuang koordinat: pembulatan pun masih
mengidentifikasi rumah. `minimalUserAgent()` hanya keluarga browser, tanpa versi
dan OS. `SCREEN_SHARE_LIMITS`: 1920×1080, 5 fps, 300 detik — berbagi layar bukan
perekam video.

### Capability

`codeExecution` dan `browser` ditambahkan ke `GET /capabilities` dengan
`requiresApproval: true`. Aturannya: tanpa kunci+template → `unconfigured`;
dengan kunci+template tetapi tanpa probe → **`unknown`**, bukan `available`.
Memiliki kunci bukan bukti isolasi bekerja, jadi tidak ada jalur dari env ke
`available`.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/sandbox/contract.ts` | **baru** — kontrak, limit, klasifikasi, digest |
| `src/lib/sandbox/e2b.ts` | **baru** — adapter E2B + probe config |
| `src/lib/sandbox/device.ts` | **baru** — rencana izin, redaksi lokasi/UA |
| `src/lib/sandbox/sandbox.test.ts` | **baru** — 19 tes |
| `src/app/api/kawan/v1/capabilities/route.ts` | `codeExecution`, `browser`, `sandboxCapability()` |

Tidak ada perubahan skema → tidak ada migrasi. Tidak ada dependensi baru.

## Tes (19 baru)

- **Limit** sesuai SDD-AG-5 (1 vCPU, 1 GiB, 15 menit).
- **truncateOutput**: 5 byte pada `"aaaaéé…"` → `"aaaa"`, tanpa `\ufffd`.
- **assertSafeOutputPath**: menerima `output/…`; menolak `../`, absolut,
  `input/`, NUL.
- **classifyBrowserAction**: GET biasa → read; GET `?delete=1`/`/publish`/
  `/checkout`/`/logout` → write; POST/body/gesture → write; URL relatif aman.
- **approvalDigest**: deterministik, tidak terpengaruh urutan query; berubah bila
  body/method/URL/revisi/step berubah.
- **Konfigurasi**: tanpa kunci → null; setengah lengkap → null; lengkap → objek;
  `createSandboxRuntime(null)` → `SANDBOX_NOT_CONFIGURED`.
- **Perangkat**: setiap izin punya alasan+fallback; dukungan API ≠ izin;
  geolokasi hanya kota/negara; UA minimum; batas layar wajar.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npx eslint src/lib/sandbox           → 0 error, 0 warning
npx vitest run src/lib/sandbox       → 19 passed
```

## Batas yang sengaja dilewati

- **Gate live belum dijalankan** (`blocked_external`): tidak ada `E2B_API_KEY`
  maupun template di mesin ini. Semua uji isolasi SDD-AG-9 (canary host/DB/kunci,
  egress privat, cross-run filesystem/cookie, CPU/RAM/time bomb, stale viewer
  token, approval submit, kill seluruh proses) **belum** dijalankan. Karena itu
  capability berhenti di `unknown`, bukan `available`.
- **Adapter ditulis terhadap API E2B dari SDD**, belum diverifikasi ke dokumentasi
  versi terpasang. Versi SDK/template wajib dipin saat provider tersedia.
- **Browser executor (navigate/observe/act) belum diimplementasikan.** Yang ada
  baru kontrak + klasifikasi aksi + digest approval; handover login, screenshot,
  dan viewer token butuh provider live.
- **UI perangkat belum ada.** Modul ini menyediakan rencana izin + batas; komponen
  yang memanggil `getUserMedia`/`getDisplayMedia` menyusul bersama FIX-19/20.
- **Tidak ada klaim mengontrol printer/filesystem.** Itu butuh aplikasi native.
