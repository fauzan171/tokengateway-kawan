"use client";

/**
 * Panel dokumen: unggah, status ingestion, hapus, coba lagi (WP-NT-P6-10,
 * REQ-NT-47, REQ-NT-54).
 *
 * Satu-satunya timer di komponen ini adalah polling 2 detik yang hidup hanya
 * selama ada dokumen `queued`/`processing`. Status diumumkan lewat wadah
 * `role="status"` (SDD-7.5).
 */

import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Salinan `ALLOWED_MIME` dari `src/lib/documents/upload.ts`: berkas itu
 * mengimpor adapter `node:fs`, jadi tidak boleh masuk bundel klien.
 */
const ACCEPT = ["application/pdf", "text/plain", "text/markdown"];

const STATUS_LABEL: Record<string, string> = {
  queued: "Menunggu",
  processing: "Memproses",
  ready: "Siap",
  failed: "Gagal",
};

const STATUS_CLASS: Record<string, string> = {
  queued: "text-muted-foreground",
  processing: "text-muted-foreground",
  ready: "text-foreground",
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

export function DocumentsPanel() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/kawan/v1/documents");
      if (response.status === 401) {
        setError("Sesi berakhir, muat ulang halaman.");
        return;
      }
      if (!response.ok) {
        setError("Gagal memuat dokumen.");
        return;
      }
      const data = (await response.json().catch(() => null)) as { documents?: DocumentItem[] } | null;
      setDocuments(data?.documents ?? []);
      setError(null);
    } catch {
      setError("Gagal memuat dokumen.");
    }
  }, []);

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

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/kawan/v1/documents", { method: "POST", body });
      if (response.status === 401) {
        setError("Sesi berakhir, muat ulang halaman.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { document?: DocumentItem; error?: { message?: string } }
        | null;
      if (!response.ok || !data?.document) {
        setError(data?.error?.message ?? "Unggahan gagal. Coba lagi.");
        return;
      }
      setDocuments((current) => [data.document as DocumentItem, ...current]);
    } catch {
      setError("Unggahan gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRetry(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/kawan/v1/documents/${id}/retry`, { method: "POST" });
      if (!response.ok) {
        setError("Dokumen belum dapat dicoba lagi.");
        return;
      }
      setDocuments((current) =>
        current.map((item) => (item.id === id ? { ...item, status: "queued", errorCode: null } : item)),
      );
    } catch {
      setError("Dokumen belum dapat dicoba lagi.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/kawan/v1/documents/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Dokumen gagal dihapus.");
        return;
      }
      setDocuments((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Dokumen gagal dihapus.");
    }
  }

  return (
    <section aria-label="Dokumen" className="mb-2 rounded-2xl border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Dokumen</p>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          {uploading ? "Mengunggah…" : "Lampirkan dokumen"}
          <input
            type="file"
            accept={ACCEPT.join(",")}
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleUpload(file);
            }}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div role="status" aria-live="polite">
        {documents.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Belum ada dokumen. Lampirkan PDF atau teks untuk bertanya berdasarkan isinya.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {documents.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate" title={item.filename}>
                  {item.filename}
                </span>
                <span className="text-muted-foreground">{sizeKb(item.sizeBytes)}</span>
                <span className={STATUS_CLASS[item.status] ?? "text-muted-foreground"}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
                {item.status === "failed" && (
                  <>
                    <span className="text-destructive">{item.errorCode ?? "Ekstraksi gagal."}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleRetry(item.id)}>
                      Coba lagi
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Hapus ${item.filename}`}
                  onClick={() => void handleDelete(item.id)}
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
