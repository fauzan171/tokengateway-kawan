# Audit engine Kawan

## Ringkasan eksekutif

1. Cacat paling langsung: custom system prompt tersimpan tetapi tidak dikirim ke model (E-01).
2. RAG semantik belum tersambung ke ingest: chunk baru tidak diberi embedding; mengaktifkan konfigurasi embedding bisa membuat dokumen tidak terambil (E-02).
3. Riwayat cabang dikirim utuh, tanpa anggaran token, reservasi output, atau ringkasan (E-03).
4. Retrieval memakai pesan terakhir, mencari seluruh dokumen pengguna, dan menerima kecocokan lemah; pertanyaan lanjutan mudah kehilangan rujukan (E-04).
5. Kegagalan retrieval diam-diam mengubah jawaban berbasis dokumen menjadi jawaban tanpa grounding (E-05).
6. EOF prematur bisa tercatat sukses; batas output `length` sudah diketahui backend tetapi tidak dijelaskan UI (E-09/E-10).
7. Streaming berjalan bertahap; pesan parsial saat galat tersimpan. Keduanya bukan kekurangan utama yang diasumsikan brief.
8. Prioritas: pulihkan jalur prompt dan dokumen, lalu konteks dan integritas jawaban. Selisih kualitas terhadap ChatGPT belum diukur dengan model/prompt setara.

## Temuan

Status **Terbukti** berarti perilaku kode terbaca atau tereproduksi, bukan bukti bahwa itulah satu-satunya penyebab keluhan produksi. Estimasi baris adalah perubahan implementasi bersih berikutnya, bukan perubahan dalam audit ini; belum termasuk tes regresi.

### E-01 Custom system prompt tidak mencapai model

- Bukti: `src/lib/chat/system-prompt.ts:118`, `src/lib/chat/system-prompt.ts:120` menyimpan prompt sebagai root terpisah; `src/lib/chat/tree.ts:48` berhenti pada root ancestry. `src/lib/chat/generate.ts:571` hanya membangun jalur menuju placeholder assistant. Payload di `src/lib/chat/generate.ts:679`:

  ```ts
  ...(contextSystem ? [{ role: "system", content: contextSystem }] : []),
  ...(searchSystem ? [{ role: "system", content: searchSystem }] : []),
  ...messages,
  ```

- Dampak ke kualitas jawaban: instruksi pengguna tentang kedalaman, bahasa, peran, dan gaya tidak berpengaruh pada percakapan normal, walaupun berhasil disimpan. Tanpa hasil RAG/web, request normal bahkan tidak memiliki pesan sistem. Ini terjadi pada setiap generasi, bukan hanya setelah giliran pertama.
- Status: Terbukti. Reproduksi `runGeneration` dengan root sistem `AUDIT_CUSTOM_PROMPT` menghasilkan payload dengan role `user` saja.
- Perbaikan: panggil `getSystemPrompt` dan prepend hasilnya pada setiap generasi, termasuk regenerate/continue. Pastikan satu salinan, urutan instruksi konsisten, dan root sistem tidak menjadi giliran percakapan. Sekitar 5-12 baris; tes harus memeriksa payload upstream, bukan sekadar CRUD prompt.

### E-02 Ingest tidak menghasilkan embedding yang dicari retrieval

- Bukti: `src/lib/documents/run-extract.ts:62` menulis chunk dengan `id`, `documentId`, `ordinal`, `text`, `page`, `section`, tanpa embedding; `src/lib/documents/run-extract.ts:74` langsung menandai dokumen `ready`. `prisma/schema.prisma:202` membuat embedding nullable. Sebaliknya `src/lib/documents/retrieve.ts:118`:

  ```ts
  const rows = (await db.documentChunk.findMany({
    where: { ...where, embedding: { not: null } },
    select: SELECT,
  ```

- Bukti integrasi: handler di `src/worker.ts:31` hanya mendaftarkan `chat.generate`, `document.extract`, dan `storage.cleanup`. `document.embed` tercantum sebagai jenis job di `src/lib/jobs/kinds.ts:14`, tetapi tidak memiliki handler. Pencarian pemanggil produksi `embedChunks` hanya menemukan embedding query di `src/lib/documents/retrieve.ts:112`; tidak ada penulis vektor chunk dalam jalur ingest.
- Dampak ke kualitas jawaban: dengan konfigurasi embedding aktif, unggahan normal yang sudah berstatus siap tersaring keluar. Tanpa konfigurasi, keyword retrieval masih dapat menemukannya. Dokumen lama yang diisi vektor lewat mekanisme luar repo tidak tercakup pembuktian ini.
- Status: Terbukti pada jalur aplikasi yang diaudit. Reproduksi retrieval dengan chunk ber-embedding `null`: mode keyword menemukan chunk, mode embedding mengembalikan nol hasil.
- Perbaikan: sambungkan `embedChunks` ke ingest yang sudah ada, simpan vektor sebelum menyatakan pencarian semantik siap; jangan membuat antrean baru jika pemanggilan dalam handler extract mencukupi. Saat vektor belum tersedia, fallback keyword dengan penanda eksplisit. Sekitar 40-80 baris. Dokumen existing perlu pengisian ulang vektor sebagai tindakan terpisah; tidak dijalankan dalam audit ini.

### E-03 Riwayat tidak memiliki anggaran konteks atau kompresi

- Bukti: `src/lib/chat/generate.ts:558` memuat semua pesan chat tanpa `take`; `src/lib/chat/tree.ts:41` menelusuri ancestry sampai root. `src/lib/chat/generate.ts:571`:

  ```ts
  const ancestry = buildAncestryPath(rows, generation.assistantMessageId);
  const messages = buildMessages(ancestry, generation.assistantMessageId);
  ```

- Bukti tambahan: `src/lib/chat/generate.ts:127` hanya membuang placeholder, kemudian pesan kosong di baris 145. `src/lib/chat/messages.ts:25` membatasi satu input pada 100.000 karakter; itu bukan batas riwayat atau token. Tidak ada ringkasan, tokenizer, batas context window, atau reservasi token output dalam jalur perakitan tersebut.
- Dampak ke kualitas jawaban: percakapan panjang terus membesar, membawa detail lama dan gambar lama. Ketika melewati kapasitas model, provider dapat menolak request; gateway yang memang memangkas sendiri dapat membuang konteks tanpa keputusan Kawan. Pembengkakan juga menambah biaya/latensi. Penurunan kualitas karena distraksi konteks masih perlu eval; tidak benar bahwa Kawan sekarang melupakan pesan karena sliding window lokal.
- Status: Terbukti untuk ketiadaan pengelolaan konteks; perilaku pemangkasan internal gateway belum diverifikasi.
- Perbaikan: tentukan kapasitas model, hitung seluruh payload termasuk prompt/RAG/gambar, cadangkan output, lalu pilih giliran utuh. Input terbaru yang sendirian melebihi batas harus ditangani eksplisit. Sekitar 60-100 baris bila penghitung token tersedia. Ringkasan terikat cabang dan cutoff baru diperlukan bila eval menunjukkan kebutuhan ingatan panjang; perkiraan tambahan 100-180 baris, bukan menambahkan memori global sekarang.

### E-04 Retrieval kehilangan maksud lanjutan dan mencampur dokumen

- Bukti: `src/lib/chat/generate.ts:598` mengambil hanya user message terakhir untuk query; pemanggilan `retrieveChunks` di baris 615 tidak mengirim `documentIds`, padahal filter tersedia di `src/lib/documents/retrieve.ts:107`. Skor keyword di `src/lib/documents/retrieve.ts:137`:

  ```ts
  const haystack = row.text.toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term)).length;
  return toResult(row, matched / terms.length);
  ```

- Bukti tambahan: `src/lib/documents/retrieve.ts:65` tidak membuang stopword atau melakukan stemming; baris 141 menerima skor apa pun yang positif. Mode vektor juga hanya cosine, `score > 0`, sort, top-k pada baris 123. Tidak ada hybrid fusion atau rerank. `src/lib/chat/generate.ts:104` hanya memutar ulang bagian teks, bukan metadata citation/source; marker `[1]` lama tetap bisa berada dalam teks sementara pemetaan chunk baru berubah.
- Dampak ke kualitas jawaban: "bagaimana pengecualiannya?" tidak membawa topik/dokumen giliran sebelumnya ke pencarian. Kata umum seperti "yang" dapat menarik dokumen lain milik pengguna yang sama. Dalam ringkasan satu dokumen panjang, enam hit query juga belum tentu mewakili keseluruhan dokumen. Metadata sumber lama tidak tersedia untuk menjawab pertanyaan lanjutan tentang sumber tersebut.
- Status: Terbukti untuk mekanisme; reproduksi query `Apa yang terbaru?` mengambil teks `dokumen yang lama` dengan skor 1/3. Besarnya penurunan recall pada korpus pengguna belum diukur.
- Perbaikan: gunakan cakupan dokumen eksplisit bila ada, pertahankan identitas sumber giliran relevan, dan perluas query lanjutan dengan konteks pendek yang relevan. Ganti substring scoring dengan token kata dan penanganan kata umum; ukur recall sebelum menambah reranker. Sekitar 50-100 baris untuk tahap awal; routing ringkasan dokumen penuh merupakan pekerjaan terpisah bila skenario itu dibutuhkan.

### E-05 Grounding gagal tanpa pemberitahuan atau fallback yang nyata

- Bukti: `src/lib/chat/generate.ts:624`:

  ```ts
  } catch {
    // Dokumen rusak/provider embedding mati: jawab tanpa rujukan.
  }
  ```

- Bukti tambahan: `keywordOnly` hanya diisi setelah retrieval sukses di `src/lib/chat/generate.ts:623`; catatan akhir di baris 728 hanya mengenal `keyword-only` dan kegagalan web. `src/lib/documents/retrieve.ts:112` tidak meneruskan signal atau outbound policy ke `embedChunks`. `src/lib/documents/embed.ts:136` memakai `DEFAULT_OUTBOUND_OPTIONS`, yang menolak HTTP/private host tanpa allowlist (`src/lib/net/policy.ts:65`). Konfigurasi allowlist koneksi chat di `src/lib/chat/generate.ts:685` tidak dipakai embedding.
- Dampak ke kualitas jawaban: timeout, embedding rusak, atau endpoint embedding lokal yang ditolak kebijakan menghasilkan jawaban lancar tanpa dokumen. Pengguna tidak tahu bahwa dokumennya gagal dipakai. Embedding query memiliki hingga tiga percobaan masing-masing 60 detik, ditambah backoff 500/1.000 ms (`src/lib/documents/embed.ts:52`, `src/lib/documents/embed.ts:142`), sebelum model chat dipanggil; persiapan dapat menambah sekitar 181,5 detik pada skenario timeout berulang, di luar overhead lain.
- Status: Terbukti untuk jalur kegagalan dan batas konfigurasi; konfigurasi embedding produksi belum diperiksa.
- Perbaikan: fallback keyword secara terukur saat embedding gagal, tampilkan status grounding, dan minta model menyatakan keterbatasan bila dokumen dibutuhkan tetapi tidak tersedia. Teruskan signal serta kebijakan allowlist operator yang sudah ada; jangan menonaktifkan SSRF. Beri deadline retrieval interaktif terpisah dari ingest batch. Sekitar 40-70 baris.

### E-06 Tidak ada deduplikasi dan anggaran dokumen bersama riwayat

- Bukti: `src/lib/documents/context.ts:27` memetakan seluruh chunk masukan tanpa filter; isi langsung ditulis pada baris 30:

  ```ts
  return `[${index + 1}] ${chunk.filename}${lokasi}\n${chunk.text}`;
  ```

- Bukti batas yang sudah ada: `src/lib/chat/generate.ts:618` meminta enam chunk; `src/lib/documents/retrieve.ts:19` membatasi maksimum delapan. `src/lib/documents/chunk.ts:11` menetapkan target 1.000, maksimum 1.200 karakter, overlap target 150. Penyesuaian batas kata di baris 68 dapat memperbesar overlap mendekati 300 karakter; angka 150 bukan jaminan tepat.
- Dampak ke kualitas jawaban: hit berdekatan atau unggahan duplikat bisa menghabiskan slot dengan informasi berulang. Namun klaim "konteks dokumen tanpa batas sama sekali" keliru: jalur ingest normal mengirim paling banyak sekitar 7.200 karakter isi chunk per request, ditambah label/preamble. Yang tidak ada adalah deduplikasi, jaminan panjang pada builder, dan alokasi token dokumen bersama riwayat/output.
- Status: Terbukti. Uji builder mempertahankan dua chunk identik; input sintetis di luar batas chunking normal juga tidak dipangkas builder.
- Perbaikan: deduplikasi teks identik, gabungkan overlap bila metadata menunjukkan chunk bersebelahan, lalu ambil hit sampai budget dokumen habis. Penomoran sitasi harus dibentuk setelah seleksi final. Sekitar 25-50 baris; jangan menaikkan top-k sebelum mengukur cakupan sumber.

### E-07 Tidak ada instruksi dasar jawaban; bahasa web dipaksa Indonesia

- Bukti: `src/lib/chat/system-prompt.ts:89` adalah CRUD teks pengguna, bukan pembentuk persona/prompt dasar. Payload `src/lib/chat/generate.ts:677` hanya memasukkan konteks dokumen, web, dan history. Satu instruksi bahasa eksplisit muncul di `src/lib/search/prompt.ts:46`:

  ```ts
  "Kutip penanda sumber, misalnya [S1], bila memakai isi salah satu sumber di atas.",
  "Jangan mengarang URL atau sumber yang tidak ada di daftar ini.",
  "Jawab dalam bahasa Indonesia.",
  ```

- Dampak ke kualitas jawaban: tidak ada standar aplikasi untuk format, kedalaman sesuai tugas, penjelasan ketidakpastian, atau larangan mengarang secara umum. Larangan mengarang URL berlaku pada prompt web; dokumen memiliki batas data/instruksi dan perintah kutipan (`src/lib/documents/context.ts:19`). Bahasa UI tidak dibaca oleh perakitan prompt; pencarian web dapat menjawab Indonesia meskipun pengguna meminta bahasa lain. Ketiadaan hubungan locale sendiri belum membuktikan penyebab jawaban kaku.
- Status: Terbukti untuk instruksi yang ada/tidak ada; hubungan dengan rasa "kaku" Terduga.
- Perbaikan: sesudah E-01, tambahkan prompt dasar singkat yang mengikuti bahasa permintaan, format tugas, kedalaman yang diminta, dan ketidakpastian. Jadikan locale hanya fallback; hilangkan pemaksaan bahasa pada prompt web. Sekitar 10-25 baris. Jangan menetapkan semua jawaban harus panjang atau semua harus ringkas.

### E-08 Parameter generasi sepenuhnya mengikuti provider

- Bukti: objek request lengkap ada di `src/lib/chat/generate.ts:675`; ujungnya pada baris 681:

  ```ts
  ...messages,
  ],
  stream: true,
  ```

- Bukti tambahan: hanya tiga properti dikirim, yaitu `model`, `messages`, `stream`. Tidak ada `temperature`, `top_p`, `max_tokens`, `max_completion_tokens`, atau `reasoning_effort`. `src/lib/chat/generate.ts:556` mengambil model dari `chat.modelRef`, fallback `deepseek-v4.1-flash` di baris 53.
- Dampak ke kualitas jawaban: Kawan tidak mengendalikan budget output/reasoning atau mencatat parameter efektif gateway. Perbedaan konfigurasi bisa menjelaskan jawaban pendek, tetapi default provider tidak otomatis berarti "malas"; batas output adalah maksimum, bukan target panjang. Nama fallback juga tidak membuktikan kualitas model atau model produksi yang benar-benar dipakai.
- Status: Terbukti untuk payload; klaim bahwa default menyebabkan keluaran buruk Terduga.
- Perbaikan: rekam identitas model/provider dan konfigurasi efektif tanpa prompt/key; tentukan budget output serta effort hanya untuk model yang mendukungnya. Evaluasi dulu sebelum mengubah sampling; jangan mengirim semua parameter ke seluruh provider. Sekitar 25-60 baris untuk konfigurasi model yang benar-benar digunakan. Dokumentasi API menjelaskan `max_completion_tokens`, dukungan effort per model, dan anjuran mengubah salah satu `temperature`/`top_p` [S2].

### E-09 Stream tidak lengkap dapat dinyatakan sukses

- Bukti: `src/lib/chat/generate.ts:386` melakukan flush bila belum melihat `done`, tetapi baris 406 tetap mengembalikan hasil tanpa mewajibkan penanda selesai. `src/lib/chat/generate.ts:754` kemudian menulis `complete`. Parser juga membuang JSON rusak di `src/lib/chat/stream-parse.ts:110`:

  ```ts
  payload = JSON.parse(data);
  } catch {
    continue; // baris rusak dilewati; jangan menjatuhkan seluruh jawaban
  ```

- Bukti tambahan: pembacaan payload pada `src/lib/chat/stream-parse.ts:116` hanya mengolah text, usage, finish reason; objek SSE `error` tidak dipetakan. `src/lib/chat/generate.ts:356` hanya memastikan body ada, tanpa memastikan format streaming yang benar.
- Dampak ke kualitas jawaban: koneksi yang berakhir normal secara HTTP tetapi prematur secara protokol dapat menghasilkan jawaban terpotong atau kosong berstatus selesai. Error di dalam SSE dapat hilang. Ini lebih dekat dengan keluhan "jawaban kurang" daripada galat HTTP yang terlihat jelas.
- Status: Terbukti. Reproduksi EOF setelah satu delta tanpa `[DONE]`/finish reason menghasilkan `complete`, `finishReason: null`. Objek SSE `error` diikuti `[DONE]` tidak menghasilkan error parser.
- Perbaikan: bedakan akhir transport dari akhir generasi; terima `[DONE]` atau finish reason sah, tandai EOF prematur/in-stream error sebagai tidak lengkap sambil mempertahankan teks. Propagasikan kerusakan frame yang menghilangkan konten, tanpa menganggap heartbeat sebagai error. Sekitar 25-50 baris.

### E-10 Batas output diketahui backend, diabaikan UI

- Bukti: `src/lib/chat/stream-parse.ts:125` menangkap finish reason; `src/lib/chat/generate.ts:759` meneruskannya dalam `done`, baris 762 menyimpannya. Namun `src/components/chat-view.tsx:346`:

  ```ts
  } else if (eventType === "done") {
    setIsStreaming(false);
    setActiveGenId(null);
  ```

- Bukti tambahan: cabang tersebut langsung refresh/return pada baris 349 tanpa membaca payload `done`. DTO `src/lib/chat/messages.ts:45` tidak memilih finish reason. Status pesan tetap `complete` untuk `length` (`src/lib/chat/generate.ts:754`).
- Dampak ke kualitas jawaban: pengguna tidak mendapat penjelasan bahwa jawaban berakhir karena batas token, termasuk setelah reload. Klaim bahwa backend sama sekali tidak menangani `finish_reason` salah; celahnya ada pada interpretasi dan penyajian status.
- Status: Terbukti dari backend dan pembacaan consumer UI; uji parser existing dan reproduksi generation mempertahankan `length`.
- Perbaikan: baca payload `done`, tampilkan penanda terpotong, persist metadata yang tersedia bagi DTO/reload, dan tawarkan kelanjutan lewat endpoint yang sudah ada (`src/lib/chat/continue.ts:57`). Jangan otomatis memulai request berbayar baru. Sekitar 20-40 baris.

### E-11 Stop menunggu aktivitas upstream

- Bukti: `src/lib/chat/stop.ts:72` hanya menulis `cancelRequestedAt`. Pemeriksaan terjadi setelah pembacaan berikut di `src/lib/chat/generate.ts:368`; pengecekan stop baru di baris 374:

  ```ts
  const { done, value } = await reader.read();
  ```

- Bukti tambahan: `src/lib/chat/generate.ts:403` benar-benar memanggil `reader.cancel()` ketika keluar loop. Signal fetch di baris 319 hanya gabungan signal worker dan timeout idle, bukan permintaan stop. Retrieval/web pada baris 615/636 juga tidak menerima signal generasi. UI `src/components/chat-view.tsx:451` mengirim POST stop lalu langsung mematikan indikator tanpa memeriksa `response.ok`.
- Dampak ke kualitas jawaban: pada stream aktif, pembatalan menutup body upstream setelah terdeteksi, bukan sekadar berhenti menampilkan. Tetapi ketika model sedang diam/reasoning atau persiapan retrieval berlangsung, stop belum memutus pekerjaan. Sebelum chunk berikutnya, generasi dan biaya provider masih mungkin berjalan. Putusnya browser SSE hanya menghentikan subscriber (`src/lib/chat/sse.ts:238`), sesuai arsitektur worker terpisah.
- Status: Terbukti. Reproduksi stop ketika pembacaan tertahan tidak membatalkan reader; setelah chunk dilepas, reader dibatalkan dan status menjadi `stopped`. Penghentian billing di sisi gateway/provider belum diverifikasi.
- Perbaikan: cek stop sebelum persiapan dan sebelum POST; gunakan polling stop ringan yang membatalkan AbortController selama request tertahan, teruskan signal ke retrieval/web, bersihkan timer di `finally`. UI menunggu hasil stop yang sah. Sekitar 35-65 baris; tidak perlu sistem pub/sub baru.

### E-12 Tidak ada retry otomatis untuk HTTP 429/5xx generasi

- Bukti: kegagalan HTTP menjadi `GenerationError` di `src/lib/chat/generate.ts:354`. Penanganannya di baris 717:

  ```ts
  if (err instanceof GenerationError) {
    await failGeneration(db, generationId, generation.assistantMessageId, err, text, new Date());
    return;
  ```

- Bukti tambahan: `src/lib/jobs/worker.ts:125` menandai job selesai ketika handler kembali. Jadi `retryable: true` pada event bukan retry otomatis. Untuk jalur chat HTTP tersebut: satu percobaan, nol retry, tidak ada backoff. Embedding berbeda: tiga percobaan total, backoff 500 lalu 1.000 ms, tanpa jitter/`Retry-After` (`src/lib/documents/embed.ts:52`, `src/lib/documents/embed.ts:183`).
- Dampak ke kualitas jawaban: kegagalan provider sementara langsung terlihat sebagai jawaban gagal. Ini isu keandalan, bukan bukti jawaban yang sukses menjadi dangkal.
- Status: Terbukti; reproduksi HTTP 429 hanya membuat satu request. Catatan penting: exception lain yang lolos ke worker memang dapat diulang karena `chat.generate` termasuk set idempoten (`src/lib/jobs/kinds.ts:23`); default tiga percobaan (`src/lib/jobs/queue.ts:59`) dengan backoff eksponensial basis 5 detik, jitter 0,5-1, cap 5 menit (`src/lib/jobs/queue.ts:37`). Itu bukan retry 429/5xx di atas dan tidak boleh disamakan dengan replay yang aman setelah output parsial.
- Perbaikan: bila diperlukan, retry terbatas untuk status 429/5xx yang belum menghasilkan output dan aman menurut kontrak provider; hormati `Retry-After` dan jitter. Jangan mengulang timeout ambigu atau stream yang sudah mengeluarkan teks tanpa penanganan duplikasi. Sekitar 30-55 baris; selaraskan klasifikasi job agar exception pasca-output tidak memulai ulang generasi secara buta.

### E-13 Usage provider tersedia, tetapi integrasinya menyimpang

- Bukti: `src/lib/chat/usage.ts:96` memiliki normalisasi integer nonnegatif dan `reported` hanya bila ketiga kolom lengkap. Generasi justru memakai fungsi `recordUsage` lokal di `src/lib/chat/generate.ts:458`; pemanggilan pada baris 769:

  ```ts
  reported: usage !== null,
  ```

- Bukti tambahan: `src/lib/chat/stream-parse.ts:45` hanya memeriksa angka finite, bukan integer nonnegatif. Objek usage dengan sebagian kolom saja tetap diterima pada baris 65. Payload `src/lib/chat/generate.ts:675` tidak mengirim `stream_options.include_usage`, padahal API OpenAI mendokumentasikan opsi itu untuk usage chunk streaming [S2]. Pada stop/error, return di baris 715/719 mendahului `recordUsage` di baris 765.
- Dampak ke kualitas jawaban: bukan kesalahan estimasi karakter bahasa Indonesia; tidak ada estimasi karakter pada jalur ini. Masalahnya observabilitas: usage bisa tidak diminta, laporan parsial dianggap lengkap, dan jalur gagal/stop tidak tercatat di tabel usage. Sulit membedakan jawaban benar-benar pendek dari budget output, reasoning, atau metrik yang hilang. Dampak ke isi jawaban tidak langsung.
- Status: Terbukti. Reproduksi `usage: {prompt_tokens: 5}` tersimpan `reported: 1` dengan `completionTokens: null`.
- Perbaikan: pakai normalizer `usage.ts` yang sudah ada, hapus fungsi duplikat, dan minta usage streaming untuk provider yang mendukungnya. Catat kegagalan/stop sebagai unreported bila angka tidak tersedia; jangan mengarang nol atau mencoba menebak biaya dari panjang teks. Sekitar 15-35 baris, termasuk penghapusan kode duplikat.

### E-14 Grounding web hanya cuplikan singkat

- Bukti: `src/lib/search/prompt.ts:12`:

  ```ts
  const SNIPPET_MAX = 300;
  ```

- Bukti tambahan: `src/lib/chat/generate.ts:636` meminta maksimum lima hasil. `src/lib/search/web.ts:125` menyimpan judul, URL, snippet yang juga dipotong 300 karakter; tidak ada pengambilan isi halaman. `src/lib/search/prompt.ts:41` membentuk satu pesan sistem dari hasil tersebut.
- Dampak ke kualitas jawaban: dengan web aktif, model menerima paling banyak sekitar 1.500 karakter isi cuplikan, selain judul/URL. Sumber dapat relevan tetapi tidak menyediakan angka, pengecualian, atau isi pasal yang diperlukan. Daftar sumber bukan bukti bahwa halaman telah dibaca atau seluruh klaim sudah didukung. Pencarian juga menggunakan query pesan terakhir, bukan pencarian bertahap.
- Status: Terbukti untuk batas bukti; selisih terhadap jawaban browsing ChatGPT pada pertanyaan identik belum diverifikasi.
- Perbaikan: dahulu nyatakan keterbatasan snippet dan larang klaim detail yang tidak didukung, sekitar 5-10 baris. Hanya bila eval menunjukkan kebutuhan, ambil isi sejumlah URL terpilih dengan kebijakan outbound yang ada, ekstraksi teks, dan budget; perkiraan tambahan 70-120 baris. Tidak perlu mesin agent/tool baru untuk perbaikan awal.

## Jawaban pertanyaan audit

### A. Perakitan konteks

1. **Susunan `messages`:** muat pesan chat, pilih ancestry root-ke-placeholder, buang placeholder dan konten kosong, ubah text/image ke format OpenAI. Prepend konteks dokumen lalu web jika tersedia (`src/lib/chat/generate.ts:123`, `src/lib/chat/generate.ts:558`, `src/lib/chat/generate.ts:677`). Konteks RAG/web dirakit ulang setiap request. Custom system prompt normalnya tidak masuk sama sekali; bukan dikirim sekali (E-01).
2. **Pemotongan riwayat:** tidak ada batas jumlah pesan/token pada ancestry. Penyaringan hanya placeholder/konten kosong (`src/lib/chat/generate.ts:128`, `src/lib/chat/generate.ts:145`). Cabang lain dikeluarkan oleh ancestry, bukan oleh pemotongan usia. Batas 100.000 karakter berlaku per input (`src/lib/chat/messages.ts:25`, `src/lib/chat/messages.ts:151`), bukan keseluruhan konteks (E-03).
3. **Ringkasan/kompresi:** tidak ada dalam jalur `src/lib/chat/generate.ts:571` sampai payload baris 675. Dampaknya konteks terus bertambah tanpa reservasi output (E-03). OpenAI mendokumentasikan compaction untuk Responses API [S1/S3]; itu tidak membuktikan implementasi internal ChatGPT web atau kebijakan ringkasannya. Premis brief bahwa ChatGPT selalu meringkas dengan cara tertentu belum diverifikasi.
4. **Pasangan tool:** tidak ada pemotongan lokal yang dapat memutus pasangan saat ini. Jalur ini juga belum merepresentasikan protokol tool calling: tipe pesan hanya role/content (`src/lib/chat/generate.ts:93`), builder hanya text/image (`src/lib/chat/generate.ts:130`), parser hanya text/usage/done (`src/lib/chat/stream-parse.ts:25`). Tidak ada `tools`, `tool_calls`, atau `tool_call_id` dalam payload. RAG/web dijalankan aplikasi sebelum model, bukan loop tool model. Jika nanti menambah tools dan budget history, pasangan call/result harus dipertahankan sebagai unit; tidak ada alasan menambah tool engine hanya untuk audit ini.

### B. Kualitas prompt

5. **Isi `system-prompt.ts`:** validasi, penyimpanan, pembacaan, penghapusan teks kustom; maksimum 8.000 karakter (`src/lib/chat/system-prompt.ts:42`, `src/lib/chat/system-prompt.ts:89`). Tidak berisi template format/panjang/bahasa/anti-halusinasi. Instruksi parsial ada pada konteks dokumen dan web (`src/lib/documents/context.ts:19`, `src/lib/search/prompt.ts:46`), dengan cakupan E-07. Praktik yang didukung dokumentasi OpenAI adalah instruksi eksplisit, pemisahan konteks, dan evaluasi per model [S4]; prompt rahasia ChatGPT tidak diasumsikan diketahui.
6. **Bahasa UI:** tidak dipakai. Data chat yang dibaca hanya id/userId/modelRef (`src/lib/chat/generate.ts:552`); prompt web memaksa Indonesia (`src/lib/search/prompt.ts:48`). Ini membuktikan ketidaksambungan bahasa, bukan penyebab pasti gaya kaku (E-07).
7. **Parameter:** semua parameter yang ditanyakan absen; payload hanya model/messages/stream (`src/lib/chat/generate.ts:675`). Provider/gateway menentukan default. Tidak dapat disimpulkan default selalu pendek; perlu mengukur model dan parameter efektif (E-08, E-16).

### C. RAG / dokumen

8. **Embedding/chunk/top-k/rerank:** model berasal dari `EMBEDDING_MODEL`, endpoint `EMBEDDING_BASE_URL`; tidak ada nama default (`src/lib/documents/embed.ts:71`). Salah satunya kosong berarti keyword. Chunk target 1.000 karakter, minimum titik potong 800, maksimum 1.200; ekor/halaman pendek boleh lebih pendek; overlap target 150 dengan penyesuaian batas kata (`src/lib/documents/chunk.ts:11`, `src/lib/documents/chunk.ts:40`, `src/lib/documents/chunk.ts:68`). Enam chunk pada generasi, hard cap retrieval delapan. Ranking cosine atau rasio substring; tanpa rerank (`src/lib/documents/retrieve.ts:123`, `src/lib/documents/retrieve.ts:135`). Fungsi embedding tersedia, tetapi ingest tidak memakainya (E-02).
9. **Penyisipan/sitasi:** sebagai system message sebelum history (`src/lib/chat/generate.ts:679`). Preamble menyatakan dokumen adalah data, bukan instruksi; setiap chunk membawa `[n]`, nama file, halaman (`src/lib/documents/context.ts:19`, `src/lib/documents/context.ts:30`). `extractCitations` hanya memetakan marker yang ditulis model dan berada dalam daftar chunk (`src/lib/documents/citations.ts:27`). Ini validasi identitas marker, bukan validasi bahwa klaim didukung sumber. Web memakai `[S1]` agar namespace berbeda (`src/lib/search/prompt.ts:37`).
10. **Deduplikasi/batas:** tidak ada deduplikasi chunk atau budget token konteks dokumen. Ada batas top-k dan ukuran chunk normal, sehingga isi dokumen normal bukan tanpa batas (E-06). `Set` di `src/lib/documents/retrieve.ts:67` menduplikasi kata query, bukan chunk; `Map` di `src/lib/documents/citations.ts:26` menduplikasi sitasi tampilan, bukan teks yang masuk prompt.

### D. Streaming dan persepsi kualitas

11. **Kapan token dikirim:** sesudah frame SSE lengkap tersedia, bukan menunggu seluruh jawaban. Parser menahan hanya frame/byte UTF-8 yang belum lengkap (`src/lib/chat/stream-parse.ts:139`, `src/lib/chat/stream-parse.ts:167`). Setiap delta menunggu penulisan `ChatMessagePart`, lalu `GenerationEvent` (`src/lib/chat/generate.ts:694`, `src/lib/chat/generate.ts:703`). Subscriber polling setiap 150 ms (`src/lib/chat/sse.ts:28`, `src/lib/chat/sse.ts:188`). Jadi bertahap, dengan latensi DB/polling. Pengaruh terhadap kehalusan pada beban nyata masih Terduga (E-15).
12. **Stop:** POST menulis flag; worker mengecek sesudah chunk terbaca lalu `reader.cancel()` menutup body. Tidak langsung membatalkan fetch yang sedang menunggu. Saat idle, batas yang digunakan adalah 90 detik (`src/lib/net/policy.ts:81`, `src/lib/chat/generate.ts:312`), bukan total 15 detik yang juga tercantum pada policy. Browser disconnect tidak otomatis menghentikan job. Status biaya provider setelah cancel belum dapat dijamin (E-11).
13. **Retry 429/5xx:** chat satu attempt, nol retry/backoff; embedding tiga attempt total dengan 500/1.000 ms. Backoff worker hanya terpakai jika exception lolos dari handler, bukan `GenerationError` yang sudah ditangani (`src/lib/chat/generate.ts:717`, `src/lib/jobs/worker.ts:125`). Detail dan risiko replay: E-12.
14. **Partial saat gagal:** ya, `failGeneration` menyimpan `partialText` di contentJson (`src/lib/chat/generate.ts:519`), stop juga demikian (`src/lib/chat/generate.ts:486`). Delta sudah durable di tabel part/event sebelum selesai. Pengecualian: worker signal abort langsung return (`src/lib/chat/generate.ts:711`); `getChat` membaca contentJson, bukan merekonstruksi parts (`src/lib/chat/messages.ts:45`, `src/lib/chat/messages.ts:84`). Karena itu jaminan partial pada transport error tidak boleh digeneralisasi ke crash/shutdown; pemulihan crash menyeluruh belum diuji.

### E. Kebenaran teknis

15. **Hitungan token:** berasal dari `usage` provider, bukan estimasi karakter. Bila tidak dilaporkan, token null (`src/lib/chat/generate.ts:466`); `usage.ts` menjumlah data, bukan melakukan tokenisasi (`src/lib/chat/usage.ts:130`). Masalah nyata adalah normalizer tidak dipakai generator dan usage streaming tidak diminta, bukan bias estimasi bahasa Indonesia (E-13).
16. **`finish_reason: "length"`:** parser, event, dan tabel Generation menangkapnya (`src/lib/chat/stream-parse.ts:125`, `src/lib/chat/generate.ts:759`). UI tidak membacanya dan DTO pesan tidak membawanya; pengguna masih melihat jawaban selesai tanpa penanda terpotong (E-10). EOF tanpa finish reason merupakan cacat terpisah (E-09).

## Tabel prioritas

P1 = koreksi langsung jalur jawaban sebelum tuning; P2 = ketahanan/ketepatan pendukung; P3 = ukur dulu. Usaha memperkirakan implementasi minimum, belum termasuk pengujian provider dan data existing.

| ID | Dampak | Usaha | Prioritas |
| --- | --- | --- | --- |
| E-01 | Instruksi kustom hilang pada request normal | Kecil, 5-12 baris | P1 pertama |
| E-02 | Dokumen siap tidak terambil ketika embedding aktif | Sedang, 40-80 baris; data existing terpisah | P1 |
| E-03 | Riwayat melampaui kapasitas; output tidak dicadangkan | Sedang, 60-100 baris; kompresi tahap berikutnya | P1 |
| E-04 | Dokumen salah/rujukan lanjutan hilang | Sedang, 50-100 baris | P1 |
| E-05 | Jawaban tanpa grounding disajikan tanpa pemberitahuan | Sedang, 40-70 baris | P1 |
| E-09 | Jawaban tidak lengkap dianggap sukses | Kecil-sedang, 25-50 baris | P1 |
| E-10 | Pengguna tidak tahu output mencapai batas | Kecil, 20-40 baris | P1 |
| E-07 | Instruksi kedalaman/bahasa tidak konsisten | Kecil, 10-25 baris; perlu eval | P2, sesudah E-01 |
| E-06 | Slot konteks habis oleh informasi berulang | Kecil-sedang, 25-50 baris | P2 |
| E-11 | Stop terlambat; pekerjaan upstream masih berjalan | Sedang, 35-65 baris | P2 |
| E-12 | Gangguan sementara tidak dipulihkan | Sedang, 30-55 baris | P2 |
| E-13 | Data token/budget tidak dapat dipercaya sepenuhnya | Kecil, 15-35 baris | P2 |
| E-14 | Web hanya memberi bukti berupa cuplikan pendek | Kecil untuk kejujuran batas; sedang untuk fetch | P2 |
| E-08 | Parameter/model efektif belum dikendalikan | Kecil-sedang, 25-60 baris; ukur dahulu | P3 |
| E-15 | Kemungkinan streaming tersendat karena DB | Pengukuran dahulu | P3 |
| E-16 | Perbandingan model/provider mungkin tidak setara | Eval terkontrol; belum ada estimasi perubahan kode | P1 untuk diagnosis, bukan penggantian model |

Urutan kerja yang disarankan: E-01/E-02, E-04/E-05, lalu E-03/E-09/E-10. Jalankan eval kecil dengan model/provider sama pada tiap tahap. Jangan sekaligus mengubah prompt, model, sampling, top-k, dan UI karena penyebab perbaikan tidak akan dapat dibedakan.

## Yang TIDAK perlu diubah

- **Pohon cabang menjadi riwayat datar.** `src/lib/chat/tree.ts:41` mengikuti parent dan menolak siklus/parent hilang; `src/lib/chat/generate.ts:571` memilih cabang generasi. Ini mencegah jawaban dari cabang lain bercampur. Tambahkan budget di atas jalur ini, bukan membuang ancestry.
- **Streaming menjadi buffer jawaban penuh.** Parser mengeluarkan frame lengkap segera, memakai decoder UTF-8 streaming (`src/lib/chat/stream-parse.ts:167`). Endpoint memasang `X-Accel-Buffering: no` (`src/app/api/kawan/v1/chat/[chatId]/stream/route.ts:32`). Keberadaan header tidak membuktikan semua proxy deployment mematuhinya, tetapi jalur aplikasi tidak sengaja menunggu jawaban penuh.
- **Penyimpanan partial dan event durable.** `src/lib/chat/generate.ts:694`, `src/lib/chat/generate.ts:519` sudah menyimpan delta dan partial. Subscriber mendukung `seq > afterSeq` (`src/lib/chat/sse.ts:188`); mekanisme ini berguna untuk replay. UI sekarang selalu membuka `afterSeq=0` (`src/components/chat-view.tsx:301`), sehingga jangan menyebut auto-resume end-to-end sudah teruji.
- **Pelaporan usage menjadi perkiraan karakter.** Pertahankan null untuk tidak dilaporkan serta normalizer integer nonnegatif di `src/lib/chat/usage.ts:91`. Satukan pemanggilnya; jangan menambah angka perkiraan ke ledger biaya.
- **Kutipan, batas data/instruksi, dan isolasi pemilik dokumen.** Ketiganya sudah punya dasar yang benar pada `src/lib/documents/context.ts:19`, `src/lib/documents/citations.ts:30`, dan `src/lib/documents/retrieve.ts:106`. Perbaiki pemilihan sumber; jangan menghapus batas kepemilikan.
- **Idle timeout menjadi timeout total 15 detik.** Generasi memang memakai 90 detik tanpa byte baru (`src/lib/chat/generate.ts:307`, `src/lib/net/policy.ts:81`). Stream yang terus mengalir boleh lebih panjang. Nilai ideal untuk model produksi belum diukur; tidak ada bukti untuk memotong semua jawaban pada detik ke-15.
- **Stack, CSS, i18n, atau framework agent baru.** Cacat utama terletak pada sambungan fungsi yang sudah tersedia, terutama `getSystemPrompt` (`src/lib/chat/system-prompt.ts:130`) dan `embedChunks` (`src/lib/documents/embed.ts:232`). Perbaikan awal tidak memerlukan framework, vector DB, atau dependency baru.

## Cakupan dan verifikasi

Audit 19 Oktober 2026 terhadap working tree cabang `feat/nt-p1-auth`, bukan verifikasi deployment. Sembilan berkas wajib dibaca penuh: `generate.ts` 774 baris, `sse.ts` 243, `stream-parse.ts` 176, `messages.ts` 337, `system-prompt.ts` 154, `embed.ts` 263, `policy.ts` 361, stream `route.ts` 115, `usage.ts` 339. Pemanggil, worker, retrieval/chunk/context/citations, prompt web, dan consumer SSE juga ditelusuri. Komentar kode dibandingkan dengan implementasi; komentar bahwa sesuatu sudah ditangani tidak dijadikan bukti tunggal.

Perubahan yang sudah ada pada UI/i18n/e2e dipertahankan. Audit hanya menambahkan laporan ini; tidak mengubah aplikasi, dependency, skema, atau migrasi; tidak commit/push/restart/deploy. Tidak memanggil model berbayar atau membaca DB produksi.

Pemeriksaan yang dijalankan:

```sh
./node_modules/.bin/vitest run src/lib/chat/stream-parse.test.ts src/lib/chat/tree.test.ts src/lib/documents/chunk.test.ts src/lib/documents/context.test.ts src/lib/documents/citations.test.ts
```

Hasil: **5 berkas, 43 tes lulus**. Ini tes murni yang tidak menjalankan migrasi DB. Kelulusan tidak meniadakan celah integrasi generation/ingest/UI.

Reproduksi tambahan memakai `runGeneration` dan retrieval asli, DB memori tiruan, fetch sintetis, serta kunci sintetis; tidak ada koneksi provider nyata. Skrip sesi: `/tmp/kawan-engine-audit-check.cjs`, dijalankan dengan `./node_modules/.bin/tsx /tmp/kawan-engine-audit-check.cjs`. Hasil **10 pemeriksaan lulus**: prompt hilang, payload tiga properti, EOF sukses palsu, `length` tersimpan, satu request saat 429, usage parsial dianggap reported, partial tersimpan saat transport error, mode embedding mengecualikan vektor null, builder mempertahankan duplikat/tanpa cap sendiri, error SSE diabaikan, serta stop menunggu chunk. Beberapa assertion dikelompokkan dalam satu pemeriksaan. Timer idle dibuat `unref` hanya pada proses uji agar proses audit tidak menunggu timer yang tersisa.

Pemeriksaan kecil berikut dapat dijalankan ulang dari root repo tanpa skrip sementara, DB, jaringan, atau perubahan aplikasi. Ia memverifikasi perilaku parser saat ini, termasuk penanganan `length` yang memang sudah ada:

```sh
./node_modules/.bin/tsx -e '
const assert = require("node:assert/strict");
const { createStreamParser } = require("./src/lib/chat/stream-parse.ts");
const bytes = (s) => new TextEncoder().encode(s);
const frame = (content, finish_reason = null) =>
  "data: " + JSON.stringify({ choices: [{ delta: { content }, finish_reason }] }) + "\n\n";
const eof = createStreamParser();
const partial = [...eof.push(bytes(frame("Belum selesai"))), ...eof.flush()];
assert.equal(partial.some((d) => d.kind === "done"), false);
const limited = createStreamParser();
limited.push(bytes(frame("Terpotong", "length")));
assert.equal(limited.flush()[0].finishReason, "length");
const failed = createStreamParser();
assert.deepEqual(failed.push(bytes("data: {\"error\":{\"message\":\"gagal\"}}\n\ndata: [DONE]\n\n")),
  [{ kind: "done", finishReason: null }]);
console.log("3 pemeriksaan parser lulus; lihat E-09/E-10");
'
```

## Sumber pembanding

Sumber berikut dibuka dan dibaca pada tanggal audit. Semuanya dokumentasi API OpenAI, **bukan dokumentasi implementasi internal ChatGPT web**.

- **[S1] Conversation state:** <https://developers.openai.com/api/docs/guides/conversation-state>. Menjelaskan pengelolaan history, context window yang juga mencakup output/reasoning, dan risiko melampaui window. Mendukung diagnosis E-03, bukan klaim algoritme ringkasan ChatGPT.
- **[S2] Create chat completion:** <https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create>. Mendokumentasikan `stream_options.include_usage`, keterbatasan usage saat stream terputus, arti `finish_reason`, `max_completion_tokens`, `reasoning_effort`, serta sampling. Mendukung E-08/E-10/E-13; kesamaan perilaku semua provider compatible tidak diasumsikan.
- **[S3] Compaction:** <https://developers.openai.com/api/docs/guides/compaction>. Mendokumentasikan compaction Responses API dan item state yang dipadatkan. Ini contoh mekanisme publik untuk percakapan panjang, bukan alasan wajib migrasi API.
- **[S4] Prompt engineering:** <https://developers.openai.com/api/docs/guides/prompt-engineering>. Menjelaskan instruksi eksplisit, message roles, pemisahan batas konteks, variasi perilaku antar model/snapshot, dan evaluasi. Mendukung usulan E-07 dan pembandingan terkontrol E-16.

Dua halaman DeepWiki yang dicoba, yaitu <https://deepwiki.com/open-webui/open-webui/6-backend-processing-pipeline> dan <https://deepwiki.com/danny-avila/LibreChat/5.1-baseclient-architecture>, sama-sama membalas **HTTP 429**. Isi halaman tidak berhasil diverifikasi. Laporan tidak mengutip perilaku Open WebUI/LibreChat dari halaman yang gagal dibaca atau menganggap peta DeepWiki sebagai bukti primer.

## Temuan terduga dan belum diverifikasi

### E-15 Penulisan DB per delta mungkin mengganggu kelancaran

- Bukti: `src/lib/chat/generate.ts:694` menunggu satu insert part untuk setiap delta; baris 703 kemudian menunggu publish event. Publikasi memakai transaksi baca-seq/tulis-event di `src/lib/chat/generate.ts:423`:

  ```ts
  return db.$transaction(async (tx) => {
  ```

- Dampak ke kualitas jawaban: mekanisme ini berpotensi menambah jeda pada SQLite atau saat beberapa generasi bersamaan. Belum ada pengukuran latensi transaksi, waktu token pertama, atau jeda antardelta pada beban deployment; tidak ada bukti ia mengubah isi jawaban model.
- Status: Terduga.
- Perbaikan: ukur dahulu p50/p95 waktu persiapan, token pertama, transaksi per delta, dan jeda tampilan. Jika DB terbukti dominan, coalesce delta selama interval kecil dengan flush terminal/cancel serta replay durable tetap benar; sekitar 25-50 baris. Jangan mengganti transport atau DB berdasarkan dugaan ini.

### E-16 Perbandingan model dan konfigurasi dengan ChatGPT belum setara

- Bukti lokal: `src/lib/chat/generate.ts:53`:

  ```ts
  export const DEFAULT_MODEL = "deepseek-v4.1-flash";
  ```

- Bukti tambahan: `src/lib/chat/generate.ts:556` mengutamakan `chat.modelRef`; kode ini tidak membuktikan model aktif produksi, model sebenarnya di balik alias gateway, atau mode ChatGPT yang dipakai owner. `src/lib/documents/embed.ts:72` membaca nama model embedding dari env; nilainya di deployment belum diperiksa. Tidak tersedia pasangan jawaban/prompt owner untuk menilai kesenjangan kualitas secara langsung.
- Dampak ke kualitas jawaban: perbedaan model, effort, akses web/dokumen, atau instruksi dapat lebih besar daripada efek UI/streaming. Besarnya kontribusi masing-masing belum dapat dihitung. Klaim bahwa ChatGPT punya prompt, suhu, atau mekanisme kompresi internal tertentu juga belum diverifikasi; dokumentasi API [S1-S4] tidak cukup untuk membuktikannya.
- Status: Belum diverifikasi.
- Perbaikan: siapkan 12 kasus tetap: 3 instruksi/gaya bahasa Indonesia, 3 penalaran/kode, 3 dokumen dengan sumber jawaban diketahui, 3 pertanyaan lanjutan/riwayat panjang. Bandingkan Kawan dengan request langsung ke provider memakai model/snapshot dan parameter sama, kemudian ulangi dengan perbaikan E-01/E-02 secara terpisah. Nilai ketepatan, kelengkapan, kepatuhan instruksi, dukungan sitasi, serta latensi; ulangi kasus stokastik. ChatGPT web menjadi pembanding produk dengan mode tercatat, bukan bukti bahwa model/backend-nya identik. Belum perlu perubahan kode aplikasi; skrip evaluasi minimum sekitar 40-80 baris bila pengujian provider kemudian diotorisasi.
