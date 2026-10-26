"use client";

/**
 * Panel kanan pratinjau berkas (ala Gemini canvas): dokumen/artefak yang
 * dihasilkan atau dilampirkan bisa dibuka geser dari kanan dan direview di
 * sana — Markdown dirender, CSV jadi tabel, PDF via viewer bawaan browser,
 * sisanya unduhan. Tidak ada render HTML mentah origin (XSS): .html selalu
 * unduh, bukan iframe.
 */

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, FileText, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { useT } from "@/lib/i18n/context";

export type PreviewTarget = {
  artifactId: string;
  displayName: string;
  format: string;
  sizeBytes: number;
};

const TEXT_PREVIEW = new Set(["md", "txt", "json", "csv", "log"]);
const MARKDOWN_PREVIEW = new Set(["md", "markdown"]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function artifactUrl(id: string): string {
  return `/api/kawan/v1/artifacts/${encodeURIComponent(id)}`;
}

function CsvTable({ text }: { text: string }) {
  const rows = useMemo(() => {
    // Parser CSV baris-sederhana: kutip ganda dipisahkan, koma di dalam kutip aman.
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
          else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    };
    return text.trim().split(/\r?\n/).slice(0, 300).map(parseLine);
  }, [text]);
  if (rows.length === 0) return null;
  const [head, ...body] = rows;
  return (
    <div className="kawan-fade-in my-2 max-h-full max-w-full overflow-auto">
      <table className="w-max min-w-full border-collapse text-xs">
        <thead>
          <tr>{head.map((c, i) => <th key={i} className="border bg-muted/60 px-2 py-1 text-left font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="border px-2 py-1 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewBody({ target }: { target: PreviewTarget }) {
  const t = useT();
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let createdUrl: string | null = null;
    setContent(null);
    setFailed(false);
    setObjectUrl(null);
    (async () => {
      try {
        const res = await fetch(artifactUrl(target.artifactId));
        if (!res.ok) throw new Error(String(res.status));
        if (target.format.toLowerCase() === "pdf") {
          const blob = await res.blob();
          createdUrl = URL.createObjectURL(blob);
          if (alive) setObjectUrl(createdUrl);
          return;
        }
        const text = await res.text();
        if (alive) setContent(text);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [target.artifactId, target.format]);

  if (failed) {
    return <p className="p-6 text-sm text-muted-foreground">{t("chat.previewUnavailable")}</p>;
  }
  if (target.format.toLowerCase() === "pdf") {
    return objectUrl ? (
      <iframe title={target.displayName} src={objectUrl} className="h-full w-full border-0" />
    ) : (
      <div className="grid h-full place-items-center"><span className="kawan-dots" aria-hidden><span /><span /><span /></span></div>
    );
  }
  if (content === null) {
    return <div className="grid h-full place-items-center p-6"><span className="kawan-dots" aria-hidden><span /><span /><span /></span></div>;
  }
  if (MARKDOWN_PREVIEW.has(target.format.toLowerCase())) {
    return <div className="kawan-markdown p-5"><Markdown text={content} /></div>;
  }
  if (target.format.toLowerCase() === "csv") {
    return <div className="p-4"><CsvTable text={content} /></div>;
  }
  if (target.format.toLowerCase() === "json") {
    let pretty = content;
    try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch {}
    return <pre className="kawan-fade-in overflow-auto p-5 text-xs leading-relaxed">{pretty}</pre>;
  }
  if (TEXT_PREVIEW.has(target.format.toLowerCase())) {
    return <pre className="kawan-fade-in whitespace-pre-wrap p-5 text-sm leading-relaxed">{content}</pre>;
  }
  // Format biner lain (xlsx, docx, zip, html): unduh, bukan render origin.
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="space-y-3">
        <FileText className="mx-auto size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{target.format.toUpperCase()} · {formatBytes(target.sizeBytes)}</p>
        <a
          href={artifactUrl(target.artifactId)}
          download={target.displayName}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-accent"
        >
          <Download className="size-4" /> {t("chat.artifactDownload")}
        </a>
      </div>
    </div>
  );
}

/** Drawer kanan: satu target aktif; komposisi chat-view mengendalikan open/onOpenChange. */
export function FilePreviewDrawer({
  target,
  open,
  onOpenChange,
}: {
  target: PreviewTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={`fixed inset-y-0 right-0 z-50 flex w-[min(92vw,42rem)] flex-col border-l bg-background shadow-2xl transition-transform duration-250 ease-out data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full`}
        >
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-medium">{target?.displayName ?? ""}</Dialog.Title>
              {target && (
                <p className="text-xs text-muted-foreground">
                  {target.format.toUpperCase()} · {formatBytes(target.sizeBytes)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {target && (
                <a
                  href={artifactUrl(target.artifactId)}
                  download={target.displayName}
                  className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  title={t("chat.artifactDownload")}
                >
                  <Download className="size-4" />
                </a>
              )}
              <Dialog.Close
                render={
                  <button
                    type="button"
                    aria-label={t("nav.closeMenu")}
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                }
              />
            </div>
          </header>
          <div className="kawan-thin-scroll min-h-0 flex-1 overflow-auto">
            {target && <PreviewBody key={target.artifactId} target={target} />}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
