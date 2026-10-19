import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { loadConfig } from "@/lib/config/env";
import { validateEmail } from "@/lib/auth/validation";
import { serverT } from "@/lib/page-i18n";

export const metadata: Metadata = {
  title: "Kawan — Chat AI by tokengateway.ai.id",
  description: "Minta tautan reset kata sandi akun Kawan.",
};

/**
 * Konfigurasi dibaca saat permintaan, bukan saat build: `loadConfig()`
 * memvalidasi env runtime, dan `next build` berjalan tanpa env produksi.
 * Halaman ini juga selalu menampilkan keadaan konfigurasi terkini.
 */
export const dynamic = "force-dynamic";

/**
 * Halaman permintaan tautan reset (REQ-NT-16, SDD-7.2).
 *
 * `emailConfigured` dibaca di server dari registry konfigurasi dan diteruskan
 * ke klien supaya penjelasan yang tampil sesuai keadaan sebenarnya: bila email
 * belum dikonfigurasi, UI mengatakan tautan muncul di log admin — bukan
 * menjanjikan email terkirim.
 */
export default async function LupaSandiPage() {
  const { emailConfigured } = loadConfig();

  // Server Action: menjalankan validator bersama di server, sehingga aturan
  // email tidak diduplikasi di klien (lihat catatan di auth-form.tsx).
  async function validate(values: { email: string }) {
    "use server";
    const t = await serverT();
    const emailError = validateEmail(values.email);
    const errors: Record<string, string> = {};
    if (emailError) errors.email = t("forgot.invalidEmail");
    return { success: emailError === null, errors };
  }

  return <ForgotPasswordForm emailConfigured={emailConfigured} onValidate={validate} />;
}
