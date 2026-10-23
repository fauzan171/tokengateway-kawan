# FIX-20 — Approval, konektor, dan batas identitas

Status: **verified_fixture** (OAuth live `blocked_external`)

## Masalah

Belum ada mekanisme persetujuan yang benar-benar mengikat. FIX-19 sudah
mengembalikan `needs_approval`, tetapi tidak ada yang menyimpan permintaan itu,
tidak ada yang mencegahnya dipakai dua kali, dan tidak ada yang membatalkannya
bila argumennya berubah. Tanpa itu, "approval" hanya kata di UI.

Belum ada konektor pihak ketiga. Menambahkannya tanpa aturan akan menempatkan
token OAuth di tempat yang salah: log, tool result, snapshot, atau model.

## Solusi

### `src/lib/approvals/approvals.ts` — approval satu-pakai

Approval memakai `TaskInteraction` yang sudah ada (tidak ada tabel baru untuk
approval). Yang ditegakkan:

| Aturan | Cara |
|---|---|
| approval mengikat aksi | digest = SHA-256(userId, aksi, target, hash payload, runId, stepId, revisi kebijakan) |
| argumen berubah → batal | digest dihitung ulang saat keputusan; beda → 409 `APPROVAL_DIGEST_MISMATCH` |
| kebijakan berubah → batal | `policyRevision` ikut digest DAN diperiksa terpisah |
| sekali pakai | `UPDATE … WHERE id=? AND status='pending'`; baris terpengaruh 0 → 409 `APPROVAL_ALREADY_USED` |
| kedaluwarsa | `expiresAt` 10 menit; lewat → ditandai `expired` lalu 409 `APPROVAL_EXPIRED` |
| owner | run diverifikasi milik pengguna; approval milik orang lain → 404 |
| output model tidak bisa menyetujui | `decideApproval` hanya menerima `userId` dari sesi; tidak ada jalur dari tool result |

Percobaan dengan payload berbeda **tidak mengonsumsi** approval — ia tetap
`pending` (dibuktikan tes), jadi pengguna tidak perlu meminta ulang hanya karena
model salah mengirim argumen.

Approval tanpa run (mis. dari chat) mengembalikan `status: "proposed"` dengan
digest bertanda tangan, tanpa menulis baris DB — skema mewajibkan `runId`.

### `src/lib/connectors/connectors.ts` + model `ConnectorCredential`

- **Token terenkripsi per baris**: envelope AES-GCM dengan AAD
  `{rowId, userId, purpose:"connector.token"}`. Ciphertext baris A tidak bisa
  dipakai di baris B.
- **Allowlist endpoint**: hanya path yang terdaftar per provider
  (`/drive/v3/files`, `/v1/search`, `/v1/pages`); path lain ditolak **sebelum**
  ada request keluar.
- **Egress tetap lewat FIX-07** (`assertOutboundAllowed` + `fetchOutbound`), jadi
  redirect ke alamat privat tetap ditolak.
- **Respons dibatasi** 1 MB; melebihi → `CONNECTOR_RESPONSE_TOO_LARGE`.
- **Token tidak pernah tampil**: `tokenHint` adalah topeng penuh
  (`FULLY_MASKED`), bukan potongan 4 karakter pertama/terakhir. Potongan pun
  membocorkan informasi dan tidak berguna bagi pengguna.
- **Revoke menghentikan akses**: `revokedAt` diset; `openToken` menolak baris
  yang sudah dicabut.

### Skema

Model baru `ConnectorCredential` (id, userId, provider, label, scopes,
tokenEncrypted, refreshEncrypted, expiresAt, revokedAt, timestamps) dengan dua
index. Migrasi ditulis manual untuk **kedua** provider.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/approvals/approvals.ts` | **baru** — digest, request, decide satu-pakai |
| `src/lib/approvals/approvals.test.ts` | **baru** — 12 tes |
| `src/lib/connectors/connectors.ts` | **baru** — token terenkripsi, allowlist, revoke |
| `prisma/schema.prisma` | model `ConnectorCredential` + relasi `User.connectors` |
| `prisma/migrations/{sqlite,postgresql}/20261029000000_connector_credential` | **baru** |

## Verifikasi

```
node scripts/check-migrations.mjs                              → OK (2 provider, init dibekukan, urutan sama)
npx prisma migrate deploy --schema prisma/schema.sqlite.prisma → All migrations applied
npm run db:generate                                            → exit 0
npx tsc --noEmit -p tsconfig.json                              → 0 error
npx eslint src/lib/approvals src/lib/connectors                → 0 error, 0 warning
npx vitest run src/lib/approvals                               → 12 passed
```

## Batas yang sengaja dilewati

- **OAuth live tidak dijalankan** (`blocked_external`): tidak ada client
  Google/Notion di mesin ini. Alur Authorization Code + PKCE + state, redirect
  URI exact, dan refresh race-safe **belum** diimplementasikan — hanya
  penyimpanan token, allowlist, dan revoke.
- **Tidak ada UI approval.** `requestApproval`/`decideApproval` siap dipakai,
  tetapi route dan komponen dialog belum ada.
- **Approval belum tersambung ke eksekusi.** `app.delete_chat` masih
  mengembalikan `needs_approval` tanpa membuat baris; penyambungannya butuh
  run aktif (FIX-08/FIX-09) dan UI di atas.
- **Identitas legal/tanda tangan digital tidak diimplementasikan.** Spesifikasi
  memintanya lewat penyedia tersertifikasi dengan consent, verifikasi
  sertifikat, timestamp, dan pemeriksaan revocation — semuanya butuh vendor dan
  kontrak hukum. Kawan hanya boleh menjadi integrator, dan itu belum terjadi.
  Gambar tanda tangan dari input pengguna boleh dibuat sebagai gambar
  berlabel, **bukan** klaim tanda tangan kriptografis.
- **Booking/pembayaran tidak ada.** Tidak ada hosted checkout, tidak ada
  penyimpanan data kartu, tidak ada billing.
- **Refresh token belum dirotasi.** Kolomnya ada; logikanya menunggu OAuth live.
