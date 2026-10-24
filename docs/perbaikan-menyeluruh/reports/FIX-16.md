# FIX-16 — Audio, video, dan perangkat input

Status: **verified**

## Masalah

Tiga bug nyata dan satu klaim yang tidak boleh dibuat:

1. **Capability gating media salah.** `GET /capabilities` mencari
   `capabilities.audio === true` pada SELURUH daftar model chat. Model media
   (`whisper-1`, `tts-1`) hampir tidak pernah ada di daftar itu, jadi STT/TTS
   yang sudah dikonfigurasi tampil `unsupported` — tombolnya hilang padahal
   fiturnya hidup.
2. **STT hanya mengembalikan teks.** Tidak ada timestamp, sehingga transkrip
   tidak bisa dirujuk ke detik tertentu dan tidak bisa disunting per bagian.
3. **Hasil image generation dikembalikan sebagai data URL base64** dan
   disimpan apa adanya di `contentJson`. Satu gambar 8 MB menjadi ~11 MB teks
   yang menetap selamanya di riwayat; retention/kuota artefak tidak berlaku.
4. **Tidak ada jalur rekam mikrofon** sama sekali: hanya unggah berkas.
5. **TTS tidak dapat dibatalkan** dengan benar. `URL.revokeObjectURL` hanya
   dipanggil pada `onended`; pemutaran yang dihentikan pengguna membocorkan blob.
6. **Video tidak ditangani**, dan label "diarization" tidak ada — sehingga
   tidak ada batas yang mencegah klaim "sudah menonton semua frame" atau
   "pembicara itu Budi".

## Solusi

### `src/lib/media/format.ts` — kontainer dari byte

`detectContainer()` membaca magic bytes: ISO-BMFF `ftyp` (mp4/m4a/mov), EBML
(webm), `OggS`, `RIFF…WAVE`, `#!AMR`, `ID3`/`FF Ex` (mp3). Label klien tidak
dipakai: berkas `.mp4` berisi WebM tetap terdeteksi benar. Format di luar daftar
→ `unknown` → route menjawab `UNSUPPORTED_CODEC` (415), bukan dikirim ke gateway
sebagai tebakan. Batas: audio 25 MB, video 100 MB.

### `src/lib/media/audio.ts` — STT bertimestamp + diarization label

`transcribeAudio()` meminta `response_format=verbose_json` dan
`timestamp_granularities[]=segment`. `parseTranscript()` menghasilkan
`{text, segments[], language?, durationSeconds?, truncated}`.

- Segmen cacat (start/end bukan angka ≥ 0, teks kosong) **dibuang satu per
  satu**, bukan menggagalkan seluruh transkrip.
- Gateway yang tidak mendukung timestamp → `segments: []`; tidak ada timestamp
  karangan.
- `labelSpeakers()` memetakan id pembicara apa pun ke `A`/`B`/`C`… menurut
  kemunculan pertama. **Tidak ada** pencocokan nama/identitas: diarization =
  label, bukan identitas.
- Batas 2.000 segmen; kelebihannya dilaporkan lewat `truncated: true`.

Transkrip masuk ke composer sebagai **draft yang dapat disunting** — pengguna
melihat dan mengubahnya sebelum mengirim, bukan langsung terkirim.

### `src/lib/media/images.ts` + artefak — hasil gambar jadi Artifact

`generateImage()` sekarang mengembalikan `{ mime, bytes }`. Jenis gambar
ditentukan dari magic bytes (`imageMimeFromBytes`), bukan dari header gateway
yang bisa berbohong; byte non-gambar → `IMAGE_FORMAT_UNSUPPORTED`.

Route `POST /api/kawan/v1/media/images` menyimpan byte sebagai `Artifact`
(format `png`, retention 7 hari, kuota 100/24 jam, owner-check yang sudah ada)
dan mengembalikan metadata + `downloadUrl`. Riwayat percakapan menyimpan
`{ kind: "image", mime, artifactId }` — **bukan** base64.

`readArtifactForModel()` membaca byte kembali saat membangun riwayat untuk
gateway; artefak hilang/kedaluwarsa **dilewati** (generasi tidak gagal karena
satu gambar lama kedaluwarsa). Lampiran dari klien ber-`artifactId` diverifikasi
kepemilikannya di dalam transaksi `sendMessage` — bukan TOCTOU.

### `src/components/media-controls.tsx` — rekam setelah izin

`useRecordingSupported()` mendeteksi `MediaRecorder` + `getUserMedia` setelah
mount. Bila ada, tombol rekam muncul dan **izin baru diminta setelah klik**
(`startRecording`). Batas 60 detik; `onstop` membentuk `File` lalu meneruskannya
ke `onTranscribe`. Bila API tidak ada, tombol unggah yang dirender. Penolakan
izin → jatuh ke dialog unggah, bukan jalan buntu.

### TTS — cancel/revoke

`chat-view.tsx` melacak `speechUrlRef`/`speechAudioRef`; `stopSpeech()` mencabut
URL objek, menghentikan audio, dan mengembalikan status. Tombol berubah menjadi
"Hentikan pembacaan" selama diputar (`media.speakCancel`).

### `src/lib/media/video.ts` — video jujur

`ffprobe` (JSON) → `parseProbeJson` → `planFrameTimestamps` → `extractFrame`
per timestamp → `extractAudio` → STT. Semua lewat `spawn` proses terpisah,
tanpa path host (input dari stdin).

| Batas | Nilai |
|---|---|
| Durasi diproses | 600 detik pertama (`truncatedDuration`) |
| Sampling | 1 frame / 5 detik |
| Jumlah frame | maksimum 120 |
| Piksel | ≤ 1280×720 (aspect dijaga) |
| Ukuran berkas | 100 MB |
| Timeout proses | 120 detik |
| Audio untuk STT | 25 MB |

`coverageText()` **wajib** menyebut: jumlah frame yang diambil, estimasi total,
pemotongan durasi, frame yang gagal, dan kalimat "frame di antaranya TIDAK
diperiksa". Tidak ada API yang bisa mengklaim telah menonton seluruh frame.

Tanpa ffprobe/ffmpeg → `VideoUnavailable("ENGINE_MISSING")` → HTTP 503. Tidak
ada video kosong yang dianggap berhasil.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/media/format.ts` | **baru** — deteksi kontainer + batas |
| `src/lib/media/video.ts` | **baru** — probe, sampling, audio, coverage |
| `src/lib/media/audio.ts` | STT bertimestamp, label speaker, parse defensif |
| `src/lib/media/images.ts` | hasil byte + mime dari magic bytes |
| `src/app/api/kawan/v1/media/video/route.ts` | **baru** — `POST` analisis video |
| `src/app/api/kawan/v1/media/images/route.ts` | simpan Artifact, balas metadata |
| `src/app/api/kawan/v1/media/transcribe/route.ts` | magic bytes + kode error eksplisit |
| `src/app/api/kawan/v1/capabilities/route.ts` | `mediaCapability()` per model media |
| `src/lib/artifacts/format.ts` | format `png` |
| `src/lib/artifacts/render.ts` | varian `{format:"png", bytes}` |
| `src/lib/artifacts/create.ts` | `readArtifactForModel()` |
| `src/lib/chat/content.ts` | `ImagePart.artifactId` |
| `src/lib/chat/attachments.ts` | terima `artifactId` tervalidasi bentuk |
| `src/lib/chat/messages.ts` | cek kepemilikan artefak + simpan rujukan |
| `src/lib/chat/generate.ts` | `buildMessages` async, resolve artefak |
| `src/components/media-controls.tsx` | rekam/berhenti + fallback unggah |
| `src/components/chat-view.tsx` | artefak gambar, cancel TTS |
| `src/lib/i18n/messages.ts` | 4 kunci baru (id + en) |

Tidak ada perubahan skema Prisma → tidak ada migrasi.

## Tes (16 baru + 1 diperbarui)

`src/lib/media/media.test.ts`:

- **Kontainer**: mp4 video, m4a audio-only, wav, mp3, ogg, amr; sampah →
  `unknown`; batas video > batas audio.
- **Timestamp**: tiga segmen → label A/B/A (pembicara sama tetap sama);
  entri negatif/NaN/kosong dibuang satu per satu; payload asing → kosong.
- **Label speaker**: `null`/`""` → tanpa label, `0` adalah id sah → `A`.
- **ffprobe**: metadata terbaca; tanpa aliran video → `UNSUPPORTED`; JSON rusak
  → `ENGINE_FAILED`.
- **Sampling**: 30 detik → 6 timestamp; 3 jam → ≤ 120 dan < 600 detik; durasi 0
  → kosong.
- **Coverage**: memuat jumlah frame dan kalimat "TIDAK diperiksa".
- **Gambar**: b64 → byte PNG (tanpa `dataUrl`); header berbohong tetap PNG;
  byte non-gambar → `IMAGE_FORMAT_UNSUPPORTED`; b64 kosong → `IMAGE_FAILED`;
  tanpa env → 409 tanpa fetch; prompt kosong → 400 tanpa fetch; pesan galat
  tidak memuat apiKey/baseUrl.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npm run lint                        → 0 error, 0 warning
npm test                            → 1015 passed (94 file)   [1012 baseline + 3 neto]
```

## Batas yang sengaja dilewati

- **Generasi video tidak diimplementasikan.** Tidak ada adapter provider yang
  benar-benar mendukung polling job/timeout/quota/cancellation, dan
  mensimulasikannya berarti menjanjikan hal yang tidak ada. Yang ada hanya
  analisis video masukan.
- **Frame dikirim ke model belum tersambung ke `generate.ts`.** Route
  mengembalikan pratinjau terbatas (12 frame, ≤ 256 KB/frame) + timestamp;
  penyuntikan ke percakapan butuh kontrak tool tersendiri (FIX-17/18).
- **Diarization hanya label A/B**, sesuai spesifikasi. Tidak ada voiceprint.
- **Rekaman browser tidak diuji di jsdom**: `MediaRecorder` tidak ada di
  lingkungan tes, jadi yang diuji adalah fallback-nya (tombol unggah) dan
  ketiadaan tombol rekam. Jalur rekam nyata butuh browser sungguhan.
- **STT `verbose_json` belum diverifikasi live** — tidak ada provider media di
  mesin ini. Kontraknya defensif: gateway tanpa segmen → `segments: []`.
- **`png` artefak tidak bisa dibuat dari klien**; hanya server (pembuatan
  gambar). Ini disengaja supaya tidak ada jalur unggah base64 arbitrer.
