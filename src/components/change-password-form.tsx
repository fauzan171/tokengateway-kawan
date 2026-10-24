"use client";

/**
 * Formulir ganti kata sandi (REQ-NT-14, SDD-7.3, SDD-7.4).
 *
 * Mengirim ke `POST /api/account/password`. Setelah berhasil, jumlah sesi lain
 * yang dicabut ditampilkan: pengguna perlu tahu perangkat lain benar-benar
 * dikeluarkan, bukan hanya bahwa sandinya berubah.
 *
 * Aksesibilitas mengikuti pola `auth-form.tsx`: label eksplisit, galat ditautkan
 * lewat `aria-describedby` dan diumumkan `role="alert"`, status galat memakai
 * teks bukan hanya warna, target sentuh 44px (`h-11`).
 */

import { useId, useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";

const FIELDS = [
  { name: "currentPassword", label: "password.current", autoComplete: "current-password" },
  { name: "newPassword", label: "password.new", autoComplete: "new-password" },
  { name: "confirmPassword", label: "password.confirmNew", autoComplete: "new-password" },
] as const satisfies readonly { name: string; label: MessageKey; autoComplete: string }[];

type FieldName = (typeof FIELDS)[number]["name"];

const EMPTY: Record<FieldName, string> = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordForm() {
  const t = useT();
  const fieldId = useId();
  const [values, setValues] = useState<Record<FieldName, string>>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setErrors({});
    setFormError(null);
    setSuccess(null);

    if (values.newPassword !== values.confirmPassword) {
      setErrors({ confirmPassword: t("password.mismatch") });
      setFormError(t("common.checkFieldsAgain"));
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; revokedSessions?: number; fields?: Record<string, string> }
        | null;

      if (!response.ok) {
        if (payload?.fields) setErrors(payload.fields as Partial<Record<FieldName, string>>);
        setFormError(payload?.error ?? t("password.changeFailed"));
        setPending(false);
        return;
      }

      const revoked = payload?.revokedSessions ?? 0;
      setSuccess(
        revoked > 0
          ? t("password.changedWithRevoked", { count: revoked })
          : t("password.changedNoRevoked"),
      );
      setValues(EMPTY);
      setPending(false);
    } catch {
      setFormError(t("common.network"));
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      {FIELDS.map((field) => {
        const inputId = `${fieldId}-${field.name}`;
        const errorId = `${inputId}-error`;
        const message = errors[field.name];
        const hasError = Boolean(message);

        return (
          <div key={field.name}>
            <label htmlFor={inputId} className="block text-sm font-medium">
              {t(field.label)}
            </label>
            <input
              id={inputId}
              name={field.name}
              type="password"
              autoComplete={field.autoComplete}
              required
              disabled={pending}
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? errorId : undefined}
              value={values[field.name]}
              onChange={(event) => update(field.name, event.target.value)}
              className={cn(
                "mt-2 block h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-60",
                hasError ? "border-destructive" : "border-input",
              )}
            />
            {hasError ? (
              <p id={errorId} role="alert"
                 className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-destructive">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{message}</span>
              </p>
            ) : null}
          </div>
        );
      })}

      {formError ? (
        <p role="alert" aria-live="assertive"
           className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </p>
      ) : null}

      {success ? (
        <p role="status" aria-live="polite"
           className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm leading-6">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{success}</span>
        </p>
      ) : null}

      <Button type="submit" disabled={pending} aria-busy={pending} className="h-11 w-full">
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
            {t("common.saving")}
          </>
        ) : (
          t("password.save")
        )}
      </Button>
    </form>
  );
}
