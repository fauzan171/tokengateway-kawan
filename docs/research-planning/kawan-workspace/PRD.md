# PRD — Kawan Workspace (susunan ulang)

26 Oktober 2026. Versi 2 dari PRD kawan-next; susunan ulang ke framing "workspace ala
Supernala" dengan engine tunggal. Basis keputusan pemilik (26 Okt): **lanjut Kawan
existing, hybrid workspace-UX engine-tunggal, search chain gratis**.
Requirement stabil R01-R11 di [PRD kawan-next](<../kawan-next/PRD.md>) **tetap berlaku**
dan tidak diulang di sini. Bukti riset: [RISET](<RISET.md>). Paket kawan-next tetap
referensi arsitektur (SDD, IMPLEMENTATION-PLAN, ACCEPTANCE).

## Posisi produk

Kawan = asisten riset BYOK dengan pengalaman workspace: tugas berjalan di background,
progres terlihat per langkah, hasil berupa jawaban ter-sitasi + artefak file yang bisa
diunduh. Bukan katalog multi-bot; satu engine riset di balik UX workspace.

Diferensiasi vs Supernala (Rp100-200rb/bln, bot pribadi serbaguna): Kawan fokus riset
dengan bukti (sitasi, konflik, abstention) + BYOK + transparansi biaya per run.

## Arsitektur: apa yang tetap, apa yang baru

### Tetap (fondasi existing, tidak diubah)
Next.js 15 + React 19 + Prisma 7, NextAuth v5, worker polling Job (lease 60s,
heartbeat, indeterminate), SSE replay afterSeq, Artifact storage/hash/expiry owner,
tool registry tertutup, renderer Markdown/GFM/Mermaid existing, i18n Indonesia.
ADR01-ADR10 kawan-next tetap berlaku (no transplant engine, no plugin framework,
no sandbox sebelum gate, fail-closed).

### Delta baru dari riset Supernala (urutan prioritas)

| # | Delta | Sumber inspirasi | Kesesuaian existing |
|---|---|---|---|
| D1 | Loop riset read-only ≤3 siklus di task | Metode 5 lapisan kawan-next | WP05-WP08 plan existing |
| D2 | File generation tool: XLSX (exceljs), DOCX (docx), MD/CSV/JSON | "Nori" Supernala: tool terpusat JSON→file, tanpa sandbox | exceljs terpasang; R09 |
| D3 | Search chain: Tavily free → Jina s.jina.ai → fetch+readability | Alternatif gratis Linkup | Chat punya search; task belum |
| D4 | Onboarding fokus: satu pertanyaan pilihan (riset/data/tulis/campur) disimpan per user, disuntik ke prompt | InteractiveQuestion Supernala | Tabel/kolom baru kecil; PRD kawan-next tidak melarang |
| D5 | Status aktivitas per langkah di UI task ("mencari…", "membaca sumber 2/3…") | activity.title worker lane Supernala | TaskEvent + SSE sudah ada; render di task-view |
| D6 | Metering per run: token/estimasi biaya/sumber dibaca ditampilkan | Pelajaran #5 kompetitor | R03 budget sudah track; tampilkan ke user |

### Non-goals (tidak berubah)
Sandbox/code execution sebelum gate isolasi live; multi-bot/grup chat/katalog persona;
plugin/MCP arbitrary; CLI shell; billing baru; janji parity Manus. D4 onboarding TIDAK
menjadi sistem persona multi-bot — hanya preferensi fokus.

## Search chain (revisi keputusan pemilik 26 Okt)

Pemilik memilih SearXNG+DDG. Riset lapangan menunjukkan SearXNG self-host tetap scrape
engine upstream (risiko CAPTCHA/rate-limit IP datacenter sama dengan DDG), RAM 200-400MB,
dan butuh Docker di prod. Delegasi penuh keputusan diberikan pemilik. Keputusan revisi:

1. **Tavily free** (1.000 kredit/bln, no card) — primer. BYOK: key admin atau key user.
2. **Jina s.jina.ai free key** (100 RPM, 10M token) — fallback.
3. **fetch + @mozilla/readability** — fallback lokal halaman statis.
4. SearXNG self-host = opsi tier berikutnya bila biaya API jadi masalah; DDG scraping =
   emergency saja. Keduanya tercatat di DECISIONS sebagai revisi yang bisa dibatalkan.

## Persona & kebutuhan (warisan kawan-next, tetap)

Empat persona kawan-next (peneliti, analis UMKM, penulis/pelajar, operator BYOK) tetap.
Tambahan dari framing workspace: pengguna baru harus paham dalam ≤30 detik bahwa Kawan
mengerjakan tugas berat di background dan hasilnya berupa file + sitasi.

## Ukuran keberhasilan

Warisan kawan-next (≥90% answerable, ≥95% abstention, ≥95% supported-claim precision,
pelanggaran keamanan nol) tetap. Tambahan workspace:
- D2: file XLSX/DOCX hasil generate lolos validasi (terbuka, struktur benar, hash cocok).
- D3: chain berhenti dengan pesan jelas bila semua provider gagal/habis; tidak pernah
  mengarang hasil pencarian.
- D4: jawaban onboarding tersimpan dan memengaruhi prompt run berikutnya (teruji).
- D5: aktivitas per langkah tampil ≤2 detik dari event; replay afterSeq benar.

## Tahapan

Tahapan mengikuti DAG baru di [IMPLEMENTATION-PLAN](<IMPLEMENTATION-PLAN.md>) (WO-0,
WO-B1..B5 + B2b/B2c/B2d, WO-F1..F5, WO-9/10) yang mewarisi prasyarat keamanan
kawan-next yang relevan (egress consent REV-03, provenance/sitasi minimal WP10).
R01-R11 tetap berlaku sebagai requirement stabil; urutan WP00-WP15 kawan-next tidak
dituangkan apa adanya ke paket ini — pemetaan delta D1-D6 ke WP terkait dicatat di
IMPLEMENTATION-PLAN. Tidak ada WO yang melompati gate R11.

## Keputusan pemilik yang sudah tercatat

| Keputusan | Nilai |
|---|---|
| Basis produk | Kawan existing (bukan Lobe Chat/fork) |
| Posisi | Hybrid: UX workspace ala Supernala, engine tunggal riset |
| Search | Revisi: Tavily→Jina→readability; SearXNG opsional; DDG emergency |
| Delegasi | Pemilik memberi full authority keputusan produk ke Hermes (bypass/YOLO); semua revisi dicatat |
