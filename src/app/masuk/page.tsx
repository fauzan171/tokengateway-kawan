import type { Metadata } from "next";
import { AuthForm, type AuthFormValues } from "@/components/auth-form";
import { validateLogin } from "@/lib/auth/validation";

export const metadata: Metadata = {
  title: "Kawan — Chat AI by tokengateway.ai.id",
  description: "Masuk ke Kawan dengan email dan kata sandi.",
};

type MasukPageProps = {
  searchParams: Promise<{ daftar?: string }>;
};

/** Ditampilkan setelah pengalihan dari `/daftar`. Tidak menjanjikan login
 *  langsung: pada mode tanpa SMTP hanya akun pertama yang berstatus `active`. */
const REGISTER_NOTICE =
  "Pendaftaran berhasil. Bila ini akun pertama, kamu bisa langsung masuk; selain itu akun perlu diaktifkan admin terlebih dahulu.";

export default async function MasukPage({ searchParams }: MasukPageProps) {
  const { daftar } = await searchParams;

  // Server Action: menjalankan validator bersama di server sehingga aturan
  // tidak diduplikasi di klien (lihat catatan di auth-form.tsx).
  async function validate(values: AuthFormValues) {
    "use server";
    return validateLogin({ email: values.email, password: values.password });
  }

  return <AuthForm mode="login" notice={daftar === "berhasil" ? REGISTER_NOTICE : undefined} onValidate={validate} />;
}
