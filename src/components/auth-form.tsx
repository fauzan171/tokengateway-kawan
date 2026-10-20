"use client";

/**
 * Formulir autentikasi bersama untuk halaman masuk dan daftar (REQ-NT-11,
 * SDD-7.2, SDD-7.3, SDD-7.4, SDD-7.6).
 *
 * Aturan validasi **tidak** diduplikasi di sini: komponen ini memanggil
 * `onValidate`, sebuah Server Action yang dirakit tiap halaman dari
 * `src/lib/auth/validation.ts` (satu sumber kebenaran). Server Action dipakai
 * karena `validation.ts` menurunkan `MIN_PASSWORD_LENGTH` dari `password.ts`
 * yang mengimpor `@node-rs/argon2`; mengimpor validator langsung ke bundel
 * klien membuat `next build` gagal mencari `@node-rs/argon2-wasm32-wasi`.
 *
 * Semua teks berbahasa Indonesia. Galat ditampilkan sebagai teks + ikon
 * (bukan warna saja), dihubungkan lewat `aria-describedby`, dan diumumkan
 * lewat `role="alert"` / `aria-live`.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";
import type { ValidationResult } from "@/lib/auth/validation";

export type AuthFormValues = {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
};

export type AuthFormProps = {
  mode: "login" | "register";
  /** Pesan informasi yang ditampilkan di atas formulir (mis. akun perlu aktivasi). */
  notice?: string;
  /** Formulir ditutup (mis. pendaftaran publik dimatikan admin, REQ-NT-76). */
  closed?: boolean;
  /** Server Action dari halaman pemanggil; menjalankan validator bersama. */
  onValidate: (values: AuthFormValues) => Promise<ValidationResult>;
};

type FieldName = keyof AuthFormValues;

type FieldSpec = {
  name: FieldName;
  label: MessageKey;
  type: "email" | "text" | "password";
  autoComplete: string;
  required: boolean;
  hint?: MessageKey;
  inputMode?: "email" | "text";
};

const EMAIL_FIELD: FieldSpec = {
  name: "email",
  label: "auth.email",
  type: "email",
  autoComplete: "email",
  inputMode: "email",
  required: true,
};

const LOGIN_FIELDS: FieldSpec[] = [
  EMAIL_FIELD,
  { name: "password", label: "auth.password", type: "password", autoComplete: "current-password", required: true },
];

const REGISTER_FIELDS: FieldSpec[] = [
  EMAIL_FIELD,
  {
    name: "name",
    label: "auth.nameOptional",
    type: "text",
    autoComplete: "name",
    required: false,
    hint: "auth.nameHint",
  },
  {
    name: "password",
    label: "auth.password",
    type: "password",
    autoComplete: "new-password",
    required: true,
    hint: "auth.passwordHint",
  },
  { name: "confirmPassword", label: "auth.confirmPassword", type: "password", autoComplete: "new-password", required: true },
];

const FIELD_ORDER: FieldName[] = ["email", "name", "password", "confirmPassword"];

/**
 * Pesan tunggal untuk semua kegagalan login: tidak mengungkap apakah sebuah
 * email terdaftar (REQ-NT-11). Kegagalan kredensial dan akun nonaktif
 * menghasilkan pesan yang sama persis.
 */
const TEXT: Record<AuthFormProps["mode"], { title: MessageKey; subtitle: MessageKey; submit: MessageKey }> = {
  login: {
    title: "auth.loginTitle",
    subtitle: "auth.loginSubtitle",
    submit: "auth.loginSubmit",
  },
  register: {
    title: "auth.registerTitle",
    subtitle: "auth.registerSubtitle",
    submit: "auth.registerSubmit",
  },
};

function firstErrorName(errors: Record<string, string>): FieldName | undefined {
  return FIELD_ORDER.find((name) => errors[name]);
}

export function AuthForm({ mode, notice, closed = false, onValidate }: AuthFormProps) {
  const t = useT();
  const router = useRouter();
  const fieldId = useId();
  const [values, setValues] = useState<AuthFormValues>({
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Bidang yang harus difokuskan setelah `pending` kembali false. Memfokuskan
   *  saat `pending` masih true akan gagal diam-diam karena input `disabled`. */
  const [focusTarget, setFocusTarget] = useState<FieldName | null>(null);
  const inputRefs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});

  const fields = mode === "login" ? LOGIN_FIELDS : REGISTER_FIELDS;
  const text = TEXT[mode];

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

    setPending(true);
    setFormError(null);
    setErrors({});

    let validation: ValidationResult;
    try {
      validation = await onValidate(values);
    } catch {
      setFormError(t("common.network"));
      setPending(false);
      return;
    }

    if (!validation.success) {
      const fieldErrors = validation.errors as Partial<Record<FieldName, string>>;
      setErrors(fieldErrors);
      setFormError(t("common.checkFieldsAgain"));
      setPending(false);
      setFocusTarget(firstErrorName(validation.errors) ?? null);
      return;
    }

    try {
      if (mode === "login") {
        const result = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
        });
        if (!result || result.error) {
          setFormError(t("auth.loginFailed"));
          setPending(false);
          return;
        }
        router.replace("/");
        router.refresh();
        return;
      }

      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; fields?: Record<string, string> }
        | null;

      if (!response.ok) {
        if (payload?.fields) {
          setErrors(payload.fields as Partial<Record<FieldName, string>>);
          setFormError(t("common.checkFieldsAgain"));
          setFocusTarget(firstErrorName(payload.fields) ?? null);
        } else {
          setFormError(payload?.error ?? t("auth.registerFailed"));
        }
        setPending(false);
        return;
      }

      // Mode tanpa SMTP: akun non-pertama berstatus `pending`. Jangan
      // menjanjikan login langsung; arahkan ke halaman masuk dengan pesan
      // aktivasi (REQ-NT-11).
      router.push("/masuk?daftar=berhasil");
    } catch {
      setFormError(t("common.network"));
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3 text-xl font-semibold">
          <BrandMark className="size-9" />
          Kawan
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{t(text.title)}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(text.subtitle)}</p>

        {notice ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-6 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm leading-6"
          >
            {closed ? (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{notice}</span>
          </p>
        ) : null}

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          {fields.map((field) => {
            const inputId = `${fieldId}-${field.name}`;
            const errorId = `${inputId}-error`;
            const hintId = `${inputId}-hint`;
            const message = errors[field.name];
            const hasError = Boolean(message);
            const describedBy =
              [field.hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

            return (
              <div key={field.name}>
                <label htmlFor={inputId} className="block text-sm font-medium">
                  {t(field.label)}
                </label>
                {field.hint ? (
                  <p id={hintId} className="mt-1 text-xs text-muted-foreground">
                    {t(field.hint)}
                  </p>
                ) : null}
                <input
                  id={inputId}
                  ref={(element) => {
                    inputRefs.current[field.name] = element;
                  }}
                  name={field.name}
                  type={field.type}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  autoCapitalize={field.type === "email" ? "none" : undefined}
                  spellCheck={field.type === "email" ? false : undefined}
                  required={field.required}
                  disabled={pending}
                  aria-invalid={hasError || undefined}
                  aria-describedby={describedBy}
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
                  <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-destructive">
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

          <Button type="submit" disabled={pending || closed} aria-busy={pending} className="h-11 w-full">
            {pending ? (
              <>
                <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                {t("common.processing")}
              </>
            ) : (
              t(text.submit)
            )}
          </Button>
        </form>

        {mode === "login" ? (
          <p className="mt-4 text-sm">
            <Link
              href="/lupa-sandi"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("auth.forgot")}
            </Link>
          </p>
        ) : null}

        <p className="mt-6 text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              {t("auth.noAccount")}{" "}
              <Link href="/daftar" className="font-medium text-foreground underline underline-offset-4">
                {t("auth.registerNow")}
              </Link>
            </>
          ) : (
            <>
              {t("auth.haveAccount")}{" "}
              <Link href="/masuk" className="font-medium text-foreground underline underline-offset-4">
                {t("auth.signInHere")}
              </Link>
            </>
          )}
        </p>
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
