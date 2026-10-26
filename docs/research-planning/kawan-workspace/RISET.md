# Riset Supernala, kompetitor, dan stack — Kawan workspace

26 Oktober 2026. Riset oleh Hermes (3 agent paralel). Input utama: ekspor sesi Gemini
`Memulai Obrolan Santai.md` (rekayasa balik supernala.com oleh pemilik via DevTools)
+ verifikasi independen. Status: riset, bukan otorisasi implementasi.

## 1. Verifikasi klaim arsitektur Supernala

Metode: fetch landing page, app login, 2 bundle JS publik, privacy/terms. WebSearch publik
nol jejak (produk organik Indonesia).

| Klaim (dari sesi Gemini) | Verdict | Bukti |
|---|---|---|
| Auth Better Auth + multi-workspace | PLAUSIBLE (auth) / VERIFIED (workspace) | Cookie `__Secure-better-auth.session_token` hanya di DevTools pemilik; URL `/app/w/{workspaceId}/chats/{conversationId}` + endpoint `/v1/workspaces/...` ada di bundle publik |
| Web search = Linkup | VERIFIED | Bundle publik `product-data-epoch-*.js` memuat literal `linkup-plan-allowance-v1` + header `x-supernala-product-data-epoch`; landing jual kuota 200/500 pencarian |
| Observability Maple.dev + OTel | VERIFIED (Maple) / PLAUSIBLE (OTel) | Privacy policy menyebut Maple eksplisit; `traceparent` hanya terlihat runtime |
| Cloudflare proxy | VERIFIED | Header `server: cloudflare`, `cf-ray` |
| Frontend Next.js | **BUSTED** | Landing = Astro; app = **Vite + React SPA** (rolldown), bukan Next.js; bukan Lobe Chat/OpenWebUI — 100% custom |
| Event sourcing: snapshot + SSE cursor + worker lane | VERIFIED | Literal bundle: `/v1/conversations/{id}/snapshot`, `/v1/events?cursor=`, `text/event-stream`, `lane: ["chat","worker"]`, `work-failure-report` |
| Artifacts fileId/grantId | VERIFIED | `/v1/artifact-references/{id}/preview|download`, objek `{conversationId, fileId, grantId, displayName, mediaType, byteSize}` |
| Onboarding questionnaire | UNVERIFIED | Nol hit `questionnaire` di bundle login; ada `/v1/account/welcome-tour`; data observasi pemilik menunjukkan InteractiveQuestion nyata — kemungkinan di chunk lain |
| Model = Claude | UNVERIFIED | Gaya bahasa bukan bukti; privacy hanya menyebut "penyedia model AI" plural |
| File generation (xlsx, engine "Nori") | PLAUSIBLE | Chunk `spreadsheet-sheet-tabs`, export endpoint; string xlsx/docx tidak ada di bundle publik |

### Profil bisnis (VERIFIED, landing + terms)
- Operator: individu Indonesia (Muhammad Hanif, hanif@fungsi.app). Produk berbahasa Indonesia.
- Fitur jual: bot pribadi persisten (nama/peran/konteks), grup multi-bot, memori privat
  per bot + memori bersama, pengingat terjadwal, Google Calendar, pencarian web berkuota,
  "Computer" per jam, plugin, file 10/20 GB.
- Harga: Standard Rp100.000/bln (promo Rp50.000), Plus Rp200.000/bln. Billing API lengkap
  di bundle (checkouts, credit-lots, trials).
- Kontradiksi menarik: FAQ bilang "bot belum pakai browser/komputer" tapi jual jam
  "Computer" + ada endpoint `/v1/retained-work/computer/stop` → fitur gated/FAQ basi.
- Pesaing langsung di pasar Indonesia, positioning "bot pribadi untuk keseharianmu" —
  lebih luas dari Kawan (fokus riset). Bukan enterprise AS.

## 2. Benchmark kompetitor agent workspace

| Produk | Posisi | Pola inti | Realistis VPS kecil BYOK? |
|---|---|---|---|
| Manus | Manajer tugas otonom | VM cloud per session, kredit | Tidak (VM mahal); pola kredit & review-antar-fase bisa ditiru |
| Supernala | Bot pribadi multi | SSE cursor + worker lane + artifacts | Ya — polanya persis fondasi Kawan |
| Open WebUI | Self-host UI/agent | Python + RAG + plugin (image 1.6GB) | Berat; lisensi NOASSERTION — jangan fork |
| LobeChat | Chat + agent team | Next.js + PG + S3 (stack sama Kawan) | Kode besar, lisensi non-kontras; ambil pola, jangan fork |
| ChatGPT Tasks/Cowork | Consumer agent | Background task + approval gate + deliverable | Pola UX paling layak ditiru |
| Sim | Open-source workspace | Workflow graph + KB + logs | Referensi arsitektur menarik, bukan transplant |
| Devin | AI SWE | Sandbox berat per repo | Tidak relevan |

### 5 pelajaran desain untuk Kawan
1. **Task background + notifikasi + resume** — cocok dengan Job lease 60s existing; status persist + SSE replay, bukan polling UI.
2. **Event stream per langkah + snapshot resumable** — worker append event, UI replay; tanpa sandbox VM.
3. **Deliverable file/artefak** — hasil riset = file unduhan (XLSX/MD), bukan cuma teks.
4. **Approval gate sebelum aksi sensitif** — relevan saat naik level dari read-only.
5. **Metering transparan** — tampilkan biaya token per run; diferensiator vs Manus/Supernala yang bakir di transparansi.

## 3. Stack: search, scraping, file generation (harga verifikasi 2026-10-26)

| Opsi | Status | Catatan |
|---|---|---|
| Tavily free | **PILIH PRIMER** | 1.000 kredit/bln reset, no card, API resmi, tidak kenal blokir IP |
| Jina s.jina.ai + free key | **PILIH FALLBACK** | 100 RPM, 10M token gratis (±1.000 search/key); r.jina.ai 20 RPM tanpa key, 500 RPM dengan key — reader termurah |
| Fetch + @mozilla/readability | **PILIH FALLBACK LOKAL** | Nol biaya; halaman statis. Koreksi: readability **belum terpasang** di Kawan (jsdom sudah ada) — ditambahkan sebagai dependensi di WO-B2 |
| SearXNG self-host | Turun tier (opsional) | RAM 200-400MB (klaim 150MB tak terverifikasi); metasearch = scrape engine upstream, IP datacenter tetap rentan CAPTCHA — risiko sama DDG |
| ddgs (DDG scraping) | Emergency saja | 429/blokir real (issue #479 aktif); jangan primer |
| Linkup | Skip | €0.005-0.006/query, free tier 4k sekali pakai saja |
| Brave API | Skip | Free butuh kartu kredit |
| Crawl4AI | Skip | Python + Playwright (200-500MB RAM), duplikasi stack |
| exceljs | **PILIH** | MIT, terawat, sudah terpasang di Kawan |
| docx (npm) | **PILIH** | MIT, API deklaratif |
| xlsx (SheetJS npm) | Skip | Rilis npm berhenti 2022, CVE prototipe pollution |
| PDF | Defer | YAGNI sampai ada permintaan nyata |

Biaya efektif: **$0/bln** untuk 10-50 user dengan pola wajar (<1.000 search/bln).

## 4. Implikasi ke keputusan produk

1. Riset Gemini menyimpulkan "Lobe Chat + FastAPI/LangGraph" — **ditolak**: fondasi Kawan
   (Next.js 15 + worker durable + SSE + artifacts + tool registry) sudah 60-70% arsitektur
   Supernala; transplant Python = buang semua + lisensi/dependency baru (sudah ADR01).
2. Frontend Supernala ternyata Astro+Vite custom — bukan resep Lobe Chat. Validasi jalur
   custom UI Kawan.
3. Arsitektur inti Supernala (event cursor, worker lane, artifacts, onboarding state)
   memetakan hampir 1:1 ke yang sudah ada/direncanakan di kawan-next (SSE afterSeq,
   Job lease, Artifact, R01-R11). Delta kecil: onboarding questionnaire, file-gen tool,
   search tool chain.
4. Supernala jual Rp100-200rb/bln di pasar sama → Kawan BYOK bisa beda harga via
   transparansi biaya + kontrol (user bawa key).

Sumber lengkap: lihat lampiran URL di tiap bagian; verifikasi harga dari halaman resmi
per 2026-10-26. Tidak diverifikasi: RAM aktual SearXNG, rate-limit angka DDG,
multiplikator kredit Tavily per endpoint, masa depan harga Jina pasca-Elastic.
