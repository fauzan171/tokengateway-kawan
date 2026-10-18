"use client";

/**
 * Pemilih prompt tersimpan (WP-NT-P7-04/05, REQ-NT-62/63).
 *
 * Daftar dimuat saat tombol pertama kali dibuka, bukan saat mount: sebagian
 * besar percakapan tidak memakai prompt, jadi tidak perlu permintaan tambahan.
 */

import { useCallback, useEffect, useState } from "react";

type PromptItem = {
  id: string;
  title: string;
  body: string;
  variables: string[];
  isDefault: boolean;
  enabled: boolean;
};

const ENDPOINT = "/api/kawan/v1/prompts";

export function PromptPicker({ onApply }: { onApply: (body: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINT);
      if (response.status === 401) {
        setError("Sesi berakhir, muat ulang halaman.");
        return;
      }
      if (!response.ok) {
        setError("Gagal memuat prompt.");
        return;
      }
      const data = (await response.json().catch(() => null)) as { prompts?: PromptItem[] } | null;
      setPrompts(data?.prompts ?? []);
      setError(null);
    } catch {
      setError("Gagal memuat prompt.");
    }
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      setLoaded(true);
      void load();
    }
  }, [open, loaded, load]);

  async function save(): Promise<void> {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!response.ok) {
        setError("Prompt gagal disimpan. Judul dan isi wajib diisi.");
        return;
      }
      setTitle("");
      setBody("");
      await load();
    } catch {
      setError("Prompt gagal disimpan.");
    }
  }

  async function remove(promptId: string): Promise<void> {
    try {
      const response = await fetch(`${ENDPOINT}/${promptId}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Prompt gagal dihapus.");
        return;
      }
      setPrompts((prev) => prev.filter((item) => item.id !== promptId));
    } catch {
      setError("Prompt gagal dihapus.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Prompt
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-80 rounded-xl border bg-background p-3 shadow-md">
          {prompts.length > 0 && (
            <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto">
              {prompts.map((prompt) => (
                <li key={prompt.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onApply(prompt.body);
                      setOpen(false);
                    }}
                    className="flex-1 truncate rounded-lg px-2 py-1 text-left text-sm hover:bg-muted"
                  >
                    {prompt.title}
                    {prompt.variables.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {prompt.variables.map((name) => `{{${name}}}`).join(" ")}
                      </span>
                    )}
                  </button>
                  {!prompt.isDefault && (
                    <button
                      type="button"
                      aria-label={`Hapus prompt ${prompt.title}`}
                      onClick={() => void remove(prompt.id)}
                      className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Hapus
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Judul prompt"
              aria-label="Judul prompt"
              className="w-full rounded-lg border bg-transparent px-2 py-1 text-sm outline-none"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Isi prompt, boleh memakai {{isi}}"
              aria-label="Isi prompt"
              rows={3}
              className="w-full resize-none rounded-lg border bg-transparent px-2 py-1 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={!title.trim() || !body.trim()}
              className="rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
            >
              Simpan prompt
            </button>
          </div>

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
