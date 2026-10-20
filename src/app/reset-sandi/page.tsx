import Link from "next/link";
import { ResetPasswordForm, ResetPasswordShell } from "@/components/reset-password-form";
import { validatePassword } from "@/lib/auth/validation";
import { serverT } from "@/lib/page-i18n";
import { pageMetadata } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("resetSandi");
}

type ResetSandiPageProps = {
  searchParams: Promise<{ token?: string }>;
};

/**
 * Halaman penetapan kata sandi baru dari tautan reset (REQ-NT-16, SDD-7.2).
 *
 * Token diambil dari query string. Bila kosong, halaman menampilkan keadaan
 * yang jelas dengan tautan ke `/lupa-sandi` — bukan formulir yang pasti gagal,
 * dan bukan galat mentah. Validitas token yang sesungguhnya tetap diputuskan
 * server saat submit; halaman ini hanya menangani bentuknya.
 */
export default async function ResetSandiPage({ searchParams }: ResetSandiPageProps) {
  const t = await serverT();
  const { token } = await searchParams;
  const value = (token ?? "").trim();

  if (!value) {
    return (
      <ResetPasswordShell>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reset.invalidTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("reset.invalidBody")}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            href="/lupa-sandi"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t("reset.requestNew")}
          </Link>
        </p>
      </ResetPasswordShell>
    );
  }

  // Server Action: memakai validator bersama di server supaya aturan panjang
  // kata sandi tidak diduplikasi di klien (lihat catatan di auth-form.tsx).
  async function validate(values: { newPassword: string; confirmPassword: string }) {
    "use server";
    const t = await serverT();
    const errors: Record<string, string> = {};
    const passwordError = validatePassword(values.newPassword);
    if (passwordError) errors.newPassword = passwordError;
    if (!values.confirmPassword || values.newPassword !== values.confirmPassword) {
      errors.confirmPassword = t("password.mismatch");
    }
    return { success: Object.keys(errors).length === 0, errors };
  }

  return (
    <ResetPasswordShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t("reset.title")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t("reset.subtitle")}
      </p>
      <ResetPasswordForm token={value} onValidate={validate} />
      <p className="mt-6 text-sm text-muted-foreground">
        {t("reset.expired")}{" "}
        <Link
          href="/lupa-sandi"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t("reset.requestNewShort")}
        </Link>
      </p>
    </ResetPasswordShell>
  );
}
