"use client";

/**
 * Pengaturan pribadi (REQ-NT-70): tema, bahasa, ukuran font, preferensi kirim.
 *
 * Tiap perubahan langsung `PATCH` dan langsung berlaku — tema dan ukuran font
 * diterapkan ke `document.documentElement`, bukan menunggu muat ulang. Slider
 * ditahan 400 ms supaya satu tarikan tidak jadi puluhan permintaan.
 *
 * Tanpa prop: komponen memuat sendiri dari `GET /api/kawan/v1/settings`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserSettings } from "@/lib/settings/settings";

const FONT_MIN = 90;
const FONT_MAX = 130;

type Patch = Partial<UserSettings>;

/** Terapkan ke dokumen: `data-theme` untuk kelas gelap, `fontSize` untuk skala. */
function apply(settings: UserSettings) {
  const root = document.documentElement;
  const dark =
    settings.theme === "dark" ||
    (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = settings.theme;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.style.fontSize = `${settings.fontScale}%`;
  // `page.tsx` memulihkan tema dari localStorage saat mount; tanpa ini dua
  // sumber saling menimpa dan pilihan kembali ke nilai lama setelah muat ulang.
  try {
    localStorage.setItem("kawan-theme", settings.theme);
  } catch { /* Storage can be unavailable in private browsers. */ }
}

export function SettingsForm() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/kawan/v1/settings");
        if (!res.ok) throw new Error("gagal");
        const data = (await res.json()) as { settings: UserSettings };
        if (!alive) return;
        setSettings(data.settings);
        apply(data.settings);
      } catch {
        if (alive) setError("Gagal memuat pengaturan.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async (patch: Patch) => {
    setError(null);
    try {
      const res = await fetch("/api/kawan/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { settings: UserSettings };
      setSettings(data.settings);
      apply(data.settings);
    } catch {
      setError("Perubahan tidak tersimpan. Coba lagi.");
    }
  }, []);

  /** Nilai tampil langsung berubah; penyimpanan ditunda untuk slider. */
  function change(patch: Patch, debounce = 0) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    if (debounce > 0) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(patch), debounce);
      return;
    }
    void save(patch);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Memuat pengaturan…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label htmlFor="theme" className="font-medium">
          Tema tampilan
        </label>
        <select
          id="theme"
          value={settings.theme}
          onChange={(event) => change({ theme: event.target.value as UserSettings["theme"] })}
          className="min-h-11 w-full rounded-lg border bg-background px-3 sm:w-56"
        >
          <option value="system">Ikuti sistem</option>
          <option value="light">Terang</option>
          <option value="dark">Gelap</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="locale" className="font-medium">
          Bahasa
        </label>
        <select
          id="locale"
          value={settings.locale}
          onChange={(event) => change({ locale: event.target.value as UserSettings["locale"] })}
          className="min-h-11 w-full rounded-lg border bg-background px-3 sm:w-56"
        >
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="font-scale" className="font-medium">
          Ukuran font: {settings.fontScale}%
        </label>
        <input
          id="font-scale"
          type="range"
          min={FONT_MIN}
          max={FONT_MAX}
          step={5}
          value={settings.fontScale}
          aria-valuetext={`${settings.fontScale} persen`}
          onChange={(event) => change({ fontScale: Number(event.target.value) }, 400)}
          className="min-h-11 w-full sm:w-56"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="send-on-enter"
          type="checkbox"
          checked={settings.sendOnEnter}
          onChange={(event) => change({ sendOnEnter: event.target.checked })}
          className="size-5"
        />
        <label htmlFor="send-on-enter" className="font-medium">
          Enter mengirim pesan
        </label>
      </div>

      {error ? (
        <p role="status" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
