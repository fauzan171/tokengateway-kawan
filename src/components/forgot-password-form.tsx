"use client";

/**
 * Formulir "lupa kata sandi" (REQ-NT-16, SDD-7.2, SDD-7.3, SDD-7.4, SDD-7.6).
 *
 * Setelah kirim, pesan yang tampil menjelaskan keadaan APA ADANYA: bila email
 * belum dikonfigurasi operator, tautan reset hanya muncul di log admin. Tidak
 * ada janji "email terkirim" — v1 belum punya pengirim email.
 *
 * Aturan validasi tidak diduplikasi di klien: `onValidate` adalah Server Action
 * dari halaman pemanggil yang menjalankan `validation.ts` (satu sumber
 * kebenaran), mengikuti pola `auth-form.tsx`.
 */

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle, MessageCircle } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { ValidationResult } from "@/lib/auth/validation";

const NETWORK_MESSAGE = "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.";

export type ForgotPasswordFormProps = {
  /** Server Action dari halaman pemanggil; menjalankan validator bersama. */
  onValidate: (values: { email: string }) => Promise<ValidationResult>;
  /** Hasil `config.emailConfigured`: menentukan penjelasan yang jujur. */
  emailConfigured: boolean;
};

export function ForgotPasswordForm({ onValidate, emailConfigured }: ForgotPasswordFormProps) {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const inputId = `${fieldId}-email`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFieldError(null);
    setFormError(null);
    setSent(false);

    let validation: ValidationResult;
    try {
      validation = await onValidate({ email });
    } catch {
      setFormError(NETWORK_MESSAGE);
      setPending(false);
      return;
    }

    if (!validation.success) {
      setFieldError(validation.errors.email ?? "Email tidak valid.");
      setFormError("Periksa kembali isian yang ditandai.");
      setPending(false);
      inputRef.current?.focus();
      return;
    }

    try {
      const response = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setFormError(payload?.error ?? "Permintaan tidak dapat diproses. Coba lagi.");
        setPending(false);
        return;
      }
      setSent(true);
      setPending(false);
    } catch {
      setFormError(NETWORK_MESSAGE);
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3 text-xl font-semibold">
          <span className="rounded-xl bg-foreground p-2 text-background">
            <MessageCircle aria-hidden className="size-5" />
          </span>
          Kawan
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Lupa kata sandi</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Masukkan email akunmu. Kami akan membuat tautan reset kata sandi sekali pakai yang
          berlaku terbatas.
        </p>

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor={inputId} className="block text-sm font-medium">
              Email
            </label>
            <p id={hintId} className="mt-1 text-xs text-muted-foreground">
              {emailConfigured
                ? "Gunakan email yang kamu pakai untuk masuk."
                : "Email belum dikonfigurasi di server ini; tautan reset akan muncul di log admin."}
            </p>
            <input
              id={inputId}
              ref={inputRef}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={pending}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={[hintId, fieldError ? errorId : null].filter(Boolean).join(" ")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={cn(
                "mt-2 block h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-60",
                fieldError ? "border-destructive" : "border-input",
              )}
            />
            {fieldError ? (
              <p
                id={errorId}
                role="alert"
                className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-destructive"
              >
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{fieldError}</span>
              </p>
            ) : null}
          </div>

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

          {sent ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm leading-6"
            >
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {emailConfigured
                  ? "Permintaan diterima. Bila email itu terdaftar, tautan reset sudah dibuat. Pengiriman email belum tersedia di versi ini, jadi hubungi admin bila tautan belum kamu terima."
                  : "Permintaan diterima. Bila email itu terdaftar, tautan reset sudah dibuat dan muncul di log admin — hubungi admin untuk mendapatkan tautannya. Email belum dikonfigurasi di server ini, jadi tidak ada email yang dikirim."}
              </span>
            </div>
          ) : null}

          <Button type="submit" disabled={pending} aria-busy={pending} className="h-11 w-full">
            {pending ? (
              <>
                <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                Memproses…
              </>
            ) : (
              "Kirim tautan reset"
            )}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Ingat kata sandimu?{" "}
          <Link href="/masuk" className="font-medium text-foreground underline underline-offset-4">
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>

      <a
        href="https://tokengateway.ai.id"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        by tokengateway.ai.id
      </a>
    </main>
  );
}
