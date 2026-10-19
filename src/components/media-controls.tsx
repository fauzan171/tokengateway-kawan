"use client";

/**
 * Kontrol media opsional (WP-NT-P8-01/03/04, REQ-NT-65/67/68).
 *
 * Komponen ini TIDAK menerima flag kapabilitas: pemanggil hanya merendernya
 * bila ada fitur yang tersedia, dan hanya mengisi handler untuk fitur itu.
 * Tombol yang tidak punya handler tidak dirender — jadi tidak mungkin ada
 * tombol mati (REQ-NT-69).
 */

import { useRef } from "react";
import { Image as ImageIcon, Mic, Volume2 } from "lucide-react";

const buttonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground disabled:opacity-50";

export function MediaControls({
  onImage,
  onTranscribe,
  onSpeak,
  busy,
  prompt = "",
}: {
  onImage?: (prompt: string) => void;
  onTranscribe?: (file: File) => void;
  onSpeak?: () => void;
  busy: boolean;
  /** Draft saat ini: tombol gambar mati bila prompt kosong. */
  prompt?: string;
}) {
  const audioInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {onImage && (
        <button
          type="button"
          aria-label="Buat gambar"
          title="Buat gambar dari prompt"
          disabled={busy || !prompt.trim()}
          onClick={() => onImage(prompt)}
          className={buttonClass}
        >
          <ImageIcon className="size-4" />
        </button>
      )}

      {onTranscribe && (
        <>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onTranscribe(file);
            }}
          />
          <button
            type="button"
            aria-label="Transkripsi audio"
            title="Ubah audio jadi teks"
            disabled={busy}
            onClick={() => audioInputRef.current?.click()}
            className={buttonClass}
          >
            <Mic className="size-4" />
          </button>
        </>
      )}

      {onSpeak && (
        <button
          type="button"
          aria-label="Bacakan jawaban"
          title="Bacakan jawaban"
          disabled={busy}
          onClick={onSpeak}
          className={buttonClass}
        >
          <Volume2 className="size-4" />
        </button>
      )}
    </>
  );
}
