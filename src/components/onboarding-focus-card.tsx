"use client";

/**
 * Kartu fokus onboarding (SDD-FRONTEND §D4).
 *
 * Controlled: nilai terpilih masuk lewat `value`, hasil keluar lewat `onChange`.
 * Tanpa fetch dan tanpa fungsi simpan sendiri — halaman task dan pengaturan
 * memakai kartu yang sama, masing-masing yang menyimpan.
 *
 * Nilai tersimpan: `riset` | `data` | `tulis` | `campur` | `custom:<teks>`.
 * "Lewati dulu" hanya menyembunyikan kartu di sesi ini (state lokal); tidak
 * menulis apa pun, jadi kartu muncul lagi sampai pertanyaannya dijawab.
 *
 * Label dibaca sendiri lewat `useT()` (pola `settings-form.tsx`): props-nya
 * sudah tetap sesuai spek, jadi tidak perlu satu prop lagi untuk terjemahan.
 */

import { useEffect, useId, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";

const PRESETS = [
  { value: "riset", label: "onboarding.opt.research" },
  { value: "data", label: "onboarding.opt.data" },
  { value: "tulis", label: "onboarding.opt.writing" },
  { value: "campur", label: "onboarding.opt.mixed" },
] as const satisfies readonly { value: string; label: MessageKey }[];

/** Nilai radio "Lainnya"; disimpan sebagai `custom:<teks>`. */
const CUSTOM = "custom";

export function OnboardingFocusCard({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const t = useT();
  const group = useId();
  const isCustom = value.startsWith(`${CUSTOM}:`);
  const [choice, setChoice] = useState(isCustom ? CUSTOM : value);
  const [text, setText] = useState(isCustom ? value.slice(CUSTOM.length + 1) : "");
  const [dismissed, setDismissed] = useState(false);

  // Resync saat prop `value` berubah (mis. halaman memuat fokus tersimpan setelah mount).
  // `choice`/`text` sengaja lokal agar pilihan tampil sebelum "Simpan"; `dismissed` tetap lokal.
  useEffect(() => {
    const next = value.startsWith(`${CUSTOM}:`);
    setChoice(next ? CUSTOM : value);
    setText(next ? value.slice(CUSTOM.length + 1) : "");
  }, [value]);

  if (dismissed) return null;

  function save() {
    if (choice === CUSTOM) {
      const trimmed = text.trim();
      if (!trimmed) return;
      onChange(`${CUSTOM}:${trimmed}`);
      return;
    }
    if (choice) onChange(choice);
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <legend className="px-1 font-medium">{t("onboarding.title")}</legend>
      <p className="text-muted-foreground">{t("onboarding.subtitle")}</p>

      <div
        data-testid="onboarding-options"
        data-compact={compact}
        className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}
      >
        {PRESETS.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3"
          >
            <input
              type="radio"
              name={group}
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="size-4 shrink-0"
            />
            <span>{t(option.label)}</span>
          </label>
        ))}

        <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3">
          <input
            type="radio"
            name={group}
            value={CUSTOM}
            checked={choice === CUSTOM}
            onChange={() => setChoice(CUSTOM)}
            className="size-4 shrink-0"
          />
          <span>{t("onboarding.opt.custom")}</span>
        </label>

        {choice === CUSTOM ? (
          <input
            type="text"
            maxLength={200}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("onboarding.opt.customPlaceholder")}
            /* nama aksesibel tanpa elipsis (placeholder tetap apa adanya) */
            aria-label={t("onboarding.opt.customPlaceholder").replace(/…$/, "")}
            className="min-h-11 rounded-lg border bg-background px-3 sm:col-span-2"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} className="h-11">
          {t("onboarding.save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="h-11"
        >
          {t("onboarding.skipped")}
        </Button>
      </div>
    </fieldset>
  );
}