import type { Metadata } from "next";
import { AuthForm, type AuthFormValues } from "@/components/auth-form";
import { validateLogin } from "@/lib/auth/validation";
import { serverT } from "@/lib/page-i18n";

export const metadata: Metadata = {
  title: "Kawan — Chat AI by tokengateway.ai.id",
  description: "Masuk ke Kawan dengan email dan kata sandi.",
};

type MasukPageProps = {
  searchParams: Promise<{ daftar?: string }>;
};

export default async function MasukPage({ searchParams }: MasukPageProps) {
  const t = await serverT();
  const { daftar } = await searchParams;

  // Server Action: menjalankan validator bersama di server sehingga aturan
  // tidak diduplikasi di klien (lihat catatan di auth-form.tsx).
  async function validate(values: AuthFormValues) {
    "use server";
    return validateLogin({ email: values.email, password: values.password });
  }

  return <AuthForm mode="login" notice={daftar === "berhasil" ? t("register.successNotice") : undefined} onValidate={validate} />;
}
