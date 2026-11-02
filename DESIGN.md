# DESIGN.md — Kawan (kawanku.tokengateway.ai.id)

Versi 1.0 · Sumber kebenaran tunggal untuk redesign Kawan (desktop + mobile) dan karakter maskot Three.js per agent.
Bahasa UI: Indonesia. Kode/komentar/nama file: English.

---

## 0. Konteks Produk (hasil audit situs saat ini)

Kawan = chat AI pribadi, BYOK ("Chat pribadi dengan kunci API milikmu sendiri"), by tokengateway.ai.id.

Struktur yang ada dan WAJIB dipertahankan (jangan hapus fitur):
- Sidebar: logo `brand/kawan-mark.png` + "Kawan", tombol **Chat baru**, kolom **Cari percakapan**, filter **Semua**, daftar percakapan (empty state: "Belum ada percakapan."), link **Pengaturan** (`/pengaturan`), **Kebijakan privasi** (`/privasi`), footer "by tokengateway.ai.id".
- Area utama: judul "Percakapan baru" + tab/toggle **Pratinjau**, greeting "Halo, ada yang bisa saya bantu hari ini?", 4 suggestion chip (Rangkum dokumen ini jadi poin · Buat laporan mingguan dari data saya · Cari harga terbaru suatu produk · Cari berita terbaru hari ini), input **Prompt**, disclaimer "Kawanku dapat membuat kesalahan. Periksa kembali info penting.", tagline "Kawan · Ruang untuk percakapan bermakna".
- Skip link "Lewati navigasi" (aksesibilitas, pertahankan).

Redesign mengubah tampilan, bukan perilaku/route/API. Stack: pertahankan framework yang ada (terdeteksi Next.js). Jangan ubah logic BYOK.

---

## 1. Prinsip Desain

1. **Hangat, tenang, tidak ribut.** Kertas krem, bukan putih steril. Satu aksen terakota, dipakai hemat.
2. **Percakapan adalah hero.** Chrome seminimal mungkin; konten dan input mendominasi.
3. **Serif untuk suara, sans untuk fungsi.** Judul/greeting/jawaban panjang = serif; UI, label, tombol = sans.
4. **Maskot membantu, tidak mengganggu.** Animasi halus, bisa dimatikan, tidak pernah menutupi teks.
5. **Mobile-first, desktop-enhanced.** Semua fitur sama di dua layout.
6. **Aksesibel by default.** WCAG AA, fokus terlihat, `prefers-reduced-motion` dihormati.

---

## 2. Design Tokens

Semua token sebagai CSS variables di `:root`, dark di `:root[data-theme="dark"]` dan `@media (prefers-color-scheme: dark)` (guard `:root:not([data-theme="light"])`).

### 2.1 Warna

Gaya mengikuti palet hangat ala Claude (krem + terakota). Nilai orisinal untuk Kawan, bukan aset berhak cipta.

```css
:root {
  /* Surfaces */
  --bg:            #F5F4ED;  /* kertas krem, background utama */
  --bg-sunken:     #EFEDE3;  /* sidebar, area cekung */
  --surface:       #FAF9F5;  /* kartu, input, bubble */
  --surface-raised:#FFFFFF;  /* popover, modal */
  --border:        #E6E3D6;
  --border-strong: #D3CFBF;

  /* Text */
  --text:          #1F1E1B;  /* utama, kontras 15:1 di --bg */
  --text-muted:    #5F5C52;  /* sekunder, kontras >= 6:1 */
  --text-faint:    #8A8678;  /* placeholder, hint (jangan untuk teks penting) */

  /* Brand / Accent (terakota) */
  --accent:        #C96442;  /* tombol utama, link aktif */
  --accent-hover:  #B4553A;
  --accent-press:  #9C4830;
  --accent-soft:   #F3E1D8;  /* background chip/aksen lembut */
  --on-accent:     #FFFFFF;

  /* Semantic */
  --success: #4E7A4B;  --success-soft: #E3EEDF;
  --warning: #A8741A;  --warning-soft: #F6EBD0;
  --danger:  #B3382C;  --danger-soft:  #F6DDD9;
  --info:    #3F6E96;  --info-soft:    #DEE9F3;

  /* Focus */
  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);

  /* Code */
  --code-bg: #EFEDE3; --code-text: #2B2A26;
}

:root[data-theme="dark"] {
  --bg:            #1C1B18;
  --bg-sunken:     #161512;
  --surface:       #262521;
  --surface-raised:#2E2D28;
  --border:        #3A3832;
  --border-strong: #4B483F;

  --text:          #F1EFE6;
  --text-muted:    #B9B5A5;
  --text-faint:    #8B8777;

  --accent:        #E07B57;
  --accent-hover:  #EA8D6C;
  --accent-press:  #C96442;
  --accent-soft:   #3A2A22;
  --on-accent:     #1C1B18;

  --success:#7DB379; --success-soft:#243022;
  --warning:#D9A441; --warning-soft:#392E17;
  --danger: #E1695C; --danger-soft:#3C201D;
  --info:   #7AA8D1; --info-soft:#1E2C3A;

  --code-bg:#161512; --code-text:#E7E4D8;
}
```

Aturan warna: aksen maksimal ~10% area layar. Tombol utama = 1 per layar. Jangan pakai gradient ungu/biru generik.

### 2.2 Tipografi

Font Claude (Styrene/Tiempos) berlisensi, tidak boleh dipakai. Padanan open-source:

| Peran | Font | Fallback stack |
|---|---|---|
| Serif (greeting, judul, jawaban AI) | **Newsreader** (opsz 6..72, wght 400-600) | `"Newsreader", "Source Serif 4", Georgia, "Times New Roman", serif` |
| Sans (UI, label, tombol, chip) | **Inter** (wght 400/500/600) | `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Mono (kode) | **JetBrains Mono** (400/500) | `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace` |

Self-host via `next/font` (hindari request ke Google Fonts saat runtime). `font-display: swap`, subset `latin`.

Skala (rem, base 16px). Mobile → Desktop:

| Token | Mobile | Desktop | Weight | Line-height | Letter-spacing | Font |
|---|---|---|---|---|---|---|
| display | 32/2rem | 44/2.75rem | 500 | 1.15 | -0.02em | serif |
| h1 | 26/1.625rem | 32/2rem | 500 | 1.2 | -0.015em | serif |
| h2 | 21/1.3125rem | 24/1.5rem | 500 | 1.25 | -0.01em | serif |
| h3 | 17/1.0625rem | 18/1.125rem | 600 | 1.35 | 0 | sans |
| body-serif (jawaban AI) | 17/1.0625rem | 17/1.0625rem | 400 | 1.65 | 0 | serif |
| body-ui | 15/0.9375rem | 15/0.9375rem | 400 | 1.5 | 0 | sans |
| label | 13/0.8125rem | 13/0.8125rem | 500 | 1.3 | 0.005em | sans |
| caption | 12/0.75rem | 12/0.75rem | 400 | 1.4 | 0.01em | sans |
| code | 14/0.875rem | 14/0.875rem | 400 | 1.55 | 0 | mono |

Aturan: lebar baris jawaban maks `68ch`; teks input minimal 16px di mobile (cegah zoom iOS); angka tabel pakai `font-variant-numeric: tabular-nums`.

### 2.3 Spacing (grid 4pt)

`--space-0:0; 1:4px; 2:8px; 3:12px; 4:16px; 5:20px; 6:24px; 8:32px; 10:40px; 12:48px; 16:64px; 20:80px`

Padding halaman: mobile 16px, tablet 24px, desktop 32px.

### 2.4 Radius

`--r-xs:6px; --r-sm:8px; --r-md:12px; --r-lg:16px; --r-xl:24px; --r-pill:999px`
Input prompt = `--r-xl` (24px). Kartu/chip = `--r-md`/`--r-pill`. Tombol = `--r-md`.

### 2.5 Elevasi (lembut, hangat)

```css
--shadow-1: 0 1px 2px rgba(60,50,30,.06);
--shadow-2: 0 4px 16px rgba(60,50,30,.08), 0 1px 2px rgba(60,50,30,.06);
--shadow-3: 0 12px 40px rgba(60,50,30,.14), 0 2px 6px rgba(60,50,30,.08);
/* dark: ganti rgba(0,0,0,.35-.5) */
```
Prefer border 1px dibanding shadow untuk kartu. Shadow dipakai di prompt input saat fokus, popover, modal.

### 2.6 Motion

```css
--ease-out: cubic-bezier(.2,.8,.2,1);
--ease-in-out: cubic-bezier(.65,0,.35,1);
--dur-fast:120ms; --dur-base:200ms; --dur-slow:360ms;
```
Pola: fade+translateY(4px) masuk; sidebar slide 280ms; streaming teks tanpa animasi per-karakter berlebihan. `@media (prefers-reduced-motion: reduce)` → semua durasi 0.01ms, maskot statis (pose idle).

### 2.7 Z-index & Breakpoint

`--z-base:0; --z-sticky:10; --z-sidebar:20; --z-popover:30; --z-modal:40; --z-toast:50`
Breakpoint: `sm 480`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Layout utama beralih di `lg` (1024).

---

## 3. Layout

### 3.1 Desktop (>= 1024px)

```
┌───────────────┬──────────────────────────────────────────┐
│ Sidebar 288px │  Header 56px: judul chat · Pratinjau · ⋯  │
│ --bg-sunken   ├──────────────────────────────────────────┤
│               │                                          │
│ [Mark] Kawan  │        Konten (max 760px, centered)      │
│ [+ Chat baru] │                                          │
│ [Cari...]     │   [Maskot 3D 160px]                      │
│ Filter: Semua │   Halo, ada yang bisa saya bantu...      │
│ ─ Hari ini    │   [chip][chip][chip][chip]               │
│   percakapan  │                                          │
│ ...           ├──────────────────────────────────────────┤
│ Pengaturan    │  Prompt dock (max 760px, sticky bottom)  │
│ Privasi       │  disclaimer caption                      │
│ by tokengw    │                                          │
└───────────────┴──────────────────────────────────────────┘
```
- Sidebar bisa collapse ke rail 64px (ikon saja), state tersimpan di localStorage (try/catch).
- Konten chat: kolom tengah `max-width: 760px`; pesan user rata kanan dalam bubble `--surface`, jawaban AI tanpa bubble (teks di atas `--bg`, ikon maskot kecil 28px di kiri).

### 3.2 Mobile (< 1024px)

```
┌──────────────────────────┐
│ ☰  Judul chat      ✎  ⋯ │ header 52px, safe-area-top
├──────────────────────────┤
│                          │
│   [Maskot 3D 120px]      │
│   Halo, ada yang bisa    │
│   saya bantu hari ini?   │
│   chip (scroll horizontal│
│   atau stack 1 kolom)    │
│                          │
├──────────────────────────┤
│ [ + ] Prompt...   [ ➤ ]  │ dock, safe-area-bottom
│ disclaimer (caption)     │
└──────────────────────────┘
```
- Sidebar = drawer kiri 86vw (maks 340px) + scrim `rgba(0,0,0,.4)`, tutup via swipe/ESC/tap scrim, focus trap.
- Wajib: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, padding `env(safe-area-inset-*)`, tinggi layar pakai `100dvh`.
- Touch target minimal 44x44px. Keyboard muncul: dock naik mengikuti `visualViewport`.
- Chip suggestion: 1 kolom (stack) di <480px, grid 2 kolom di 480-1023px.

---

## 4. Komponen

Setiap komponen wajib punya state: default, hover, pressed, focus-visible, disabled, loading, error (jika relevan).

### 4.1 Button
- **Primary**: bg `--accent`, teks `--on-accent`, tinggi 40 (mobile 44), padding 0 16, radius `--r-md`, weight 500.
- **Secondary**: bg `--surface`, border `--border-strong`, teks `--text`.
- **Ghost**: transparan, hover bg `--bg-sunken`.
- **Icon button**: 40x40 (44 mobile), radius `--r-md`, `aria-label` wajib.
- Loading: spinner 16px + teks tetap, `aria-busy`.

### 4.2 Prompt Input (komponen terpenting)
- Container: bg `--surface`, border 1px `--border-strong`, radius 24, padding 12 16, `--shadow-1`; fokus: border `--accent` + `--shadow-2`.
- `textarea` auto-grow 1 baris → maks 8 baris (mobile 5), lalu scroll internal. Placeholder: "Tanya Kawan apa saja..." (`--text-faint`).
- Baris aksi bawah: kiri `+` (lampiran/tools), tengah pemilih agent (chip kecil dengan avatar maskot 20px + nama), kanan tombol kirim (lingkaran 36px, `--accent`; disabled saat kosong; berubah jadi tombol Stop saat streaming).
- Enter = kirim (desktop), Shift+Enter = baris baru; mobile: Enter = baris baru, kirim lewat tombol.
- `aria-label="Prompt"`.

### 4.3 Suggestion Chip
Pill atau kartu kecil: bg `--surface`, border `--border`, padding 10 14, label 14px; hover bg `--accent-soft` border `--accent`. Awalan ikon kecil per chip (dokumen, laporan, harga, berita). Teks "Coba" dipertahankan sebagai aksi terpisah/tooltip.

### 4.4 Sidebar Item (percakapan)
Tinggi 40, radius 8, judul 1 baris ellipsis, aktif: bg `--surface` + border kiri 2px `--accent`; hover: bg `--surface` 60%. Menu `⋯` muncul saat hover/fokus (ganti nama, pin, hapus). Grup waktu: Hari ini / Kemarin / 7 hari / Lebih lama (label caption uppercase tracking .06em).

### 4.5 Search & Filter
Search: tinggi 36, ikon kiri, radius 10, bg `--surface`. Filter "Semua" = segmented control / dropdown (Semua · Disematkan · Per agent).

### 4.6 Message
- **User**: bubble `--surface`, border `--border`, radius 18 (sudut kanan-bawah 6), maks 85% lebar, sans 15px.
- **AI**: tanpa bubble, serif 17px/1.65, maskot avatar 28px di kiri (desktop) atau di atas pesan (mobile <480). Markdown: heading serif, list rapi, tabel scroll horizontal dalam container `overflow-x:auto`.
- **Aksi pesan** (muncul saat hover/fokus; selalu tampil di mobile): salin, regenerasi, suka/tidak, ⋯.
- **Streaming**: kursor blok kecil `▍` warna `--accent` berkedip 1s; maskot berstate `thinking`→`speaking`.
- **Code block**: bg `--code-bg`, radius 12, header (bahasa + tombol Salin), scroll-x.

### 4.7 Toast, Modal, Popover, Tooltip
Toast bawah-tengah (desktop) / atas (mobile, di bawah safe-area). Modal radius 20, `--shadow-3`, scrim 40%. Fokus trap + ESC + `aria-modal`.

### 4.8 Empty/Error/Loading
- Empty sidebar: "Belum ada percakapan." + maskot kecil pose `sleepy` (static fallback PNG).
- Error: banner `--danger-soft` + ikon + teks + tombol "Coba lagi".
- Loading: skeleton `--bg-sunken` shimmer lembut (nonaktif saat reduced-motion).

### 4.9 Halaman Pengaturan (`/pengaturan`)
Layout 2 kolom desktop (nav kiri 220px: Umum · API Key · Agent · Tampilan · Privasi), 1 kolom mobile dengan list navigasi → detail.
- **API Key (BYOK)**: field password + tombol tampilkan/sembunyikan, status tervalidasi (badge success), catatan "Kunci disimpan di perangkatmu" (sesuaikan dengan perilaku asli, jangan mengklaim yang tidak benar).
- **Tampilan**: tema (Terang/Gelap/Sistem), ukuran font (S/M/L), **Maskot 3D** (Aktif/Mode hemat/Mati).
- **Agent**: kartu per agent dengan pratinjau 3D, nama, deskripsi, system prompt (opsional).

### 4.10 Halaman Privasi (`/privasi`)
Tipografi artikel: serif, lebar `68ch`, h2 serif, daftar isi sticky di desktop.

---

## 5. Aksesibilitas

- Kontras: teks >= 4.5:1, UI/ikon >= 3:1 (sudah diverifikasi untuk token di atas; ulangi jika token diubah).
- Fokus: `:focus-visible` memakai `--focus-ring`; jangan pernah `outline:none` tanpa pengganti.
- Skip link "Lewati navigasi" tetap ada dan terlihat saat fokus.
- Semantik: `<nav>` sidebar, `<main id="content">`, `aria-live="polite"` untuk area streaming, `role="log"` untuk daftar pesan.
- Canvas 3D: `aria-hidden="true"` untuk dekoratif; status agent dikomunikasikan lewat teks (`aria-label` pada chip agent, mis. "Agent Peneliti, sedang berpikir").
- Target sentuh >= 44px, zoom tidak dikunci, dukung font scaling 200%.
- `prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast: more` (naikkan border ke `--border-strong`).

---

## 6. Maskot Per Agent (Three.js)

### 6.1 Konsep
Keluarga karakter orisinal bernama **"Kawan-kawan"**: tubuh bulat lembut (blob/squircle), mata dua titik besar, tanpa mulut detail (ekspresi lewat mata + pipi + gerak), satu **percikan terakota** (spark) di kepala sebagai motif keluarga. Gaya: *soft toon*, hangat, ramah, bukan realistis. Tidak meniru maskot Anthropic/Claude; jangan pakai bentuk starburst/kepiting piksel.

Bahasa bentuk: proporsi chibi (kepala:tubuh ~ 1:1), siluet unik per agent, aksesori 1 buah per agent.

### 6.2 Roster Agent

| ID | Nama | Peran | Warna tubuh | Aksen | Siluet & aksesori | Kepribadian gerak |
|---|---|---|---|---|---|---|
| `kawan` | **Kawan** | Asisten umum | `#E9B79B` (peach) | `#C96442` | Blob bulat, spark di atas kepala | Ramah, goyang pelan |
| `peneliti` | **Pelita** | Riset & pencarian web | `#B9D3C2` (sage) | `#4E7A4B` | Bentuk telur tinggi, kacamata bulat besar, antena kecil | Memiringkan kepala, menoleh-noleh |
| `penulis` | **Pena** | Menulis & edit | `#D9C7E4` (lilac lembut) | `#7A5C9A` | Blob miring, topi baret kecil, pena menjadi spark | Mengetuk-ngetuk, mengangguk |
| `analis` | **Angka** | Data & laporan | `#BCD2E6` (biru debu) | `#3F6E96` | Squircle, 3 batang bar mini melayang di sisi | Bar naik-turun mengikuti "berpikir" |
| `koder` | **Kode** | Software engineer | `#3A3832` (arang hangat) bodi, wajah `#F1EFE6` | `#E07B57` | Persegi membulat, headset, tanda `</>` di dada | Ketukan cepat, kedip mata mode terminal |
| `penjaga` | **Jaga** | Monitor sistem | `#F0D9A8` (kuning krem) | `#A8741A` | Bentuk perisai membulat, 3 lampu indikator (CPU/RAM/Disk) | Lampu menyala sesuai level nyata |

Tambah agent baru = tambah 1 entri di `agents.config.ts`, tanpa ubah engine.

### 6.3 Pendekatan Teknis
- **Prosedural, tanpa aset eksternal**: seluruh karakter dibangun dari primitif Three.js (`SphereGeometry`, `CapsuleGeometry`*, `RoundedBox` dibuat lewat `ExtrudeGeometry`/custom, `TorusGeometry`, `CylinderGeometry`). *Pakai `three@0.160+` untuk `CapsuleGeometry`. Pin versi exact di `package.json`.
- Dependensi: `three` (+ opsional `@react-three/fiber` & `@react-three/drei` bila stack React; jika memakai R3F, tetap pisahkan engine dari config).
- **Lazy load**: `dynamic(() => import('./MascotCanvas'), { ssr: false })`; muat hanya setelah first paint/idle. Fallback: gambar statis (`/mascots/<id>.webp` 2x) atau SVG sederhana.
- Satu `WebGLRenderer` bersama (singleton) untuk banyak avatar kecil: render ke canvas offscreen lalu `drawImage`, atau gunakan 1 canvas fixed + `scissor/viewport` per elemen. Jangan membuat >2 konteks WebGL sekaligus.
- Kamera: `PerspectiveCamera(fov 28)`, jarak ~6, posisi sedikit atas. `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, `outputColorSpace = SRGBColorSpace`, `antialias: true`, `alpha: true`.

### 6.4 Material & Pencahayaan (soft toon)
- Material utama: `MeshToonMaterial` dengan `gradientMap` 3-tone (generate lewat `DataTexture` 3 piksel, `NearestFilter`) → bayangan berundak halus. Alternatif: `MeshStandardMaterial` roughness 0.8 untuk dekat ke "clay".
- Outline: duplikat mesh dengan `BackSide`, skala 1.03, `MeshBasicMaterial` warna `#2A2723` (opacity 0.9) → garis tebal tipis.
- Cahaya: `HemisphereLight(0xFFF3E0, 0x8A7F6A, 0.9)` + `DirectionalLight(0xFFFFFF, 1.1)` dari kiri-atas; tanpa shadow map (hemat). Kontak shadow palsu = `CircleGeometry` datar transparan radial gradient di bawah karakter.
- Pipi: 2 lingkaran `#E8836B` opacity 0.35 di wajah. Mata: `SphereGeometry` hitam `#1F1E1B` + highlight putih kecil (bisa kedip lewat scale Y).
- Dark mode: naikkan intensitas hemisphere 10% dan ubah warna outline `#0E0D0B`; background canvas selalu transparan.

### 6.5 Rig & Animasi (tanpa skeleton, hierarki Object3D)
Hierarki: `root > body > (head/eyes/cheeks/accessory/spark)`. Animasi memakai kurva prosedural di loop `requestAnimationFrame` (atau `useFrame`), tanpa library tween wajib.

State machine (`MascotState`):

| State | Pemicu | Gerak |
|---|---|---|
| `idle` | default | napas: scaleY `1 + 0.02·sin(t·1.6)`, bob y ±0.03, kedip tiap 3-6 detik acak (scaleY mata → 0.1, 120ms) |
| `listening` | user mengetik | kepala miring 6°, mata membesar 5%, spark berkedip pelan |
| `thinking` | request dikirim | goyang ringan kiri-kanan 2s, spark berputar, aksesori khas bergerak (bar/ketukan/kacamata geser) |
| `speaking` | token streaming | squash & stretch kecil mengikuti ritme token (amplitudo dari laju token), mata fokus |
| `happy` | jawaban selesai / feedback suka | lompat kecil (ease-out-back 400ms), pipi lebih terang, spark meletup 6 partikel |
| `error` | gagal/API key salah | goyang geleng 2x, mata jadi `> <` (swap geometri/texture), spark redup |
| `sleepy` | idle >60 detik atau empty state | mata setengah tertutup, napas lambat, "z" kecil melayang |
| `alert` | khusus `penjaga` saat RAM/CPU/Disk >= 85% | lampu merah berdenyut, bodi bergetar halus |

Transisi antar state: blend nilai lewat damping `x += (target - x) * (1 - exp(-k·dt))`, k = 8. Tidak ada snapping.

Interaksi: mata mengikuti pointer (clamp ±15°); klik/tap = `happy` singkat; hover desktop = `listening`. Nonaktif saat reduced-motion.

### 6.6 Ukuran & Penempatan
| Konteks | Ukuran | Mode |
|---|---|---|
| Hero empty-state desktop | 160-200px | animasi penuh |
| Hero mobile | 112-128px | animasi penuh (30fps cap) |
| Avatar pesan AI | 28px | statis/low-fps, render snapshot per state |
| Chip pemilih agent | 20px | snapshot statis |
| Kartu agent di Pengaturan | 120px | animasi hover |

### 6.7 Performa & Fallback
- Target 60fps desktop, 30fps mobile (cap lewat delta). Render hanya saat terlihat: `IntersectionObserver` + `document.visibilityState`.
- Pause loop saat tab tersembunyi atau canvas offscreen; `dispose()` geometry/material/texture saat unmount.
- Budget: <= 5k segitiga per karakter, <= 1 draw call group per bagian, bundle tambahan three (tree-shaken) target <= 180KB gzip.
- Mode "Hemat": 15fps, tanpa outline pass, pixelRatio 1. Mode "Mati": gambar statis.
- Deteksi tidak ada WebGL / `webglcontextlost` → fallback statis tanpa error.
- Opsi lanjutan (opsional): ekspor GLB via `GLTFExporter` dari karakter prosedural untuk dipakai ulang.

### 6.8 Kontrak Kode

```ts
// src/mascot/types.ts
export type MascotState =
  | 'idle' | 'listening' | 'thinking' | 'speaking'
  | 'happy' | 'error' | 'sleepy' | 'alert';

export interface AgentConfig {
  id: string;            // 'kawan' | 'peneliti' | ...
  name: string;          // 'Kawan', 'Pelita', ...
  role: string;          // deskripsi singkat (ID)
  body: string;          // hex
  accent: string;        // hex
  shape: 'blob' | 'egg' | 'squircle' | 'shield' | 'tilted';
  accessory: 'spark' | 'glasses' | 'beret' | 'bars' | 'headset' | 'lights';
}

// src/mascot/Mascot.tsx
export interface MascotProps {
  agent: AgentConfig;
  state: MascotState;
  size: number;              // px
  quality?: 'full' | 'eco' | 'off';
  interactive?: boolean;
  className?: string;
}
```

Integrasi state: `idle` default → `listening` (onInput) → `thinking` (onSubmit) → `speaking` (onToken) → `happy` (onDone) / `error` (onError).

---

## 7. Struktur File

```
src/
  styles/tokens.css          # semua CSS variables section 2
  styles/globals.css         # reset, tipografi, utilitas
  components/ui/             # Button, Chip, Input, Modal, Toast, ...
  components/chat/           # PromptInput, Message, MessageList, Sidebar, Header
  mascot/
    types.ts
    agents.config.ts
    engine/                  # scene, materials, rig, animations, stateMachine
    characters/              # kawan.ts, peneliti.ts, penulis.ts, analis.ts, koder.ts, penjaga.ts
    Mascot.tsx               # wrapper + lazy + fallback
  app/(routes)/...           # route existing, jangan ubah path
public/mascots/              # fallback webp per agent (+ brand/kawan-mark)
DESIGN.md
```

---

## 8. Aturan Implementasi

1. Pertahankan route, API, dan logic BYOK. Ubah hanya lapisan presentasi.
2. Tidak ada nilai warna/spacing/font hardcoded di komponen; semuanya dari token.
3. Halaman published harus self-contained untuk aset kritis; font di-self-host.
4. Tipografi apostrof/kutip: gunakan ’ dan “ ” pada teks yang dibaca user (bukan di kode).
5. Commit atomik (Conventional Commits), branch `agent/redesign-kawan`, kerja di worktree.
6. Jangan menyalin aset, logo, atau teks berhak cipta pihak lain.

## 9. Acceptance Checklist

- [ ] Lighthouse mobile: Performance >= 85, Accessibility >= 95, CLS < 0.05
- [ ] Layout benar di 360, 390, 768, 1024, 1280, 1536 px (tidak ada scroll horizontal)
- [ ] Terang/gelap/sistem berfungsi, tanpa flash tema saat load
- [ ] Sidebar: desktop collapse, mobile drawer + focus trap + ESC
- [ ] Prompt dock tidak tertutup keyboard mobile / notch
- [ ] 6 maskot render, 8 state berfungsi, reduced-motion = statis
- [ ] WebGL tidak tersedia → fallback gambar tanpa error konsol
- [ ] Semua fitur situs lama tetap ada (cari, filter, pengaturan, privasi, chip saran)
- [ ] Screenshot before/after (mobile + desktop, terang + gelap) disimpan di `reports/redesign-YYYYMMDD/`
