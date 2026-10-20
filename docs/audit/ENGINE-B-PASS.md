# Pass B — RAG, jaringan, token

Audit statis. Catatan awal langsung ditulis setelah pembacaan berkas wajib, lalu diperbarui per bagian setelah menelusuri pemanggil. Perkiraan baris perbaikan bukan perubahan yang diterapkan.

Verifikasi: 61 tes dalam 6 berkas lulus melalui `npm test -- src/lib/documents/chunk.test.ts src/lib/documents/context.test.ts src/lib/documents/citations.test.ts src/lib/documents/embed.test.ts src/lib/chat/stream-parse.test.ts src/lib/net/policy.test.ts`. Tes ini memeriksa perilaku yang sudah tercakup, bukan membuktikan semua skenario cacat di bawah; temuan alur generasi/DB berdasarkan penelusuran kode. Tidak menjalankan migrasi atau menghubungi provider aktif. Konfigurasi runtime, semantik usage provider, dan batas reverse proxy belum diverifikasi.

## E-B01 D: Model embedding mengikuti environment, tanpa model bawaan
- Bukti: `src/lib/documents/embed.ts:71`
  ```ts
  const baseUrl = env["EMBEDDING_BASE_URL"]?.trim();
  const model = env["EMBEDDING_MODEL"]?.trim();
  if (!baseUrl || !model) return undefined;
  ```
- Dampak: Nama model aktif tidak bisa dipastikan dari kode; tanpa URL/model, konfigurasi embedding tidak tersedia. Permintaan memakai `config.model` (`src/lib/documents/embed.ts:155`).
- Status: Terbukti
- Perbaikan: Dokumentasikan model/dimensi deployment dan kebijakan perubahan model, sekitar 5-10 baris dokumentasi; model runtime belum diverifikasi.

## E-B02 D: Chunk berbasis karakter; top-k terbatas tetapi tanpa deduplikasi/rerank
- Bukti: `src/lib/documents/chunk.ts:11`
  ```ts
  const TARGET = 1_000;
  const MIN = 800;
  const MAX = 1_200;
  ```
- Bukti: `src/lib/documents/chunk.ts:68`
  ```ts
    let next = end - OVERLAP;
    for (let i = next; i > end - 2 * OVERLAP; i -= 1) {
      if (isSpace(text[i - 1])) {
  ```
- Bukti: `src/lib/documents/retrieve.ts:125`
  ```ts
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  ```
- Dampak: Target 1.000 karakter, batas 1.200, pencarian batas kata sampai 800; halaman/ekor boleh lebih pendek. Overlap nominal 150 (`src/lib/documents/chunk.ts:14`), dapat mendekati 300 karena mundur ke batas kata. Maksimum 5.000 chunk/dokumen (`src/lib/documents/chunk.ts:16`). Top-k bawaan 6, maksimum 8 (`src/lib/documents/retrieve.ts:16`, `src/lib/documents/retrieve.ts:19`); kedua cabang hanya skor, urut, ambil. Chunk sama/bertumpang tindih bisa menghabiskan slot. Deduplikasi kata query bukan deduplikasi chunk.
- Status: Terbukti
- Perbaikan: Deduplikasi teks sebelum top-k, sekitar 10-20 baris; tambah diversifikasi/rerank hanya bila evaluasi retrieval membuktikan kebutuhan.

## E-B03 D: Konteks diberi sumber, tetapi tidak mempunyai anggaran token sendiri
- Bukti: `src/lib/documents/context.ts:29`
  ```ts
      const lokasi = chunk.page === null ? "" : ` (halaman ${chunk.page})`;
      return `[${index + 1}] ${chunk.filename}${lokasi}\n${chunk.text}`;
    })
  ```
- Bukti: `src/lib/documents/context.ts:34`
  ```ts
  return { system: `${PREAMBLE}\n\n${body}`, note: null };
  ```
- Bukti: `src/lib/chat/generate.ts:677`
  ```ts
        messages: [
          // Konteks dokumen lebih dulu, lalu sumber web.
          ...(contextSystem ? [{ role: "system", content: contextSystem }] : []),
  ```
- Dampak: Chunk benar-benar disisipkan sebagai system message sebelum sumber web/history, dengan penanda [n], filename, halaman dan instruksi memperlakukan isi sebagai data (`src/lib/documents/context.ts:19`). Tidak ada pemotongan/token budget di builder maupun penyusunan request (`src/lib/chat/generate.ts:675`). Chat meminta 6 chunk (`src/lib/chat/generate.ts:618`), sehingga isi normal maksimal 7.200 karakter; API retrieval maksimal 8/9.600 karakter, di luar metadata/preamble. Gabungan history/dokumen/web tetap bisa melampaui context window model. Sitasi jawaban dideduplikasi menurut nomor dan penanda di luar jangkauan diabaikan (`src/lib/documents/citations.ts:26`); hasilnya disimpan sebagai citation parts (`src/lib/chat/generate.ts:733`).
- Status: Terbukti
- Perbaikan: Terapkan anggaran dokumen setelah memperhitungkan history/system/output model, sekitar 20-40 baris; jangan menyatakan konteks dokumen sepenuhnya tanpa batas.

## E-B04 D: [P1] Embedding gagal membuat chat kehilangan dokumen tanpa fallback keyword
- Bukti: `src/lib/documents/retrieve.ts:111`
  ```ts
  if (input.embedding) {
    const [embedded] = await embedChunks(
      [{ ordinal: 0, text: query, page: 1, section: null }],
  ```
- Bukti: `src/lib/chat/generate.ts:624`
  ```ts
    } catch {
      // Dokumen rusak/provider embedding mati: jawab tanpa rujukan.
    }
  ```
- Dampak: Chat tidak gagal total: kegagalan embedding/retrieval ditelan, generasi menjawab tanpa konteks dokumen dan tanpa pemberitahuan kegagalan RAG. Tidak mencoba ulang retrieval keyword. Keyword hanya dijalankan ketika konfigurasi embedding tidak tersedia (`src/lib/chat/generate.ts:619`), dengan catatan `keyword-only` jika ada hasil (`src/lib/chat/generate.ts:623`). Mode vektor juga mengecualikan chunk tanpa embedding (`src/lib/documents/retrieve.ts:119`), tanpa fallback jika hasil kosong.
- Status: Terbukti
- Perbaikan: Saat embedding gagal/vektor tidak tersedia, coba `retrieveChunks` tanpa embedding, bangun ulang konteks/sitasi dan beri catatan degradasi; jika retrieval tetap gagal tampilkan catatan dokumen tidak tersedia, sekitar 15-30 baris.

## E-B14 D: [P1] Pipeline unggahan tidak mengisi embedding dokumen
- Bukti: `src/lib/documents/run-extract.ts:67`
  ```ts
        text: chunk.text,
        page: chunk.page,
        section: chunk.section,
  ```
- Bukti: `src/lib/documents/run-extract.ts:72`
  ```ts
    await tx.document.update({
      where: { id: documentId },
      data: { status: "ready", errorCode: null },
  ```
- Bukti: `src/worker.ts:39`
  ```ts
  "document.extract": async (claim, signal) => {
    const payload = JSON.parse(claim.payloadJson || "{}") as { documentId?: string };
    if (!payload.documentId) throw new Error("Payload job document.extract tidak memiliki documentId.");
  ```
- Dampak: Ekstraksi membuat chunk tanpa embedding lalu langsung ready; tidak memanggil/enqueue embedding. Daftar handler worker (`src/worker.ts:31`) hanya chat.generate, document.extract, storage.cleanup; `document.embed` tidak terdaftar. Pencarian pemanggilan `embedChunks` dalam src menemukan jalur produksi hanya untuk query retrieval (`src/lib/documents/retrieve.ts:112`). Pada dokumen dari pipeline ini, menyalakan konfigurasi embedding membuat retrieval memilih hanya chunk bervektor (`src/lib/documents/retrieve.ts:119`), sehingga hasil kosong walau teks keyword tersedia. Proses pengisian vektor di luar repo tidak diverifikasi.
- Status: Terbukti
- Perbaikan: Hubungkan job embedding setelah ekstraksi, simpan vektor per ordinal secara idempoten, daftarkan handler; pertahankan fallback keyword selama indeks belum tersedia. Sekitar 50-90 baris, memakai `embedChunks` yang sudah ada.

## E-B05 E: [P1] Batas 10 MiB/koneksi 5 detik tidak ditegakkan; stream memakai idle 90 detik
- Bukti: `src/lib/net/policy.ts:75`
  ```ts
export const OUTBOUND_LIMITS = {
  connectTimeoutMs: 5_000,
  totalTimeoutMs: 15_000,
  ```
- Bukti: `src/lib/net/policy.ts:81`
  ```ts
  streamIdleTimeoutMs: 90_000,
  maxResponseBytes: 10 * 1024 * 1024,
} as const;
  ```
- Bukti: `src/app/api/kawan/v1/chat/[chatId]/stream/route.ts:81`
  ```ts
    const body = createSseStream({
      db,
      userId,
  ```
- Bukti: `src/lib/chat/generate.ts:368`
  ```ts
      const { done, value } = await reader.read();
      bumpIdle();
      if (done) break;
  ```
- Dampak: Konstanta koneksi 5 detik, total 15 detik, idle stream 90 detik, body 10 MiB. Jalur chat hanya memakai idle: stream panjang boleh melewati 15 detik selama byte terus datang. Nilai 15 detik tidak menjamin cukup untuk jawaban panjang, tetapi bukan batas generasi chat ini; `fetchJson` memakai default 15 detik sendiri (`src/lib/api/http.ts:30`). Tidak ada penghitung byte pada loop chat; respons JSON/embedding dibaca utuh (`src/lib/api/http.ts:76`, `src/lib/documents/embed.ts:191`). Jadi batas byte aplikasi tidak memotong jawaban diam-diam: batasnya justru tidak aktif, membuka konsumsi memori/DB berlebih. Timer koneksi 5 detik juga tidak dipasang; `fetchOutbound` memakai fetch tanpa dispatcher khusus (`src/lib/net/policy.ts:340`). DNS awal terjadi sebelum idle timer (`src/lib/chat/generate.ts:292`).
- Status: Terbukti
- Perbaikan: Hitung byte sebelum parsing, abort dengan galat eksplisit saat >10 MiB; batasi reader JSON/embedding; pasang deadline koneksi yang benar, sekitar 40-70 baris lintas jalur. Pertahankan timeout idle terpisah dari durasi total stream.

## E-B09 E: [P2] Diam >90 detik memutus stream, tetapi galat setelah header salah diklasifikasi
- Bukti: `src/lib/chat/generate.ts:309`
  ```ts
    idleTimer = setTimeout(() => {
      idleFired = true;
      idle.abort();
  ```
- Bukti: `src/lib/chat/generate.ts:398`
  ```ts
    // apa adanya supaya pemanggil membedakannya dari kegagalan gateway.
    if (input.signal.aborted || err instanceof StopRequested) throw err;
    throw transportError(err);
  ```
- Dampak: Sebelum header, idle dipetakan ke `TIMEOUT` (`src/lib/chat/generate.ts:338`). Setelah header, `idle.abort()` menghasilkan AbortError, sedangkan `transportError` hanya mengenali TimeoutError (`src/lib/chat/generate.ts:260`); akhirnya `UPSTREAM_ERROR`/pesan koneksi terputus. Partial disimpan sebagai error dan event galat dikirim (`src/lib/chat/generate.ts:511`, `src/lib/chat/generate.ts:519`), diteruskan SSE lalu ditutup (`src/lib/chat/sse.ts:197`). Bukan pemotongan tanpa peringatan. Idle di-reset setiap potongan byte, termasuk heartbeat, bukan setiap token; model boleh diam lebih lama bila upstream terus mengirim heartbeat. Timer tidak dibersihkan pada finally (`src/lib/chat/generate.ts:401`), menyisakan timer sampai 90 detik setelah selesai.
- Status: Terbukti
- Perbaikan: Periksa `idleFired` pada catch reader seperti catch fetch, lalu `clearTimeout(idleTimer)` pada semua jalur selesai, sekitar 5-10 baris; tambahkan uji timeout sebelum/sesudah header.

## E-B10 E: [P1] EOF tanpa penanda selesai dianggap jawaban lengkap
- Bukti: `src/lib/chat/generate.ts:386`
  ```ts
    if (!sawDone) {
      for (const delta of parser.flush()) {
        if (delta.kind === "done") {
  ```
- Bukti: `src/lib/chat/generate.ts:406`
  ```ts
  return { usage, finishReason };
  ```
- Dampak: Jika upstream/proxy menutup body secara bersih sebelum `[DONE]` dan sebelum `finish_reason`, flush dapat tidak mengeluarkan done, tetapi fungsi tetap sukses. `runGeneration` menulis `status: "complete"` (`src/lib/chat/generate.ts:754`) dan mengirim done. Jawaban parsial bisa tampil lengkap tanpa peringatan. Ini jalur pemotongan senyap yang nyata secara kode, bukan akibat konstanta byte 10 MiB.
- Status: Terbukti
- Perbaikan: Catat terminator valid dari push maupun flush; jika EOF tanpa terminator/finish_reason, lempar galat stream tidak lengkap sambil mempertahankan partial, sekitar 8-15 baris.

## E-B06 F: Usage provider disimpan apa adanya; tanpa estimasi karakter
- Bukti: `src/lib/chat/usage.ts:97`
  ```ts
  const promptTokens = token(input.usage?.promptTokens);
  const completionTokens = token(input.usage?.completionTokens);
  const totalTokens = token(input.usage?.totalTokens);
  ```
- Bukti: `src/lib/chat/usage.ts:100`
  ```ts
  const reported =
    promptTokens !== null && completionTokens !== null && totalTokens !== null ? 1 : 0;
  ```
- Dampak: Pada modul ini, nilai hilang/tidak sah menjadi NULL (`src/lib/chat/usage.ts:91`), semua hilang berarti ketiga token NULL dan `reported=0`. Tidak ada estimasi berbasis karakter. Jalur chat memakai fungsi berbeda di `generate.ts`, tetapi tetap membaca angka `usage` provider (`src/lib/chat/stream-parse.ts:66`); tanpa objek usage, generasi selesai mencatat ketiga token NULL dan `reported=0` (`src/lib/chat/generate.ts:765`). Bias estimasi karakter untuk bahasa Indonesia tidak berlaku pada jalur pencatatan yang dibaca. Perbedaan validasi kedua writer dijelaskan pada E-B11.
- Status: Terbukti
- Perbaikan: Pertahankan pembedaan tidak dilaporkan versus nol; gunakan satu normalisasi untuk kedua writer, lihat E-B11.

## E-B07 F: Laporan parsial dikeluarkan seluruhnya dari jumlah token
- Bukti: `src/lib/chat/usage.ts:128`
  ```ts
  const reportedWhere = { userId, reported: 1, createdAt: { gte: since } };
  const [summed, unreportedCount] = await Promise.all([
    db.usageRecord.aggregate({
  ```
- Dampak: Untuk baris yang ditulis melalui `usage.ts`, bila prompt/completion ada tetapi total hilang, nilai sah disimpan namun tidak masuk ringkasan. Agregasi harian/model juga melewati `reported!=1` (`src/lib/chat/usage.ts:195`). Ini kebijakan eksplisit, bukan estimasi. Namun chat produksi memakai writer lain yang menandai laporan parsial sebagai lengkap (E-B11), sehingga jaminan `unreportedCount` tidak berlaku konsisten.
- Status: Terbukti
- Perbaikan: Tampilkan kelengkapan ringkasan secara eksplisit; jika diperlukan agregasi parsial, jumlahkan per kolom dengan indikator kelengkapan, sekitar 15-30 baris.

## E-B08 F: Tidak ada kolom reasoning dalam kontrak pencatatan usage
- Bukti: `src/lib/chat/usage.ts:22`
  ```ts
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
  ```
- Bukti: `src/lib/chat/stream-parse.ts:66`
  ```ts
    promptTokens: toNumberOrNull(raw["prompt_tokens"]),
    completionTokens: toNumberOrNull(raw["completion_tokens"]),
    totalTokens: toNumberOrNull(raw["total_tokens"]),
  ```
- Dampak: Parser hanya mengambil tiga angka tersebut; `completion_tokens_details.reasoning_tokens` tidak dipetakan dan tidak disimpan terpisah. Bila provider sudah memasukkan reasoning ke completion/total, reasoning ikut tercatat secara agregat. Bila hanya dilaporkan terpisah, aplikasi tidak menambahkannya. Semantik provider aktif belum diverifikasi; tidak ada bukti bahwa seluruh reasoning selalu hilang dari total.
- Status: Terbukti
- Perbaikan: Bila rincian reasoning dibutuhkan, tambahkan pemetaan/penyimpanan/DTO khusus tanpa menjumlah ulang ke total provider, sekitar 30-60 baris lintas lapisan.

## E-B11 F: [P1] Writer chat melewati validasi usage; objek kosong dianggap laporan lengkap
- Bukti: `src/lib/chat/generate.ts:769`
  ```ts
    reported: usage !== null,
    promptTokens: usage?.promptTokens ?? null,
    completionTokens: usage?.completionTokens ?? null,
  ```
- Bukti: `src/lib/chat/stream-parse.ts:45`
  ```ts
function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
  ```
- Bukti: `src/lib/chat/generate.ts:468`
  ```ts
      totalTokens: reported ? (input.totalTokens ?? null) : null,
      reported: reported ? 1 : 0,
    },
  ```
- Dampak: `usage:{}` menjadi objek tiga NULL, lalu `reported=1`; ringkasan menghitungnya sebagai laporan lengkap dengan agregat nol dan tanpa menaikkan unreported. Usage parsial juga dianggap lengkap. Angka negatif/pecahan diterima parser, berbeda dari normalisasi integer >=0 di `src/lib/chat/usage.ts:91`; angka negatif dapat mengurangi total, pecahan mencapai kolom integer dan bergantung penolakan/konversi DB. Keberadaan objek tidak membuktikan laporan valid.
- Status: Terbukti
- Perbaikan: Hapus writer duplikat, gunakan normalisasi `recordUsage` dari `usage.ts`, selaraskan event SSE `reported` (`src/lib/chat/sse.ts:59`), sekitar 15-30 baris bersih; uji objek kosong, parsial, negatif, pecahan.

## E-B12 F: [P2] Request stream tidak meminta usage dari provider
- Bukti: `src/lib/chat/generate.ts:682`
  ```ts
        ],
        stream: true,
      },
  ```
- Dampak: Body tidak menyertakan `stream_options: { include_usage: true }`. Pada provider kompatibel yang hanya mengirim usage bila diminta, semua generasi selesai akan dicatat sebagai tidak dilaporkan meskipun provider mendukung token akurat. Provider yang mengirim usage secara default tetap tercatat; perilaku deployment belum diuji.
- Status: Terbukti
- Perbaikan: Minta usage untuk provider yang mendukung opsi tersebut; jika semua koneksi kompatibel cukup 1 baris, jika perlu deteksi dukungan sekitar 10-20 baris. Jangan menggantinya dengan perkiraan karakter.

## E-B13 F: [P1] Generasi gagal/dihentikan tidak menghasilkan catatan usage
- Bukti: `src/lib/chat/generate.ts:713`
  ```ts
    if (err instanceof StopRequested) {
      await stopGeneration(db, generationId, generation.assistantMessageId, text, new Date());
      return;
  ```
- Bukti: `src/lib/chat/generate.ts:717`
  ```ts
    if (err instanceof GenerationError) {
      await failGeneration(db, generationId, generation.assistantMessageId, err, text, new Date());
      return;
  ```
- Dampak: Pencatatan baru dilakukan pada jalur sukses di `src/lib/chat/generate.ts:765`. Timeout/stop sesudah token dihasilkan tidak mencatat pemakaian bahkan sebagai `reported=0`, sehingga biaya nyata bisa ada tanpa menaikkan unreportedCount. Usage yang sempat diterima hanya diterbitkan sebagai event (`src/lib/chat/generate.ts:704`), lalu tidak menjadi UsageRecord jika stream gagal.
- Status: Terbukti
- Perbaikan: Pertahankan usage terakhir di lingkup generasi, catat sekali pada jalur terminal setelah request provider dimulai (NULL bila tidak tersedia), sekitar 20-35 baris; jangan mengarang nol atau menghitung ganda.

## Ringkasan pass B (maks 6 baris)
D: chunk/top-k terbatas; tanpa deduplikasi/rerank dan tanpa budget token di builder.
D: pipeline tidak mengisi embedding; mode vektor/failure bisa kehilangan konteks tanpa fallback keyword.
E: idle 90s aktif; batas koneksi/byte tidak aktif; klasifikasi idle salah; EOF dini bisa dianggap lengkap.
F: usage provider, tanpa estimasi; writer chat salah menandai laporan parsial/kosong; reasoning tidak terpisah.
F: opsi permintaan usage absen; generasi gagal/stop tidak tercatat dalam pemakaian.
61 tes terarah lulus; temuan integrasi dari audit statis; kode aplikasi tidak diubah.

PASS_B_DONE
