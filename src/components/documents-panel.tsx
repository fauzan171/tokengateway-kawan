"use client";

/**
 * Dokumen sebagai lampiran composer (WP-NT-P6-10, REQ-NT-47, REQ-NT-54).
 *
 * Dulu panel terpisah di bawah chat. Sekarang menempel di kotak input seperti
 * ChatGPT/Gemini: chip di atas textarea, tombol lampirkan di toolbar. State
 * diangkat ke `useDocuments` supaya chip dan tombol berbagi satu daftar.
 *
 * Satu-satunya timer: polling 2 detik selama ada dokumen `queued`/`processing`.
 */

import { useCallback, useEffect, useState } from "react";
import { FileText, LoaderCircle, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Salinan `ALLOWED_MIME` dari `src/lib/documents/upload.ts`: berkas itu
 * mengimpor adapter `node:fs`, jadi tidak boleh masuk bundel klien.
 */
const ACCEPT = ["application/pdf", "text/plain", "text/markdown"];

const STATUS_LABEL: Record<string, MessageKey> = {
  queued: "documents.status.queued",
  processing: "documents.status.processing",
  ready: "documents.status.ready",
  failed: "documents.status.failed",
};

const STATUS_CLASS: Record<string, string> = {
  queued: "text-muted-foreground",
  processing: "text-muted-foreground",
  ready: "text-emerald-600 dark:text-emerald-500",
  failed: "text-destructive",
};

type DocumentItem = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  status: string;
  errorCode: string | null;
  createdAt: string;
};

function sizeKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isPending(status: string): boolean {
  return status === "queued" || status === "processing";
}

export type DocumentsApi = {
  documents: DocumentItem[];
  error: string | null;
  uploading: boolean;
  upload: (file: File) => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function useDocuments(): DocumentsApi {
  const t = useT();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/kawan/v1/documents");
      if (response.status === 401) {
        setError(t("common.sessionExpired"));
        return;
      }
      if (!response.ok) {
        setError(t("documents.loadFailed"));
        return;
      }
      const data = (await response.json().catch(() => null)) as { documents?: DocumentItem[] } | null;
      setDocuments(data?.documents ?? []);
      setError(null);
    } catch {
      setError(t("documents.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const polling = documents.some((item) => isPending(item.status));
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => {
      void load();
    }, 2000);
    return () => clearInterval(timer);
  }, [polling, load]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      const body = new FormData();
      body.append("file", file);
      try {
        const response = await fetch("/api/kawan/v1/documents", { method: "POST", body });
        if (response.status === 401) {
          setError(t("common.sessionExpired"));
          return;
        }
        const data = (await response.json().catch(() => null)) as
          | { document?: DocumentItem; error?: { message?: string } }
          | null;
        if (!response.ok || !data?.document) {
          setError(data?.error?.message ?? t("documents.uploadFailed"));
          return;
        }
        setDocuments((current) => [data.document as DocumentItem, ...current]);
      } catch {
        setError(t("documents.uploadFailedNetwork"));
      } finally {
        setUploading(false);
      }
    },
    [t],
  );

  const retry = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await fetch(`/api/kawan/v1/documents/${id}/retry`, { method: "POST" });
        if (!response.ok) {
          setError(t("documents.retryFailed"));
          return;
        }
        setDocuments((current) =>
          current.map((item) => (item.id === id ? { ...item, status: "queued", errorCode: null } : item)),
        );
      } catch {
        setError(t("documents.retryFailed"));
      }
    },
    [t],
  );

  const remove = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await fetch(`/api/kawan/v1/documents/${id}`, { method: "DELETE" });
        if (!response.ok) {
          setError(t("documents.deleteFailed"));
          return;
        }
        setDocuments((current) => current.filter((item) => item.id !== id));
      } catch {
        setError(t("documents.deleteFailed"));
      }
    },
    [t],
  );

  return { documents, error, uploading, upload, retry, remove };
}

/** Tombol lampirkan dokumen di toolbar composer. */
export function DocumentAttachButton({ api }: { api: DocumentsApi }) {
  const t = useT();
  const { uploading, upload } = api;
  return (
    <label
      aria-label={t("documents.attach")}
      title={t("documents.attach")}
      className={`ml-2 rounded-lg p-2 hover:text-foreground ${
        uploading ? "cursor-wait opacity-50" : "cursor-pointer text-muted-foreground"
      }`}
    >
      {uploading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Paperclip aria-hidden className="size-4" />}
      <input
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
    </label>
  );
}

/** Chip lampiran di dalam kotak input, gaya ChatGPT/Gemini. */
export function DocumentChips({ api }: { api: DocumentsApi }) {
  const t = useT();
  const { documents, error, retry, remove } = api;
  if (documents.length === 0 && !error) return null;

  return (
    <div className="px-2 pt-2">
      <div role="status" aria-live="polite">
        {documents.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {documents.map((item) => (
              <li
                key={item.id}
                className="flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/40 py-1 pl-2 pr-1 text-xs"
              >
                <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 max-w-40 truncate" title={item.filename}>
                  {item.filename}
                </span>
                <span className="shrink-0 text-muted-foreground">{sizeKb(item.sizeBytes)}</span>
                <span className={`shrink-0 ${STATUS_CLASS[item.status] ?? "text-muted-foreground"}`}>
                  {STATUS_LABEL[item.status] ? t(STATUS_LABEL[item.status]) : item.status}
                </span>
                {item.status === "failed" && (
                  <span className="shrink-0 text-destructive">
                    {item.errorCode ?? t("documents.extractFailed")}
                  </span>
                )}
                {item.status === "failed" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-5 px-1.5 text-[11px]"
                    onClick={() => void retry(item.id)}
                  >
                    {t("common.retry")}
                  </Button>
                )}
                <button
                  type="button"
                  aria-label={t("documents.remove", { filename: item.filename })}
                  onClick={() => void remove(item.id)}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Chip + tombol dalam satu blok; dipakai test dan sebagai pemakaian mandiri. */
export function DocumentsPanel() {
  const api = useDocuments();
  return (
    <section aria-label="Dokumen">
      <DocumentChips api={api} />
      <DocumentAttachButton api={api} />
    </section>
  );
}
