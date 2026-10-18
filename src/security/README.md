# Suite keamanan (WP-NT-P10-02)

Peta butir SDD-9.3 ke berkas uji. Semua berkas memakai harness yang sudah ada:
`tests/helpers/auth-db.ts` (SQLite sementara + migrasi nyata) dan resolver DNS
palsu di `src/lib/net/policy.ts`.

| SDD-9.3 butir | Berkas uji | Kasus | Catatan |
|---|---|---|---|
| 1. Kanari | `canary.test.ts` | 10 | Kanari disuntik lewat kunci jinak (`note`) agar lapis nilai yang diuji, bukan nama kunci. Termasuk ekspor, snapshot berbagi, dan DTO koneksi. |
| 2. SSRF | `ssrf.test.ts` | 9 | Kebijakan tidak ditulis ulang; yang diuji pemakaiannya di `fetchJson`. Bukti inti: `fetch` **tidak pernah dipanggil** untuk alamat metadata/privat. |
| 3. XSS | `xss.test.ts` | 10 | MIME unggahan, `sanitizeFilename`, render markdown (tanpa `rehype-raw`), dan teks yang dirender sebagai teks (judul, nama berkas, sumber). |
| 4. Lintas pengguna | `cross-user.test.ts` | 16 | Chat, pesan (edit/regenerate/continue), dokumen, folder, prompt, koneksi, tautan berbagi. Semua 404, bukan 403. |

Total: 4 berkas, 45 kasus.

## Batas yang jujur

- `cross-user.test.ts` memanggil modul domain langsung, bukan route HTTP. Yang
  diuji adalah filter kepemilikan di level query; lapisan sesi
  (`requireContext`) diuji terpisah di `src/lib/auth/`.
- `ssrf.test.ts` memakai resolver palsu, jadi tidak membuktikan perilaku DNS
  nyata maupun penutupan TOCTOU/DNS-rebinding (didokumentasikan di
  `src/lib/net/policy.ts`).
- XSS diuji pada render server (`renderToStaticMarkup`). Komponen yang memakai
  `dangerouslySetInnerHTML` (diagram mermaid) mengandalkan `securityLevel:
  "strict"` milik mermaid dan tidak diuji di sini.
