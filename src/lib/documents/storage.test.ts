import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  deleteDocument,
  readDocument,
  resolveKey,
  saveDocument,
  storageRoot,
} from "./storage";

const dir = mkdtempSync(join(tmpdir(), "kawan-docs-"));
const root = join(dir, "documents");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("penyimpanan dokumen", () => {
  it("simpan lalu baca mengembalikan isi yang sama", async () => {
    const data = Buffer.from("isi dokumen uji");
    const key = await saveDocument(data, root);

    expect((await readDocument(key, root)).equals(data)).toBe(true);
  });

  it("nama simpan acak: tanpa nama asli dan berbeda antar simpan", async () => {
    const a = await saveDocument(Buffer.from("a"), root);
    const b = await saveDocument(Buffer.from("b"), root);

    expect(a).not.toBe(b);
    expect(a).not.toContain("dokumen");
    expect(a).not.toContain(".pdf");
  });

  it("storageKey dengan .. ditolak", async () => {
    await expect(readDocument("../rahasia.txt", root)).rejects.toThrow(/tidak sah/);
    await expect(deleteDocument("../rahasia.txt", root)).rejects.toThrow(/tidak sah/);
    expect(() => resolveKey(root, "/etc/passwd")).toThrow(/tidak sah/);
  });

  it("hapus membuat berkas hilang, dan hapus dua kali tidak melempar", async () => {
    const key = await saveDocument(Buffer.from("hapus"), root);
    await deleteDocument(key, root);
    await expect(readDocument(key, root)).rejects.toThrow();
    await expect(deleteDocument(key, root)).resolves.toBeUndefined();
  });

  it("akar penyimpanan berada di luar public/", async () => {
    const defaultRoot = storageRoot({});
    expect(defaultRoot).not.toContain(`${sep}public${sep}`);
    expect(storageRoot({ STORAGE_LOCAL_DIR: root })).toBe(root);
  });

  it("berkas sementara tidak tertinggal setelah simpan", async () => {
    await mkdir(root, { recursive: true });
    await saveDocument(Buffer.from("x"), root);
    expect(readdirSync(root).some((name) => name.endsWith(".tmp"))).toBe(false);
  });
});
