"use client";

/**
 * Formulir onboarding "Hubungkan Gateway" (REQ-NT-01, REQ-NT-04, REQ-NT-05,
 * REQ-NT-06, REQ-NT-08, SDD-7.2).
 *
 * Komponen ini TIDAK menulis ulang aturan apa pun yang sudah dibekukan:
 * normalisasi URL tetap milik `src/lib/connections/url.ts` (dijalankan di
 * endpoint), dan bentuk balasan tetap milik endpoint WP-NT-P2-06. Klien hanya
 * memanggil endpoint lalu menampilkan pesan yang dikembalikan server — pesan
 * itu sudah bahasa Indonesia dan siap tampil (SDD-5.4).
 *
 * Alur simpan mengikuti REQ-NT-04: tombol "Simpan" hanya aktif setelah uji
 * koneksi sukses, KECUALI pengguna mencentang "Simpan tanpa uji" — dan
 * konsekuensinya (koneksi `draft`, belum bisa dipakai chat sampai diuji)
 * dinyatakan terang-terangan, tidak disembunyikan.
 *
 * Aksesibilitas mengikuti pola `auth-form.tsx`: label eksplisit,
 * `aria-describedby`, `role="alert"`/`role="status"`, galat memakai teks
 * (bukan hanya warna), target sentuh ≥44px (`h-11`), dan animasi menghormati
 * `prefers-reduced-motion`.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useT, type Translate } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";

/** Situs pendaftaran gateway; satu sumber untuk kedua tautan keluar (REQ-NT-05/06). */
const GATEWAY_SITE = "https://tokengateway.ai.id";

/** Placeholder Base URL — persis seperti REQ-NT-01. */
const BASE_URL_PLACEHOLDER = "https://api.tokengateway.ai.id/v1";


type FieldName = "name" | "baseUrl" | "apiKey";

type FieldSpec = {
  name: FieldName;
  label: MessageKey;
  type: "text" | "url" | "password";
  autoComplete: string;
  placeholder?: string;
  hint?: MessageKey;
};

const FIELDS: FieldSpec[] = [
  {
    name: "name",
    label: "gateway.nameLabel",
    type: "text",
    autoComplete: "off",
    hint: "gateway.nameHint",
  },
  {
    name: "baseUrl",
    label: "gateway.baseUrlLabel",
    type: "url",
    autoComplete: "url",
    placeholder: BASE_URL_PLACEHOLDER,
    hint: "gateway.baseUrlHint",
  },
  {
    name: "apiKey",
    label: "gateway.apiKeyLabel",
    type: "password",
    autoComplete: "off",
    hint: "gateway.apiKeyHint",
  },
];

const FIELD_ORDER: FieldName[] = ["name", "baseUrl", "apiKey"];

/** Hasil uji koneksi seperti yang ditampilkan ke pengguna. */
type TestState =
  | { status: "idle" }
  | { status: "ok"; modelCount: number; sampleModels: string[] }
  | { status: "fail"; message: string };

type ErrorEnvelope = { error?: { code?: string; message?: string } };

function firstMissing(values: Record<FieldName, string>): FieldName | undefined {
  return FIELD_ORDER.find((name) => values[name].trim() === "");
}

/** Pesan ramah untuk field wajib yang masih kosong; aturan sebenarnya tetap
 *  milik server, ini hanya umpan balik cepat. */
function missingMessage(t: Translate, name: FieldName): string {
  if (name === "name") return t("gateway.missingName");
  if (name === "baseUrl") return t("gateway.missingBaseUrl");
  return t("gateway.missingApiKey");
}

/** Field mana yang salah berdasarkan `code` galat server (kosakata SDD-3.2). */
function fieldForCode(code: string | undefined): FieldName {
  if (code === "INVALID_NAME") return "name";
  if (code === "INVALID_API_KEY") return "apiKey";
  return "baseUrl"; // BAD_URL | BAD_SCHEME | BAD_HOST
}

export function ConnectGatewayForm({ defaultBaseUrl }: { defaultBaseUrl: string | null }) {
  const t = useT();
  const router = useRouter();
  const fieldId = useId();
  const [values, setValues] = useState<Record<FieldName, string>>({ name: "", baseUrl: "", apiKey: "" });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [skipTest, setSkipTest] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FieldName | null>(null);
  const inputRefs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});

  const busy = testing || saving;
  const allFilled = FIELD_ORDER.every((name) => values[name].trim() !== "");
  /** Simpan hanya aktif setelah uji sukses, atau bila pengguna sadar memilih
   *  "Simpan tanpa uji" (REQ-NT-04). */
  const canSave = allFilled && (test.status === "ok" || skipTest);

  useEffect(() => {
    if (busy || !focusTarget) return;
    inputRefs.current[focusTarget]?.focus();
    setFocusTarget(null);
  }, [busy, focusTarget]);

  function update(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    // Mengubah isian membatalkan hasil uji: URL atau key yang berbeda belum
    // pernah diuji, jadi tombol Simpan harus kembali menunggu uji baru.
    if (test.status !== "idle") setTest({ status: "idle" });
  }

  /** Membaca pesan galat dari amplop `{ error: { message } }` (SDD-3.1). */
  async function readError(response: Response, fallback: string): Promise<{ code?: string; message: string }> {
    const payload = (await response.json().catch(() => null)) as ErrorEnvelope | null;
    return { code: payload?.error?.code, message: payload?.error?.message ?? fallback };
  }

  async function handleTest() {
    if (busy) return;
    setFormError(null);
    setErrors({});

    const missing = firstMissing(values);
    if (missing) {
      setErrors({ [missing]: missingMessage(t, missing) });
      setFormError(t("gateway.fillBeforeTest"));
      setFocusTarget(missing);
      return;
    }

    setTesting(true);
    try {
      const response = await fetch("/api/kawan/v1/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: values.baseUrl.trim(), apiKey: values.apiKey.trim() }),
      });

      // Hanya input salah bentuk/value yang 4xx (WP-NT-P2-06). Kegagalan uji
      // sendiri selalu 200 dengan `{ ok: false }`.
      if (!response.ok) {
        const { code, message } = await readError(response, t("gateway.testFailed"));
        const field = fieldForCode(code);
        setErrors({ [field]: message });
        setFormError(t("common.checkFields"));
        setTest({ status: "idle" });
        setFocusTarget(field);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; modelCount: number; sampleModels?: string[] }
        | { ok: false; reason?: string; message?: string }
        | null;

      if (payload && payload.ok === true) {
        setTest({ status: "ok", modelCount: payload.modelCount, sampleModels: payload.sampleModels ?? [] });
      } else {
        setTest({ status: "fail", message: payload?.message ?? t("gateway.testFailed") });
      }
    } catch {
      setTest({ status: "idle" });
      setFormError(t("common.network"));
    } finally {
      setTesting(false);
    }
  }

  async function handleUseDefault() {
    if (busy) return;
    setFormError(null);
    setErrors({});
    setSaving(true);
    try {
      const response = await fetch("/api/kawan/v1/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useDefault: true, name: t("gateway.defaultName"), skipTest: false }),
      });

      if (!response.ok) {
        const { message } = await readError(response, t("gateway.saveFailed"));
        setFormError(message);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setFormError(t("common.network"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    setErrors({});

    const missing = firstMissing(values);
    if (missing) {
      setErrors({ [missing]: missingMessage(t, missing) });
      setFormError(t("gateway.fillBeforeSave"));
      setFocusTarget(missing);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/kawan/v1/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          baseUrl: values.baseUrl.trim(),
          apiKey: values.apiKey.trim(),
          skipTest,
        }),
      });

      if (!response.ok) {
        const { code, message } = await readError(response, t("gateway.saveFailed"));
        const field = fieldForCode(code);
        setErrors({ [field]: message });
        setFormError(t("common.checkFields"));
        setFocusTarget(field);
        return;
      }

      // Berhasil: jangan tampilkan kunci lagi. Bersihkan isian lalu kembali ke
      // beranda, yang kini mengenali koneksi aktif.
      setValues({ name: "", baseUrl: "", apiKey: "" });
      router.replace("/");
      router.refresh();
    } catch {
      setFormError(t("common.network"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3 text-xl font-semibold">
          <BrandMark className="size-9" />
          Kawan
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{t("gateway.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("gateway.subtitle")}
        </p>

        {/* Jalur cepat: gateway bawaan operator. Tanpa isian apa pun. */}
        <section aria-labelledby={`${fieldId}-default`} className="mt-6 rounded-lg border p-4">
          <h2 id={`${fieldId}-default`} className="text-sm font-medium">
            {t("gateway.defaultTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {defaultBaseUrl
              ? t("gateway.defaultHint")
              : t("gateway.defaultUnavailable")}
          </p>
          {defaultBaseUrl ? (
            <p className="mt-1 break-all text-xs text-muted-foreground">{defaultBaseUrl}</p>
          ) : null}
          <Button
            type="button"
            onClick={handleUseDefault}
            disabled={busy || defaultBaseUrl === null}
            aria-busy={saving}
            className="mt-3 h-11 w-full"
          >
            {saving ? (
              <>
                <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                {t("common.saving")}
              </>
            ) : (
              t("gateway.defaultCta")
            )}
          </Button>
        </section>

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          {FIELDS.map((field) => {
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
                  autoComplete={field.autoComplete}
                  autoCapitalize={field.name === "baseUrl" ? "none" : undefined}
                  spellCheck={field.name === "baseUrl" ? false : undefined}
                  placeholder={field.placeholder}
                  disabled={busy}
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
                {field.name === "baseUrl" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("gateway.signUpPrompt")}{" "}
                    <a
                      href={GATEWAY_SITE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {t("gateway.signUpLink")}
                    </a>
                  </p>
                ) : null}
                {hasError ? (
                  <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-destructive">
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>{message}</span>
                  </p>
                ) : null}
              </div>
            );
          })}

          {/* Hasil uji: sukses (dengan jumlah model) atau gagal yang dapat ditindaklanjuti. */}
          <div role="status" aria-live="polite">
            {test.status === "ok" ? (
              <p className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm leading-6">
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  {test.sampleModels.length > 0
                    ? t("gateway.testSuccessSamples", {
                        count: test.modelCount,
                        samples: test.sampleModels.join(", "),
                      })
                    : t("gateway.testSuccess", { count: test.modelCount })}
                </span>
              </p>
            ) : test.status === "fail" ? (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{t("gateway.testFailedPrefix", { message: test.message })}</span>
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={busy}
            aria-busy={testing}
            className="h-11 w-full"
          >
            {testing ? (
              <>
                <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                {t("gateway.testing")}
              </>
            ) : (
              t("gateway.test")
            )}
          </Button>

          {/* "Simpan tanpa uji": pilihan sadar, konsekuensinya dinyatakan jelas.
              Baris label dibuat setinggi ≥44px agar nyaman disentuh (SDD-7.4). */}
          <div className="rounded-lg border p-3">
            <label htmlFor={`${fieldId}-skip`} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                id={`${fieldId}-skip`}
                type="checkbox"
                checked={skipTest}
                disabled={busy}
                onChange={(event) => setSkipTest(event.target.checked)}
                aria-describedby={`${fieldId}-skip-hint`}
                className="size-5 shrink-0 rounded border-input accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="text-sm font-medium">{t("gateway.skipTest")}</span>
            </label>
            <p id={`${fieldId}-skip-hint`} className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("gateway.skipTestHintBefore")}
              <strong>{t("gateway.skipTestHintDraft")}</strong>
              {t("gateway.skipTestHintAfter")}
            </p>
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

          <Button type="submit" disabled={busy || !canSave} aria-busy={saving} className="h-11 w-full">
            {saving ? (
              <>
                <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </form>

        {/* Teks keamanan jujur (REQ-NT-08): tanpa klaim "key tidak pernah menyentuh server". */}
        <section aria-labelledby={`${fieldId}-keamanan`} className="mt-6 rounded-lg border bg-muted/40 p-4">
          <h2 id={`${fieldId}-keamanan`} className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck aria-hidden className="size-4 shrink-0" />
            {t("gateway.securityTitle")}
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t("gateway.securityBefore")}
            <strong>{t("gateway.securityEncrypted")}</strong>
            {t("gateway.securityMiddle")}
            <strong>{t("gateway.securityForward")}</strong>
            {t("gateway.securityAfter")}
          </p>
        </section>

        {/* CTA saat gagal atau belum punya gateway (REQ-NT-06). */}
        {test.status === "fail" || test.status === "idle" ? (
          <section aria-labelledby={`${fieldId}-cta`} className="mt-4 rounded-lg border p-4">
            <h2 id={`${fieldId}-cta`} className="text-sm font-medium">
              {t("gateway.noKeyTitle")}
            </h2>
            <a
              href={GATEWAY_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t("gateway.openSite")}
            </a>
          </section>
        ) : null}
      </div>

      <a
        href={GATEWAY_SITE}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-6 items-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        by tokengateway.ai.id
      </a>
    </main>
  );
}
