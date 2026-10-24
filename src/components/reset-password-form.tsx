"use client";

/**
 * Formulir kata sandi baru untuk tautan reset (REQ-NT-16, SDD-7.3, SDD-7.4,
 * SDD-7.6).
 *
 * Token dibawa sebagai prop dari halaman (`?token=...`) dan ikut terkirim ke
 * `POST /api/account/reset-password`. Bila token kosong, halaman menampilkan
 * keadaan "tautan tidak valid" dengan jalan keluar ke `/lupa-sandi`, bukan
 * formulir yang pasti gagal.
 *
 * Validasi bentuk mengikuti pola `auth-form.tsx`: kecocokan konfirmasi
 * diperiksa di klien untuk umpan balik cepat, aturan panjang dari server.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import type { ValidationResult } from "@/lib/auth/validation";

const FIELDS = [
  { name: "newPassword", label: "password.new", autoComplete: "new-password" },
  { name: "confirmPassword", label: "password.confirmNew", autoComplete: "new-password" },
] as const;

type FieldName = (typeof FIELDS)[number]["name"];

const EMPTY: Record<FieldName, string> = { newPassword: "", confirmPassword: "" };

export type ResetPasswordFormProps = {
  token: string;
  /** Server Action dari halaman pemanggil; menjalankan validator bersama. */
  onValidate: (values: {
    newPassword: string;
    confirmPassword: string;
  }) => Promise<ValidationResult>;
};

export function ResetPasswordForm({ token, onValidate }: ResetPasswordFormProps) {
  const t = useT();
  const fieldId = useId();
  const [values, setValues] = useState<Record<FieldName, string>>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FieldName | null>(null);
  const inputRefs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (pending || !focusTarget) return;
    inputRefs.current[focusTarget]?.focus();
    setFocusTarget(null);
  }, [pending, focusTarget]);

  function update(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setErrors({});
    setFormError(null);
    setSuccess(false);

    let validation: ValidationResult;
    try {
      validation = await onValidate(values);
    } catch {
      setFormError(t("common.network"));
      return;
    }
    if (!validation.success) {
      setErrors(validation.errors as Partial<Record<FieldName, string>>);
      setFormError(t("common.checkFieldsAgain"));
      setFocusTarget("newPassword");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...values }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; fields?: Record<string, string> }
        | null;

      if (!response.ok) {
        if (payload?.fields) {
          setErrors(payload.fields as Partial<Record<FieldName, string>>);
          setFocusTarget("newPassword");
        }
        setFormError(payload?.error ?? t("reset.failed"));
        setPending(false);
        return;
      }

      setSuccess(true);
      setValues(EMPTY);
      setPending(false);
    } catch {
      setFormError(t("common.network"));
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
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
              ref={(element) => {
                inputRefs.current[field.name] = element;
              }}
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
              <p
                id={errorId}
                role="alert"
                className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-destructive"
              >
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{message}</span>
              </p>
            ) : null}
          </div>
        );
      })}

      {formError ? (
        <p
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </p>
      ) : null}

      {success ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm leading-6"
        >
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {t("reset.success")}{" "}
            <Link href="/masuk" className="font-medium text-foreground underline underline-offset-4">
              {t("reset.signInNow")}
            </Link>
            .
          </span>
        </div>
      ) : null}

      <Button type="submit" disabled={pending || success} aria-busy={pending} className="h-11 w-full">
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

/** Halaman pembungkus bersama agar kedua keadaan memakai tajuk yang sama. */
export function ResetPasswordShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3 text-xl font-semibold">
          <BrandMark className="size-9" />
          Kawan
        </div>
        {children}
      </div>

      <a
        href="https://tokengateway.ai.id"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-6 items-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        by tokengateway.ai.id
      </a>
    </main>
  );
}
