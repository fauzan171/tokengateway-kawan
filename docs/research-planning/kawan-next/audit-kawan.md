# Audit kode aktual Kawan

Tanggal observasi: 24 Oktober 2026. Audit read-only; bukan implementasi atau izin deployment.

## Baseline

Checkout `/home/hermes/workspace/projects/tokengateway-kawan`; branch `merge/main-into-feat-nt-p1`; HEAD `027e17d4ba9c8faaa75d749e0e30166f651a17f5`. `git status --short` hanya menunjukkan direktori state tim untracked sebelum penulisan laporan; isinya tidak dibaca. `git diff --stat`, `git diff --name-status`, `git diff --cached --name-status` kosong. Tidak ada edit source existing pada baseline. Tool Bash tidak menampilkan marker exit numerik; output Git tidak memuat galat. Tidak menjalankan tes, build, migrasi, deployment, commit, atau membuka secret/DB.

[STATUS:3–13](../../../tasks/agent-v1/STATUS.md#L3-L13) menyatakan task belum ada. Itu basi terhadap checkout: API, schema, UI dan worker task sudah ada. [Scope aktif:91–120](../../../tasks/ACTIVE-SCOPE.md#L91-L120) tetap kontrak target, bukan bukti delivery.

## Kesimpulan

Gap utama **integrasi**, bukan ketiadaan seluruh komponen. Chat sudah menghubungkan pencarian, baca sumber, retrieval lampiran, Markdown/tabel/Mermaid dan artefak. Task terpisah masih satu panggilan model tanpa tools, tanpa lampiran yang diteruskan, tanpa rendering Markdown. Belum ada loop riset terhubung dengan batas tiga siklus pada jalur yang diperiksa.

Lima lapisan **otoritas prompt** sudah ada; bukan lima tahap **metode riset**. Perubahan prompt saja tidak menghasilkan riset iteratif.

## Peta jalur aktual

| Area | Bukti | Terhubung / batas |
|---|---|---|
| Worker | [worker:38–59](../../../src/worker.ts#L38-L59) | Handler `chat.generate`, `document.extract`, `agent.run` memanggil eksekutor masing-masing. |
| Task API | [route:44–79](../../../src/app/api/kawan/v1/tasks/route.ts#L44-L79), [service:390–475](../../../src/lib/tasks/tasks.ts#L390-L475) | Auth, quota, validasi agent, ownership; transaksi task/run/pesan/job/event. |
| Task execution | [run:294–314](../../../src/lib/tasks/run.ts#L294-L314), [run:394–414](../../../src/lib/tasks/run.ts#L394-L414) | Satu request model, teks saja; step bertambah sekali; selesai dengan `artifactIds: []`. Tidak mengirim tools atau mengeksekusi registry. |
| Task SSE | [events:20–36](../../../src/lib/tasks/events.ts#L20-L36), [events:95–127](../../../src/lib/tasks/events.ts#L95-L127) | Owner check, durable event, replay `afterSeq`, terminal seq. |
| Chat research | [generate:970–1025](../../../src/lib/chat/generate.ts#L970-L1025) | Toggle/heuristik freshness/URL; satu query, lima hasil, baca dua halaman sebelum generasi. Tidak ada evaluasi gap/query ulang. |
| Direct URL | [generate:1027–1064](../../../src/lib/chat/generate.ts#L1027-L1064) | Baca URL pertama jika hasil kosong dan search tidak gagal; search error menutup fallback. |
| Chat tools | [generate:1133–1165](../../../src/lib/chat/generate.ts#L1133-L1165), [generate:1226–1296](../../../src/lib/chat/generate.ts#L1226-L1296) | Schema dari registry; eksekusi switch file/document setelah stream. Maksimal tiga call sekali putaran, bukan tiga siklus. Hasil tool tidak kembali ke model. |
| Registry | [registry:118–123](../../../src/lib/tools/registry.ts#L118-L123), [registry:658–682](../../../src/lib/tools/registry.ts#L658-L682), [registry:726–750](../../../src/lib/tools/registry.ts#L726-L750) | Compute/chart/QR ada, tidak chat-exposed. Hanya generate_file/generate_document diekspos. |
| Agent catalog | [agents:37–56](../../../src/lib/agents/registry.ts#L37-L56) | Default saja; tools kosong; web/image/code false. Limit 40 steps/50.000 token/900 detik bukan cap riset tiga siklus. |
| Lampiran chat | [generate:935–967](../../../src/lib/chat/generate.ts#L935-L967) | Retrieval enam chunk, fallback keyword, degradasi. Bukan analitik dataset penuh. |
| Ekstraksi | [extract:121–169](../../../src/lib/documents/extract.ts#L121-L169), [run-extract:40–67](../../../src/lib/documents/run-extract.ts#L40-L67) | PDF/text/DOCX/PPTX/XLSX; worker mengambil pages dan menyimpan text/page/section, bukan cells terstruktur. PDF scan menghasilkan OCR_UNAVAILABLE ([extract:73–80](../../../src/lib/documents/extract.ts#L73-L80)). |
| Artefak | [create:86–157](../../../src/lib/artifacts/create.ts#L86-L157), [format:3–6](../../../src/lib/artifacts/format.ts#L3-L6) | Render byte, 25 MiB, SHA-256, staging/ready/failed, storage, lineage; md/txt/json/csv/html/xlsx/docx/pdf/zip/png. Dependency slide bukan bukti generator terhubung. |
| Chat output | [chat-view:937–954](../../../src/components/chat-view.tsx#L937-L954), [Markdown:108–149](../../../src/components/markdown.tsx#L108-L149) | Kartu unduh; Markdown GFM/tabel, math, highlight. |
| Flowchart | [Markdown:26–61](../../../src/components/markdown.tsx#L26-L61), [Markdown:94–98](../../../src/components/markdown.tsx#L94-L98) | Mermaid strict, fallback code saat gagal. Bukan editor/exporter diagram. |
| Task UI | [page:13–27](../../../src/app/tugas/page.tsx#L13-L27), [task-view:237–255](../../../src/components/task-view.tsx#L237-L255) | Auth tersedia; pesan/stream plain text, tanpa Markdown/diagram/tabel/kartu artefak. |
| Schema | [schema:600–685](../../../prisma/schema.prisma#L600-L685), [schema:813–849](../../../prisma/schema.prisma#L813-L849) | Task/TaskRun/TaskMessage/TaskEvent/TaskInteraction nyata; tidak ada model TaskStep. TaskMessage hanya text. Schema interaction bukan bukti approval loop. |
| Relasi artefak | [schema:249–282](../../../prisma/schema.prisma#L249-L282) | User/chat/message; belum task/run/step. Butuh kontrak attachment/provenance task. |

## Temuan prioritas

### P0 — batas eksekusi dan task pertama

1. **Cancel/deadline task tidak mencapai request aktif.** [run:261–319](../../../src/lib/tasks/run.ts#L261-L319) membuat idle/stop controller tetapi fetch tidak diberi signal; parameter signal worker juga tidak diteruskan. [fetchOutbound:404–423](../../../src/lib/net/policy.ts#L404-L423) hanya meneruskan init. Deadline hanya sebelum dispatch ([run:151–158](../../../src/lib/tasks/run.ts#L151-L158)). Risiko stop tidak segera menghentikan provider, shutdown tertahan, limit tidak bermakna. Bukti statis kuat; biaya/durasi aktual belum diukur. Gate: stream menggantung, cancel in-flight, shutdown, deadline total, nol delta/dispatch setelah stop.
2. **Task pertama tidak dapat dikirim lewat UI kosong.** [task-view:147–154](../../../src/components/task-view.tsx#L147-L154) return bila `!active`; [page:27](../../../src/app/tugas/page.tsx#L27) memasang TaskView tanpa taskId. Daftar kosong tidak menyediakan pilihan active. Gate: user baru membuat task pertama lewat UI, bukan API saja.
3. **Limit step/token belum ditegakkan executor.** [agents:54](../../../src/lib/agents/registry.ts#L54) mendefinisikan limit; [run:294–314](../../../src/lib/tasks/run.ts#L294-L314) tidak memakainya. Tetapkan cap server `researchCycle <= 3`, berbeda dari HTTP retry dan jumlah tool call. Angka tiga pada [generate:1242](../../../src/lib/chat/generate.ts#L1242) bukan cap siklus.

### P1 — kontrak input/output dan integritas

4. **artifactIds task divalidasi tetapi tidak dipersist sebagai konteks.** [tasks:411–423](../../../src/lib/tasks/tasks.ts#L411-L423); pesan hanya text ([tasks:468–472](../../../src/lib/tasks/tasks.ts#L468-L472)); executor membaca role/text ([run:213–222](../../../src/lib/tasks/run.ts#L213-L222)). Gate: attachment masuk reader/prompt, foreign/deleted/expired ditolak, retry referensi tetap.
5. **Lima lapisan otoritas bukan metode riset.** [prompt:10–20](../../../src/lib/chat/prompt-builder.ts#L10-L20), [policy:45–53](../../../src/lib/chat/prompt-builder.ts#L45-L53): policy/capability/preference/context/untrusted, anti-fabrikasi, fakta/inferensi. Chat menggunakannya; task menambah legacy autonomy/runtime terpisah. Definisikan lima lapisan riset dari requirement pemilik; jangan mengganti hierarchy trust. Gate injection, kurang bukti, konflik sumber, stop reason.
6. **Agent version tercatat, resolve memakai versi terbaru.** [run:187–197](../../../src/lib/tasks/run.ts#L187-L197), [registry:64–66](../../../src/lib/agents/registry.ts#L64-L66) mencari id saja. Belum snapshot prompt historis. Gate: perubahan definisi setelah admission tidak mengubah prompt/tools/model diam-diam.
7. **Rendering chat/task berbeda.** Reuse Markdown aman; perlu message parts, sourceRefs dan artifact refs, bukan renderer baru. Gate GFM table, Mermaid invalid, HTML/script, mobile overflow, aksesibilitas, unduhan owner-checked.
8. **Excel menjadi teks, bukan analitik dataset.** cells hasil extractor hilang di worker; compute tidak terhubung ke loop. Retrieval enam chunk tidak menjamin statistik seluruh data. Irisan minimum: schema/row count/truncation, null/type/unit eksplisit, operasi deterministik, provenance sheet/cell. Sandbox hanya setelah kebutuhan melewati operasi tersebut.
9. **Replay UI berisiko menggandakan teks parsial.** [task-view:74–82](../../../src/components/task-view.tsx#L74-L82) reset cursor nol setelah snapshot; [task-view:129–130](../../../src/components/task-view.tsx#L129-L130) menambahkan replay ke blok live sementara snapshot tetap tampil. Perlu cursor snapshot/dedup message+seq. Belum reproduksi browser.
10. **Fencing terpisah dari mutasi.** held dicek terpisah; finish transaction tanpa token lease ([run:81–115](../../../src/lib/tasks/run.ts#L81-L115)). Gate kehilangan lease antara check/write, bukan hanya di delta; worker basi tidak mengubah terminal.

## Guard yang dipertahankan

- Session server, bukan userId body: [route:15–28](../../../src/lib/api/route.ts#L15-L28).
- DNS pinning/manual redirect: [net:404–449](../../../src/lib/net/policy.ts#L404-L449). Reuse untuk research HTTP.
- Artifact owner/ready/expiry: [create:175–189](../../../src/lib/artifacts/create.ts#L175-L189). Attachment/private/no-store/nosniff/CSP sandbox: [download:24–42](../../../src/app/api/kawan/v1/artifacts/[artifactId]/route.ts#L24-L42).
- Raw HTML disabled, Mermaid strict: [Markdown:12–15](../../../src/components/markdown.tsx#L12-L15), [Markdown:37–61](../../../src/components/markdown.tsx#L37-L61).
- Untrusted wrapper/budget: [prompt:130–139](../../../src/lib/chat/prompt-builder.ts#L130-L139), [prompt:217–237](../../../src/lib/chat/prompt-builder.ts#L217-L237). Pemanggil mengambil content saja ([generate:1160](../../../src/lib/chat/generate.ts#L1160)); metadata dropped belum tampil. Sumber terpotong perlu provenance, bukan dianggap sudah ditinjau.

## Tes tersedia, belum dijalankan

Tidak mengklaim jumlah pass, keamanan live, deployment atau UI aktual. Inventaris bukan acceptance.

- [Vitest:10–15](../../../vitest.config.mts#L10-L15): source/tests; bukan Playwright; passWithNoTests true. Exit sukses tanpa jumlah tes tidak cukup.
- [Prompt tests:21–42](../../../src/lib/chat/prompt-builder.test.ts#L21-L42): urutan/string, bukan ketahanan model terhadap injection.
- [Run tests:86–108](../../../src/lib/tasks/run.test.ts#L86-L108): fixture stream/durable text/satu step. Suite juga berisi pre-dispatch cancel/deadline, lease loss, follow-up, SSE ownership; bukan bukti cancel request menggantung.
- Suite relevan: [task UI](../../../src/components/task-view.test.tsx), [Markdown](../../../src/components/markdown.test.tsx), [registry](../../../src/lib/tools/registry.test.ts), [compute](../../../src/lib/tools/compute.test.ts), [artefak](../../../src/lib/artifacts/artifacts.test.ts), [SSRF](../../../src/lib/net/policy.test.ts), [worker](../../../tests/worker-lifecycle.test.ts), [E2E dokumen](../../../e2e/documents.spec.ts), [E2E rendering](../../../e2e/render.spec.ts).
- [Scripts:6–18](../../../package.json#L6-L18) memisahkan test/typecheck/build/worker/deploy. Deploy membangun lalu restart layanan; jangan dipakai sebagai perintah verifikasi.

## Irisan SDD berikutnya

1. Tutup task pertama, cancel/deadline/fencing, replay. Bekukan tests sebelum loop.
2. Satu executor riset read-only di atas task durable: search/read, gap assessment, maksimal tiga siklus. Pisahkan cycle/model turn/tool call/retry. Persist query/source hash/cycle index/budget/stop reason. Tidak perlu multi-agent produk atau engine pengganti.
3. Hubungkan lampiran dan hasil ke extraction/retrieval, compute, artefak, Markdown existing. Schema baru hanya relasi/provenance yang dibutuhkan.
4. Bekukan lima lapisan metode riset dari requirement pemilik; jangan menganggap lima lapisan otoritas memenuhi requirement otomatis.
5. Gate fixture: cukup bukti stop awal; belum cukup mencapai siklus ketiga lalu jawaban terbatas; search/read error; SSRF; tool malformed/unknown; ownership; token/waktu/byte cap; injection; resume tanpa efek ganda; sumber/artefak dapat dibuka. Live gate terpisah setelah izin/config, bukan klaim dari mock.

Batas: tidak mengaudit seluruh endpoint, deployment aktual, kualitas provider live, sandbox live, atau migrasi fresh/populated dua DB. Temuan statis cukup untuk memilih irisan SDD; bukan sertifikat keamanan/rilis.
