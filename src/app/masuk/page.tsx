import { AuthForm, type AuthFormValues } from "@/components/auth-form";
import { validateLogin } from "@/lib/auth/validation";
import { serverT } from "@/lib/page-i18n";
import { pageMetadata } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("masuk");
}

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
