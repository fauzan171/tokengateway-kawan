# FIX-04 — konteks server & state klien yang jujur

Status: **selesai** untuk empat butir yang bisa dikerjakan tanpa infra eksternal.
Gate dijalankan ulang setelah perubahan terakhir.

## Yang berubah

| Berkas | Perubahan |
|---|---|
| `src/lib/chat/chats.ts` | `PublicChat` dan `ChatRow` mengekspos `titleSource` + `titleRevision`; `CHAT_FIELDS` membaca kedua kolom; `toPublicChat` meneruskannya ke klien. Sebelumnya kolomnya ada di DB tapi tidak pernah sampai ke UI, sehingga satu-satunya cara menebak "judul masih bawaan" adalah membandingkan teks. |
| `src/lib/chat/grouping.ts` | `GroupableChat` menerima `titleSource?` dan `titleRevision?` (opsional, supaya pemanggil lama tidak pecah). |
| `src/components/chat-view.tsx` | `ensureChat()` tidak lagi mengirim `title: t("chat.newChatTitle")`. Judul terjemahan membuat `createChat` mencatat `titleSource: "manual"`, jadi judul otomatis tidak akan pernah bisa mengisi chat baru. Sekarang body hanya membawa `modelRef` bila chat itu memang sudah punya pilihan. `modelRef` menjadi `string \| null` mulai `null`; konstanta `DEFAULT_MODEL = "deepseek-v4.1-flash"` dihapus dari klien. Efek daftar model memakai model pertama yang dilaporkan server **hanya** untuk memutuskan tombol visi — nilainya tidak disimpan, karena menyimpannya berarti mengunci chat ke model tertentu tanpa persetujuan pengguna. |
| `src/components/chat-sidebar.tsx` | Judul bawaan dilabeli dari state: `titleSource === "auto" && titleRevision === 0` → `t("chat.newChatTitle")`; selebihnya `chat.title` apa adanya. Rename manual ke teks yang kebetulan sama dengan judul bawaan sekarang tetap tampil sebagai pilihan pengguna. |
| `src/lib/chat/chats.test.ts` | Tes baru: chat tanpa `title` → `titleSource: "auto"`, `titleRevision: 0`; chat dengan `title: "Chat baru"` → `titleSource: "manual"`. |

## Butir yang ternyata sudah benar (tidak diubah)

- **Tanggal dari clock server.** `buildRuntimeContext` (`src/lib/chat/generate.ts:78`) memakai `now: new Date()` dari proses server, memvalidasi zona waktu lewat `Intl.DateTimeFormat` dan jatuh ke `DEFAULT_TIMEZONE` bila nilai tidak sah. Tidak ada angka yang dikarang.
- **Capability jujur.** `src/app/api/kawan/v1/capabilities/route.ts` sudah menurunkan state dari dua bukti saja — koneksi aktif dan kapabilitas yang diumumkan gateway pada cache model. Env terisi tidak pernah cukup: `stt`/`tts` butuh media dikonfigurasi **dan** gateway mengumumkan `audio`; belum diprobe → `unknown`, bukan `false`. Boolean lama diturunkan dari state, bukan ditebak ulang.
- **Judul otomatis menang atas judul bawaan saja.** `src/lib/chat/title.ts` sudah memakai syarat `titleSource: "auto"` pada penulisan otomatis dan menulis `manual` + `titleRevision: { increment: 1 }` pada rename manual.

## Verifikasi (output nyata)

```
npx tsc --noEmit -p tsconfig.json          → TSC=0
npx eslint <5 berkas yang diubah>          → LINT=0
npm test                                   → 79 file, 788 test lulus (TEST_EXIT=0)
rm -rf .next && npm run build              → BUILD_EXIT=0
python3 tasks/agent-v1/check_docs.py       → LULUS (0 pelanggaran)
node scripts/check-migrations.mjs          → OK (2 provider, init dibekukan, urutan sama)
```

Baseline sebelum FIX-04: 787 test. Naik satu karena tes `titleSource` baru.
Tidak ada assertion yang dilonggarkan.

## Belum dikerjakan

- **Preferensi zona waktu per pengguna.** Belum ada kolom `UserSetting.timezone`; `generate.ts:904` memakai `DEFAULT_TIMEZONE` dengan penanda `shortcut:`. Menambah kolom berarti migrasi baru — di luar lingkup FIX-04.
- **Model default yang dilaporkan server pada `/capabilities`.** Route capabilities belum mengekspos `defaultModel`; klien memakai `models[0]` dari `/models` sebagai gantinya. Menambah field itu berarti kontrak baru — ditunda sampai ada kebutuhan nyata.
- **Pemilih model di UI.** Belum ada; `modelRef` per chat hanya dibaca dari `data.chat.modelRef` saat chat dibuka. Menambah pemilih berarti pekerjaan UI baru, bukan perbaikan konteks.
- **Replay stream setelah reload penuh** (warisan FIX-03) masih belum diuji di browser nyata.

## Catatan proses

[CC] run-5 (`wo-fix04.md`, `--max-turns 45`) berakhir `error_max_turns` dengan **nol tulisan** — 204 tool call hanya membaca. Ini run kelima [CC] yang gagal berturut-turut; FIX-04 dikerjakan native.
