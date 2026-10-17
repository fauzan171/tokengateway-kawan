# SDD-AG-3: Kontrak HTTP, DTO dan event

Status: target API baru. Prefix `/api/kawan/v1`; route chat/auth existing tidak
diubah breaking. Route baru Node runtime; otorisasi server setiap request.
Semua contoh memakai ID contoh dan tidak menggambarkan data produksi.

## Aturan lintas endpoint

Session cookie HttpOnly, Secure pada HTTPS dan SameSite=Lax. Mutasi cookie-auth
memvalidasi Origin terhadap origin kanonik operator; tidak percaya forwarded host
arbitrer. Input JSON harus object, unknown field ditolak, ukuran body dibatasi.
userId/role/status/leaseToken/storageKey tidak dapat ditentukan klien.
Resource hilang dan resource pengguna lain sama-sama 404.

Respons sukses `{data: ..., requestId}`; galat memakai envelope existing
`{error:{code,message,requestId,retryable,details?}}`. Header X-Request-Id seragam.
Envelope ini khusus API task baru; frontend chat existing tetap memakai kontraknya.
Semua API private dan SSE memakai Cache-Control:no-store.

Idempotency-Key wajib untuk create task/run, message, interaction answer dan cancel.
Scope key per pengguna; digest mencakup method+path+body kanonik. Key sama dan isi
sama → status/response semula; isi berbeda →409 IDEMPOTENCY_CONFLICT. Simpan 24 jam;
bukan mekanisme retry provider. Mutasi revision memakai If-Match `"<integer>"`;
hilang→428, mismatch→409 REVISION_CONFLICT dengan revision aman terbaru.

Limit request default: teks input 100.000 karakter, JSON 256 KiB, list page 20
maksimum100. Cursor opak berbasis pasangan (createdAt,id), diikat user/filter/sort
serta ditandatangani. List mengembalikan `{items,nextCursor:null|string}`.
Text input kosong ditolak422; ID/enum/bounds salah400 atau422 sesuai validasi.

## DTO publik

```typescript
type RunStatus = 'queued'|'running'|'waiting_input'|'waiting_approval'|
  'completed'|'failed'|'cancelled'|'indeterminate';
type TaskDto = { id:string; title:string; status:'active'|'archived';
  activeRunId:string|null; revision:number; createdAt:string; updatedAt:string };
type RunDto = { id:string; taskId:string; status:RunStatus; revision:number;
  modelId:string; stepCount:number; lastEventSeq:number; deadlineAt:string;
  cancelRequestedAt:string|null; errorCode:string|null; startedAt:string|null;
  finishedAt:string|null; interaction:InteractionDto|null; artifacts:ArtifactDto[] };
type ArtifactDto = { id:string; name:string; mime:string; sizeBytes:number;
  direction:'input'|'output'; status:'staging'|'processing'|'ready'|'failed'|'deleting';
  downloadPath:string|null; previewPath:string|null };
type InteractionDto = { id:string; kind:'input'|'approval'|'handover'; revision:number;
  prompt:string; options?:string[]; actionSummary?:{tool:string;target:string;dataSummary:string};
  expiresAt:string };
```

Task detail menambahkan messages, paginated steps dan recentRuns. Run tidak
mengembalikan Job row, konfigurasi rahasia atau args tool mentah. Step DTO hanya
id, ordinal, label, status, timestamps, source/artifact refs serta safe error.

## Endpoint inti

| Method / path | Body / query | Respons dan perilaku |
|---|---|---|
| POST /tasks | `{title?,input,connectionId,modelId,artifactIds?:string[]}` | 202 `{task:TaskDto,run:RunDto}`; atomik membuat task+run+job; title default dari input terpotong |
| GET /tasks | `status=active\|archived&cursor?&limit?&q?` | 200 page<TaskDto>; q maksimum200 karakter mencari title/input pemilik |
| GET /tasks/:taskId | `messageCursor?&stepCursor?` | 200 task snapshot + page messages/recentRuns; ETag revision |
| PATCH /tasks/:taskId | `{title?:string,status?:active\|archived}` + If-Match | 200 TaskDto; title 1..200 karakter |
| DELETE /tasks/:taskId | If-Match | 202 `{id,status:'deleting'}`; tombstone dan cleanup; request berulang oleh pemilik tetap aman |
| POST /tasks/:taskId/messages | `{input,connectionId?,modelId?,artifactIds?}` | 202 RunDto; run baru dari follow-up setelah terminal; run aktif→409 RUN_ACTIVE; tidak menyisipkan pesan diam-diam ke run berjalan |
| GET /tasks/:taskId/runs | cursor/limit | 200 page<RunDto> dari task pemilik |
| GET /tasks/:taskId/runs/:runId | tanpa body | 200 RunDto + safe step snapshot; run harus milik task |
| POST /tasks/:taskId/runs/:runId/cancel | `{}` + If-Match | 202 RunDto; terminal→200 tanpa efek baru; cancel intent segera, hasil terminal setelah tool benar-benar berhenti atau indeterminate |
| POST /tasks/:taskId/runs/:runId/interactions/:interactionId/answer | `{decision:'approve'\|'reject'}` atau `{text:string}` atau `{handover:'return'}` + If-Match interaction | 202 RunDto jika dijadwalkan; reject/expire terminal cancelled; digest/izin stale→409; satu kali konsumsi |
| GET /tasks/:taskId/runs/:runId/events | `afterSeq=0\|integer` | 200 text/event-stream; owner dicek sebelum header; lihat kontrak di bawah |
| POST /artifacts | multipart `file` + `taskId?` | 202 ArtifactDto; validasi byte/type/name, simpan staging lalu proses async |
| GET /artifacts/:artifactId | tanpa body | 200 ArtifactDto; status polling |
| GET /artifacts/:artifactId/download | tanpa body | 200 stream attachment setelah owner+status+storage check; nosniff; ID tidak menjadi path |
| GET /artifacts/:artifactId/preview | tanpa body | 200 safe preview: text/PDF/image yang divalidasi; HTML output di origin terisolasi; bila belum tersedia→415 |
| DELETE /artifacts/:artifactId | tanpa body | 202 deleting; artefak terpakai run aktif→409 sampai cancel; cleanup referensi dimiliki pengguna |
| GET /tasks/:taskId/export | `format=json\|markdown` | 200 attachment; snapshot tanpa kredensial/metadata internal; JSON schemaVersion1 |
| GET /capabilities | connectionId/modelId | 200 `{chat,agent,web,file,code,browser,reasons}`; dihitung dari gateway + konfigurasi + runtime gate |

Upload progress lokal tidak disamakan extraction ready. Untuk input yang tidak
ready, create task/run membalas409 ARTIFACT_NOT_READY, bukan mengabaikannya.
Endpoint download tidak menerima URL/path arbitrary. Range download opsional;
kalau disediakan, validasi range dan authorization dilakukan setiap request.

Handover memakai endpoint tambahan POST `/tasks/:taskId/runs/:runId/browser-session`
→200 `{viewerUrl,expiresAt}` hanya untuk interaction handover pending milik user.
URL/session viewer berumur ≤60 detik, one-time, no-store; tidak memuat provider API key.
Akses viewer harus melalui proxy yang dapat menghilangkan password/cookie dari
observasi agen dan rekaman. Detail ada di SDD-AG-5.

Admin/status/account/export/delete user memakai baseline route yang sudah ada atau
route baru yang konsisten; sebelum menambah periksa implementasi aktual. Hak admin
membaca status/akun tidak otomatis memberi hak membaca transcript/artefak pengguna.

## Status dan galat

| HTTP | Code | Perlakuan klien |
|---|---|---|
| 401 | UNAUTHORIZED | Arahkan login hanya untuk sesi Kawan |
| 403 | ACTION_FORBIDDEN | Terangkan tindakan tidak diizinkan |
| 404 | RESOURCE_NOT_FOUND | Halaman resource tidak tersedia tanpa membocorkan owner |
| 409 | RUN_ACTIVE / REVISION_CONFLICT / IDEMPOTENCY_CONFLICT | Refresh snapshot; jangan kirim ulang tool |
| 409 | APPROVAL_STALE / INTERACTION_CONSUMED / ARTIFACT_NOT_READY | Tampilkan sebab dan tindakan relevan |
| 410 | EVENT_CURSOR_EXPIRED / INTERACTION_EXPIRED | Ambil snapshot atau hentikan interaksi lama |
| 413 / 415 | BODY_TOO_LARGE / UNSUPPORTED_MEDIA | Perbaiki input file/body |
| 422 | INVALID_INPUT / MODEL_CAPABILITY_MISSING | Pilih model atau perbaiki data |
| 429 | RUN_LIMIT / RATE_LIMITED | Retry-After; tidak membatalkan sesi |
| 502 / 503 / 504 | UPSTREAM_ERROR / RUNTIME_UNAVAILABLE / UPSTREAM_TIMEOUT | Error provider di run atau kegagalan admission yang aman |

Sesudah202, kegagalan eksekusi ditulis ke run/event, bukan mengubah respons HTTP
lama. Error code tidak mengandung raw vendor body, key atau prompt pengguna.

## Kontrak SSE task

Event persisten: `run.queued`, `run.started`, `plan.updated`, `step.started`,
`step.completed`, `step.failed`, `message.delta`, `sources.updated`, `artifact.ready`,
`interaction.requested`, `interaction.resolved`, `usage.updated`, `cancel.requested`,
`run.completed`, `run.failed`, `run.cancelled`, `run.indeterminate`.
Payload dibungkus `{schemaVersion:1,runId,seq,at,data}`. Plan adalah daftar judul
langkah yang dapat direvisi, bukan jaminan seluruh langkah atau chain-of-thought.

```text
id: 7
event: step.completed
data: {"schemaVersion":1,"runId":"run_example","seq":7,"at":"2026-10-17T00:00:00Z","data":{"stepId":"step_example","label":"Membaca sumber","status":"succeeded"}}

```

Payload `data` setiap event dibatasi kontrak berikut; field opsional hanya untuk
kapabilitas yang nyata, bukan raw row/vendor response:

| Event | Bentuk data |
|---|---|
| run.queued / run.started | `{status:'queued'\|'running',revision,segment,modelId}` |
| plan.updated | `{version:number,steps:{id:string,title:string}[]}`; judul pendek, tanpa reasoning privat |
| step.started | `{stepId,ordinal,label,kind:'model'\|'tool',status:'running'}` |
| step.completed | `{stepId,label,status:'succeeded',sourceRefs?:SourceRef[],artifactIds?:string[]}` |
| step.failed | `{stepId,status:'failed'\|'indeterminate',error:{code,message,retryable:false}}` |
| message.delta | `{messageId:string,text:string}`; messageId=run.assistantMessageId, text merupakan tambahan, teks durable sudah commit |
| sources.updated | `{sources:{id:string,title:string,url?:string,artifactId?:string,locator?:string,excerpt:string}[]}`; ID sumber stabil per run |
| artifact.ready | `{artifact:ArtifactDto}` |
| interaction.requested | `{interaction:InteractionDto}` |
| interaction.resolved | `{interactionId,status:'accepted'\|'rejected'\|'expired'\|'cancelled'}` |
| usage.updated | `{reported:boolean,promptTokens:number\|null,completionTokens:number\|null,totalTokens:number\|null,estimatedReservedTokens:number}`; hanya integer nonnegatif, reported=true jika laporan lengkap |
| cancel.requested | `{cancelRequestedAt:string,revision:number}` |
| run.completed | `{status:'completed',revision,messageId,artifactIds:string[]}` |
| run.failed / run.indeterminate | `{status:'failed'\|'indeterminate',revision,messageId,error:{code,message,retryable:false}}` |
| run.cancelled | `{status:'cancelled',revision,messageId,reason:'user'\|'rejected'\|'expired'\|'account_disabled'}` |

SourceRef memakai struktur sumber pada sources.updated tanpa excerpt bila hanya
referensi. Snapshot mencakup teks durable dan source map yang sama; event bukan
satu-satunya penyimpanan jawaban. Tombstone Task.deletedAt disembunyikan dari list,
membatalkan admission/mutasi dan menghasilkan404 pada resource yang dihapus.

`afterSeq` dan Last-Event-ID dibaca sebagai cursor terakhir; query eksplisit menang.
Sequence mulai1. afterSeq0 memutar dari awal yang tersedia, tidak membuat run baru.
Kirim seq>cursor urut; klien mengabaikan seq≤cursor. Event terminal unik dan terakhir;
state terminal + hasil + event commit bersama. Setelah terminal replay selesai, tutup.

Heartbeat `: keepalive` tiap15 detik tanpa seq. Poll batch maksimum100; batasi buffer
per koneksi dan putus klien lambat dengan resume yang aman. Salah cursor400;
cursor melebihi lastEventSeq409; cursor yang dipangkas410 dengan `snapshotPath`
relatif. Cek izin saat buka dan berkala, hentikan jika sesi/resource dicabut.
Transient network error menggunakan reconnect dengan cursor/backoff; event aplikasi
run.failed berbeda dari event transport `error` milik EventSource.

Snapshot detail memuat lastEventSeq sebagai titik sinkronisasi. Klien load snapshot,
lalu replay setelah seq snapshot; gap karena retensi ditangani snapshot ulang.
Tab ditutup hanya menutup SSE. Cancel harus melalui POST terotorisasi.
