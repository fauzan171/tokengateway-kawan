import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm, ResetPasswordShell } from "@/components/reset-password-form";
import { validatePassword } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "Kawan — Chat AI by tokengateway.ai.id",
  description: "Tetapkan kata sandi baru untuk akun Kawan.",
};

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
  const { token } = await searchParams;
  const value = (token ?? "").trim();

  if (!value) {
    return (
      <ResetPasswordShell>
        <h1 className="text-2xl font-semibold tracking-tight">Tautan tidak valid</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tautan reset ini tidak memuat token, jadi kata sandi tidak dapat diubah dari sini.
          Minta tautan baru untuk melanjutkan.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            href="/lupa-sandi"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Minta tautan reset baru
          </Link>
        </p>
      </ResetPasswordShell>
    );
  }

  // Server Action: memakai validator bersama di server supaya aturan panjang
  // kata sandi tidak diduplikasi di klien (lihat catatan di auth-form.tsx).
  async function validate(values: { newPassword: string; confirmPassword: string }) {
    "use server";
    const errors: Record<string, string> = {};
    const passwordError = validatePassword(values.newPassword);
    if (passwordError) errors.newPassword = passwordError;
    if (!values.confirmPassword || values.newPassword !== values.confirmPassword) {
      errors.confirmPassword = "Kata sandi tidak cocok.";
    }
    return { success: Object.keys(errors).length === 0, errors };
  }

  return (
    <ResetPasswordShell>
      <h1 className="text-2xl font-semibold tracking-tight">Tetapkan kata sandi baru</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Setelah kata sandi berganti, semua perangkat yang sebelumnya masuk akan dikeluarkan.
      </p>
      <ResetPasswordForm token={value} onValidate={validate} />
      <p className="mt-6 text-sm text-muted-foreground">
        Tautan sudah kedaluwarsa?{" "}
        <Link
          href="/lupa-sandi"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Minta tautan baru
        </Link>
      </p>
    </ResetPasswordShell>
  );
}
