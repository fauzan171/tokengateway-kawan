/**
 * SDD-9.3 butir 3 — XSS.
 *
 * Tiga batas diperiksa: berkas masuk (MIME), keluaran model (markdown), dan
 * teks yang dirender sebagai teks di UI (nama berkas, judul chat).
 */

import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../tests/helpers/auth-db";
import { ApiError } from "@/lib/api/errors";
import { loadConfig, type Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { sanitizeFilename, uploadDocument } from "@/lib/documents/upload";
import { Markdown } from "@/components/markdown";
import { SourceList } from "@/components/source-list";

const renderMarkdown = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe("unggahan", () => {
  let temp: TempDb;
  let db: Db;
  let config: Config;
  let userId: string;

  beforeEach(async () => {
    temp = await createTempDb();
    db = temp.db;
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
    config = loadConfig({
      DATABASE_URL: "file:x",
      ENCRYPTION_SECRET: Buffer.alloc(32).toString("base64"),
      AUTH_SECRET: "uji",
    });
  });

  afterAll(async () => {
    await temp.cleanup();
  });

  it("menolak text/html", async () => {
    await expect(
      uploadDocument(db, config, {
        userId,
        filename: "x.html",
        mime: "text/html",
        data: Buffer.from("<script>alert(1)</script>"),
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(await db.document.count()).toBe(0);
  });

  it("menolak SVG", async () => {
    for (const mime of ["image/svg+xml", "text/svg", "application/xhtml+xml"]) {
      await expect(
        uploadDocument(db, config, {
          userId,
          filename: "x.svg",
          mime,
          data: Buffer.from("<svg onload=alert(1)/>"),
        }),
        mime,
      ).rejects.toBeInstanceOf(ApiError);
    }
  });

  it("membuang komponen path dan karakter kontrol dari nama berkas", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("a\u0000b\nc.pdf")).toBe("abc.pdf");
    expect(sanitizeFilename(42)).toBe("dokumen");
  });
});

describe("markdown", () => {
  it("<script> tetap teks, tidak jadi elemen", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("atribut onerror tidak aktif", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror=\"");
  });

  it("tautan berbahaya tidak menjadi javascript: yang dapat diklik", () => {
    const html = renderMarkdown("[klik](javascript:alert(1))");
    expect(html).not.toContain('href="javascript:');
  });

  it("HTML di dalam blok kode tetap teks", () => {
    // Highlight memecah tag jadi beberapa `<span>`, jadi yang diperiksa
    // ketiadaan elemen `script`, bukan bentuk escape yang utuh.
    const html = renderMarkdown("```html\n<script>alert(1)</script>\n```");
    expect(html).not.toContain("<script");
    expect(html).toContain("alert(1)");
  });
});

describe("teks dirender sebagai teks", () => {
  it("nama berkas berisi markup tidak bocor mentah ke atribut aria/title", () => {
    const name = sanitizeFilename('"><img src=x onerror=alert(1)>.pdf');
    expect(name).toContain("<img src=x onerror=alert(1)>");
    const html = renderToStaticMarkup(
      createElement("button", { type: "button", title: name, "aria-label": `Hapus ${name}` }, name),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("judul chat berisi <script> dirender sebagai teks", () => {
    const html = renderToStaticMarkup(createElement("span", null, "<script>alert(1)</script>"));
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("judul sumber web dirender sebagai teks", () => {
    const html = renderToStaticMarkup(
      createElement(SourceList, { sources: [{ title: "<script>alert(1)</script>", url: "https://contoh.test" }] }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
