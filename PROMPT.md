# Prompt — Bangun Kawan (BYOK Chat AI Platform, by tokengateway.ai.id)

Kamu senior full-stack developer. Bangun **Kawan** (kawan.ai.id) — platform web chat AI open-source dengan konsep **BYOK (Bring Your Own Key)**, persis konsep open-webui: siapa pun bisa pakai Kawan sebagai antarmuka chat, tinggal masukkan **URL gateway + API key** miliknya sendiri. Kawan tidak menyimpan API key provider, tidak menjadi perantara LLM — dia murni klien chat yang berdiri di domain terpisah dari gateway mana pun.

Kawan adalah produk resmi **by tokengateway.ai.id** — branding itu tampil di UI (lihat bagian Branding).

## Referensi

- Source code **open-webui** sudah di-clone di `/Users/mekari/tokengateway/open-webui`. **Pelajari dulu secara menyeluruh**: struktur frontend-nya (SvelteKit di `src/`), layout, komponen chat, cara handle streaming, penyimpanan riwayat, skema DB (`backend/open_webui/models/`), dan terutama cara dia handle **Connections/Settings** (user memasukkan endpoint + key provider sendiri, mis. di `src/lib/components/chat/Settings` dan admin settings).
- Bangun ulang fitur dan UX-nya **hampir 100% sama**, tulis kode dari nol dengan stack di bawah. **Jangan salin file/kode/aset apa pun** dari repo itu (batasan lisensi Open WebUI License).
- Target tampilan & perilaku: **seperti ChatGPT web / Claude web** — patokan rasa UI.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui + Vercel AI SDK v5 + Prisma (SQLite dev, Postgres prod) + Auth.js (email+password).

## Konsep kunci: BYOK Connections

Tiru konsep Connections milik open-webui, versi klien-only:

1. **Onboarding**: setelah register/login pertama kali, user disambut layar "Hubungkan Gateway" — input `Base URL` (endpoint [OI]-compatible, default placeholder `https://api.tokengateway.ai.id/v1`) + `API Key` + tombol "Test koneksi" (panggil `GET /v1/models`, validasi, tampilkan sukses/gagal + jumlah model ditemukan).
2. **Bisa lebih dari satu connection**: user bisa simpan beberapa gateway (nama + URL + key), pilih connection aktif di Settings. Model picker di chat menampilkan model dari connection aktif.
3. **Keamanan**: API key disimpan **terenkripsi** (AES-256-GCM, kunci dari env `ENCRYPTION_SECRET`) di DB, tidak pernah dikirim balik ke browser (mask: `sk-...abc1`). Semua panggilan LLM tetap lewat server route handler — browser tidak pernah pegang key mentah.
4. **Mode tanpa server** (opsional, tiru fitur "Direct Connections" open-webui): toggle "Gunakan langsung dari browser" — key disimpan di localStorage dan panggilan LLM langsung dari browser ke gateway user. Untuk user yang tidak mau key-nya lewat server Kawan sama sekali. Default: lewat server.
5. **Tabel DB**: `Connection { id, userId, name, baseUrl, apiKeyEncrypted, isDirect, isActive, createdAt }`.

Kalau user belum punya gateway, UI mengarahkan ke tokengateway.ai.id (lihat Branding).

## Fitur yang harus ada

Samakan dengan open-webui/ChatGPT untuk pemakaian pribadi:

- Auth (register/login/logout), multi-user
- **Onboarding BYOK** (di atas)
- Chat streaming (SSE), stop, regenerate
- Riwayat chat: sidebar, search, rename, pin, hapus, folder, grouped per tanggal
- Model picker per chat (model dari connection aktif)
- Edit pesan user + branching (message tree, bukan array — tiru pola open-webui)
- Markdown + code highlighting + copy
- Attach gambar & file (PDF/teks)
- System prompt per chat
- Dark mode, mobile responsive
- Export chat (Markdown), share link publik read-only
- Halaman Settings lengkap ala open-webui: General (tema, bahasa), Connections (kelola gateway), About
- **MCP support** (fase akhir): user daftarkan MCP server (URL + auth), tools muncul di chat (tombol tools di composer), dipanggil via tool-calling model. Eksekusi server-side.

Yang TIDAK usah dibuat (fitur enterprise open-webui): RAG/knowledge base, Ollama, tools/functions marketplace, RBAC/team, admin panel kompleks, calendars, notes.

## Metering (per user, per connection-nya sendiri)

Karena BYOK, Kawan tidak menagih token — tapi tetap **catat pemakaian** (`usage` dari respons gateway: prompt_tokens, completion_tokens, model) per user untuk halaman Usage pribadi: grafik harian, total per model. Ini fitur monitoring, bukan billing.

## Branding (wajib, ini identitas produk)

- Nama produk: **Kawan**. Logo teks + ikon sederhana.
- Footer sidebar & halaman login/onboarding ada tulisan: **"by tokengateway.ai.id"** — link ke `https://tokengateway.ai.id`.
- Di halaman Settings → Connections, saat user belum punya gateway atau test koneksi gagal, tampilkan kartu CTA: **"Belum punya API key? Dapatkan di tokengateway.ai.id"** dengan tombol link ke sana (buka tab baru).
- Di onboarding, di bawah input URL, link kecil: "Pakai gateway tokengateway.ai.id? Daftar di sini".
- Halaman About (Settings) menampilkan versi app + link repo + "by tokengateway.ai.id".
- `metadata` (title/description) di `layout.tsx`: "Kawan — Chat AI by tokengateway.ai.id".
- Kawan dirancang jadi platform yang siapa pun bisa self-host; branding by tokengateway tetap tampil (persis relasi openwebui.com terhadap open-webui).

## Aturan kerja

- Pelajari dulu cara open-webui mengerjakan tiap fitur, lalu implementasi versi sendiri di Next.js. Kalau ragu cara UI-nya, lihat komponen serupa di `src/lib/components/` open-webui.
- Kerjakan bertahap sampai semua fitur jalan. Tiap tahap harus `npm run build` sukses.
- Urutan bila ragu: auth + onboarding connection dulu, lalu chat streaming, lalu riwayat/branching, lalu attach/settings, lalu share/export/metering, MCP terakhir.
- Jangan tambah dependency aneh-aneh, jangan bikin abstraksi yang tidak perlu, jangan tinggalkan TODO kosong.
