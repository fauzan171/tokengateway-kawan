"use client";

/**
 * Pemilih prompt tersimpan (WP-NT-P7-04/05, REQ-NT-62/63).
 *
 * Daftar dimuat saat tombol pertama kali dibuka, bukan saat mount: sebagian
 * besar percakapan tidak memakai prompt, jadi tidak perlu permintaan tambahan.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";

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
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Escape menutup popup dan fokus kembali ke pemicu (UX-07).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Fokus masuk ke kontrol pertama saat popup dibuka.
  useEffect(() => {
    if (open) popupRef.current?.querySelector<HTMLElement>("button, input, textarea")?.focus();
  }, [open]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINT);
      if (response.status === 401) {
        setError(t("common.sessionExpired"));
        return;
      }
      if (!response.ok) {
        setError(t("prompts.loadFailed"));
        return;
      }
      const data = (await response.json().catch(() => null)) as { prompts?: PromptItem[] } | null;
      setPrompts(data?.prompts ?? []);
      setError(null);
    } catch {
      setError(t("prompts.loadFailed"));
    }
  }, [t]);

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
        setError(t("prompts.saveFailed"));
        return;
      }
      setTitle("");
      setBody("");
      await load();
    } catch {
      setError(t("prompts.saveNetworkFailed"));
    }
  }

  async function remove(promptId: string): Promise<void> {
    try {
      const response = await fetch(`${ENDPOINT}/${promptId}`, { method: "DELETE" });
      if (!response.ok) {
        setError(t("prompts.deleteFailed"));
        return;
      }
      setPrompts((prev) => prev.filter((item) => item.id !== promptId));
    } catch {
      setError(t("prompts.deleteFailed"));
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs text-muted-foreground hover:text-foreground"
      >
        {t("prompts.trigger")}
      </button>

      {open && (
        <div ref={popupRef} className="absolute bottom-full left-0 z-10 mb-2 w-80 rounded-xl border bg-background p-3 shadow-md">
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
                    className="min-h-11 flex-1 truncate rounded-lg px-2 text-left text-sm hover:bg-muted"
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
                      aria-label={t("prompts.remove", { title: prompt.title })}
                      onClick={() => void remove(prompt.id)}
                      className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      {t("common.delete")}
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
              placeholder={t("prompts.titlePlaceholder")}
              aria-label={t("prompts.titlePlaceholder")}
              className="min-h-11 w-full rounded-lg border bg-transparent px-2 text-sm outline-none"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("prompts.bodyPlaceholder")}
              aria-label={t("prompts.bodyPlaceholder")}
              rows={3}
              className="min-h-11 w-full resize-none rounded-lg border bg-transparent px-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={!title.trim() || !body.trim()}
              className="min-h-11 rounded-lg border px-2 text-xs disabled:opacity-50"
            >
              {t("prompts.save")}
            </button>
          </div>

          {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
