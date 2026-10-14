# Skenario acceptance mandor

Status: test specification, belum dijalankan. Baseline dan seluruh kontrak tetap mengikuti [PRD](prd.md), [schema contract](schema-contract.md) dan [inventory](reference/README.md). Skenario di sini adalah minimum konkret untuk setiap gate, bukan pengganti test tiap reference ID di [coverage.json](coverage.json).

## Fixture dan evidence contract

Gunakan dua user terpisah A/B, admin, pending user, dua group dengan nested membership, public reader, dan resource owner yang aksesnya dapat dicabut. Provider fixture mempunyai dua model, model tanpa vision/tools, chunk Unicode, tool calls, reasoning yang benar-benar dikirim provider, usage tersedia/tidak tersedia, timeout, 401, 429, response rusak, dan putus di tengah stream. Tidak memakai data/key produksi.

Jalankan profile SQLite dan Postgres; dark/light/system; mobile/desktop; locale Indonesia/Inggris/RTL; flags enabled/disabled; satu instance/multi-instance; online/offline jika didukung fitur. Adapter-specific profile wajib ditambahkan sesuai katalog. Nilai expected yang bergantung baseline ditangkap dari referensi pada P00, bukan diasumsikan dari nama fitur.

Setiap case merekam task/reference IDs, input, baseline expected, Kawan actual, DB diff, HTTP/WS trace atau screenshot sesuai kasus, assertion, dan hasil pass/fail. Secret disanitasi. Tentukan budget latency/memory/visual diff dari benchmark yang sama pada P00 dan kunci sebelum implementasi, sehingga bukan batas yang disesuaikan agar hasil lolos.

## P00 — baseline dan fondasi

- ACC-P00-01: commit/source fingerprints lokal cocok dengan baseline, source tidak berubah setelah inventory, semua dynamic branches diberi owner dan review status.
- ACC-P00-02: jalankan app referensi terisolasi; synthetic login/chat/admin/workspace journey menghasilkan reproducible HTTP/WS snapshots dan screenshots; dataset reset mengulang hasil yang sama.
- ACC-P00-03: scaffold Kawan punya seluruh command yang diwajibkan, navigation keyboard/mobile bekerja, unknown route/error/loading states tercatat, tidak ada production service memakai backend referensi.

## P01 — schema dan data

- ACC-P01-01: introspect migrated live DB dua provider; seluruh 43 tabel, 396 declared columns, migration-only objects, types/defaults/nullability/keys/indexes dibandingkan dengan target; semua delta dijelaskan.
- ACC-P01-02: import lalu export fixture dengan nanosecond timestamps, large integers, nullable metadata, JSONField TEXT, composite tag key dan semua history tables; tidak ada pembulatan/kehilangan tipe atau references.
- ACC-P01-03: mutate chat tree, share snapshot, file link dan materialized ChatMessage secara atomik; inject rollback di tengah transaksi; JSON/projection/selected leaf tetap konsisten setelah restart.

## P02 — auth dan account

- ACC-P02-01: first-user admin/signup disabled/pending/active/rejected flows dibandingkan baseline; A/B tidak bisa memakai session satu sama lain; logout/revoke/expiry/session-stamp menutup akses.
- ACC-P02-02: MFA enroll/verify/recovery/reset diuji termasuk code reuse/expiry/brute force; perubahan password/profile tidak membocorkan hashes atau mem-bypass status akun.
- ACC-P02-03: setiap OAuth/OIDC/LDAP/trusted-header profile diuji identity linking, invalid issuer/state, disabled user dan signup policy; application API key mengikuti endpoint restrictions, terpisah dari provider key.

## P03 — RBAC, groups dan SCIM

- ACC-P03-01: owner/admin/group/public read/write matrix diuji API dan UI untuk setiap resource; group inheritance/cycle/revoked membership memberi keputusan yang sama dengan baseline.
- ACC-P03-02: A memasukkan ID resource B pada path/body/search/import/socket join; server menolak atau memfilter sesuai kontrak, termasuk setelah resource sharing dicabut.
- ACC-P03-03: SCIM create/list/filter/PATCH/deprovision Users/Groups memberi identity dan membership yang konsisten; invalid bearer/schema/duplicate identity tidak merusak akun lain.

## P04 — connections dan providers

- ACC-P04-01: onboarding "Hubungkan Gateway" menguji URL dengan/tanpa trailing slash, URL default `/v1`, key valid/invalid, zero models, timeout, dan multiple connections; endpoint tidak menjadi `/v1/v1/models`.
- ACC-P04-02: hanya satu personal connection aktif per user; pindah connection mengubah model picker; saved key AES-GCM/rotation/mask diuji; browser/network/log/DB tidak memuat raw persisted key.
- ACC-P04-03: Direct models/chat berjalan browser ke gateway; CORS failure tidak fallback diam-diam ke server; key tidak masuk synced settings/DB; native Ollama pull/create/delete progress dan cancel benar-benar bekerja.
- ACC-P04-04: seluruh provider branch/header/auth/custom params diuji; DNS/redirect policy diuji dengan operator-allowed private gateway dan forbidden metadata endpoint; admin global key tidak bisa dibaca user.

## P05 — chat execution

- ACC-P05-01: kirim prompt; SSE/socket provider fixture mengirim split Unicode, reasoning/tool/usage parts; UI dan persistence menyusun isi/ordering yang sama tanpa token hilang/duplikat.
- ACC-P05-02: stop saat sedang streaming lalu regenerate; partial output/status/task cancellation sama dengan baseline. Disconnect/reload dan worker restart tidak membuat generation atau charge token tambahan tanpa aksi baru.
- ACC-P05-03: pilih beberapa model; satu sukses, satu timeout; tiap response/status/usage/cancel independen. Background/title/tag/follow-up tasks memakai model/flag yang benar, temporary mode mengikuti retention contract.

## P06 — history dan branching

- ACC-P06-01: edit pesan user lama lalu regenerate satu assistant sibling; branch lama tetap bisa dipilih; request berikutnya hanya berisi ancestry branch aktif; reload/export/import mempertahankan current leaf.
- ACC-P06-02: nested folder move/share/archive/search/tag/pin/unread/bulk delete diuji; reparent cycle dan cross-owner move ditolak; date grouping/timezone/pagination mengikuti baseline.
- ACC-P06-03: public share snapshot update/revoke/read-only/clone diuji; export/import JSON/text/Markdown/PDF yang ada pada baseline mempertahankan content/tree dan tidak menyertakan keys/private system metadata yang dikecualikan.

## P07 — rendering dan composer

- ACC-P07-01: streaming Markdown belum lengkap, highlighted code/copy, math, Mermaid, citations, details, alerts dan rich output tampil sesuai surface; unsafe HTML/artifact script tetap terisolasi.
- ACC-P07-02: composer IME/Enter/Shift+Enter/drafts/paste/upload/@model/#knowledge/prompt/notes bekerja pada mobile/desktop; izin/capability controls bereaksi sesuai baseline.
- ACC-P07-03: edit/continue/regenerate/rating/TTS/overview/multi-response/artifact edit-download diuji; keyboard focus dan scroll mengikuti user preference setelah update stream.

## P08 — personal Settings dan locales

- ACC-P08-01: setiap control personal mempunyai default/change/save/reload/reset test; model params benar-benar mengubah request; visibility mengikuti permission dan tidak menjadi toggle inert.
- ACC-P08-02: seluruh 64 locale surfaces mempunyai key/interpolation/plural/fallback check; RTL/date/theme/responsive/shortcuts diuji dengan independently written translations.
- ACC-P08-03: Settings search/deep link, notifications permission denied, Account/Usage/Archive/About navigation diuji; semua branding required muncul pada login/onboarding/sidebar/About/metadata.

## P09 — attachments, storage dan parsing

- ACC-P09-01: gambar/PDF/teks dan semua format baseline upload-preview-extract-chat-download-delete berhasil; MIME mismatch/size/duplicate/upload abort/parse failure memberi status yang benar.
- ACC-P09-02: tiap storage/parser adapter mempunyai contract fixture dan configured smoke; file private/range/signed URL expiry/access revocation diuji; shared reference tidak ikut terhapus oleh cleanup orphan.
- ACC-P09-03: cloud picker auth/select/import/retry dan document/OCR/media pipeline restart diuji; citation page/metadata dan model vision capability tidak hilang di request.

## P10 — models dan Playground

- ACC-P10-01: buat wrapper model dengan system/params/knowledge/tools/skills/capabilities; inferensi memakai binding/permissions yang benar; base model collision/prefix/order/cache mengikuti baseline.
- ACC-P10-02: edit/version/rollback/clone/import/export model; tiap history snapshot dapat diulang; resource grants dan model availability tetap konsisten setelah provider berubah.
- ACC-P10-03: Playground chat/completions/images menjalankan request nyata pada fixture/provider, bukan preview palsu; native model management/load-unload memberi progress/status yang benar.

## P11 — prompts dan skills

- ACC-P11-01: slash template dengan variables/forms menghasilkan prompt tepat; command collision dan malformed inputs ditolak; search/activation/access sama dengan baseline.
- ACC-P11-02: prompt/skill create/edit/history/diff/rollback/import/export round-trip; references/file paths dan localized metadata dipertahankan tanpa source/aset/translation disalin.
- ACC-P11-03: private/group/public grants dan access-loss diuji di chooser dan server; skill files/instructions yang dipilih masuk context sesuai baseline, tidak tertukar antarakun.

## P12 — tools, MCP dan plugins

- ACC-P12-01: discover lalu pilih MCP/OpenAPI tools; model tool call dengan structured args dieksekusi, result dimasukkan ke model, second-step final response tampil; schemas/error/retry/step limits diuji.
- ACC-P12-02: auth/OAuth/token expiry/elicitation approve-reject/cancel/resource/prompt flows pada transports baseline bekerja; Direct model + server tool bridge tidak mengirim raw model key ke server.
- ACC-P12-03: custom Python tool/function/filter/pipe/action/pipeline + valves/history UI benar-benar dieksekusi pada worker isolasi; timeout/file/egress/resource failure tidak mengakses user/process lain.

## P13 — knowledge dan RAG

- ACC-P13-01: knowledge hierarchy/files/access/indexing dan reindex/delete diuji; chunk metadata/citations/progress terjaga setelah retry/restart, cross-user retrieval tidak muncul.
- ACC-P13-02: seluruh embedding/vector adapter, semantic/hybrid/BM25/full-context/reranking/top-k/threshold profile dibandingkan baseline fixtures; engine selection benar-benar mengubah backend yang dipakai.
- ACC-P13-03: update file/model embedding atau revoke ACL menghasilkan cache/vector lifecycle yang benar; download/share/reference cleanup tidak meninggalkan authorized stale data.

## P14 — search dan memory

- ACC-P14-01: setiap search adapter menangani query/results/errors/rate limits/config; web load/crawl menampilkan citations sesuai source; URL/DNS/redirect/size/timeout policies berlaku.
- ACC-P14-02: manual/always/on-demand search dan generated queries memberi context sesuai settings; disabled state tidak diam-diam memakai engine lain.
- ACC-P14-03: memories create/edit/delete/retrieve/background review mengikuti user/type/path limits; A/B isolation, access-loss dan restart cadence diuji, external knowledge response contract dipertahankan.

## P15 — audio dan realtime voice

- ACC-P15-01: mic allow/deny/device change/record/upload/stop/transcribe memasukkan teks nyata; tiap local/external STT engine diuji dengan deterministic audio fixtures dan timeout/capability failure.
- ACC-P15-02: tiap TTS voice/model/cache/stream profile memberi audio yang benar; interrupt/playback/device loss tidak terus menjalankan request atau memakai voice engine berbeda.
- ACC-P15-03: realtime turn-taking/VAD/transcript/tool call/disconnect/reconnect diuji; temporary tokens dan provider keys mengikuti declared secret policy, worker offline/GPU-ready state tidak dipalsukan.

## P16 — image generation dan editing

- ACC-P16-01: semua baseline image engine/model/parameter/workflow mapping diuji; generate dari chat/Playground menghasilkan file output/private history yang dapat dibuka/diunduh.
- ACC-P16-02: image edit/mask/reference inputs dan progress/cancel/error diuji pada engines yang mendukungnya; unsupported capability memberi behavior baseline, tidak fake success.
- ACC-P16-03: permission/quota/provider key/storage/revoke diuji; ComfyUI/Automatic1111 polling/upload node mapping tidak jatuh ke generic OpenAI payload secara diam-diam.

## P17 — channels dan collaboration

- ACC-P17-01: channel/membership/message/thread/reaction/pin/read/file CRUD mempunyai HTTP/WS effects yang benar; history cursor/order dan user timestamps konsisten.
- ACC-P17-02: dua browser di dua app instances menerima events sekali dan reconnect dengan state benar; private room join/revoked membership/access loss langsung ditegakkan server.
- ACC-P17-03: webhook auth/message payload/model mention/automation target diuji; duplicate/retry/edit-delete race tidak menghasilkan referensi lintas owner atau event invalid.

## P18 — notes dan collaborative editor

- ACC-P18-01: rich note dengan tables/media/code export-import-edit round-trip; pin/search/share/mention/context actions tidak menghilangkan content atau metadata.
- ACC-P18-02: dua editor mengubah document bersamaan; Yjs persistence/reconnect/offline sync/awareness mengikuti baseline; restart server tidak menghapus updates.
- ACC-P18-03: read-only public/group/revoked editor tidak bisa mengirim write updates melalui socket maupun API; deleted note/attachments diproses sesuai lifecycle.

## P19 — calendar

- ACC-P19-01: calendar default/color/grants dan timed/all-day event CRUD/range queries bekerja; month/week/list/editor surfaces yang tersedia punya behavior baseline.
- ACC-P19-02: recurrence/series edits/exceptions/cancel dan DST/timezones diuji fake clock; recurrence expansion bounded dan attendee status tidak berubah karena offset waktu.
- ACC-P19-03: attendee responses/private fields/access revoked dan model calendar tool action diuji; unauthorized tool argument tidak dapat membaca/mengubah calendar B.

## P20 — automation dan subagents

- ACC-P20-01: RRULE automation menjalankan model/prompt/folder/chat/channel/terminal target yang tepat; run history/next-last run/status/notifications sama dengan contract.
- ACC-P20-02: kill worker setelah provider response sebelum commit; idempotent recovery tidak mengulangi inference ketika response sudah persisted; kasus response hilang sebelum persistence dilaporkan sebagai indeterminate, bukan klaim exactly-once absolut.
- ACC-P20-03: subagent limits/tools/result/events/timer/compaction diuji; revoke owner/provider/target permissions sebelum jadwal membuat authorized failure, tidak bypass karena background job.

## P21 — terminal dan code execution

- ACC-P21-01: remote terminal HTTP/WS create/attach/resize/input/output/close/reconnect menghasilkan sesi nyata dengan cwd/chat ownership yang benar.
- ACC-P21-02: file tree/edit/diff/search/upload/download/rename/delete/notebook/JSON/SQLite/port preview mengikuti baseline; traversal/foreign session access ditolak.
- ACC-P21-03: Jupyter/Pyodide code-output-artifacts/package/session cleanup dan cancel diuji; isolation/resource/egress limits berlaku dan generated files tetap private.

## P22 — feedback, evaluation dan usage

- ACC-P22-01: feedback/rating/comments/tags/snapshot/edit/delete/export, evaluation dataset/jobs dan arena/blind votes diuji sesuai permissions/profile.
- ACC-P22-02: daily/model/connection aggregates mengikuti reported usage termasuk tool/subagent/multi-model steps; retry tidak double count; missing usage tampil unknown, bukan token nol palsu.
- ACC-P22-03: timezone heatmap/filter/admin drill-down/export dibandingkan angka fixture; Direct usage diberi label client-reported/unverified, public share tidak membocorkan metering pribadi.

## P23 — seluruh Admin Settings dan operations

- ACC-P23-01: seluruh 421 config keys dan env/default/persist precedence diuji type/default/save/reset/restart/effect; setiap control Admin terhubung ke service nyata dan permission gate.
- ACC-P23-02: event target/webhook routing/templates/auth/retry/test delivery diuji untuk seluruh 191 event definitions; secret redaction dan ownership berlaku pada config import/export.
- ACC-P23-03: system/health/version/database/maintenance/slim-offline/interface/I18n flags diuji pada feature-on/off profiles; required Kawan attribution tidak hilang oleh admin custom theme.

## P24 — closure dan self-host

- ACC-P24-01: semua enumerated obligations pada coverage registry, termasuk source-file reviews, memiliki semantic review + test/evidence; dynamic branches yang ditemukan ditambahkan ke registry; tidak ada open failure yang disembunyikan sebagai N/A.
- ACC-P24-02: clean install, SQLite/Postgres, upgrade/import/backup/restore/rollback/multi-instance/proxy SSE/WS/private storage/vector/worker smoke diuji pada container deployment profiles.
- ACC-P24-03: endpoint/schema/event/settings/UI/locales/performance/accessibility/security reports mengacu commit/profile yang sama; final report membedakan verified contracts dan declared differences; `npm run build` sukses dan semua phase gates lulus.

## Cara memakai sebagai mandor

Saat memberikan task, pilih cases phase terkait dan child cases yang spesifik untuk reference IDs task. Task yang masih menyebut “semua engines/OAuth/controls” dipecah per contract/provider/control sebelum coding; maksimum sekitar lima file inti dan satu sesi terfokus per child. Parent package tidak dianggap done hanya karena satu happy path bekerja.

Daftar ini berisi 76 minimum cases. Release test suite akan lebih besar karena tiap endpoint/config/adapter/schema obligation mempunyai cases sendiri. Tidak ada case yang sudah berstatus pass pada planning ini.
