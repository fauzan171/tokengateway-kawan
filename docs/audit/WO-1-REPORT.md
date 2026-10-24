# WO-1 Report — System prompt tersambung ke model

**Status:** selesai. **Gerbang:** semua hijau.

## Berkas diubah

| Berkas | Perubahan |
|---|---|
| `src/lib/chat/generate.ts` | `DEFAULT_SYSTEM_PROMPT` (5 baris teks), import `getSystemPrompt`, ambil prompt pengguna, sisipkan ke body request |
| `src/lib/search/prompt.ts` | hapus `"Jawab dalam bahasa Indonesia."` (baris 48) |
| `src/lib/chat/generate.test.ts` | sesuaikan 1 test lama, tambah 1 test baru |

## Diff inti

```ts
const DEFAULT_SYSTEM_PROMPT = [
  "Kamu adalah asisten AI yang membantu dan jujur.",
  "Jawab dengan bahasa yang dipakai pengguna.",
  "Sesuaikan panjang jawaban dengan kebutuhan pertanyaan; jangan memotong jawaban yang butuh penjelasan.",
  "Jika tidak yakin, katakan tidak yakin. Jangan mengarang fakta, angka, atau sumber.",
  "Gunakan markdown bila membantu keterbacaan: daftar, tabel, atau blok kode.",
].join("\n");
```

```ts
const userSystem =
  ancestry.some((node) => node.role === "system") || messages.some((m) => m.role === "system")
    ? null
    : await getSystemPrompt(db, generation.chatId);
```

```ts
messages: [
  { role: "system", content: DEFAULT_SYSTEM_PROMPT },
  ...(userSystem ? [{ role: "system", content: userSystem }] : []),
  ...(contextSystem ? [{ role: "system", content: contextSystem }] : []),
  ...(searchSystem ? [{ role: "system", content: searchSystem }] : []),
  ...messages,
],
```

Urutan akhir: prompt bawaan → prompt pengguna → konteks dokumen → sumber web → riwayat.

## Keluaran gerbang (mentah)

```
$ npx tsc --noEmit
TSC_OK

$ npx eslint src/lib/chat src/lib/search
ESLINT_OK

$ npx vitest run
 Test Files  73 passed (73)
      Tests  749 passed (749)

$ npm run build
ƒ  (Dynamic)  server-rendered on demand
```

Sebelum WO-1: 748 tes. Sesudah: 749 (satu test baru). Tidak ada tes yang turun.

## Test baru

`mengirim system prompt pengguna tepat setelah prompt bawaan (WO-1)` — memakai `setSystemPrompt` nyata, memastikan `messages[0]` prompt bawaan, `messages[1]` prompt pengguna, dan total role system tepat 2 (tidak dobel).

Test lama `mengirim riwayat ancestry + stream:true ke /chat/completions` diperbarui: dulu mengharap `messages === [{user:"Halo"}]`, sekarang mengharap 2 elemen dengan system lebih dulu. Ini perubahan perilaku yang disengaja, bukan pelonggaran assertion — isi pesan user tetap diperiksa persis.

## Catatan jujur

- [CC] berhenti di batas 20 turn sebelum sempat menjalankan gerbang atau menulis laporan. Diff-nya sudah benar dan sesuai brief; gerbang dan test dikerjakan manual oleh Hermes.
- Biaya sesi [CC]: $4,47 untuk 881k token input. Pemakaian token tinggi karena [CC] membaca ulang berkas besar berulang kali.
- Belum diuji di browser/produksi. Verifikasi perilaku nyata menyusul setelah deploy.

WO1_DONE
