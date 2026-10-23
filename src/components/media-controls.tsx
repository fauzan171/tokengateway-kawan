"use client";

/**
 * Kontrol media opsional (WP-NT-P8-01/03/04, REQ-NT-65/67/68; FIX-16).
 *
 * Komponen ini TIDAK menerima flag kapabilitas: pemanggil hanya merendernya
 * bila ada fitur yang tersedia, dan hanya mengisi handler untuk fitur itu.
 * Tombol yang tidak punya handler tidak dirender — jadi tidak mungkin ada
 * tombol mati (REQ-NT-69).
 *
 * FIX-16: merekam memakai MediaRecorder setelah klik pengguna (gesture) dengan
 * batas 60 detik; hasil rekaman berupa `Blob` yang diteruskan ke `onTranscribe`.
 * Bila MediaRecorder/codec tidak tersedia, tombol rekam diganti tombol unggah.
 * Transkrip masuk sebagai draft yang bisa disunting — TIDAK langsung terkirim.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { Image as ImageIcon, Mic, Square, Upload, Volume2 } from "lucide-react";

const buttonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground disabled:opacity-50";

/** Batas durasi rekaman; direkam dulu baru dikirim. */
const MAX_RECORD_SECONDS = 60;

export function useRecordingSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);
  return supported;
}

export function stopObjectUrl(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}

export function MediaControls({
  onImage,
  onTranscribe,
  onSpeak,
  onStopSpeak,
  speaking = false,
  busy,
  prompt = "",
}: {
  onImage?: (prompt: string) => void;
  onTranscribe?: (file: File) => void;
  onSpeak?: () => void;
  /** Membatalkan pemutaran: URL objek dicabut, audio dihentikan. */
  onStopSpeak?: () => void;
  speaking?: boolean;
  busy: boolean;
  /** Draft saat ini: tombol gambar mati bila prompt kosong. */
  prompt?: string;
}) {
  const t = useT();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const canRecord = useRecordingSupported();
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lepas stream bila komponen dibongkar saat merekam; izin mic tidak menggantung.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], "rekaman.webm", { type: blob.type || "audio/webm" });
        if (file.size > 0) onTranscribe?.(file);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
      timerRef.current = setTimeout(() => recorder.stop(), MAX_RECORD_SECONDS * 1000);
    } catch {
      // Izin ditolak / tidak ada mic: pengguna tetap bisa lewat tombol unggah.
      audioInputRef.current?.click();
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
  }

  return (
    <>
      {onImage && (
        <button
          type="button"
          aria-label={t("media.image")}
          title={t("media.imageTitle")}
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
          {/* Izin hanya diminta SETELAH klik; sebelum itu tidak ada getUserMedia. */}
          {canRecord ? (
            <button
              type="button"
              aria-label={recording ? t("media.stopRecording") : t("media.record")}
              title={recording ? t("media.stopRecordingTitle") : t("media.recordTitle")}
              disabled={busy}
              onClick={() => (recording ? stopRecording() : startRecording())}
              className={buttonClass}
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            </button>
          ) : (
            <button
              type="button"
              aria-label={t("media.transcribe")}
              title={t("media.transcribeTitle")}
              disabled={busy}
              onClick={() => audioInputRef.current?.click()}
              className={buttonClass}
            >
              <Upload className="size-4" />
            </button>
          )}
        </>
      )}

      {onSpeak && (
        // FIX-16: saat audio diputar tombol menjadi "hentikan", sehingga
        // pemutaran bisa dibatalkan dan URL objeknya dicabut.
        <button
          type="button"
          aria-label={speaking ? t("media.speakCancel") : t("media.speak")}
          title={speaking ? t("media.speakCancel") : t("media.speak")}
          disabled={busy}
          onClick={() => (speaking && onStopSpeak ? onStopSpeak() : onSpeak())}
          className={buttonClass}
        >
          {speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      )}
    </>
  );
}
