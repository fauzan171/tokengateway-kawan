import { AuthForm, type AuthFormValues } from "@/components/auth-form";
import { validateRegister } from "@/lib/auth/validation";
import { readAppConfig } from "@/lib/admin/config";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { serverT } from "@/lib/page-i18n";
import { pageMetadata } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("daftar");
}

export default async function DaftarPage() {
  const t = await serverT();
  // Server Action: memakai `validateRegister` apa adanya, sehingga aturan
  // panjang kata sandi dan kecocokan konfirmasi tetap satu sumber kebenaran.
  async function validate(values: AuthFormValues) {
    "use server";
    return validateRegister({
      email: values.email,
      name: values.name === "" ? undefined : values.name,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });
  }

  // Keadaan ditutup dijelaskan sebelum pengguna mengisi apa pun; POST tetap
  // menolak sendiri, jadi halaman ini hanya lapis tampilan.
  const open = await isRegistrationOpen();

  return (
    <AuthForm
      mode="register"
      notice={open ? undefined : t("register.closed")}
      closed={!open}
      onValidate={validate}
    />
  );
}

/** Gagal membaca konfigurasi diperlakukan sebagai "terbuka": POST tetap
 *  memutuskan, dan halaman pendaftaran tidak boleh mati karena galat baca. */
async function isRegistrationOpen(): Promise<boolean> {
  try {
    const db = await getDb(loadConfig().databaseUrl);
    return (await readAppConfig(db)).registrationOpen;
  } catch {
    return true;
  }
}
