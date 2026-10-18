/**
 * Adapter penyimpanan berkas dokumen (SDD-6.1 butir 2).
 *
 * Berkas disimpan di luar webroot dengan nama acak; nama asli dari pengguna
 * tidak pernah dipakai sebagai path. `storageKey` yang disimpan di database
 * adalah path relatif terhadap akar penyimpanan.
 *
 * Server-only: memakai `node:fs/promises`, jadi tidak boleh diimpor komponen
 * klien. Dipakai route unggah dan worker, bukan browser.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

/** Akar penyimpanan. `STORAGE_LOCAL_DIR` bila diisi, selain itu
 *  `<project>/.data/documents` — keduanya di luar `public/`. */
export function storageRoot(env: Record<string, string | undefined> = process.env): string {
  const configured = env["STORAGE_LOCAL_DIR"]?.trim();
  return configured ? resolve(configured) : join(process.cwd(), ".data", "documents");
}

/**
 * Menerjemahkan `storageKey` menjadi path absolut, atau melempar bila keluar
 * dari akar. Ini batas kepercayaan: kunci berasal dari database dan dari
 * permintaan pengguna (mis. hapus dokumen), jadi `..`, path absolut, dan hasil
 * resolve di luar akar ditolak.
 */
export function resolveKey(root: string, storageKey: string): string {
  if (!storageKey || isAbsolute(storageKey)) {
    throw new Error("storageKey tidak sah: harus path relatif.");
  }
  const target = resolve(root, storageKey);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error("storageKey tidak sah: keluar dari akar penyimpanan.");
  }
  return target;
}

/** Menyimpan isi berkas dan mengembalikan `storageKey` acak. */
export async function saveDocument(
  data: Buffer,
  root = storageRoot(),
): Promise<string> {
  const key = randomUUID();
  const target = resolveKey(root, key);
  const temporary = `${target}.tmp`;

  await mkdir(root, { recursive: true });
  // Tulis ke berkas sementara lalu rename: unggahan yang terputus tidak
  // meninggalkan berkas bernama akhir yang tampak utuh.
  await writeFile(temporary, data);
  await rename(temporary, target);

  return key;
}

/** Membaca isi berkas. Melempar bila kunci tidak sah atau berkas tidak ada. */
export async function readDocument(
  storageKey: string,
  root = storageRoot(),
): Promise<Buffer> {
  return readFile(resolveKey(root, storageKey));
}

/** Menghapus berkas. Menghapus dua kali tidak melempar. */
export async function deleteDocument(
  storageKey: string,
  root = storageRoot(),
): Promise<void> {
  await rm(resolveKey(root, storageKey), { force: true });
}
